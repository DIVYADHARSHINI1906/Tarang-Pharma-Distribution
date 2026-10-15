import os
import shutil
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.models.schemas import (
    HealthResponse, MetricsResponse, ClaimDetail, BatchProcessRequest,
    BatchProcessSummary, DecisionOverride, ClaimInput
)
from backend.app.rules.claims_service import claims_service
from backend.app.ocr.engine import ocr_engine


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health():
    tess_avail = Path(settings.TESSERACT_CMD).exists()
    # Check images directory
    img_count = len([f for f in settings.IMAGES_DIR.iterdir() if f.is_file()]) if settings.IMAGES_DIR.exists() else 0
    
    return HealthResponse(
        status="healthy",
        ocr_engine=settings.OCR_ENGINE,
        tesseract_available=tess_avail,
        winrt_ocr_available=True,  # Built-in to Windows
        dataset_claims_train_rows=283,
        dataset_claims_test_rows=190,
        dataset_employees_rows=16,
        images_available=img_count,
        config={
            "auto_approve_threshold": settings.AUTO_APPROVE_THRESHOLD,
            "amount_tolerance": settings.AMOUNT_TOLERANCE,
            "food_limit_without_approval": settings.FOOD_LIMIT_WITHOUT_APPROVAL,
            "lodging_m1_m2_limit": settings.LODGING_M1_M2_LIMIT,
            "lodging_m3_limit": settings.LODGING_M3_LIMIT,
            "confidence_min_auto_approve": settings.CONFIDENCE_MIN_AUTO_APPROVE,
            "images_dir": str(settings.IMAGES_DIR),
            "tesseract_cmd": settings.TESSERACT_CMD
        }
    )


@router.get("/claims", response_model=List[ClaimDetail])
def list_claims(
    search: Optional[str] = Query(None, description="Search by claim ID, employee name, or vendor"),
    decision: Optional[str] = Query(None, description="Filter by decision: 'approve' or 'review'"),
    category: Optional[str] = Query(None, description="Filter by category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500)
):
    claims = list(claims_service.claims_store.values())
    
    if search:
        s = search.lower().strip()
        claims = [
            c for c in claims
            if s in c.claim_id.lower() or s in c.emp_name.lower() or s in c.claimed_vendor.lower() or s in c.emp_id.lower()
        ]
        
    if decision:
        d = decision.lower().strip()
        claims = [
            c for c in claims
            if (c.override.override_decision.lower() if c.override else c.validation.decision.lower()) == d
        ]
        
    if category:
        cat = category.lower().strip()
        claims = [c for c in claims if c.category.lower() == cat]
        
    return claims[skip:skip + limit]


@router.get("/claims/{claim_id}", response_model=ClaimDetail)
def get_claim(claim_id: str):
    if claim_id not in claims_service.claims_store:
        raise HTTPException(status_code=404, detail=f"Claim '{claim_id}' not found.")
    return claims_service.claims_store[claim_id]


@router.post("/claims/{claim_id}/process", response_model=ClaimDetail)
def process_claim_endpoint(claim_id: str):
    detail = claims_service.process_claim(claim_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Claim '{claim_id}' not found.")
    return detail


@router.post("/claims/{claim_id}/override", response_model=ClaimDetail)
def override_claim_decision(claim_id: str, override: DecisionOverride):
    updated = claims_service.apply_override(claim_id, override)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Claim '{claim_id}' not found.")
    return updated


@router.post("/claims/extract", response_model=ClaimDetail)
async def extract_receipt(
    claim_id: str = Form("CLM-CUSTOM"),
    emp_id: str = Form("TPD-0412"),
    category: str = Form("Food"),
    vendor: str = Form(""),
    amount_claimed: str = Form("0.0"),
    expense_date: str = Form(""),
    rep_comment: str = Form(""),
    receipt_file: Optional[UploadFile] = File(None),
    image_filename: Optional[str] = Form(None)
):
    saved_path = None
    if receipt_file and receipt_file.filename:
        # Validate MIME or extension
        allowed_extensions = {".jpg", ".jpeg", ".png", ".bmp"}
        ext = Path(receipt_file.filename).suffix.lower()
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Allowed extensions: {', '.join(allowed_extensions)}"
            )
            
        dest = settings.IMAGES_DIR / receipt_file.filename
        with open(dest, "wb") as buffer:
            shutil.copyfileobj(receipt_file.file, buffer)
        saved_path = str(dest)
    elif image_filename:
        saved_path = image_filename

    detail = claims_service.process_custom_claim(
        claim_id=claim_id,
        emp_id=emp_id,
        category=category,
        vendor=vendor,
        amount_claimed=amount_claimed,
        expense_date=expense_date,
        rep_comment=rep_comment,
        image_path=saved_path
    )
    return detail


@router.post("/claims/batch", response_model=BatchProcessSummary)
def run_batch(request: BatchProcessRequest):
    return claims_service.batch_process(dataset_type=request.dataset_type, limit=request.limit)


@router.get("/metrics", response_model=MetricsResponse)
def get_metrics():
    return claims_service.get_metrics()


@router.get("/predictions/download")
def download_predictions():
    csv_path = settings.PREDICTIONS_CSV
    if not csv_path.exists():
        # Trigger prediction generator if not already generated
        from scripts.generate_predictions import generate_submission
        generate_submission()
        
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="predictions.csv not found.")
        
    return FileResponse(
        path=str(csv_path),
        filename="predictions.csv",
        media_type="text/csv"
    )


@router.get("/images/{filename}")
def serve_image(filename: str):
    resolved, err = ocr_engine.resolve_image_path(filename)
    if not resolved or not resolved.exists():
        raise HTTPException(status_code=404, detail=f"Image '{filename}' not found.")
        
    ext = resolved.suffix.lower()
    media_type = "image/jpeg"
    if ext == ".png":
        media_type = "image/png"
    elif ext == ".bmp":
        media_type = "image/bmp"
        
    return FileResponse(path=str(resolved), media_type=media_type)
