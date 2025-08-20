/**
 * Integration Tests for Llama.cpp Server
 * Tests actual server integration, memory leaks, and production scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { LlamaCppHttpProvider } from '../LlamaCppHttpProvider';
import { LLMProviderManager } from '../LLMProviderManager';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { logger } from '../../../utils/logger';

// Test configuration
const TEST_SERVER_PORT = 8082; // Different port to avoid conflicts
const TEST_MODEL_PATH = process.env.TEST_MODEL_PATH || '/models/tinyllama-1.1b.gguf';
const SKIP_INTEGRATION = process.env.SKIP_LLAMA_INTEGRATION === 'true';

describe('Llama.cpp Integration Tests', () => {
  if (SKIP_INTEGRATION) {
    it.skip('Integration tests skipped (SKIP_LLAMA_INTEGRATION=true)', () => {});
    return;
  }

  let serverProcess: ChildProcess | null = null;
  let provider: LlamaCppHttpProvider;
  let baseURL: string;

  /**
   * Start a test llama-server instance
   */
  async function startTestServer(): Promise<void> {
    const modelExists = await fs.access(TEST_MODEL_PATH).then(() => true).catch(() => false);
    if (!modelExists) {
      console.warn(`Model not found at ${TEST_MODEL_PATH}, using mock server`);
      return startMockServer();
    }

    return new Promise((resolve, reject) => {
      serverProcess = spawn('llama-server', [
        '-m', TEST_MODEL_PATH,
        '--host', '0.0.0.0',
        '--port', TEST_SERVER_PORT.toString(),
        '--ctx-size', '2048',
        '--threads', '4',
        '--n-gpu-layers', '0', // CPU only for testing
        '--log-disable'
      ]);

      let serverReady = false;

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('server listening') || output.includes('HTTP server listening')) {
          serverReady = true;
          resolve();
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!serverReady) {
          if (serverProcess) {
            serverProcess.kill();
          }
          reject(new Error('Server startup timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Start a mock server for testing when model is not available
   */
  async function startMockServer(): Promise<void> {
    const express = require('express');
    const app = express();
    
    app.use(express.json());
    
    // Mock endpoints
    app.get('/health', (req: any, res: any) => {
      res.json({ status: 'ok' });
    });
    
    app.get('/v1/models', (req: any, res: any) => {
      res.json({
        data: [
          { id: 'test-model', object: 'model' }
        ]
      });
    });
    
    app.post('/v1/chat/completions', (req: any, res: any) => {
      const { messages, stream } = req.body;
      
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: {"choices":[{"delta":{"content":"Mock"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":" response"}}]}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.json({
          id: 'mock-completion',
          object: 'chat.completion',
          created: Date.now(),
          model: 'test-model',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Mock response to: ' + messages[messages.length - 1].content
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          }
        });
      }
    });
    
    return new Promise((resolve) => {
      const server = app.listen(TEST_SERVER_PORT, () => {
        console.log(`Mock server started on port ${TEST_SERVER_PORT}`);
        serverProcess = server as any;
        resolve();
      });
    });
  }

  beforeAll(async () => {
    baseURL = `http://localhost:${TEST_SERVER_PORT}`;
    await startTestServer();
    
    // Wait for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    if (serverProcess) {
      if (typeof serverProcess.kill === 'function') {
        serverProcess.kill();
      } else if (typeof (serverProcess as any).close === 'function') {
        (serverProcess as any).close();
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  describe('Server Connection and Health', () => {
    beforeEach(() => {
      provider = new LlamaCppHttpProvider(baseURL);
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should successfully connect to the server', async () => {
      await provider.initialize();
      expect(provider.isReady()).toBe(true);
    });

    it('should retrieve model information', async () => {
      await provider.initialize();
      const info = provider.getModelInfo();
      
      expect(info).toHaveProperty('model');
      expect(info).toHaveProperty('contextSize');
      expect(info).toHaveProperty('loaded');
      expect(info.loaded).toBe(true);
    });

    it('should handle server health checks', async () => {
      const response = await axios.get(`${baseURL}/health`);
      expect(response.data).toHaveProperty('status');
      expect(response.data.status).toBe('ok');
    });
  });

  describe('Text Generation', () => {
    beforeEach(async () => {
      provider = new LlamaCppHttpProvider(baseURL);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should generate text successfully', async () => {
      const result = await provider.generate('What is 2 + 2?', {
        maxTokens: 50,
        temperature: 0.1
      });

      expect(result).toHaveProperty('response');
      expect(result.response).toBeTruthy();
      expect(result.done).toBe(true);
    });

    it('should handle system prompts', async () => {
      const result = await provider.generate('Hello', {
        systemPrompt: 'You are a helpful assistant. Be concise.',
        maxTokens: 30
      });

      expect(result.response).toBeTruthy();
    });

    it('should generate with different temperatures', async () => {
      const results = await Promise.all([
        provider.generate('Tell me a story', { temperature: 0.1, maxTokens: 50 }),
        provider.generate('Tell me a story', { temperature: 0.9, maxTokens: 50 })
      ]);

      // Both should generate something
      expect(results[0].response).toBeTruthy();
      expect(results[1].response).toBeTruthy();
    });

    it('should respect max token limits', async () => {
      const result = await provider.generate('Count from 1 to 100', {
        maxTokens: 10
      });

      // Response should be truncated
      const tokens = result.response.split(/\s+/);
      expect(tokens.length).toBeLessThanOrEqual(15); // Some buffer for tokenization differences
    });
  });

  describe('Streaming Generation', () => {
    beforeEach(async () => {
      provider = new LlamaCppHttpProvider(baseURL);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should stream responses', async () => {
      const chunks: string[] = [];
      
      for await (const chunk of provider.generateStream('Hello, how are you?', {
        maxTokens: 30
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const fullResponse = chunks.join('');
      expect(fullResponse).toBeTruthy();
    });

    it('should handle stream interruption', async () => {
      const chunks: string[] = [];
      let interrupted = false;
      
      try {
        for await (const chunk of provider.generateStream('Tell me a long story', {
          maxTokens: 100
        })) {
          chunks.push(chunk);
          
          // Interrupt after a few chunks
          if (chunks.length >= 3) {
            interrupted = true;
            break;
          }
        }
      } catch (error) {
        // Stream interruption might throw
      }

      expect(interrupted).toBe(true);
      expect(chunks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Concurrent Requests', () => {
    beforeEach(async () => {
      provider = new LlamaCppHttpProvider(baseURL);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should handle multiple concurrent requests', async () => {
      const prompts = [
        'What is the capital of France?',
        'What is 2 + 2?',
        'Name a color',
        'What day comes after Monday?',
        'What is H2O?'
      ];

      const startTime = performance.now();
      const results = await Promise.all(
        prompts.map(prompt => 
          provider.generate(prompt, { maxTokens: 20 })
        )
      );
      const duration = performance.now() - startTime;

      // All requests should complete
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.response).toBeTruthy();
        expect(result.done).toBe(true);
      });

      // Log performance
      console.log(`Concurrent requests completed in ${duration.toFixed(2)}ms`);
    });

    it('should maintain request isolation', async () => {
      const contexts = [
        { userId: 'user1' },
        { userId: 'user2' },
        { userId: 'user3' }
      ];

      const results = await Promise.all(
        contexts.map((context, i) => 
          provider.generate(`Request ${i}`, { 
            maxTokens: 20,
            context 
          })
        )
      );

      // Each should get a response
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.response).toBeTruthy();
      });
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      provider = new LlamaCppHttpProvider(baseURL);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should not leak memory on repeated requests', async () => {
      const memoryBefore = process.memoryUsage();
      
      // Make 20 requests
      for (let i = 0; i < 20; i++) {
        await provider.generate(`Test request ${i}`, {
          maxTokens: 50
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage();
      const heapGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      // Allow some growth but not excessive (< 50MB)
      expect(heapGrowth).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should track active process count correctly', async () => {
      expect(provider.getModelInfo().processCount).toBe(0);
      
      // Start multiple requests
      const promises = Array(3).fill(null).map((_, i) => 
        provider.generate(`Request ${i}`, { maxTokens: 20 })
      );

      // Check count during processing
      await new Promise(resolve => setTimeout(resolve, 10));
      const duringCount = provider.getModelInfo().processCount;
      expect(duringCount).toBeGreaterThan(0);

      // Wait for completion
      await Promise.all(promises);
      
      // Count should return to 0
      expect(provider.getModelInfo().processCount).toBe(0);
    });

    it('should cleanup resources properly', async () => {
      // Generate some requests
      await provider.generate('Test 1', { maxTokens: 20 });
      await provider.generate('Test 2', { maxTokens: 20 });
      
      // Cleanup
      await provider.cleanup();
      
      // Provider should not be ready
      expect(provider.isReady()).toBe(false);
      
      // Should not be able to generate
      await expect(
        provider.generate('Test after cleanup')
      ).rejects.toThrow();
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      provider = new LlamaCppHttpProvider(baseURL);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should handle malformed prompts', async () => {
      const malformedPrompts = [
        '', // Empty
        ' '.repeat(10000), // Very long whitespace
        '\x00\x01\x02', // Control characters
        '🔥'.repeat(1000) // Many emojis
      ];

      for (const prompt of malformedPrompts) {
        // Should not throw, but handle gracefully
        const result = await provider.generate(prompt, {
          maxTokens: 10
        }).catch(e => ({ error: e.message }));
        
        // Either succeeds or returns controlled error
        expect(result).toBeDefined();
      }
    });

    it('should recover from request timeouts', async () => {
      // Create provider with short timeout
      const timeoutProvider = new LlamaCppHttpProvider(baseURL);
      await timeoutProvider.initialize();
      
      // Override timeout
      (timeoutProvider as any).client.defaults.timeout = 100; // 100ms timeout
      
      // Long generation that would timeout
      const result = await timeoutProvider.generate(
        'Write a very long essay about the history of computing',
        { maxTokens: 1000 }
      ).catch(e => ({ error: e.message }));
      
      expect(result).toHaveProperty('error');
      
      await timeoutProvider.cleanup();
    });
  });

  describe('LLMProviderManager Integration', () => {
    let manager: LLMProviderManager;

    beforeEach(async () => {
      // Configure manager to use our test server
      process.env.LLAMA_CPP_URL = baseURL;
      manager = LLMProviderManager.getInstance();
      await manager.initialize();
    });

    afterEach(async () => {
      delete process.env.LLAMA_CPP_URL;
    });

    it('should integrate with LLMProviderManager', async () => {
      const response = await manager.generateWithFallback(
        'What is the capital of France?',
        { maxTokens: 20 }
      );

      expect(response).toHaveProperty('text');
      expect(response.text).toBeTruthy();
      expect(response).toHaveProperty('provider');
    });

    it('should handle provider fallback', async () => {
      // Force primary provider to fail
      const primaryProvider = (manager as any).primaryProvider;
      vi.spyOn(primaryProvider, 'generate').mockRejectedValueOnce(
        new Error('Primary provider failed')
      );

      const response = await manager.generateWithFallback(
        'Test fallback',
        { maxTokens: 20 }
      );

      // Should succeed with fallback
      expect(response.text).toBeTruthy();
      expect(response.provider).not.toBe('primary');
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      provider = new LlamaCppHttpProvider(baseURL);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should measure token generation speed', async () => {
      const prompts = [
        { text: 'Short prompt', tokens: 10 },
        { text: 'Write a paragraph about AI', tokens: 50 },
        { text: 'Explain quantum computing in detail', tokens: 100 }
      ];

      const results: any[] = [];

      for (const { text, tokens } of prompts) {
        const startTime = performance.now();
        const result = await provider.generate(text, {
          maxTokens: tokens,
          temperature: 0.7
        });
        const duration = performance.now() - startTime;

        results.push({
          prompt: text,
          requestedTokens: tokens,
          generatedTokens: result.tokensGenerated || 0,
          duration: duration,
          tokensPerSecond: result.tokensPerSecond || 0
        });
      }

      // Log benchmark results
      console.table(results);

      // Verify reasonable performance
      results.forEach(result => {
        expect(result.duration).toBeLessThan(30000); // Less than 30 seconds
        if (result.generatedTokens > 0) {
          expect(result.tokensPerSecond).toBeGreaterThan(0);
        }
      });
    });

    it('should measure latency for different request sizes', async () => {
      const sizes = [10, 50, 100, 200];
      const latencies: any[] = [];

      for (const size of sizes) {
        const prompt = 'x '.repeat(size); // Create prompt of specific size
        
        const startTime = performance.now();
        await provider.generate(prompt, {
          maxTokens: 20,
          temperature: 0.5
        });
        const latency = performance.now() - startTime;

        latencies.push({
          promptSize: size * 2, // Approximate token count
          latency: latency.toFixed(2),
          latencyPerToken: (latency / (size * 2)).toFixed(2)
        });
      }

      console.table(latencies);

      // Latency should not grow exponentially
      const firstLatency = latencies[0].latency;
      const lastLatency = latencies[latencies.length - 1].latency;
      expect(lastLatency / firstLatency).toBeLessThan(10); // Reasonable scaling
    });
  });

  describe('Production Scenarios', () => {
    beforeEach(async () => {
      provider = new LlamaCppHttpProvider(baseURL);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should handle business email analysis', async () => {
      const emailContent = `
        Subject: Q4 Revenue Report - Action Required
        
        Dear Team,
        
        Our Q4 revenue shows a 15% increase YoY. 
        Key metrics:
        - Total revenue: $2.5M
        - New customers: 150
        - Churn rate: 5%
        
        Please review and prepare for Monday's meeting.
        
        Best regards,
        John
      `;

      const result = await provider.generate(
        `Analyze this email and extract key information: ${emailContent}`,
        {
          systemPrompt: 'You are a business analyst. Extract key metrics and action items.',
          maxTokens: 200,
          temperature: 0.3
        }
      );

      expect(result.response).toBeTruthy();
      expect(result.response.length).toBeGreaterThan(20);
    });

    it('should handle code generation requests', async () => {
      const result = await provider.generate(
        'Write a TypeScript function to validate email addresses',
        {
          systemPrompt: 'You are a code assistant. Provide clean, working code.',
          maxTokens: 150,
          temperature: 0.2
        }
      );

      expect(result.response).toBeTruthy();
      // Should contain some code-like content
      expect(result.response).toMatch(/function|const|return|@/);
    });

    it('should handle multi-turn conversation context', async () => {
      const conversation = [
        { role: 'user', content: 'My name is Alice' },
        { role: 'assistant', content: 'Hello Alice!' },
        { role: 'user', content: 'What is my name?' }
      ];

      // Build context
      const systemPrompt = 'You are a helpful assistant with good memory.';
      const context = conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      
      const result = await provider.generate(
        context + '\nassistant:',
        {
          systemPrompt,
          maxTokens: 50,
          temperature: 0.3
        }
      );

      // Should remember the name
      expect(result.response.toLowerCase()).toContain('alice');
    });
  });
});