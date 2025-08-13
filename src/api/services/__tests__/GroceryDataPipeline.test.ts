import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  GroceryDataPipeline, 
  PriceUpdate, 
  InventoryUpdate, 
  ProductMatch,
  DealAnalysis,
  NutritionData
} from '../GroceryDataPipeline.js';

// Mock dependencies
const mockMessageQueue = {
  connect: vi.fn().mockResolvedValue(undefined),
  registerConsumer: vi.fn().mockResolvedValue(undefined),
  startConsumer: vi.fn().mockResolvedValue(undefined),
  enqueue: vi.fn().mockResolvedValue('job-id-123'),
  getAllQueueStats: vi.fn().mockResolvedValue([]),
  shutdown: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockReturnThis(),
  emit: vi.fn().mockReturnThis()
};

const mockCacheManager = {
  getCentralCache: vi.fn().mockReturnValue({
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ found: false, value: null }),
    delete: vi.fn().mockResolvedValue({ deleted: true })
  }),
  on: vi.fn().mockReturnThis(),
  emit: vi.fn().mockReturnThis()
};

vi.mock('../RedisMessageQueue.js', () => ({
  RedisMessageQueue: vi.fn().mockImplementation(() => mockMessageQueue)
}));

vi.mock('../UnifiedCacheManager.js', () => ({
  UnifiedCacheManager: vi.fn().mockImplementation(() => mockCacheManager)
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-nanoid-123')
}));

