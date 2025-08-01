import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "../utils/logger";

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
  onMaxRetriesExceeded?: (error: Error) => void;
  resetKeys?: string[];
}

export interface ErrorRecoveryState {
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
}

/**
 * Hook for handling error recovery with automatic retry logic
 */
export function useErrorRecovery(options: ErrorRecoveryOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    onRetry,
    onMaxRetriesExceeded,
    resetKeys = [],
  } = options;

  const [state, setState] = useState<ErrorRecoveryState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    canRetry: true,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    setState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      canRetry: true,
    });

    // Reset specified query keys
    if (resetKeys.length > 0) {
      resetKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    }
  }, [queryClient, resetKeys]);

  const retry = useCallback(
    async (retryFn: () => Promise<void>) => {
      if (!state.canRetry || state.retryCount >= maxRetries) {
        return;
      }

      setState((prev) => ({ ...prev, isRetrying: true }));

      try {
        await retryFn();
        reset(); // Success - reset state
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const newRetryCount = state.retryCount + 1;

        if (onRetry) {
          onRetry(newRetryCount, err);
        }

        if (newRetryCount >= maxRetries) {
          setState((prev) => ({
            ...prev,
            error: err,
            isRetrying: false,
            retryCount: newRetryCount,
            canRetry: false,
          }));

          if (onMaxRetriesExceeded) {
            onMaxRetriesExceeded(err);
          }
        } else {
          // Calculate delay
          const delay = exponentialBackoff
            ? retryDelay * Math.pow(2, newRetryCount - 1)
            : retryDelay;

          setState((prev) => ({
            ...prev,
            error: err,
            isRetrying: false,
            retryCount: newRetryCount,
          }));

          // Schedule next retry
          retryTimeoutRef.current = setTimeout(() => {
            retry(retryFn);
          }, delay);
        }
      }
    },
    [
      state.canRetry,
      state.retryCount,
      maxRetries,
      reset,
      onRetry,
      onMaxRetriesExceeded,
      retryDelay,
      exponentialBackoff,
    ],
  );

  const handleError = useCallback(
    (error: Error, retryFn?: () => Promise<void>) => {
      logger.error(
        "Error caught by recovery hook",
        "ERROR_RECOVERY",
        undefined,
        error,
      );

      setState({
        error,
        isRetrying: false,
        retryCount: 0,
        canRetry: !!retryFn && maxRetries > 0,
      });

      if (retryFn && maxRetries > 0) {
        // Start retry sequence
        retryTimeoutRef.current = setTimeout(() => {
          retry(retryFn);
        }, retryDelay);
      }
    },
    [maxRetries, retryDelay, retry],
  );

  return {
    ...state,
    reset,
    retry,
    handleError,
  };
}

/**
 * Hook for automatic reconnection logic
 */
export function useAutoReconnect(
  connect: () => Promise<void>,
  options: {
    enabled?: boolean;
    maxAttempts?: number;
    delay?: number;
    onReconnect?: () => void;
    onFail?: () => void;
  } = {},
) {
  const {
    enabled = true,
    maxAttempts = Infinity,
    delay = 1000,
    onReconnect,
    onFail,
  } = options;

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const reconnect = useCallback(async () => {
    if (!enabled || attempts >= maxAttempts) {
      if (onFail) onFail();
      return;
    }

    setIsReconnecting(true);
    setAttempts((prev) => prev + 1);

    try {
      await connect();
      setIsReconnecting(false);
      setAttempts(0);
      if (onReconnect) onReconnect();
    } catch (error) {
      logger.warn(
        `Reconnection attempt ${attempts + 1} failed`,
        "RECONNECTION_RECOVERY",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      if (attempts + 1 < maxAttempts) {
        const nextDelay = delay * Math.min(Math.pow(2, attempts), 10);
        timeoutRef.current = setTimeout(reconnect, nextDelay);
      } else {
        setIsReconnecting(false);
        if (onFail) onFail();
      }
    }
  }, [enabled, attempts, maxAttempts, connect, delay, onReconnect, onFail]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isReconnecting,
    attempts,
    reconnect,
    reset: useCallback(() => {
      setAttempts(0);
      setIsReconnecting(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }, []),
  };
}

/**
 * Hook for handling offline/online states with recovery
 */
export function useNetworkRecovery(
  onOnline?: () => void,
  onOffline?: () => void,
) {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true,
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info("Network connection restored");

      // Refetch all queries when coming back online
      queryClient.refetchQueries();

      if (onOnline) onOnline();
    };

    const handleOffline = () => {
      setIsOnline(false);
      logger.warn("Network connection lost");

      if (onOffline) onOffline();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [queryClient, onOnline, onOffline]);

  return { isOnline };
}

/**
 * Hook for circuit breaker pattern in React
 */
export function useCircuitBreaker(
  threshold: number = 5,
  timeout: number = 60000,
) {
  const [state, setState] = useState<"closed" | "open" | "half-open">("closed");
  const [failures, setFailures] = useState(0);
  const [lastFailureTime, setLastFailureTime] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (state === "open" && lastFailureTime) {
      timeoutRef.current = setTimeout(() => {
        setState("half-open");
        setFailures(0);
      }, timeout);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state, lastFailureTime, timeout]);

  const execute = useCallback(
    async <T>(
      operation: () => Promise<T>,
      fallback?: () => T | Promise<T>,
    ): Promise<T> => {
      if (state === "open") {
        if (fallback) {
          return fallback();
        }
        throw new Error("Circuit breaker is open");
      }

      try {
        const result = await operation();

        if (state === "half-open") {
          setState("closed");
          setFailures(0);
        }

        return result;
      } catch (error) {
        const newFailures = failures + 1;
        setFailures(newFailures);
        setLastFailureTime(Date.now());

        if (newFailures >= threshold) {
          setState("open");
          logger.error(
            "Circuit breaker opened due to failures",
            "CIRCUIT_BREAKER",
            {
              threshold,
              failures: newFailures,
            },
          );

          if (fallback) {
            return fallback();
          }
        }

        throw error;
      }
    },
    [state, failures, threshold],
  );

  const reset = useCallback(() => {
    setState("closed");
    setFailures(0);
    setLastFailureTime(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    state,
    failures,
    execute,
    reset,
  };
}
