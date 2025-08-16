/**
 * Optimized Cache Service with TTL, size limits, and performance monitoring
 * Replaces unbounded caching with efficient memory management
 */

import { LRUCache } from 'lru-cache';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

export interface CacheOptions {
  max?: number;           // Maximum number of items
  maxSize?: number;       // Maximum size in bytes
  ttl?: number;          // Time to live in milliseconds
  updateAgeOnGet?: boolean;
  updateAgeOnHas?: boolean;
  stale?: boolean;       // Allow stale data while refreshing
}

export interface CacheEntry<T> {
  value: T;
  size: number;
  createdAt: number;
  accessCount: number;
  key: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  itemCount: number;
  hitRate: number;
  avgResponseTime: number;
}

export class OptimizedCacheService<T = any> extends EventEmitter {
  private cache: LRUCache<string, CacheEntry<T>>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    itemCount: 0,
    hitRate: 0,
    avgResponseTime: 0
  };
  private pendingFetches: Map<string, Promise<T>>;
  private responseTimes: number[] = [];
  private readonly maxResponseTimeSamples = 1000;

  constructor(private options: CacheOptions = {}) {
    super();
    
    // Set sensible defaults
    this.options = {
      max: options.max || 1000,
      maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB default
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
      updateAgeOnGet: options.updateAgeOnGet !== false,
      updateAgeOnHas: options.updateAgeOnHas !== false,
      stale: options.stale !== false
    };

    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: this.options.max ?? 1000,
      maxSize: this.options.maxSize ?? 50 * 1024 * 1024,
      updateAgeOnGet: this.options.updateAgeOnGet,
      updateAgeOnHas: this.options.updateAgeOnHas,
      allowStale: this.options.stale,
      
      // Calculate size of cache entries
      sizeCalculation: (entry: CacheEntry<T>) => entry.size,
      
      // Handle evictions
      dispose: (entry, key, reason) => {
        if (reason === 'evict' || reason === 'set') {
          this.stats.evictions++;
          this.emit('eviction', { key, reason, entry });
        }
      },
      
      // TTL based on entry
      ttl: (entry: CacheEntry<T>) => {
        // Reduce TTL for frequently accessed items to keep them fresh
        if (entry.accessCount > 10) {
          return Math.floor((this.options.ttl ?? 5 * 60 * 1000) * 0.5);
        }
        return this.options.ttl ?? 5 * 60 * 1000;
      }
    });

    this.pendingFetches = new Map();
    this.initializeStats();
    
    // Periodic stats reporting
    setInterval(() => this.reportStats(), 60000); // Every minute
  }

  private initializeStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      itemCount: 0,
      hitRate: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Get item from cache with automatic deduplication
   */
  async get(key: string, fetcher?: () => Promise<T>): Promise<T | undefined> {
    const startTime = Date.now();
    
    // Check cache first
    const cached = this?.cache?.get(key);
    if (cached) {
      cached.accessCount++;
      this.stats.hits++;
      this.recordResponseTime(Date.now() - startTime);
      this.emit('hit', { key, responseTime: Date.now() - startTime });
      return cached.value;
    }

    this.stats.misses++;
    
    // If no fetcher provided, return undefined
    if (!fetcher) {
      this.recordResponseTime(Date.now() - startTime);
      return undefined;
    }

    // Check if fetch is already in progress (deduplication)
    const pending = this?.pendingFetches?.get(key);
    if (pending) {
      logger.debug(`Deduplicating fetch for key: ${key}`, "CACHE");
      const result = await pending;
      this.recordResponseTime(Date.now() - startTime);
      return result;
    }

    // Start new fetch
    const fetchPromise = this.fetchWithCache(key, fetcher);
    this?.pendingFetches?.set(key, fetchPromise);
    
    try {
      const result = await fetchPromise;
      this.recordResponseTime(Date.now() - startTime);
      return result;
    } finally {
      this?.pendingFetches?.delete(key);
    }
  }

  private async fetchWithCache(key: string, fetcher: () => Promise<T>): Promise<T> {
    try {
      const value = await fetcher();
      await this.set(key, value);
      return value;
    } catch (error) {
      logger.error(`Failed to fetch and cache key: ${key}`, "CACHE", { error });
      throw error;
    }
  }

  /**
   * Set item in cache with size calculation
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const size = this.calculateSize(value);
    
    const entry: CacheEntry<T> = {
      value,
      size,
      createdAt: Date.now(),
      accessCount: 0,
      key
    };

    // Use custom TTL if provided
    if (ttl !== undefined) {
      this?.cache?.set(key, entry, { ttl });
    } else {
      this?.cache?.set(key, entry);
    }

    this.stats.sets++;
    this.updateCacheStats();
    this.emit('set', { key, size, ttl });
  }

  /**
   * Batch get operation for multiple keys
   */
  async getBatch(keys: string[]): Promise<Map<string, T | undefined>> {
    const results = new Map<string, T | undefined>();
    
    for (const key of keys) {
      const cached = this?.cache?.get(key);
      if (cached) {
        cached.accessCount++;
        this.stats.hits++;
        results.set(key, cached.value);
      } else {
        this.stats.misses++;
        results.set(key, undefined);
      }
    }
    
    return results;
  }

  /**
   * Batch set operation for multiple items
   */
  async setBatch(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const { key, value, ttl } of entries) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const deleted = this?.cache?.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.updateCacheStats();
      this.emit('delete', { key });
    }
    return deleted || false;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const previousSize = this?.cache?.size;
    this?.cache?.clear();
    this?.pendingFetches?.clear();
    this.updateCacheStats();
    this.emit('clear', { itemsCleared: previousSize });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this?.cache?.has(key);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateCacheStats();
    return { ...this.stats };
  }

  /**
   * Warm cache with predefined data
   */
  async warm(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    logger.info(`Warming cache with ${entries?.length || 0} entries`, "CACHE");
    await this.setBatch(entries);
    this.emit('warm', { count: entries?.length || 0 });
  }

  /**
   * Prune expired entries manually
   */
  prune(): number {
    const previousSize = this?.cache?.size;
    this?.cache?.purgeStale();
    const pruned = previousSize - this?.cache?.size;
    
    if (pruned > 0) {
      this.updateCacheStats();
      this.emit('prune', { pruned });
    }
    
    return pruned;
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): { used: number; max: number; percentage: number } {
    const used = this?.cache?.calculatedSize || 0;
    const max = this?.options?.maxSize!;
    const percentage = (used / max) * 100;
    
    return { used, max, percentage };
  }

  private calculateSize(value: T): number {
    try {
      // Simple size estimation based on JSON serialization
      const serialized = JSON.stringify(value);
      return Buffer.byteLength(serialized, 'utf8');
    } catch {
      // Fallback to rough estimate
      return 1024; // 1KB default
    }
  }

  private updateCacheStats(): void {
    if (this.cache) {
      this.stats.itemCount = this.cache.size;
      this.stats.size = this.cache.calculatedSize || 0;
    }
    
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    if (this.responseTimes.length > 0) {
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.stats.avgResponseTime = sum / this.responseTimes.length;
    }
  }

  private recordResponseTime(time: number): void {
    this?.responseTimes?.push(time);
    
    // Keep only recent samples
    if (this?.responseTimes?.length > this.maxResponseTimeSamples) {
      this?.responseTimes?.shift();
    }
  }

  private reportStats(): void {
    const stats = this.getStats();
    const memory = this.getMemoryUsage();
    
    logger.info('Cache statistics', "CACHE", {
      hitRate: `${stats?.hitRate?.toFixed(2)}%`,
      items: stats.itemCount,
      memory: `${(memory.used / 1024 / 1024).toFixed(2)}MB / ${(memory.max / 1024 / 1024).toFixed(2)}MB`,
      avgResponseTime: `${stats?.avgResponseTime?.toFixed(2)}ms`,
      evictions: stats.evictions
    });
  }

  /**
   * Cleanup and shutdown
   */
  dispose(): void {
    this.clear();
    this.removeAllListeners();
  }
}

