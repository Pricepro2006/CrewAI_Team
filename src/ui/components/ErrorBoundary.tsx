import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details to console in development
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-background p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-destructive mb-4">
                Something went wrong
              </h2>
              
              <div className="space-y-4">
                <div className="bg-background/50 rounded p-4">
                  <h3 className="font-semibold mb-2">Error Message:</h3>
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {this.state.error?.toString()}
                  </pre>
                </div>

                {this.state.errorInfo && (
                  <div className="bg-background/50 rounded p-4">
                    <h3 className="font-semibold mb-2">Component Stack:</h3>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-64">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}

                <div className="bg-background/50 rounded p-4">
                  <h3 className="font-semibold mb-2">Stack Trace:</h3>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-64">
                    {this.state.error?.stack}
                  </pre>
                </div>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}