import React from 'react';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  FileCode, 
  Activity, 
  BarChart3, 
  Zap,
  Target,
  GitBranch
} from 'lucide-react';
import { AnalysisRun } from '../types';
import { mapToDashboardViewModel, mapToExecutionViewModel } from '../utils/mappers';

interface IntelligenceOverviewProps {
  run: AnalysisRun | null;
}

/* ── Score Ring SVG ─────────────────────────────────── */
function ScoreRing({ 
  value, 
  label, 
  color, 
  size = 110 
}: { 
  value: number; 
  label: string; 
  color: 'emerald' | 'amber' | 'rose' | 'indigo' | 'violet'; 
  size?: number;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const colorMap = {
    emerald: { stroke: '#34d399', bg: 'rgba(52,211,153,0.08)', text: 'text-emerald-400' },
    amber: { stroke: '#fbbf24', bg: 'rgba(251,191,36,0.08)', text: 'text-amber-400' },
    rose: { stroke: '#fb7185', bg: 'rgba(251,113,133,0.08)', text: 'text-rose-400' },
    indigo: { stroke: '#818cf8', bg: 'rgba(129,140,248,0.08)', text: 'text-indigo-400' },
    violet: { stroke: '#a78bfa', bg: 'rgba(167,139,250,0.08)', text: 'text-violet-400' },
  };

  const c = colorMap[color];

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(148,163,184,0.08)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={c.stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${c.stroke}40)` }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold tabular-nums ${c.text}`}>
            {Math.round(value)}
          </span>
        </div>
      </div>
      <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

/* ── Readiness Check Row ────────────────────────────── */
function ReadinessCheck({ 
  label, 
  passed, 
  detail 
}: { 
  label: string; 
  passed: boolean; 
  detail?: string;
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-4 rounded-lg transition-colors ${
      passed ? 'hover:bg-emerald-500/5' : 'hover:bg-rose-500/5'
    }`}>
      <div className="flex items-center space-x-3">
        {passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
        )}
        <span className="text-xs text-slate-300 font-medium">{label}</span>
      </div>
      <div className="flex items-center space-x-2">
        {detail && (
          <span className="text-[10px] text-slate-500 font-mono">{detail}</span>
        )}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          passed ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          {passed ? 'PASS' : 'FAIL'}
        </span>
      </div>
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────── */
function StatCard({ 
  icon: IconComp, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  color: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
    violet: 'from-violet-500/10 to-violet-500/5 border-violet-500/20 text-violet-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
  };
  const cls = colorMap[color] || colorMap.indigo;

  return (
    <div className={`bg-gradient-to-br ${cls} border rounded-xl p-5 flex flex-col items-center space-y-2`}>
      <IconComp className="h-5 w-5 opacity-70" />
      <span className="text-2xl font-bold text-slate-100 tabular-nums">{value.toLocaleString()}</span>
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────── */
export default function IntelligenceOverview({ run }: IntelligenceOverviewProps) {
  if (!run || run.status !== 'COMPLETED') {
    return (
      <div className="py-16">
        <div className="text-center space-y-4 max-w-sm mx-auto">
          <div className="h-14 w-14 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto">
            <Zap className="h-7 w-7 text-slate-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-300">Intelligence Overview Unavailable</h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              A completed analysis run is required to generate the consolidated intelligence scorecard. 
              Trigger an analysis and wait for completion.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dashVM = mapToDashboardViewModel(run);
  const execVM = mapToExecutionViewModel(run);

  // Computed overall readiness score
  const overallScore = Math.round(
    (dashVM.coverageConfidence + dashVM.executionConfidence + dashVM.passRate) / 3
  );

  const scoreColor = (v: number): 'emerald' | 'amber' | 'rose' => 
    v >= 80 ? 'emerald' : v >= 50 ? 'amber' : 'rose';

  // Readiness checks
  const checks = [
    { label: 'Coverage Analysis Available', passed: dashVM.coverageConfidence > 0, detail: `${dashVM.coverageConfidence}%` },
    { label: 'Execution Analysis Available', passed: dashVM.executionConfidence > 0, detail: `${dashVM.executionConfidence}%` },
    { label: 'Automation Coverage > 50%', passed: dashVM.automationCoverage >= 50, detail: `${dashVM.automationCoverage}%` },
    { label: 'Pass Rate > 80%', passed: dashVM.passRate >= 80, detail: `${dashVM.passRate}%` },
    { label: 'Flaky Rate < 10%', passed: dashVM.flakyRate < 10, detail: `${dashVM.flakyRate}%` },
    { label: 'Release Ready Gate', passed: dashVM.ready, detail: dashVM.ready ? 'Approved' : `${dashVM.blockingReasons.length} blocker(s)` },
  ];

  const passedChecks = checks.filter(c => c.passed).length;

  return (
    <div className="space-y-8">
      {/* ── Section Header ── */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-11 w-11 bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 rounded-xl flex items-center justify-center border border-indigo-500/20">
              <Shield className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Intelligence Overview
              </h2>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                Consolidated quality scorecard — Commit {dashVM.commitSha.substring(0, 7)}
              </span>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${
            dashVM.ready 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            {dashVM.ready ? '● Release Ready' : '○ Not Ready'}
          </div>
        </div>
      </div>

      {/* ── Score Meters Row ── */}
      <div className="glass-card rounded-2xl p-8 border border-slate-800">
        <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-6">
          Quality Score Meters
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 justify-items-center">
          <ScoreRing 
            value={overallScore} 
            label="Overall Readiness" 
            color={scoreColor(overallScore)} 
          />
          <ScoreRing 
            value={dashVM.coverageConfidence} 
            label="Coverage Score" 
            color={scoreColor(dashVM.coverageConfidence)} 
          />
          <ScoreRing 
            value={dashVM.executionConfidence} 
            label="Execution Score" 
            color={scoreColor(dashVM.executionConfidence)} 
          />
          <ScoreRing 
            value={dashVM.passRate} 
            label="Pass Rate" 
            color={scoreColor(dashVM.passRate)} 
          />
        </div>
      </div>

      {/* ── Readiness Checklist + Structural Counts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Readiness Checklist */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Readiness Checklist
            </h3>
            <span className={`text-xs font-bold tabular-nums ${
              passedChecks === checks.length ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {passedChecks}/{checks.length} passed
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-1.5 bg-slate-800 rounded-full mb-5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${
                passedChecks === checks.length 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' 
                  : 'bg-gradient-to-r from-amber-500 to-amber-400'
              }`}
              style={{ width: `${(passedChecks / checks.length) * 100}%` }}
            />
          </div>

          <div className="space-y-0.5">
            {checks.map((check) => (
              <ReadinessCheck key={check.label} {...check} />
            ))}
          </div>

          {/* Blocking reasons */}
          {dashVM.blockingReasons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800/50 space-y-2">
              <h4 className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                <AlertTriangle className="h-3 w-3" />
                <span>Blocking Reasons</span>
              </h4>
              {dashVM.blockingReasons.map((reason, i) => (
                <div key={i} className="bg-rose-500/5 border border-rose-500/10 rounded-lg px-3 py-2">
                  <span className="text-xs text-rose-300/70">{reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Structural Counts */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-slate-800">
            <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">
              Repository Structure
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={GitBranch} label="Features" value={dashVM.featureCount} color="indigo" />
              <StatCard icon={Target} label="Scenarios" value={dashVM.scenarioCount} color="violet" />
              <StatCard icon={FileCode} label="Test Cases" value={dashVM.testCaseCount} color="emerald" />
              <StatCard icon={Activity} label="Automated" value={dashVM.automatedCount} color="amber" />
            </div>
          </div>

          {/* Quick metrics */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800">
            <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">
              Key Metrics
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Automation Coverage</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(dashVM.automationCoverage, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-violet-400 font-bold tabular-nums w-10 text-right">
                    {dashVM.automationCoverage}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Flaky Rate</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        dashVM.flakyRate <= 5 ? 'bg-emerald-500' : dashVM.flakyRate <= 15 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(dashVM.flakyRate, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold tabular-nums w-10 text-right ${
                    dashVM.flakyRate <= 5 ? 'text-emerald-400' : dashVM.flakyRate <= 15 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {dashVM.flakyRate}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Execution Score</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(execVM.overallScore, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-indigo-400 font-bold tabular-nums w-10 text-right">
                    {execVM.overallScore}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Risk Assessment ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Risks */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Top Risks
            </h3>
          </div>
          {execVM.topRisks.length > 0 ? (
            <div className="space-y-2">
              {execVM.topRisks.map((risk, i) => (
                <div key={i} className="flex items-start space-x-3 py-2 px-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                  <span className="text-[10px] text-rose-400 font-bold mt-0.5 shrink-0">{i + 1}</span>
                  <span className="text-xs text-rose-300/80 leading-relaxed">{risk}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <span className="text-xs text-slate-600">No significant risks detected</span>
            </div>
          )}
        </div>

        {/* Top Strengths */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Top Strengths
            </h3>
          </div>
          {execVM.topStrengths.length > 0 ? (
            <div className="space-y-2">
              {execVM.topStrengths.map((strength, i) => (
                <div key={i} className="flex items-start space-x-3 py-2 px-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <span className="text-[10px] text-emerald-400 font-bold mt-0.5 shrink-0">{i + 1}</span>
                  <span className="text-xs text-emerald-300/80 leading-relaxed">{strength}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <span className="text-xs text-slate-600">Run analysis to discover strengths</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Executive Recommendation ── */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
        <div className={`h-1 w-full ${
          execVM.recommendationSeverity === 'CRITICAL' 
            ? 'bg-gradient-to-r from-rose-500 to-rose-400' 
            : execVM.recommendationSeverity === 'WARNING'
              ? 'bg-gradient-to-r from-amber-500 to-amber-400'
              : 'bg-gradient-to-r from-indigo-500 to-violet-500'
        }`} />
        <div className="p-6">
          <div className="flex items-center space-x-2 mb-3">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Executive Recommendation
            </h3>
            <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
              execVM.recommendationSeverity === 'CRITICAL' 
                ? 'bg-rose-500/10 text-rose-400' 
                : execVM.recommendationSeverity === 'WARNING'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-indigo-500/10 text-indigo-400'
            }`}>
              {execVM.recommendationSeverity}
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {execVM.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
