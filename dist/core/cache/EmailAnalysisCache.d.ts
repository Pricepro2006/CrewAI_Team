import { EmailAnalysis } from '../agents/specialized/EmailAnalysisTypes';
export declare class EmailAnalysisCache {
    private cache;
    private stats;
    constructor(options?: {
        maxSize?: number;
        ttl?: number;
    });
    /**
     * Get cached analysis
     */
    get(emailId: string): EmailAnalysis | undefined;
    /**
     * Cache analysis result
     */
    set(emailId: string, analysis: EmailAnalysis): void;
    /**
     * Check if email is cached
     */
    has(emailId: string): boolean;
    /**
     * Invalidate cache entry
     */
    invalidate(emailId: string): boolean;
    /**
     * Clear entire cache
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        hitRate: number;
        hits: number;
        misses: number;
        evictions: number;
    };
    /**
     * Prune old entries manually
     */
    prune(): number;
}
//# sourceMappingURL=EmailAnalysisCache.d.ts.map