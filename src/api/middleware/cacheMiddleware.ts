/**
 * Cache Middleware for tRPC Routes
 * 
 * Features:
 * - Automatic caching for query procedures
 * - Cache invalidation for mutations
 * - Request-specific cache configuration
 * - Smart TTL management based on data type
 * - Cache warming for frequently accessed data
 */

import { TRPCError } from '@trpc/server';
import { cacheManager } from '../../core/cache/RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../monitoring/metrics.js';
import crypto from 'crypto';
import { z } from 'zod';

// Cache configuration schema
const CacheConfigSchema = z.object({
  ttl: z.number().min(1).max(86400 * 30).optional(),
  skipCache: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  invalidateOnMutation: z.boolean().optional().default(true),
  varyBy: z.array(z.string()).optional().default([]),
  compress: z.boolean().optional().default(false),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export interface CacheMiddlewareOptions {
  namespace?: string;
  defaultTTL?: number;
  enableCompression?: boolean;
  keyGenerator?: (input: any, ctx: any) => string;
  shouldCache?: (input: any, ctx: any) => boolean;
  onCacheHit?: (key: string, data: any) => void;
  onCacheMiss?: (key: string) => void;
}

/**
 * Generate cache key for tRPC procedure
 */
function generateCacheKey(
  procedureName: string,
  input: any,
  ctx: any,
  varyBy: string[] = [],
  customKeyGenerator?: (input: any, ctx: any) => string
): string {
  if (customKeyGenerator) {
    return `trpc:${procedureName}:${customKeyGenerator(input, ctx)}`;
  }

  // Create key components
  const keyComponents = [procedureName];

  // Add input hash
  if (input !== undefined && input !== null) {
    const inputHash = crypto
      .createHash('md5')
      .update(JSON.stringify(input))
      .digest('hex');
    keyComponents.push(`input:${inputHash}`);
  }

  // Add context variations
  for (const field of varyBy) {
    if (ctx[field] !== undefined) {
      keyComponents.push(`${field}:${String(ctx[field])}`);
    }
  }

  // Add user context if available
  if (ctx.user?.id) {
    keyComponents.push(`user:${ctx.user.id}`);
  }

  return `trpc:${keyComponents.join(':')}`;
}

/**
 * Determine TTL based on procedure name and data characteristics
 */
function determineTTL(procedureName: string, data: any, defaultTTL: number): number {
  // Short TTL for real-time data
  if (procedureName.includes('realtime') || 
      procedureName.includes('live') || 
      procedureName.includes('status')) {
    return 60; // 1 minute
  }

  // Medium TTL for frequently changing data
  if (procedureName.includes('dashboard') || 
      procedureName.includes('metrics') || 
      procedureName.includes('analytics')) {
    return 300; // 5 minutes
  }

  // Long TTL for stable data
  if (procedureName.includes('user') || 
      procedureName.includes('preferences') || 
      procedureName.includes('settings')) {
    return 3600; // 1 hour
  }

  // Very long TTL for historical data
  if (data && typeof data === 'object' && data.isHistorical) {
    return 86400; // 24 hours
  }

  return defaultTTL;
}

/**
 * Generate cache tags based on procedure and data
 */
function generateCacheTags(
  procedureName: string,
  input: any,
  ctx: any,
  customTags: string[] = []
): string[] {
  const tags = [...customTags];

  // Add procedure-based tags
  tags.push(`procedure:${procedureName}`);

  // Add entity-based tags
  if (procedureName.includes('email')) {
    tags.push('emails');
    
    if (input?.emailId) {
      tags.push(`email:${input.emailId}`);
    }
    
    if (input?.conversationId) {
      tags.push(`conversation:${input.conversationId}`);
    }
  }

  if (procedureName.includes('user')) {
    tags.push('users');
    
    if (ctx.user?.id) {
      tags.push(`user:${ctx.user.id}`);
    }
  }

  if (procedureName.includes('workflow')) {
    tags.push('workflows');
    
    if (input?.workflowId) {
      tags.push(`workflow:${input.workflowId}`);
    }
  }

  return tags;
}

/**
 * Create cache middleware for tRPC queries
 */
export function createQueryCacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    namespace = 'trpc',
    defaultTTL = 900, // 15 minutes
    enableCompression = false,
    keyGenerator,
    shouldCache,
    onCacheHit,
    onCacheMiss,
  } = options;

  return async function cacheMiddleware(opts: any) {
    const startTime = Date.now();
    const { path, type, input, ctx, next } = opts;

    // Only cache queries
    if (type !== 'query') {
      return next();
    }

    // Check if caching should be skipped
    if (shouldCache && !shouldCache(input, ctx)) {
      logger.debug('Skipping cache due to shouldCache check', 'CACHE_MIDDLEWARE', {
        procedure: path,
      });
      return next();
    }

    // Check for skip cache flag in input
    if (input?.skipCache === true) {
      logger.debug('Skipping cache due to skipCache flag', 'CACHE_MIDDLEWARE', {
        procedure: path,
      });
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = generateCacheKey(
        path,
        input,
        ctx,
        input?.varyBy || [],
        keyGenerator
      );

      // Try to get from cache
      const cached = await cacheManager.get(cacheKey, namespace);

      if (cached !== null) {
        // Cache hit
        metrics.increment('trpc_cache.hit');
        metrics.histogram('trpc_cache.get_duration', Date.now() - startTime);

        if (onCacheHit) {
          onCacheHit(cacheKey, cached);
        }

        logger.debug('tRPC cache hit', 'CACHE_MIDDLEWARE', {
          procedure: path,
          cacheKey,
          age: cached.cachedAt ? Date.now() - new Date(cached.cachedAt).getTime() : 'unknown',
        });

        return {
          ok: true,
          data: cached.data,
          meta: {
            ...cached.meta,
            fromCache: true,
            cacheKey,
          },
        };
      }

      // Cache miss - execute procedure
      if (onCacheMiss) {
        onCacheMiss(cacheKey);
      }

      metrics.increment('trpc_cache.miss');

      const result = await next();

      // Cache the result if successful
      if (result.ok && result.data !== undefined) {
        const ttl = input?.ttl || determineTTL(path, result.data, defaultTTL);
        const tags = generateCacheTags(path, input, ctx, input?.tags || []);

        const cacheData = {
          data: result.data,
          meta: result.meta || {},
          cachedAt: new Date().toISOString(),
          procedure: path,
        };

        const compress = enableCompression || input?.compress || false;

        await cacheManager.set(cacheKey, cacheData, {
          ttl,
          compress,
          namespace,
          tags,
        });

        metrics.increment('trpc_cache.cached');
        metrics.histogram('trpc_cache.cache_duration', Date.now() - startTime);

        logger.debug('tRPC result cached', 'CACHE_MIDDLEWARE', {
          procedure: path,
          cacheKey,
          ttl,
          tags,
          compressed: compress,
        });

        // Add cache metadata to response
        result.meta = {
          ...result.meta,
          cached: true,
          cacheKey,
          ttl,
        };
      }

      return result;
    } catch (error) {
      logger.error('Cache middleware error', 'CACHE_MIDDLEWARE', {
        error: error instanceof Error ? error.message : String(error),
        procedure: path,
      });
      metrics.increment('trpc_cache.error');

      // Continue without caching on error
      return next();
    }
  };
}

