/**
 * Unit Tests for LlamaCppHttpProvider
 * Tests HTTP-based llama.cpp server integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { LlamaCppHttpProvider } from '../LlamaCppHttpProvider';
import { logger } from '../../../utils/logger';
import * as llamaCppService from '../../../services/llama-cpp.service';
import * as llamaCppConfig from '../../../config/llama-cpp-optimized.config';

// Mock dependencies
vi.mock('axios');
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));
vi.mock('../../../services/llama-cpp.service');
vi.mock('../../../config/llama-cpp-optimized.config');

describe('LlamaCppHttpProvider', () => {
  let provider: LlamaCppHttpProvider;
  let mockAxiosInstance: {
    get: MockedFunction<any>;
    post: MockedFunction<any>;
  };

  const mockConfig = {
    server: {
      port: 8081,
      host: 'localhost',
      contextSize: 8192,
      threads: 8,
      gpuLayers: 35
    },
    models: {
      default: 'llama-3.2-3b',
      paths: {
        'llama-3.2-3b': '/models/llama-3.2-3b.gguf'
      }
    },
    performance: {
      batchSize: 512,
      maxTokens: 2048,
      temperature: 0.7
    }
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup axios mock
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn()
    };
    
    (axios.create as MockedFunction<typeof axios.create>).mockReturnValue(mockAxiosInstance as any);
    (llamaCppConfig.getOptimizedConfig as MockedFunction<any>).mockResolvedValue(mockConfig);
    
    provider = new LlamaCppHttpProvider('http://localhost:8081');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default URL', () => {
      const defaultProvider = new LlamaCppHttpProvider();
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:8081',
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should initialize with custom URL', () => {
      const customProvider = new LlamaCppHttpProvider('http://localhost:9999');
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:9999'
        })
      );
    });

    it('should successfully connect to existing server', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });

      await provider.initialize();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully connected to llama-server',
        'LLAMA_CPP_HTTP'
      );
    });

    it('should attempt to start server if connection fails', async () => {
      // First health check fails
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Connection refused'));
      
      // Mock server start
      const mockStartServer = vi.spyOn(provider as any, 'startServer').mockResolvedValueOnce(undefined);
      
      // Second health check succeeds after server starts
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });

      await provider.initialize();
      
      expect(mockStartServer).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'llama-server not running, attempting to start it',
        'LLAMA_CPP_HTTP'
      );
    });

    it('should handle initialization failure gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));
      
      await expect(provider.initialize()).rejects.toThrow('Failed to initialize LlamaCppHttpProvider');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('generate method', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });
      await provider.initialize();
    });

    it('should generate text successfully', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-3.2-3b',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Generated response text'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await provider.generate('Test prompt', {
        temperature: 0.8,
        maxTokens: 100
      });

      expect(result.text).toBe('Generated response text');
      expect(result.model).toBe('llama-3.2-3b');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        expect.objectContaining({
          model: 'llama-3.2-3b',
          messages: [{ role: 'user', content: 'Test prompt' }],
          temperature: 0.8,
          max_tokens: 100
        })
      );
    });

    it('should handle system prompts correctly', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: { content: 'Response with system prompt' }
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await provider.generate('User prompt', {
        systemPrompt: 'You are a helpful assistant'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'User prompt' }
          ]
        })
      );
    });

    it('should handle streaming responses', async () => {
      const streamData = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}]}',
        'data: [DONE]'
      ].join('\n');

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: streamData,
        headers: { 'content-type': 'text/event-stream' }
      });

      const result = await provider.generate('Test', { stream: true });
      
      // Stream parsing would happen in real implementation
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        expect.objectContaining({ stream: true })
      );
    });

    it('should retry on temporary failures', async () => {
      // First attempt fails
      mockAxiosInstance.post.mockRejectedValueOnce(
        new Error('Temporary failure')
      );
      
      // Second attempt succeeds
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: { content: 'Success after retry' }
          }]
        }
      });

      const result = await provider.generate('Test prompt', {
        maxRetries: 2
      });

      expect(result.text).toBe('Success after retry');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should handle rate limiting with exponential backoff', async () => {
      const error = new Error('Rate limited') as AxiosError;
      error.response = { status: 429, data: {}, headers: {}, statusText: 'Too Many Requests', config: {} as any };
      
      // Mock rate limit error then success
      mockAxiosInstance.post
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          data: {
            choices: [{
              message: { content: 'Success after rate limit' }
            }]
          }
        });

      const startTime = Date.now();
      const result = await provider.generate('Test', {
        maxRetries: 2,
        retryDelay: 100
      });
      const duration = Date.now() - startTime;

      expect(result.text).toBe('Success after rate limit');
      expect(duration).toBeGreaterThanOrEqual(100); // Should have delayed
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 60000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      
      mockAxiosInstance.post.mockRejectedValueOnce(timeoutError);

      await expect(provider.generate('Test', { maxRetries: 1 }))
        .rejects.toThrow('timeout');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Request timeout'),
        expect.any(String)
      );
    });

    it('should respect token limits', async () => {
      const longPrompt = 'x'.repeat(10000); // Very long prompt
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: { content: 'Truncated response' }
          }]
        }
      });

      await provider.generate(longPrompt, {
        maxTokens: 100
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        expect.objectContaining({
          max_tokens: 100
        })
      );
    });
  });

  describe('model management', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });
      await provider.initialize();
    });

    it('should list available models', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: 'llama-3.2-3b', object: 'model' },
            { id: 'codellama-7b', object: 'model' }
          ]
        }
      });

      const models = await provider.listModels();
      
      expect(models).toEqual(['llama-3.2-3b', 'codellama-7b']);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/models');
    });

    it('should switch models', async () => {
      await provider.setModel('codellama-7b');
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: { content: 'Response from CodeLlama' }
          }]
        }
      });

      await provider.generate('Code question');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        expect.objectContaining({
          model: 'codellama-7b'
        })
      );
    });

    it('should get current model', () => {
      const model = provider.getCurrentModel();
      expect(model).toBe('llama-3.2-3b');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });
      await provider.initialize();
    });

    it('should handle 400 bad request errors', async () => {
      const error = new Error('Bad request') as AxiosError;
      error.response = { 
        status: 400, 
        data: { error: 'Invalid parameters' },
        headers: {},
        statusText: 'Bad Request',
        config: {} as any
      };
      
      mockAxiosInstance.post.mockRejectedValueOnce(error);

      await expect(provider.generate('Test'))
        .rejects.toThrow('Invalid parameters');
    });

    it('should handle 503 service unavailable', async () => {
      const error = new Error('Service unavailable') as AxiosError;
      error.response = { 
        status: 503,
        data: {},
        headers: {},
        statusText: 'Service Unavailable',
        config: {} as any
      };
      
      mockAxiosInstance.post.mockRejectedValueOnce(error);

      await expect(provider.generate('Test', { maxRetries: 1 }))
        .rejects.toThrow('Service unavailable');
      
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Server unavailable'),
        expect.any(String)
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      networkError.code = 'ECONNREFUSED';
      
      mockAxiosInstance.post.mockRejectedValueOnce(networkError);

      await expect(provider.generate('Test'))
        .rejects.toThrow('Network error');
      
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle malformed responses', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { invalid: 'response' }
      });

      await expect(provider.generate('Test'))
        .rejects.toThrow('Invalid response format');
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });
      await provider.initialize();
    });

    it('should track generation metrics', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: { content: 'Test response' }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
            total_duration: 1500 // ms
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await provider.generate('Test');
      
      expect(result.tokensGenerated).toBe(20);
      expect(result.totalDuration).toBe(1500);
      expect(result.tokensPerSecond).toBeCloseTo(13.33, 1);
    });

    it('should calculate tokens per second', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: { content: 'Response' }
          }],
          usage: {
            completion_tokens: 100,
            total_duration: 2000
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await provider.generate('Test');
      
      expect(result.tokensPerSecond).toBe(50);
    });
  });

  describe('connection recovery', () => {
    it('should reconnect after connection loss', async () => {
      // Initial successful connection
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });
      await provider.initialize();

      // Connection lost
      mockAxiosInstance.post.mockRejectedValueOnce(
        new Error('Connection refused')
      );

      // Automatic reconnection attempt
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });

      // Successful request after reconnection
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: { content: 'Reconnected successfully' }
          }]
        }
      });

      const result = await provider.generate('Test', {
        maxRetries: 2
      });

      expect(result.text).toBe('Reconnected successfully');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting'),
        expect.any(String)
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });
      await provider.initialize();

      await provider.destroy();
      
      expect(logger.info).toHaveBeenCalledWith(
        'LlamaCppHttpProvider destroyed',
        'LLAMA_CPP_HTTP'
      );
    });

    it('should stop server if it was started', async () => {
      // Server not initially running
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Not running'));
      
      const mockStopServer = vi.spyOn(provider as any, 'stopServer').mockResolvedValueOnce(undefined);
      
      // Start server
      const mockStartServer = vi.spyOn(provider as any, 'startServer').mockResolvedValueOnce(undefined);
      mockAxiosInstance.get.mockResolvedValueOnce({ 
        data: { status: 'ok' },
        status: 200 
      });
      
      await provider.initialize();
      await provider.destroy();
      
      expect(mockStopServer).toHaveBeenCalled();
    });
  });
});