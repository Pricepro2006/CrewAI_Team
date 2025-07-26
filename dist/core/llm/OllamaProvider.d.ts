import { EventEmitter } from 'events';
export interface OllamaConfig {
    model: string;
    baseUrl?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTokens?: number;
    systemPrompt?: string;
    format?: 'json' | string;
    stream?: boolean;
    extractLogProbs?: boolean;
}
export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_duration?: number;
    eval_duration?: number;
    eval_count?: number;
    tokens?: string[];
    logprobs?: number[][];
    token_logprobs?: number[];
}
export interface OllamaGenerateOptions {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTokens?: number;
    systemPrompt?: string;
    format?: 'json' | string;
    context?: number[];
    extractLogProbs?: boolean;
}
export interface OllamaGenerateWithLogProbsResponse {
    text: string;
    tokens?: string[];
    logProbs?: number[];
    metadata?: {
        model: string;
        duration: number;
        tokenCount: number;
        tokensPerSecond?: number;
    };
}
export declare class OllamaProvider extends EventEmitter {
    private client;
    private config;
    private isInitialized;
    private context?;
    constructor(config: OllamaConfig);
    initialize(): Promise<void>;
    generate(prompt: string, options?: OllamaGenerateOptions): Promise<string>;
    /**
     * Generate text with log probabilities for confidence scoring
     * This method returns both the generated text and token-level confidence data
     */
    generateWithLogProbs(prompt: string, options?: OllamaGenerateOptions): Promise<OllamaGenerateWithLogProbsResponse>;
    private generateFallbackResponse;
    generateStream(prompt: string, options?: OllamaGenerateOptions, onChunk?: (chunk: string) => void): Promise<string>;
    embed(text: string): Promise<number[]>;
    listModels(): Promise<ModelInfo[]>;
    pullModel(modelName: string): Promise<void>;
    private buildPrompt;
    clearContext(): void;
    getContext(): number[] | undefined;
    setModel(model: string): void;
    getConfig(): OllamaConfig;
}
interface ModelInfo {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
}
export {};
//# sourceMappingURL=OllamaProvider.d.ts.map