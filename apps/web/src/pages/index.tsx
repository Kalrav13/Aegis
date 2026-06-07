import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  Play, 
  History as HistoryIcon, 
  Download, 
  CheckCircle,
  Activity, 
  Layers, 
  FileCode, 
  BarChart3,
  RefreshCw,
  GitCompare,
  Plus
} from 'lucide-react';

import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import StatusBadge from '@/components/StatusBadge';
import MetricCard from '@/components/MetricCard';
import HealthWidget from '@/components/HealthWidget';
import Timeline from '@/components/Timeline';
import RunComparer from '@/components/RunComparer';
import AnalysisDetailsDrawer from '@/components/AnalysisDetailsDrawer';
import BackendOfflineState from '@/components/BackendOfflineState';
import { CardSkeleton, TableSkeleton } from '@/components/Skeletons';
import { useToast } from '@/components/Toast';
import { useAnalysisPolling } from '@/hooks/useAnalysisPolling';
import { useUrlState } from '@/hooks/useUrlState';
import { useAuditLogger } from '@/hooks/useAuditLogger';
import { useUIStore } from '@/store/store';

import FeatureBrowser from '@/features/FeatureBrowser';
import CoverageMaps from '@/features/CoverageMaps';
import ExecutionTab from '@/features/ExecutionTab';
import SettingsPanel from '@/features/SettingsPanel';
import IntelligenceOverview from '@/features/IntelligenceOverview';

import { Project, AnalysisRun } from '@/types';
import { 
  fetchProjects, 
  createProject, 
  triggerAnalysis, 
  fetchProjectHistory 
} from '@/utils/api';
import { mapToDashboardViewModel } from '@/utils/mappers';
import { exportAnalysisRunAsJson } from '@/utils/export';

