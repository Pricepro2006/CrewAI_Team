import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EmbeddingService } from './EmbeddingService';
import type { EmbeddingProvider } from './types';

// Mock the Ollama provider
const mockOllamaProvider: EmbeddingProvider = {
  generateEmbedding: vi.fn(),
  generateBatchEmbeddings: vi.fn(),
};

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mocked functions
    vi.mocked(mockOllamaProvider.generateEmbedding).mockReset();
    vi.mocked(mockOllamaProvider.generateBatchEmbeddings).mockReset();
    service = new EmbeddingService(mockOllamaProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('embedText', () => {
    it('should generate embeddings for text', async () => {
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      vi.mocked(mockOllamaProvider.generateEmbedding).mockResolvedValueOnce(mockEmbedding);

      const result = await service.embedText('Hello world');

      expect(mockOllamaProvider.generateEmbedding).toHaveBeenCalledWith('Hello world');
      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(384);
    });

    it('should handle empty text', async () => {
      const mockEmbedding = new Array(384).fill(0);
      vi.mocked(mockOllamaProvider.generateEmbedding).mockResolvedValueOnce(mockEmbedding);

      const result = await service.embedText('');

      expect(result).toEqual(mockEmbedding);
    });

    it('should handle provider errors gracefully', async () => {
      vi.mocked(mockOllamaProvider.generateEmbedding).mockRejectedValueOnce(
        new Error('Provider error')
      );

      await expect(service.embedText('test')).rejects.toThrow('Provider error');
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Hello', 'World', 'Test'];
      const mockEmbeddings = texts.map(() => 
        new Array(384).fill(0).map(() => Math.random())
      );
      vi.mocked(mockOllamaProvider.generateBatchEmbeddings).mockResolvedValueOnce(mockEmbeddings);

      const result = await service.embedBatch(texts);

      expect(mockOllamaProvider.generateBatchEmbeddings).toHaveBeenCalledWith(texts);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(384);
    });

    it('should handle empty batch', async () => {
      vi.mocked(mockOllamaProvider.generateBatchEmbeddings).mockResolvedValueOnce([]);

      const result = await service.embedBatch([]);

      expect(result).toEqual([]);
    });

    it('should fallback to individual embeddings if batch not supported', async () => {
      // Provider without batch support
      const simpleMockProvider: EmbeddingProvider = {
        generateEmbedding: vi.fn(),
      };
      service = new EmbeddingService(simpleMockProvider);

      const texts = ['Text1', 'Text2'];
      const mockEmbeddings = texts.map(() => 
        new Array(384).fill(0).map(() => Math.random())
      );
      
      mockEmbeddings.forEach((embedding, i) => {
        vi.mocked(simpleMockProvider.generateEmbedding)
          .mockResolvedValueOnce(embedding);
      });

      const result = await service.embedBatch(texts);

      expect(simpleMockProvider.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });
  });

  describe('embedDocument', () => {
    it('should embed all chunks in a document', async () => {
      const document = {
        chunks: [
          { content: 'Chunk 1', metadata: { chunkIndex: 0, sourceId: 'doc1' } },
          { content: 'Chunk 2', metadata: { chunkIndex: 1, sourceId: 'doc1' } },
        ],
        metadata: {
          sourceId: 'doc1',
          contentType: 'text/plain' as const,
          totalChunks: 2,
          processedAt: new Date(),
        },
      };

      const mockEmbeddings = document.chunks.map(() => 
        new Array(384).fill(0).map(() => Math.random())
      );
      vi.mocked(mockOllamaProvider.generateBatchEmbeddings).mockResolvedValueOnce(mockEmbeddings);

      const result = await service.embedDocument(document);

      expect(result).toHaveLength(2);
      expect(result[0].chunk).toEqual(document.chunks[0]);
      expect(result[0].embedding).toEqual(mockEmbeddings[0]);
      expect(result[1].chunk).toEqual(document.chunks[1]);
      expect(result[1].embedding).toEqual(mockEmbeddings[1]);
    });

    it('should handle documents with no chunks', async () => {
      const document = {
        chunks: [],
        metadata: {
          sourceId: 'empty-doc',
          contentType: 'text/plain' as const,
          totalChunks: 0,
          processedAt: new Date(),
        },
      };

      const result = await service.embedDocument(document);

      expect(result).toEqual([]);
    });
  });

  describe('similarity calculation', () => {
    it('should calculate cosine similarity correctly', async () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0, 0];
      
      const similarity = await service.calculateSimilarity(embedding1, embedding2);
      
      expect(similarity).toBeCloseTo(1.0, 5); // Same vectors = similarity 1
    });

    it('should handle orthogonal vectors', async () => {
      const embedding1 = [1, 0];
      const embedding2 = [0, 1];
      
      const similarity = await service.calculateSimilarity(embedding1, embedding2);
      
      expect(similarity).toBeCloseTo(0.0, 5); // Orthogonal vectors = similarity 0
    });

    it('should handle opposite vectors', async () => {
      const embedding1 = [1, 0];
      const embedding2 = [-1, 0];
      
      const similarity = await service.calculateSimilarity(embedding1, embedding2);
      
      expect(similarity).toBeCloseTo(-1.0, 5); // Opposite vectors = similarity -1
    });

    it('should handle embeddings of different lengths', async () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0];
      
      await expect(service.calculateSimilarity(embedding1, embedding2))
        .rejects.toThrow('Embeddings must have the same length');
    });

    it('should handle zero vectors', async () => {
      const embedding1 = [0, 0, 0];
      const embedding2 = [1, 0, 0];
      
      const similarity = await service.calculateSimilarity(embedding1, embedding2);
      
      expect(similarity).toBe(0); // Zero vector similarity is 0
    });
  });

  describe('findSimilar', () => {
    it('should find similar embeddings', async () => {
      const queryEmbedding = [1, 0, 0];
      const embeddings = [
        { id: '1', embedding: [0.9, 0.1, 0], metadata: {} },
        { id: '2', embedding: [0, 1, 0], metadata: {} },
        { id: '3', embedding: [1, 0, 0], metadata: {} },
        { id: '4', embedding: [-1, 0, 0], metadata: {} },
      ];

      const results = await service.findSimilar(queryEmbedding, embeddings, { topK: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('3'); // Exact match
      expect(results[0].similarity).toBeCloseTo(1.0, 5);
      expect(results[1].id).toBe('1'); // Close match
      expect(results[1].similarity).toBeGreaterThan(0.9);
    });

    it('should respect similarity threshold', async () => {
      const queryEmbedding = [1, 0, 0];
      const embeddings = [
        { id: '1', embedding: [0.5, 0.5, 0.5], metadata: {} },
        { id: '2', embedding: [0, 1, 0], metadata: {} },
        { id: '3', embedding: [-1, 0, 0], metadata: {} },
      ];

      const results = await service.findSimilar(queryEmbedding, embeddings, {
        topK: 10,
        threshold: 0.5,
      });

      expect(results.every(r => r.similarity >= 0.5)).toBe(true);
    });

    it('should handle empty embeddings list', async () => {
      const queryEmbedding = [1, 0, 0];
      const embeddings: any[] = [];

      const results = await service.findSimilar(queryEmbedding, embeddings);

      expect(results).toEqual([]);
    });

    it('should return all results when topK exceeds available embeddings', async () => {
      const queryEmbedding = [1, 0, 0];
      const embeddings = [
        { id: '1', embedding: [1, 0, 0], metadata: {} },
        { id: '2', embedding: [0, 1, 0], metadata: {} },
      ];

      const results = await service.findSimilar(queryEmbedding, embeddings, { topK: 10 });

      expect(results).toHaveLength(2);
    });
  });

  describe('performance considerations', () => {
    it('should handle large embedding dimensions efficiently', async () => {
      const dimension = 1536; // GPT embedding size
      const embedding1 = new Array(dimension).fill(0).map(() => Math.random());
      const embedding2 = new Array(dimension).fill(0).map(() => Math.random());

      const start = Date.now();
      const similarity = await service.calculateSimilarity(embedding1, embedding2);
      const duration = Date.now() - start;

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should batch process efficiently', async () => {
      const batchSize = 100;
      const texts = new Array(batchSize).fill(0).map((_, i) => `Text ${i}`);
      const mockEmbeddings = texts.map(() => 
        new Array(384).fill(0).map(() => Math.random())
      );
      vi.mocked(mockOllamaProvider.generateBatchEmbeddings).mockResolvedValueOnce(mockEmbeddings);

      const start = Date.now();
      const result = await service.embedBatch(texts);
      const duration = Date.now() - start;

      expect(result).toHaveLength(batchSize);
      expect(mockOllamaProvider.generateBatchEmbeddings).toHaveBeenCalledTimes(1);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });
  });
});