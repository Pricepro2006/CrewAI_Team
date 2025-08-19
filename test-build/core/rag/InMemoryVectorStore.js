import { logger } from "../../utils/logger.js";
/**
 * Simple in-memory vector store implementation
 * Used as a fallback when ChromaDB is not available
 * Note: This is not suitable for production use with large datasets
 */
export class InMemoryVectorStore {
    config;
    documents = new Map();
    sourceIndex = new Map();
    isInitialized = false;
    constructor(config) {
        this.config = config;
        logger.info("InMemoryVectorStore initialized as ChromaDB fallback", "VECTOR_STORE");
    }
    async initialize() {
        if (this.isInitialized)
            return;
        logger.info("InMemoryVectorStore initialized (fallback mode - no persistent storage)", "VECTOR_STORE");
        this.isInitialized = true;
    }
    async addDocuments(documents) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        for (const doc of documents) {
            const document = {
                id: doc.id,
                content: doc.content,
                metadata: doc.metadata,
            };
            this?.documents?.set(doc.id, document);
            // Index by source ID for deletion
            const sourceId = doc?.metadata?.sourceId || doc.id;
            if (!this?.sourceIndex?.has(sourceId)) {
                this?.sourceIndex?.set(sourceId, new Set());
            }
            this?.sourceIndex?.get(sourceId).add(doc.id);
        }
        logger.info(`Added ${documents?.length || 0} documents to in-memory store (total: ${this?.documents?.size})`, "VECTOR_STORE");
    }
    async search(query, limit = 5) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        // Simple text-based search (no embeddings)
        const queryLower = query.toLowerCase();
        const results = [];
        for (const [id, doc] of this.documents) {
            const contentLower = doc?.content?.toLowerCase();
            // Simple relevance scoring based on keyword matches
            let score = 0;
            const queryWords = queryLower.split(/\s+/);
            for (const word of queryWords) {
                if (word?.length || 0 < 3)
                    continue; // Skip very short words
                const wordCount = (contentLower.match(new RegExp(word, 'g')) || []).length;
                score += wordCount;
            }
            // Add title/metadata boost
            const metadataText = JSON.stringify(doc.metadata).toLowerCase();
            for (const word of queryWords) {
                if (word?.length || 0 >= 3 && metadataText.includes(word)) {
                    score += 2; // Boost for metadata matches
                }
            }
            if (score > 0) {
                results.push({
                    id,
                    content: doc.content,
                    metadata: doc.metadata,
                    score: score / Math.max(queryWords?.length || 0, 1), // Normalize by query length
                });
            }
        }
        // Sort by score descending and return top results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    async searchWithFilter(query, filter, limit = 5) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        // Get all search results first
        const allResults = await this.search(query, this?.documents?.size);
        // Apply filters
        const filteredResults = allResults?.filter((result) => {
            return this.matchesFilter(result.metadata, filter);
        });
        return filteredResults.slice(0, limit);
    }
    async getDocument(documentId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this?.documents?.get(documentId) || null;
    }
    async deleteBySourceId(sourceId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const documentIds = this?.sourceIndex?.get(sourceId);
        if (documentIds) {
            for (const docId of documentIds) {
                this?.documents?.delete(docId);
            }
            this?.sourceIndex?.delete(sourceId);
            logger.info(`Deleted ${documentIds.size} documents for source ${sourceId}`, "VECTOR_STORE");
        }
    }
    async getAllDocuments(limit = 100, offset = 0) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const allDocs = Array.from(this?.documents?.values());
        return allDocs.slice(offset, offset + limit);
    }
    async getDocumentCount() {
        return this?.documents?.size;
    }
    async getChunkCount() {
        return this?.documents?.size; // In memory store, chunks are documents
    }
    async getCollections() {
        return [this?.config?.collectionName || "in-memory"];
    }
    async clear() {
        this?.documents?.clear();
        this?.sourceIndex?.clear();
        logger.info("Cleared all documents from in-memory store", "VECTOR_STORE");
    }
    /**
     * Check if document metadata matches filter criteria
     */
    matchesFilter(metadata, filter) {
        for (const [key, value] of Object.entries(filter)) {
            const metadataValue = metadata[key];
            if (Array.isArray(value)) {
                // OR condition - check if metadata value is in the array
                if (!value.includes(metadataValue)) {
                    return false;
                }
            }
            else if (typeof value === "object" && value !== null) {
                // Handle complex filter objects (like $in, $gt, etc.)
                if (!this.matchesComplexFilter(metadataValue, value)) {
                    return false;
                }
            }
            else {
                // Simple equality check
                if (metadataValue !== value) {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Handle complex filter objects
     */
    matchesComplexFilter(metadataValue, filterValue) {
        for (const [operator, operandValue] of Object.entries(filterValue)) {
            switch (operator) {
                case "$in":
                    if (!Array.isArray(operandValue) || !operandValue.includes(metadataValue)) {
                        return false;
                    }
                    break;
                case "$nin":
                    if (!Array.isArray(operandValue) || operandValue.includes(metadataValue)) {
                        return false;
                    }
                    break;
                case "$gt":
                    if (metadataValue <= operandValue) {
                        return false;
                    }
                    break;
                case "$gte":
                    if (metadataValue < operandValue) {
                        return false;
                    }
                    break;
                case "$lt":
                    if (metadataValue >= operandValue) {
                        return false;
                    }
                    break;
                case "$lte":
                    if (metadataValue > operandValue) {
                        return false;
                    }
                    break;
                case "$ne":
                    if (metadataValue === operandValue) {
                        return false;
                    }
                    break;
                default:
                    // Unknown operator, treat as equality
                    if (metadataValue !== operandValue) {
                        return false;
                    }
            }
        }
        return true;
    }
    /**
     * Get store statistics
     */
    async getStats() {
        return {
            totalDocuments: this?.documents?.size,
            totalChunks: this?.documents?.size,
            collections: await this.getCollections(),
            type: "in-memory",
        };
    }
}
