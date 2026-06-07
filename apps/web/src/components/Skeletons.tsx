import React from 'react';

export function CardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5 border border-slate-800 animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-3 w-24 bg-slate-800 rounded"></div>
        <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
      </div>
      <div className="h-6 w-32 bg-slate-850 rounded"></div>
      <div className="h-1.5 w-full bg-slate-850 rounded-full"></div>
      <div className="h-2 w-20 bg-slate-800 rounded"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="glass-card rounded-xl border border-slate-800 overflow-hidden animate-pulse">
      <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center px-6 space-x-4">
        <div className="h-3 w-16 bg-slate-800 rounded"></div>
        <div className="h-3 w-32 bg-slate-800 rounded"></div>
        <div className="h-3 w-20 bg-slate-800 rounded"></div>
        <div className="h-3 w-24 bg-slate-800 rounded"></div>
      </div>
      <div className="divide-y divide-slate-850">
        {Array(rows).fill(0).map((_, i) => (
          <div key={i} className="h-16 flex items-center px-6 space-x-4">
            <div className="h-4 w-12 bg-slate-850 rounded"></div>
            <div className="h-4 w-48 bg-slate-850 rounded"></div>
            <div className="h-4 w-16 bg-slate-850 rounded"></div>
            <div className="h-4 w-28 bg-slate-850 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="glass-card rounded-xl p-6 border border-slate-800 animate-pulse">
      <div className="h-4 w-36 bg-slate-800 rounded mb-6"></div>
      <div className="flex items-center space-x-6">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="flex-1 flex items-center space-x-3">
            <div className="h-6 w-6 rounded-full bg-slate-800 flex-shrink-0"></div>
            <div className="space-y-2 flex-1">
              <div className="h-3 w-full bg-slate-800 rounded"></div>
              <div className="h-2.5 w-2/3 bg-slate-850 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="glass-card rounded-xl p-6 border border-slate-800 animate-pulse h-[300px] flex flex-col justify-between">
      <div className="flex justify-between items-center mb-4">
        <div className="h-4 w-40 bg-slate-800 rounded"></div>
        <div className="h-4 w-20 bg-slate-800 rounded"></div>
      </div>
      <div className="flex-1 flex items-end justify-between px-4 space-x-6">
        {Array(8).fill(0).map((_, i) => (
          <div 
            key={i} 
            className="w-full bg-slate-850 rounded-t"
            style={{ height: `${20 + i * 10}%` }}
          ></div>
        ))}
      </div>
      <div className="h-4 w-full bg-slate-900 mt-4 rounded-b border border-slate-800/40"></div>
    </div>
  );
}