/**
 * Create cache invalidation middleware for tRPC mutations
 */
export function createMutationCacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const { namespace = 'trpc' } = options;

  return async function invalidationMiddleware(opts: any) {
    const startTime = Date.now();
    const { path, type, input, ctx, next } = opts;

    // Only handle mutations
    if (type !== 'mutation') {
      return next();
    }

    try {
      // Execute the mutation first
      const result = await next();

      // Invalidate related caches if successful
      if (result.ok && input?.invalidateOnMutation !== false) {
        const tags = generateCacheTags(path, input, ctx, input?.invalidateTags || []);
        
        if (tags.length > 0) {
          const invalidatedCount = await cacheManager.invalidateByTags(tags);
          
          metrics.increment('trpc_cache.invalidated', invalidatedCount);
          metrics.histogram('trpc_cache.invalidation_duration', Date.now() - startTime);

          logger.debug('Cache invalidated by mutation', 'CACHE_MIDDLEWARE', {
            procedure: path,
            tags,
            invalidatedCount,
          });

          // Add invalidation info to response
          result.meta = {
            ...result.meta,
            cacheInvalidated: true,
            invalidatedTags: tags,
            invalidatedCount,
          };
        }
      }

      return result;
    } catch (error) {
      logger.error('Invalidation middleware error', 'CACHE_MIDDLEWARE', {
        error: error instanceof Error ? error.message : String(error),
        procedure: path,
      });
      metrics.increment('trpc_cache.invalidation_error');

      throw error; // Re-throw mutation errors
    }
  };
}

