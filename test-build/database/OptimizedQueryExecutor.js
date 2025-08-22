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
export class OptimizedQueryExecutor {
    db;
    queryCache = new Map();
    preparedStatements = new Map();
    queryMetrics = [];
    // Configuration
    cacheTTL = 5000; // 5 seconds for dynamic data
    maxCacheSize = 1000;
    slowQueryThreshold = 100; // ms
    metricsRetention = 1000; // Keep last 1000 queries
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.optimizeDatabase();
        this.createIndexes();
        // Periodic cache cleanup
        setInterval(() => this.cleanupCache(), 30000); // Every 30 seconds
        logger.info('OptimizedQueryExecutor initialized', { dbPath });
    }
    /**
     * Execute query synchronously (for backwards compatibility)
     * WARNING: This bypasses async optimizations - use executeAsync when possible
     */
    executeSync(sql, params) {
        const startTime = Date.now();
        const isReadQuery = this.isReadQuery(sql);
        const cacheKey = this.getCacheKey(sql, params);
        try {
            // Check cache for read queries
            if (isReadQuery) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.recordMetrics(sql, Date.now() - startTime, cached.data.length, true);
                    return cached.data;
                }
            }
            // Execute query synchronously
            const stmt = this.getPreparedStatement(sql);
            let result;
            if (isReadQuery) {
                result = params ? stmt.all(...params) : stmt.all();
            }
            else {
                result = params ? stmt.run(...params) : stmt.run();
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
            return result;
        }
        catch (error) {
            logger.error('Query execution failed', {
                sql: sql.substring(0, 100),
                error: error.message,
                executionTime: Date.now() - startTime
            });
            throw error;
        }
    }
    /**
     * Get or create a synchronous prepared statement wrapper
     */
    prepare(sql) {
        const stmt = this.getPreparedStatement(sql);
        const self = this;
        return {
            run: (...params) => self.executeSync(sql, params),
            get: (...params) => {
                const stmt = self.getPreparedStatement(sql);
                return params ? stmt.get(...params) : stmt.get();
            },
            all: (...params) => self.executeSync(sql, params),
            iterate: function* (...params) {
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
    async execute(sql, params) {
        const startTime = Date.now();
        const isReadQuery = this.isReadQuery(sql);
        const cacheKey = this.getCacheKey(sql, params);
        try {
            // Check cache for read queries
            if (isReadQuery) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.recordMetrics(sql, Date.now() - startTime, cached.data.length, true);
                    return cached.data;
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
            return result;
        }
        catch (error) {
            logger.error('Query execution failed', {
                sql: sql.substring(0, 100),
                error: error.message,
                executionTime: Date.now() - startTime
            });
            throw error;
        }
    }
    /**
     * Execute a synchronous transaction (for backwards compatibility)
     */
    transaction(fn) {
        const wrappedDb = {
            prepare: (sql) => this.prepare(sql),
            exec: (sql) => this.db.exec(sql),
            pragma: (pragma, value) => this.db.pragma(pragma, value)
        };
        const transaction = this.db.transaction((db) => fn(wrappedDb));
        return transaction();
    }
    /**
     * Execute multiple queries in a transaction (async)
     */
    async executeTransaction(queries) {
        const startTime = Date.now();
        const results = [];
        const transaction = this.db.transaction((queries) => {
            for (const { sql, params } of queries) {
                const stmt = this.getPreparedStatement(sql);
                const result = params ? stmt.all(...params) : stmt.all();
                results.push(result);
            }
        });
        try {
            transaction(queries);
            logger.debug('Transaction completed', {
                queryCount: queries.length,
                executionTime: Date.now() - startTime
            });
            return results;
        }
        catch (error) {
            logger.error('Transaction failed', {
                error: error.message,
                queryCount: queries.length
            });
            throw error;
        }
    }
    /**
     * Execute query with prepared statement
     */
    executeQuery(sql, params) {
        const stmt = this.getPreparedStatement(sql);
        // Use setImmediate to avoid blocking the event loop
        return new Promise((resolve, reject) => {
            setImmediate(() => {
                try {
                    let result;
                    if (this.isReadQuery(sql)) {
                        result = params ? stmt.all(...params) : stmt.all();
                    }
                    else {
                        result = params ? stmt.run(...params) : stmt.run();
                    }
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    /**
     * Get or create prepared statement
     */
    getPreparedStatement(sql) {
        if (!this.preparedStatements.has(sql)) {
            const stmt = this.db.prepare(sql);
            this.preparedStatements.set(sql, stmt);
            // Limit prepared statement cache size
            if (this.preparedStatements.size > 100) {
                const firstKey = this.preparedStatements.keys().next().value;
                this.preparedStatements.delete(firstKey);
            }
        }
        return this.preparedStatements.get(sql);
    }
    /**
     * Optimize database settings for performance
     */
    optimizeDatabase() {
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
        logger.info('Database optimizations applied');
    }
    /**
     * Create missing indexes for common queries
     */
    createIndexes() {
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
            }
            catch (error) {
                logger.warn('Index creation failed', {
                    index: index.substring(0, 50),
                    error: error.message
                });
            }
        }
        logger.info('Database indexes verified', { indexCount: indexes.length });
    }
    /**
     * Check if query is a read operation
     */
    isReadQuery(sql) {
        const trimmed = sql.trim().toLowerCase();
        return trimmed.startsWith('select') ||
            trimmed.startsWith('with') ||
            trimmed.startsWith('pragma');
    }
    /**
     * Generate cache key from query and parameters
     * Using SHA-256 instead of MD5 for better security
     */
    getCacheKey(sql, params) {
        const input = JSON.stringify({ sql, params });
        return crypto.createHash('sha256').update(input).digest('hex');
    }
    /**
     * Get result from cache if valid
     */
    getFromCache(key) {
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
    addToCache(key, data) {
        // Evict oldest entries if cache is full
        if (this.queryCache.size >= this.maxCacheSize) {
            const firstKey = this.queryCache.keys().next().value;
            this.queryCache.delete(firstKey);
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
    cleanupCache() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.queryCache.entries()) {
            if (now - entry.timestamp > this.cacheTTL * 2) {
                this.queryCache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.debug('Cache cleanup completed', {
                entriesRemoved: cleaned,
                cacheSize: this.queryCache.size
            });
        }
    }
    /**
     * Record query metrics for monitoring
     */
    recordMetrics(query, executionTime, rowCount, cacheHit) {
        const metric = {
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
    analyzeSlowQuery(sql, executionTime, params) {
        logger.warn('Slow query detected', {
            sql: sql.substring(0, 200),
            executionTime,
            params: params?.slice(0, 3)
        });
        // Analyze query plan
        try {
            const explain = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(params || []));
            // Check for missing indexes
            const needsIndex = explain.some((row) => row.detail?.includes('SCAN TABLE') ||
                row.detail?.includes('USING TEMP B-TREE'));
            if (needsIndex) {
                logger.warn('Query needs index optimization', {
                    sql: sql.substring(0, 100),
                    suggestion: 'Consider adding an index on the WHERE clause columns'
                });
            }
        }
        catch (error) {
            // Ignore explain errors
        }
    }
    /**
     * Get query statistics for monitoring
     */
    getStats() {
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
        for (const [key, value] of this.queryCache.entries()) {
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
    getMetrics() {
        return this.getStats();
    }
    /**
     * Get cache hit ratio
     */
    getCacheHitRatio() {
        const stats = this.getStats();
        const total = stats.cacheHits + stats.cacheMisses;
        return total > 0 ? (stats.cacheHits / total) * 100 : 0;
    }
    /**
     * Clear all caches and reset metrics
     */
    clearCache() {
        this.queryCache.clear();
        this.queryMetrics = [];
        logger.info('Query cache cleared');
    }
    /**
     * Execute raw SQL (synchronous, for backwards compatibility)
     */
    exec(sql) {
        return this.db.exec(sql);
    }
    /**
     * Execute pragma statement (synchronous, for backwards compatibility)
     */
    pragma(pragma, value) {
        return this.db.pragma(pragma, value);
    }
    /**
     * Close database connection and clean up
     */
    close() {
        this.preparedStatements.clear();
        this.queryCache.clear();
        this.db.close();
        logger.info('Database connection closed');
    }
}
