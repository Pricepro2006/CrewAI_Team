export declare const DEFAULT_TIMEOUTS: {
    LLM_GENERATION: number;
    AGENT_EXECUTION: number;
    TOOL_EXECUTION: number;
    API_REQUEST: number;
    CACHE_TTL: number;
};
interface DatabaseConfig {
    path: string;
}
interface ApiConfig {
    port: number;
    cors: {
        origin: string[] | string | boolean | ((origin: string | undefined, callback: (err: Error | null, origin?: boolean | string | RegExp | (boolean | string | RegExp)[]) => void) => void);
        credentials: boolean;
        optionsSuccessStatus?: number;
        methods?: string[];
        allowedHeaders?: string[];
    };
}
interface OllamaConfig {
    url: string;
    model?: string;
}
interface AppConfig {
    database: DatabaseConfig;
    api: ApiConfig;
    ollama?: OllamaConfig;
}
declare const appConfig: AppConfig;
export default appConfig;
//# sourceMappingURL=app.config.d.ts.map