import { performanceOptimizer } from '../api/services/PerformanceOptimizer';
import { logger } from './logger';

/**
 * Lazy loading utilities for virtual scrolling and large datasets
 * Implements 2025 best practices for React table performance
 */
export class LazyLoader<T> {
  private cache: Map<string, CachedChunk<T>> = new Map();
  private loadingStates: Map<string, Promise<T[]>> = new Map();
  private readonly chunkSize: number;
  private readonly cacheSize: number;
  private readonly cacheTimeout: number;
  
  constructor(
    chunkSize: number = 50,
    cacheSize: number = 10,
    cacheTimeout: number = 5 * 60 * 1000 // 5 minutes
  ) {
    this.chunkSize = chunkSize;
    this.cacheSize = cacheSize;
    this.cacheTimeout = cacheTimeout;
  }
  
  /**
   * Load data chunk with intelligent caching and deduplication
   */
  async loadChunk(
    startIndex: number,
    loadFn: (offset: number, limit: number) => Promise<T[]>,
    totalItems?: number
  ): Promise<LazyLoadResult<T>> {
    const chunkKey = this.getChunkKey(startIndex);
    
    // Check cache first
    const cached = this.cache.get(chunkKey);
    if (cached && !this.isCacheExpired(cached)) {
      logger.debug('Lazy load cache hit', 'LAZY_LOADER', { 
        startIndex, 
        chunkKey,
        cacheSize: this.cache.size 
      });
      
      return {
        data: cached.data,
        startIndex,
        endIndex: startIndex + cached.data.length - 1,
        isFromCache: true,
        totalItems: cached.totalItems
      };
    }
    
    // Check if already loading this chunk (deduplication)
    const existingLoad = this.loadingStates.get(chunkKey);
    if (existingLoad) {
      logger.debug('Deduplicating concurrent load', 'LAZY_LOADER', { chunkKey });
      const data = await existingLoad;
      return {
        data,
        startIndex,
        endIndex: startIndex + data.length - 1,
        isFromCache: false,
        totalItems
      };
    }
    
    // Load new chunk
    const loadPromise = this.performLoad(startIndex, loadFn);
    this.loadingStates.set(chunkKey, loadPromise);
    
    try {
      const data = await loadPromise;
      
      // Cache the result
      this.cacheChunk(chunkKey, data, totalItems);
      
      // Clean up loading state
      this.loadingStates.delete(chunkKey);
      
      return {
        data,
        startIndex,
        endIndex: startIndex + data.length - 1,
        isFromCache: false,
        totalItems
      };
    } catch (error) {
      // Clean up loading state on error
      this.loadingStates.delete(chunkKey);
      throw error;
    }
  }
  
  /**
   * Preload adjacent chunks for smoother scrolling
   */
  async preloadAdjacentChunks(
    currentIndex: number,
    loadFn: (offset: number, limit: number) => Promise<T[]>,
    totalItems?: number
  ): Promise<void> {
    const preloadPromises: Promise<any>[] = [];
    
    // Preload next chunk
    const nextStartIndex = this.getNextChunkStart(currentIndex);
    if (!totalItems || nextStartIndex < totalItems) {
      const nextChunkKey = this.getChunkKey(nextStartIndex);
      if (!this.cache.has(nextChunkKey) && !this.loadingStates.has(nextChunkKey)) {
        preloadPromises.push(
          this.loadChunk(nextStartIndex, loadFn, totalItems).catch(error => {
            logger.warn('Failed to preload next chunk', 'LAZY_LOADER', { error, nextStartIndex });
          })
        );
      }
    }
    
    // Preload previous chunk
    const prevStartIndex = this.getPreviousChunkStart(currentIndex);
    if (prevStartIndex >= 0) {
      const prevChunkKey = this.getChunkKey(prevStartIndex);
      if (!this.cache.has(prevChunkKey) && !this.loadingStates.has(prevChunkKey)) {
        preloadPromises.push(
          this.loadChunk(prevStartIndex, loadFn, totalItems).catch(error => {
            logger.warn('Failed to preload previous chunk', 'LAZY_LOADER', { error, prevStartIndex });
          })
        );
      }
    }
    
    // Execute preloads without blocking
    if (preloadPromises.length > 0) {
      Promise.allSettled(preloadPromises).then(() => {
        logger.debug('Preload completed', 'LAZY_LOADER', { 
          currentIndex, 
          preloadedChunks: preloadPromises.length 
        });
      });
    }
  }
  
  /**
   * Virtual scrolling helper - get visible items for a viewport
   */
  getVisibleItems(
    scrollTop: number,
    viewportHeight: number,
    itemHeight: number,
    overscan: number = 5
  ): VirtualScrollInfo {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
    );
    
