import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { toast } from "../components/Toast/useToast";
import { errorLogger } from "../utils/errorLogger";
import { translateError } from "../utils/errorTranslator";

export interface ErrorInfo {
  id: string;
  error: Error;
  timestamp: Date;
  context?: string;
  componentStack?: string;
  userAction?: string;
  retryCount?: number;
  recoverable?: boolean;
  severity?: "low" | "medium" | "high" | "critical";
}

export interface ErrorContextValue {
  errors: ErrorInfo[];
  addError: (error: Error | ErrorInfo, options?: ErrorOptions) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  retryError: (id: string) => Promise<void>;
  getErrorById: (id: string) => ErrorInfo | undefined;
  hasErrors: boolean;
  criticalError: ErrorInfo | null;
}

export interface ErrorOptions {
  context?: string;
  userAction?: string;
  recoverable?: boolean;
  severity?: ErrorInfo["severity"];
  showToast?: boolean;
  logToConsole?: boolean;
  sendToServer?: boolean;
  retryAction?: () => Promise<void>;
}

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

export const useErrorContext = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error("useErrorContext must be used within ErrorProvider");
  }
  return context;
};

interface ErrorProviderProps {
  children: ReactNode;
  maxErrors?: number;
  autoCleanup?: boolean;
  cleanupInterval?: number;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({
  children,
  maxErrors = 50,
  autoCleanup = true,
  cleanupInterval = 300000, // 5 minutes
}) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const retryActionsRef = useRef<Map<string, () => Promise<void>>>(new Map());

  // Auto cleanup old errors
  React.useEffect(() => {
    if (!autoCleanup) return;

    const interval = setInterval(() => {
      const now = new Date();
      setErrors((prev) =>
        prev.filter(
          (error) =>
            now.getTime() - error.timestamp.getTime() < cleanupInterval
        )
      );
    }, cleanupInterval);

    return () => clearInterval(interval);
  }, [autoCleanup, cleanupInterval]);

  const addError = useCallback(
    (errorOrInfo: Error | ErrorInfo, options: ErrorOptions = {}) => {
      const errorInfo: ErrorInfo =
        errorOrInfo instanceof Error
          ? {
              id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              error: errorOrInfo,
              timestamp: new Date(),
              context: options.context,
              userAction: options.userAction,
              retryCount: 0,
              recoverable: options.recoverable ?? false,
              severity: options.severity ?? "medium",
            }
          : errorOrInfo;

      // Store retry action if provided
      if (options.retryAction) {
        retryActionsRef.current.set(errorInfo.id, options.retryAction);
      }

      // Add to state (limit max errors)
      setErrors((prev) => {
        const newErrors = [errorInfo, ...prev].slice(0, maxErrors);
        return newErrors;
      });

      // Log to various destinations
      if (options.logToConsole !== false) {
        console.error(`[${errorInfo.severity?.toUpperCase()}]`, errorInfo.error, {
          context: errorInfo.context,
          userAction: errorInfo.userAction,
        });
      }

      if (options.sendToServer !== false) {
        errorLogger.logToServer(errorInfo);
      }

      // Show user-friendly notification
      if (options.showToast !== false) {
        const message = translateError(errorInfo.error);
        const toastType =
          errorInfo.severity === "critical"
            ? "error"
            : errorInfo.severity === "high"
            ? "warning"
            : "info";

        toast[toastType](message, {
          duration: errorInfo.severity === "critical" ? 0 : 5000, // Critical errors don't auto-dismiss
          action: errorInfo.recoverable
            ? {
                label: "Retry",
                onClick: () => retryError(errorInfo.id),
              }
            : undefined,
        });
      }
    },
    [maxErrors]
  );

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((error) => error.id !== id));
    retryActionsRef.current.delete(id);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
    retryActionsRef.current.clear();
  }, []);

  const retryError = useCallback(
    async (id: string) => {
      const errorInfo = errors.find((e) => e.id === id);
      if (!errorInfo) return;

      const retryAction = retryActionsRef.current.get(id);
      if (!retryAction) {
        console.warn(`No retry action found for error ${id}`);
        return;
      }

      try {
        // Update retry count
        setErrors((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, retryCount: (e.retryCount || 0) + 1 } : e
          )
        );

        await retryAction();
        
        // If successful, remove the error
        removeError(id);
        toast.success("Action completed successfully");
      } catch (retryError) {
        // Update error with new failure
        const newError = retryError instanceof Error ? retryError : new Error(String(retryError));
        
        setErrors((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  error: newError,
                  timestamp: new Date(),
                  retryCount: (e.retryCount || 0) + 1,
                }
              : e
          )
        );

        toast.error(`Retry failed: ${translateError(newError)}`);
      }
    },
    [errors, removeError]
  );

  const getErrorById = useCallback(
    (id: string) => errors.find((e) => e.id === id),
    [errors]
  );

  const criticalError = errors.find((e) => e.severity === "critical") || null;

  const value: ErrorContextValue = {
    errors,
    addError,
    removeError,
    clearErrors,
    retryError,
    getErrorById,
    hasErrors: errors.length > 0,
    criticalError,
  };

  return (
    <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>
  );
};

// Hook for easy error reporting
export const useErrorReporter = () => {
  const { addError } = useErrorContext();

  return useCallback(
    (error: Error | unknown, options?: ErrorOptions) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      addError(errorObj, options);
    },
    [addError]
  );
};