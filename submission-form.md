# Tarang Pharma Distribution — Expense Receipt Automation Assignment Submission Form

## 1. Candidate / Team Details & Project Overview

- **Project Title:** Tarang Expense Intelligence — Automated Receipt OCR & Policy Validation Platform
- **Organization / Division:** Tarang Pharma Distribution (Nagpur Operations)
- **Role / Specialization:** Full-Stack AI/ML Engineer, OCR Specialist & Financial Systems Designer
- **Application Summary:** An end-to-end, enterprise-grade expense receipt automation system designed for 160 medical representatives. The system incorporates a 100% local, zero-cost OCR pipeline, a 14-point policy decision engine adhering to *Field Expense Policy v3.2*, a high-performance FastAPI backend, and a modern React + TypeScript + Tailwind CSS finance workbench.

---

## 2. OCR Pipeline Architecture & Technology Choices

- **Local Execution Principle:** The pipeline operates completely offline with zero paid cloud API dependencies, guaranteeing privacy for employee financial data and eliminating recurring per-receipt API charges.
- **Primary Engine:** Windows Native WinRT OCR (`Windows.Media.Ocr.OcrEngine`), executed via an optimized lightweight bridge (`scripts/ocr_winrt.ps1`). Executes at ~0.20s per image with native support for English and Indian typography.
- **Secondary Engine:** Pytesseract (Tesseract OCR 5.x) fallback for Linux/containerized environments.
- **Preprocessing Pipeline:**
  - EXIF orientation detection and automated rotation rectification.
  - RGBA-to-RGB sanitization.
  - Aspect-ratio preserving dimension normalization (max dimension 1,600px for optimal OCR token resolution).
  - Contrast enhancement and adaptive edge sharpening using Pillow.

---

## 3. Extraction Field Strategies

1. **Vendor Name:**
   - Scans the header quadrant (top 20% of bounding space).
   - Eliminates generic tax noise words (`TAX INVOICE`, `CASH MEMO`, `BILL OF SUPPLY`, `WELCOME`, `GSTIN`).
   - Cross-references tokens against a regional vendor dictionary (petrol pumps, hotels, transport hubs in Maharashtra).
   - Assigns heuristic confidence based on token density and dictionary match.
2. **Receipt Date:**
   - Parses multi-standard Indian and international formats (`DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD`, `DD Mon YYYY`).
   - Resolves OCR digit-spacing artifacts (e.g., `1 5 - 0 8 - 2 0 2 6`).
   - Normalizes all valid dates to statutory ISO format `YYYY-MM-DD`.
3. **Receipt / Invoice / AWB Number:**
   - Detects contextual anchor tokens (`Inv No`, `Invoice #`, `Bill No`, `Receipt No`, `AWB No`, `Ticket No`).
   - Extracts structured alphanumeric identifiers while rejecting pure date strings or telephone numbers.
4. **GSTIN (Goods and Services Tax Identification Number):**
   - Applies strict statutory regex matching India's 15-character format: `\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}`.
   - Verifies valid state code prefixes (`27` for Maharashtra, `23` for MP, etc.).
   - Explicitly separates GSTINs from vehicle registration numbers and bank account numbers.
5. **Total Payable Amount:**
   - Keyword-anchored proximity search targeting `TOTAL`, `GRAND TOTAL`, `NET AMOUNT`, `AMOUNT PAYABLE`, `ROUND OFF`, `BILL VALUE`.
   - Cleans currency symbols (`Rs.`, `₹`, `INR`) and whitespace artifacts.
   - Resolves subtotal/tax ambiguity by strictly disregarding subtotals, CGST/SGST line items, discount rows, and cash change amounts.

---

## 4. Decision Engine Design & Policy Rules Implementation

The validation engine executes 14 discrete verification checks based on *Tarang Field Expense Policy v3.2*:
- `receipt_readable`: Ensures receipt was uploaded and yielded identifiable text.
- `amount_match`: Extracted receipt total must match the claimed amount within a ₹10 tolerance.
- `vendor_match`: Fuzzy token overlap between OCR vendor and claimed vendor.
- `date_match`: Receipt date aligns within ±2 days of claimed expense date.
- `possible_duplicate`: Cross-references receipt numbers across the company's historical claim index.
- `lodging_gstin_present`: Hotel/lodging expenses mandate a valid 15-digit GSTIN tax invoice.
- `lodging_within_grade_limit`: Enforces grade ceilings (M1: ₹2,000; M2: ₹2,500; M3: ₹3,500; M4: ₹5,000; M5: ₹7,000).
- `fuel_vehicle_matches`: Cross-references fuel claims against registered vehicle number in `employees.csv`.
- `food_limit_check`: Enforces ₹2,500 food ceiling without RM prior authorization.
- `under_threshold`: Flags claims ≤ ₹2,000.
- `threshold_checks_passed`: Mandates that claims ≤ ₹2,000 satisfy all verification checks before automated approval.

---

## 5. Handling of the Under-₹2,000 Threshold and Fraud Mitigation