    return {
      startIndex,
      endIndex,
      visibleStartIndex: Math.floor(scrollTop / itemHeight),
      visibleEndIndex: Math.ceil((scrollTop + viewportHeight) / itemHeight),
      overscanCount: overscan
    };
  }
  
  /**
   * Optimized search with result caching
   */
  async searchWithCache<S>(
    searchParams: S,
    searchFn: (params: S) => Promise<T[]>,
    cacheKey?: string
  ): Promise<T[]> {
    const key = cacheKey || this.generateSearchKey(searchParams);
    
    return performanceOptimizer.cacheQuery(
      `search_${key}`,
      () => searchFn(searchParams)
    );
  }
  
  /**
   * Get performance statistics
   */
  getStats(): LazyLoadStats {
    const totalCached = this.cache.size;
    const cacheHitRate = totalCached > 0 ? (totalCached / (totalCached + this.loadingStates.size)) * 100 : 0;
    
    return {
      totalChunksCached: totalCached,
      activeLoads: this.loadingStates.size,
      cacheHitRate,
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  /**
   * Clear cache and reset state
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingStates.clear();
    logger.info('Lazy loader cache cleared', 'LAZY_LOADER');
  }
  
  /**
   * Invalidate specific chunks (useful for data updates)
   */
  invalidateChunks(startIndex?: number, endIndex?: number): void {
    if (startIndex !== undefined && endIndex !== undefined) {
      // Invalidate specific range
      for (let i = startIndex; i <= endIndex; i += this.chunkSize) {
        const chunkKey = this.getChunkKey(i);
        this.cache.delete(chunkKey);
        this.loadingStates.delete(chunkKey);
      }
    } else {
      // Invalidate all
      this.clearCache();
    }
    
    logger.debug('Cache invalidated', 'LAZY_LOADER', { startIndex, endIndex });
  }
  
  // Private methods
  
  private async performLoad(
    startIndex: number,
    loadFn: (offset: number, limit: number) => Promise<T[]>
  ): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      const data = await loadFn(startIndex, this.chunkSize);
      const duration = Date.now() - startTime;
      
      logger.debug('Chunk loaded', 'LAZY_LOADER', {
        startIndex,
        itemCount: data.length,
        duration
      });
      
      return data;
    } catch (error) {
      logger.error('Failed to load chunk', 'LAZY_LOADER', {
        startIndex,
        error
      });
      throw error;
    }
  }
  
  private cacheChunk(chunkKey: string, data: T[], totalItems?: number): void {
    // Implement LRU eviction
    if (this.cache.size >= this.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(chunkKey, {
      data,
      timestamp: Date.now(),
      totalItems,
      accessCount: 1
    });
  }
  
  private getChunkKey(startIndex: number): string {
    const chunkIndex = Math.floor(startIndex / this.chunkSize);
    return `chunk_${chunkIndex}`;
  }
  
  private getNextChunkStart(currentIndex: number): number {
    const currentChunk = Math.floor(currentIndex / this.chunkSize);
    return (currentChunk + 1) * this.chunkSize;
  }
  
  private getPreviousChunkStart(currentIndex: number): number {
    const currentChunk = Math.floor(currentIndex / this.chunkSize);
    return Math.max(0, (currentChunk - 1) * this.chunkSize);
  }
  
  private isCacheExpired(cached: CachedChunk<T>): boolean {
    return Date.now() - cached.timestamp > this.cacheTimeout;
  }
  
  private generateSearchKey(params: any): string {
    return Buffer.from(JSON.stringify(params)).toString('base64').slice(0, 16);
  }
  
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    this.cache.forEach(chunk => {
      // Rough estimation - 1KB per item on average
      totalSize += chunk.data.length * 1024;
    });
    return totalSize;
  }
}

// Type definitions
interface CachedChunk<T> {
  data: T[];
  timestamp: number;
  totalItems?: number;
  accessCount: number;
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
  memoryUsage: number; // in bytes
}

/**
 * Hook-style lazy loader for React components
 */
export function useLazyLoader<T>(
  chunkSize: number = 50,
  cacheSize: number = 10
): LazyLoader<T> {
  // In a real React app, this would use useMemo
  return new LazyLoader<T>(chunkSize, cacheSize);
}

/**
 * Virtual scrolling utilities for table performance
 */
export class VirtualTableHelper {
  private itemHeight: number;
  private overscan: number;
  
  constructor(itemHeight: number = 48, overscan: number = 5) {
    this.itemHeight = itemHeight;
    this.overscan = overscan;
  }
  
  /**
   * Calculate which items should be rendered in viewport
   */
  getVisibleRange(
    scrollTop: number,
    viewportHeight: number,
    totalItems: number
  ): { start: number; end: number; offsetY: number } {
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    const end = Math.min(
      totalItems - 1,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.overscan
    );
    
    const offsetY = start * this.itemHeight;
    
    return { start, end, offsetY };
  }
  
  /**
   * Calculate total scrollable height
   */
  getTotalHeight(totalItems: number): number {
    return totalItems * this.itemHeight;
  }
  
  /**
   * Calculate scroll position for specific item
   */
  getScrollPosition(itemIndex: number): number {
    return itemIndex * this.itemHeight;
  }
}

// Export utilities
export const virtualTableHelper = new VirtualTableHelper();
export const emailLazyLoader = new LazyLoader<any>(50, 20);