import { useCallback, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { api } from "../../lib/trpc.js";
import { useApiErrorRecovery } from "./useApiErrorRecovery.js";
import { useErrorReporter } from "../contexts/ErrorContext.js";
import { toast } from "../components/Toast/useToast.js";

export function useTRPCWithErrorHandling() {
  const { callWithRecovery } = useApiErrorRecovery({
    enableCircuitBreaker: true,
    enableRetry: true,
    maxRetries: 3,
  });
  const reportError = useErrorReporter();

  // Wrap tRPC query with error handling
  const safeQuery = useCallback(
    <T,>(
      queryFn: () => Promise<T>,
      options: {
        fallbackData?: T;
        showToast?: boolean;
        context?: string;
        cacheKey?: string;
      } = {}
    ) => {
      return callWithRecovery(queryFn, {
        useCache: true,
        showToast: options.showToast ?? true,
        context: options.context,
      });
    },
    [callWithRecovery]
  );

  // Wrap tRPC mutation with error handling
  const safeMutation = useCallback(
    async <T,>(
      mutationFn: () => Promise<T>,
      options: {
        successMessage?: string;
        errorMessage?: string;
        context?: string;
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
      } = {}
    ): Promise<T | null> => {
      try {
        const result = await mutationFn();
        
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        
        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        reportError(errorObj, {
          context: options.context || "TRPC Mutation",
          recoverable: true,
          severity: "medium",
        });
        
        if (options.errorMessage) {
          toast.error(options.errorMessage);
        }
        
        options.onError?.(errorObj);
        return null;
      }
    },
    [reportError]
  );

  return {
    safeQuery,
    safeMutation,
  };
}

// Hook for specific tRPC procedures with built-in error handling
export function useSafeTRPCQuery<T>(
  queryKey: string,
  queryFn: () => UseQueryResult<T, Error>,
  options?: {
    fallbackData?: T;
    enabled?: boolean;
    refetchInterval?: number;
    staleTime?: number;
  }
): UseQueryResult<T, Error> & { data: T | undefined } {
  const reportError = useErrorReporter();
  
  const query = queryFn();
  
  // Report errors to error context
  if (query.error) {
    reportError(new Error(query?.error?.message || 'Unknown query error'), {
      context: `TRPC Query: ${queryKey}`,
      recoverable: true,
      severity: "medium",
      showToast: true,
    });
  }
  
  return {
    ...query,
    data: query.data ?? options?.fallbackData,
  };
}

// Hook for mutations with optimistic updates
export function useOptimisticMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  options: {
    onMutate?: (input: TInput) => void | Promise<void>;
    onSuccess?: (data: TOutput, input: TInput) => void | Promise<void>;
    onError?: (error: Error, input: TInput) => void | Promise<void>;
    onSettled?: () => void | Promise<void>;
    optimisticUpdate?: (input: TInput) => void;
    rollback?: () => void;
  } = {}
) {
  const reportError = useErrorReporter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (input: TInput) => {
      setIsLoading(true);
      setError(null);

      // Optimistic update
      if (options.optimisticUpdate) {
        options.optimisticUpdate(input);
      }

      try {
        await options.onMutate?.(input);
        const result = await mutationFn(input);
        await options.onSuccess?.(result, input);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        
        // Rollback optimistic update
        if (options.rollback) {
          options.rollback();
        }
        
        reportError(error, {
          context: "Optimistic Mutation",
          recoverable: true,
          severity: "medium",
        });
        
        await options.onError?.(error, input);
        throw error;
      } finally {
        setIsLoading(false);
        await options.onSettled?.();
      }
    },
    [mutationFn, options, reportError]
  );

  return {
    mutate,
    isLoading,
    error,
  };
}