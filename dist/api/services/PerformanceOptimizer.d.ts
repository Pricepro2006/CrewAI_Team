export declare class PerformanceOptimizer {
    private queryCache;
    private performanceMetrics;
    private readonly CACHE_TTL;
    private readonly SLOW_QUERY_THRESHOLD;
    private readonly MAX_CACHE_SIZE;
    private readonly CACHE_CLEANUP_INTERVAL;
    private cleanupInterval;
    constructor();
    /**
     * Optimize database query based on 2025 best practices
     */
    optimizeQuery(query: string, params?: any[]): OptimizedQuery;
    /**
     * Apply SQL query optimization patterns from 2025 research
     */
    private applyQueryOptimizations;
    /**
     * Replace large IN clauses with JOINs (2025 best practice)
     */
    private optimizeInClauses;
    /**
     * Convert HAVING to WHERE when possible for better performance
     */
    private optimizeHavingClauses;
    /**
     * Replace SELECT * with specific columns when possible
     */
    private optimizeSelectStatements;
    /**
     * Optimize JOIN operations for better performance
     */
    private optimizeJoinOperations;
    /**
     * Add query hints for better execution plans
     */
    private addQueryHints;
    /**
     * Intelligent caching with TTL and size limits
     */
    cacheQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T>;
    /**
     * Generate cache key with query fingerprinting
     */
    private generateCacheKey;
    /**
     * Set cache entry with metadata
     */
    private setCache;
    /**
     * Check if cache entry is expired
     */
    private isCacheExpired;
    /**
     * Optimized pagination with offset optimization
     */
    optimizePagination(baseQuery: string, page: number, pageSize: number): PaginationQuery;
    /**
     * Generate cursor-based pagination for large datasets
     */
    private generateCursorPagination;
    /**
     * Monitor query performance and generate recommendations
     */
    private recordQueryPerformance;
    /**
     * Generate optimization recommendations based on query analysis
     */
    private generateOptimizationRecommendations;
    /**
     * Calculate estimated performance gain from optimization
     */
    private calculatePerformanceGain;
    /**
     * Generate a unique cache key for a query
     */
    generateQueryKey(query: string): string;
    /**
     * Cache-aware query execution wrapper
     */
    withCache<T>(cacheKey: string, queryFn: () => Promise<T>, ttl?: number): Promise<T>;
    /**
     * Get statistics about the optimizer
     */
    getStatistics(): {
        cacheSize: number;
        cacheHitRate: number;
        avgQueryTime: number;
        slowQueriesCount: number;
        totalOptimizationRecommendations: number;
    };
    /**
     * Cleanup resources
     */
    cleanup(): void;
    /**
     * Get performance metrics and insights
     */
    getPerformanceMetrics(): PerformanceReport;
    /**
     * Generate global performance recommendations
     */
    private generateGlobalRecommendations;
    /**
     * Calculate performance trend over time
     */
    private calculatePerformanceTrend;
    /**
     * Clear cache and reset metrics
     */
    clearCache(): void;
    /**
     * Start cache cleanup routine
     */
    private startCacheCleanup;
    /**
     * Stop cache cleanup routine
     */
    destroy(): void;
}
interface QueryMetric {
    query: string;
    executionTime: number;
    timestamp: number;
}
interface SlowQuery extends QueryMetric {
    recommendations: string[];
}
interface OptimizedQuery {
    originalQuery: string;
    optimizedQuery: string;
    params?: any[];
    estimatedPerformanceGain: number;
    recommendations: string[];
}
interface PaginationQuery {
    query: string;
    countQuery: string;
    isPaginationOptimized: boolean;
    paginationType: 'offset' | 'cursor';
    recommendations?: string[];
}
interface PerformanceReport {
    averageQueryTime: number;
    cacheHitRatio: number;
    totalCacheHits: number;
    totalCacheMisses: number;
    slowQueriesCount: number;
    cacheSize: number;
    recommendations: string[];
    recentSlowQueries: SlowQuery[];
    performanceTrend: PerformanceTrend;
}
interface PerformanceTrend {
    trend: 'improving' | 'degrading' | 'stable';
    percentChange: number;
}
export declare const performanceOptimizer: PerformanceOptimizer;
export {};
//# sourceMappingURL=PerformanceOptimizer.d.ts.map