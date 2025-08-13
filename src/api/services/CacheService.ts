/**
 * Cache Service - High-performance caching layer with Redis
 * Implements multi-tier caching strategy for API optimization
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

export interface CacheConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  ttl: {
    default: number;
    products: number;
    prices: number;
    userHistory: number;
    searchResults: number;
    analytics: number;
  };
  memory?: {
    maxSize: number; // MB
    checkPeriod: number; // ms
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export class CacheService {
  private static instance: CacheService;
  private redisClient?: RedisClientType;
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private isRedisAvailable: boolean = false;
  private memorySizeBytes: number = 0;
  private readonly MAX_MEMORY_SIZE: number;

  private constructor(config?: Partial<CacheConfig>) {
    this.config = {
      redis: config?.redis || {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      },
      ttl: {
        default: config?.ttl?.default || 300, // 5 minutes
        products: config?.ttl?.products || 3600, // 1 hour
        prices: config?.ttl?.prices || 60, // 1 minute (real-time prices)
        userHistory: config?.ttl?.userHistory || 1800, // 30 minutes
        searchResults: config?.ttl?.searchResults || 600, // 10 minutes
        analytics: config?.ttl?.analytics || 86400 // 24 hours
      },
      memory: config?.memory || {
        maxSize: 100, // 100MB
        checkPeriod: 60000 // 1 minute
      }
    };

    this.MAX_MEMORY_SIZE = (this.config.memory?.maxSize || 100) * 1024 * 1024;
    this.initializeRedis();
    this.startMemoryManagement();
  }

  static getInstance(config?: Partial<CacheConfig>): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(config);
    }
    return CacheService.instance;
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createClient({
        socket: {
          host: this.config.redis?.host,
          port: this.config.redis?.port
        },
        password: this.config.redis?.password,
        database: this.config.redis?.db
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis error', 'CACHE_SERVICE', { error: err });
        this.isRedisAvailable = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis connected', 'CACHE_SERVICE');
        this.isRedisAvailable = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.warn('Redis not available, falling back to memory cache', 'CACHE_SERVICE', { error });
      this.isRedisAvailable = false;
    }
  }

  /**
   * Start memory management for in-memory cache
   */
  private startMemoryManagement(): void {
    setInterval(() => {
      this.evictExpiredEntries();
      this.enforceMemoryLimit();
    }, this.config.memory?.checkPeriod || 60000);
  }

  /**
   * Generate cache key
   */
  private generateKey(namespace: string, identifier: string | object): string {
    const id = typeof identifier === 'object' 
      ? crypto.createHash('md5').update(JSON.stringify(identifier)).digest('hex')
      : identifier;
    return `${namespace}:${id}`;
  }

  /**
   * Get from cache (Redis first, then memory)
   */
  async get<T>(namespace: string, identifier: string | object): Promise<T | null> {
    const key = this.generateKey(namespace, identifier);
    
    try {
      // Try Redis first
      if (this.isRedisAvailable && this.redisClient) {
        const cached = await this.redisClient.get(key);
        if (cached) {
          const entry: CacheEntry<T> = JSON.parse(cached);
          
          // Check if expired
          if (Date.now() - entry.timestamp > entry.ttl * 1000) {
            await this.redisClient.del(key);
            return null;
          }
          
          // Update hit count
          entry.hits++;
          await this.redisClient.setEx(key, entry.ttl, JSON.stringify(entry));
          
          logger.debug('Cache hit (Redis)', 'CACHE_SERVICE', { key, hits: entry.hits });
          return entry.data;
        }
      }

      // Fallback to memory cache
      const memEntry = this.memoryCache.get(key);
      if (memEntry) {
        // Check if expired
        if (Date.now() - memEntry.timestamp > memEntry.ttl * 1000) {
          this.memoryCache.delete(key);
          return null;
        }
        
        memEntry.hits++;
        logger.debug('Cache hit (Memory)', 'CACHE_SERVICE', { key, hits: memEntry.hits });
        return memEntry.data as T;
      }

      return null;
    } catch (error) {
      logger.error('Cache get error', 'CACHE_SERVICE', { error, key });
      return null;
    }
  }

  /**
   * Set in cache (both Redis and memory)
   */
  async set<T>(
    namespace: string, 
    identifier: string | object, 
    data: T, 
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey(namespace, identifier);
    const finalTtl = ttl || this.getTTLForNamespace(namespace);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: finalTtl,
      hits: 0
    };

    try {
      // Store in Redis if available
      if (this.isRedisAvailable && this.redisClient) {
        await this.redisClient.setEx(key, finalTtl, JSON.stringify(entry));
      }

      // Also store in memory cache
      const dataSize = this.estimateSize(entry);
      this.memoryCache.set(key, entry);
      this.memorySizeBytes += dataSize;
      
      logger.debug('Cache set', 'CACHE_SERVICE', { key, ttl: finalTtl, size: dataSize });
    } catch (error) {
      logger.error('Cache set error', 'CACHE_SERVICE', { error, key });
    }
  }

  /**
   * Delete from cache
   */
  async delete(namespace: string, identifier: string | object): Promise<void> {
    const key = this.generateKey(namespace, identifier);
    
    try {
      if (this.isRedisAvailable && this.redisClient) {
        await this.redisClient.del(key);
      }
      
      const entry = this.memoryCache.get(key);
      if (entry) {
        this.memorySizeBytes -= this.estimateSize(entry);
        this.memoryCache.delete(key);
      }
      
      logger.debug('Cache delete', 'CACHE_SERVICE', { key });
    } catch (error) {
      logger.error('Cache delete error', 'CACHE_SERVICE', { error, key });
    }
  }

  /**
   * Clear entire namespace
   */
  async clearNamespace(namespace: string): Promise<void> {
    try {
      const pattern = `${namespace}:*`;
      
      // Clear from Redis
      if (this.isRedisAvailable && this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }
      
      // Clear from memory
      for (const [key, entry] of this.memoryCache.entries()) {
        if (key.startsWith(`${namespace}:`)) {
          this.memorySizeBytes -= this.estimateSize(entry);
          this.memoryCache.delete(key);
        }
      }
      
      logger.info('Namespace cleared', 'CACHE_SERVICE', { namespace });
    } catch (error) {
      logger.error('Clear namespace error', 'CACHE_SERVICE', { error, namespace });
    }
  }

  /**
   * Cache wrapper for async functions
   */
  async cacheable<T>(
    namespace: string,
    identifier: string | object,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(namespace, identifier);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(namespace, identifier, result, ttl);
    return result;
  }

  /**
   * Batch get from cache
   */
  async batchGet<T>(
    namespace: string,
    identifiers: string[]
  ): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    // Use Redis pipeline if available
    if (this.isRedisAvailable && this.redisClient) {
      const pipeline = this.redisClient.multi();
      const keys = identifiers.map(id => this.generateKey(namespace, id));
      
      keys.forEach(key => pipeline.get(key));
      
      try {
        const replies = await pipeline.exec();
        identifiers.forEach((id, index) => {
          const cached = replies[index];
          if (cached) {
            const entry: CacheEntry<T> = JSON.parse(cached as string);
            if (Date.now() - entry.timestamp <= entry.ttl * 1000) {
              results.set(id, entry.data);
            } else {
              results.set(id, null);
            }
          } else {
            results.set(id, null);
          }
        });
      } catch (error) {
        logger.error('Batch get error', 'CACHE_SERVICE', { error });
      }
    } else {
      // Fallback to memory cache
      for (const id of identifiers) {
        const result = await this.get<T>(namespace, id);
        results.set(id, result);
      }
    }
    
    return results;
  }

  /**
   * Get TTL for namespace
   */
  private getTTLForNamespace(namespace: string): number {
    const ttlMap: { [key: string]: number } = {
      'product': this.config.ttl.products,
      'price': this.config.ttl.prices,
      'history': this.config.ttl.userHistory,
      'search': this.config.ttl.searchResults,
      'analytics': this.config.ttl.analytics
    };
    
    for (const [key, value] of Object.entries(ttlMap)) {
      if (namespace.includes(key)) {
        return value;
      }
    }
    
    return this.config.ttl.default;
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate (2 bytes per char)
  }

  /**
   * Evict expired entries from memory cache
   */
  private evictExpiredEntries(): void {
    const now = Date.now();
    let evicted = 0;
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.memorySizeBytes -= this.estimateSize(entry);
        this.memoryCache.delete(key);
        evicted++;
      }
    }
    
    if (evicted > 0) {
      logger.debug('Evicted expired entries', 'CACHE_SERVICE', { count: evicted });
    }
  }

  /**
   * Enforce memory limit using LRU eviction
   */
  private enforceMemoryLimit(): void {
    if (this.memorySizeBytes <= this.MAX_MEMORY_SIZE) {
      return;
    }
    
    // Sort by least recently used (timestamp + hits consideration)
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => {
        const scoreA = a[1].timestamp + (a[1].hits * 60000); // 1 hit = 1 minute bonus
        const scoreB = b[1].timestamp + (b[1].hits * 60000);
        return scoreA - scoreB;
      });
    
    let evicted = 0;
    for (const [key, entry] of entries) {
      if (this.memorySizeBytes <= this.MAX_MEMORY_SIZE * 0.9) { // Keep 10% buffer
        break;
      }
      
      this.memorySizeBytes -= this.estimateSize(entry);
      this.memoryCache.delete(key);
      evicted++;
    }
    
    if (evicted > 0) {
      logger.info('Memory limit enforced', 'CACHE_SERVICE', { 
        evicted, 
        currentSize: this.memorySizeBytes,
        maxSize: this.MAX_MEMORY_SIZE 
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    redis: boolean;
    memoryEntries: number;
    memorySize: number;
    hitRate?: number;
  }> {
    const stats = {
      redis: this.isRedisAvailable,
      memoryEntries: this.memoryCache.size,
      memorySize: this.memorySizeBytes,
      hitRate: 0
    };
    
    // Calculate hit rate from memory cache
    let totalHits = 0;
    let totalEntries = 0;
    
    for (const entry of this.memoryCache.values()) {
      totalHits += entry.hits;
      totalEntries++;
    }
    
    if (totalEntries > 0) {
      stats.hitRate = totalHits / totalEntries;
    }
    
    return stats;
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    this.memoryCache.clear();
    logger.info('Cache service shutdown', 'CACHE_SERVICE');
  }
}

export default CacheService;