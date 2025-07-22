/**
 * Query Cache Implementation
 *
 * Provides Redis-based caching for query results to improve performance
 * and reduce processing time for repeated queries.
 */
interface CacheConfig {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    defaultTTL?: number;
    maxRetries?: number;
}
interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    errors: number;
    hitRate: number;
}
export declare class QueryCache {
    private redis;
    private config;
    private stats;
    private enabled;
    constructor(config?: CacheConfig);
    private initialize;
    /**
     * Get cached query result
     */
    get<T = any>(query: string, context?: Record<string, any>): Promise<T | null>;
    /**
     * Cache query result
     */
    set(query: string, data: any, ttl?: number, context?: Record<string, any>): Promise<void>;
    /**
     * Clear specific cache entry
     */
    clear(query: string, context?: Record<string, any>): Promise<void>;
    /**
     * Clear all query cache entries
     */
    clearAll(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Check if cache is enabled and connected
     */
    isEnabled(): boolean;
    /**
     * Get cache health status
     */
    getHealth(): Promise<{
        status: string;
        latency?: number;
        error?: string;
    }>;
    /**
     * Generate cache key from query and context
     */
    private generateKey;
    /**
     * Update hit rate calculation
     */
    private updateHitRate;
    /**
     * Cleanup and close connections
     */
    close(): Promise<void>;
}
/**
 * Get global query cache instance
 */
export declare function getQueryCache(): QueryCache;
export {};
//# sourceMappingURL=QueryCache.d.ts.map