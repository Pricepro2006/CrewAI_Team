export declare const agentRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        agentRegistry: any;
        ragSystem: any;
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
}>, {
    list: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
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
                agentRegistry: any;
                ragSystem: any;
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
        }>;
        _meta: object;
        _ctx_out: {
            timestamp: Date;
            user: import("../trpc/context").User;
            batchId: string | undefined;
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            requestId: string;
            validatedInput: unknown;
            masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
            conversationService: import("../services/ConversationService").ConversationService;
            taskService: import("../services/TaskService").TaskService;
            maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
            userService: import("../services/UserService").UserService;
            agentRegistry: any;
            ragSystem: any;
        };
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, any>;
    status: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
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
                agentRegistry: any;
                ragSystem: any;
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
        }>;
        _meta: object;
        _ctx_out: {
            timestamp: Date;
            user: import("../trpc/context").User;
            batchId: string | undefined;
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            requestId: string;
            validatedInput: unknown;
            masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
            conversationService: import("../services/ConversationService").ConversationService;
            taskService: import("../services/TaskService").TaskService;
            maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
            userService: import("../services/UserService").UserService;
            agentRegistry: any;
            ragSystem: any;
        };
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, any>;
    execute: import("@trpc/server").BuildProcedure<"mutation", {
        _config: import("@trpc/server").RootConfig<{
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
                agentRegistry: any;
                ragSystem: any;
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
        }>;
        _meta: object;
        _ctx_out: {
            timestamp: Date;
            user: import("../trpc/context").User;
            batchId: string | undefined;
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            requestId: string;
            validatedInput: unknown;
            masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
            conversationService: import("../services/ConversationService").ConversationService;
            taskService: import("../services/TaskService").TaskService;
            maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
            userService: import("../services/UserService").UserService;
            agentRegistry: any;
            ragSystem: any;
        };
        _input_in: {
            task: string;
            agentType: string;
            context?: {
                ragDocuments?: any[] | undefined;
                previousResults?: any[] | undefined;
                userPreferences?: Record<string, any> | undefined;
            } | undefined;
        };
        _input_out: {
            task: string;
            agentType: string;
            context?: {
                ragDocuments?: any[] | undefined;
                previousResults?: any[] | undefined;
                userPreferences?: Record<string, any> | undefined;
            } | undefined;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, any>;
    poolStatus: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
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
                agentRegistry: any;
                ragSystem: any;
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
        }>;
        _meta: object;
        _ctx_out: {
            timestamp: Date;
            user: import("../trpc/context").User;
            batchId: string | undefined;
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            requestId: string;
            validatedInput: unknown;
            masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
            conversationService: import("../services/ConversationService").ConversationService;
            taskService: import("../services/TaskService").TaskService;
            maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
            userService: import("../services/UserService").UserService;
            agentRegistry: any;
            ragSystem: any;
        };
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, any>;
    getConfig: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
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
                agentRegistry: any;
                ragSystem: any;
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
        }>;
        _meta: object;
        _ctx_out: {
            timestamp: Date;
            user: import("../trpc/context").User;
            batchId: string | undefined;
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            requestId: string;
            validatedInput: unknown;
            masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
            conversationService: import("../services/ConversationService").ConversationService;
            taskService: import("../services/TaskService").TaskService;
            maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
            userService: import("../services/UserService").UserService;
            agentRegistry: any;
            ragSystem: any;
        };
        _input_in: {
            agentType?: string | undefined;
        } | undefined;
        _input_out: {
            agentType?: string | undefined;
        } | undefined;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        pool: any;
        agent: any;
        agents?: undefined;
    } | {
        pool: any;
        agents: Record<string, any>;
        agent?: undefined;
    }>;
    updateConfig: import("@trpc/server").BuildProcedure<"mutation", {
        _config: import("@trpc/server").RootConfig<{
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
                agentRegistry: any;
                ragSystem: any;
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
        }>;
        _meta: object;
        _ctx_out: {
            timestamp: Date;
            user: import("../trpc/context").User;
            batchId: string | undefined;
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            requestId: string;
            validatedInput: unknown;
            masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
            conversationService: import("../services/ConversationService").ConversationService;
            taskService: import("../services/TaskService").TaskService;
            maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
            userService: import("../services/UserService").UserService;
            agentRegistry: any;
            ragSystem: any;
        };
        _input_in: {
            agent?: {
                type: string;
                timeout?: number | undefined;
                model?: string | undefined;
                maxRetries?: number | undefined;
            } | undefined;
            pool?: {
                maxAgents?: number | undefined;
                idleTimeout?: number | undefined;
                preloadAgents?: string[] | undefined;
            } | undefined;
        };
        _input_out: {
            agent?: {
                type: string;
                timeout?: number | undefined;
                model?: string | undefined;
                maxRetries?: number | undefined;
            } | undefined;
            pool?: {
                maxAgents?: number | undefined;
                idleTimeout?: number | undefined;
                preloadAgents?: string[] | undefined;
            } | undefined;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        success: boolean;
        updates: string[];
        message: string;
    }>;
}>;
//# sourceMappingURL=agent.router.d.ts.map