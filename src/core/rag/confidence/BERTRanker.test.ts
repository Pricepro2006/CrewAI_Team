/**
 * Unit tests for BERTRanker
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BERTRanker } from './BERTRanker';
import { ScoredDocument } from './types';

// Mock the @xenova/transformers module
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
  env: {
    allowRemoteModels: true,
    localURL: '/models/'
  }
}));

describe('BERTRanker', () => {
  let ranker: BERTRanker;
  let mockPipeline: any;

  beforeEach(() => {
    ranker = new BERTRanker();
    
    // Setup mock pipeline
    mockPipeline = vi.fn().mockImplementation(async (text: string) => {
      // Return mock embeddings based on text content
      const embedding = new Float32Array(384); // Typical BERT embedding size
      
      // Create different embeddings for different texts
      const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = Math.sin(hash + i) * 0.5 + 0.5;
      }
      
      return { data: embedding };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with mock pipeline', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      
      expect(ranker.isAvailable()).toBe(true);
      expect(pipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/ms-marco-MiniLM-L-6-v2',
        { quantized: true }
      );
    });

    it('should handle initialization failure gracefully', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockRejectedValue(new Error('Model loading failed'));

      await expect(ranker.initialize()).rejects.toThrow('BERT initialization failed');
      expect(ranker.isAvailable()).toBe(false);
    });

    it('should only initialize once', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      await ranker.initialize(); // Second call

      expect(pipeline).toHaveBeenCalledTimes(1);
    });
  });

  describe('rerank', () => {
    const createMockDocuments = (): ScoredDocument[] => [
      {
        id: '1',
        content: 'Machine learning is a subset of artificial intelligence',
        retrievalScore: 0.7,
        confidenceScore: 0.75,
        source: 'doc1',
        metadata: { source: 'wiki', sourceId: '1' }
      },
      {
        id: '2',
        content: 'Deep learning uses neural networks with multiple layers',
        retrievalScore: 0.8,
        confidenceScore: 0.85,
        source: 'doc2',
        metadata: { source: 'wiki', sourceId: '2' }
      },
      {
        id: '3',
        content: 'Python is a popular programming language',
        retrievalScore: 0.6,
        confidenceScore: 0.65,
        source: 'doc3',
        metadata: { source: 'wiki', sourceId: '3' }
      }
    ];

    it('should rerank documents based on semantic similarity', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      
      const query = 'What is deep learning?';
      const documents = createMockDocuments();
      
      const results = await ranker.rerank(query, documents);

      expect(results).toHaveLength(3);
      expect(results[0].document.id).toBeDefined();
      expect(results[0].semanticScore).toBeGreaterThan(0);
      expect(results[0].combinedScore).toBeGreaterThan(0);
      
      // Results should be sorted by combined score
      expect(results[0].combinedScore).toBeGreaterThanOrEqual(results[1].combinedScore);
      expect(results[1].combinedScore).toBeGreaterThanOrEqual(results[2].combinedScore);
    });

    it('should respect topK parameter', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      
      const documents = createMockDocuments();
      const results = await ranker.rerank('query', documents, 2);

      expect(results).toHaveLength(2);
    });

    it('should handle empty document list', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      
      const results = await ranker.rerank('query', []);

      expect(results).toHaveLength(0);
    });

    it('should fallback gracefully when pipeline fails', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      
      // Make pipeline throw error
      mockPipeline.mockRejectedValue(new Error('Embedding failed'));
      
      const documents = createMockDocuments();
      const results = await ranker.rerank('query', documents);

      // Should return original documents with retrieval scores
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.semanticScore).toBe(documents[index].retrievalScore);
        expect(result.combinedScore).toBe(documents[index].retrievalScore);
      });
    });

    it('should work without initialization (fallback mode)', async () => {
      const documents = createMockDocuments();
      const results = await ranker.rerank('query', documents);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.document).toBe(documents[index]);
        expect(result.semanticScore).toBe(documents[index].retrievalScore);
      });
    });
  });

  describe('calculateRerankingConfidence', () => {
    it('should calculate high confidence for well-separated scores', () => {
      const results = [
        { document: {} as ScoredDocument, semanticScore: 0.9, combinedScore: 0.85 },
        { document: {} as ScoredDocument, semanticScore: 0.7, combinedScore: 0.65 },
        { document: {} as ScoredDocument, semanticScore: 0.4, combinedScore: 0.35 }
      ];

      const confidence = ranker.calculateRerankingConfidence(results);
      
      expect(confidence).toBeGreaterThan(0.7);
    });

    it('should calculate low confidence for similar scores', () => {
      const results = [
        { document: {} as ScoredDocument, semanticScore: 0.5, combinedScore: 0.52 },
        { document: {} as ScoredDocument, semanticScore: 0.5, combinedScore: 0.51 },
        { document: {} as ScoredDocument, semanticScore: 0.5, combinedScore: 0.50 }
      ];

      const confidence = ranker.calculateRerankingConfidence(results);
      
      expect(confidence).toBeLessThan(0.5);
    });

    it('should return 0 for empty results', () => {
      const confidence = ranker.calculateRerankingConfidence([]);
      
      expect(confidence).toBe(0);
    });
  });

  describe('batchRerank', () => {
    it('should process multiple queries efficiently', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      
      const queries = ['query1', 'query2'];
      const documentSets = [
        [
          { id: '1', content: 'doc1', retrievalScore: 0.8, confidenceScore: 0.8, source: 's1', metadata: {} } as ScoredDocument,
          { id: '2', content: 'doc2', retrievalScore: 0.6, confidenceScore: 0.6, source: 's2', metadata: {} } as ScoredDocument
        ],
        [
          { id: '3', content: 'doc3', retrievalScore: 0.7, confidenceScore: 0.7, source: 's3', metadata: {} } as ScoredDocument,
          { id: '4', content: 'doc4', retrievalScore: 0.5, confidenceScore: 0.5, source: 's4', metadata: {} } as ScoredDocument
        ]
      ];

      const results = await ranker.batchRerank(queries, documentSets);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveLength(2);
      expect(results[1]).toHaveLength(2);
    });

    it('should throw error for mismatched arrays', async () => {
      await expect(
        ranker.batchRerank(['query1'], [[], [], []])
      ).rejects.toThrow('Number of queries must match number of document sets');
    });
  });

  describe('getModelInfo', () => {
    it('should return correct model information', () => {
      const info = ranker.getModelInfo();
      
      expect(info.name).toBe('Xenova/ms-marco-MiniLM-L-6-v2');
      expect(info.initialized).toBe(false);
      expect(info.type).toBe('feature-extraction');
    });
  });

  describe('dispose', () => {
    it('should cleanup resources', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      expect(ranker.isAvailable()).toBe(true);

      await ranker.dispose();
      expect(ranker.isAvailable()).toBe(false);
    });
  });

  describe('score combination', () => {
    it('should properly combine scores with geometric mean', async () => {
      const { pipeline } = await import('@xenova/transformers');
      (pipeline as any).mockResolvedValue(mockPipeline);

      await ranker.initialize();
      
      // Create documents with known scores
      const documents: ScoredDocument[] = [
        {
          id: '1',
          content: 'Test document',
          retrievalScore: 0.8,
          confidenceScore: 0.8,
          source: 'test',
          metadata: {}
        }
      ];

      const results = await ranker.rerank('test query', documents);
      
      // Combined score should be between retrieval and semantic scores
      expect(results[0].combinedScore).toBeGreaterThan(0);
      expect(results[0].combinedScore).toBeLessThanOrEqual(1);
    });
  });
});