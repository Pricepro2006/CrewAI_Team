/**
 * API Client for UI components
 * Centralized API access for all tRPC endpoints
 */

import { trpc } from "../utils/trpc.js";

/**
 * Main API object that provides access to all tRPC routers
 * This ensures type safety and consistency across the UI layer
 */
export const api = trpc;

// Re-export individual routers for convenience
export const {
  walmartPrice,
  walmartGrocery,
  auth,
  health,
  chat,
  agent,
  task,
  rag,
} = api;

// Helper types
export type RouterInputs = Parameters<typeof api>[0];
export type RouterOutputs = ReturnType<typeof api>;

// Query client context helper
export const useApiContext = () => api.useContext();