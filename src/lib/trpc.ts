import { createTRPCReact } from "@trpc/react-query";
import type { CreateTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../api/trpc/router.js";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

// Create the typed tRPC React client
export const api = createTRPCReact<AppRouter>();

// Export for backwards compatibility
export const trpc = api;

// Export type helpers
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;

// Export the type for use in other files
export type TRPCReactClient = typeof api;
