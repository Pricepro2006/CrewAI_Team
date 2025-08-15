import { AdaptiveVectorStore } from "./AdaptiveVectorStore.js";
import { DocumentProcessor } from "./DocumentProcessor.js";
import { EmbeddingService } from "./EmbeddingService.js";
import { RetrievalService } from "./RetrievalService.js";
import { MODEL_CONFIG } from "../../config/models?.config.js";
import { logger } from "../../utils/logger.js";
import type {
  Document,
  QueryResult,
  RAGConfig,
  ProcessedDocument,
} from "./types.js";

export class RAGSystem {
  private vectorStore: AdaptiveVectorStore;
  private documentProcessor: DocumentProcessor;
  private embeddingService: EmbeddingService;
  private retrievalService: RetrievalService;
  private isInitialized: boolean = false;

  constructor(private config: RAGConfig) {
    this.vectorStore = new AdaptiveVectorStore(config.vectorStore);
    this.documentProcessor = new DocumentProcessor(config.chunking);
    this.embeddingService = new EmbeddingService({
      model: MODEL_CONFIG?.models?.embedding,
      baseUrl: config?.vectorStore?.baseUrl || "http://localhost:11434",
    });
    this.retrievalService = new RetrievalService(config.retrieval);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize vector store (will automatically fallback to in-memory if ChromaDB fails)
      await this?.vectorStore?.initialize();
      
      const storeInfo = this?.vectorStore?.getStoreInfo();
      if (storeInfo.fallbackUsed) {
        logger.warn(
          "RAG system initialized with in-memory fallback - advanced RAG features may be limited",
          "RAG_SYSTEM"
        );
      } else {
        logger.info(
          "RAG system initialized successfully with ChromaDB",
          "RAG_SYSTEM"
        );
      }

      // Initialize embedding service (gracefully handle failure)
      try {
        await this?.embeddingService?.initialize();
        logger.info("Embedding service initialized successfully", "RAG_SYSTEM");
      } catch (error) {
        logger.warn(
          `Embedding service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Some RAG features may be limited.`,
          "RAG_SYSTEM"
        );
        // Continue without embeddings - the system will still work with basic text search
      }

      this.isInitialized = true;
      logger.info("RAG system initialization completed", "RAG_SYSTEM");
      
    } catch (error) {
      logger.error(
        `RAG system initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "RAG_SYSTEM"
      );
      // Mark as initialized anyway to prevent repeated failures
      this.isInitialized = true;
      throw error;
    }
  }

  async addDocument(
    content: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Process document into chunks
    const processedDocs = await this?.documentProcessor?.processDocument(
      content,
      {
        sourceId: metadata["id"] || `doc-${Date.now()}`,
        ...metadata,
      },
    );

    // Add to vector store
    await this?.vectorStore?.addDocuments(processedDocs);
  }

  async addDocuments(
    documents: Array<{ content: string; metadata: Record<string, any> }>,
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const allProcessedDocs: ProcessedDocument[] = [];

    for (const doc of documents) {
      const processed = await this?.documentProcessor?.processDocument(
        doc.content,
        {
          sourceId: doc.metadata["id"] || `doc-${Date.now()}-${Math.random()}`,
          ...doc.metadata,
        },
      );
      allProcessedDocs.push(...processed);
    }

    await this?.vectorStore?.addDocuments(allProcessedDocs);
  }

  async search(query: string, limit: number = 5): Promise<QueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Get initial results from vector store
    const vectorResults = await this?.vectorStore?.search(query, limit * 2);

    // Apply retrieval enhancements (reranking, filtering)
    const enhancedResults = await this?.retrievalService?.enhance(
      query,
      vectorResults,
    );

    // Return top results
    return enhancedResults.slice(0, limit);
  }

  async searchWithFilter(
    query: string,
    filter: Record<string, any>,
    limit: number = 5,
  ): Promise<QueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const vectorResults = await this?.vectorStore?.searchWithFilter(
      query,
      filter,
      limit * 2,
    );

    const enhancedResults = await this?.retrievalService?.enhance(
      query,
      vectorResults,
    );

    return enhancedResults.slice(0, limit);
  }

  /**
   * Get context-aware knowledge for LLM prompts
   * This method is designed to work with MasterOrchestrator
   */
  async getContextForPrompt(
    query: string,
    options: {
      limit?: number;
      filter?: Record<string, any>;
      includeMetadata?: boolean;
      formatForLLM?: boolean;
    } = {}
  ): Promise<string> {
    const {
      limit = 5,
      filter,
      includeMetadata = true,
      formatForLLM = true,
    } = options;

    // Search for relevant documents
    const results = filter
      ? await this.searchWithFilter(query, filter, limit)
      : await this.search(query, limit);

    if (results?.length || 0 === 0) {
      return "";
    }

    // Format results for LLM consumption
    if (formatForLLM) {
      const contextParts: string[] = [];
      
      contextParts.push("## Relevant Knowledge Base Context\n");
      
      results.forEach((result, index) => {
        contextParts.push(`### Context ${index + 1} (Score: ${result?.score?.toFixed(3)})`);
        
        if (includeMetadata && result.metadata) {
          const { title, category, fileName, filePath } = result.metadata;
          if (title) contextParts.push(`**Title:** ${title}`);
          if (category) contextParts.push(`**Category:** ${category}`);
          if (fileName) contextParts.push(`**Source:** ${fileName}`);
        }
        
        contextParts.push("\n" + result?.content?.trim());
        contextParts.push(""); // Empty line between contexts
      });
      