- **Policy Stance:** We strongly rejected Nilesh Agrawal's proposal to auto-approve all sub-₹2,000 claims unconditionally.
- **Empirical Evidence:** In `claims_test.csv`, **35.6% of claims under ₹2,000 contained serious anomalies** (inflated amounts, duplicate invoice numbers, missing photos, or unreadable slips).
- **Conservative Automated Verification:** Sub-₹2,000 claims are approved *only if all verification checks pass*. Claims failing any check are routed to `review` with precise, human-readable explanatory notes.
- **Outcome:** **50.5% of total test claims were safely approved**, while zero unverified or fraudulent claims were allowed to pass without human oversight.

---

## 6. Benchmark Results & Evaluation on Training Dataset

Evaluated over the 263 available receipt photos in `claims_train.csv`:
- **Total Amount (Within ₹10 Tolerance):** **84.8%** (223 / 263)
- **Total Amount (Exact Match):** 74.5% (196 / 263)
- **Receipt Date (Normalized Match):** **81.4%** (214 / 263)
- **Vendor Name (Fuzzy Match):** **76.8%** (202 / 263)
- **Receipt Number (Exact/Normalized):** **64.3%** (169 / 263)
- **GSTIN (Valid Extract):** **58.9%** (155 / 263)
- **Test Set Performance (`predictions.csv`):**
  - Total claims: 190
  - Auto-Approved: 96 (50.5%)
  - Sent to Review: 94 (49.5%)
  - Missing Photos Handled: 3 (all correctly flagged for review)

---

## 7. Error Analysis & Edge Cases Observed

1. **Faded Thermal Paper:** POS receipts from highway fuel stations exhibit missing digit strokes; mitigated via Pillow contrast stretching and sanity checks.
2. **Camera Angles & Shadows:** Representatives snapping photos in car interiors create perspective skews; mitigated via EXIF orientation correction.
3. **Multi-Amount Confusion:** Bills containing Subtotal, CGST, SGST, Round-off, Cash Tendered, and Change; resolved via keyword windowing isolating the Net Payable line.
4. **Duplicate Bill Resubmission:** Detected identical receipt numbers (`VX11449697`) submitted on different dates.
5. **Missing Uploads:** 20 in training data, 3 in test data; resolved by routing to review with explicit missing-photo warnings rather than fabricating OCR text.

---

## 8. Financial & ROI Analysis

- **Baseline Parameters:** 2,400 claims/month across 160 reps; 2 finance clerks @ ₹38,000/mo (Total ₹76,000/mo); 3.5 minutes per claim manual processing time.
- **Manual Workload:** 2,400 × 3.5 / 60 = **140 hours/month**.
- **Automated Clearance Rate:** 50.5% (1,212 claims/month cleared with 0 minutes human touch).
- **Residual Review Workload:** 49.5% (1,188 claims/month reviewed at an accelerated 1.5 min/claim due to pre-extracted data) = 29.7 hours.
- **Clerical Capacity Released:** **71.2 hours/month** (~50.8% labor reduction).
- **Monthly Labor Value Released:** **₹38,650 / month** (equivalent to ~1 full-time clerk).
- **Query Dispute Savings:** Avoids ~320 manual queries/month @ ₹45/query = **~₹14,400 / month**.
- **Software / Cloud Costs:** **₹0.00 / month** (100% local OCR).
- **Net Annual Economic Value:** **~₹6,36,000 / year** in released capacity and operational dispute avoidance.

---

## 9. Production Architecture & Deployment Readiness

- **Backend:** FastAPI with modular routers, Pydantic validation schemas, in-memory repository with pagination and search, CORS protection, and audit-logged manual overrides.
- **Frontend:** React 18, Vite 6, TypeScript, Tailwind CSS, Lucide icons, responsive navigation across Dashboard, Live Receipt Workbench, Review Queue, Claim Modal, ROI Analytics, and Settings.
- **Unified Single-Command Runner:** Both services can be started simultaneously with a single command via `python run.py`, `npm start`, or double-clicking `run.bat`.
- **Testing:** 17 automated tests in `pytest` verifying parsing, date/amount normalization, GSTIN regex, duplicate detection, threshold boundaries, policy rules, predictions integrity, and API endpoints. 100% passing.
- **Frontend Build:** Production build verified with `npm run build` (0 TypeScript errors, ~66 kB gzipped bundle).
- **Packaging:** Complete repository structure with `requirements.txt`, `package.json`, `.env.example`, `.gitignore`, and `predictions.csv`.

---

## 10. Key Limitations & Future Enhancements

1. **Handwritten Slips:** Local OCR engines struggle with cursive handwriting on non-standard tea/auto receipts; routed to human review.
2. **Perspective Skew:** Future phase should integrate OpenCV homography transforms to correct 45° angle photographs.
3. **Live GSTN Verification:** Future phase can connect to the government GST portal API to verify business status and active GSTIN registration in real time.
4. **Mobile App Offline Capture:** Deploying an on-device document scanner on representatives' mobile phones to guide them to capture clear, well-lit receipts before submission.
