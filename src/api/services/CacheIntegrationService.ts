import { EventEmitter } from 'events';
import { CentralizedCacheService, CacheTier } from './CentralizedCacheService.js';
import { PricingService } from '../../microservices/pricing-service/PricingService.js';
import type { PriceRequest, PriceResponse } from '../../microservices/pricing-service/PricingService.js';
import { ListManagementService } from './ListManagementService.js';
import type { List, ListItem } from './ListManagementService.js';
import { z } from 'zod';

// Cache integration configuration
const CacheIntegrationConfigSchema = z.object({
  enablePricingCache: z.boolean().default(true),
  enableListCache: z.boolean().default(true),
  pricingCacheTtl: z.number().default(3600), // 1 hour
  listCacheTtl: z.number().default(1800), // 30 minutes
  enableCacheWarm: z.boolean().default(true),
  warmOnStartup: z.boolean().default(false),
  cacheKeyPrefix: z.string().default('integrated:'),
  invalidationStrategy: z.enum(['immediate', 'lazy', 'periodic']).default('immediate')
});

export type CacheIntegrationConfig = z.infer<typeof CacheIntegrationConfigSchema>;

export interface CacheStats {
  pricing: {
    hits: number;
    misses: number;
    avgLatency: number;
    cacheSize: number;
  };
  lists: {
    hits: number;
    misses: number;
    avgLatency: number;
    cacheSize: number;
  };
  unified: {
    totalHits: number;
    totalMisses: number;
    overallHitRatio: number;
    tierDistribution: Record<CacheTier, number>;
  };
}

/**
 * CacheIntegrationService
 * 
 * Provides unified caching integration for all microservices.
 * Manages cache tiers and provides consistent caching patterns
 * across pricing, lists, and other services.
 */
export class CacheIntegrationService extends EventEmitter {
  private config: CacheIntegrationConfig;
  private centralCache: CentralizedCacheService;
  private pricingService?: PricingService;
  private listService?: ListManagementService;
  private stats!: CacheStats;
  private warmupCompleted = false;

  constructor(
    centralCache: CentralizedCacheService,
    config: Partial<CacheIntegrationConfig> = {}
  ) {
    super();
    
    this.config = CacheIntegrationConfigSchema.parse(config);
    this.centralCache = centralCache;
    this.initializeStats();
    this.setupEventHandlers();
  }

  private initializeStats(): void {
    this.stats = {
      pricing: { hits: 0, misses: 0, avgLatency: 0, cacheSize: 0 },
      lists: { hits: 0, misses: 0, avgLatency: 0, cacheSize: 0 },
      unified: { 
        totalHits: 0, 
        totalMisses: 0, 
        overallHitRatio: 0, 
        tierDistribution: { 
          [CacheTier.MEMORY]: 0, 
          [CacheTier.REDIS]: 0, 
          [CacheTier.SQLITE]: 0 
        } 
      }
    };
  }

  private setupEventHandlers(): void {
    // Listen to central cache events
    this.centralCache?.on('cache:hit', (data: any) => {
      if (this.stats) {
        this.stats.unified.totalHits++;
        if (data.tier && this.stats.unified.tierDistribution[data.tier as CacheTier] !== undefined) {
          this.stats.unified.tierDistribution[data.tier as CacheTier]++;
        }
      }
      this.updateOverallStats();
      this.emit('cache:unified:hit', data);
    });

    this?.centralCache?.on('cache:set', (data: any) => {
      this.emit('cache:unified:set', data);
    });

    this?.centralCache?.on('error', (error: any) => {
      this.emit('cache:error', error);
    });
  }

  private updateOverallStats(): void {
    if (this.stats) {
      const total = this.stats.unified.totalHits + this.stats.unified.totalMisses;
      this.stats.unified.overallHitRatio = total > 0 ? (this.stats.unified.totalHits / total) * 100 : 0;
    }
  }

  // Service registration methods
  public registerPricingService(pricingService: PricingService): void {
    this.pricingService = pricingService;
    
    if (this?.config?.enablePricingCache) {
      this.setupPricingCacheIntegration();
    }

    this.emit('service:registered', { type: 'pricing', service: pricingService });
  }

