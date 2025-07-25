import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../api/trpc/router";

export const api = createTRPCReact<AppRouter>();

// Export for backwards compatibility
export const trpc = api;
