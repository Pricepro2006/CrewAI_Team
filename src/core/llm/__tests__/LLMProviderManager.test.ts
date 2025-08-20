/**
 * Integration Tests for LLMProviderManager
 * Tests provider management, fallback mechanisms, and llama.cpp integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { LLMProviderManager } from '../LLMProviderManager';
import { LlamaCppHttpProvider } from '../LlamaCppHttpProvider';
import { OllamaProvider } from '../OllamaProvider';
import { SimpleLLMProvider } from '../SimpleLLMProvider';
import { logger } from '../../../utils/logger';

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock provider modules
vi.mock('../LlamaCppHttpProvider');
vi.mock('../OllamaProvider');
vi.mock('../SimpleLLMProvider');

describe('LLMProviderManager', () => {
  let manager: LLMProviderManager;
  let mockLlamaCppProvider: any;
  let mockOllamaProvider: any;
  let mockSimpleProvider: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock providers
    mockLlamaCppProvider = {
      initialize: vi.fn().mockResolvedValue(undefined),
      generate: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      destroy: vi.fn().mockResolvedValue(undefined),
      getCurrentModel: vi.fn().mockReturnValue('llama-3.2-3b'),
      setModel: vi.fn(),
      listModels: vi.fn().mockResolvedValue(['llama-3.2-3b', 'codellama-7b'])
    };

    mockOllamaProvider = {
      initialize: vi.fn().mockResolvedValue(undefined),
      generate: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      destroy: vi.fn().mockResolvedValue(undefined),
      getCurrentModel: vi.fn().mockReturnValue('qwen3:14b'),
      setModel: vi.fn()
    };

    mockSimpleProvider = {
      initialize: vi.fn().mockResolvedValue(undefined),
      generate: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      destroy: vi.fn().mockResolvedValue(undefined)
    };

    // Mock constructor implementations
    (LlamaCppHttpProvider as unknown as Mock).mockImplementation(() => mockLlamaCppProvider);
    (OllamaProvider as unknown as Mock).mockImplementation(() => mockOllamaProvider);
    (SimpleLLMProvider as unknown as Mock).mockImplementation(() => mockSimpleProvider);
    
    // Create manager instance
    manager = LLMProviderManager.getInstance();
  });

  afterEach(async () => {
    // Clean up singleton instance
    await manager.destroy();
    (LLMProviderManager as any).instance = null;
    vi.restoreAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LLMProviderManager.getInstance();
      const instance2 = LLMProviderManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize only once', async () => {
      const instance1 = LLMProviderManager.getInstance();
      await instance1.initialize();
      
      const instance2 = LLMProviderManager.getInstance();
      await instance2.initialize();
      
      // Providers should be initialized only once
      expect(mockLlamaCppProvider.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('provider initialization', () => {
    it('should initialize all providers on startup', async () => {
      await manager.initialize();
      
      expect(mockLlamaCppProvider.initialize).toHaveBeenCalled();
      expect(mockOllamaProvider.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('LLMProviderManager initialized'),
        'LLM_MANAGER'
      );
    });

    it('should handle provider initialization failures gracefully', async () => {
      mockLlamaCppProvider.initialize.mockRejectedValueOnce(new Error('Init failed'));
      mockLlamaCppProvider.isAvailable.mockResolvedValueOnce(false);
      
      await manager.initialize();
      
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize provider: llama-cpp'),
        'LLM_MANAGER'
      );
      
      // Other providers should still initialize
      expect(mockOllamaProvider.initialize).toHaveBeenCalled();
    });

    it('should mark unavailable providers', async () => {
      mockLlamaCppProvider.isAvailable.mockResolvedValueOnce(false);
      
      await manager.initialize();
      
      const available = await manager.isProviderAvailable('llama-cpp');
      expect(available).toBe(false);
    });
  });

  describe('provider selection', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should use primary provider (llama-cpp) by default', async () => {
      mockLlamaCppProvider.generate.mockResolvedValueOnce({
        text: 'Response from llama.cpp',
        model: 'llama-3.2-3b'
      });

      const result = await manager.generate('Test prompt');
      
      expect(result.text).toBe('Response from llama.cpp');
      expect(mockLlamaCppProvider.generate).toHaveBeenCalledWith('Test prompt', {});
      expect(mockOllamaProvider.generate).not.toHaveBeenCalled();
    });

    it('should allow explicit provider selection', async () => {
      mockOllamaProvider.generate.mockResolvedValueOnce({
        text: 'Response from Ollama',
        model: 'qwen3:14b'
      });

      const result = await manager.generate('Test prompt', {
        provider: 'ollama'
      });
      
      expect(result.text).toBe('Response from Ollama');
      expect(mockOllamaProvider.generate).toHaveBeenCalled();
      expect(mockLlamaCppProvider.generate).not.toHaveBeenCalled();
    });

    it('should set and use current provider', async () => {
      await manager.setCurrentProvider('ollama');
      
      mockOllamaProvider.generate.mockResolvedValueOnce({
        text: 'Ollama response',
        model: 'qwen3:14b'
      });

      const result = await manager.generate('Test');
      
      expect(result.text).toBe('Ollama response');
      expect(mockOllamaProvider.generate).toHaveBeenCalled();
    });

    it('should get current provider', async () => {
      const provider = await manager.getCurrentProvider();
      expect(provider).toBe('llama-cpp');
      
      await manager.setCurrentProvider('ollama');
      const newProvider = await manager.getCurrentProvider();
      expect(newProvider).toBe('ollama');
    });
  });

  describe('fallback mechanism', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should fallback to Ollama when llama-cpp fails', async () => {
      mockLlamaCppProvider.generate.mockRejectedValueOnce(new Error('llama-cpp failed'));
      mockOllamaProvider.generate.mockResolvedValueOnce({
        text: 'Fallback response from Ollama',
        model: 'qwen3:14b'
      });

      const result = await manager.generate('Test prompt');
      
      expect(result.text).toBe('Fallback response from Ollama');
      expect(mockLlamaCppProvider.generate).toHaveBeenCalled();
      expect(mockOllamaProvider.generate).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Provider llama-cpp failed, trying fallback'),
        'LLM_MANAGER'
      );
    });

    it('should fallback through multiple providers', async () => {
      mockLlamaCppProvider.generate.mockRejectedValueOnce(new Error('llama-cpp failed'));
      mockOllamaProvider.generate.mockRejectedValueOnce(new Error('ollama failed'));
      mockSimpleProvider.generate.mockResolvedValueOnce({
        text: 'Fallback response from simple provider',
        model: 'simple'
      });

      const result = await manager.generate('Test prompt');
      
      expect(result.text).toBe('Fallback response from simple provider');
      expect(mockLlamaCppProvider.generate).toHaveBeenCalled();
      expect(mockOllamaProvider.generate).toHaveBeenCalled();
      expect(mockSimpleProvider.generate).toHaveBeenCalled();
    });

    it('should throw error when all providers fail', async () => {
      mockLlamaCppProvider.generate.mockRejectedValueOnce(new Error('llama-cpp failed'));
      mockOllamaProvider.generate.mockRejectedValueOnce(new Error('ollama failed'));
      mockSimpleProvider.generate.mockRejectedValueOnce(new Error('simple failed'));

      await expect(manager.generate('Test prompt'))
        .rejects.toThrow('All LLM providers failed');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('All providers failed'),
        'LLM_MANAGER'
      );
    });

    it('should skip unavailable providers in fallback chain', async () => {
      mockLlamaCppProvider.isAvailable.mockResolvedValueOnce(false);
      mockOllamaProvider.generate.mockResolvedValueOnce({
        text: 'Response from first available provider',
        model: 'qwen3:14b'
      });

      const result = await manager.generate('Test prompt');
      
      expect(result.text).toBe('Response from first available provider');
      expect(mockLlamaCppProvider.generate).not.toHaveBeenCalled();
      expect(mockOllamaProvider.generate).toHaveBeenCalled();
    });
  });

  describe('provider recovery', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should attempt to recover failed providers', async () => {
      // Mark provider as failed
      mockLlamaCppProvider.generate.mockRejectedValueOnce(new Error('Connection lost'));
      mockLlamaCppProvider.isAvailable.mockResolvedValueOnce(false);
      mockOllamaProvider.generate.mockResolvedValueOnce({ text: 'Fallback' });
      
      await manager.generate('Test');
      
      // Simulate recovery check
      mockLlamaCppProvider.isAvailable.mockResolvedValueOnce(true);
      mockLlamaCppProvider.initialize.mockResolvedValueOnce(undefined);
      
      await manager.checkProviderHealth();
      
      expect(mockLlamaCppProvider.initialize).toHaveBeenCalledTimes(2); // Initial + recovery
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Provider llama-cpp recovered'),
        'LLM_MANAGER'
      );
    });

    it('should periodically check provider health', async () => {
      vi.useFakeTimers();
      
      await manager.startHealthCheck(1000); // Check every second
      
      // Fast forward time
      vi.advanceTimersByTime(3000);
      
      expect(mockLlamaCppProvider.isAvailable).toHaveBeenCalledTimes(3);
      expect(mockOllamaProvider.isAvailable).toHaveBeenCalledTimes(3);
      
      manager.stopHealthCheck();
      vi.useRealTimers();
    });
  });

  describe('model management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should list models from all providers', async () => {
      mockLlamaCppProvider.listModels.mockResolvedValueOnce(['llama-3.2-3b', 'codellama-7b']);
      mockOllamaProvider.listModels = vi.fn().mockResolvedValueOnce(['qwen3:14b', 'mistral:7b']);

      const models = await manager.listAllModels();
      
      expect(models).toEqual({
        'llama-cpp': ['llama-3.2-3b', 'codellama-7b'],
        'ollama': ['qwen3:14b', 'mistral:7b']
      });
    });

    it('should switch models for a provider', async () => {
      await manager.setModel('llama-cpp', 'codellama-7b');
      
      expect(mockLlamaCppProvider.setModel).toHaveBeenCalledWith('codellama-7b');
    });

    it('should get current model for each provider', async () => {
      const models = await manager.getCurrentModels();
      
      expect(models).toEqual({
        'llama-cpp': 'llama-3.2-3b',
        'ollama': 'qwen3:14b'
      });
    });
  });

  describe('performance optimization', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should cache provider availability', async () => {
      await manager.isProviderAvailable('llama-cpp');
      await manager.isProviderAvailable('llama-cpp');
      await manager.isProviderAvailable('llama-cpp');
      
      // Should only check once within cache period
      expect(mockLlamaCppProvider.isAvailable).toHaveBeenCalledTimes(1);
    });

    it('should batch concurrent requests to same provider', async () => {
      mockLlamaCppProvider.generate.mockImplementation(async (prompt: string) => ({
        text: `Response to: ${prompt}`,
        model: 'llama-3.2-3b'
      }));

      const promises = [
        manager.generate('Prompt 1'),
        manager.generate('Prompt 2'),
        manager.generate('Prompt 3')
      ];

      const results = await Promise.all(promises);
      
      expect(results[0].text).toBe('Response to: Prompt 1');
      expect(results[1].text).toBe('Response to: Prompt 2');
      expect(results[2].text).toBe('Response to: Prompt 3');
      expect(mockLlamaCppProvider.generate).toHaveBeenCalledTimes(3);
    });

    it('should implement request queuing under load', async () => {
      const delays = [100, 50, 150];
      let callCount = 0;
      
      mockLlamaCppProvider.generate.mockImplementation(async () => {
        const delay = delays[callCount++];
        await new Promise(resolve => setTimeout(resolve, delay));
        return { text: `Response ${callCount}`, model: 'llama-3.2-3b' };
      });

      const promises = Array(3).fill(null).map((_, i) => 
        manager.generate(`Prompt ${i}`)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(callCount).toBe(3);
    });
  });

  describe('error handling and logging', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should log detailed error information', async () => {
      const error = new Error('Detailed error message');
      error.stack = 'Error stack trace';
      
      mockLlamaCppProvider.generate.mockRejectedValueOnce(error);
      mockOllamaProvider.generate.mockRejectedValueOnce(new Error('Ollama error'));
      mockSimpleProvider.generate.mockRejectedValueOnce(new Error('Simple error'));

      await expect(manager.generate('Test'))
        .rejects.toThrow('All LLM providers failed');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Detailed error message'),
        'LLM_MANAGER'
      );
    });

    it('should track error rates per provider', async () => {
      // Generate some successes and failures
      mockLlamaCppProvider.generate
        .mockResolvedValueOnce({ text: 'Success 1' })
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce({ text: 'Success 2' })
        .mockRejectedValueOnce(new Error('Fail 2'));

      for (let i = 0; i < 4; i++) {
        try {
          await manager.generate('Test', { provider: 'llama-cpp' });
        } catch (e) {
          // Expected failures
        }
      }

      const stats = manager.getProviderStats('llama-cpp');
      expect(stats.totalRequests).toBe(4);
      expect(stats.successCount).toBe(2);
      expect(stats.errorCount).toBe(2);
      expect(stats.errorRate).toBe(0.5);
    });

    it('should provide detailed provider status', async () => {
      const status = await manager.getProviderStatus();
      
      expect(status).toHaveProperty('llama-cpp');
      expect(status['llama-cpp']).toEqual({
        available: true,
        model: 'llama-3.2-3b',
        lastChecked: expect.any(Date),
        errorCount: 0,
        successCount: 0
      });
    });
  });

  describe('concurrent provider management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle concurrent requests to different providers', async () => {
      mockLlamaCppProvider.generate.mockResolvedValueOnce({
        text: 'LlamaCpp response',
        model: 'llama-3.2-3b'
      });
      
      mockOllamaProvider.generate.mockResolvedValueOnce({
        text: 'Ollama response',
        model: 'qwen3:14b'
      });

      const [result1, result2] = await Promise.all([
        manager.generate('Test 1', { provider: 'llama-cpp' }),
        manager.generate('Test 2', { provider: 'ollama' })
      ]);

      expect(result1.text).toBe('LlamaCpp response');
      expect(result2.text).toBe('Ollama response');
    });

    it('should load balance when using auto provider selection', async () => {
      // Mock both providers as healthy
      mockLlamaCppProvider.generate.mockResolvedValue({ text: 'LlamaCpp' });
      mockOllamaProvider.generate.mockResolvedValue({ text: 'Ollama' });

      // Enable load balancing
      await manager.enableLoadBalancing();

      // Make multiple requests
      const results = await Promise.all(
        Array(10).fill(null).map(() => manager.generate('Test'))
      );

      // Should distribute load between providers
      const llamaCount = mockLlamaCppProvider.generate.mock.calls.length;
      const ollamaCount = mockOllamaProvider.generate.mock.calls.length;
      
      expect(llamaCount + ollamaCount).toBe(10);
      expect(llamaCount).toBeGreaterThan(0);
      expect(ollamaCount).toBeGreaterThan(0);
    });
  });

  describe('cleanup and lifecycle', () => {
    it('should cleanup all providers on destroy', async () => {
      await manager.initialize();
      await manager.destroy();
      
      expect(mockLlamaCppProvider.destroy).toHaveBeenCalled();
      expect(mockOllamaProvider.destroy).toHaveBeenCalled();
      expect(mockSimpleProvider.destroy).toHaveBeenCalled();
      
      expect(logger.info).toHaveBeenCalledWith(
        'LLMProviderManager destroyed',
        'LLM_MANAGER'
      );
    });

    it('should stop health checks on destroy', async () => {
      vi.useFakeTimers();
      
      await manager.initialize();
      await manager.startHealthCheck(1000);
      
      await manager.destroy();
      
      // Advance time to verify no more health checks
      vi.advanceTimersByTime(5000);
      
      // Should not have been called after destroy
      expect(mockLlamaCppProvider.isAvailable).toHaveBeenCalledTimes(0);
      
      vi.useRealTimers();
    });

    it('should handle destroy errors gracefully', async () => {
      await manager.initialize();
      
      mockLlamaCppProvider.destroy.mockRejectedValueOnce(new Error('Destroy failed'));
      
      await manager.destroy();
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error destroying provider'),
        'LLM_MANAGER'
      );
      
      // Other providers should still be destroyed
      expect(mockOllamaProvider.destroy).toHaveBeenCalled();
    });
  });
});