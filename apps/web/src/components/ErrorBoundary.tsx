import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TestLens Widget Error caught:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card border border-rose-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]">
          <div className="h-10 w-10 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-200">
              {this.props.title || 'Widget Failed to Load'}
            </h4>
            <p className="text-xs text-slate-400 max-w-xs mt-1 truncate">
              {this.state.error?.message || 'An unexpected rendering error occurred'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="px-4 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-xs font-semibold rounded-lg transition-colors duration-150"
          >
            Retry Loading
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
