/**
 * API Client for UI components
 * Centralized API access for all tRPC endpoints
 */

import { trpc } from "../../lib/trpc.js";
import type { AppRouter } from "../../api/trpc/router.js";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

/**
 * Main API object that provides access to all tRPC routers
 * This ensures type safety and consistency across the UI layer
 */
export const api = trpc;

// Re-export individual routers for convenience (available routers)
export const {
  walmartGrocery,
  walmartPrice,
  auth,
  health,
  chat,
  agent,
  task,
  rag,
  emails,
  deals,
  security,
  monitoring,
} = api;

// Helper types for inputs and outputs
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// Query client context helper
export const useApiContext = () => api.useContext();