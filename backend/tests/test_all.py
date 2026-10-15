import pytest
from datetime import datetime
from pathlib import Path

from backend.app.config import settings
from backend.app.models.schemas import ExtractedReceipt, FieldConfidence
from backend.app.ocr.parser import normalize_date, clean_amount, extract_gstin, parse_receipt_text
from backend.app.rules.decision_engine import decision_engine


# 1. Date Normalization Tests
def test_date_normalization():
    assert normalize_date("08-06-2026") == "2026-06-08"
    assert normalize_date("09/06/26") == "2026-06-09"
    assert normalize_date("11.07.2026") == "2026-07-11"
    assert normalize_date("2026-07-15") == "2026-07-15"
    assert normalize_date("15-Jun-2026") == "2026-06-15"
    # Handles internal spaces from OCR
    assert normalize_date("1 1 / 96 / 26") == "2026-06-11"
    assert normalize_date("invalid-date") is None


# 2. Amount Normalization Tests
def test_amount_normalization():
    assert clean_amount("330.00") == 330.00
    assert clean_amount("325") == 325.00
    assert clean_amount("2,352.50") == 2352.50
    assert clean_amount("Rs 448.40") == 448.40
    assert clean_amount("141.6") == 141.60
    assert clean_amount("") is None
    assert clean_amount("not-a-number") is None


# 3. GSTIN Pattern Detection Tests
def test_gstin_pattern_detection():
    # Standard Maharashtra GSTIN (state code 27)
    g1, conf1, _ = extract_gstin("Tax Invoice GSTIN: 27PMLCE5129S3ZO Date: 08-06-2026")
    assert g1 == "27PMLCE5129S3ZO"
    assert conf1 >= 0.80

    # Lowercase text normalization
    g2, conf2, _ = extract_gstin("gstin 27aabcu9603r1zm")
    assert g2 == "27AABCU9603R1ZM"

    # Reject non-GSTINs (vehicle numbers, phone numbers, dates)
    g3, _, _ = extract_gstin("Vehicle No: MH31 EK 4471 Phone: 9822334455 Date: 08-06-2026")
    assert g3 == ""


# 4. Missing Receipt Handling Tests
def test_missing_receipt_handling():
    res = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-001",
        emp_id="TPD-0412",
        category="Food",
        claimed_vendor="Highway King Dhaba",
        amount_claimed_raw="350",
        expense_date_raw="08-06-2026",
        image_available=False,
        extracted=None
    )
    assert res.decision == "review"
    assert any("not attached" in r.lower() or "missing" in r.lower() for r in res.reasons)
    assert res.checks.get("receipt_available") is False


# 5. Amount Mismatch Tolerance Tests (Policy allows Rs 10 tolerance)
def test_amount_mismatch_check():
    # Within Rs 10 tolerance: 330 claimed vs 335 on bill -> Approved
    ext_pass = ExtractedReceipt(
        vendor="Highway King Dhaba",
        receipt_date="2026-06-08",
        receipt_number="BILL-1001",
        total_amount=335.0,
        confidence=FieldConfidence(total_amount=0.9),
        raw_text="Highway King Dhaba\nBILL-1001\nTOTAL 335.00"
    )
    res_pass = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-AMT1",
        emp_id="TPD-0490",
        category="Food",
        claimed_vendor="Highway King Dhaba",
        amount_claimed_raw="330",
        expense_date_raw="08-06-2026",
        image_available=True,
        extracted=ext_pass
    )
    assert res_pass.checks.get("amount_match") is True
    assert res_pass.decision == "approve"

    # Exceeding Rs 10 tolerance: 330 claimed vs 380 on bill -> Review
    ext_fail = ExtractedReceipt(
        vendor="Highway King Dhaba",
        receipt_date="2026-06-08",
        receipt_number="BILL-1002",
        total_amount=380.0,
        confidence=FieldConfidence(total_amount=0.9),
        raw_text="Highway King Dhaba\nBILL-1002\nTOTAL 380.00"
    )
    res_fail = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-AMT2",
        emp_id="TPD-0490",
        category="Food",
        claimed_vendor="Highway King Dhaba",
        amount_claimed_raw="330",
        expense_date_raw="08-06-2026",
        image_available=True,
        extracted=ext_fail
    )
    assert res_fail.checks.get("amount_match") is False
    assert res_fail.decision == "review"
    assert any("differs" in r.lower() for r in res_fail.reasons)


