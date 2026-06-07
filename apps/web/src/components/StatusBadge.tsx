import React from 'react';
import { 
  Play, 
  Search, 
  RotateCw, 
  CheckCircle, 
  XCircle, 
  HelpCircle 
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getBadgeDetails = (statusStr: string) => {
    const formatted = statusStr.toUpperCase();
    switch (formatted) {
      case 'IDLE':
        return {
          bg: 'bg-slate-800/80 border-slate-700 text-slate-300',
          icon: Play,
          label: 'Idle',
          animate: false
        };
      case 'CLONING':
        return {
          bg: 'bg-blue-950/45 border-blue-900/60 text-blue-300',
          icon: RotateCw,
          label: 'Cloning Repository',
          animate: true
        };
      case 'FILTERING':
        return {
          bg: 'bg-cyan-950/45 border-cyan-900/60 text-cyan-300',
          icon: Search,
          label: 'Filtering Content',
          animate: true
        };
      case 'ANALYZING':
        return {
          bg: 'bg-indigo-950/45 border-indigo-900/60 text-indigo-300',
          icon: RotateCw,
          label: 'Analyzing Architecture',
          animate: true
        };
      case 'GENERATING':
        return {
          bg: 'bg-violet-950/45 border-violet-900/60 text-violet-300',
          icon: RotateCw,
          label: 'Generating Coverage',
          animate: true
        };
      case 'COMPLETED':
        return {
          bg: 'bg-emerald-950/45 border-emerald-900/60 text-emerald-400',
          icon: CheckCircle,
          label: 'Completed',
          animate: false
        };
      case 'FAILED':
        return {
          bg: 'bg-rose-950/45 border-rose-900/60 text-rose-400',
          icon: XCircle,
          label: 'Failed',
          animate: false
        };
      default:
        return {
          bg: 'bg-slate-800/80 border-slate-700 text-slate-400',
          icon: HelpCircle,
          label: statusStr || 'Unknown',
          animate: false
        };
    }
  };

  const details = getBadgeDetails(status);
  const IconComp = details.icon;

  return (
    <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${details.bg}`}>
      <IconComp className={`h-3.5 w-3.5 ${details.animate ? 'animate-spin' : ''}`} />
      <span>{details.label}</span>
    </span>
  );
}
