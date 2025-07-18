/**
 * Unit tests for MultiModalEvaluator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiModalEvaluator } from './MultiModalEvaluator';
import { FactualityChecker } from './evaluators/FactualityChecker';
import { RelevanceScorer } from './evaluators/RelevanceScorer';
import { CoherenceAnalyzer } from './evaluators/CoherenceAnalyzer';
import type { ResponseEvaluationResult, ScoredDocument } from './types';

// Mock the evaluator modules
vi.mock('./evaluators/FactualityChecker');
vi.mock('./evaluators/RelevanceScorer');
vi.mock('./evaluators/CoherenceAnalyzer');

describe('MultiModalEvaluator', () => {
  let evaluator: MultiModalEvaluator;
  let mockFactualityChecker: any;
  let mockRelevanceScorer: any;
  let mockCoherenceAnalyzer: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock implementations
    mockFactualityChecker = {
      checkFactuality: vi.fn().mockReturnValue(0.8),
      calculateSupport: vi.fn().mockReturnValue({
        supportScore: 0.8,
        supportedClaims: 3,
        totalClaims: 4,
        unsupportedClaims: ['Some unsupported claim']
      })
    };

    mockRelevanceScorer = {
      scoreRelevance: vi.fn().mockReturnValue(0.85),
      assessQueryCoverage: vi.fn().mockReturnValue({
        coverageScore: 0.9,
        coveredTerms: ['typescript', 'types'],
        missedTerms: [],
        queryTerms: ['typescript', 'types'],
        coverageRatio: 1.0
      })
    };

    mockCoherenceAnalyzer = {
      analyzeCoherence: vi.fn().mockReturnValue(0.75),
      getCoherenceBreakdown: vi.fn().mockReturnValue({
        logicalFlow: { flowScore: 0.8, hasTransitions: true, transitionCount: 2 },
        topicConsistency: { consistencyScore: 0.7, mainTopics: ['typescript'], topicDrift: 0.2 },
        readability: { score: 0.75, avgSentenceLength: 15, complexWordRatio: 0.2 },
        overallScore: 0.75,
        suggestions: []
      })
    };

    // Mock constructors
    (FactualityChecker as any).mockImplementation(() => mockFactualityChecker);
    (RelevanceScorer as any).mockImplementation(() => mockRelevanceScorer);
    (CoherenceAnalyzer as any).mockImplementation(() => mockCoherenceAnalyzer);

    evaluator = new MultiModalEvaluator();
  });

  const createMockContext = () => ({
    query: 'What are TypeScript types?',
    response: 'TypeScript provides static typing for JavaScript.',
    sources: [
      {
        id: '1',
        content: 'TypeScript adds static types to JavaScript.',
        retrievalScore: 0.9,
        confidenceScore: 0.85,
        source: 'docs'
      }
    ] as ScoredDocument[],
    generationConfidence: 0.82
  });

  describe('evaluate', () => {
    it('should perform complete evaluation', async () => {
      const context = createMockContext();
      
      const result = await evaluator.evaluate(
        context.query,
        context.response,
        context.sources,
        context.generationConfidence
      );
      
      expect(result).toHaveProperty('factuality');
      expect(result).toHaveProperty('relevance');
      expect(result).toHaveProperty('coherence');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('explanation');
    });

    it('should calculate weighted confidence score', async () => {
      const context = createMockContext();
      
      const result = await evaluator.evaluate(
        context.query,
        context.response,
        context.sources,
        context.generationConfidence
      );
      
      // Raw confidence = (0.8 * 0.4 + 0.85 * 0.3 + 0.75 * 0.2 + 0.82 * 0.1) = 0.807
      expect(result.confidence.raw).toBeCloseTo(0.807, 2);
      expect(result.confidence.calibrated).toBe(result.confidence.raw); // No calibration yet
    });

    it('should recommend acceptance for high confidence', async () => {
      const context = createMockContext();
      
      const result = await evaluator.evaluate(
        context.query,
        context.response,
        context.sources,
        context.generationConfidence
      );
      
      expect(result.action).toBe('accept');
      expect(result.confidence.raw).toBeGreaterThan(0.8);
    });

    it('should recommend review for medium confidence', async () => {
      // Setup lower scores
      mockFactualityChecker.checkFactuality.mockReturnValue(0.5);
      mockRelevanceScorer.scoreRelevance.mockReturnValue(0.6);
      
      const context = createMockContext();
      const result = await evaluator.evaluate(
        context.query,
        context.response,
        context.sources,
        0.5 // Lower generation confidence
      );
      
      expect(result.action).toBe('review');
      expect(result.confidence.raw).toBeGreaterThan(0.4);
      expect(result.confidence.raw).toBeLessThan(0.8);
    });

    it('should recommend fallback for low confidence', async () => {
      // Setup very low scores
      mockFactualityChecker.checkFactuality.mockReturnValue(0.2);
      mockRelevanceScorer.scoreRelevance.mockReturnValue(0.3);
      mockCoherenceAnalyzer.analyzeCoherence.mockReturnValue(0.3);
      
      const context = createMockContext();
      const result = await evaluator.evaluate(
        context.query,
        context.response,
        context.sources,
        0.2
      );
      
      expect(result.action).toBe('fallback');
      expect(result.confidence.raw).toBeLessThan(0.4);
    });
  });

  describe('evaluateFactuality', () => {
    it('should evaluate factuality with support details', () => {
      const response = 'TypeScript has static types.';
      const sources = createMockContext().sources;
      
      const result = evaluator.evaluateFactuality(response, sources);
      
      expect(result.score).toBe(0.8);
      expect(result.supportDetails).toBeDefined();
      expect(result.supportDetails?.supportedClaims).toBe(3);
      expect(mockFactualityChecker.checkFactuality).toHaveBeenCalledWith(response, sources);
    });

    it('should handle empty sources', () => {
      const response = 'TypeScript has static types.';
      const sources: ScoredDocument[] = [];
      
      mockFactualityChecker.checkFactuality.mockReturnValue(0.3);
      
      const result = evaluator.evaluateFactuality(response, sources);
      
      expect(result.score).toBe(0.3);
      expect(result.hasSupport).toBe(false);
    });

    it('should identify well-supported responses', () => {
      mockFactualityChecker.calculateSupport.mockReturnValue({
        supportScore: 0.9,
        supportedClaims: 5,
        totalClaims: 5,
        unsupportedClaims: []
      });
      
      const response = 'TypeScript is great.';
      const sources = createMockContext().sources;
      
      const result = evaluator.evaluateFactuality(response, sources);
      
      expect(result.hasSupport).toBe(true);
      expect(result.supportDetails?.unsupportedClaims).toHaveLength(0);
    });
  });

  describe('evaluateRelevance', () => {
    it('should evaluate relevance with coverage details', () => {
      const query = 'What is TypeScript?';
      const response = 'TypeScript is a typed superset of JavaScript.';
      
      const result = evaluator.evaluateRelevance(query, response);
      
      expect(result.score).toBe(0.85);
      expect(result.queryCoverage).toBeDefined();
      expect(result.queryCoverage?.coverageRatio).toBe(1.0);
      expect(mockRelevanceScorer.scoreRelevance).toHaveBeenCalledWith(query, response);
    });

    it('should handle partial query coverage', () => {
      mockRelevanceScorer.assessQueryCoverage.mockReturnValue({
        coverageScore: 0.6,
        coveredTerms: ['typescript'],
        missedTerms: ['interfaces', 'generics'],
        queryTerms: ['typescript', 'interfaces', 'generics'],
        coverageRatio: 0.33
      });
      
      const query = 'How do TypeScript interfaces and generics work?';
      const response = 'TypeScript is a programming language.';
      
      const result = evaluator.evaluateRelevance(query, response);
      
      expect(result.isRelevant).toBe(true); // Still relevant but incomplete
      expect(result.queryCoverage?.missedTerms).toContain('interfaces');
      expect(result.queryCoverage?.missedTerms).toContain('generics');
    });

    it('should mark irrelevant responses', () => {
      mockRelevanceScorer.scoreRelevance.mockReturnValue(0.2);
      
      const query = 'What is TypeScript?';
      const response = 'Python is great for data science.';
      
      const result = evaluator.evaluateRelevance(query, response);
      
      expect(result.isRelevant).toBe(false);
      expect(result.score).toBeLessThan(0.5);
    });
  });

  describe('evaluateCoherence', () => {
    it('should evaluate coherence with breakdown', () => {
      const response = 'TypeScript provides type safety. Therefore, it prevents errors.';
      
      const result = evaluator.evaluateCoherence(response);
      
      expect(result.score).toBe(0.75);
      expect(result.breakdown).toBeDefined();
      expect(result.isCoherent).toBe(true);
      expect(mockCoherenceAnalyzer.analyzeCoherence).toHaveBeenCalledWith(response);
    });

    it('should identify incoherent responses', () => {
      mockCoherenceAnalyzer.analyzeCoherence.mockReturnValue(0.3);
      mockCoherenceAnalyzer.getCoherenceBreakdown.mockReturnValue({
        logicalFlow: { flowScore: 0.2, hasTransitions: false, transitionCount: 0 },
        topicConsistency: { consistencyScore: 0.3, mainTopics: [], topicDrift: 0.8 },
        readability: { score: 0.4, avgSentenceLength: 30, complexWordRatio: 0.6 },
        overallScore: 0.3,
        suggestions: ['Add transitions', 'Improve topic focus']
      });
      
      const response = 'TypeScript. Blue sky. Random words. No connection.';
      
      const result = evaluator.evaluateCoherence(response);
      
      expect(result.isCoherent).toBe(false);
      expect(result.breakdown?.suggestions).toHaveLength(2);
    });

    it('should provide improvement suggestions', () => {
      const mockBreakdown = {
        logicalFlow: { flowScore: 0.5, hasTransitions: false, transitionCount: 0 },
        topicConsistency: { consistencyScore: 0.6, mainTopics: ['typescript'], topicDrift: 0.4 },
        readability: { score: 0.5, avgSentenceLength: 25, complexWordRatio: 0.4 },
        overallScore: 0.53,
        suggestions: ['Add transition words', 'Simplify complex sentences']
      };
      
      mockCoherenceAnalyzer.analyzeCoherence.mockReturnValue(0.53);
      mockCoherenceAnalyzer.getCoherenceBreakdown.mockReturnValue(mockBreakdown);
      
      const response = 'Complex response here.';
      
      const result = evaluator.evaluateCoherence(response);
      
      expect(result.breakdown?.suggestions).toContain('Add transition words');
      expect(result.breakdown?.suggestions).toContain('Simplify complex sentences');
    });
  });

  describe('determineAction', () => {
    it('should accept high confidence responses', () => {
      const action = evaluator.determineAction(0.85);
      expect(action).toBe('accept');
    });

    it('should suggest review for medium confidence', () => {
      const action = evaluator.determineAction(0.6);
      expect(action).toBe('review');
    });

    it('should fallback for low confidence', () => {
      const action = evaluator.determineAction(0.3);
      expect(action).toBe('fallback');
    });

    it('should handle edge cases', () => {
      expect(evaluator.determineAction(0.8)).toBe('accept');
      expect(evaluator.determineAction(0.4)).toBe('review');
      expect(evaluator.determineAction(0.39)).toBe('fallback');
    });
  });

  describe('explainEvaluation', () => {
    it('should explain high confidence evaluation', () => {
      const evaluation = {
        factuality: { score: 0.9, hasSupport: true },
        relevance: { score: 0.95, isRelevant: true },
        coherence: { score: 0.85, isCoherent: true },
        confidence: { raw: 0.9, calibrated: 0.9 },
        action: 'accept' as const
      };
      
      const explanation = evaluator.explainEvaluation(evaluation);
      
      expect(explanation).toContain('high confidence');
      expect(explanation).toContain('well-supported');
      expect(explanation).toContain('relevant');
      expect(explanation).toContain('coherent');
    });

    it('should explain low confidence evaluation', () => {
      const evaluation = {
        factuality: { score: 0.3, hasSupport: false },
        relevance: { score: 0.4, isRelevant: false },
        coherence: { score: 0.35, isCoherent: false },
        confidence: { raw: 0.35, calibrated: 0.35 },
        action: 'fallback' as const
      };
      
      const explanation = evaluator.explainEvaluation(evaluation);
      
      expect(explanation).toContain('low confidence');
      expect(explanation).toContain('limited factual support');
    });

    it('should highlight specific issues', () => {
      const evaluation = {
        factuality: { score: 0.8, hasSupport: true },
        relevance: { score: 0.3, isRelevant: false },
        coherence: { score: 0.9, isCoherent: true },
        confidence: { raw: 0.65, calibrated: 0.65 },
        action: 'review' as const
      };
      
      const explanation = evaluator.explainEvaluation(evaluation);
      
      expect(explanation).toContain('not directly relevant');
    });
  });

  describe('edge cases', () => {
    it('should handle empty inputs gracefully', async () => {
      const result = await evaluator.evaluate('', '', [], 0.5);
      
      expect(result.confidence.raw).toBeLessThan(0.5);
      expect(result.action).toBe('fallback');
    });

    it('should handle very long responses', async () => {
      const longResponse = Array(1000).fill('TypeScript is great.').join(' ');
      const context = createMockContext();
      
      const result = await evaluator.evaluate(
        context.query,
        longResponse,
        context.sources,
        context.generationConfidence
      );
      
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('action');
    });

    it('should handle evaluation errors gracefully', async () => {
      mockFactualityChecker.checkFactuality.mockImplementation(() => {
        throw new Error('Evaluation error');
      });
      
      const context = createMockContext();
      
      // Should not throw
      const result = await evaluator.evaluate(
        context.query,
        context.response,
        context.sources,
        context.generationConfidence
      );
      
      expect(result.factuality.score).toBe(0); // Default on error
    });
  });
});