import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, Eye, Download, AlertTriangle, CheckCircle2, Copy, Check } from 'lucide-react';
import { ClaimDetail } from '../types';
import { getDownloadPredictionsUrl, submitDecisionOverride } from '../api';

interface ClaimsQueueProps {
  claims: ClaimDetail[];
  onSelectClaim: (claim: ClaimDetail) => void;
  initialFilter?: string;
  onClaimUpdated?: (updated: ClaimDetail) => void;
}

export const ClaimsQueue: React.FC<ClaimsQueueProps> = ({
  claims,
  onSelectClaim,
  initialFilter,
  onClaimUpdated
}) => {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<string>(initialFilter || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'id' | 'amount' | 'date'>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (initialFilter) {
      setDecisionFilter(initialFilter);
      setPage(1);
    }
  }, [initialFilter]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    claims.forEach(c => c.category && set.add(c.category));
    return Array.from(set).sort();
  }, [claims]);

  // Filtering & Sorting
  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      const effDecision = c.override ? c.override.override_decision : c.validation.decision;
      if (decisionFilter !== 'all' && effDecision !== decisionFilter) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;

      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchesId = c.claim_id.toLowerCase().includes(s);
        const matchesEmp = (c.emp_name || '').toLowerCase().includes(s) || c.emp_id.toLowerCase().includes(s);
        const matchesVendor = (c.claimed_vendor || '').toLowerCase().includes(s) || (c.extracted.vendor || '').toLowerCase().includes(s);
        if (!matchesId && !matchesEmp && !matchesVendor) return false;
      }
      return true;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortField === 'amount') {
        cmp = a.claimed_amount - b.claimed_amount;
      } else if (sortField === 'date') {
        cmp = a.expense_date.localeCompare(b.expense_date);
      } else {
        cmp = a.claim_id.localeCompare(b.claim_id);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [claims, decisionFilter, categoryFilter, searchTerm, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredClaims.length / pageSize) || 1;
  const paginatedClaims = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClaims.slice(start, start + pageSize);
  }, [filteredClaims, page]);

  return (
    <div className="space-y-4">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Claim ID, Employee, or Vendor..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Decision Filter */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => { setDecisionFilter('all'); setPage(1); }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                decisionFilter === 'all' ? 'bg-white shadow-xs text-navy-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({claims.length})
            </button>
            <button
              onClick={() => { setDecisionFilter('approve'); setPage(1); }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                decisionFilter === 'approve' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Approved ({claims.filter(c => (c.override ? c.override.override_decision : c.validation.decision) === 'approve').length})
            </button>
            <button
              onClick={() => { setDecisionFilter('review'); setPage(1); }}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                decisionFilter === 'review' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 hover:text-amber-950 font-bold'
              }`}
            >
              Review ({claims.filter(c => (c.override ? c.override.override_decision : c.validation.decision) === 'review').length})
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-lg text-xs px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Sort Field */}
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center space-x-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort: {sortField.toUpperCase()} ({sortAsc ? 'Asc' : 'Desc'})</span>
          </button>
        </div>
      </div>

      {/* Claims Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 cursor-pointer" onClick={() => { setSortField('id'); setSortAsc(!sortAsc); }}>
                  Claim ID
                </th>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Claimed Vendor</th>
                <th className="px-6 py-3 text-right cursor-pointer" onClick={() => { setSortField('amount'); setSortAsc(!sortAsc); }}>
                  Claimed Amount
                </th>
                <th className="px-6 py-3 text-right">Extracted Total</th>
                <th className="px-6 py-3 text-center">Decision</th>
                <th className="px-6 py-3">Audit Reason</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedClaims.length > 0 ? (
                paginatedClaims.map((claim) => {
                  const effDecision = claim.override ? claim.override.override_decision : claim.validation.decision;
                  const isApprove = effDecision === 'approve';
                  const hasDuplicate = claim.validation.checks.possible_duplicate;

                  return (
                    <tr 
                      key={claim.claim_id} 
                      onClick={() => onSelectClaim(claim)}
                      className="hover:bg-brand-50/50 cursor-pointer transition-colors group"
                      title="Click row to inspect claim and review receipt photo"
                    >
                      <td className="px-6 py-3.5 font-medium text-navy-900 whitespace-nowrap group-hover:text-brand-700">
                        <div className="flex items-center space-x-1.5">
                          {hasDuplicate && (
                            <span title="Possible Duplicate Receipt">
                              <Copy className="w-3.5 h-3.5 text-purple-600" />
                            </span>
                          )}
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

                      <td className="px-6 py-3.5 text-xs text-slate-700 max-w-xs truncate" title={claim.claimed_vendor}>
                        {claim.claimed_vendor}
                      </td>

                      <td className="px-6 py-3.5 text-right font-medium text-slate-900 whitespace-nowrap">
                        Rs {claim.claimed_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-6 py-3.5 text-right text-xs whitespace-nowrap">
                        {claim.extracted.total_amount !== null ? (
                          <span className={`font-medium ${
                            Math.abs(claim.claimed_amount - (claim.extracted.total_amount ?? 0)) <= 10
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}>
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
                          title="Click to review and inspect this claim"
                        >
                          {effDecision.toUpperCase()}
                        </button>
                      </td>

                      <td className="px-6 py-3.5 text-xs text-slate-600 max-w-sm truncate" title={claim.validation.reasons.join(' ')}>
                        {claim.override ? (
                          <span className="text-emerald-700 italic font-medium">{claim.override.reason || 'Verified and approved by Finance Clerk'}</span>
                        ) : (
                          claim.validation.reasons[0] || 'Verified within policy'
                        )}
                      </td>

                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {!isApprove && (
                            <button
                              type="button"
                              disabled={approvingId === claim.claim_id}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  setApprovingId(claim.claim_id);
                                  const updated = await submitDecisionOverride(claim.claim_id, {
                                    override_decision: 'approve',
                                    reason: 'Verified and approved by Finance Clerk',
                                    reviewer: 'Priya Bhende (Senior Accounts Executive)'
                                  });
                                  if (onClaimUpdated) onClaimUpdated(updated);
                                } catch (err: any) {
                                  alert(`Approval failed: ${err.message}`);
                                } finally {
                                  setApprovingId(null);
                                }
                              }}
                              className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-300 hover:border-emerald-600 px-2.5 py-1 rounded-md transition-colors cursor-pointer shadow-2xs active:scale-95"
                              title="Click to approve this claim immediately"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{approvingId === claim.claim_id ? 'Approving...' : 'Approve'}</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectClaim(claim);
                            }}
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-md transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 text-xs">
                    No claims match your search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-700">
              {Math.min(page * pageSize, filteredClaims.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-700">{filteredClaims.length}</span> claims
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
            >
              Previous
            </button>
            <span className="font-medium text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
