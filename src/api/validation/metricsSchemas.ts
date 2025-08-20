/**
 * Zod Schemas for Metrics Validation
 * Comprehensive type definitions and validation for all metrics across the system
 */

import { z } from 'zod';

// ============================================
// Database Metrics Schemas
// ============================================

/**
 * Query metrics for individual query tracking
 */
export const QueryMetricsSchema = z.object({
  query: z.string(),
  executionTime: z.number(),
  rowCount: z.number(),
  cacheHit: z.boolean(),
  timestamp: z.number()
});

/**
 * Slow query information
 */
export const SlowQuerySchema = z.object({
  query: z.string(),
  executionTime: z.number(),
  rowCount: z.number(),
  cacheHit: z.boolean(),
  timestamp: z.number()
});

/**
 * Database query statistics
 */
export const QueryStatsSchema = z.object({
  totalQueries: z.number(),
  cacheHits: z.number(),
  cacheMisses: z.number(),
  avgExecutionTime: z.number(),
  slowQueries: z.array(SlowQuerySchema),
  cacheSize: z.number().optional(),
  cacheEvictions: z.number().optional(),
  cacheMemoryUsage: z.number().optional(),
  cacheEntries: z.number().optional(),
  maxCacheSize: z.number().optional(),
  preparedStatements: z.number().optional(),
  preparedReused: z.number().optional()
});

/**
 * Extended database metrics with calculated fields
 */
export const ExtendedDatabaseMetricsSchema = QueryStatsSchema.extend({
  hitRate: z.number(),
  totalRequests: z.number().optional(),
  avgQueryTime: z.number().optional()
});

// ============================================
// LLM Provider Metrics Schemas
// ============================================

/**
 * Cache metrics for LLM provider
 */
export const LLMCacheMetricsSchema = z.object({
  hits: z.number(),
  misses: z.number(),
  evictions: z.number(),
  dedupeCount: z.number(),
  timeouts: z.number(),
  errors: z.number()
});

/**
 * Extended LLM metrics with calculated fields
 */
export const ExtendedLLMMetricsSchema = LLMCacheMetricsSchema.extend({
  hitRate: z.number(),
  cacheSize: z.number()
});

/**
 * LLM cache entry for top entries tracking
 */
export const LLMCacheEntrySchema = z.object({
  key: z.string(),
  hits: z.number(),
  age: z.number()
});

/**
 * LLM statistics export
 */
export const LLMStatsExportSchema = z.object({
  metrics: ExtendedLLMMetricsSchema,
  topEntries: z.array(LLMCacheEntrySchema),
  cacheSize: z.number(),
  pendingRequests: z.number(),
  memoryUsage: z.number()
});

/**
 * LLM cache details
 */
export const LLMCacheDetailsSchema = z.object({
  size: z.number(),
  maxSize: z.number(),
  evictions: z.number(),
  memoryUsage: z.number(),
  ttl: z.number(),
  oldestEntry: z.string().nullable(),
  newestEntry: z.string().nullable()
});

// ============================================
// Response Schemas
// ============================================

/**
 * Database metrics response
 */
export const DatabaseMetricsResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  databases: z.object({
    main: QueryStatsSchema,
    walmart: QueryStatsSchema.optional()
  }),
  summary: z.object({
    totalCacheHits: z.number(),
    totalCacheMisses: z.number(),
    totalQueries: z.number(),
    avgCacheHitRate: z.number(),
    totalMemoryUsage: z.number()
  })
});

/**
 * Cache statistics response
 */
export const CacheStatsResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  cache: z.object({
    size: z.number().optional(),
    hits: z.number(),
    misses: z.number(),
    hitRate: z.number(),
    evictions: z.number(),
    memoryUsage: z.number(),
    entries: z.number(),
    maxSize: z.number()
  }),
  prepared: z.object({
    count: z.number(),
    reused: z.number(),
    reuseRate: z.number()
  })
});

/**
 * Cache clear response
 */
export const CacheClearResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  message: z.string(),
  before: z.object({
    cacheSize: z.number().optional(),
    cacheHits: z.number(),
    cacheMisses: z.number()
  }),
  after: z.object({
    cacheSize: z.number().optional(),
    cacheHits: z.number(),
    cacheMisses: z.number()
  })
});

/**
 * LLM metrics response
 */
export const LLMMetricsResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  llm: z.object({
    hits: z.number(),
    misses: z.number(),
    evictions: z.number(),
    dedupeCount: z.number(),
    timeouts: z.number(),
    errors: z.number(),
    hitRate: z.number(),
    avgLatency: z.number(),
    deduplicationRate: z.number(),
    cacheSize: z.number()
  })
});

/**
 * LLM cache statistics response
 */
