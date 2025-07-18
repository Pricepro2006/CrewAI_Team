/**
 * Unit tests for RelevanceScorer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RelevanceScorer } from './RelevanceScorer';

describe('RelevanceScorer', () => {
  let scorer: RelevanceScorer;

  beforeEach(() => {
    scorer = new RelevanceScorer();
  });

  describe('scoreRelevance', () => {
    it('should score high for directly relevant responses', () => {
      const query = 'What is TypeScript?';
      const response = 'TypeScript is a programming language developed by Microsoft that adds static typing to JavaScript.';
      
      const score = scorer.scoreRelevance(query, response);
      
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should score low for irrelevant responses', () => {
      const query = 'What is TypeScript?';
      const response = 'Python is a high-level programming language known for its simplicity.';
      
      const score = scorer.scoreRelevance(query, response);
      
      expect(score).toBeLessThan(0.3);
    });

    it('should handle empty query', () => {
      const query = '';
      const response = 'Some response text';
      
      const score = scorer.scoreRelevance(query, response);
      
      expect(score).toBe(0);
    });

    it('should handle empty response', () => {
      const query = 'What is TypeScript?';
      const response = '';
      
      const score = scorer.scoreRelevance(query, response);
      
      expect(score).toBe(0);
    });

    it('should handle partial relevance', () => {
      const query = 'How does TypeScript handle errors?';
      const response = 'TypeScript is a programming language. It has many features for developers.';
      
      const score = scorer.scoreRelevance(query, response);
      
      expect(score).toBeGreaterThan(0.2);
      expect(score).toBeLessThan(0.6);
    });
  });

  describe('calculateSemanticSimilarity', () => {
    it('should calculate high similarity for related texts', () => {
      const text1 = 'TypeScript extends JavaScript with types';
      const text2 = 'TypeScript adds type annotations to JavaScript';
      
      const similarity = scorer.calculateSemanticSimilarity(text1, text2);
      
      expect(similarity).toBeGreaterThan(0.6);
    });

    it('should calculate low similarity for unrelated texts', () => {
      const text1 = 'TypeScript is a programming language';
      const text2 = 'The weather is sunny today';
      
      const similarity = scorer.calculateSemanticSimilarity(text1, text2);
      
      expect(similarity).toBeLessThan(0.2);
    });

    it('should handle identical texts', () => {
      const text = 'TypeScript is great';
      
      const similarity = scorer.calculateSemanticSimilarity(text, text);
      
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should be case insensitive', () => {
      const text1 = 'TYPESCRIPT';
      const text2 = 'typescript';
      
      const similarity = scorer.calculateSemanticSimilarity(text1, text2);
      
      expect(similarity).toBeGreaterThan(0.9);
    });
  });

  describe('assessQueryCoverage', () => {
    it('should detect full query coverage', () => {
      const query = 'What are TypeScript interfaces?';
      const response = 'TypeScript interfaces define the structure of objects. They are used for type checking.';
      
      const coverage = scorer.assessQueryCoverage(query, response);
      
      expect(coverage.coverageScore).toBeGreaterThan(0.7);
      expect(coverage.coveredTerms).toContain('typescript');
      expect(coverage.coveredTerms).toContain('interfaces');
      expect(coverage.missedTerms).toHaveLength(0);
    });

    it('should identify missed query terms', () => {
      const query = 'How do TypeScript generics work with interfaces?';
      const response = 'TypeScript has a type system.';
      
      const coverage = scorer.assessQueryCoverage(query, response);
      
      expect(coverage.coverageScore).toBeLessThan(0.5);
      expect(coverage.missedTerms).toContain('generics');
      expect(coverage.missedTerms).toContain('interfaces');
    });

    it('should handle question words appropriately', () => {
      const query = 'What is TypeScript used for?';
      const response = 'TypeScript is used for building large-scale applications.';
      
      const coverage = scorer.assessQueryCoverage(query, response);
      
      expect(coverage.coveredTerms).toContain('typescript');
      expect(coverage.coveredTerms).toContain('used');
      expect(coverage.queryTerms).not.toContain('what');
      expect(coverage.queryTerms).not.toContain('is');
    });

    it('should calculate coverage ratio correctly', () => {
      const query = 'TypeScript compiler options';
      const response = 'The TypeScript compiler has many options for configuration.';
      
      const coverage = scorer.assessQueryCoverage(query, response);
      
      expect(coverage.coverageRatio).toBe(1.0); // All query terms covered
      expect(coverage.totalQueryTerms).toBe(3);
    });
  });

  describe('detectAnswerType', () => {
    it('should detect definition answers', () => {
      const query = 'What is TypeScript?';
      const response = 'TypeScript is a programming language.';
      
      const type = scorer.detectAnswerType(query, response);
      
      expect(type).toBe('definition');
    });

    it('should detect explanation answers', () => {
      const query = 'How does TypeScript work?';
      const response = 'TypeScript works by transpiling to JavaScript.';
      
      const type = scorer.detectAnswerType(query, response);
      
      expect(type).toBe('explanation');
    });

    it('should detect list answers', () => {
      const query = 'What are TypeScript features?';
      const response = 'TypeScript features include: 1) Static typing 2) Interfaces 3) Generics';
      
      const type = scorer.detectAnswerType(query, response);
      
      expect(type).toBe('list');
    });

    it('should detect comparison answers', () => {
      const query = 'TypeScript vs JavaScript';
      const response = 'TypeScript differs from JavaScript in several ways.';
      
      const type = scorer.detectAnswerType(query, response);
      
      expect(type).toBe('comparison');
    });

    it('should default to general for unclear types', () => {
      const query = 'TypeScript';
      const response = 'Information about TypeScript.';
      
      const type = scorer.detectAnswerType(query, response);
      
      expect(type).toBe('general');
    });
  });

  describe('edge cases', () => {
    it('should handle very short inputs', () => {
      const query = 'TS?';
      const response = 'Yes.';
      
      const score = scorer.scoreRelevance(query, response);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle special characters', () => {
      const query = 'TypeScript@2.0?';
      const response = 'TypeScript version 2.0 introduced new features.';
      
      const score = scorer.scoreRelevance(query, response);
      
      expect(score).toBeGreaterThan(0.5);
    });

    it('should handle multilingual content gracefully', () => {
      const query = 'What is TypeScript?';
      const response = 'TypeScript は JavaScript のスーパーセットです。';
      
      const score = scorer.scoreRelevance(query, response);
      
      expect(score).toBeGreaterThan(0); // Should still match 'TypeScript'
    });

    it('should handle very long texts', () => {
      const query = 'TypeScript benefits';
      const longResponse = Array(100).fill('TypeScript provides type safety.').join(' ');
      
      const score = scorer.scoreRelevance(query, longResponse);
      
      expect(score).toBeGreaterThan(0.5);
    });
  });
});