/**
 * Test Helper Functions
 */
export function createTestDatabase() {
    return {
        // Mock database implementation for testing
        query: async (sql, params) => {
            return { rows: [], rowCount: 0 };
        },
        close: async () => {
            // Mock database closed
        }
    };
}
export function createMockConfig() {
    return {
        model: 'phi3:mini',
        ollamaUrl: 'http://localhost:11434',
        rag: {
            vectorStore: {
                type: 'chromadb',
                path: './test-data/chroma-test',
                collectionName: 'test-collection',
                dimension: 384,
            },
            chunking: {
                size: 500,
                overlap: 50,
                method: 'sentence',
            },
            retrieval: {
                topK: 5,
                minScore: 0.5,
                reranking: false,
            },
        },
    };
}
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=test-helpers.js.map