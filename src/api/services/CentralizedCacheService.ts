import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// Cache configuration schemas
export const CacheConfigSchema = z.object({
  memory: z.object({
    maxSize: z.number().min(100).default(10000),
    ttl: z.number().min(10).default(300), // 5 minutes
    checkInterval: z.number().min(1000).default(60000) // 1 minute
  }),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().min(0).default(0),
    ttl: z.number().min(60).default(3600), // 1 hour
    keyPrefix: z.string().default('cache:'),
    maxRetries: z.number().min(0).default(3)
  }),
  sqlite: z.object({
    path: z.string().default('./data/unified_cache.db'),
    ttl: z.number().min(300).default(86400), // 24 hours
    tableName: z.string().default('unified_cache'),
    maxEntries: z.number().min(1000).default(1000000),
    cleanupInterval: z.number().min(60000).default(3600000) // 1 hour
  })
});

export const CacheEntrySchema = z.object({
  key: z.string(),
  value: z.any(),
  ttl: z.number(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  accessCount: z.number().default(0),
  lastAccessed: z.number()
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;

// Cache tier enumeration
export enum CacheTier {
  MEMORY = 'memory',
  REDIS = 'redis', 
  SQLITE = 'sqlite'
}

// Cache operation types
export enum CacheOperation {
  GET = 'get',
  SET = 'set',
  DELETE = 'delete',
  CLEAR = 'clear',
  INVALIDATE = 'invalidate'
}

export interface CacheStats {
  hits: Record<CacheTier, number>;
  misses: Record<CacheTier, number>;
  sets: Record<CacheTier, number>;
  deletes: Record<CacheTier, number>;
  errors: Record<CacheTier, number>;
  latency: Record<CacheTier, number[]>;
  hitRatio: Record<CacheTier, number>;
  sizes: Record<CacheTier, number>;
}

interface CacheResult<T = any> {
  value: T | null;
  found: boolean;
  tier: CacheTier | null;
  latency: number;
  promoted?: boolean;
}

export class CentralizedCacheService extends EventEmitter {
  private config: CacheConfig;
  private memoryCache: LRUCache<string, CacheEntry>;
  private redisClient: Redis;
  private sqliteDb: Database.Database;
  private stats: CacheStats;
  private isInitialized = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = CacheConfigSchema.parse(config);
    this.initializeStats();
    this.initializeMemoryCache();
    this.initializeRedis();
    this.initializeSQLite();
    this.setupCleanupTasks();
  }

  private initializeStats(): void {
    this.stats = {
      hits: { [CacheTier.MEMORY]: 0, [CacheTier.REDIS]: 0, [CacheTier.SQLITE]: 0 },
      misses: { [CacheTier.MEMORY]: 0, [CacheTier.REDIS]: 0, [CacheTier.SQLITE]: 0 },
      sets: { [CacheTier.MEMORY]: 0, [CacheTier.REDIS]: 0, [CacheTier.SQLITE]: 0 },
      deletes: { [CacheTier.MEMORY]: 0, [CacheTier.REDIS]: 0, [CacheTier.SQLITE]: 0 },
      errors: { [CacheTier.MEMORY]: 0, [CacheTier.REDIS]: 0, [CacheTier.SQLITE]: 0 },
      latency: { [CacheTier.MEMORY]: [], [CacheTier.REDIS]: [], [CacheTier.SQLITE]: [] },
      hitRatio: { [CacheTier.MEMORY]: 0, [CacheTier.REDIS]: 0, [CacheTier.SQLITE]: 0 },
      sizes: { [CacheTier.MEMORY]: 0, [CacheTier.REDIS]: 0, [CacheTier.SQLITE]: 0 }
    };
  }

  private initializeMemoryCache(): void {
    this.memoryCache = new LRUCache<string, CacheEntry>({
      max: this.config.memory.maxSize,
      ttl: this.config.memory.ttl * 1000, // Convert to milliseconds
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      dispose: (entry, key) => {
        this.emit('memory:evicted', { key, entry });
      }
    });

    this.stats.sizes[CacheTier.MEMORY] = 0;
  }

  private initializeRedis(): void {
    this.redisClient = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: this.config.redis.maxRetries,
      retryDelayOnFailover: 100,
      retryStrategy: (times: number) => {
        if (times > this.config.redis.maxRetries) return null;
        return Math.min(times * 100, 3000);
      }
    });

    this.redisClient.on('connect', () => {
      this.emit('redis:connected');
    });

    this.redisClient.on('error', (error: Error) => {
      this.stats.errors[CacheTier.REDIS]++;
      this.emit('redis:error', error);
    });

    this.redisClient.on('ready', () => {
      this.emit('redis:ready');
    });
  }

  private initializeSQLite(): void {
    this.sqliteDb = new Database(this.config.sqlite.path);
    
    // Create cache table if it doesn't exist
    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS ${this.config.sqlite.tableName} (
        cache_key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        tags TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0,
        last_accessed INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cache_expires 
        ON ${this.config.sqlite.tableName}(expires_at);
        
      CREATE INDEX IF NOT EXISTS idx_cache_tags 
        ON ${this.config.sqlite.tableName}(tags);
        
      CREATE INDEX IF NOT EXISTS idx_cache_last_accessed 
        ON ${this.config.sqlite.tableName}(last_accessed);
    `);

    // Set up automatic cleanup trigger
    this.sqliteDb.exec(`
      CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
      AFTER INSERT ON ${this.config.sqlite.tableName}
      WHEN (SELECT COUNT(*) FROM ${this.config.sqlite.tableName}) > ${this.config.sqlite.maxEntries}
      BEGIN
        DELETE FROM ${this.config.sqlite.tableName}
        WHERE expires_at < strftime('%s', 'now')
        OR cache_key IN (
          SELECT cache_key FROM ${this.config.sqlite.tableName}
          ORDER BY last_accessed ASC
          LIMIT (SELECT COUNT(*) FROM ${this.config.sqlite.tableName}) - ${this.config.sqlite.maxEntries}
        );
      END;
    `);
  }

  private setupCleanupTasks(): void {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries().catch(error => {
        this.emit('cleanup:error', error);
      });
    }, this.config.sqlite.cleanupInterval);

    // Update hit ratios periodically
    setInterval(() => {
      this.updateHitRatios();
    }, 30000); // Every 30 seconds
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    
    try {
      // Clean up SQLite
      const deleteStmt = this.sqliteDb.prepare(`
        DELETE FROM ${this.config.sqlite.tableName}
        WHERE expires_at < ?
      `);
      const result = deleteStmt.run(now);
      
      if (result.changes > 0) {
        this.emit('cleanup:sqlite', { removed: result.changes });
      }

      // Clean up Redis (Redis handles TTL automatically, but we can get stats)
      const redisSize = await this.getRedisSize();
      this.stats.sizes[CacheTier.REDIS] = redisSize;
      
      // Memory cache is handled automatically by LRU
      this.stats.sizes[CacheTier.MEMORY] = this.memoryCache.size;

    } catch (error) {
      this.stats.errors[CacheTier.SQLITE]++;
      this.emit('cleanup:error', error);
    }
  }

  private updateHitRatios(): void {
    for (const tier of Object.values(CacheTier)) {
      const hits = this.stats.hits[tier];
      const misses = this.stats.misses[tier];
      const total = hits + misses;
      this.stats.hitRatio[tier] = total > 0 ? (hits / total) * 100 : 0;
    }
  }

  private async getRedisSize(): Promise<number> {
    try {
      const keys = await this.redisClient.keys(`${this.config.redis.keyPrefix}*`);
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  // Core cache operations
  public async get<T = any>(key: string): Promise<CacheResult<T>> {
    // L1: Check memory cache
    const memoryResult = await this.getFromMemory<T>(key);
    if (memoryResult.found) {
      return memoryResult;
    }

    // L2: Check Redis cache
    const redisResult = await this.getFromRedis<T>(key);
    if (redisResult.found) {
      // Promote to memory cache
      await this.setInMemory(key, redisResult.value);
      return { ...redisResult, promoted: true };
    }

    // L3: Check SQLite cache
    const sqliteResult = await this.getFromSQLite<T>(key);
    if (sqliteResult.found) {
      // Promote to higher cache tiers
      await Promise.all([
        this.setInMemory(key, sqliteResult.value),
        this.setInRedis(key, sqliteResult.value)
      ]);
      return { ...sqliteResult, promoted: true };
    }

    // Not found in any tier
    return {
      value: null,
      found: false,
      tier: null,
      latency: memoryResult.latency + redisResult.latency + sqliteResult.latency
    };
  }

  private async getFromMemory<T>(key: string): Promise<CacheResult<T>> {
    const startTime = Date.now();
    
    try {
      const entry = this.memoryCache.get(key);
      const latency = Date.now() - startTime;
      this.stats.latency[CacheTier.MEMORY].push(latency);

      if (entry) {
        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        
        this.stats.hits[CacheTier.MEMORY]++;
        this.emit('cache:hit', { tier: CacheTier.MEMORY, key, latency });
        
        return {
          value: entry.value,
          found: true,
          tier: CacheTier.MEMORY,
          latency
        };
      } else {
        this.stats.misses[CacheTier.MEMORY]++;
        return {
          value: null,
          found: false,
          tier: null,
          latency
        };
      }
    } catch (error) {
      this.stats.errors[CacheTier.MEMORY]++;
      this.emit('error', { tier: CacheTier.MEMORY, operation: CacheOperation.GET, error });
      return {
        value: null,
        found: false,
        tier: null,
        latency: Date.now() - startTime
      };
    }
  }

  private async getFromRedis<T>(key: string): Promise<CacheResult<T>> {
    const startTime = Date.now();
    
    try {
      const redisKey = `${this.config.redis.keyPrefix}${key}`;
      const data = await this.redisClient.get(redisKey);
      const latency = Date.now() - startTime;
      this.stats.latency[CacheTier.REDIS].push(latency);

      if (data) {
        const entry: CacheEntry = JSON.parse(data);
        
        this.stats.hits[CacheTier.REDIS]++;
        this.emit('cache:hit', { tier: CacheTier.REDIS, key, latency });
        
        return {
          value: entry.value,
          found: true,
          tier: CacheTier.REDIS,
          latency
        };
      } else {
        this.stats.misses[CacheTier.REDIS]++;
        return {
          value: null,
          found: false,
          tier: null,
          latency
        };
      }
    } catch (error) {
      this.stats.errors[CacheTier.REDIS]++;
      this.emit('error', { tier: CacheTier.REDIS, operation: CacheOperation.GET, error });
      return {
        value: null,
        found: false,
        tier: null,
        latency: Date.now() - startTime
      };
    }
  }

  private async getFromSQLite<T>(key: string): Promise<CacheResult<T>> {
    const startTime = Date.now();
    
    try {
      const now = Math.floor(Date.now() / 1000);
      const stmt = this.sqliteDb.prepare(`
        SELECT value, access_count, last_accessed
        FROM ${this.config.sqlite.tableName}
        WHERE cache_key = ? AND expires_at > ?
      `);
      
      const row = stmt.get(key, now) as any;
      const latency = Date.now() - startTime;
      this.stats.latency[CacheTier.SQLITE].push(latency);

      if (row) {
        // Update access statistics
        const updateStmt = this.sqliteDb.prepare(`
          UPDATE ${this.config.sqlite.tableName}
          SET access_count = ?, last_accessed = ?
          WHERE cache_key = ?
        `);
        updateStmt.run(row.access_count + 1, Math.floor(Date.now() / 1000), key);

        this.stats.hits[CacheTier.SQLITE]++;
        this.emit('cache:hit', { tier: CacheTier.SQLITE, key, latency });
        
        return {
          value: JSON.parse(row.value),
          found: true,
          tier: CacheTier.SQLITE,
          latency
        };
      } else {
        this.stats.misses[CacheTier.SQLITE]++;
        return {
          value: null,
          found: false,
          tier: null,
          latency
        };
      }
    } catch (error) {
      this.stats.errors[CacheTier.SQLITE]++;
      this.emit('error', { tier: CacheTier.SQLITE, operation: CacheOperation.GET, error });
      return {
        value: null,
        found: false,
        tier: null,
        latency: Date.now() - startTime
      };
    }
  }

  public async set(
    key: string, 
    value: any, 
    options: {
      ttl?: number;
      tags?: string[];
      metadata?: Record<string, any>;
      tiers?: CacheTier[];
    } = {}
  ): Promise<void> {
    const { ttl, tags = [], metadata, tiers = [CacheTier.MEMORY, CacheTier.REDIS, CacheTier.SQLITE] } = options;

    const entry: CacheEntry = {
      key,
      value,
      ttl: ttl || this.config.memory.ttl,
      tags,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    };

    // Set in requested cache tiers
    const promises = [];
    
    if (tiers.includes(CacheTier.MEMORY)) {
      promises.push(this.setInMemory(key, entry));
    }
    if (tiers.includes(CacheTier.REDIS)) {
      promises.push(this.setInRedis(key, entry));
    }
    if (tiers.includes(CacheTier.SQLITE)) {
      promises.push(this.setInSQLite(key, entry));
    }

    await Promise.allSettled(promises);
    
    this.emit('cache:set', { key, tiers, tags });
  }

  private async setInMemory(key: string, entry: CacheEntry | any): Promise<void> {
    try {
      const cacheEntry = entry.key ? entry : {
        key,
        value: entry,
        ttl: this.config.memory.ttl,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now()
      };

      this.memoryCache.set(key, cacheEntry);
      this.stats.sets[CacheTier.MEMORY]++;
      this.stats.sizes[CacheTier.MEMORY] = this.memoryCache.size;
    } catch (error) {
      this.stats.errors[CacheTier.MEMORY]++;
      this.emit('error', { tier: CacheTier.MEMORY, operation: CacheOperation.SET, error });
    }
  }

  private async setInRedis(key: string, entry: CacheEntry | any): Promise<void> {
    try {
      const redisKey = `${this.config.redis.keyPrefix}${key}`;
      const cacheEntry = entry.key ? entry : {
        key,
        value: entry,
        ttl: this.config.redis.ttl,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now()
      };

      await this.redisClient.setex(
        redisKey, 
        entry.ttl || this.config.redis.ttl, 
        JSON.stringify(cacheEntry)
      );
      
      this.stats.sets[CacheTier.REDIS]++;
    } catch (error) {
      this.stats.errors[CacheTier.REDIS]++;
      this.emit('error', { tier: CacheTier.REDIS, operation: CacheOperation.SET, error });
    }
  }

  private async setInSQLite(key: string, entry: CacheEntry): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + (entry.ttl || this.config.sqlite.ttl);
      
      const stmt = this.sqliteDb.prepare(`
        INSERT OR REPLACE INTO ${this.config.sqlite.tableName} (
          cache_key, value, tags, metadata, created_at, 
          updated_at, expires_at, access_count, last_accessed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        key,
        JSON.stringify(entry.value),
        JSON.stringify(entry.tags),
        JSON.stringify(entry.metadata),
        now,
        now,
        expiresAt,
        0,
        now
      );

      this.stats.sets[CacheTier.SQLITE]++;
    } catch (error) {
      this.stats.errors[CacheTier.SQLITE]++;
      this.emit('error', { tier: CacheTier.SQLITE, operation: CacheOperation.SET, error });
    }
  }

  public async delete(key: string): Promise<{ deleted: boolean; tiers: CacheTier[] }> {
    const deletedFrom: CacheTier[] = [];

    // Delete from all tiers
    const results = await Promise.allSettled([
      this.deleteFromMemory(key),
      this.deleteFromRedis(key),
      this.deleteFromSQLite(key)
    ]);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        deletedFrom.push([CacheTier.MEMORY, CacheTier.REDIS, CacheTier.SQLITE][index]);
      }
    });

    const deleted = deletedFrom.length > 0;
    this.emit('cache:delete', { key, deleted, tiers: deletedFrom });

    return { deleted, tiers: deletedFrom };
  }

  private async deleteFromMemory(key: string): Promise<boolean> {
    try {
      const deleted = this.memoryCache.delete(key);
      if (deleted) {
        this.stats.deletes[CacheTier.MEMORY]++;
        this.stats.sizes[CacheTier.MEMORY] = this.memoryCache.size;
      }
      return deleted;
    } catch (error) {
      this.stats.errors[CacheTier.MEMORY]++;
      return false;
    }
  }

  private async deleteFromRedis(key: string): Promise<boolean> {
    try {
      const redisKey = `${this.config.redis.keyPrefix}${key}`;
      const deleted = await this.redisClient.del(redisKey);
      if (deleted > 0) {
        this.stats.deletes[CacheTier.REDIS]++;
      }
      return deleted > 0;
    } catch (error) {
      this.stats.errors[CacheTier.REDIS]++;
      return false;
    }
  }

  private async deleteFromSQLite(key: string): Promise<boolean> {
    try {
      const stmt = this.sqliteDb.prepare(`
        DELETE FROM ${this.config.sqlite.tableName}
        WHERE cache_key = ?
      `);
      const result = stmt.run(key);
      if (result.changes > 0) {
        this.stats.deletes[CacheTier.SQLITE]++;
      }
      return result.changes > 0;
    } catch (error) {
      this.stats.errors[CacheTier.SQLITE]++;
      return false;
    }
  }

  // Advanced cache operations
  public async invalidateByTags(tags: string[]): Promise<{ invalidated: number; tiers: CacheTier[] }> {
    const invalidatedFrom: CacheTier[] = [];
    let totalInvalidated = 0;

    // Invalidate from SQLite (has tag support)
    try {
      const stmt = this.sqliteDb.prepare(`
        DELETE FROM ${this.config.sqlite.tableName}
        WHERE tags LIKE ANY (${tags.map(() => '?').join(', ')})
      `);
      const result = stmt.run(...tags.map(tag => `%"${tag}"%`));
      if (result.changes > 0) {
        totalInvalidated += result.changes;
        invalidatedFrom.push(CacheTier.SQLITE);
      }
    } catch (error) {
      this.emit('error', { tier: CacheTier.SQLITE, operation: CacheOperation.INVALIDATE, error });
    }

    // For memory and Redis, we'd need to scan keys (expensive)
    // In practice, you might maintain separate tag->key indexes

    this.emit('cache:invalidate:tags', { tags, invalidated: totalInvalidated, tiers: invalidatedFrom });
    return { invalidated: totalInvalidated, tiers: invalidatedFrom };
  }

  public async warm(
    entries: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>
  ): Promise<{ warmed: number; errors: number }> {
    let warmed = 0;
    let errors = 0;

    const promises = entries.map(async (entry) => {
      try {
        await this.set(entry.key, entry.value, {
          ttl: entry.ttl,
          tags: entry.tags
        });
        warmed++;
      } catch (error) {
        errors++;
        this.emit('error', { operation: 'warm', key: entry.key, error });
      }
    });

    await Promise.allSettled(promises);
    
    this.emit('cache:warm', { requested: entries.length, warmed, errors });
    return { warmed, errors };
  }

  public async clear(tiers: CacheTier[] = [CacheTier.MEMORY, CacheTier.REDIS, CacheTier.SQLITE]): Promise<void> {
    const promises = [];

    if (tiers.includes(CacheTier.MEMORY)) {
      promises.push(this.clearMemory());
    }
    if (tiers.includes(CacheTier.REDIS)) {
      promises.push(this.clearRedis());
    }
    if (tiers.includes(CacheTier.SQLITE)) {
      promises.push(this.clearSQLite());
    }

    await Promise.allSettled(promises);
    this.emit('cache:clear', { tiers });
  }

  private async clearMemory(): Promise<void> {
    this.memoryCache.clear();
    this.stats.sizes[CacheTier.MEMORY] = 0;
  }

  private async clearRedis(): Promise<void> {
    try {
      const keys = await this.redisClient.keys(`${this.config.redis.keyPrefix}*`);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
      this.stats.sizes[CacheTier.REDIS] = 0;
    } catch (error) {
      this.emit('error', { tier: CacheTier.REDIS, operation: CacheOperation.CLEAR, error });
    }
  }

  private async clearSQLite(): Promise<void> {
    try {
      this.sqliteDb.exec(`DELETE FROM ${this.config.sqlite.tableName}`);
      this.stats.sizes[CacheTier.SQLITE] = 0;
    } catch (error) {
      this.emit('error', { tier: CacheTier.SQLITE, operation: CacheOperation.CLEAR, error });
    }
  }

  // Monitoring and statistics
  public getStats(): CacheStats & { 
    averageLatency: Record<CacheTier, number>;
    totalOperations: number;
    overallHitRatio: number;
  } {
    const avgLatency = {} as Record<CacheTier, number>;
    for (const tier of Object.values(CacheTier)) {
      const latencies = this.stats.latency[tier];
      avgLatency[tier] = latencies.length > 0 
        ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
        : 0;
    }

    const totalHits = Object.values(this.stats.hits).reduce((sum, hits) => sum + hits, 0);
    const totalMisses = Object.values(this.stats.misses).reduce((sum, misses) => sum + misses, 0);
    const totalOperations = totalHits + totalMisses;
    const overallHitRatio = totalOperations > 0 ? (totalHits / totalOperations) * 100 : 0;

    return {
      ...this.stats,
      averageLatency: avgLatency,
      totalOperations,
      overallHitRatio
    };
  }

  public resetStats(): void {
    this.initializeStats();
    this.emit('stats:reset');
  }

  // Health check
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    tiers: Record<CacheTier, 'healthy' | 'unhealthy'>;
    details: Record<string, any>;
  }> {
    const tierHealth = {} as Record<CacheTier, 'healthy' | 'unhealthy'>;
    
    // Check memory cache
    tierHealth[CacheTier.MEMORY] = this.memoryCache ? 'healthy' : 'unhealthy';

    // Check Redis
    try {
      await this.redisClient.ping();
      tierHealth[CacheTier.REDIS] = 'healthy';
    } catch (error) {
      tierHealth[CacheTier.REDIS] = 'unhealthy';
    }

    // Check SQLite
    try {
      this.sqliteDb.prepare('SELECT 1').get();
      tierHealth[CacheTier.SQLITE] = 'healthy';
    } catch (error) {
      tierHealth[CacheTier.SQLITE] = 'unhealthy';
    }

    const healthyTiers = Object.values(tierHealth).filter(h => h === 'healthy').length;
    const status = healthyTiers === 3 ? 'healthy' : 
                   healthyTiers >= 2 ? 'degraded' : 'unhealthy';

    return {
      status,
      tiers: tierHealth,
      details: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        stats: this.getStats()
      }
    };
  }

  // Cleanup and shutdown
  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    await Promise.allSettled([
      this.redisClient.quit(),
      new Promise<void>((resolve) => {
        this.sqliteDb.close();
        resolve();
      })
    ]);

    this.removeAllListeners();
    this.emit('shutdown');
  }
}