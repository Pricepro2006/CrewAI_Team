import type { ContactInfo } from '../BusinessResponseValidator.js';
export interface FallbackSearchOptions {
    query: string;
    missingInfo: string[];
    currentResults?: ContactInfo;
    location?: string;
    searchDepth?: 'shallow' | 'deep';
}
export interface FallbackSearchResult {
    success: boolean;
    enhancedInfo?: ContactInfo;
    searchQueries: string[];
    sourcesUsed: string[];
    error?: string;
}
export interface DataSource {
    name: string;
    priority: number;
    searchFunction: (query: string) => Promise<string>;
    isAvailable: () => Promise<boolean>;
}
export declare class FallbackSearchManager {
    private dataSources;
    private searchHistory;
    private userFeedback;
    constructor();
    /**
     * Initialize available data sources
     */
    private initializeDataSources;
    /**
     * Perform fallback search when initial validation fails
     */
    performFallbackSearch(options: FallbackSearchOptions): Promise<FallbackSearchResult>;
    /**
     * Generate optimized search queries based on missing information
     */
    private generateSearchQueries;
    /**
     * Check if results contain required information
     */
    private hasRequiredInfo;
    /**
     * Parse search results into ContactInfo structure
     */
    private parseSearchResults;
    /**
     * Generate cache key for search
     */
    private generateCacheKey;
    /**
     * Record user feedback on search results
     */
    recordFeedback(query: string, helpful: boolean, reason?: string): void;
    /**
     * Get feedback summary for a query
     */
    getFeedbackSummary(query: string): {
        totalFeedback: number;
        helpfulPercentage: number;
        commonIssues: string[];
    };
    /**
     * Add a new data source dynamically
     */
    addDataSource(source: DataSource): void;
    /**
     * Remove a data source
     */
    removeDataSource(name: string): void;
    /**
     * Get available data sources
     */
    getAvailableDataSources(): Promise<string[]>;
    /**
     * Clear search cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        hits: number;
        misses: number;
    };
}
//# sourceMappingURL=FallbackSearchManager.d.ts.map