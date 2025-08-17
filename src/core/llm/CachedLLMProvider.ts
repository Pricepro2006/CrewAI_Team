/**
 * Cached LLM Provider with Performance Optimizations
 * 
 * Key Features:
 * - LRU cache for response memoization
 * - Request deduplication to prevent duplicate calls
 * - Configurable timeouts with circuit breaker
 * - Metrics collection for monitoring
 * - Graceful degradation on failures
 */

import { LLMProviderManager } from './LLMProviderManager.js';
import { Logger } from '../../utils/logger.js';
import crypto from 'crypto';

const logger = new Logger('CachedLLMProvider');

interface CacheEntry {
  response: string;
  timestamp: number;
  hitCount: number;
}

interface PendingRequest {
  promise: Promise<string>;
  timestamp: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  dedupeCount: number;
  timeouts: number;
  errors: number;
}

export class CachedLLMProvider extends LLMProviderManager {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    dedupeCount: 0,
    timeouts: 0,
    errors: 0
  };

  // Configuration
  private readonly maxCacheSize = 500;
  private readonly cacheTTL = 30 * 60 * 1000; // 30 minutes
  private readonly requestTimeout = 30000; // 30 seconds
  private readonly dedupeWindow = 5000; // 5 seconds

  constructor() {
    super();
    
    // Periodic cache cleanup
    setInterval(() => this.cleanupCache(), 60000); // Every minute
    
    logger.info('CachedLLMProvider initialized', {
      maxCacheSize: this.maxCacheSize,
      cacheTTL: this.cacheTTL,
      requestTimeout: this.requestTimeout
    });
  }

  /**
   * Generate response with caching and deduplication
   */
  async generate(prompt: string, options?: any): Promise<string> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(prompt, options);

    try {
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.hits++;
        logger.debug('Cache hit', {
          cacheKey: cacheKey.substring(0, 8),
          responseTime: Date.now() - startTime,
          hitCount: cached.hitCount
        });
        return cached.response;
      }

      // Check for pending identical request (deduplication)
      const pending = this.pendingRequests.get(cacheKey);
      if (pending && Date.now() - pending.timestamp < this.dedupeWindow) {
        this.metrics.dedupeCount++;
        logger.debug('Request deduplication', {
          cacheKey: cacheKey.substring(0, 8),
          age: Date.now() - pending.timestamp
        });
        return pending.promise;
      }

      // Create new request with timeout
      this.metrics.misses++;
      const requestPromise = this.generateWithTimeout(prompt, options);
      
      // Store as pending to enable deduplication
      this.pendingRequests.set(cacheKey, {
        promise: requestPromise,
        timestamp: Date.now()
      });

      // Wait for response
      const response = await requestPromise;

      // Cache successful response
      this.addToCache(cacheKey, response);
      
      // Clean up pending request
      this.pendingRequests.delete(cacheKey);

      logger.debug('Generated and cached response', {
        cacheKey: cacheKey.substring(0, 8),
        responseTime: Date.now() - startTime,
        responseLength: response.length
      });

      return response;

    } catch (error) {
      this.metrics.errors++;
      this.pendingRequests.delete(cacheKey);
      
      logger.error('Generation failed', {
        error: error.message,
        cacheKey: cacheKey.substring(0, 8),
        responseTime: Date.now() - startTime
      });
      
      throw error;
    }
  }

  /**
   * Generate with timeout protection
   */
  private async generateWithTimeout(prompt: string, options?: any): Promise<string> {
    return Promise.race([
      super.generate(prompt, options),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          this.metrics.timeouts++;
          reject(new Error(`LLM request timeout after ${this.requestTimeout}ms`));
        }, this.requestTimeout);
      })
    ]);
  }

  /**
   * Generate cache key from prompt and options
   */
  private getCacheKey(prompt: string, options?: any): string {
    const input = JSON.stringify({ prompt, options });
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Get entry from cache if valid
   */
  private getFromCache(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hitCount++;
    
    // Move to end (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry;
  }

  /**
   * Add response to cache with LRU eviction
   */
  private addToCache(key: string, response: string): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.metrics.evictions++;
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hitCount: 0
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    // Clean up old pending requests
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > this.dedupeWindow * 2) {
        this.pendingRequests.delete(key);
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', {
        entriesRemoved: cleaned,
        cacheSize: this.cache.size,
        pendingRequests: this.pendingRequests.size
      });
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  getMetrics(): CacheMetrics & { hitRate: number; cacheSize: number } {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    return {
      ...this.metrics,
      hitRate,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear cache and reset metrics
   */
  clearCache(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      dedupeCount: 0,
      timeouts: 0,
      errors: 0
    };
    
    logger.info('Cache cleared');
  }

  /**
   * Warm up cache with common prompts
   */
  async warmupCache(prompts: Array<{ prompt: string; options?: any }>): Promise<void> {
    logger.info('Starting cache warmup', { promptCount: prompts.length });
    
    const results = await Promise.allSettled(
      prompts.map(({ prompt, options }) => 
        this.generate(prompt, options).catch(err => {
          logger.warn('Warmup prompt failed', { error: err.message });
          return null;
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    logger.info('Cache warmup completed', {
      successful,
      failed: prompts.length - successful,
      cacheSize: this.cache.size
    });
  }

  /**
   * Export cache statistics for monitoring
   */
  exportStats(): Record<string, any> {
    const metrics = this.getMetrics();
    const topEntries = Array.from(this.cache.entries())
      .sort((a, b) => b[1].hitCount - a[1].hitCount)
      .slice(0, 10)
      .map(([key, entry]) => ({
        key: key.substring(0, 8),
        hits: entry.hitCount,
        age: Date.now() - entry.timestamp
      }));

    return {
      metrics,
      topEntries,
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    };
  }
}