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
interface AppConfig {
    database: DatabaseConfig;
    api: ApiConfig;
}
declare const appConfig: AppConfig;
export default appConfig;
//# sourceMappingURL=app.config.d.ts.map