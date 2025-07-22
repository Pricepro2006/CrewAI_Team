export { router, publicProcedure, protectedProcedure, adminProcedure, userProcedure, chatProcedure, agentProcedure, taskProcedure, ragProcedure, strictProcedure, enhancedProcedure, monitoredProcedure, middleware, commonSchemas, createFeatureRouter, createSecureRouter, } from "./enhanced-router";
import type { AnyRouter } from "@trpc/server";
export declare const appRouter: AnyRouter;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=router.d.ts.map