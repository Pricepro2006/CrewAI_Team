/**
 * Resilient ChromaDB Manager with automatic fallback to in-memory storage
 * Provides seamless degradation when ChromaDB is unavailable
 */

import { Collection } from "chromadb";
import { logger } from "../../utils/logger.js";
import { ChromaDBConnectionManager, ConnectionState } from "./ChromaDBConnectionManager.js";
import { InMemoryVectorStore } from "../../core/rag/InMemoryVectorStore.js";
import type { 
  ChromaDocument, 
  ChromaQueryResult, 
  CollectionConfig 
} from "./ChromaDBManager.js";
import type { ProcessedDocument } from "../../core/rag/types.js";

export enum StorageMode {
  CHROMADB = "chromadb",
  IN_MEMORY = "in-memory",
  HYBRID = "hybrid", // ChromaDB with in-memory cache
}

export interface ResilientConfig {
  chromadb?: {
    host?: string;
    port?: number;
    ssl?: boolean;
    headers?: Record<string, string>;
    tenant?: string;
    database?: string;
  };
  connectionManager?: {
    maxRetries?: number;
    initialRetryDelay?: number;
    maxRetryDelay?: number;
    healthCheckInterval?: number;
  };
  fallback?: {
    enabled?: boolean;
    preserveDataOnSwitch?: boolean;
    maxInMemoryDocuments?: number;
    syncInterval?: number; // Interval to sync in-memory to ChromaDB when it recovers
  };
}

export class ResilientChromaDBManager {
  private connectionManager: ChromaDBConnectionManager;
  private inMemoryStore: InMemoryVectorStore;
  private collections: Map<string, Collection> = new Map();
  private mode: StorageMode = StorageMode.CHROMADB;
  private config: Required<ResilientConfig["fallback"]>;
  private syncTimer?: NodeJS.Timer;
  private pendingOperations: Map<string, ProcessedDocument[]> = new Map();
  private isInitialized: boolean = false;

  constructor(config: ResilientConfig = {}) {
    // Initialize connection manager
    this.connectionManager = new ChromaDBConnectionManager({
      ...config.chromadb,
      ...config.connectionManager,
    });

    // Initialize in-memory fallback
    this.inMemoryStore = new InMemoryVectorStore({
      collectionName: "fallback",
      path: "",
      baseUrl: "",
    });

    // Configure fallback settings
    this.config = {
      enabled: config.fallback?.enabled ?? true,
      preserveDataOnSwitch: config.fallback?.preserveDataOnSwitch ?? true,
      maxInMemoryDocuments: config.fallback?.maxInMemoryDocuments ?? 10000,
      syncInterval: config.fallback?.syncInterval ?? 60000, // 1 minute
    };

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Initialize the manager and establish connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info("Initializing Resilient ChromaDB Manager", "RESILIENT_CHROMADB");

    // Initialize in-memory store
    await this.inMemoryStore.initialize();

    // Try to connect to ChromaDB
    const connected = await this.connectionManager.connect();

    if (connected) {
      this.mode = StorageMode.CHROMADB;
      logger.info("ChromaDB connected - using persistent storage", "RESILIENT_CHROMADB");
    } else if (this.config.enabled) {
      this.mode = StorageMode.IN_MEMORY;
      logger.warn(
        "ChromaDB unavailable - falling back to in-memory storage",
        "RESILIENT_CHROMADB"
      );
    } else {
      throw new Error("ChromaDB connection failed and fallback is disabled");
    }

    this.isInitialized = true;

    // Start sync timer if in fallback mode
    if (this.mode === StorageMode.IN_MEMORY) {
      this.startSyncTimer();
    }
  }

  /**
   * Set up event listeners for connection state changes
   */
  private setupEventListeners(): void {
    this.connectionManager.on("connected", () => {
      this.onChromaDBConnected();
    });

    this.connectionManager.on("disconnected", (error: string) => {
      this.onChromaDBDisconnected(error);
    });
  }

  /**
   * Handle ChromaDB connection
   */
  private async onChromaDBConnected(): Promise<void> {
    logger.info("ChromaDB connection restored", "RESILIENT_CHROMADB");

    if (this.mode === StorageMode.IN_MEMORY && this.config.preserveDataOnSwitch) {
      // Sync in-memory data to ChromaDB
      await this.syncInMemoryToChromaDB();
    }

    this.mode = StorageMode.CHROMADB;
    this.stopSyncTimer();
  }

