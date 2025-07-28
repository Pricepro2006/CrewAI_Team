import React from 'react';
import { AlertCircle, RefreshCw, Home, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../../components/ui/button.js';
import { Card } from '../../../components/ui/card.js';
import { Alert, AlertDescription } from '../../../components/ui/alert.js';
import { cn } from '../../../utils/cn.js';
import './ErrorFallback.css';

interface ErrorFallbackProps {
  error: Error;
  errorInfo?: React.ErrorInfo | null;
  onReset: () => void;
  isIsolated?: boolean;
  errorCount?: number;
  canRetry?: boolean;
}

export function ErrorFallback({
  error,
  errorInfo,
  onReset,
  isIsolated = false,
  errorCount = 0,
  canRetry = true,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    // Add a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    onReset();
    setIsResetting(false);
  };

  const errorMessages = {
    network: {
      title: 'Connection Problem',
      description: 'Unable to connect to our servers. Please check your internet connection.',
      icon: '🌐',
    },
    permission: {
      title: 'Access Denied',
      description: 'You don\'t have permission to access this resource.',
      icon: '🔒',
    },
    notFound: {
      title: 'Page Not Found',
      description: 'The page you\'re looking for doesn\'t exist.',
      icon: '🔍',
    },
    default: {
      title: 'Something went wrong',
      description: 'An unexpected error occurred. Our team has been notified.',
      icon: '⚠️',
    },
  };

  const getErrorType = (error: Error) => {
    if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch')) {
      return 'network';
    }
    if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('unauthorized')) {
      return 'permission';
    }
    if (error.message.toLowerCase().includes('not found') || error.message.toLowerCase().includes('404')) {
      return 'notFound';
    }
    return 'default';
  };

  const errorType = getErrorType(error);
  const errorConfig = errorMessages[errorType];

  return (
    <div
      className={cn(
        'error-fallback-container',
        isIsolated ? 'error-fallback-isolated' : 'error-fallback-fullscreen'
      )}
    >
      <Card className="error-fallback-card">
        <div className="error-fallback-content">
          {/* Animated Icon */}
          <div className="error-icon-wrapper">
            <div className="error-icon-bg" />
            <span className="error-icon" role="img" aria-label="Error">
              {errorConfig.icon}
            </span>
          </div>

          {/* Error Title and Description */}
          <div className="error-text-content">
            <h2 className="error-title">{errorConfig.title}</h2>
            <p className="error-description">{errorConfig.description}</p>
            
            {/* Error Message */}
            {error.message && error.message !== errorConfig.description && (
              <Alert className="error-alert" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            {/* Retry Warning */}
            {errorCount > 1 && (
              <div className="retry-warning">
                <p className="retry-warning-text">
                  This error has occurred {errorCount} times. 
                  {errorCount >= 3 && ' The issue might persist.'}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="error-actions">
            {canRetry && (
              <Button
                onClick={handleReset}
                disabled={isResetting}
                className="error-action-button primary"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </>
                )}
              </Button>
            )}

            {!isIsolated && (
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="error-action-button"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            )}

            <Button
              onClick={() => window.location.href = 'mailto:support@example.com'}
              variant="ghost"
              className="error-action-button"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Contact Support
            </Button>
          </div>

          {/* Technical Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="error-details-section">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="error-details-toggle"
                aria-expanded={showDetails}
                aria-controls="error-details"
              >
                <span>Technical Details</span>
                {showDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showDetails && (
                <div id="error-details" className="error-details-content">
                  <div className="error-stack">
                    <strong>Error Stack:</strong>
                    <pre>{error.stack}</pre>
                  </div>
                  {errorInfo && (
                    <div className="error-component-stack">
                      <strong>Component Stack:</strong>
                      <pre>{errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}