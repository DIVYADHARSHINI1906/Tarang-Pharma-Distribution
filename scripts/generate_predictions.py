import csv
import re
import sys
from pathlib import Path

# Ensure project root is in python path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.config import settings
from backend.app.ocr.engine import ocr_engine
from backend.app.rules.decision_engine import decision_engine


def generate_submission():
    test_csv = settings.TEST_CSV
    sample_sub_csv = settings.SAMPLE_SUBMISSION_CSV
    out_csv = settings.PREDICTIONS_CSV

    if not test_csv.exists():
        raise FileNotFoundError(f"claims_test.csv not found at {test_csv}")
    if not sample_sub_csv.exists():
        raise FileNotFoundError(f"sample_submission.csv not found at {sample_sub_csv}")

    # Read sample submission to verify target IDs and columns
    with open(sample_sub_csv, 'r', encoding='utf-8') as f:
        sample_reader = csv.DictReader(f)
        expected_headers = sample_reader.fieldnames
        expected_ids = [r['claim_id'].strip() for r in sample_reader]

    print(f"Loaded {len(expected_ids)} target claim IDs from sample_submission.csv")
    print(f"Target columns: {expected_headers}")

    # Read test claims
    test_claims = []
    with open(test_csv, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        for r in reader:
            test_claims.append(r)

    print(f"Loaded {len(test_claims)} claims from claims_test.csv")

    output_rows = []
    approved_count = 0
    review_count = 0
    missing_img_count = 0

    for i, r in enumerate(test_claims):
        cid = r['claim_id'].strip()
        emp_id = r.get('emp_id', '').strip()
        cat = r.get('category', '').strip()
        claimed_vendor = r.get('vendor', '').strip()
        raw_amt = r.get('amount_claimed', '').strip()
        exp_date = r.get('expense_date', '').strip()
        rep_comment = r.get('rep_comment', '').strip()
        img_file = r.get('image_file', '').strip()

        claimed_amt = decision_engine._clean_num(raw_amt)
        resolved_path, img_err = ocr_engine.resolve_image_path(img_file)

        if not resolved_path:
            # Safe fallback for missing images: Never fabricate values
            missing_img_count += 1
            review_count += 1
            output_rows.append({
                "claim_id": cid,
                "vendor": "",
                "receipt_date": "",
                "receipt_number": "",
                "gstin": "",
                "total_amount": "",
                "decision": "review",
                "reason": "Receipt photo is not attached or upload failed."
            })
            continue

        # Extract fields from photo using local OCR
        extracted = ocr_engine.extract_from_image(
            str(resolved_path),
            claimed_vendor=claimed_vendor,
            claimed_amount=claimed_amt
        )

        # Run policy checks & decision engine
        val_result = decision_engine.evaluate_claim(
            claim_id=cid,
            emp_id=emp_id,
            category=cat,
            claimed_vendor=claimed_vendor,
            amount_claimed_raw=raw_amt,
            expense_date_raw=exp_date,
            rep_comment=rep_comment,
            image_file=img_file,
            extracted=extracted,
            image_available=True
        )

        decision = val_result.decision
        if decision == "approve":
            approved_count += 1
        else:
            review_count += 1

        # Format total amount: number only (no currency symbol) or blank
        amt_str = f"{extracted.total_amount:.2f}" if extracted.total_amount is not None else ""

        # Format short reason
        reason_str = " ".join(val_result.reasons)
        if not reason_str:
            reason_str = "Verified receipt within expense policy." if decision == "approve" else "Clerk verification required."

        output_rows.append({
            "claim_id": cid,
            "vendor": extracted.vendor,
            "receipt_date": extracted.receipt_date,
            "receipt_number": extracted.receipt_number,
            "gstin": extracted.gstin,
            "total_amount": amt_str,
            "decision": decision,
            "reason": reason_str
        })

    # Strict Validation against sample_submission.csv
    assert len(output_rows) == len(expected_ids), f"Row count mismatch! {len(output_rows)} vs {len(expected_ids)}"
    for out_r, exp_id in zip(output_rows, expected_ids):
        assert out_r['claim_id'] == exp_id, f"ID order mismatch: {out_r['claim_id']} != {exp_id}"
        assert out_r['decision'] in {'approve', 'review'}, f"Invalid decision: {out_r['decision']}"
        # Validate date format if present
        if out_r['receipt_date']:
            assert re.match(r'^\d{4}-\d{2}-\d{2}$', out_r['receipt_date']), f"Invalid date: {out_r['receipt_date']}"
        # Validate amount numeric only if present
        if out_r['total_amount']:
            assert re.match(r'^\d+(?:\.\d+)?$', str(out_r['total_amount'])), f"Non-numeric amount: {out_r['total_amount']}"

    # Write output predictions.csv
    with open(out_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=expected_headers)
        writer.writeheader()
        writer.writerows(output_rows)

    print("\n=======================================================")
    print(" PREDICTIONS.CSV GENERATED SUCCESSFULLY")
    print("=======================================================")
    print(f"File Location: {out_csv}")
    print(f"Total Rows: {len(output_rows)}")
    print(f"Auto-Approved: {approved_count} ({approved_count / len(output_rows) * 100:.1f}%)")
    print(f"Sent to Review: {review_count} ({review_count / len(output_rows) * 100:.1f}%)")
    print(f"Missing Photos (Handled via Safe Review): {missing_img_count}")
    print("=======================================================\n")
    return out_csv


if __name__ == "__main__":
    generate_submission()
