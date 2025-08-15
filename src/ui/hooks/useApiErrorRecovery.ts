import { useCallback, useRef, useState } from "react";
import { useRetryMechanism, useCircuitBreaker } from "./useRetryMechanism.js";
import { useErrorReporter } from "../contexts/ErrorContext.js";
import { toast } from "../components/Toast/useToast.js";
import { translateError, isRecoverableError } from "../utils/errorTranslator.js";

export interface ApiErrorRecoveryOptions {
  enableCircuitBreaker?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  onError?: (error: Error) => void;
  onRecovery?: () => void;
  fallbackData?: any;
  cacheKey?: string;
  cacheDuration?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

// Simple in-memory cache for fallback data
const fallbackCache = new Map<string, CacheEntry>();

export function useApiErrorRecovery<T = any>(options: ApiErrorRecoveryOptions = {}) {
  const {
    enableCircuitBreaker = true,
    enableRetry = true,
    maxRetries = 3,
    onError,
    onRecovery,
    fallbackData,
    cacheKey,
    cacheDuration = 5 * 60 * 1000, // 5 minutes
  } = options;

  const reportError = useErrorReporter();
  const circuitBreaker = useCircuitBreaker();
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryAttempts = useRef(0);

  // Get cached data if available
  const getCachedData = useCallback((): T | null => {
    if (!cacheKey) return null;

    const cached = fallbackCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < cacheDuration) {
        return cached.data;
      }
      fallbackCache.delete(cacheKey);
    }
    return null;
  }, [cacheKey, cacheDuration]);

  // Cache successful data
  const setCachedData = useCallback((data: T) => {
    if (cacheKey) {
      fallbackCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    }
  }, [cacheKey]);

  // Handle API call with recovery
  const callWithRecovery = useCallback(
    async <R = T>(
      apiCall: () => Promise<R>,
      options: {
        useCache?: boolean;
        showToast?: boolean;
        context?: string;
      } = {}
    ): Promise<R> => {
      const { useCache = true, showToast = true, context } = options;

      // Check circuit breaker
      if (enableCircuitBreaker && !circuitBreaker.canAttempt()) {
        const cached = useCache ? getCachedData() : null;
        if (cached) {
          toast.info("Using cached data while service recovers");
          return cached as R;
        }
        throw new Error("Service temporarily unavailable due to repeated failures");
      }

      try {
        setIsRecovering(false);
        const result = await apiCall();
        
        // Record success
        if (enableCircuitBreaker) {
          circuitBreaker.recordSuccess();
        }
        
        // Cache the result
        setCachedData(result as any);
        
        // Call recovery callback if we were recovering
        if (recoveryAttempts.current > 0) {
          recoveryAttempts.current = 0;
          onRecovery?.();
          if (showToast) {
            toast.success("Service recovered successfully");
          }
        }
        
        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        // Record failure in circuit breaker
        if (enableCircuitBreaker) {
          circuitBreaker.recordFailure();
        }
        
        // Report error
        reportError(errorObj, {
          context,
          recoverable: isRecoverableError(errorObj),
          severity: "medium",
          showToast: false, // We'll handle toast ourselves
        });
        
        // Call error callback
        onError?.(errorObj);
        
        // Try recovery strategies
        if (enableRetry && isRecoverableError(errorObj) && recoveryAttempts.current < maxRetries) {
          setIsRecovering(true);
          recoveryAttempts.current++;
          
          if (showToast) {
            toast.warning(`Connection issue. Attempting recovery... (${recoveryAttempts.current}/${maxRetries})`);
          }
          
          // Wait with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, recoveryAttempts.current), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the call
          return callWithRecovery(apiCall, options);
        }
        
        // Try to use cached data as fallback
        if (useCache) {
          const cached = getCachedData();
          if (cached) {
            if (showToast) {
              toast.warning("Using cached data due to connection issues");
            }
            return cached as R;
          }
        }
        
        // Use provided fallback data
        if (fallbackData !== undefined) {
          if (showToast) {
            toast.warning("Using fallback data due to connection issues");
          }
          return fallbackData as R;
        }
        
        // Show user-friendly error
        if (showToast) {
          toast.error(translateError(errorObj));
        }
        
        throw errorObj;
      }
    },
    [
      enableCircuitBreaker,
      enableRetry,
      maxRetries,
      circuitBreaker,
      getCachedData,
      setCachedData,
      reportError,
      onError,
      onRecovery,
      fallbackData,
    ]
  );

  // Manual retry function
  const retry = useCallback(async () => {
    recoveryAttempts.current = 0;
    circuitBreaker.reset();
  }, [circuitBreaker]);

  // Clear cache
  const clearCache = useCallback(() => {
    if (cacheKey) {
      fallbackCache.delete(cacheKey);
    }
  }, [cacheKey]);

  return {
    callWithRecovery,
    retry,
    clearCache,
    isRecovering,
    circuitBreakerState: {
      isOpen: circuitBreaker.isOpen,
      failures: circuitBreaker.failures,
    },
  };
}

// Hook for TRPC error recovery
export function useTRPCErrorRecovery() {
  const reportError = useErrorReporter();

  const handleTRPCError = useCallback((error: any) => {
    // Extract meaningful error from TRPC error structure
    const message = error?.message || error?.data?.message || "Unknown error";
    const code = error?.data?.code || error?.code;
    const httpStatus = error?.data?.httpStatus;

    // Create a more meaningful error
    const enhancedError = new Error(message);
    (enhancedError as any).code = code;
    (enhancedError as any).httpStatus = httpStatus;

    // Determine severity and recoverability
    const isAuthError = code === "UNAUTHORIZED" || httpStatus === 401;
    const isNotFound = code === "NOT_FOUND" || httpStatus === 404;
    const isServerError = httpStatus >= 500;

    reportError(enhancedError, {
      context: "TRPC API Call",
      recoverable: !isAuthError && !isNotFound,
      severity: isServerError ? "high" : isAuthError ? "critical" : "medium",
      showToast: true,
    });

    // Return action based on error type
    if (isAuthError) {
      // Redirect to login after a delay
      setTimeout(() => {
        window?.location?.href = "/login";
      }, 2000);
    }

    return enhancedError;
  }, [reportError]);

  return { handleTRPCError };
}