import { createTRPCReact } from '@trpc/react-query';
import { createTRPCMsw } from 'msw-trpc';
import type { AppRouter } from '../../api/trpc/router.js';

/**
 * TRPC React utilities for type-safe API communication
 */

export const trpc = createTRPCReact<AppRouter>();

// MSW (Mock Service Worker) utilities for testing
export const trpcMsw = createTRPCMsw<AppRouter>();

// Helper function to get authorization headers
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('accessToken');
  return token
    ? { authorization: `Bearer ${token}` }
    : {};
};

// TRPC client configuration with authentication
export const createTRPCClientConfig = (apiUrl: string) => {
  return {
    links: [
      // Add authentication headers to all requests
      trpc.httpLink({
        url: apiUrl,
        headers: () => getAuthHeaders(),
      }),
    ],
  };
};