  /**
   * Handle ChromaDB disconnection
   */
  private onChromaDBDisconnected(error: string): void {
    logger.warn(`ChromaDB disconnected: ${error}`, "RESILIENT_CHROMADB");

    if (this.config.enabled) {
      this.mode = StorageMode.IN_MEMORY;
      this.startSyncTimer();
      logger.info("Switched to in-memory fallback mode", "RESILIENT_CHROMADB");
    }
  }

  /**
   * Start periodic sync attempts
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(async () => {
      await this.attemptSync();
    }, this.config.syncInterval);
  }

  /**
   * Stop sync timer
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Attempt to sync data with ChromaDB
   */
  private async attemptSync(): Promise<void> {
    if (this.mode !== StorageMode.IN_MEMORY) {
      return;
    }

    const connected = await this.connectionManager.connect();
    if (connected) {
      await this.syncInMemoryToChromaDB();
    }
  }

  /**
   * Sync in-memory data to ChromaDB
   */
  private async syncInMemoryToChromaDB(): Promise<void> {
    logger.info("Starting data sync from in-memory to ChromaDB", "RESILIENT_CHROMADB");

    try {
      // Get all documents from in-memory store
      const documents = await this.inMemoryStore.getAllDocuments(
        this.config.maxInMemoryDocuments
      );

      if (documents.length === 0) {
        logger.info("No documents to sync", "RESILIENT_CHROMADB");
        return;
      }

      // Group documents by collection (stored in metadata)
      const documentsByCollection = new Map<string, ProcessedDocument[]>();

      for (const doc of documents) {
        const collectionName = doc.metadata.collection || "default";
        if (!documentsByCollection.has(collectionName)) {
          documentsByCollection.set(collectionName, []);
        }
        documentsByCollection.get(collectionName)!.push({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
        });
      }

      // Sync each collection
      for (const [collectionName, docs] of documentsByCollection) {
        try {
          await this.addDocumentsToChromaDB(collectionName, docs);
          logger.info(
            `Synced ${docs.length} documents to collection ${collectionName}`,
            "RESILIENT_CHROMADB"
          );
        } catch (error) {
          logger.error(
            `Failed to sync collection ${collectionName}: ${error}`,
            "RESILIENT_CHROMADB"
          );
        }
      }

      // Clear in-memory store after successful sync
      await this.inMemoryStore.clear();
      logger.info("Data sync completed successfully", "RESILIENT_CHROMADB");
    } catch (error) {
      logger.error(`Data sync failed: ${error}`, "RESILIENT_CHROMADB");
    }
  }

