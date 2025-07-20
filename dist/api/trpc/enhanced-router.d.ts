import superjson from "superjson";
import type { Context } from "./context";
import { z } from "zod";
/**
 * Enhanced tRPC setup with comprehensive security and performance features
 * Based on TypeScript Expert tRPC API instructions and security best practices
 */
declare const t: {
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
        transformer: typeof superjson;
    }>;
    procedure: import("@trpc/server").ProcedureBuilder<{
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
            transformer: typeof superjson;
        }>;
        _ctx_out: {
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
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
        _meta: object;
    }>;
    middleware: <TNewParams extends import("@trpc/server").ProcedureParams<import("@trpc/server").AnyRootConfig, unknown, unknown, unknown, unknown, unknown, unknown>>(fn: import("@trpc/server").MiddlewareFunction<{
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
            transformer: typeof superjson;
        }>;
        _ctx_out: {};
        _input_out: typeof import("@trpc/server").unsetMarker;
        _input_in: unknown;
        _output_in: unknown;
        _output_out: unknown;
        _meta: object;
    }, TNewParams>) => import("@trpc/server").MiddlewareBuilder<{
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
            transformer: typeof superjson;
        }>;
        _ctx_out: {};
        _input_out: typeof import("@trpc/server").unsetMarker;
        _input_in: unknown;
        _output_in: unknown;
        _output_out: unknown;
        _meta: object;
    }, TNewParams>;
    router: <TProcRouterRecord extends import("@trpc/server").ProcedureRouterRecord>(procedures: TProcRouterRecord) => import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
        transformer: typeof superjson;
    }>, TProcRouterRecord>;
    mergeRouters: typeof import("@trpc/server").mergeRouters;
    createCallerFactory: <TRouter extends import("@trpc/server").Router<import("@trpc/server").AnyRouterDef<import("@trpc/server").RootConfig<{
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
        transformer: typeof superjson;
    }>, any>>>(router: TRouter) => import("@trpc/server").RouterCaller<TRouter["_def"]>;
};
export declare const router: typeof t.router;
export declare const middleware: typeof t.middleware;
export declare const publicProcedure: ReturnType<typeof t.procedure.use>;
export declare const protectedProcedure: ReturnType<typeof t.procedure.use>;
export declare const adminProcedure: ReturnType<typeof t.procedure.use>;
export declare const userProcedure: ReturnType<typeof t.procedure.use>;
export declare const chatProcedure: import("@trpc/server").ProcedureBuilder<{
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
        transformer: typeof superjson;
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
}>;
export declare const agentProcedure: import("@trpc/server").ProcedureBuilder<{
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
        transformer: typeof superjson;
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
}>;
export declare const taskProcedure: import("@trpc/server").ProcedureBuilder<{
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
        transformer: typeof superjson;
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
}>;
export declare const ragProcedure: import("@trpc/server").ProcedureBuilder<{
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
        transformer: typeof superjson;
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
}>;
export declare const strictProcedure: import("@trpc/server").ProcedureBuilder<{
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
        transformer: typeof superjson;
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
}>;
export declare const secureTextProcedure: ReturnType<typeof protectedProcedure.use>;
export declare const secureQueryProcedure: ReturnType<typeof protectedProcedure.use>;
export declare const monitoredProcedure: ReturnType<typeof protectedProcedure.use>;
export declare const monitoredPublicProcedure: ReturnType<typeof publicProcedure.use>;
export declare const enhancedProcedure: ReturnType<typeof t.procedure.use>;
export declare const batchProcedure: import("@trpc/server").ProcedureBuilder<{
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
        transformer: typeof superjson;
    }>;
    _meta: object;
    _ctx_out: {
        timestamp: Date;
        user: import("./context").User;
        batchId: string;
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
}>;
export declare function createCustomErrorHandler(errorType: string): import("@trpc/server").MiddlewareBuilder<{
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
        transformer: typeof superjson;
    }>;
    _ctx_out: {};
    _input_out: typeof import("@trpc/server").unsetMarker;
    _input_in: unknown;
    _output_in: unknown;
    _output_out: unknown;
    _meta: object;
}, {
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
        transformer: typeof superjson;
    }>;
    _ctx_out: {};
    _input_out: typeof import("@trpc/server").unsetMarker;
    _input_in: unknown;
    _output_in: unknown;
    _output_out: unknown;
    _meta: object;
}>;
export declare const commonSchemas: {
    id: z.ZodString;
    pagination: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
    }, {
        limit?: number | undefined;
        page?: number | undefined;
    }>;
    search: z.ZodObject<{
        query: z.ZodString;
        filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        sort: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        sort?: "asc" | "desc" | undefined;
        filters?: Record<string, string> | undefined;
    }, {
        query: string;
        sort?: "asc" | "desc" | undefined;
        filters?: Record<string, string> | undefined;
    }>;
    fileUpload: z.ZodObject<{
        name: z.ZodString;
        size: z.ZodNumber;
        type: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: string;
        size: number;
    }, {
        name: string;
        type: string;
        size: number;
    }>;
};
export type EnhancedContext = Context & {
    batchId?: string;
    requestId: string;
    timestamp: Date;
};
export declare function createFeatureRouter<T extends Record<string, any>>(name: string, procedures: T): T;
export declare function createSecureRouter<T extends Record<string, any>>(routes: T, options?: {
    requireAuth?: boolean;
    rateLimit?: boolean;
    adminOnly?: boolean;
}): T;
export {};
//# sourceMappingURL=enhanced-router.d.ts.map