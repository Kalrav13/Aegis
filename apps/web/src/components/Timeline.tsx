import React from 'react';
import { 
  GitPullRequest, 
  Filter, 
  Binary, 
  Sparkles, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';

interface TimelineProps {
  status: string;
  errorMessage?: string | null;
}

export default function Timeline({ status, errorMessage }: TimelineProps) {
  const steps = [
    { key: 'CLONING', label: 'Repository Cloning', icon: GitPullRequest },
    { key: 'FILTERING', label: 'Filtering Targets', icon: Filter },
    { key: 'ANALYZING', label: 'Analyzing Semantics', icon: Binary },
    { key: 'GENERATING', label: 'AI Test Discovery', icon: Sparkles },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2 }
  ];

  const getStepState = (stepKey: string, currentStatus: string) => {
    const s = currentStatus.toUpperCase();
    const stepIdx = steps.findIndex(x => x.key === stepKey);
    const currIdx = steps.findIndex(x => x.key === s);

    if (s === 'FAILED') {
      if (stepKey === 'COMPLETED') return 'FAILED';
      // If failed, mark steps before failure as completed, and current step as active/failed
      return 'COMPLETED'; // default older steps
    }

    if (s === 'COMPLETED') return 'COMPLETED';
    if (s === 'IDLE') return 'PENDING';

    if (stepKey === s) return 'ACTIVE';
    if (stepIdx < currIdx) return 'COMPLETED';
    return 'PENDING';
  };

  return (
    <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-slate-300">Analysis Progress Pipeline</h4>
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Real-time status</span>
      </div>

      <div className="flex items-center justify-between space-x-4 pt-2">
        {steps.map((step, idx) => {
          const state = getStepState(step.key, status);
          const IconComp = step.icon;
          
          let iconColor = 'text-slate-600 bg-slate-900 border-slate-850';
          let textColor = 'text-slate-500';
          let ping = false;

          if (state === 'COMPLETED') {
            iconColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
            textColor = 'text-slate-350';
          } else if (state === 'ACTIVE') {
            iconColor = 'text-indigo-400 bg-indigo-500/15 border-indigo-500/40';
            textColor = 'text-indigo-300 font-semibold';
            ping = true;
          } else if (state === 'FAILED') {
            iconColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
            textColor = 'text-rose-400';
          }

          return (
            <React.Fragment key={step.key}>
              <div className="flex items-center space-x-3 flex-1">
                <div className={`h-8 w-8 rounded-full border flex items-center justify-center relative flex-shrink-0 ${iconColor}`}>
                  {ping && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  )}
                  {state === 'FAILED' ? <XCircle className="h-4.5 w-4.5" /> : <IconComp className="h-4.5 w-4.5" />}
                </div>
                
                <div className="min-w-0 flex-1">
                  <span className={`block text-xs truncate ${textColor}`}>{step.label}</span>
                  <span className="block text-[9px] text-slate-500 capitalize">
                    {state === 'ACTIVE' ? 'Processing...' : state.toLowerCase()}
                  </span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="h-0.5 w-8 bg-slate-850 hidden md:block flex-shrink-0"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {status === 'FAILED' && errorMessage && (
        <div className="mt-4 p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-lg">
          <span className="block text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Analysis Failure Message</span>
          <p className="text-xs text-rose-350 mt-1 leading-relaxed">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
