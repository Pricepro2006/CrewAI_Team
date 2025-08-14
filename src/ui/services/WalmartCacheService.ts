/**
 * Walmart Cache Service
 * Multi-layer intelligent caching system for optimal performance
 * Supports memory, IndexedDB, and API-level caching with smart invalidation
 */

import { WalmartProduct, SearchResult, SearchQuery, PriceHistoryPoint } from '../components/Walmart/types/WalmartTypes';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  hits: number;
  size: number; // Estimated size in bytes
}

interface CacheConfig {
  memory: {
    maxSize: number; // Max memory cache size in MB
    maxEntries: number;
    defaultTtl: number;
  };
  indexedDB: {
    maxSize: number; // Max IndexedDB size in MB
    dbName: string;
    version: number;
    defaultTtl: number;
  };
  api: {
    defaultTtl: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

interface CacheStats {
  memory: {
    size: number;
    entries: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  indexedDB: {
    size: number;
    entries: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  total: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

class WalmartCacheService {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private indexedDB: IDBDatabase | null = null;
  private stats: CacheStats;
  private config: CacheConfig;
  private initPromise: Promise<void> | null = null;
  
  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      memory: {
        maxSize: 50, // 50MB
        maxEntries: 1000,
        defaultTtl: 5 * 60 * 1000, // 5 minutes
        ...config?.memory
      },
      indexedDB: {
        maxSize: 200, // 200MB
        dbName: 'WalmartCache',
        version: 1,
        defaultTtl: 60 * 60 * 1000, // 1 hour
        ...config?.indexedDB
      },
      api: {
        defaultTtl: 10 * 60 * 1000, // 10 minutes
        retryAttempts: 3,
        retryDelay: 1000,
        ...config?.api
      }
    };
    
    this.stats = {
      memory: { size: 0, entries: 0, hits: 0, misses: 0, hitRate: 0 },
      indexedDB: { size: 0, entries: 0, hits: 0, misses: 0, hitRate: 0 },
      total: { hits: 0, misses: 0, hitRate: 0 }
    };
    
    this.initPromise = this.initIndexedDB();
  }
  
  /**
   * Initialize IndexedDB
   */
  private async initIndexedDB(): Promise<void> {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported, using memory cache only');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.indexedDB.dbName, this.config.indexedDB.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.indexedDB = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('searches')) {
          db.createObjectStore('searches', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('priceHistory')) {
          db.createObjectStore('priceHistory', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });
  }
  
  /**
   * Ensure IndexedDB is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }
  
  /**
   * Generate cache key from parameters
   */
  private getCacheKey(type: string, params: any): string {
    const sortedParams = JSON.stringify(params, Object.keys(params).sort());
    return `${type}:${btoa(sortedParams).replace(/[+/=]/g, '')}`;
  }
  
  /**
   * Estimate data size in bytes
   */
  private estimateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }
  
  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }
  
  /**
   * Update cache statistics
   */
  private updateStats(layer: 'memory' | 'indexedDB', type: 'hit' | 'miss'): void {
    this.stats[layer][`${type}s`]++;
    this.stats.total[`${type}s`]++;
    
    // Calculate hit rates
    const layerStats = this.stats[layer];
    layerStats.hitRate = layerStats.hits / (layerStats.hits + layerStats.misses);
    
    this.stats.total.hitRate = this.stats.total.hits / (this.stats.total.hits + this.stats.total.misses);
  }
  
  /**
   * Cleanup expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    let totalSize = 0;
    
    // Remove expired entries
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      } else {
        totalSize += entry.size;
      }
    }
    
    // If still over limit, remove least recently used entries
    const maxSizeBytes = this.config.memory.maxSize * 1024 * 1024;
    if (totalSize > maxSizeBytes || this.memoryCache.size > this.config.memory.maxEntries) {
      const entries = Array.from(this.memoryCache.entries())
        .map(([key, entry]) => ({ key, ...entry }))
        .sort((a, b) => (a.timestamp + a.hits) - (b.timestamp + b.hits));
      
      while (
        (totalSize > maxSizeBytes || this.memoryCache.size > this.config.memory.maxEntries) &&
        entries.length > 0
      ) {
        const entry = entries.shift()!;
        this.memoryCache.delete(entry.key);
        totalSize -= entry.size;
      }
    }
    
    this.stats.memory.size = totalSize;
    this.stats.memory.entries = this.memoryCache.size;
  }
  
  /**
   * Get item from memory cache
   */
  private getFromMemoryCache<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry || this.isExpired(entry)) {
      if (entry) this.memoryCache.delete(key);
      this.updateStats('memory', 'miss');
      return null;
    }
    
