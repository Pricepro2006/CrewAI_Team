import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RetrievalService } from './RetrievalService';
import type { VectorStore, RetrievalOptions, StoredDocument } from './types';

// Mock vector store
const mockVectorStore: VectorStore = {
  addDocuments: vi.fn(),
  search: vi.fn(),
  deleteDocument: vi.fn(),
  getDocument: vi.fn(),
  listDocuments: vi.fn(),
  clear: vi.fn(),
};

describe('RetrievalService', () => {
  let service: RetrievalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RetrievalService(mockVectorStore, {
      defaultTopK: 5,
      defaultThreshold: 0.7,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addDocument', () => {
    it('should add a document to the vector store', async () => {
      const document: StoredDocument = {
        id: 'doc-1',
        content: 'Test content',
        embedding: new Array(384).fill(0).map(() => Math.random()),
        metadata: {
          sourceId: 'source-1',
          contentType: 'text/plain',
          chunkIndex: 0,
          timestamp: new Date(),
        },
      };

      vi.mocked(mockVectorStore.addDocuments).mockResolvedValueOnce(['doc-1']);

      const result = await service.addDocument(document);

      expect(mockVectorStore.addDocuments).toHaveBeenCalledWith([document]);
      expect(result).toBe('doc-1');
    });

    it('should handle errors when adding documents', async () => {
      const document: StoredDocument = {
        id: 'doc-1',
        content: 'Test content',
        embedding: new Array(384).fill(0),
        metadata: {},
      };

      vi.mocked(mockVectorStore.addDocuments).mockRejectedValueOnce(
        new Error('Storage error')
      );

      await expect(service.addDocument(document)).rejects.toThrow('Storage error');
    });
  });

  describe('addDocuments', () => {
    it('should add multiple documents in batch', async () => {
      const documents: StoredDocument[] = [
        {
          id: 'doc-1',
          content: 'Content 1',
          embedding: new Array(384).fill(0),
          metadata: {},
        },
        {
          id: 'doc-2',
          content: 'Content 2',
          embedding: new Array(384).fill(0),
          metadata: {},
        },
      ];

      vi.mocked(mockVectorStore.addDocuments).mockResolvedValueOnce(['doc-1', 'doc-2']);

      const results = await service.addDocuments(documents);

      expect(mockVectorStore.addDocuments).toHaveBeenCalledWith(documents);
      expect(results).toEqual(['doc-1', 'doc-2']);
    });

    it('should handle empty document array', async () => {
      vi.mocked(mockVectorStore.addDocuments).mockResolvedValueOnce([]);

      const results = await service.addDocuments([]);

      expect(results).toEqual([]);
    });
  });

  describe('retrieve', () => {
    it('should retrieve relevant documents for a query', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      const mockResults: StoredDocument[] = [
        {
          id: 'doc-1',
          content: 'Relevant content 1',
          embedding: queryEmbedding,
          metadata: { similarity: 0.95 },
        },
        {
          id: 'doc-2',
          content: 'Relevant content 2',
          embedding: new Array(384).fill(0),
          metadata: { similarity: 0.85 },
        },
      ];

      vi.mocked(mockVectorStore.search).mockResolvedValueOnce(mockResults);

      const results = await service.retrieve(queryEmbedding);

      expect(mockVectorStore.search).toHaveBeenCalledWith(queryEmbedding, {
        topK: 5,
        threshold: 0.7,
      });
      expect(results).toEqual(mockResults);
    });

    it('should use custom retrieval options', async () => {
      const queryEmbedding = new Array(384).fill(0);
      const options: RetrievalOptions = {
        topK: 10,
        threshold: 0.8,
        filter: { contentType: 'text/markdown' },
      };

      vi.mocked(mockVectorStore.search).mockResolvedValueOnce([]);

      await service.retrieve(queryEmbedding, options);

      expect(mockVectorStore.search).toHaveBeenCalledWith(queryEmbedding, options);
    });

    it('should handle search errors gracefully', async () => {
      const queryEmbedding = new Array(384).fill(0);
      
      vi.mocked(mockVectorStore.search).mockRejectedValueOnce(
        new Error('Search failed')
      );

      await expect(service.retrieve(queryEmbedding)).rejects.toThrow('Search failed');
    });
  });

  describe('retrieveByQuery', () => {
    it('should retrieve documents by text query with embedding', async () => {
      const query = 'test query';
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      const mockResults: StoredDocument[] = [
        {
          id: 'doc-1',
          content: 'Test document content',
          embedding: new Array(384).fill(0),
          metadata: {},
        },
      ];

      // Mock embedding generation
      const embeddingService = {
        embedText: vi.fn().mockResolvedValueOnce(queryEmbedding),
      };
      service = new RetrievalService(mockVectorStore, {
        defaultTopK: 5,
        defaultThreshold: 0.7,
      }, embeddingService as any);

      vi.mocked(mockVectorStore.search).mockResolvedValueOnce(mockResults);

      const results = await service.retrieveByQuery(query);

      expect(embeddingService.embedText).toHaveBeenCalledWith(query);
      expect(mockVectorStore.search).toHaveBeenCalledWith(queryEmbedding, {
        topK: 5,
        threshold: 0.7,
      });
      expect(results).toEqual(mockResults);
    });

    it('should throw error if embedding service not available', async () => {
      const query = 'test query';
      
      await expect(service.retrieveByQuery(query)).rejects.toThrow(
        'Embedding service not configured'
      );
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document by ID', async () => {
      vi.mocked(mockVectorStore.deleteDocument).mockResolvedValueOnce(true);

      const result = await service.deleteDocument('doc-1');

      expect(mockVectorStore.deleteDocument).toHaveBeenCalledWith('doc-1');
      expect(result).toBe(true);
    });

    it('should return false if document not found', async () => {
      vi.mocked(mockVectorStore.deleteDocument).mockResolvedValueOnce(false);

      const result = await service.deleteDocument('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getDocument', () => {
    it('should retrieve a document by ID', async () => {
      const document: StoredDocument = {
        id: 'doc-1',
        content: 'Test content',
        embedding: new Array(384).fill(0),
        metadata: {},
      };

      vi.mocked(mockVectorStore.getDocument).mockResolvedValueOnce(document);

      const result = await service.getDocument('doc-1');

      expect(mockVectorStore.getDocument).toHaveBeenCalledWith('doc-1');
      expect(result).toEqual(document);
    });

    it('should return null if document not found', async () => {
      vi.mocked(mockVectorStore.getDocument).mockResolvedValueOnce(null);

      const result = await service.getDocument('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listDocuments', () => {
    it('should list all documents with pagination', async () => {
      const documents: StoredDocument[] = [
        {
          id: 'doc-1',
          content: 'Content 1',
          embedding: new Array(384).fill(0),
          metadata: {},
        },
        {
          id: 'doc-2',
          content: 'Content 2',
          embedding: new Array(384).fill(0),
          metadata: {},
        },
      ];

      vi.mocked(mockVectorStore.listDocuments).mockResolvedValueOnce({
        documents,
        total: 2,
        offset: 0,
        limit: 10,
      });

      const result = await service.listDocuments({ offset: 0, limit: 10 });

      expect(mockVectorStore.listDocuments).toHaveBeenCalledWith({ offset: 0, limit: 10 });
      expect(result.documents).toEqual(documents);
      expect(result.total).toBe(2);
    });

    it('should handle empty document list', async () => {
      vi.mocked(mockVectorStore.listDocuments).mockResolvedValueOnce({
        documents: [],
        total: 0,
        offset: 0,
        limit: 10,
      });

      const result = await service.listDocuments();

      expect(result.documents).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all documents from the store', async () => {
      vi.mocked(mockVectorStore.clear).mockResolvedValueOnce(undefined);

      await service.clear();

      expect(mockVectorStore.clear).toHaveBeenCalled();
    });

    it('should handle clear errors', async () => {
      vi.mocked(mockVectorStore.clear).mockRejectedValueOnce(
        new Error('Clear failed')
      );

      await expect(service.clear()).rejects.toThrow('Clear failed');
    });
  });

  describe('rerank', () => {
    it('should rerank results based on additional criteria', async () => {
      const documents: StoredDocument[] = [
        {
          id: 'doc-1',
          content: 'First document about AI',
          embedding: new Array(384).fill(0),
          metadata: { 
            sourceId: 'trusted-source',
            timestamp: new Date('2025-01-15'),
            similarity: 0.8,
          },
        },
        {
          id: 'doc-2',
          content: 'Second document about AI',
          embedding: new Array(384).fill(0),
          metadata: { 
            sourceId: 'regular-source',
            timestamp: new Date('2025-01-10'),
            similarity: 0.85,
          },
        },
        {
          id: 'doc-3',
          content: 'Third document about ML',
          embedding: new Array(384).fill(0),
          metadata: { 
            sourceId: 'trusted-source',
            timestamp: new Date('2025-01-20'),
            similarity: 0.75,
          },
        },
      ];

      // Custom reranking function that prioritizes trusted sources and recency
      const rerankedResults = await service.rerank(documents, {
        query: 'AI',
        boostFactors: {
          trustedSource: 1.2,
          recency: 1.1,
        },
      });

      // Should reorder based on combined factors
      expect(rerankedResults[0].id).toBe('doc-3'); // Most recent + trusted
      expect(rerankedResults[1].id).toBe('doc-1'); // Trusted but older
      expect(rerankedResults[2].id).toBe('doc-2'); // Highest similarity but not trusted
    });
  });

  describe('hybrid search', () => {
    it('should combine vector and keyword search', async () => {
      const queryEmbedding = new Array(384).fill(0);
      const vectorResults: StoredDocument[] = [
        {
          id: 'doc-1',
          content: 'Vector match content',
          embedding: new Array(384).fill(0),
          metadata: { similarity: 0.9 },
        },
      ];
      const keywordResults: StoredDocument[] = [
        {
          id: 'doc-2',
          content: 'Keyword match content',
          embedding: new Array(384).fill(0),
          metadata: { keywordScore: 0.95 },
        },
      ];

      vi.mocked(mockVectorStore.search).mockResolvedValueOnce(vectorResults);
      
      // Mock keyword search (if implemented)
      const hybridService = new RetrievalService(mockVectorStore, {
        defaultTopK: 5,
        defaultThreshold: 0.7,
        hybridSearch: true,
      });

      // This would combine results from both vector and keyword search
      const results = await hybridService.retrieve(queryEmbedding, {
        query: 'test query',
        hybridAlpha: 0.5, // 50% vector, 50% keyword
      });

      expect(mockVectorStore.search).toHaveBeenCalled();
      // Results would be merged and reranked
    });
  });
});