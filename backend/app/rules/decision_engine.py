import csv
import re
import difflib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

from backend.app.config import settings
from backend.app.models.schemas import ExtractedReceipt, ValidationResult, ClaimInput


class DecisionEngine:
    def __init__(self):
        self.employees: Dict[str, Dict[str, str]] = {}
        self.historical_claims: Dict[str, Dict[str, Any]] = {}
        self.bill_no_to_claim: Dict[str, str] = {}
        self.image_to_claim: Dict[str, str] = {}
        self._load_reference_data()

    def _load_reference_data(self):
        # Load employees
        if settings.EMPLOYEES_CSV.exists():
            with open(settings.EMPLOYEES_CSV, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.DictReader(f)
                for r in reader:
                    self.employees[r['emp_id'].strip()] = {
                        'name': r.get('name', '').strip(),
                        'designation': r.get('designation', '').strip(),
                        'headquarter': r.get('headquarter', '').strip(),
                        'manager_id': r.get('manager_id', '').strip(),
                        'vehicle_no': r.get('vehicle_no', '').strip(),
                        'grade': r.get('grade', '').strip(),
                    }

        # Load historical train claims for duplicate detection
        if settings.TRAIN_CSV.exists():
            with open(settings.TRAIN_CSV, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.DictReader(f)
                for r in reader:
                    cid = r['claim_id'].strip()
                    bill_no = r.get('clerk_bill_no', '').strip().upper()
                    img = Path(r.get('image_file', '')).name.lower()
                    amt = self._clean_num(r.get('amount_claimed', ''))
                    
                    self.historical_claims[cid] = {
                        'claim_id': cid,
                        'emp_id': r.get('emp_id', '').strip(),
                        'category': r.get('category', '').strip(),
                        'vendor': r.get('vendor', '').strip(),
                        'amount': amt,
                        'bill_no': bill_no,
                        'image': img,
                        'status': r.get('status', '').strip()
                    }
                    if bill_no and len(bill_no) >= 3 and bill_no not in {'NA', 'NONE', 'NIL'}:
                        self.bill_no_to_claim[bill_no] = cid
                    if img:
                        self.image_to_claim[img] = cid

    def evaluate_claim(
        self,
        claim_id: str,
        emp_id: str,
        category: str,
        claimed_vendor: str,
        amount_claimed_raw: str,
        expense_date_raw: str,
        rep_comment: str = "",
        image_file: str = "",
        extracted: Optional[ExtractedReceipt] = None,
        image_available: bool = True
    ) -> ValidationResult:
        reasons = []
        warnings = []
        checks = {}
        
        claimed_amt = self._clean_num(amount_claimed_raw)
        emp_info = self.employees.get(emp_id, {})
        grade = emp_info.get('grade', 'M1')
        
        # Check A: Receipt Availability & Readability
        if not image_available or not extracted:
            checks["receipt_available"] = False
            checks["receipt_readable"] = False
            reasons.append("Receipt photo is not attached or failed upload.")
            return ValidationResult(decision="review", reasons=reasons, checks=checks, warnings=warnings)
            
        checks["receipt_available"] = True
        
        raw_text = extracted.raw_text or ""
        lines_count = len([l for l in raw_text.splitlines() if l.strip()])
        if lines_count < 2:
            checks["receipt_readable"] = False
            reasons.append("Receipt photo is unreadable or blurred.")
            return ValidationResult(decision="review", reasons=reasons, checks=checks, warnings=warnings)
            
        checks["receipt_readable"] = True

        # Check B: Receipt Amount vs Claimed Amount (with policy ₹10 rounding tolerance)
        if extracted.total_amount is None:
            checks["amount_match"] = False
            reasons.append("Total bill amount could not be verified from the photo.")
        else:
            diff = abs(claimed_amt - extracted.total_amount)
            if diff <= settings.AMOUNT_TOLERANCE:
                checks["amount_match"] = True
            else:
                checks["amount_match"] = False
                reasons.append(
                    f"Receipt amount (Rs {extracted.total_amount:,.2f}) differs from claimed amount (Rs {claimed_amt:,.2f})."
                )

        # Check C: Vendor Match
        if extracted.vendor:
            is_match = self._match_vendor(claimed_vendor, extracted.vendor)
            checks["vendor_match"] = is_match
            if not is_match:
                reasons.append(
                    f"Extracted vendor '{extracted.vendor}' does not match claimed vendor '{claimed_vendor}'."
                )
        else:
            checks["vendor_match"] = False
            warnings.append("Vendor name could not be identified with certainty from receipt.")

        # Check D: Receipt Date Match
        if extracted.receipt_date:
            norm_exp_date = self._normalize_date(expense_date_raw)
            if norm_exp_date:
                days_diff = self._date_diff_days(norm_exp_date, extracted.receipt_date)
                if abs(days_diff) <= 3:
                    checks["date_match"] = True
                else:
                    checks["date_match"] = False
                    reasons.append(
                        f"Receipt date ({extracted.receipt_date}) differs from claimed expense date ({norm_exp_date})."
                    )
            else:
                checks["date_match"] = True
        else:
            checks["date_match"] = True  # Not hard failing if OCR missed date but other fields pass
            warnings.append("Receipt date not clearly detected in photo.")

        # Check E & F & G & H: Duplicate Detection
        bill_no_clean = extracted.receipt_number.strip().upper() if extracted.receipt_number else ""
        checks["possible_duplicate"] = False
        
        # Check repeated bill number across claims
        if bill_no_clean and len(bill_no_clean) >= 3 and bill_no_clean not in {'NA', 'NONE', 'NIL'}:
            prev_claim = self.bill_no_to_claim.get(bill_no_clean)
            if prev_claim and prev_claim != claim_id:
                checks["possible_duplicate"] = True
                reasons.append(f"Possible duplicate receipt: bill number '{bill_no_clean}' previously used in claim {prev_claim}.")
                
        # Check same photo filename claimed by another representative
        img_name = Path(image_file).name.lower()
        clean_img_name = re.sub(r'^[0-9a-fA-F-]{36,37}-', '', img_name)
        if clean_img_name:
            prev_claim_img = self.image_to_claim.get(clean_img_name)
            if prev_claim_img and prev_claim_img != claim_id:
                prev_emp = self.historical_claims.get(prev_claim_img, {}).get('emp_id')
                if prev_emp and prev_emp != emp_id:
                    checks["possible_duplicate"] = True
                    reasons.append(f"Duplicate receipt photo: already submitted by colleague in claim {prev_claim_img}.")

        # Check I & J & K & L & M: Policy-Specific Checks
        cat_lower = category.strip().lower()
        checks["policy_checks_passed"] = True

        # Food Limit Check
        if cat_lower == "food":
            if claimed_amt > settings.FOOD_LIMIT_WITHOUT_APPROVAL:
                checks["policy_checks_passed"] = False
                reasons.append(f"Food expense Rs {claimed_amt:,.2f} exceeds Rs {settings.FOOD_LIMIT_WITHOUT_APPROVAL:,.0f} limit requiring prior approval.")

        # Lodging GST and Grade Limit Check
        elif cat_lower == "lodging":
            # Hotel bill must be GST tax invoice with GSTIN
            if not extracted.gstin:
                checks["policy_checks_passed"] = False
                reasons.append("Lodging claim requires a valid GST tax invoice with printed GSTIN.")
            
            # Grade ceiling check
            max_limit = settings.LODGING_M3_LIMIT if grade == 'M3' else settings.LODGING_M1_M2_LIMIT
            if claimed_amt > max_limit:
                checks["policy_checks_passed"] = False
                reasons.append(f"Lodging claim Rs {claimed_amt:,.2f} exceeds Grade {grade} policy limit of Rs {max_limit:,.0f} per night.")

        # Fuel Vehicle Requirement Check
        elif cat_lower == "fuel":
            reg_vehicle = emp_info.get('vehicle_no', '').replace(' ', '').upper()
            if not reg_vehicle:
                checks["policy_checks_passed"] = False
                reasons.append("Fuel claim submitted without registered employee vehicle on record.")
            else:
                # If vehicle number visible on bill, verify state/city prefix
                veh_match = re.search(r'\b(MH[0-9]{2}[A-Z]{1,2}[0-9]{3,4})\b', raw_text.replace(' ', ''))
                if veh_match:
                    bill_veh = veh_match.group(1).upper()
                    # Check if at least first 4 chars match registration (e.g. MH31)
                    if bill_veh[:4] != reg_vehicle[:4]:
                        warnings.append(f"Vehicle number on fuel receipt ({bill_veh}) may differ from employee vehicle ({reg_vehicle}).")

        # Threshold Rule:
        # A claim >= Rs 2,000 must be sent for clerk review per Nilesh's policy
        # BUT a claim < Rs 2,000 is ONLY approved if ALL checks pass and evidence is solid!
        checks["below_threshold"] = (claimed_amt < settings.AUTO_APPROVE_THRESHOLD)
        
        if claimed_amt >= settings.AUTO_APPROVE_THRESHOLD:
            reasons.append(f"Amount Rs {claimed_amt:,.2f} is at or above the Rs {settings.AUTO_APPROVE_THRESHOLD:,.0f} threshold requiring clerk review.")
            return ValidationResult(decision="review", reasons=reasons, checks=checks, warnings=warnings)

        # For claims < ₹2,000:
        # Check if mandatory criteria pass:
        all_passed = (
            checks.get("receipt_available", False) and
            checks.get("receipt_readable", False) and
            checks.get("amount_match", False) and
            checks.get("vendor_match", True) and
            not checks.get("possible_duplicate", False) and
            checks.get("policy_checks_passed", False)
        )

        if all_passed and not reasons:
            return ValidationResult(
                decision="approve",
                reasons=["All policy checks passed: verified readable receipt, amount matches within policy tolerance."],
                checks=checks,
                warnings=warnings
            )
        else:
            if not reasons:
                reasons.append("One or more verification checks failed. Finance clerk review required.")
            return ValidationResult(
                decision="review",
                reasons=reasons,
                checks=checks,
                warnings=warnings
            )

    def _match_vendor(self, claimed: str, extracted: str) -> bool:
        c = claimed.lower().strip()
        e = extracted.lower().strip()
        if not c or not e:
            return True
            
        if c in e or e in c:
            return True
            
        # Fuel brand aliases
        fuel_aliases = {
            'bpcl': ['bharat petroleum', 'bpcl', 'laxmi auto fuels', 'service station'],
            'hpcl': ['hindustan petroleum', 'hpcl', 'kisan petroleum'],
            'ioc': ['indian oil', 'ioc', 'iocl', 'highway service'],
        }
        for brand, aliases in fuel_aliases.items():
            if any(a in c for a in aliases) and any(a in e for a in aliases):
                return True
                
        ratio = difflib.SequenceMatcher(None, c, e).ratio()
        return ratio >= 0.50

    def _clean_num(self, val_str: Any) -> float:
        if isinstance(val_str, (int, float)):
            return float(val_str)
        s = str(val_str).strip()
        # Strip currency prefixes: Rs., Rs, INR, etc.
        s = re.sub(r'^(?:rs|inr|₹)\.?\s*', '', s, flags=re.IGNORECASE)
        # Remove commas
        s = s.replace(',', '')
        # Extract first valid number
        m = re.search(r'\b\d+(?:\.\d+)?\b', s)
        if m:
            try:
                return float(m.group(0))
            except Exception:
                pass
        return 0.0

    def _normalize_date(self, d_str: str) -> Optional[str]:
        if not d_str:
            return None
        d = d_str.strip().replace('/', '-').replace('.', '-')
        parts = d.split('-')
        if len(parts) == 3:
            try:
                if len(parts[0]) == 4:
                    return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
                else:
                    yr = int(parts[2])
                    if yr < 100:
                        yr += 2000
                    return f"{yr:04d}-{int(parts[1]):02d}-{int(parts[0]):02d}"
            except Exception:
                pass
        return None

    def _date_diff_days(self, d1_str: str, d2_str: str) -> int:
        try:
            dt1 = datetime.strptime(d1_str, "%Y-%m-%d")
            dt2 = datetime.strptime(d2_str, "%Y-%m-%d")
            return (dt1 - dt2).days
        except Exception:
            return 0


# Singleton instance
decision_engine = DecisionEngine()
