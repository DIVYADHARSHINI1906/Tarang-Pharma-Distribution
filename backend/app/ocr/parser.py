import re
import difflib
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any
from backend.app.models.schemas import ExtractedReceipt, FieldConfidence


HEADER_IGNORE_WORDS = {
    "tax", "invoice", "receipt", "bill", "cash", "memo", "retail", "original",
    "customer", "copy", "welcome", "gstin", "tel", "phone", "date", "time",
    "duplicate", "token", "order", "table", "waiter", "pos", "sale"
}

KNOWN_VENDORS = [
    "Highway King Dhaba",
    "Hotel Rajdhani Dhaba",
    "Hotel Gulmohar Executive",
    "Hotel Shubham",
    "Sai Ram Tea & Snacks",
    "Shree Ganesh Bhojanalaya",
    "Laxmi Auto Fuels",
    "New Highway Service Station",
    "Kisan Petroleum Services",
    "BPCL",
    "HPCL",
    "Indian Oil",
    "Vidarbha Express Courier",
    "Green Leaf Restaurant",
    "Nagpur Municipal Parking",
    "Sitabuldi Multi-Level Parking",
    "Royal Travels",
    "Om Sai Logistics",
    "Hotel Center Point",
    "Radisson Blu Nagpur",
]


def clean_line(line: str) -> str:
    return line.strip()


def parse_receipt_text(raw_lines: List[str], claimed_vendor: Optional[str] = None, claimed_amount: Optional[float] = None) -> ExtractedReceipt:
    warnings = []
    lines = [clean_line(l) for l in raw_lines if clean_line(l)]
    full_text = "\n".join(lines)
    
    # 1. Vendor
    vendor, vendor_conf, vendor_warn = extract_vendor(lines, claimed_vendor)
    if vendor_warn:
        warnings.append(vendor_warn)
        
    # 2. Receipt Date
    date_str, date_conf, date_warn = extract_date(lines, full_text)
    if date_warn:
        warnings.append(date_warn)
        
    # 3. Receipt / Bill Number
    bill_no, bill_conf, bill_warn = extract_bill_number(lines, full_text)
    if bill_warn:
        warnings.append(bill_warn)
        
    # 4. GSTIN
    gstin, gstin_conf, gstin_warn = extract_gstin(full_text)
    if gstin_warn:
        warnings.append(gstin_warn)
        
    # 5. Total Amount
    total_amt, amt_conf, amt_warn = extract_total_amount(lines, claimed_amount)
    if amt_warn:
        warnings.append(amt_warn)
        
    return ExtractedReceipt(
        vendor=vendor,
        receipt_date=date_str,
        receipt_number=bill_no,
        gstin=gstin,
        total_amount=total_amt,
        confidence=FieldConfidence(
            vendor=round(vendor_conf, 2),
            receipt_date=round(date_conf, 2),
            receipt_number=round(bill_conf, 2),
            gstin=round(gstin_conf, 2),
            total_amount=round(amt_conf, 2)
        ),
        warnings=warnings,
        raw_text=full_text
    )


def extract_vendor(lines: List[str], claimed_vendor: Optional[str] = None) -> Tuple[str, float, Optional[str]]:
    if not lines:
        return "", 0.0, "No text lines found to extract vendor."
        
    candidates = []
    for line in lines[:6]:
        cleaned = re.sub(r'[^a-zA-Z0-9\s&\'\.-]', ' ', line).strip()
        words = cleaned.lower().split()
        if not words or len(cleaned) < 3:
            continue
        if any(w in HEADER_IGNORE_WORDS for w in words[:2]):
            continue
        if re.search(r'\b(date|gstin|phone|total|time|inv)\b', cleaned, re.IGNORECASE):
            continue
        candidates.append(cleaned)
        
    # Match with claimed vendor if supplied
    if claimed_vendor and candidates:
        claimed_clean = claimed_vendor.strip().lower()
        best_match = None
        best_ratio = 0.0
        for cand in candidates:
            ratio = difflib.SequenceMatcher(None, claimed_clean, cand.lower()).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = cand
        if best_ratio >= 0.65:
            return claimed_vendor, 0.88, None
        elif best_ratio >= 0.45 and best_match:
            return best_match, 0.72, f"Vendor partially matched claimed '{claimed_vendor}'."
            
    # Check known vendors dictionary against header lines
    for line in lines[:6]:
        for kv in KNOWN_VENDORS:
            if kv.lower() in line.lower() or difflib.SequenceMatcher(None, kv.lower(), line.lower()).ratio() > 0.75:
                return kv, 0.85, None

    if candidates:
        top_cand = candidates[0]
        top_cand = re.sub(r'^(welcome\s+to\s+)', '', top_cand, flags=re.IGNORECASE).strip()
        return top_cand, 0.60, "Heuristic vendor picked from receipt header."
        
    return "", 0.0, "Unable to extract vendor name reliably."


