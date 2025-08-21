/**
 * Test Helper Functions
 */

export function createTestDatabase() {
  return {
    // Mock database implementation for testing
    query: async (sql: string, params?: any[]) => {
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
    ollamaUrl: 'http://localhost:8081',
    rag: {
      vectorStore: {
        type: 'chromadb' as const,
        path: './test-data/chroma-test',
        collectionName: 'test-collection',
        dimension: 384,
      },
      chunking: {
        size: 500,
        overlap: 50,
        method: 'sentence' as const,
      },
      retrieval: {
        topK: 5,
        minScore: 0.5,
        reranking: false,
      },
    },
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
