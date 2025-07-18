/**
 * Integration tests for the complete confidence-scored RAG system
 * Tests the full workflow from query processing to adaptive delivery
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ConfidenceMasterOrchestrator } from '../../core/master-orchestrator/ConfidenceMasterOrchestrator';
import { VectorStore } from '../../core/rag/VectorStore';
import { OllamaProvider } from '../../core/llm/OllamaProvider';
import { createTestQuery } from '../utils/test-helpers';
import { OllamaTestHelper } from '../utils/ollama-test-helper';
import { ActionType } from '../../core/rag/confidence/types';

describe('Confidence-Scored RAG System Integration', () => {
  let orchestrator: ConfidenceMasterOrchestrator;
  let ollamaHelper: OllamaTestHelper;
  let isOllamaAvailable = false;

  beforeAll(async () => {
    ollamaHelper = new OllamaTestHelper();
    isOllamaAvailable = await ollamaHelper.isAvailable();

    if (!isOllamaAvailable) {
      console.warn('⚠️  Ollama not available - tests will use mock mode');
    }

    // Initialize orchestrator with test configuration
    const config = {
      model: 'qwen2.5:0.5b', // Small model for tests
      ollamaUrl: 'http://localhost:11434',
      rag: {
        vectorStore: {
          type: 'chromadb' as const,
          path: './test-data/vectors',
          collectionName: 'test-confidence',
          dimension: 384,
        },
        chunking: {
          size: 200,
          overlap: 20,
          method: 'sentence' as const,
        },
        retrieval: {
          topK: 3,
          minScore: 0.5,
          reranking: true,
        },
      },
    };

    orchestrator = new ConfidenceMasterOrchestrator(config);
    
    // Initialize system
    await orchestrator.initialize();
  }, 30000);

  afterAll(async () => {
    // Cleanup
    await orchestrator.saveCalibrationParameters();
  });

  describe('Query Complexity Routing', () => {
    it('should route simple queries appropriately', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const query = createTestQuery('What is TypeScript?');
      const result = await orchestrator.processQuery(query);

      expect(result).toBeDefined();
      expect(result.processingPath).toBe('simple-query');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.deliveredResponse.metadata.action).toBe(ActionType.ACCEPT);
    });

    it('should route medium complexity queries to confidence RAG', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const query = createTestQuery('How does async/await work in TypeScript and what are the performance implications?');
      const result = await orchestrator.processQuery(query);

      expect(result).toBeDefined();
      expect(result.processingPath).toBe('confidence-rag');
      expect(result.deliveredResponse.evidence).toBeDefined();
      expect(result.feedbackId).toBeDefined();
    });

    it('should route complex queries to agent orchestration', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const query = createTestQuery(
        'Analyze the performance characteristics of different sorting algorithms, ' +
        'implement a hybrid approach combining quicksort and insertion sort, ' +
        'and provide benchmarks comparing it to standard library implementations.'
      );
      const result = await orchestrator.processQuery(query);

      expect(result).toBeDefined();
      expect(result.processingPath).toBe('agent-orchestration');
      expect(result.deliveredResponse.metadata.humanReviewNeeded).toBeDefined();
    });
  });

  describe('Confidence Scoring Workflow', () => {
    it('should track confidence through all stages', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const confidenceUpdates: any[] = [];
      
      orchestrator.on('confidence:update', (data) => {
        confidenceUpdates.push(data);
      });

      const query = createTestQuery('Explain the concept of dependency injection in software design');
      const result = await orchestrator.processQuery(query);

      // Should have updates from different stages
      expect(confidenceUpdates.length).toBeGreaterThan(0);
      expect(confidenceUpdates.some(u => u.stage === 'query-analysis')).toBe(true);
      expect(confidenceUpdates.some(u => u.stage === 'retrieval')).toBe(true);
      expect(confidenceUpdates.some(u => u.stage === 'generation')).toBe(true);

      // Final confidence should be reasonable
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('should provide appropriate warnings for low confidence', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      // Query with limited context should result in lower confidence
      const query = createTestQuery('What is the best programming language for quantum computing?');
      const result = await orchestrator.processQuery(query);

      if (result.confidence < 0.6) {
        expect(result.deliveredResponse.warnings).toBeDefined();
        expect(result.deliveredResponse.warnings!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Adaptive Delivery', () => {
    it('should format responses based on confidence level', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const query = createTestQuery('What is a variable?');
      const result = await orchestrator.processQuery(query);

      const content = result.deliveredResponse.content;

      if (result.confidence >= 0.8) {
        // High confidence - clean response
        expect(content).not.toContain('⚠️');
        expect(content).not.toContain('Low Confidence');
      } else if (result.confidence >= 0.6) {
        // Medium confidence - may have caveats
        expect(content).toContain('Confidence:');
      } else {
        // Low confidence - should have warnings
        expect(content).toContain('⚠️');
      }
    });

    it('should include evidence when confidence is medium', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const query = createTestQuery('Compare REST and GraphQL APIs');
      const result = await orchestrator.processQuery(query);

      if (result.confidence >= 0.4 && result.confidence < 0.8) {
        expect(result.deliveredResponse.evidence).toBeDefined();
        if (result.deliveredResponse.evidence) {
          expect(result.deliveredResponse.evidence.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Feedback System', () => {
    it('should capture and process feedback', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const query = createTestQuery('What is React?');
      const result = await orchestrator.processQuery(query);

      // Submit feedback
      orchestrator.captureFeedback(result.feedbackId, {
        helpful: true,
        accurate: true,
        comments: 'Great explanation'
      });

      // Get performance stats
      const stats = orchestrator.getPerformanceStats();
      expect(stats.delivery.feedbackRate).toBeGreaterThan(0);
    });

    it('should update calibration based on positive feedback', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const query = createTestQuery('What is npm?');
      const result = await orchestrator.processQuery(query);
      
      const initialStats = orchestrator.getPerformanceStats();
      const initialDataPoints = initialStats.calibration.dataPoints;

      // Submit positive feedback
      orchestrator.captureFeedback(result.feedbackId, {
        helpful: true,
        accurate: true
      });

      // Check calibration update
      const updatedStats = orchestrator.getPerformanceStats();
      expect(updatedStats.calibration.dataPoints).toBeGreaterThan(initialDataPoints);
    });
  });

  describe('Error Handling', () => {
    it('should handle query processing errors gracefully', async () => {
      // Force an error by using invalid configuration
      const badQuery = createTestQuery('');
      badQuery.text = ''; // Empty query should trigger validation error
      
      const result = await orchestrator.processQuery(badQuery);
      
      expect(result).toBeDefined();
      expect(result.processingPath).toBe('simple-query');
      expect(result.confidence).toBe(0);
      expect(result.deliveredResponse.metadata.action).toBe(ActionType.FALLBACK);
    });

    it('should provide helpful fallback messages', async () => {
      const errorQuery = createTestQuery('This is a test to trigger an error');
      
      // Mock an error in processing
      vi.spyOn(orchestrator as any, 'handleConfidenceRAG').mockRejectedValueOnce(
        new Error('Test error')
      );

      const result = await orchestrator.processQuery(errorQuery);
      
      expect(result.deliveredResponse.content).toContain('encountered an unexpected error');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      // Process multiple queries
      const queries = [
        'What is JavaScript?',
        'How do promises work?',
        'Explain async/await'
      ];

      for (const q of queries) {
        await orchestrator.processQuery(createTestQuery(q));
      }

      const stats = orchestrator.getPerformanceStats();
      
      expect(stats.delivery.total).toBeGreaterThan(0);
      expect(stats.delivery.averageConfidence).toBeGreaterThan(0);
      expect(stats.delivery.byAction).toBeDefined();
      expect(stats.performance).toBeDefined();
    });
  });

  describe('Configuration Profiles', () => {
    it('should respect confidence profile settings', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      // Create orchestrator with conservative profile
      const conservativeConfig = {
        model: 'qwen2.5:0.5b',
        ollamaUrl: 'http://localhost:11434',
        confidenceProfile: 'conservative',
        rag: {
          vectorStore: {
            type: 'chromadb' as const,
            path: './test-data/vectors-conservative',
            collectionName: 'test-conservative',
            dimension: 384,
          },
        },
      };

      const conservativeOrchestrator = new ConfidenceMasterOrchestrator(conservativeConfig);
      await conservativeOrchestrator.initialize();

      const query = createTestQuery('What is a function?');
      const result = await conservativeOrchestrator.processQuery(query);

      // Conservative profile should have stricter thresholds
      if (result.confidence < 0.85) {
        expect(result.deliveredResponse.metadata.action).not.toBe(ActionType.ACCEPT);
      }
    });
  });

  describe('Real-time Updates', () => {
    it('should emit events for real-time monitoring', async () => {
      if (!isOllamaAvailable) {
        console.log('Skipping test - Ollama not available');
        return;
      }

      const events: any[] = [];
      let evaluationComplete = false;

      orchestrator.on('confidence:update', (data) => {
        events.push({ type: 'confidence', data });
      });

      orchestrator.on('evaluation:complete', (data) => {
        events.push({ type: 'evaluation', data });
        evaluationComplete = true;
      });

      orchestrator.on('processing:complete', (data) => {
        events.push({ type: 'complete', data });
      });

      const query = createTestQuery('What is Docker?');
      await orchestrator.processQuery(query);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'confidence')).toBe(true);
      expect(evaluationComplete).toBe(true);
    });
  });
});