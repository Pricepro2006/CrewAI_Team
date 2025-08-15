import React from "react";
import { translateError, getErrorCategory } from "../../utils/errorTranslator.js";

interface BaseErrorFallbackProps {
  error: Error;
  resetError: () => void;
  title?: string;
  showDetails?: boolean;
}

// Network Error Fallback
export const NetworkErrorFallback: React.FC<BaseErrorFallbackProps> = ({
  error,
  resetError,
  title = "Connection Problem",
  showDetails,
}) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
    <div className="text-center max-w-md">
      <svg
        className="w-20 h-20 mx-auto mb-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
        />
      </svg>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {translateError(error)}
      </p>
      <div className="space-y-3">
        <button
          onClick={resetError}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window?.location?.reload()}
          className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
        >
          Refresh Page
        </button>
      </div>
      {showDetails && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            Error Details
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-32">
            {error.message}
          </pre>
        </details>
      )}
    </div>
  </div>
);

// Data Loading Error Fallback
export const DataErrorFallback: React.FC<BaseErrorFallbackProps> = ({
  error,
  resetError,
  title = "Unable to Load Data",
  showDetails,
}) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
    <div className="text-center max-w-md">
      <svg
        className="w-20 h-20 mx-auto mb-4 text-yellow-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {translateError(error)}
      </p>
      <button
        onClick={resetError}
        className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
      >
        Retry Loading
      </button>
      {showDetails && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {error.message}
          </p>
        </div>
      )}
    </div>
  </div>
);

// Permission Error Fallback
export const PermissionErrorFallback: React.FC<BaseErrorFallbackProps> = ({
  error,
  resetError,
  title = "Access Denied",
}) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
    <div className="text-center max-w-md">
      <svg
        className="w-20 h-20 mx-auto mb-4 text-red-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        You don't have permission to access this resource.
      </p>
      <div className="space-y-3">
        <button
          onClick={() => window?.location?.href = "/"}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Go to Home
        </button>
        <button
          onClick={resetError}
          className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  </div>
);

// Empty State Fallback (not an error, but no data)
export const EmptyStateFallback: React.FC<{
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}> = ({
  title = "No Data Available",
  message = "There's nothing to display at the moment.",
  action,
}) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
    <div className="text-center max-w-md">
      <svg
        className="w-20 h-20 mx-auto mb-4 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  </div>
);

// Loading State Fallback
export const LoadingFallback: React.FC<{
  message?: string;
}> = ({ message = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
      <p className="text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  </div>
);

// Smart Error Fallback - chooses the right fallback based on error type
export const SmartErrorFallback: React.FC<BaseErrorFallbackProps> = ({
  error,
  resetError,
  showDetails,
}) => {
  const category = getErrorCategory(error);

  switch (category) {
    case "network":
      return (
        <NetworkErrorFallback
          error={error}
          resetError={resetError}
          showDetails={showDetails}
        />
      );
    case "auth":
      return (
        <PermissionErrorFallback
          error={error}
          resetError={resetError}
          showDetails={showDetails}
        />
      );
    case "server":
    case "validation":
      return (
        <DataErrorFallback
          error={error}
          resetError={resetError}
          showDetails={showDetails}
        />
      );
    default:
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {translateError(error)}
            </p>
            <button
              onClick={resetError}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
  }
};