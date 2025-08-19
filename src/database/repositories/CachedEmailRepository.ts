/**
 * Cached Email Repository
 * 
 * Wraps the EmailRepository with Redis caching for:
 * - Frequently accessed email queries
 * - Email entities, attachments, and recipients
 * - Conversation and thread queries
 * - Expensive aggregation queries
 * - Analytics data
 */

import { EmailRepository } from './EmailRepository.js';
import type { EmailRepositoryConfig, CreateEmailParams, UpdateEmailParams, EmailQueryParams, EmailEntity } from './EmailRepository.js';
import { cacheManager } from '../../core/cache/RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import * as crypto from 'crypto';

export class CachedEmailRepository extends EmailRepository {
  private cacheNamespace = 'email';
  private defaultTTL = 3600; // 1 hour
  private shortTTL = 300; // 5 minutes for frequently changing data
  private longTTL = 86400; // 24 hours for stable data

  constructor(config: EmailRepositoryConfig) {
    super(config);
    logger.info('CachedEmailRepository initialized', 'CACHED_EMAIL_REPO');
  }

  /**
   * Generate cache key for email queries
   */
  private generateQueryCacheKey(params: EmailQueryParams): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    return `query:${hash}`;
  }

  /**
   * Generate cache key for email by ID
   */
  private generateEmailCacheKey(emailId: string): string {
    return `email:${emailId}`;
  }

  /**
   * Generate cache key for email by Graph ID
   */
  private generateGraphEmailCacheKey(graphId: string): string {
    return `graph:${graphId}`;
  }

  /**
   * Generate cache key for analytics
   */
  private generateAnalyticsCacheKey(dateRange?: { start: Date; end: Date }): string {
    if (dateRange) {
      const rangeStr = `${dateRange?.start?.toISOString()}-${dateRange?.end?.toISOString()}`;
      return `analytics:${crypto.createHash('md5').update(rangeStr).digest('hex')}`;
    }
    return 'analytics:current';
  }

  /**
   * Generate invalidation tags for an email
   */
  private generateEmailTags(email: any): string[] {
    const tags = [
      'emails:all',
      `sender:${email.senderEmail}`,
      `status:${email.status}`,
      `priority:${email.priority}`,
    ];

    if (email.conversationId) {
      tags.push(`conversation:${email.conversationId}`);
    }

    if (email.threadId) {
      tags.push(`thread:${email.threadId}`);
    }

    if (email.assignedTo) {
      tags.push(`assigned:${email.assignedTo}`);
    }

    return tags;
  }

  /**
   * Create a new email record with cache invalidation
   */
  override async createEmail(params: CreateEmailParams): Promise<string> {
    const startTime = Date.now();

    try {
      // Create email in database
      const emailId = await super.createEmail(params);

      // Invalidate related cache entries
      await this.invalidateEmailCaches([
        'emails:all',
        `sender:${params.senderEmail}`,
        'analytics:current',
      ]);

      // Cache the new email
      const email = await super.getEmailById(emailId);
      if (email) {
        await cacheManager.set(
          this.generateEmailCacheKey(emailId),
          email,
          {
            ttl: this.defaultTTL,
            namespace: this.cacheNamespace,
            tags: this.generateEmailTags(email),
          }
        );

        // Cache by graph ID if available
        if (params.graphId) {
          await cacheManager.set(
            this.generateGraphEmailCacheKey(params.graphId),
            email,
            {
              ttl: this.defaultTTL,
              namespace: this.cacheNamespace,
              tags: [`graph:${params.graphId}`],
            }
          );
        }
      }

      metrics.histogram('cached_email_repository.create_duration', Date.now() - startTime);
      logger.debug('Email created and cached', 'CACHED_EMAIL_REPO', { emailId });

      return emailId;
    } catch (error) {
      logger.error('Failed to create cached email', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update an email record with cache invalidation
   */
  override async updateEmail(emailId: string, params: UpdateEmailParams): Promise<void> {
    const startTime = Date.now();

    try {
      // Update in database
      await super.updateEmail(emailId, params);

      // Get updated email for caching
      const email = await super.getEmailById(emailId);
      if (email) {
        // Update cache
        await cacheManager.set(
          this.generateEmailCacheKey(emailId),
          email,
          {
            ttl: this.defaultTTL,
            namespace: this.cacheNamespace,
            tags: this.generateEmailTags(email),
          }
        );

        // Invalidate query caches that might be affected
        const invalidationTags = [
          'emails:all',
          `sender:${email.senderEmail}`,
          'analytics:current',
        ];

        if (params.status) {
          invalidationTags.push(`status:${params.status}`);
        }

        if (params.priority) {
          invalidationTags.push(`priority:${params.priority}`);
        }

        if (params.assignedTo) {
          invalidationTags.push(`assigned:${params.assignedTo}`);
        }

        await this.invalidateEmailCaches(invalidationTags);
      }

      metrics.histogram('cached_email_repository.update_duration', Date.now() - startTime);
      logger.debug('Email updated and cache refreshed', 'CACHED_EMAIL_REPO', { emailId });
    } catch (error) {
      logger.error('Failed to update cached email', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
        emailId,
      });
      throw error;
    }
  }

  /**
   * Store email entities with caching
   */
  override async storeEmailEntities(emailId: string, entities: EmailEntity[]): Promise<void> {
    const startTime = Date.now();

    try {
      // Store in database
      await super.storeEmailEntities(emailId, entities);

      // Invalidate email cache to force refresh with new entities
      await cacheManager.del(this.generateEmailCacheKey(emailId), this.cacheNamespace);

      // Cache entities separately for fast access
      await cacheManager.set(
        `entities:${emailId}`,
        entities,
        {
          ttl: this.longTTL,
          namespace: this.cacheNamespace,
          tags: [`email:${emailId}`],
        }
      );

      metrics.histogram('cached_email_repository.store_entities_duration', Date.now() - startTime);
      logger.debug('Email entities stored and cached', 'CACHED_EMAIL_REPO', {
        emailId,
        entityCount: entities?.length || 0,
      });
    } catch (error) {
      logger.error('Failed to store cached email entities', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
        emailId,
      });
      throw error;
    }
  }

  /**
   * Query emails with caching
   */
  override async queryEmails(params: EmailQueryParams): Promise<{ emails: any[]; total: number }> {
    const startTime = Date.now();
    const cacheKey = this.generateQueryCacheKey(params);

    try {
      // Try cache first
      const cached = await cacheManager.get<{ emails: any[]; total: number }>(
        cacheKey,
        this.cacheNamespace
      );

      if (cached) {
        metrics.increment('cached_email_repository.query_cache_hit');
        metrics.histogram('cached_email_repository.query_cache_duration', Date.now() - startTime);
        logger.debug('Email query cache hit', 'CACHED_EMAIL_REPO', { cacheKey });
        return cached;
      }

      // Cache miss - query database
      const result = await super.queryEmails(params);

      // Determine TTL based on query characteristics
      let ttl = this.defaultTTL;
      
      // Use shorter TTL for real-time queries
      if (params.statuses?.includes('new') || params.assignedTo === null) {
        ttl = this.shortTTL;
      }
      
      // Use longer TTL for historical queries
      if (params.dateRange && params?.dateRange?.end < new Date(Date.now() - 86400000)) {
        ttl = this.longTTL;
      }

      // Generate cache tags for invalidation
      const tags = ['emails:all'];
      
      if (params.senderEmails?.length) {
        tags.push(...params?.senderEmails?.map(email => `sender:${email}`));
      }
      
      if (params.statuses?.length) {
        tags.push(...params?.statuses?.map(status => `status:${status}`));
      }
      
      if (params.assignedTo) {
        tags.push(`assigned:${params.assignedTo}`);
      }

      // Cache the result
      await cacheManager.set(cacheKey, result, {
        ttl,
        namespace: this.cacheNamespace,
        tags,
      });

      metrics.increment('cached_email_repository.query_cache_miss');
      metrics.histogram('cached_email_repository.query_db_duration', Date.now() - startTime);
      
      logger.debug('Email query executed and cached', 'CACHED_EMAIL_REPO', {
        cacheKey,
        resultCount: result?.emails?.length,
        ttl,
      });

      return result;
    } catch (error) {
      logger.error('Failed to query cached emails', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get email by ID with caching
   */
  override async getEmailById(emailId: string): Promise<any | null> {
    const startTime = Date.now();
    const cacheKey = this.generateEmailCacheKey(emailId);

    try {
      // Try cache first
      const cached = await cacheManager.get(cacheKey, this.cacheNamespace);

      if (cached) {
        metrics.increment('cached_email_repository.get_by_id_cache_hit');
        metrics.histogram('cached_email_repository.get_by_id_cache_duration', Date.now() - startTime);
        logger.debug('Email by ID cache hit', 'CACHED_EMAIL_REPO', { emailId });
        return cached;
      }

      // Cache miss - query database
      const email = await super.getEmailById(emailId);

      if (email) {
        // Cache the email
        await cacheManager.set(cacheKey, email, {
          ttl: this.defaultTTL,
          namespace: this.cacheNamespace,
          tags: this.generateEmailTags(email),
        });

        metrics.increment('cached_email_repository.get_by_id_cache_miss');
        logger.debug('Email by ID cached', 'CACHED_EMAIL_REPO', { emailId });
      }

      metrics.histogram('cached_email_repository.get_by_id_db_duration', Date.now() - startTime);
      return email;
    } catch (error) {
      logger.error('Failed to get cached email by ID', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
        emailId,
      });
      throw error;
    }
  }

  /**
   * Get email by Graph ID with caching
   */
  override async getEmailByGraphId(graphId: string): Promise<any | null> {
    const startTime = Date.now();
    const cacheKey = this.generateGraphEmailCacheKey(graphId);

    try {
      // Try cache first
      const cached = await cacheManager.get(cacheKey, this.cacheNamespace);

      if (cached) {
        metrics.increment('cached_email_repository.get_by_graph_id_cache_hit');
        metrics.histogram('cached_email_repository.get_by_graph_id_cache_duration', Date.now() - startTime);
        logger.debug('Email by Graph ID cache hit', 'CACHED_EMAIL_REPO', { graphId });
        return cached;
      }

      // Cache miss - query database
      const email = await super.getEmailByGraphId(graphId);

      if (email) {
        // Cache the email
        await cacheManager.set(cacheKey, email, {
          ttl: this.defaultTTL,
          namespace: this.cacheNamespace,
          tags: [...this.generateEmailTags(email), `graph:${graphId}`],
        });

        // Also cache by email ID
        await cacheManager.set(
          this.generateEmailCacheKey(email.id),
          email,
          {
            ttl: this.defaultTTL,
            namespace: this.cacheNamespace,
            tags: this.generateEmailTags(email),
          }
        );

        metrics.increment('cached_email_repository.get_by_graph_id_cache_miss');
        logger.debug('Email by Graph ID cached', 'CACHED_EMAIL_REPO', { graphId });
      }

      metrics.histogram('cached_email_repository.get_by_graph_id_db_duration', Date.now() - startTime);
      return email;
    } catch (error) {
      logger.error('Failed to get cached email by Graph ID', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
        graphId,
      });
      throw error;
    }
  }

  /**
   * Get analytics with caching
   */
  override async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateAnalyticsCacheKey(dateRange);

    try {
      // Try cache first
      const cached = await cacheManager.get(cacheKey, this.cacheNamespace);

      if (cached) {
        metrics.increment('cached_email_repository.analytics_cache_hit');
        metrics.histogram('cached_email_repository.analytics_cache_duration', Date.now() - startTime);
        logger.debug('Analytics cache hit', 'CACHED_EMAIL_REPO', { cacheKey });
        return cached;
      }

      // Cache miss - query database
      const analytics = await super.getAnalytics(dateRange);

      // Use shorter TTL for current analytics, longer for historical
      const ttl = dateRange && dateRange.end < new Date(Date.now() - 86400000) 
        ? this.longTTL 
        : this.shortTTL;

      // Cache the analytics
      await cacheManager.set(cacheKey, analytics, {
        ttl,
        namespace: this.cacheNamespace,
        tags: ['analytics'],
      });

      metrics.increment('cached_email_repository.analytics_cache_miss');
      metrics.histogram('cached_email_repository.analytics_db_duration', Date.now() - startTime);
      
      logger.debug('Analytics executed and cached', 'CACHED_EMAIL_REPO', {
        cacheKey,
        ttl,
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get cached analytics', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Bulk get emails by IDs with caching
   */
  async getEmailsByIds(emailIds: string[]): Promise<Map<string, any>> {
    const startTime = Date.now();
    const results = new Map<string, any>();

    try {
      // Generate cache keys
      const cacheKeys = emailIds?.map(id => this.generateEmailCacheKey(id));
      
      // Try to get from cache
      const cachedResults = await cacheManager.mget<any>(cacheKeys, this.cacheNamespace);
      
      const missedIds: string[] = [];
      const missedKeys: string[] = [];

      // Separate hits and misses
      for (let i = 0; i < (emailIds?.length || 0); i++) {
        const emailId = emailIds[i];
        const cacheKey = cacheKeys[i];
        
        if (cachedResults.has(cacheKey)) {
          results.set(emailId, cachedResults.get(cacheKey));
          metrics.increment('cached_email_repository.bulk_get_cache_hit');
        } else {
          missedIds.push(emailId);
          missedKeys.push(cacheKey);
          metrics.increment('cached_email_repository.bulk_get_cache_miss');
        }
      }

      // Fetch missed emails from database
      if ((missedIds?.length || 0) > 0) {
        const dbPromises = missedIds?.map(async (emailId) => {
          try {
            const email = await super.getEmailById(emailId);
            if (email) {
              results.set(emailId, email);
              
              // Cache the result
              await cacheManager.set(
                this.generateEmailCacheKey(emailId),
                email,
                {
                  ttl: this.defaultTTL,
                  namespace: this.cacheNamespace,
                  tags: this.generateEmailTags(email),
                }
              );
            }
          } catch (error) {
            logger.warn('Failed to fetch email in bulk operation', 'CACHED_EMAIL_REPO', {
              emailId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });

        await Promise.all(dbPromises);
      }

      metrics.histogram('cached_email_repository.bulk_get_duration', Date.now() - startTime);
      
      logger.debug('Bulk email fetch completed', 'CACHED_EMAIL_REPO', {
        totalRequested: emailIds?.length || 0,
        cacheHits: (emailIds?.length || 0) - (missedIds?.length || 0),
        cacheMisses: missedIds?.length || 0,
        resultCount: results.size,
      });

      return results;
    } catch (error) {
      logger.error('Failed to bulk get cached emails', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
        emailIds,
      });
      throw error;
    }
  }

  /**
   * Invalidate caches by tags
   */
  private async invalidateEmailCaches(tags: string[]): Promise<void> {
    try {
      const deletedCount = await cacheManager.invalidateByTags(tags);
      
      logger.debug('Email caches invalidated', 'CACHED_EMAIL_REPO', {
        tags,
        deletedCount,
      });
      
      metrics.increment('cached_email_repository.cache_invalidation', deletedCount);
    } catch (error) {
      logger.error('Failed to invalidate email caches', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
        tags,
      });
    }
  }

  /**
   * Warm email cache with frequently accessed data
   */
  async warmCache(options: {
    recentDays?: number;
    topSenders?: number;
    priorityEmails?: boolean;
  } = {}): Promise<number> {
    const startTime = Date.now();
    let warmedCount = 0;

    try {
      logger.info('Starting cache warming', 'CACHED_EMAIL_REPO', options);

      // Warm recent emails
      if (options.recentDays) {
        const recentEmails = await super.queryEmails({
          dateRange: {
            start: new Date(Date.now() - options.recentDays * 24 * 60 * 60 * 1000),
            end: new Date(),
          },
          limit: 1000,
        });

        for (const email of recentEmails.emails) {
          await cacheManager.set(
            this.generateEmailCacheKey(email.id),
            email,
            {
              ttl: this.defaultTTL,
              namespace: this.cacheNamespace,
              tags: this.generateEmailTags(email),
            }
          );
          warmedCount++;
        }
      }

      // Warm priority emails
      if (options.priorityEmails) {
        const priorityEmails = await super.queryEmails({
          priorities: ['critical', 'high'],
          limit: 500,
        });

        for (const email of priorityEmails.emails) {
          await cacheManager.set(
            this.generateEmailCacheKey(email.id),
            email,
            {
              ttl: this.defaultTTL,
              namespace: this.cacheNamespace,
              tags: this.generateEmailTags(email),
            }
          );
          warmedCount++;
        }
      }

      // Warm analytics
      const analytics = await super.getAnalytics();
      await cacheManager.set(
        this.generateAnalyticsCacheKey(),
        analytics,
        {
          ttl: this.shortTTL,
          namespace: this.cacheNamespace,
          tags: ['analytics'],
        }
      );
      warmedCount++;

      metrics.histogram('cached_email_repository.cache_warming_duration', Date.now() - startTime);
      
      logger.info('Cache warming completed', 'CACHED_EMAIL_REPO', {
        warmedCount,
        duration: Date.now() - startTime,
      });

      return warmedCount;
    } catch (error) {
      logger.error('Cache warming failed', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
      });
      return warmedCount;
    }
  }

  /**
   * Get cache statistics for emails
   */
  async getCacheStats(): Promise<any> {
    try {
      const stats = await cacheManager.getStats();
      
      return {
        ...stats,
        namespace: this.cacheNamespace,
        defaultTTL: this.defaultTTL,
        shortTTL: this.shortTTL,
        longTTL: this.longTTL,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Clear all email caches
   */
  async clearCache(): Promise<boolean> {
    try {
      const success = await cacheManager.clear(this.cacheNamespace);
      
      logger.info('Email cache cleared', 'CACHED_EMAIL_REPO', { success });
      metrics.increment('cached_email_repository.cache_cleared');
      
      return success;
    } catch (error) {
      logger.error('Failed to clear email cache', 'CACHED_EMAIL_REPO', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}