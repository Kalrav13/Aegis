import React, { useEffect, useCallback } from 'react';
import { 
  X, 
  GitCommit, 
  GitBranch, 
  Clock, 
  Calendar, 
  Hash, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  BarChart3 
} from 'lucide-react';
import { AnalysisRun } from '../types';
import StatusBadge from './StatusBadge';

interface AnalysisDetailsDrawerProps {
  run: AnalysisRun | null;
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

export default function AnalysisDetailsDrawer({
  run,
  isOpen,
  onClose,
  projectName
}: AnalysisDetailsDrawerProps) {
  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !run) return null;

  const startDate = new Date(run.startedAt);
  const endDate = run.completedAt ? new Date(run.completedAt) : null;
  const durationMs = endDate ? endDate.getTime() - startDate.getTime() : null;
  const durationStr = durationMs
    ? durationMs > 60000
      ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
      : `${Math.floor(durationMs / 1000)}s`
    : 'In progress…';

  const stats = run.repositoryStatistics || {};

  const detailRows = [
    { icon: Hash, label: 'Analysis ID', value: run.id.substring(0, 12) + '…', mono: true },
    { icon: GitCommit, label: 'Commit SHA', value: run.commitSha?.substring(0, 8) || '—', mono: true },
    { icon: GitBranch, label: 'Project', value: projectName || '—', mono: false },
    { icon: Calendar, label: 'Started At', value: startDate.toLocaleString(undefined, { 
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    }), mono: false },
    { icon: Calendar, label: 'Completed At', value: endDate 
      ? endDate.toLocaleString(undefined, { 
          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        }) 
      : '—', mono: false },
    { icon: Clock, label: 'Duration', value: durationStr, mono: false },
  ];

  const statCards = [
    { label: 'Features', value: stats.totalFeatures || 0, color: 'indigo' },
    { label: 'Scenarios', value: stats.totalScenarios || 0, color: 'violet' },
    { label: 'Test Cases', value: stats.totalTestCases || 0, color: 'emerald' },
    { label: 'Automated', value: stats.totalAutomated || 0, color: 'amber' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div 
        className="fixed top-0 right-0 h-full w-full max-w-md z-[70] transform transition-transform duration-300 ease-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Analysis Details"
      >
        <div className="h-full glass-panel border-l border-slate-800 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-200">Analysis Details</h3>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  Run metadata inspector
                </span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold uppercase">Current Status</span>
              <StatusBadge status={run.status} />
            </div>

            {/* Detail Rows */}
            <div className="space-y-1">
              {detailRows.map((row) => {
                const IconComp = row.icon;
                return (
                  <div 
                    key={row.label}
                    className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-slate-900/40 transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <IconComp className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      <span className="text-xs text-slate-500 font-medium">{row.label}</span>
                    </div>
                    <span className={`text-xs font-semibold text-slate-300 ${row.mono ? 'font-mono' : ''}`}>
                      {row.value}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Repository Statistics */}
            <div className="space-y-3">
              <h4 className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Repository Statistics
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {statCards.map((stat) => (
                  <div 
                    key={stat.label}
                    className="glass-card rounded-xl p-4 border border-slate-800/50 text-center space-y-1.5"
                  >
                    <span className="block text-2xl font-bold text-slate-100 tabular-nums">
                      {stat.value.toLocaleString()}
                    </span>
                    <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Message (if failed) */}
            {run.status === 'FAILED' && run.errorMessage && (
              <div className="space-y-2">
                <h4 className="text-xs text-rose-400 font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Error Details</span>
                </h4>
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                  <p className="text-xs text-rose-300/80 font-mono leading-relaxed break-all">
                    {run.errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Success indicator */}
            {run.status === 'COMPLETED' && (
              <div className="flex items-center space-x-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-300/80 font-medium">
                  Analysis completed successfully. All intelligence layers processed.
                </span>
              </div>
            )}

            {/* In-progress indicator */}
            {['CLONING', 'FILTERING', 'ANALYZING', 'GENERATING'].includes(run.status) && (
              <div className="flex items-center space-x-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                <Loader2 className="h-4 w-4 text-indigo-400 shrink-0 animate-spin" />
                <span className="text-xs text-indigo-300/80 font-medium">
                  Pipeline is actively processing. Stage: {run.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
