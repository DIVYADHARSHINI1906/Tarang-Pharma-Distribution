import React, { useState } from 'react';
import { 
  CheckCircle2, AlertTriangle, FileQuestion, Copy, TrendingUp, Clock, 
  ArrowRight, Play, Check, ShieldCheck, DollarSign 
} from 'lucide-react';
import { MetricsResponse, ClaimDetail, BatchProcessSummary } from '../types';
import { runBatchProcess } from '../api';

interface DashboardProps {
  metrics: MetricsResponse | null;
  recentClaims: ClaimDetail[];
  onSelectClaim: (claim: ClaimDetail) => void;
  onRefreshMetrics: () => void;
  onNavigateToQueue: (filterDecision?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  metrics,
  recentClaims,
  onSelectClaim,
  onRefreshMetrics,
  onNavigateToQueue
}) => {
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchProcessSummary | null>(null);

  const handleRunBatch = async (dataset: 'test' | 'train') => {
    try {
      setBatchLoading(true);
      const res = await runBatchProcess(dataset);
      setBatchResult(res);
      onRefreshMetrics();
    } catch (err: any) {
      alert(`Batch processing error: ${err.message}`);
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Finance Operations Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated receipt OCR extraction, field comparison, and strict expense policy enforcement for 160 field representatives.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleRunBatch('test')}
            disabled={batchLoading}
            className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            {batchLoading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{batchLoading ? 'Processing Batch...' : 'Run Test Batch (190 Claims)'}</span>
          </button>
        </div>
      </div>

      {/* Batch Result Flash Alert */}
      {batchResult && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Check className="w-5 h-5 text-teal-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-teal-900">
                Batch Run Completed in {batchResult.duration_seconds}s!
              </p>
              <p className="text-xs text-teal-700 mt-0.5">
                Processed {batchResult.total_processed} claims: {batchResult.auto_approved} Auto-Approved ({100 - batchResult.review_rate_pct}%), {batchResult.sent_to_review} Sent to Review ({batchResult.review_rate_pct}%). Missing photos: {batchResult.missing_images}.
              </p>
            </div>
          </div>
          <button onClick={() => setBatchResult(null)} className="text-xs text-teal-600 hover:text-teal-800 font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Claims */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Claims</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-navy-900">{metrics?.total_claims ?? 473}</span>
            <span className="text-xs text-slate-400">Nagpur Div</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">283 train + 190 test</p>
        </div>

        {/* Auto-Approved */}
        <div 
          onClick={() => onNavigateToQueue('approve')}
          className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm hover:border-emerald-400 hover:ring-2 hover:ring-emerald-200/50 cursor-pointer transition-all hover:shadow active:scale-95"
          role="button"
          tabIndex={0}
          title="Click to view all auto-approved claims"
        >
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
            <span>Auto-Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-900">{metrics?.auto_approved ?? 0}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {metrics ? `${((metrics.auto_approved / metrics.total_claims) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-100 text-[11px] text-emerald-700 font-medium">
            <span>Passed all checks</span>
            <span className="text-emerald-600 hover:underline">View →</span>
          </div>
        </div>

        {/* Sent to Review */}
        <div 
          onClick={() => onNavigateToQueue('review')}
          className="bg-white rounded-xl border-2 border-amber-300 p-4 shadow-sm hover:border-amber-500 hover:ring-2 hover:ring-amber-200 cursor-pointer transition-all hover:shadow active:scale-95 bg-amber-50/30"
          role="button"
          tabIndex={0}
          title="Click to open Review Queue filtered by Review"
        >
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center justify-between">
            <span>Requires Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-amber-950">{metrics?.sent_to_review ?? 0}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
              {metrics ? `${metrics.review_rate}%` : '0%'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200 text-[11px] text-amber-800 font-medium">
            <span>Discrepancy / policy flags</span>
            <span className="text-amber-700 font-bold hover:underline">Open Queue →</span>
          </div>
        </div>

        {/* Missing Photos */}
        <div 
          onClick={() => onNavigateToQueue('review')}
          className="bg-white rounded-xl border border-rose-200 p-4 shadow-sm hover:border-rose-400 hover:ring-2 hover:ring-rose-200/50 cursor-pointer transition-all hover:shadow active:scale-95"
          role="button"
          tabIndex={0}
          title="Click to view claims with missing photos in Review Queue"
        >
          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center justify-between">
            <span>Missing Photos</span>
            <FileQuestion className="w-4 h-4 text-rose-600" />
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-rose-900">{metrics?.missing_receipts ?? 0}</span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">Review</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-rose-100 text-[11px] text-rose-700 font-medium">
            <span>App upload failures</span>
            <span className="text-rose-600 hover:underline">View →</span>
          </div>
        </div>

        {/* Amount Mismatches */}
        <div 
          onClick={() => onNavigateToQueue('review')}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-brand-400 hover:ring-2 hover:ring-brand-200/50 cursor-pointer transition-all hover:shadow active:scale-95"
          role="button"
          tabIndex={0}
          title="Click to view claims with amount mismatches in Review Queue"
        >
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span>Amt Mismatches</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-navy-900">{metrics?.amount_mismatches ?? 0}</span>
            <span className="text-xs text-slate-500 font-medium">&gt; Rs 10 diff</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
            <span>Blocked auto-approval</span>
            <span className="text-brand-600 hover:underline">View →</span>
          </div>
        </div>

        {/* Potential Duplicates */}
        <div 
          onClick={() => onNavigateToQueue('review')}
          className="bg-white rounded-xl border border-purple-200 p-4 shadow-sm hover:border-purple-400 hover:ring-2 hover:ring-purple-200/50 cursor-pointer transition-all hover:shadow active:scale-95"
          role="button"
          tabIndex={0}
          title="Click to view duplicate bill alerts in Review Queue"
        >
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider flex items-center justify-between">
            <span>Duplicate Alerts</span>
            <Copy className="w-4 h-4 text-purple-600" />
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-purple-900">{metrics?.potential_duplicates ?? 0}</span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">Flagged</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-100 text-[11px] text-purple-700 font-medium">
            <span>Repeated bill numbers</span>
            <span className="text-purple-600 hover:underline">View →</span>
          </div>
        </div>
      </div>

      {/* Financial Impact & Strategic Policy Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Labour Capacity Value Card */}
        <div className="bg-navy-900 text-white rounded-xl p-6 border border-navy-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Labour Capacity Released</span>
              <Clock className="w-5 h-5 text-brand-400" />
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-white">
                {metrics?.estimated_hours_saved ?? 0}
              </span>
              <span className="text-sm font-medium text-navy-300">hours / month avoided</span>
            </div>
            <p className="text-xs text-navy-300 mt-2 leading-relaxed">
              Based on 3.5 minutes per claim avoided on verified low-value claims.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-navy-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-navy-400">Equivalent Capacity Value</p>
              <p className="text-lg font-bold text-brand-300">
                Rs {(metrics?.estimated_monthly_value_rs ?? 0).toLocaleString()} <span className="text-xs font-normal text-navy-400">/ mo</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-navy-400">API Run Cost</p>
              <p className="text-lg font-bold text-emerald-400">Rs 0 <span className="text-xs font-normal text-navy-400">(Local OCR)</span></p>
            </div>
          </div>
        </div>

        {/* Policy Safeguard Notice */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-800 font-semibold mb-2">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
            <h2>Conservative Policy Safeguards: Below Rs 2,000 Threshold</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            In accordance with assignment instructions, claims under ₹2,000 are <strong className="text-navy-900 font-semibold">NOT automatically approved</strong> merely because they are below the threshold. The system executes automated cross-verification before issuing an approval:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-800 block">1. Photo Readability & Amount Match</span>
              <p className="text-slate-500 mt-0.5">Unreadable receipts or bills where total cannot be verified within ₹10 are held for human review.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-800 block">2. Duplicate Bill & Colleague Fraud</span>
              <p className="text-slate-500 mt-0.5">Identical bill numbers (e.g. VX11449697) or reused receipt images trigger immediate fraud hold.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-800 block">3. Mandatory Lodging GST Invoices</span>
              <p className="text-slate-500 mt-0.5">Hotel bills must have printed GSTIN and adhere to Grade ceilings (M1/M2: ₹3,000, M3: ₹4,500).</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-800 block">4. Fuel Vehicle Registration</span>
              <p className="text-slate-500 mt-0.5">Representative must have a registered vehicle on record to submit fuel claims.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Claims Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-navy-900">Recent Claims Inspection</h3>
            <p className="text-xs text-slate-500">Latest claims processed through OCR and policy validation</p>
          </div>
          <button
            onClick={() => onNavigateToQueue()}
            className="flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <span>View All in Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Claim ID</th>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Claimed Vendor</th>
                <th className="px-6 py-3 text-right">Claimed Amt</th>
                <th className="px-6 py-3 text-right">Extracted Amt</th>
                <th className="px-6 py-3 text-center">Decision</th>
                <th className="px-6 py-3">Reason Summary</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentClaims.slice(0, 8).map((claim) => {
                const effDecision = claim.override ? claim.override.override_decision : claim.validation.decision;
                const isApprove = effDecision === 'approve';
                return (
                  <tr 
                    key={claim.claim_id} 
                    onClick={() => onSelectClaim(claim)}
                    className="hover:bg-brand-50/50 cursor-pointer transition-colors group"
                    title="Click row to inspect claim and receipt photo"
                  >
                    <td className="px-6 py-3.5 font-medium text-navy-900 whitespace-nowrap group-hover:text-brand-700">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold">{claim.claim_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-800">{claim.emp_name || claim.emp_id}</div>
                      <div className="text-[11px] text-slate-400">{claim.emp_id} • {claim.emp_grade || 'M1'}</div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {claim.category}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-700 max-w-xs truncate">
                      {claim.claimed_vendor}
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium text-slate-900 whitespace-nowrap">
                      Rs {claim.claimed_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs whitespace-nowrap">
                      {claim.extracted.total_amount !== null ? (
                        <span className={`font-medium ${Math.abs(claim.claimed_amount - (claim.extracted.total_amount ?? 0)) <= 10 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          Rs {claim.extracted.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not detected</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClaim(claim);
                        }}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shadow-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                          isApprove 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:ring-2 hover:ring-emerald-300' 
                            : 'bg-amber-100 text-amber-900 border border-amber-300 hover:ring-2 hover:ring-amber-300'
                        }`}
                        title="Click to inspect this claim"
                      >
                        {effDecision.toUpperCase()}
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600 max-w-sm truncate" title={claim.validation.reasons.join(' ')}>
                      {claim.validation.reasons[0] || 'Verified within policy'}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClaim(claim);
                        }}
                        className="inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
