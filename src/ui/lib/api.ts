/**
 * API Client for UI components
 * Centralized API access for all tRPC endpoints
 */

import { trpc } from "../../lib/trpc.js";
import type { AppRouter } from "../../api/trpc/router.js";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { TRPCReactClient } from "../../lib/trpc.js";

/**
 * Main API object that provides access to all tRPC routers
 * This ensures type safety and consistency across the UI layer
 */
export const api = trpc;

// Re-export individual routers for convenience
// We use the api object directly to maintain proper typing
export const walmartGrocery = api.walmartGrocery;
export const walmartPrice = api.walmartPrice;
export const auth = api.auth;
export const health = api.health;
export const chat = api.chat;
export const agent = api.agent;
export const task = api.task;
export const rag = api.rag;
export const emails = api.emails;
export const deals = api.deals;
export const security = api.security;
export const monitoring = api.monitoring;

// Helper types for inputs and outputs
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// Query client context helper
export const useApiContext = () => api.useContext();