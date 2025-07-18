import { LRUCache } from 'lru-cache';
import { EmailAnalysis } from '../agents/specialized/EmailAnalysisAgent';
import { logger } from '../../utils/logger';

interface CacheEntry {
  analysis: EmailAnalysis;
  timestamp: number;
  hits: number;
}

export class EmailAnalysisCache {
  private cache: LRUCache<string, CacheEntry>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(options?: {
    maxSize?: number;
    ttl?: number;
  }) {
    const maxSize = options?.maxSize || 1000;
    const ttl = options?.ttl || 1000 * 60 * 30; // 30 minutes default

    this.cache = new LRUCache<string, CacheEntry>({
      max: maxSize,
      ttl: ttl,
      updateAgeOnGet: true,
      dispose: (value, key) => {
        this.stats.evictions++;
        logger.debug(`Cache entry evicted: ${key}`, 'EMAIL_CACHE', {
          hits: value.hits
        });
      }
    });

    logger.info('Email analysis cache initialized', 'EMAIL_CACHE', {
      maxSize,
      ttl: ttl / 1000 + 's'
    });
  }

  /**
   * Get cached analysis
   */
  get(emailId: string): EmailAnalysis | undefined {
    const entry = this.cache.get(emailId);
    
    if (entry) {
      this.stats.hits++;
      entry.hits++;
      logger.debug(`Cache hit for email: ${emailId}`, 'EMAIL_CACHE');
      return entry.analysis;
    }
    
    this.stats.misses++;
    return undefined;
  }

  /**
   * Cache analysis result
   */
  set(emailId: string, analysis: EmailAnalysis): void {
    const entry: CacheEntry = {
      analysis,
      timestamp: Date.now(),
      hits: 0
    };

    this.cache.set(emailId, entry);
    logger.debug(`Cached analysis for email: ${emailId}`, 'EMAIL_CACHE');
  }

  /**
   * Check if email is cached
   */
  has(emailId: string): boolean {
    return this.cache.has(emailId);
  }

  /**
   * Invalidate cache entry
   */
  invalidate(emailId: string): boolean {
    const deleted = this.cache.delete(emailId);
    if (deleted) {
      logger.debug(`Cache invalidated for email: ${emailId}`, 'EMAIL_CACHE');
    }
    return deleted;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache cleared. Removed ${size} entries`, 'EMAIL_CACHE');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  /**
   * Prune old entries manually
   */
  prune(): number {
    const sizeBefore = this.cache.size;
    this.cache.purgeStale();
    const pruned = sizeBefore - this.cache.size;
    
    if (pruned > 0) {
      logger.info(`Pruned ${pruned} stale cache entries`, 'EMAIL_CACHE');
    }
    
    return pruned;
  }
}