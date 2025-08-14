/**
 * Unit Tests for Pricing API with Caching
 * Tests real-time pricing, price history, cache invalidation, and performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/api/app.js';
import { WalmartPriceFetcher } from '../../../src/api/services/WalmartPriceFetcher.js';
import { CentralizedCacheService } from '../../../src/api/services/CentralizedCacheService.js';
import { PriceHistoryService } from '../../../src/api/services/PriceHistoryService.js';

// Mock services
vi.mock('../../../src/api/services/WalmartPriceFetcher.js');
vi.mock('../../../src/api/services/CentralizedCacheService.js');
vi.mock('../../../src/api/services/PriceHistoryService.js');

describe('Pricing API with Caching', () => {
  let mockPriceFetcher: any;
  let mockCacheService: any;
  let mockPriceHistoryService: any;

  const mockPriceData = {
    productId: 'prod-123',
    currentPrice: 4.99,
    regularPrice: 5.49,
    salePrice: 4.99,
    currency: 'USD',
    inStock: true,
    storeId: 'store-456',
    lastUpdated: new Date('2024-01-01T12:00:00Z'),
    priceHistory: [
      { price: 5.49, date: new Date('2023-12-01'), type: 'regular' },
      { price: 4.99, date: new Date('2024-01-01'), type: 'sale' }
    ]
  };

  beforeEach(() => {
    mockPriceFetcher = {
      fetchPrice: vi.fn(),
      fetchBulkPrices: vi.fn(),
      checkStockStatus: vi.fn(),
      getStoreLocations: vi.fn()
    };

    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      getStats: vi.fn().mockReturnValue({ hits: 0, misses: 0, hitRate: 0 })
    };

    mockPriceHistoryService = {
      recordPrice: vi.fn(),
      getPriceHistory: vi.fn(),
      getAveragePrice: vi.fn(),
      getPriceTrends: vi.fn()
    };

    (WalmartPriceFetcher as any).mockImplementation(() => mockPriceFetcher);
    (CentralizedCacheService as any).mockImplementation(() => mockCacheService);
    (PriceHistoryService as any).mockImplementation(() => mockPriceHistoryService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/walmart/pricing/:productId', () => {
    it('should return cached price when available', async () => {
      mockCacheService.get.mockResolvedValue(mockPriceData);

      const response = await request(app)
        .get('/api/walmart/pricing/prod-123');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        productId: 'prod-123',
        currentPrice: 4.99,
        regularPrice: 5.49
      });
      expect(response.headers['x-cache']).toBe('HIT');
      expect(mockPriceFetcher.fetchPrice).not.toHaveBeenCalled();
    });

    it('should fetch fresh price when cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPriceFetcher.fetchPrice.mockResolvedValue(mockPriceData);
      mockCacheService.set.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/walmart/pricing/prod-123');

      expect(response.status).toBe(200);
      expect(response.body.currentPrice).toBe(4.99);
      expect(response.headers['x-cache']).toBe('MISS');
      expect(mockPriceFetcher.fetchPrice).toHaveBeenCalledWith('prod-123', undefined);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should include store-specific pricing', async () => {
      const storeSpecificPrice = { ...mockPriceData, storeId: 'store-789', currentPrice: 4.79 };
      mockCacheService.get.mockResolvedValue(null);
      mockPriceFetcher.fetchPrice.mockResolvedValue(storeSpecificPrice);

      const response = await request(app)
        .get('/api/walmart/pricing/prod-123')
        .query({ storeId: 'store-789' });

      expect(response.status).toBe(200);
      expect(response.body.currentPrice).toBe(4.79);
      expect(response.body.storeId).toBe('store-789');
      expect(mockPriceFetcher.fetchPrice).toHaveBeenCalledWith('prod-123', 'store-789');
    });

    it('should handle pricing errors gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPriceFetcher.fetchPrice.mockRejectedValue(new Error('Pricing service unavailable'));

      const response = await request(app)
        .get('/api/walmart/pricing/prod-123');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Pricing service temporarily unavailable');
    });

    it('should validate product ID format', async () => {
      const response = await request(app)
        .get('/api/walmart/pricing/invalid-id-format');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid product ID format');
    });
  });

  describe('POST /api/walmart/pricing/bulk', () => {
    it('should fetch bulk pricing with cache optimization', async () => {
      const productIds = ['prod-1', 'prod-2', 'prod-3'];
      const cachedPrices = new Map([['prod-1', { ...mockPriceData, productId: 'prod-1' }]]);
      const freshPrices = [
        { ...mockPriceData, productId: 'prod-2' },
        { ...mockPriceData, productId: 'prod-3' }
      ];

      mockCacheService.get.mockImplementation((key: string) => 
        cachedPrices.get(key.split(':')[1]) || null
      );
      mockPriceFetcher.fetchBulkPrices.mockResolvedValue(freshPrices);

      const response = await request(app)
        .post('/api/walmart/pricing/bulk')
        .send({ productIds });

      expect(response.status).toBe(200);
      expect(response.body.prices).toHaveLength(3);
      expect(response.body.cacheStats).toMatchObject({
        hits: 1,
        misses: 2,
        total: 3
      });
      
      // Should only fetch uncached products
      expect(mockPriceFetcher.fetchBulkPrices).toHaveBeenCalledWith(['prod-2', 'prod-3'], undefined);
    });

    it('should handle empty product list', async () => {
      const response = await request(app)
        .post('/api/walmart/pricing/bulk')
        .send({ productIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Product IDs array cannot be empty');
    });

    it('should limit bulk request size', async () => {
      const productIds = Array.from({ length: 101 }, (_, i) => `prod-${i}`);

      const response = await request(app)
        .post('/api/walmart/pricing/bulk')
        .send({ productIds });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Maximum 100 products per bulk request');
    });
  });

  describe('GET /api/walmart/pricing/:productId/history', () => {
    it('should return price history', async () => {
      const priceHistory = [
        { price: 5.49, date: new Date('2023-12-01'), type: 'regular' },
        { price: 4.99, date: new Date('2024-01-01'), type: 'sale' },
        { price: 5.49, date: new Date('2024-01-15'), type: 'regular' }
      ];

      mockPriceHistoryService.getPriceHistory.mockResolvedValue(priceHistory);

      const response = await request(app)
        .get('/api/walmart/pricing/prod-123/history')
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.history).toHaveLength(3);
      expect(response.body.history[0].price).toBe(5.49);
      expect(mockPriceHistoryService.getPriceHistory).toHaveBeenCalledWith('prod-123', { days: 30 });
    });

    it('should include price statistics', async () => {
      mockPriceHistoryService.getPriceHistory.mockResolvedValue(mockPriceData.priceHistory);
      mockPriceHistoryService.getAveragePrice.mockResolvedValue(5.24);
      mockPriceHistoryService.getPriceTrends.mockResolvedValue({
        trend: 'decreasing',
        changePercent: -9.1,
        lowestPrice: 4.99,
        highestPrice: 5.49
      });

      const response = await request(app)
        .get('/api/walmart/pricing/prod-123/history')
        .query({ includeStats: true });

      expect(response.status).toBe(200);
      expect(response.body.statistics).toMatchObject({
        averagePrice: 5.24,
        trend: 'decreasing',
        changePercent: -9.1,
        lowestPrice: 4.99,
        highestPrice: 5.49
      });
    });
  });

  describe('POST /api/walmart/pricing/:productId/refresh', () => {
    it('should force refresh cached price', async () => {
      mockPriceFetcher.fetchPrice.mockResolvedValue({
        ...mockPriceData,
        currentPrice: 3.99, // New price
        lastUpdated: new Date()
      });
      mockCacheService.delete.mockResolvedValue(true);
      mockCacheService.set.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/walmart/pricing/prod-123/refresh');

      expect(response.status).toBe(200);
      expect(response.body.currentPrice).toBe(3.99);
      expect(response.body.refreshed).toBe(true);
      expect(mockCacheService.delete).toHaveBeenCalled();
    });

    it('should require valid reason for refresh', async () => {
      const response = await request(app)
        .post('/api/walmart/pricing/prod-123/refresh')
        .send({ reason: 'invalid_reason' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid refresh reason');
    });
  });

  describe('GET /api/walmart/pricing/cache/stats', () => {
    it('should return cache performance statistics', async () => {
      mockCacheService.getStats.mockReturnValue({
        hits: 1500,
        misses: 300,
        hitRate: 0.833,
        size: 1200,
        maxSize: 10000,
        ttl: 300
      });

      const response = await request(app)
        .get('/api/walmart/pricing/cache/stats');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        hits: 1500,
        misses: 300,
        hitRate: 0.833,
        efficiency: 'high'
      });
    });
  });

  describe('DELETE /api/walmart/pricing/cache', () => {
    it('should clear pricing cache with authentication', async () => {
      mockCacheService.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/walmart/pricing/cache')
        .set('Authorization', 'Bearer admin-token')
        .send({ pattern: 'walmart:price:*' });

      expect(response.status).toBe(200);
      expect(response.body.cleared).toBe(true);
      expect(mockCacheService.delete).toHaveBeenCalledWith('walmart:price:*');
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .delete('/api/walmart/pricing/cache');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Admin authentication required');
    });
  });

  describe('Real-time Price Updates', () => {
    it('should handle price alerts when price changes', async () => {
      const oldPrice = 5.49;
      const newPrice = 4.99;
      const priceChange = { productId: 'prod-123', oldPrice, newPrice, changePercent: -9.1 };

      mockPriceFetcher.fetchPrice.mockResolvedValue({
        ...mockPriceData,
        currentPrice: newPrice
      });

      const response = await request(app)
        .get('/api/walmart/pricing/prod-123')
        .query({ alertOnChange: true });

      expect(response.status).toBe(200);
      expect(response.body.currentPrice).toBe(newPrice);
      
      // Check if price change was recorded
      expect(mockPriceHistoryService.recordPrice).toHaveBeenCalled();
    });

    it('should support price monitoring webhooks', async () => {
      const webhookUrl = 'https://example.com/price-webhook';
      
      const response = await request(app)
        .post('/api/walmart/pricing/prod-123/monitor')
        .send({
          webhookUrl,
          threshold: 0.05, // 5% price change
          type: 'decrease'
        });

      expect(response.status).toBe(201);
      expect(response.body.monitoring).toBe(true);
      expect(response.body.threshold).toBe(0.05);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent pricing requests efficiently', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPriceFetcher.fetchPrice.mockResolvedValue(mockPriceData);

      const requests = Array.from({ length: 50 }, (_, i) =>
        request(app).get(`/api/walmart/pricing/prod-${i}`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle all requests without errors
      expect(responses.filter(r => r.status !== 200)).toHaveLength(0);
    });

    it('should implement rate limiting for pricing API', async () => {
      mockCacheService.get.mockResolvedValue(mockPriceData);

      // Make rapid requests beyond rate limit
      const requests = Array.from({ length: 200 }, () =>
        request(app)
          .get('/api/walmart/pricing/prod-123')
          .set('X-Forwarded-For', '192.168.1.100')
      );

      const responses = await Promise.all(requests);
      
      // Should have some rate-limited responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should measure and report API response times', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPriceFetcher.fetchPrice.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(mockPriceData), 100)
        )
      );

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/walmart/pricing/prod-123');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.headers['x-response-time']).toBeDefined();
      expect(responseTime).toBeGreaterThan(90); // Accounting for mock delay
    });
  });

  describe('Error Recovery and Fallbacks', () => {
    it('should use stale cache data when pricing service fails', async () => {
      const staleData = { ...mockPriceData, lastUpdated: new Date(Date.now() - 600000) }; // 10 min old
      mockCacheService.get.mockResolvedValue(staleData);
      mockPriceFetcher.fetchPrice.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/walmart/pricing/prod-123')
        .query({ allowStale: true });

      expect(response.status).toBe(200);
      expect(response.body.currentPrice).toBe(4.99);
      expect(response.headers['x-cache']).toBe('STALE');
      expect(response.headers['x-warning']).toContain('stale data');
    });

    it('should implement circuit breaker pattern', async () => {
      // Simulate service failures
      mockPriceFetcher.fetchPrice.mockRejectedValue(new Error('Service down'));

      // Multiple failed requests should trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        await request(app).get('/api/walmart/pricing/prod-123');
      }

      const response = await request(app)
        .get('/api/walmart/pricing/prod-456');

      expect(response.status).toBe(503);
      expect(response.body.error).toContain('Circuit breaker open');
    });
  });
});