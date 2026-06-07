import React from 'react';
import { X, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { AnalysisRun } from '../types';
import { mapToComparisonViewModel } from '../utils/mappers';

interface RunComparerProps {
  runA: AnalysisRun;
  runB: AnalysisRun;
  onClose: () => void;
}

export default function RunComparer({ runA, runB, onClose }: RunComparerProps) {
  const comparison = mapToComparisonViewModel(runA, runB);

  const formatDelta = (val: number, isFlaky = false) => {
    if (val === 0) {
      return {
        text: 'No change',
        color: 'text-slate-400',
        icon: Minus
      };
    }
    
    const isImprovement = isFlaky ? val < 0 : val > 0;
    const sign = val > 0 ? '+' : '';

    return {
      text: `${sign}${val}%`,
      color: isImprovement ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-rose-400 bg-rose-500/10 border-rose-500/25',
      icon: isImprovement ? TrendingUp : TrendingDown
    };
  };

  const formatCountDelta = (val: number) => {
    if (val === 0) return { text: '0', color: 'text-slate-400' };
    const sign = val > 0 ? '+' : '';
    return {
      text: `${sign}${val}`,
      color: val > 0 ? 'text-emerald-400' : 'text-rose-400'
    };
  };

  const deltaPass = formatDelta(comparison.passRateDelta);
  const deltaFlaky = formatDelta(comparison.flakyRateDelta, true);
  const deltaConf = formatDelta(comparison.confidenceDelta);
  const deltaCov = formatDelta(comparison.coverageDelta);

  const deltaFeatures = formatCountDelta(comparison.featuresCountDelta);
  const deltaScenarios = formatCountDelta(comparison.scenariosCountDelta);
  const deltaTests = formatCountDelta(comparison.testCasesCountDelta);
  const deltaAuto = formatCountDelta(comparison.automatedCountDelta);

  const getRunName = (run: AnalysisRun) => {
    const dateStr = new Date(run.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `Run #${run.id.substring(0, 5)} (${dateStr})`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-2xl border border-slate-800 rounded-xl shadow-glass flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-200">Comparison Report</h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
              Run delta calculations (Run B vs Run A)
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-500 hover:text-slate-350 transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-2 gap-4 text-xs font-semibold p-4 bg-slate-950/45 border border-slate-900 rounded-xl">
            <div>
              <span className="text-slate-500 block uppercase">Run A (Base)</span>
              <span className="text-slate-300 text-sm mt-0.5 block truncate">{getRunName(runA)}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase">Run B (Target)</span>
              <span className="text-slate-300 text-sm mt-0.5 block truncate">{getRunName(runB)}</span>
            </div>
          </div>

          {/* Rates Comparisons */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quality Rates Deltas</h4>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Pass Rate Progression', delta: deltaPass },
                { label: 'Flaky Rate Mitigation', delta: deltaFlaky },
                { label: 'Execution Confidence Delta', delta: deltaConf },
                { label: 'Automation Coverage Delta', delta: deltaCov }
              ].map((item, i) => {
                const IconComp = item.delta.icon;
                return (
                  <div key={i} className="glass-panel border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-slate-450 font-medium">{item.label}</span>
                    <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${item.delta.color}`}>
                      <IconComp className="h-3.5 w-3.5" />
                      <span>{item.delta.text}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Counts Comparisons */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Codebase Entity Deltas</h4>
            
            <div className="border border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/20 text-slate-500 border-b border-slate-850">
                    <th className="p-4 font-semibold">Entity Type</th>
                    <th className="p-4 font-semibold text-right">Run A</th>
                    <th className="p-4 font-semibold text-right">Run B</th>
                    <th className="p-4 font-semibold text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {[
                    { name: 'Discovered Features', a: runA.repositoryStatistics?.totalFeatures || 0, b: runB.repositoryStatistics?.totalFeatures || 0, delta: deltaFeatures },
                    { name: 'Functional Scenarios', a: runA.repositoryStatistics?.totalScenarios || 0, b: runB.repositoryStatistics?.totalScenarios || 0, delta: deltaScenarios },
                    { name: 'Discovered Test Cases', a: runA.repositoryStatistics?.totalTestCases || 0, b: runB.repositoryStatistics?.totalTestCases || 0, delta: deltaTests },
                    { name: 'Automated Scripts', a: runA.repositoryStatistics?.totalAutomated || 0, b: runB.repositoryStatistics?.totalAutomated || 0, delta: deltaAuto }
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-slate-900/10 text-slate-300">
                      <td className="p-4 font-medium">{row.name}</td>
                      <td className="p-4 text-right text-slate-400">{row.a}</td>
                      <td className="p-4 text-right text-slate-400">{row.b}</td>
                      <td className={`p-4 text-right font-bold ${row.delta.color}`}>{row.delta.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/25 flex items-center justify-between text-[11px] text-slate-500 rounded-b-xl">
          <div className="flex items-center space-x-1">
            <Info className="h-3.5 w-3.5" />
            <span>Delta computes mathematically as Target value minus Base value.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-colors duration-150"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
