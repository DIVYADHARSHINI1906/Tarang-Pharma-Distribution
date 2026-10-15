# Tarang Expense Intelligence — System Limitations & Boundary Conditions

## 1. Overview

In accordance with our core engineering principles, this document transparently details the known technical, data, and operational limitations of the **Tarang Expense Intelligence** prototype. 

The system does not claim 100% automated accuracy, nor does it represent heuristic confidence indicators as calibrated statistical probabilities.

---

## 2. OCR Engine & Image Processing Limitations

### 2.1 Thermal Paper Degradation
- **Problem:** Over 60% of fuel and toll slips are printed on thermal paper using low-cost POS dot-matrix printers. Thermal receipts fade within weeks when exposed to heat or sunlight in vehicle glove compartments.
- **Limitation:** Faded digits (particularly `3`, `8`, `0`, and decimal points) may be dropped or misread by local OCR engines.
- **Safety Safeguard:** When an amount cannot be extracted with high confidence or fails the ₹10 match tolerance, the claim is never silently guessed—it is immediately routed to the clerical `review` queue.

### 2.2 Mobile Photography Artifacts
- **Problem:** Receipts photographed by medical representatives often feature steep perspective skew (photographed at 45° angles), heavy shadows from the user's hand or phone, and specular glare from flash units.
- **Limitation:** Skewed receipts may result in fragmented line bounding boxes, causing tokens from adjacent lines (e.g., date and invoice number) to be merged.
- **Safety Safeguard:** EXIF orientation correction resolves 90°/180° rotations, but perspective rectifications on severe 3D skews require future computer vision homography transforms.

### 2.3 Handwritten Receipts & Annotations
- **Problem:** Small tea stalls, rural dhabas, and auto-rickshaw drivers frequently issue handwritten kuccha receipts or write notes like *"Nagpur to Wardha return"* across the printed bill.
- **Limitation:** Classical OCR engines (both WinRT OCR and Tesseract) are designed for printed typography and have poor accuracy on cursive or hurried handwriting.
- **Safety Safeguard:** The system flags these receipts as unreadable or low confidence, correctly routing them for human review.

---

## 3. Data & Reference Label Limitations

### 3.1 Clerk Transcription Noise in `claims_train.csv`
- **Problem:** The training dataset contains reference labels entered by two finance clerks. Manual clerical data entry inherently contains human error:
  - Clerks frequently shortened vendor names (e.g., typing `"BPCL"` instead of `"Bharat Petroleum Corporation Ltd - Highway Point"`).
  - Clerks occasionally transposed digits (e.g., entering `₹1,240` when the bill was `₹1,204`).
  - Clerks omitted GSTIN numbers when processing large batches under time pressure.
- **Limitation:** Evaluating the OCR engine purely against clerk reference labels penalizes the OCR engine when the OCR actually read the receipt correctly and the clerk made a typo.
- **Documentation:** We report exact match alongside normalized and tolerance-based metrics to account for this discrepancy.

### 3.2 Missing Image Uploads
- **Problem:** The dataset contains missing image files (20 in train, 3 in test) due to field upload failures.
- **Limitation:** No OCR engine can extract fields from a nonexistent file.
- **Safety Safeguard:** The system detects missing files instantly, records a diagnostic warning, and marks the claim for clerical review without fabricating results.

---

## 4. Confidence Score Caveat

The confidence scores returned in the API:
```json
{
  "confidence": {
    "vendor": 0.85,
    "receipt_date": 0.90,
    "receipt_number": 0.70,
    "gstin": 0.95,
    "total_amount": 0.85
  }
}
```
**Are heuristic confidence indicators, NOT calibrated Bayesian probabilities.**

They are computed using rule-based metrics such as:
- Regex format completeness (e.g., valid 15-character statutory GSTIN checksum structure = 0.95)
- Token proximity to total keywords (`TOTAL`, `NET PAYABLE` = 0.85–0.90)
- Dictionary matching against known regional vendor registries
- Bounding-box position (top 20% of receipt for vendor = 0.85)

These heuristics serve to guide human reviewers toward questionable fields, but should not be interpreted as mathematical proof of correctness.

---

## 5. Policy & Business Logic Limitations

### 5.1 Multiple Receipts in a Single Photo
- **Limitation:** If a representative photographs two separate food receipts or fuel slips side-by-side in a single camera capture, the OCR parser treats the entire image as one contiguous text stream. This can lead to conflicting totals.
- **Mitigation:** The system flags multiple distinct "TOTAL" occurrences as a potential anomaly and routes the claim for review.

### 5.2 Out-of-State GSTIN Verification
- **Limitation:** While the system validates the 15-character statutory checksum and state code prefix (`27` for Maharashtra, `23` for Madhya Pradesh), it does not query the live GSTN portal API in real time.
- **Mitigation:** Live GST portal lookup can be added via an external microservice in Phase 2.

---

## 6. Local OCR vs. Multimodal Cloud Vision Models

| Feature | Built Local Pipeline (WinRT / Tesseract) | Cloud Vision LLM (e.g., Claude 3.5 / GPT-4o) |
| :--- | :--- | :--- |
| **Operational Cost** | **₹0.00 (Free, 100% Local)** | ₹1.50 – ₹4.00 per receipt image |
| **Monthly API Cost (2,400 claims)** | **₹0.00** | **₹3,600 – ₹9,600 / month** |
| **Offline Execution** | **Yes (Works without internet)** | No (Requires cloud connectivity) |
| **Processing Speed** | **~0.20s per receipt** | 2.5s – 5.0s per receipt |
| **Data Privacy** | **100% On-Premise (No employee data leaves network)** | Data transmitted to external third-party servers |
| **Handwriting & Faded Thermal** | Moderate | High |

**Conclusion:** For Tarang Pharma's operational scale (Nagpur Division), the local OCR pipeline delivers optimal economic return with zero ongoing variable software costs. Cloud vision models can be reserved as an optional tertiary escalation for claims flagged for human review.
