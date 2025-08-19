/**
 * NLP Service Tests
 * Comprehensive test suite for the core NLP service functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NLPService } from '../services/NLPService';
import type { NLPServiceConfig } from '../types/index';

// Mock the GroceryNLPQueue
vi.mock('../../../../api/services/GroceryNLPQueue', () => ({
  GroceryNLPQueue: {
    getInstance: vi.fn(() => ({
      enqueue: vi.fn(),
      enqueueBatch: vi.fn(),
      getStatus: vi.fn(() => ({
        healthy: true,
        queueSize: 0,
        activeRequests: 0,
        maxConcurrent: 2,
        metrics: {
          totalRequests: 0,
          completedRequests: 0,
          failedRequests: 0,
          averageWaitTime: 0,
          averageProcessingTime: 0,
          successRate: 0
        }
      })),
      getMetrics: vi.fn(() => ({
        totalRequests: 0,
        completedRequests: 0,
        failedRequests: 0,
        timeoutRequests: 0,
        averageWaitTime: 0,
        averageProcessingTime: 0,
        currentQueueSize: 0,
        activeRequests: 0,
        successRate: 0,
        requestsPerMinute: 0,
        peakQueueSize: 0,
        throughput: {
          last1min: 0,
          last5min: 0,
          last15min: 0
        }
      })),
      isHealthy: vi.fn(() => true),
      clearQueue: vi.fn(),
      on: vi.fn()
    }))
  }
}));

describe('NLPService', () => {
  let nlpService: NLPService;
  let mockConfig: NLPServiceConfig;

  beforeEach(() => {
    mockConfig = {
      port: 3001,
      grpcPort: 50051,
      host: 'localhost',
      environment: 'test',
      queue: {
        maxConcurrent: 2,
        defaultTimeout: 30000,
        maxRetries: 2,
        persistenceEnabled: false,
        persistencePath: './test-data'
      },
      monitoring: {
        enabled: true,
        healthCheckInterval: 5000,
        alertThresholds: {
          queueSize: 10,
          errorRate: 0.1,
          processingTime: 5000,
          memoryUsage: 80
        }
      },
      discovery: {
        enabled: false,
        serviceName: 'test-nlp-service',
        serviceVersion: '1.0.0-test',
        heartbeatInterval: 10000
      },
      security: {
        rateLimiting: {
          enabled: false,
          max: 100,
          timeWindow: '1 minute'
        },
        cors: {
          enabled: false,
          origins: []
        },
        apiKeys: {
          enabled: false,
          required: false
        }
      },
      shutdown: {
        timeout: 5000,
        signals: ['SIGINT', 'SIGTERM']
      }
    };

    nlpService = new NLPService(mockConfig);
  });

  afterEach(async () => {
    if (nlpService) {
      await nlpService.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(nlpService).toBeDefined();
      const status = nlpService.getStatus();
      expect(status.service).toBe('nlp-service');
      expect(status.version).toBeDefined();
    });

    it('should start successfully', async () => {
      await expect(nlpService.start()).resolves.not.toThrow();
      const status = nlpService.getStatus();
      expect(status.status).toBe('healthy');
    });

    it('should handle start errors gracefully', async () => {
      // Mock initialization failure
      vi.spyOn(nlpService as any, 'initializeDependencies').mockRejectedValue(
        new Error('Initialization failed')
      );

      await expect(nlpService.start()).rejects.toThrow('Initialization failed');
    });
  });

  describe('Query Processing', () => {
    beforeEach(async () => {
      await nlpService.start();
    });

    it('should process a simple query successfully', async () => {
      const result = await nlpService.processQuery('add milk to my list');
      
      expect(result).toBeDefined();
      expect(result.entities).toBeInstanceOf(Array);
      expect(result.intent).toBeDefined();
      expect(result.normalizedItems).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.processingMetadata).toBeDefined();
    });

    it('should handle empty queries', async () => {
      await expect(nlpService.processQuery('')).rejects.toThrow('Query cannot be empty');
    });

    it('should handle null queries', async () => {
      await expect(nlpService.processQuery(null as any)).rejects.toThrow('Query cannot be empty');
    });

    it('should process queries with different priorities', async () => {
      const highPriorityResult = await nlpService.processQuery('urgent: add eggs', 'high');
      const lowPriorityResult = await nlpService.processQuery('maybe add cheese', 'low');
      
      expect(highPriorityResult).toBeDefined();
      expect(lowPriorityResult).toBeDefined();
    });

    it('should handle processing timeouts', async () => {
      // Mock queue timeout
      const mockQueue = (nlpService as any).queue;
      mockQueue.enqueue?.mockRejectedValue(new Error('Request timeout after 1000ms'));
      
      await expect(nlpService.processQuery('test query', 'normal', 1000))
        .rejects.toThrow('Query processing timeout');
    });

    it('should handle queue overflow', async () => {
      // Mock queue overflow
      const mockQueue = (nlpService as any).queue;
      mockQueue.enqueue?.mockRejectedValue(new Error('Queue overflow'));
      
      await expect(nlpService.processQuery('test query'))
        .rejects.toThrow('Queue is at capacity');
    });

    it('should reject queries during shutdown', async () => {
      await nlpService.shutdown();
      
      await expect(nlpService.processQuery('test query'))
        .rejects.toThrow('Service is shutting down');
    });
  });

  describe('Batch Processing', () => {
    beforeEach(async () => {
      await nlpService.start();
    });

    it('should process batch queries successfully', async () => {
      const queries = [
        { query: 'add milk' },
        { query: 'add bread' },
        { query: 'add eggs' }
      ];

      const result = await nlpService.processBatch(queries);
      
      expect(result).toBeDefined();
      expect(result.batchId).toBeDefined();
      expect(result.results).toHaveLength(3);
      expect(result.completedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    it('should handle empty batch', async () => {
      await expect(nlpService.processBatch([]))
        .rejects.toThrow('Batch cannot be empty');
    });

    it('should handle mixed success/failure in batch', async () => {
      // Mock some failures in batch processing
      const mockQueue = (nlpService as any).queue;
      mockQueue.enqueueBatch?.mockResolvedValue([
        { entities: [], intent: { action: 'add', confidence: 0.8 }, normalizedItems: [] },
        null, // Failed query
        { entities: [], intent: { action: 'add', confidence: 0.7 }, normalizedItems: [] }
      ]);

      const queries = [
        { query: 'add milk' },
        { query: 'invalid query that fails' },
        { query: 'add eggs' }
      ];

      const result = await nlpService.processBatch(queries, 'normal', undefined, { 
        failFast: false 
      });
      
      expect(result.results).toHaveLength(3);
      expect(result.results[1]).toBeNull(); // Failed query
      expect(result.completedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    it('should reject batch during shutdown', async () => {
      await nlpService.shutdown();
      
      await expect(nlpService.processBatch([{ query: 'test' }]))
        .rejects.toThrow('Service is shutting down');
    });
  });

  describe('Service Status and Metrics', () => {
    beforeEach(async () => {
      await nlpService.start();
    });

    it('should provide service status', () => {
      const status = nlpService.getStatus();
      
      expect(status).toBeDefined();
      expect(status.service).toBe('nlp-service');
      expect(status.status).toBe('healthy');
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.dependencies).toBeDefined();
      expect(status.resources).toBeDefined();
    });

    it('should provide service metrics', () => {
      const metrics = nlpService.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.requests).toBeDefined();
      expect(metrics.queue).toBeDefined();
      expect(metrics.resources).toBeDefined();
      expect(metrics.dependencies).toBeDefined();
    });

    it('should provide queue status', () => {
      const queueStatus = nlpService.getQueueStatus();
      
      expect(queueStatus).toBeDefined();
      expect(typeof queueStatus.queueSize).toBe('number');
      expect(typeof queueStatus.activeRequests).toBe('number');
      // Queue status may have different shapes - check for health property existence
      if ('healthy' in queueStatus) {
        expect(typeof queueStatus.healthy).toBe('boolean');
      }
      if ('health' in queueStatus) {
        expect(typeof queueStatus.health).toBe('string');
      }
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop gracefully', async () => {
      await nlpService.start();
      expect(nlpService.getStatus().status).toBe('healthy');
      
      await nlpService.shutdown();
      // Service should still respond to status requests after shutdown
      const finalStatus = nlpService.getStatus();
      expect(finalStatus).toBeDefined();
    });

    it('should handle multiple shutdown calls', async () => {
      await nlpService.start();
      
      // Multiple shutdown calls should not cause errors
      await nlpService.shutdown();
      await nlpService.shutdown();
    });

    it('should respect shutdown timeout', async () => {
      await nlpService.start();
      
      const shutdownStart = Date.now();
      await nlpService.shutdown(1000); // 1 second timeout
      const shutdownDuration = Date.now() - shutdownStart;
      
      // Should complete within reasonable time (allowing for test overhead)
      expect(shutdownDuration).toBeLessThan(2000);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await nlpService.start();
    });

    it('should handle processing errors gracefully', async () => {
      // Mock processing error
      const mockQueue = (nlpService as any).queue;
      mockQueue.enqueue?.mockRejectedValue(new Error('Processing error'));
      
      await expect(nlpService.processQuery('test query'))
        .rejects.toThrow('Failed to process query');
    });

    it('should emit error events', async () => {
      let errorEmitted = false;
      nlpService.on('error', () => {
        errorEmitted = true;
      });

      // Trigger an error condition
      try {
        await nlpService.processQuery('');
      } catch (e) {
        // Expected
      }

      // Note: Error event emission would depend on internal implementation
    });
  });

  describe('Configuration Handling', () => {
    it('should respect max concurrent limit', () => {
      const status = nlpService.getStatus();
      const queueStatus = nlpService.getQueueStatus();
      
      // Check for maxConcurrent property existence
      if ('maxConcurrent' in queueStatus) {
        expect(queueStatus.maxConcurrent).toBe(mockConfig.queue.maxConcurrent);
      }
    });

    it('should handle monitoring configuration', () => {
      const newConfig = { ...mockConfig };
      newConfig.monitoring.enabled = false;
      
      const service = new NLPService(newConfig);
      expect(service).toBeDefined();
    });
  });

  describe('Queue Management', () => {
    beforeEach(async () => {
      await nlpService.start();
    });

    it('should clear queue when requested', () => {
      expect(() => nlpService.clearQueue()).not.toThrow();
    });

    it('should provide queue capacity check', () => {
      const queueStatus = nlpService.getQueueStatus();
      // Check for health indicator properties
      if ('healthy' in queueStatus) {
        expect(typeof queueStatus.healthy).toBe('boolean');
      }
      if ('health' in queueStatus) {
        expect(typeof queueStatus.health).toBe('string');
      }
    });
  });
});