# 6. Duplicate Indicator Tests
def test_duplicate_indicators():
    # VX11449697 is already in historical claims
    ext_dup = ExtractedReceipt(
        vendor="Vidarbha Express Courier",
        receipt_number="VX11449697",
        total_amount=448.40,
        raw_text="Vidarbha Express Courier\nVX11449697\nTOTAL 448.40"
    )
    res = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-DUP",
        emp_id="TPD-0412",
        category="Courier",
        claimed_vendor="Vidarbha Express Courier",
        amount_claimed_raw="448.40",
        expense_date_raw="18-07-2026",
        image_available=True,
        extracted=ext_dup
    )
    assert res.checks.get("possible_duplicate") is True
    assert res.decision == "review"
    assert any("duplicate" in r.lower() for r in res.reasons)


# 7. Rs 2,000 Threshold Boundaries
def test_threshold_boundaries():
    ext = ExtractedReceipt(
        vendor="Hotel Rajdhani",
        receipt_date="2026-06-10",
        receipt_number="BILL-2001",
        total_amount=2000.0,
        raw_text="Hotel Rajdhani\nBILL-2001\nTOTAL 2000.00"
    )
    
    # Exactly Rs 2,000 -> Must be sent to review
    res_2000 = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-2000",
        emp_id="TPD-0412",
        category="Food",
        claimed_vendor="Hotel Rajdhani",
        amount_claimed_raw="2000",
        expense_date_raw="10-06-2026",
        image_available=True,
        extracted=ext
    )
    assert res_2000.decision == "review"
    assert any("2,000 threshold" in r for r in res_2000.reasons)

    # Rs 2,500 -> Must be sent to review
    res_2500 = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-2500",
        emp_id="TPD-0412",
        category="Food",
        claimed_vendor="Hotel Rajdhani",
        amount_claimed_raw="2500",
        expense_date_raw="10-06-2026",
        image_available=True,
        extracted=ext
    )
    assert res_2500.decision == "review"


# 8. Policy Checks: Lodging GST & Grade Limit
def test_policy_lodging():
    # Lodging without GSTIN -> Review
    ext_no_gst = ExtractedReceipt(
        vendor="Hotel Shubham",
        receipt_date="2026-06-15",
        receipt_number="HS-881",
        gstin="",
        total_amount=1800.0,
        raw_text="Hotel Shubham\nHS-881\nTOTAL 1800.00"
    )
    res_no_gst = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-LODGE-1",
        emp_id="TPD-0412",  # Grade M1
        category="Lodging",
        claimed_vendor="Hotel Shubham",
        amount_claimed_raw="1800",
        expense_date_raw="15-06-2026",
        image_available=True,
        extracted=ext_no_gst
    )
    assert res_no_gst.checks.get("policy_checks_passed") is False
    assert any("gst" in r.lower() for r in res_no_gst.reasons)

    # Lodging exceeding grade limit (M1 limit is 3,000)
    ext_high_lodge = ExtractedReceipt(
        vendor="Hotel Gulmohar",
        receipt_date="2026-06-15",
        receipt_number="HG-992",
        gstin="27PMLCE5129S3ZO",
        total_amount=3500.0,
        raw_text="Hotel Gulmohar\nGSTIN: 27PMLCE5129S3ZO\nTOTAL 3500.00"
    )
    res_high_lodge = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-LODGE-2",
        emp_id="TPD-0412",  # Grade M1
        category="Lodging",
        claimed_vendor="Hotel Gulmohar",
        amount_claimed_raw="3500",
        expense_date_raw="15-06-2026",
        image_available=True,
        extracted=ext_high_lodge
    )
    assert res_high_lodge.decision == "review"
    assert any("policy limit" in r.lower() for r in res_high_lodge.reasons)


# 9. Policy Checks: Food limit > Rs 2,500
def test_policy_food():
    ext_food = ExtractedReceipt(
        vendor="Green Leaf Restaurant",
        receipt_date="2026-06-20",
        receipt_number="GL-101",
        total_amount=2800.0,
        raw_text="Green Leaf Restaurant\nGL-101\nTOTAL 2800.00"
    )
    res = decision_engine.evaluate_claim(
        claim_id="CLM-TEST-FOOD",
        emp_id="TPD-0412",
        category="Food",
        claimed_vendor="Green Leaf Restaurant",
        amount_claimed_raw="2800",
        expense_date_raw="20-06-2026",
        image_available=True,
        extracted=ext_food
    )
    assert res.decision == "review"
    assert any("exceeds" in r.lower() and "2,500" in r for r in res.reasons)


# 10. API Health & Predictions Validation
def test_health_config():
    assert settings.AUTO_APPROVE_THRESHOLD == 2000.0
    assert settings.AMOUNT_TOLERANCE == 10.0
    assert settings.FOOD_LIMIT_WITHOUT_APPROVAL == 2500.0
    assert settings.LODGING_M1_M2_LIMIT == 3000.0
