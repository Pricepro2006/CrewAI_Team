import type { Document, QueryResult, VectorStoreConfig, ProcessedDocument } from "./types";
export declare class VectorStore {
    private client;
    private collection?;
    private embeddingService;
    private config;
    constructor(config: VectorStoreConfig);
    initialize(): Promise<void>;
    addDocuments(documents: ProcessedDocument[]): Promise<void>;
    search(query: string, limit?: number): Promise<QueryResult[]>;
    searchWithFilter(query: string, filter: Record<string, any>, limit?: number): Promise<QueryResult[]>;
    getDocument(documentId: string): Promise<Document | null>;
    deleteBySourceId(sourceId: string): Promise<void>;
    getAllDocuments(limit?: number, offset?: number): Promise<Document[]>;
    getDocumentCount(): Promise<number>;
    getChunkCount(): Promise<number>;
    getCollections(): Promise<string[]>;
    clear(): Promise<void>;
    private formatResults;
    private buildWhereClause;
}
//# sourceMappingURL=VectorStore.d.ts.map