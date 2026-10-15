import React from 'react';
import { FileText, Settings, Download } from 'lucide-react';
import { HealthResponse } from '../types';
import { getDownloadPredictionsUrl } from '../api';

interface HeaderProps {
  activeTab: 'dashboard' | 'processing' | 'queue' | 'analytics';
  setActiveTab: (tab: 'dashboard' | 'processing' | 'queue' | 'analytics') => void;
  health: HealthResponse | null;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  health,
  onOpenSettings
}) => {
  return (
    <header className="bg-navy-900 border-b border-navy-800 text-white sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center shadow-inner">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">TARANG</span>
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-brand-900 text-brand-300 border border-brand-700/50">
                  EXPENSE INTELLIGENCE
                </span>
              </div>
              <p className="text-xs text-navy-400">Pharma Distribution • Nagpur Division</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-navy-800 text-brand-400 border border-navy-700'
                  : 'text-navy-300 hover:text-white hover:bg-navy-800/60'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('processing')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'processing'
                  ? 'bg-navy-800 text-brand-400 border border-navy-700'
                  : 'text-navy-300 hover:text-white hover:bg-navy-800/60'
              }`}
            >
              Receipt Processing
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'queue'
                  ? 'bg-navy-800 text-brand-400 border border-navy-700'
                  : 'text-navy-300 hover:text-white hover:bg-navy-800/60'
              }`}
            >
              Review Queue
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-navy-800 text-brand-400 border border-navy-700'
                  : 'text-navy-300 hover:text-white hover:bg-navy-800/60'
              }`}
            >
              Analytics & ROI
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Status indicator */}
            {(() => {
              const isOcrActive = health ? (health.tesseract_available || health.winrt_ocr_available) : true;
              return (
                <div className={`hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  isOcrActive
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                    : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isOcrActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  <span>{health?.ocr_engine || 'Native Local OCR'}</span>
                </div>
              );
            })()}

            {/* Download predictions */}
            <a
              href={getDownloadPredictionsUrl()}
              download="predictions.csv"
              className="flex items-center space-x-1.5 bg-brand-700 hover:bg-brand-600 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-sm transition-colors"
              title="Download generated predictions.csv for claims_test.csv"
            >
              <Download className="w-3.5 h-3.5" />
              <span>predictions.csv</span>
            </a>

            {/* Settings trigger */}
            <button
              onClick={onOpenSettings}
              className="p-1.5 text-navy-400 hover:text-white hover:bg-navy-800 rounded-md transition-colors"
              title="Policy & System Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
