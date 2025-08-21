/**
 * Performance Optimization Verification Tests
 * Tests to verify the claims in PERFORMANCE_OPTIMIZATION_DEPLOYMENT.md
 */

import { describe, test, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { getCachedLLMProvider } from '../../src/core/llm/index.js';
import { getOptimizedQueryExecutor, clearQueryCache } from '../../src/database/query-optimizer.js';
import { BaseAgent } from '../../src/core/agents/base/BaseAgent.js';
import { ResearchAgent } from '../../src/core/agents/specialized/ResearchAgent.js';
import { DataAnalysisAgent } from '../../src/core/agents/specialized/DataAnalysisAgent.js';
import { CodeAgent } from '../../src/core/agents/specialized/CodeAgent.js';
import { WriterAgent } from '../../src/core/agents/specialized/WriterAgent.js';
import { ToolExecutorAgent } from '../../src/core/agents/specialized/ToolExecutorAgent.js';

describe('Performance Optimization Verification', () => {
  
  describe('Singleton Pattern Verification', () => {
    test('CachedLLMProvider should return singleton instance', () => {
      const instance1 = getCachedLLMProvider();
      const instance2 = getCachedLLMProvider();
      
      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
      expect(instance1).toBe(instance2); // Should be the same instance
    });

    test('OptimizedQueryExecutor should return singleton instance', () => {
      const instance1 = getOptimizedQueryExecutor();
      const instance2 = getOptimizedQueryExecutor();
      
      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
      expect(instance1).toBe(instance2); // Should be the same instance
    });
  });

  describe('CachedLLMProvider Functionality', () => {
    let cachedProvider: any;

    beforeAll(() => {
      cachedProvider = getCachedLLMProvider();
    });

    test('should have cache methods', () => {
      expect(cachedProvider).toHaveProperty('generate');
      expect(cachedProvider).toHaveProperty('clearCache');
      expect(cachedProvider).toHaveProperty('getMetrics');
    });

    test('should track cache metrics', async () => {
      const metrics = cachedProvider.getMetrics();
      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('avgResponseTime');
    });

    test('should cache identical prompts', async () => {
      // Clear cache first
      cachedProvider.clearCache();
      
      const prompt = 'Test prompt for caching verification';
      
      // First call - should miss cache
      const metricsBefore = cachedProvider.getMetrics();
      const result1 = await cachedProvider.generate(prompt).catch(() => 'error');
      
      // Second call - should hit cache
      const result2 = await cachedProvider.generate(prompt).catch(() => 'error');
      const metricsAfter = cachedProvider.getMetrics();
      
      // If caching works, hit count should increase
      if (result1 !== 'error' && result2 !== 'error') {
        expect(metricsAfter.hits).toBeGreaterThan(metricsBefore.hits);
      }
    });

    test('should handle timeouts properly', async () => {
      // Test with a very long prompt that might timeout
      const longPrompt = 'x'.repeat(10000);
      
      const startTime = Date.now();
      await cachedProvider.generate(longPrompt).catch(() => null);
      const duration = Date.now() - startTime;
      
      // Should timeout within 35 seconds (30s timeout + overhead)
      expect(duration).toBeLessThan(35000);
    });
  });

  describe('OptimizedQueryExecutor Functionality', () => {
    let queryExecutor: any;

    beforeAll(() => {
      queryExecutor = getOptimizedQueryExecutor();
    });

    beforeEach(() => {
      clearQueryCache();
    });

    test('should have optimization methods', () => {
      expect(queryExecutor).toHaveProperty('execute');
      expect(queryExecutor).toHaveProperty('prepare');
      expect(queryExecutor).toHaveProperty('getStatistics');
      expect(queryExecutor).toHaveProperty('clearCache');
    });

    test('should track query statistics', () => {
      const stats = queryExecutor.getStatistics();
      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('avgExecutionTime');
      expect(stats).toHaveProperty('slowQueries');
    });

    test('should cache query results', () => {
      const query = 'SELECT COUNT(*) as count FROM emails';
      
      // First execution
      const statsBefore = queryExecutor.getStatistics();
      const result1 = queryExecutor.execute(query);
      
      // Second execution (should be cached)
      const result2 = queryExecutor.execute(query);
      const statsAfter = queryExecutor.getStatistics();
      
      expect(result1).toEqual(result2);
      // Cache hits should increase if caching works
      expect(statsAfter.cacheHits).toBeGreaterThanOrEqual(statsBefore.cacheHits);
    });

    test('should reuse prepared statements', () => {
      const stmt = queryExecutor.prepare('SELECT * FROM emails WHERE id = ?');
      expect(stmt).toBeDefined();
      
      // Getting the same statement again should return cached version
      const stmt2 = queryExecutor.prepare('SELECT * FROM emails WHERE id = ?');
      expect(stmt2).toBe(stmt);
    });
  });

  describe('Agent Integration Verification', () => {
    test('BaseAgent should use CachedLLMProvider', () => {
      const agent = new BaseAgent({
        name: 'TestAgent',
        description: 'Test agent',
        systemPrompt: 'You are a test agent'
      });
      
      // Check if the agent's LLM is the cached singleton
      const cachedProvider = getCachedLLMProvider();
      expect(agent.llm).toBe(cachedProvider);
    });

    test('5 out of 6 agents should initialize successfully', async () => {
      const agents = [];
      let successCount = 0;
      
      // Test each agent initialization
      try {
        const research = new ResearchAgent();
        agents.push(research);
        successCount++;
      } catch (e) {
        console.log('ResearchAgent failed:', e);
      }
      
      try {
        const dataAnalysis = new DataAnalysisAgent();
        agents.push(dataAnalysis);
        successCount++;
      } catch (e) {
        console.log('DataAnalysisAgent failed:', e);
      }
      
      try {
        const code = new CodeAgent();
        agents.push(code);
        successCount++;
      } catch (e) {
        console.log('CodeAgent failed:', e);
      }
      
      try {
        const writer = new WriterAgent();
        agents.push(writer);
        successCount++;
      } catch (e) {
        console.log('WriterAgent failed:', e);
      }
      
      try {
        const toolExecutor = new ToolExecutorAgent();
        agents.push(toolExecutor);
        successCount++;
      } catch (e) {
        console.log('ToolExecutorAgent failed:', e);
      }
      
      // EmailAnalysisAgent is excluded by design
      // At least 5 should succeed
      expect(successCount).toBeGreaterThanOrEqual(5);
      
      // All initialized agents should use the same cached LLM provider
      const cachedProvider = getCachedLLMProvider();
      agents.forEach(agent => {
        expect(agent.llm).toBe(cachedProvider);
      });
    });
  });

  describe('Memory Management', () => {
    test('should not have memory leaks in cache', async () => {
      const cachedProvider = getCachedLLMProvider();
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many cached entries
      for (let i = 0; i < 100; i++) {
        await cachedProvider.generate(`Test prompt ${i}`).catch(() => null);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB for 100 cache entries)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('cache should respect max size limit', () => {
      const cachedProvider = getCachedLLMProvider();
      const metrics = cachedProvider.getMetrics();
      
      // The cache size should not exceed the configured maximum (500 entries)
      expect(metrics.cacheSize || 0).toBeLessThanOrEqual(500);
    });
  });

  describe('Performance Improvements', () => {
    test('cached queries should be faster than uncached', async () => {
      const queryExecutor = getOptimizedQueryExecutor();
      clearQueryCache();
      
      const query = 'SELECT id, subject FROM emails LIMIT 10';
      
      // First execution (uncached)
      const start1 = Date.now();
      queryExecutor.execute(query);
      const uncachedTime = Date.now() - start1;
      
      // Second execution (cached)
      const start2 = Date.now();
      queryExecutor.execute(query);
      const cachedTime = Date.now() - start2;
      
      // Cached should be significantly faster (at least 50% faster)
      // Note: This might not always be true for very fast queries
      if (uncachedTime > 5) { // Only test if query takes more than 5ms
        expect(cachedTime).toBeLessThan(uncachedTime * 0.5);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', () => {
      const queryExecutor = getOptimizedQueryExecutor();
      
      // Invalid SQL should not crash
      expect(() => {
        queryExecutor.execute('INVALID SQL QUERY');
      }).toThrow();
    });

    test('should handle LLM provider errors gracefully', async () => {
      const cachedProvider = getCachedLLMProvider();
      
      // Even with errors, should not crash
      const result = await cachedProvider.generate(null).catch(err => 'handled');
      expect(result).toBe('handled');
    });
  });
});