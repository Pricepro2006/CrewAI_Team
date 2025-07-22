import type { Document, QueryResult, RAGConfig } from "./types";
export declare class RAGSystem {
    private config;
    private vectorStore;
    private documentProcessor;
    private embeddingService;
    private retrievalService;
    private isInitialized;
    constructor(config: RAGConfig);
    initialize(): Promise<void>;
    addDocument(content: string, metadata: Record<string, any>): Promise<void>;
    addDocuments(documents: Array<{
        content: string;
        metadata: Record<string, any>;
    }>): Promise<void>;
    search(query: string, limit?: number): Promise<QueryResult[]>;
    searchWithFilter(query: string, filter: Record<string, any>, limit?: number): Promise<QueryResult[]>;
    deleteDocument(documentId: string): Promise<void>;
    getDocument(documentId: string): Promise<Document | null>;
    getAllDocuments(limit?: number, offset?: number): Promise<Document[]>;
    getStats(): Promise<RAGStats>;
    clear(): Promise<void>;
    updateDocument(documentId: string, content: string, metadata?: Record<string, any>): Promise<void>;
    exportDocuments(format?: "json" | "csv"): Promise<string>;
    importDocuments(data: string, format?: "json" | "csv"): Promise<void>;
}
interface RAGStats {
    totalDocuments: number;
    totalChunks: number;
    collections: string[];
    averageChunksPerDocument: number;
    vectorStoreType: string;
    embeddingModel: string;
}
export {};
//# sourceMappingURL=RAGSystem.d.ts.map