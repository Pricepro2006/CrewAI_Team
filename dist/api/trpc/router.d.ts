export { router, publicProcedure, protectedProcedure, adminProcedure, userProcedure, chatProcedure, agentProcedure, taskProcedure, ragProcedure, strictProcedure, enhancedProcedure, monitoredProcedure, middleware, commonSchemas, createFeatureRouter, createSecureRouter, } from "./enhanced-router";
export declare const appRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        user: import("./context").User;
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
}>, {
    auth: import("@trpc/server").Router<any>;
    agent: import("@trpc/server").Router<any>;
    task: import("@trpc/server").Router<any>;
    rag: import("@trpc/server").Router<any>;
    chat: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
            user: import("./context").User;
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
    }>, {
        create: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
            masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
            conversationService: import("../services/ConversationService").ConversationService;
            taskService: import("../services/TaskService").TaskService;
            maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
            userService: import("../services/UserService").UserService;
            agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
            ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
            req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
            res: import("express").Response<any, Record<string, any>>;
            user: import("./context").User;
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
    dataCollection: import("@trpc/server").Router<import("@trpc/server/dist/core/router").RouterDef<import("@trpc/server").RootConfig<{
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
            user: import("./context").User;
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
    emails: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
            user: import("./context").User;
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
    }>, {
        getTableData: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
            };
            _input_in: {
                search?: string | undefined;
                filters?: {
                    priority?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                    workflowState?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                    status?: ("red" | "yellow" | "green")[] | undefined;
                    emailAlias?: string[] | undefined;
                    dateRange?: {
                        end: string;
                        start: string;
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
                        end: string;
                        start: string;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    end: Date;
                    start: Date;
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
                    end: Date;
                    start: Date;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
        bulkUpdate: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
            };
            _input_in: {
                body: string;
                subject: string;
                to: string[];
                priority?: "low" | "high" | "normal" | undefined;
                cc?: string[] | undefined;
                bcc?: string[] | undefined;
                template?: string | undefined;
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
                cc?: string[] | undefined;
                bcc?: string[] | undefined;
                template?: string | undefined;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
            };
            _input_in: {
                query: string;
                filters?: {
                    priority?: ("Critical" | "High" | "Medium" | "Low")[] | undefined;
                    workflowState?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[] | undefined;
                    status?: ("red" | "yellow" | "green")[] | undefined;
                    emailAlias?: string[] | undefined;
                    dateRange?: {
                        end: string;
                        start: string;
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
                        end: string;
                        start: string;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                        end: Date;
                        start: Date;
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
                        end: Date;
                        start: Date;
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
                        end: Date;
                        start: Date;
                    } | undefined;
                } | undefined;
            };
        }>;
        batchCreateEmails: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
    metrics: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
            user: import("./context").User;
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
    }>, {
        getRateLimitMetrics: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
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
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, any>;
        resetRateLimitMetrics: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
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
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
                    masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                    conversationService: import("../services/ConversationService").ConversationService;
                    taskService: import("../services/TaskService").TaskService;
                    maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                    userService: import("../services/UserService").UserService;
                    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                    res: import("express").Response<any, Record<string, any>>;
                    user: import("./context").User;
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
            }>;
            _meta: object;
            _ctx_out: {
                timestamp: Date;
                user: import("./context").User;
                batchId: string | undefined;
                req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
                res: import("express").Response<any, Record<string, any>>;
                requestId: string;
                masterOrchestrator: import("../../core/master-orchestrator/MasterOrchestrator").MasterOrchestrator;
                conversationService: import("../services/ConversationService").ConversationService;
                taskService: import("../services/TaskService").TaskService;
                maestroFramework: import("../../core/maestro/MaestroFramework").MaestroFramework;
                userService: import("../services/UserService").UserService;
                agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
                ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
                validatedInput: unknown;
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
}>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=router.d.ts.map