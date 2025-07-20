import { RAGSystem } from "../../core/rag/RAGSystem";
export interface ChromaDBTestConfig {
    skipIfUnavailable?: boolean;
    chromaUrl?: string;
    collectionPrefix?: string;
}
export declare class ChromaDBTestHelper {
    private static instance?;
    private isAvailable?;
    static getInstance(): ChromaDBTestHelper;
    /**
     * Check if ChromaDB is available for testing
     */
    checkAvailability(url?: string): Promise<boolean>;
    /**
     * Create a test RAG system with proper ChromaDB configuration
     */
    createTestRAGSystem(config?: ChromaDBTestConfig): Promise<RAGSystem | null>;
    /**
     * Skip test if ChromaDB is not available
     */
    skipIfUnavailable(testName: string): Promise<boolean>;
    /**
     * Reset for new test session
     */
    reset(): void;
}
//# sourceMappingURL=chromadb-test-helper.d.ts.map