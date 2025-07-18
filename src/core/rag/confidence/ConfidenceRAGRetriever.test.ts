/**
 * Unit tests for ConfidenceRAGRetriever
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ConfidenceRAGRetriever } from './ConfidenceRAGRetriever';
import { VectorStore } from '../VectorStore';
import { BERTRanker } from './BERTRanker';
import { QueryComplexityAnalyzer } from './QueryComplexityAnalyzer';

// Mock dependencies
vi.mock('../VectorStore');
vi.mock('./BERTRanker');
vi.mock('./QueryComplexityAnalyzer');

describe('ConfidenceRAGRetriever', () => {
  let retriever: ConfidenceRAGRetriever;
  let mockVectorStore: VectorStore;
  let mockBERTRanker: BERTRanker;
  let mockQueryAnalyzer: QueryComplexityAnalyzer;

  beforeEach(() => {
    // Create mock instances
    mockVectorStore = new VectorStore({} as any);
    retriever = new ConfidenceRAGRetriever(mockVectorStore);

    // Get mock instances from the retriever
    mockBERTRanker = (retriever as any).bertRanker;
    mockQueryAnalyzer = (retriever as any).queryAnalyzer;

    // Setup default mock behaviors
    (mockQueryAnalyzer.assessComplexity as Mock).mockReturnValue({
      score: 5,
      factors: {
        length: 3,
        technicalDepth: 5,
        multiIntent: 4,
        ambiguity: 2,
        domainSpecificity: 6
      },
      analysis: {
        wordCount: 10,
        sentenceCount: 1,
        technicalTerms: ['API', 'REST'],
        detectedIntents: ['question:explanatory'],
        domains: ['technical'],
        questionType: 'explanatory',
        ambiguousTerms: []
      }
    });

    (mockVectorStore.query as Mock).mockResolvedValue([
      {
        id: '1',
        content: 'REST API is a web service architecture',
        score: 0.85,
        metadata: { source: 'docs', chunk: 1 }
      },
      {
        id: '2',
        content: 'GraphQL is an alternative to REST',
        score: 0.75,
        metadata: { source: 'docs', chunk: 2 }
      },
      {
        id: '3',
        content: 'API design patterns for microservices',
        score: 0.65,
        metadata: { source: 'docs', chunk: 3 }
      }
    ]);

    (mockBERTRanker.isAvailable as Mock).mockReturnValue(false);
    (mockBERTRanker.initialize as Mock).mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should initialize BERT ranker', async () => {
      await retriever.initialize();
      
      expect(mockBERTRanker.initialize).toHaveBeenCalled();
    });

    it('should handle BERT initialization failure gracefully', async () => {
      (mockBERTRanker.initialize as Mock).mockRejectedValue(new Error('Init failed'));
      
      // Should not throw
      await expect(retriever.initialize()).resolves.toBeUndefined();
    });
  });

  describe('retrieve', () => {
    it('should perform basic retrieval successfully', async () => {
      const query = 'What is REST API?';
      const result = await retriever.retrieve(query);

      expect(result.processedQuery).toBe(query);
      expect(result.queryComplexity).toBe(5);
      expect(result.expectedDomains).toContain('technical');
      expect(result.documents).toHaveLength(3);
      expect(result.retrievalConfidence).toBeGreaterThan(0);
    });

    it('should filter documents by minimum confidence', async () => {
      const result = await retriever.retrieve('query', {
        minScore: 0.7
      });

      // Should filter out document with score 0.65
      expect(result.documents).toHaveLength(2);
      expect(result.documents.every(d => d.retrievalScore >= 0.7)).toBe(true);
    });

    it('should adjust topK based on query complexity', async () => {
      // Simple query
      (mockQueryAnalyzer.assessComplexity as Mock).mockReturnValueOnce({
        score: 2,
        analysis: { domains: [] }
      });

      await retriever.retrieve('simple query');
      expect(mockVectorStore.query).toHaveBeenCalledWith('simple query', 10); // topK * 2

      // Complex query
      (mockQueryAnalyzer.assessComplexity as Mock).mockReturnValueOnce({
        score: 8,
        analysis: { domains: [] }
      });

      await retriever.retrieve('complex query');
      expect(mockVectorStore.query).toHaveBeenCalledWith('complex query', 16); // topK=8 * 2
    });

    it('should use BERT reranking when available and enabled', async () => {
      (mockBERTRanker.isAvailable as Mock).mockReturnValue(true);
      (mockBERTRanker.rerank as Mock).mockResolvedValue([
        {
          document: {
            id: '2',
            content: 'GraphQL is an alternative to REST',
            retrievalScore: 0.75,
            confidenceScore: 0.75,
            source: 'docs',
            metadata: {}
          },
          semanticScore: 0.9,
          combinedScore: 0.82
        }
      ]);

      const result = await retriever.retrieve('query', {
        useBERTReranking: true
      });

      expect(mockBERTRanker.rerank).toHaveBeenCalled();
      expect(result.documents[0].id).toBe('2'); // Reranked document
    });

    it('should filter low quality documents', async () => {
      (mockVectorStore.query as Mock).mockResolvedValue([
        {
          id: '1',
          content: 'Good content with sufficient length and variety',
          score: 0.8,
          metadata: {}
        },
        {
          id: '2',
          content: 'Too short', // Less than 50 chars
          score: 0.75,
          metadata: {}
        },
        {
          id: '3',
          content: 'spam spam spam spam spam spam spam spam spam', // Repetitive
          score: 0.7,
          metadata: {}
        }
      ]);

      const result = await retriever.retrieve('query');

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].id).toBe('1');
    });

    it('should handle empty retrieval results', async () => {
      (mockVectorStore.query as Mock).mockResolvedValue([]);

      const result = await retriever.retrieve('query');

      expect(result.documents).toHaveLength(0);
      expect(result.retrievalConfidence).toBe(0);
    });

    it('should handle vector store errors', async () => {
      (mockVectorStore.query as Mock).mockRejectedValue(new Error('Store error'));

      const result = await retriever.retrieve('query');

      expect(result.documents).toHaveLength(0);
      expect(result.retrievalConfidence).toBe(0);
    });
  });

  describe('batchRetrieve', () => {
    it('should process multiple queries', async () => {
      const queries = ['query1', 'query2', 'query3'];
      const results = await retriever.batchRetrieve(queries);

      expect(results).toHaveLength(3);
      expect(mockVectorStore.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('getRetrievalStats', () => {
    it('should calculate statistics correctly', async () => {
      const result = await retriever.retrieve('query');
      const stats = retriever.getRetrievalStats(result);

      expect(stats.totalDocuments).toBe(3);
      expect(stats.avgConfidence).toBeCloseTo(0.75, 2);
      expect(stats.maxConfidence).toBe(0.85);
      expect(stats.minConfidence).toBe(0.65);
      expect(stats.confidenceDistribution).toEqual({
        low: 0,
        medium: 1, // 0.65
        high: 2  // 0.85 and 0.75
      });
    });

    it('should handle empty results', async () => {
      (mockVectorStore.query as Mock).mockResolvedValue([]);
      
      const result = await retriever.retrieve('query');
      const stats = retriever.getRetrievalStats(result);

      expect(stats.totalDocuments).toBe(0);
      expect(stats.avgConfidence).toBe(0);
      expect(stats.confidenceDistribution).toEqual({
        low: 0,
        medium: 0,
        high: 0
      });
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      retriever.updateConfig({
        retrieval: {
          minimum: 0.8,
          preferred: 0.9
        }
      });

      // Verify by checking filtering behavior
      retriever.retrieve('query', { minScore: undefined }).then(result => {
        expect(result.documents.every(d => d.retrievalScore >= 0.8)).toBe(true);
      });
    });
  });

  describe('retrieval confidence calculation', () => {
    it('should calculate high confidence for good results', async () => {
      (mockVectorStore.query as Mock).mockResolvedValue([
        { id: '1', content: 'High quality result', score: 0.95, metadata: {} },
        { id: '2', content: 'Another good result', score: 0.90, metadata: {} },
        { id: '3', content: 'Third good result', score: 0.85, metadata: {} }
      ]);

      const result = await retriever.retrieve('query');
      
      expect(result.retrievalConfidence).toBeGreaterThan(0.8);
    });

    it('should calculate low confidence for poor results', async () => {
      (mockVectorStore.query as Mock).mockResolvedValue([
        { id: '1', content: 'Marginal result', score: 0.61, metadata: {} }
      ]);

      const result = await retriever.retrieve('query');
      
      expect(result.retrievalConfidence).toBeLessThan(0.5);
    });

    it('should penalize high complexity queries', async () => {
      (mockQueryAnalyzer.assessComplexity as Mock).mockReturnValue({
        score: 9,
        analysis: { domains: [] }
      });

      const result = await retriever.retrieve('very complex query');
      
      // Confidence should be reduced due to complexity
      expect(result.retrievalConfidence).toBeLessThan(0.7);
    });
  });

  describe('isBERTRankingAvailable', () => {
    it('should return BERT availability status', () => {
      (mockBERTRanker.isAvailable as Mock).mockReturnValue(true);
      expect(retriever.isBERTRankingAvailable()).toBe(true);

      (mockBERTRanker.isAvailable as Mock).mockReturnValue(false);
      expect(retriever.isBERTRankingAvailable()).toBe(false);
    });
  });
});