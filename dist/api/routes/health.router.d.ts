export declare const healthRouter: import("@trpc/server").Router<import("@trpc/server/dist/core/router").RouterDef<import("@trpc/server").RootConfig<{
    ctx: {
        req: import("express").Request;
        res: import("express").Response;
        user: import("../trpc/context").User;
        requestId: string;
        timestamp: Date;
        batchId: string | undefined;
        validatedInput: unknown;
        masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
        conversationService: import("../services/ConversationService").ConversationService;
        taskService: import("../services/TaskService").TaskService;
        maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
        userService: import("../services/UserService").UserService;
        dealDataService: import("../services/DealDataService").DealDataService;
        emailStorageService: import("../services/EmailStorageService").EmailStorageService;
        walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
        agentRegistry: any;
        ragSystem: any;
        mcpTools: any;
    };
    meta: object;
    errorShape: {
        data: {
            stack: string | undefined;
            requestId: any;
            code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
        };
        message: string;
        code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
    };
    transformer: typeof import("superjson").default;
}>, {}, {
    queries: {};
    mutations: {};
    subscriptions: {};
}>>;
//# sourceMappingURL=health.router.d.ts.map