import { ChromaClient, Collection } from "chromadb";
import { EmbeddingService } from "./EmbeddingService";
import type {
  Document,
  QueryResult,
  VectorStoreConfig,
  ProcessedDocument,
} from "./types";
import type { DocumentMetadata } from "../shared/types";

export class VectorStore {
  private client: ChromaClient;
  private collection?: Collection;
  private embeddingService: EmbeddingService;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    
    // Check if path is a URL or file path and configure accordingly
    const chromaPath = config.path || "http://localhost:8000";
    const clientConfig: any = {};
    
    if (chromaPath.startsWith('http')) {
      // HTTP URL - use as-is
      clientConfig.path = chromaPath;
    } else {
      // File path - this will fail in 2025 versions, fallback to HTTP
      console.warn('ChromaDB file path configuration is deprecated. Falling back to HTTP.');
      clientConfig.path = "http://localhost:8000";
    }
    
    this.client = new ChromaClient(clientConfig);

    this.embeddingService = new EmbeddingService({
      model: "nomic-embed-text",
      baseUrl: config.baseUrl || "http://localhost:11434",
    });
  }

  async initialize(): Promise<void> {
    try {
      // First check if ChromaDB is running
      await this.client.heartbeat();
      
      // Get or create collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.collectionName,
        metadata: {
          description: "Knowledge base for AI agents",
          created_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to initialize vector store:", error);
      
      // Check if it's a connection error
      if ((error as any).message?.includes('Could not connect to tenant') || 
          (error as any).message?.includes('Failed to parse URL') ||
          (error as any).code === 'ECONNREFUSED') {
        console.warn("ChromaDB is not running or misconfigured. Vector store will be disabled.");
        throw new Error("ChromaDB connection failed - vector store disabled");
      }
      
      throw new Error("Vector store initialization failed");
    }
  }

  async addDocuments(documents: ProcessedDocument[]): Promise<void> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    if (documents.length === 0) return;

    // Generate embeddings
    const embeddings = await this.embeddingService.embedBatch(
      documents.map((d) => d.content),
    );

    // Prepare data for ChromaDB
    const ids = documents.map((d) => d.id);
    const metadatas = documents.map((d) => ({
      ...d.metadata,
      content_length: d.content.length,
      indexed_at: new Date().toISOString(),
    }));
    const contents = documents.map((d) => d.content);

    // Add to collection
    await this.collection.add({
      ids,
      embeddings,
      metadatas: metadatas as any[], // ChromaDB type mismatch
      documents: contents,
    });
  }

  async search(query: string, limit: number = 5): Promise<QueryResult[]> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embed(query);

    // Search in collection
    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      include: ["metadatas", "documents", "distances"] as any,
    });

    return this.formatResults(results);
  }

  async searchWithFilter(
    query: string,
    filter: Record<string, any>,
    limit: number = 5,
  ): Promise<QueryResult[]> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    const queryEmbedding = await this.embeddingService.embed(query);

    // Convert filter to ChromaDB where clause
    const whereClause = this.buildWhereClause(filter);

    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: whereClause,
      include: ["metadatas", "documents", "distances"] as any,
    });

    return this.formatResults(results);
  }

  async getDocument(documentId: string): Promise<Document | null> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    try {
      const result = await this.collection.get({
        ids: [documentId],
        include: ["metadatas", "documents"] as any,
      });

      if (result.ids.length === 0) {
        return null;
      }

      const metadata = result.metadatas?.[0] || {};
      return {
        id: result.ids[0] || "",
        content: result.documents?.[0] || "",
        metadata: {
          sourceId: metadata.sourceId || result.ids[0] || "",
          ...metadata,
        } as DocumentMetadata,
      };
    } catch (error) {
      console.error("Failed to get document:", error);
      return null;
    }
  }

  async deleteBySourceId(sourceId: string): Promise<void> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    // Find all chunks for this source
    const results = await this.collection.get({
      where: { sourceId },
      include: ["ids"] as any,
    });

    if (results.ids.length > 0) {
      await this.collection.delete({
        ids: results.ids,
      });
    }
  }

  async getAllDocuments(
    limit: number = 100,
    offset: number = 0,
  ): Promise<Document[]> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    // Note: ChromaDB doesn't have native pagination, so we get all and slice
    const results = await this.collection.get({
      include: ["metadatas", "documents"] as any,
    });

    const documents: Document[] = [];
    for (let i = 0; i < results.ids.length; i++) {
      const metadata = results.metadatas?.[i] || {};
      documents.push({
        id: results.ids[i] || "",
        content: results.documents?.[i] || "",
        metadata: {
          sourceId: metadata.sourceId || results.ids[i] || "",
          ...metadata,
        } as DocumentMetadata,
      });
    }

    // Apply pagination
    return documents.slice(offset, offset + limit);
  }

  async getDocumentCount(): Promise<number> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    const results = await this.collection.get({
      include: [],
    });

    // Get unique source IDs
    const sourceIds = new Set(
      results.metadatas?.map((m) => m?.sourceId).filter(Boolean) || [],
    );

    return sourceIds.size;
  }

  async getChunkCount(): Promise<number> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    const results = await this.collection.get({
      include: [],
    });

    return results.ids.length;
  }

  async getCollections(): Promise<string[]> {
    const collections = await this.client.listCollections();
    return collections.map((c: any) => c.name);
  }

  async clear(): Promise<void> {
    if (!this.collection) {
      throw new Error("Vector store not initialized");
    }

    // Delete the collection
    await this.client.deleteCollection({
      name: this.config.collectionName,
    });

    // Recreate it
    await this.initialize();
  }

  private formatResults(chromaResults: any): QueryResult[] {
    const results: QueryResult[] = [];

    if (!chromaResults.ids || chromaResults.ids.length === 0) {
      return results;
    }

    for (let i = 0; i < chromaResults.ids[0].length; i++) {
      const metadata = chromaResults.metadatas?.[0]?.[i] || {};
      results.push({
        id: chromaResults.ids[0][i] || "",
        content: chromaResults.documents?.[0]?.[i] || "",
        metadata: {
          ...metadata,
          sourceId: metadata.sourceId || "",
        } as DocumentMetadata,
        score: chromaResults.distances?.[0]?.[i]
          ? 1 - chromaResults.distances[0][i] // Convert distance to similarity score
          : 0,
      });
    }

    return results;
  }

  private buildWhereClause(filter: Record<string, any>): any {
    const whereClause: any = {};

    for (const [key, value] of Object.entries(filter)) {
      if (Array.isArray(value)) {
        // Handle array filters (OR condition)
        whereClause[key] = { $in: value };
      } else if (typeof value === "object" && value !== null) {
        // Handle complex filters
        whereClause[key] = value;
      } else {
        // Handle simple equality
        whereClause[key] = value;
      }
    }

    return whereClause;
  }
}