  /**
   * Add documents to ChromaDB with retry
   */
  private async addDocumentsToChromaDB(
    collectionName: string,
    documents: ProcessedDocument[]
  ): Promise<void> {
    const client = this.connectionManager.getClient();
    if (!client) {
      throw new Error("ChromaDB client not available");
    }

    // Get or create collection
    let collection = this.collections.get(collectionName);
    if (!collection) {
      try {
        collection = await client.getCollection({ name: collectionName } as any);
      } catch {
        collection = await client.createCollection({
          name: collectionName,
          metadata: { created_at: new Date().toISOString() },
        });
      }
      this.collections.set(collectionName, collection);
    }

    // Add documents in batches
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      await collection.add({
        ids: batch.map(d => d.id),
        documents: batch.map(d => d.content),
        metadatas: batch.map(d => d.metadata) as any[],
      });
    }
  }

  /**
   * Add documents with automatic fallback
   */
  async addDocuments(
    collectionName: string,
    documents: ChromaDocument[],
    embeddings?: number[][]
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const processedDocs: ProcessedDocument[] = documents.map(doc => ({
      id: doc.id,
      content: doc.content,
      metadata: {
        ...doc.metadata,
        collection: collectionName,
      },
    }));

    if (this.mode === StorageMode.CHROMADB) {
      try {
        await this.addDocumentsToChromaDB(collectionName, processedDocs);
        logger.info(
          `Added ${documents.length} documents to ChromaDB collection ${collectionName}`,
          "RESILIENT_CHROMADB"
        );
      } catch (error) {
        logger.warn(
          `Failed to add documents to ChromaDB, using fallback: ${error}`,
          "RESILIENT_CHROMADB"
        );
        
        if (this.config.enabled) {
          // Switch to in-memory mode
          this.mode = StorageMode.IN_MEMORY;
          await this.inMemoryStore.addDocuments(processedDocs);
          
          // Store for later sync
          if (!this.pendingOperations.has(collectionName)) {
            this.pendingOperations.set(collectionName, []);
          }
          this.pendingOperations.get(collectionName)!.push(...processedDocs);
        } else {
          throw error;
        }
      }
    } else {
      // In-memory mode
      await this.inMemoryStore.addDocuments(processedDocs);
      
      // Store for later sync
      if (!this.pendingOperations.has(collectionName)) {
        this.pendingOperations.set(collectionName, []);
      }
      this.pendingOperations.get(collectionName)!.push(...processedDocs);
    }
  }

  /**
   * Query documents with automatic fallback
   */
  async queryDocuments(
    collectionName: string,
    queryEmbedding: number[],
    options: {
      nResults?: number;
      where?: Record<string, any>;
    } = {}
  ): Promise<ChromaQueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.mode === StorageMode.IN_MEMORY) {
      // Use in-memory search (text-based, no embeddings)
      const results = await this.inMemoryStore.search(
        "", // Query text not available here
        options.nResults
      );

      return results.map(r => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        distance: 1 - r.score,
        similarity: r.score,
      }));
    }

    // ChromaDB mode
    const client = this.connectionManager.getClient();
    if (!client) {
      // Fallback to in-memory
      const results = await this.inMemoryStore.search("", options.nResults);
      return results.map(r => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        distance: 1 - r.score,
        similarity: r.score,
      }));
    }

    try {
      const collection = await client.getCollection({ name: collectionName } as any);
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: options.nResults || 10,
        where: options.where,
        include: ["metadatas", "documents", "distances"] as any,
      });

      return this.formatQueryResults(results);
    } catch (error) {
      logger.warn(
        `Query failed on ChromaDB, using fallback: ${error}`,
        "RESILIENT_CHROMADB"
      );
      
      // Fallback to in-memory
      const results = await this.inMemoryStore.search("", options.nResults);
      return results.map(r => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        distance: 1 - r.score,
        similarity: r.score,
      }));
    }
  }

  /**
   * Format ChromaDB query results
   */
  private formatQueryResults(chromaResults: any): ChromaQueryResult[] {
    const results: ChromaQueryResult[] = [];

    if (!chromaResults.ids || chromaResults.ids.length === 0) {
      return results;
    }

    for (let i = 0; i < chromaResults.ids[0].length; i++) {
      const distance = chromaResults.distances?.[0]?.[i] || 0;
      const similarity = 1 - distance;

      results.push({
        id: chromaResults.ids[0][i],
        content: chromaResults.documents?.[0]?.[i] || "",
        metadata: chromaResults.metadatas?.[0]?.[i] || {},
        distance,
        similarity: Math.max(0, similarity),
      });
    }

    return results;
  }

  /**
   * Get current storage mode
   */
  getStorageMode(): StorageMode {
    return this.mode;
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    status: "healthy" | "degraded" | "error";
    mode: StorageMode;
    chromadb: {
      connected: boolean;
      state: ConnectionState;
      metrics: any;
    };
    inMemory: {
      documentCount: number;
      pendingSync: number;
    };
    message: string;
  }> {
    const chromadbHealth = await this.connectionManager.healthCheck();
    const inMemoryCount = await this.inMemoryStore.getDocumentCount();
    
    let pendingCount = 0;
    for (const docs of this.pendingOperations.values()) {
      pendingCount += docs.length;
    }

    const status = 
      this.mode === StorageMode.CHROMADB ? "healthy" :
      this.mode === StorageMode.IN_MEMORY ? "degraded" :
      "error";

    const message = 
      this.mode === StorageMode.CHROMADB ? 
        "ChromaDB operational - persistent storage active" :
      this.mode === StorageMode.IN_MEMORY ?
        "Using in-memory fallback - system operational but data not persisted" :
        "Storage system error";

    return {
      status,
      mode: this.mode,
      chromadb: {
        connected: chromadbHealth.healthy,
        state: chromadbHealth.state,
        metrics: chromadbHealth.metrics,
      },
      inMemory: {
        documentCount: inMemoryCount,
        pendingSync: pendingCount,
      },
      message,
    };
  }

  /**
   * Force switch to in-memory mode (for testing)
   */
  async switchToInMemory(): Promise<void> {
    await this.connectionManager.disconnect();
    this.mode = StorageMode.IN_MEMORY;
    logger.info("Manually switched to in-memory mode", "RESILIENT_CHROMADB");
  }

  /**
   * Force reconnect to ChromaDB
   */
  async reconnect(): Promise<boolean> {
    const connected = await this.connectionManager.connect();
    if (connected) {
      await this.onChromaDBConnected();
    }
    return connected;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.stopSyncTimer();
    await this.connectionManager.disconnect();
    logger.info("Resilient ChromaDB Manager shutdown", "RESILIENT_CHROMADB");
  }
}