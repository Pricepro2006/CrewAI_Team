import React, { Component, ErrorInfo, ReactNode } from 'react';
import { sentryErrorTracker } from '../../monitoring/SentryErrorTracker.js';
import { AlertTriangle, RefreshCcw, Home, Bug } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { Alert, AlertDescription } from '../components/ui/alert.js';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean; // Whether to isolate this boundary
  component?: string; // Component name for tracking
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  errorBoundaryId: string;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      errorBoundaryId: `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { component = 'unknown', onError } = this.props;
    
    // Track error with Sentry
    const errorId = sentryErrorTracker.captureError(
      error,
      {
        component: `react_boundary_${component}`,
        operation: 'component_render',
        sessionId: this.state.errorBoundaryId,
      },
      'error',
      {
        boundary_component: component,
        component_stack: errorInfo.componentStack,
        error_boundary_id: this.state.errorBoundaryId,
        retry_count: this.state.retryCount.toString(),
      }
    );

    // Add breadcrumb for debugging
    sentryErrorTracker.addBreadcrumb(
      `Error boundary caught error in ${component}`,
      'ui',
      'error',
      {
        errorId,
        componentStack: errorInfo.componentStack,
        errorBoundaryId: this.state.errorBoundaryId,
      }
    );

    this.setState({ errorId });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 React Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component:', component);
      console.error('Error ID:', errorId);
      console.groupEnd();
    }
  }

  handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      sentryErrorTracker.addBreadcrumb(
        `Max retries exceeded for error boundary ${this.props.component}`,
        'ui',
        'warning',
        {
          errorId: this.state.errorId,
          retryCount: this.state.retryCount,
          maxRetries: this.maxRetries,
        }
      );
      return;
    }

    const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
    
    sentryErrorTracker.addBreadcrumb(
      `Retrying error boundary ${this.props.component} in ${retryDelay}ms`,
      'ui',
      'info',
      {
        errorId: this.state.errorId,
        retryCount: this.state.retryCount + 1,
        retryDelay,
      }
    );

    const timeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorId: null,
        retryCount: this.state.retryCount + 1,
      });
      
      this.retryTimeouts.delete(timeout);
    }, retryDelay);

    this.retryTimeouts.add(timeout);
  };

  handleReload = () => {
    sentryErrorTracker.addBreadcrumb(
      `User triggered page reload from error boundary ${this.props.component}`,
      'ui',
      'info',
      {
        errorId: this.state.errorId,
        component: this.props.component,
      }
    );
    
    window.location.reload();
  };

  handleGoHome = () => {
    sentryErrorTracker.addBreadcrumb(
      `User navigated home from error boundary ${this.props.component}`,
      'ui',
      'info',
      {
        errorId: this.state.errorId,
        component: this.props.component,
      }
    );
    
    window.location.href = '/';
  };

  handleReportBug = () => {
    const subject = encodeURIComponent(`Bug Report: Error in ${this.props.component || 'Component'}`);
    const body = encodeURIComponent(`
Error ID: ${this.state.errorId}
Component: ${this.props.component || 'Unknown'}
Error Message: ${this.state.error?.message || 'Unknown error'}
Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}

Please describe what you were doing when this error occurred:

    `.trim());

    window.open(`mailto:support@yourcompany.com?subject=${subject}&body=${body}`);
    
    sentryErrorTracker.addBreadcrumb(
      `User initiated bug report from error boundary`,
      'ui',
      'info',
      {
        errorId: this.state.errorId,
        component: this.props.component,
      }
    );
  };

  componentWillUnmount() {
    // Clean up retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  render() {
    if (this.state.hasError) {
      const { fallback, component = 'Component', isolate = false } = this.props;
      const canRetry = this.state.retryCount < this.maxRetries;

      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Render different UI based on isolation level
      if (isolate) {
        return (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-center gap-2 text-red-700 mb-2">
              <AlertTriangle size={16} />
              <span className="font-medium">Something went wrong</span>
            </div>
            <p className="text-sm text-red-600 mb-3">
              {component} encountered an error. Please try refreshing this section.
            </p>
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={this.handleRetry}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                <RefreshCcw size={14} className="mr-1" />
                Retry
              </Button>
            )}
          </div>
        );
      }

      // Full page error boundary
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-600 mb-6">
                We're sorry for the inconvenience. An unexpected error occurred in the {component.toLowerCase()}.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Alert className="mb-6 text-left">
                  <Bug className="h-4 w-4" />
                  <AlertDescription className="font-mono text-xs">
                    <strong>Error:</strong> {this.state.error.message}
                    {this.state.errorId && (
                      <>
                        <br />
                        <strong>ID:</strong> {this.state.errorId}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {canRetry && (
                  <Button
                    onClick={this.handleRetry}
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                )}

                <Button
                  onClick={this.handleReload}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  className="w-full"
                  variant="outline"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>

                <Button
                  onClick={this.handleReportBug}
                  className="w-full"
                  variant="ghost"
                >
                  <Bug className="mr-2 h-4 w-4" />
                  Report Bug
                </Button>
              </div>

              {this.state.errorId && (
                <p className="text-xs text-gray-500 mt-4">
                  Error ID: {this.state.errorId}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryOptions?: {
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    isolate?: boolean;
    component?: string;
  }
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryOptions}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Specialized error boundaries for specific components
export const WalmartErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    component="Walmart Grocery Agent"
    isolate={true}
    onError={(error, errorInfo) => {
      sentryErrorTracker.recordCustomMetric('walmart_component_error', 1, {
        component: 'walmart_grocery',
        error_type: error.name,
      });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const PricingErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    component="Price Tracker"
    isolate={true}
    onError={(error, errorInfo) => {
      sentryErrorTracker.recordCustomMetric('pricing_component_error', 1, {
        component: 'price_tracker',
        error_type: error.name,
      });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const DashboardErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    component="Dashboard"
    isolate={false}
    onError={(error, errorInfo) => {
      sentryErrorTracker.recordCustomMetric('dashboard_component_error', 1, {
        component: 'dashboard',
        error_type: error.name,
      });
    }}
  >
    {children}
  </ErrorBoundary>
);