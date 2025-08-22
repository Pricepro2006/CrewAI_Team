import { ChromaClient, type Collection } from "chromadb";
import { EmbeddingService } from "./EmbeddingService.js";
import { MODEL_CONFIG } from "../../config/models.config.js";
import type {
  Document,
  QueryResult,
  VectorStoreConfig,
  ProcessedDocument,
} from "./types.js";
import { logger } from "../../utils/logger.js";
import { LRUCache } from "lru-cache";
import pLimit from "p-limit";

interface CachedResult {
  results: QueryResult[];
  timestamp: number;
}

interface BatchRequest {
  query: string;
  resolve: (results: QueryResult[]) => void;
  reject: (error: Error) => void;
}

/**
 * Optimized vector store with caching, batching, and parallel processing
 */
export class OptimizedVectorStore {
  private client: ChromaClient;
  private collection?: Collection;
  private embeddingService: EmbeddingService;
  private config: VectorStoreConfig;
  
  // Optimization features
  private queryCache: LRUCache<string, CachedResult>;
  private embeddingCache: LRUCache<string, number[]>;
  private batchQueue: BatchRequest[] = [];
  private batchTimer?: NodeJS.Timeout;
  private concurrencyLimit = pLimit(5); // Limit concurrent operations
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_DELAY = 50; // ms
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: VectorStoreConfig) {
    this.config = config;

    // Initialize caches
    this.queryCache = new LRUCache<string, CachedResult>({
      max: 1000, // Cache up to 1000 queries
      ttl: this.CACHE_TTL,
    });

    this.embeddingCache = new LRUCache<string, number[]>({
      max: 5000, // Cache up to 5000 embeddings
      ttl: this.CACHE_TTL * 2, // Embeddings can be cached longer
    });

    // Setup ChromaDB client
    const chromaUrl = config.baseUrl || config.path || "http://localhost:8000";
    const clientConfig: any = {};

    if (chromaUrl.startsWith("http")) {
      clientConfig.path = chromaUrl;
    } else {
      logger.warn(
        "ChromaDB file path configuration is deprecated. Using HTTP URL instead.",
        "OPTIMIZED_VECTOR_STORE"
      );
      clientConfig.path = "http://localhost:8000";
    }

    this.client = new ChromaClient(clientConfig);

    this.embeddingService = new EmbeddingService({
      model: MODEL_CONFIG?.models?.embedding,
      baseUrl: config.baseUrl || "http://localhost:8081",
    });
  }

  async initialize(): Promise<void> {
    try {
      // Check ChromaDB connection
      await this.client.version();

      // Get or create collection
      try {
        this.collection = await this.client.getCollection({
          name: this.config.collectionName,
        } as any);
        
        // Warm up cache with recent queries if collection exists
        await this.warmUpCache();
      } catch (getError) {
        // Create new collection
        this.collection = await this.client.createCollection({
          name: this.config.collectionName,
          metadata: {
            description: "Optimized knowledge base for AI agents",
            created_at: new Date().toISOString(),
            optimized: true,
          },
        });
      }
      
      logger.info("Optimized vector store initialized", "OPTIMIZED_VECTOR_STORE");
    } catch (error) {
      logger.error("Failed to initialize optimized vector store", "OPTIMIZED_VECTOR_STORE", {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Add documents with batch processing and parallel embedding
   */
  async addDocuments(documents: ProcessedDocument[]): Promise<void> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    if (!documents || documents.length === 0) return;

    // Process in batches for better performance
    const batches = this.createBatches(documents, this.BATCH_SIZE);
    
    await Promise.all(
      batches.map((batch) =>
        this.concurrencyLimit(async () => {
          await this.addBatch(batch);
        })
      )
    );
    
    // Clear relevant caches
    this.invalidateCache();
  }

  private async addBatch(documents: ProcessedDocument[]): Promise<void> {
    // Generate embeddings with caching
    const embeddings = await this.getEmbeddingsWithCache(
      documents.map((d) => d.content)
    );

    // Prepare data for ChromaDB
    const ids = documents.map((d) => d.id);
    const metadatas = documents.map((d) => ({
      ...d.metadata,
      chunked: d.metadata?.chunked || false,
      source: d.metadata?.source || "unknown",
      timestamp: d.metadata?.timestamp || new Date().toISOString(),
    }));
    const contents = documents.map((d) => d.content);

    // Add to collection
    await this.collection!.add({
      ids,
      embeddings,
      metadatas: metadatas as any[],
      documents: contents,
    });
  }

  /**
   * Optimized search with caching and batch processing
   */
  async search(query: string, limit: number = 5): Promise<QueryResult[]> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    // Check cache first
    const cacheKey = `${query}:${limit}`;
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug("Returning cached search results", "OPTIMIZED_VECTOR_STORE");
      return cached.results;
    }

    // Add to batch queue for processing
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ query, resolve, reject });
      
      // Process batch after delay or when batch is full
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        this.processBatch();
      } else {
        this.scheduleBatchProcessing();
      }
    });
  }

  /**
   * Search with metadata filtering
   */
  async searchWithFilter(
    query: string,
    filter: Record<string, any>,
    limit: number = 5
  ): Promise<QueryResult[]> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    const cacheKey = `${query}:${JSON.stringify(filter)}:${limit}`;
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.results;
    }

    const queryEmbedding = await this.getEmbeddingWithCache(query);
    const whereClause = this.buildWhereClause(filter);

    const results = await this.collection!.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: whereClause,
      include: ["metadatas", "documents", "distances"] as any,
    });

    const formattedResults = this.formatResults(results);
    
    // Cache results
    this.queryCache.set(cacheKey, {
      results: formattedResults,
      timestamp: Date.now(),
    });

    return formattedResults;
  }

  /**
   * Batch processing for multiple queries
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    const batch = this.batchQueue.splice(0, this.BATCH_SIZE);
    if (batch.length === 0) return;

    try {
      // Get embeddings for all queries in batch
      const queries = batch.map((b) => b.query);
      const embeddings = await this.getEmbeddingsWithCache(queries);

      // Execute batch query
      const results = await this.collection!.query({
        queryEmbeddings: embeddings,
        nResults: 5, // Default limit
        include: ["metadatas", "documents", "distances"] as any,
      });

      // Process and cache results for each query
      batch.forEach((request, index) => {
        const queryResults = this.formatSingleResult(results, index);
        
        // Cache results
        const cacheKey = `${request.query}:5`;
        this.queryCache.set(cacheKey, {
          results: queryResults,
          timestamp: Date.now(),
        });

        // Resolve promise
        request.resolve(queryResults);
      });
    } catch (error) {
      // Reject all promises in batch
      batch.forEach((request) => {
        request.reject(error as Error);
      });
    }
  }

  private scheduleBatchProcessing(): void {
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.BATCH_DELAY);
    }
  }

  /**
   * Get embeddings with caching
   */
  private async getEmbeddingWithCache(text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(text);
    if (cached) {
      return cached;
    }

    const embedding = await this.embeddingService.embed(text);
    this.embeddingCache.set(text, embedding);
    return embedding;
  }

  private async getEmbeddingsWithCache(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for each text
    texts.forEach((text, index) => {
      const cached = this.embeddingCache.get(text);
      if (cached) {
        results[index] = cached;
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(index);
      }
    });

    // Get embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      const newEmbeddings = await this.embeddingService.embedBatch(uncachedTexts);
      
      // Cache and add to results
      uncachedTexts.forEach((text, i) => {
        const embedding = newEmbeddings[i];
        const originalIndex = uncachedIndices[i];
        if (originalIndex !== undefined && embedding) {
          this.embeddingCache.set(text, embedding);
          results[originalIndex] = embedding;
        }
      });
    }

    return results;
  }

  /**
   * Warm up cache with common queries
   */
  private async warmUpCache(): Promise<void> {
    try {
      // Get some recent documents to pre-compute embeddings
      const sampleResults = await this.collection!.peek({ limit: 20 });
      
      if (sampleResults.documents && sampleResults.documents.length > 0) {
        // Pre-compute embeddings for these documents
        const texts = sampleResults.documents.filter((d): d is string => d !== null);
        await this.getEmbeddingsWithCache(texts);
        
        logger.info(
          `Warmed up cache with ${texts.length} embeddings`,
          "OPTIMIZED_VECTOR_STORE"
        );
      }
    } catch (error) {
      logger.warn("Failed to warm up cache", "OPTIMIZED_VECTOR_STORE", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Invalidate cache when new documents are added
   */
  private invalidateCache(): void {
    // Clear query cache but keep embedding cache
    this.queryCache.clear();
    logger.debug("Query cache invalidated", "OPTIMIZED_VECTOR_STORE");
  }

  /**
   * Create batches from documents
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Build where clause for ChromaDB filtering
   */
  private buildWhereClause(filter: Record<string, any>): any {
    const whereClause: any = {};
    
    Object.entries(filter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        whereClause[key] = { "$in": value };
      } else if (typeof value === "object" && value !== null) {
        whereClause[key] = value;
      } else {
        whereClause[key] = { "$eq": value };
      }
    });

    return whereClause;
  }

  /**
   * Format ChromaDB results
   */
  private formatResults(results: any): QueryResult[] {
    if (!results.ids || results.ids.length === 0) {
      return [];
    }

    const formattedResults: QueryResult[] = [];
    const firstBatch = results.ids[0];

    for (let i = 0; i < firstBatch.length; i++) {
      formattedResults.push({
        id: results.ids[0][i],
        content: results.documents?.[0]?.[i] || "",
        metadata: results.metadatas?.[0]?.[i] || {},
        score: results.distances?.[0]?.[i] ? 1 - results.distances[0][i] : 0,
      });
    }

    return formattedResults;
  }

  /**
   * Format single result from batch query
   */
  private formatSingleResult(results: any, index: number): QueryResult[] {
    if (!results.ids || results.ids.length <= index) {
      return [];
    }

    const formattedResults: QueryResult[] = [];
    const batch = results.ids[index];

    for (let i = 0; i < batch.length; i++) {
      formattedResults.push({
        id: batch[i],
        content: results.documents?.[index]?.[i] || "",
        metadata: results.metadatas?.[index]?.[i] || {},
        score: results.distances?.[index]?.[i] 
          ? 1 - results.distances[index][i] 
          : 0,
      });
    }

    return formattedResults;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    queryCache: { size: number; hits: number; misses: number };
    embeddingCache: { size: number; hits: number; misses: number };
  } {
    return {
      queryCache: {
        size: this.queryCache.size,
        hits: 0, // Would need to track this
        misses: 0, // Would need to track this
      },
      embeddingCache: {
        size: this.embeddingCache.size,
        hits: 0, // Would need to track this
        misses: 0, // Would need to track this
      },
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.queryCache.clear();
    this.embeddingCache.clear();
    logger.info("All caches cleared", "OPTIMIZED_VECTOR_STORE");
  }
}