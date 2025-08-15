/**
 * Resilient Vector Store with advanced retry logic and automatic fallback
 * Provides seamless operation even when ChromaDB is unavailable
 */

import type { IVectorStore } from "./IVectorStore.js";
import type { ProcessedDocument, QueryResult, Document, VectorStoreConfig } from "./types.js";
import { ResilientChromaDBManager, StorageMode } from "../../database/vector/ResilientChromaDBManager.js";
import { logger } from "../../utils/logger.js";
import { EmbeddingService } from "./EmbeddingService.js";
import { MODEL_CONFIG } from "../../config/models.config.js";

export class ResilientVectorStore implements IVectorStore {
  private manager: ResilientChromaDBManager;
  private embeddingService: EmbeddingService;
  private config: VectorStoreConfig;
  private isInitialized: boolean = false;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    
    // Initialize resilient manager
    this.manager = new ResilientChromaDBManager({
      chromadb: {
        host: this.extractHost(config.path || "http://localhost:8001"),
        port: this.extractPort(config.path || "http://localhost:8001"),
        ssl: (config.path || "").startsWith("https"),
      },
      connectionManager: {
        maxRetries: 5,
        initialRetryDelay: 1000,
        maxRetryDelay: 30000,
        healthCheckInterval: 300000, // 5 minutes
      },
      fallback: {
        enabled: true,
        preserveDataOnSwitch: true,
        maxInMemoryDocuments: 10000,
        syncInterval: 60000, // 1 minute
      },
    });

