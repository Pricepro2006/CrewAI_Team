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
    auth: import("@trpc/server").Router<any>;
    agent: import("@trpc/server").Router<any>;
    task: import("@trpc/server").Router<any>;
    rag: import("@trpc/server").Router<any>;
    chat: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
                user: import("./context").User;
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
    ws: import("@trpc/server").Router<any>;
    health: import("@trpc/server").Router<import("@trpc/server/dist/core/router").RouterDef<import("@trpc/server").RootConfig<{
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
    dataCollection: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        searchEngine: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                engine?: "google" | "bing" | "yandex" | undefined;
                language?: string | undefined;
                cursor?: string | undefined;
                location?: string | undefined;
                maxResults?: number | undefined;
            };
            _input_out: {
                query: string;
                engine: "google" | "bing" | "yandex";
                maxResults: number;
                language?: string | undefined;
                cursor?: string | undefined;
                location?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: import("../../core/data-collection/types").CollectedData[];
            metadata: {
                totalRecords: number;
                engine: "google" | "bing" | "yandex";
                timestamp: string;
                requestId: string;
            };
        }>;
        webScraping: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                url: string;
                extractionPrompt?: string | undefined;
                followLinks?: boolean | undefined;
                maxDepth?: number | undefined;
                respectRobots?: boolean | undefined;
            };
            _input_out: {
                url: string;
                followLinks: boolean;
                maxDepth: number;
                respectRobots: boolean;
                extractionPrompt?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: import("../../core/data-collection/types").CollectedData[];
            metadata: {
                totalRecords: number;
                url: string;
                timestamp: string;
                requestId: string;
            };
        }>;
        ecommerce: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                platform: "walmart" | "amazon" | "ebay" | "etsy" | "bestbuy" | "homedepot" | "zara";
                productUrl?: string | undefined;
                searchKeyword?: string | undefined;
                maxProducts?: number | undefined;
            };
            _input_out: {
                platform: "walmart" | "amazon" | "ebay" | "etsy" | "bestbuy" | "homedepot" | "zara";
                productUrl?: string | undefined;
                searchKeyword?: string | undefined;
                maxProducts?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: import("../../core/data-collection/types").CollectedData[];
            metadata: {
                totalRecords: number;
                platform: "walmart" | "amazon" | "ebay" | "etsy" | "bestbuy" | "homedepot" | "zara";
                timestamp: string;
                requestId: string;
            };
        }>;
        socialMedia: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                platform: "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube";
                profileUrl: string;
                includeComments?: boolean | undefined;
                includeMedia?: boolean | undefined;
            };
            _input_out: {
                platform: "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube";
                profileUrl: string;
                includeComments: boolean;
                includeMedia: boolean;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: import("../../core/data-collection/types").CollectedData[];
            metadata: {
                totalRecords: number;
                platform: "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube";
                timestamp: string;
                requestId: string;
            };
        }>;
        stats: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            success: boolean;
            data: import("../../core/data-collection/types").DataPipelineStats;
            timestamp: string;
        }>;
        health: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            success: boolean;
            status: string;
            services: {
                brightData: {
                    status: string;
                    rateLimits: {
                        search: string;
                        scraping: string;
                        ecommerce: string;
                        socialMedia: string;
                    };
                };
                database: string;
                timestamp: string;
            };
            requestId: string;
            error?: undefined;
        } | {
            success: boolean;
            status: string;
            error: string;
            requestId: string;
            services?: undefined;
        }>;
        platforms: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            searchEngines: string[];
            ecommerce: string[];
            socialMedia: string[];
            webScraping: {
                supportedFormats: string[];
                maxDepth: number;
                respectRobots: boolean;
            };
        }>;
    }>;
    emails: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        getTableData: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                search?: string | undefined;
                filters?: {
                    priority?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                    workflowState?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                    status?: ("red" | "yellow" | "green")[] | undefined;
                    emailAlias?: string[] | undefined;
                    dateRange?: {
                        start: string;
                        end: string;
                    } | undefined;
                } | undefined;
                page?: number | undefined;
                pageSize?: number | undefined;
                sortBy?: "subject" | "priority" | "status" | "received_date" | "requested_by" | undefined;
                sortOrder?: "asc" | "desc" | undefined;
                refreshKey?: number | undefined;
            };
            _input_out: {
                page: number;
                pageSize: number;
                sortBy: "subject" | "priority" | "status" | "received_date" | "requested_by";
                sortOrder: "asc" | "desc";
                search?: string | undefined;
                filters?: {
                    priority?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                    workflowState?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                    status?: ("red" | "yellow" | "green")[] | undefined;
                    emailAlias?: string[] | undefined;
                    dateRange?: {
                        start: string;
                        end: string;
                    } | undefined;
                } | undefined;
                refreshKey?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                emails: Array<{
                    id: string;
                    email_alias: string;
                    requested_by: string;
                    subject: string;
                    summary: string;
                    status: string;
                    status_text: string;
                    workflow_state: string;
                    priority: string;
                    received_date: string;
                    is_read: boolean;
                    has_attachments: boolean;
                }>;
                totalCount: number;
                totalPages: number;
                fromCache?: boolean;
                performanceMetrics?: {
                    queryTime: number;
                    cacheHit: boolean;
                    optimizationGain: number;
                };
            };
        }>;
        getDashboardStats: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                refreshKey?: number | undefined;
            };
            _input_out: {
                refreshKey?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                totalEmails: number;
                criticalCount: number;
                inProgressCount: number;
                completedCount: number;
                statusDistribution: Record<string, number>;
            };
        }>;
        getAnalytics: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                refreshKey?: number | undefined;
            };
            _input_out: {
                refreshKey?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                totalEmails: number;
                workflowDistribution: Record<string, number>;
                slaCompliance: Record<string, number>;
                averageProcessingTime: number;
            };
        }>;
        getList: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                status?: string | undefined;
                search?: string | undefined;
                workflow?: string | undefined;
                slaStatus?: "on-track" | "at-risk" | "overdue" | undefined;
                offset?: number | undefined;
                dateRange?: {
                    start: Date;
                    end: Date;
                } | undefined;
                refreshKey?: number | undefined;
            };
            _input_out: {
                limit: number;
                offset: number;
                priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                status?: string | undefined;
                search?: string | undefined;
                workflow?: string | undefined;
                slaStatus?: "on-track" | "at-risk" | "overdue" | undefined;
                dateRange?: {
                    start: Date;
                    end: Date;
                } | undefined;
                refreshKey?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: any[];
        }>;
        getById: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                id: string;
            };
            _input_out: {
                id: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: import("../services/EmailStorageService").EmailWithAnalysis;
        }>;
        updateWorkflowState: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emailId: string;
                newState: "In Review" | "In Progress" | "Pending External" | "Completed" | "New" | "Archived";
            };
            _input_out: {
                emailId: string;
                newState: "In Review" | "In Progress" | "Pending External" | "Completed" | "New" | "Archived";
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
        updateStatus: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                id: string;
                status: "red" | "yellow" | "green";
                status_text: string;
                workflow_state?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
            };
            _input_out: {
                id: string;
                status: "red" | "yellow" | "green";
                status_text: string;
                workflow_state?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
        bulkUpdate: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                action: "mark-read" | "archive" | "set-priority" | "change-state";
                emailIds: string[];
                value?: string | undefined;
            };
            _input_out: {
                action: "mark-read" | "archive" | "set-priority" | "change-state";
                emailIds: string[];
                value?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                processed: number;
                successful: number;
                failed: number;
                results: ({
                    emailId: string;
                    success: boolean;
                    error?: undefined;
                } | {
                    emailId: string;
                    success: boolean;
                    error: string;
                })[];
            };
        }>;
        sendEmail: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                body: string;
                subject: string;
                to: string[];
                priority?: "low" | "high" | "normal" | undefined;
                template?: string | undefined;
                cc?: string[] | undefined;
                bcc?: string[] | undefined;
                attachments?: {
                    content: string;
                    contentType: string;
                    filename: string;
                }[] | undefined;
            };
            _input_out: {
                body: string;
                subject: string;
                priority: "low" | "high" | "normal";
                to: string[];
                template?: string | undefined;
                cc?: string[] | undefined;
                bcc?: string[] | undefined;
                attachments?: {
                    content: string;
                    contentType: string;
                    filename: string;
                }[] | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                messageId: string;
                sentAt: string;
                recipients: number;
            };
        }>;
        getWorkflowPatterns: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            success: boolean;
            data: any[];
        }>;
        getStats: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            success: boolean;
            data: {
                todayStats: {
                    received: number;
                    processed: number;
                    overdue: number;
                    critical: number;
                };
                totalEmails: number;
                workflowDistribution: Record<string, number>;
                slaCompliance: Record<string, number>;
                averageProcessingTime: number;
            };
        }>;
        searchAdvanced: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                filters?: {
                    priority?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                    workflowState?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                    status?: ("red" | "yellow" | "green")[] | undefined;
                    emailAlias?: string[] | undefined;
                    dateRange?: {
                        start: string;
                        end: string;
                    } | undefined;
                    workflowType?: string[] | undefined;
                    entityTypes?: string[] | undefined;
                } | undefined;
                page?: number | undefined;
                pageSize?: number | undefined;
                sortBy?: "subject" | "status" | "relevance" | "received_date" | undefined;
                sortOrder?: "asc" | "desc" | undefined;
                searchFields?: ("summary" | "subject" | "entities" | "emailAlias" | "requestedBy")[] | undefined;
                includeHighlight?: boolean | undefined;
            };
            _input_out: {
                query: string;
                page: number;
                pageSize: number;
                sortBy: "subject" | "status" | "relevance" | "received_date";
                sortOrder: "asc" | "desc";
                searchFields: ("summary" | "subject" | "entities" | "emailAlias" | "requestedBy")[];
                includeHighlight: boolean;
                filters?: {
                    priority?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                    workflowState?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                    status?: ("red" | "yellow" | "green")[] | undefined;
                    emailAlias?: string[] | undefined;
                    dateRange?: {
                        start: string;
                        end: string;
                    } | undefined;
                    workflowType?: string[] | undefined;
                    entityTypes?: string[] | undefined;
                } | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                searchMetadata: {
                    query: string;
                    searchFields: ("summary" | "subject" | "entities" | "emailAlias" | "requestedBy")[];
                    totalMatches: number;
                    searchTime: number;
                    relevanceScoring: boolean;
                };
                emails: Array<{
                    id: string;
                    email_alias: string;
                    requested_by: string;
                    subject: string;
                    summary: string;
                    status: string;
                    status_text: string;
                    workflow_state: string;
                    priority: string;
                    received_date: string;
                    is_read: boolean;
                    has_attachments: boolean;
                }>;
                totalCount: number;
                totalPages: number;
                fromCache?: boolean;
                performanceMetrics?: {
                    queryTime: number;
                    cacheHit: boolean;
                    optimizationGain: number;
                };
            };
        }>;
        search: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                filters?: {
                    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                    status?: string | undefined;
                    workflow?: string | undefined;
                    slaStatus?: "on-track" | "at-risk" | "overdue" | undefined;
                    dateRange?: {
                        start: Date;
                        end: Date;
                    } | undefined;
                } | undefined;
            };
            _input_out: {
                query: string;
                limit: number;
                filters?: {
                    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                    status?: string | undefined;
                    workflow?: string | undefined;
                    slaStatus?: "on-track" | "at-risk" | "overdue" | undefined;
                    dateRange?: {
                        start: Date;
                        end: Date;
                    } | undefined;
                } | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                emails: {
                    id: string;
                    email_alias: string;
                    requested_by: string;
                    subject: string;
                    summary: string;
                    status: string;
                    status_text: string;
                    workflow_state: string;
                    priority: string;
                    received_date: string;
                    is_read: boolean;
                    has_attachments: boolean;
                }[];
                total: number;
                query: string;
                filters: {
                    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                    status?: string | undefined;
                    workflow?: string | undefined;
                    slaStatus?: "on-track" | "at-risk" | "overdue" | undefined;
                    dateRange?: {
                        start: Date;
                        end: Date;
                    } | undefined;
                } | undefined;
            };
        }>;
        batchCreateEmails: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emails: {
                    summary: string;
                    subject: string;
                    workflowState: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                    status: "red" | "yellow" | "green";
                    emailAlias: string;
                    messageId: string;
                    requestedBy: string;
                    statusText: string;
                    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                    entities?: {
                        type: string;
                        value: string;
                    }[] | undefined;
                    workflowType?: string | undefined;
                    receivedDate?: Date | undefined;
                }[];
                batchId?: string | undefined;
            };
            _input_out: {
                emails: {
                    summary: string;
                    subject: string;
                    workflowState: "START_POINT" | "IN_PROGRESS" | "COMPLETION";
                    status: "red" | "yellow" | "green";
                    emailAlias: string;
                    messageId: string;
                    requestedBy: string;
                    statusText: string;
                    priority?: "Critical" | "High" | "Medium" | "Low" | undefined;
                    entities?: {
                        type: string;
                        value: string;
                    }[] | undefined;
                    workflowType?: string | undefined;
                    receivedDate?: Date | undefined;
                }[];
                batchId?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                created: number;
                failed: number;
                total: number;
                results: {
                    emailId: string;
                    messageId: string;
                    success: boolean;
                }[];
                errors: {
                    messageId: string;
                    error: string;
                    success: boolean;
                }[] | undefined;
            };
        }>;
        batchUpdateStatuses: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                updates: {
                    emailId: string;
                    status: "red" | "yellow" | "green";
                    statusText: string;
                    workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
                }[];
                changedBy?: string | undefined;
            };
            _input_out: {
                updates: {
                    emailId: string;
                    status: "red" | "yellow" | "green";
                    statusText: string;
                    workflowState?: "START_POINT" | "IN_PROGRESS" | "COMPLETION" | undefined;
                }[];
                changedBy?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                updated: number;
                failed: number;
                total: number;
                results: {
                    emailId: string;
                    success: boolean;
                }[];
                errors: {
                    emailId: string;
                    error: string;
                    success: boolean;
                }[] | undefined;
            };
        }>;
        batchDelete: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emailIds: string[];
                softDelete?: boolean | undefined;
                reason?: string | undefined;
            };
            _input_out: {
                emailIds: string[];
                softDelete: boolean;
                reason?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            data: {
                deleted: number;
                failed: number;
                total: number;
                softDelete: boolean;
                results: {
                    emailId: string;
                    success: boolean;
                }[];
                errors: {
                    emailId: string;
                    error: string;
                    success: boolean;
                }[] | undefined;
            };
        }>;
        getTableMetadata: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            success: boolean;
            data: {
                columns: {
                    key: string;
                    label: string;
                    type: string;
                    sortable: boolean;
                    filterable: boolean;
                    width: number;
                }[];
                filterOptions: {
                    status: {
                        value: string;
                        label: string;
                        color: string;
                    }[];
                    priority: {
                        value: string;
                        label: string;
                        color: string;
                    }[];
                    workflowState: {
                        value: string;
                        label: string;
                        color: string;
                    }[];
                };
                defaultSort: {
                    column: string;
                    direction: string;
                };
                pagination: {
                    defaultPageSize: number;
                    pageSizeOptions: number[];
                };
                features: {
                    search: boolean;
                    filtering: boolean;
                    sorting: boolean;
                    bulkActions: boolean;
                    export: boolean;
                    realTimeUpdates: boolean;
                };
            };
        }>;
        subscribeToEmailUpdates: import("@trpc/server").BuildProcedure<"subscription", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                types?: string[] | undefined;
            };
            _input_out: {
                types: string[];
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, AsyncGenerator<{
            type: any;
            data: unknown;
            timestamp: string;
        }, never, unknown>>;
    }>;
    emailAssignment: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        getTeamMembers: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            id: string;
            name: string;
            email: string;
            role: string;
            teams: string[];
        }[]>;
        assignEmail: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emailId: string;
                assignedTo: string | null;
            };
            _input_out: {
                emailId: string;
                assignedTo: string | null;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, any>;
        bulkAssignEmails: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emailIds: string[];
                assignedTo: string | null;
            };
            _input_out: {
                emailIds: string[];
                assignedTo: string | null;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            updated: any[];
            errors: {
                emailId: string;
                error: string;
            }[];
        }>;
        getAssignmentSuggestions: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            _input_in: string;
            _input_out: string;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            emailId: string;
            emailAlias: any;
            suggestions: {
                id: string;
                name: string;
                email: string;
                role: string;
                confidence: number;
            }[];
        }>;
        getWorkloadDistribution: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            memberId: string;
            memberName: string;
            memberEmail: string | undefined;
            emailCount: number;
        }[]>;
        onEmailUpdate: import("@trpc/server").BuildProcedure<"subscription", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            [Symbol.asyncIterator](): AsyncGenerator<{
                type: string;
                timestamp: string;
            }, void, unknown>;
        }>;
    }>;
    metrics: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        getRateLimitMetrics: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
        }, any>;
        resetRateLimitMetrics: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                identifier?: string | undefined;
            };
            _input_out: {
                identifier?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
        }>;
        getRateLimitStatus: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                identifier: string;
            };
            _input_out: {
                identifier: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            identifier: string;
            allowed: boolean;
            remaining: number;
            resetTime: Date;
        }>;
    }>;
    iemsEmails: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        getCategorizedEmails: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                refresh?: boolean | undefined;
            } | undefined;
            _input_out: {
                limit?: number | undefined;
                refresh?: boolean | undefined;
            } | undefined;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("../../types/iems-email.types").CategorizedEmails>;
        updateEmailStatus: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emailId: string;
                status: "red" | "yellow" | "green";
                statusText?: string | undefined;
            };
            _input_out: {
                emailId: string;
                status: "red" | "yellow" | "green";
                statusText?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            emailId: string;
            status: "red" | "yellow" | "green";
        }>;
        assignEmail: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emailId: string;
                assigneeId: string;
                assigneeName: string;
            };
            _input_out: {
                emailId: string;
                assigneeId: string;
                assigneeName: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            emailId: string;
            assigneeId: string;
        }>;
        performEmailAction: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emailId: string;
                action: string;
                data?: Record<string, any> | undefined;
            };
            _input_out: {
                emailId: string;
                action: string;
                data?: Record<string, any> | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            emailId: string;
            action: "escalate" | "respond" | "viewCase";
        }>;
        getEmailSummary: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                emailId: string;
                forceRegenerate?: boolean | undefined;
            };
            _input_out: {
                emailId: string;
                forceRegenerate?: boolean | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            emailId: string;
            summary: string;
            generatedAt: Date;
        }>;
        getTeamMembers: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            id: string;
            name: string;
            email: string;
            available: boolean;
        }[]>;
        getAnalytics: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            totalEmails: number;
            byCategory: {
                'email-alias': number;
                'marketing-splunk': number;
                'vmware-tdsynnex': number;
            };
            byStatus: {
                red: number;
                yellow: number;
                green: number;
            };
            avgResponseTime: number;
            urgentCount: number;
            pendingAssignments: number;
        }>;
    }>;
    deals: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        getDeal: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                dealId: string;
            };
            _input_out: {
                dealId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("../services/DealDataService").DealResponse>;
        getDealItem: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                dealId: string;
                productNumber: string;
            };
            _input_out: {
                dealId: string;
                productNumber: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            calculatedPrice: number;
            priceDisclaimer: string;
            id: string;
            dealId: string;
            productNumber: string;
            productFamily: string;
            remainingQuantity: number;
            dealerNetPrice: number;
            listPrice?: number;
            description?: string;
            createdAt: string;
            updatedAt: string;
        }>;
        calculatePriceForQuantity: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                quantity: number;
                dealId: string;
                productNumber: string;
            };
            _input_out: {
                quantity: number;
                dealId: string;
                productNumber: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            productNumber: string;
            productFamily: string;
            quantity: number;
            remainingQuantity: number;
            unitPrice: number;
            totalPrice: number;
            currency: string;
            priceDisclaimer: string;
        }>;
        getDealAnalytics: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
            totalDeals: number;
            activeDeals: number;
            expiredDeals: number;
            totalValue: number;
            averageDealValue: number;
            topCustomers: {
                name: string;
                dealCount: number;
                totalValue: number;
            }[];
            productFamilyBreakdown: {
                IPG: {
                    count: number;
                    value: number;
                };
                PSG: {
                    count: number;
                    value: number;
                };
            };
            expirationAlerts: {
                dealId: string;
                customer: string;
                daysUntilExpiration: number;
                endDate: string;
            }[];
        }>;
    }>;
    walmartGrocery: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        searchProducts: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                inStock?: boolean | undefined;
                category?: string | undefined;
                storeId?: string | undefined;
                minPrice?: number | undefined;
                maxPrice?: number | undefined;
            };
            _input_out: {
                query: string;
                limit: number;
                inStock?: boolean | undefined;
                category?: string | undefined;
                storeId?: string | undefined;
                minPrice?: number | undefined;
                maxPrice?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            products: import("../../core/data-collection/types").CollectedData[];
            analysis: string;
            metadata: {
                totalResults: number;
                searchId: string;
                cached: boolean;
            };
        }>;
        getProductDetails: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                productId: string;
                includeReviews?: boolean | undefined;
                includeAvailability?: boolean | undefined;
            };
            _input_out: {
                productId: string;
                includeReviews: boolean;
                includeAvailability: boolean;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            source: string;
            data: any;
            timestamp: any;
        }>;
        cartOperation: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                operation: "update" | "add" | "remove";
                userId: string;
                productId: string;
                quantity: number;
            };
            _input_out: {
                operation: "update" | "add" | "remove";
                userId: string;
                productId: string;
                quantity: number;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            cartId: string;
            operation: "update" | "add" | "remove";
            deals: any;
            message: string;
        }>;
        analyzeDeal: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                productIds: string[];
                dealId?: string | undefined;
                customerId?: string | undefined;
            };
            _input_out: {
                productIds: string[];
                dealId?: string | undefined;
                customerId?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            products: string[];
            dealAnalysis: any;
            recommendations: string;
            potentialSavings: any;
            applicableDeals: any;
        }>;
        scrapeData: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                url: string;
                extractType: "search" | "category" | "deals" | "product";
                options?: Record<string, any> | undefined;
            };
            _input_out: {
                url: string;
                extractType: "search" | "category" | "deals" | "product";
                options?: Record<string, any> | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            recordsCollected: number;
            data: import("../../core/data-collection/types").CollectedData[];
            message: string;
        }>;
        onUpdate: import("@trpc/server").BuildProcedure<"subscription", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                events: ("search" | "all" | "deals" | "cart" | "scraping")[];
                userId?: string | undefined;
            };
            _input_out: {
                events: ("search" | "all" | "deals" | "cart" | "scraping")[];
                userId?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("@trpc/server/observable").Observable<unknown, unknown>>;
        getRecommendations: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
                category?: string | undefined;
                dietaryRestrictions?: string[] | undefined;
                budget?: number | undefined;
            };
            _input_out: {
                userId: string;
                category?: string | undefined;
                dietaryRestrictions?: string[] | undefined;
                budget?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            userId: string;
            recommendations: string;
            categories: any;
            estimatedBudget: any;
            timestamp: Date;
        }>;
        uploadReceipt: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
                mimeType: string;
                receiptData: string;
            };
            _input_out: {
                userId: string;
                mimeType: string;
                receiptData: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            receiptId: string;
            analysis: string;
            insights: any;
        }>;
        getLists: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
            };
            _input_out: {
                userId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            lists: any;
        }>;
        createList: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                name: string;
                userId: string;
                description?: string | undefined;
            };
            _input_out: {
                name: string;
                userId: string;
                description?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            list: any;
        }>;
        updateList: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                listId: string;
                name?: string | undefined;
                description?: string | undefined;
            };
            _input_out: {
                listId: string;
                name?: string | undefined;
                description?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            listId: string;
        }>;
        deleteList: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                listId: string;
            };
            _input_out: {
                listId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            listId: string;
        }>;
        addItemToList: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                items: {
                    productId: string;
                    quantity: number;
                    notes?: string | undefined;
                }[];
                listId: string;
            };
            _input_out: {
                items: {
                    productId: string;
                    quantity: number;
                    notes?: string | undefined;
                }[];
                listId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            items: any;
        }>;
        removeItemFromList: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                listId: string;
                itemId: string;
            };
            _input_out: {
                listId: string;
                itemId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            listId: string;
            itemId: string;
        }>;
        getOrders: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
                limit?: number | undefined;
                offset?: number | undefined;
            };
            _input_out: {
                limit: number;
                userId: string;
                offset: number;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            orders: {
                id: string;
                userId: string;
                orderNumber: string;
                items: never[];
                subtotal: number;
                tax: number;
                fees: number;
                deliveryFee: number;
                total: number;
                status: "pending";
                orderDate: Date;
                createdAt: Date;
                updatedAt: Date;
                deliveryAddress: string;
                deliveryDate: Date;
                deliverySlot: string;
            }[];
            totalCount: number;
        }>;
        getOrder: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                orderId: string;
            };
            _input_out: {
                orderId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            order: {
                id: string;
                userId: string;
                orderNumber: string;
                items: never[];
                subtotal: number;
                tax: number;
                fees: number;
                deliveryFee: number;
                total: number;
                status: "pending";
                orderDate: Date;
                createdAt: Date;
                updatedAt: Date;
                deliveryAddress: string;
                deliveryDate: Date;
                deliverySlot: string;
            };
        }>;
        createOrder: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
                items: {
                    productId: string;
                    quantity: number;
                    price: number;
                }[];
                deliveryAddress: string;
                deliveryDate: string;
                deliverySlot: string;
            };
            _input_out: {
                userId: string;
                items: {
                    productId: string;
                    quantity: number;
                    price: number;
                }[];
                deliveryAddress: string;
                deliveryDate: string;
                deliverySlot: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            order: {
                id: string;
                userId: string;
                orderNumber: string;
                items: {
                    productId: string;
                    quantity: number;
                    price: number;
                }[];
                subtotal: number;
                tax: number;
                fees: number;
                deliveryFee: number;
                total: number;
                status: "pending";
                orderDate: Date;
                createdAt: Date;
                updatedAt: Date;
                deliveryAddress: string;
                deliveryDate: Date;
                deliverySlot: string;
            };
        }>;
        updateOrderStatus: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                status: "cancelled" | "pending" | "confirmed" | "preparing" | "delivered" | "out_for_delivery";
                orderId: string;
            };
            _input_out: {
                status: "cancelled" | "pending" | "confirmed" | "preparing" | "delivered" | "out_for_delivery";
                orderId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            orderId: string;
            status: "cancelled" | "pending" | "confirmed" | "preparing" | "delivered" | "out_for_delivery";
        }>;
        trackOrder: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                orderId: string;
            };
            _input_out: {
                orderId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            orderId: string;
            status: string;
            trackingSteps: ({
                step: string;
                completed: boolean;
                timestamp: Date;
            } | {
                step: string;
                completed: boolean;
                timestamp: null;
            })[];
            estimatedDelivery: Date;
            driverInfo: null;
        }>;
        getPreferences: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
            };
            _input_out: {
                userId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            preferences: {
                dietaryRestrictions: never[];
                allergies: never[];
                favoriteCategories: never[];
                preferredBrands: never[];
                avoidBrands: never[];
                deliveryPreferences: {
                    preferredDays: never[];
                    preferredTimeSlots: never[];
                };
            };
        }>;
        updatePreferences: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
                preferences: {
                    dietaryRestrictions?: string[] | undefined;
                    allergies?: string[] | undefined;
                    favoriteCategories?: string[] | undefined;
                    preferredBrands?: string[] | undefined;
                    avoidBrands?: string[] | undefined;
                    deliveryPreferences?: {
                        preferredDays?: string[] | undefined;
                        preferredTimeSlots?: string[] | undefined;
                    } | undefined;
                };
            };
            _input_out: {
                userId: string;
                preferences: {
                    dietaryRestrictions?: string[] | undefined;
                    allergies?: string[] | undefined;
                    favoriteCategories?: string[] | undefined;
                    preferredBrands?: string[] | undefined;
                    avoidBrands?: string[] | undefined;
                    deliveryPreferences?: {
                        preferredDays?: string[] | undefined;
                        preferredTimeSlots?: string[] | undefined;
                    } | undefined;
                };
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            preferences: {
                dietaryRestrictions?: string[] | undefined;
                allergies?: string[] | undefined;
                favoriteCategories?: string[] | undefined;
                preferredBrands?: string[] | undefined;
                avoidBrands?: string[] | undefined;
                deliveryPreferences?: {
                    preferredDays?: string[] | undefined;
                    preferredTimeSlots?: string[] | undefined;
                } | undefined;
            };
        }>;
        getAlerts: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
            };
            _input_out: {
                userId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            alerts: never[];
        }>;
        createAlert: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
                productId: string;
                alertType: "deal" | "price_drop" | "back_in_stock";
                targetPrice?: number | undefined;
            };
            _input_out: {
                userId: string;
                productId: string;
                alertType: "deal" | "price_drop" | "back_in_stock";
                targetPrice?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            alert: {
                id: string;
                userId: string;
                productId: string;
                alertType: "deal" | "price_drop" | "back_in_stock";
                targetPrice: number | undefined;
                createdAt: Date;
                active: boolean;
            };
        }>;
        deleteAlert: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                alertId: string;
            };
            _input_out: {
                alertId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            alertId: string;
        }>;
        trackPrice: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                userId: string;
                productId: string;
                targetPrice?: number | undefined;
            };
            _input_out: {
                userId: string;
                productId: string;
                targetPrice?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            tracking: {
                id: string;
                productId: string;
                userId: string;
                targetPrice: number | undefined;
                currentPrice: number;
                createdAt: Date;
                active: boolean;
            };
        }>;
        getPriceHistory: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                user: import("./context").User;
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
                productId: string;
                days?: number | undefined;
            };
            _input_out: {
                days: number;
                productId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            productId: string;
            history: {
                date: Date;
                price: number;
                available: boolean;
            }[];
            lowestPrice: number;
            highestPrice: number;
            averagePrice: number;
        }>;
    }>;
}>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=router.d.ts.map