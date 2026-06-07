import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subText?: string;
  color?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet';
  progress?: number;
}

export default function MetricCard({
  title,
  value,
  icon: IconComp,
  subText,
  color = 'indigo',
  progress
}: MetricCardProps) {
  const getColorClasses = (c: string) => {
    switch (c) {
      case 'emerald':
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/10 text-emerald-400',
          border: 'hover:border-emerald-500/20',
          bar: 'bg-emerald-500',
          glow: 'hover:shadow-emerald-500/5'
        };
      case 'rose':
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500/10 text-rose-400',
          border: 'hover:border-rose-500/20',
          bar: 'bg-rose-500',
          glow: 'hover:shadow-rose-500/5'
        };
      case 'amber':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500/10 text-amber-400',
          border: 'hover:border-amber-500/20',
          bar: 'bg-amber-500',
          glow: 'hover:shadow-amber-500/5'
        };
      case 'violet':
        return {
          text: 'text-violet-400',
          bg: 'bg-violet-500/10 text-violet-400',
          border: 'hover:border-violet-500/20',
          bar: 'bg-violet-500',
          glow: 'hover:shadow-violet-500/5'
        };
      default:
        return {
          text: 'text-indigo-400',
          bg: 'bg-indigo-500/10 text-indigo-400',
          border: 'hover:border-indigo-500/20',
          bar: 'bg-indigo-500',
          glow: 'hover:shadow-indigo-500/5'
        };
    }
  };

  const colors = getColorClasses(color);

  return (
    <div className={`glass-card rounded-xl p-5 border border-slate-800 transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-lg ${colors.border} ${colors.glow}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
          <IconComp className="h-4.5 w-4.5" />
        </div>
      </div>
      
      <div className="mt-3">
        <span className="text-2xl font-bold tracking-tight text-slate-100">{value}</span>
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800/40">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            ></div>
          </div>
        </div>
      )}

      {subText && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">{subText}</span>
        </div>
      )}
    </div>
  );
}
