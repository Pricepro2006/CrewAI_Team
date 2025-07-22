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
            code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
        };
        message: string;
        code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
    };
    transformer: typeof import("superjson").default;
}>, {
    auth: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
                code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
                httpStatus: number;
                path?: string;
            };
            message: string;
            code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
        };
        transformer: typeof import("superjson").default;
    }>, {
        register: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                email: string;
                username: string;
                password: string;
                role?: import("../services/UserService").UserRole | undefined;
            };
            _input_out: {
                email: string;
                username: string;
                password: string;
                role?: import("../services/UserService").UserRole | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            user: {
                id: string;
                email: string;
                username: string;
                role: import("../services/UserService").UserRole;
            };
        }>;
        login: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                password: string;
                emailOrUsername: string;
            };
            _input_out: {
                password: string;
                emailOrUsername: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            user: {
                id: string;
                email: string;
                username: string;
                role: import("../services/UserService").UserRole;
            };
            tokens: import("../services/UserService").AuthTokens;
        }>;
        refresh: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                refreshToken: string;
            };
            _input_out: {
                refreshToken: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            tokens: import("../services/UserService").AuthTokens;
        }>;
        logout: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                refreshToken?: string | undefined;
            };
            _input_out: {
                refreshToken?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
        me: import("@trpc/server").BuildProcedure<"query", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            id: string;
            email: string;
            username: string;
            role: import("../services/UserService").UserRole;
            isActive: boolean;
            createdAt: string;
            lastLoginAt: string | undefined;
        }>;
        listUsers: import("@trpc/server").BuildProcedure<"query", {
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
                agentRegistry: any;
                ragSystem: any;
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
        }, {
            users: {
                id: string;
                email: string;
                username: string;
                role: import("../services/UserService").UserRole;
                isActive: boolean;
                createdAt: string;
                lastLoginAt: string | undefined;
            }[];
            total: number;
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            totalUsers: number;
            activeUsers: number;
            usersByRole: Record<string, number>;
            recentSignups: number;
        }>;
        updateRole: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                userId: string;
                role: import("../services/UserService").UserRole;
            };
            _input_out: {
                userId: string;
                role: import("../services/UserService").UserRole;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
        deactivateUser: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
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
            success: boolean;
            message: string;
        }>;
        reactivateUser: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
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
            success: boolean;
            message: string;
        }>;
    }>;
    agent: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
    task: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
                code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
                httpStatus: number;
                path?: string;
            };
            message: string;
            code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
        };
        transformer: typeof import("superjson").default;
    }>, {
        submit: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                type: "tool" | "agent" | "composite";
                timeout?: number | undefined;
                data?: any;
                priority?: number | undefined;
                retries?: number | undefined;
            };
            _input_out: {
                type: "tool" | "agent" | "composite";
                timeout?: number | undefined;
                data?: any;
                priority?: number | undefined;
                retries?: number | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            taskId: string;
        }>;
        status: import("@trpc/server").BuildProcedure<"query", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                taskId: string;
            };
            _input_out: {
                taskId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            id: string;
            status: "completed" | "failed" | "queued" | "running" | "cancelled";
            progress: number;
            startTime: string;
            completedTime: string | undefined;
            estimatedCompletion: null;
            result: import("../../core/maestro/types").TaskResult | undefined;
            error: string | undefined;
        }>;
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                filter?: "completed" | "active" | "all" | undefined;
            };
            _input_out: {
                filter: "completed" | "active" | "all";
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            id: any;
            type: any;
            status: any;
            progress: any;
            priority: any;
            submittedAt: any;
            startedAt: any;
            completedAt: any;
            result: any;
            error: any;
        }[]>;
        cancel: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                taskId: string;
            };
            _input_out: {
                taskId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: true;
        }>;
        queueStatus: import("@trpc/server").BuildProcedure<"query", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            total: number;
            active: number;
            pending: number;
            running: number;
            completed: number;
            failed: number;
            cancelled: number;
        }>;
        clearCompleted: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
    }>;
    rag: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
                code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
                httpStatus: number;
                path?: string;
            };
            message: string;
            code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
        };
        transformer: typeof import("superjson").default;
    }>, {
        upload: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                content: string;
                filename: string;
                metadata?: Record<string, any> | undefined;
            };
            _input_out: {
                content: string;
                filename: string;
                metadata?: Record<string, any> | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                query: string;
                filter?: Record<string, any> | undefined;
                limit?: number | undefined;
            };
            _input_out: {
                query: string;
                limit: number;
                filter?: Record<string, any> | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, any>;
        getDocument: import("@trpc/server").BuildProcedure<"query", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                documentId: string;
            };
            _input_out: {
                documentId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, any>;
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                documentId: string;
            };
            _input_out: {
                documentId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
        }>;
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
                agentRegistry: any;
                ragSystem: any;
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
        }, any>;
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, any>;
        clear: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
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
                agentRegistry: any;
                ragSystem: any;
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
            data: any;
            format: "json" | "csv";
            timestamp: string;
        }>;
        import: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                data: string;
                format?: "json" | "csv" | undefined;
            };
            _input_out: {
                data: string;
                format: "json" | "csv";
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
        uploadFile: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                data: string;
                filename: string;
                mimeType: string;
                metadata?: Record<string, any> | undefined;
            };
            _input_out: {
                data: string;
                filename: string;
                mimeType: string;
                metadata?: Record<string, any> | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            documentId: string;
            message: string;
        }>;
        uploadBatch: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                files: {
                    data: string;
                    filename: string;
                    mimeType: string;
                    metadata?: Record<string, any> | undefined;
                }[];
            };
            _input_out: {
                files: {
                    data: string;
                    filename: string;
                    mimeType: string;
                    metadata?: Record<string, any> | undefined;
                }[];
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            uploaded: number;
            failed: number;
            results: {
                filename: string;
                documentId: string;
                success: boolean;
            }[];
            errors: {
                filename: string;
                error: string;
            }[];
        }>;
        uploadFromUrl: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                url: string;
                metadata?: Record<string, any> | undefined;
            };
            _input_out: {
                url: string;
                metadata?: Record<string, any> | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            documentId: string;
            message: string;
        }>;
        updateMetadata: import("@trpc/server").BuildProcedure<"mutation", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                metadata: Record<string, any>;
                documentId: string;
            };
            _input_out: {
                metadata: Record<string, any>;
                documentId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
    }>;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
    ws: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
                code: import("@trpc/server/rpc").TRPC_ERROR_CODE_KEY;
                httpStatus: number;
                path?: string;
            };
            message: string;
            code: import("@trpc/server/rpc").TRPC_ERROR_CODE_NUMBER;
        };
        transformer: typeof import("superjson").default;
    }>, {
        subscribe: import("@trpc/server").BuildProcedure<"subscription", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                filter?: {
                    agentId?: string | undefined;
                    taskId?: string | undefined;
                    planId?: string | undefined;
                    conversationId?: string | undefined;
                } | undefined;
                types?: string[] | undefined;
            };
            _input_out: {
                types: string[];
                filter?: {
                    agentId?: string | undefined;
                    taskId?: string | undefined;
                    planId?: string | undefined;
                    conversationId?: string | undefined;
                } | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("@trpc/server/observable").Observable<unknown, unknown>>;
        agentStatus: import("@trpc/server").BuildProcedure<"subscription", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                agentId?: string | undefined;
            };
            _input_out: {
                agentId?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("@trpc/server/observable").Observable<unknown, unknown>>;
        planProgress: import("@trpc/server").BuildProcedure<"subscription", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                planId: string;
            };
            _input_out: {
                planId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("@trpc/server/observable").Observable<unknown, unknown>>;
        taskQueue: import("@trpc/server").BuildProcedure<"subscription", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("@trpc/server/observable").Observable<unknown, unknown>>;
        ragOperations: import("@trpc/server").BuildProcedure<"subscription", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("@trpc/server/observable").Observable<unknown, unknown>>;
        systemHealth: import("@trpc/server").BuildProcedure<"subscription", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("@trpc/server/observable").Observable<unknown, unknown>>;
        connectionStats: import("@trpc/server").BuildProcedure<"query", {
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            connectedClients: number;
            timestamp: Date;
        }>;
    }>;
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                query: string;
                engine?: "google" | "bing" | "yandex" | undefined;
                language?: string | undefined;
                maxResults?: number | undefined;
                location?: string | undefined;
                cursor?: string | undefined;
            };
            _input_out: {
                query: string;
                engine: "google" | "bing" | "yandex";
                maxResults: number;
                language?: string | undefined;
                location?: string | undefined;
                cursor?: string | undefined;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: {
                platform: "amazon" | "walmart" | "ebay" | "etsy" | "bestbuy" | "homedepot" | "zara";
                productUrl?: string | undefined;
                searchKeyword?: string | undefined;
                maxProducts?: number | undefined;
            };
            _input_out: {
                platform: "amazon" | "walmart" | "ebay" | "etsy" | "bestbuy" | "homedepot" | "zara";
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
                platform: "amazon" | "walmart" | "ebay" | "etsy" | "bestbuy" | "homedepot" | "zara";
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
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
                agentRegistry: any;
                ragSystem: any;
            };
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            totalEmails: number;
            byCategory: {
                "email-alias": number;
                "marketing-splunk": number;
                "vmware-tdsynnex": number;
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
}>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=router.d.ts.map