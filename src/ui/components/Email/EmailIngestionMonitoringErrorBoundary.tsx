import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card.js';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../components/ui/alert.js';
import { Button } from '../../../components/ui/button.js';
import {
  AlertTriangle,
  RefreshCw,
  Bug,
  ExternalLink,
} from 'lucide-react';

// =====================================================
// Types and Interfaces
// =====================================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

// =====================================================
// Error Boundary Component
// =====================================================

export class EmailIngestionMonitoringErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `monitoring-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    console.error('EmailIngestionMonitoring Error Boundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error to monitoring service
    this.reportError(error, errorInfo);
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Send error report to backend monitoring service
      await fetch('/api/monitoring/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorId: this.state.errorId,
          component: 'EmailIngestionMonitoring',
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          retryCount: this.retryCount,
        }),
      });
    } catch (reportingError) {
      console.error('Failed to report error to monitoring service:', reportingError);
    }
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount += 1;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private copyErrorDetails = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2)).then(() => {
      // Could show a toast notification here
      console.log('Error details copied to clipboard');
    });
  };

  override render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <CardTitle className="text-xl text-red-600">
                  Monitoring Dashboard Error
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <Bug className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>
                  The email ingestion monitoring dashboard encountered an unexpected error. 
                  This has been automatically reported to our team.
                </AlertDescription>
              </Alert>

              {/* Error Details */}
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium">Error ID:</span>{' '}
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    {this.state.errorId}
                  </code>
                </div>
                
                {this.state.error && (
                  <div className="text-sm">
                    <span className="font-medium">Error Message:</span>
                    <div className="mt-1 p-3 bg-muted rounded border-l-4 border-red-500">
                      <code className="text-xs text-red-600">
                        {this.state.error.message}
                      </code>
                    </div>
                  </div>
                )}

                {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                  <details className="text-sm">
                    <summary className="font-medium cursor-pointer">
                      Stack Trace (Development)
                    </summary>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4">
                {this.retryCount < this.maxRetries && (
                  <Button onClick={this.handleRetry} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                  </Button>
                )}
                
                <Button variant="outline" onClick={this.handleReload} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </Button>
                
                <Button variant="outline" onClick={this.copyErrorDetails} className="gap-2">
                  <Bug className="w-4 h-4" />
                  Copy Error Details
                </Button>
                
                <Button variant="outline" asChild className="gap-2">
                  <a href="/support" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                    Contact Support
                  </a>
                </Button>
              </div>

              {/* Retry Information */}
              {this.retryCount >= this.maxRetries && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Maximum retries reached</AlertTitle>
                  <AlertDescription>
                    The dashboard has failed to load after {this.maxRetries} attempts. 
                    Please reload the page or contact support if the issue persists.
                  </AlertDescription>
                </Alert>
              )}

              {/* Help Text */}
              <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
                <p className="font-medium mb-1">What happened?</p>
                <p>
                  The monitoring dashboard encountered an unexpected error while rendering. 
                  This could be due to network issues, data formatting problems, or a temporary service interruption.
                </p>
                <p className="mt-2">
                  <span className="font-medium">Next steps:</span> Try refreshing the page, 
                  check your network connection, or contact support if the problem continues.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// =====================================================
// Functional Error Boundary Hook (Alternative)
// =====================================================

export const useEmailIngestionMonitoringErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    console.error('EmailIngestionMonitoring Error Handler:', error);
    setError(error);
    
    // Report error
    fetch('/api/monitoring/error-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        component: 'EmailIngestionMonitoring',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    }).catch(console.error);
  }, []);

  return {
    error,
    resetError,
    handleError,
    hasError: !!error,
  };
};

// =====================================================
// Higher-Order Component Wrapper
// =====================================================

export const withEmailIngestionMonitoringErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  const WrappedComponent = (props: P) => (
    <EmailIngestionMonitoringErrorBoundary fallback={fallback}>
      <Component {...props} />
    </EmailIngestionMonitoringErrorBoundary>
  );

  WrappedComponent.displayName = `withEmailIngestionMonitoringErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// =====================================================
// Default Export
// =====================================================

export default EmailIngestionMonitoringErrorBoundary;