export declare const chatRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
}>, {
    create: import("@trpc/server").BuildProcedure<"mutation", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            message: string;
            priority?: "medium" | "low" | "high" | undefined;
            conversationId?: string | undefined;
        };
        _input_out: {
            priority: "medium" | "low" | "high";
            message: string;
            conversationId?: string | undefined;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        conversationId: string;
        response: string;
        metadata: {
            requestId: string;
            timestamp: Date;
        };
    }>;
    message: import("@trpc/server").BuildProcedure<"mutation", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            message: string;
            conversationId: string;
        };
        _input_out: {
            message: string;
            conversationId: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        response: string;
        metadata: Record<string, any> | undefined;
    }>;
    history: import("@trpc/server").BuildProcedure<"query", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            conversationId: string;
        };
        _input_out: {
            conversationId: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, import("../services/ConversationService").Message[]>;
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            limit?: number | undefined;
            offset?: number | undefined;
        };
        _input_out: {
            limit: number;
            offset: number;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, import("../services/ConversationService").Conversation[]>;
    delete: import("@trpc/server").BuildProcedure<"mutation", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            conversationId: string;
        };
        _input_out: {
            conversationId: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        success: boolean;
    }>;
    onMessage: import("@trpc/server").BuildProcedure<"subscription", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            conversationId: string;
        };
        _input_out: {
            conversationId: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, import("@trpc/server/observable").Observable<unknown, unknown>>;
    generateTitle: import("@trpc/server").BuildProcedure<"mutation", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            conversationId: string;
        };
        _input_out: {
            conversationId: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        title: string;
    }>;
    search: import("@trpc/server").BuildProcedure<"query", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            query: string;
            limit?: number | undefined;
        };
        _input_out: {
            query: string;
            limit: number;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, import("../services/ConversationService").Conversation[]>;
    recent: import("@trpc/server").BuildProcedure<"query", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            limit?: number | undefined;
            days?: number | undefined;
        };
        _input_out: {
            limit: number;
            days: number;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, import("../services/ConversationService").Conversation[]>;
    stats: import("@trpc/server").BuildProcedure<"query", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        totalConversations: number;
        totalMessages: number;
        averageMessagesPerConversation: number;
        recentActivity: {
            date: string;
            count: number;
        }[];
    }>;
    export: import("@trpc/server").BuildProcedure<"query", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            conversationId: string;
            format?: "json" | "markdown" | undefined;
        };
        _input_out: {
            format: "json" | "markdown";
            conversationId: string;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        data: string;
        format: "json" | "markdown";
        conversationId: string;
        timestamp: string;
    }>;
    exportAll: import("@trpc/server").BuildProcedure<"query", {
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
            dealDataService: import("../services/DealDataService").DealDataService;
            emailStorageService: import("../services/EmailStorageService").EmailStorageService;
            walmartGroceryService: import("../services/WalmartGroceryService").WalmartGroceryService;
            agentRegistry: any;
            ragSystem: any;
            mcpTools: any;
        };
        _input_in: {
            format?: "json" | "csv" | undefined;
        };
        _input_out: {
            format: "json" | "csv";
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, {
        data: string;
        format: "json" | "csv";
        timestamp: string;
    }>;
}>;
//# sourceMappingURL=chat.router.d.ts.map