/**
 * Unit tests for ConfidenceExtractor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceExtractor } from './ConfidenceExtractor';
import { TokenConfidence } from './types';

describe('ConfidenceExtractor', () => {
  let extractor: ConfidenceExtractor;

  beforeEach(() => {
    extractor = new ConfidenceExtractor();
  });

  describe('logProbToConfidence', () => {
    it('should convert log probabilities to confidence scores', () => {
      // Perfect confidence
      expect(extractor.logProbToConfidence(0)).toBe(1.0);
      
      // No confidence
      expect(extractor.logProbToConfidence(-10)).toBe(0.0);
      
      // Mid-range values
      expect(extractor.logProbToConfidence(-1)).toBeCloseTo(0.378, 2);
      expect(extractor.logProbToConfidence(-2)).toBeCloseTo(0.269, 2);
      expect(extractor.logProbToConfidence(-0.5)).toBeCloseTo(0.438, 2);
    });

    it('should handle edge cases', () => {
      expect(extractor.logProbToConfidence(10)).toBe(1.0);
      expect(extractor.logProbToConfidence(-100)).toBe(0.0);
      expect(extractor.logProbToConfidence(-Infinity)).toBe(0.0);
    });
  });

  describe('extractTokenConfidence', () => {
    it('should extract token confidence correctly', () => {
      const tokens = ['The', 'capital', 'of', 'France', 'is', 'Paris'];
      const logProbs = [-0.1, -0.2, -0.1, -0.3, -0.1, -0.05];

      const result = extractor.extractTokenConfidence(tokens, logProbs);

      expect(result).toHaveLength(6);
      expect(result[0]).toEqual({
        token: 'The',
        logProbability: -0.1,
        confidence: expect.any(Number),
        position: 0
      });
      expect(result[5].token).toBe('Paris');
      expect(result[5].confidence).toBeGreaterThan(result[3].confidence);
    });

    it('should throw error for mismatched lengths', () => {
      const tokens = ['Hello', 'world'];
      const logProbs = [-0.1];

      expect(() => {
        extractor.extractTokenConfidence(tokens, logProbs);
      }).toThrow('Tokens and log probabilities must have the same length');
    });
  });

  describe('aggregateConfidence', () => {
    it('should calculate harmonic mean correctly', () => {
      const tokenConfidences: TokenConfidence[] = [
        { token: 'A', logProbability: -0.1, confidence: 0.9, position: 0 },
        { token: 'B', logProbability: -0.2, confidence: 0.8, position: 1 },
        { token: 'C', logProbability: -0.3, confidence: 0.7, position: 2 }
      ];

      const result = extractor.aggregateConfidence(tokenConfidences);
      
      // Harmonic mean of [0.9, 0.8, 0.7] ≈ 0.792
      expect(result).toBeCloseTo(0.792, 2);
    });

    it('should filter out very low confidence tokens', () => {
      const tokenConfidences: TokenConfidence[] = [
        { token: 'A', logProbability: -0.1, confidence: 0.9, position: 0 },
        { token: 'B', logProbability: -10, confidence: 0.05, position: 1 }, // Should be filtered
        { token: 'C', logProbability: -0.3, confidence: 0.7, position: 2 }
      ];

      const result = extractor.aggregateConfidence(tokenConfidences);
      
      // Should only consider tokens A and C
      expect(result).toBeCloseTo(0.788, 2);
    });

    it('should return 0 for empty array', () => {
      expect(extractor.aggregateConfidence([])).toBe(0);
    });
  });

  describe('calculateWeightedConfidence', () => {
    it('should weight content words higher than stop words', () => {
      const tokenConfidences: TokenConfidence[] = [
        { token: 'The', logProbability: -0.1, confidence: 0.9, position: 0 }, // Stop word
        { token: 'algorithm', logProbability: -0.2, confidence: 0.8, position: 1 }, // Content word
        { token: 'is', logProbability: -0.1, confidence: 0.9, position: 2 }, // Stop word
        { token: 'efficient', logProbability: -0.3, confidence: 0.7, position: 3 } // Content word
      ];

      const weighted = extractor.calculateWeightedConfidence(tokenConfidences);
      const simple = extractor.aggregateConfidence(tokenConfidences);

      // Weighted should be lower due to stop words having lower weight
      expect(weighted).toBeLessThan(simple);
      expect(weighted).toBeCloseTo(0.793, 2);
    });

    it('should assign low weight to punctuation', () => {
      const tokenConfidences: TokenConfidence[] = [
        { token: 'Hello', logProbability: -0.1, confidence: 0.9, position: 0 },
        { token: ',', logProbability: -0.1, confidence: 0.9, position: 1 }, // Punctuation
        { token: 'world', logProbability: -0.2, confidence: 0.8, position: 2 },
        { token: '!', logProbability: -0.1, confidence: 0.9, position: 3 } // Punctuation
      ];

      const result = extractor.calculateWeightedConfidence(tokenConfidences);
      expect(result).toBeCloseTo(0.857, 2);
    });
  });

  describe('detectUncertaintyMarkers', () => {
    it('should detect uncertainty phrases', () => {
      const text = 'I think the answer might be correct, but I\'m not sure.';
      const markers = extractor.detectUncertaintyMarkers(text);

      expect(markers).toContain('i think');
      expect(markers).toContain('might');
      expect(markers).toContain('not sure');
    });

    it('should detect contradictions', () => {
      const text = 'The answer is A. However, it could alternatively be B.';
      const markers = extractor.detectUncertaintyMarkers(text);

      expect(markers).toContain('Contains alternatives or contradictions');
    });

    it('should detect low confidence regions when token data provided', () => {
      const text = 'The answer is definitely maybe.';
      const tokenConfidences: TokenConfidence[] = [
        { token: 'The', logProbability: -0.1, confidence: 0.9, position: 0 },
        { token: 'answer', logProbability: -0.2, confidence: 0.8, position: 1 },
        { token: 'is', logProbability: -2, confidence: 0.3, position: 2 }, // Low
        { token: 'definitely', logProbability: -3, confidence: 0.2, position: 3 }, // Low
        { token: 'maybe', logProbability: -2.5, confidence: 0.25, position: 4 } // Low
      ];

      const markers = extractor.detectUncertaintyMarkers(text, tokenConfidences);
      
      expect(markers).toContain('maybe');
      expect(markers.some(m => m.includes('Low confidence region'))).toBe(true);
    });
  });

  describe('calculateGenerationMetrics', () => {
    it('should calculate metrics correctly', () => {
      const tokenConfidences: TokenConfidence[] = [
        { token: 'A', logProbability: -0.1, confidence: 0.9, position: 0 },
        { token: 'B', logProbability: -0.5, confidence: 0.5, position: 1 }, // Uncertain
        { token: 'C', logProbability: -0.3, confidence: 0.7, position: 2 },
        { token: 'D', logProbability: -1.5, confidence: 0.3, position: 3 } // Uncertain
      ];

      const metrics = extractor.calculateGenerationMetrics(tokenConfidences);

      expect(metrics.tokensGenerated).toBe(4);
      expect(metrics.averageConfidence).toBeCloseTo(0.6, 2);
      expect(metrics.minConfidence).toBe(0.3);
      expect(metrics.maxConfidence).toBe(0.9);
      expect(metrics.uncertaintyRatio).toBe(0.5); // 2 out of 4 tokens
    });

    it('should handle empty input', () => {
      const metrics = extractor.calculateGenerationMetrics([]);

      expect(metrics.tokensGenerated).toBe(0);
      expect(metrics.averageConfidence).toBe(0);
      expect(metrics.uncertaintyRatio).toBe(1);
    });
  });

  describe('estimateConfidenceFromText', () => {
    it('should estimate high confidence for assertive text', () => {
      const text = 'The capital of France is definitely Paris. This is clearly established.';
      const confidence = extractor.estimateConfidenceFromText(text);

      expect(confidence).toBeGreaterThan(0.7);
    });

    it('should estimate low confidence for uncertain text', () => {
      const text = 'I think it might be Paris, but I\'m not sure. Could it be London?';
      const confidence = extractor.estimateConfidenceFromText(text);

      expect(confidence).toBeLessThan(0.5);
    });

    it('should penalize very short responses', () => {
      const text = 'Maybe Paris.';
      const confidence = extractor.estimateConfidenceFromText(text);

      expect(confidence).toBeLessThan(0.6);
    });

    it('should return 0 for empty text', () => {
      expect(extractor.estimateConfidenceFromText('')).toBe(0);
      expect(extractor.estimateConfidenceFromText('   ')).toBe(0);
    });
  });
});