import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  name: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-icon">!</div>
          <p className="error-boundary-title">Something went wrong</p>
          <p className="error-boundary-detail">
            {this.props.name} encountered an error
          </p>
          <button
            className="error-boundary-retry"
            onClick={this.handleRetry}
            aria-label="Retry"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
