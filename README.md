# Tarang Expense Intelligence — AI Expense Receipt Automation

> **Enterprise-grade receipt OCR extraction, expense policy validation, and automated approval platform for Tarang Pharma Distribution (Nagpur Division).**

[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.13-009688.svg)](https://fastapi.tiangolo.com/)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20TypeScript-61DAFB.svg)](https://react.dev/)
[![Styling](https://img.shields.io/badge/Styling-TailwindCSS%203.4-38B2AC.svg)](https://tailwindcss.com/)
[![OCR Engine](https://img.shields.io/badge/OCR-Native%20WinRT%20%2F%20Tesseract-green.svg)](https://github.com/tesseract-ocr/tesseract)
[![Tests](https://img.shields.io/badge/Tests-17%2F17%20Passing-brightgreen.svg)](backend/tests/)

---

## 1. Project Overview

Tarang Pharma Distribution employs approximately 160 medical representatives across Maharashtra and central India. Finance clerks process over 2,400 expense claim photographs per month, manually keying in vendor names, receipt dates, invoice numbers, GSTINs, and total amounts.

**Tarang Expense Intelligence** automates this workflow:
1. **100% Local OCR Extraction:** Extracts 5 mandatory fields (`vendor`, `receipt_date`, `receipt_number`, `gstin`, `total_amount`) directly on-premise with zero cloud API keys or external recurring expenses.
2. **Policy Compliance Engine:** Cross-validates claims against *Tarang Field Expense Policy v3.2*, including fuel vehicle number validation, employee grade lodging ceilings, food limits, and duplicate receipt detection.
3. **Conservative Decision Logic:** Rejects the dangerous proposal of blindly auto-approving all claims under ₹2,000. Instead, it enforces multi-check automated verification: approving clean receipts while routing suspicious or altered claims to human clerical review.
4. **Interactive Finance Workbench:** A modern, clean web application for finance clerks to review flagged claims, inspect high-resolution receipts, and execute audit-logged decision overrides.

---

## 2. Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py              # FastAPI REST endpoints
│   │   ├── models/
│   │   │   └── schemas.py             # Pydantic data schemas
│   │   ├── ocr/
│   │   │   ├── engine.py              # Image path resolver & OCR runner
│   │   │   └── parser.py              # Regex & heuristic extraction parser
│   │   ├── rules/
│   │   │   ├── decision_engine.py     # Policy check & approval rule engine
│   │   │   └── claims_service.py      # Claims repository & batch manager
│   │   ├── config.py                  # Policy thresholds & system settings
│   │   └── main.py                    # Application entrypoint & CORS
│   └── tests/
│       ├── test_all.py                # Unit tests for parser & policy rules
│       ├── test_api.py                # Integration tests for FastAPI routes
│       └── test_predictions.py       # Integrity checks for predictions.csv
├── frontend/                          # React + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── components/                # Dashboard, Queue, Details Modal, Analytics
│   │   ├── api.ts                     # REST client for backend
│   │   └── types.ts                   # TypeScript interfaces
│   └── package.json
├── docs/
│   ├── architecture.md               # Detailed system architecture & pipeline
│   ├── evidence-report.md            # Empirical evaluation & error analysis
│   ├── memo-to-nilesh.md             # One-page executive finance memo
│   └── limitations.md                # System limitations & boundary conditions
├── scripts/
│   ├── ocr_winrt.ps1                  # High-speed native Windows OCR runner
│   ├── generate_predictions.py       # Generates root predictions.csv
│   └── evaluate_ocr.py               # Evaluates OCR on claims_train.csv
├── claims_train.csv                   # Historical training dataset (283 claims)
├── claims_test.csv                    # Evaluation test dataset (190 claims)
├── employees.csv                      # Employee master directory (16 employees)
├── sample_submission.csv              # Submission template
├── predictions.csv                    # Final predictions generated for test set
├── submission-form.md                 # Completed 10-point assignment submission form
├── requirements.txt                   # Python backend dependencies
└── README.md                          # This documentation
```

---

## 3. Prerequisites

- **Python:** 3.10, 3.11, 3.12, or 3.13
- **Node.js:** v18.0.0 or later (with `npm`)
- **Operating System:**
  - **Windows (Recommended):** Out-of-the-box native OCR via Windows WinRT machine-learning OCR engine (`Windows.Media.Ocr`). No external software or elevation required!
  - **Linux / macOS / Docker:** Install standard Tesseract OCR (`sudo apt-get install tesseract-ocr`).

---

## 4. Installation & Setup

### 4.1 Clone Repository & Setup Environment

```powershell
# Navigate to project directory
cd "e:\Tarang Pharma Distribution"

# Install Python backend dependencies
pip install -r requirements.txt

# Install Frontend dependencies
cd frontend
npm install
cd ..
```

---

## 5. Running the Application

### 5.1 Single-Command Unified Launch (Runs Backend + Frontend Together)

You can run **both the FastAPI Backend and React Frontend simultaneously with a single command**:

```powershell
# Option A: Universal Python launcher (Streams both logs to terminal & opens browser)
python run.py

# Option B: Root npm command
npm start
# or: npm run dev

# Option C: Windows Batch File (or simply double-click run.bat in File Explorer)
.\run.bat

# Option D: Windows PowerShell script
.\run.ps1
```

Once launched, both services are immediately live:
- **Frontend Web Application:** [http://localhost:5173](http://localhost:5173)
- **FastAPI REST API:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger / OpenAPI Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check Endpoint:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

Press `Ctrl+C` in the terminal anytime to cleanly stop both services.

---

### 5.2 Running Services Individually (Optional)

If you prefer to run services in separate terminal tabs:

**Terminal 1 — Backend (Port 8000):**
```powershell
$env:PYTHONPATH = "."
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend (Port 5173):**
```powershell
cd frontend
npm run dev
```

## 6. Running Tests & Evaluations

### 6.1 Automated Test Suite (`pytest`)

Execute the complete 16-test suite verifying parser regexes, policy boundaries, API routes, and `predictions.csv` integrity:

```powershell
python -m pytest backend/tests/ -v
```

*Expected output: `16 passed in ~0.70s`.*

### 6.2 Frontend Production Build Validation

Verify TypeScript compilation and Vite bundling:

```powershell
cd frontend
npm run build
```

*Expected output: `✓ built in ~2.5s with 0 errors`.*

### 6.3 Run OCR Evaluation Benchmark

Benchmark the extraction pipeline against historical clerk labels in `claims_train.csv`:

```powershell
python -m scripts.evaluate_ocr
```

### 6.4 Generate `predictions.csv`

Regenerate predictions for all 190 claims in `claims_test.csv` (strictly matching `sample_submission.csv` format):

```powershell
python -m scripts.generate_predictions
```

The output file is saved directly to `predictions.csv` in the root workspace.

---

## 7. API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns backend operational status, active OCR engine, and dataset row counts |
| `GET` | `/api/claims` | Returns paginated list of claims with filters for decision (`approve`/`review`) and search |
| `GET` | `/api/claims/{claim_id}` | Returns comprehensive details of a single claim, OCR values, checks, and image path |
| `POST` | `/api/claims/extract` | Accepts a multipart image and claim metadata; executes OCR and policy validation |
| `POST` | `/api/claims/batch` | Triggers asynchronous batch processing over dataset claims with error isolation |
| `POST` | `/api/claims/{id}/override` | Allows an authorized reviewer to manually override a decision with a mandatory audit note |
| `GET` | `/api/metrics` | Returns computed KPIs, review rate, mismatch count, and estimated time savings |
| `GET` | `/api/predictions/download` | Serves the generated `predictions.csv` file for download |
| `GET` | `/api/images/{filename}` | Serves uploaded receipt photos for frontend preview |

---

## 8. Expense Policy & Threshold Logic

In accordance with *Field Expense Policy v3.2*:

1. **Conservative Auto-Approval Threshold (`₹2,000`):**
   - A claim amount ≤ ₹2,000 does **NOT** automatically grant approval.
   - The claim must pass all integrity checks: receipt image readability, amount match within ₹10 tolerance, no duplicate bill number, and valid category guidelines.
   - Claims failing any check are marked `review`.
2. **Rounding Tolerance (`₹10.00`):**
   - Accounts for merchant rounding and petty cash differences without triggering false-positive alerts.
3. **Lodging Requirements:**
   - Hotel stays require a valid 15-digit GSTIN tax invoice and are capped by employee grade ceilings:
     - Grade `M1`: ₹2,000/night
     - Grade `M2`: ₹2,500/night
     - Grade `M3`: ₹3,500/night
     - Grade `M4`: ₹5,000/night
     - Grade `M5`: ₹7,000/night
4. **Fuel Verification:**
   - Fuel expense claims cross-check whether the representative's registered vehicle number matches company records in `employees.csv`.
5. **Food Limit (`₹2,500`):**
   - Food/meal expenses exceeding ₹2,500 require explicit regional manager approval.

---

## 9. Troubleshooting & FAQ

- **Q: Does this project require an OpenAI / Anthropic / Google Gemini API key?**
  - **No.** The system runs 100% locally using Windows Native OCR or local Tesseract. No API keys are required for startup or execution.
- **Q: How does the system handle missing photos?**
  - In `claims_test.csv`, 3 receipt photos failed to upload (`rec_00454.jpg`, `rec_00465.jpg`, `rec_00473.jpg`). The system safely flags them as unreadable and routes them to `review` with an explicit reason, never inventing fabricated text.
- **Q: Why does the system report heuristic confidence rather than probability?**
  - Heuristic confidence reflects verifiable format indicators (e.g., statutory 15-digit GSTIN regex match, keyword proximity). We do not claim these are calibrated Bayesian probabilities.

---

## 10. License

Developed for Tarang Pharma Distribution (Nagpur Operations). All rights reserved.