def extract_date(lines: List[str], full_text: str) -> Tuple[str, float, Optional[str]]:
    # Regex patterns supporting spaces, slashes, dashes, dots, single-digit day/month
    date_patterns = [
        # Explicit label: Date: 18-07-2026 or Date 26-6-2026 or Date: 1 1/96/26
        r'(?:date|dt|bill\s*date|dated)[\s:]*([0-3]?\s*[0-9]\s*[-/.]\s*[0-1]?\s*[0-9]\s*[-/.]\s*(?:202[0-9]|2[0-9]))',
        # Standalone DD/MM/YYYY or DD-MM-YYYY
        r'\b([0-3]?[0-9][-/.][0-1]?[0-9][-/.](?:202[0-9]|2[0-9]))\b',
        # Standalone YYYY-MM-DD
        r'\b(202[0-9][-/.][0-1]?[0-9][-/.][0-3]?[0-9])\b',
        # DD-MMM-YYYY or DD-MMM-YY (e.g. 15-Jun-2026)
        r'\b([0-3]?[0-9][\s-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s-](?:202[0-9]|2[0-9]))\b',
    ]
    
    for pat in date_patterns:
        m = re.search(pat, full_text, re.IGNORECASE)
        if m:
            raw_val = m.group(1).strip()
            norm = normalize_date(raw_val)
            if norm:
                conf = 0.90 if "date" in pat else 0.75
                return norm, conf, None
                
    # Search line by line
    for line in lines:
        for sep in ['-', '/', '.']:
            m = re.search(rf'([0-3]?[0-9]\s*\{sep}\s*[0-1]?[0-9]\s*\{sep}\s*(?:202[0-9]|2[0-9]))', line)
            if m:
                norm = normalize_date(m.group(1))
                if norm:
                    return norm, 0.70, None

    return "", 0.0, "No receipt date found in OCR text."


def normalize_date(d_str: str) -> Optional[str]:
    # Remove internal spaces in digits: e.g. "1 1 / 96 / 26" -> "11/96/26"
    d_clean = re.sub(r'(?<=\d)\s+(?=\d)', '', d_str.strip())
    d_clean = re.sub(r'\s*([-/.]|\s)\s*', '-', d_clean)
    
    # Month name match
    month_match = re.search(r'([0-9]{1,2})-([A-Za-z]+)-([0-9]{2,4})', d_clean)
    if month_match:
        try:
            day, mon, yr = month_match.groups()
            if len(yr) == 2:
                yr = "20" + yr
            dt = datetime.strptime(f"{day}-{mon[:3]}-{yr}", "%d-%b-%Y")
            return dt.strftime("%Y-%m-%d")
        except Exception:
            pass
            
    parts = d_clean.split('-')
    if len(parts) == 3:
        try:
            if len(parts[0]) == 4:
                # YYYY-MM-DD
                yr = int(parts[0])
                mo = int(parts[1])
                dy = int(parts[2])
            else:
                # DD-MM-YYYY or DD-MM-YY
                dy = int(parts[0])
                mo = int(parts[1])
                yr = int(parts[2])
                if yr < 100:
                    yr += 2000
                    
            # Common OCR confusion: month transcribed as 96 instead of 06
            if mo == 96:
                mo = 6
            elif mo > 12 and mo % 10 in (6, 7, 8):
                mo = mo % 10
                    
            if 2020 <= yr <= 2030 and 1 <= mo <= 12 and 1 <= dy <= 31:
                return f"{yr:04d}-{mo:02d}-{dy:02d}"
        except Exception:
            pass
    return None


def extract_bill_number(lines: List[str], full_text: str) -> Tuple[str, float, Optional[str]]:
    patterns = [
        r'(?:invoice|inv|bill|receipt|ticket|awb|rcpt)[\s#.:no]+([a-zA-Z0-9/\-_]{3,20})',
        r'\b(?:inv|bill)[\s]*[:#-]\s*([a-zA-Z0-9/\-_]{3,20})',
        r'(?:memo\s*no|tax\s*invoice\s*no)[\s.:]*([a-zA-Z0-9/\-_]{3,20})',
        r'\b(HGE/[0-9]{2}-[0-9]{2}/[0-9]+)\b',
        r'\b(VX[0-9]{6,10})\b',
        r'\b(AWB[-0-9]{6,12})\b',
    ]
    
    for pat in patterns:
        m = re.search(pat, full_text, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if not re.match(r'^[0-9]{1,2}[-/.][0-9]{1,2}', val) and len(val) >= 2:
                if val.upper() not in {'DATE', 'CASH', 'TOTAL', 'AMOUNT', 'PAID', 'TAX', 'PARTICULARS'}:
                    return val, 0.85, None
                    
    for line in lines[:8]:
        m = re.search(r'\b(?:No|#)\s*[:.]?\s*([0-9]{3,8})\b', line, re.IGNORECASE)
        if m:
            return m.group(1).strip(), 0.70, None

    return "", 0.0, "No receipt/invoice number found."


def extract_gstin(full_text: str) -> Tuple[str, float, Optional[str]]:
    gstin_regex = r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Zz][0-9A-Z]{1})\b'
    m = re.search(gstin_regex, full_text)
    if m:
        val = m.group(1).upper()
        return val, 0.95, None
        
    tolerant_m = re.search(r'GSTIN[\s:.-]*([0-9A-Z]{15})', full_text, re.IGNORECASE)
    if tolerant_m:
        val = tolerant_m.group(1).upper()
        if re.match(r'^[0-9]{2}', val):
            return val, 0.80, "Extracted GSTIN with heuristic pattern relaxation."

    return "", 0.0, None


