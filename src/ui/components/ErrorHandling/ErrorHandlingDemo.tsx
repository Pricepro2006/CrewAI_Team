import React, { useState } from "react";
import { useToast } from "../Toast/index.js";
import { ErrorModal } from "../ErrorModal/index.js";
import { ErrorBoundary, withErrorBoundary } from "../ErrorBoundary/index.js";
import { ErrorRecoveryBoundary } from "../ErrorRecovery/index.js";
import { LoadingState, Skeleton, LoadingCard } from "../LoadingState/index.js";
import { Button } from "../../../components/ui/button.js";
import { Card } from "../../../components/ui/card.js";
import { Alert, AlertDescription } from "../../../components/ui/alert.js";
import {
  useErrorRecovery,
  useCircuitBreaker,
} from "../../hooks/useErrorRecovery.js";
import "./ErrorHandlingDemo.css";

// Component that throws errors for testing
function ErrorProneComponent({ shouldError }: { shouldError: boolean }) {
  if (shouldError) {
    throw new Error("This is a test error from ErrorProneComponent");
  }
  return <div>Component rendered successfully!</div>;
}

// Wrapped with error boundary HOC
const SafeErrorProneComponent = withErrorBoundary(ErrorProneComponent, {
  onError: (error) => console.log("HOC Error caught:", error),
});

export function ErrorHandlingDemo() {
  const toast = useToast();
  const [showError, setShowError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalError, setModalError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const errorRecovery = useErrorRecovery({
    maxRetries: 3,
    onRetry: (attempt, error) => {
      toast.warning(`Retry attempt ${attempt}`, {
        message: error.message,
      });
    },
  });

  const circuitBreaker = useCircuitBreaker(3, 10000);

  // Simulate various error scenarios
  const simulateNetworkError = async () => {
    try {
      await circuitBreaker.execute(async () => {
        throw new Error("Network request failed");
      });
    } catch (error) {
      toast.error("Network Error", {
        message: "Failed to connect to server",
        action: {
          label: "Retry",
          onClick: simulateNetworkError,
        },
      });
    }
  };

  const simulateCriticalError = () => {
    const error = new Error(
      "Critical system failure - Database connection lost",
    );
    setModalError(error);
    setShowModal(true);
  };

  const simulateSuccessAction = () => {
    toast.success("Action completed successfully!", {
      message: "Your changes have been saved",
    });
  };

  const simulateWarning = () => {
    toast.warning("Warning", {
      message: "Your session will expire in 5 minutes",
      duration: 0, // Don't auto-dismiss
    });
  };

  const simulateInfo = () => {
    toast.info("New update available", {
      message: "Click to refresh and get the latest features",
      action: {
        label: "Refresh",
        onClick: () => window.location.reload(),
      },
    });
  };

  const simulateAsyncOperation = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (Math.random() > 0.5) {
            resolve("Success");
          } else {
            reject(new Error("Async operation failed"));
          }
        }, 2000);
      });
      toast.success("Async operation completed!");
    } catch (error) {
      errorRecovery.handleError(error as Error, simulateAsyncOperation);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="error-handling-demo">
      <h1>Error Handling Demo</h1>
      <p>
        This page demonstrates various error handling UI components and
        patterns.
      </p>

      {/* Toast Notifications */}
      <Card className="demo-section">
        <h2>Toast Notifications</h2>
        <div className="demo-buttons">
          <Button onClick={simulateSuccessAction} variant="default">
            Success Toast
          </Button>
          <Button onClick={simulateNetworkError} variant="destructive">
            Error Toast
          </Button>
          <Button onClick={simulateWarning} variant="outline">
            Warning Toast
          </Button>
          <Button onClick={simulateInfo} variant="secondary">
            Info Toast
          </Button>
        </div>
      </Card>

      {/* Error Boundaries */}
      <Card className="demo-section">
        <h2>Error Boundaries</h2>
        <div className="demo-content">
          <ErrorBoundary
            isolate
            onError={(error) => console.log("Isolated error:", error)}
          >
            <div className="error-boundary-demo">
              <p>This component is wrapped in an error boundary</p>
              <Button
                onClick={() => setShowError(!showError)}
                variant={showError ? "destructive" : "default"}
              >
                {showError ? "Fix Component" : "Break Component"}
              </Button>
              <div className="component-container">
                <ErrorProneComponent shouldError={showError} />
              </div>
            </div>
          </ErrorBoundary>
        </div>
      </Card>

      {/* Error Recovery */}
      <Card className="demo-section">
        <h2>Error Recovery with Retry</h2>
        <ErrorRecoveryBoundary maxRetries={3}>
          <div className="demo-content">
            <p>Current retry count: {errorRecovery.retryCount}</p>
            <Button
              onClick={simulateAsyncOperation}
              disabled={isLoading || errorRecovery.isRetrying}
            >
              {isLoading
                ? "Processing..."
                : "Simulate Async Operation (50% fail rate)"}
            </Button>
            {errorRecovery.error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  {errorRecovery.error.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ErrorRecoveryBoundary>
      </Card>

      {/* Error Modal */}
      <Card className="demo-section">
        <h2>Error Modal</h2>
        <div className="demo-buttons">
          <Button
            onClick={() => {
              setModalError(new Error("This is a warning message"));
              setShowModal(true);
            }}
            variant="outline"
          >
            Show Warning Modal
          </Button>
          <Button onClick={simulateCriticalError} variant="destructive">
            Show Critical Error Modal
          </Button>
        </div>
      </Card>

      {/* Loading States */}
      <Card className="demo-section">
        <h2>Loading States</h2>
        <div className="demo-content">
          <div className="loading-demo-grid">
            <div>
              <h3>Inline Loading</h3>
              <LoadingState size="small" text="Loading..." />
            </div>
            <div>
              <h3>Card Loading</h3>
              <LoadingCard lines={3} showAvatar />
            </div>
            <div>
              <h3>Skeleton Loading</h3>
              <Button
                onClick={() => setShowSkeleton(!showSkeleton)}
                variant="outline"
                className="mb-4"
              >
                Toggle Skeleton
              </Button>
              {showSkeleton ? (
                <div className="skeleton-demo">
                  <Skeleton width="100%" height={20} />
                  <Skeleton width="80%" height={20} />
                  <Skeleton width="60%" height={20} />
                </div>
              ) : (
                <div className="content-demo">
                  <p>This is the actual content</p>
                  <p>It appears when loaded</p>
                  <p>No more skeleton!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Circuit Breaker Status */}
      <Card className="demo-section">
        <h2>Circuit Breaker Status</h2>
        <div className="circuit-breaker-status">
          <p>
            State: <strong>{circuitBreaker.state}</strong>
          </p>
          <p>
            Failures: <strong>{circuitBreaker.failures}/3</strong>
          </p>
          <Button
            onClick={() => circuitBreaker.reset()}
            variant="outline"
            disabled={circuitBreaker.state === "closed"}
          >
            Reset Circuit Breaker
          </Button>
        </div>
      </Card>

      {/* Error Modal Component */}
      <ErrorModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        error={modalError || "Unknown error"}
        severity={
          modalError?.message.includes("Critical") ? "critical" : "warning"
        }
        onRetry={() => {
          setShowModal(false);
          toast.info("Retrying operation...");
        }}
        actions={[
          {
            label: "Contact Support",
            onClick: () => {
              window.location.href = "mailto:support@example.com";
            },
            variant: "outline",
          },
        ]}
      />
    </div>
  );
}
