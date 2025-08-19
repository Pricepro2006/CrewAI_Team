/**
 * Optimized Query Executor with Caching and Performance Monitoring
 * 
 * Performance optimizations:
 * - Query result caching with TTL
 * - Prepared statement reuse
 * - Batch query execution
 * - Query performance monitoring
 * - Automatic index recommendations
 */

import Database from 'better-sqlite3';
import { Logger } from '../utils/logger.js';
import * as crypto from 'crypto';

const logger = new Logger('OptimizedQueryExecutor');

interface QueryMetrics {
  query: string;
  executionTime: number;
  rowCount: number;
  cacheHit: boolean;
  timestamp: number;
}

interface CachedResult {
  data: any;
  timestamp: number;
  hitCount: number;
}

interface QueryStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  avgExecutionTime: number;
  slowQueries: QueryMetrics[];
  cacheSize?: number;
  cacheEvictions?: number;
  cacheMemoryUsage?: number;
  cacheEntries?: number;
  maxCacheSize?: number;
  preparedStatements?: number;
  preparedReused?: number;
}

export class OptimizedQueryExecutor {
  private db: Database.Database;
  private queryCache = new Map<string, CachedResult>();
  private preparedStatements = new Map<string, Database.Statement>();
  private queryMetrics: QueryMetrics[] = [];
  
  // Configuration
  private readonly cacheTTL = 5000; // 5 seconds for dynamic data
  private readonly maxCacheSize = 1000;
  private readonly slowQueryThreshold = 100; // ms
  private readonly metricsRetention = 1000; // Keep last 1000 queries

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.optimizeDatabase();
    this.createIndexes();
    
    // Periodic cache cleanup
    setInterval(() => this.cleanupCache(), 30000); // Every 30 seconds
    
