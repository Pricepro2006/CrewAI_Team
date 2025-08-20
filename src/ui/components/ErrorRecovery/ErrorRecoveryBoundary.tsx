import React, { ReactNode } from "react";
import { ErrorBoundary } from "../ErrorBoundary/index.js";
import {
  useErrorRecovery,
  useNetworkRecovery,
} from "../../hooks/useErrorRecovery.js";
// Simple inline implementations for Alert and Button
const Alert: React.FC<{ type: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ type, icon, className, children }) => (
  <div className={`p-4 rounded border ${type === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : type === 'info' ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-red-50 border-red-300 text-red-800'} ${className || ''}`}>
    <div className="flex items-center gap-2">
      {icon}
      <div>{children}</div>
    </div>
  </div>
);

const Button: React.FC<{ children: React.ReactNode; onClick?: () => void; variant?: string; size?: string; icon?: React.ReactNode; disabled?: boolean }> = ({ children, onClick, variant, disabled, icon }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 px-4 py-2 rounded ${
      variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 
      variant === 'secondary' ? 'bg-gray-600 text-white hover:bg-gray-700' : 
      'bg-blue-600 text-white hover:bg-blue-700'
    } disabled:opacity-50`}
  >
    {icon}
    {children}
  </button>
);
import { WifiOff, RefreshCw } from "lucide-react";

interface ErrorRecoveryBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
  maxRetries?: number;
  showNetworkStatus?: boolean;
}

export function ErrorRecoveryBoundary({
  children,
  fallback,
  onError,
  maxRetries = 3,
  showNetworkStatus = true,
}: ErrorRecoveryBoundaryProps) {
  const [boundaryError, setBoundaryError] = React.useState<Error | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  const { isOnline } = useNetworkRecovery();
  const errorRecovery = useErrorRecovery({
    maxRetries,
    onMaxRetriesExceeded: (error: any) => {
      console.error("Max retries exceeded:", error);
    },
  });

  const handleError = (error: Error) => {
    setBoundaryError(error);
    errorRecovery.handleError(error);
    if (onError) onError(error);
  };

  const handleRetry = () => {
    setBoundaryError(null);
    errorRecovery.reset();
    setRetryKey((prev: any) => prev + 1); // Force re-render of children
  };

  // Show network status banner if offline
  const networkBanner = showNetworkStatus && !isOnline && (
    <Alert
      type="warning"
      icon={<WifiOff size={16} />}
      className="network-status-banner"
    >
      You are currently offline. Some features may be unavailable.
    </Alert>
  );

  // If there's an error, show recovery UI
  if (boundaryError && !errorRecovery.isRetrying) {
    if (fallback) {
      return (
        <>
          {networkBanner}
          {fallback}
        </>
      );
    }

    return (
      <>
        {networkBanner}
        <div className="error-recovery-container">
          <div className="error-recovery-content">
            <h2>Something went wrong</h2>
            <p className="error-message">
              {boundaryError.message || "An unexpected error occurred"}
            </p>

            {!isOnline && (
              <Alert type="info" className="offline-notice">
                This error may be due to your offline status. Please check your
                internet connection.
              </Alert>
            )}

            <div className="error-recovery-actions">
              {errorRecovery.canRetry &&
                errorRecovery.retryCount < maxRetries && (
                  <div className="retry-info">
                    <p>
                      Retry attempt {errorRecovery.retryCount} of {maxRetries}
                    </p>
                  </div>
                )}

              <Button
                onClick={handleRetry}
                variant="primary"
                icon={<RefreshCw size={16} />}
                disabled={!errorRecovery.canRetry}
              >
                {errorRecovery.canRetry ? "Try Again" : "Refresh Page"}
              </Button>

              {!errorRecovery.canRetry && (
                <Button
                  onClick={() => window?.location?.reload()}
                  variant="secondary"
                >
                  Reload Application
                </Button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {networkBanner}
      <ErrorBoundary
        key={retryKey}
        onError={handleError}
        resetKeys={[retryKey]}
        resetOnKeysChange
      >
        {children}
      </ErrorBoundary>
    </>
  );
}

// Wrapper component for async operations with error recovery
interface AsyncBoundaryProps {
  children: ReactNode;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  retryText?: string;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
}

export function AsyncBoundary({
  children,
  loading,
  error,
  onRetry,
  retryText = "Try Again",
  loadingComponent,
  errorComponent,
}: AsyncBoundaryProps) {
  if (loading) {
    return (
      <>
        {loadingComponent || (
          <div className="async-loading">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        )}
      </>
    );
  }

  if (error) {
    return (
      <>
        {errorComponent || (
          <Alert type="error" className="async-error">
            <p>{error.message || "An error occurred"}</p>
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="secondary"
                size="small"
                icon={<RefreshCw size={14} />}
              >
                {retryText}
              </Button>
            )}
          </Alert>
        )}
      </>
    );
  }

  return <>{children}</>;
}
