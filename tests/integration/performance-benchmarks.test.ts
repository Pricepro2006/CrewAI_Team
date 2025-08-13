/**
 * Performance Benchmarks for Microservices Architecture
 * 
 * Comprehensive performance testing to validate that the system meets
 * real-world performance requirements under various load conditions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../../src/utils/logger.js';

interface PerformanceMetrics {
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    concurrentUsers: number;
    totalRequests: number;
  };
  errors: {
    count: number;
    rate: number;
    types: Record<string, number>;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    networkIO: number;
  };
}

interface LoadTestConfig {
  duration: number;
  rampUpTime: number;
  maxConcurrentUsers: number;
  requestsPerUser: number;
  thinkTime: number;
}

interface PerformanceBaseline {
  service: string;
  operation: string;
  maxResponseTime: number;
  minThroughput: number;
  maxErrorRate: number;
}

describe('Performance Benchmarks', () => {
  let axiosClient: AxiosInstance;
  let redis: Redis;
  let performanceBaselines: PerformanceBaseline[];
  
  const API_BASE = 'http://localhost:3000';
  const NLP_BASE = 'http://localhost:3008';
  const PRICING_BASE = 'http://localhost:3007';
  const CACHE_BASE = 'http://localhost:3006';

  beforeAll(async () => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 12, // Performance test DB
      lazyConnect: true
    });

    await redis.connect();
    await redis.flushdb();

    axiosClient = axios.create({
      timeout: 30000,
      validateStatus: () => true,
    });

    // Define performance baselines
    performanceBaselines = [
      {
        service: 'walmart-api-server',
        operation: 'session_creation',
        maxResponseTime: 200,
        minThroughput: 100,
        maxErrorRate: 0.01
      },
      {
        service: 'walmart-nlp-queue',
        operation: 'nlp_processing',
        maxResponseTime: 2000,
        minThroughput: 10,
        maxErrorRate: 0.02
      },
      {
        service: 'walmart-pricing',
        operation: 'price_lookup',
        maxResponseTime: 500,
        minThroughput: 50,
        maxErrorRate: 0.01
      },
      {
        service: 'walmart-cache-warmer',
        operation: 'cache_operation',
        maxResponseTime: 100,
        minThroughput: 200,
        maxErrorRate: 0.005
      }
    ];

    logger.info('Performance benchmark setup complete', 'PERF_TEST');
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.disconnect();
  });

  describe('Single Service Performance', () => {
    it('should meet API server response time requirements', async () => {
      const testConfig: LoadTestConfig = {
        duration: 30000, // 30 seconds
        rampUpTime: 5000, // 5 seconds
        maxConcurrentUsers: 50,
        requestsPerUser: 10,
        thinkTime: 100
      };

      const metrics = await runLoadTest(
        async (userId: number) => {
          const response = await axiosClient.post(`${API_BASE}/api/grocery/session`, {
            userId: `perf-user-${userId}`,
            sessionId: `perf-session-${userId}-${Date.now()}`,
            budget: 100 + (userId * 10)
          });
          return response;
        },
        testConfig
      );

      // Validate against baselines
      const baseline = performanceBaselines.find(b => 
        b.service === 'walmart-api-server' && b.operation === 'session_creation'
      )!;

      expect(metrics.responseTime.p95).toBeLessThan(baseline.maxResponseTime);
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThan(baseline.minThroughput);
      expect(metrics.errors.rate).toBeLessThan(baseline.maxErrorRate);

      logger.info('API server performance validated', 'PERF_TEST', {
        p95ResponseTime: metrics.responseTime.p95,
        throughput: metrics.throughput.requestsPerSecond,
        errorRate: metrics.errors.rate
      });
    });

    it('should meet NLP processing performance targets', async () => {
      const testQueries = [
        "I need milk and bread",
        "organic vegetables for salad",
        "gluten-free snacks for kids",
        "chicken breast and brown rice",
        "fresh fruits and yogurt"
      ];

      const testConfig: LoadTestConfig = {
        duration: 60000, // 1 minute
        rampUpTime: 10000, // 10 seconds
        maxConcurrentUsers: 20,
        requestsPerUser: 5,
        thinkTime: 500
      };

      const metrics = await runLoadTest(
        async (userId: number, requestIndex: number) => {
          const query = testQueries[requestIndex % testQueries.length];
          const response = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
            query,
            sessionId: `nlp-perf-${userId}`,
            options: { extractAll: true }
          });
          return response;
        },
        testConfig
      );

      const baseline = performanceBaselines.find(b => 
        b.service === 'walmart-nlp-queue' && b.operation === 'nlp_processing'
      )!;

      expect(metrics.responseTime.p95).toBeLessThan(baseline.maxResponseTime);
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThan(baseline.minThroughput);
      expect(metrics.errors.rate).toBeLessThan(baseline.maxErrorRate);

      // Additional NLP-specific validations
      expect(metrics.responseTime.avg).toBeLessThan(1500); // Average under 1.5 seconds
      expect(metrics.responseTime.max).toBeLessThan(5000); // Max under 5 seconds

      logger.info('NLP processing performance validated', 'PERF_TEST', {
        avgResponseTime: metrics.responseTime.avg,
        maxResponseTime: metrics.responseTime.max,
        throughput: metrics.throughput.requestsPerSecond
      });
    });

    it('should validate pricing service performance under load', async () => {
      const productIds = Array.from({ length: 100 }, (_, i) => `product-${i + 1}`);

      const testConfig: LoadTestConfig = {
        duration: 45000, // 45 seconds
        rampUpTime: 8000, // 8 seconds
        maxConcurrentUsers: 30,
        requestsPerUser: 15,
        thinkTime: 200
      };

      const metrics = await runLoadTest(
        async (userId: number, requestIndex: number) => {
          const requestProductIds = productIds.slice(
            (requestIndex * 5) % 90,
            ((requestIndex * 5) % 90) + 5
          );
          
          const response = await axiosClient.post(`${PRICING_BASE}/pricing/bulk-quote`, {
            productIds: requestProductIds,
            sessionId: `pricing-perf-${userId}`,
            location: '90210'
          });
          return response;
        },
        testConfig
      );

      const baseline = performanceBaselines.find(b => 
        b.service === 'walmart-pricing' && b.operation === 'price_lookup'
      )!;

      expect(metrics.responseTime.p95).toBeLessThan(baseline.maxResponseTime);
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThan(baseline.minThroughput);
      expect(metrics.errors.rate).toBeLessThan(baseline.maxErrorRate);

      logger.info('Pricing service performance validated', 'PERF_TEST', {
        p50ResponseTime: metrics.responseTime.p50,
        p95ResponseTime: metrics.responseTime.p95,
        throughput: metrics.throughput.requestsPerSecond
      });
    });
  });

  describe('End-to-End Pipeline Performance', () => {
    it('should validate complete shopping workflow performance', async () => {
      const testConfig: LoadTestConfig = {
        duration: 90000, // 1.5 minutes
        rampUpTime: 15000, // 15 seconds
        maxConcurrentUsers: 25,
        requestsPerUser: 3,
        thinkTime: 2000 // 2 seconds between requests
      };

      const workflows = [
        "I need ingredients for pasta dinner",
        "organic breakfast items for family",
        "snacks and drinks for party",
        "healthy lunch ingredients",
        "baking supplies for cookies"
      ];

      const metrics = await runLoadTest(
        async (userId: number, requestIndex: number) => {
          const workflow = workflows[userId % workflows.length];
          
          // Complete shopping workflow
          const startTime = performance.now();
          
          // Step 1: Create session
          const sessionResponse = await axiosClient.post(`${API_BASE}/api/grocery/session`, {
            userId: `e2e-user-${userId}`,
            sessionId: `e2e-session-${userId}-${requestIndex}`,
            budget: 75 + (requestIndex * 25)
          });
          
          if (sessionResponse.status !== 200) {
            throw new Error(`Session creation failed: ${sessionResponse.status}`);
          }
          
          const { sessionId } = sessionResponse.data;
          
          // Step 2: NLP processing
          const nlpResponse = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
            query: workflow,
            sessionId,
            options: { extractAll: true }
          });
          
          if (nlpResponse.status !== 200) {
            throw new Error(`NLP processing failed: ${nlpResponse.status}`);
          }
          
          // Step 3: Product matching
          const matchingResponse = await axiosClient.post(`${API_BASE}/api/grocery/match-products`, {
            sessionId,
            nlpResults: nlpResponse.data,
            maxResults: 5
          });
          
          if (matchingResponse.status !== 200) {
            throw new Error(`Product matching failed: ${matchingResponse.status}`);
          }
          
          // Step 4: Pricing
          const productIds = matchingResponse.data.matches?.map((m: any) => m.productId) || [];
          const pricingResponse = await axiosClient.post(`${PRICING_BASE}/pricing/bulk-quote`, {
            productIds,
            sessionId,
            location: '90210'
          });
          
          if (pricingResponse.status !== 200) {
            throw new Error(`Pricing failed: ${pricingResponse.status}`);
          }
          
          // Step 5: Add to cart
          const cartResponse = await axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
            sessionId,
            items: matchingResponse.data.matches?.map((m: any, index: number) => ({
              productId: m.productId,
              quantity: 1,
              price: pricingResponse.data.items?.[index]?.price || 10.00
            })) || []
          });
          
          if (cartResponse.status !== 200) {
            throw new Error(`Cart update failed: ${cartResponse.status}`);
          }
          
          const endTime = performance.now();
          
          return {
            status: 200,
            data: { workflowTime: endTime - startTime },
            headers: {},
            statusText: 'OK'
          };
        },
        testConfig
      );

      // End-to-end workflow should complete within reasonable time
      expect(metrics.responseTime.p95).toBeLessThan(8000); // 8 seconds for 95th percentile
      expect(metrics.responseTime.avg).toBeLessThan(5000); // 5 seconds average
      expect(metrics.errors.rate).toBeLessThan(0.05); // 5% error rate acceptable for complex workflow
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThan(2); // At least 2 workflows per second

      logger.info('End-to-end workflow performance validated', 'PERF_TEST', {
        avgWorkflowTime: metrics.responseTime.avg,
        p95WorkflowTime: metrics.responseTime.p95,
        throughput: metrics.throughput.requestsPerSecond,
        errorRate: metrics.errors.rate
      });
    });
  });

  describe('Concurrent User Scenarios', () => {
    it('should handle peak concurrent shopping sessions', async () => {
      const peakConfig: LoadTestConfig = {
        duration: 120000, // 2 minutes
        rampUpTime: 20000, // 20 seconds to reach peak
        maxConcurrentUsers: 100,
        requestsPerUser: 8,
        thinkTime: 1500
      };

      const metrics = await runLoadTest(
        async (userId: number, requestIndex: number) => {
          const operations = [
            // Session management
            () => axiosClient.post(`${API_BASE}/api/grocery/session`, {
              userId: `peak-user-${userId}`,
              sessionId: `peak-session-${userId}-${Date.now()}`
            }),
            // Search operations
            () => axiosClient.post(`${API_BASE}/api/grocery/search`, {
              query: `search-${userId}-${requestIndex}`,
              userId: `peak-user-${userId}`
            }),
            // Cart operations
            () => axiosClient.post(`${API_BASE}/api/grocery/cart/add`, {
              sessionId: `peak-session-${userId}-${Date.now()}`,
              items: [{ productId: `product-${requestIndex}`, quantity: 1, price: 9.99 }]
            }),
            // Price checks
            () => axiosClient.get(`${PRICING_BASE}/pricing/product-${requestIndex}`)
          ];

          const operation = operations[requestIndex % operations.length];
          return await operation();
        },
        peakConfig
      );

      // System should maintain performance under peak load
      expect(metrics.responseTime.p95).toBeLessThan(3000); // 3 seconds for 95th percentile
      expect(metrics.errors.rate).toBeLessThan(0.1); // 10% error rate acceptable under peak load
      expect(metrics.throughput.requestsPerSecond).toBeGreaterThan(50); // Minimum throughput maintained

      logger.info('Peak load performance validated', 'PERF_TEST', {
        concurrentUsers: peakConfig.maxConcurrentUsers,
        p95ResponseTime: metrics.responseTime.p95,
        throughput: metrics.throughput.requestsPerSecond,
        errorRate: metrics.errors.rate
      });
    });

    it('should maintain WebSocket performance under high connection load', async () => {
      const websocketConnections: WebSocket[] = [];
      const messageLatencies: number[] = [];
      const connectionErrors: string[] = [];

      try {
        // Create many concurrent WebSocket connections
        const connectionPromises = Array.from({ length: 200 }, async (_, i) => {
          try {
            const ws = new WebSocket('ws://localhost:8080/grocery');
            websocketConnections.push(ws);

            return new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
              }, 5000);

              ws.on('open', () => {
                clearTimeout(timeout);
                
                // Subscribe to updates
                ws.send(JSON.stringify({
                  type: 'subscribe',
                  payload: {
                    sessionId: `ws-perf-${i}`,
                    events: ['cart_updated', 'price_changed']
                  }
                }));

                resolve();
              });

              ws.on('error', (error) => {
                clearTimeout(timeout);
                connectionErrors.push(error.message);
                reject(error);
              });

              ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.timestamp) {
                  const latency = Date.now() - message.timestamp;
                  messageLatencies.push(latency);
                }
              });
            });
          } catch (error) {
            connectionErrors.push(error instanceof Error ? error.message : String(error));
            throw error;
          }
        });

        const results = await Promise.allSettled(connectionPromises);
        const successfulConnections = results.filter(r => r.status === 'fulfilled').length;

        // Wait for connections to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Send broadcast messages to test message distribution performance
        const broadcastPromises = Array.from({ length: 10 }, (_, i) => 
          axiosClient.post(`${API_BASE}/api/grocery/broadcast`, {
            type: 'price_changed',
            payload: { productId: `broadcast-${i}`, newPrice: 12.99, timestamp: Date.now() }
          })
        );

        await Promise.all(broadcastPromises);

        // Wait for messages to be delivered
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Validate WebSocket performance
        expect(successfulConnections).toBeGreaterThan(150); // At least 75% connection success rate
        expect(connectionErrors.length).toBeLessThan(50); // Less than 25% error rate

        if (messageLatencies.length > 0) {
          const avgLatency = messageLatencies.reduce((a, b) => a + b, 0) / messageLatencies.length;
          const maxLatency = Math.max(...messageLatencies);
          
          expect(avgLatency).toBeLessThan(500); // Average message latency under 500ms
          expect(maxLatency).toBeLessThan(2000); // Max message latency under 2 seconds
        }

        logger.info('WebSocket performance validated', 'PERF_TEST', {
          successfulConnections,
          connectionErrors: connectionErrors.length,
          avgMessageLatency: messageLatencies.length > 0 ? 
            messageLatencies.reduce((a, b) => a + b, 0) / messageLatencies.length : 0
        });

      } finally {
        // Cleanup WebSocket connections
        websocketConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
      }
    });
  });

  describe('Cache Performance Validation', () => {
    it('should demonstrate cache effectiveness under load', async () => {
      const cacheTestQueries = [
        "popular item search",
        "frequently requested products",
        "common grocery items",
        "bestseller products",
        "seasonal favorites"
      ];

      // First, warm up the cache
      const warmupPromises = cacheTestQueries.map(query =>
        axiosClient.post(`${NLP_BASE}/nlp/process`, {
          query,
          sessionId: 'cache-warmup',
          forceCache: true
        })
      );

      await Promise.all(warmupPromises);

      // Wait for cache to be populated
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test performance with cached data
      const cachedTestConfig: LoadTestConfig = {
        duration: 60000,
        rampUpTime: 5000,
        maxConcurrentUsers: 50,
        requestsPerUser: 20,
        thinkTime: 100
      };

      const cachedMetrics = await runLoadTest(
        async (userId: number, requestIndex: number) => {
          const query = cacheTestQueries[requestIndex % cacheTestQueries.length];
          const response = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
            query,
            sessionId: `cache-test-${userId}`
          });
          return response;
        },
        cachedTestConfig
      );

      // Test performance without cache (different queries)
      const uncachedTestConfig: LoadTestConfig = {
        duration: 60000,
        rampUpTime: 5000,
        maxConcurrentUsers: 50,
        requestsPerUser: 20,
        thinkTime: 100
      };

      const uncachedMetrics = await runLoadTest(
        async (userId: number, requestIndex: number) => {
          const query = `unique query ${userId}-${requestIndex}-${Date.now()}`;
          const response = await axiosClient.post(`${NLP_BASE}/nlp/process`, {
            query,
            sessionId: `uncached-test-${userId}`
          });
          return response;
        },
        uncachedTestConfig
      );

      // Cache should provide significant performance improvement
      expect(cachedMetrics.responseTime.avg).toBeLessThan(uncachedMetrics.responseTime.avg * 0.5);
      expect(cachedMetrics.throughput.requestsPerSecond).toBeGreaterThan(uncachedMetrics.throughput.requestsPerSecond * 1.5);

      // Both should still meet baseline requirements
      const baseline = performanceBaselines.find(b => b.operation === 'nlp_processing')!;
      expect(cachedMetrics.responseTime.p95).toBeLessThan(baseline.maxResponseTime);
      expect(uncachedMetrics.responseTime.p95).toBeLessThan(baseline.maxResponseTime);

      logger.info('Cache effectiveness validated', 'PERF_TEST', {
        cachedAvgResponseTime: cachedMetrics.responseTime.avg,
        uncachedAvgResponseTime: uncachedMetrics.responseTime.avg,
        performanceImprovement: ((uncachedMetrics.responseTime.avg - cachedMetrics.responseTime.avg) / uncachedMetrics.responseTime.avg * 100).toFixed(1) + '%'
      });
    });
  });

  // Helper function to run load tests
  async function runLoadTest(
    requestFunction: (userId: number, requestIndex: number) => Promise<any>,
    config: LoadTestConfig
  ): Promise<PerformanceMetrics> {
    const responseTimes: number[] = [];
    const errors: { type: string; message: string; time: number }[] = [];
    const startTime = performance.now();
    const endTime = startTime + config.duration;
    
    let activeUsers = 0;
    let totalRequests = 0;
    let completedRequests = 0;

    return new Promise((resolve) => {
      const userPromises: Promise<void>[] = [];

      // Ramp up users gradually
      const userRampInterval = config.rampUpTime / config.maxConcurrentUsers;
      
      for (let userId = 0; userId < config.maxConcurrentUsers; userId++) {
        const userStartDelay = userId * userRampInterval;
        
        const userPromise = new Promise<void>((userResolve) => {
          setTimeout(async () => {
            activeUsers++;
            
            for (let requestIndex = 0; requestIndex < config.requestsPerUser; requestIndex++) {
              if (performance.now() > endTime) break;

              try {
                totalRequests++;
                const requestStart = performance.now();
                
                await requestFunction(userId, requestIndex);
                
                const requestTime = performance.now() - requestStart;
                responseTimes.push(requestTime);
                completedRequests++;

              } catch (error) {
                errors.push({
                  type: error instanceof Error ? error.name : 'UnknownError',
                  message: error instanceof Error ? error.message : String(error),
                  time: performance.now()
                });
              }

              // Think time between requests
              if (requestIndex < config.requestsPerUser - 1 && config.thinkTime > 0) {
                await new Promise(resolve => setTimeout(resolve, config.thinkTime));
              }
            }

            activeUsers--;
            userResolve();
          }, userStartDelay);
        });

        userPromises.push(userPromise);
      }

      Promise.all(userPromises).then(() => {
        const actualDuration = performance.now() - startTime;
        
        // Calculate metrics
        responseTimes.sort((a, b) => a - b);
        
        const metrics: PerformanceMetrics = {
          responseTime: {
            min: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
            max: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
            avg: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
            p50: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.5)] : 0,
            p95: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.95)] : 0,
            p99: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.99)] : 0,
          },
          throughput: {
            requestsPerSecond: completedRequests / (actualDuration / 1000),
            concurrentUsers: config.maxConcurrentUsers,
            totalRequests: completedRequests
          },
          errors: {
            count: errors.length,
            rate: totalRequests > 0 ? errors.length / totalRequests : 0,
            types: errors.reduce((acc, error) => {
              acc[error.type] = (acc[error.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          },
          resources: {
            memoryUsage: process.memoryUsage().heapUsed,
            cpuUsage: 0, // Would need additional monitoring
            networkIO: 0  // Would need additional monitoring
          }
        };

        resolve(metrics);
      });
    });
  }
});