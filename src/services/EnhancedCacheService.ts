import { LRUCache } from 'lru-cache';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  updateAgeOnGet?: boolean;
}

interface CacheEntry<T> {
  value: T;
  hash?: string;
  accessCount: number;
  createdAt: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  deduplicatedRequests: number;
  hitRate: number;
  size: number;
  inflightRequests: number;
}

/**
 * Enhanced Cache Service with:
 * - LRU eviction to prevent unbounded growth
 * - Request deduplication for expensive operations
 * - Specialized caches with appropriate TTLs
 * - Pattern-based invalidation
 * - Batch operations
 * - Express middleware support
 */
export class EnhancedCacheService extends EventEmitter {
  private static instance: EnhancedCacheService;
  private caches: Map<string, LRUCache<string, CacheEntry<any>>>;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private defaultMaxSize = 1000;
  private requestDeduplication: Map<string, Promise<any>>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    deduplicatedRequests: 0,
    hitRate: 0,
    size: 0,
    inflightRequests: 0
  };
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.caches = new Map();
    this.requestDeduplication = new Map();
    this.initialize();
  }

  static getInstance(): EnhancedCacheService {
    if (!EnhancedCacheService.instance) {
      EnhancedCacheService.instance = new EnhancedCacheService();
    }
    return EnhancedCacheService.instance;
  }

  private initialize(): void {
    // Create specialized caches with appropriate TTLs
    this.createCache('pricing', { ttl: 60000, maxSize: 500 }); // 1 minute for pricing
    this.createCache('products', { ttl: 300000, maxSize: 2000 }); // 5 minutes for products
    this.createCache('nlp', { ttl: 600000, maxSize: 1000 }); // 10 minutes for NLP results
    this.createCache('health', { ttl: 10000, maxSize: 10 }); // 10 seconds for health checks
    this.createCache('session', { ttl: 3600000, maxSize: 5000 }); // 1 hour for sessions
    this.createCache('walmart', { ttl: 120000, maxSize: 1000 }); // 2 minutes for Walmart data
    this.createCache('grocery', { ttl: 180000, maxSize: 1500 }); // 3 minutes for grocery items
    this.createCache('deals', { ttl: 300000, maxSize: 500 }); // 5 minutes for deals
    
    // Setup cleanup interval
    this.setupCleanupInterval();
    
    console.log('✅ Enhanced cache service initialized with specialized caches');
  }

  private createCache(name: string, options: CacheOptions = {}): void {
    const cache = new LRUCache<string, CacheEntry<any>>({
      max: options.maxSize || this.defaultMaxSize,
      ttl: options.ttl || this.defaultTTL,
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      dispose: (entry, key) => {
        this.emit('evicted', { cache: name, key });
      }
    });

    this?.caches?.set(name, cache);
  }

  private setupCleanupInterval(): void {
    // Cleanup stale deduplication entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupDeduplication();
      this.updateStats();
    }, 60000);
  }

  private cleanupDeduplication(): void {
    // Clear resolved promises older than 5 seconds
    for (const [key, promise] of this.requestDeduplication) {
      promise.finally(() => {
        setTimeout(() => {
          this?.requestDeduplication?.delete(key);
        }, 5000);
      });
    }
  }

  private updateStats(): void {
    let totalSize = 0;
    for (const cache of this?.caches?.values()) {
      totalSize += cache.size;
    }
    this?.stats?.size = totalSize;
    this?.stats?.inflightRequests = this?.requestDeduplication?.size;
    
    const total = this?.stats?.hits + this?.stats?.misses;
    this?.stats?.hitRate = total > 0 ? (this?.stats?.hits / total) * 100 : 0;
    
    this.emit('stats', this.stats);
  }

  /**
   * Get value from cache with automatic cache selection
   */
  async get<T>(key: string, cacheName?: string): Promise<T | null> {
    const cache = this.selectCache(cacheName || this.detectCacheType(key));
    const entry = cache.get(key);
    
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this?.stats?.hits++;
      this.emit('hit', { cache: cacheName, key });
      return entry.value;
    }
    
    this?.stats?.misses++;
    this.emit('miss', { cache: cacheName, key });
    return null;
  }

  /**
   * Set value in cache with automatic cache selection
   */
  async set<T>(key: string, value: T, options: { ttl?: number; cache?: string } = {}): Promise<void> {
    const cacheName = options.cache || this.detectCacheType(key);
    const cache = this.selectCache(cacheName);
    
    const entry: CacheEntry<T> = {
      value,
      hash: this.generateHash(value),
      accessCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };

    cache.set(key, entry, { ttl: options.ttl });
    this?.stats?.sets++;
    this.emit('set', { cache: cacheName, key });
  }

  /**
   * Request deduplication for expensive operations
   * Prevents multiple identical requests from executing simultaneously
   */
  async deduplicate<T>(
    key: string,
    factory: () => Promise<T>,
    options: { ttl?: number; cache?: string } = {}
  ): Promise<T> {
    // Check if request is already in flight
    const inflightRequest = this?.requestDeduplication?.get(key);
    if (inflightRequest) {
      this?.stats?.deduplicatedRequests++;
      return inflightRequest;
    }

    // Check cache first
    const cached = await this.get<T>(key, options.cache);
    if (cached !== null) {
      return cached;
    }

    // Create new request and store promise
    const requestPromise = factory()
      .then(async (result: any) => {
        await this.set(key, result, options);
        this?.requestDeduplication?.delete(key);
        return result;
      })
      .catch((error: any) => {
        this?.requestDeduplication?.delete(key);
        throw error;
      });

    this?.requestDeduplication?.set(key, requestPromise);
    return requestPromise;
  }

  /**
   * Batch get operations for efficiency
   */
  async batchGet<T>(keys: string[], cacheName?: string): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    for (const key of keys) {
      const value = await this.get<T>(key, cacheName);
      results.set(key, value);
    }
    
    return results;
  }

  /**
   * Batch set operations
   */
  async batchSet<T>(entries: Array<{ key: string; value: T; ttl?: number }>, cacheName?: string): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, { ttl: entry.ttl, cache: cacheName });
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: RegExp, cacheName?: string): Promise<number> {
    let invalidated = 0;
    const caches = cacheName ? [this.selectCache(cacheName)] : Array.from(this?.caches?.values());
    
    for (const cache of caches) {
      for (const key of cache.keys()) {
        if (pattern.test(key)) {
          cache.delete(key);
          invalidated++;
          this?.stats?.deletes++;
        }
      }
    }
    
    this.emit('invalidated', { pattern: pattern.toString(), count: invalidated });
    return invalidated;
  }

  /**
   * Express middleware for caching route responses
   */
  middleware(cacheKey: string | ((req: any) => string), ttl: number = 60) {
    return async (req: any, res: any, next: any) => {
      const key = typeof cacheKey === 'function' ? cacheKey(req) : cacheKey;
      
      // Try to get cached response
      const cached = await this.get(key);
      if (cached) {
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json?.bind(res);
      
      // Override json method to cache response
      res.json = (data: any) => {
        this.set(key, data, { ttl: ttl * 1000 });
        return originalJson(data);
      };

      next();
    };
  }

  /**
   * Detect cache type based on key pattern
   */
  private detectCacheType(key: string): string {
    if (key.includes('price') || key.includes('cost')) return 'pricing';
    if (key.includes('product') || key.includes('item')) return 'products';
    if (key.includes('nlp') || key.includes('intent')) return 'nlp';
    if (key.includes('health')) return 'health';
    if (key.includes('session') || key.includes('user')) return 'session';
    if (key.includes('walmart')) return 'walmart';
    if (key.includes('grocery') || key.includes('food')) return 'grocery';
    if (key.includes('deal') || key.includes('offer')) return 'deals';
    return 'default';
  }

  /**
   * Select or create cache by name
   */
  private selectCache(name: string): LRUCache<string, CacheEntry<any>> {
    let cache = this?.caches?.get(name);
    if (!cache) {
      this.createCache(name);
      cache = this?.caches?.get(name)!;
    }
    return cache;
  }

  /**
   * Generate hash for cache entry
   */
  private generateHash(value: any): string {
    const str = JSON.stringify(value);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { caches: Array<{ name: string; size: number; maxSize: number }> } {
    const cacheStats = Array.from(this?.caches?.entries()).map(([name, cache]) => ({
      name,
      size: cache.size,
      maxSize: cache.max
    }));

    return {
      ...this.stats,
      caches: cacheStats
    };
  }

  /**
   * Clear specific cache or all caches
   */
  async clear(cacheName?: string): Promise<void> {
    if (cacheName) {
      const cache = this?.caches?.get(cacheName);
      if (cache) cache.clear();
    } else {
      for (const cache of this?.caches?.values()) {
        cache.clear();
      }
    }
    this?.requestDeduplication?.clear();
    this.emit('cleared', { cache: cacheName || 'all' });
  }

  /**
   * Warm cache with pre-loaded data
   */
  async warmCache(entries: Array<{ key: string; value: any; ttl?: number; cache?: string }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, { ttl: entry.ttl, cache: entry.cache });
    }
    this.emit('warmed', { count: entries?.length || 0 });
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const cacheService = EnhancedCacheService.getInstance();