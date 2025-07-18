/**
 * Unit tests for ConfidenceContextBuilder
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceContextBuilder } from './ConfidenceContextBuilder';
import { ScoredDocument } from './types';

describe('ConfidenceContextBuilder', () => {
  let builder: ConfidenceContextBuilder;

  const createMockDocuments = (): ScoredDocument[] => [
    {
      id: '1',
      content: 'High confidence document about TypeScript',
      retrievalScore: 0.9,
      confidenceScore: 0.85,
      source: 'docs',
      metadata: { source: 'typescript-docs', sourceId: 'ts-1', timestamp: new Date('2025-01-01') }
    },
    {
      id: '2',
      content: 'Medium confidence document about JavaScript',
      retrievalScore: 0.7,
      confidenceScore: 0.65,
      source: 'wiki',
      metadata: { source: 'js-wiki', sourceId: 'js-1' }
    },
    {
      id: '3',
      content: 'Low confidence document about programming',
      retrievalScore: 0.5,
      confidenceScore: 0.45,
      source: 'blog',
      metadata: { source: 'tech-blog', sourceId: 'blog-1', chunkIndex: 2, totalChunks: 5 }
    }
  ];

  beforeEach(() => {
    builder = new ConfidenceContextBuilder();
  });

  describe('buildContext', () => {
    it('should build separated context by default', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'What is TypeScript?');

      expect(context).toContain('## HIGH CONFIDENCE SOURCES');
      expect(context).toContain('## MEDIUM CONFIDENCE SOURCES');
      expect(context).toContain('## LOW CONFIDENCE SOURCES');
      expect(context).toContain('High confidence document about TypeScript');
    });

    it('should build unified context when requested', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'What is TypeScript?', {
        separateByConfidence: false
      });

      expect(context).toContain('## RETRIEVED SOURCES');
      expect(context).not.toContain('## HIGH CONFIDENCE SOURCES');
      expect(context).toContain('## CONFIDENCE SUMMARY');
    });

    it('should include confidence labels', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'query', {
        includeConfidenceLabels: true,
        confidenceFormat: 'both'
      });

      expect(context).toContain('[HIGH - 85%]');
      expect(context).toContain('[MEDIUM - 65%]');
      expect(context).toContain('[LOW - 45%]');
    });

    it('should format confidence as percentage only', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'query', {
        confidenceFormat: 'percentage'
      });

      expect(context).toContain('[85%]');
      expect(context).toContain('[65%]');
      expect(context).toContain('[45%]');
    });

    it('should format confidence as label only', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'query', {
        confidenceFormat: 'label'
      });

      expect(context).toContain('[HIGH]');
      expect(context).toContain('[MEDIUM]');
      expect(context).toContain('[LOW]');
    });

    it('should include metadata when requested', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'query', {
        includeMetadata: true
      });

      expect(context).toContain('Source: typescript-docs');
      expect(context).toContain('ID: ts-1');
      expect(context).toContain('Updated: 12/31/2024');
      expect(context).toContain('Part 3 of 5');
    });

    it('should exclude metadata when not requested', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'query', {
        includeMetadata: false
      });

      expect(context).not.toContain('Source: typescript-docs');
      expect(context).not.toContain('ID: ts-1');
    });

    it('should handle empty documents', () => {
      const context = builder.buildContext([], 'What is TypeScript?');

      expect(context).toContain('## NO RELEVANT SOURCES FOUND');
      expect(context).toContain("I couldn't find any relevant information");
      expect(context).toContain('What is TypeScript?');
    });

    it('should add warning for low confidence documents', () => {
      const docs = [createMockDocuments()[2]]; // Only low confidence
      const context = builder.buildContext(docs, 'query');

      expect(context).toContain('⚠️ Note: This source has low relevance');
    });

    it('should truncate long context', () => {
      const longDoc: ScoredDocument = {
        id: 'long',
        content: 'A'.repeat(5000), // Very long content
        retrievalScore: 0.9,
        confidenceScore: 0.9,
        source: 'long',
        metadata: {}
      };

      const context = builder.buildContext([longDoc], 'query', {
        maxContextLength: 1000
      });

      expect(context.length).toBeLessThanOrEqual(1100); // Some buffer for truncation message
      expect(context).toContain('[Context truncated due to length limits]');
    });
  });

  describe('buildSpecializedContext', () => {
    const docs = createMockDocuments();

    it('should build factual context with high confidence only', () => {
      const context = builder.buildSpecializedContext(docs, 'What is TypeScript?', 'factual');

      expect(context).toContain('High confidence document about TypeScript');
      expect(context).toContain('Medium confidence document about JavaScript');
      expect(context).not.toContain('Low confidence document'); // Filtered out
    });

    it('should build explanatory context with all sources separated', () => {
      const context = builder.buildSpecializedContext(docs, 'Explain TypeScript', 'explanatory');

      expect(context).toContain('## HIGH CONFIDENCE SOURCES');
      expect(context).toContain('## MEDIUM CONFIDENCE SOURCES');
      expect(context).toContain('## LOW CONFIDENCE SOURCES');
      expect(context).toContain('[HIGH - 85%]'); // Both format
    });

    it('should build creative context without separation', () => {
      const context = builder.buildSpecializedContext(docs, 'Write about TypeScript', 'creative');

      expect(context).not.toContain('## HIGH CONFIDENCE SOURCES');
      expect(context).toContain('## RETRIEVED SOURCES');
      expect(context).toContain('[HIGH]'); // Label only
    });

    it('should build analytical context with full details', () => {
      const context = builder.buildSpecializedContext(docs, 'Analyze TypeScript', 'analytical');

      expect(context).toContain('## HIGH CONFIDENCE SOURCES');
      expect(context).toContain('Source: typescript-docs'); // Metadata included
      expect(context).toContain('[HIGH - 85%]'); // Both format
    });
  });

  describe('confidence guidance', () => {
    it('should show positive message for all high confidence', () => {
      const highDocs = [createMockDocuments()[0]];
      const context = builder.buildContext(highDocs, 'query');

      expect(context).toContain('✅ All sources are highly relevant');
    });

    it('should show warning for only low confidence', () => {
      const lowDocs = [createMockDocuments()[2]];
      const context = builder.buildContext(lowDocs, 'query');

      expect(context).toContain('⚠️ Only low-confidence sources were found');
    });

    it('should show mixed message for varied confidence', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'query');

      expect(context).toContain('ℹ️ Found 1 highly relevant source');
    });
  });

  describe('confidence summary', () => {
    it('should calculate average confidence correctly', () => {
      const docs = createMockDocuments();
      const context = builder.buildContext(docs, 'query', {
        separateByConfidence: false
      });

      // Average of 0.85, 0.65, 0.45 = 0.65 = 65%
      expect(context).toContain('Average relevance: 65%');
      expect(context).toContain('High confidence sources: 1');
      expect(context).toContain('Medium confidence sources: 1');
      expect(context).toContain('Low confidence sources: 1');
    });
  });

  describe('edge cases', () => {
    it('should handle documents without metadata', () => {
      const doc: ScoredDocument = {
        id: '1',
        content: 'Content without metadata',
        retrievalScore: 0.8,
        confidenceScore: 0.8,
        source: 'unknown',
        metadata: {}
      };

      const context = builder.buildContext([doc], 'query');
      expect(context).toContain('Content without metadata');
      expect(context).not.toContain('Source:'); // No metadata to show
    });

    it('should handle very low confidence documents', () => {
      const doc: ScoredDocument = {
        id: '1',
        content: 'Very low confidence',
        retrievalScore: 0.2,
        confidenceScore: 0.2,
        source: 'unknown',
        metadata: {}
      };

      const context = builder.buildContext([doc], 'query');
      expect(context).toContain('[VERY LOW - 20%]');
    });

    it('should sort documents by confidence', () => {
      const unsortedDocs: ScoredDocument[] = [
        { id: '1', content: 'Low', retrievalScore: 0.3, confidenceScore: 0.3, source: 's1', metadata: {} },
        { id: '2', content: 'High', retrievalScore: 0.9, confidenceScore: 0.9, source: 's2', metadata: {} },
        { id: '3', content: 'Medium', retrievalScore: 0.6, confidenceScore: 0.6, source: 's3', metadata: {} }
      ];

      const context = builder.buildContext(unsortedDocs, 'query', {
        separateByConfidence: false
      });

      // Check order in unified context
      const highIndex = context.indexOf('High');
      const mediumIndex = context.indexOf('Medium');
      const lowIndex = context.indexOf('Low');

      expect(highIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(lowIndex);
    });
  });
});