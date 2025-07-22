import type { ValidationResult } from '../validators/BusinessResponseValidator';
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
    maxSize: number;
    maxAge: number;
    staleWhileRevalidate: number;
    useRedis: boolean;
    redisPrefix: string;
    compressionThreshold: number;
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
export declare class BusinessSearchCache {
    private memoryCache;
    private redisClient?;
    private config;
    private stats;
    private responseTimeHistory;
    private readonly MAX_RESPONSE_TIME_HISTORY;
    constructor(config?: Partial<CacheConfig>);
    private initializeRedis;
    /**
     * Generate a cache key from query and location
     */
    private generateKey;
    /**
     * Get an entry from cache
     */
    get(query: string, location?: string): Promise<CacheEntry | null>;
    /**
     * Set an entry in cache
     */
    set(query: string, location: string | undefined, response: string, validation?: ValidationResult, metadata?: Partial<CacheEntry['metadata']>): Promise<void>;
    /**
     * Delete an entry from cache
     */
    delete(query: string, location?: string): Promise<boolean>;
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    /**
     * Preload cache with common queries
     */
    preload(queries: Array<{
        query: string;
        location?: string;
        response: string;
    }>): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get entries matching a pattern
     */
    search(pattern: RegExp): Promise<Array<{
        key: string;
        entry: CacheEntry;
    }>>;
    /**
     * Analyze cache performance
     */
    analyzePerformance(): {
        hotQueries: Array<{
            query: string;
            location?: string;
            hitCount: number;
        }>;
        staleEntries: number;
        avgAge: number;
        memoryPressure: number;
    };
    /**
     * Track response time for metrics
     */
    private trackResponseTime;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Export cache for analysis
     */
    exportCache(): Promise<Array<CacheEntry & {
        key: string;
    }>>;
    /**
     * Import cache entries
     */
    importCache(entries: Array<CacheEntry & {
        key: string;
    }>): Promise<void>;
}
//# sourceMappingURL=BusinessSearchCache.d.ts.map