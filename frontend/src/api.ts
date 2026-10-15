import { ClaimDetail, MetricsResponse, HealthResponse, BatchProcessSummary, DecisionOverride } from './types';

const API_BASE = '/api';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch system health');
  return res.json();
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function fetchClaims(params?: {
  search?: string;
  decision?: string;
  category?: string;
  limit?: number;
}): Promise<ClaimDetail[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.decision) query.append('decision', params.decision);
  if (params?.category) query.append('category', params.category);
  if (params?.limit) query.append('limit', params.limit.toString());

  const res = await fetch(`${API_BASE}/claims?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch claims');
  return res.json();
}

export async function fetchClaimDetail(claimId: string): Promise<ClaimDetail> {
  const res = await fetch(`${API_BASE}/claims/${claimId}`);
  if (!res.ok) throw new Error(`Failed to fetch claim ${claimId}`);
  return res.json();
}

export async function processClaim(claimId: string): Promise<ClaimDetail> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/process`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to process claim ${claimId}`);
  return res.json();
}

export async function submitClaimExtraction(formData: FormData): Promise<ClaimDetail> {
  const res = await fetch(`${API_BASE}/claims/extract`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to process receipt' }));
    throw new Error(err.detail || 'Failed to process receipt');
  }
  return res.json();
}

export async function submitDecisionOverride(claimId: string, override: DecisionOverride): Promise<ClaimDetail> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(override)
  });
  if (!res.ok) throw new Error('Failed to submit override');
  return res.json();
}

export async function runBatchProcess(datasetType: 'test' | 'train' = 'test', limit?: number): Promise<BatchProcessSummary> {
  const res = await fetch(`${API_BASE}/claims/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_type: datasetType, limit })
  });
  if (!res.ok) throw new Error('Failed to run batch process');
  return res.json();
}

export function getImageUrl(filename: string): string {
  return `${API_BASE}/images/${encodeURIComponent(filename)}`;
}

export function getDownloadPredictionsUrl(): string {
  return `${API_BASE}/predictions/download`;
}
