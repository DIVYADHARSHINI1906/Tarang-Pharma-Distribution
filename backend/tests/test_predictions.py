import csv
import re
from pathlib import Path
from backend.app.config import settings


def test_predictions_csv_integrity():
    pred_path = settings.PREDICTIONS_CSV
    sample_path = settings.SAMPLE_SUBMISSION_CSV

    assert pred_path.exists(), f"predictions.csv does not exist at {pred_path}"
    assert sample_path.exists(), f"sample_submission.csv does not exist at {sample_path}"

    with open(sample_path, 'r', encoding='utf-8') as f:
        sample_reader = csv.DictReader(f)
        expected_cols = sample_reader.fieldnames
        expected_ids = [r['claim_id'].strip() for r in sample_reader]

    with open(pred_path, 'r', encoding='utf-8') as f:
        pred_reader = csv.DictReader(f)
        actual_cols = pred_reader.fieldnames
        pred_rows = list(pred_reader)

    # 1. Exact columns & order
    assert actual_cols == expected_cols, f"Column mismatch: {actual_cols} != {expected_cols}"

    # 2. Row count
    assert len(pred_rows) == 190, f"Expected 190 rows, got {len(pred_rows)}"
    assert len(pred_rows) == len(expected_ids)

    # 3. Every row validation
    for i, (row, exp_id) in enumerate(zip(pred_rows, expected_ids)):
        cid = row['claim_id'].strip()
        assert cid == exp_id, f"Row {i}: claim_id mismatch {cid} != {exp_id}"
        
        dec = row['decision'].strip().lower()
        assert dec in {'approve', 'review'}, f"Row {i}: Invalid decision '{dec}'"
        
        d = row['receipt_date'].strip()
        if d:
            assert re.match(r'^\d{4}-\d{2}-\d{2}$', d), f"Row {i}: Date '{d}' not in YYYY-MM-DD format"
            
        amt = row['total_amount'].strip()
        if amt:
            assert re.match(r'^\d+(?:\.\d+)?$', amt), f"Row {i}: Amount '{amt}' is not numeric"
            
        # No raw NaN or null literals
        for col, val in row.items():
            assert val.lower() not in {'nan', 'null', 'undefined'}, f"Row {i} {col} has invalid value '{val}'"
