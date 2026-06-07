import React, { Component, ErrorInfo, ReactNode } from 'react';
import WidgetErrorState from './WidgetErrorState';

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
        <WidgetErrorState
          title={this.props.title || 'Widget Failed to Load'}
          errorMessage={this.state.error?.message || 'An unexpected rendering error occurred.'}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
