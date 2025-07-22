/**
 * Lazy loading utilities for virtual scrolling and large datasets
 * Implements 2025 best practices for React table performance
 */
export declare class LazyLoader<T> {
    private cache;
    private loadingStates;
    private readonly chunkSize;
    private readonly cacheSize;
    private readonly cacheTimeout;
    constructor(chunkSize?: number, cacheSize?: number, cacheTimeout?: number);
    /**
     * Load data chunk with intelligent caching and deduplication
     */
    loadChunk(startIndex: number, loadFn: (offset: number, limit: number) => Promise<T[]>, totalItems?: number): Promise<LazyLoadResult<T>>;
    /**
     * Preload adjacent chunks for smoother scrolling
     */
    preloadAdjacentChunks(currentIndex: number, loadFn: (offset: number, limit: number) => Promise<T[]>, totalItems?: number): Promise<void>;
    /**
     * Virtual scrolling helper - get visible items for a viewport
     */
    getVisibleItems(scrollTop: number, viewportHeight: number, itemHeight: number, overscan?: number): VirtualScrollInfo;
    /**
     * Optimized search with result caching
     */
    searchWithCache<S>(searchParams: S, searchFn: (params: S) => Promise<T[]>, cacheKey?: string): Promise<T[]>;
    /**
     * Get performance statistics
     */
    getStats(): LazyLoadStats;
    /**
     * Clear cache and reset state
     */
    clearCache(): void;
    /**
     * Invalidate specific chunks (useful for data updates)
     */
    invalidateChunks(startIndex?: number, endIndex?: number): void;
    private performLoad;
    private cacheChunk;
    private getChunkKey;
    private getNextChunkStart;
    private getPreviousChunkStart;
    private isCacheExpired;
    private generateSearchKey;
    private estimateMemoryUsage;
}
interface LazyLoadResult<T> {
    data: T[];
    startIndex: number;
    endIndex: number;
    isFromCache: boolean;
    totalItems?: number;
}
interface VirtualScrollInfo {
    startIndex: number;
    endIndex: number;
    visibleStartIndex: number;
    visibleEndIndex: number;
    overscanCount: number;
}
interface LazyLoadStats {
    totalChunksCached: number;
    activeLoads: number;
    cacheHitRate: number;
    memoryUsage: number;
}
/**
 * Hook-style lazy loader for React components
 */
export declare function useLazyLoader<T>(chunkSize?: number, cacheSize?: number): LazyLoader<T>;
/**
 * Virtual scrolling utilities for table performance
 */
export declare class VirtualTableHelper {
    private itemHeight;
    private overscan;
    constructor(itemHeight?: number, overscan?: number);
    /**
     * Calculate which items should be rendered in viewport
     */
    getVisibleRange(scrollTop: number, viewportHeight: number, totalItems: number): {
        start: number;
        end: number;
        offsetY: number;
    };
    /**
     * Calculate total scrollable height
     */
    getTotalHeight(totalItems: number): number;
    /**
     * Calculate scroll position for specific item
     */
    getScrollPosition(itemIndex: number): number;
}
export declare const virtualTableHelper: VirtualTableHelper;
export declare const emailLazyLoader: LazyLoader<any>;
export {};
//# sourceMappingURL=LazyLoader.d.ts.map