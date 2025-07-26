export declare const dataCollectionRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
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
    searchEngine: import("@trpc/server").BuildProcedure<"mutation", {
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
            engine?: "google" | "bing" | "yandex" | undefined;
            language?: string | undefined;
            location?: string | undefined;
            cursor?: string | undefined;
            maxResults?: number | undefined;
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
        success: boolean;
        data: import("../../core/data-collection/types").DataPipelineStats;
        timestamp: string;
    }>;
    health: import("@trpc/server").BuildProcedure<"query", {
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
//# sourceMappingURL=data-collection.router.d.ts.map