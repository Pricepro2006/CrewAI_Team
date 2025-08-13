/**
 * Cache Warmer Microservice for Walmart Grocery Agent
 * 
 * This service runs independently to warm caches proactively based on:
 * - Access patterns and analytics
 * - Time-based predictions (peak hours)
 * - Ollama query patterns
 * - Common grocery items
 * 
 * Features:
 * - Non-blocking background operations
 * - Memory-aware warming with 100MB limit
 * - Analytics-driven decisions
 * - Integration with Redis (DB 2 for analytics)
 * - SQLite persistence for long-term patterns
 */

import express from 'express';
import Redis from 'ioredis';
import { IntelligentCacheWarmer } from '../../core/cache/IntelligentCacheWarmer.js';
import { LLMResponseCache } from '../../core/cache/LLMResponseCache.js';
import { RedisCacheManager } from '../../core/cache/RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import { z } from 'zod';

// Configuration schema
const ServiceConfigSchema = z.object({
  port: z.number().default(3006),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    db: z.number().default(0),
    analyticsDb: z.number().default(2)
  }),
  warming: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().default(5 * 60 * 1000), // 5 minutes
    memoryLimit: z.number().default(100 * 1024 * 1024), // 100MB
    batchSize: z.number().default(10),
    concurrency: z.number().default(3)
  }),
  monitoring: z.object({
    metricsEnabled: z.boolean().default(true),
    healthCheckInterval: z.number().default(30000) // 30 seconds
  })
});

type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

class CacheWarmerService {
  private app: express.Application;
  private config: ServiceConfig;
  private redis: Redis;
  private cacheManager: RedisCacheManager;
  private llmCache: LLMResponseCache;
  private cacheWarmer: IntelligentCacheWarmer;
  private isRunning = false;
  private startTime = Date.now();
  
  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = ServiceConfigSchema.parse(config);
    this.app = express();
    this.app.use(express.json());
    
