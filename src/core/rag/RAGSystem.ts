import { VectorStore } from './VectorStore';
import { DocumentProcessor } from './DocumentProcessor';
import { EmbeddingService } from './EmbeddingService';
import { RetrievalService } from './RetrievalService';
import type { Document, QueryResult, RAGConfig, ProcessedDocument } from './types';

export class RAGSystem {
  private vectorStore: VectorStore;
  private documentProcessor: DocumentProcessor;
  private embeddingService: EmbeddingService;
  private retrievalService: RetrievalService;
  private isInitialized: boolean = false;

  constructor(private config: RAGConfig) {
    this.vectorStore = new VectorStore(config.vectorStore);
    this.documentProcessor = new DocumentProcessor(config.chunking);
    this.embeddingService = new EmbeddingService({
      model: 'nomic-embed-text',
      baseUrl: config.vectorStore.baseUrl || 'http://localhost:11434'
    });
    this.retrievalService = new RetrievalService(config.retrieval);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await Promise.all([
      this.vectorStore.initialize(),
      this.embeddingService.initialize()
    ]);

    this.isInitialized = true;
  }

  async addDocument(
    content: string,
    metadata: Record<string, any>
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Process document into chunks
    const processedDocs = await this.documentProcessor.processDocument(
      content,
      {
        sourceId: metadata.id || `doc-${Date.now()}`,
        ...metadata
      }
    );

    // Add to vector store
    await this.vectorStore.addDocuments(processedDocs);
  }

  async addDocuments(
    documents: Array<{ content: string; metadata: Record<string, any> }>
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const allProcessedDocs: ProcessedDocument[] = [];

    for (const doc of documents) {
      const processed = await this.documentProcessor.processDocument(
        doc.content,
        {
          sourceId: doc.metadata.id || `doc-${Date.now()}-${Math.random()}`,
          ...doc.metadata
        }
      );
      allProcessedDocs.push(...processed);
    }

    await this.vectorStore.addDocuments(allProcessedDocs);
  }

  async search(query: string, limit: number = 5): Promise<QueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Get initial results from vector store
    const vectorResults = await this.vectorStore.search(query, limit * 2);

    // Apply retrieval enhancements (reranking, filtering)
    const enhancedResults = await this.retrievalService.enhance(
      query,
      vectorResults
    );

    // Return top results
    return enhancedResults.slice(0, limit);
  }

  async searchWithFilter(
    query: string,
    filter: Record<string, any>,
    limit: number = 5
  ): Promise<QueryResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const vectorResults = await this.vectorStore.searchWithFilter(
      query,
      filter,
      limit * 2
    );

    const enhancedResults = await this.retrievalService.enhance(
      query,
      vectorResults
    );

    return enhancedResults.slice(0, limit);
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.vectorStore.deleteBySourceId(documentId);
  }

  async getDocument(documentId: string): Promise<Document | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.vectorStore.getDocument(documentId);
  }

  async getAllDocuments(
    limit: number = 100,
    offset: number = 0
  ): Promise<Document[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.vectorStore.getAllDocuments(limit, offset);
  }

  async getStats(): Promise<RAGStats> {
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
      averageChunksPerDocument: totalDocuments > 0 
        ? Math.round(totalChunks / totalDocuments) 
        : 0,
      vectorStoreType: this.config.vectorStore.type,
      embeddingModel: 'nomic-embed-text'
    };
  }

  async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.vectorStore.clear();
  }

  async updateDocument(
    documentId: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Delete old document
    await this.deleteDocument(documentId);

    // Add updated document
    await this.addDocument(content, {
      id: documentId,
      ...metadata,
      updatedAt: new Date().toISOString()
    });
  }

  async exportDocuments(format: 'json' | 'csv' = 'json'): Promise<string> {
    const documents = await this.getAllDocuments(10000);
    
    if (format === 'json') {
      return JSON.stringify(documents, null, 2);
    } else {
      // Simple CSV export
      const headers = ['id', 'content', 'metadata'];
      const rows = documents.map(doc => [
        doc.id,
        doc.content.replace(/"/g, '""'),
        JSON.stringify(doc.metadata).replace(/"/g, '""')
      ]);
      
      return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
    }
  }

  async importDocuments(data: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    let documents: Array<{ content: string; metadata: Record<string, any> }>;

    if (format === 'json') {
      documents = JSON.parse(data);
    } else {
      // Simple CSV parsing
      const lines = data.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      documents = lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^,]+)/g) || [];
        const cleaned = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        
        return {
          content: cleaned[1] || '',
          metadata: {
            id: cleaned[0],
            ...JSON.parse(cleaned[2] || '{}')
          }
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
}