export default function Home() {
  const { showToast } = useToast();
  const { logEvent } = useAuditLogger();

  // Activate URL ↔ Zustand synchronization
  useUrlState();

  // Read global UI state from Zustand
  const { activeTab, setActiveTab } = useUIStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<AnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  
  // Project creation modal details
  const [showAddProject, setShowAddProject] = useState<boolean>(false);
  const [newProjName, setNewProjName] = useState<string>('');
  const [newProjRepo, setNewProjRepo] = useState<string>('');
  const [newProjBranch, setNewProjBranch] = useState<string>('main');

  // Comparison selections
  const [compareAId, setCompareAId] = useState<string>('');
  const [compareBId, setCompareBId] = useState<string>('');
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Details drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Initialize projects list
  useEffect(() => {
    async function load() {
      try {
        const projs = await fetchProjects();
        setProjects(projs);
        if (projs.length > 0) {
          setSelectedProject(projs[0]);
        }
      } catch (err) {
        showToast('Failed to load projects.', 'ERROR');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  // Load project run history
  useEffect(() => {
    if (!selectedProject) return;
    async function loadHistory() {
      setLoading(true);
      try {
        const hist = await fetchProjectHistory(selectedProject!.id);
        setHistory(hist);
        if (hist.length > 0) {
          setSelectedRun(hist[0]);
        } else {
          setSelectedRun(null);
        }
      } catch (err) {
        showToast('Failed to load project run history.', 'ERROR');
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [selectedProject, showToast]);

  // Sync active analysis updates dynamically via polling hooks
  useAnalysisPolling({
    analysisId: selectedRun ? selectedRun.id : null,
    status: selectedRun ? selectedRun.status : null,
    onStatusUpdate: (updatedRun) => {
      // Update running entity inside logs history list
      setHistory((prev) => 
        prev.map((r) => (r.id === updatedRun.id ? updatedRun : r))
      );
      // Update selected panel payload if it matches active view
      if (selectedRun && selectedRun.id === updatedRun.id) {
        setSelectedRun(updatedRun);
      }
      
      // Notify user on completion
      if (selectedRun && selectedRun.id === updatedRun.id && selectedRun.status !== updatedRun.status) {
        if (updatedRun.status === 'COMPLETED') {
          showToast(`Analysis run #${updatedRun.id.substring(0, 5)} completed successfully!`, 'SUCCESS');
        } else if (updatedRun.status === 'FAILED') {
          showToast(`Analysis run #${updatedRun.id.substring(0, 5)} failed.`, 'ERROR');
        }
      }
    }
  });

  // Handle triggering a new scan
  const handleTriggerAnalysis = async () => {
    if (!selectedProject) return;
    setTriggering(true);
    logEvent('ANALYSIS_TRIGGERED', { projectId: selectedProject.id });
    showToast('Initializing repository clone and analysis pipeline...', 'INFO');
    try {
      const newRun = await triggerAnalysis(selectedProject.id);
      setHistory(prev => [newRun, ...prev]);
      setSelectedRun(newRun);
      showToast('Analysis run triggered successfully.', 'SUCCESS');
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger run.', 'ERROR');
    } finally {
      setTriggering(false);
    }
  };

  // Handle creating a new project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const proj = await createProject({
        name: newProjName,
        repoUrl: newProjRepo,
        branch: newProjBranch
      });
      setProjects(prev => [...prev, proj]);
      setSelectedProject(proj);
      setShowAddProject(false);
      setNewProjName('');
      setNewProjRepo('');
      setNewProjBranch('main');
      logEvent('PROJECT_CREATED', { projectId: proj.id, name: proj.name });
      showToast(`Project '${proj.name}' registered successfully.`, 'SUCCESS');
    } catch (err: any) {
      showToast(err.message || 'Failed to create project.', 'ERROR');
    }
  };

  // Handle tab change with audit logging
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    logEvent('TAB_CHANGED', { tab });
  };

  // Handle run selection with audit
  const handleSelectRun = (run: AnalysisRun) => {
    setSelectedRun(run);
    logEvent('ANALYSIS_SELECTED', { runId: run.id, status: run.status });
  };

  // Handle export with audit
  const handleExport = () => {
    if (selectedRun) {
      exportAnalysisRunAsJson(selectedRun);
      logEvent('EXPORT_TRIGGERED', { runId: selectedRun.id });
    }
  };

  // Handle drawer
  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
    logEvent('DRAWER_OPENED', { runId: selectedRun?.id });
  };

  const dashboardVM = selectedRun ? mapToDashboardViewModel(selectedRun) : null;

  return (
    <>
      <Head>
        <title>TestLens Dashboard Console</title>
        <meta name="description" content="AI-powered QA Analyst platform — consolidated test intelligence dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Backend offline overlay */}
      <BackendOfflineState />

      <Layout 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        projectName={selectedProject?.name}
        repoUrl={selectedProject?.gitUrl}
        onRunDetailsClick={selectedRun ? handleOpenDrawer : undefined}
      >
        {/* Project Selector header and actions controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-3">
            <select
              id="project-selector"
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const proj = projects.find(p => p.id === e.target.value);
                if (proj) {
                  setSelectedProject(proj);
                  logEvent('PROJECT_SELECTED', { projectId: proj.id });
                }
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 font-semibold outline-none focus:border-indigo-500 cursor-pointer min-w-[200px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            
            <button
              id="add-project-btn"
              onClick={() => setShowAddProject(true)}
              className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800/60 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
              title="Add New Project"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>

          {selectedProject && (
            <div className="flex items-center space-x-3">
              {/* Trigger button */}
              <button
                id="trigger-analysis-btn"
                onClick={handleTriggerAnalysis}
                disabled={triggering || !!(selectedRun && ['CLONING', 'FILTERING', 'ANALYZING', 'GENERATING'].includes(selectedRun.status))}
                className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-800/80 disabled:text-slate-500 text-white font-semibold rounded-lg text-xs flex items-center space-x-2 transition-all duration-150 shadow-lg shadow-indigo-600/10"
              >
                {triggering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span>Trigger Analysis Run</span>
              </button>

              {/* Export JSON button */}
              {selectedRun && selectedRun.status === 'COMPLETED' && (
                <button
                  id="export-json-btn"
                  onClick={handleExport}
                  className="px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800/60 rounded-lg text-slate-300 hover:text-indigo-400 text-xs font-semibold flex items-center space-x-2 transition-all duration-150"
                  title="Export Run as JSON"
                >
                  <Download className="h-4 w-4" />
                  <span>Export JSON</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Loading Skeleton indicators */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />)}
            </div>
            <TableSkeleton />
          </div>
        ) : !selectedRun ? (
          /* Empty Workspace state */
          <div className="py-12">
            <div className="text-center space-y-4 max-w-md mx-auto">
              <HistoryIcon className="h-12 w-12 text-slate-600 mx-auto" />
              <div>
                <h3 className="font-bold text-slate-200">No Run Logs Yet</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                  There are no completed analysis scans for this project. Trigger your first run to populate the metrics dashboard.
                </p>
              </div>
              <button
                onClick={handleTriggerAnalysis}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-colors mx-auto block mt-2"
              >
                Initialize Scan
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Realtime pipeline progress timeline */}
            {['CLONING', 'FILTERING', 'ANALYZING', 'GENERATING', 'FAILED'].includes(selectedRun.status) && (
              <Timeline status={selectedRun.status} errorMessage={selectedRun.errorMessage} />
            )}

            {/* Dashboard metrics cards */}
            {dashboardVM && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
                <MetricCard 
                  title="Pass Rate Score" 
                  value={`${dashboardVM.passRate}%`} 
                  icon={CheckCircle}
                  progress={dashboardVM.passRate}
                  color={dashboardVM.passRate >= 95 ? 'emerald' : dashboardVM.passRate >= 80 ? 'indigo' : 'rose'}
                />
                <MetricCard 
                  title="Automation Ratio" 
                  value={`${dashboardVM.automationCoverage}%`} 
                  icon={FileCode}
                  progress={dashboardVM.automationCoverage}
                  color="violet"
                />
                <MetricCard 
                  title="Coverage Confidence" 
                  value={`${dashboardVM.coverageConfidence}%`} 
                  icon={Layers}
                  progress={dashboardVM.coverageConfidence}
                  color="indigo"
                />
                <MetricCard 
                  title="Execution Confidence" 
                  value={`${dashboardVM.executionConfidence}%`} 
                  icon={BarChart3}
                  progress={dashboardVM.executionConfidence}
                  color={dashboardVM.executionConfidence >= 80 ? 'emerald' : 'amber'}
                />
                <MetricCard 
                  title="Flakiness Index" 
                  value={`${dashboardVM.flakyRate}%`} 
                  icon={Activity}
                  progress={dashboardVM.flakyRate}
                  color={dashboardVM.flakyRate <= 5 ? 'emerald' : dashboardVM.flakyRate <= 15 ? 'amber' : 'rose'}
                  subText="Lower is better"
                />
              </div>
            )}

            {/* Tab Panes Workspace */}
            <ErrorBoundary title={`${activeTab} view panel`}>
              {activeTab === 'dashboard' && dashboardVM && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5">
                    <HealthWidget viewModel={dashboardVM} />
                  </div>
                  
                  {/* Run History List logs */}
                  <div className="lg:col-span-7 glass-card rounded-xl p-5 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                      <div>
                        <h4 className="font-semibold text-sm text-slate-350">Run History logs</h4>
                        <span className="block text-[9px] text-slate-500 font-semibold uppercase mt-0.5">Toggle historical run payloads</span>
                      </div>
                      
                      {compareAId && compareBId && (
                        <button
                          id="compare-runs-btn"
                          onClick={() => {
                            setIsComparing(true);
                            logEvent('RUN_COMPARED', { runA: compareAId, runB: compareBId });
                          }}
                          className="px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-all duration-150"
                        >
                          <GitCompare className="h-4 w-4" />
                          <span>Compare selected</span>
                        </button>
                      )}
                    </div>

                    <div className="border border-slate-850 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950/20 text-slate-500 border-b border-slate-850 font-semibold">
                            <th className="p-4">Selection</th>
                            <th className="p-4">Commit Sha</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {history.map((runItem) => {
                            const isSelected = selectedRun?.id === runItem.id;
                            const isA = compareAId === runItem.id;
                            const isB = compareBId === runItem.id;
                            return (
                              <tr 
                                key={runItem.id} 
                                className={`cursor-pointer transition-colors duration-150 ${
                                  isSelected ? 'bg-slate-900/40 text-slate-200' : 'hover:bg-slate-900/10 text-slate-400'
                                }`}
                                onClick={() => handleSelectRun(runItem)}
                              >
                                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center space-x-3">
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={isA}
                                        onChange={() => setCompareAId(isA ? '' : runItem.id)}
                                        className="rounded border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer bg-slate-950 h-3.5 w-3.5"
                                        title="Compare A (Base)"
                                      />
                                      <span className="text-[10px] text-slate-500">A</span>
                                    </label>
                                    <label className="flex items-center space-x-1 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={isB}
                                        onChange={() => setCompareBId(isB ? '' : runItem.id)}
                                        className="rounded border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer bg-slate-950 h-3.5 w-3.5"
                                        title="Compare B (Target)"
                                      />
                                      <span className="text-[10px] text-slate-500">B</span>
                                    </label>
                                  </div>
                                </td>
                                <td className="p-4 font-mono font-medium">{runItem.commitSha.substring(0, 7)}</td>
                                <td className="p-4">
                                  <StatusBadge status={runItem.status} />
                                </td>
                                <td className="p-4 text-right font-medium">
                                  {new Date(runItem.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'intelligence' && (
                <IntelligenceOverview run={selectedRun} />
              )}

              {activeTab === 'features' && (
                <FeatureBrowser run={selectedRun} />
              )}

              {activeTab === 'coverage' && (
                <CoverageMaps run={selectedRun} />
              )}

              {activeTab === 'execution' && (
                <ExecutionTab run={selectedRun} />
              )}

              {activeTab === 'settings' && (
                <SettingsPanel 
                  initialRepoUrl={selectedProject?.gitUrl}
                  initialBranch={selectedProject?.defaultBranch}
                />
              )}
            </ErrorBoundary>
          </div>
        )}

        {/* Modal: Compare Runs */}
        {isComparing && compareAId && compareBId && (
          <RunComparer 
            runA={history.find(h => h.id === compareAId)!}
            runB={history.find(h => h.id === compareBId)!}
            onClose={() => {
              setIsComparing(false);
              setCompareAId('');
              setCompareBId('');
            }}
          />
        )}

        {/* Modal: Create Project onboarding form */}
        {showAddProject && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-md border border-slate-800 rounded-xl shadow-glass flex flex-col">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-slate-200">Register Repository</h3>
                <button onClick={() => setShowAddProject(false)} className="text-slate-500 hover:text-slate-350 transition-colors">
                  <Plus className="h-5 w-5 transform rotate-45" />
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="p-6 space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Workspace Project Name</label>
                  <input 
                    type="text" 
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder="e.g. TestLens Core API"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-300 font-medium outline-none focus:border-indigo-500"
                    required
                    id="new-project-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Repository URL</label>
                  <input 
                    type="text" 
                    value={newProjRepo}
                    onChange={(e) => setNewProjRepo(e.target.value)}
                    placeholder="https://github.com/company/repo.git"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-300 font-medium outline-none focus:border-indigo-500"
                    required
                    id="new-project-repo"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Default Branch</label>
                  <input 
                    type="text" 
                    value={newProjBranch}
                    onChange={(e) => setNewProjBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-300 font-medium outline-none focus:border-indigo-500"
                    required
                    id="new-project-branch"
                  />
                </div>
                <div className="pt-4 border-t border-slate-900 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddProject(false)}
                    className="px-4 py-2 bg-slate-850 border border-slate-800 text-slate-300 font-semibold hover:bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-semibold rounded-lg shadow-lg shadow-indigo-650/10"
                    id="create-project-submit"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Layout>

      {/* Details Drawer */}
      <AnalysisDetailsDrawer
        run={selectedRun}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          logEvent('DRAWER_CLOSED');
        }}
        projectName={selectedProject?.name}
      />
    </>
  );
}
