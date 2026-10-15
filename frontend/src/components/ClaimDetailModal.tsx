import React, { useState } from 'react';
import { 
  X, CheckCircle2, AlertTriangle, User, Calendar, FileText, 
  Building, Copy, ExternalLink, ShieldAlert, Sparkles, Check, Edit3 
} from 'lucide-react';
import { ClaimDetail } from '../types';
import { getImageUrl, submitDecisionOverride, processClaim } from '../api';

interface ClaimDetailModalProps {
  claim: ClaimDetail;
  onClose: () => void;
  onClaimUpdated: (updated: ClaimDetail) => void;
}

export const ClaimDetailModal: React.FC<ClaimDetailModalProps> = ({
  claim,
  onClose,
  onClaimUpdated
}) => {
  const [reprocessing, setReprocessing] = useState(false);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState<'approve' | 'review'>('approve');
  const [overrideReason, setOverrideReason] = useState('');
  const [reviewerName, setReviewerName] = useState('Priya Bhende (Senior Accounts Executive)');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const effDecision = claim.override ? claim.override.override_decision : claim.validation.decision;
  const isApprove = effDecision === 'approve';

  const handleReprocess = async () => {
    try {
      setReprocessing(true);
      const updated = await processClaim(claim.claim_id);
      onClaimUpdated(updated);
    } catch (err: any) {
      alert(`Error re-evaluating claim: ${err.message}`);
    } finally {
      setReprocessing(false);
    }
  };

  const handleQuickApprove = async () => {
    try {
      setOverrideSubmitting(true);
      const note = overrideReason.trim() || 'Verified and approved by Finance Clerk';
      const updated = await submitDecisionOverride(claim.claim_id, {
        override_decision: 'approve',
        reason: note,
        reviewer: reviewerName.trim()
      });
      onClaimUpdated(updated);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleQuickReview = async () => {
    try {
      setOverrideSubmitting(true);
      const note = overrideReason.trim() || 'Held for detailed clerk audit & query';
      const updated = await submitDecisionOverride(claim.claim_id, {
        override_decision: 'review',
        reason: note,
        reviewer: reviewerName.trim()
      });
      onClaimUpdated(updated);
    } catch (err: any) {
      alert(`Error updating claim: ${err.message}`);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    const note = overrideReason.trim() || (overrideDecision === 'approve' ? 'Verified and approved by Finance Clerk' : 'Held for detailed clerk audit');
    try {
      setOverrideSubmitting(true);
      const updated = await submitDecisionOverride(claim.claim_id, {
        override_decision: overrideDecision,
        reason: note,
        reviewer: reviewerName.trim()
      });
      onClaimUpdated(updated);
      setOverrideModal(false);
    } catch (err: any) {
      alert(`Failed to save decision: ${err.message}`);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const imgSrc = claim.image_file ? getImageUrl(claim.image_file) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-navy-900 text-white flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center space-x-3">
            <span className="text-lg font-bold tracking-tight">{claim.claim_id}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-navy-800 text-navy-200 border border-navy-700">
              {claim.category}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
              isApprove 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {effDecision}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {!isApprove ? (
              <button
                type="button"
                onClick={handleQuickApprove}
                disabled={overrideSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105 active:scale-95"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{overrideSubmitting ? 'Approving...' : 'Approve Claim'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickReview}
                disabled={overrideSubmitting}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105 active:scale-95"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{overrideSubmitting ? 'Updating...' : 'Move to Review'}</span>
              </button>
            )}

            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="text-xs text-navy-300 hover:text-white bg-navy-800 hover:bg-navy-700 px-3 py-1.5 rounded-md transition-colors flex items-center space-x-1 border border-navy-700"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>{reprocessing ? 'Re-running OCR...' : 'Re-Evaluate'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-navy-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Decision Status Banner */}
          {claim.override && (
            <div className={`rounded-lg p-3 text-xs flex items-start justify-between ${
              claim.override.override_decision === 'approve'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border border-amber-200 text-amber-900'
            }`}>
              <div>
                <span className={`font-bold uppercase tracking-wider block ${
                  claim.override.override_decision === 'approve' ? 'text-emerald-800' : 'text-amber-800'
                }`}>
                  {claim.override.override_decision === 'approve' ? 'Verified & Approved' : 'Review Requested'}
                </span>
                <p className="mt-0.5">
                  Decision confirmed by <strong>{claim.override.reviewer}</strong>: "{claim.override.reason}".
                </p>
              </div>
              <button
                onClick={() => setOverrideModal(true)}
                className="text-slate-600 hover:text-slate-900 underline font-semibold text-xs ml-4 cursor-pointer"
              >
                Edit Note
              </button>
            </div>
          )}

          {/* Grid Layout: Left Photo, Right Verification */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left: Receipt Photo Viewer */}
            <div className="md:col-span-5 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 p-2 flex flex-col items-center justify-center min-h-[360px] max-h-[500px]">
              {claim.image_available && imgSrc ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={imgSrc}
                    alt={`Receipt for ${claim.claim_id}`}
                    className="max-h-[460px] object-contain rounded"
                  />
                  <a
                    href={imgSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-2 right-2 bg-black/70 hover:bg-black text-white text-xs px-2.5 py-1 rounded flex items-center space-x-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open Full Size</span>
                  </a>
                </div>
              ) : (
                <div className="text-center p-8 text-slate-400">
                  <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">Receipt Photo Unavailable</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Upload failed or photo was not recorded by the mobile app.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Validation & Comparison */}
            <div className="md:col-span-7 space-y-4">
              {/* Employee & Claim Meta */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Representative</span>
                  <span className="font-semibold text-slate-900">{claim.emp_name || claim.emp_id}</span>
                  <span className="text-[11px] text-slate-500 block">{claim.emp_id} • Grade {claim.emp_grade || 'M1'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Designation / HQ</span>
                  <span className="font-semibold text-slate-900">{claim.emp_designation || 'Medical Rep'}</span>
                  <span className="text-[11px] text-slate-500 block">{claim.emp_headquarter || 'Nagpur'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Registered Vehicle</span>
                  <span className="font-semibold text-slate-900 font-mono">{claim.emp_vehicle_no || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Expense Date</span>
                  <span className="font-semibold text-slate-900">{claim.expense_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Submitted On</span>
                  <span className="font-semibold text-slate-900">{claim.submitted_on || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Representative Note</span>
                  <span className="font-medium text-slate-700 italic">"{claim.rep_comment || 'None'}"</span>
                </div>
              </div>

              {/* Side by Side Comparison Audit */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-700 flex justify-between">
                  <span>Field Verification Audit</span>
                  <span className="text-[11px] text-slate-500">Heuristic Confidence</span>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                    <span className="col-span-3 text-slate-500 font-medium">Vendor</span>
                    <span className="col-span-4 font-semibold text-slate-900">{claim.claimed_vendor}</span>
                    <span className="col-span-4 text-slate-700">{claim.extracted.vendor || '<Not found>'}</span>
                    <span className="col-span-1 text-right text-slate-400 font-medium">
                      {(claim.extracted.confidence.vendor * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                    <span className="col-span-3 text-slate-500 font-medium">Bill Date</span>
                    <span className="col-span-4 font-semibold text-slate-900">{claim.expense_date}</span>
                    <span className="col-span-4 text-slate-700">{claim.extracted.receipt_date || '<Not found>'}</span>
                    <span className="col-span-1 text-right text-slate-400 font-medium">
                      {(claim.extracted.confidence.receipt_date * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                    <span className="col-span-3 text-slate-500 font-medium">Bill Number</span>
                    <span className="col-span-4 text-slate-400 italic">Not entered</span>
                    <span className="col-span-4 font-mono text-slate-700">{claim.extracted.receipt_number || '<Not found>'}</span>
                    <span className="col-span-1 text-right text-slate-400 font-medium">
                      {(claim.extracted.confidence.receipt_number * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                    <span className="col-span-3 text-slate-500 font-medium">GSTIN</span>
                    <span className="col-span-4 text-slate-400 italic">Not entered</span>
                    <span className="col-span-4 font-mono text-slate-700">{claim.extracted.gstin || '<None>'}</span>
                    <span className="col-span-1 text-right text-slate-400 font-medium">
                      {(claim.extracted.confidence.gstin * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-12 px-4 py-2.5 items-center bg-slate-50">
                    <span className="col-span-3 font-bold text-slate-800">Total Amount</span>
                    <span className="col-span-4 font-bold text-slate-900 text-sm">
                      Rs {claim.claimed_amount.toFixed(2)}
                    </span>
                    <span className="col-span-4 font-bold text-brand-700 text-sm">
                      {claim.extracted.total_amount !== null ? `Rs ${claim.extracted.total_amount.toFixed(2)}` : '<Not found>'}
                    </span>
                    <span className="col-span-1 text-right font-bold text-brand-600">
                      {(claim.extracted.confidence.total_amount * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Checks Matrix */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Automated Policy Matrix</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(claim.validation.checks).map(([key, val]) => {
                    const isDupKey = key === 'possible_duplicate';
                    const isPassed = isDupKey ? !val : !!val;
                    
                    let label = key.replace(/_/g, ' ');
                    let badgeText = isPassed ? 'PASS' : 'FAIL';

                    if (isDupKey) {
                      label = 'Duplicate Check';
                      badgeText = val ? 'DUPLICATE' : 'PASS';
                    } else if (key === 'policy_checks_passed') {
                      label = 'Category Limits';
                    } else if (key === 'below_threshold') {
                      label = 'Threshold ( < ₹2k )';
                    }

                    return (
                      <div key={key} className={`p-2 rounded border flex items-center justify-between ${
                        isPassed ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/60 border-rose-200'
                      }`}>
                        <span className="text-slate-700 capitalize font-medium">{label}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isPassed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {badgeText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reasons & Policy Notices */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <span className="font-bold text-slate-700 block uppercase tracking-wider text-[11px]">System Audit Findings:</span>
                {claim.validation.reasons.map((r, i) => (
                  <p key={i} className="text-slate-600 flex items-start space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1 flex-shrink-0"></span>
                    <span>{r}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Direct Approve & Override Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {claim.override ? (
              <span className={`font-semibold ${claim.override.override_decision === 'approve' ? 'text-emerald-700' : 'text-amber-700'}`}>
                Status: <strong className="uppercase">{claim.override.override_decision}</strong> (Confirmed by {claim.override.reviewer})
              </span>
            ) : (
              <span>Automated policy evaluation: <strong className="uppercase">{effDecision}</strong></span>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {!isApprove ? (
              <button
                type="button"
                onClick={handleQuickApprove}
                disabled={overrideSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center space-x-2 cursor-pointer hover:scale-105 active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{overrideSubmitting ? 'Approving...' : '✓ Approve Claim Now'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickReview}
                disabled={overrideSubmitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105 active:scale-95"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{overrideSubmitting ? 'Updating...' : 'Move to Review'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setOverrideModal(true)}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Custom Note</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Override Dialog Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Update Claim Decision</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Update the decision and notes for claim <strong className="text-slate-800">{claim.claim_id}</strong>. Actions are logged for administrative audit.
            </p>

            <form onSubmit={handleSaveOverride} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideDecision('approve')}
                    className={`py-2 rounded-lg font-bold uppercase transition-colors ${
                      overrideDecision === 'approve'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideDecision('review')}
                    className={`py-2 rounded-lg font-bold uppercase transition-colors ${
                      overrideDecision === 'review'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Review
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reviewer Name & Title</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Required Explanation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Verified original physical receipt with sales manager Amol Kathane."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setOverrideModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md font-semibold transition-colors disabled:opacity-50"
                >
                  {overrideSubmitting ? 'Saving...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
