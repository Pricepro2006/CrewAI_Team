import { createTRPCReact } from "@trpc/react-query";
import type { CreateTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../api/trpc/router.js";

// Create the typed tRPC React client
export const api = createTRPCReact<AppRouter>();

// Export for backwards compatibility
export const trpc = api;

// Export the type for use in other files
export type TRPCReactClient = CreateTRPCReact<AppRouter, unknown, null>;