// Factory for creating specialized caches
export class CacheFactory {
  private static caches = new Map<string, OptimizedCacheService<any>>();

  static create<T>(name: string, options: CacheOptions = {}): OptimizedCacheService<T> {
    if (this?.caches?.has(name)) {
      return this?.caches?.get(name)!;
    }

    const cache = new OptimizedCacheService<T>(options);
    this?.caches?.set(name, cache);
    
    // Log cache creation
    logger.info(`Created cache: ${name}`, "CACHE_FACTORY", {
      max: options.max,
      ttl: options.ttl,
      maxSize: options.maxSize
    });
    
    return cache;
  }

  static get<T>(name: string): OptimizedCacheService<T> | undefined {
    return this?.caches?.get(name);
  }

  static disposeAll(): void {
    for (const [name, cache] of this.caches) {
      cache.dispose();
      logger.info(`Disposed cache: ${name}`, "CACHE_FACTORY");
    }
    this?.caches?.clear();
  }

  static getStats(): Map<string, CacheStats> {
    const stats = new Map<string, CacheStats>();
    for (const [name, cache] of this.caches) {
      stats.set(name, cache.getStats());
    }
    return stats;
  }
}

// Pre-configured cache instances for common use cases
export const walmartPriceCache = CacheFactory.create<any>('walmart-prices', {
  max: 500,
  ttl: 30 * 60 * 1000, // 30 minutes
  maxSize: 10 * 1024 * 1024 // 10MB
});

export const groceryListCache = CacheFactory.create<any>('grocery-lists', {
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 5 * 1024 * 1024 // 5MB
});

export const nlpResultCache = CacheFactory.create<any>('nlp-results', {
  max: 1000,
  ttl: 60 * 60 * 1000, // 1 hour
  maxSize: 20 * 1024 * 1024 // 20MB
});

export const sessionCache = CacheFactory.create<any>('sessions', {
  max: 10000,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 50 * 1024 * 1024 // 50MB
});