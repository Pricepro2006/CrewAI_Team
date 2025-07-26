import type { ProcessedDocument, QueryResult, Document, VectorStoreConfig } from './types';
import type { IVectorStore } from './IVectorStore';
export declare class PineconeVectorStore implements IVectorStore {
    private config;
    private client;
    private index;
    private initialized;
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
    clear(): Promise<void>;
    private generateEmbedding;
}
//# sourceMappingURL=PineconeVectorStore.d.ts.map