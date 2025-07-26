import { VectorStore } from "./VectorStore";
import { DocumentProcessor } from "./DocumentProcessor";
import { EmbeddingService } from "./EmbeddingService";
import { RetrievalService } from "./RetrievalService";
export class RAGSystem {
    config;
    vectorStore;
    documentProcessor;
    embeddingService;
    retrievalService;
    isInitialized = false;
    constructor(config) {
        this.config = config;
        this.vectorStore = new VectorStore(config.vectorStore);
        this.documentProcessor = new DocumentProcessor(config.chunking);
        this.embeddingService = new EmbeddingService({
            model: "nomic-embed-text",
            baseUrl: config.vectorStore.baseUrl || "http://localhost:11434",
        });
        this.retrievalService = new RetrievalService(config.retrieval);
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            // Initialize vector store and embedding service with individual error handling
            const vectorStorePromise = this.vectorStore
                .initialize()
                .catch((error) => {
                console.warn("Vector store initialization failed:", error.message);
                return null; // Continue without vector store
            });
            const embeddingPromise = this.embeddingService
                .initialize()
                .catch((error) => {
                console.warn("Embedding service initialization failed:", error.message);
                return null; // Continue without embeddings
            });
            await Promise.all([vectorStorePromise, embeddingPromise]);
            this.isInitialized = true;
        }
        catch (error) {
            console.warn("RAG system initialization failed:", error.message);
            // Mark as initialized even if vector store fails (graceful degradation)
            this.isInitialized = true;
            throw error; // Re-throw so orchestrator can handle gracefully
        }
    }
    async addDocument(content, metadata) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        // Process document into chunks
        const processedDocs = await this.documentProcessor.processDocument(content, {
            sourceId: metadata["id"] || `doc-${Date.now()}`,
            ...metadata,
        });
        // Add to vector store
        await this.vectorStore.addDocuments(processedDocs);
    }
    async addDocuments(documents) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const allProcessedDocs = [];
        for (const doc of documents) {
            const processed = await this.documentProcessor.processDocument(doc.content, {
                sourceId: doc.metadata["id"] || `doc-${Date.now()}-${Math.random()}`,
                ...doc.metadata,
            });
            allProcessedDocs.push(...processed);
        }
        await this.vectorStore.addDocuments(allProcessedDocs);
    }
    async search(query, limit = 5) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        // Get initial results from vector store
        const vectorResults = await this.vectorStore.search(query, limit * 2);
        // Apply retrieval enhancements (reranking, filtering)
        const enhancedResults = await this.retrievalService.enhance(query, vectorResults);
        // Return top results
        return enhancedResults.slice(0, limit);
    }
    async searchWithFilter(query, filter, limit = 5) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const vectorResults = await this.vectorStore.searchWithFilter(query, filter, limit * 2);
        const enhancedResults = await this.retrievalService.enhance(query, vectorResults);
        return enhancedResults.slice(0, limit);
    }
    async deleteDocument(documentId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        await this.vectorStore.deleteBySourceId(documentId);
    }
    async getDocument(documentId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return await this.vectorStore.getDocument(documentId);
    }
    async getAllDocuments(limit = 100, offset = 0) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return await this.vectorStore.getAllDocuments(limit, offset);
    }
    async getStats() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const totalDocuments = await this.vectorStore.getDocumentCount();
        const totalChunks = await this.vectorStore.getChunkCount();
        const collections = await this.vectorStore.getCollections();
        return {
            totalDocuments,
            totalChunks,
            collections,
            averageChunksPerDocument: totalDocuments > 0 ? Math.round(totalChunks / totalDocuments) : 0,
            vectorStoreType: this.config.vectorStore.type,
            embeddingModel: "nomic-embed-text",
        };
    }
    async clear() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        await this.vectorStore.clear();
    }
    async updateDocument(documentId, content, metadata) {
        // Delete old document
        await this.deleteDocument(documentId);
        // Add updated document
        await this.addDocument(content, {
            id: documentId,
            ...metadata,
            updatedAt: new Date().toISOString(),
        });
    }
    async exportDocuments(format = "json") {
        const documents = await this.getAllDocuments(10000);
        if (format === "json") {
            return JSON.stringify(documents, null, 2);
        }
        else {
            // Simple CSV export
            const headers = ["id", "content", "metadata"];
            const rows = documents.map((doc) => [
                doc.id,
                doc.content.replace(/"/g, '""'),
                JSON.stringify(doc.metadata).replace(/"/g, '""'),
            ]);
            return [
                headers.join(","),
                ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
            ].join("\n");
        }
    }
    async importDocuments(data, format = "json") {
        let documents;
        if (format === "json") {
            documents = JSON.parse(data);
        }
        else {
            // Simple CSV parsing
            const lines = data.split("\n");
            const headers = lines[0]?.split(",").map((h) => h.trim().replace(/"/g, "")) || [];
            documents = lines.slice(1).map((line) => {
                const values = line.match(/(".*?"|[^,]+)/g) || [];
                const cleaned = values.map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
                return {
                    content: cleaned[1] || "",
                    metadata: {
                        id: cleaned[0],
                        ...JSON.parse(cleaned[2] || "{}"),
                    },
                };
            });
        }
        await this.addDocuments(documents);
    }
}
//# sourceMappingURL=RAGSystem.js.map