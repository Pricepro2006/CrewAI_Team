export declare const chatRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
//# sourceMappingURL=chat.router.d.ts.map