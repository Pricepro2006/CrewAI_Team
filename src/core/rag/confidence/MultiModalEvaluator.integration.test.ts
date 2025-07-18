/**
 * Integration test for MultiModalEvaluator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultiModalEvaluator } from './MultiModalEvaluator';
import type { ScoredDocument } from './types';

describe('MultiModalEvaluator Integration', () => {
  let evaluator: MultiModalEvaluator;

  beforeEach(() => {
    evaluator = new MultiModalEvaluator();
  });

  const createMockContext = () => ({
    query: 'What is TypeScript?',
    response: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
    sources: [
      {
        id: '1',
        content: 'TypeScript is a superset of JavaScript that adds static typing.',
        retrievalScore: 0.9,
        confidenceScore: 0.85,
        source: 'docs',
        metadata: { source: 'typescript-docs' }
      }
    ] as ScoredDocument[],
    generationConfidence: 0.8
  });

  describe('evaluate method', () => {
    it('should perform complete evaluation', async () => {
      const context = createMockContext();
      
      const result = await evaluator.evaluate(
        context.query,
        context.response,
        context.sources,
        context.generationConfidence
      );
      
      // Verify structure
      expect(result).toHaveProperty('factuality');
      expect(result).toHaveProperty('relevance');
      expect(result).toHaveProperty('coherence');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('explanation');
      
      // Verify factuality
      expect(result.factuality).toHaveProperty('score');
      expect(result.factuality.score).toBeGreaterThanOrEqual(0);
      expect(result.factuality.score).toBeLessThanOrEqual(1);
      
      // Verify relevance
      expect(result.relevance).toHaveProperty('score');
      expect(result.relevance.score).toBeGreaterThanOrEqual(0);
      expect(result.relevance.score).toBeLessThanOrEqual(1);
      
      // Verify coherence
      expect(result.coherence).toHaveProperty('score');
      expect(result.coherence.score).toBeGreaterThanOrEqual(0);
      expect(result.coherence.score).toBeLessThanOrEqual(1);
      
      // Verify confidence
      expect(result.confidence).toHaveProperty('raw');
      expect(result.confidence).toHaveProperty('calibrated');
      expect(result.confidence.raw).toBeGreaterThanOrEqual(0);
      expect(result.confidence.raw).toBeLessThanOrEqual(1);
      
      // Verify action
      expect(['accept', 'review', 'fallback']).toContain(result.action);
    });

    it('should handle edge cases gracefully', async () => {
      // Empty response
      const emptyResult = await evaluator.evaluate('', '', [], 0.5);
      expect(emptyResult.action).toBe('fallback');
      
      // No sources
      const noSourcesResult = await evaluator.evaluate(
        'What is TypeScript?',
        'TypeScript is great.',
        [],
        0.5
      );
      expect(noSourcesResult.factuality.score).toBeLessThan(0.5);
    });

    it('should provide explanations', async () => {
      const context = createMockContext();
      
      const result = await evaluator.evaluate(
        context.query,
        context.response,
        context.sources,
        context.generationConfidence
      );
      
      expect(result.explanation).toBeTruthy();
      expect(typeof result.explanation).toBe('string');
      expect(result.explanation.length).toBeGreaterThan(10);
    });
  });
});