import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import Database from 'better-sqlite3';
import { z } from 'zod';
import pLimit from 'p-limit';
import { EventEmitter } from 'events';

// Type definitions
export const PriceRequestSchema = z.object({
  productId: z.string(),
  storeId: z.string().optional().default('default'),
  quantity: z.number().min(1).default(1),
  includePromotions: z.boolean().default(true)
});

export const PriceResponseSchema = z.object({
  productId: z.string(),
  storeId: z.string(),
  price: z.number(),
  originalPrice: z.number().optional(),
  discount: z.number().optional(),
  promotions: z.array(z.object({
    type: z.string(),
    description: z.string(),
    value: z.number()
  })).optional(),
  currency: z.string().default('USD'),
  timestamp: z.number(),
  source: z.enum(['memory', 'redis', 'sqlite', 'api']),
  ttl: z.number()
});

export type PriceRequest = z.infer<typeof PriceRequestSchema>;
export type PriceResponse = z.infer<typeof PriceResponseSchema>;

interface CacheConfig {
  memory: {
    maxSize: number;
    ttl: number; // seconds
  };
  redis: {
    ttl: number; // seconds
    keyPrefix: string;
  };
  sqlite: {
    ttl: number; // seconds
    tableName: string;
  };
}

interface WalmartAPIConfig {
  baseUrl: string;
  apiKey: string;
  rateLimit: number; // requests per second
  timeout: number; // milliseconds
  retries: number;
}

export class PricingService extends EventEmitter {
  private memoryCache: LRUCache<string, PriceResponse>;
  private redisClient: Redis;
  private sqliteDb: Database.Database;
  private apiLimiter: ReturnType<typeof pLimit>;
  private config: {
    cache: CacheConfig;
    api: WalmartAPIConfig;
  };
  private metrics: {
    hits: { memory: number; redis: number; sqlite: number; api: number };
    misses: { memory: number; redis: number; sqlite: number };
    errors: { redis: number; sqlite: number; api: number };
    latency: { memory: number[]; redis: number[]; sqlite: number[]; api: number[] };
  };

  constructor(config: {
    cache?: Partial<CacheConfig>;
    api?: Partial<WalmartAPIConfig>;
    redis?: Redis.RedisOptions;
    sqlitePath?: string;
  } = {}) {
    super();

    // Initialize configuration with defaults
    this.config = {
      cache: {
        memory: {
          maxSize: config.cache?.memory?.maxSize ?? 10000,
          ttl: config.cache?.memory?.ttl ?? 300 // 5 minutes
        },
        redis: {
          ttl: config.cache?.redis?.ttl ?? 3600, // 1 hour
          keyPrefix: config.cache?.redis?.keyPrefix ?? 'price:'
        },
        sqlite: {
          ttl: config.cache?.sqlite?.ttl ?? 86400, // 24 hours
          tableName: config.cache?.sqlite?.tableName ?? 'price_cache'
        }
      },
      api: {
        baseUrl: config.api?.baseUrl ?? process.env.WALMART_API_URL ?? 'https://api.walmart.com',
        apiKey: config.api?.apiKey ?? process.env.WALMART_API_KEY ?? '',
        rateLimit: config.api?.rateLimit ?? 10,
        timeout: config.api?.timeout ?? 5000,
        retries: config.api?.retries ?? 3
      }
    };

    // Initialize metrics
    this.metrics = {
      hits: { memory: 0, redis: 0, sqlite: 0, api: 0 },
      misses: { memory: 0, redis: 0, sqlite: 0 },
      errors: { redis: 0, sqlite: 0, api: 0 },
      latency: { memory: [], redis: [], sqlite: [], api: [] }
    };

    // Initialize memory cache (L1)
    this.memoryCache = new LRUCache<string, PriceResponse>({
      max: this.config.cache.memory.maxSize,
      ttl: this.config.cache.memory.ttl * 1000, // Convert to milliseconds
      updateAgeOnGet: true,
      updateAgeOnHas: false
    });

    // Initialize Redis client (L2)
    this.redisClient = new Redis({
      ...config.redis,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      }
    });

    // Initialize SQLite database (L3)
    const dbPath = config.sqlitePath ?? './data/price_cache.db';
    this.sqliteDb = new Database(dbPath);
    this.initializeSQLite();

    // Initialize API rate limiter
    this.apiLimiter = pLimit(this.config.api.rateLimit);

