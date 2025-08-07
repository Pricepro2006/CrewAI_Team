import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedCacheManager } from '../UnifiedCacheManager.js';

// Mock the dependencies
vi.mock('../CentralizedCacheService.js', () => ({
  CentralizedCacheService: vi.fn().mockImplementation(() => ({
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ found: false, value: null, tier: null, latency: 10 }),
    delete: vi.fn().mockResolvedValue({ deleted: true, tiers: [] }),
    clear: vi.fn().mockResolvedValue(undefined),
    warm: vi.fn().mockResolvedValue({ warmed: 0, errors: 0 }),
    invalidateByTags: vi.fn().mockResolvedValue({ invalidated: 0, tiers: [] }),
    getStats: vi.fn().mockReturnValue({
      hits: { memory: 0, redis: 0, sqlite: 0 },
      misses: { memory: 0, redis: 0, sqlite: 0 },
      sets: { memory: 0, redis: 0, sqlite: 0 },
      deletes: { memory: 0, redis: 0, sqlite: 0 },
      errors: { memory: 0, redis: 0, sqlite: 0 },
      latency: { memory: [], redis: [], sqlite: [] },
      hitRatio: { memory: 0, redis: 0, sqlite: 0 },
      sizes: { memory: 0, redis: 0, sqlite: 0 },
      averageLatency: { memory: 0, redis: 0, sqlite: 0 },
      totalOperations: 0,
      overallHitRatio: 0
    }),
    resetStats: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      tiers: { memory: 'healthy', redis: 'healthy', sqlite: 'healthy' },
      details: {}
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    emit: vi.fn()
  })),
  CacheTier: {
    MEMORY: 'memory',
    REDIS: 'redis', 
    SQLITE: 'sqlite'
  }
}));

vi.mock('../CacheIntegrationService.js', () => ({
  CacheIntegrationService: vi.fn().mockImplementation(() => ({
    registerPricingService: vi.fn(),
    registerListService: vi.fn(),
    warmPricingCache: vi.fn().mockResolvedValue({ warmed: 0, errors: 0 }),
    warmListCache: vi.fn().mockResolvedValue({ warmed: 0, errors: 0 }),
    invalidatePricingCache: vi.fn().mockResolvedValue({ invalidated: 0, tiers: [] }),
    invalidateListCache: vi.fn().mockResolvedValue({ invalidated: 0, tiers: [] }),
    invalidateAllCaches: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      pricing: { hits: 0, misses: 0, avgLatency: 0, cacheSize: 0 },
      lists: { hits: 0, misses: 0, avgLatency: 0, cacheSize: 0 },
      unified: { totalHits: 0, totalMisses: 0, overallHitRatio: 0, tierDistribution: {} }
    }),
    resetStats: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      services: {},
      cache: { status: 'healthy', tiers: { memory: 'healthy', redis: 'healthy', sqlite: 'healthy' } }
    }),
    startup: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    emit: vi.fn()
  }))
}));

describe('UnifiedCacheManager', () => {
  let cacheManager: UnifiedCacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheManager = new UnifiedCacheManager({
      cache: {
        memory: { maxSize: 1000, ttl: 60 },
        redis: { host: 'localhost', port: 6379, ttl: 300 },
        sqlite: { path: ':memory:', ttl: 3600 }
      },
      integration: {
        enablePricingCache: true,
        enableListCache: true,
        warmOnStartup: false,
        invalidationStrategy: 'immediate'
      },
      monitoring: {
        enableMetrics: false, // Disable for tests
        metricsInterval: 60000,
        healthCheckInterval: 30000
      }
    });
  });

  afterEach(async () => {
    if (cacheManager && cacheManager.isHealthy()) {
      await cacheManager.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(cacheManager).toBeDefined();
      expect(cacheManager.isHealthy()).toBe(false); // Not initialized yet
      
      await cacheManager.initialize();
      expect(cacheManager.isHealthy()).toBe(true);
    });

    it('should not initialize twice', async () => {
      await cacheManager.initialize();
      await cacheManager.initialize(); // Should not throw or cause issues
      expect(cacheManager.isHealthy()).toBe(true);
    });
  });

  describe('Service Registration', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it('should register pricing service', () => {
      const mockPricingService = {
        getPrice: vi.fn(),
        warmCache: vi.fn(),
        invalidateCache: vi.fn(),
        close: vi.fn()
      } as any;

      expect(() => {
        cacheManager.registerPricingService(mockPricingService);
      }).not.toThrow();
    });

    it('should register list service', () => {
      const mockListService = {
        getList: vi.fn(),
        createList: vi.fn(),
        updateList: vi.fn(),
        on: vi.fn()
      } as any;

      expect(() => {
        cacheManager.registerListService(mockListService);
      }).not.toThrow();
    });
  });

  describe('Cache Operations', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it('should warm cache', async () => {
      const result = await cacheManager.warmCache({
        pricing: {
          productIds: ['PROD1', 'PROD2'],
          storeIds: ['store1']
        }
      });

      expect(result).toBeDefined();
      expect(result.pricing).toBeDefined();
    });

    it('should invalidate cache', async () => {
      await expect(
        cacheManager.invalidateCache({
          pricing: { productId: 'PROD1' }
        })
      ).resolves.not.toThrow();
    });

    it('should invalidate all caches', async () => {
      await expect(
        cacheManager.invalidateCache({ all: true })
      ).resolves.not.toThrow();
    });
  });

  describe('Status and Metrics', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it('should get system status', async () => {
      const status = await cacheManager.getStatus();
      
      expect(status).toBeDefined();
      expect(status.status).toBe('healthy');
      expect(status.uptime).toBeGreaterThan(0);
      expect(status.services).toBeDefined();
      expect(status.performance).toBeDefined();
      expect(status.tiers).toBeDefined();
    });

    it('should get metrics', () => {
      const metrics = cacheManager.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.central).toBeDefined();
      expect(metrics.integration).toBeDefined();
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.initialized).toBe(true);
    });

    it('should check health synchronously', () => {
      expect(cacheManager.isHealthy()).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it('should update configuration', () => {
      expect(() => {
        cacheManager.updateConfig({
          monitoring: {
            enableMetrics: true,
            metricsInterval: 30000,
            healthCheckInterval: 15000
          }
        });
      }).not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should shutdown gracefully', async () => {
      await cacheManager.initialize();
      expect(cacheManager.isHealthy()).toBe(true);
      
      await cacheManager.shutdown();
      expect(cacheManager.isHealthy()).toBe(false);
    });

    it('should restart successfully', async () => {
      await cacheManager.initialize();
      await cacheManager.restart();
      expect(cacheManager.isHealthy()).toBe(true);
    });
  });

  describe('Middleware Creation', () => {
    it('should create Express middleware', () => {
      const middleware = cacheManager.createCacheMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
      
      // Test middleware function
      const req = {} as any;
      const res = {
        setHeader: vi.fn(),
        locals: {}
      } as any;
      const next = vi.fn();

      middleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache-System', 'unified-3tier');
      expect(res.locals.cacheManager).toBe(cacheManager);
      expect(next).toHaveBeenCalled();
    });
  });
});