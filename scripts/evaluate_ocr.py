import csv
import re
import sys
import argparse
import difflib
from pathlib import Path
from collections import defaultdict, Counter
from typing import Dict, List, Any, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.config import settings
from backend.app.ocr.engine import ocr_engine
from backend.app.rules.decision_engine import decision_engine


def normalize_str(s: str) -> str:
    if not s:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', s).lower()


def evaluate_dataset(sample_limit: Optional[int] = None, stratified: bool = True):
    train_csv = settings.TRAIN_CSV
    if not train_csv.exists():
        raise FileNotFoundError(f"claims_train.csv not found at {train_csv}")

    records = []
    with open(train_csv, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        for r in reader:
            records.append(r)

    print(f"Loaded {len(records)} reference records from claims_train.csv.")
    
    # Stratified selection if limit specified
    if sample_limit and sample_limit < len(records):
        by_category = defaultdict(list)
        for r in records:
            by_category[r['category']].append(r)
            
        selected = []
        per_cat = max(1, sample_limit // len(by_category))
        for cat, cat_records in by_category.items():
            selected.extend(cat_records[:per_cat])
        records = selected[:sample_limit]
        print(f"Evaluated on a representative stratified subset of {len(records)} claims across all {len(by_category)} categories.")
    else:
        print(f"Evaluating across all {len(records)} reference records.")

    # Tracking metrics
    total_samples = len(records)
    vendor_exact = 0
    vendor_fuzzy = 0
    date_matches = 0
    bill_no_exact = 0
    gstin_exact = 0
    amount_exact = 0
    amount_within_10 = 0
    
    field_counts = {
        'vendor': 0,
        'date': 0,
        'bill_no': 0,
        'gstin': 0,
        'amount': 0
    }
    
    ocr_failures = 0
    missing_images = 0
    
    error_analysis = {
        'blurry_or_unreadable': [],
        'missing_photo': [],
        'faded_thermal_paper': [],
        'vendor_spelling_variation': [],
        'date_format_variance': [],
        'multiple_totals_ambiguity': [],
        'clerk_transcription_discrepancy': []
    }

    for idx, r in enumerate(records):
        cid = r['claim_id'].strip()
        cat = r.get('category', '').strip()
        clerk_v = r.get('clerk_vendor', '').strip()
        clerk_d = r.get('clerk_bill_date', '').strip()
        clerk_no = r.get('clerk_bill_no', '').strip()
        clerk_amt = r.get('clerk_bill_amount', '').strip()
        clerk_g = r.get('clerk_gstin', '').strip()
        img_file = r.get('image_file', '').strip()

        resolved_path, img_err = ocr_engine.resolve_image_path(img_file)
        if not resolved_path:
            missing_images += 1
            error_analysis['missing_photo'].append(cid)
            continue

        # Run OCR without passing clerk labels (zero data leakage)
        # We pass only claimed_vendor and claimed_amount which were submitted by representative
        extracted = ocr_engine.extract_from_image(
            str(resolved_path),
            claimed_vendor=r.get('vendor', '').strip(),
            claimed_amount=decision_engine._clean_num(r.get('amount_claimed', ''))
        )

        if not extracted.raw_text:
            ocr_failures += 1
            error_analysis['blurry_or_unreadable'].append(cid)
            continue

        # 1. Vendor Evaluation
        if clerk_v:
            field_counts['vendor'] += 1
            if normalize_str(extracted.vendor) == normalize_str(clerk_v):
                vendor_exact += 1
                vendor_fuzzy += 1
            elif difflib.SequenceMatcher(None, normalize_str(extracted.vendor), normalize_str(clerk_v)).ratio() >= 0.70:
                vendor_fuzzy += 1
                error_analysis['vendor_spelling_variation'].append((cid, clerk_v, extracted.vendor))

        # 2. Date Evaluation
        if clerk_d:
            field_counts['date'] += 1
            # Normalize clerk date to YYYY-MM-DD
            norm_clerk_d = decision_engine._normalize_date(clerk_d)
            if extracted.receipt_date == norm_clerk_d:
                date_matches += 1
            elif extracted.receipt_date:
                error_analysis['date_format_variance'].append((cid, clerk_d, extracted.receipt_date))

        # 3. Bill / Invoice Number Evaluation
        if clerk_no and clerk_no.upper() not in {'NA', 'NONE', 'NIL'}:
            field_counts['bill_no'] += 1
            if normalize_str(extracted.receipt_number) == normalize_str(clerk_no):
                bill_no_exact += 1

        # 4. GSTIN Evaluation
        if clerk_g and len(clerk_g) >= 10:
            field_counts['gstin'] += 1
            if normalize_str(extracted.gstin) == normalize_str(clerk_g):
                gstin_exact += 1

        # 5. Amount Evaluation
        clerk_amt_num = decision_engine._clean_num(clerk_amt)
        if clerk_amt_num > 0:
            field_counts['amount'] += 1
            if extracted.total_amount is not None:
                diff = abs(extracted.total_amount - clerk_amt_num)
                if diff < 0.01:
                    amount_exact += 1
                    amount_within_10 += 1
                elif diff <= 10.0:
                    amount_within_10 += 1
                else:
                    error_analysis['multiple_totals_ambiguity'].append((cid, clerk_amt_num, extracted.total_amount))

    # Calculate Percentages
    v_exact_pct = (vendor_exact / field_counts['vendor'] * 100.0) if field_counts['vendor'] else 0.0
    v_fuzzy_pct = (vendor_fuzzy / field_counts['vendor'] * 100.0) if field_counts['vendor'] else 0.0
    d_pct = (date_matches / field_counts['date'] * 100.0) if field_counts['date'] else 0.0
    b_pct = (bill_no_exact / field_counts['bill_no'] * 100.0) if field_counts['bill_no'] else 0.0
    g_pct = (gstin_exact / field_counts['gstin'] * 100.0) if field_counts['gstin'] else 0.0
    a_exact_pct = (amount_exact / field_counts['amount'] * 100.0) if field_counts['amount'] else 0.0
    a_within_10_pct = (amount_within_10 / field_counts['amount'] * 100.0) if field_counts['amount'] else 0.0

    print("\n=======================================================")
    print(" TARANG EXPENSE INTELLIGENCE — OCR EVALUATION REPORT")
    print("=======================================================")
    print(f"Evaluated Samples: {total_samples}")
    print(f"Missing Photos (Upload Failures): {missing_images}")
    print(f"Unreadable Photos: {ocr_failures}")
    print("-------------------------------------------------------")
    print(f"Vendor Exact Match:       {vendor_exact}/{field_counts['vendor']} ({v_exact_pct:.1f}%)")
    print(f"Vendor Fuzzy (>=70%):     {vendor_fuzzy}/{field_counts['vendor']} ({v_fuzzy_pct:.1f}%)")
    print(f"Receipt Date (YYYY-MM-DD):{date_matches}/{field_counts['date']} ({d_pct:.1f}%)")
    print(f"Bill / Receipt Number:    {bill_no_exact}/{field_counts['bill_no']} ({b_pct:.1f}%)")
    print(f"GSTIN Format Match:       {gstin_exact}/{field_counts['gstin']} ({g_pct:.1f}%)")
    print(f"Amount Exact Match:       {amount_exact}/{field_counts['amount']} ({a_exact_pct:.1f}%)")
    print(f"Amount within Rs 10:      {amount_within_10}/{field_counts['amount']} ({a_within_10_pct:.1f}%)")
    print("=======================================================")
    print("\nERROR ANALYSIS SUMMARY (OBSERVED IN DATASET):")
    print(f"- Missing Photos: {len(error_analysis['missing_photo'])} claims")
    print(f"- Blurry/Thermal Degradation: {len(error_analysis['blurry_or_unreadable'])} claims")
    print(f"- Vendor Spelling/Alias Discrepancies: {len(error_analysis['vendor_spelling_variation'])} claims")
    print(f"- Date OCR Variances: {len(error_analysis['date_format_variance'])} claims")
    print(f"- Amount Differences (> Rs 10): {len(error_analysis['multiple_totals_ambiguity'])} claims")
    print("=======================================================\n")

    return {
        "total_samples": total_samples,
        "vendor_exact": v_exact_pct,
        "vendor_fuzzy": v_fuzzy_pct,
        "date_accuracy": d_pct,
        "bill_no_accuracy": b_pct,
        "gstin_accuracy": g_pct,
        "amount_exact": a_exact_pct,
        "amount_within_10": a_within_10_pct,
        "missing_images": missing_images,
        "ocr_failures": ocr_failures
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate OCR pipeline on reference labels")
    parser.add_argument("--limit", type=int, default=None, help="Optional sample limit for quick run")
    parser.add_argument("--stratified", action="store_true", default=True, help="Use stratified sampling if limit set")
    args = parser.parse_args()
    evaluate_dataset(sample_limit=args.limit, stratified=args.stratified)
