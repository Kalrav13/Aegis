import React, { useState } from 'react';
import { 
  Folder, 
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  Terminal, 
  BookOpen,
  PieChart,
  Eye,
  Lightbulb,
  AlertTriangle
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
  const [expandedScenarios, setExpandedScenarios] = useState<Record<string, boolean>>({});

  const toggleFolder = (id: string) => {
    setExpandedFolder(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleScenario = (id: string) => {
    setExpandedScenarios(prev => ({ ...prev, [id]: !prev[id] }));
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
                  <div className="bg-slate-950/40 px-12 py-4 space-y-4 border-l-2 border-indigo-500/20 ml-6">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-900 pb-2">
                      <span className="font-bold flex items-center space-x-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Discovered Scenarios</span>
                      </span>
                      <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                        Confidence Score: {feature.confidenceScore}
                      </span>
                    </div>

                    {/* Quality Recommendations */}
                    {feature.qualityWarnings && feature.qualityWarnings.length > 0 && (
                      <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-450 flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">Quality Recommendations</span>
                          <ul className="list-disc list-inside mt-1 text-amber-400">
                            {feature.qualityWarnings.map((warn, idx) => (
                              <li key={idx}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Render Scenarios List */}
                    {(!feature.scenarios || feature.scenarios.length === 0) ? (
                      <div className="text-xs text-slate-500 py-2">No scenarios discovered for this feature.</div>
                    ) : (
                      <div className="space-y-3">
                        {feature.scenarios.map((scenario) => {
                          const isScenExpanded = !!expandedScenarios[scenario.id];
                          const tcList = scenario.testCases || [];
                          
                          // Determine scenario type badge style
                          const scenTypeColors = 
                            scenario.scenarioType === 'NEGATIVE' ? 'bg-rose-500/10 border-rose-500/20 text-rose-450' :
                            scenario.scenarioType === 'EDGE_CASE' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                            scenario.scenarioType === 'SECURITY' ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' :
                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-450';

                          return (
                            <div key={scenario.id} className="border border-slate-850/80 rounded-lg overflow-hidden bg-slate-950/20">
                              {/* Scenario Header */}
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleScenario(scenario.id);
                                }}
                                className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/40 cursor-pointer transition-all text-xs"
                              >
                                <div className="flex items-center space-x-2.5">
                                  <div className="text-slate-500">
                                    {isScenExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </div>
                                  <Lightbulb className="h-4 w-4 text-amber-450 shrink-0" />
                                  <span className="font-semibold text-slate-200">{scenario.scenarioName}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${scenTypeColors}`}>
                                    {scenario.scenarioType}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                    {tcList.length} Test Cases
                                  </span>
                                </div>
                              </div>

                              {/* Collapsible Scenario Details */}
                              {isScenExpanded && (
                                <div className="px-6 pb-4 pt-2 space-y-4 border-t border-slate-900 bg-slate-950/40 text-xs text-slate-350">
                                  <div className="space-y-1 mt-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Scenario Description</span>
                                    <p className="text-slate-300 leading-relaxed">{scenario.description}</p>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 text-[11px] border-y border-slate-900/60 py-2">
                                    <div>
                                      <span className="text-slate-550 block font-semibold">Risk Level:</span>
                                      <span className={`font-bold uppercase ${
                                        scenario.riskLevel === 'CRITICAL' || scenario.riskLevel === 'HIGH' ? 'text-rose-455' : 'text-slate-400'
                                      }`}>{scenario.riskLevel}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-550 block font-semibold">Priority:</span>
                                      <span className="text-indigo-400 font-bold uppercase">{scenario.priority}</span>
                                    </div>
                                  </div>

                                  {/* Test Cases List */}
                                  <div className="space-y-3">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Discovered Test Cases</span>
                                    {tcList.length === 0 ? (
                                      <div className="text-[11px] text-slate-500 italic pl-2">No test cases generated for this scenario.</div>
                                    ) : (
                                      <div className="space-y-3 pl-2">
                                        {tcList.map((tc) => {
                                          const isAutomated = tc.automationStatus === 'AUTOMATED';
                                          
                                          const tcTypeColors = 
                                            tc.testCaseType === 'NEGATIVE' ? 'bg-rose-500/10 border-rose-500/20 text-rose-455' :
                                            tc.testCaseType === 'EDGE_CASE' ? 'bg-amber-500/10 border-amber-500/20 text-amber-450' :
                                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-450';

                                          return (
                                            <div key={tc.id} className="border border-slate-900 rounded-lg p-4 bg-slate-950/60 space-y-3 shadow-sm hover:border-slate-800 transition-colors">
                                              {/* Test Case Header */}
                                              <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                  <div className="flex items-center space-x-2">
                                                    <span className="font-mono text-[10px] text-indigo-400 font-bold bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10 shrink-0">
                                                      {tc.testCaseKey}
                                                    </span>
                                                    <h5 className="font-bold text-slate-200 text-xs">{tc.testCaseName}</h5>
                                                  </div>
                                                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{tc.description}</p>
                                                </div>

                                                <div className="flex flex-col items-end space-y-1.5 shrink-0">
                                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${tcTypeColors}`}>
                                                    {tc.testCaseType}
                                                  </span>
                                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                                    isAutomated 
                                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold' 
                                                      : 'bg-slate-900 border-slate-800 text-slate-500'
                                                  }`}>
                                                    {tc.automationStatus}
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Preconditions */}
                                              {tc.preconditions && tc.preconditions.length > 0 && (
                                                <div className="text-[11px] bg-slate-900/30 p-2.5 rounded border border-slate-900/80">
                                                  <span className="text-slate-500 font-semibold block uppercase text-[9px] mb-1 tracking-wider">Preconditions</span>
                                                  <ul className="list-disc pl-4 space-y-1 text-slate-400 font-medium">
                                                    {tc.preconditions.map((prec, pIdx) => (
                                                      <li key={pIdx}>{prec}</li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}

                                              {/* Steps */}
                                              {tc.steps && tc.steps.length > 0 && (
                                                <div className="space-y-2">
                                                  <span className="text-slate-550 font-semibold block uppercase text-[9px] tracking-wider">Test Steps</span>
                                                  <div className="border border-slate-900/80 rounded-lg overflow-hidden divide-y divide-slate-900/80">
                                                    {tc.steps.map((step) => (
                                                      <div key={step.stepNumber} className="grid grid-cols-12 gap-3 p-2 bg-slate-950/20 text-[11px]">
                                                        <div className="col-span-1 font-bold text-slate-500 text-center shrink-0">
                                                          {step.stepNumber}
                                                        </div>
                                                        <div className="col-span-6 text-slate-350">
                                                          <span className="text-slate-550 uppercase text-[8px] font-bold block mb-0.5">Action</span>
                                                          <span className="font-medium">{step.action}</span>
                                                        </div>
                                                        <div className="col-span-5 text-slate-350">
                                                          <span className="text-slate-550 uppercase text-[8px] font-bold block mb-0.5">Expected</span>
                                                          <span className="font-medium text-slate-400">{step.expectedResult}</span>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}

                                              {/* Overall Expected Result */}
                                              {tc.expectedResult && (
                                                <div className="text-[11px] border-t border-slate-900/80 pt-2 flex items-start space-x-1.5 text-slate-400 leading-normal">
                                                  <Eye className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
                                                  <div>
                                                    <span className="text-slate-550 font-semibold uppercase text-[9px] tracking-wider block">Overall Expected Outcome</span>
                                                    <span className="font-medium text-slate-300">{tc.expectedResult}</span>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