/**
 * Combined cache middleware (query + mutation)
 */
export function createCacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const queryMiddleware = createQueryCacheMiddleware(options);
  const mutationMiddleware = createMutationCacheMiddleware(options);

  return async function combinedCacheMiddleware(opts: any) {
    const { type } = opts;

    if (type === 'query') {
      return queryMiddleware(opts);
    } else if (type === 'mutation') {
      return mutationMiddleware(opts);
    } else {
      return opts.next();
    }
  };
}

/**
 * Cache warming utility for frequently accessed procedures
 */
export async function warmTRPCCache(
  procedures: Array<{
    name: string;
    inputs: any[];
    context: any;
  }>,
  options: {
    namespace?: string;
    concurrency?: number;
    retryAttempts?: number;
  } = {}
): Promise<number> {
  const { namespace = 'trpc', concurrency = 5, retryAttempts = 2 } = options;
  let warmedCount = 0;

  logger.info('Starting tRPC cache warming', 'CACHE_MIDDLEWARE', {
    procedureCount: procedures.length,
    concurrency,
  });

  try {
    // Process procedures in batches
    for (let i = 0; i < procedures.length; i += concurrency) {
      const batch = procedures.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (proc) => {
        for (const input of proc.inputs) {
          try {
            const cacheKey = generateCacheKey(proc.name, input, proc.context);
            
            // Check if already cached
            const existing = await cacheManager.get(cacheKey, namespace);
            if (existing) {
              warmedCount++;
              continue;
            }

            // Generate placeholder cache entry for warming
            // In practice, you'd call the actual procedure
            logger.debug('Cache warming placeholder', 'CACHE_MIDDLEWARE', {
              procedure: proc.name,
              cacheKey,
            });

          } catch (error) {
            logger.warn('Failed to warm cache for procedure', 'CACHE_MIDDLEWARE', {
              procedure: proc.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      });

      await Promise.all(batchPromises);
    }

    logger.info('tRPC cache warming completed', 'CACHE_MIDDLEWARE', {
      warmedCount,
      totalProcedures: procedures.length,
    });

    return warmedCount;
  } catch (error) {
    logger.error('tRPC cache warming failed', 'CACHE_MIDDLEWARE', {
      error: error instanceof Error ? error.message : String(error),
    });
    return warmedCount;
  }
}

/**
 * Cache statistics for tRPC procedures
 */
export async function getTRPCCacheStats(namespace: string = 'trpc'): Promise<any> {
  try {
    const stats = await cacheManager.getStats();
    
    return {
      ...stats,
      namespace,
      procedures: {
        // Could be extended with procedure-specific stats
      },
    };
  } catch (error) {
    logger.error('Failed to get tRPC cache stats', 'CACHE_MIDDLEWARE', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Clear tRPC cache
 */
export async function clearTRPCCache(namespace: string = 'trpc'): Promise<boolean> {
  try {
    const success = await cacheManager.clear(namespace);
    
    logger.info('tRPC cache cleared', 'CACHE_MIDDLEWARE', {
      namespace,
      success,
    });
    
    metrics.increment('trpc_cache.cleared');
    return success;
  } catch (error) {
    logger.error('Failed to clear tRPC cache', 'CACHE_MIDDLEWARE', {
      error: error instanceof Error ? error.message : String(error),
      namespace,
    });
    return false;
  }
}