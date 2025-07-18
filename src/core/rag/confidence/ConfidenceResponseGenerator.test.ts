/**
 * Unit tests for ConfidenceResponseGenerator
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ConfidenceResponseGenerator } from './ConfidenceResponseGenerator';
import { OllamaProvider } from '../../llm/OllamaProvider';
import { ConfidenceExtractor } from './ConfidenceExtractor';
import { ConfidenceContextBuilder } from './ConfidenceContextBuilder';
import { ConfidenceContext } from './types';

// Mock dependencies
vi.mock('../../llm/OllamaProvider');
vi.mock('./ConfidenceExtractor');
vi.mock('./ConfidenceContextBuilder');

describe('ConfidenceResponseGenerator', () => {
  let generator: ConfidenceResponseGenerator;
  let mockOllamaProvider: OllamaProvider;
  let mockConfidenceExtractor: ConfidenceExtractor;
  let mockContextBuilder: ConfidenceContextBuilder;

  const createMockContext = (): ConfidenceContext => ({
    query: 'What is TypeScript?',
    documents: [
      {
        id: '1',
        content: 'TypeScript is a superset of JavaScript',
        retrievalScore: 0.9,
        confidenceScore: 0.85,
        source: 'docs',
        metadata: {}
      }
    ],
    retrievalConfidence: 0.8,
    queryComplexity: 3
  });

  beforeEach(() => {
    mockOllamaProvider = new OllamaProvider({ model: 'test' });
    generator = new ConfidenceResponseGenerator(mockOllamaProvider);

    // Get mocked instances
    mockConfidenceExtractor = (generator as any).confidenceExtractor;
    mockContextBuilder = (generator as any).contextBuilder;

    // Setup default mock behaviors
    (mockContextBuilder.buildSpecializedContext as Mock).mockReturnValue(
      'CONTEXT: TypeScript is a superset of JavaScript'
    );

    (mockOllamaProvider.generateWithLogProbs as Mock).mockResolvedValue({
      text: 'TypeScript is a statically typed superset of JavaScript.',
      tokens: ['TypeScript', 'is', 'a', 'statically', 'typed', 'superset', 'of', 'JavaScript', '.'],
      logProbs: [-0.1, -0.1, -0.1, -0.3, -0.2, -0.2, -0.1, -0.1, -0.1],
      metadata: {
        model: 'test',
        duration: 1000,
        tokenCount: 9
      }
    });

    (mockOllamaProvider.generate as Mock).mockResolvedValue(
      'TypeScript is a statically typed superset of JavaScript.'
    );

    (mockConfidenceExtractor.extractTokenConfidence as Mock).mockReturnValue([
      { token: 'TypeScript', logProbability: -0.1, confidence: 0.9, position: 0 },
      { token: 'is', logProbability: -0.1, confidence: 0.9, position: 1 }
    ]);

    (mockConfidenceExtractor.aggregateConfidence as Mock).mockReturnValue(0.85);
    (mockConfidenceExtractor.detectUncertaintyMarkers as Mock).mockReturnValue([]);
    (mockConfidenceExtractor.calculateGenerationMetrics as Mock).mockReturnValue({
      tokensGenerated: 9,
      averageConfidence: 0.85,
      minConfidence: 0.7,
      maxConfidence: 0.9,
      uncertaintyRatio: 0.1
    });
    (mockConfidenceExtractor.estimateConfidenceFromText as Mock).mockReturnValue(0.8);
  });

  describe('generateWithConfidence', () => {
    it('should generate response with log probabilities when available', async () => {
      const context = createMockContext();
      const result = await generator.generateWithConfidence(context);

      expect(result.response).toBe('TypeScript is a statically typed superset of JavaScript.');
      expect(result.aggregatedConfidence).toBe(0.85);
      expect(result.tokenLevelConfidence).toHaveLength(2);
      expect(result.uncertaintyMarkers).toHaveLength(0);
      expect(result.generationMetrics.tokensGenerated).toBe(9);
    });

    it('should fall back to standard generation when log probs disabled', async () => {
      const context = createMockContext();
      const result = await generator.generateWithConfidence(context, {
        extractConfidence: false
      });

      expect(mockOllamaProvider.generate).toHaveBeenCalled();
      expect(result.aggregatedConfidence).toBe(0.8); // Estimated
      expect(result.tokenLevelConfidence).toHaveLength(0);
    });

    it('should adjust temperature based on confidence', async () => {
      const lowConfidenceContext: ConfidenceContext = {
        ...createMockContext(),
        retrievalConfidence: 0.4
      };

      await generator.generateWithConfidence(lowConfidenceContext, {
        temperature: 0.8
      });

      // Should reduce temperature for low confidence
      const calls = (mockOllamaProvider.generateWithLogProbs as Mock).mock.calls;
      expect(calls).toHaveLength(1);
      const [, options] = calls[0];
      expect(options.temperature).toBeLessThan(0.8);
    });

    it('should handle complex queries with lower temperature', async () => {
      const complexContext: ConfidenceContext = {
        ...createMockContext(),
        queryComplexity: 9
      };

      await generator.generateWithConfidence(complexContext, {
        temperature: 0.8
      });

      const calls = (mockOllamaProvider.generateWithLogProbs as Mock).mock.calls;
      expect(calls).toHaveLength(1);
      const [, options] = calls[0];
      expect(options.temperature).toBeLessThan(0.8);
    });

    it('should use specialized context based on response type', async () => {
      const context = createMockContext();
      await generator.generateWithConfidence(context, {
        responseType: 'factual'
      });

      expect(mockContextBuilder.buildSpecializedContext).toHaveBeenCalledWith(
        context.documents,
        context.query,
        'factual'
      );
    });

    it('should handle generation errors gracefully', async () => {
      (mockOllamaProvider.generateWithLogProbs as Mock).mockRejectedValue(
        new Error('Generation failed')
      );

      const context = createMockContext();
      const result = await generator.generateWithConfidence(context);

      expect(result.response).toContain('I encountered an issue');
      expect(result.aggregatedConfidence).toBe(0.3); // Low confidence for fallback
      expect(result.uncertaintyMarkers).toContain('generation_failed');
    });

    it('should generate appropriate fallback for empty documents', async () => {
      const emptyContext: ConfidenceContext = {
        ...createMockContext(),
        documents: []
      };

      (mockOllamaProvider.generateWithLogProbs as Mock).mockRejectedValue(
        new Error('No context')
      );

      const result = await generator.generateWithConfidence(emptyContext);

      expect(result.response).toContain("couldn't find relevant information");
      expect(result.aggregatedConfidence).toBe(0.3);
    });

    it('should generate appropriate fallback for low confidence retrieval', async () => {
      const lowConfContext: ConfidenceContext = {
        ...createMockContext(),
        retrievalConfidence: 0.2
      };

      (mockOllamaProvider.generateWithLogProbs as Mock).mockRejectedValue(
        new Error('Low confidence')
      );

      const result = await generator.generateWithConfidence(lowConfContext);

      expect(result.response).toContain('relevance is quite low');
      expect(result.aggregatedConfidence).toBe(0.3);
    });
  });

  describe('prompt building', () => {
    it('should build high confidence instructions', async () => {
      const highConfContext: ConfidenceContext = {
        ...createMockContext(),
        retrievalConfidence: 0.9
      };

      await generator.generateWithConfidence(highConfContext);

      const promptCall = (mockOllamaProvider.generateWithLogProbs as Mock).mock.calls[0][0];
      expect(promptCall).toContain('highly relevant sources');
      expect(promptCall).toContain('confident, detailed response');
    });

    it('should build medium confidence instructions', async () => {
      const medConfContext: ConfidenceContext = {
        ...createMockContext(),
        retrievalConfidence: 0.65
      };

      await generator.generateWithConfidence(medConfContext);

      const promptCall = (mockOllamaProvider.generateWithLogProbs as Mock).mock.calls[0][0];
      expect(promptCall).toContain('moderately relevant');
      expect(promptCall).toContain('balanced response');
    });

    it('should build low confidence instructions', async () => {
      const lowConfContext: ConfidenceContext = {
        ...createMockContext(),
        retrievalConfidence: 0.3
      };

      await generator.generateWithConfidence(lowConfContext);

      const promptCall = (mockOllamaProvider.generateWithLogProbs as Mock).mock.calls[0][0];
      expect(promptCall).toContain('limited relevance');
      expect(promptCall).toContain('Be cautious');
    });

    it('should add complexity instructions for complex queries', async () => {
      const complexContext: ConfidenceContext = {
        ...createMockContext(),
        queryComplexity: 8
      };

      await generator.generateWithConfidence(complexContext);

      const promptCall = (mockOllamaProvider.generateWithLogProbs as Mock).mock.calls[0][0];
      expect(promptCall).toContain('complex query');
      expect(promptCall).toContain('clear sections');
    });
  });

  describe('postProcessResponse', () => {
    const mockResult = {
      response: 'This is the response.',
      tokenLevelConfidence: [],
      aggregatedConfidence: 0.8,
      uncertaintyMarkers: [],
      generationMetrics: {
        tokensGenerated: 4,
        averageConfidence: 0.8,
        minConfidence: 0.8,
        maxConfidence: 0.8,
        uncertaintyRatio: 0
      }
    };

    it('should return plain response when indicators disabled', () => {
      const processed = generator.postProcessResponse(mockResult, false);
      expect(processed).toBe('This is the response.');
    });

    it('should add high confidence prefix', () => {
      const highConfResult = { ...mockResult, aggregatedConfidence: 0.85 };
      const processed = generator.postProcessResponse(highConfResult, true);
      
      expect(processed).toContain('✅ High Confidence Response:');
      expect(processed).toContain('This is the response.');
    });

    it('should add medium confidence prefix', () => {
      const medConfResult = { ...mockResult, aggregatedConfidence: 0.65 };
      const processed = generator.postProcessResponse(medConfResult, true);
      
      expect(processed).toContain('ℹ️ Moderate Confidence Response:');
    });

    it('should add low confidence prefix', () => {
      const lowConfResult = { ...mockResult, aggregatedConfidence: 0.45 };
      const processed = generator.postProcessResponse(lowConfResult, true);
      
      expect(processed).toContain('⚠️ Low Confidence Response:');
    });

    it('should add very low confidence prefix', () => {
      const veryLowConfResult = { ...mockResult, aggregatedConfidence: 0.25 };
      const processed = generator.postProcessResponse(veryLowConfResult, true);
      
      expect(processed).toContain('❗ Very Low Confidence Response:');
    });

    it('should add uncertainty warning when needed', () => {
      const uncertainResult = {
        ...mockResult,
        aggregatedConfidence: 0.5,
        uncertaintyMarkers: ['maybe', 'possibly', 'uncertain']
      };
      const processed = generator.postProcessResponse(uncertainResult, true);
      
      expect(processed).toContain('⚠️ Note: This response contains some uncertainty');
      expect(processed).toContain('3 uncertainty markers were detected');
    });
  });

  describe('analyzeResponseQuality', () => {
    it('should analyze high quality response', () => {
      const result = {
        response: 'Clear and confident response.',
        tokenLevelConfidence: [],
        aggregatedConfidence: 0.9,
        uncertaintyMarkers: [],
        generationMetrics: {
          tokensGenerated: 4,
          averageConfidence: 0.9,
          minConfidence: 0.85,
          maxConfidence: 0.95,
          uncertaintyRatio: 0.05
        }
      };

      const analysis = generator.analyzeResponseQuality(result);

      expect(analysis.hasUncertainty).toBe(false);
      expect(analysis.uncertaintyLevel).toBe('none');
      expect(analysis.suggestsHumanReview).toBe(false);
      expect(analysis.qualityScore).toBeGreaterThan(0.8);
    });

    it('should detect low uncertainty', () => {
      const result = {
        response: 'Response with slight uncertainty.',
        tokenLevelConfidence: [],
        aggregatedConfidence: 0.7,
        uncertaintyMarkers: ['possibly'],
        generationMetrics: {
          tokensGenerated: 5,
          averageConfidence: 0.7,
          minConfidence: 0.6,
          maxConfidence: 0.8,
          uncertaintyRatio: 0.15
        }
      };

      const analysis = generator.analyzeResponseQuality(result);

      expect(analysis.hasUncertainty).toBe(true);
      expect(analysis.uncertaintyLevel).toBe('low');
      expect(analysis.suggestsHumanReview).toBe(false);
    });

    it('should suggest human review for low confidence', () => {
      const result = {
        response: 'Very uncertain response.',
        tokenLevelConfidence: [],
        aggregatedConfidence: 0.35,
        uncertaintyMarkers: ['maybe', 'possibly'],  // Reduced to 2 markers
        generationMetrics: {
          tokensGenerated: 4,
          averageConfidence: 0.35,
          minConfidence: 0.2,
          maxConfidence: 0.5,
          uncertaintyRatio: 0.35  // Reduced below 0.4
        }
      };

      const analysis = generator.analyzeResponseQuality(result);

      expect(analysis.hasUncertainty).toBe(true);
      expect(analysis.uncertaintyLevel).toBe('medium');
      expect(analysis.suggestsHumanReview).toBe(true);
      expect(analysis.qualityScore).toBeLessThan(0.5);
    });

    it('should detect high uncertainty', () => {
      const result = {
        response: 'Very uncertain response with many markers.',
        tokenLevelConfidence: [],
        aggregatedConfidence: 0.5,
        uncertaintyMarkers: ['maybe', 'possibly', 'might', 'could be', 'uncertain', 'not sure'],
        generationMetrics: {
          tokensGenerated: 8,
          averageConfidence: 0.5,
          minConfidence: 0.3,
          maxConfidence: 0.7,
          uncertaintyRatio: 0.5
        }
      };

      const analysis = generator.analyzeResponseQuality(result);

      expect(analysis.uncertaintyLevel).toBe('high');
      expect(analysis.suggestsHumanReview).toBe(true);
    });
  });

  describe('temperature adjustment', () => {
    it('should maintain temperature for high confidence', async () => {
      const context: ConfidenceContext = {
        ...createMockContext(),
        retrievalConfidence: 0.85,
        queryComplexity: 4
      };

      await generator.generateWithConfidence(context, {
        temperature: 0.7
      });

      expect(mockOllamaProvider.generateWithLogProbs).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.7 // No adjustment needed
        })
      );
    });

    it('should cap temperature at maximum', async () => {
      const context = createMockContext();

      await generator.generateWithConfidence(context, {
        temperature: 1.5 // Too high
      });

      expect(mockOllamaProvider.generateWithLogProbs).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 1.0 // Capped
        })
      );
    });

    it('should ensure minimum temperature', async () => {
      const context: ConfidenceContext = {
        ...createMockContext(),
        retrievalConfidence: 0.3,
        queryComplexity: 9
      };

      await generator.generateWithConfidence(context, {
        temperature: 0.2
      });

      const calls = (mockOllamaProvider.generateWithLogProbs as Mock).mock.calls;
      expect(calls).toHaveLength(1);
      const [, options] = calls[0];
      // Should be close to minimum (0.1) but allow for calculation precision
      expect(options.temperature).toBeGreaterThanOrEqual(0.1);
      expect(options.temperature).toBeLessThan(0.15);
    });
  });
});