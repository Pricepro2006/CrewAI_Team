/**
 * Comprehensive Redis Cache Manager for CrewAI Team
 * 
 * Features:
 * - Cache-aside pattern with TTL management
 * - Distributed cache invalidation strategies
 * - Cache warming and monitoring
 * - Compression for large values
 * - Circuit breaker for Redis failures
 * - Performance metrics and monitoring
 */

import Redis from 'ioredis';
import { redisClient } from '../../config/redis.config.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import { CircuitBreaker } from '../resilience/CircuitBreaker.js';
import { z } from 'zod';
import crypto from 'crypto';
import { promisify } from 'util';
import zlib from 'zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Cache configuration schema
const CacheConfigSchema = z.object({
  ttl: z.number().min(1).max(86400 * 30), // 1 second to 30 days
  compress: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  namespace: z.string().optional().default('default'),
  invalidationStrategy: z.enum(['time', 'manual', 'dependency']).optional().default('time'),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export interface CacheStats {
  totalKeys: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  avgResponseTime: number;
}

export interface CacheMetrics {
  key: string;
  hits: number;
  misses: number;
  lastAccessed: Date;
  size: number;
  ttl: number;
}

export interface CacheWarmingConfig {
  keys: string[];
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
}

/**
 * Centralized Redis Cache Manager
 */
export class RedisCacheManager {
  private static instance: RedisCacheManager | null = null;
  private redis: Redis;
  private circuitBreaker: CircuitBreaker;
  private metricsCollector: Map<string, CacheMetrics> = new Map();
  private defaultTTL: number = 3600; // 1 hour
  private compressionThreshold: number = 1024; // Compress values > 1KB
  private keyPrefixes = {
    data: 'cache:data:',
    session: 'cache:session:',
    user: 'cache:user:',
    llm: 'cache:llm:',
    query: 'cache:query:',
    analytics: 'cache:analytics:',
    tags: 'cache:tags:',
    locks: 'cache:locks:',
  };

  private constructor() {
    this.redis = redisClient;
    this.circuitBreaker = new CircuitBreaker('redis-cache', {
      failureThreshold: 5,
      resetTimeout: 30000,
      timeout: 5000,
    });

    this.setupErrorHandling();
    this.startMetricsCollection();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RedisCacheManager {
    if (!RedisCacheManager.instance) {
      RedisCacheManager.instance = new RedisCacheManager();
    }
    return RedisCacheManager.instance;
  }

  /**
   * Set a value in cache with configuration
   */
  async set<T>(
    key: string,
    value: T,
    config: Partial<CacheConfig> = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const validatedConfig = CacheConfigSchema.parse({
        ttl: this.defaultTTL,
        ...config,
      });

      const fullKey = this.buildKey(key, validatedConfig.namespace);
      let serializedValue = JSON.stringify(value);

      // Compress large values
      if (validatedConfig.compress && serializedValue.length > this.compressionThreshold) {
        const compressed = await gzip(Buffer.from(serializedValue));
        serializedValue = `compressed:${compressed.toString('base64')}`;
      }

      const result = await this.circuitBreaker.execute(async () => {
        if (validatedConfig.ttl > 0) {
          return await this.redis.setex(fullKey, validatedConfig.ttl, serializedValue);
        } else {
          return await this.redis.set(fullKey, serializedValue);
        }
      });

      // Store tags for invalidation
      if (validatedConfig.tags.length > 0) {
        await this.storeTags(fullKey, validatedConfig.tags);
      }

      // Update metrics
      this.updateMetrics(key, 'set', Date.now() - startTime);
      metrics.increment('cache.set.success');
      metrics.histogram('cache.set.duration', Date.now() - startTime);

      logger.debug('Cache set successful', 'CACHE_MANAGER', {
        key: fullKey,
        ttl: validatedConfig.ttl,
        compressed: validatedConfig.compress,
        size: serializedValue.length,
      });

      return result === 'OK';
    } catch (error) {
      logger.error('Cache set failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      metrics.increment('cache.set.error');
      return false;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, namespace: string = 'default'): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const fullKey = this.buildKey(key, namespace);
      
      const result = await this.circuitBreaker.execute(async () => {
        return await this.redis.get(fullKey);
      });

      if (result === null) {
        this.updateMetrics(key, 'miss', Date.now() - startTime);
        metrics.increment('cache.miss');
        return null;
      }

      let value = result;

      // Decompress if needed
      if (value.startsWith('compressed:')) {
        const compressedData = Buffer.from(value.slice(11), 'base64');
        const decompressed = await gunzip(compressedData);
        value = decompressed.toString();
      }

      const parsedValue = JSON.parse(value) as T;

      // Update metrics
      this.updateMetrics(key, 'hit', Date.now() - startTime);
      metrics.increment('cache.hit');
      metrics.histogram('cache.get.duration', Date.now() - startTime);

      logger.debug('Cache hit', 'CACHE_MANAGER', {
        key: fullKey,
        size: value.length,
      });

      return parsedValue;
    } catch (error) {
      logger.error('Cache get failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      metrics.increment('cache.get.error');
      return null;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[], namespace: string = 'default'): Promise<Map<string, T>> {
    const startTime = Date.now();
    const results = new Map<string, T>();
    
    try {
      const fullKeys = keys.map(key => this.buildKey(key, namespace));
      
      const values = await this.circuitBreaker.execute(async () => {
        return await this.redis.mget(...fullKeys);
      });

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = values[i];

        if (value !== null) {
          try {
            let parsedValue = value;

            // Decompress if needed
            if (value.startsWith('compressed:')) {
              const compressedData = Buffer.from(value.slice(11), 'base64');
              const decompressed = await gunzip(compressedData);
              parsedValue = decompressed.toString();
            }

            results.set(key, JSON.parse(parsedValue) as T);
            this.updateMetrics(key, 'hit', Date.now() - startTime);
          } catch (parseError) {
            logger.warn('Failed to parse cached value', 'CACHE_MANAGER', {
              key,
              error: parseError instanceof Error ? parseError.message : String(parseError),
            });
            this.updateMetrics(key, 'miss', Date.now() - startTime);
          }
        } else {
          this.updateMetrics(key, 'miss', Date.now() - startTime);
        }
      }

      metrics.increment('cache.mget.success');
      metrics.histogram('cache.mget.duration', Date.now() - startTime);

      return results;
    } catch (error) {
      logger.error('Cache mget failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        keys,
      });
      metrics.increment('cache.mget.error');
      return results;
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string, namespace: string = 'default'): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      
      const result = await this.circuitBreaker.execute(async () => {
        return await this.redis.del(fullKey);
      });

      // Remove from tags
      await this.removeFromTags(fullKey);

      metrics.increment('cache.del.success');
      logger.debug('Cache key deleted', 'CACHE_MANAGER', { key: fullKey });

      return result > 0;
    } catch (error) {
      logger.error('Cache delete failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      metrics.increment('cache.del.error');
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;
    
    try {
      for (const tag of tags) {
        const tagKey = `${this.keyPrefixes.tags}${tag}`;
        const keys = await this.redis.smembers(tagKey);
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
          
          // Remove the tag set
          await this.redis.del(tagKey);
        }
      }

      metrics.increment('cache.invalidate.success');
      logger.info('Cache invalidated by tags', 'CACHE_MANAGER', {
        tags,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Cache invalidation by tags failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        tags,
      });
      metrics.increment('cache.invalidate.error');
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string, namespace: string = 'default'): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, namespace);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const deletedCount = await this.redis.del(...keys);

      // Remove from tags
      await Promise.all(keys.map(key => this.removeFromTags(key)));

      metrics.increment('cache.invalidate_pattern.success');
      logger.info('Cache invalidated by pattern', 'CACHE_MANAGER', {
        pattern: fullPattern,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Cache invalidation by pattern failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        pattern,
      });
      metrics.increment('cache.invalidate_pattern.error');
      return 0;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number, namespace: string = 'default'): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await this.redis.expire(fullKey, ttl);
      
      metrics.increment('cache.expire.success');
      return result === 1;
    } catch (error) {
      logger.error('Cache expire failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      metrics.increment('cache.expire.error');
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, namespace: string = 'default'): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists check failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('stats');
      const memory = await this.redis.info('memory');
      
      // Parse Redis stats
      const statsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const memoryMatch = memory.match(/used_memory:(\d+)/);
      
      const hits = statsMatch ? parseInt(statsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missMatch[1]) : 0;
      const total = hits + misses;
      
      // Calculate metrics from our collector
      const totalResponseTime = Array.from(this.metricsCollector.values())
        .reduce((sum, metric) => sum + (metric.hits + metric.misses), 0);
      
      const avgResponseTime = totalResponseTime > 0 
        ? Array.from(this.metricsCollector.values())
            .reduce((sum, metric) => sum + metric.lastAccessed.getTime(), 0) / totalResponseTime
        : 0;

      return {
        totalKeys: await this.redis.dbsize(),
        hitRate: total > 0 ? (hits / total) * 100 : 0,
        missRate: total > 0 ? (misses / total) * 100 : 0,
        totalHits: hits,
        totalMisses: misses,
        memoryUsage: memoryMatch ? parseInt(memoryMatch[1]) : 0,
        avgResponseTime: avgResponseTime / 1000, // Convert to seconds
      };
    } catch (error) {
      logger.error('Failed to get cache stats', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        totalKeys: 0,
        hitRate: 0,
        missRate: 0,
        totalHits: 0,
        totalMisses: 0,
        memoryUsage: 0,
        avgResponseTime: 0,
      };
    }
  }

  /**
   * Warm cache with data
   */
  async warmCache(config: CacheWarmingConfig, dataProvider: (keys: string[]) => Promise<Map<string, any>>): Promise<number> {
    let warmedCount = 0;
    
    try {
      // Process keys in batches
      for (let i = 0; i < config.keys.length; i += config.batchSize) {
        const batch = config.keys.slice(i, i + config.batchSize);
        
        try {
          const data = await dataProvider(batch);
          
          // Store data in cache
          const promises = Array.from(data.entries()).map(async ([key, value]) => {
            const success = await this.set(key, value, { ttl: this.defaultTTL });
            if (success) warmedCount++;
          });
          
          await Promise.all(promises);
        } catch (batchError) {
          logger.warn('Cache warming batch failed', 'CACHE_MANAGER', {
            batch,
            error: batchError instanceof Error ? batchError.message : String(batchError),
          });
        }
      }

      logger.info('Cache warming completed', 'CACHE_MANAGER', {
        totalKeys: config.keys.length,
        warmedCount,
        successRate: (warmedCount / config.keys.length) * 100,
      });

      return warmedCount;
    } catch (error) {
      logger.error('Cache warming failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
      });
      return warmedCount;
    }
  }

  /**
   * Distributed lock implementation
   */
  async acquireLock(
    lockKey: string,
    ttl: number = 30,
    timeout: number = 10000
  ): Promise<string | null> {
    const lockValue = crypto.randomUUID();
    const fullKey = `${this.keyPrefixes.locks}${lockKey}`;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.redis.set(fullKey, lockValue, 'PX', ttl * 1000, 'NX');
        
        if (result === 'OK') {
          logger.debug('Lock acquired', 'CACHE_MANAGER', {
            lockKey: fullKey,
            lockValue,
            ttl,
          });
          return lockValue;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Lock acquisition failed', 'CACHE_MANAGER', {
          error: error instanceof Error ? error.message : String(error),
          lockKey,
        });
        break;
      }
    }

    return null;
  }

  /**
   * Release distributed lock
   */
  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    const fullKey = `${this.keyPrefixes.locks}${lockKey}`;
    
    try {
      // Lua script to atomically check and delete
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(luaScript, 1, fullKey, lockValue);
      
      logger.debug('Lock released', 'CACHE_MANAGER', {
        lockKey: fullKey,
        lockValue,
        success: result === 1,
      });

      return result === 1;
    } catch (error) {
      logger.error('Lock release failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        lockKey,
      });
      return false;
    }
  }

  /**
   * Clear all cache data
   */
  async clear(namespace?: string): Promise<boolean> {
    try {
      if (namespace) {
        const pattern = this.buildKey('*', namespace);
        const keys = await this.redis.keys(pattern);
        
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        
        logger.info('Cache namespace cleared', 'CACHE_MANAGER', {
          namespace,
          keysDeleted: keys.length,
        });
      } else {
        await this.redis.flushdb();
        logger.info('All cache cleared', 'CACHE_MANAGER');
      }

      this.metricsCollector.clear();
      metrics.increment('cache.clear.success');
      
      return true;
    } catch (error) {
      logger.error('Cache clear failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
        namespace,
      });
      metrics.increment('cache.clear.error');
      return false;
    }
  }

  // Private helper methods

  private buildKey(key: string, namespace: string): string {
    return `${this.keyPrefixes.data}${namespace}:${key}`;
  }

  private async storeTags(key: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `${this.keyPrefixes.tags}${tag}`;
        await this.redis.sadd(tagKey, key);
      }
    } catch (error) {
      logger.warn('Failed to store cache tags', 'CACHE_MANAGER', {
        key,
        tags,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async removeFromTags(key: string): Promise<void> {
    try {
      // Find all tag sets containing this key
      const tagKeys = await this.redis.keys(`${this.keyPrefixes.tags}*`);
      
      for (const tagKey of tagKeys) {
        await this.redis.srem(tagKey, key);
      }
    } catch (error) {
      logger.warn('Failed to remove key from tags', 'CACHE_MANAGER', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private updateMetrics(key: string, operation: 'hit' | 'miss' | 'set', duration: number): void {
    const metric = this.metricsCollector.get(key) || {
      key,
      hits: 0,
      misses: 0,
      lastAccessed: new Date(),
      size: 0,
      ttl: 0,
    };

    if (operation === 'hit') {
      metric.hits++;
    } else if (operation === 'miss') {
      metric.misses++;
    }

    metric.lastAccessed = new Date();
    this.metricsCollector.set(key, metric);

    // Limit metrics collection to prevent memory leaks
    if (this.metricsCollector.size > 10000) {
      const oldestKeys = Array.from(this.metricsCollector.entries())
        .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime())
        .slice(0, 1000)
        .map(([key]) => key);
      
      oldestKeys.forEach(key => this.metricsCollector.delete(key));
    }
  }

  private setupErrorHandling(): void {
    this.redis.on('error', (error) => {
      logger.error('Redis cache error', 'CACHE_MANAGER', {
        error: error.message,
        stack: error.stack,
      });
      metrics.increment('cache.redis.error');
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis cache reconnecting', 'CACHE_MANAGER');
      metrics.increment('cache.redis.reconnecting');
    });
  }

  private startMetricsCollection(): void {
    // Periodically report cache metrics
    setInterval(async () => {
      try {
        const stats = await this.getStats();
        
        metrics.gauge('cache.hit_rate', stats.hitRate);
        metrics.gauge('cache.miss_rate', stats.missRate);
        metrics.gauge('cache.total_keys', stats.totalKeys);
        metrics.gauge('cache.memory_usage', stats.memoryUsage);
        metrics.gauge('cache.avg_response_time', stats.avgResponseTime);
      } catch (error) {
        logger.warn('Failed to collect cache metrics', 'CACHE_MANAGER', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 60000); // Every minute
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      await this.redis.quit();
      RedisCacheManager.instance = null;
      logger.info('Cache manager shutdown complete', 'CACHE_MANAGER');
    } catch (error) {
      logger.error('Cache manager shutdown failed', 'CACHE_MANAGER', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const cacheManager = RedisCacheManager.getInstance();