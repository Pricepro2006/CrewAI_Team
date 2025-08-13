import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../api/trpc/router.js";
import type { CreateTRPCReact } from "@trpc/react-query";

export const trpc: CreateTRPCReact<AppRouter, unknown, null> = createTRPCReact<AppRouter>();
