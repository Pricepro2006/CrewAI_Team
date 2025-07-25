import type { EmbeddingConfig } from "./types";
export declare class EmbeddingService {
    private client;
    private config;
    private isInitialized;
    constructor(config: EmbeddingConfig);
    initialize(): Promise<void>;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
    private embedWithRetry;
    private delay;
    cosineSimilarity(embedding1: number[], embedding2: number[]): Promise<number>;
    findSimilar(queryEmbedding: number[], embeddings: number[][], topK?: number): Promise<Array<{
        index: number;
        score: number;
    }>>;
    getDimensions(): number;
    getModel(): string;
}
//# sourceMappingURL=EmbeddingService.d.ts.map