    entry.hits++;
    this.updateStats('memory', 'hit');
    return entry.data;
  }
  
  /**
   * Set item in memory cache
   */
  private setInMemoryCache<T>(key: string, data: T, ttl?: number): void {
    const size = this.estimateSize(data);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.memory.defaultTtl,
      hits: 0,
      size
    };
    
    this.memoryCache.set(key, entry);
    this.cleanupMemoryCache();
  }
  
  /**
   * Get item from IndexedDB cache
   */
  private async getFromIndexedDBCache<T>(key: string): Promise<T | null> {
    await this.ensureInitialized();
    if (!this.indexedDB) {
      this.updateStats('indexedDB', 'miss');
      return null;
    }
    
    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        if (!result || this.isExpired(result)) {
          this.updateStats('indexedDB', 'miss');
          if (result) {
            // Clean up expired entry
            this.deleteFromIndexedDBCache(key);
          }
          resolve(null);
          return;
        }
        
        result.hits++;
        this.updateStats('indexedDB', 'hit');
        
        // Update hit count
        const updateTransaction = this.indexedDB!.transaction(['cache'], 'readwrite');
        const updateStore = updateTransaction.objectStore('cache');
        updateStore.put(result);
        
        resolve(result.data);
      };
      
      request.onerror = () => {
        this.updateStats('indexedDB', 'miss');
        resolve(null);
      };
    });
  }
  
  /**
   * Set item in IndexedDB cache
   */
  private async setInIndexedDBCache<T>(key: string, data: T, ttl?: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.indexedDB) return;
    
    const size = this.estimateSize(data);
    const entry: CacheEntry<T> & { key: string } = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.indexedDB.defaultTtl,
      hits: 0,
      size
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put(entry);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Delete item from IndexedDB cache
   */
  private async deleteFromIndexedDBCache(key: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.indexedDB) return;
    
    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Don't throw on delete errors
    });
  }
  
  /**
   * Get cached item with fallback through cache layers
   */
  public async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryResult = this.getFromMemoryCache<T>(key);
    if (memoryResult !== null) {
      return memoryResult;
    }
    
    // Try IndexedDB cache
    const indexedDBResult = await this.getFromIndexedDBCache<T>(key);
    if (indexedDBResult !== null) {
      // Promote to memory cache
      this.setInMemoryCache(key, indexedDBResult);
      return indexedDBResult;
    }
    
    return null;
  }
  
  /**
   * Set item in all appropriate cache layers
   */
  public async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    // Set in memory cache
    this.setInMemoryCache(key, data, ttl);
    
    // Set in IndexedDB cache for persistence
    await this.setInIndexedDBCache(key, data, ttl);
  }
  
  /**
   * Delete item from all cache layers
   */
  public async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.deleteFromIndexedDBCache(key);
  }
  
  /**
   * Product-specific cache methods
   */
  public async getProduct(productId: string): Promise<WalmartProduct | null> {
    const key = this.getCacheKey('product', { id: productId });
    return this.get<WalmartProduct>(key);
  }
  
  public async setProduct(product: WalmartProduct, ttl?: number): Promise<void> {
    const key = this.getCacheKey('product', { id: product.id });
    await this.set(key, product, ttl);
  }
  
  /**
   * Search results cache methods
   */
  public async getSearchResults(query: SearchQuery): Promise<SearchResult | null> {
    const key = this.getCacheKey('search', query);
    return this.get<SearchResult>(key);
  }
  
  public async setSearchResults(result: SearchResult, ttl?: number): Promise<void> {
    const key = this.getCacheKey('search', { 
      query: result.query, 
      filters: result.filters 
    });
    await this.set(key, result, ttl);
  }
  
  /**
   * Price history cache methods
   */
  public async getPriceHistory(productId: string): Promise<PriceHistoryPoint[] | null> {
    const key = this.getCacheKey('priceHistory', { productId });
    return this.get<PriceHistoryPoint[]>(key);
  }
  
  public async setPriceHistory(productId: string, history: PriceHistoryPoint[], ttl?: number): Promise<void> {
    const key = this.getCacheKey('priceHistory', { productId });
    await this.set(key, history, ttl);
  }
  
  /**
   * Invalidate cache by pattern
   */
  public async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }
    
    // Invalidate IndexedDB cache
    await this.ensureInitialized();
    if (!this.indexedDB) return;
    
    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.key.toString().includes(pattern)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => resolve();
    });
  }
  
  /**
   * Invalidate category cache
   */
  public async invalidateCategory(category: string): Promise<void> {
    await this.invalidatePattern(`category:${category}`);
    await this.invalidatePattern(`search:`);
  }
  
  /**
   * Invalidate product cache
   */
  public async invalidateProduct(productId: string): Promise<void> {
    await this.invalidatePattern(`product:${productId}`);
    await this.invalidatePattern(`priceHistory:${productId}`);
  }
  
  /**
   * Clear all cache
   */
  public async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear IndexedDB cache
    await this.ensureInitialized();
    if (!this.indexedDB) return;
    
    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();
      
      request.onsuccess = () => {
        // Reset stats
        this.stats = {
          memory: { size: 0, entries: 0, hits: 0, misses: 0, hitRate: 0 },
          indexedDB: { size: 0, entries: 0, hits: 0, misses: 0, hitRate: 0 },
          total: { hits: 0, misses: 0, hitRate: 0 }
        };
        resolve();
      };
      
      request.onerror = () => resolve();
    });
  }
  
  /**
   * Cleanup expired entries
   */
  public async cleanup(): Promise<void> {
    this.cleanupMemoryCache();
    
    // Cleanup IndexedDB
    await this.ensureInitialized();
    if (!this.indexedDB) return;
    
    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry = cursor.value;
          if (this.isExpired(entry)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => resolve();
    });
  }
  
  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return JSON.parse(JSON.stringify(this.stats));
  }
  
  /**
   * Warm cache with frequently accessed data
   */
  public async warmCache(products: WalmartProduct[]): Promise<void> {
    const promises = products.map(product => 
      this.setProduct(product, this.config.memory.defaultTtl)
    );
    
    await Promise.all(promises);
  }
}

// Export singleton instance
export const walmartCacheService = new WalmartCacheService();

// Periodic cleanup
setInterval(() => {
  walmartCacheService.cleanup();
}, 10 * 60 * 1000); // Cleanup every 10 minutes

export default WalmartCacheService;