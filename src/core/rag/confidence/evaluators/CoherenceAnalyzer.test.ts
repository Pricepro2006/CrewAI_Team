/**
 * Unit tests for CoherenceAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CoherenceAnalyzer } from './CoherenceAnalyzer';

describe('CoherenceAnalyzer', () => {
  let analyzer: CoherenceAnalyzer;

  beforeEach(() => {
    analyzer = new CoherenceAnalyzer();
  });

  describe('analyzeCoherence', () => {
    it('should score high for well-structured responses', () => {
      const response = `TypeScript is a programming language developed by Microsoft. 
        It adds static typing to JavaScript. 
        This helps developers catch errors early in the development process. 
        As a result, TypeScript improves code quality and maintainability.`;
      
      const score = analyzer.analyzeCoherence(response);
      
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should score low for incoherent responses', () => {
      const response = `TypeScript blue sky. 
        Yesterday programming? 
        Microsoft elephant dancing. 
        Compiler breakfast amazing!`;
      
      const score = analyzer.analyzeCoherence(response);
      
      expect(score).toBeLessThan(0.4);
    });

    it('should handle empty response', () => {
      const response = '';
      
      const score = analyzer.analyzeCoherence(response);
      
      expect(score).toBe(0);
    });

    it('should handle single sentence', () => {
      const response = 'TypeScript is a superset of JavaScript.';
      
      const score = analyzer.analyzeCoherence(response);
      
      expect(score).toBeGreaterThan(0.8); // Single coherent sentence should score high
    });
  });

  describe('checkLogicalFlow', () => {
    it('should detect good logical flow with transitions', () => {
      const sentences = [
        'TypeScript provides static typing.',
        'Therefore, it helps catch errors early.',
        'Additionally, it improves code documentation.',
        'As a result, teams can work more efficiently.'
      ];
      
      const flow = analyzer.checkLogicalFlow(sentences);
      
      expect(flow.flowScore).toBeGreaterThan(0.7);
      expect(flow.hasTransitions).toBe(true);
      expect(flow.transitionCount).toBeGreaterThan(2);
    });

    it('should detect poor logical flow', () => {
      const sentences = [
        'TypeScript is great.',
        'Cats are animals.',
        'The sun is bright.',
        'Programming is fun.'
      ];
      
      const flow = analyzer.checkLogicalFlow(sentences);
      
      expect(flow.flowScore).toBeLessThan(0.4);
      expect(flow.hasTransitions).toBe(false);
    });

    it('should identify transition words', () => {
      const sentences = [
        'First, TypeScript adds types.',
        'However, it requires compilation.',
        'Furthermore, it has great tooling.',
        'In conclusion, TypeScript is beneficial.'
      ];
      
      const flow = analyzer.checkLogicalFlow(sentences);
      
      expect(flow.hasTransitions).toBe(true);
      expect(flow.transitionCount).toBe(4);
      expect(flow.flowScore).toBeGreaterThan(0.8);
    });

    it('should handle sentences without transitions', () => {
      const sentences = [
        'TypeScript has types.',
        'JavaScript is dynamic.',
        'Both are programming languages.',
      ];
      
      const flow = analyzer.checkLogicalFlow(sentences);
      
      expect(flow.hasTransitions).toBe(false);
      expect(flow.transitionCount).toBe(0);
    });
  });

  describe('assessTopicConsistency', () => {
    it('should detect consistent topic focus', () => {
      const sentences = [
        'TypeScript is a typed superset of JavaScript.',
        'It compiles to plain JavaScript code.',
        'TypeScript supports modern JavaScript features.',
        'The TypeScript compiler checks for type errors.'
      ];
      
      const consistency = analyzer.assessTopicConsistency(sentences);
      
      expect(consistency.consistencyScore).toBeGreaterThan(0.8);
      expect(consistency.mainTopics).toContain('typescript');
      expect(consistency.topicDrift).toBeLessThan(0.2);
    });

    it('should detect topic drift', () => {
      const sentences = [
        'TypeScript is a programming language.',
        'Python is also popular.',
        'Machine learning is growing.',
        'AI will change the world.'
      ];
      
      const consistency = analyzer.assessTopicConsistency(sentences);
      
      expect(consistency.consistencyScore).toBeLessThan(0.4);
      expect(consistency.topicDrift).toBeGreaterThan(0.6);
    });

    it('should identify main topics', () => {
      const sentences = [
        'React is a JavaScript library.',
        'React components are reusable.',
        'React hooks simplify state management.',
      ];
      
      const consistency = analyzer.assessTopicConsistency(sentences);
      
      expect(consistency.mainTopics).toContain('react');
      expect(consistency.topicCoverage).toBeGreaterThan(0.8);
    });

    it('should handle diverse but related topics', () => {
      const sentences = [
        'TypeScript provides type safety.',
        'Type safety prevents runtime errors.',
        'Errors can be caught during compilation.',
        'Compilation happens before deployment.'
      ];
      
      const consistency = analyzer.assessTopicConsistency(sentences);
      
      expect(consistency.consistencyScore).toBeGreaterThan(0.6);
      expect(consistency.mainTopics.length).toBeGreaterThan(1);
    });
  });

  describe('calculateReadability', () => {
    it('should score high for clear, simple text', () => {
      const response = 'TypeScript is easy to learn. It helps you write better code. Many developers use it.';
      
      const readability = analyzer.calculateReadability(response);
      
      expect(readability.score).toBeGreaterThan(0.7);
      expect(readability.avgSentenceLength).toBeLessThan(10);
    });

    it('should score lower for complex text', () => {
      const response = `The TypeScript type system, with its sophisticated inference mechanisms 
        and structural typing paradigm, enables developers to construct highly maintainable 
        applications through compile-time verification of complex type relationships and 
        polymorphic abstractions.`;
      
      const readability = analyzer.calculateReadability(response);
      
      expect(readability.score).toBeLessThan(0.6);
      expect(readability.complexWordRatio).toBeGreaterThan(0.3);
    });

    it('should calculate sentence length metrics', () => {
      const response = 'Short sentence. This is a medium length sentence here. This one is much longer with many more words to demonstrate variety.';
      
      const readability = analyzer.calculateReadability(response);
      
      expect(readability.avgSentenceLength).toBeGreaterThan(5);
      expect(readability.sentenceLengthVariance).toBeGreaterThan(0);
    });

    it('should identify complex words', () => {
      const response = 'Implementation of asynchronous functionality requires understanding.';
      
      const readability = analyzer.calculateReadability(response);
      
      expect(readability.complexWordRatio).toBeGreaterThan(0.5);
    });
  });

  describe('getCoherenceBreakdown', () => {
    it('should provide complete breakdown', () => {
      const response = `TypeScript extends JavaScript. 
        Therefore, it's easy to adopt. 
        Additionally, it provides better tooling.`;
      
      const breakdown = analyzer.getCoherenceBreakdown(response);
      
      expect(breakdown).toHaveProperty('logicalFlow');
      expect(breakdown).toHaveProperty('topicConsistency');
      expect(breakdown).toHaveProperty('readability');
      expect(breakdown).toHaveProperty('overallScore');
      expect(breakdown).toHaveProperty('suggestions');
    });

    it('should provide improvement suggestions', () => {
      const response = 'TypeScript. JavaScript. Programming. Coding.';
      
      const breakdown = analyzer.getCoherenceBreakdown(response);
      
      expect(breakdown.suggestions).not.toHaveLength(0);
      expect(breakdown.suggestions.some(s => s.includes('transition') || s.includes('flow'))).toBe(true);
    });

    it('should not suggest improvements for coherent text', () => {
      const response = `TypeScript is a typed superset of JavaScript. 
        It compiles to plain JavaScript, making it compatible with any browser. 
        Furthermore, it adds optional static typing and class-based object-oriented programming.`;
      
      const breakdown = analyzer.getCoherenceBreakdown(response);
      
      expect(breakdown.overallScore).toBeGreaterThan(0.7);
      expect(breakdown.suggestions).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle text with only punctuation', () => {
      const response = '... !!! ???';
      
      const score = analyzer.analyzeCoherence(response);
      
      expect(score).toBe(0);
    });

    it('should handle text with repeated sentences', () => {
      const response = 'TypeScript is great. TypeScript is great. TypeScript is great.';
      
      const score = analyzer.analyzeCoherence(response);
      
      expect(score).toBeLessThan(0.5); // Repetition should lower coherence
    });

    it('should handle text with unicode characters', () => {
      const response = 'TypeScript supports émojis 😊 and unicode ñ characters.';
      
      const score = analyzer.analyzeCoherence(response);
      
      expect(score).toBeGreaterThan(0.5);
    });

    it('should handle very long sentences', () => {
      const longSentence = Array(50).fill('word').join(' ') + '.';
      
      const score = analyzer.analyzeCoherence(longSentence);
      
      expect(score).toBeLessThan(0.7); // Very long sentences reduce readability
    });
  });
});