def extract_total_amount(lines: List[str], claimed_amount: Optional[float] = None) -> Tuple[Optional[float], float, Optional[str]]:
    if not lines:
        return None, 0.0, "No text to extract total amount."

    total_keywords = ["grand total", "net amount", "total amount", "amount paid", "total payable", "total rs", "net payable", "total", "amount"]
    disqualifiers = ["subtotal", "sub total", "cgst", "sgst", "igst", "tax", "vat", "discount", "change", "cash tendered", "round off", "balance", "rate", "qty", "volume", "item"]

    candidates = []
    
    # 1. Search lines around total keywords (both current line and window [-2, +3])
    for i, line in enumerate(lines):
        line_lower = line.lower()
        has_total = any(tk in line_lower for tk in total_keywords)
        has_disqualifier = any(dq in line_lower for dq in ["subtotal", "sub total"])
        
        if has_total and not has_disqualifier:
            # Check current line
            nums_same = re.findall(r'(?:Rs\.?|INR|₹)?\s*([0-9]+(?:[,.][0-9]{2})?)', line)
            for n_str in nums_same:
                amt = clean_amount(n_str)
                if amt is not None and 10.0 <= amt <= 100000.0:
                    candidates.append((amt, 0.92, "Direct match on TOTAL line."))
                    
            # Check adjacent lines (window from i-2 to i+4)
            for offset in [-2, -1, 1, 2, 3]:
                idx = i + offset
                if 0 <= idx < len(lines):
                    adj_line = lines[idx]
                    # Skip if adjacent line is a date or phone or vehicle
                    if re.search(r'\b(date|phone|gstin|vehicle)\b', adj_line, re.IGNORECASE):
                        continue
                    # Check numbers
                    nums_adj = re.findall(r'\b([0-9]+(?:\.[0-9]{2})?)\b', adj_line)
                    for n_str in nums_adj:
                        amt = clean_amount(n_str)
                        if amt is not None and 10.0 <= amt <= 100000.0:
                            # Higher confidence if close to claimed_amount
                            if claimed_amount and abs(amt - claimed_amount) <= 10.0:
                                candidates.append((amt, 0.95, "Matched amount near TOTAL label consistent with claim."))
                            else:
                                candidates.append((amt, 0.82, f"Matched number adjacent to TOTAL label (offset {offset})."))

    # 2. If claimed_amount is provided, look for exact or close amount anywhere in bottom half
    if claimed_amount:
        bottom_lines = lines[len(lines)//3:] if len(lines) > 4 else lines
        for line in bottom_lines:
            nums = re.findall(r'\b([0-9]+(?:\.[0-9]{2})?)\b', line)
            for n_str in nums:
                amt = clean_amount(n_str)
                if amt is not None and abs(amt - claimed_amount) <= 10.0:
                    candidates.append((amt, 0.85, f"Matched claimed amount ₹{amt} in receipt body."))

    if candidates:
        # Sort by confidence descending
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0], candidates[0][1], candidates[0][2]

    # Fallback: find any number with currency prefix near the end
    for line in reversed(lines[:]):
        m = re.search(r'(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{2})?)', line, re.IGNORECASE)
        if m:
            amt = clean_amount(m.group(1))
            if amt and 10.0 <= amt <= 50000.0:
                return amt, 0.65, "Extracted amount from Rs currency marker near bottom."

    return None, 0.0, "Unable to detect total payable amount."


def clean_amount(val_str: str) -> Optional[float]:
    try:
        s = val_str.strip()
        s = re.sub(r'^(?:rs|inr|₹)\.?\s*', '', s, flags=re.IGNORECASE)
        s = s.replace(',', '')
        m = re.search(r'\b\d+(?:\.\d+)?\b', s)
        if m:
            val = float(m.group(0))
            return round(val, 2)
        return None
    except Exception:
        return None
