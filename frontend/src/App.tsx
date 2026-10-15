import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ReceiptProcessing } from './components/ReceiptProcessing';
import { ClaimsQueue } from './components/ClaimsQueue';
import { Analytics } from './components/Analytics';
import { ClaimDetailModal } from './components/ClaimDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { ClaimDetail, MetricsResponse, HealthResponse } from './types';
import { fetchHealth, fetchMetrics, fetchClaims } from './api';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'processing' | 'queue' | 'analytics'>('dashboard');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [claims, setClaims] = useState<ClaimDetail[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimDetail | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [h, m, c] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchMetrics().catch(() => null),
        fetchClaims({ limit: 400 }).catch(() => [])
      ]);
      setHealth(h);
      setMetrics(m);
      setClaims(c);
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClaimUpdated = (updated: ClaimDetail) => {
    setSelectedClaim(updated);
    setClaims(prev => prev.map(c => c.claim_id === updated.claim_id ? updated : c));
    fetchMetrics().then(m => setMetrics(m)).catch(() => {});
  };

  const handleNavigateToQueue = (filterDecision?: string) => {
    if (filterDecision) {
      setQueueFilter(filterDecision);
    } else {
      setQueueFilter('all');
    }
    setActiveTab('queue');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <span className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin"></span>
            <p className="text-xs text-slate-500 font-medium">Loading Tarang Expense Intelligence...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                metrics={metrics}
                recentClaims={claims}
                onSelectClaim={setSelectedClaim}
                onRefreshMetrics={() => fetchMetrics().then(setMetrics)}
                onNavigateToQueue={handleNavigateToQueue}
              />
            )}

            {activeTab === 'processing' && (
              <ReceiptProcessing
                onProcessed={(c) => {
                  setClaims(prev => [c, ...prev.filter(x => x.claim_id !== c.claim_id)]);
                  fetchMetrics().then(setMetrics);
                }}
              />
            )}

            {activeTab === 'queue' && (
              <ClaimsQueue
                claims={claims}
                onSelectClaim={setSelectedClaim}
                initialFilter={queueFilter}
                onClaimUpdated={handleClaimUpdated}
              />
            )}

            {activeTab === 'analytics' && (
              <Analytics metrics={metrics} />
            )}
          </>
        )}
      </main>

      {/* Claim Detail Modal */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onClaimUpdated={handleClaimUpdated}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          health={health}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Tarang Pharma Distribution • Field Expense Receipt Reading & Policy Automation System • Nagpur Division
      </footer>
    </div>
  );
}

export default App;
