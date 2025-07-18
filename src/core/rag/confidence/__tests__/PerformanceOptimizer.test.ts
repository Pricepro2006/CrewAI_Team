import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceOptimizer } from '../PerformanceOptimizer';
import { ScoredDocument, TokenConfidence } from '../types';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer({
      enableCache: true,
      cacheSize: 100,
      cacheTTL: 5000,
      enableBatching: true,
      batchSize: 3,
      batchTimeout: 50,
    });
  });

  afterEach(() => {
    optimizer.cleanup();
  });

  describe('Cache functionality', () => {
    it('should cache results and return from cache on subsequent calls', async () => {
      const expensiveFunction = vi.fn().mockResolvedValue('result');
      const key = 'test-key';

      // First call - should execute function
      const result1 = await optimizer.withCache(key, expensiveFunction);
      expect(result1).toBe('result');
      expect(expensiveFunction).toHaveBeenCalledTimes(1);

      // Second call - should return from cache
      const result2 = await optimizer.withCache(key, expensiveFunction);
      expect(result2).toBe('result');
      expect(expensiveFunction).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should respect TTL and refresh cache after expiry', async () => {
      const optimizer = new PerformanceOptimizer({
        enableCache: true,
        cacheTTL: 100, // 100ms TTL
      });

      const expensiveFunction = vi.fn()
        .mockResolvedValueOnce('result1')
        .mockResolvedValueOnce('result2');
      const key = 'ttl-test';

      // First call
      const result1 = await optimizer.withCache(key, expensiveFunction);
      expect(result1).toBe('result1');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call after TTL - should execute function again
      const result2 = await optimizer.withCache(key, expensiveFunction);
      expect(result2).toBe('result2');
      expect(expensiveFunction).toHaveBeenCalledTimes(2);

      optimizer.cleanup();
    });

    it('should handle cache disabled mode', async () => {
      const optimizer = new PerformanceOptimizer({ enableCache: false });
      const expensiveFunction = vi.fn().mockResolvedValue('result');
      const key = 'no-cache';

      // Should always execute function when cache is disabled
      await optimizer.withCache(key, expensiveFunction);
      await optimizer.withCache(key, expensiveFunction);
      expect(expensiveFunction).toHaveBeenCalledTimes(2);

      optimizer.cleanup();
    });
  });

  describe('Batching functionality', () => {
    it('should batch multiple requests together', async () => {
      const batchFunction = vi.fn().mockImplementation(async (items: string[]) => {
        return items.map(item => `processed-${item}`);
      });

      // Send multiple requests simultaneously
      const promises = [
        optimizer.withBatching('batch1', 'item1', batchFunction),
        optimizer.withBatching('batch1', 'item2', batchFunction),
        optimizer.withBatching('batch1', 'item3', batchFunction),
      ];

      const results = await Promise.all(promises);

      // Should have batched all three together
      expect(batchFunction).toHaveBeenCalledTimes(1);
      expect(batchFunction).toHaveBeenCalledWith(['item1', 'item2', 'item3']);
      expect(results).toEqual(['processed-item1', 'processed-item2', 'processed-item3']);
    });

    it('should process partial batch after timeout', async () => {
      const batchFunction = vi.fn().mockImplementation(async (items: string[]) => {
        return items.map(item => `processed-${item}`);
      });

      // Send only two requests (less than batch size of 3)
      const promise1 = optimizer.withBatching('batch2', 'item1', batchFunction);
      const promise2 = optimizer.withBatching('batch2', 'item2', batchFunction);

      // Wait for batch timeout
      const results = await Promise.all([promise1, promise2]);

      expect(batchFunction).toHaveBeenCalledTimes(1);
      expect(batchFunction).toHaveBeenCalledWith(['item1', 'item2']);
      expect(results).toEqual(['processed-item1', 'processed-item2']);
    });

    it('should handle batch errors gracefully', async () => {
      const batchFunction = vi.fn().mockRejectedValue(new Error('Batch failed'));

      const promise = optimizer.withBatching('batch3', 'item1', batchFunction);

      await expect(promise).rejects.toThrow('Batch failed');
    });

    it('should handle batching disabled mode', async () => {
      const optimizer = new PerformanceOptimizer({ enableBatching: false });
      const batchFunction = vi.fn().mockImplementation(async (items: string[]) => {
        return items.map(item => `processed-${item}`);
      });

      const result = await optimizer.withBatching('batch4', 'item1', batchFunction);

      expect(result).toBe('processed-item1');
      expect(batchFunction).toHaveBeenCalledWith(['item1']);

      optimizer.cleanup();
    });
  });

  describe('Key generation', () => {
    it('should generate consistent query keys', () => {
      const query = 'test query';
      const options = { temperature: 0.7 };

      const key1 = optimizer.generateQueryKey(query, options);
      const key2 = optimizer.generateQueryKey(query, options);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should generate different keys for different inputs', () => {
      const key1 = optimizer.generateQueryKey('query1');
      const key2 = optimizer.generateQueryKey('query2');

      expect(key1).not.toBe(key2);
    });

    it('should generate consistent document keys', () => {
      const documents: ScoredDocument[] = [
        { id: 'doc1', content: 'content1', metadata: {}, score: 0.9, confidenceScore: 0.85 },
        { id: 'doc2', content: 'content2', metadata: {}, score: 0.8, confidenceScore: 0.75 },
      ];

      const key1 = optimizer.generateDocumentKey(documents);
      const key2 = optimizer.generateDocumentKey(documents);

      expect(key1).toBe(key2);
    });

    it('should handle document order independence', () => {
      const docs1: ScoredDocument[] = [
        { id: 'doc1', content: 'content1', metadata: {}, score: 0.9, confidenceScore: 0.85 },
        { id: 'doc2', content: 'content2', metadata: {}, score: 0.8, confidenceScore: 0.75 },
      ];

      const docs2: ScoredDocument[] = [
        { id: 'doc2', content: 'content2', metadata: {}, score: 0.8, confidenceScore: 0.75 },
        { id: 'doc1', content: 'content1', metadata: {}, score: 0.9, confidenceScore: 0.85 },
      ];

      const key1 = optimizer.generateDocumentKey(docs1);
      const key2 = optimizer.generateDocumentKey(docs2);

      expect(key1).toBe(key2); // Same documents, different order
    });
  });

  describe('Document optimization', () => {
    it('should optimize document retrieval by confidence score', async () => {
      const documents: ScoredDocument[] = [
        { id: 'doc1', content: 'content1', metadata: {}, score: 0.9, confidenceScore: 0.9 },
        { id: 'doc2', content: 'content2', metadata: {}, score: 0.8, confidenceScore: 0.2 },
        { id: 'doc3', content: 'content3', metadata: {}, score: 0.7, confidenceScore: 0.8 },
        { id: 'doc4', content: 'content4', metadata: {}, score: 0.6, confidenceScore: 0.3 },
      ];

      const optimized = await optimizer.optimizeRetrieval(documents, 3);

      expect(optimized).toHaveLength(2); // Only high confidence docs
      expect(optimized[0].id).toBe('doc1');
      expect(optimized[1].id).toBe('doc3');
    });

    it('should respect topK limit', async () => {
      const documents: ScoredDocument[] = Array.from({ length: 10 }, (_, i) => ({
        id: `doc${i}`,
        content: `content${i}`,
        metadata: {},
        score: 0.9 - i * 0.05,
        confidenceScore: 0.9 - i * 0.05,
      }));

      const optimized = await optimizer.optimizeRetrieval(documents, 5);

      expect(optimized).toHaveLength(5);
      expect(optimized[0].id).toBe('doc0');
      expect(optimized[4].id).toBe('doc4');
    });
  });

  describe('Token optimization', () => {
    it('should optimize token confidence by keeping high confidence tokens', () => {
      const tokens: TokenConfidence[] = [
        { token: 'high1', logProb: -0.1, confidence: 0.9 },
        { token: 'low1', logProb: -2.0, confidence: 0.3 },
        { token: 'high2', logProb: -0.2, confidence: 0.85 },
        { token: 'low2', logProb: -1.5, confidence: 0.4 },
      ];

      const optimized = optimizer.optimizeTokenConfidence(tokens, 3);

      expect(optimized).toHaveLength(3);
      // Should include both high confidence tokens
      expect(optimized.filter(t => t.confidence >= 0.8)).toHaveLength(2);
    });

    it('should return all tokens if under max limit', () => {
      const tokens: TokenConfidence[] = [
        { token: 'token1', logProb: -0.5, confidence: 0.6 },
        { token: 'token2', logProb: -0.7, confidence: 0.5 },
      ];

      const optimized = optimizer.optimizeTokenConfidence(tokens, 10);

      expect(optimized).toHaveLength(2);
      expect(optimized).toEqual(tokens);
    });
  });

  describe('Model suggestion', () => {
    it('should suggest appropriate model based on complexity', () => {
      // Simple query
      expect(optimizer.suggestModel(2)).toBe('qwen2.5:0.5b');

      // Medium query
      expect(optimizer.suggestModel(5)).toBe('qwen3:8b');

      // Complex query
      expect(optimizer.suggestModel(9)).toBe('qwen3:14b');
    });

    it('should return default model when model switching is disabled', () => {
      const optimizer = new PerformanceOptimizer({
        enableModelSwitching: false,
      });

      expect(optimizer.suggestModel(2)).toBe('qwen3:8b');
      expect(optimizer.suggestModel(9)).toBe('qwen3:8b');

      optimizer.cleanup();
    });
  });

  describe('Statistics and metrics', () => {
    it('should track cache statistics', async () => {
      const fn1 = vi.fn().mockResolvedValue('result1');
      const fn2 = vi.fn().mockResolvedValue('result2');

      // Generate some cache hits and misses
      await optimizer.withCache('key1', fn1);
      await optimizer.withCache('key1', fn1); // Hit
      await optimizer.withCache('key2', fn2); // Miss

      const stats = await optimizer.getStatistics();

      expect(stats.cache.hits).toBe(1);
      expect(stats.cache.misses).toBe(2);
      expect(stats.cache.hitRate).toBeCloseTo(1/3);
    });

    it('should clear cache and reset metrics', async () => {
      optimizer.clearCache();

      const stats = await optimizer.getStatistics();

      expect(stats.cache.size).toBe(0);
      expect(stats.cache.hits).toBe(0);
      expect(stats.cache.misses).toBe(0);
    });
  });

  describe('Resource monitoring', () => {
    it('should get resource metrics', async () => {
      const metrics = await optimizer.getResourceMetrics();

      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('activeRequests');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('averageLatency');

      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeLessThanOrEqual(1);
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeLessThanOrEqual(1);
    });
  });
});