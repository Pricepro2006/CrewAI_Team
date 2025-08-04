import { useState, useCallback } from "react";
import type { TRPCClientErrorLike } from "@trpc/client";
import { useCSRF, handleCSRFError } from "./useCSRF.js";
import { logger } from "../utils/logger.js";

/**
 * Enhanced mutation hook with automatic CSRF protection and retry logic
 *
 * @example
 * ```tsx
 * const createUserMutation = useCSRFProtectedMutation(
 *   api.user.create,
 *   {
 *     onSuccess: (data) => {
 *       console.log('User created:', data);
 *     },
 *     onError: (error) => {
 *       console.error('Failed to create user:', error);
 *     },
 *   }
 * );
 *
 * // Use it like a normal mutation
 * createUserMutation.mutate({ name: 'John', email: 'john@example.com' });
 * ```
 */
export function useCSRFProtectedMutation<
  TInput = unknown,
  TOutput = unknown,
  TError = unknown,
  TContext = unknown,
>(
  mutation: any, // Use any temporarily to avoid complex type issues
  options?: {
    maxRetries?: number;
    retryDelay?: number;
    onCSRFError?: (error: Error) => void;
    onSuccess?: (data: TOutput) => void;
    onError?: (error: TRPCClientErrorLike<any>) => void;
  },
) {
  const { refreshToken } = useCSRF();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const mutateWithProtection = useCallback(
    async (input: TInput, mutationOptions?: any) => {
      setIsRetrying(true);
      setRetryCount(0);

      try {
        await handleCSRFError(
          async () => {
            await mutation.mutateAsync(input, mutationOptions);
          },
          {
            onTokenRefresh: async () => {
              setRetryCount((prev) => prev + 1);
              await refreshToken();
            },
            maxRetries: options?.maxRetries ?? 2,
            retryDelay: options?.retryDelay ?? 1000,
          },
        );
      } catch (error) {
        const csrfError =
          error instanceof Error ? error : new Error("Unknown error");

        // Check if it's specifically a CSRF error
        if (
          csrfError.message.toLowerCase().includes("csrf") ||
          (error as any)?.code === "FORBIDDEN"
        ) {
          logger.error("CSRF error in protected mutation", "CSRF", {
            error: csrfError,
            retryCount,
          });

          if (options?.onCSRFError) {
            options.onCSRFError(csrfError);
          }
        }

        // Re-throw for normal error handling
        throw error;
      } finally {
        setIsRetrying(false);
      }
    },
    [mutation, refreshToken, options],
  );

  return {
    ...mutation,
    mutate: mutateWithProtection,
    mutateAsync: mutateWithProtection,
    isRetrying,
    retryCount,
  };
}

/**
 * Hook for batch operations with CSRF protection
 *
 * @example
 * ```tsx
 * const batchDelete = useCSRFBatchOperation(
 *   async (ids: string[]) => {
 *     return Promise.all(
 *       ids.map(id => api.item.delete.mutateAsync({ id }))
 *     );
 *   },
 *   {
 *     onSuccess: (results) => {
 *       console.log('Deleted items:', results);
 *     },
 *   }
 * );
 *
 * batchDelete.execute(['id1', 'id2', 'id3']);
 * ```
 */
export function useCSRFBatchOperation<TInput, TOutput>(
  operation: (input: TInput) => Promise<TOutput>,
  options?: {
    onSuccess?: (result: TOutput) => void;
    onError?: (error: Error) => void;
    onCSRFError?: (error: Error) => void;
    maxRetries?: number;
  },
) {
  const { refreshToken } = useCSRF();
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (input: TInput) => {
      setIsExecuting(true);
      setProgress(0);
      setError(null);

      try {
        const result = await handleCSRFError(() => operation(input), {
          onTokenRefresh: refreshToken,
          maxRetries: options?.maxRetries ?? 1,
        });

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Batch operation failed");
        setError(error);

        if (
          error.message.toLowerCase().includes("csrf") ||
          (err as any)?.code === "FORBIDDEN"
        ) {
          if (options?.onCSRFError) {
            options.onCSRFError(error);
          }
        } else if (options?.onError) {
          options.onError(error);
        }

        throw error;
      } finally {
        setIsExecuting(false);
        setProgress(100);
      }
    },
    [operation, refreshToken, options],
  );

  return {
    execute,
    isExecuting,
    progress,
    error,
  };
}

/**
 * Hook for form submissions with CSRF protection
 *
 * @example
 * ```tsx
 * const submitForm = useCSRFFormSubmit({
 *   onSuccess: (data) => {
 *     console.log('Form submitted:', data);
 *   },
 * });
 *
 * const handleSubmit = (e: FormEvent) => {
 *   e.preventDefault();
 *   const formData = new FormData(e.target as HTMLFormElement);
 *   submitForm('/api/contact', formData);
 * };
 * ```
 */
export function useCSRFFormSubmit(options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  headers?: Record<string, string>;
}) {
  const { getHeaders } = useCSRF();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(
    async (url: string, data: FormData | Record<string, any>) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const isFormData = data instanceof FormData;

        const response = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            ...getHeaders(),
            ...(isFormData ? {} : { "Content-Type": "application/json" }),
            ...options?.headers,
          },
          body: isFormData ? data : JSON.stringify(data),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || response.statusText);
        }

        const result = await response.json();

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Form submission failed");
        setError(error);

        if (options?.onError) {
          options.onError(error);
        }

        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getHeaders, options],
  );

  return {
    submit,
    isSubmitting,
    error,
  };
}
