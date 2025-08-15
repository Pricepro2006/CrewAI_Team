import React, { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { ErrorFallback } from "./ErrorFallback.js";
import { errorLogger } from "../../utils/errorLogger.js";
import { translateError, getErrorSeverity } from "../../utils/errorTranslator.js";

export interface SectionErrorBoundaryProps {
  children: ReactNode;
  sectionName: string;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean; // If true, errors won't propagate to parent
  showDetails?: boolean;
  customMessage?: string;
}

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  sectionName: string;
  showDetails?: boolean;
  customMessage?: string;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: Date | null;
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null,
    };
    
    this.previousResetKeys = props.resetKeys || [];
  }

  static override getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: new Date(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { sectionName, onError, isolate } = this.props;
    const { errorCount } = this.state;

    // Log the error
    errorLogger.logError(error, `Section: ${sectionName}`, "Component Error");

    // Update error count
    this.setState((prevState: any) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // If not isolating, let it propagate after logging
    if (!isolate && errorCount > 2) {
      throw error;
    }

    // Auto-reset after multiple errors (circuit breaker pattern)
    if (errorCount > 0 && errorCount < 3) {
      this.scheduleReset(5000 * errorCount); // Exponential backoff
    }
  }

  override componentDidUpdate(prevProps: SectionErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.children !== this?.props?.children && resetOnPropsChange) {
      this.resetError();
    }

    if (resetKeys && hasError) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== this.previousResetKeys[index]
      );

      if (hasResetKeyChanged) {
        this.resetError();
        this.previousResetKeys = resetKeys;
      }
    }
  }

  override componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.resetError();
    }, delay);
  };

  resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      // Don't reset errorCount to track repeated errors
    });
  };

  override render() {
    const { hasError, error, errorCount } = this.state;
    const { children, sectionName, fallback: FallbackComponent, showDetails, customMessage } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            resetError={this.resetError}
            sectionName={sectionName}
            showDetails={showDetails}
            customMessage={customMessage}
          />
        );
      }

      // Default fallback UI
      return (
        <div className="section-error-boundary">
          <div className="error-container p-6 m-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              {sectionName} Error
            </h3>
            <p className="text-red-600 dark:text-red-300 mb-4">
              {customMessage || translateError(error)}
            </p>
            
            {errorCount > 1 && (
              <p className="text-sm text-red-500 dark:text-red-400 mb-2">
                This error has occurred {errorCount} times.
              </p>
            )}

            {showDetails && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400 hover:underline">
                  Technical Details
                </summary>
                <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs overflow-auto max-h-40">
                  {error.stack || error.message}
                </pre>
              </details>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={this.resetError}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window?.location?.reload()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// HOC for easy section error boundary wrapping
export function withSectionErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  sectionName: string,
  options?: Omit<SectionErrorBoundaryProps, "children" | "sectionName">
) {
  return React.forwardRef<any, P>((props, ref) => (
    <SectionErrorBoundary sectionName={sectionName} {...options}>
      <Component {...props} ref={ref} />
    </SectionErrorBoundary>
  ));
}

// Specific error boundaries for different sections
export const DashboardErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <SectionErrorBoundary
    sectionName="Dashboard"
    customMessage="The dashboard encountered an error. Your data is safe."
    showDetails={process.env.NODE_ENV === "development"}
    isolate
  >
    {children}
  </SectionErrorBoundary>
);

export const WalmartErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <SectionErrorBoundary
    sectionName="Walmart Grocery Agent"
    customMessage="The Walmart service is temporarily unavailable."
    showDetails={process.env.NODE_ENV === "development"}
    isolate
  >
    {children}
  </SectionErrorBoundary>
);

export const ChatErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <SectionErrorBoundary
    sectionName="Chat Interface"
    customMessage="The chat service encountered an error. Your conversation history is preserved."
    showDetails={process.env.NODE_ENV === "development"}
    isolate
  >
    {children}
  </SectionErrorBoundary>
);

export const EmailErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <SectionErrorBoundary
    sectionName="Email Dashboard"
    customMessage="Unable to load email data. Please check your connection."
    showDetails={process.env.NODE_ENV === "development"}
    isolate
  >
    {children}
  </SectionErrorBoundary>
);