export interface FieldConfidence {
  vendor: number;
  receipt_date: number;
  receipt_number: number;
  gstin: number;
  total_amount: number;
}

export interface ExtractedReceipt {
  vendor: string;
  receipt_date: string;
  receipt_number: string;
  gstin: string;
  total_amount: number | null;
  confidence: FieldConfidence;
  warnings: string[];
  raw_text?: string;
}

export interface ValidationResult {
  decision: 'approve' | 'review';
  reasons: string[];
  checks: Record<string, boolean>;
  warnings: string[];
}

export interface DecisionOverride {
  override_decision: 'approve' | 'review';
  reason: string;
  reviewer: string;
  timestamp?: string;
}

export interface ClaimDetail {
  claim_id: string;
  emp_id: string;
  emp_name?: string;
  emp_designation?: string;
  emp_headquarter?: string;
  emp_vehicle_no?: string;
  emp_grade?: string;
  submitted_on: string;
  expense_date: string;
  category: string;
  claimed_vendor: string;
  claimed_amount: number;
  claimed_amount_raw: string;
  rep_comment: string;
  image_file: string;
  image_resolved_path?: string | null;
  image_available: boolean;
  extracted: ExtractedReceipt;
  validation: ValidationResult;
  override?: DecisionOverride | null;
}

export interface MetricsResponse {
  total_claims: number;
  auto_approved: number;
  sent_to_review: number;
  review_rate: number;
  missing_receipts: number;
  amount_mismatches: number;
  potential_duplicates: number;
  low_value_claims: number;
  high_value_claims: number;
  estimated_hours_saved: number;
  estimated_monthly_value_rs: number;
  field_accuracies?: Record<string, number>;
}

export interface BatchProcessSummary {
  total_processed: number;
  auto_approved: number;
  sent_to_review: number;
  review_rate_pct: number;
  missing_images: number;
  amount_mismatches: number;
  potential_duplicates: number;
  duration_seconds: number;
}

export interface HealthResponse {
  status: string;
  ocr_engine: string;
  tesseract_available: boolean;
  winrt_ocr_available: boolean;
  dataset_claims_train_rows: number;
  dataset_claims_test_rows: number;
  dataset_employees_rows: number;
  images_available: number;
  config: Record<string, any>;
}
