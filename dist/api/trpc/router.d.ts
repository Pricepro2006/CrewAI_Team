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
    auth: import("@trpc/server").Router<any>;
    agent: import("@trpc/server").Router<any>;
    task: import("@trpc/server").Router<any>;
    rag: import("@trpc/server").Router<any>;
    chat: any;
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
    dataCollection: any;
    emails: any;
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
    metrics: any;
    iemsEmails: any;
}>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=router.d.ts.map