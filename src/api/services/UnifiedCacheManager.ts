import { EventEmitter } from 'events';
import { CentralizedCacheService } from './CentralizedCacheService.js';
import type { CacheConfig } from './CentralizedCacheService.js';
import { CacheIntegrationService } from './CacheIntegrationService.js';
import type { CacheIntegrationConfig } from './CacheIntegrationService.js';
import { PricingService } from '../../microservices/pricing-service/PricingService.js';
import { ListManagementService } from './ListManagementService.js';
import { z } from 'zod';

// Unified cache manager configuration
const UnifiedCacheManagerConfigSchema = z.object({
  cache: z.object({
    memory: z.object({
      maxSize: z.number().default(50000),
      ttl: z.number().default(300) // 5 minutes
    }),
    redis: z.object({
      host: z.string().default('localhost'),
      port: z.number().default(6379),
      ttl: z.number().default(3600) // 1 hour
    }),
    sqlite: z.object({
      path: z.string().default('./data/unified_cache.db'),
      ttl: z.number().default(86400) // 24 hours
    })
  }),
  integration: z.object({
    enablePricingCache: z.boolean().default(true),
    enableListCache: z.boolean().default(true),
    warmOnStartup: z.boolean().default(false),
    invalidationStrategy: z.enum(['immediate', 'lazy', 'periodic']).default('immediate')
  }),
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    metricsInterval: z.number().default(60000), // 1 minute
    healthCheckInterval: z.number().default(30000) // 30 seconds
  })
});

export type UnifiedCacheManagerConfig = z.infer<typeof UnifiedCacheManagerConfigSchema>;

export interface UnifiedCacheStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  services: {
    central: boolean;
    integration: boolean;
    pricing: boolean;
    lists: boolean;
  };
  performance: {
    totalRequests: number;
    cacheHitRatio: number;
    averageLatency: number;
    errorRate: number;
  };
  tiers: {
    memory: { status: string; size: number; hitRatio: number };
    redis: { status: string; hitRatio: number };
    sqlite: { status: string; hitRatio: number };
  };
}

/**
 * UnifiedCacheManager
 * 
 * Central orchestrator for all caching services in the application.
 * Manages initialization, configuration, monitoring, and lifecycle
 * of the entire caching infrastructure.
 */
export class UnifiedCacheManager extends EventEmitter {
  private config: UnifiedCacheManagerConfig;
  private centralCache: CentralizedCacheService;
  private integration: CacheIntegrationService;
  private isInitialized = false;
  private startTime: number = Date.now();
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  // Service references
  private pricingService?: PricingService;
  private listService?: ListManagementService;

