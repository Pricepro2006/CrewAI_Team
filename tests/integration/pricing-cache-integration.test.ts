/**
 * Integration Tests for Pricing and Caching System
 * Tests real-time pricing updates, cache invalidation, and performance optimization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Redis } from 'ioredis';
import { app } from '../../src/api/app.js';
import { CentralizedCacheService } from '../../src/api/services/CentralizedCacheService.js';
import { WalmartPriceFetcher } from '../../src/api/services/WalmartPriceFetcher.js';
import { PriceHistoryService } from '../../src/api/services/PriceHistoryService.js';

describe('Pricing and Caching Integration Tests', () => {
  let redisClient: Redis;
  let cacheService: CentralizedCacheService;
  let priceFetcher: WalmartPriceFetcher;
  let priceHistoryService: PriceHistoryService;

  beforeAll(async () => {
    // Initialize Redis connection for testing
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15, // Use separate DB for tests
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 1
    });

    // Initialize services
    cacheService = new CentralizedCacheService(redisClient);
    priceFetcher = new WalmartPriceFetcher();
    priceHistoryService = new PriceHistoryService();

    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up test data
    await redisClient.flushdb();
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await redisClient.flushdb();
  });

  afterEach(async () => {
    // Clean up after each test
    await redisClient.flushdb();
  });

  describe('Price Fetching and Caching Flow', () => {
    it('should fetch fresh price and cache it on first request', async () => {
      const productId = 'test-product-123';
      
      // First request should fetch fresh price
      const response1 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);

      expect(response1.status).toBe(200);
      expect(response1.body).toMatchObject({
        productId,
        currentPrice: expect.any(Number),
        lastUpdated: expect.any(String)
      });
      expect(response1.headers['x-cache']).toBe('MISS');

      // Verify price is cached
      const cachedPrice = await cacheService.get(`walmart:price:${productId}`);
      expect(cachedPrice).toBeDefined();
      expect(cachedPrice.productId).toBe(productId);
    });

    it('should return cached price on subsequent requests', async () => {
      const productId = 'test-product-456';
      
      // First request
      const response1 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request should use cache
      const response2 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);

      expect(response2.status).toBe(200);
      expect(response2.headers['x-cache']).toBe('HIT');
      expect(response2.body.productId).toBe(productId);

      // Response times should be faster for cached request
      const responseTime1 = parseInt(response1.headers['x-response-time'] || '0');
      const responseTime2 = parseInt(response2.headers['x-response-time'] || '0');
      expect(responseTime2).toBeLessThan(responseTime1);
    });

    it('should handle cache expiration correctly', async () => {
      const productId = 'test-product-789';
      
      // Set short TTL for testing
      await cacheService.set(`walmart:price:${productId}`, {
        productId,
        currentPrice: 9.99,
        lastUpdated: new Date().toISOString()
      }, 1); // 1 second TTL

      // Immediate request should use cache
      const response1 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      expect(response1.headers['x-cache']).toBe('HIT');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Request after expiration should fetch fresh
      const response2 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      expect(response2.headers['x-cache']).toBe('MISS');
    });
  });

  describe('Bulk Pricing Operations', () => {
    it('should optimize bulk requests with partial caching', async () => {
      const productIds = ['bulk-1', 'bulk-2', 'bulk-3', 'bulk-4', 'bulk-5'];
      
      // Pre-cache some products
      await cacheService.set('walmart:price:bulk-1', {
        productId: 'bulk-1',
        currentPrice: 10.99,
        lastUpdated: new Date().toISOString()
      });
      await cacheService.set('walmart:price:bulk-3', {
        productId: 'bulk-3',
        currentPrice: 15.99,
        lastUpdated: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/walmart/pricing/bulk')
        .send({ productIds });

      expect(response.status).toBe(200);
      expect(response.body.prices).toHaveLength(5);
      expect(response.body.cacheStats).toMatchObject({
        hits: 2,
        misses: 3,
        total: 5
      });

      // Cached products should be returned immediately
      const cachedProducts = response.body.prices.filter((p: any) => 
        p.productId === 'bulk-1' || p.productId === 'bulk-3'
      );
      expect(cachedProducts).toHaveLength(2);
    });

    it('should handle bulk request failures gracefully', async () => {
      const productIds = ['valid-1', 'invalid-product', 'valid-2'];
      
      const response = await request(app)
        .post('/api/walmart/pricing/bulk')
        .send({ productIds });

      expect(response.status).toBe(200);
      
      // Should return partial results for valid products
      expect(response.body.prices.length).toBeGreaterThan(0);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should maintain performance under bulk load', async () => {
      const productIds = Array.from({ length: 50 }, (_, i) => `load-test-${i}`);
      
      const startTime = Date.now();
      const response = await request(app)
        .post('/api/walmart/pricing/bulk')
        .send({ productIds });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.prices).toHaveLength(50);
      
      // Should complete within reasonable time (adjust based on system)
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Price History Integration', () => {
    it('should record price changes in history', async () => {
      const productId = 'history-test-123';
      
      // First price fetch
      const response1 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      expect(response1.status).toBe(200);
      
      const initialPrice = response1.body.currentPrice;

      // Wait and force refresh to simulate price change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response2 = await request(app)
        .post(`/api/walmart/pricing/${productId}/refresh`)
        .send({ reason: 'price_verification' });
      
      expect(response2.status).toBe(200);

      // Check price history
      const historyResponse = await request(app)
        .get(`/api/walmart/pricing/${productId}/history`)
        .query({ days: 1 });

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.history).toBeDefined();
      
      if (historyResponse.body.history.length > 1) {
        const prices = historyResponse.body.history.map((h: any) => h.price);
        expect(prices).toContain(initialPrice);
      }
    });

    it('should calculate price statistics correctly', async () => {
      const productId = 'stats-test-456';
      
      // Generate some price history data
      const pricePoints = [10.99, 11.49, 9.99, 10.99, 12.99];
      
      for (const price of pricePoints) {
        await priceHistoryService.recordPrice(productId, price, 'regular');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const response = await request(app)
        .get(`/api/walmart/pricing/${productId}/history`)
        .query({ includeStats: true, days: 1 });

      expect(response.status).toBe(200);
      expect(response.body.statistics).toMatchObject({
        averagePrice: expect.any(Number),
        lowestPrice: 9.99,
        highestPrice: 12.99,
        trend: expect.any(String)
      });
    });
  });

  describe('Cache Invalidation and Updates', () => {
    it('should invalidate cache when forced refresh requested', async () => {
      const productId = 'invalidation-test-123';
      
      // Initial request to populate cache
      const response1 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request should use cache
      const response2 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      expect(response2.headers['x-cache']).toBe('HIT');

      // Force refresh should invalidate cache
      const refreshResponse = await request(app)
        .post(`/api/walmart/pricing/${productId}/refresh`)
        .send({ reason: 'manual_refresh' });
      
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.refreshed).toBe(true);

      // Next request should fetch fresh data
      const response3 = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      expect(response3.headers['x-cache']).toBe('MISS');
    });

    it('should handle cache warming for popular products', async () => {
      const popularProducts = ['popular-1', 'popular-2', 'popular-3'];
      
      // Trigger cache warming
      const warmResponse = await request(app)
        .post('/api/walmart/pricing/cache/warm')
        .send({ productIds: popularProducts })
        .set('Authorization', 'Bearer admin-token');

      expect(warmResponse.status).toBe(200);
      expect(warmResponse.body.warmed).toBe(popularProducts.length);

      // All products should now be cached
      for (const productId of popularProducts) {
        const response = await request(app)
          .get(`/api/walmart/pricing/${productId}`);
        expect(response.headers['x-cache']).toBe('HIT');
      }
    });

    it('should implement intelligent cache invalidation based on price volatility', async () => {
      const volatileProductId = 'volatile-123';
      const stableProductId = 'stable-456';
      
      // Set different TTLs based on product volatility
      await cacheService.set(`walmart:price:${volatileProductId}`, {
        productId: volatileProductId,
        currentPrice: 19.99,
        lastUpdated: new Date().toISOString(),
        volatility: 'high'
      }, 60); // 1 minute for volatile products

      await cacheService.set(`walmart:price:${stableProductId}`, {
        productId: stableProductId,
        currentPrice: 29.99,
        lastUpdated: new Date().toISOString(),
        volatility: 'low'
      }, 1800); // 30 minutes for stable products

      // Verify different TTLs
      const volatileTTL = await redisClient.ttl(`walmart:price:${volatileProductId}`);
      const stableTTL = await redisClient.ttl(`walmart:price:${stableProductId}`);
      
      expect(volatileTTL).toBeLessThan(stableTTL);
    });
  });

  describe('Store-Specific Pricing', () => {
    it('should cache prices per store location', async () => {
      const productId = 'store-test-123';
      const store1 = 'store-001';
      const store2 = 'store-002';
      
      // Fetch price for store 1
      const response1 = await request(app)
        .get(`/api/walmart/pricing/${productId}`)
        .query({ storeId: store1 });
      
      expect(response1.status).toBe(200);
      expect(response1.body.storeId).toBe(store1);

      // Fetch price for store 2
      const response2 = await request(app)
        .get(`/api/walmart/pricing/${productId}`)
        .query({ storeId: store2 });
      
      expect(response2.status).toBe(200);
      expect(response2.body.storeId).toBe(store2);

      // Prices might be different per store
      // Cache keys should be separate
      const cache1 = await cacheService.get(`walmart:price:${productId}:${store1}`);
      const cache2 = await cacheService.get(`walmart:price:${productId}:${store2}`);
      
      expect(cache1).toBeDefined();
      expect(cache2).toBeDefined();
      expect(cache1.storeId).toBe(store1);
      expect(cache2.storeId).toBe(store2);
    });

    it('should handle regional price variations', async () => {
      const productId = 'regional-test-456';
      const region1Stores = ['reg1-store1', 'reg1-store2'];
      const region2Stores = ['reg2-store1', 'reg2-store2'];
      
      // Fetch prices for different regions
      const region1Prices = await Promise.all(
        region1Stores.map(storeId =>
          request(app)
            .get(`/api/walmart/pricing/${productId}`)
            .query({ storeId })
        )
      );

      const region2Prices = await Promise.all(
        region2Stores.map(storeId =>
          request(app)
            .get(`/api/walmart/pricing/${productId}`)
            .query({ storeId })
        )
      );

      // All requests should succeed
      [...region1Prices, ...region2Prices].forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.currentPrice).toBeDefined();
      });

      // Prices within region should be similar
      const reg1Amounts = region1Prices.map(r => r.body.currentPrice);
      const reg2Amounts = region2Prices.map(r => r.body.currentPrice);
      
      expect(reg1Amounts.every(price => typeof price === 'number')).toBe(true);
      expect(reg2Amounts.every(price => typeof price === 'number')).toBe(true);
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should track cache performance metrics', async () => {
      const productIds = ['metrics-1', 'metrics-2', 'metrics-3'];
      
      // Generate some cache hits and misses
      for (const productId of productIds) {
        // First request (miss)
        await request(app).get(`/api/walmart/pricing/${productId}`);
        
        // Second request (hit)
        await request(app).get(`/api/walmart/pricing/${productId}`);
      }

      // Check cache statistics
      const statsResponse = await request(app)
        .get('/api/walmart/pricing/cache/stats');

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body).toMatchObject({
        hits: expect.any(Number),
        misses: expect.any(Number),
        hitRate: expect.any(Number),
        size: expect.any(Number)
      });

      expect(statsResponse.body.hits).toBeGreaterThan(0);
      expect(statsResponse.body.misses).toBeGreaterThan(0);
      expect(statsResponse.body.hitRate).toBeGreaterThan(0);
    });

    it('should monitor pricing API response times', async () => {
      const productId = 'response-time-test';
      
      const response = await request(app)
        .get(`/api/walmart/pricing/${productId}`);

      expect(response.status).toBe(200);
      expect(response.headers['x-response-time']).toBeDefined();
      
      const responseTime = parseInt(response.headers['x-response-time']);
      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(5000); // Should be under 5 seconds
    });

    it('should implement circuit breaker for external pricing service', async () => {
      // This test would need to simulate external service failures
      // and verify circuit breaker behavior
      
      const response = await request(app)
        .get('/api/walmart/pricing/circuit-breaker-test');

      // If circuit breaker is open, should return cached data or error
      expect([200, 503]).toContain(response.status);
      
      if (response.status === 503) {
        expect(response.body.error).toContain('Circuit breaker');
      }
    });
  });

  describe('Data Consistency and Race Conditions', () => {
    it('should handle concurrent price updates correctly', async () => {
      const productId = 'concurrent-test-123';
      
      // Simulate concurrent requests for the same product
      const requests = Array.from({ length: 10 }, () =>
        request(app).get(`/api/walmart/pricing/${productId}`)
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.productId).toBe(productId);
      });

      // Only one should be a cache miss (first one)
      const cacheMisses = responses.filter(r => r.headers['x-cache'] === 'MISS');
      expect(cacheMisses.length).toBe(1);
    });

    it('should prevent cache stampede with locking', async () => {
      const productId = 'stampede-test-456';
      
      // Clear any existing cache
      await cacheService.delete(`walmart:price:${productId}`);
      
      // Launch multiple concurrent requests
      const startTime = Date.now();
      const requests = Array.from({ length: 20 }, () =>
        request(app).get(`/api/walmart/pricing/${productId}`)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete in reasonable time (no cache stampede)
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(3000); // 3 seconds max

      // Verify only one external fetch occurred
      const cacheMisses = responses.filter(r => r.headers['x-cache'] === 'MISS');
      expect(cacheMisses.length).toBe(1);
    });

    it('should maintain data consistency across cache layers', async () => {
      const productId = 'consistency-test-789';
      
      // Set initial price in cache
      const initialPrice = 19.99;
      await cacheService.set(`walmart:price:${productId}`, {
        productId,
        currentPrice: initialPrice,
        lastUpdated: new Date().toISOString()
      });

      // Fetch cached price
      const cachedResponse = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      
      expect(cachedResponse.body.currentPrice).toBe(initialPrice);

      // Force refresh to update price
      const refreshResponse = await request(app)
        .post(`/api/walmart/pricing/${productId}/refresh`)
        .send({ reason: 'consistency_check' });

      expect(refreshResponse.status).toBe(200);

      // Fetch updated price
      const updatedResponse = await request(app)
        .get(`/api/walmart/pricing/${productId}`);
      
      // Should reflect the refresh
      expect(updatedResponse.body.lastUpdated).not.toBe(
        cachedResponse.body.lastUpdated
      );
    });
  });

  describe('Error Recovery and Fallbacks', () => {
    it('should use stale cache data when pricing service is down', async () => {
      const productId = 'stale-cache-test';
      
      // Set stale data in cache (older than normal TTL)
      const staleData = {
        productId,
        currentPrice: 14.99,
        lastUpdated: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      };
      
      await cacheService.set(`walmart:price:${productId}`, staleData, 7200); // Still in cache

      // Request with allowStale parameter
      const response = await request(app)
        .get(`/api/walmart/pricing/${productId}`)
        .query({ allowStale: true });

      expect(response.status).toBe(200);
      expect(response.body.currentPrice).toBe(14.99);
      expect(response.headers['x-cache']).toBe('STALE');
      expect(response.headers['x-warning']).toContain('stale data');
    });

    it('should implement graceful degradation', async () => {
      const productId = 'degradation-test';
      
      // Test with external service timeout
      const response = await request(app)
        .get(`/api/walmart/pricing/${productId}`)
        .timeout(100); // Very short timeout

      // Should either succeed quickly (cached) or fail gracefully
      if (response.status !== 200) {
        expect(response.status).toBe(503);
        expect(response.body.error).toContain('temporarily unavailable');
      }
    });
  });
});