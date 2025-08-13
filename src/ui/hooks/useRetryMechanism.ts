import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "../components/Toast/useToast";

export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number) => void;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface RetryState {
  isRetrying: boolean;
  attempt: number;
  lastError: Error | null;
  nextRetryIn: number | null;
}

const defaultConfig: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  onRetry: () => {},
  onSuccess: () => {},
  onFailure: () => {},
  shouldRetry: (error, attempt) => {
    // Don't retry on auth errors
    if (error.message.match(/401|403|unauthorized|forbidden/i)) {
      return false;
    }
    return attempt < 3;
  },
};

export function useRetryMechanism<T>(
  asyncFn: () => Promise<T>,
  config: RetryConfig = {}
) {
  const mergedConfig = { ...defaultConfig, ...config };
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    lastError: null,
    nextRetryIn: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const calculateDelay = useCallback(
    (attempt: number) => {
      const delay = Math.min(
        mergedConfig.initialDelay * Math.pow(mergedConfig.backoffFactor, attempt - 1),
        mergedConfig.maxDelay
      );
      return delay + Math.random() * 1000; // Add jitter
    },
    [mergedConfig]
  );

  const executeWithRetry = useCallback(
    async (attemptNumber = 1): Promise<T> => {
      setState((prev) => ({
        ...prev,
        isRetrying: true,
        attempt: attemptNumber,
        nextRetryIn: null,
      }));

      try {
        const result = await asyncFn();
        
        setState((prev) => ({
          ...prev,
          isRetrying: false,
          lastError: null,
          nextRetryIn: null,
        }));
        
        mergedConfig.onSuccess();
        
        if (attemptNumber > 1) {
          toast.success("Operation succeeded after retry");
        }
        
        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        setState((prev) => ({
          ...prev,
          lastError: errorObj,
        }));

        if (
          attemptNumber < mergedConfig.maxAttempts &&
          mergedConfig.shouldRetry(errorObj, attemptNumber)
        ) {
          const delay = calculateDelay(attemptNumber);
          
          // Start countdown
          let remainingTime = Math.floor(delay / 1000);
          setState((prev) => ({ ...prev, nextRetryIn: remainingTime }));
          
          countdownRef.current = setInterval(() => {
            remainingTime -= 1;
            if (remainingTime > 0) {
              setState((prev) => ({ ...prev, nextRetryIn: remainingTime }));
            } else {
              if (countdownRef.current) clearInterval(countdownRef.current);
            }
          }, 1000);

          mergedConfig.onRetry(attemptNumber);
          
          return new Promise<T>((resolve, reject) => {
            timeoutRef.current = setTimeout(async () => {
              if (countdownRef.current) clearInterval(countdownRef.current);
              try {
                const result = await executeWithRetry(attemptNumber + 1);
                resolve(result);
              } catch (retryError) {
                reject(retryError);
              }
            }, delay);
          });
        } else {
          setState((prev) => ({
            ...prev,
            isRetrying: false,
            nextRetryIn: null,
          }));
          
          mergedConfig.onFailure(errorObj);
          throw errorObj;
        }
      }
    },
    [asyncFn, mergedConfig, calculateDelay]
  );

  const retry = useCallback(() => {
    return executeWithRetry(1);
  }, [executeWithRetry]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isRetrying: false,
      nextRetryIn: null,
    }));
  }, []);

  return {
    retry,
    cancel,
    state,
  };
}

// Circuit breaker pattern for preventing cascading failures
export function useCircuitBreaker(
  threshold = 5,
  timeout = 60000
) {
  const [isOpen, setIsOpen] = useState(false);
  const [failures, setFailures] = useState(0);
  const [lastFailureTime, setLastFailureTime] = useState<Date | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const recordSuccess = useCallback(() => {
    setFailures(0);
    setIsOpen(false);
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const recordFailure = useCallback(() => {
    const newFailures = failures + 1;
    setFailures(newFailures);
    setLastFailureTime(new Date());

    if (newFailures >= threshold) {
      setIsOpen(true);
      
      // Auto-reset after timeout
      resetTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
        setFailures(0);
        toast.info("Service connection restored. Retrying...");
      }, timeout);
      
      toast.error(`Service temporarily disabled due to repeated failures. Will retry in ${timeout / 1000} seconds.`);
    }
  }, [failures, threshold, timeout]);

  const reset = useCallback(() => {
    setIsOpen(false);
    setFailures(0);
    setLastFailureTime(null);
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const canAttempt = useCallback(() => {
    return !isOpen;
  }, [isOpen]);

  return {
    isOpen,
    failures,
    lastFailureTime,
    recordSuccess,
    recordFailure,
    reset,
    canAttempt,
  };
}

// Exponential backoff with jitter
export function useExponentialBackoff(
  baseDelay = 1000,
  maxDelay = 30000,
  factor = 2
) {
  const [attempt, setAttempt] = useState(0);

  const getDelay = useCallback(() => {
    const exponentialDelay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
    const jitter = Math.random() * exponentialDelay * 0.1; // 10% jitter
    return exponentialDelay + jitter;
  }, [attempt, baseDelay, maxDelay, factor]);

  const increment = useCallback(() => {
    setAttempt((prev) => prev + 1);
  }, []);

  const reset = useCallback(() => {
    setAttempt(0);
  }, []);

  return {
    attempt,
    delay: getDelay(),
    increment,
    reset,
  };
}