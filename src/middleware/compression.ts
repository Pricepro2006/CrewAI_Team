/**
 * Response Compression Middleware for tRPC API Optimization
 * Implements efficient JSON compression and caching strategies
 */

import { z } from "zod";
import { logger } from "../utils/logger.js";
import type { Context } from "../api/trpc/context.js";
import { TRPCError } from "@trpc/server";
import { LRUCache } from "lru-cache";
import { createHash } from "crypto";

// Compression configuration
export interface CompressionConfig {
  threshold: number; // Minimum response size in bytes to compress
  level: number; // Compression level (1-9)
  enableCaching: boolean;
  cacheMaxAge: number; // Cache max age in milliseconds
  cacheMaxSize: number; // Maximum cache size in items
}

const defaultConfig: CompressionConfig = {
  threshold: 1024, // 1KB
  level: 6, // Balanced compression
  enableCaching: true,
  cacheMaxAge: 5 * 60 * 1000, // 5 minutes
  cacheMaxSize: 1000, // 1000 cached responses
};

// Response cache using LRU
const responseCache = new LRUCache<string, {
  data: any;
  etag: string;
  compressed: Buffer | null;
  timestamp: number;
}>({
  max: defaultConfig.cacheMaxSize,
  ttl: defaultConfig.cacheMaxAge,
});

/**
 * Generate ETag for response caching
 */
export function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('md5').update(content).digest('hex');
}

/**
 * Check if response should be compressed based on size and content type
 */
export function shouldCompress(data: any, config: CompressionConfig): boolean {
  if (!data) return false;
  
  const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
  return size >= config.threshold;
}

/**
 * Compress JSON response using gzip
 */
export async function compressResponse(data: any): Promise<Buffer> {
  const { gzip } = await import('zlib');
  const { promisify } = await import('util');
  const gzipAsync = promisify(gzip);
  
  const jsonString = JSON.stringify(data);
  return await gzipAsync(jsonString);
}

/**
 * Generate cache key for response caching
 */
export function generateCacheKey(
  procedure: string,
  input: any,
  userId?: string,
  additionalKeys?: string[]
): string {
  const baseKey = `${procedure}:${JSON.stringify(input)}`;
  const userKey = userId ? `:user:${userId}` : '';
  const extraKeys = additionalKeys ? `:${additionalKeys.join(':')}` : '';
  
  return createHash('sha256')
    .update(`${baseKey}${userKey}${extraKeys}`)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for shorter keys
}

/**
 * Cache response with compression and ETag generation
 */
export async function cacheResponse(
  cacheKey: string,
  data: any,
  config: CompressionConfig = defaultConfig
): Promise<void> {
  try {
    const etag = generateETag(data);
    const compressed = shouldCompress(data, config) 
      ? await compressResponse(data)
      : null;
    
    responseCache.set(cacheKey, {
      data,
      etag,
      compressed,
      timestamp: Date.now(),
    });

    logger.debug("Response cached", "COMPRESSION", {
      cacheKey,
      etag,
      compressed: !!compressed,
      size: Buffer.byteLength(JSON.stringify(data), 'utf8'),
      compressedSize: compressed?.length || 0,
    });
  } catch (error) {
    logger.error("Failed to cache response", "COMPRESSION", { cacheKey, error });
  }
}

/**
 * Retrieve cached response
 */
export function getCachedResponse(cacheKey: string): {
  data: any;
  etag: string;
  compressed: Buffer | null;
  age: number;
} | null {
  const cached = responseCache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  const age = Date.now() - cached.timestamp;
  
  return {
    ...cached,
    age,
  };
}

/**
 * Check if client has valid cached version using ETag
 */
export function isClientCacheValid(
  clientETag: string | undefined,
  responseETag: string
): boolean {
  return clientETag === responseETag;
}

/**
 * Set appropriate cache headers on response
 */
