import Redis from "ioredis";
import { logger } from "../../utils/logger.js";

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryStrategy?: (times: number) => number | void;
}

export class RedisService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor(config?: Partial<RedisConfig>) {
    const defaultConfig: RedisConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
      retryStrategy: (times: any) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(
          `Redis connection attempt ${times}, retrying in ${delay}ms`,
          "REDIS",
        );
        return delay;
      },
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.client = new Redis(finalConfig);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.client) {
      logger.error("Redis client not initialized", "REDIS");
      return;
    }

    this.client.on("connect", () => {
      this.isConnected = true;
      logger.info("Redis connected successfully", "REDIS");
    });

    this.client.on("error", (error: any) => {
      this.isConnected = false;
      logger.error("Redis connection error", "REDIS", { error: error?.message || 'Unknown error' });
    });

    this.client.on("close", () => {
      this.isConnected = false;
      logger.warn("Redis connection closed", "REDIS");
    });

    this.client.on("reconnecting", () => {
      logger.info("Redis reconnecting...", "REDIS");
    });
  }

  /**
   * Set a value in Redis with optional TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      logger.debug(`Set cache key: ${key}`, "REDIS");
    } catch (error) {
      logger.error(`Failed to set cache key: ${key}`, "REDIS", { error });
      throw error;
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Failed to get cache key: ${key}`, "REDIS", { error });
      throw error;
    }
  }

  /**
   * Delete a key from Redis
   */
  async delete(key: string): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      await this.client.del(key);
      logger.debug(`Deleted cache key: ${key}`, "REDIS");
    } catch (error) {
      logger.error(`Failed to delete cache key: ${key}`, "REDIS", { error });
      throw error;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      const keys = await this.client.keys(pattern);
      if (keys && keys.length > 0) {
        await this.client.del(...keys);
        logger.debug(
          `Deleted ${keys.length} keys matching pattern: ${pattern}`,
          "REDIS",
        );
      }
    } catch (error) {
      logger.error(`Failed to delete keys with pattern: ${pattern}`, "REDIS", {
        error,
      });
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to check existence of key: ${key}`, "REDIS", {
        error,
      });
      throw error;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Failed to get TTL for key: ${key}`, "REDIS", { error });
      throw error;
    }
  }

  /**
   * Cache with fallback - tries to get from cache, falls back to loader function
   */
  async cacheWithFallback<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        logger.debug(`Cache hit for key: ${key}`, "REDIS");
        return cached;
      }

      // Cache miss - load data
      logger.debug(`Cache miss for key: ${key}`, "REDIS");
      const data = await loader();

      // Store in cache
      await this.set(key, data, ttlSeconds);

      return data;
    } catch (error) {
      logger.error(`Cache with fallback failed for key: ${key}`, "REDIS", {
        error,
      });
      // If Redis fails, still return the loaded data
      return await loader();
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, by: number = 1): Promise<number> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      return await this.client.incrby(key, by);
    } catch (error) {
      logger.error(`Failed to increment key: ${key}`, "REDIS", { error });
      throw error;
    }
  }

  /**
   * Set key expiration time
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to set expiration for key: ${key}`, "REDIS", { error });
      throw error;
    }
  }

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: any): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      await this.client.hset(key, field, JSON.stringify(value));
    } catch (error) {
      logger.error(`Failed to set hash field: ${key}.${field}`, "REDIS", {
        error,
      });
      throw error;
    }
  }

  /**
   * Get hash field
   */
  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      const value = await this.client.hget(key, field);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Failed to get hash field: ${key}.${field}`, "REDIS", {
        error,
      });
      throw error;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall<T>(key: string): Promise<Record<string, T>> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      const hash = await this.client.hgetall(key);
      const result: Record<string, T> = {};

      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value) as T;
      }

      return result;
    } catch (error) {
      logger.error(`Failed to get all hash fields: ${key}`, "REDIS", { error });
      throw error;
    }
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client && this.client.status === "ready";
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (!this.client) {
      logger.warn("Redis client not initialized, nothing to close", "REDIS");
      return;
    }
    try {
      await this.client.quit();
      logger.info("Redis connection closed", "REDIS");
    } catch (error) {
      logger.error("Failed to close Redis connection", "REDIS", { error });
      throw error;
    }
  }

  /**
   * Flush all keys (use with caution!)
   */
  async flushAll(): Promise<void> {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    try {
      await this.client.flushall();
      logger.warn("Flushed all Redis keys", "REDIS");
    } catch (error) {
      logger.error("Failed to flush Redis", "REDIS", { error });
      throw error;
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();

// Cache key generators for consistency
export const CacheKeys = {
  emailStats: () => "email:stats",
  emailDailyVolume: (days: number) => `email:daily_volume:${days}`,
  emailEntityMetrics: () => "email:entity_metrics",
  emailWorkflowDistribution: () => "email:workflow_distribution",
  emailProcessingPerformance: (days: number) =>
    `email:processing_performance:${days}`,
  emailUrgencyDistribution: () => "email:urgency_distribution",
  walmartSearch: (query: string, maxResults: number) =>
    `walmart:search:${query}:${maxResults}`,
  walmartProduct: (url: string) => `walmart:product:${url}`,
  automationRule: (ruleId: string) => `automation:rule:${ruleId}`,
  automationRulePerformance: (ruleId: string) =>
    `automation:rule_performance:${ruleId}`,
  userSettings: (userId: string) => `user:settings:${userId}`,
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 30, // 30 seconds
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
};