    // Set up error handlers
    this.setupErrorHandlers();
  }

  private initializeSQLite(): void {
    // Create price cache table if it doesn't exist
    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS ${this.config.cache.sqlite.tableName} (
        cache_key TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        price REAL NOT NULL,
        original_price REAL,
        discount REAL,
        promotions TEXT,
        currency TEXT DEFAULT 'USD',
        timestamp INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_product_store 
        ON ${this.config.cache.sqlite.tableName}(product_id, store_id);
      
      CREATE INDEX IF NOT EXISTS idx_expires 
        ON ${this.config.cache.sqlite.tableName}(expires_at);
    `);

    // Set up cleanup trigger for expired entries
    this.sqliteDb.exec(`
      CREATE TRIGGER IF NOT EXISTS cleanup_expired_prices
      AFTER INSERT ON ${this.config.cache.sqlite.tableName}
      BEGIN
        DELETE FROM ${this.config.cache.sqlite.tableName}
        WHERE expires_at < strftime('%s', 'now')
        AND (SELECT COUNT(*) FROM ${this.config.cache.sqlite.tableName}) > 100000;
      END;
    `);
  }

  private setupErrorHandlers(): void {
    this.redisClient.on('error', (err) => {
      this.emit('error', { source: 'redis', error: err });
      this.metrics.errors.redis++;
    });

    this.redisClient.on('ready', () => {
      this.emit('ready', { source: 'redis' });
    });
  }

  private getCacheKey(request: PriceRequest): string {
    return `${request.productId}:${request.storeId}:${request.quantity}:${request.includePromotions}`;
  }

  public async getPrice(request: PriceRequest): Promise<PriceResponse> {
    const validatedRequest = PriceRequestSchema.parse(request);
    const cacheKey = this.getCacheKey(validatedRequest);

    // L1: Check memory cache
    const memoryResult = await this.checkMemoryCache(cacheKey);
    if (memoryResult) return memoryResult;

    // L2: Check Redis cache
    const redisResult = await this.checkRedisCache(cacheKey, validatedRequest);
    if (redisResult) return redisResult;

    // L3: Check SQLite cache
    const sqliteResult = await this.checkSQLiteCache(cacheKey, validatedRequest);
    if (sqliteResult) return sqliteResult;

    // L4: Fetch from Walmart API
    const apiResult = await this.fetchFromAPI(validatedRequest);
    
    // Store in all cache layers
    await this.storePriceInCaches(cacheKey, apiResult);

    return apiResult;
  }

  private async checkMemoryCache(cacheKey: string): Promise<PriceResponse | null> {
    const startTime = Date.now();
    const cached = this.memoryCache.get(cacheKey);
    
    const latency = Date.now() - startTime;
    this.metrics.latency.memory.push(latency);

    if (cached) {
      this.metrics.hits.memory++;
      this.emit('cache:hit', { level: 'memory', key: cacheKey, latency });
      return { ...cached, source: 'memory' };
    }

    this.metrics.misses.memory++;
    return null;
  }

  private async checkRedisCache(
    cacheKey: string, 
    request: PriceRequest
  ): Promise<PriceResponse | null> {
    try {
      const startTime = Date.now();
      const redisKey = `${this.config.cache.redis.keyPrefix}${cacheKey}`;
      const cached = await this.redisClient.get(redisKey);
      
      const latency = Date.now() - startTime;
      this.metrics.latency.redis.push(latency);

      if (cached) {
        const parsed = JSON.parse(cached) as PriceResponse;
        this.metrics.hits.redis++;
        this.emit('cache:hit', { level: 'redis', key: cacheKey, latency });
        
        // Promote to memory cache
        this.memoryCache.set(cacheKey, parsed);
        
        return { ...parsed, source: 'redis' };
      }

      this.metrics.misses.redis++;
      return null;
    } catch (error) {
      this.metrics.errors.redis++;
      this.emit('error', { source: 'redis', error, key: cacheKey });
      return null;
    }
  }

  private async checkSQLiteCache(
    cacheKey: string,
    request: PriceRequest
  ): Promise<PriceResponse | null> {
    try {
      const startTime = Date.now();
      const now = Math.floor(Date.now() / 1000);
      
      const query = this.sqliteDb.prepare(`
        SELECT * FROM ${this.config.cache.sqlite.tableName}
        WHERE cache_key = ? AND expires_at > ?
      `);
      
      const row = query.get(cacheKey, now) as any;
      
      const latency = Date.now() - startTime;
      this.metrics.latency.sqlite.push(latency);

      if (row) {
        const response: PriceResponse = {
          productId: row.product_id,
          storeId: row.store_id,
          price: row.price,
          originalPrice: row.original_price,
          discount: row.discount,
          promotions: row.promotions ? JSON.parse(row.promotions) : undefined,
          currency: row.currency,
          timestamp: row.timestamp * 1000,
          source: 'sqlite',
          ttl: row.expires_at - now
        };

        this.metrics.hits.sqlite++;
        this.emit('cache:hit', { level: 'sqlite', key: cacheKey, latency });
        
        // Promote to higher cache layers
        await this.promoteToHigherCaches(cacheKey, response);
        
        return response;
      }

      this.metrics.misses.sqlite++;
      return null;
    } catch (error) {
      this.metrics.errors.sqlite++;
      this.emit('error', { source: 'sqlite', error, key: cacheKey });
      return null;
    }
  }

  private async fetchFromAPI(request: PriceRequest): Promise<PriceResponse> {
    return this.apiLimiter(async () => {
      const startTime = Date.now();
      
      try {
        // Simulate Walmart API call (replace with actual implementation)
        const response = await this.callWalmartAPI(request);
        
        const latency = Date.now() - startTime;
        this.metrics.latency.api.push(latency);
        this.metrics.hits.api++;
        
        this.emit('api:fetch', { 
          productId: request.productId, 
          latency,
          success: true 
        });

        return {
          ...response,
          source: 'api',
          timestamp: Date.now(),
          ttl: this.config.cache.memory.ttl
        };
      } catch (error) {
        this.metrics.errors.api++;
        this.emit('error', { source: 'api', error, request });
        throw error;
      }
    });
  }

  private async callWalmartAPI(request: PriceRequest): Promise<Omit<PriceResponse, 'source' | 'ttl'>> {
    // TODO: Implement actual Walmart API call
    // This is a mock implementation
    const mockPrice = Math.floor(Math.random() * 10000) / 100;
    const hasDiscount = Math.random() > 0.7;
    
    return {
      productId: request.productId,
      storeId: request.storeId,
      price: hasDiscount ? mockPrice * 0.8 : mockPrice,
      originalPrice: hasDiscount ? mockPrice : undefined,
      discount: hasDiscount ? mockPrice * 0.2 : undefined,
      promotions: hasDiscount ? [{
        type: 'percentage',
        description: '20% off',
        value: 20
      }] : undefined,
      currency: 'USD',
      timestamp: Date.now()
    };
  }

  private async storePriceInCaches(cacheKey: string, response: PriceResponse): Promise<void> {
    // Store in memory cache
    this.memoryCache.set(cacheKey, response);

    // Store in Redis cache (async, don't wait)
    this.storeInRedis(cacheKey, response).catch(err => {
      this.emit('error', { source: 'redis:store', error: err });
    });

    // Store in SQLite cache (async, don't wait)
    this.storeInSQLite(cacheKey, response).catch(err => {
      this.emit('error', { source: 'sqlite:store', error: err });
    });
  }

  private async storeInRedis(cacheKey: string, response: PriceResponse): Promise<void> {
    const redisKey = `${this.config.cache.redis.keyPrefix}${cacheKey}`;
    await this.redisClient.setex(
      redisKey,
      this.config.cache.redis.ttl,
      JSON.stringify(response)
    );
  }

  private async storeInSQLite(cacheKey: string, response: PriceResponse): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.config.cache.sqlite.ttl;
    
    const insert = this.sqliteDb.prepare(`
      INSERT OR REPLACE INTO ${this.config.cache.sqlite.tableName} (
        cache_key, product_id, store_id, price, original_price,
        discount, promotions, currency, timestamp, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      cacheKey,
      response.productId,
      response.storeId,
      response.price,
      response.originalPrice ?? null,
      response.discount ?? null,
      response.promotions ? JSON.stringify(response.promotions) : null,
      response.currency,
      Math.floor(response.timestamp / 1000),
      expiresAt
    );
  }

  private async promoteToHigherCaches(cacheKey: string, response: PriceResponse): Promise<void> {
    // Promote to memory cache
    this.memoryCache.set(cacheKey, response);

    // Promote to Redis cache (async)
    this.storeInRedis(cacheKey, response).catch(err => {
      this.emit('error', { source: 'redis:promote', error: err });
    });
  }

  // Cache management methods
  public async warmCache(productIds: string[], storeIds: string[] = ['default']): Promise<void> {
    const requests: PriceRequest[] = [];
    
    for (const productId of productIds) {
      for (const storeId of storeIds) {
        requests.push({ productId, storeId, quantity: 1, includePromotions: true });
      }
    }

    // Process in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      await Promise.all(batch.map(req => this.getPrice(req).catch(() => null)));
      this.emit('cache:warm:progress', { 
        completed: Math.min(i + batchSize, requests.length), 
        total: requests.length 
      });
    }

    this.emit('cache:warm:complete', { count: requests.length });
  }

  public async invalidateCache(
    criteria: { productId?: string; storeId?: string } = {}
  ): Promise<number> {
    let invalidated = 0;

    // Clear memory cache
    if (!criteria.productId && !criteria.storeId) {
      const size = this.memoryCache.size;
      this.memoryCache.clear();
      invalidated += size;
    } else {
      for (const [key] of this.memoryCache.entries()) {
        if (this.shouldInvalidate(key, criteria)) {
          this.memoryCache.delete(key);
          invalidated++;
        }
      }
    }

    // Clear Redis cache
    const redisPattern = this.buildRedisPattern(criteria);
    const keys = await this.redisClient.keys(redisPattern);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
      invalidated += keys.length;
    }

    // Clear SQLite cache
    const sqliteDeleted = this.invalidateSQLiteCache(criteria);
    invalidated += sqliteDeleted;

    this.emit('cache:invalidate', { criteria, count: invalidated });
    return invalidated;
  }

  private shouldInvalidate(
    key: string, 
    criteria: { productId?: string; storeId?: string }
  ): boolean {
    const parts = key.split(':');
    if (criteria.productId && !parts[0].includes(criteria.productId)) return false;
    if (criteria.storeId && !parts[1].includes(criteria.storeId)) return false;
    return true;
  }

  private buildRedisPattern(criteria: { productId?: string; storeId?: string }): string {
    const prefix = this.config.cache.redis.keyPrefix;
    const productPart = criteria.productId ?? '*';
    const storePart = criteria.storeId ?? '*';
    return `${prefix}${productPart}:${storePart}:*:*`;
  }

  private invalidateSQLiteCache(criteria: { productId?: string; storeId?: string }): number {
    let query = `DELETE FROM ${this.config.cache.sqlite.tableName} WHERE 1=1`;
    const params: any[] = [];

    if (criteria.productId) {
      query += ' AND product_id = ?';
      params.push(criteria.productId);
    }

    if (criteria.storeId) {
      query += ' AND store_id = ?';
      params.push(criteria.storeId);
    }

    const stmt = this.sqliteDb.prepare(query);
    const result = stmt.run(...params);
    return result.changes;
  }

  // Metrics and monitoring
  public getMetrics() {
    const calculateAverage = (arr: number[]) => 
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      errors: this.metrics.errors,
      hitRate: {
        memory: this.calculateHitRate('memory'),
        redis: this.calculateHitRate('redis'),
        sqlite: this.calculateHitRate('sqlite'),
        overall: this.calculateOverallHitRate()
      },
      avgLatency: {
        memory: calculateAverage(this.metrics.latency.memory),
        redis: calculateAverage(this.metrics.latency.redis),
        sqlite: calculateAverage(this.metrics.latency.sqlite),
        api: calculateAverage(this.metrics.latency.api)
      },
      cacheSize: {
        memory: this.memoryCache.size,
        memoryMax: this.config.cache.memory.maxSize
      }
    };
  }

  private calculateHitRate(level: 'memory' | 'redis' | 'sqlite'): number {
    const hits = this.metrics.hits[level];
    const misses = this.metrics.misses[level];
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }

  private calculateOverallHitRate(): number {
    const totalHits = this.metrics.hits.memory + this.metrics.hits.redis + this.metrics.hits.sqlite;
    const totalMisses = this.metrics.misses.memory + this.metrics.misses.redis + this.metrics.misses.sqlite;
    const total = totalHits + totalMisses;
    return total > 0 ? (totalHits / total) * 100 : 0;
  }

  public resetMetrics(): void {
    this.metrics = {
      hits: { memory: 0, redis: 0, sqlite: 0, api: 0 },
      misses: { memory: 0, redis: 0, sqlite: 0 },
      errors: { redis: 0, sqlite: 0, api: 0 },
      latency: { memory: [], redis: [], sqlite: [], api: [] }
    };
  }

  // Cleanup
  public async close(): Promise<void> {
    this.memoryCache.clear();
    await this.redisClient.quit();
    this.sqliteDb.close();
    this.removeAllListeners();
  }
}