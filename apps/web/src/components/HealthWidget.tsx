import React from 'react';
import { Shield, Sparkles, AlertCircle } from 'lucide-react';
import { DashboardViewModel } from '../types';

interface HealthWidgetProps {
  viewModel: DashboardViewModel;
}

export default function HealthWidget({ viewModel }: HealthWidgetProps) {
  const {
    featureCount,
    scenarioCount,
    testCaseCount,
    automatedCount,
    automationCoverage,
    coverageConfidence,
    executionConfidence,
    ready,
    blockingReasons
  } = viewModel;

  // Calculate a consolidated health score
  const healthScore = Math.round(
    (0.40 * automationCoverage + 
     0.30 * coverageConfidence + 
     0.30 * executionConfidence)
  );

  const getHealthRating = (score: number) => {
    if (score >= 90) return { label: 'Excellent Health', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 shadow-emerald-500/5' };
    if (score >= 75) return { label: 'Good Health', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25 shadow-indigo-500/5' };
    if (score >= 60) return { label: 'Fair Health', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25 shadow-amber-500/5' };
    return { label: 'Poor Health', color: 'text-rose-400 bg-rose-500/10 border-rose-500/25 shadow-rose-500/5' };
  };

  const rating = getHealthRating(healthScore);

  return (
    <div className="glass-card rounded-xl p-6 border border-slate-800 flex flex-col justify-between space-y-6">
      {/* Header and consolidated score */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-slate-350 text-sm">Repository Health Index</h4>
          <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">consolidated testing metrics</span>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center space-x-1.5 ${rating.color}`}>
          <Shield className="h-3.5 w-3.5" />
          <span>{rating.label}</span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        {/* Radial consolidated score */}
        <div className="relative h-20 w-20 flex items-center justify-center flex-shrink-0">
          <svg className="absolute transform -rotate-90 w-20 h-20">
            <circle
              cx="40"
              cy="40"
              r="34"
              stroke="rgba(30, 41, 59, 0.4)"
              strokeWidth="5"
              fill="transparent"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              stroke="url(#indigoGradient)"
              strokeWidth="5.5"
              fill="transparent"
              strokeDasharray="213"
              strokeDashoffset={213 - (213 * healthScore) / 100}
              strokeLinecap="round"
              className="transition-all duration-550 ease-out"
            />
            <defs>
              <linearGradient id="indigoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="flex flex-col items-center justify-center">
            <span className="text-xl font-bold tracking-tight text-slate-200">{healthScore}</span>
            <span className="text-[8px] text-slate-500 font-semibold uppercase">index</span>
          </div>
        </div>

        {/* Flat detailed list */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div className="flex justify-between border-b border-slate-900 pb-1.5">
            <span className="text-slate-400">Total Features</span>
            <span className="font-semibold text-slate-250">{featureCount}</span>
          </div>
          <div className="flex justify-between border-b border-slate-900 pb-1.5">
            <span className="text-slate-400">Total Scenarios</span>
            <span className="font-semibold text-slate-250">{scenarioCount}</span>
          </div>
          <div className="flex justify-between border-b border-slate-900 pb-1.5 col-span-2">
            <span className="text-slate-400">Test Cases (Auto / Total)</span>
            <span className="font-semibold text-slate-250">
              {automatedCount} / {testCaseCount}
            </span>
          </div>
        </div>
      </div>

      {/* Release gates status */}
      <div className="pt-2 border-t border-slate-850">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Release readiness gates</span>
          <span className={`text-xs font-bold ${ready ? 'text-emerald-400' : 'text-rose-400'}`}>
            {ready ? 'READY FOR RELEASE' : 'BLOCKED'}
          </span>
        </div>
        
        {!ready && blockingReasons.length > 0 && (
          <div className="mt-2.5 space-y-1 bg-rose-500/5 border border-rose-500/10 rounded-lg p-3">
            {blockingReasons.map((reason, i) => (
              <div key={i} className="flex items-start space-x-1.5 text-[10px] text-rose-350 leading-relaxed">
                <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
