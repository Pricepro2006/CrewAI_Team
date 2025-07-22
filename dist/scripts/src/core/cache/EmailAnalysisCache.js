import { LRUCache } from 'lru-cache';
import { logger } from "../../utils/logger.js";
export class EmailAnalysisCache {
    constructor(options) {
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
        const maxSize = options?.maxSize || 1000;
        const ttl = options?.ttl || 1000 * 60 * 30; // 30 minutes default
        this.cache = new LRUCache({
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
    get(emailId) {
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
    set(emailId, analysis) {
        const entry = {
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
    has(emailId) {
        return this.cache.has(emailId);
    }
    /**
     * Invalidate cache entry
     */
    invalidate(emailId) {
        const deleted = this.cache.delete(emailId);
        if (deleted) {
            logger.debug(`Cache invalidated for email: ${emailId}`, 'EMAIL_CACHE');
        }
        return deleted;
    }
    /**
     * Clear entire cache
     */
    clear() {
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
    prune() {
        const sizeBefore = this.cache.size;
        this.cache.purgeStale();
        const pruned = sizeBefore - this.cache.size;
        if (pruned > 0) {
            logger.info(`Pruned ${pruned} stale cache entries`, 'EMAIL_CACHE');
        }
        return pruned;
    }
}
