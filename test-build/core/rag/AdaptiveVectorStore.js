import { VectorStore } from "./VectorStore.js";
import { InMemoryVectorStore } from "./InMemoryVectorStore.js";
import { logger } from "../../utils/logger.js";
/**
 * Adaptive vector store that falls back to in-memory storage when ChromaDB fails
 * This ensures the system continues to work even when ChromaDB is not available
 */
export class AdaptiveVectorStore {
    config;
    store;
    fallbackUsed = false;
    constructor(config) {
        this.config = config;
        // Start with ChromaDB attempt
        this.store = new VectorStore(config);
    }
    async initialize() {
        try {
            await this?.store?.initialize();
            logger.info("ChromaDB vector store initialized successfully", "ADAPTIVE_VECTOR_STORE");
        }
        catch (error) {
            logger.warn(`ChromaDB initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to in-memory storage.`, "ADAPTIVE_VECTOR_STORE");
            // Switch to in-memory fallback
            this.store = new InMemoryVectorStore(this.config);
            await this?.store?.initialize();
            this.fallbackUsed = true;
            logger.info("In-memory vector store fallback initialized", "ADAPTIVE_VECTOR_STORE");
        }
    }
    async addDocuments(documents) {
        try {
            await this?.store?.addDocuments(documents);
        }
        catch (error) {
            if (!this.fallbackUsed) {
                logger.warn(`ChromaDB operation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Switching to in-memory fallback.`, "ADAPTIVE_VECTOR_STORE");
                await this.switchToFallback();
                await this?.store?.addDocuments(documents);
            }
            else {
                throw error; // Re-throw if already using fallback
            }
        }
    }
    async search(query, limit) {
        try {
            return await this?.store?.search(query, limit);
        }
        catch (error) {
            if (!this.fallbackUsed) {
                logger.warn(`ChromaDB search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Switching to in-memory fallback.`, "ADAPTIVE_VECTOR_STORE");
                await this.switchToFallback();
                return await this?.store?.search(query, limit);
            }
            else {
                throw error; // Re-throw if already using fallback
            }
        }
    }
    async searchWithFilter(query, filter, limit) {
        try {
            return await this?.store?.searchWithFilter(query, filter, limit);
        }
        catch (error) {
            if (!this.fallbackUsed) {
                logger.warn(`ChromaDB filtered search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Switching to in-memory fallback.`, "ADAPTIVE_VECTOR_STORE");
                await this.switchToFallback();
                return await this?.store?.searchWithFilter(query, filter, limit);
            }
            else {
                throw error; // Re-throw if already using fallback
            }
        }
    }
    async getDocument(documentId) {
        try {
            return await this?.store?.getDocument(documentId);
        }
        catch (error) {
            if (!this.fallbackUsed) {
                logger.warn(`ChromaDB getDocument failed: ${error instanceof Error ? error.message : 'Unknown error'}. Switching to in-memory fallback.`, "ADAPTIVE_VECTOR_STORE");
                await this.switchToFallback();
                return await this?.store?.getDocument(documentId);
            }
            else {
                throw error; // Re-throw if already using fallback
            }
        }
    }
    async deleteBySourceId(sourceId) {
        try {
            await this?.store?.deleteBySourceId(sourceId);
        }
        catch (error) {
            if (!this.fallbackUsed) {
                logger.warn(`ChromaDB deleteBySourceId failed: ${error instanceof Error ? error.message : 'Unknown error'}. Switching to in-memory fallback.`, "ADAPTIVE_VECTOR_STORE");
                await this.switchToFallback();
                await this?.store?.deleteBySourceId(sourceId);
            }
            else {
                throw error; // Re-throw if already using fallback
            }
        }
    }
    async getAllDocuments(limit, offset) {
        try {
            return await this?.store?.getAllDocuments(limit, offset);
        }
        catch (error) {
            if (!this.fallbackUsed) {
                logger.warn(`ChromaDB getAllDocuments failed: ${error instanceof Error ? error.message : 'Unknown error'}. Switching to in-memory fallback.`, "ADAPTIVE_VECTOR_STORE");
                await this.switchToFallback();
                return await this?.store?.getAllDocuments(limit, offset);
            }
            else {
                throw error; // Re-throw if already using fallback
            }
        }
    }
    /**
     * Switch to in-memory fallback store
     */
    async switchToFallback() {
        if (this.fallbackUsed)
            return;
        // Try to preserve existing data if possible
        let existingDocuments = [];
        try {
            existingDocuments = await this?.store?.getAllDocuments(10000); // Get up to 10k docs
        }
        catch (error) {
            logger.warn("Could not retrieve existing documents during fallback switch", "ADAPTIVE_VECTOR_STORE");
        }
        // Create new in-memory store
        this.store = new InMemoryVectorStore(this.config);
        await this?.store?.initialize();
        this.fallbackUsed = true;
        // Restore documents if we managed to retrieve them
        if ((existingDocuments?.length || 0) > 0) {
            logger.info(`Restoring ${existingDocuments?.length || 0} documents to in-memory fallback`, "ADAPTIVE_VECTOR_STORE");
            const processedDocs = existingDocuments?.map(doc => ({
                id: doc.id,
                content: doc.content,
                metadata: doc.metadata,
            }));
            try {
                await this?.store?.addDocuments(processedDocs);
                logger.info("Successfully restored documents to in-memory fallback", "ADAPTIVE_VECTOR_STORE");
            }
            catch (error) {
                logger.error("Failed to restore documents to in-memory fallback", "ADAPTIVE_VECTOR_STORE", { error });
            }
        }
    }
    /**
     * Check if the store is using fallback mode
     */
    isFallbackMode() {
        return this.fallbackUsed;
    }
    /**
     * Get information about the current store type
     */
    getStoreInfo() {
        return {
            type: this.fallbackUsed ? "in-memory" : "chromadb",
            fallbackUsed: this.fallbackUsed,
        };
    }
    /**
     * Health check for the vector store
     */
    async healthCheck() {
        const storeInfo = this.getStoreInfo();
        try {
            // Try a simple operation to verify the store is working
            await this.getAllDocuments(1);
            return {
                status: this.fallbackUsed ? "degraded" : "healthy",
                type: storeInfo.type,
                fallbackUsed: storeInfo.fallbackUsed,
                message: this.fallbackUsed
                    ? "Using in-memory fallback - ChromaDB unavailable"
                    : "ChromaDB operational",
            };
        }
        catch (error) {
            return {
                status: "error",
                type: storeInfo.type,
                fallbackUsed: storeInfo.fallbackUsed,
                message: `Vector store error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }
}
