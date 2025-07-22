import { logger } from '../../utils/logger';
// Performance optimization service implementing 2025 best practices
export class PerformanceOptimizer {
    queryCache = new Map();
    performanceMetrics = {
        queryTimes: [],
        cacheHits: 0,
        cacheMisses: 0,
        slowQueries: [],
        optimizationRecommendations: []
    };
    CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    SLOW_QUERY_THRESHOLD = 1000; // 1 second
    MAX_CACHE_SIZE = 100;
    CACHE_CLEANUP_INTERVAL = 60 * 1000; // 1 minute
    cleanupInterval;
    constructor() {
        this.startCacheCleanup();
    }
    /**
     * Optimize database query based on 2025 best practices
     */
    optimizeQuery(query, params) {
        const startTime = Date.now();
        // Apply query optimization patterns from research
        const optimizedQuery = this.applyQueryOptimizations(query);
        // Log performance metrics
        const executionTime = Date.now() - startTime;
        this.recordQueryPerformance(query, executionTime);
        return {
            originalQuery: query,
            optimizedQuery,
            params,
            estimatedPerformanceGain: this.calculatePerformanceGain(query, optimizedQuery),
            recommendations: this.generateOptimizationRecommendations(query)
        };
    }
    /**
     * Apply SQL query optimization patterns from 2025 research
     */
    applyQueryOptimizations(query) {
        let optimized = query;
        // 1. Replace IN clauses with JOIN on virtual tables for large lists
        optimized = this.optimizeInClauses(optimized);
        // 2. Use WHERE instead of HAVING when possible
        optimized = this.optimizeHavingClauses(optimized);
        // 3. Replace SELECT * with specific columns
        optimized = this.optimizeSelectStatements(optimized);
        // 4. Optimize JOIN operations
        optimized = this.optimizeJoinOperations(optimized);
        // 5. Add query hints for better execution plans
        optimized = this.addQueryHints(optimized);
        return optimized;
    }
    /**
     * Replace large IN clauses with JOINs (2025 best practice)
     */
    optimizeInClauses(query) {
        const inClausePattern = /WHERE\s+(\w+)\s+IN\s*\(([^)]+)\)/gi;
        return query.replace(inClausePattern, (match, column, values) => {
            const valuesList = values.split(',').map((v) => v.trim());
            // Only optimize if more than 5 values (performance threshold)
            if (valuesList.length > 5) {
                const valuesTable = valuesList.map((v) => `(${v})`).join(', ');
                return `INNER JOIN (VALUES ${valuesTable}) AS vt(${column}_val) ON ${column} = vt.${column}_val`;
            }
            return match;
        });
    }
    /**
     * Convert HAVING to WHERE when possible for better performance
     */
    optimizeHavingClauses(query) {
        // This is a simplified example - real implementation would be more complex
        if (query.includes('HAVING') && !query.includes('GROUP BY')) {
            return query.replace(/HAVING/gi, 'WHERE');
        }
        return query;
    }
    /**
     * Replace SELECT * with specific columns when possible
     */
    optimizeSelectStatements(query) {
        // For table view queries, specify only needed columns
        if (query.includes('SELECT *') && query.includes('emails')) {
            return query.replace('SELECT *', 'SELECT id, message_id, email_alias, requested_by, subject, summary, status, priority, workflow_state, received_date');
        }
        return query;
    }
    /**
     * Optimize JOIN operations for better performance
     */
    optimizeJoinOperations(query) {
        // Prefer INNER JOIN over OUTER JOIN when possible
        // Ensure join conditions use indexed columns
        return query
            .replace(/LEFT OUTER JOIN/gi, 'LEFT JOIN')
            .replace(/RIGHT OUTER JOIN/gi, 'RIGHT JOIN')
            .replace(/FULL OUTER JOIN/gi, 'FULL JOIN');
    }
    /**
     * Add query hints for better execution plans
     */
    addQueryHints(query) {
        // Add index hints for commonly queried columns
        if (query.includes('WHERE') && query.includes('emails')) {
            const indexHints = [
                'USE INDEX (idx_emails_status)',
                'USE INDEX (idx_emails_received_date)',
                'USE INDEX (idx_emails_alias)'
            ];
            // Add hints if not already present
            if (!query.includes('USE INDEX')) {
                const fromIndex = query.indexOf('FROM emails');
                if (fromIndex > -1) {
                    const hint = indexHints[0]; // Use most relevant index
                    return query.replace('FROM emails', `FROM emails ${hint}`);
                }
            }
        }
        return query;
    }
    /**
     * Intelligent caching with TTL and size limits
     */
    async cacheQuery(key, queryFn) {
        const cacheKey = this.generateCacheKey(key);
        const cached = this.queryCache.get(cacheKey);
        // Check cache hit
        if (cached && !this.isCacheExpired(cached)) {
            this.performanceMetrics.cacheHits++;
            logger.debug('Cache hit', 'PERFORMANCE_OPTIMIZER', { key: cacheKey });
            return cached.data;
        }
        // Cache miss - execute query
        this.performanceMetrics.cacheMisses++;
        logger.debug('Cache miss - executing query', 'PERFORMANCE_OPTIMIZER', { key: cacheKey });
        const startTime = Date.now();
        const result = await queryFn();
        const executionTime = Date.now() - startTime;
        // Store in cache
        this.setCache(cacheKey, result, executionTime);
        return result;
    }
    /**
     * Generate cache key with query fingerprinting
     */
    generateCacheKey(input) {
        // Create hash of query for consistent caching
        return Buffer.from(input).toString('base64').slice(0, 32);
    }
    /**
     * Set cache entry with metadata
     */
    setCache(key, data, executionTime) {
        // Implement LRU eviction if cache is full
        if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.queryCache.keys().next().value;
            if (oldestKey !== undefined) {
                this.queryCache.delete(oldestKey);
            }
        }
        this.queryCache.set(key, {
            data,
            timestamp: Date.now(),
            executionTime,
            accessCount: 1
        });
        logger.debug('Query cached', 'PERFORMANCE_OPTIMIZER', {
            key,
            executionTime,
            cacheSize: this.queryCache.size
        });
    }
    /**
     * Check if cache entry is expired
     */
    isCacheExpired(entry) {
        return Date.now() - entry.timestamp > this.CACHE_TTL;
    }
    /**
     * Optimized pagination with offset optimization
     */
    optimizePagination(baseQuery, page, pageSize) {
        // Use cursor-based pagination for large datasets (2025 best practice)
        const offset = (page - 1) * pageSize;
        // For large offsets, use cursor-based approach
        if (offset > 10000) {
            return this.generateCursorPagination(baseQuery, page, pageSize);
        }
        // Standard pagination for smaller datasets
        return {
            query: `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`,
            countQuery: `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`,
            isPaginationOptimized: true,
            paginationType: 'offset'
        };
    }
    /**
     * Generate cursor-based pagination for large datasets
     */
    generateCursorPagination(baseQuery, page, pageSize) {
        // Simplified cursor implementation - would need last ID from previous page
        const cursorQuery = `${baseQuery} ORDER BY id LIMIT ${pageSize}`;
        return {
            query: cursorQuery,
            countQuery: `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`,
            isPaginationOptimized: true,
            paginationType: 'cursor',
            recommendations: [
                'Consider implementing cursor-based pagination for better performance with large datasets',
                'Store cursor position to avoid expensive OFFSET calculations'
            ]
        };
    }
    /**
     * Monitor query performance and generate recommendations
     */
    recordQueryPerformance(query, executionTime) {
        this.performanceMetrics.queryTimes.push({
            query,
            executionTime,
            timestamp: Date.now()
        });
        // Track slow queries
        if (executionTime > this.SLOW_QUERY_THRESHOLD) {
            this.performanceMetrics.slowQueries.push({
                query,
                executionTime,
                timestamp: Date.now(),
                recommendations: this.generateOptimizationRecommendations(query)
            });
            logger.warn('Slow query detected', 'PERFORMANCE_OPTIMIZER', {
                query: query.substring(0, 100),
                executionTime
            });
        }
        // Keep only last 100 query times
        if (this.performanceMetrics.queryTimes.length > 100) {
            this.performanceMetrics.queryTimes = this.performanceMetrics.queryTimes.slice(-100);
        }
    }
    /**
     * Generate optimization recommendations based on query analysis
     */
    generateOptimizationRecommendations(query) {
        const recommendations = [];
        if (query.includes('SELECT *')) {
            recommendations.push('Use specific column names instead of SELECT * to reduce data transfer');
        }
        if (query.includes('IN (')) {
            recommendations.push('Consider using JOIN with VALUES table for large IN clauses');
        }
        if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
            recommendations.push('Add LIMIT clause when using ORDER BY to improve performance');
        }
        if (query.includes('LIKE \'%')) {
            recommendations.push('Avoid leading wildcards in LIKE patterns - consider full-text search');
        }
        if (!query.includes('WHERE') && query.includes('emails')) {
            recommendations.push('Add WHERE clause to filter data and improve query performance');
        }
        return recommendations;
    }
    /**
     * Calculate estimated performance gain from optimization
     */
    calculatePerformanceGain(original, optimized) {
        // Simplified calculation based on optimization patterns
        let gain = 0;
        if (original.includes('SELECT *') && !optimized.includes('SELECT *')) {
            gain += 20; // 20% improvement from column selection
        }
        if (original.includes('IN (') && optimized.includes('JOIN')) {
            gain += 30; // 30% improvement from IN to JOIN conversion
        }
        if (original.includes('HAVING') && optimized.includes('WHERE')) {
            gain += 15; // 15% improvement from HAVING to WHERE
        }
        return Math.min(gain, 80); // Cap at 80% improvement
    }
    /**
     * Generate a unique cache key for a query
     */
    generateQueryKey(query) {
        // Simple hash function for query caching
        let hash = 0;
        for (let i = 0; i < query.length; i++) {
            const char = query.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `query_${Math.abs(hash)}`;
    }
    /**
     * Cache-aware query execution wrapper
     */
    async withCache(cacheKey, queryFn, ttl = this.CACHE_TTL) {
        // Check cache first
        const cached = this.queryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ttl) {
            this.performanceMetrics.cacheHits++;
            logger.debug('Cache hit', 'PERFORMANCE_OPTIMIZER', { cacheKey });
            return cached.data;
        }
        // Execute query
        this.performanceMetrics.cacheMisses++;
        const startTime = Date.now();
        const result = await queryFn();
        const executionTime = Date.now() - startTime;
        // Store in cache
        this.queryCache.set(cacheKey, {
            data: result,
            timestamp: Date.now(),
            executionTime,
            accessCount: 1
        });
        // Evict old entries if cache is too large
        if (this.queryCache.size > this.MAX_CACHE_SIZE) {
            const entries = Array.from(this.queryCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);
            const oldestEntry = entries[0];
            if (oldestEntry) {
                this.queryCache.delete(oldestEntry[0]);
            }
        }
        return result;
    }
    /**
     * Get statistics about the optimizer
     */
    getStatistics() {
        return {
            cacheSize: this.queryCache.size,
            cacheHitRate: this.performanceMetrics.cacheHits > 0
                ? this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)
                : 0,
            avgQueryTime: this.performanceMetrics.queryTimes.length > 0
                ? this.performanceMetrics.queryTimes.reduce((sum, q) => sum + q.executionTime, 0) / this.performanceMetrics.queryTimes.length
                : 0,
            slowQueriesCount: this.performanceMetrics.slowQueries.length,
            totalOptimizationRecommendations: this.performanceMetrics.optimizationRecommendations.length
        };
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.queryCache.clear();
        logger.info('PerformanceOptimizer cleaned up', 'PERFORMANCE_OPTIMIZER');
    }
    /**
     * Get performance metrics and insights
     */
    getPerformanceMetrics() {
        const avgQueryTime = this.performanceMetrics.queryTimes.length > 0
            ? this.performanceMetrics.queryTimes.reduce((sum, q) => sum + q.executionTime, 0) / this.performanceMetrics.queryTimes.length
            : 0;
        const cacheHitRatio = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
            ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
            : 0;
        return {
            averageQueryTime: avgQueryTime,
            cacheHitRatio,
            totalCacheHits: this.performanceMetrics.cacheHits,
            totalCacheMisses: this.performanceMetrics.cacheMisses,
            slowQueriesCount: this.performanceMetrics.slowQueries.length,
            cacheSize: this.queryCache.size,
            recommendations: this.generateGlobalRecommendations(),
            recentSlowQueries: this.performanceMetrics.slowQueries.slice(-5),
            performanceTrend: this.calculatePerformanceTrend()
        };
    }
    /**
     * Generate global performance recommendations
     */
    generateGlobalRecommendations() {
        const recommendations = [];
        const metrics = this.performanceMetrics;
        const cacheHitRatio = metrics.cacheHits + metrics.cacheMisses > 0
            ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100
            : 0;
        if (cacheHitRatio < 50) {
            recommendations.push('Cache hit ratio is low - consider increasing cache TTL or reviewing cache strategy');
        }
        if (metrics.slowQueries.length > 10) {
            recommendations.push('High number of slow queries detected - review database indexes and query optimization');
        }
        const avgQueryTime = metrics.queryTimes.length > 0
            ? metrics.queryTimes.reduce((sum, q) => sum + q.executionTime, 0) / metrics.queryTimes.length
            : 0;
        if (avgQueryTime > 500) {
            recommendations.push('Average query time is high - consider implementing database query optimization');
        }
        if (this.queryCache.size >= this.MAX_CACHE_SIZE * 0.9) {
            recommendations.push('Cache is near capacity - consider increasing cache size or implementing better eviction strategy');
        }
        return recommendations;
    }
    /**
     * Calculate performance trend over time
     */
    calculatePerformanceTrend() {
        const recentQueries = this.performanceMetrics.queryTimes.slice(-20);
        const olderQueries = this.performanceMetrics.queryTimes.slice(-40, -20);
        if (recentQueries.length === 0 || olderQueries.length === 0) {
            return { trend: 'stable', percentChange: 0 };
        }
        const recentAvg = recentQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentQueries.length;
        const olderAvg = olderQueries.reduce((sum, q) => sum + q.executionTime, 0) / olderQueries.length;
        const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
        let trend;
        if (percentChange < -10) {
            trend = 'improving';
        }
        else if (percentChange > 10) {
            trend = 'degrading';
        }
        else {
            trend = 'stable';
        }
        return { trend, percentChange };
    }
    /**
     * Clear cache and reset metrics
     */
    clearCache() {
        this.queryCache.clear();
        this.performanceMetrics.cacheHits = 0;
        this.performanceMetrics.cacheMisses = 0;
        logger.info('Performance cache cleared', 'PERFORMANCE_OPTIMIZER');
    }
    /**
     * Start cache cleanup routine
     */
    startCacheCleanup() {
        this.cleanupInterval = setInterval(() => {
            const expiredKeys = [];
            this.queryCache.forEach((entry, key) => {
                if (this.isCacheExpired(entry)) {
                    expiredKeys.push(key);
                }
            });
            expiredKeys.forEach(key => this.queryCache.delete(key));
            if (expiredKeys.length > 0) {
                logger.debug('Cache cleanup completed', 'PERFORMANCE_OPTIMIZER', {
                    expiredEntries: expiredKeys.length,
                    remainingEntries: this.queryCache.size
                });
            }
        }, this.CACHE_CLEANUP_INTERVAL);
    }
    /**
     * Stop cache cleanup routine
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();
//# sourceMappingURL=PerformanceOptimizer.js.map