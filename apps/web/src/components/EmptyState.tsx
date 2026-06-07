import React from 'react';
import { LucideIcon, HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon: IconComp = HelpCircle,
  action
}: EmptyStateProps) {
  return (
    <div className="glass-card rounded-xl p-12 border border-slate-800 flex flex-col items-center justify-center text-center space-y-5 max-w-xl mx-auto shadow-glass my-8">
      <div className="h-14 w-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 shadow-md">
        <IconComp className="h-6 w-6" />
      </div>
      
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-slate-200">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
          {description}
        </p>
      </div>

      {action && (
        <div className="pt-2">
          {action}
        </div>
      )}
    </div>
  );
}
