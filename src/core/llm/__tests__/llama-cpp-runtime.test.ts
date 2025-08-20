/**
 * Runtime Behavior and Error Handling Tests for Llama.cpp Integration
 * Tests server startup, memory management, rate limiting, and error recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { LlamaCppHttpProvider } from '../LlamaCppHttpProvider';
import { llamaCppService } from '../../../services/llama-cpp.service';
import { ResourceLimiter, SecurityValidator, SecurityAuditLogger } from '../../../config/llama-cpp-security.config';
import axios, { AxiosError } from 'axios';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock modules
vi.mock('axios');
vi.mock('child_process');
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Llama.cpp Runtime Behavior Tests', () => {
  let provider: LlamaCppHttpProvider;
  let mockAxiosInstance: any;
  let serverProcess: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup axios mock
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn()
    };
    
    (axios.create as any).mockReturnValue(mockAxiosInstance);
    
    // Create a mock server process
    serverProcess = new EventEmitter();
    (serverProcess as any).pid = 12345;
    (serverProcess as any).kill = vi.fn();
    
    provider = new LlamaCppHttpProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Server Startup and Connection', () => {
    it('should verify server health before accepting requests', async () => {
      // Mock health check sequence
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('ECONNREFUSED')) // First check fails
        .mockResolvedValueOnce({ data: { status: 'loading' } }) // Server starting
        .mockResolvedValueOnce({ data: { status: 'ready' } }); // Server ready

      // Mock server spawn
      const mockSpawn = vi.spyOn(child_process, 'spawn').mockReturnValue(serverProcess as any);

      await provider.initialize();

      // Should have made multiple health checks
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/models');
    });

    it('should handle server startup timeout gracefully', async () => {
      // Mock continuous connection failures
      mockAxiosInstance.get.mockRejectedValue(new Error('ECONNREFUSED'));
      
      // Mock server spawn that doesn't connect
      const mockSpawn = vi.spyOn(child_process, 'spawn').mockReturnValue(serverProcess as any);
      
      // Set a shorter timeout for testing
      const originalTimeout = setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: any, ms: any) => {
        if (ms > 1000) ms = 100; // Speed up timeout for test
        return originalTimeout(fn, ms);
      });

      await expect(provider.initialize()).rejects.toThrow('Cannot connect to or start llama-server');
      
      // Should have attempted multiple connections
      expect(mockAxiosInstance.get.calls.length).toBeGreaterThan(1);
    });

    it('should detect and recover from server crashes', async () => {
      // Initial successful connection
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { status: 'ok' } });
      await provider.initialize();

      // Simulate server crash during request
      const crashError = new Error('ECONNREFUSED');
      (crashError as any).code = 'ECONNREFUSED';
      mockAxiosInstance.post.mockRejectedValueOnce(crashError);

      // Mock server restart
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { status: 'ok' } });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Recovered response' } }]
        }
      });

      const result = await provider.generate('Test after crash');
      
      expect(result.response).toBe('Recovered response');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // Initial + recovery
    });

    it('should handle port conflicts during startup', async () => {
      // Mock EADDRINUSE error (port in use)
      const portError = new Error('listen EADDRINUSE: address already in use :::8081');
      (portError as any).code = 'EADDRINUSE';
      
      mockAxiosInstance.get.mockRejectedValueOnce(portError);
      
      // Should try alternative port or cleanup
      const mockSpawn = vi.spyOn(child_process, 'spawn').mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.pid = 12346;
        proc.kill = vi.fn();
        
        // Emit error event
        setTimeout(() => proc.emit('error', portError), 10);
        return proc;
      });

      await expect(provider.initialize()).rejects.toThrow();
      
      // Verify error was handled appropriately
      expect(mockSpawn).toHaveBeenCalled();
    });
  });

  describe('Memory Management and Cleanup', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });
      await provider.initialize();
    });

    it('should track and limit concurrent requests', async () => {
      const responses = Array(10).fill({
        data: {
          choices: [{ message: { content: 'Response' } }]
        }
      });
      
      mockAxiosInstance.post.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(responses.shift()), 100))
      );

      // Start multiple concurrent requests
      const promises = Array(10).fill(null).map((_, i) => 
        provider.generate(`Request ${i}`)
      );

      // Check process count during execution
      const info = provider.getModelInfo();
      expect(info.processCount).toBeGreaterThan(0);

      await Promise.all(promises);
      
      // Process count should return to 0
      const finalInfo = provider.getModelInfo();
      expect(finalInfo.processCount).toBe(0);
    });

    it('should release resources on error', async () => {
      const mockAcquire = vi.spyOn(ResourceLimiter, 'acquireResources');
      const mockRelease = vi.spyOn(ResourceLimiter, 'releaseResources');
      
      // Mock resource check to pass
      vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(true);
      
      // Mock request failure
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Generation failed'));

      await expect(provider.generate('Test')).rejects.toThrow('Generation failed');
      
      // Resources should be acquired and released even on error
      expect(mockAcquire).toHaveBeenCalledWith(1);
      expect(mockRelease).toHaveBeenCalledWith(1);
    });

    it('should handle memory pressure gracefully', async () => {
      // Mock low memory condition
      vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(false);
      
      await expect(provider.generate('Test')).rejects.toThrow('Server is at capacity');
      
      // Should not have made a request to the server
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should cleanup server process on provider cleanup', async () => {
      // Mock server was started by provider
      const mockStopServer = vi.spyOn(llamaCppService, 'stopServer').mockResolvedValue();
      
      await provider.cleanup();
      
      expect(mockStopServer).toHaveBeenCalled();
      expect(provider.isReady()).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock cleanup failure
      vi.spyOn(llamaCppService, 'stopServer').mockRejectedValue(new Error('Failed to stop'));
      
      // Should not throw
      await expect(provider.cleanup()).resolves.not.toThrow();
      
      // Provider should still be marked as not ready
      expect(provider.isReady()).toBe(false);
    });
  });

  describe('Rate Limiting Behavior', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });
      await provider.initialize();
      vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(true);
      vi.spyOn(ResourceLimiter, 'acquireResources').mockImplementation();
      vi.spyOn(ResourceLimiter, 'releaseResources').mockImplementation();
    });

    it('should enforce rate limits per client', async () => {
      const mockCheckRate = vi.spyOn(SecurityValidator, 'checkRateLimit');
      mockCheckRate.mockReturnValueOnce(true).mockReturnValueOnce(false);
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [{ message: { content: 'OK' } }] }
      });

      // First request should succeed
      await provider.generate('Test 1', { context: { userId: 'user123' } });
      
      // Second request should be rate limited
      await expect(
        provider.generate('Test 2', { context: { userId: 'user123' } })
      ).rejects.toThrow('Rate limit exceeded');
      
      expect(mockCheckRate).toHaveBeenCalledWith('user:user123');
    });

    it('should use different rate limit pools for different clients', async () => {
      const mockCheckRate = vi.spyOn(SecurityValidator, 'checkRateLimit').mockReturnValue(true);
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [{ message: { content: 'OK' } }] }
      });

      // Requests from different users
      await provider.generate('Test 1', { context: { userId: 'user1' } });
      await provider.generate('Test 2', { context: { userId: 'user2' } });
      await provider.generate('Test 3', { context: { sessionId: 'session1' } });
      await provider.generate('Test 4', { context: { ip: '192.168.1.1' } });

      // Verify different client IDs were used
      expect(mockCheckRate).toHaveBeenCalledWith('user:user1');
      expect(mockCheckRate).toHaveBeenCalledWith('user:user2');
      expect(mockCheckRate).toHaveBeenCalledWith('session:session1');
      expect(mockCheckRate).toHaveBeenCalledWith('ip:192.168.1.1');
    });

    it('should normalize IP addresses for consistent rate limiting', async () => {
      const mockCheckRate = vi.spyOn(SecurityValidator, 'checkRateLimit').mockReturnValue(true);
      
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [{ message: { content: 'OK' } }] }
      });

      // Different representations of same IP
      await provider.generate('Test 1', { context: { ip: '::1' } });
      await provider.generate('Test 2', { context: { ip: '127.0.0.1:3000' } });
      await provider.generate('Test 3', { context: { ip: '::ffff:192.168.1.1' } });

      // Should normalize to consistent format
      expect(mockCheckRate).toHaveBeenCalledWith('ip:127.0.0.1');
      expect(mockCheckRate).toHaveBeenCalledWith('ip:127.0.0.1');
      expect(mockCheckRate).toHaveBeenCalledWith('ip:192.168.1.1');
    });

    it('should log rate limit violations', async () => {
      vi.spyOn(SecurityValidator, 'checkRateLimit').mockReturnValue(false);
      const mockAudit = vi.spyOn(SecurityAuditLogger, 'log');
      
      await expect(
        provider.generate('Test', { 
          context: { 
            userId: 'user123',
            ip: '192.168.1.1',
            sessionId: 'sess456'
          } 
        })
      ).rejects.toThrow('Rate limit exceeded');
      
      expect(mockAudit).toHaveBeenCalledWith(
        'warn',
        'Rate limit exceeded',
        expect.objectContaining({
          clientId: 'user:user123',
          userId: 'user123',
          ip: '192.168.1.1',
          sessionId: 'sess456'
        })
      );
    });
  });

  describe('Concurrent Request Handling', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });
      await provider.initialize();
      vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(true);
      vi.spyOn(ResourceLimiter, 'acquireResources').mockImplementation();
      vi.spyOn(ResourceLimiter, 'releaseResources').mockImplementation();
      vi.spyOn(SecurityValidator, 'checkRateLimit').mockReturnValue(true);
    });

    it('should handle multiple concurrent requests', async () => {
      let activeRequests = 0;
      let maxConcurrent = 0;
      
      mockAxiosInstance.post.mockImplementation(async () => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        activeRequests--;
        return {
          data: {
            choices: [{ message: { content: `Response ${activeRequests}` } }]
          }
        };
      });

      // Start 5 concurrent requests
      const promises = Array(5).fill(null).map((_, i) => 
        provider.generate(`Concurrent ${i}`)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(maxConcurrent).toBeGreaterThan(1); // Should have concurrent processing
      expect(activeRequests).toBe(0); // All should complete
    });

    it('should maintain request isolation', async () => {
      const responses = ['Response A', 'Response B', 'Response C'];
      let callIndex = 0;
      
      mockAxiosInstance.post.mockImplementation(async () => {
        const response = responses[callIndex++];
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return {
          data: {
            choices: [{ message: { content: response } }]
          }
        };
      });

      const results = await Promise.all([
        provider.generate('Request A'),
        provider.generate('Request B'),
        provider.generate('Request C')
      ]);

      // Each request should get its corresponding response
      expect(results.map(r => r.response)).toEqual(responses);
    });

    it('should handle mixed success and failure in concurrent requests', async () => {
      let callCount = 0;
      
      mockAxiosInstance.post.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Request 2 failed');
        }
        return {
          data: {
            choices: [{ message: { content: `Success ${callCount}` } }]
          }
        };
      });

      const promises = [
        provider.generate('Request 1'),
        provider.generate('Request 2').catch(e => ({ error: e.message })),
        provider.generate('Request 3')
      ];

      const results = await Promise.all(promises);
      
      expect(results[0].response).toBe('Success 1');
      expect(results[1].error).toBe('Request 2 failed');
      expect(results[2].response).toBe('Success 3');
    });
  });

  describe('Error Recovery Scenarios', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });
      await provider.initialize();
      vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(true);
      vi.spyOn(ResourceLimiter, 'acquireResources').mockImplementation();
      vi.spyOn(ResourceLimiter, 'releaseResources').mockImplementation();
      vi.spyOn(SecurityValidator, 'checkRateLimit').mockReturnValue(true);
    });

    it('should recover from temporary network issues', async () => {
      const networkError = new Error('ETIMEDOUT');
      (networkError as any).code = 'ETIMEDOUT';
      
      mockAxiosInstance.post
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: 'Success after retry' } }]
          }
        });

      // Should retry and eventually succeed
      const result = await provider.generate('Test with network issues');
      expect(result.response).toBe('Success after retry');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    it('should handle model loading delays', async () => {
      const error503 = new Error('Service Unavailable');
      (error503 as any).response = { status: 503 };
      
      mockAxiosInstance.post
        .mockRejectedValueOnce(error503) // Model loading
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: 'Model loaded' } }]
          }
        });

      const result = await provider.generate('Test during model load');
      expect(result.response).toBe('Model loaded');
    });

    it('should handle corrupted responses', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: null }) // Null response
        .mockResolvedValueOnce({ data: {} }) // Empty response
        .mockResolvedValueOnce({ // Malformed response
          data: { choices: null }
        })
        .mockResolvedValueOnce({ // Valid response
          data: {
            choices: [{ message: { content: 'Valid response' } }]
          }
        });

      // Should handle invalid responses and retry
      const result = await provider.generate('Test with corruption');
      expect(result.response).toBe('Valid response');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4);
    });

    it('should handle partial server failures', async () => {
      let requestCount = 0;
      
      mockAxiosInstance.post.mockImplementation(async () => {
        requestCount++;
        
        // Simulate intermittent failures
        if (requestCount % 3 === 0) {
          const error = new Error('Internal Server Error');
          (error as any).response = { status: 500 };
          throw error;
        }
        
        return {
          data: {
            choices: [{ message: { content: `Response ${requestCount}` } }]
          }
        };
      });

      // Make multiple requests
      const promises = Array(5).fill(null).map((_, i) => 
        provider.generate(`Request ${i}`).catch(e => ({ error: true }))
      );

      const results = await Promise.all(promises);
      
      // Some should succeed, some should fail
      const successes = results.filter(r => !r.error);
      const failures = results.filter(r => r.error);
      
      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should handle server restart during operation', async () => {
      // Simulate server going down and coming back up
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: 'Before restart' } }]
          }
        })
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));
      
      // Health check during recovery
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ data: { status: 'ok' } });
      
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: 'After restart' } }]
          }
        });

      const result1 = await provider.generate('Request 1');
      expect(result1.response).toBe('Before restart');
      
      const result2 = await provider.generate('Request 2');
      expect(result2.response).toBe('After restart');
      
      // Should have attempted recovery
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // Initial + recovery
    });
  });

  describe('Streaming Response Handling', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });
      await provider.initialize();
      vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(true);
      vi.spyOn(SecurityValidator, 'checkRateLimit').mockReturnValue(true);
    });

    it('should handle streaming responses correctly', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) {
              yield Buffer.from(chunk);
            }
          }
        }
      });

      const result: string[] = [];
      for await (const chunk of provider.generateStream('Test streaming')) {
        result.push(chunk);
      }

      expect(result.join('')).toBe('Hello world');
    });

    it('should handle streaming errors gracefully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('data: {"choices":[{"delta":{"content":"Start"}}]}\n\n');
            throw new Error('Stream interrupted');
          }
        }
      });

      const result: string[] = [];
      
      await expect(async () => {
        for await (const chunk of provider.generateStream('Test error')) {
          result.push(chunk);
        }
      }).rejects.toThrow('Stream interrupted');
      
      expect(result).toEqual(['Start']);
    });

    it('should handle malformed streaming data', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Valid"}}]}\n\n',
        'data: INVALID_JSON\n\n', // Malformed
        'data: {"choices":[{"delta":{"content":" continues"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) {
              yield Buffer.from(chunk);
            }
          }
        }
      });

      const result: string[] = [];
      for await (const chunk of provider.generateStream('Test malformed')) {
        result.push(chunk);
      }

      // Should skip malformed chunks
      expect(result.join('')).toBe('Valid continues');
    });
  });

  describe('Model Switching and Management', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });
      await provider.initialize();
    });

    it('should handle model switching with server restart', async () => {
      const mockCleanup = vi.spyOn(provider, 'cleanup');
      const mockInitialize = vi.spyOn(provider, 'initialize');
      
      // Switch to different model
      await provider.switchModel('codellama-7b');
      
      expect(mockCleanup).toHaveBeenCalled();
      expect(mockInitialize).toHaveBeenCalled();
      
      const info = provider.getModelInfo();
      expect(info.model).toBe('codellama-7b');
    });

    it('should queue requests during model switch', async () => {
      let modelSwitching = true;
      
      mockAxiosInstance.post.mockImplementation(async () => {
        if (modelSwitching) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return {
          data: {
            choices: [{ message: { content: 'Response' } }]
          }
        };
      });

      // Start model switch
      const switchPromise = provider.switchModel('phi-2').then(() => {
        modelSwitching = false;
      });

      // Try to generate during switch
      const generatePromise = provider.generate('Test during switch');

      await Promise.all([switchPromise, generatePromise]);
      
      expect(provider.getModelInfo().model).toBe('phi-2');
    });

    it('should validate model availability before switching', async () => {
      await expect(
        provider.switchModel('non-existent-model')
      ).rejects.toThrow('Model non-existent-model not found');
      
      // Should remain on current model
      expect(provider.getModelInfo().model).toBe('llama-3.2-3b');
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });
      await provider.initialize();
      vi.spyOn(ResourceLimiter, 'checkResources').mockResolvedValue(true);
      vi.spyOn(ResourceLimiter, 'acquireResources').mockImplementation();
      vi.spyOn(ResourceLimiter, 'releaseResources').mockImplementation();
      vi.spyOn(SecurityValidator, 'checkRateLimit').mockReturnValue(true);
    });

    it('should track token generation metrics', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Test response' } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 50,
            total_tokens: 60
          }
        }
      });

      const startTime = Date.now();
      const result = await provider.generate('Test metrics');
      const duration = Date.now() - startTime;

      expect(result.tokensGenerated).toBe(50);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.tokensPerSecond).toBeGreaterThan(0);
    });

    it('should detect performance degradation', async () => {
      const mockAudit = vi.spyOn(SecurityAuditLogger, 'log');
      
      // Simulate slow response
      mockAxiosInstance.post.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return {
          data: {
            choices: [{ message: { content: 'Slow response' } }],
            usage: { completion_tokens: 10 }
          }
        };
      });

      const result = await provider.generate('Test slow');
      
      // Should have very low tokens/second
      expect(result.tokensPerSecond).toBeLessThan(5);
      
      // Should log the completion with performance metrics
      expect(mockAudit).toHaveBeenCalledWith(
        'info',
        'Text generation completed',
        expect.objectContaining({
          duration: expect.any(Number)
        })
      );
    });
  });
});