  public registerListService(listService: ListManagementService): void {
    this.listService = listService;
    
    if (this?.config?.enableListCache) {
      this.setupListCacheIntegration();
    }

    this.emit('service:registered', { type: 'lists', service: listService });
  }

  // Pricing service cache integration
  private setupPricingCacheIntegration(): void {
    if (!this.pricingService) return;

    // Override pricing service cache methods to use unified cache
    const originalGetPrice = this.pricingService.getPrice.bind(this.pricingService);
    
    if (this.pricingService) {
      this.pricingService.getPrice = async (request: PriceRequest): Promise<PriceResponse> => {
      const cacheKey = this.generatePricingCacheKey(request);
      const startTime = Date.now();

      try {
        // Try to get from unified cache first
        const cachedResult = await this?.centralCache?.get<PriceResponse>(cacheKey);
        
        if (cachedResult.found && cachedResult.value) {
          if (this.stats) {
            this.stats.pricing.hits++;
            this.stats.pricing.avgLatency = this.updateAvgLatency(this.stats.pricing.avgLatency, cachedResult.latency);
          }
          
          this.emit('cache:pricing:hit', {
            key: cacheKey,
            tier: cachedResult.tier,
            latency: cachedResult.latency,
            promoted: cachedResult.promoted
          });

          return cachedResult.value;
        }

        // Cache miss - fetch from original service
        if (this.stats) {
          this.stats.pricing.misses++;
        }
        const result = await originalGetPrice(request);
        
        // Store in unified cache
        await this?.centralCache?.set(cacheKey, result, {
          ttl: this?.config?.pricingCacheTtl,
          tags: [`pricing`, `product:${request.productId}`, `store:${request.storeId}`]
        });

        const totalLatency = Date.now() - startTime;
        if (this.stats) {
          this.stats.pricing.avgLatency = this.updateAvgLatency(this.stats.pricing.avgLatency, totalLatency);
        }

        this.emit('cache:pricing:miss', {
          key: cacheKey,
          latency: totalLatency,
          cached: true
        });

        return result;

      } catch (error) {
        this.emit('cache:pricing:error', { key: cacheKey, error });
        // Fallback to original service
        return originalGetPrice(request);
      }
      };
    }
  }

  // List service cache integration
  private setupListCacheIntegration(): void {
    if (!this.listService) return;

    // Override list service methods to use unified cache
    const originalGetList = this.listService.getList.bind(this.listService);
    
    if (this.listService) {
      this.listService.getList = (listId: string): List | undefined => {
      const cacheKey = this.generateListCacheKey(listId);
      
      // For synchronous methods, we'll use a different approach
      // Try to get from memory cache only (synchronous)
      const list = originalGetList(listId);
      
      if (list) {
        // Asynchronously cache in unified system
        this?.centralCache?.set(cacheKey, list, {
          ttl: this?.config?.listCacheTtl,
          tags: [`list`, `list:${listId}`, `owner:${list.ownerId}`]
        }).catch(error => {
          this.emit('cache:list:error', { key: cacheKey, error });
        });
      }

      return list;
      };
    }

    // Listen to list updates and invalidate cache
    this?.listService?.on('list:updated', (data: any) => {
      if (this?.config?.invalidationStrategy === 'immediate') {
        this.invalidateListCache(data.listId);
      }
    });
  }

  // Cache key generation
  private generatePricingCacheKey(request: PriceRequest): string {
    return `${this?.config?.cacheKeyPrefix}pricing:${request.productId}:${request.storeId}:${request.quantity}:${request.includePromotions}`;
  }

  private generateListCacheKey(listId: string): string {
    return `${this?.config?.cacheKeyPrefix}list:${listId}`;
  }

  // Cache warming operations
  public async warmPricingCache(
    productIds: string[], 
    storeIds: string[] = ['default']
  ): Promise<{ warmed: number; errors: number }> {
    if (!this?.config?.enableCacheWarm || !this.pricingService) {
      return { warmed: 0, errors: 0 };
    }

    const warmEntries = [];
    for (const productId of productIds) {
      for (const storeId of storeIds) {
        warmEntries.push({
          key: this.generatePricingCacheKey({
            productId,
            storeId,
            quantity: 1,
            includePromotions: true
          }),
          value: await this?.pricingService?.getPrice({
            productId,
            storeId,
            quantity: 1,
            includePromotions: true
          }),
          ttl: this?.config?.pricingCacheTtl,
          tags: [`pricing`, `product:${productId}`, `store:${storeId}`]
        });
      }
    }

    const result = await this?.centralCache?.warm(warmEntries);
    this.emit('cache:warm:pricing', result);
    return result;
  }

