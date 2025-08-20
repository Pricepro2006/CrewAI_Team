import React from "react";
import { useErrorReporter, useErrorContext } from "../../contexts/ErrorContext.js";
import { useToast } from "../Toast/useToast.js";
import { useRetryMechanism, useCircuitBreaker } from "../../hooks/useRetryMechanism.js";
import { useApiErrorRecovery } from "../../hooks/useApiErrorRecovery.js";
import { useTRPCWithErrorHandling } from "../../hooks/useTRPCWithErrorHandling.js";

/**
 * Example component demonstrating all error handling features
 */
export const ErrorHandlingExample: React.FC = () => {
  const reportError = useErrorReporter();
  const { errors, hasErrors, retryError } = useErrorContext();
  const { success, error, warning, info } = useToast();
  const circuitBreaker = useCircuitBreaker(3, 30000);
  const { safeQuery, safeMutation } = useTRPCWithErrorHandling();

  // Example 1: Basic error reporting
  const handleBasicError = () => {
    try {
      throw new Error("This is a test error");
    } catch (err) {
      reportError(err as Error, {
        context: "Example Component",
        userAction: "Clicked test button",
        recoverable: true,
        severity: "low",
      });
    }
  };

  // Example 2: Network error with retry
  const { retry: retryNetworkCall, state: retryState } = useRetryMechanism(
    async () => {
      const response = await fetch("/api/test");
      if (!response.ok) {
        throw new Error(`Network error: ${response.status}`);
      }
      return response.json();
    },
    {
      maxAttempts: 3,
      onSuccess: () => success("Data loaded successfully!"),
      onFailure: (err: any) => error(`Failed after retries: ${err.message}`),
    }
  );

  // Example 3: API call with recovery
  const { callWithRecovery } = useApiErrorRecovery({
    enableCircuitBreaker: true,
    fallbackData: { message: "Using cached data" },
    cacheKey: "example-api-data",
  });

  const handleApiCall = async () => {
    try {
      const result = await callWithRecovery(
        async () => {
          const response = await fetch("/api/data");
          if (!response.ok) throw new Error("API Error");
          return response.json();
        },
        { context: "Example API Call" }
      );
      console.log("API Result:", result);
    } catch (err) {
      // Error is already handled by callWithRecovery
    }
  };

  // Example 4: Circuit breaker pattern
  const handleCircuitBreakerTest = () => {
    if (!circuitBreaker.canAttempt()) {
      warning("Service is temporarily disabled due to repeated failures");
      return;
    }

    try {
      // Simulate API call
      if (Math.random() > 0.5) {
        throw new Error("Random failure");
      }
      circuitBreaker.recordSuccess();
      success("Operation succeeded!");
    } catch (err) {
      circuitBreaker.recordFailure();
      error("Operation failed");
    }
  };

  // Example 5: Toast notifications
  const showToastExamples = () => {
    success("This is a success message");
    error("This is an error message", {
      duration: 0, // Won't auto-dismiss
      action: {
        label: "Undo",
        onClick: () => console.log("Undo clicked"),
      },
    });
    warning("This is a warning message");
    info("This is an info message");
  };

  // Example 6: Safe tRPC mutation
  const handleSafeMutation = async () => {
    await safeMutation(
      async () => {
        // Simulate tRPC mutation
        const response = await fetch("/api/update", {
          method: "POST",
          body: JSON.stringify({ data: "test" }),
        });
        if (!response.ok) throw new Error("Mutation failed");
        return response.json();
      },
      {
        successMessage: "Data updated successfully!",
        errorMessage: "Failed to update data",
        context: "Update Operation",
        onSuccess: (data: any) => console.log("Success:", data),
        onError: (err: any) => console.error("Error:", err),
      }
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Error Handling Examples</h2>

      {/* Error Status Display */}
      {hasErrors && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h3 className="font-semibold mb-2">Current Errors ({errors?.length || 0})</h3>
          <div className="space-y-2">
            {errors.slice(0, 3).map((error: any) => (
              <div key={error.id} className="flex justify-between items-center">
                <span className="text-sm">{error?.error?.message}</span>
                {error.recoverable && (
                  <button
                    onClick={() => retryError(error.id)}
                    className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retry State Display */}
      {retryState.isRetrying && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p>Retrying... Attempt {retryState.attempt}</p>
          {retryState.nextRetryIn && (
            <p className="text-sm">Next retry in {retryState.nextRetryIn} seconds</p>
          )}
        </div>
      )}

      {/* Circuit Breaker Status */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="font-semibold mb-2">Circuit Breaker Status</h3>
        <p className="text-sm">
          Status: {circuitBreaker.isOpen ? "OPEN (Service Disabled)" : "CLOSED (Service Active)"}
        </p>
        <p className="text-sm">Failures: {circuitBreaker.failures}</p>
      </div>

      {/* Test Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={handleBasicError}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Trigger Basic Error
        </button>

        <button
          onClick={() => retryNetworkCall()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={retryState.isRetrying}
        >
          Test Network Retry
        </button>

        <button
          onClick={handleApiCall}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test API Recovery
        </button>

        <button
          onClick={handleCircuitBreakerTest}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test Circuit Breaker
        </button>

        <button
          onClick={showToastExamples}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Show Toast Examples
        </button>

        <button
          onClick={handleSafeMutation}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Test Safe Mutation
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold mb-2">How to Use Error Handling in Your Components:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Wrap sections with SectionErrorBoundary for isolated error handling</li>
          <li>Use useErrorReporter() to report errors with context</li>
          <li>Use useToast() for user notifications</li>
          <li>Use useRetryMechanism() for retryable operations</li>
          <li>Use useApiErrorRecovery() for API calls with fallback</li>
          <li>Use useCircuitBreaker() to prevent cascading failures</li>
          <li>Use useTRPCWithErrorHandling() for safe tRPC operations</li>
        </ol>
      </div>
    </div>
  );
};