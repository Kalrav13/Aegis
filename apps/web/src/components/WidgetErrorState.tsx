import React from 'react';
import { AlertTriangle, RotateCw, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface WidgetErrorStateProps {
  title?: string;
  errorMessage?: string;
  onRetry: () => void;
}

export default function WidgetErrorState({
  title = 'Component failed to load',
  errorMessage = 'An unexpected rendering error occurred.',
  onRetry
}: WidgetErrorStateProps) {
  const queryClient = useQueryClient();

  const handleRefreshData = () => {
    // Invalidate all react-query caches to trigger fresh network requests
    queryClient.invalidateQueries();
    onRetry();
  };

  return (
    <div className="glass-card border border-rose-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[220px]">
      <div className="h-10 w-10 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      
      <div>
        <h4 className="font-semibold text-slate-200 text-sm">{title}</h4>
        <p className="text-xs text-slate-500 max-w-xs mt-1 truncate">
          {errorMessage}
        </p>
      </div>

      <div className="flex items-center space-x-3 pt-1">
        <button
          onClick={onRetry}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-350 border border-slate-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          <RotateCw className="h-3 w-3" />
          <span>Retry Loading</span>
        </button>
        
        <button
          onClick={handleRefreshData}
          className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh Data</span>
        </button>
      </div>
    </div>
  );
}
