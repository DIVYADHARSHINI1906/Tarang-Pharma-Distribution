from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field


class FieldConfidence(BaseModel):
    vendor: float = Field(0.0, description="Heuristic confidence indicator for vendor")
    receipt_date: float = Field(0.0, description="Heuristic confidence indicator for receipt date")
    receipt_number: float = Field(0.0, description="Heuristic confidence indicator for receipt number")
    gstin: float = Field(0.0, description="Heuristic confidence indicator for GSTIN")
    total_amount: float = Field(0.0, description="Heuristic confidence indicator for total amount")


class ExtractedReceipt(BaseModel):
    vendor: str = Field("", description="Extracted vendor name")
    receipt_date: str = Field("", description="Normalized receipt date YYYY-MM-DD")
    receipt_number: str = Field("", description="Extracted receipt/bill/invoice/AWB number")
    gstin: str = Field("", description="15-character GSTIN if present and valid")
    total_amount: Optional[float] = Field(None, description="Extracted numeric total payable amount")
    confidence: FieldConfidence = Field(default_factory=FieldConfidence)
    warnings: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = Field(None, description="Raw OCR text for audit")


class ClaimInput(BaseModel):
    claim_id: str
    emp_id: str
    submitted_on: Optional[str] = ""
    expense_date: str
    category: str
    vendor: str
    amount_claimed: str
    rep_comment: Optional[str] = ""
    image_file: Optional[str] = ""


class ValidationResult(BaseModel):
    decision: str = Field(..., description="'approve' or 'review'")
    reasons: List[str] = Field(default_factory=list, description="Explanatory decision reasons")
    checks: Dict[str, bool] = Field(default_factory=dict, description="Detailed boolean check status")
    warnings: List[str] = Field(default_factory=list)


class DecisionOverride(BaseModel):
    override_decision: str = Field(..., description="'approve' or 'review'")
    reason: str = Field(..., description="Mandatory reason for decision override")
    reviewer: str = Field("Demo Reviewer", description="Name/role of reviewer performing override")
    timestamp: Optional[str] = None


class ClaimDetail(BaseModel):
    claim_id: str
    emp_id: str
    emp_name: Optional[str] = ""
    emp_designation: Optional[str] = ""
    emp_headquarter: Optional[str] = ""
    emp_vehicle_no: Optional[str] = ""
    emp_grade: Optional[str] = ""
    submitted_on: str = ""
    expense_date: str
    category: str
    claimed_vendor: str
    claimed_amount: float
    claimed_amount_raw: str
    rep_comment: str = ""
    image_file: str = ""
    image_resolved_path: Optional[str] = None
    image_available: bool = False
    extracted: ExtractedReceipt
    validation: ValidationResult
    override: Optional[DecisionOverride] = None


class BatchProcessRequest(BaseModel):
    dataset_type: str = Field("test", description="'train', 'test', or 'custom'")
    limit: Optional[int] = Field(None, description="Optional row limit for batch run")


class BatchProcessSummary(BaseModel):
    total_processed: int
    auto_approved: int
    sent_to_review: int
    review_rate_pct: float
    missing_images: int
    amount_mismatches: int
    potential_duplicates: int
    duration_seconds: float


class HealthResponse(BaseModel):
    status: str
    ocr_engine: str
    tesseract_available: bool
    winrt_ocr_available: bool
    dataset_claims_train_rows: int
    dataset_claims_test_rows: int
    dataset_employees_rows: int
    images_available: int
    config: Dict[str, Any]


class MetricsResponse(BaseModel):
    total_claims: int
    auto_approved: int
    sent_to_review: int
    review_rate: float
    missing_receipts: int
    amount_mismatches: int
    potential_duplicates: int
    low_value_claims: int
    high_value_claims: int
    estimated_hours_saved: float
    estimated_monthly_value_rs: float
    field_accuracies: Optional[Dict[str, Any]] = None