    // Initialize Redis connections
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      db: this.config.redis.db,
      retryStrategy: (times) => Math.min(times * 100, 3000)
    });
    
    // Initialize cache managers
    this.cacheManager = RedisCacheManager.getInstance();
    this.llmCache = LLMResponseCache.getInstance();
    
    // Initialize intelligent cache warmer
    this.cacheWarmer = new IntelligentCacheWarmer(
      {
        enabled: this.config.warming.enabled,
        redis: {
          db: this.config.redis.analyticsDb
        },
        warming: {
          interval: this.config.warming.interval,
          memoryLimit: this.config.warming.memoryLimit,
          batchSize: this.config.warming.batchSize,
          concurrency: this.config.warming.concurrency
        },
        schedules: [
          // Peak hours for grocery shopping
          { name: 'morning_peak', cron: '0 7 * * *', items: [], strategy: 'full' },
          { name: 'lunch_peak', cron: '0 11 * * *', items: [], strategy: 'partial' },
          { name: 'evening_peak', cron: '0 17 * * *', items: [], strategy: 'full' },
          // Weekend preparation
          { name: 'weekend_prep', cron: '0 18 * * 5', items: [], strategy: 'full' },
          // Sunday planning
          { name: 'sunday_planning', cron: '0 10 * * 0', items: [], strategy: 'full' }
        ]
      },
      this.redis,
      this.cacheManager,
      this.llmCache
    );
    
    this.setupRoutes();
    this.setupEventHandlers();
    this.startMonitoring();
  }
  
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const stats = this.cacheWarmer.getStatistics();
      const uptime = Date.now() - this.startTime;
      
      res.json({
        status: 'healthy',
        service: 'cache-warmer',
        uptime,
        isRunning: this.isRunning,
        statistics: stats,
        config: {
          warmingEnabled: this.config.warming.enabled,
          interval: this.config.warming.interval,
          memoryLimit: this.config.warming.memoryLimit
        }
      });
    });
    
    // Get warming statistics
    this.app.get('/stats', (req, res) => {
      const stats = this.cacheWarmer.getStatistics();
      res.json(stats);
    });
    
    // Trigger manual warming
    this.app.post('/warm', async (req, res) => {
      try {
        const { strategy = 'auto', items = [] } = req.body;
        
        let result;
        if (items.length > 0) {
          result = await this.cacheWarmer.forceWarm(items);
        } else {
          result = await this.cacheWarmer.warmCache(strategy);
        }
        
        res.json({
          success: true,
          result
        });
      } catch (error) {
        logger.error('Manual warming failed', 'CACHE_WARMER_SERVICE', { error });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Warm specific grocery category
    this.app.post('/warm/category', async (req, res) => {
      try {
        const { category } = req.body;
        
        if (!category) {
          return res.status(400).json({
            success: false,
            error: 'Category is required'
          });
        }
        
        const result = await this.cacheWarmer.warmGroceryCategory(category);
        
        res.json({
          success: true,
          result
        });
      } catch (error) {
        logger.error('Category warming failed', 'CACHE_WARMER_SERVICE', { error, category: req.body.category });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Warm common NLP queries
    this.app.post('/warm/nlp', async (req, res) => {
      try {
        const result = await this.cacheWarmer.warmCommonNLPQueries();
        
        res.json({
          success: true,
          result
        });
      } catch (error) {
        logger.error('NLP warming failed', 'CACHE_WARMER_SERVICE', { error });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Record Ollama query for analytics
    this.app.post('/record/ollama', (req, res) => {
      try {
        const { query, responseTime, cached, response } = req.body;
        
        if (!query || responseTime === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Query and responseTime are required'
          });
        }
        
        this.cacheWarmer.recordOllamaQuery(query, responseTime, cached || false, response);
        
        res.json({ success: true });
      } catch (error) {
        logger.error('Failed to record Ollama query', 'CACHE_WARMER_SERVICE', { error });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Record general access pattern
    this.app.post('/record/access', (req, res) => {
      try {
        const { itemId, loadTime, hit, metadata } = req.body;
        
        if (!itemId || loadTime === undefined) {
          return res.status(400).json({
            success: false,
            error: 'ItemId and loadTime are required'
          });
        }
        
        this.cacheWarmer.recordAccess(itemId, loadTime, hit || false, metadata);
        
        res.json({ success: true });
      } catch (error) {
        logger.error('Failed to record access', 'CACHE_WARMER_SERVICE', { error });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Clear cache
    this.app.post('/clear', (req, res) => {
      try {
        this.cacheWarmer.clearCache();
        res.json({ success: true });
      } catch (error) {
        logger.error('Failed to clear cache', 'CACHE_WARMER_SERVICE', { error });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }
  
  private setupEventHandlers(): void {
    // Cache warmer events
    this.cacheWarmer.on('initialized', (data) => {
      logger.info('Cache warmer initialized', 'CACHE_WARMER_SERVICE', data);
      metrics.increment('cache_warmer.initialized');
    });
    
    this.cacheWarmer.on('warming_started', (data) => {
      logger.info('Warming started', 'CACHE_WARMER_SERVICE', data);
      metrics.increment('cache_warmer.warming_started');
      metrics.gauge('cache_warmer.candidates_count', data.candidatesCount);
    });
    
    this.cacheWarmer.on('warming_completed', (result) => {
      logger.info('Warming completed', 'CACHE_WARMER_SERVICE', result);
      metrics.increment('cache_warmer.warming_completed');
      metrics.gauge('cache_warmer.warmed_items', result.warmedItems);
      metrics.gauge('cache_warmer.failed_items', result.failedItems);
      metrics.histogram('cache_warmer.warming_duration', result.duration);
    });
    
    this.cacheWarmer.on('item_warmed', (data) => {
      logger.debug('Item warmed', 'CACHE_WARMER_SERVICE', data);
      metrics.increment('cache_warmer.item_warmed');
      metrics.histogram('cache_warmer.item_size', data.size);
    });
    
    this.cacheWarmer.on('warming_error', (data) => {
      logger.error('Warming error', 'CACHE_WARMER_SERVICE', data);
      metrics.increment('cache_warmer.warming_error');
    });
    
    // Redis events
    this.redis.on('error', (error) => {
      logger.error('Redis error', 'CACHE_WARMER_SERVICE', { error });
      metrics.increment('cache_warmer.redis_error');
    });
    
    this.redis.on('connect', () => {
      logger.info('Redis connected', 'CACHE_WARMER_SERVICE');
      metrics.increment('cache_warmer.redis_connected');
    });
  }
  
  private startMonitoring(): void {
    if (!this.config.monitoring.metricsEnabled) return;
    
    // Periodic metrics collection
    setInterval(() => {
      const stats = this.cacheWarmer.getStatistics();
      
      // General metrics
      metrics.gauge('cache_warmer.patterns_tracked', stats.patternsTracked);
      metrics.gauge('cache_warmer.memory_usage', stats.memoryUsage);
      
      // Ollama metrics
      metrics.gauge('cache_warmer.ollama.queries_tracked', stats.ollamaStats.queriesTracked);
      metrics.gauge('cache_warmer.ollama.avg_response_time', stats.ollamaStats.avgResponseTime);
      metrics.gauge('cache_warmer.ollama.cache_hit_rate', stats.ollamaStats.cacheHitRate);
      
      // Grocery metrics
      metrics.gauge('cache_warmer.grocery.items_tracked', stats.groceryStats.itemsTracked);
      metrics.gauge('cache_warmer.grocery.categories_loaded', stats.groceryStats.categoriesLoaded);
      metrics.gauge('cache_warmer.grocery.common_items_cached', stats.groceryStats.commonItemsCached);
      
    }, this.config.monitoring.healthCheckInterval);
  }
  
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        this.isRunning = true;
        logger.info(`Cache Warmer Service started on port ${this.config.port}`, 'CACHE_WARMER_SERVICE');
        resolve();
      });
    });
  }
  
  public async stop(): Promise<void> {
    this.isRunning = false;
    await this.cacheWarmer.shutdown();
    await this.redis.quit();
    logger.info('Cache Warmer Service stopped', 'CACHE_WARMER_SERVICE');
  }
}

// Start the service if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new CacheWarmerService({
    port: parseInt(process.env.CACHE_WARMER_PORT || '3006'),
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '0'),
      analyticsDb: parseInt(process.env.REDIS_ANALYTICS_DB || '2')
    },
    warming: {
      enabled: process.env.CACHE_WARMING_ENABLED !== 'false',
      interval: parseInt(process.env.CACHE_WARMING_INTERVAL || String(5 * 60 * 1000)),
      memoryLimit: parseInt(process.env.CACHE_WARMING_MEMORY_LIMIT || String(100 * 1024 * 1024)),
      batchSize: parseInt(process.env.CACHE_WARMING_BATCH_SIZE || '10'),
      concurrency: parseInt(process.env.CACHE_WARMING_CONCURRENCY || '3')
    }
  });
  
  service.start().catch((error) => {
    console.error('Failed to start Cache Warmer Service:', error);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await service.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await service.stop();
    process.exit(0);
  });
}

export { CacheWarmerService };