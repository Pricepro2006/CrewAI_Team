/**
 * Performance and Integration Tests for OptimizedCacheService
 * Validates LRU eviction, TTL management, deduplication, and memory efficiency
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OptimizedCacheService, CacheFactory } from '../../src/api/services/OptimizedCacheService';
import { performance } from 'perf_hooks';

describe('OptimizedCacheService - Performance Tests', () => {
  let cache: OptimizedCacheService<any>;

  beforeEach(() => {
    cache = new OptimizedCacheService({
      max: 100,
      maxSize: 1024 * 1024, // 1MB
      ttl: 60000, // 1 minute
    });
  });

  afterEach(() => {
    cache.dispose();
    CacheFactory.disposeAll();
  });

  describe('Cache Eviction', () => {
    test('should evict LRU items when max count reached', async () => {
      const cache = new OptimizedCacheService({ max: 5, ttl: 60000 });
      
      // Fill cache to max
      for (let i = 0; i < 5; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      // Access some items to update LRU order
      await cache.get('key0'); // Most recently used
      await cache.get('key2');

      // Add new item, should evict least recently used
      await cache.set('key5', 'value5');

      // key1 should be evicted (least recently used)
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key0')).toBe('value0'); // Should still exist
      expect(await cache.get('key5')).toBe('value5'); // New item exists
    });

    test('should evict items when max size reached', async () => {
      const cache = new OptimizedCacheService({ 
        max: 1000,
        maxSize: 1024, // 1KB
        ttl: 60000 
      });

      const largeValue = 'x'.repeat(500); // ~500 bytes
      
      // Add items until size limit reached
      await cache.set('item1', largeValue);
      await cache.set('item2', largeValue);
      
      // Should trigger eviction based on size
      await cache.set('item3', largeValue);

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      
      // Total size should not exceed maxSize
      const memUsage = cache.getMemoryUsage();
      expect(memUsage.used).toBeLessThanOrEqual(memUsage.max);
    });

    test('should respect TTL and evict expired items', async () => {
      jest.useFakeTimers();
      
      const cache = new OptimizedCacheService({ 
        max: 100,
        ttl: 1000 // 1 second
      });

      await cache.set('short-lived', 'value1', 500); // 500ms TTL
      await cache.set('long-lived', 'value2', 5000); // 5s TTL

      // Advance time by 1 second
      jest.advanceTimersByTime(1000);

      // Short-lived should be expired
      expect(await cache.get('short-lived')).toBeUndefined();
      expect(await cache.get('long-lived')).toBe('value2');

      jest.useRealTimers();
    });

    test('should reduce TTL for frequently accessed items', async () => {
      const cache = new OptimizedCacheService({ 
        max: 100,
        ttl: 60000 
      });

      await cache.set('popular', 'value');

      // Access item multiple times
      for (let i = 0; i < 15; i++) {
        await cache.get('popular');
      }

      // Check that item has increased access count
      const entry = (cache as any).cache.get('popular');
      expect(entry.accessCount).toBeGreaterThan(10);

      // TTL should be reduced for frequently accessed items
      const ttl = (cache as any).cache.ttl(entry);
      expect(ttl).toBeLessThan(60000);
    });
  });

  describe('Request Deduplication', () => {
    test('should deduplicate concurrent fetches for same key', async () => {
      let fetchCount = 0;
      const fetcher = jest.fn(async () => {
        fetchCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return `fetched-${fetchCount}`;
      });

      // Trigger multiple concurrent fetches
      const promises = [
        cache.get('key1', fetcher),
        cache.get('key1', fetcher),
        cache.get('key1', fetcher),
        cache.get('key1', fetcher),
      ];

      const results = await Promise.all(promises);

      // All should get same result
      expect(results.every(r => r === 'fetched-1')).toBe(true);
      
      // Fetcher should only be called once
      expect(fetchCount).toBe(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('should handle fetch failures gracefully', async () => {
      const error = new Error('Fetch failed');
      const fetcher = jest.fn(async () => {
        throw error;
      });

      // Multiple concurrent fetches
      const promises = [
        cache.get('error-key', fetcher).catch(e => e),
        cache.get('error-key', fetcher).catch(e => e),
        cache.get('error-key', fetcher).catch(e => e),
      ];

      const results = await Promise.all(promises);

      // All should get same error
      expect(results.every(r => r === error)).toBe(true);
      
      // Fetcher called only once despite multiple requests
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('should clear pending fetches after completion', async () => {
      const fetcher = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'value';
      };

      await cache.get('key', fetcher);

      // Pending fetches should be cleared
      expect((cache as any).pendingFetches.size).toBe(0);
    });
  });

  describe('Memory Management', () => {
    test('should accurately calculate entry sizes', async () => {
      const testData = [
        { key: 'small', value: 'test', expectedMin: 4 },
        { key: 'medium', value: { data: 'x'.repeat(100) }, expectedMin: 100 },
        { key: 'large', value: { array: new Array(1000).fill('x') }, expectedMin: 1000 },
      ];

      for (const { key, value, expectedMin } of testData) {
        await cache.set(key, value);
        const entry = (cache as any).cache.get(key);
        expect(entry.size).toBeGreaterThan(expectedMin);
      }
    });

    test('should respect maxSize memory limit', async () => {
      const cache = new OptimizedCacheService({ 
        max: 10000,
        maxSize: 10 * 1024, // 10KB
        ttl: 60000 
      });

      const value = 'x'.repeat(1024); // 1KB each
      
      // Try to add more than maxSize allows
      for (let i = 0; i < 20; i++) {
        await cache.set(`key${i}`, value);
      }

      const memUsage = cache.getMemoryUsage();
      expect(memUsage.used).toBeLessThanOrEqual(memUsage.max);
      
      // Should have evicted some items
      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    test('should clean up properly on dispose', async () => {
      const cache = new OptimizedCacheService({ max: 100 });
      
      // Add some data
      for (let i = 0; i < 10; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      // Set up pending fetch
      const fetcher = () => new Promise(resolve => setTimeout(() => resolve('value'), 1000));
      cache.get('pending', fetcher);

      // Dispose
      cache.dispose();

      // Verify cleanup
      expect((cache as any).isDisposed).toBe(true);
      expect((cache as any).cache.size).toBe(0);
      expect((cache as any).pendingFetches.size).toBe(0);
      expect((cache as any).statsReportInterval).toBeUndefined();
    });
  });

  describe('Batch Operations', () => {
    test('should efficiently handle batch get operations', async () => {
      // Populate cache
      for (let i = 0; i < 50; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      const keys = Array.from({ length: 50 }, (_, i) => `key${i}`);
      
      const startTime = performance.now();
      const results = await cache.getBatch(keys);
      const duration = performance.now() - startTime;

      // Should be fast (< 10ms for 50 items)
      expect(duration).toBeLessThan(10);

      // Verify all results
      expect(results.size).toBe(50);
      for (let i = 0; i < 50; i++) {
        expect(results.get(`key${i}`)).toBe(`value${i}`);
      }
    });

    test('should efficiently handle batch set operations', async () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        key: `key${i}`,
        value: { data: `value${i}`, index: i },
        ttl: 60000,
      }));

      const startTime = performance.now();
      await cache.setBatch(entries);
      const duration = performance.now() - startTime;

      // Should be fast (< 20ms for 100 items)
      expect(duration).toBeLessThan(20);

      // Verify all items cached
      for (let i = 0; i < 100; i++) {
        const value = await cache.get(`key${i}`);
        expect(value?.data).toBe(`value${i}`);
      }
    });
  });

  describe('Performance Metrics', () => {
    test('should track hit rate accurately', async () => {
      // Set up cache with known items
      for (let i = 0; i < 10; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      // Generate hits and misses
      for (let i = 0; i < 20; i++) {
        if (i < 10) {
          await cache.get(`key${i}`); // Hit
        } else {
          await cache.get(`missing${i}`); // Miss
        }
      }

      const stats = cache.getStats();
      expect(stats.hits).toBe(10);
      expect(stats.misses).toBe(10);
      expect(stats.hitRate).toBe(50);
    });

    test('should track response times with percentiles', async () => {
      // Generate variety of response times
      for (let i = 0; i < 100; i++) {
        await cache.set(`key${i}`, `value${i}`);
        await cache.get(`key${i}`);
      }

      const memUsage = cache.getMemoryUsage();
      expect(memUsage.percentage).toBeGreaterThan(0);
      expect(memUsage.percentage).toBeLessThanOrEqual(100);

      const stats = cache.getStats();
      expect(stats.avgResponseTime).toBeGreaterThan(0);
      expect(stats.avgResponseTime).toBeLessThan(10); // Should be very fast
    });

    test('should emit events for cache operations', async () => {
      const events = {
        hit: jest.fn(),
        set: jest.fn(),
        eviction: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
      };

      // Subscribe to events
      Object.entries(events).forEach(([event, handler]) => {
        cache.on(event, handler);
      });

      // Trigger various operations
      await cache.set('key1', 'value1');
      await cache.get('key1');
      cache.delete('key1');
      
      // Fill cache to trigger eviction
      const smallCache = new OptimizedCacheService({ max: 2 });
      smallCache.on('eviction', events.eviction);
      await smallCache.set('a', '1');
      await smallCache.set('b', '2');
      await smallCache.set('c', '3'); // Should evict 'a'

      cache.clear();

      // Verify events were emitted
      expect(events.set).toHaveBeenCalled();
      expect(events.hit).toHaveBeenCalled();
      expect(events.delete).toHaveBeenCalled();
      expect(events.eviction).toHaveBeenCalled();
      expect(events.clear).toHaveBeenCalled();

      smallCache.dispose();
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache efficiently', async () => {
      const entries = Array.from({ length: 50 }, (_, i) => ({
        key: `warm${i}`,
        value: { data: `value${i}` },
        ttl: 60000,
      }));

      await cache.warm(entries);

      // Verify all entries cached
      for (let i = 0; i < 50; i++) {
        const value = await cache.get(`warm${i}`);
        expect(value?.data).toBe(`value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.sets).toBeGreaterThanOrEqual(50);
    });

    test('should prune stale entries', async () => {
      jest.useFakeTimers();

      // Add items with short TTL
      for (let i = 0; i < 10; i++) {
        await cache.set(`stale${i}`, `value${i}`, 1000);
      }

      // Advance time past TTL
      jest.advanceTimersByTime(2000);

      // Prune stale entries
      const pruned = cache.prune();
      expect(pruned).toBeGreaterThan(0);

      // Verify items removed
      for (let i = 0; i < 10; i++) {
        expect(await cache.get(`stale${i}`)).toBeUndefined();
      }

      jest.useRealTimers();
    });
  });

  describe('CacheFactory', () => {
    test('should create and manage multiple cache instances', () => {
      const cache1 = CacheFactory.create('cache1', { max: 100 });
      const cache2 = CacheFactory.create('cache2', { max: 200 });

      expect(CacheFactory.get('cache1')).toBe(cache1);
      expect(CacheFactory.get('cache2')).toBe(cache2);

      // Should return existing instance
      const cache1Again = CacheFactory.create('cache1', { max: 500 });
      expect(cache1Again).toBe(cache1);
    });

    test('should collect stats from all caches', async () => {
      const cache1 = CacheFactory.create('stats1', { max: 100 });
      const cache2 = CacheFactory.create('stats2', { max: 100 });

      await cache1.set('key1', 'value1');
      await cache2.set('key2', 'value2');
      await cache1.get('key1');
      await cache2.get('missing');

      const allStats = CacheFactory.getStats();
      
      expect(allStats.has('stats1')).toBe(true);
      expect(allStats.has('stats2')).toBe(true);
      
      const stats1 = allStats.get('stats1');
      expect(stats1?.hits).toBe(1);
      expect(stats1?.sets).toBe(1);

      const stats2 = allStats.get('stats2');
      expect(stats2?.misses).toBe(1);
      expect(stats2?.sets).toBe(1);
    });

    test('should dispose all caches', () => {
      CacheFactory.create('dispose1', { max: 100 });
      CacheFactory.create('dispose2', { max: 100 });

      CacheFactory.disposeAll();

      expect(CacheFactory.get('dispose1')).toBeUndefined();
      expect(CacheFactory.get('dispose2')).toBeUndefined();
    });
  });
});

describe('OptimizedCacheService - Stress Tests', () => {
  test('should handle high concurrency without degradation', async () => {
    const cache = new OptimizedCacheService({ 
      max: 1000,
      maxSize: 10 * 1024 * 1024, // 10MB
      ttl: 60000 
    });

    const concurrentOps = 1000;
    const operations: Promise<any>[] = [];

    for (let i = 0; i < concurrentOps; i++) {
      // Mix of operations
      if (i % 3 === 0) {
        operations.push(cache.set(`key${i}`, `value${i}`));
      } else if (i % 3 === 1) {
        operations.push(cache.get(`key${i - 1}`));
      } else {
        operations.push(cache.delete(`key${i - 2}`));
      }
    }

    const startTime = performance.now();
    await Promise.all(operations);
    const duration = performance.now() - startTime;

    // Should complete within reasonable time
    expect(duration).toBeLessThan(1000); // 1 second for 1000 ops

    const stats = cache.getStats();
    expect(stats.sets + stats.hits + stats.misses + stats.deletes).toBeGreaterThanOrEqual(concurrentOps);

    cache.dispose();
  });

  test('should maintain performance with cache churn', async () => {
    const cache = new OptimizedCacheService({ 
      max: 100, // Small cache to force evictions
      maxSize: 1024 * 1024,
      ttl: 60000 
    });

    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      await cache.set(`key${i}`, `value${i}`.repeat(100));
      
      // Access random previous items
      if (i > 10) {
        const randomKey = `key${Math.floor(Math.random() * i)}`;
        await cache.get(randomKey);
      }
    }

    const duration = performance.now() - startTime;
    const opsPerSecond = (iterations * 2) / (duration / 1000);

    // Should maintain good throughput despite evictions
    expect(opsPerSecond).toBeGreaterThan(1000);

    const stats = cache.getStats();
    expect(stats.evictions).toBeGreaterThan(iterations - 100); // Most items evicted

    cache.dispose();
  });

  test('should handle memory pressure gracefully', async () => {
    const cache = new OptimizedCacheService({ 
      max: 10000,
      maxSize: 5 * 1024 * 1024, // 5MB limit
      ttl: 60000 
    });

    const largeObject = { data: 'x'.repeat(10000) }; // ~10KB each
    const itemCount = 1000; // Would be 10MB total

    for (let i = 0; i < itemCount; i++) {
      await cache.set(`large${i}`, { ...largeObject, id: i });
    }

    const memUsage = cache.getMemoryUsage();
    
    // Should stay within limit
    expect(memUsage.used).toBeLessThanOrEqual(memUsage.max);
    expect(memUsage.percentage).toBeLessThanOrEqual(100);

    // Should have evicted items to stay under limit
    const stats = cache.getStats();
    expect(stats.evictions).toBeGreaterThan(0);
    expect(stats.itemCount).toBeLessThan(itemCount);

    cache.dispose();
  });
});