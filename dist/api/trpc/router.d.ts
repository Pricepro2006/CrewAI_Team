export { router, publicProcedure, protectedProcedure, adminProcedure, userProcedure, chatProcedure, agentProcedure, taskProcedure, ragProcedure, strictProcedure, enhancedProcedure, monitoredProcedure, middleware, commonSchemas, createFeatureRouter, createSecureRouter, } from "./enhanced-router";
export declare const appRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
    ctx: {
        req: import("express").Request;
        res: import("express").Response;
        user: import("./context").User;
        requestId: string;
        timestamp: Date;
        batchId: string | undefined;
        validatedInput: unknown;
        masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
        conversationService: import("../services/ConversationService").ConversationService;
        taskService: import("../services/TaskService").TaskService;
        maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
        userService: import("../services/UserService").UserService;
        agentRegistry: any;
        ragSystem: any;
    };
    meta: object;
    errorShape: {
        data: {
            stack: string | undefined;
            requestId: any;
            code: import("@trpc/server/dist/rpc").TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
        };
        message: string;
        code: import("@trpc/server/dist/rpc").TRPC_ERROR_CODE_NUMBER;
    };
    transformer: typeof import("superjson").default;
}>, {
    auth: import("@trpc/server").AnyRouter;
    agent: import("@trpc/server").AnyRouter;
    task: import("@trpc/server").AnyRouter;
    rag: import("@trpc/server").AnyRouter;
    chat: import("@trpc/server").AnyRouter;
    ws: import("@trpc/server").AnyRouter;
    health: import("@trpc/server").AnyRouter;
    dataCollection: import("@trpc/server").AnyRouter;
    emails: import("@trpc/server").AnyRouter;
    emailAssignment: import("@trpc/server").AnyRouter;
    metrics: import("@trpc/server").AnyRouter;
    iemsEmails: import("@trpc/server").AnyRouter;
}>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=router.d.ts.map