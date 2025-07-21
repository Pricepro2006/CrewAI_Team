import { RAGSystem } from "../../core/rag/RAGSystem.js";
export class ChromaDBTestHelper {
    static instance;
    isAvailable;
    static getInstance() {
        if (!ChromaDBTestHelper.instance) {
            ChromaDBTestHelper.instance = new ChromaDBTestHelper();
        }
        return ChromaDBTestHelper.instance;
    }
    /**
     * Check if ChromaDB is available for testing
     */
    async checkAvailability(url = "http://localhost:8001") {
        if (this.isAvailable !== undefined) {
            return this.isAvailable;
        }
        try {
            const response = await fetch(`${url}/api/v2/version`, {
                method: "GET",
                signal: AbortSignal.timeout(2000), // 2 second timeout
            });
            this.isAvailable = response.ok;
        }
        catch (error) {
            console.warn(`ChromaDB not available at ${url}:`, error instanceof Error ? error.message : "Unknown error");
            this.isAvailable = false;
        }
        return this.isAvailable;
    }
    /**
     * Create a test RAG system with proper ChromaDB configuration
     */
    async createTestRAGSystem(config = {}) {
        const chromaUrl = config.chromaUrl || "http://localhost:8001";
        const available = await this.checkAvailability(chromaUrl);
        if (!available) {
            if (config.skipIfUnavailable) {
                console.log("Skipping ChromaDB tests - server not available");
                return null;
            }
            throw new Error(`ChromaDB test server not available at ${chromaUrl}. Start with: docker-compose -f docker-compose.test.yml up -d`);
        }
        const collectionName = `${config.collectionPrefix || "test"}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const ragConfig = {
            vectorStore: {
                type: "chromadb",
                collectionName,
                path: chromaUrl,
            },
            chunking: {
                size: 500,
                overlap: 50,
            },
            retrieval: {
                topK: 5,
                minScore: 0.1,
            },
        };
        return new RAGSystem(ragConfig);
    }
    /**
     * Skip test if ChromaDB is not available
     */
    async skipIfUnavailable(testName) {
        const available = await this.checkAvailability();
        if (!available) {
            console.log(`SKIP: ${testName} - ChromaDB server not available`);
            return true;
        }
        return false;
    }
    /**
     * Reset for new test session
     */
    reset() {
        this.isAvailable = undefined;
    }
}
//# sourceMappingURL=chromadb-test-helper.js.map