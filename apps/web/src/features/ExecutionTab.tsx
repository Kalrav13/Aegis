import React, { useState } from 'react';
import { 
  BarChart3, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink, 
  Flame, 
  ShieldAlert, 
  ShieldAlert as CriticalIcon,
  TrendingUp, 
  Info 
} from 'lucide-react';
import { AnalysisRun } from '../types';
import { mapToExecutionViewModel } from '../utils/mappers';
import EmptyState from '../components/EmptyState';

interface ExecutionTabProps {
  run: AnalysisRun;
}

export default function ExecutionTab({ run }: ExecutionTabProps) {
  const execution = mapToExecutionViewModel(run);
  
  const {
    overallScore,
    confidenceScore,
    classification,
    releaseReady,
    recommendation,
    recommendationSeverity,
    topStrengths,
    topRisks,
    failures,
    flaky,
    trends,
    sources,
    quality
  } = execution;

  const [activeSubTab, setActiveSubTab] = useState<'failures' | 'flaky' | 'sources'>('failures');

  const getSeverityAlertClasses = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/10 border-rose-500/25 text-rose-350';
      case 'WARNING':
        return 'bg-amber-500/10 border-amber-500/25 text-amber-350';
      default:
        return 'bg-indigo-500/10 border-indigo-500/25 text-indigo-350';
    }
  };

  const getRecommendationIcon = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return ShieldAlert;
      case 'WARNING':
        return AlertCircle;
      default:
        return CheckCircle;
      }
  };

  // Safe SVG sparkline builder
  const renderSparkline = (points: number[], colorClass: string) => {
    if (points.length <= 1) return <MinusLine />;
    const width = 120;
    const height = 24;
    const padding = 2;
    const maxVal = Math.max(...points, 100);
    const minVal = 0;
    const range = maxVal - minVal;

    const coordinates = points.map((p, idx) => {
      const x = padding + (idx / (points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((p - minVal) / (range || 1)) * (height - padding * 2);
      return `${x},${y}`;
    });

    const pathData = `M ${coordinates.join(' L ')}`;

    return (
      <svg width={width} height={height} className={colorClass}>
        <path d={pathData} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, idx) => {
          const coord = coordinates[idx].split(',');
          return (
            <circle 
              key={idx} 
              cx={coord[0]} 
              cy={coord[1]} 
              r="2.5" 
              className="fill-current text-slate-100" 
            />
          );
        })}
      </svg>
    );
  };

  const MinusLine = () => (
    <div className="h-0.5 w-16 bg-slate-800 rounded"></div>
  );

  if (overallScore === 0 && failures.critical.length === 0 && flaky.high.length === 0) {
    return (
      <EmptyState
        title="No Execution Data"
        description="This run does not contain test execution reports. Make sure automation execution results are synced."
        icon={BarChart3}
      />
    );
  }

  const AlertIcon = getRecommendationIcon(recommendationSeverity);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Summary and Trends */}
      <div className="lg:col-span-5 space-y-6">
        {/* Executive summary card */}
        <div className="glass-card rounded-xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-sm text-slate-350">Executive Verdict</h4>
              <span className="block text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Overall execution classification</span>
            </div>
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${
              classification === 'EXCELLENT' ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/5' :
              classification === 'GOOD' ? 'text-indigo-400 border-indigo-500/25 bg-indigo-500/5' :
              classification === 'FAIR' ? 'text-amber-400 border-amber-500/25 bg-amber-500/5' :
              'text-rose-400 border-rose-500/25 bg-rose-500/5'
            }`}>
              {classification}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-900">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Overall Score</span>
              <span className="text-2xl font-extrabold text-slate-200 block">{overallScore}%</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Confidence Rating</span>
              <span className="text-2xl font-extrabold text-slate-200 block">{confidenceScore}%</span>
            </div>
          </div>

          {/* Recommendation */}
          <div className={`p-4 border rounded-xl flex items-start space-x-3 text-xs leading-relaxed ${getSeverityAlertClasses(recommendationSeverity)}`}>
            <AlertIcon className="h-4.5 w-4.5 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="font-bold block uppercase text-[10px]">Release Recommendation</span>
              <p className="mt-1">{recommendation}</p>
            </div>
          </div>
        </div>

        {/* Rolling Sparkline Trends */}
        <div className="glass-card rounded-xl p-5 border border-slate-800 space-y-4">
          <div>
            <h4 className="font-semibold text-sm text-slate-350">Rolling Quality Trends</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Performance sparklines for the last 5 analysis runs</p>
          </div>

          <div className="space-y-3.5 divide-y divide-slate-900">
            {[
              { label: 'Pass Rate Progress', data: trends.history.map(h => h.passRate), color: 'text-emerald-400', dir: trends.passRateTrend },
              { label: 'Flaky Mitigation', data: trends.history.map(h => h.flakyRate), color: 'text-violet-400', dir: trends.flakyRateTrend },
              { label: 'Confidence Score', data: trends.history.map(h => h.confidenceScore), color: 'text-indigo-400', dir: trends.confidenceTrend }
            ].map((tr, i) => (
              <div key={i} className="flex items-center justify-between pt-3.5 first:pt-0">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">{tr.label}</span>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                    tr.dir === 'IMPROVING' ? 'text-emerald-400' :
                    tr.dir === 'DECLINING' ? 'text-rose-400' : 'text-slate-500'
                  }`}>
                    {tr.dir}
                  </span>
                </div>
                <div>
                  {renderSparkline(tr.data, tr.color)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Tabbed Lists */}
      <div className="lg:col-span-7 space-y-4">
        <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
          {/* Sub-tabs header */}
          <div className="flex border-b border-slate-850 bg-slate-950/20">
            {[
              { id: 'failures', label: 'Failures Group' },
              { id: 'flaky', label: 'Flaky Priority List' },
              { id: 'sources', label: 'Runner Sources' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-6 py-4.5 text-xs font-semibold transition-all border-b-2 ${
                  activeSubTab === tab.id 
                    ? 'border-indigo-500 text-indigo-300 bg-slate-900/30' 
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-tab view contents */}
          <div className="p-6">
            {activeSubTab === 'failures' && (
              <div className="space-y-4">
                {[
                  { label: 'Critical Failures', list: failures.critical, color: 'text-rose-400 border-rose-500/20 bg-rose-500/5', badge: 'CRITICAL' },
                  { label: 'High Failures', list: failures.high, color: 'text-orange-400 border-orange-500/20 bg-orange-500/5', badge: 'HIGH' },
                  { label: 'Medium Failures', list: failures.medium, color: 'text-amber-400 border-amber-500/20 bg-amber-500/5', badge: 'MEDIUM' },
                  { label: 'Low Failures', list: failures.low, color: 'text-slate-400 border-slate-850 bg-slate-900/40', badge: 'LOW' }
                ].map((sec, i) => {
                  if (sec.list.length === 0) return null;
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1">
                        <span>{sec.label}</span>
                        <span className={`px-2 py-0.5 border rounded-full text-[9px] ${sec.color}`}>{sec.list.length}</span>
                      </div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {sec.list.map((item, idx) => (
                          <div key={idx} className="glass-panel border border-slate-850 p-3 rounded-lg flex items-start justify-between space-x-4 text-xs leading-normal">
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-slate-350 block truncate">{item.testCaseName}</span>
                              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed truncate">{item.failureReason}</p>
                            </div>
                            {item.ciDeepLink && item.ciDeepLink !== '#' && (
                              <a
                                href={item.ciDeepLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-550 hover:text-indigo-400 transition-colors mt-0.5 flex-shrink-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.values(failures).every(f => f.length === 0) && (
                  <div className="text-center text-xs text-slate-500 py-12">
                    No execution failures occurred in this run.
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'flaky' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-900 pb-2">
                  <span>Test Case Name</span>
                  <div className="flex items-center space-x-6">
                    <span>Flaky Rate</span>
                    <span>Priority Score</span>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {[...flaky.high, ...flaky.medium, ...flaky.low].map((item, idx) => (
                    <div key={idx} className="glass-panel border border-slate-850/80 p-3.5 rounded-lg flex items-center justify-between text-xs hover:bg-slate-900/10 transition-colors duration-150">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-300 block truncate">{item.testCaseName}</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase mt-1.5 ${
                          item.flakySeverity === 'HIGH' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' :
                          item.flakySeverity === 'MEDIUM' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
                          'text-slate-400 border-slate-850 bg-slate-900/40'
                        }`}>
                          {item.flakySeverity} Severity
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-8 text-right font-medium text-slate-400 ml-4">
                        <span className="w-12">{item.flakyRate}%</span>
                        <span className="w-16 font-bold text-indigo-400">{item.maintenancePriorityScore}</span>
                      </div>
                    </div>
                  ))}
                  {[...flaky.high, ...flaky.medium, ...flaky.low].length === 0 && (
                    <div className="text-center text-xs text-slate-500 py-12">
                      Zero flaky tests detected across execution records.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'sources' && (
              <div className="space-y-4">
                <div className="border border-slate-850 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/20 text-slate-500 border-b border-slate-850 font-semibold">
                        <th className="p-4">Execution Source</th>
                        <th className="p-4 text-right">Avg Pass Rate</th>
                        <th className="p-4 text-right">Flaky Rate</th>
                        <th className="p-4 text-right">Runs Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {sources.map((src, i) => (
                        <tr key={i} className="hover:bg-slate-900/10 text-slate-300">
                          <td className="p-4 font-semibold text-slate-200 uppercase tracking-wide">{src.executionSource}</td>
                          <td className="p-4 text-right text-slate-450 font-medium">{src.averagePassRate}%</td>
                          <td className="p-4 text-right text-rose-450 font-medium">{src.flakyRate}%</td>
                          <td className="p-4 text-right text-slate-400">{src.sampleCount}</td>
                        </tr>
                      ))}
                      {sources.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-slate-500 py-12">
                            No source segments metrics recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
