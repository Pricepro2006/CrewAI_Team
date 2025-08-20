import { useState, useEffect, useCallback } from "react";
import {
  httpBatchLink,
  httpLink,
  wsLink,
  splitLink,
  createWSClient,
} from "@trpc/client";
import superjson from "superjson";
import { api } from "../../lib/trpc.js";
import { useCSRF, handleCSRFError } from "./useCSRF.js";
import { logger } from "../../utils/logger.js";

interface TRPCClientConfig {
  apiUrl?: string;
  wsUrl?: string;
  enableBatching?: boolean;
  credentials?: RequestCredentials;
}

const DEFAULT_CONFIG: TRPCClientConfig = {
  apiUrl: "http://localhost:3001/trpc",
  wsUrl: "ws://localhost:3002/trpc-ws",
  enableBatching: true,
  credentials: "include",
};

/**
 * Enhanced tRPC hook with CSRF protection
 */
export function useTRPCWithCSRF(config: TRPCClientConfig = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { token, getHeaders, refreshToken } = useCSRF();
  const [trpcClient, setTrpcClient] = useState<ReturnType<
    typeof api.createClient
  > | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Create tRPC client with CSRF headers
  const createTRPCClient = useCallback(() => {
    if (!token) {
      logger.debug("Skipping tRPC client creation - no CSRF token", "TRPC");
      return null;
    }

    logger.debug("Creating tRPC client with CSRF protection", "TRPC", {
      hasToken: !!token,
      apiUrl: mergedConfig.apiUrl,
    });

    const client = api.createClient({
      transformer: superjson,
      links: [
        splitLink({
          condition(op) {
            return op.type === "subscription";
          },
          true: wsLink({
            client: createWSClient({
              url: mergedConfig.wsUrl!,
              retryDelayMs: () => Math.min(1000 * 2 ** 0, 30000),
              WebSocket: window.WebSocket,
              // @ts-expect-error - connectionParams might not be in the type definition
              connectionParams: () => {
                const authToken = localStorage.getItem("token");
                return {
                  headers: {
                    ...getHeaders(),
                    ...(authToken && { authorization: `Bearer ${authToken}` }),
                  },
                };
              },
            }),
          }),
          false: mergedConfig.enableBatching
            ? httpBatchLink({
                url: mergedConfig.apiUrl!,
                headers() {
                  const authToken = localStorage.getItem("token");
                  return {
                    ...getHeaders(), // CSRF headers
                    ...(authToken && { authorization: `Bearer ${authToken}` }),
                  };
                },
                fetch(url, options) {
                  return fetch(url, {
                    ...options,
                    credentials: mergedConfig.credentials,
                  });
                },
              })
            : httpLink({
                url: mergedConfig.apiUrl!,
                headers() {
                  const authToken = localStorage.getItem("token");
                  return {
                    ...getHeaders(), // CSRF headers
                    ...(authToken && { authorization: `Bearer ${authToken}` }),
                  };
                },
                fetch(url, options) {
                  return fetch(url, {
                    ...options,
                    credentials: mergedConfig.credentials,
                  });
                },
              }),
        }),
      ],
    });

    return client;
  }, [token, getHeaders, mergedConfig]);

  // Update client when token changes
  useEffect(() => {
    if (token) {
      const newClient = createTRPCClient();
      if (newClient) {
        setTrpcClient(newClient);
        setIsReady(true);
        logger.debug("tRPC client ready with CSRF protection", "TRPC");
      }
    }
  }, [token, createTRPCClient]);

  // Enhanced mutation wrapper with CSRF error handling
  const mutateWithCSRF = useCallback(
    async <TInput, TOutput>(
      mutationFn: (input: TInput) => Promise<TOutput>,
      input: TInput,
      options?: {
        onError?: (error: Error) => void;
        maxRetries?: number;
      },
    ): Promise<TOutput> => {
      return handleCSRFError(() => mutationFn(input), {
        onTokenRefresh: refreshToken,
        maxRetries: options?.maxRetries ?? 1,
      }).catch((error: unknown) => {
        if (options?.onError) {
          options.onError(error);
        }
        throw error;
      });
    },
    [refreshToken],
  );

  // Enhanced query wrapper with CSRF error handling
  const queryWithCSRF = useCallback(
    async <TOutput>(
      queryFn: () => Promise<TOutput>,
      options?: {
        onError?: (error: Error) => void;
        maxRetries?: number;
      },
    ): Promise<TOutput> => {
      return handleCSRFError(queryFn, {
        onTokenRefresh: refreshToken,
        maxRetries: options?.maxRetries ?? 1,
      }).catch((error: unknown) => {
        if (options?.onError) {
          options.onError(error);
        }
        throw error;
      });
    },
    [refreshToken],
  );

  return {
    client: trpcClient,
    isReady,
    mutateWithCSRF,
    queryWithCSRF,
  };
}

/**
 * Hook for monitoring CSRF token status
 */
export function useCSRFStatus() {
  const { token, error, isLoading } = useCSRF();
  const [tokenAge, setTokenAge] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (token) {
      const storedRefreshTime = localStorage.getItem("csrf-last-refresh");
      if (storedRefreshTime) {
        const refreshTime = new Date(parseInt(storedRefreshTime, 10));
        setLastRefresh(refreshTime);

        // Update token age every second
        const interval = setInterval(() => {
          const age = Date.now() - refreshTime.getTime();
          setTokenAge(age);
        }, 1000);

        return () => clearInterval(interval);
      }
    }
    // Return undefined for cases where conditions aren't met
    return undefined;
  }, [token]);

  const formatAge = (ms: number | null): string => {
    if (ms === null) return "Unknown";

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return {
    hasToken: !!token,
    tokenAge: formatAge(tokenAge),
    lastRefresh,
    error,
    isLoading,
    status: error
      ? "error"
      : isLoading
        ? "loading"
        : token
          ? "active"
          : "inactive",
  };
}

/**
 * Hook for CSRF-protected form submissions
 */
export function useCSRFForm() {
  const { getHeaders } = useCSRF();

  const submitForm = useCallback(
    async (
      url: string,
      data: FormData | Record<string, unknown>,
      options?: RequestInit,
    ) => {
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
        ...options,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || response.statusText);
      }

      return response.json();
    },
    [getHeaders],
  );

  return { submitForm };
}