    logger.info('OptimizedQueryExecutor initialized', 'database', { dbPath });
  }

  /**
   * Execute query synchronously (for backwards compatibility)
   * WARNING: This bypasses async optimizations - use executeAsync when possible
   */
  executeSync<T = any>(sql: string, params?: any[]): T {
    const startTime = Date.now();
    const isReadQuery = this.isReadQuery(sql);
    const cacheKey = this.getCacheKey(sql, params);

    try {
      // Check cache for read queries
      if (isReadQuery) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.recordMetrics(sql, Date.now() - startTime, cached.data.length, true);
          return cached.data as T;
        }
      }

      // Execute query synchronously
      const stmt = this.getPreparedStatement(sql);
      let result;
      
      if (isReadQuery) {
        result = params && params.length > 0 ? stmt.all(...params) : stmt.all();
      } else {
        result = params && params.length > 0 ? stmt.run(...params) : stmt.run();
      }
      
      // Cache read query results
      if (isReadQuery && result) {
        this.addToCache(cacheKey, result);
      }

      // Record metrics
      const executionTime = Date.now() - startTime;
      this.recordMetrics(sql, executionTime, Array.isArray(result) ? result.length : 1, false);

      // Check for slow queries
      if (executionTime > this.slowQueryThreshold) {
        this.analyzeSlowQuery(sql, executionTime, params);
      }

      return result as T;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Query execution failed', 'database', {
        sql: sql.substring(0, 100),
        error: errorMessage,
        executionTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get or create a synchronous prepared statement wrapper
   */
  prepare(sql: string): {
    run: (...params: any[]) => any;
    get: (...params: any[]) => any;
    all: (...params: any[]) => any;
    iterate: (...params: any[]) => Iterator<any>;
  } {
    const stmt = this.getPreparedStatement(sql);
    const self = this;
    
    return {
      run: (...params: any[]) => self.executeSync(sql, params),
      get: (...params: any[]) => {
        const stmt = self.getPreparedStatement(sql);
        return params.length > 0 ? stmt.get(...params) : stmt.get();
      },
      all: (...params: any[]) => self.executeSync(sql, params),
      iterate: function* (...params: any[]) {
        const results = self.executeSync(sql, params);
        if (Array.isArray(results)) {
          for (const row of results) {
            yield row;
          }
        }
      }
    };
  }

  /**
   * Execute query with caching and monitoring (async version)
   */
  async execute<T = any>(sql: string, params?: any[]): Promise<T> {
    const startTime = Date.now();
    const isReadQuery = this.isReadQuery(sql);
    const cacheKey = this.getCacheKey(sql, params);

    try {
      // Check cache for read queries
      if (isReadQuery) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.recordMetrics(sql, Date.now() - startTime, cached.data.length, true);
          return cached.data as T;
        }
      }

      // Execute query
      const result = await this.executeQuery(sql, params);
      
      // Cache read query results
      if (isReadQuery && result) {
        this.addToCache(cacheKey, result);
      }

      // Record metrics
      const executionTime = Date.now() - startTime;
      this.recordMetrics(sql, executionTime, Array.isArray(result) ? result.length : 1, false);

      // Check for slow queries
      if (executionTime > this.slowQueryThreshold) {
        this.analyzeSlowQuery(sql, executionTime, params);
      }

      return result as T;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Query execution failed', 'database', {
        sql: sql.substring(0, 100),
        error: errorMessage,
        executionTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Execute a synchronous transaction (for backwards compatibility)
   */
  transaction<T = any>(fn: (db: {
    prepare: (sql: string) => any;
    exec: (sql: string) => any;
    pragma: (pragma: string, value?: any) => any;
  }) => T): T {
    const wrappedDb = {
      prepare: (sql: string) => this.prepare(sql),
      exec: (sql: string) => this.db.exec(sql),
      pragma: (pragma: string, value?: any) => this.db.pragma(pragma, value)
    };
    
    const transaction = this.db.transaction(() => fn(wrappedDb));
    return transaction();
  }

  /**
   * Execute multiple queries in a transaction (async)
   */
  async executeTransaction<T = any>(queries: Array<{ sql: string; params?: any[] }>): Promise<T[]> {
    const startTime = Date.now();
    const results: T[] = [];

    const transaction = this.db.transaction((queries: Array<{ sql: string; params?: any[] }>) => {
      for (const { sql, params } of queries) {
        const stmt = this.getPreparedStatement(sql);
        const result = params && params.length > 0 ? stmt.all(...params) : stmt.all();
        results.push(result as T);
      }
    });

    try {
      transaction(queries);
      
      logger.debug('Transaction completed', 'database', {
        queryCount: queries.length,
        executionTime: Date.now() - startTime
      });

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Transaction failed', 'database', {
        error: errorMessage,
        queryCount: queries.length
      });
      throw error;
    }
  }

  /**
   * Execute query with prepared statement
   */
  private executeQuery(sql: string, params?: any[]): Promise<any> {
    const stmt = this.getPreparedStatement(sql);
    
    // Use setImmediate to avoid blocking the event loop
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          let result;
          
          if (this.isReadQuery(sql)) {
            result = params && params.length > 0 ? stmt.all(...params) : stmt.all();
          } else {
            result = params && params.length > 0 ? stmt.run(...params) : stmt.run();
          }
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Get or create prepared statement
   */
  private getPreparedStatement(sql: string): Database.Statement {
    if (!this.preparedStatements.has(sql)) {
      const stmt = this.db.prepare(sql);
      this.preparedStatements.set(sql, stmt);
      
      // Limit prepared statement cache size
      if (this.preparedStatements.size > 100) {
        const firstKey = this.preparedStatements.keys().next().value;
        if (firstKey !== undefined) {
          this.preparedStatements.delete(firstKey);
        }
      }
    }
    
    return this.preparedStatements.get(sql)!;
  }

  /**
   * Optimize database settings for performance
   */
  private optimizeDatabase(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    
    // Increase cache size (10MB)
    this.db.pragma('cache_size = -10000');
    
    // Enable memory mapping (256MB)
    this.db.pragma('mmap_size = 268435456');
    
    // Optimize for read-heavy workloads
    this.db.pragma('page_size = 4096');
    this.db.pragma('temp_store = MEMORY');
    
    // Enable query planner optimizations
    this.db.pragma('optimize');
    
    logger.info('Database optimizations applied', 'database');
  }

  /**
   * Create missing indexes for common queries
   */
  private createIndexes(): void {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_emails_chain_id ON emails(chain_id)',
      'CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email)',
      'CREATE INDEX IF NOT EXISTS idx_emails_subject ON emails(subject)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at DESC)'
    ];

    for (const index of indexes) {
      try {
        this.db.exec(index);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Index creation failed', 'database', {
          index: index.substring(0, 50),
          error: errorMessage
        });
      }
    }
    
    logger.info('Database indexes verified', 'database', { indexCount: indexes.length });
  }

  /**
   * Check if query is a read operation
   */
  private isReadQuery(sql: string): boolean {
    const trimmed = sql.trim().toLowerCase();
    return trimmed.startsWith('select') || 
           trimmed.startsWith('with') ||
           trimmed.startsWith('pragma');
  }

  /**
   * Generate cache key from query and parameters
   * Using SHA-256 instead of MD5 for better security
   */
  private getCacheKey(sql: string, params?: any[]): string {
    const input = JSON.stringify({ sql, params });
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Get result from cache if valid
   */
  private getFromCache(key: string): CachedResult | null {
    const entry = this.queryCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.queryCache.delete(key);
      return null;
    }

    // Update hit count
    entry.hitCount++;
    
    // Move to end (LRU behavior)
    this.queryCache.delete(key);
    this.queryCache.set(key, entry);

    return entry;
  }

  /**
   * Add result to cache with LRU eviction
   */
  private addToCache(key: string, data: any): void {
    // Evict oldest entries if cache is full
    if (this.queryCache.size >= this.maxCacheSize) {
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.queryCache.delete(firstKey);
      }
    }

    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      hitCount: 0
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of Array.from(this.queryCache.entries())) {
      if (now - entry.timestamp > this.cacheTTL * 2) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', 'database', {
        entriesRemoved: cleaned,
        cacheSize: this.queryCache.size
      });
    }
  }

  /**
   * Record query metrics for monitoring
   */
  private recordMetrics(query: string, executionTime: number, rowCount: number, cacheHit: boolean): void {
    const metric: QueryMetrics = {
      query: query.substring(0, 100),
      executionTime,
      rowCount,
      cacheHit,
      timestamp: Date.now()
    };

    this.queryMetrics.push(metric);

    // Limit metrics retention
    if (this.queryMetrics.length > this.metricsRetention) {
      this.queryMetrics.shift();
    }
  }

  /**
   * Analyze slow queries and suggest optimizations
   */
  private analyzeSlowQuery(sql: string, executionTime: number, params?: any[]): void {
    logger.warn('Slow query detected', 'database', {
      sql: sql.substring(0, 200),
      executionTime,
      params: params?.slice(0, 3)
    });

    // Analyze query plan
    try {
      const explainParams = params || [];
      const explain = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...explainParams);
      
      // Check for missing indexes
      const needsIndex = explain.some((row: any) => 
        row.detail?.includes('SCAN TABLE') || 
        row.detail?.includes('USING TEMP B-TREE')
      );

      if (needsIndex) {
        logger.warn('Query needs index optimization', 'database', {
          sql: sql.substring(0, 100),
          suggestion: 'Consider adding an index on the WHERE clause columns'
        });
      }
    } catch (error) {
      // Ignore explain errors
    }
  }

  /**
   * Get query statistics for monitoring
   */
  getStats(): QueryStats {
    const cacheHits = this.queryMetrics.filter(m => m.cacheHit).length;
    const cacheMisses = this.queryMetrics.filter(m => !m.cacheHit).length;
    const totalQueries = this.queryMetrics.length;
    
    const avgExecutionTime = totalQueries > 0
      ? this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
      : 0;

    const slowQueries = this.queryMetrics
      .filter(m => m.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    // Calculate cache memory usage (rough estimate)
    let cacheMemoryUsage = 0;
    for (const [key, value] of Array.from(this.queryCache.entries())) {
      cacheMemoryUsage += key.length + JSON.stringify(value.data).length;
    }

    return {
      totalQueries,
      cacheHits,
      cacheMisses,
      avgExecutionTime,
      slowQueries,
      cacheSize: this.queryCache.size,
      cacheEvictions: 0, // Not tracked yet
      cacheMemoryUsage: cacheMemoryUsage / 1024, // Convert to KB
      cacheEntries: this.queryCache.size,
      maxCacheSize: this.maxCacheSize,
      preparedStatements: this.preparedStatements.size,
      preparedReused: totalQueries - this.preparedStatements.size
    };
  }

  /**
   * Get metrics (alias for getStats for compatibility)
   */
  getMetrics(): QueryStats {
    return this.getStats();
  }

  /**
   * Get cache hit ratio
   */
  getCacheHitRatio(): number {
    const stats = this.getStats();
    const total = stats.cacheHits + stats.cacheMisses;
    return total > 0 ? (stats.cacheHits / total) * 100 : 0;
  }

  /**
   * Clear all caches and reset metrics
   */
  clearCache(): void {
    this.queryCache.clear();
    this.queryMetrics = [];
    logger.info('Query cache cleared', 'database');
  }

  /**
   * Execute raw SQL (synchronous, for backwards compatibility)
   */
  exec(sql: string): any {
    return this.db.exec(sql);
  }

  /**
   * Execute pragma statement (synchronous, for backwards compatibility)
   */
  pragma(pragma: string, value?: any): any {
    return this.db.pragma(pragma, value);
  }

  /**
   * Close database connection and clean up
   */
  close(): void {
    this.preparedStatements.clear();
    this.queryCache.clear();
    this.db.close();
    logger.info('Database connection closed', 'database');
  }
}