import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle, 
  Layers,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { AnalysisRun } from '../types';
import { mapToCoverageViewModel } from '../utils/mappers';
import EmptyState from '../components/EmptyState';

interface CoverageMapsProps {
  run: AnalysisRun;
}

export default function CoverageMaps({ run }: CoverageMapsProps) {
  const coverage = mapToCoverageViewModel(run);
  const { 
    featureCoverage, 
    scenarioCoverage, 
    testCaseCoverage, 
    automationCoverage,
    coverageConfidenceScore,
    coverageClassification,
    coverageGapSummary,
    details 
  } = coverage;

  const getClassificationStyles = (c: string) => {
    switch (c) {
      case 'EXCELLENT':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'GOOD':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'FAIR':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  const getGapBadge = (type: string) => {
    switch (type.toUpperCase()) {
      case 'FEATURE':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25';
      case 'SCENARIO':
        return 'text-violet-400 bg-violet-500/10 border-violet-500/25';
      default:
        return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    }
  };

  if (featureCoverage === 0 && details.features.length === 0) {
    return (
      <EmptyState
        title="No Coverage Map"
        description="This run does not contain computed coverage mapping data. Verify that coverage index runs have completed."
        icon={Layers}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Classification card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card rounded-xl p-5 border border-slate-800 flex flex-col justify-between md:col-span-2 space-y-4">
          <div>
            <h4 className="font-semibold text-slate-350 text-sm">Coverage Verification Summary</h4>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Automated script traceability mapping</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Classification</span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border w-fit mt-1.5 ${getClassificationStyles(coverageClassification)}`}>
                {coverageClassification}
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Confidence Rating</span>
              <span className="text-2xl font-extrabold text-slate-200 mt-1">{coverageConfidenceScore}%</span>
            </div>
          </div>
        </div>

        {/* Mini stats cards */}
        {[
          { title: 'Scenario Coverage', val: `${scenarioCoverage}%`, color: 'text-indigo-400' },
          { title: 'Test Case Coverage', val: `${testCaseCoverage}%`, color: 'text-violet-400' }
        ].map((c, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-slate-850 flex flex-col justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.title}</span>
            <span className={`text-2xl font-bold tracking-tight mt-3 ${c.color}`}>{c.val}</span>
          </div>
        ))}
      </div>

      {/* Grid: Gaps and Map details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Gaps list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-card rounded-xl border border-slate-800 p-5 space-y-4">
            <div>
              <h4 className="font-semibold text-sm text-slate-350">Traceability Gaps</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Discovered requirements lacking automated test scripts</p>
            </div>

            {details.traceabilityGaps.length === 0 ? (
              <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl text-xs font-semibold">
                <CheckCircle className="h-4.5 w-4.5 flex-shrink-0" />
                <span>Zero traceability gaps identified. 100% covered.</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {details.traceabilityGaps.map((gap, i) => (
                  <div key={i} className="glass-panel border border-slate-850/80 p-3 rounded-lg flex items-start space-x-3 text-xs leading-normal">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getGapBadge(gap.type)}`}>
                          {gap.type}
                        </span>
                        <span className="font-semibold text-slate-300 truncate">{gap.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{gap.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Map listing table */}
        <div className="lg:col-span-7">
          <div className="glass-card rounded-xl border border-slate-800 p-5 space-y-4">
            <div>
              <h4 className="font-semibold text-sm text-slate-350">Coverage Grid Matrix</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Automated script status and weights mapped by feature</p>
            </div>

            <div className="border border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/20 text-slate-500 border-b border-slate-850 font-semibold">
                    <th className="p-4.5">Feature Name</th>
                    <th className="p-4.5 text-right">Coverage Ratio</th>
                    <th className="p-4.5 text-right">Traceability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {details.features.map((feature) => (
                    <tr key={feature.featureId} className="hover:bg-slate-900/10 text-slate-300">
                      <td className="p-4.5 font-semibold text-slate-200">{feature.featureName}</td>
                      <td className="p-4.5 text-right">
                        <div className="inline-flex items-center space-x-2">
                          <span className="font-semibold text-indigo-400">{feature.coverageRatio * 100}%</span>
                          <div className="w-12 bg-slate-900 rounded-full h-1 overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${feature.coverageRatio * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4.5 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          feature.confidenceScore >= 80 
                            ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' 
                            : 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                        }`}>
                          Score: {feature.confidenceScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
