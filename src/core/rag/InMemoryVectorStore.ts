import type { IVectorStore } from "./IVectorStore.js";
import type { ProcessedDocument, QueryResult, Document, VectorStoreConfig } from "./types.js";
import { logger } from "../../utils/logger.js";

/**
 * Simple in-memory vector store implementation
 * Used as a fallback when ChromaDB is not available
 * Note: This is not suitable for production use with large datasets
 */
export class InMemoryVectorStore implements IVectorStore {
  private documents: Map<string, Document> = new Map();
  private sourceIndex: Map<string, Set<string>> = new Map();
  private isInitialized: boolean = false;

  constructor(private config: VectorStoreConfig) {
    logger.info(
      "InMemoryVectorStore initialized as ChromaDB fallback",
      "VECTOR_STORE"
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info(
      "InMemoryVectorStore initialized (fallback mode - no persistent storage)",
      "VECTOR_STORE"
    );
    this.isInitialized = true;
  }

  async addDocuments(documents: ProcessedDocument[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    for (const doc of documents) {
      const document: Document = {
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
      };

      this.documents.set(doc.id, document);

      // Index by source ID for deletion
      const sourceId = doc?.metadata?.sourceId || doc.id;
      if (!this.sourceIndex.has(sourceId)) {
        this.sourceIndex.set(sourceId, new Set());
      }
      this.sourceIndex.get(sourceId)!.add(doc.id);
    }

    logger.info(
      `Added ${documents?.length ?? 0} documents to in-memory store (total: ${this.documents.size})`,
      "VECTOR_STORE"
    );
  }

  async search(query: string, limit: number = 5): Promise<QueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Simple text-based search (no embeddings)
    const queryLower = query.toLowerCase();
    const results: QueryResult[] = [];

    for (const [id, doc] of Array.from(this.documents)) {
      const contentLower = doc?.content?.toLowerCase() ?? '';
      
      // Simple relevance scoring based on keyword matches
      let score = 0;
      const queryWords = queryLower.split(/\s+/);
      
      for (const word of queryWords) {
        const wordLength = word?.length ?? 0;
        if (wordLength < 3) continue; // Skip very short words
        
        const wordCount = (contentLower.match(new RegExp(word, 'g')) || []).length;
        score += wordCount;
      }

      // Add title/metadata boost
      const metadataText = JSON.stringify(doc.metadata).toLowerCase();
      for (const word of queryWords) {
        const wordLength = word?.length ?? 0;
        if (wordLength >= 3 && metadataText.includes(word)) {
          score += 2; // Boost for metadata matches
        }
      }

      if (score > 0) {
        results.push({
          id,
          content: doc.content,
          metadata: doc.metadata,
          score: score / Math.max(queryWords?.length ?? 1, 1), // Normalize by query length
        });
      }
    }

    // Sort by score descending and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async searchWithFilter(
    query: string,
    filter: Record<string, any>,
    limit: number = 5
  ): Promise<QueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Get all search results first
    const allResults = await this.search(query, this.documents.size);

    // Apply filters
    const filteredResults = allResults?.filter((result: any) => {
      return this.matchesFilter(result.metadata, filter);
    });

    return filteredResults.slice(0, limit);
  }

  async getDocument(documentId: string): Promise<Document | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.documents.get(documentId) || null;
  }

  async deleteBySourceId(sourceId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const documentIds = this.sourceIndex.get(sourceId);
    if (documentIds) {
      for (const docId of Array.from(documentIds)) {
        this.documents.delete(docId);
      }
      this.sourceIndex.delete(sourceId);
      
      logger.info(
        `Deleted ${documentIds.size} documents for source ${sourceId}`,
        "VECTOR_STORE"
      );
    }
  }

  async getAllDocuments(limit: number = 100, offset: number = 0): Promise<Document[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const allDocs = Array.from(this.documents.values());
    return allDocs.slice(offset, offset + limit);
  }

  async getDocumentCount(): Promise<number> {
    return this.documents.size;
  }

  async getChunkCount(): Promise<number> {
    return this.documents.size; // In memory store, chunks are documents
  }

  async getCollections(): Promise<string[]> {
    return [this.config.collectionName || "in-memory"];
  }

  async clear(): Promise<void> {
    this.documents.clear();
    this.sourceIndex.clear();
    logger.info("Cleared all documents from in-memory store", "VECTOR_STORE");
  }

  /**
   * Check if document metadata matches filter criteria
   */
  private matchesFilter(metadata: Record<string, any>, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const metadataValue = metadata[key];
      
      if (Array.isArray(value)) {
        // OR condition - check if metadata value is in the array
        if (!value.includes(metadataValue)) {
          return false;
        }
      } else if (typeof value === "object" && value !== null) {
        // Handle complex filter objects (like $in, $gt, etc.)
        if (!this.matchesComplexFilter(metadataValue, value)) {
          return false;
        }
      } else {
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
  private matchesComplexFilter(metadataValue: any, filterValue: Record<string, any>): boolean {
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
  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    collections: string[];
    type: string;
  }> {
    return {
      totalDocuments: this.documents.size,
      totalChunks: this.documents.size,
      collections: await this.getCollections(),
      type: "in-memory",
    };
  }
}