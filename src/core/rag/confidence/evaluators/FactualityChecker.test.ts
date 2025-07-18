/**
 * Unit tests for FactualityChecker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FactualityChecker } from './FactualityChecker';
import type { ScoredDocument } from '../types';

describe('FactualityChecker', () => {
  let checker: FactualityChecker;

  beforeEach(() => {
    checker = new FactualityChecker();
  });

  const createMockDocuments = (): ScoredDocument[] => [
    {
      id: '1',
      content: 'TypeScript is a superset of JavaScript that adds static typing.',
      retrievalScore: 0.9,
      confidenceScore: 0.85,
      source: 'docs',
      metadata: { source: 'typescript-docs' }
    },
    {
      id: '2',
      content: 'JavaScript is a dynamically typed programming language.',
      retrievalScore: 0.8,
      confidenceScore: 0.75,
      source: 'wiki',
      metadata: { source: 'js-wiki' }
    }
  ];

  describe('checkFactuality', () => {
    it('should score high for responses supported by sources', () => {
      const response = 'TypeScript is a superset of JavaScript with static typing support.';
      const sources = createMockDocuments();
      
      const score = checker.checkFactuality(response, sources);
      
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should score low for unsupported claims', () => {
      const response = 'TypeScript was created by Google in 2020.';
      const sources = createMockDocuments();
      
      const score = checker.checkFactuality(response, sources);
      
      expect(score).toBeLessThan(0.5);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty response', () => {
      const response = '';
      const sources = createMockDocuments();
      
      const score = checker.checkFactuality(response, sources);
      
      expect(score).toBe(0);
    });

    it('should handle empty sources', () => {
      const response = 'TypeScript is great.';
      const sources: ScoredDocument[] = [];
      
      const score = checker.checkFactuality(response, sources);
      
      expect(score).toBe(0.3); // Base score for unsupported claims
    });
  });

  describe('extractClaims', () => {
    it('should extract individual claims from response', () => {
      const response = 'TypeScript is statically typed. It compiles to JavaScript. It was created by Microsoft.';
      
      const claims = checker.extractClaims(response);
      
      expect(claims).toHaveLength(3);
      expect(claims[0]).toContain('statically typed');
      expect(claims[1]).toContain('compiles to JavaScript');
      expect(claims[2]).toContain('created by Microsoft');
    });

    it('should handle single sentence', () => {
      const response = 'TypeScript extends JavaScript.';
      
      const claims = checker.extractClaims(response);
      
      expect(claims).toHaveLength(1);
      expect(claims[0]).toBe('TypeScript extends JavaScript.');
    });

    it('should filter out very short sentences', () => {
      const response = 'TypeScript is great. Yes. It has many features.';
      
      const claims = checker.extractClaims(response);
      
      expect(claims).toHaveLength(2);
      expect(claims).not.toContain('Yes.');
    });

    it('should handle questions and exclamations', () => {
      const response = 'What is TypeScript? It is a superset of JavaScript! Really amazing.';
      
      const claims = checker.extractClaims(response);
      
      expect(claims).toHaveLength(3);
    });
  });

  describe('verifyClaim', () => {
    it('should verify exact matches', () => {
      const claim = 'TypeScript is a superset of JavaScript';
      const sources = createMockDocuments();
      
      const score = checker.verifyClaim(claim, sources);
      
      expect(score).toBeGreaterThan(0.8);
    });

    it('should verify partial matches', () => {
      const claim = 'TypeScript has static typing';
      const sources = createMockDocuments();
      
      const score = checker.verifyClaim(claim, sources);
      
      expect(score).toBeGreaterThan(0.6);
    });

    it('should give low score for unverifiable claims', () => {
      const claim = 'TypeScript is faster than C++';
      const sources = createMockDocuments();
      
      const score = checker.verifyClaim(claim, sources);
      
      expect(score).toBeLessThan(0.4);
    });

    it('should handle keyword overlap', () => {
      const claim = 'JavaScript and TypeScript are related';
      const sources = createMockDocuments();
      
      const score = checker.verifyClaim(claim, sources);
      
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe('calculateSupport', () => {
    it('should calculate high support for well-sourced responses', () => {
      const response = 'TypeScript is a superset of JavaScript that adds static typing. JavaScript is dynamically typed.';
      const sources = createMockDocuments();
      
      const support = checker.calculateSupport(response, sources);
      
      expect(support.supportScore).toBeGreaterThan(0.7);
      expect(support.supportedClaims).toBeGreaterThan(1);
      expect(support.totalClaims).toBe(2);
      expect(support.unsupportedClaims).toHaveLength(0);
    });

    it('should identify unsupported claims', () => {
      const response = 'TypeScript is great. It was created in 1995. It runs on quantum computers.';
      const sources = createMockDocuments();
      
      const support = checker.calculateSupport(response, sources);
      
      expect(support.supportScore).toBeLessThan(0.5);
      expect(support.unsupportedClaims.length).toBeGreaterThan(0);
      expect(support.unsupportedClaims).toContain('It was created in 1995.');
    });

    it('should provide detailed support breakdown', () => {
      const response = 'TypeScript adds static typing to JavaScript.';
      const sources = createMockDocuments();
      
      const support = checker.calculateSupport(response, sources);
      
      expect(support).toHaveProperty('supportScore');
      expect(support).toHaveProperty('supportedClaims');
      expect(support).toHaveProperty('totalClaims');
      expect(support).toHaveProperty('unsupportedClaims');
      expect(support).toHaveProperty('claimScores');
    });
  });

  describe('edge cases', () => {
    it('should handle responses with only punctuation', () => {
      const response = '...!!!???';
      const sources = createMockDocuments();
      
      const score = checker.checkFactuality(response, sources);
      
      expect(score).toBe(0);
    });

    it('should handle very long responses', () => {
      const longResponse = Array(50).fill('TypeScript is great.').join(' ');
      const sources = createMockDocuments();
      
      const score = checker.checkFactuality(longResponse, sources);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle responses with special characters', () => {
      const response = 'TypeScript → JavaScript (transpilation)';
      const sources = createMockDocuments();
      
      const score = checker.checkFactuality(response, sources);
      
      expect(score).toBeGreaterThan(0);
    });
  });
});