export function setCacheHeaders(
  ctx: Context,
  etag: string,
  maxAge: number = defaultConfig.cacheMaxAge / 1000
): void {
  const response = ctx?.res;
  
  // Set ETag for conditional requests
  response.setHeader('ETag', `"${etag}"`);
  
  // Set cache control headers
  response.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);
  
  // Set Vary header for proper caching
  response.setHeader('Vary', 'Accept-Encoding, Authorization');
  
  // Set Last-Modified
  response.setHeader('Last-Modified', new Date().toUTCString());
}

/**
 * tRPC middleware for response compression and caching
 */
export function createCompressionMiddleware(config: CompressionConfig = defaultConfig) {
  return async ({ next, ctx, path, input }: {
    next: () => Promise<any>;
    ctx: Context;
    path: string;
    input: any;
  }) => {
    const startTime = Date.now();
    
    // Generate cache key if caching is enabled
    let cacheKey: string | null = null;
    if (config.enableCaching) {
      cacheKey = generateCacheKey(
        path,
        input,
        ctx.user?.id,
        [ctx?.req?.method || 'unknown']
      );
      
      // Check for cached response
      const cached = getCachedResponse(cacheKey);
      if (cached) {
        // Check if client has valid cache using If-None-Match header
        const clientETag = ctx?.req?.headers['if-none-match']?.replace(/"/g, '');
        
        if (isClientCacheValid(clientETag, cached.etag)) {
          // Client has valid cache, return 304 Not Modified
          ctx?.res?.status(304);
          setCacheHeaders(ctx, cached.etag);
          
          logger.debug("Cache hit - 304 Not Modified", "COMPRESSION", {
            path,
            cacheKey,
            age: cached.age,
          });
          
          return null; // No body for 304 response
        }
        
        // Client cache is stale, return cached data with headers
        setCacheHeaders(ctx, cached.etag);
        
        logger.debug("Cache hit - returning cached data", "COMPRESSION", {
          path,
          cacheKey,
          age: cached.age,
          compressed: !!cached.compressed,
        });
        
        return cached.data;
      }
    }
    
    // Execute the procedure
    const result = await next();
    const responseTime = Date.now() - startTime;
    
    // Process response for compression and caching
    if (result && config.enableCaching && cacheKey) {
      // Cache the response asynchronously to avoid blocking
      cacheResponse(cacheKey, result, config).catch(error => {
        logger.error("Failed to cache response", "COMPRESSION", { cacheKey, error });
      });
      
      // Set cache headers for new response
      const etag = generateETag(result);
      setCacheHeaders(ctx, etag);
    }
    
    // Log performance metrics
    logger.debug("Response processed", "COMPRESSION", {
      path,
      responseTime,
      cached: !!cacheKey && responseCache.has(cacheKey),
      size: result ? Buffer.byteLength(JSON.stringify(result), 'utf8') : 0,
    });
    
    return result;
  };
}

/**
 * Streaming response handler for large datasets
 */
export class StreamingResponseHandler {
  private chunks: any[] = [];
  private config: CompressionConfig;
  
  constructor(config: CompressionConfig = defaultConfig) {
    this.config = config;
  }
  
  /**
   * Add data chunk to stream
   */
  addChunk(data: any): void {
    this?.chunks?.push(data);
  }
  
  /**
   * Process and stream response chunks
   */
  async streamResponse(ctx: Context): Promise<void> {
    const response = ctx?.res;
    
    // Set streaming headers
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Transfer-Encoding', 'chunked');
    
    // Stream opening bracket
    response.write('[');
    
    for (let i = 0; i < this?.chunks?.length; i++) {
      const chunk = this.chunks[i];
      const chunkJson = JSON.stringify(chunk);
      
      // Add comma separator except for first chunk
      if (i > 0) {
        response.write(',');
      }
      
      response.write(chunkJson);
    }
    
    // Stream closing bracket
    response.write(']');
    response.end();
  }
}

/**
 * Batch response optimizer for multiple related requests
 */
export class BatchResponseOptimizer {
  private responses: Map<string, any> = new Map();
  private config: CompressionConfig;
  
  constructor(config: CompressionConfig = defaultConfig) {
    this.config = config;
  }
  
  /**
   * Add response to batch
   */
  addResponse(key: string, data: any): void {
    this?.responses?.set(key, data);
  }
  
  /**
   * Get optimized batch response
   */
  async getBatchResponse(): Promise<Record<string, any>> {
    const batchData = Object.fromEntries(this.responses);
    
    // Apply compression if needed
    if (shouldCompress(batchData, this.config)) {
      logger.debug("Batch response will be compressed", "COMPRESSION", {
        batchSize: this?.responses?.size,
        totalSize: Buffer.byteLength(JSON.stringify(batchData), 'utf8'),
      });
    }
    
    return batchData;
  }
  
  /**
   * Clear batch data
   */
  clear(): void {
    this?.responses?.clear();
  }
}

/**
 * Response optimization utilities
 */
export const ResponseOptimization = {
  /**
   * Remove null/undefined values from response
   */
  cleanResponse<T extends Record<string, any>>(data: T): Partial<T> {
    const cleaned: Partial<T> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        // Recursively clean nested objects
        if (typeof value === 'object' && !Array.isArray(value)) {
          const cleanedNested = this.cleanResponse(value);
          if (Object.keys(cleanedNested).length > 0) {
            cleaned[key as keyof T] = cleanedNested as T[keyof T];
          }
        } else if (Array.isArray(value)) {
          // Clean array elements
          const cleanedArray = value
            .map(item => typeof item === 'object' ? this.cleanResponse(item) : item)
            .filter(item => item !== null && item !== undefined);
          
          if (cleanedArray?.length || 0 > 0) {
            cleaned[key as keyof T] = cleanedArray as T[keyof T];
          }
        } else {
          cleaned[key as keyof T] = value;
        }
      }
    }
    
    return cleaned;
  },
  
  /**
   * Optimize response for minimal bandwidth usage
   */
  minimizeResponse<T extends Record<string, any>>(
    data: T,
    options: {
      removeEmpty?: boolean;
      truncateStrings?: number;
      maxArrayLength?: number;
    } = {}
  ): Partial<T> {
    const { removeEmpty = true, truncateStrings, maxArrayLength } = options;
    
    let result = removeEmpty ? this.cleanResponse(data) : { ...data };
    
    // Truncate long strings if specified
    if (truncateStrings) {
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'string' && value?.length || 0 > truncateStrings) {
          (result as any)[key] = value.substring(0, truncateStrings) + '...';
        }
      }
    }
    
    // Limit array lengths if specified
    if (maxArrayLength) {
      for (const [key, value] of Object.entries(result)) {
        if (Array.isArray(value) && value?.length || 0 > maxArrayLength) {
          (result as any)[key] = value.slice(0, maxArrayLength);
        }
      }
    }
    
    return result;
  },
};

/**
 * Cache invalidation utilities
 */
export const CacheInvalidation = {
  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: string): number {
    let count = 0;
    const keys = Array.from(responseCache.keys());
    
    for (const key of keys) {
      if (String(key).includes(pattern)) {
        responseCache.delete(key);
        count++;
      }
    }
    
    logger.info("Cache invalidated by pattern", "COMPRESSION", {
      pattern,
      invalidatedCount: count,
    });
    
    return count;
  },
  
  /**
   * Invalidate cache entries for specific user
   */
  invalidateForUser(userId: string): number {
    return this.invalidateByPattern(`:user:${userId}`);
  },
  
  /**
   * Clear all cached responses
   */
  clearAll(): void {
    responseCache.clear();
    logger.info("All cache entries cleared", "COMPRESSION");
  },
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: responseCache.size,
      maxSize: responseCache.max,
      hitRatio: (responseCache as any).calculatedHitRatio || 0,
    };
  },
};