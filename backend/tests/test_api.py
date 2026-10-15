import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import settings


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["dataset_claims_train_rows"] == 283
    assert data["dataset_claims_test_rows"] == 190
    assert data["dataset_employees_rows"] == 16
    assert data["images_available"] > 0
    assert "auto_approve_threshold" in data["config"]


def test_list_claims(client):
    response = client.get("/api/claims?limit=10")
    assert response.status_code == 200
    claims = response.json()
    assert len(claims) == 10
    first = claims[0]
    assert "claim_id" in first
    assert "emp_id" in first
    assert "extracted" in first
    assert "validation" in first


def test_get_claim_detail(client):
    response = client.get("/api/claims/CLM-30412")
    assert response.status_code == 200
    data = response.json()
    assert data["claim_id"] == "CLM-30412"
    assert data["emp_id"] == "TPD-0490"
    assert data["category"] == "Food"


def test_get_metrics(client):
    response = client.get("/api/metrics")
    assert response.status_code == 200
    metrics = response.json()
    assert "total_claims" in metrics
    assert "auto_approved" in metrics
    assert "sent_to_review" in metrics
    assert "estimated_hours_saved" in metrics
    assert metrics["total_claims"] > 0


def test_claim_override(client):
    payload = {
        "override_decision": "approve",
        "reason": "Audited in person with hard copy invoice",
        "reviewer": "Priya Bhende (Senior Accounts Executive)"
    }
    response = client.post("/api/claims/CLM-30412/override", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["override"] is not None
    assert data["override"]["override_decision"] == "approve"
    assert data["override"]["reviewer"] == "Priya Bhende (Senior Accounts Executive)"


def test_extract_endpoint(client):
    import io
    from PIL import Image, ImageDraw

    # Create a small in-memory test image
    img = Image.new("RGB", (400, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "Indian Oil Corporation", fill=(0, 0, 0))
    draw.text((10, 40), "Date: 15/07/2026", fill=(0, 0, 0))
    draw.text((10, 70), "Bill No: IOC-9921", fill=(0, 0, 0))
    draw.text((10, 100), "GSTIN: 27AABCI1234F1Z5", fill=(0, 0, 0))
    draw.text((10, 130), "TOTAL: Rs 450.00", fill=(0, 0, 0))
    
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = {"receipt_image": ("receipt.jpg", buf, "image/jpeg")}
    data = {
        "claim_id": "TEST-CLAIM-99",
        "emp_id": "TPD-0490",
        "claimed_vendor": "Indian Oil Corporation",
        "claimed_amount": "450.00",
        "expense_date": "2026-07-15",
        "category": "Fuel",
        "rep_comment": "Petrol for HQ travel"
    }

    response = client.post("/api/claims/extract", files=files, data=data)
    assert response.status_code == 200
    res = response.json()
    assert "extracted" in res
    assert "validation" in res
    assert "decision" in res["validation"]
    assert res["validation"]["decision"] in ["approve", "review"]

