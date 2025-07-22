/**
 * Test Helper Functions
 */
export declare function createTestDatabase(): {
    query: (sql: string, params?: any[]) => Promise<{
        rows: never[];
        rowCount: number;
    }>;
    close: () => Promise<void>;
};
export declare function createMockConfig(): {
    model: string;
    ollamaUrl: string;
    rag: {
        vectorStore: {
            type: "chromadb";
            path: string;
            collectionName: string;
            dimension: number;
        };
        chunking: {
            size: number;
            overlap: number;
            method: "sentence";
        };
        retrieval: {
            topK: number;
            minScore: number;
            reranking: boolean;
        };
    };
};
export declare function delay(ms: number): Promise<void>;
//# sourceMappingURL=test-helpers.d.ts.map