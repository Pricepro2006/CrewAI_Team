/**
 * Integration Tests for NLP Microservice
 * Tests the full service integration including API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NLPMicroservice } from '../index.js';
import type { NLPServiceConfig } from '../types/index.js';

// Mock the GroceryNLPQueue for integration tests
vi.mock('../../../../api/services/GroceryNLPQueue.js', () => ({
  GroceryNLPQueue: {
    getInstance: vi.fn(() => ({
      enqueue: vi.fn(async (operation) => {
        // Simulate actual NLP processing
        await new Promise(resolve => setTimeout(resolve, 100));
        return await operation();
      }),
      enqueueBatch: vi.fn(async (operations) => {
        // Process operations in sequence for testing
        const results = [];
        for (const operation of operations) {
          try {
            const result = await operation();
            results.push(result);
          } catch (error) {
            results.push(null);
          }
        }
        return results;
      }),
      getStatus: vi.fn(() => ({
        healthy: true,
        queueSize: 0,
        activeRequests: 0,
        maxConcurrent: 2,
        metrics: {
          totalRequests: 5,
          completedRequests: 4,
          failedRequests: 1,
          averageWaitTime: 50,
          averageProcessingTime: 200,
          successRate: 0.8
        },
        estimatedWaitTime: 0
      })),
      getMetrics: vi.fn(() => ({
        totalRequests: 10,
        completedRequests: 8,
        failedRequests: 2,
        timeoutRequests: 0,
        averageWaitTime: 50,
        averageProcessingTime: 200,
        currentQueueSize: 1,
        activeRequests: 0,
        successRate: 0.8,
        requestsPerMinute: 60,
        peakQueueSize: 3,
        throughput: {
          last1min: 15,
          last5min: 12,
          last15min: 10
        }
      })),
      isHealthy: vi.fn(() => true),
      clearQueue: vi.fn(),
      on: vi.fn(),
      emit: vi.fn()
    }))
  }
}));

describe('NLP Microservice Integration', () => {
  let app: NLPMicroservice;
  let baseUrl: string;
  
  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3002'; // Use different port for testing
    process.env.GRPC_PORT = '50052';
    process.env.MONITORING_ENABLED = 'false';
    process.env.SERVICE_DISCOVERY_ENABLED = 'false';
    
    app = new NLPMicroservice();
    await app.start();
    
    baseUrl = 'http://localhost:3002';
  }, 30000); // 30 second timeout for startup

  afterAll(async () => {
    if (app) {
      await app.stop();
    }
  }, 15000); // 15 second timeout for shutdown

  describe('REST API Endpoints', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.service).toBe('nlp-service');
      expect(data.status).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    it('should provide detailed health information', async () => {
      const response = await fetch(`${baseUrl}/health/detailed`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.service).toBeDefined();
      expect(data.metrics).toBeDefined();
      expect(data.queue).toBeDefined();
    });

    it('should provide service metrics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(data.requests).toBeDefined();
      expect(data.queue).toBeDefined();
      expect(data.resources).toBeDefined();
    });

    it('should serve API documentation', async () => {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(200);
      
      const content = await response.text();
      expect(content).toContain('NLP Microservice API');
      expect(content).toContain('/health');
      expect(content).toContain('/api/v1/process');
    });

    it('should process NLP queries via REST API', async () => {
      const requestBody = {
        query: 'add 2 pounds of apples to my shopping list',
        priority: 'normal',
        metadata: { source: 'integration-test' }
      };

      const response = await fetch(`${baseUrl}/api/v1/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.requestId).toBeDefined();
      expect(data.result).toBeDefined();
      expect(data.result.entities).toBeInstanceOf(Array);
      expect(data.result.intent).toBeDefined();
      expect(data.result.normalized).toBeDefined();
      expect(data.processingTime).toBeGreaterThan(0);
    });

    it('should process batch queries via REST API', async () => {
      const requestBody = {
        queries: [
          { query: 'add milk' },
          { query: 'add bread' },
          { query: 'remove eggs' }
        ],
        priority: 'normal'
      };

      const response = await fetch(`${baseUrl}/api/v1/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.batchId).toBeDefined();
      expect(data.results).toHaveLength(3);
      expect(data.completedCount).toBeGreaterThan(0);
      expect(data.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should handle invalid requests gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/v1/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ /* missing query */ })
      });

      expect(response.status).toBe(400);
    });

    it('should provide queue status', async () => {
      const response = await fetch(`${baseUrl}/api/v1/queue/status`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.healthy).toBeDefined();
      expect(data.queueSize).toBeDefined();
      expect(data.activeRequests).toBeDefined();
      expect(data.maxConcurrent).toBe(2); // Should respect Ollama limit
    });

    it('should handle 404 for unknown endpoints', async () => {
      const response = await fetch(`${baseUrl}/api/v1/nonexistent`);
      expect(response.status).toBe(404);
    });
  });

  describe('Service Status and Monitoring', () => {
    it('should provide comprehensive service status', async () => {
      const response = await fetch(`${baseUrl}/api/v1/status`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.service).toBe('nlp-service');
      expect(data.version).toBeDefined();
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(data.dependencies).toBeDefined();
      expect(data.resources).toBeDefined();
      expect(data.queue).toBeDefined();
    });

    it('should track request metrics over time', async () => {
      // Make several requests to generate metrics
      for (let i = 0; i < 3; i++) {
        await fetch(`${baseUrl}/api/v1/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `test query ${i}` })
        });
      }

      const response = await fetch(`${baseUrl}/metrics`);
      const data = await response.json();
      
      expect(data.requests.total).toBeGreaterThan(0);
      expect(data.queue).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/v1/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json'
      });

      expect(response.status).toBe(400);
    });

    it('should handle empty requests', async () => {
      const response = await fetch(`${baseUrl}/api/v1/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: '' })
      });

      expect(response.status).toBe(400);
    });

    it('should handle large batch requests appropriately', async () => {
      const largeQueries = Array(15).fill(null).map((_, i) => ({ 
        query: `query ${i}` 
      }));

      const response = await fetch(`${baseUrl}/api/v1/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ queries: largeQueries })
      });

      // Should reject large batches (over limit of 10)
      expect(response.status).toBe(400);
    });
  });

  describe('Service Configuration', () => {
    it('should respect Ollama 2-operation limit', async () => {
      const queueResponse = await fetch(`${baseUrl}/api/v1/queue/status`);
      const queueData = await queueResponse.json();
      
      expect(queueData.maxConcurrent).toBe(2);
    });

    it('should show correct service version', async () => {
      const statusResponse = await fetch(`${baseUrl}/api/v1/status`);
      const statusData = await statusResponse.json();
      
      expect(statusData.version).toBeDefined();
      expect(typeof statusData.version).toBe('string');
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map((_, i) => 
        fetch(`${baseUrl}/api/v1/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `concurrent query ${i}` })
        })
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
      });

      // Verify all responses
      const results = await Promise.all(responses.map(r => r.json()));
      results.forEach((data, i) => {
        expect(data.success).toBe(true);
        expect(data.requestId).toBeDefined();
      });
    });

    it('should maintain queue health under load', async () => {
      // Generate some load
      const loadRequests = Array(10).fill(null).map((_, i) => 
        fetch(`${baseUrl}/api/v1/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `load test ${i}` })
        }).catch(() => ({ status: 500 })) // Handle any failures gracefully
      );

      await Promise.all(loadRequests);

      // Check queue health after load
      const healthResponse = await fetch(`${baseUrl}/health`);
      expect(healthResponse.status).toBe(200);

      const healthData = await healthResponse.json();
      expect(['healthy', 'degraded']).toContain(healthData.status);
    });
  });

  describe('Request Tracking and Tracing', () => {
    it('should include request IDs in responses', async () => {
      const response = await fetch(`${baseUrl}/api/v1/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': 'test-request-123'
        },
        body: JSON.stringify({ query: 'test query with ID' })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('x-request-id')).toBe('test-request-123');
      
      const data = await response.json();
      expect(data.requestId).toBeDefined();
    });

    it('should generate request IDs if not provided', async () => {
      const response = await fetch(`${baseUrl}/api/v1/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query without ID' })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('x-request-id')).toBeDefined();
      
      const data = await response.json();
      expect(data.requestId).toBeDefined();
    });
  });

  describe('Service Integration Status', () => {
    it('should provide complete integration status', () => {
      const status = app.getStatus();
      
      expect(status.service).toBeDefined();
      expect(status.service.service).toBe('nlp-service');
      expect(status.config).toBeDefined();
      expect(status.config.environment).toBe('test');
      expect(status.config.ports.http).toBe(3002);
      expect(status.config.ports.grpc).toBe(50052);
    });
  });
});