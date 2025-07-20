export declare const healthRouter: import("@trpc/server").Router<import("@trpc/server/dist/core/router").RouterDef<import("@trpc/server").RootConfig<{
    ctx: {
        masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
        conversationService: import("../services/ConversationService").ConversationService;
        taskService: import("../services/TaskService").TaskService;
        maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
        userService: import("../services/UserService").UserService;
        agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
        ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
        req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
        res: import("express").Response<any, Record<string, any>>;
        user: import("../trpc/context").User;
        requestId: string;
        timestamp: Date;
        batchId: string | undefined;
        validatedInput: unknown;
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