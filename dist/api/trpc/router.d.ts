export { router, publicProcedure, protectedProcedure, adminProcedure, userProcedure, chatProcedure, agentProcedure, taskProcedure, ragProcedure, strictProcedure, enhancedProcedure, monitoredProcedure, middleware, commonSchemas, createFeatureRouter, createSecureRouter, } from "./enhanced-router";
export declare const appRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
    ctx: any;
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
    auth: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: any;
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
        register: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: {
                role: import("../services/UserService").UserRole;
                userId: string;
            };
            _input_out: {
                role: import("../services/UserService").UserRole;
                userId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
        deactivateUser: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
    agent: import("@trpc/server").Router<any>;
    task: import("@trpc/server").Router<any>;
    rag: import("@trpc/server").Router<any>;
    chat: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: any;
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
        create: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: {
                message: string;
                conversationId?: string | undefined;
                priority?: "medium" | "low" | "high" | undefined;
            };
            _input_out: {
                message: string;
                priority: "medium" | "low" | "high";
                conversationId?: string | undefined;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            conversationId: any;
            response: any;
            metadata: any;
        }>;
        message: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
            response: any;
            metadata: any;
        }>;
        history: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: {
                conversationId: string;
            };
            _input_out: {
                conversationId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, any>;
        list: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
        delete: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: {
                conversationId: string;
            };
            _input_out: {
                conversationId: string;
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            title: any;
        }>;
        search: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
        }, any>;
        recent: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
        }, any>;
        stats: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, any>;
        export: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: {
                conversationId: string;
                format?: "json" | "markdown" | undefined;
            };
            _input_out: {
                conversationId: string;
                format: "json" | "markdown";
            };
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            data: any;
            format: "json" | "markdown";
            conversationId: string;
            timestamp: string;
        }>;
        exportAll: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
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
    }>;
    ws: import("@trpc/server").Router<any>;
    health: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: any;
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
        basic: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            status: string;
            timestamp: string;
            responseTime: number;
            services: {
                api: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                ollama: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                database: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
            };
        }>;
        detailed: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            status: "healthy" | "degraded" | "unhealthy";
            timestamp: string;
            uptime: number;
            version: string;
            environment: string;
            services: {
                api: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                ollama: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                chromadb: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                database: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                masterOrchestrator: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                agentRegistry: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
            };
            metrics: {
                memoryUsage: {
                    used: number;
                    total: number;
                    percentage: number;
                };
                cpuUsage: undefined;
                responseTime: number;
            };
            details: {
                ollama: any;
                chromadb: any;
                database: any;
                masterOrchestrator: any;
                agentRegistry: any;
            };
        }>;
        ready: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            ready: boolean;
            timestamp: string;
            responseTime: number;
            services: {
                ollama: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                database: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
                masterOrchestrator: "error" | "timeout" | "connected" | "disconnected" | "running" | "not_configured";
            };
        }>;
        live: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            alive: boolean;
            timestamp: string;
            uptime: number;
            responseTime: number;
            pid: number;
        }>;
    }>;
    dataCollection: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: any;
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
        initialize: import("@trpc/server").BuildProcedure<"mutation", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, {
            success: boolean;
            message: string;
        }>;
        getStats: import("@trpc/server").BuildProcedure<"query", {
            _config: import("@trpc/server").RootConfig<{
                ctx: any;
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
            }>;
            _meta: object;
            _ctx_out: any;
            _input_in: typeof import("@trpc/server").unsetMarker;
            _input_out: typeof import("@trpc/server").unsetMarker;
            _output_in: typeof import("@trpc/server").unsetMarker;
            _output_out: typeof import("@trpc/server").unsetMarker;
        }, import("../../core/data-collection/types").DataPipelineStats>;
        sources: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
            ctx: any;
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
            list: import("@trpc/server").BuildProcedure<"query", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: typeof import("@trpc/server").unsetMarker;
                _input_out: typeof import("@trpc/server").unsetMarker;
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, import("../../core/data-collection/types").DataSource[]>;
            create: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: {
                    name: string;
                    type: "web_scraping" | "search_engine" | "social_media" | "ecommerce" | "news";
                    config: {
                        url?: string | undefined;
                        keywords?: string[] | undefined;
                        filters?: Record<string, any> | undefined;
                        maxResults?: number | undefined;
                        frequency?: "hourly" | "daily" | "weekly" | "monthly" | undefined;
                        outputFormat?: "json" | "csv" | "markdown" | undefined;
                    };
                    status?: "active" | "inactive" | undefined;
                };
                _input_out: {
                    name: string;
                    type: "web_scraping" | "search_engine" | "social_media" | "ecommerce" | "news";
                    status: "active" | "inactive";
                    config: {
                        url?: string | undefined;
                        keywords?: string[] | undefined;
                        filters?: Record<string, any> | undefined;
                        maxResults?: number | undefined;
                        frequency?: "hourly" | "daily" | "weekly" | "monthly" | undefined;
                        outputFormat?: "json" | "csv" | "markdown" | undefined;
                    };
                };
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, {
                sourceId: string;
                message: string;
            }>;
            update: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: {
                    sourceId: string;
                    updates: {
                        name?: string | undefined;
                        type?: "web_scraping" | "search_engine" | "social_media" | "ecommerce" | "news" | undefined;
                        status?: "error" | "active" | "inactive" | undefined;
                        config?: {
                            url?: string | undefined;
                            keywords?: string[] | undefined;
                            filters?: Record<string, any> | undefined;
                            maxResults?: number | undefined;
                            frequency?: "hourly" | "daily" | "weekly" | "monthly" | undefined;
                            outputFormat?: "json" | "csv" | "markdown" | undefined;
                        } | undefined;
                    };
                };
                _input_out: {
                    sourceId: string;
                    updates: {
                        name?: string | undefined;
                        type?: "web_scraping" | "search_engine" | "social_media" | "ecommerce" | "news" | undefined;
                        status?: "error" | "active" | "inactive" | undefined;
                        config?: {
                            url?: string | undefined;
                            keywords?: string[] | undefined;
                            filters?: Record<string, any> | undefined;
                            maxResults?: number | undefined;
                            frequency?: "hourly" | "daily" | "weekly" | "monthly" | undefined;
                            outputFormat?: "json" | "csv" | "markdown" | undefined;
                        } | undefined;
                    };
                };
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, {
                success: boolean;
                message: string;
            }>;
            delete: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: {
                    sourceId: string;
                };
                _input_out: {
                    sourceId: string;
                };
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, {
                success: boolean;
                message: string;
            }>;
            collect: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: {
                    sourceId: string;
                };
                _input_out: {
                    sourceId: string;
                };
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, {
                jobId: string;
                message: string;
            }>;
        }>;
        jobs: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
            ctx: any;
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
            list: import("@trpc/server").BuildProcedure<"query", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: {
                    sourceId?: string | undefined;
                    limit?: number | undefined;
                    status?: "completed" | "failed" | "running" | "pending" | undefined;
                    offset?: number | undefined;
                };
                _input_out: {
                    limit: number;
                    offset: number;
                    sourceId?: string | undefined;
                    status?: "completed" | "failed" | "running" | "pending" | undefined;
                };
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, never[] | {
                jobs: import("../../core/data-collection/types").DataCollectionJob[];
                total: number;
                hasMore: boolean;
            }>;
            get: import("@trpc/server").BuildProcedure<"query", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: {
                    jobId: string;
                };
                _input_out: {
                    jobId: string;
                };
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, import("../../core/data-collection/types").DataCollectionJob>;
        }>;
        collect: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
            ctx: any;
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
            searchEngine: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: {
                    query: string;
                    engine?: "google" | "bing" | "yandex" | undefined;
                    language?: string | undefined;
                    maxResults?: number | undefined;
                    location?: string | undefined;
                };
                _input_out: {
                    query: string;
                    engine: "google" | "bing" | "yandex";
                    maxResults: number;
                    language?: string | undefined;
                    location?: string | undefined;
                };
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, {
                success: boolean;
                recordsCollected: number;
                message: string;
                data: never[];
            }>;
            webScraping: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
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
                recordsCollected: number;
                message: string;
                data: never[];
            }>;
        }>;
        control: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
            ctx: any;
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
            start: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: typeof import("@trpc/server").unsetMarker;
                _input_out: typeof import("@trpc/server").unsetMarker;
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, {
                success: boolean;
                message: string;
            }>;
            stop: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: typeof import("@trpc/server").unsetMarker;
                _input_out: typeof import("@trpc/server").unsetMarker;
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, {
                success: boolean;
                message: string;
            }>;
            runScheduled: import("@trpc/server").BuildProcedure<"mutation", {
                _config: import("@trpc/server").RootConfig<{
                    ctx: any;
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
                }>;
                _meta: object;
                _ctx_out: any;
                _input_in: typeof import("@trpc/server").unsetMarker;
                _input_out: typeof import("@trpc/server").unsetMarker;
                _output_in: typeof import("@trpc/server").unsetMarker;
                _output_out: typeof import("@trpc/server").unsetMarker;
            }, {
                success: boolean;
                message: string;
            }>;
        }>;
    }>;
}>;
export type AppRouter = typeof appRouter;
//# sourceMappingURL=router.d.ts.map