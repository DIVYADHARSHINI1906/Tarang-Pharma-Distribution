import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, 
  RotateCcw, Sparkles, AlertCircle, Building, Calendar, Hash, DollarSign,
  Edit3, ChevronDown, ChevronUp, Check, X
} from 'lucide-react';
import { ClaimDetail } from '../types';
import { submitClaimExtraction, submitDecisionOverride } from '../api';

interface ReceiptProcessingProps {
  onProcessed?: (claim: ClaimDetail) => void;
}

export const ReceiptProcessing: React.FC<ReceiptProcessingProps> = ({ onProcessed }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Form fields
  const [claimId, setClaimId] = useState('CLM-DEMO-' + Math.floor(1000 + Math.random() * 9000));
  const [empId, setEmpId] = useState('TPD-0412');
  const [category, setCategory] = useState('Food');
  const [vendor, setVendor] = useState('Highway King Dhaba');
  const [amountClaimed, setAmountClaimed] = useState('330.00');
  const [expenseDate, setExpenseDate] = useState('2026-06-08');
  const [comment, setComment] = useState('Lunch during field route');

  // Processing state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClaimDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputsChanged, setInputsChanged] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState<'approve' | 'review'>('approve');
  const [overrideReason, setOverrideReason] = useState('Manually audited receipt photograph and confirmed details.');
  const [reviewerName, setReviewerName] = useState('Priya Bhende (Senior Accounts Executive)');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    if (!overrideReason.trim()) {
      alert('Please provide a reason or note.');
      return;
    }
    try {
      setOverrideSubmitting(true);
      const updated = await submitDecisionOverride(result.claim_id, {
        override_decision: overrideDecision,
        reason: overrideReason.trim(),
        reviewer: reviewerName.trim()
      });
      setResult(updated);
      if (onProcessed) onProcessed(updated);
      setOverrideModal(false);
    } catch (err: any) {
      alert(`Failed to save decision: ${err.message}`);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Auto-detect if user uploaded sample WA0030
    const fn = file.name.toLowerCase();
    if (fn.includes('wa0030')) {
      setVendor('Hotel Rajdhani Dhaba');
      setAmountClaimed('110.00');
      setCategory('Food');
      setExpenseDate('2026-06-12');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSelectSample = (sampleImg: string, sampleVendor: string, sampleAmt: string, sampleCat: string, sampleDate: string) => {
    setVendor(sampleVendor);
    setAmountClaimed(sampleAmt);
    setCategory(sampleCat);
    setExpenseDate(sampleDate);
    // Point preview to existing server image
    setPreviewUrl(`/api/images/${encodeURIComponent(sampleImg)}`);
    setSelectedFile(null); // Indicates use existing server image
    setResult(null);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('claim_id', claimId);
      formData.append('emp_id', empId);
      formData.append('category', category);
      formData.append('vendor', vendor);
      formData.append('amount_claimed', amountClaimed);
      formData.append('expense_date', expenseDate);
      formData.append('rep_comment', comment);

      if (selectedFile) {
        formData.append('receipt_file', selectedFile);
      } else if (previewUrl && previewUrl.startsWith('/api/images/')) {
        const fname = decodeURIComponent(previewUrl.replace('/api/images/', ''));
        formData.append('image_filename', fname);
      } else {
        throw new Error('Please upload a receipt photo or pick a sample from the test pack.');
      }

      const res = await submitClaimExtraction(formData);
      setResult(res);
      if (onProcessed) onProcessed(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Processing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setErrorMsg(null);
    setClaimId('CLM-DEMO-' + Math.floor(1000 + Math.random() * 9000));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-navy-900">Receipt Processing & Claim Verification</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload representative receipt photographs or test real dataset receipts against Tarang Pharma Distribution expense policies.
        </p>

        {/* Quick Sample Selector */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Quick Test Samples:</span>
          <button
            type="button"
            onClick={() => handleSelectSample('IMG-20260619-WA0030.jpg', 'Hotel Rajdhani Dhaba', '110.00', 'Food', '2026-06-12')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded border border-slate-200 transition-colors"
          >
            Rajdhani Dhaba (Food, Rs 110)
          </button>
          <button
            type="button"
            onClick={() => handleSelectSample('IMG_20260608_080820.jpg', 'Highway King Dhaba', '330.00', 'Food', '2026-06-08')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded border border-slate-200 transition-colors"
          >
            Highway King (Food, Rs 330)
          </button>
          <button
            type="button"
            onClick={() => handleSelectSample('IMG-20260610-WA0001.jpg', 'Laxmi Auto Fuels', '300.00', 'Fuel', '2026-06-11')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded border border-slate-200 transition-colors"
          >
            Laxmi Fuels (Fuel, Rs 300)
          </button>
          <button
            type="button"
            onClick={() => handleSelectSample('IMG-20260612-WA0058.jpg', 'Hotel Gulmohar Executive', '2352.00', 'Lodging', '2026-06-08')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded border border-slate-200 transition-colors"
          >
            Hotel Gulmohar (&gt;Rs 2,000 Threshold)
          </button>
          <button
            type="button"
            onClick={() => handleSelectSample('IMG-20260613-WA0094.jpg', 'Vidarbha Express Courier', '448.40', 'Courier', '2026-07-18')}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded border border-slate-200 transition-colors"
          >
            Courier Duplicate Test
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg flex items-center space-x-2 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form and Output Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: Claim Inputs & Upload */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-navy-900 border-b border-slate-100 pb-3 flex items-center justify-between">
            <span>Representative Claim Information</span>
            {previewUrl && (
              <button 
                type="button" 
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center space-x-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              />
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                {selectedFile ? selectedFile.name : 'Click to upload receipt photo or drag and drop'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">JPEG, PNG, or mobile camera uploads</p>
            </div>

            {/* Image Preview Box */}
            {previewUrl && (
              <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-900 max-h-56 flex items-center justify-center">
                <img src={previewUrl} alt="Receipt Preview" className="max-h-56 object-contain" />
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                  Photo Preview
                </div>
              </div>
            )}

            {/* Input Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Claim ID</label>
                <input
                  type="text"
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Expense Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none bg-white"
                >
                  <option value="Food">Food</option>
                  <option value="Fuel">Fuel</option>
                  <option value="Lodging">Lodging</option>
                  <option value="Courier">Courier</option>
                  <option value="Local travel">Local travel</option>
                  <option value="Parking">Parking</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Expense Date</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Claimed Vendor</label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Amount Claimed (Rs)</label>
                <input
                  type="text"
                  value={amountClaimed}
                  onChange={(e) => setAmountClaimed(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Rep Comment</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {inputsChanged && result && (
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Claim inputs updated! Click <strong>"Process Receipt & Validate Claim"</strong> below to re-calculate.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>Executing OCR Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Process Receipt & Validate Claim</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Output: Extraction & Decision */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (() => {
            const effDecision = result.override ? result.override.override_decision : result.validation.decision;
            const isApprove = effDecision === 'approve';
            
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                {/* Decision Header Banner */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isApprove
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}>
                  <div className="flex items-center space-x-3">
                    {isApprove ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs uppercase font-bold tracking-wider text-slate-500">System Decision</span>
                      </div>
                      <h3 className="text-2xl font-extrabold uppercase tracking-tight">
                        {effDecision}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    {!isApprove ? (
                      <button
                        type="button"
                        disabled={overrideSubmitting}
                        onClick={async () => {
                          try {
                            setOverrideSubmitting(true);
                            const updated = await submitDecisionOverride(result.claim_id, {
                              override_decision: 'approve',
                              reason: 'Verified and approved by Finance Clerk',
                              reviewer: reviewerName
                            });
                            setResult(updated);
                            if (onProcessed) onProcessed(updated);
                          } catch (err: any) {
                            alert(`Approval failed: ${err.message}`);
                          } finally {
                            setOverrideSubmitting(false);
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105 active:scale-95"
                        title="Click to approve this claim immediately"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{overrideSubmitting ? 'Approving...' : '✓ Approve Claim'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={overrideSubmitting}
                        onClick={async () => {
                          try {
                            setOverrideSubmitting(true);
                            const updated = await submitDecisionOverride(result.claim_id, {
                              override_decision: 'review',
                              reason: 'Moved back to review for detailed check',
                              reviewer: reviewerName
                            });
                            setResult(updated);
                            if (onProcessed) onProcessed(updated);
                          } catch (err: any) {
                            alert(`Update failed: ${err.message}`);
                          } finally {
                            setOverrideSubmitting(false);
                          }
                        }}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{overrideSubmitting ? 'Updating...' : 'Move to Review'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setOverrideDecision(isApprove ? 'review' : 'approve');
                        setOverrideModal(true);
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs flex items-center space-x-1 cursor-pointer transition-colors"
                      title="Add a custom explanation note"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-brand-600" />
                      <span>Custom Note</span>
                    </button>
                  </div>
                </div>

                {/* Decision Status Banner */}
                {result.override && (
                  <div className={`rounded-lg p-3 text-xs flex items-start justify-between ${
                    result.override.override_decision === 'approve'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border border-amber-200 text-amber-900'
                  }`}>
                    <div>
                      <span className={`font-bold uppercase tracking-wider block ${
                        result.override.override_decision === 'approve' ? 'text-emerald-800' : 'text-amber-800'
                      }`}>
                        {result.override.override_decision === 'approve' ? 'Verified & Approved' : 'Review Requested'}
                      </span>
                      <p className="mt-0.5">
                        Decision set to <strong className="uppercase">{result.override.override_decision}</strong> by <strong>{result.override.reviewer}</strong>: "{result.override.reason}".
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

                {/* Explanatory Decision Reasons */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Decision Reasons & Policy Checks</h4>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {result.validation.reasons.map((r, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0"></span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Side-by-Side Comparison: Claimed vs Extracted */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Field Comparison Audit</span>
                    <span className="text-[11px] text-slate-400">Heuristic Confidence Indicators</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {/* Vendor */}
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <span className="col-span-3 text-slate-500 font-medium">Vendor</span>
                      <span className="col-span-4 text-slate-900 font-semibold">{result.claimed_vendor}</span>
                      <span className="col-span-4 text-slate-700">{result.extracted.vendor || '<Not found>'}</span>
                      <span className="col-span-1 text-right font-medium text-slate-400">
                        {(result.extracted.confidence.vendor * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Date */}
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <span className="col-span-3 text-slate-500 font-medium">Receipt Date</span>
                      <span className="col-span-4 text-slate-900 font-semibold">{result.expense_date}</span>
                      <span className="col-span-4 text-slate-700">{result.extracted.receipt_date || '<Not found>'}</span>
                      <span className="col-span-1 text-right font-medium text-slate-400">
                        {(result.extracted.confidence.receipt_date * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Bill No */}
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <span className="col-span-3 text-slate-500 font-medium">Bill / Invoice No</span>
                      <span className="col-span-4 text-slate-400 italic">Not entered by rep</span>
                      <span className="col-span-4 text-slate-700 font-mono">{result.extracted.receipt_number || '<Not found>'}</span>
                      <span className="col-span-1 text-right font-medium text-slate-400">
                        {(result.extracted.confidence.receipt_number * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* GSTIN */}
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <span className="col-span-3 text-slate-500 font-medium">GSTIN</span>
                      <span className="col-span-4 text-slate-400 italic">Not entered by rep</span>
                      <span className="col-span-4 text-slate-700 font-mono">{result.extracted.gstin || '<None>'}</span>
                      <span className="col-span-1 text-right font-medium text-slate-400">
                        {(result.extracted.confidence.gstin * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Total Amount */}
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center bg-slate-50/50">
                      <span className="col-span-3 text-slate-800 font-bold">Total Amount</span>
                      <span className="col-span-4 text-slate-900 font-bold text-sm">
                        Rs {result.claimed_amount.toFixed(2)}
                      </span>
                      <span className="col-span-4 font-bold text-sm text-brand-700">
                        {result.extracted.total_amount !== null ? `Rs ${result.extracted.total_amount.toFixed(2)}` : '<Not found>'}
                      </span>
                      <span className="col-span-1 text-right font-bold text-brand-600">
                        {(result.extracted.confidence.total_amount * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Policy Checks Matrix */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Automated Policy Matrix</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {Object.entries(result.validation.checks).map(([key, val]) => {
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

                {/* Controlled Raw Text Accordion for Audit */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="w-full flex items-center justify-between p-3 font-semibold text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Inspect Raw OCR Text Stream</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({showRawText ? 'Click to hide' : 'Click to view extracted words'})
                      </span>
                    </div>
                    {showRawText ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                  </button>
                  {showRawText && (
                    <div className="p-3 border-t border-slate-200 bg-slate-900 text-slate-200 rounded-b-lg">
                      <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap font-mono">
                        {result.extracted.raw_text && result.extracted.raw_text.trim()
                          ? result.extracted.raw_text
                          : '(No raw text detected by the OCR engine on this receipt image)'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700">No Receipt Processed Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Fill out the claim details and upload a receipt photo on the left, or choose one of the quick test samples above.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Decision Override Dialog Modal */}
      {overrideModal && result && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Update Claim Decision</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Update the decision and notes for claim <strong className="text-slate-800">{result.claim_id}</strong>. Logged for administrative audit.
            </p>

            <form onSubmit={handleSaveOverride} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideDecision('approve')}
                    className={`py-2 rounded-lg font-bold uppercase transition-colors cursor-pointer ${
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
                    className={`py-2 rounded-lg font-bold uppercase transition-colors cursor-pointer ${
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Explanation Reason</label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why this decision is being manually overridden..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOverrideModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  {overrideSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Decision</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
