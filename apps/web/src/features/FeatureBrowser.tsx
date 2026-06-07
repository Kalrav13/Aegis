import React, { useState } from 'react';
import { 
  Folder, 
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  Terminal, 
  BookOpen,
  PieChart
} from 'lucide-react';
import { AnalysisRun } from '../types';
import { mapToCoverageViewModel } from '../utils/mappers';
import EmptyState from '../components/EmptyState';

interface FeatureBrowserProps {
  run: AnalysisRun;
}

export default function FeatureBrowser({ run }: FeatureBrowserProps) {
  const coverage = mapToCoverageViewModel(run);
  const { features } = coverage.details;

  const [expandedFolder, setExpandedFolder] = useState<Record<string, boolean>>({});

  const toggleFolder = (id: string) => {
    setExpandedFolder(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (features.length === 0) {
    return (
      <EmptyState
        title="No Feature Context"
        description="This analysis run contains no feature structure context logs. Verify that automation script files exist."
        icon={Folder}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-250">Feature Explorer Tree</h3>
          <p className="text-xs text-slate-500 mt-0.5">Discovered functional features mapping scenario scripts</p>
        </div>
        <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-semibold bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
          <PieChart className="h-3.5 w-3.5" />
          <span>{features.length} Features Discovered</span>
        </div>
      </div>

      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        {/* Tree Header */}
        <div className="grid grid-cols-12 gap-4 bg-slate-950/20 text-slate-500 font-semibold text-xs border-b border-slate-850 px-6 py-4.5">
          <div className="col-span-6">Feature Name</div>
          <div className="col-span-2 text-right">Scenarios</div>
          <div className="col-span-2 text-right">Test Cases</div>
          <div className="col-span-2 text-right">Automated</div>
        </div>

        {/* Tree Body */}
        <div className="divide-y divide-slate-850">
          {features.map((feature) => {
            const isExpanded = !!expandedFolder[feature.featureId];
            const automationRate = feature.testCasesCount > 0 
              ? Math.round((feature.automatedCount / feature.testCasesCount) * 100)
              : 0;

            return (
              <React.Fragment key={feature.featureId}>
                <div 
                  onClick={() => toggleFolder(feature.featureId)}
                  className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-slate-900/10 cursor-pointer transition-colors duration-150 text-xs"
                >
                  {/* Folder expand & Icon */}
                  <div className="col-span-6 flex items-center space-x-3 text-slate-200">
                    <div className="text-slate-550">
                      {isExpanded ? <ChevronDown className="h-4.5 w-4.5" /> : <ChevronRight className="h-4.5 w-4.5" />}
                    </div>
                    <Folder className="h-4.5 w-4.5 text-indigo-400 flex-shrink-0" />
                    <span className="font-semibold truncate">{feature.featureName}</span>
                  </div>

                  <div className="col-span-2 text-right text-slate-400 font-medium">
                    {feature.scenariosCount}
                  </div>
                  
                  <div className="col-span-2 text-right text-slate-400 font-medium">
                    {feature.testCasesCount}
                  </div>

                  {/* Automation progress */}
                  <div className="col-span-2 text-right">
                    <span className={`inline-flex items-center space-x-1 font-semibold ${automationRate >= 80 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      <span>{automationRate}%</span>
                      <span className="text-[10px] text-slate-500">({feature.automatedCount})</span>
                    </span>
                  </div>
                </div>

                {/* Collapsible features nested info */}
                {isExpanded && (
                  <div className="bg-slate-950/20 px-12 py-4 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-900 pb-2">
                      <span className="font-bold flex items-center space-x-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                        <span>Functional Details</span>
                      </span>
                      <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                        Confidence Score: {feature.confidenceScore}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-6 text-xs py-1">
                      <div className="space-y-1">
                        <span className="text-slate-500 block uppercase text-[10px]">Traceability Rating</span>
                        <span className="text-slate-300 font-medium">Satisfactory</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 block uppercase text-[10px]">Associated Script Link</span>
                        <span className="text-slate-300 font-medium flex items-center space-x-1 text-slate-450 hover:text-indigo-400 transition-colors">
                          <Terminal className="h-3.5 w-3.5" />
                          <span>script_{feature.featureName.toLowerCase().replace(/\s+/g, '_')}.spec.ts</span>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-500 block uppercase text-[10px]">Testing Coverage</span>
                        <span className="text-slate-350 block font-medium">
                          {feature.coverageRatio * 100}% mapped elements
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
