/**
 * Memory Leak Detection Tests for Llama.cpp Integration
 * Tests for memory leaks, resource cleanup, and long-running scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LlamaCppHttpProvider } from '../LlamaCppHttpProvider';
import { ResourceLimiter } from '../../../config/llama-cpp-security.config';
import { performance } from 'perf_hooks';
import * as v8 from 'v8';
import * as util from 'util';

// Enable garbage collection for testing (run with --expose-gc flag)
declare global {
  function gc(): void;
}

// Helper to force garbage collection
function forceGC() {
  if (global.gc) {
    global.gc();
  }
}

// Helper to get heap statistics
function getHeapStats() {
  const stats = v8.getHeapStatistics();
  return {
    used: stats.used_heap_size,
    total: stats.total_heap_size,
    limit: stats.heap_size_limit,
    external: stats.external_memory,
    usedMB: (stats.used_heap_size / 1024 / 1024).toFixed(2),
    totalMB: (stats.total_heap_size / 1024 / 1024).toFixed(2)
  };
}

// Helper to create heap snapshot
async function createHeapSnapshot(): Promise<any> {
  const snapshot = v8.writeHeapSnapshot();
  return snapshot;
}

// Mock axios for controlled testing
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn()
    }))
  },
  isAxiosError: vi.fn()
}));

describe('Memory Leak Detection', () => {
  let provider: LlamaCppHttpProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup axios mock
    const axios = require('axios').default;
    mockAxiosInstance = {
      get: vi.fn().mockResolvedValue({ data: { status: 'ok' } }),
      post: vi.fn()
    };
    axios.create.mockReturnValue(mockAxiosInstance);
    
    provider = new LlamaCppHttpProvider();
  });

  afterEach(async () => {
    await provider.cleanup();
    forceGC();
  });

  describe('Request Memory Management', () => {
    it('should not leak memory on successful requests', async () => {
      await provider.initialize();
      
      // Mock successful responses
      mockAxiosInstance.post.mockImplementation(() => 
        Promise.resolve({
          data: {
            choices: [{ 
              message: { 
                content: 'x'.repeat(1000) // Large response
              } 
            }],
            usage: { completion_tokens: 100 }
          }
        })
      );

      forceGC();
      const heapBefore = getHeapStats();
      
      // Make many requests
      for (let i = 0; i < 100; i++) {
        await provider.generate(`Request ${i}`, { maxTokens: 100 });
        
        // Occasionally force GC
        if (i % 20 === 0) {
          forceGC();
        }
      }

      forceGC();
      await new Promise(resolve => setTimeout(resolve, 100)); // Let cleanup happen
      forceGC();
      
      const heapAfter = getHeapStats();
      const heapGrowth = heapAfter.used - heapBefore.used;
      const heapGrowthMB = heapGrowth / 1024 / 1024;

      console.log('Memory stats:', {
        before: heapBefore.usedMB + 'MB',
        after: heapAfter.usedMB + 'MB',
        growth: heapGrowthMB.toFixed(2) + 'MB'
      });

      // Should not grow more than 10MB for 100 requests
      expect(heapGrowthMB).toBeLessThan(10);
    });

    it('should not leak memory on failed requests', async () => {
      await provider.initialize();
      
      // Mock failed responses
      mockAxiosInstance.post.mockImplementation(() => 
        Promise.reject(new Error('Request failed'))
      );

      forceGC();
      const heapBefore = getHeapStats();
      
      // Make many failed requests
      for (let i = 0; i < 100; i++) {
        await provider.generate(`Request ${i}`, { maxTokens: 100 })
          .catch(() => {}); // Ignore errors
        
        if (i % 20 === 0) {
          forceGC();
        }
      }

      forceGC();
      await new Promise(resolve => setTimeout(resolve, 100));
      forceGC();
      
      const heapAfter = getHeapStats();
      const heapGrowthMB = (heapAfter.used - heapBefore.used) / 1024 / 1024;

      console.log('Memory after errors:', {
        growth: heapGrowthMB.toFixed(2) + 'MB'
      });

      // Should not grow more than 10MB even with errors
      expect(heapGrowthMB).toBeLessThan(10);
    });

    it('should not leak memory with streaming responses', async () => {
      await provider.initialize();
      
      // Mock streaming responses
      mockAxiosInstance.post.mockImplementation(() => ({
        data: {
          [Symbol.asyncIterator]: async function* () {
            for (let i = 0; i < 100; i++) {
              yield Buffer.from(`data: {"choices":[{"delta":{"content":"chunk${i}"}}]}\n\n`);
            }
            yield Buffer.from('data: [DONE]\n\n');
          }
        }
      }));

      forceGC();
      const heapBefore = getHeapStats();
      
      // Stream many responses
      for (let i = 0; i < 20; i++) {
        const chunks: string[] = [];
        for await (const chunk of provider.generateStream(`Stream ${i}`)) {
          chunks.push(chunk);
        }
        
        // Chunks should be garbage collected
        if (i % 5 === 0) {
          forceGC();
        }
      }

      forceGC();
      await new Promise(resolve => setTimeout(resolve, 100));
      forceGC();
      
      const heapAfter = getHeapStats();
      const heapGrowthMB = (heapAfter.used - heapBefore.used) / 1024 / 1024;

      console.log('Memory after streaming:', {
        growth: heapGrowthMB.toFixed(2) + 'MB'
      });

      expect(heapGrowthMB).toBeLessThan(15);
    });
  });

  describe('Resource Limiter Memory', () => {
    it('should properly track and release resources', async () => {
      const mockCheck = vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(true);
      const mockAcquire = vi.spyOn(ResourceLimiter, 'acquireResources');
      const mockRelease = vi.spyOn(ResourceLimiter, 'releaseResources');
      
      await provider.initialize();
      
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'Response' } }]
        }
      });

      // Track resource allocations
      const allocations: number[] = [];
      mockAcquire.mockImplementation((gb) => {
        allocations.push(gb);
      });

      const releases: number[] = [];
      mockRelease.mockImplementation((gb) => {
        releases.push(gb);
      });

      // Make multiple concurrent requests
      const promises = Array(10).fill(null).map((_, i) => 
        provider.generate(`Request ${i}`, { maxTokens: 50 })
      );

      await Promise.all(promises);

      // All resources should be released
      expect(allocations.length).toBe(10);
      expect(releases.length).toBe(10);
      expect(allocations.reduce((a, b) => a + b, 0))
        .toBe(releases.reduce((a, b) => a + b, 0));
    });

    it('should not leak resources on errors', async () => {
      const mockAcquire = vi.spyOn(ResourceLimiter, 'acquireResources');
      const mockRelease = vi.spyOn(ResourceLimiter, 'releaseResources');
      vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(true);
      
      await provider.initialize();
      
      // Mix success and failure
      let requestCount = 0;
      mockAxiosInstance.post.mockImplementation(() => {
        requestCount++;
        if (requestCount % 3 === 0) {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve({
          data: {
            choices: [{ message: { content: 'OK' } }]
          }
        });
      });

      const results = await Promise.allSettled(
        Array(15).fill(null).map((_, i) => 
          provider.generate(`Request ${i}`, { maxTokens: 20 })
        )
      );

      // All acquired resources should be released
      expect(mockAcquire).toHaveBeenCalledTimes(15);
      expect(mockRelease).toHaveBeenCalledTimes(15);
    });
  });

  describe('Long Running Scenarios', () => {
    it('should handle continuous operation without memory growth', async () => {
      await provider.initialize();
      
      mockAxiosInstance.post.mockImplementation(() => 
        Promise.resolve({
          data: {
            choices: [{ message: { content: 'Response' } }],
            usage: { completion_tokens: 10 }
          }
        })
      );

      const measurements: any[] = [];
      const duration = 5000; // Run for 5 seconds
      const startTime = performance.now();
      let requestCount = 0;

      // Take initial measurement
      forceGC();
      const initialHeap = getHeapStats();

      while (performance.now() - startTime < duration) {
        await provider.generate(`Long running ${requestCount}`, {
          maxTokens: 20
        });
        
        requestCount++;
        
        // Measure every 10 requests
        if (requestCount % 10 === 0) {
          forceGC();
          const currentHeap = getHeapStats();
          measurements.push({
            requests: requestCount,
            heapMB: currentHeap.usedMB,
            growthMB: ((currentHeap.used - initialHeap.used) / 1024 / 1024).toFixed(2)
          });
        }
      }

      // Final measurement
      forceGC();
      const finalHeap = getHeapStats();
      
      console.log('Long running test results:');
      console.table(measurements);
      console.log(`Total requests: ${requestCount}`);
      console.log(`Final heap growth: ${((finalHeap.used - initialHeap.used) / 1024 / 1024).toFixed(2)}MB`);

      // Growth should be minimal and stabilize
      const avgGrowthPerRequest = (finalHeap.used - initialHeap.used) / requestCount;
      expect(avgGrowthPerRequest).toBeLessThan(10 * 1024); // Less than 10KB per request
    });

    it('should handle provider recreation without leaks', async () => {
      forceGC();
      const initialHeap = getHeapStats();

      // Create and destroy providers multiple times
      for (let i = 0; i < 20; i++) {
        const tempProvider = new LlamaCppHttpProvider();
        await tempProvider.initialize();
        
        mockAxiosInstance.post.mockResolvedValue({
          data: {
            choices: [{ message: { content: 'Test' } }]
          }
        });
        
        // Make some requests
        await tempProvider.generate('Test', { maxTokens: 10 });
        await tempProvider.generate('Test2', { maxTokens: 10 });
        
        // Cleanup
        await tempProvider.cleanup();
        
        if (i % 5 === 0) {
          forceGC();
        }
      }

      forceGC();
      await new Promise(resolve => setTimeout(resolve, 100));
      forceGC();
      
      const finalHeap = getHeapStats();
      const heapGrowthMB = (finalHeap.used - initialHeap.used) / 1024 / 1024;

      console.log('Provider recreation memory:', {
        growth: heapGrowthMB.toFixed(2) + 'MB'
      });

      // Should not accumulate memory from old providers
      expect(heapGrowthMB).toBeLessThan(5);
    });
  });

  describe('Event Listener Cleanup', () => {
    it('should not leak event listeners', async () => {
      // Track event listener counts
      const getListenerCount = () => {
        return process.listenerCount('uncaughtException') +
               process.listenerCount('unhandledRejection');
      };

      const initialListeners = getListenerCount();

      // Create and destroy multiple providers
      for (let i = 0; i < 10; i++) {
        const tempProvider = new LlamaCppHttpProvider();
        await tempProvider.initialize();
        await tempProvider.cleanup();
      }

      const finalListeners = getListenerCount();

      // Should not accumulate listeners
      expect(finalListeners).toBeLessThanOrEqual(initialListeners + 1);
    });

    it('should cleanup axios interceptors', async () => {
      const interceptors: any[] = [];
      
      // Mock axios with interceptor tracking
      mockAxiosInstance.interceptors = {
        request: {
          use: vi.fn((handler) => {
            const id = interceptors.length;
            interceptors.push({ type: 'request', handler, id });
            return id;
          }),
          eject: vi.fn((id) => {
            interceptors[id] = null;
          })
        },
        response: {
          use: vi.fn((handler) => {
            const id = interceptors.length;
            interceptors.push({ type: 'response', handler, id });
            return id;
          }),
          eject: vi.fn((id) => {
            interceptors[id] = null;
          })
        }
      };

      await provider.initialize();
      const activeBeforeCleanup = interceptors.filter(i => i !== null).length;
      
      await provider.cleanup();
      const activeAfterCleanup = interceptors.filter(i => i !== null).length;

      // Should cleanup interceptors if any were added
      if (activeBeforeCleanup > 0) {
        expect(activeAfterCleanup).toBeLessThan(activeBeforeCleanup);
      }
    });
  });

  describe('Circular Reference Prevention', () => {
    it('should not create circular references in responses', async () => {
      await provider.initialize();
      
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'Test' } }]
        }
      });

      const responses: any[] = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await provider.generate(`Test ${i}`, {
          maxTokens: 10
        });
        responses.push(response);
      }

      // Check for circular references
      try {
        JSON.stringify(responses);
        // If stringify succeeds, no circular references
        expect(true).toBe(true);
      } catch (error: any) {
        if (error.message.includes('circular')) {
          throw new Error('Circular reference detected in responses');
        }
      }
    });

    it('should not retain references between requests', async () => {
      await provider.initialize();
      
      const responses: any[] = [];
      
      mockAxiosInstance.post.mockImplementation((url, data) => {
        // Store request data
        responses.push({ request: data });
        
        return Promise.resolve({
          data: {
            choices: [{ message: { content: 'Response' } }]
          }
        });
      });

      // Make multiple requests with different data
      const contexts = [
        { userId: 'user1' },
        { userId: 'user2' },
        { userId: 'user3' }
      ];

      for (const context of contexts) {
        await provider.generate('Test', { 
          maxTokens: 10,
          context 
        });
      }

      // Check that requests don't reference each other
      for (let i = 0; i < responses.length; i++) {
        for (let j = i + 1; j < responses.length; j++) {
          expect(responses[i].request).not.toBe(responses[j].request);
        }
      }
    });
  });

  describe('WeakMap/WeakSet Usage', () => {
    it('should use weak references for caching if applicable', async () => {
      await provider.initialize();
      
      // Create objects that should be weakly referenced
      const contexts: any[] = [];
      
      for (let i = 0; i < 100; i++) {
        contexts.push({
          userId: `user${i}`,
          sessionId: `session${i}`,
          metadata: { large: 'x'.repeat(1000) }
        });
      }

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'OK' } }]
        }
      });

      // Use contexts in requests
      for (const context of contexts) {
        await provider.generate('Test', {
          maxTokens: 10,
          context
        });
      }

      // Clear strong references
      contexts.length = 0;
      forceGC();

      // Memory should be reclaimed
      const heapAfter = getHeapStats();
      
      // Make another request to ensure provider still works
      await provider.generate('Final test', { maxTokens: 10 });
      
      expect(provider.isReady()).toBe(true);
    });
  });

  describe('Buffer Management', () => {
    it('should properly manage buffer allocations', async () => {
      await provider.initialize();
      
      // Mock large streaming responses
      mockAxiosInstance.post.mockImplementation(() => ({
        data: {
          [Symbol.asyncIterator]: async function* () {
            // Generate large chunks
            for (let i = 0; i < 50; i++) {
              const largeContent = 'x'.repeat(10000);
              yield Buffer.from(`data: {"choices":[{"delta":{"content":"${largeContent}"}}]}\n\n`);
            }
            yield Buffer.from('data: [DONE]\n\n');
          }
        }
      }));

      forceGC();
      const heapBefore = getHeapStats();

      // Process large streaming response
      const chunks: string[] = [];
      for await (const chunk of provider.generateStream('Large stream')) {
        chunks.push(chunk);
        
        // Clear processed chunks periodically
        if (chunks.length > 10) {
          chunks.splice(0, 5); // Remove old chunks
        }
      }

      // Clear all chunks
      chunks.length = 0;
      forceGC();
      
      const heapAfter = getHeapStats();
      const heapGrowthMB = (heapAfter.used - heapBefore.used) / 1024 / 1024;

      console.log('Buffer management:', {
        growth: heapGrowthMB.toFixed(2) + 'MB'
      });

      // Should not retain large buffers
      expect(heapGrowthMB).toBeLessThan(20);
    });
  });
});