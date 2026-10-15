import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List


@dataclass
class Settings:
    PROJECT_NAME: str = "Tarang Expense Intelligence"
    API_V1_STR: str = "/api"
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    IMAGES_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "images")
    TRAIN_CSV: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "claims_train.csv")
    TEST_CSV: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "claims_test.csv")
    EMPLOYEES_CSV: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "employees.csv")
    SAMPLE_SUBMISSION_CSV: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "sample_submission.csv")
    PREDICTIONS_CSV: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "predictions.csv")
    POLICY_TXT: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "expense-policy.txt")
    POLICY_PDF: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "expense-policy.pdf")
    
    # OCR Engine settings
    OCR_ENGINE: str = os.environ.get("OCR_ENGINE", "native")  # "native" (Windows.Media.Ocr), "tesseract", or "vision"
    TESSERACT_CMD: str = os.environ.get("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    SCRIPTS_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent / "scripts")
    
    # Policy Thresholds & Rules
    AUTO_APPROVE_THRESHOLD: float = 2000.0  # ₹2,000 threshold
    AMOUNT_TOLERANCE: float = 10.0  # ₹10 rounding tolerance accepted by policy
    FOOD_LIMIT_WITHOUT_APPROVAL: float = 2500.0  # Meals with doctors up to ₹2,500 without prior approval
    LODGING_M1_M2_LIMIT: float = 3000.0  # Lodging up to ₹3,000 before GST for grades M1 & M2
    LODGING_M3_LIMIT: float = 4500.0  # Lodging up to ₹4,500 for grade M3
    
    # Heuristic confidence requirement for auto-approval
    CONFIDENCE_MIN_AUTO_APPROVE: float = 0.60
    
    # CORS
    CORS_ORIGINS: List[str] = field(default_factory=lambda: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ])


settings = Settings()
