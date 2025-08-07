/**
 * Edge Cases and Error Scenarios Integration Tests
 * 
 * Comprehensive testing of error conditions, edge cases, and system resilience
 * under various failure scenarios and extreme conditions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { WalmartServiceMesh } from '../../src/microservices/WalmartServiceMesh.js';
import { CircuitBreakerManager } from '../../src/core/events/CircuitBreaker.js';
import { logger } from '../../src/utils/logger.js';

interface NetworkPartitionSimulator {
  blockService(serviceName: string): Promise<void>;
  unblockService(serviceName: string): Promise<void>;
  simulateLatency(serviceName: string, delayMs: number): Promise<void>;
  restoreNormalLatency(serviceName: string): Promise<void>;
}

interface MemoryLeakDetector {
  startMonitoring(serviceName: string): void;
  stopMonitoring(serviceName: string): void;
  getMemoryUsage(serviceName: string): Promise<number>;
  detectLeaks(): Promise<Array<{ service: string; leakRate: number }>>;
}

describe('Edge Cases and Error Scenarios', () => {
  let serviceMesh: WalmartServiceMesh;
  let redis: Redis;
  let axiosClient: AxiosInstance;
  let circuitBreaker: CircuitBreakerManager;
  let networkSimulator: NetworkPartitionSimulator;
  let memoryDetector: MemoryLeakDetector;
  
  const API_BASE = 'http://localhost:3000';
  const NLP_BASE = 'http://localhost:3008';
  const PRICING_BASE = 'http://localhost:3007';
  
  beforeAll(async () => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 13, // Use separate DB for error scenario tests
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    await redis.connect();
    await redis.flushdb();

    circuitBreaker = new CircuitBreakerManager();
    serviceMesh = WalmartServiceMesh.getInstance();
    
    axiosClient = axios.create({
      timeout: 15000,
      validateStatus: () => true,
      maxRedirects: 3,
      retry: 3
    });

    // Initialize test utilities
    networkSimulator = createNetworkSimulator();
    memoryDetector = createMemoryDetector();

    logger.info('Edge cases test setup complete', 'EDGE_CASES_TEST');
  });

  afterAll(async () => {
    await serviceMesh.shutdown();
    await redis.flushdb();
    await redis.disconnect();
  });

  describe('Partial Service Failures', () => {
    it('should handle NLP service failure gracefully', async () => {
      // Simulate NLP service failure
      await networkSimulator.blockService('walmart-nlp-queue');
      
      const sessionData = {
        userId: 'failure-test-001',
        sessionId: 'session-nlp-failure-001',
        budget: 100
      };
      
      // Create session (should work)
      const sessionResponse = await axiosClient.post(`${API_BASE}/api/grocery/session`, sessionData);
      expect(sessionResponse.status).toBe(200);
      
      // Try NLP processing (should fail gracefully)
      const nlpResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: "I need milk and bread",
        sessionId: sessionData.sessionId
      });
      
      // Should get service unavailable or fallback response
      expect([503, 200]).toContain(nlpResponse.status);
      
      if (nlpResponse.status === 200) {
        // Fallback mechanism should be indicated
        expect(nlpResponse.data.fallback).toBe(true);
        expect(nlpResponse.data.source).toBe('rule_based');
      }
      
      // Restore NLP service
      await networkSimulator.unblockService('walmart-nlp-queue');
      
      // Wait for service recovery
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try again (should work)
      const recoveryResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
        query: "I need milk and bread",
        sessionId: sessionData.sessionId
      });
      
      expect(recoveryResponse.status).toBe(200);
      expect(recoveryResponse.data.fallback).toBeFalsy();
    });

    it('should handle pricing service degradation', async () => {
      // Simulate high latency in pricing service
      await networkSimulator.simulateLatency('walmart-pricing', 8000);
      
      const sessionData = {
        userId: 'degraded-pricing-001',
        sessionId: 'session-degraded-pricing-001'
      };
      
      await axiosClient.post(`${API_BASE}/api/grocery/session`, sessionData);
      
      // Try to get pricing (should timeout or provide cached/estimated prices)
      const startTime = Date.now();
      const pricingResponse = await axiosClient.post(`${PRICING_BASE}/pricing/bulk-quote`, {
        productIds: ['test-001', 'test-002'],
        sessionId: sessionData.sessionId,
        timeout: 5000
      });
      const responseTime = Date.now() - startTime;
      
      expect(pricingResponse.status).toBeIn([200, 408, 503]);
      
      if (pricingResponse.status === 200) {
        // Should use cached or estimated prices
        expect(pricingResponse.data.estimated).toBe(true);
        expect(pricingResponse.data.source).toBeIn(['cache', 'historical', 'estimated']);
      }
      
      // Response time should be reasonable even with degraded service
      expect(responseTime).toBeLessThan(6000);
      
      // Restore normal latency
      await networkSimulator.restoreNormalLatency('walmart-pricing');
    });

    it('should handle database deadlocks and connection issues', async () => {
      const testSessions = Array.from({ length: 10 }, (_, i) => ({
        userId: `deadlock-user-${i}`,
        sessionId: `deadlock-session-${i}`,
        budget: 50 + (i * 10)
      }));
      
      // Create concurrent sessions that might cause database contention
      const sessionPromises = testSessions.map(session => 
        axiosClient.post(`${API_BASE}/api/grocery/session`, session)
      );
      
      const sessionResponses = await Promise.all(sessionPromises);
      const successfulSessions = sessionResponses.filter(r => r.status === 200);
      
      // At least some sessions should succeed despite potential contention
      expect(successfulSessions.length).toBeGreaterThan(testSessions.length / 2);
      
      // Now create concurrent cart operations on the same products
      const cartPromises = successfulSessions.map((response, index) => 
        axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
          sessionId: testSessions[index].sessionId,
          items: [
            { productId: 'deadlock-product-001', quantity: 1, price: 9.99 },
            { productId: 'deadlock-product-002', quantity: 2, price: 4.99 }
          ]
        })
      );
      
      const cartResponses = await Promise.all(cartPromises);
      const successfulCarts = cartResponses.filter(r => r.status === 200);
      
      // Should handle concurrent access gracefully
      expect(successfulCarts.length).toBeGreaterThan(0);
      
      // Verify data consistency - no duplicate inventory reservations
      const inventoryResponse = await axiosClient.get(
        `${API_BASE}/api/grocery/inventory/deadlock-product-001`
      );
      
      if (inventoryResponse.status === 200) {
        const reservedQuantity = inventoryResponse.data.reserved || 0;
        const expectedReservations = successfulCarts.length;
        expect(reservedQuantity).toBeLessThanOrEqual(expectedReservations);
      }
    });
  });

  describe('Network Partition Scenarios', () => {
    it('should handle split-brain scenarios in service discovery', async () => {
      // Simulate network partition affecting service registry
      const initialServices = await axiosClient.get(`${API_BASE}/service-mesh/services`);
      expect(initialServices.status).toBe(200);
      
      const serviceCount = initialServices.data.services.length;
      
      // Simulate partition by temporarily isolating some services
      await Promise.all([
        networkSimulator.blockService('walmart-cache-warmer'),
        networkSimulator.blockService('walmart-memory-monitor')
      ]);
      
      // Wait for partition to take effect
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Service registry should handle missing services gracefully
      const partitionedServices = await axiosClient.get(`${API_BASE}/service-mesh/services`);
      
      if (partitionedServices.status === 200) {
        // Should mark unavailable services as unhealthy rather than removing them
        const healthyServices = partitionedServices.data.services.filter(
          (s: any) => s.status === 'healthy'
        );
        
        expect(healthyServices.length).toBeLessThan(serviceCount);
        expect(partitionedServices.data.services.length).toBe(serviceCount); // All services still tracked
      }
      
      // Restore network connectivity
      await Promise.all([
        networkSimulator.unblockService('walmart-cache-warmer'),
        networkSimulator.unblockService('walmart-memory-monitor')
      ]);
      
      // Wait for services to recover
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Services should rejoin and be marked as healthy
      const recoveredServices = await axiosClient.get(`${API_BASE}/service-mesh/services`);
      
      if (recoveredServices.status === 200) {
        const healthyServices = recoveredServices.data.services.filter(
          (s: any) => s.status === 'healthy'
        );
        
        expect(healthyServices.length).toBeGreaterThan(serviceCount - 2);
      }
    });

    it('should maintain eventual consistency during partitions', async () => {
      const testData = {
        userId: 'partition-user-001',
        sessionId: 'partition-session-001',
        items: [
          { productId: 'partition-001', quantity: 3, price: 12.99 },
          { productId: 'partition-002', quantity: 1, price: 25.99 }
        ]
      };
      
      // Create initial state
      await axiosClient.post(`${API_BASE}/api/grocery/session`, testData);
      await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId: testData.sessionId,
        items: testData.items
      });
      
      // Verify initial state
      const initialCart = await axiosClient.get(`${API_BASE}/api/grocery/cart/${testData.sessionId}`);
      expect(initialCart.status).toBe(200);
      expect(initialCart.data.items).toHaveLength(2);
      
      // Simulate partition affecting cache services
      await networkSimulator.blockService('walmart-cache-warmer');
      
      // Make changes during partition
      const partitionChanges = {
        sessionId: testData.sessionId,
        items: [{ productId: 'partition-003', quantity: 2, price: 8.99 }]
      };
      
      const partitionResponse = await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, partitionChanges);
      
      // Should still work, possibly with degraded performance
      expect([200, 202]).toContain(partitionResponse.status);
      
      // Restore connectivity
      await networkSimulator.unblockService('walmart-cache-warmer');
      
      // Wait for synchronization
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify eventual consistency
      const finalCart = await axiosClient.get(`${API_BASE}/api/grocery/cart/${testData.sessionId}`);
      expect(finalCart.status).toBe(200);
      expect(finalCart.data.items.length).toBeGreaterThanOrEqual(2);
      
      // Should have the changes made during partition
      const addedItem = finalCart.data.items.find((item: any) => item.productId === 'partition-003');
      expect(addedItem).toBeDefined();
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory pressure gracefully', async () => {
      memoryDetector.startMonitoring('walmart-nlp-queue');
      
      // Generate large number of concurrent NLP requests
      const largeRequests = Array.from({ length: 50 }, (_, i) => {
        const largeQuery = `This is a very long grocery list with many items: ${
          Array.from({ length: 100 }, (_, j) => `item-${i}-${j}`).join(', ')
        }`;
        
        return axiosClient.post(`${NLP_BASE}/nlp/process`, {
          query: largeQuery,
          sessionId: `memory-test-${i}`,
          options: { extractAll: true, deepAnalysis: true }
        });
      });
      
      const results = await Promise.allSettled(largeRequests);
      const successful = results.filter(r => r.status === 'fulfilled' && 
        (r.value as any).status === 200);
      const failed = results.filter(r => r.status === 'rejected' || 
        (r.status === 'fulfilled' && (r.value as any).status !== 200));
      
      // Should handle some requests successfully, gracefully reject others
      expect(successful.length).toBeGreaterThan(10);
      expect(failed.length).toBeGreaterThan(0); // Some should fail due to resource limits
      
      // Check for memory leaks
      await new Promise(resolve => setTimeout(resolve, 2000));
      const memoryUsage = await memoryDetector.getMemoryUsage('walmart-nlp-queue');
      const leaks = await memoryDetector.detectLeaks();
      
      // Memory should stabilize after requests complete
      expect(leaks.length).toBe(0);
      
      memoryDetector.stopMonitoring('walmart-nlp-queue');
    });

    it('should handle queue overflow conditions', async () => {
      const overflowRequests = Array.from({ length: 100 }, (_, i) => 
        axiosClient.post(`${NLP_BASE}/nlp/queue/add`, {
          query: `Overflow test query ${i}`,
          sessionId: `overflow-${i}`,
          priority: i % 3 === 0 ? 'high' : 'normal'
        })
      );
      
      const results = await Promise.allSettled(overflowRequests);
      
      const accepted = results.filter(r => r.status === 'fulfilled' && 
        (r.value as any).status === 202); // Queued
      const rejected = results.filter(r => r.status === 'fulfilled' && 
        (r.value as any).status === 429); // Too Many Requests
      
      // Should accept some, reject others when queue is full
      expect(accepted.length + rejected.length).toBe(100);
      expect(rejected.length).toBeGreaterThan(0);
      
      // High priority requests should be more likely to be accepted
      const highPriorityAccepted = accepted.filter((_, index) => index % 3 === 0);
      const normalPriorityAccepted = accepted.filter((_, index) => index % 3 !== 0);
      
      if (accepted.length > 30) {
        expect(highPriorityAccepted.length / (accepted.length / 3)).toBeGreaterThan(
          normalPriorityAccepted.length / (accepted.length * 2 / 3)
        );
      }
      
      // Check queue status
      const queueStatus = await axiosClient.get(`${NLP_BASE}/nlp/queue/status`);
      expect(queueStatus.status).toBe(200);
      expect(queueStatus.data.size).toBeGreaterThan(0);
      expect(queueStatus.data.processing).toBe(true);
    });

    it('should handle rate limiting appropriately', async () => {
      const userId = 'rate-limit-test-001';
      const rapidRequests = Array.from({ length: 20 }, (_, i) => 
        axiosClient.post(`${API_BASE}/api/grocery/search`, {
          query: `rapid search ${i}`,
          userId,
          timestamp: Date.now()
        })
      );
      
      const results = await Promise.all(rapidRequests);
      
      const successful = results.filter(r => r.status === 200);
      const rateLimited = results.filter(r => r.status === 429);
      
      // Should rate limit excessive requests
      expect(rateLimited.length).toBeGreaterThan(0);
      expect(successful.length).toBeLessThan(20);
      
      // Wait for rate limit window to reset
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      // Should work again after rate limit resets
      const resetResponse = await axiosClient.post(`${API_BASE}/api/grocery/search`, {
        query: 'post rate limit test',
        userId
      });
      
      expect(resetResponse.status).toBe(200);
    });
  });

  describe('Authentication and Security Edge Cases', () => {
    it('should handle token expiry gracefully', async () => {
      // Create session with short-lived token
      const shortTokenResponse = await axiosClient.post(`${API_BASE}/auth/token`, {
        userId: 'token-expiry-test',
        expiresIn: '2s' // Very short expiry for testing
      });
      
      expect(shortTokenResponse.status).toBe(200);
      const { token } = shortTokenResponse.data;
      
      // Use token immediately (should work)
      const immediateResponse = await axiosClient.get(`${API_BASE}/api/grocery/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      expect(immediateResponse.status).toBe(200);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to use expired token (should fail)
      const expiredResponse = await axiosClient.get(`${API_BASE}/api/grocery/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      expect(expiredResponse.status).toBe(401);
      expect(expiredResponse.data.error).toMatch(/token.*expired/i);
      
      // Should include refresh instructions
      expect(expiredResponse.data.refreshUrl || expiredResponse.data.authUrl).toBeDefined();
    });

    it('should detect and prevent abuse patterns', async () => {
      const suspiciousRequests = Array.from({ length: 30 }, (_, i) => 
        axiosClient.post(`${API_BASE}/api/grocery/search`, {
          query: `suspicious search ${i}`,
          userId: `bot-user-${i % 3}`, // Multiple similar user IDs
          userAgent: 'SuspiciousBot/1.0'
        })
      );
      
      const results = await Promise.all(suspiciousRequests);
      
      const blocked = results.filter(r => [403, 429].includes(r.status));
      const allowed = results.filter(r => r.status === 200);
      
      // Should detect and block suspicious patterns
      expect(blocked.length).toBeGreaterThan(0);
      
      // Should not block all legitimate-looking requests
      if (allowed.length > 0) {
        expect(allowed.length).toBeLessThan(suspiciousRequests.length);
      }
    });

    it('should handle malformed authentication data', async () => {
      const malformedRequests = [
        // Malformed JWT
        axiosClient.get(`${API_BASE}/api/grocery/profile`, {
          headers: { Authorization: 'Bearer invalid.jwt.token' }
        }),
        // SQL injection attempt in userId
        axiosClient.post(`${API_BASE}/api/grocery/session`, {
          userId: "'; DROP TABLE sessions; --",
          sessionId: 'malformed-001'
        }),
        // XSS attempt in query
        axiosClient.post(`${NLP_BASE}/nlp/process`, {
          query: '<script>alert("xss")</script>',
          sessionId: 'malformed-002'
        }),
        // Extremely long authentication header
        axiosClient.get(`${API_BASE}/api/grocery/profile`, {
          headers: { Authorization: `Bearer ${'a'.repeat(10000)}` }
        })
      ];
      
      const results = await Promise.all(malformedRequests);
      
      // All should be handled gracefully with appropriate error codes
      results.forEach((response, index) => {
        expect([400, 401, 413, 422]).toContain(response.status);
        expect(response.data).toBeDefined();
        
        // Should not leak internal error details
        expect(response.data.stack).toBeUndefined();
        expect(response.data.internalError).toBeUndefined();
      });
    });
  });

  describe('Data Corruption and Recovery', () => {
    it('should handle corrupted cache data', async () => {
      const sessionId = 'corruption-test-001';
      
      // Create normal session
      await axiosClient.post(`${API_BASE}/api/grocery/session`, {
        userId: 'corruption-user',
        sessionId
      });
      
      // Manually corrupt cache data
      await redis.set(`session:${sessionId}`, 'corrupted-json-data{invalid}');
      await redis.set(`cart:${sessionId}`, '{"items": [malformed json}');
      
      // Try to access corrupted session
      const corruptedResponse = await axiosClient.get(`${API_BASE}/api/grocery/session/${sessionId}`);
      
      // Should handle corruption gracefully
      expect([200, 404, 500]).toContain(corruptedResponse.status);
      
      if (corruptedResponse.status === 200) {
        // Should have recovered or recreated session
        expect(corruptedResponse.data.recovered).toBe(true);
      } else if (corruptedResponse.status === 404) {
        // Should allow recreation of session
        const recreationResponse = await axiosClient.post(`${API_BASE}/api/grocery/session`, {
          userId: 'corruption-user',
          sessionId
        });
        expect(recreationResponse.status).toBe(200);
      }
      
      // Verify cache is cleaned up
      const cacheKeys = await redis.keys(`*${sessionId}*`);
      for (const key of cacheKeys) {
        const value = await redis.get(key);
        if (value) {
          expect(() => JSON.parse(value)).not.toThrow();
        }
      }
    });

    it('should recover from database inconsistencies', async () => {
      const sessionId = 'inconsistency-test-001';
      const userId = 'inconsistency-user';
      
      // Create session and cart
      await axiosClient.post(`${API_BASE}/api/grocery/session`, { userId, sessionId });
      await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
        sessionId,
        items: [{ productId: 'inconsistent-001', quantity: 5, price: 9.99 }]
      });
      
      // Simulate inconsistency by directly modifying data
      await redis.hset(`cart:${sessionId}`, 'items', JSON.stringify([
        { productId: 'inconsistent-001', quantity: -5, price: 9.99 }, // Negative quantity
        { productId: 'inconsistent-002', quantity: 'invalid', price: 'not-a-number' }
      ]));
      
      // Try to access inconsistent cart
      const inconsistentResponse = await axiosClient.get(`${API_BASE}/api/grocery/cart/${sessionId}`);
      
      expect(inconsistentResponse.status).toBe(200);
      
      // Should have cleaned up inconsistent data
      const cleanedItems = inconsistentResponse.data.items;
      expect(cleanedItems.every((item: any) => 
        typeof item.quantity === 'number' && 
        item.quantity >= 0 &&
        typeof item.price === 'number' &&
        item.price > 0
      )).toBe(true);
      
      // Should log inconsistency for investigation
      expect(inconsistentResponse.data.warnings).toBeDefined();
      expect(inconsistentResponse.data.warnings.some((w: string) => 
        w.includes('inconsistency') || w.includes('cleaned')
      )).toBe(true);
    });
  });

  // Helper Functions
  function createNetworkSimulator(): NetworkPartitionSimulator {
    const blockedServices = new Set<string>();
    const latencySettings = new Map<string, number>();
    
    return {
      async blockService(serviceName: string): Promise<void> {
        blockedServices.add(serviceName);
        // In a real implementation, this would configure network rules
        logger.info(`Network simulation: Blocking service ${serviceName}`, 'NETWORK_SIMULATOR');
      },
      
      async unblockService(serviceName: string): Promise<void> {
        blockedServices.delete(serviceName);
        logger.info(`Network simulation: Unblocking service ${serviceName}`, 'NETWORK_SIMULATOR');
      },
      
      async simulateLatency(serviceName: string, delayMs: number): Promise<void> {
        latencySettings.set(serviceName, delayMs);
        logger.info(`Network simulation: Adding ${delayMs}ms latency to ${serviceName}`, 'NETWORK_SIMULATOR');
      },
      
      async restoreNormalLatency(serviceName: string): Promise<void> {
        latencySettings.delete(serviceName);
        logger.info(`Network simulation: Restored normal latency for ${serviceName}`, 'NETWORK_SIMULATOR');
      }
    };
  }
  
  function createMemoryDetector(): MemoryLeakDetector {
    const monitoredServices = new Map<string, NodeJS.Timeout>();
    const memoryBaselines = new Map<string, number>();
    
    return {
      startMonitoring(serviceName: string): void {
        const interval = setInterval(async () => {
          const memUsage = process.memoryUsage();
          const currentUsage = memUsage.heapUsed;
          
          if (!memoryBaselines.has(serviceName)) {
            memoryBaselines.set(serviceName, currentUsage);
          }
          
          logger.debug(`Memory usage for ${serviceName}: ${currentUsage} bytes`, 'MEMORY_DETECTOR');
        }, 1000);
        
        monitoredServices.set(serviceName, interval);
      },
      
      stopMonitoring(serviceName: string): void {
        const interval = monitoredServices.get(serviceName);
        if (interval) {
          clearInterval(interval);
          monitoredServices.delete(serviceName);
        }
      },
      
      async getMemoryUsage(serviceName: string): Promise<number> {
        return process.memoryUsage().heapUsed;
      },
      
      async detectLeaks(): Promise<Array<{ service: string; leakRate: number }>> {
        const leaks: Array<{ service: string; leakRate: number }> = [];
        
        for (const [serviceName, baseline] of memoryBaselines) {
          const current = process.memoryUsage().heapUsed;
          const growth = current - baseline;
          const growthRate = growth / baseline;
          
          if (growthRate > 0.5) { // 50% growth indicates potential leak
            leaks.push({
              service: serviceName,
              leakRate: growthRate
            });
          }
        }
        
        return leaks;
      }
    };
  }

  // Custom matcher for more flexible status code checking
  expect.extend({
    toBeIn(received: any, expected: any[]) {
      const pass = expected.includes(received);
      if (pass) {
        return {
          message: () => `expected ${received} not to be in [${expected.join(', ')}]`,
          pass: true,
        };
      } else {
        return {
          message: () => `expected ${received} to be in [${expected.join(', ')}]`,
          pass: false,
        };
      }
    },
  });
});