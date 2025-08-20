/**
 * Query Cache Implementation
 *
 * Provides Redis-based caching for query results to improve performance
 * and reduce processing time for repeated queries.
 */

import Redis from "ioredis";
import crypto from "crypto";
import { logger } from "../../utils/logger.js";

interface CacheConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTTL?: number;
  maxRetries?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  key: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
  hitRate: number;
}

export class QueryCache {
  private redis: Redis | null = null;
  private config: Required<CacheConfig>;
  private stats: CacheStats;
  private enabled: boolean = false;

  constructor(config: CacheConfig = {}) {
    this.config = {
      host: config.host || "localhost",
      port: config.port || 6379,
      password: config.password || "",
      db: config.db || 0,
      keyPrefix: config.keyPrefix || "query:",
      defaultTTL: config.defaultTTL || 3600, // 1 hour
      maxRetries: config.maxRetries || 3,
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
      hitRate: 0,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.redis = new Redis({
        host: this?.config?.host,
        port: this?.config?.port,
        password: this?.config?.password || undefined,
        db: this?.config?.db,
        maxRetriesPerRequest: this?.config?.maxRetries,
        lazyConnect: true,
        reconnectOnError: (err: any) => {
          const targetError = "READONLY";
          return err?.message?.includes(targetError);
        },
      });

      // Test connection
      await this?.redis.connect();
      await this?.redis.ping();

      this.enabled = true;
      logger.info("Query cache initialized successfully", "QUERY_CACHE", {
        host: this?.config?.host,
        port: this?.config?.port,
        db: this?.config?.db,
      });

      // Set up event handlers
      this?.redis.on("error", (error: any) => {
        if (this.stats.errors) { this.stats.errors++ };
        logger.error(
          "Redis connection error",
          "QUERY_CACHE",
          undefined,
          error as Error,
        );
        this.enabled = false;
      });

      this?.redis.on("connect", () => {
        logger.info("Redis cache connected", "QUERY_CACHE");
        this.enabled = true;
      });

      this?.redis.on("close", () => {
        logger.warn("Redis cache disconnected", "QUERY_CACHE");
        this.enabled = false;
      });
    } catch (error) {
      logger.warn(
        "Failed to initialize query cache, running without cache",
        "QUERY_CACHE",
        { error: (error as Error).message },
      );
      this.enabled = false;
    }
  }

  /**
   * Get cached query result
   */
  async get<T = any>(
    query: string,
    context?: Record<string, any>,
  ): Promise<T | null> {
    if (!this.enabled || !this.redis) {
      return null;
    }

    try {
      const key = this.generateKey(query, context);
      const cached = await this?.redis.get(key);

      if (!cached) {
        if (this.stats.misses) { this.stats.misses++ };
        this.updateHitRate();
        return null;
      }

      const entry: CacheEntry = JSON.parse(cached);

      // Check if entry has expired (additional check)
      if (Date.now() > entry.timestamp + entry.ttl * 1000) {
        await this?.redis.del(key);
        if (this.stats.misses) { this.stats.misses++ };
        this.updateHitRate();
        return null;
      }

      if (this.stats.hits) { this.stats.hits++ };
      this.updateHitRate();

      logger.debug("Cache hit", "QUERY_CACHE", {
        key: key.substring(0, 20) + "...",
        age: Date.now() - entry.timestamp,
      });

      return entry.data;
    } catch (error) {
      if (this.stats.errors) { this.stats.errors++ };
      logger.error("Cache get error", "QUERY_CACHE", undefined, error as Error);
      return null;
    }
  }

  /**
   * Cache query result
   */
  async set(
    query: string,
    data: any,
    ttl?: number,
    context?: Record<string, any>,
  ): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const key = this.generateKey(query, context);
      const effectiveTTL = ttl || this?.config?.defaultTTL;

      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        ttl: effectiveTTL,
        key,
      };

      await this?.redis.setex(key, effectiveTTL, JSON.stringify(entry));
      if (this.stats.sets) { this.stats.sets++ };

      logger.debug("Cache set", "QUERY_CACHE", {
        key: key.substring(0, 20) + "...",
        ttl: effectiveTTL,
        dataSize: JSON.stringify(data).length,
      });
    } catch (error) {
      if (this.stats.errors) { this.stats.errors++ };
      logger.error("Cache set error", "QUERY_CACHE", undefined, error as Error);
    }
  }

  /**
   * Clear specific cache entry
   */
  async clear(query: string, context?: Record<string, any>): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const key = this.generateKey(query, context);
      await this?.redis.del(key);

      logger.debug("Cache cleared", "QUERY_CACHE", {
        key: key.substring(0, 20) + "...",
      });
    } catch (error) {
      if (this.stats.errors) { this.stats.errors++ };
      logger.error(
        "Cache clear error",
        "QUERY_CACHE",
        undefined,
        error as Error,
      );
    }
  }

  /**
   * Clear all query cache entries
   */
  async clearAll(): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const pattern = this?.config?.keyPrefix + "*";
      const keys = await this?.redis.keys(pattern);

      if (keys?.length || 0 > 0) {
        await this?.redis.del(...keys);
        logger.info("All query cache cleared", "QUERY_CACHE", {
          keysDeleted: keys?.length || 0,
        });
      }
    } catch (error) {
      if (this.stats.errors) { this.stats.errors++ };
      logger.error(
        "Cache clear all error",
        "QUERY_CACHE",
        undefined,
        error as Error,
      );
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Check if cache is enabled and connected
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get cache health status
   */
  async getHealth(): Promise<{
    status: string;
    latency?: number;
    error?: string;
  }> {
    if (!this.enabled || !this.redis) {
      return { status: "disabled" };
    }

    try {
      const start = Date.now();
      await this?.redis.ping();
      const latency = Date.now() - start;

      return {
        status: "healthy",
        latency,
      };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate cache key from query and context
   */
  private generateKey(query: string, context?: Record<string, any>): string {
    const contextStr = context
      ? JSON.stringify(context, Object.keys(context).sort())
      : "";
    const combined = query + contextStr;
    const hash = crypto.createHash("md5").update(combined).digest("hex");
    return this?.config?.keyPrefix + hash;
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this?.stats?.hits + this?.stats?.misses;
    if (this.stats) {

      this.stats.hitRate = total > 0 ? (this?.stats?.hits / total) * 100 : 0;

    }
  }

  /**
   * Cleanup and close connections
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this?.redis.quit();
      this.redis = null;
      this.enabled = false;
      logger.info("Query cache closed", "QUERY_CACHE");
    }
  }
}

// Singleton instance
let queryCache: QueryCache | null = null;

/**
 * Get global query cache instance
 */
export function getQueryCache(): QueryCache {
  if (!queryCache) {
    queryCache = new QueryCache();
  }
  return queryCache;
}