export const LLMCacheStatsResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  cache: z.object({
    size: z.number(),
    maxSize: z.number(),
    hits: z.number(),
    misses: z.number(),
    hitRate: z.number(),
    evictions: z.number(),
    memoryUsage: z.number(),
    ttl: z.number(),
    oldestEntry: z.string().nullable(),
    newestEntry: z.string().nullable()
  }),
  deduplication: z.object({
    active: z.number(),
    saved: z.number(),
    rate: z.number()
  })
});

/**
 * Optimization summary response
 */
export const OptimizationSummaryResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  optimization: z.object({
    database: z.object({
      cacheHitRate: z.number(),
      totalQueries: z.number(),
      avgQueryTime: z.number(),
      cacheMemory: z.number()
    }),
    llm: z.object({
      cacheHitRate: z.number(),
      totalRequests: z.number(),
      avgLatency: z.number(),
      cacheMemory: z.number()
    }),
    overall: z.object({
      totalCacheHits: z.number(),
      totalCacheMisses: z.number(),
      totalOperations: z.number(),
      avgCacheHitRate: z.number(),
      totalMemoryUsage: z.number()
    })
  })
});

/**
 * Recommendation item
 */
export const RecommendationSchema = z.object({
  type: z.enum(['database', 'llm', 'memory', 'general']),
  severity: z.enum(['low', 'medium', 'high', 'info']),
  message: z.string()
});

/**
 * Recommendations response
 */
export const RecommendationsResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  recommendations: z.array(RecommendationSchema),
  metrics: z.object({
    database: z.object({
      hitRate: z.number(),
      avgQueryTime: z.number()
    }),
    llm: z.object({
      hitRate: z.number(),
      errorRate: z.number()
    }),
    memory: z.object({
      totalUsage: z.number(),
      totalUsageMB: z.number()
    })
  })
});

/**
 * Error response
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.string().optional()
});

// ============================================
// Type Exports
// ============================================

export type QueryMetrics = z.infer<typeof QueryMetricsSchema>;
export type SlowQuery = z.infer<typeof SlowQuerySchema>;
export type QueryStats = z.infer<typeof QueryStatsSchema>;
export type ExtendedDatabaseMetrics = z.infer<typeof ExtendedDatabaseMetricsSchema>;
export type LLMCacheMetrics = z.infer<typeof LLMCacheMetricsSchema>;
export type ExtendedLLMMetrics = z.infer<typeof ExtendedLLMMetricsSchema>;
export type LLMCacheEntry = z.infer<typeof LLMCacheEntrySchema>;
export type LLMStatsExport = z.infer<typeof LLMStatsExportSchema>;
export type LLMCacheDetails = z.infer<typeof LLMCacheDetailsSchema>;
export type DatabaseMetricsResponse = z.infer<typeof DatabaseMetricsResponseSchema>;
export type CacheStatsResponse = z.infer<typeof CacheStatsResponseSchema>;
export type CacheClearResponse = z.infer<typeof CacheClearResponseSchema>;
export type LLMMetricsResponse = z.infer<typeof LLMMetricsResponseSchema>;
export type LLMCacheStatsResponse = z.infer<typeof LLMCacheStatsResponseSchema>;
export type OptimizationSummaryResponse = z.infer<typeof OptimizationSummaryResponseSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type RecommendationsResponse = z.infer<typeof RecommendationsResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Safely extract database metrics with defaults
 */
export function safeDatabaseMetrics(metrics: any): QueryStats {
  return {
    totalQueries: metrics?.totalQueries ?? 0,
    cacheHits: metrics?.cacheHits ?? 0,
    cacheMisses: metrics?.cacheMisses ?? 0,
    avgExecutionTime: metrics?.avgExecutionTime ?? 0,
    slowQueries: metrics?.slowQueries ?? [],
    cacheSize: metrics?.cacheSize,
    cacheEvictions: metrics?.cacheEvictions,
    cacheMemoryUsage: metrics?.cacheMemoryUsage,
    cacheEntries: metrics?.cacheEntries,
    maxCacheSize: metrics?.maxCacheSize,
    preparedStatements: metrics?.preparedStatements,
    preparedReused: metrics?.preparedReused
  };
}

/**
 * Safely extract LLM metrics with defaults
 */
export function safeLLMMetrics(metrics: any): ExtendedLLMMetrics {
  return {
    hits: metrics?.hits ?? 0,
    misses: metrics?.misses ?? 0,
    evictions: metrics?.evictions ?? 0,
    dedupeCount: metrics?.dedupeCount ?? 0,
    timeouts: metrics?.timeouts ?? 0,
    errors: metrics?.errors ?? 0,
    hitRate: metrics?.hitRate ?? 0,
    cacheSize: metrics?.cacheSize ?? 0
  };
}

/**
 * Calculate cache hit rate safely
 */
export function calculateHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  return total > 0 ? (hits / total) * 100 : 0;
}

/**
 * Calculate average with safe division
 */
export function safeAverage(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}