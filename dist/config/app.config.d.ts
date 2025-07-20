interface DatabaseConfig {
    path: string;
}
interface ApiConfig {
    port: number;
    cors: {
        origin: string[];
        credentials: boolean;
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