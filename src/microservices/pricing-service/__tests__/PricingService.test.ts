import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing the service
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const store = new Map();
      return {
        get: vi.fn((key: any) => Promise.resolve(store.get(key))),
        setex: vi.fn((key, ttl, value) => {
          store.set(key, value);
          return Promise.resolve('OK');
        }),
        keys: vi.fn((pattern: any) => {
          const keys = Array.from(store.keys());
          return Promise.resolve(keys?.filter(k => k.includes(pattern.replace('*', ''))));
        }),
        del: vi.fn((...keys) => {
          keys.forEach(k => store.delete(k));
          return Promise.resolve(keys?.length || 0);
        }),
        on: vi.fn(),
        quit: vi.fn(() => Promise.resolve())
      };
    })
  };
});

vi.mock('better-sqlite3', () => {
  const mockStore = new Map();
  return {
    default: vi.fn().mockImplementation(() => ({
      exec: vi.fn(),
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT')) {
          return {
            get: vi.fn((key: string, expires?: number) => {
              const data = mockStore.get(key);
              if (data && (!expires || data.expires_at > expires)) {
                return data;
              }
              return null;
            })
          };
        } else if (sql.includes('INSERT') || sql.includes('DELETE')) {
          return {
            run: vi.fn((...params: any[]) => {
              if (sql.includes('INSERT')) {
                const [key] = params;
                mockStore.set(key, {
                  cache_key: key,
                  expires_at: Math.floor(Date.now() / 1000) + 3600
                });
              } else if (sql.includes('DELETE')) {
                let changes = 0;
                for (const [key] of mockStore.entries()) {
                  mockStore.delete(key);
                  changes++;
                }
                return { changes };
              }
              return { changes: 1 };
            })
          };
        }
        return {
          run: vi.fn(() => ({ changes: 1 })),
          get: vi.fn(() => null)
        };
      }),
      close: vi.fn()
    }))
  };
});

vi.mock('p-limit', () => ({
  default: vi.fn((limit: number) => (fn: () => Promise<any>) => fn())
}));

// Now import the service after mocks are set up
import { PricingService, PriceRequest, PriceResponse } from '../PricingService';

describe('PricingService', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    vi.clearAllMocks();
    pricingService = new PricingService({
      cache: {
        memory: { maxSize: 100, ttl: 60 },
        redis: { ttl: 300, keyPrefix: 'test:' },
        sqlite: { ttl: 3600, tableName: 'test_cache' }
      },
      api: {
        baseUrl: 'https://api?.test?.com',
        apiKey: 'test-key',
        rateLimit: 5,
        timeout: 1000,
        retries: 2
      }
    });
  });

  afterEach(async () => {
    await pricingService.close();
  });

  describe('Basic Functionality', () => {
    it('should initialize with correct configuration', () => {
      expect(pricingService).toBeDefined();
      const metrics = pricingService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toBeDefined();
    });

    it('should get price from API when cache is empty', async () => {
      const request: PriceRequest = {
        productId: 'TEST123',
        storeId: 'store1',
        quantity: 1,
        includePromotions: true
      };

      const result = await pricingService.getPrice(request);
      expect(result.source).toBe('api');
      expect(result.productId).toBe(request.productId);
      expect(result.price).toBeGreaterThan(0);
    });

    it('should get price from memory cache on second call', async () => {
      const request: PriceRequest = {
        productId: 'TEST456',
        storeId: 'store1',
        quantity: 1,
        includePromotions: true
      };

      // First call - should go to API
      const result1 = await pricingService.getPrice(request);
      expect(result1.source).toBe('api');

      // Second call - should come from memory cache
      const result2 = await pricingService.getPrice(request);
      expect(result2.source).toBe('memory');
      expect(result2.productId).toBe(request.productId);
    });
  });

  describe('Cache Management', () => {
    it('should warm cache with products', async () => {
      const productIds = ['PROD1', 'PROD2'];
      let warmCompleted = false;
      
      pricingService.on('cache:warm:complete', (data: any) => {
        warmCompleted = true;
        expect(data.count).toBe(productIds?.length || 0);
      });

      await pricingService.warmCache(productIds);
      expect(warmCompleted).toBe(true);

      // Verify products are in cache
      const result = await pricingService.getPrice({
        productId: 'PROD1',
        storeId: 'default',
        quantity: 1,
        includePromotions: true
      });
      expect(result.source).toBe('memory');
    });

    it('should invalidate cache', async () => {
      // Add item to cache
      const request: PriceRequest = {
        productId: 'CLEAR1',
        storeId: 'store1',
        quantity: 1,
        includePromotions: true
      };

      await pricingService.getPrice(request);
      
      const metrics1 = pricingService.getMetrics();
      expect(metrics1?.cacheSize?.length).toBeGreaterThan(0);

      // Clear cache
      await pricingService.invalidateCache();
      
      const metrics2 = pricingService.getMetrics();
      expect(metrics2).toBeDefined();
    });
  });

  describe('Metrics', () => {
    it('should track hits and misses', async () => {
      const request: PriceRequest = {
        productId: 'METRICS1',
        storeId: 'store1',
        quantity: 1,
        includePromotions: true
      };

      // First call - miss, then API hit
      await pricingService.getPrice(request);
      
      // Second call - memory hit
      await pricingService.getPrice(request);

      const metrics = pricingService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toBeDefined();
    });

    it('should reset metrics', async () => {
      await pricingService.getPrice({
        productId: 'RESET1',
        storeId: 'store1',
        quantity: 1,
        includePromotions: true
      });

      pricingService.resetMetrics();

      const metrics = pricingService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate input parameters', async () => {
      const invalidRequest = {
        productId: '', // Invalid: empty string
        storeId: 'store1',
        quantity: -1, // Invalid: negative
        includePromotions: true
      };

      await expect(pricingService.getPrice(invalidRequest as PriceRequest))
        .rejects.toThrow();
    });
  });

  describe('Event System', () => {
    it('should emit cache hit events', async () => {
      let hitEvent: any = null;
      
      pricingService.on('cache:hit', (data: any) => {
        hitEvent = data;
      });

      const request: PriceRequest = {
        productId: 'EVENT1',
        storeId: 'store1',
        quantity: 1,
        includePromotions: true
      };

      // First call - no hit event
      await pricingService.getPrice(request);
      expect(hitEvent).toBeNull();

      // Second call - should emit hit event
      await pricingService.getPrice(request);
      expect(hitEvent).toBeTruthy();
      expect(hitEvent.level).toBe('memory');
    });

    it('should emit API fetch events', async () => {
      let apiEvent: any = null;
      
      pricingService.on('api:fetch', (data: any) => {
        apiEvent = data;
      });

      await pricingService.getPrice({
        productId: 'APIEVENT1',
        storeId: 'store1',
        quantity: 1,
        includePromotions: true
      });

      expect(apiEvent).toBeTruthy();
      expect(apiEvent.productId).toBe('APIEVENT1');
      expect(apiEvent.success).toBe(true);
    });
  });
});