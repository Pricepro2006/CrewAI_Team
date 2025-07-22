import type { ProcessedDocument, QueryResult, Document, VectorStoreConfig } from './types';
import type { IVectorStore } from './IVectorStore';
export declare class MCPVectorizeStore implements IVectorStore {
    private config;
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
    performDeepResearch(query: string, useWebSearch?: boolean): Promise<any>;
}
//# sourceMappingURL=MCPVectorizeStore.d.ts.map