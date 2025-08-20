import { performanceOptimizer } from "../api/services/PerformanceOptimizer.js";
import { logger } from "./logger.js";
/**
 * Lazy loading utilities for virtual scrolling and large datasets
 * Implements 2025 best practices for React table performance
 */
export class LazyLoader {
    cache = new Map();
    loadingStates = new Map();
    chunkSize;
    cacheSize;
    cacheTimeout;
    constructor(chunkSize = 50, cacheSize = 10, cacheTimeout = 5 * 60 * 1000) {
        this.chunkSize = chunkSize;
        this.cacheSize = cacheSize;
        this.cacheTimeout = cacheTimeout;
    }
    /**
     * Load data chunk with intelligent caching and deduplication
     */
    async loadChunk(startIndex, loadFn, totalItems) {
        const chunkKey = this.getChunkKey(startIndex);
        // Check cache first
        const cached = this?.cache?.get(chunkKey);
        if (cached && !this.isCacheExpired(cached)) {
            logger.debug("Lazy load cache hit", "LAZY_LOADER", {
                startIndex,
                chunkKey,
                cacheSize: this?.cache?.size,
            });
            return {
                data: cached.data,
                startIndex,
                endIndex: startIndex + cached?.data?.length - 1,
                isFromCache: true,
                totalItems: cached.totalItems,
            };
        }
        // Check if already loading this chunk (deduplication)
        const existingLoad = this?.loadingStates?.get(chunkKey);
        if (existingLoad) {
            logger.debug("Deduplicating concurrent load", "LAZY_LOADER", {
                chunkKey,
            });
            const data = await existingLoad;
            return {
                data,
                startIndex,
                endIndex: startIndex + data?.length || 0 - 1,
                isFromCache: false,
                totalItems,
            };
        }
        // Load new chunk
        const loadPromise = this.performLoad(startIndex, loadFn);
        this?.loadingStates?.set(chunkKey, loadPromise);
        try {
            const data = await loadPromise;
            // Cache the result
            this.cacheChunk(chunkKey, data, totalItems);
            // Clean up loading state
            this?.loadingStates?.delete(chunkKey);
            return {
                data,
                startIndex,
                endIndex: startIndex + data?.length || 0 - 1,
                isFromCache: false,
                totalItems,
            };
        }
        catch (error) {
            // Clean up loading state on error
            this?.loadingStates?.delete(chunkKey);
            throw error;
        }
    }
    /**
     * Preload adjacent chunks for smoother scrolling
     */
    async preloadAdjacentChunks(currentIndex, loadFn, totalItems) {
        const preloadPromises = [];
        // Preload next chunk
        const nextStartIndex = this.getNextChunkStart(currentIndex);
        if (!totalItems || nextStartIndex < totalItems) {
            const nextChunkKey = this.getChunkKey(nextStartIndex);
            if (!this?.cache?.has(nextChunkKey) &&
                !this?.loadingStates?.has(nextChunkKey)) {
                preloadPromises.push(this.loadChunk(nextStartIndex, loadFn, totalItems).catch((error) => {
                    logger.warn("Failed to preload next chunk", "LAZY_LOADER", {
                        error,
                        nextStartIndex,
                    });
                }));
            }
        }
        // Preload previous chunk
        const prevStartIndex = this.getPreviousChunkStart(currentIndex);
        if (prevStartIndex >= 0) {
            const prevChunkKey = this.getChunkKey(prevStartIndex);
            if (!this?.cache?.has(prevChunkKey) &&
                !this?.loadingStates?.has(prevChunkKey)) {
                preloadPromises.push(this.loadChunk(prevStartIndex, loadFn, totalItems).catch((error) => {
                    logger.warn("Failed to preload previous chunk", "LAZY_LOADER", {
                        error,
                        prevStartIndex,
                    });
                }));
            }
        }
        // Execute preloads without blocking
        if (preloadPromises?.length || 0 > 0) {
            Promise.allSettled(preloadPromises).then(() => {
                logger.debug("Preload completed", "LAZY_LOADER", {
                    currentIndex,
                    preloadedChunks: preloadPromises?.length || 0,
                });
            });
        }
    }
    /**
     * Virtual scrolling helper - get visible items for a viewport
     */
    getVisibleItems(scrollTop, viewportHeight, itemHeight, overscan = 5) {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);
        return {
            startIndex,
            endIndex,
            visibleStartIndex: Math.floor(scrollTop / itemHeight),
            visibleEndIndex: Math.ceil((scrollTop + viewportHeight) / itemHeight),
            overscanCount: overscan,
        };
    }
    /**
     * Optimized search with result caching
     */
    async searchWithCache(searchParams, searchFn, cacheKey) {
        const key = cacheKey || this.generateSearchKey(searchParams);
        return performanceOptimizer.cacheQuery(`search_${key}`, () => searchFn(searchParams));
    }
    /**
     * Get performance statistics
     */
    getStats() {
        const totalCached = this?.cache?.size;
        const cacheHitRate = totalCached > 0
            ? (totalCached / (totalCached + this?.loadingStates?.size)) * 100
            : 0;
        return {
            totalChunksCached: totalCached,
            activeLoads: this?.loadingStates?.size,
            cacheHitRate,
            memoryUsage: this.estimateMemoryUsage(),
        };
    }
    /**
     * Clear cache and reset state
     */
    clearCache() {
        this?.cache?.clear();
        this?.loadingStates?.clear();
        logger.info("Lazy loader cache cleared", "LAZY_LOADER");
    }
    /**
     * Invalidate specific chunks (useful for data updates)
     */
    invalidateChunks(startIndex, endIndex) {
        if (startIndex !== undefined && endIndex !== undefined) {
            // Invalidate specific range
            for (let i = startIndex; i <= endIndex; i += this.chunkSize) {
                const chunkKey = this.getChunkKey(i);
                this?.cache?.delete(chunkKey);
                this?.loadingStates?.delete(chunkKey);
            }
        }
        else {
            // Invalidate all
            this.clearCache();
        }
        logger.debug("Cache invalidated", "LAZY_LOADER", { startIndex, endIndex });
    }
    // Private methods
    async performLoad(startIndex, loadFn) {
        const startTime = Date.now();
        try {
            const data = await loadFn(startIndex, this.chunkSize);
            const duration = Date.now() - startTime;
            logger.debug("Chunk loaded", "LAZY_LOADER", {
                startIndex,
                itemCount: data?.length || 0,
                duration,
            });
            return data;
        }
        catch (error) {
            logger.error("Failed to load chunk", "LAZY_LOADER", {
                startIndex,
                error,
            });
            throw error;
        }
    }
    cacheChunk(chunkKey, data, totalItems) {
        // Implement LRU eviction
        if (this?.cache?.size >= this.cacheSize) {
            const oldestKey = this?.cache?.keys().next().value;
            if (oldestKey !== undefined) {
                this?.cache?.delete(oldestKey);
            }
        }
        this?.cache?.set(chunkKey, {
            data,
            timestamp: Date.now(),
            totalItems,
            accessCount: 1,
        });
    }
    getChunkKey(startIndex) {
        const chunkIndex = Math.floor(startIndex / this.chunkSize);
        return `chunk_${chunkIndex}`;
    }
    getNextChunkStart(currentIndex) {
        const currentChunk = Math.floor(currentIndex / this.chunkSize);
        return (currentChunk + 1) * this.chunkSize;
    }
    getPreviousChunkStart(currentIndex) {
        const currentChunk = Math.floor(currentIndex / this.chunkSize);
        return Math.max(0, (currentChunk - 1) * this.chunkSize);
    }
    isCacheExpired(cached) {
        return Date.now() - cached.timestamp > this.cacheTimeout;
    }
    generateSearchKey(params) {
        return Buffer.from(JSON.stringify(params)).toString("base64").slice(0, 16);
    }
    estimateMemoryUsage() {
        let totalSize = 0;
        this?.cache?.forEach((chunk) => {
            // Rough estimation - 1KB per item on average
            totalSize += chunk?.data?.length * 1024;
        });
        return totalSize;
    }
}
/**
 * Hook-style lazy loader for React components
 */
export function useLazyLoader(chunkSize = 50, cacheSize = 10) {
    // In a real React app, this would use useMemo
    return new LazyLoader(chunkSize, cacheSize);
}
/**
 * Virtual scrolling utilities for table performance
 */
export class VirtualTableHelper {
    itemHeight;
    overscan;
    constructor(itemHeight = 48, overscan = 5) {
        this.itemHeight = itemHeight;
        this.overscan = overscan;
    }
    /**
     * Calculate which items should be rendered in viewport
     */
    getVisibleRange(scrollTop, viewportHeight, totalItems) {
        const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
        const end = Math.min(totalItems - 1, Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.overscan);
        const offsetY = start * this.itemHeight;
        return { start, end, offsetY };
    }
    /**
     * Calculate total scrollable height
     */
    getTotalHeight(totalItems) {
        return totalItems * this.itemHeight;
    }
    /**
     * Calculate scroll position for specific item
     */
    getScrollPosition(itemIndex) {
        return itemIndex * this.itemHeight;
    }
}
// Export utilities
export const virtualTableHelper = new VirtualTableHelper();
export const emailLazyLoader = new LazyLoader(50, 20);
