export interface OllamaConfig {
    baseUrl: string;
    defaultModel: string;
    timeout: number;
    maxRetries: number;
    models: {
        [key: string]: {
            name: string;
            description: string;
            contextWindow: number;
            temperature: number;
        };
    };
}
declare const ollamaConfig: OllamaConfig;
export default ollamaConfig;
//# sourceMappingURL=ollama.config.d.ts.map