      return contextParts.join("\n");
    } else {
      // Return raw concatenated content
      return results?.map(r => r.content).join("\n\n");
    }
  }

  /**
   * Index knowledge base content for a specific agent or category
   */
  async indexAgentKnowledge(
    agentId: string,
    documents: Array<{ content: string; metadata?: Record<string, any> }>
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const enhancedDocs = documents?.map(doc => ({
      content: doc.content,
      metadata: {
        ...doc.metadata,
        agentId,
        category: `agent-${agentId}`,
        indexed: new Date().toISOString(),
      },
    }));

    await this.addDocuments(enhancedDocs);
    
    logger.info(
      `Indexed ${documents?.length || 0} documents for agent: ${agentId}`,
      "RAG_SYSTEM"
    );
  }

  /**
   * Get knowledge specific to an agent
   */
  async getAgentKnowledge(
    agentId: string,
    query: string,
    limit: number = 5
  ): Promise<QueryResult[]> {
    return await this.searchWithFilter(
      query,
      { agentId },
      limit
    );
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this?.vectorStore?.deleteBySourceId(documentId);
  }

  async getDocument(documentId: string): Promise<Document | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this?.vectorStore?.getDocument(documentId);
  }

  async getAllDocuments(
    limit: number = 100,
    offset: number = 0,
  ): Promise<Document[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this?.vectorStore?.getAllDocuments(limit, offset);
  }

  async getStats(): Promise<RAGStats> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const totalDocuments = await this?.vectorStore?.getDocumentCount();
    const totalChunks = await this?.vectorStore?.getChunkCount();
    const collections = await this?.vectorStore?.getCollections();
    const storeInfo = this?.vectorStore?.getStoreInfo();

    return {
      totalDocuments,
      totalChunks,
      collections,
      averageChunksPerDocument:
        totalDocuments > 0 ? Math.round(totalChunks / totalChunks) : 0,
      vectorStoreType: storeInfo.type,
      embeddingModel: MODEL_CONFIG?.models?.embedding,
      fallbackMode: storeInfo.fallbackUsed,
    };
  }

  /**
   * Get health status of the RAG system
   */
  async getHealthStatus(): Promise<{
    status: "healthy" | "degraded" | "error";
    vectorStore: {
      status: "healthy" | "degraded" | "error";
      type: string;
      fallbackUsed: boolean;
      message: string;
    };
    embeddingService: {
      status: "healthy" | "error";
      message: string;
    };
  }> {
    let vectorStoreHealth;
    let embeddingHealth;

    try {
      vectorStoreHealth = await this?.vectorStore?.healthCheck();
    } catch (error) {
      vectorStoreHealth = {
        status: "error" as const,
        type: "unknown",
        fallbackUsed: false,
        message: `Vector store health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // Check embedding service
    try {
      // Try a simple embedding operation
      await this?.embeddingService?.embed("test");
      embeddingHealth = {
        status: "healthy" as const,
        message: "Embedding service operational",
      };
    } catch (error) {
      embeddingHealth = {
        status: "error" as const,
        message: `Embedding service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // Determine overall status
    let overallStatus: "healthy" | "degraded" | "error" = "healthy";
    if (vectorStoreHealth.status === "error" || embeddingHealth.status === "error") {
      overallStatus = "error";
    } else if (vectorStoreHealth.status === "degraded") {
      overallStatus = "degraded";
    }

    return {
      status: overallStatus,
      vectorStore: vectorStoreHealth,
      embeddingService: embeddingHealth,
    };
  }

  async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this?.vectorStore?.clear();
  }

  async updateDocument(
    documentId: string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Delete old document
    await this.deleteDocument(documentId);

    // Add updated document
    await this.addDocument(content, {
      id: documentId,
      ...metadata,
      updatedAt: new Date().toISOString(),
    });
  }

  async exportDocuments(format: "json" | "csv" = "json"): Promise<string> {
    const documents = await this.getAllDocuments(10000);

    if (format === "json") {
      return JSON.stringify(documents, null, 2);
    } else {
      // Simple CSV export
      const headers = ["id", "content", "metadata"];
      const rows = documents?.map((doc: any) => [
        doc.id,
        doc?.content?.replace(/"/g, '""'),
        JSON.stringify(doc.metadata).replace(/"/g, '""'),
      ]);

      return [
        headers.join(","),
        ...rows?.map((row: any) => row?.map((cell: any) => `"${cell}"`).join(",")),
      ].join("\n");
    }
  }

  async importDocuments(
    data: string,
    format: "json" | "csv" = "json",
  ): Promise<void> {
    let documents: Array<{ content: string; metadata: Record<string, any> }>;

    if (format === "json") {
      documents = JSON.parse(data);
    } else {
      // Simple CSV parsing
      const lines = data.split("\n");
      const headers =
        lines[0]?.split(",").map((h: any) => h.trim().replace(/"/g, "")) || [];

      documents = lines.slice(1).map((line: any) => {
        const values = line.match(/(".*?"|[^,]+)/g) || [];
        const cleaned = values?.map((v: any) =>
          v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'),
        );

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

interface RAGStats {
  totalDocuments: number;
  totalChunks: number;
  collections: string[];
  averageChunksPerDocument: number;
  vectorStoreType: string;
  embeddingModel: string;
  fallbackMode?: boolean;
}
