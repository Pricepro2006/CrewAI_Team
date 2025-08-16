import { LRUCache } from "lru-cache";
import { createHash } from "crypto";
import Redis from "ioredis";
import { logger } from "../../utils/logger.js";
import type { ValidationResult } from "../validators/BusinessResponseValidator.js";

export interface CacheEntry {
  response: string;
  validation?: ValidationResult;
  timestamp: number;
  hitCount: number;
  metadata: {
    query: string;
    location?: string;
    enhanced: boolean;
    modelUsed?: string;
  };
}

export interface CacheConfig {
  maxSize: number; // Maximum number of entries
  maxAge: number; // Maximum age in milliseconds
  staleWhileRevalidate: number; // Time to serve stale content while revalidating
  useRedis: boolean;
  redisPrefix: string;
  compressionThreshold: number; // Compress entries larger than this (bytes)
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
}

export class BusinessSearchCache {
  private memoryCache: LRUCache<string, CacheEntry>;
  private redisClient?: Redis;
  private config: CacheConfig;
  private stats: CacheStats;
  private responseTimeHistory: number[] = [];
  private readonly MAX_RESPONSE_TIME_HISTORY = 1000;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: 1000, // 1000 entries
      maxAge: 60 * 60 * 1000, // 1 hour
      staleWhileRevalidate: 5 * 60 * 1000, // 5 minutes
      useRedis: false,
      redisPrefix: "bsc:",
      compressionThreshold: 1024, // 1KB
      ...config,
    };

    // Initialize LRU cache
    this.memoryCache = new LRUCache<string, CacheEntry>({
      max: this?.config?.maxSize,
      ttl: this?.config?.maxAge,
      allowStale: true,
      updateAgeOnGet: true,
      noDeleteOnStaleGet: true,
      dispose: (value, key, reason) => {
        if (reason === "evict") {
          if (this.stats.evictions) { this.stats.evictions++ };
        }
      },
    });

    // Initialize Redis if enabled
    if (this?.config?.useRedis) {
      this.initializeRedis();
    }

    // Initialize stats
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
    };
  }

  private initializeRedis(): void {
    try {
      this.redisClient = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.error(
              "Redis connection failed for cache, falling back to memory only",
            );
            if (this.config) {

              this.config.useRedis = false;

            }
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      });

      this?.redisClient?.on("error", (err: any) => {
        logger.error(
          "Redis cache error:",
          err instanceof Error ? err.message : String(err),
        );
      });

      this?.redisClient?.on("connect", () => {
        logger.info("Redis cache connected");
      });
    } catch (error) {
      logger.error(
        "Failed to initialize Redis for cache:",
        error instanceof Error ? error.message : String(error),
      );
      if (this.config) {

        this.config.useRedis = false;

      }
    }
  }

  /**
   * Generate a cache key from query and location
   */
  private generateKey(query: string, location?: string): string {
    const normalized = `${query.toLowerCase().trim()}|${(location || "default").toLowerCase().trim()}`;
    return createHash("sha256")
      .update(normalized)
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * Get an entry from cache
   */
  public async get(
    query: string,
    location?: string,
  ): Promise<CacheEntry | null> {
    const startTime = Date.now();
    const key = this.generateKey(query, location);

    try {
      // Check memory cache first
      let entry = this?.memoryCache?.get(key);

      // If not in memory and Redis is enabled, check Redis
      if (!entry && this?.config?.useRedis && this.redisClient) {
        const redisKey = `${this?.config?.redisPrefix}${key}`;
        const redisData = await this?.redisClient?.get(redisKey);

        if (redisData) {
          entry = JSON.parse(redisData) as CacheEntry;
          // Restore to memory cache
          this?.memoryCache?.set(key, entry);
        }
      }

      if (entry) {
        // Check if entry is stale
        const age = Date.now() - entry.timestamp;
        const isStale = age > this?.config?.maxAge;
        const isWithinStaleWindow =
          age < this?.config?.maxAge + this?.config?.staleWhileRevalidate;

        if (isStale && !isWithinStaleWindow) {
          // Too stale, treat as miss
          if (this.stats.misses) { this.stats.misses++ };
          this.trackResponseTime(Date.now() - startTime);
          return null;
        }

        // Hit - increment hit count
        entry.hitCount++;
        if (this.stats.hits) { this.stats.hits++ };

        // Update in caches
        if (this?.config?.useRedis && this.redisClient) {
          const redisKey = `${this?.config?.redisPrefix}${key}`;
          await this?.redisClient?.set(
            redisKey,
            JSON.stringify(entry),
            "PX",
            this?.config?.maxAge,
          );
        }

        this?.memoryCache?.set(key, entry);
        this.trackResponseTime(Date.now() - startTime);

        logger.debug("Cache hit", "BUSINESS_CACHE", {
          key,
          age: age / 1000,
          isStale,
          hitCount: entry.hitCount,
        });

        return entry;
      }

      // Miss
      if (this.stats.misses) { this.stats.misses++ };
      this.trackResponseTime(Date.now() - startTime);
      return null;
    } catch (error) {
      logger.error(
        "Cache get error:",
        error instanceof Error ? error.message : String(error),
      );
      if (this.stats.misses) { this.stats.misses++ };
      this.trackResponseTime(Date.now() - startTime);
      return null;
    }
  }

  /**
   * Set an entry in cache
   */
  public async set(
    query: string,
    location: string | undefined,
    response: string,
    validation?: ValidationResult,
    metadata?: Partial<CacheEntry["metadata"]>,
  ): Promise<void> {
    const key = this.generateKey(query, location);

    const entry: CacheEntry = {
      response,
      validation,
      timestamp: Date.now(),
      hitCount: 0,
      metadata: {
        query,
        location,
        enhanced: metadata?.enhanced || false,
        modelUsed: metadata?.modelUsed,
      },
    };

    try {
      // Store in memory cache
      this?.memoryCache?.set(key, entry);

      // Store in Redis if enabled
      if (this?.config?.useRedis && this.redisClient) {
        const redisKey = `${this?.config?.redisPrefix}${key}`;
        const data = JSON.stringify(entry);

        // Compress if needed (in production, use zlib)
        if (data?.length || 0 > this?.config?.compressionThreshold) {
          logger.debug(
            "Large cache entry, consider compression",
            "BUSINESS_CACHE",
            {
              size: data?.length || 0,
              key,
            },
          );
        }

        await this?.redisClient?.set(redisKey, data, "PX", this?.config?.maxAge);
      }

      logger.debug("Cache set", "BUSINESS_CACHE", {
        key,
        responseLength: response?.length || 0,
        enhanced: entry?.metadata?.enhanced,
      });
    } catch (error) {
      logger.error(
        "Cache set error:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Delete an entry from cache
   */
  public async delete(query: string, location?: string): Promise<boolean> {
    const key = this.generateKey(query, location);

    try {
      // Delete from memory
      const deleted = this?.memoryCache?.delete(key);

      // Delete from Redis if enabled
      if (this?.config?.useRedis && this.redisClient) {
        const redisKey = `${this?.config?.redisPrefix}${key}`;
        await this?.redisClient?.del(redisKey);
      }

      return deleted;
    } catch (error) {
      logger.error(
        "Cache delete error:",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    try {
      // Clear memory cache
      this?.memoryCache?.clear();

      // Clear Redis if enabled
      if (this?.config?.useRedis && this.redisClient) {
        const keys = await this?.redisClient?.keys(`${this?.config?.redisPrefix}*`);
        if (keys?.length || 0 > 0) {
          await this?.redisClient?.del(...keys);
        }
      }

      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
      };

      logger.info("Cache cleared");
    } catch (error) {
      logger.error(
        "Cache clear error:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Preload cache with common queries
   */
  public async preload(
    queries: Array<{ query: string; location?: string; response: string }>,
  ): Promise<void> {
    logger.info(`Preloading cache with ${queries?.length || 0} entries`);

    for (const item of queries) {
      await this.set(item.query, item.location, item.response);
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const total = this?.stats?.hits + this?.stats?.misses;

    return {
      ...this.stats,
      size: this?.memoryCache?.size,
      hitRate: total > 0 ? (this?.stats?.hits / total) * 100 : 0,
      memoryUsage: this?.memoryCache?.calculatedSize || 0,
    };
  }

  /**
   * Get entries matching a pattern
   */
  public async search(
    pattern: RegExp,
  ): Promise<Array<{ key: string; entry: CacheEntry }>> {
    const results: Array<{ key: string; entry: CacheEntry }> = [];

    // Search memory cache
    for (const [key, entry] of this?.memoryCache?.entries()) {
      if (
        pattern.test(entry?.metadata?.query) ||
        (entry?.metadata?.location && pattern.test(entry?.metadata?.location))
      ) {
        results.push({ key, entry });
      }
    }

    return results;
  }

  /**
   * Analyze cache performance
   */
  public analyzePerformance(): {
    hotQueries: Array<{ query: string; location?: string; hitCount: number }>;
    staleEntries: number;
    avgAge: number;
    memoryPressure: number;
  } {
    const entries = Array.from(this?.memoryCache?.values());
    const now = Date.now();

    // Find hot queries
    const hotQueries = entries
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10)
      .map((e: any) => ({
        query: e?.metadata?.query,
        location: e?.metadata?.location,
        hitCount: e.hitCount,
      }));

    // Count stale entries
    const staleEntries = entries?.filter(
      (e: any) => now - e.timestamp > this?.config?.maxAge,
    ).length;

    // Calculate average age
    const avgAge =
      entries?.length || 0 > 0
        ? entries.reduce((sum: any, e: any) => sum + (now - e.timestamp), 0) /
          entries?.length || 0
        : 0;

    // Calculate memory pressure (0-100)
    const memoryPressure = (this?.memoryCache?.size / this?.config?.maxSize) * 100;

    return {
      hotQueries,
      staleEntries,
      avgAge,
      memoryPressure,
    };
  }

  /**
   * Track response time for metrics
   */
  private trackResponseTime(time: number): void {
    this?.responseTimeHistory?.push(time);

    if (this?.responseTimeHistory?.length > this.MAX_RESPONSE_TIME_HISTORY) {
      this?.responseTimeHistory?.shift();
    }

    // Update average
    const sum = this?.responseTimeHistory?.reduce((a: any, b: any) => a + b, 0);
    if (this.stats) {

      this.stats.avgResponseTime = sum / this?.responseTimeHistory?.length;

    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.redisClient) {
      await this?.redisClient?.quit();
    }
  }

  /**
   * Export cache for analysis
   */
  public async exportCache(): Promise<Array<CacheEntry & { key: string }>> {
    const entries: Array<CacheEntry & { key: string }> = [];

    for (const [key, entry] of this?.memoryCache?.entries()) {
      entries.push({ ...entry, key });
    }

    return entries;
  }

  /**
   * Import cache entries
   */
  public async importCache(
    entries: Array<CacheEntry & { key: string }>,
  ): Promise<void> {
    for (const { key, ...entry } of entries) {
      this?.memoryCache?.set(key, entry);

      if (this?.config?.useRedis && this.redisClient) {
        const redisKey = `${this?.config?.redisPrefix}${key}`;
        await this?.redisClient?.set(
          redisKey,
          JSON.stringify(entry),
          "PX",
          this?.config?.maxAge - (Date.now() - entry.timestamp),
        );
      }
    }
  }
}