    // Initialize embedding service
    this.embeddingService = new EmbeddingService({
      model: MODEL_CONFIG?.models?.embedding,
      baseUrl: config.baseUrl || "http://localhost:11434",
    });
  }

  /**
   * Extract host from URL
   */
  private extractHost(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return "localhost";
    }
  }

  /**
   * Extract port from URL
   */
  private extractPort(url: string): number {
    try {
      const parsed = new URL(url);
      return parseInt(parsed.port) || (parsed.protocol === "https:" ? 443 : 8001);
    } catch {
      return 8001;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this?.manager?.initialize();
      this.isInitialized = true;
      
      const status = await this?.manager?.getHealthStatus();
      logger.info(
        `ResilientVectorStore initialized - Mode: ${status.mode}, Message: ${status.message}`,
        "RESILIENT_VECTOR_STORE"
      );
    } catch (error) {
      logger.error(
        `Failed to initialize ResilientVectorStore: ${error}`,
        "RESILIENT_VECTOR_STORE"
      );
      throw error;
    }
  }

  async addDocuments(documents: ProcessedDocument[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (documents?.length || 0 === 0) return;

    try {
      // Generate embeddings if we're in ChromaDB mode
      const mode = this?.manager?.getStorageMode();
      let embeddings: number[][] | undefined;
      
      if (mode === StorageMode.CHROMADB) {
        try {
          embeddings = await this?.embeddingService?.embedBatch(
            documents?.map(d => d.content)
          );
        } catch (error) {
          logger.warn(
            `Failed to generate embeddings, proceeding without: ${error}`,
            "RESILIENT_VECTOR_STORE"
          );
        }
      }

      // Convert to ChromaDocument format
      const chromaDocs = documents?.map(doc => ({
        id: doc.id,
        content: doc.content,
        metadata: {
          ...doc.metadata,
          indexed_at: new Date().toISOString(),
          content_length: doc?.content?.length,
        },
      }));

      await this?.manager?.addDocuments(
        this?.config?.collectionName || "knowledge_base",
        chromaDocs,
        embeddings
      );

      logger.info(
        `Added ${documents?.length || 0} documents to resilient store`,
        "RESILIENT_VECTOR_STORE"
      );
    } catch (error) {
      logger.error(
        `Failed to add documents: ${error}`,
        "RESILIENT_VECTOR_STORE"
      );
      throw error;
    }
  }

  async search(query: string, limit: number = 5): Promise<QueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate query embedding if in ChromaDB mode
      const mode = this?.manager?.getStorageMode();
      
      if (mode === StorageMode.CHROMADB) {
        try {
          const queryEmbedding = await this?.embeddingService?.embed(query);
          
          const results = await this?.manager?.queryDocuments(
            this?.config?.collectionName || "knowledge_base",
            queryEmbedding,
            { nResults: limit }
          );

          return results?.map(r => ({
            id: r.id,
            content: r.content,
            metadata: r.metadata,
            score: r.similarity,
          }));
        } catch (error) {
          logger.warn(
            `ChromaDB search failed, falling back to text search: ${error}`,
            "RESILIENT_VECTOR_STORE"
          );
        }
      }

      // Fallback to text-based search (in-memory mode)
      const results = await this?.manager?.queryDocuments(
        this?.config?.collectionName || "knowledge_base",
        [], // Empty embedding for text search
        { nResults: limit }
      );

      return results?.map(r => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        score: r.similarity,
      }));
    } catch (error) {
      logger.error(
        `Search failed: ${error}`,
        "RESILIENT_VECTOR_STORE"
      );
      throw error;
    }
  }

  async searchWithFilter(
    query: string,
    filter: Record<string, any>,
    limit: number = 5
  ): Promise<QueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const mode = this?.manager?.getStorageMode();
      
      if (mode === StorageMode.CHROMADB) {
        try {
          const queryEmbedding = await this?.embeddingService?.embed(query);
          
          const results = await this?.manager?.queryDocuments(
            this?.config?.collectionName || "knowledge_base",
            queryEmbedding,
            { nResults: limit, where: filter }
          );

          return results?.map(r => ({
            id: r.id,
            content: r.content,
            metadata: r.metadata,
            score: r.similarity,
          }));
        } catch (error) {
          logger.warn(
            `Filtered search failed: ${error}`,
            "RESILIENT_VECTOR_STORE"
          );
        }
      }

      // Fallback to basic search without filter
      return this.search(query, limit);
    } catch (error) {
      logger.error(
        `Filtered search failed: ${error}`,
        "RESILIENT_VECTOR_STORE"
      );
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<Document | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // This would need implementation in the manager
    // For now, return null as a placeholder
    logger.warn(
      "getDocument not fully implemented in resilient store",
      "RESILIENT_VECTOR_STORE"
    );
    return null;
  }

  async deleteBySourceId(sourceId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // This would need implementation in the manager
    logger.warn(
      "deleteBySourceId not fully implemented in resilient store",
      "RESILIENT_VECTOR_STORE"
    );
  }

  async getAllDocuments(limit: number = 100, offset: number = 0): Promise<Document[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // This would need implementation in the manager
    logger.warn(
      "getAllDocuments not fully implemented in resilient store",
      "RESILIENT_VECTOR_STORE"
    );
    return [];
  }

  async getDocumentCount(): Promise<number> {
    const status = await this?.manager?.getHealthStatus();
    return status?.inMemory?.documentCount;
  }

  async getChunkCount(): Promise<number> {
    const status = await this?.manager?.getHealthStatus();
    return status?.inMemory?.documentCount; // Same as document count for now
  }

  async getCollections(): Promise<string[]> {
    return [this?.config?.collectionName || "knowledge_base"];
  }

  async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // This would need implementation in the manager
    logger.warn(
      "clear not fully implemented in resilient store",
      "RESILIENT_VECTOR_STORE"
    );
  }

  /**
   * Get health status of the resilient store
   */
  async getHealthStatus(): Promise<{
    status: "healthy" | "degraded" | "error";
    mode: StorageMode;
    message: string;
    details: any;
  }> {
    const health = await this?.manager?.getHealthStatus();
    
    return {
      status: health.status,
      mode: health.mode,
      message: health.message,
      details: {
        chromadb: health.chromadb,
        inMemory: health.inMemory,
      },
    };
  }

  /**
   * Force reconnection to ChromaDB
   */
  async reconnect(): Promise<boolean> {
    logger.info("Forcing ChromaDB reconnection", "RESILIENT_VECTOR_STORE");
    return await this?.manager?.reconnect();
  }

  /**
   * Switch to in-memory mode (for testing)
   */
  async switchToInMemory(): Promise<void> {
    logger.info("Switching to in-memory mode", "RESILIENT_VECTOR_STORE");
    await this?.manager?.switchToInMemory();
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down resilient vector store", "RESILIENT_VECTOR_STORE");
    await this?.manager?.shutdown();
  }
}