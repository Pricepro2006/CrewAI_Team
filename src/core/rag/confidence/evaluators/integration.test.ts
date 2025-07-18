/**
 * Integration tests for confidence evaluators
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FactualityChecker } from './FactualityChecker';
import { RelevanceScorer } from './RelevanceScorer';
import { CoherenceAnalyzer } from './CoherenceAnalyzer';
import type { ScoredDocument } from '../types';

describe('Confidence Evaluators Integration', () => {
  let factualityChecker: FactualityChecker;
  let relevanceScorer: RelevanceScorer;
  let coherenceAnalyzer: CoherenceAnalyzer;

  beforeEach(() => {
    factualityChecker = new FactualityChecker();
    relevanceScorer = new RelevanceScorer();
    coherenceAnalyzer = new CoherenceAnalyzer();
  });

  const createMockDocuments = (): ScoredDocument[] => [
    {
      id: '1',
      content: 'TypeScript is a superset of JavaScript that adds static typing.',
      retrievalScore: 0.9,
      confidenceScore: 0.85,
      source: 'docs',
      metadata: { source: 'typescript-docs' }
    }
  ];

  describe('FactualityChecker', () => {
    it('should have checkFactuality method', () => {
      expect(factualityChecker).toHaveProperty('checkFactuality');
      expect(typeof factualityChecker.checkFactuality).toBe('function');
    });

    it('should return factuality score', () => {
      const response = 'TypeScript is a superset of JavaScript.';
      const sources = createMockDocuments();
      
      const result = factualityChecker.checkFactuality(response, sources);
      
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('score');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('RelevanceScorer', () => {
    it('should have calculateRelevance method', () => {
      expect(relevanceScorer).toHaveProperty('calculateRelevance');
      expect(typeof relevanceScorer.calculateRelevance).toBe('function');
    });

    it('should return relevance result', () => {
      const query = 'What is TypeScript?';
      const response = 'TypeScript is a programming language.';
      const sources = createMockDocuments();
      
      const result = relevanceScorer.calculateRelevance(query, response, sources);
      
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('semanticSimilarity');
      expect(result).toHaveProperty('termCoverage');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('CoherenceAnalyzer', () => {
    it('should have evaluateCoherence method', () => {
      expect(coherenceAnalyzer).toHaveProperty('evaluateCoherence');
      expect(typeof coherenceAnalyzer.evaluateCoherence).toBe('function');
    });

    it('should return coherence result', () => {
      const response = 'TypeScript is a programming language. It adds static typing to JavaScript.';
      
      const result = coherenceAnalyzer.evaluateCoherence(response);
      
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('metrics');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('Combined evaluation', () => {
    it('should work together for complete evaluation', () => {
      const query = 'What is TypeScript?';
      const response = 'TypeScript is a superset of JavaScript that adds static typing. It helps catch errors at compile time.';
      const sources = createMockDocuments();
      
      // Run all evaluators
      const factuality = factualityChecker.checkFactuality(response, sources);
      const relevance = relevanceScorer.calculateRelevance(query, response, sources);
      const coherence = coherenceAnalyzer.evaluateCoherence(response);
      
      // All should return valid scores
      expect(factuality.score).toBeGreaterThan(0.5);
      expect(relevance.score).toBeGreaterThan(0.5);
      expect(coherence.score).toBeGreaterThan(0.5);
      
      // Calculate combined score
      const combinedScore = (factuality.score + relevance.score + coherence.score) / 3;
      expect(combinedScore).toBeGreaterThan(0.5);
    });
  });
});