describe('GroceryDataPipeline', () => {
  let pipeline: GroceryDataPipeline;
  const defaultConfig = {
    queues: {
      priceUpdates: 'grocery_price_updates',
      inventorySync: 'grocery_inventory_sync',
      productMatching: 'grocery_product_matching',
      dealAnalysis: 'grocery_deal_analysis',
      nutritionFetch: 'grocery_nutrition_fetch',
      reviewAnalysis: 'grocery_review_analysis',
      recommendations: 'grocery_recommendations'
    },
    processing: {
      batchSize: 10,
      concurrency: 3,
      enableCaching: true,
      cacheInvalidation: true,
      dependencyProcessing: true,
      deadLetterRetention: 604800
    },
    integrations: {
      walmartApi: true,
      nutritionApi: true,
      reviewSentiment: true,
      priceComparison: true
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new GroceryDataPipeline(
      mockMessageQueue as any,
      mockCacheManager as any,
      defaultConfig
    );
  });

  afterEach(async () => {
    if (pipeline && pipeline.isActive()) {
      await pipeline.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const defaultPipeline = new GroceryDataPipeline(
        mockMessageQueue as any,
        mockCacheManager as any
      );
      expect(defaultPipeline).toBeDefined();
      expect(defaultPipeline.isActive()).toBe(false);
    });

    it('should initialize with custom config', () => {
      expect(pipeline).toBeDefined();
      expect(pipeline.isActive()).toBe(false);
    });

    it('should set up event handlers on initialization', () => {
      expect(mockMessageQueue.on).toHaveBeenCalledWith('message:completed', expect.any(Function));
      expect(mockMessageQueue.on).toHaveBeenCalledWith('message:error', expect.any(Function));
      expect(mockMessageQueue.on).toHaveBeenCalledWith('message:retry', expect.any(Function));
    });

    it('should initialize consumers with correct configurations', () => {
      // The consumers are initialized in the constructor
      // We can verify this by checking the internal structure
      expect(pipeline).toBeDefined();
      
      // Start the pipeline to register consumers
      expect(pipeline.start()).resolves.not.toThrow();
    });
  });

  describe('Pipeline Lifecycle', () => {
    it('should start the pipeline successfully', async () => {
      let pipelineStarted = false;
      pipeline.on('pipeline:started', () => {
        pipelineStarted = true;
      });

      await pipeline.start();

      expect(pipeline.isActive()).toBe(true);
      expect(mockMessageQueue.connect).toHaveBeenCalled();
      expect(mockMessageQueue.registerConsumer).toHaveBeenCalledTimes(7); // 7 consumer types
      expect(pipelineStarted).toBe(true);
    });

    it('should not start pipeline twice', async () => {
      await pipeline.start();
      await pipeline.start(); // Second call should be ignored

      expect(mockMessageQueue.connect).toHaveBeenCalledTimes(1);
      expect(pipeline.isActive()).toBe(true);
    });

    it('should stop the pipeline gracefully', async () => {
      await pipeline.start();
      expect(pipeline.isActive()).toBe(true);

      let pipelineStopped = false;
      pipeline.on('pipeline:stopped', () => {
        pipelineStopped = true;
      });

      await pipeline.stop();

      expect(pipeline.isActive()).toBe(false);
      expect(pipelineStopped).toBe(true);
    });

    it('should shutdown completely', async () => {
      await pipeline.start();
      await pipeline.shutdown();

      expect(pipeline.isActive()).toBe(false);
      expect(mockMessageQueue.shutdown).toHaveBeenCalled();
    });
  });

  describe('Job Submission', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should submit price update job', async () => {
      const priceUpdate: PriceUpdate = {
        productId: 'PROD123',
        storeId: 'STORE456',
        newPrice: 12.99,
        oldPrice: 14.99,
        currency: 'USD',
        effectiveDate: Date.now(),
        source: 'walmart_api',
        confidence: 0.95
      };

      const jobId = await pipeline.submitPriceUpdate(priceUpdate);

      expect(jobId).toBe('job-id-123');
      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        'grocery_price_updates',
        expect.objectContaining({
          type: 'grocery:price_update',
          payload: expect.objectContaining({
            productId: 'PROD123',
            storeId: 'STORE456',
            data: priceUpdate
          }),
          priority: 7,
          maxRetries: 5
        })
      );
    });

    it('should submit inventory sync job', async () => {
      const inventoryUpdate: InventoryUpdate = {
        productId: 'PROD789',
        storeId: 'STORE123',
        quantity: 50,
        inStock: true,
        lastUpdated: Date.now(),
        source: 'inventory_system',
        threshold: 10
      };

      const jobId = await pipeline.submitInventorySync(inventoryUpdate);

      expect(jobId).toBe('job-id-123');
      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        'grocery_inventory_sync',
        expect.objectContaining({
          type: 'grocery:inventory_sync',
          payload: expect.objectContaining({
            productId: 'PROD789',
            storeId: 'STORE123',
            data: inventoryUpdate
          }),
          priority: 6,
          maxRetries: 3
        })
      );
    });

    it('should submit product match job', async () => {
      const productMatch: ProductMatch = {
        sourceProductId: 'PROD_A',
        targetProductId: 'PROD_B',
        confidence: 0.85,
        matchType: 'fuzzy',
        attributes: {
          brand: 'Test Brand',
          category: 'Grocery'
        },
        verificationStatus: 'pending'
      };

      const jobId = await pipeline.submitProductMatch(productMatch);

      expect(jobId).toBe('job-id-123');
      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        'grocery_product_matching',
        expect.objectContaining({
          type: 'grocery:product_match',
          payload: expect.objectContaining({
            data: productMatch
          }),
          priority: 4,
          maxRetries: 2
        })
      );
    });

    it('should submit nutrition fetch job', async () => {
      const productId = 'NUTRITION_PROD_123';
      const jobId = await pipeline.submitNutritionFetch(productId);

      expect(jobId).toBe('job-id-123');
      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        'grocery_nutrition_fetch',
        expect.objectContaining({
          type: 'grocery:nutrition_fetch',
          payload: expect.objectContaining({
            productId,
            data: { productId, requestedAt: expect.any(Number) }
          }),
          priority: 3,
          maxRetries: 4
        })
      );
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should process price update messages', async () => {
      const mockMessage = {
        id: 'price-msg-1',
        type: 'grocery:price_update',
        payload: {
          data: {
            productId: 'PROD123',
            storeId: 'STORE456',
            newPrice: 10.99,
            oldPrice: 12.99,
            currency: 'USD',
            effectiveDate: Date.now(),
            source: 'test',
            confidence: 1.0
          }
        }
      };

      // Access the private method through the consumers map
      const consumers = (pipeline as any).consumers;
      const priceConsumer = consumers.get('price_updates');
      
      expect(priceConsumer).toBeDefined();
      
      const result = await priceConsumer.process(mockMessage);
      
      expect(result.success).toBe(true);
      expect(result.messageType).toBe('price_update');
      expect(result.result.productId).toBe('PROD123');
      expect(result.cacheUpdated).toBe(true);
    });

    it('should process inventory update messages', async () => {
      const mockMessage = {
        id: 'inventory-msg-1',
        type: 'grocery:inventory_sync',
        payload: {
          data: {
            productId: 'PROD789',
            storeId: 'STORE123',
            quantity: 25,
            inStock: true,
            lastUpdated: Date.now(),
            source: 'test'
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const inventoryConsumer = consumers.get('inventory_sync');
      
      const result = await inventoryConsumer.process(mockMessage);
      
      expect(result.success).toBe(true);
      expect(result.messageType).toBe('inventory_sync');
      expect(result.result.inStock).toBe(true);
    });

    it('should process product matching messages', async () => {
      const mockMessage = {
        id: 'match-msg-1',
        type: 'grocery:product_match',
        payload: {
          data: {
            sourceProductId: 'PROD_A',
            targetProductId: 'PROD_B',
            confidence: 0.8,
            matchType: 'fuzzy',
            attributes: {},
            verificationStatus: 'pending'
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const matchConsumer = consumers.get('product_matching');
      
      const result = await matchConsumer.process(mockMessage);
      
      expect(result.success).toBe(true);
      expect(result.messageType).toBe('product_match');
      expect(result.result.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should process nutrition fetch messages', async () => {
      const mockMessage = {
        id: 'nutrition-msg-1',
        type: 'grocery:nutrition_fetch',
        payload: {
          productId: 'NUTRITION_PROD',
          data: { productId: 'NUTRITION_PROD', requestedAt: Date.now() }
        }
      };

      const consumers = (pipeline as any).consumers;
      const nutritionConsumer = consumers.get('nutrition_fetch');
      
      const result = await nutritionConsumer.process(mockMessage);
      
      expect(result.success).toBe(true);
      expect(result.messageType).toBe('nutrition_fetch');
      expect(result.result.productId).toBe('NUTRITION_PROD');
      expect(result.result.calories).toBeGreaterThan(0);
    });

    it('should handle processing errors gracefully', async () => {
      const invalidMessage = {
        id: 'invalid-msg',
        type: 'grocery:price_update',
        payload: {
          data: {
            // Missing required fields
            productId: 'PROD123'
            // Missing storeId, newPrice, etc.
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const priceConsumer = consumers.get('price_updates');
      
      const result = await priceConsumer.process(invalidMessage);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Cache Integration', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should update cache when processing price updates', async () => {
      const mockMessage = {
        id: 'cache-price-msg',
        type: 'grocery:price_update',
        payload: {
          data: {
            productId: 'CACHE_PROD',
            storeId: 'CACHE_STORE',
            newPrice: 15.99,
            currency: 'USD',
            effectiveDate: Date.now(),
            source: 'test',
            confidence: 1.0
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const priceConsumer = consumers.get('price_updates');
      
      await priceConsumer.process(mockMessage);
      
      const centralCache = mockCacheManager.getCentralCache();
      expect(centralCache.set).toHaveBeenCalledWith(
        'price:CACHE_PROD:CACHE_STORE',
        expect.any(Object),
        {
          ttl: 3600,
          tags: ['pricing', 'product:CACHE_PROD', 'store:CACHE_STORE']
        }
      );
    });

    it('should update cache when processing inventory updates', async () => {
      const mockMessage = {
        id: 'cache-inventory-msg',
        type: 'grocery:inventory_sync',
        payload: {
          data: {
            productId: 'CACHE_INV_PROD',
            storeId: 'CACHE_INV_STORE',
            quantity: 100,
            inStock: true,
            lastUpdated: Date.now(),
            source: 'test'
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const inventoryConsumer = consumers.get('inventory_sync');
      
      await inventoryConsumer.process(mockMessage);
      
      const centralCache = mockCacheManager.getCentralCache();
      expect(centralCache.set).toHaveBeenCalledWith(
        'inventory:CACHE_INV_PROD:CACHE_INV_STORE',
        expect.any(Object),
        {
          ttl: 1800,
          tags: ['inventory', 'product:CACHE_INV_PROD', 'store:CACHE_INV_STORE']
        }
      );
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should emit price update events', async () => {
      let priceUpdatedEvent: any = null;
      pipeline.on('price:updated', (data) => {
        priceUpdatedEvent = data;
      });

      const mockMessage = {
        id: 'event-price-msg',
        type: 'grocery:price_update',
        payload: {
          data: {
            productId: 'EVENT_PROD',
            storeId: 'EVENT_STORE',
            newPrice: 8.99,
            oldPrice: 10.99,
            currency: 'USD',
            effectiveDate: Date.now(),
            source: 'test',
            confidence: 1.0
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const priceConsumer = consumers.get('price_updates');
      
      await priceConsumer.process(mockMessage);
      
      expect(priceUpdatedEvent).toBeDefined();
      expect(priceUpdatedEvent.result.productId).toBe('EVENT_PROD');
      expect(priceUpdatedEvent.result.priceChange).toBe('-18.20%');
    });

    it('should emit inventory update events', async () => {
      let inventoryUpdatedEvent: any = null;
      pipeline.on('inventory:updated', (data) => {
        inventoryUpdatedEvent = data;
      });

      const mockMessage = {
        id: 'event-inventory-msg',
        type: 'grocery:inventory_sync',
        payload: {
          data: {
            productId: 'EVENT_INV_PROD',
            storeId: 'EVENT_INV_STORE',
            quantity: 0,
            inStock: false,
            lastUpdated: Date.now(),
            source: 'test'
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const inventoryConsumer = consumers.get('inventory_sync');
      
      await inventoryConsumer.process(mockMessage);
      
      expect(inventoryUpdatedEvent).toBeDefined();
      expect(inventoryUpdatedEvent.result.inStock).toBe(false);
      expect(inventoryUpdatedEvent.result.quantity).toBe(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should track processing statistics', async () => {
      // Process a few messages to generate stats
      const mockMessage = {
        id: 'stats-msg',
        type: 'grocery:price_update',
        payload: {
          data: {
            productId: 'STATS_PROD',
            storeId: 'STATS_STORE',
            newPrice: 5.99,
            currency: 'USD',
            effectiveDate: Date.now(),
            source: 'test',
            confidence: 1.0
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const priceConsumer = consumers.get('price_updates');
      
      await priceConsumer.process(mockMessage);
      
      const stats = pipeline.getProcessingStats();
      expect(stats).toBeInstanceOf(Map);
    });

    it('should get queue statistics', async () => {
      const queueStats = await pipeline.getQueueStats();
      expect(Array.isArray(queueStats)).toBe(true);
      expect(mockMessageQueue.getAllQueueStats).toHaveBeenCalled();
    });

    it('should report active status', () => {
      expect(pipeline.isActive()).toBe(true);
    });
  });

  describe('Dependency Processing', () => {
    beforeEach(async () => {
      await pipeline.start();
    });

    it('should trigger deal analysis on significant price drops', async () => {
      const mockMessage = {
        id: 'deal-trigger-msg',
        type: 'grocery:price_update',
        payload: {
          data: {
            productId: 'DEAL_PROD',
            storeId: 'DEAL_STORE',
            newPrice: 8.00,
            oldPrice: 12.00, // 33% drop - should trigger deal analysis
            currency: 'USD',
            effectiveDate: Date.now(),
            source: 'test',
            confidence: 1.0
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const priceConsumer = consumers.get('price_updates');
      
      const result = await priceConsumer.process(mockMessage);
      
      expect(result.dependentJobs).toBeDefined();
      expect(result.dependentJobs.length).toBeGreaterThan(0);
      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        'grocery_deal_analysis',
        expect.objectContaining({
          type: 'grocery:deal_analysis'
        })
      );
    });

    it('should trigger stock alerts on low inventory', async () => {
      const mockMessage = {
        id: 'stock-alert-msg',
        type: 'grocery:inventory_sync',
        payload: {
          data: {
            productId: 'LOW_STOCK_PROD',
            storeId: 'LOW_STOCK_STORE',
            quantity: 5,
            inStock: true,
            lastUpdated: Date.now(),
            source: 'test',
            threshold: 10 // Below threshold - should trigger alert
          }
        }
      };

      const consumers = (pipeline as any).consumers;
      const inventoryConsumer = consumers.get('inventory_sync');
      
      const result = await inventoryConsumer.process(mockMessage);
      
      expect(result.dependentJobs).toBeDefined();
      expect(result.dependentJobs).toContain('stock_alert_generated');
    });
  });

  describe('Schema Validation', () => {
    it('should validate price update schema', () => {
      const validPriceUpdate: PriceUpdate = {
        productId: 'VALID_PROD',
        storeId: 'VALID_STORE',
        newPrice: 9.99,
        oldPrice: 11.99,
        currency: 'USD',
        effectiveDate: Date.now(),
        source: 'validation_test',
        confidence: 0.9
      };

      expect(() => {
        const { PriceUpdateSchema } = require('../GroceryDataPipeline.js');
        PriceUpdateSchema.parse(validPriceUpdate);
      }).not.toThrow();
    });

    it('should validate inventory update schema', () => {
      const validInventoryUpdate: InventoryUpdate = {
        productId: 'VALID_INV_PROD',
        storeId: 'VALID_INV_STORE',
        quantity: 50,
        inStock: true,
        lastUpdated: Date.now(),
        source: 'validation_test',
        threshold: 10
      };

      expect(() => {
        const { InventoryUpdateSchema } = require('../GroceryDataPipeline.js');
        InventoryUpdateSchema.parse(validInventoryUpdate);
      }).not.toThrow();
    });

    it('should reject invalid schemas', () => {
      const invalidPriceUpdate = {
        productId: '', // Invalid - empty string
        newPrice: -5.99, // Invalid - negative price
        // Missing required fields
      };

      expect(() => {
        const { PriceUpdateSchema } = require('../GroceryDataPipeline.js');
        PriceUpdateSchema.parse(invalidPriceUpdate);
      }).toThrow();
    });
  });
});