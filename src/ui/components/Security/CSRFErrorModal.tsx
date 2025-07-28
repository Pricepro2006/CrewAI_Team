import React from 'react';
import { X, Shield, RefreshCw, AlertTriangle } from 'lucide-react';

interface CSRFErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  error?: Error | null;
  retryCount?: number;
}

export const CSRFErrorModal: React.FC<CSRFErrorModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  error,
  retryCount = 0,
}) => {
  if (!isOpen) return null;

  const isMaxRetries = retryCount >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Security Validation Required
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p className="mb-2">
                We need to refresh your security credentials to continue. This is a standard 
                security measure to protect your data.
              </p>
              {error && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Technical details: {error.message}
                </p>
              )}
            </div>
          </div>

          {retryCount > 0 && (
            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-md">
              <p className="text-xs text-orange-800 dark:text-orange-200">
                Retry attempt {retryCount} of 3
              </p>
            </div>
          )}

          {isMaxRetries && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">
                We're having trouble connecting. Please refresh the page or try again later.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                     hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          {isMaxRetries ? (
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 
                       hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
          ) : (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 
                       hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to manage CSRF error modal state
 */
export function useCSRFErrorModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [retryCallback, setRetryCallback] = React.useState<(() => void) | null>(null);

  const showError = React.useCallback((error: Error, onRetry?: () => void) => {
    setError(error);
    setRetryCallback(() => onRetry || null);
    setIsOpen(true);
  }, []);

  const handleRetry = React.useCallback(() => {
    setRetryCount(prev => prev + 1);
    if (retryCallback) {
      retryCallback();
    }
    setIsOpen(false);
  }, [retryCallback]);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setError(null);
    setRetryCount(0);
    setRetryCallback(null);
  }, []);

  return {
    isOpen,
    error,
    retryCount,
    showError,
    handleRetry,
    handleClose,
  };
}