  constructor(config: Partial<UnifiedCacheManagerConfig> = {}) {
    super();
    
    this.config = UnifiedCacheManagerConfigSchema.parse(config);
    
    // Initialize core services
    this.centralCache = new CentralizedCacheService(this.config.cache);
    this.integration = new CacheIntegrationService(
      this.centralCache, 
      this.config.integration
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Central cache events
    this.centralCache.on('cache:hit', (data) => {
      this.emit('cache:hit', { ...data, source: 'central' });
    });

    this.centralCache.on('error', (error) => {
      this.emit('cache:error', { ...error, source: 'central' });
    });

    // Integration service events
    this.integration.on('cache:pricing:hit', (data) => {
      this.emit('cache:hit', { ...data, source: 'pricing' });
    });

    this.integration.on('cache:list:hit', (data) => {
      this.emit('cache:hit', { ...data, source: 'lists' });
    });

    this.integration.on('service:registered', (data) => {
      this.emit('service:registered', data);
    });

    this.integration.on('cache:error', (error) => {
      this.emit('cache:error', { ...error, source: 'integration' });
    });
  }

  // Initialization and service registration
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.emit('initialization:start');

      // Start integration service
      await this.integration.startup();

      // Start monitoring if enabled
      if (this.config.monitoring.enableMetrics) {
        this.startMonitoring();
      }

      this.isInitialized = true;
      this.emit('initialization:complete');

    } catch (error) {
      this.emit('initialization:error', error);
      throw error;
    }
  }

  public registerPricingService(pricingService: PricingService): void {
    this.pricingService = pricingService;
    this.integration.registerPricingService(pricingService);
    
    this.emit('service:registered', { 
      type: 'pricing', 
      timestamp: Date.now() 
    });
  }

  public registerListService(listService: ListManagementService): void {
    this.listService = listService;
    this.integration.registerListService(listService);
    
    this.emit('service:registered', { 
      type: 'lists', 
      timestamp: Date.now() 
    });
  }

  // Cache operations delegated to appropriate services
  public async warmCache(options: {
    pricing?: { productIds: string[]; storeIds?: string[] };
    lists?: { listIds: string[] };
  }): Promise<{
    pricing?: { warmed: number; errors: number };
    lists?: { warmed: number; errors: number };
  }> {
    const results: any = {};

    if (options.pricing) {
      results.pricing = await this.integration.warmPricingCache(
        options.pricing.productIds,
        options.pricing.storeIds
      );
    }

    if (options.lists) {
      results.lists = await this.integration.warmListCache(options.lists.listIds);
    }

    this.emit('cache:warm:complete', results);
    return results;
  }

  public async invalidateCache(options: {
    pricing?: { productId?: string; storeId?: string };
    lists?: { listId?: string };
    all?: boolean;
  }): Promise<void> {
    if (options.all) {
      await this.integration.invalidateAllCaches();
      this.emit('cache:invalidate:all');
      return;
    }

    if (options.pricing) {
      await this.integration.invalidatePricingCache(
        options.pricing.productId,
        options.pricing.storeId
      );
    }

    if (options.lists) {
      await this.integration.invalidateListCache(options.lists.listId);
    }

    this.emit('cache:invalidate:complete', options);
  }

  // Monitoring and health checks
  private startMonitoring(): void {
    // Periodic metrics collection
    this.monitoringInterval = setInterval(() => {
      this.collectAndEmitMetrics();
    }, this.config.monitoring.metricsInterval);

    // Health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoring.healthCheckInterval);
  }

  private collectAndEmitMetrics(): void {
    try {
      const centralStats = this.centralCache.getStats();
      const integrationStats = this.integration.getStats();
      
      const metrics = {
        timestamp: Date.now(),
        uptime: Date.now() - this.startTime,
        central: centralStats,
        integration: integrationStats,
        combined: {
          totalHits: centralStats.hits.memory + centralStats.hits.redis + centralStats.hits.sqlite,
          totalMisses: centralStats.misses.memory + centralStats.misses.redis + centralStats.misses.sqlite,
          overallHitRatio: integrationStats.unified.overallHitRatio
        }
      };

      this.emit('metrics:collected', metrics);
    } catch (error) {
      this.emit('metrics:error', error);
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const healthStatus = await this.getStatus();
      this.emit('health:check', healthStatus);

      if (healthStatus.status === 'unhealthy') {
        this.emit('health:alert', healthStatus);
      }
    } catch (error) {
      this.emit('health:error', error);
    }
  }

  // Status and statistics
  public async getStatus(): Promise<UnifiedCacheStatus> {
    const integrationHealth = await this.integration.healthCheck();
    const centralStats = this.centralCache.getStats();
    const integrationStats = this.integration.getStats();

    const totalRequests = integrationStats.unified.totalHits + integrationStats.unified.totalMisses;
    const errorCount = Object.values(centralStats.errors).reduce((sum, errors) => sum + errors, 0);

    return {
      status: integrationHealth.status,
      uptime: Date.now() - this.startTime,
      services: {
        central: integrationHealth.cache.status !== 'unhealthy',
        integration: Object.keys(integrationHealth.services).length > 0,
        pricing: !!this.pricingService,
        lists: !!this.listService
      },
      performance: {
        totalRequests,
        cacheHitRatio: integrationStats.unified.overallHitRatio,
        averageLatency: Object.values(centralStats.averageLatency).reduce((sum, lat) => sum + lat, 0) / 3,
        errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
      },
      tiers: {
        memory: {
          status: integrationHealth.cache.tiers.memory,
          size: centralStats.sizes.memory,
          hitRatio: centralStats.hitRatio.memory
        },
        redis: {
          status: integrationHealth.cache.tiers.redis,
          hitRatio: centralStats.hitRatio.redis
        },
        sqlite: {
          status: integrationHealth.cache.tiers.sqlite,
          hitRatio: centralStats.hitRatio.sqlite
        }
      }
    };
  }

  public getMetrics() {
    return {
      central: this.centralCache.getStats(),
      integration: this.integration.getStats(),
      uptime: Date.now() - this.startTime,
      initialized: this.isInitialized
    };
  }

  // Configuration management
  public updateConfig(updates: Partial<UnifiedCacheManagerConfig>): void {
    this.config = UnifiedCacheManagerConfigSchema.parse({
      ...this.config,
      ...updates
    });

    this.emit('config:updated', updates);
  }

  // Lifecycle management
  public async restart(): Promise<void> {
    this.emit('restart:begin');
    
    await this.shutdown();
    await this.initialize();
    
    this.emit('restart:complete');
  }

  public async shutdown(): Promise<void> {
    this.emit('shutdown:begin');

    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown services
    await this.integration.shutdown();
    await this.centralCache.shutdown();

    this.isInitialized = false;
    this.removeAllListeners();
    
    this.emit('shutdown:complete');
  }

  // Utility methods for application integration
  public getCentralCache(): CentralizedCacheService {
    return this.centralCache;
  }

  public getIntegrationService(): CacheIntegrationService {
    return this.integration;
  }

  public isHealthy(): boolean {
    // Quick synchronous health check
    return this.isInitialized && this.centralCache !== undefined && this.integration !== undefined;
  }

  // Express middleware for cache headers
  public createCacheMiddleware() {
    return (req: any, res: any, next: any) => {
      // Add cache-related headers
      res.setHeader('X-Cache-System', 'unified-3tier');
      res.setHeader('X-Cache-Uptime', Math.floor((Date.now() - this.startTime) / 1000));
      
      // Add cache status to response locals
      res.locals.cacheManager = this;
      
      next();
    };
  }
}