  public async warmListCache(listIds: string[]): Promise<{ warmed: number; errors: number }> {
    if (!this?.config?.enableCacheWarm || !this.listService) {
      return { warmed: 0, errors: 0 };
    }

    const warmEntries = [];
    for (const listId of listIds) {
      const list = this?.listService?.getList(listId);
      if (list) {
        warmEntries.push({
          key: this.generateListCacheKey(listId),
          value: list,
          ttl: this?.config?.listCacheTtl,
          tags: [`list`, `list:${listId}`, `owner:${list.ownerId}`]
        });
      }
    }

    const result = await this?.centralCache?.warm(warmEntries);
    this.emit('cache:warm:lists', result);
    return result;
  }

  // Cache invalidation methods
  public async invalidatePricingCache(
    productId?: string,
    storeId?: string
  ): Promise<{ invalidated: number; tiers: CacheTier[] }> {
    const tags = [];
    
    if (productId) tags.push(`product:${productId}`);
    if (storeId) tags.push(`store:${storeId}`);
    if (tags?.length || 0 === 0) tags.push('pricing');

    const result = await this?.centralCache?.invalidateByTags(tags);
    this.emit('cache:invalidate:pricing', { tags, result });
    return result;
  }

  public async invalidateListCache(listId?: string): Promise<{ invalidated: number; tiers: CacheTier[] }> {
    const tags = listId ? [`list:${listId}`] : ['list'];
    
    const result = await this?.centralCache?.invalidateByTags(tags);
    this.emit('cache:invalidate:lists', { tags, result });
    return result;
  }

  public async invalidateAllCaches(): Promise<void> {
    await this?.centralCache?.clear();
    this.initializeStats();
    this.emit('cache:clear:all');
  }

  // Performance monitoring methods
  public getStats(): CacheStats {
    const centralStats = this?.centralCache?.getStats();
    
    return {
      ...this.stats,
      unified: {
        ...this?.stats?.unified,
        tierDistribution: centralStats.hits
      }
    };
  }

  public resetStats(): void {
    this.initializeStats();
    this?.centralCache?.resetStats();
    this.emit('stats:reset');
  }

  // Health check for integrated cache system
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'healthy' | 'unhealthy'>;
    cache: Awaited<ReturnType<CentralizedCacheService['healthCheck']>>;
  }> {
    const cacheHealth = await this?.centralCache?.healthCheck();
    
    const services: Record<string, 'healthy' | 'unhealthy'> = {};
    
    if (this.pricingService) {
      services.pricing = 'healthy'; // Assume healthy if registered
    }
    
    if (this.listService) {
      services.lists = 'healthy'; // Assume healthy if registered
    }

    const healthyServices = Object.values(services).filter(s => s === 'healthy').length;
    const status = cacheHealth.status === 'healthy' && healthyServices === Object.keys(services).length
      ? 'healthy'
      : cacheHealth.status === 'unhealthy' || healthyServices === 0
      ? 'unhealthy'
      : 'degraded';

    return {
      status,
      services,
      cache: cacheHealth
    };
  }

  // Utility methods
  private updateAvgLatency(currentAvg: number, newLatency: number): number {
    // Simple moving average approximation
    return currentAvg === 0 ? newLatency : (currentAvg * 0.9 + newLatency * 0.1);
  }

  public async startup(): Promise<void> {
    if (this?.config?.warmOnStartup && !this.warmupCompleted) {
      this.emit('startup:begin');
      
      try {
        // Perform any startup cache warming here
        this.warmupCompleted = true;
        this.emit('startup:complete');
      } catch (error) {
        this.emit('startup:error', error);
      }
    }
  }

  public async shutdown(): Promise<void> {
    await this?.centralCache?.shutdown();
    this.removeAllListeners();
    this.emit('shutdown');
  }
}