/**
 * Optimization Metrics Router
 * Exposes metrics for OptimizedQueryExecutor and CachedLLMProvider
 */

import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/index.js';
import { CachedLLMProvider } from '../../core/llm/CachedLLMProvider.js';
import { logger } from '../../utils/logger.js';
import {
  safeDatabaseMetrics,
  safeLLMMetrics,
  calculateHitRate,
  safeAverage,
  type QueryStats,
  type ExtendedLLMMetrics,
  type DatabaseMetricsResponse,
  type CacheStatsResponse,
  type CacheClearResponse,
  type LLMMetricsResponse,
  type LLMCacheStatsResponse,
  type OptimizationSummaryResponse,
  type RecommendationsResponse,
  type Recommendation
} from '../validation/metricsSchemas.js';

const router = Router();

/**
 * GET /api/optimization/database/metrics
 * Get OptimizedQueryExecutor metrics for all database instances
 */
router.get('/database/metrics', async (req: Request, res: Response) => {
  try {
    // Get metrics from main database
    const mainDb = getDatabase();
    const mainMetrics = safeDatabaseMetrics(mainDb.getMetrics());
    
    // Get metrics from walmart database if it exists
    let walmartMetrics: QueryStats | null = null;
    try {
      const walmartDb = getDatabase('./walmart_grocery.db');
      walmartMetrics = safeDatabaseMetrics(walmartDb.getMetrics());
    } catch (error) {
      // Walmart database might not exist
    }
    
    const response: DatabaseMetricsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      databases: {
        main: mainMetrics,
        ...(walmartMetrics && { walmart: walmartMetrics })
      },
      summary: {
        totalCacheHits: mainMetrics.cacheHits + (walmartMetrics?.cacheHits ?? 0),
        totalCacheMisses: mainMetrics.cacheMisses + (walmartMetrics?.cacheMisses ?? 0),
        totalQueries: mainMetrics.totalQueries + (walmartMetrics?.totalQueries ?? 0),
        avgCacheHitRate: calculateHitRate(
          mainMetrics.cacheHits + (walmartMetrics?.cacheHits ?? 0),
          mainMetrics.cacheMisses + (walmartMetrics?.cacheMisses ?? 0)
        ),
        totalMemoryUsage: (mainMetrics.cacheMemoryUsage ?? 0) + (walmartMetrics?.cacheMemoryUsage ?? 0)
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get database optimization metrics', 'OPTIMIZATION_METRICS', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database optimization metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/database/cache
 * Get detailed cache statistics
 */
router.get('/database/cache', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const metrics = safeDatabaseMetrics(db.getMetrics());
    
    const cacheStats: CacheStatsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      cache: {
        size: metrics.cacheSize,
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses,
        hitRate: calculateHitRate(metrics.cacheHits, metrics.cacheMisses),
        evictions: metrics.cacheEvictions ?? 0,
        memoryUsage: metrics.cacheMemoryUsage ?? 0,
        entries: metrics.cacheEntries ?? 0,
        maxSize: metrics.maxCacheSize ?? 1000
      },
      prepared: {
        count: metrics.preparedStatements ?? 0,
        reused: metrics.preparedReused ?? 0,
        reuseRate: safeAverage(metrics.preparedReused ?? 0, metrics.preparedStatements ?? 0) * 100
      }
    };
    
    res.json(cacheStats);
  } catch (error) {
    logger.error('Failed to get cache statistics', 'OPTIMIZATION_METRICS', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/database/cache/clear
 * Clear the query cache
 */
router.post('/database/cache/clear', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const beforeMetrics = safeDatabaseMetrics(db.getMetrics());
    
    // Clear cache
    db.clearCache();
    
    const afterMetrics = safeDatabaseMetrics(db.getMetrics());
    
    const response: CacheClearResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Query cache cleared successfully',
      before: {
        cacheSize: beforeMetrics.cacheSize,
        cacheHits: beforeMetrics.cacheHits,
        cacheMisses: beforeMetrics.cacheMisses
      },
      after: {
        cacheSize: afterMetrics.cacheSize,
        cacheHits: afterMetrics.cacheHits,
        cacheMisses: afterMetrics.cacheMisses
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to clear query cache', 'OPTIMIZATION_METRICS', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear query cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/llm/metrics
 * Get CachedLLMProvider metrics
 */
router.get('/llm/metrics', async (req: Request, res: Response) => {
  try {
    // Get singleton instance metrics
    const provider = CachedLLMProvider.getInstance();
    const metrics = safeLLMMetrics(provider.getMetrics());
    
    const response: LLMMetricsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      llm: {
        ...metrics,
        avgLatency: 0, // Not tracked in current metrics
        deduplicationRate: safeAverage(metrics.dedupeCount, metrics.hits + metrics.misses) * 100
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get LLM optimization metrics', 'OPTIMIZATION_METRICS', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve LLM optimization metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/llm/cache
 * Get detailed LLM cache statistics
 */
router.get('/llm/cache', async (req: Request, res: Response) => {
  try {
    const provider = CachedLLMProvider.getInstance();
    const metrics = safeLLMMetrics(provider.getMetrics());
    // Get cache details from existing metrics and stats
    const stats = provider.exportStats();
    
    const cacheStats: LLMCacheStatsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      cache: {
        size: stats.cacheSize ?? 0,
        maxSize: 500, // From CachedLLMProvider config
        hits: metrics.hits,
        misses: metrics.misses,
        hitRate: metrics.hitRate,
        evictions: metrics.evictions ?? 0,
        memoryUsage: (stats.memoryUsage ?? 0) * 1024 * 1024, // Convert MB to bytes
        ttl: 30 * 60 * 1000, // 30 minutes from config
        oldestEntry: null,
        newestEntry: null
      },
      deduplication: {
        active: metrics.dedupeCount,
        saved: metrics.dedupeCount,
        rate: safeAverage(metrics.dedupeCount, metrics.hits + metrics.misses) * 100
      }
    };
    
    res.json(cacheStats);
  } catch (error) {
    logger.error('Failed to get LLM cache statistics', 'OPTIMIZATION_METRICS', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve LLM cache statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/optimization/llm/cache/clear
 * Clear the LLM cache
 */
router.post('/llm/cache/clear', async (req: Request, res: Response) => {
  try {
    const provider = CachedLLMProvider.getInstance();
    const beforeMetrics = safeLLMMetrics(provider.getMetrics());
    
    // Clear cache
    provider.clearCache();
    
    const afterMetrics = safeLLMMetrics(provider.getMetrics());
    
    const response: CacheClearResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      message: 'LLM cache cleared successfully',
      before: {
        cacheSize: beforeMetrics.cacheSize,
        cacheHits: beforeMetrics.hits,
        cacheMisses: beforeMetrics.misses
      },
      after: {
        cacheSize: afterMetrics.cacheSize,
        cacheHits: afterMetrics.hits,
        cacheMisses: afterMetrics.misses
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to clear LLM cache', 'OPTIMIZATION_METRICS', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear LLM cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/summary
 * Get summary of all optimization metrics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // Database metrics
    const mainDb = getDatabase();
    const dbMetrics = safeDatabaseMetrics(mainDb.getMetrics());
    
    // LLM metrics
    const provider = CachedLLMProvider.getInstance();
    const llmMetrics = safeLLMMetrics(provider.getMetrics());
    
    const response: OptimizationSummaryResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      optimization: {
        database: {
          cacheHitRate: calculateHitRate(dbMetrics.cacheHits, dbMetrics.cacheMisses),
          totalQueries: dbMetrics.totalQueries,
          avgQueryTime: dbMetrics.avgExecutionTime,
          cacheMemory: dbMetrics.cacheMemoryUsage ?? 0
        },
        llm: {
          cacheHitRate: llmMetrics.hitRate,
          totalRequests: llmMetrics.hits + llmMetrics.misses,
          avgLatency: 0, // Not tracked in current metrics
          cacheMemory: llmMetrics.cacheSize ?? 0
        },
        overall: {
          totalCacheHits: dbMetrics.cacheHits + llmMetrics.hits,
          totalCacheMisses: dbMetrics.cacheMisses + llmMetrics.misses,
          totalOperations: dbMetrics.totalQueries + (llmMetrics.hits + llmMetrics.misses),
          avgCacheHitRate: calculateHitRate(
            dbMetrics.cacheHits + llmMetrics.hits,
            dbMetrics.cacheMisses + llmMetrics.misses
          ),
          totalMemoryUsage: (dbMetrics.cacheMemoryUsage ?? 0) + (llmMetrics.cacheSize ?? 0)
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get optimization summary', 'OPTIMIZATION_METRICS', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve optimization summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/optimization/recommendations
 * Get optimization recommendations based on metrics
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const mainDb = getDatabase();
    const dbMetrics = safeDatabaseMetrics(mainDb.getMetrics());
    const provider = CachedLLMProvider.getInstance();
    const llmMetrics = safeLLMMetrics(provider.getMetrics());
    
    const recommendations: Recommendation[] = [];
    
    // Database recommendations
    const dbHitRate = calculateHitRate(dbMetrics.cacheHits, dbMetrics.cacheMisses);
    if (dbHitRate < 50) {
      recommendations.push({
        type: 'database',
        severity: 'medium',
        message: `Database cache hit rate is low (${dbHitRate.toFixed(1)}%). Consider increasing cache size or TTL.`
      });
    }
    
    if (dbMetrics.avgExecutionTime > 100) {
      recommendations.push({
        type: 'database',
        severity: 'high',
        message: `Average query time is high (${dbMetrics.avgExecutionTime.toFixed(1)}ms). Consider adding indexes or optimizing queries.`
      });
    }
    
    // LLM recommendations
    const llmHitRate = llmMetrics.hitRate;
    if (llmHitRate < 30) {
      recommendations.push({
        type: 'llm',
        severity: 'low',
        message: `LLM cache hit rate is low (${llmHitRate.toFixed(1)}%). This is normal for diverse queries.`
      });
    }
    
    const totalLLMRequests = llmMetrics.hits + llmMetrics.misses;
    const errorRate = safeAverage(llmMetrics.errors, totalLLMRequests) * 100;
    if (errorRate > 5) {
      recommendations.push({
        type: 'llm',
        severity: 'high',
        message: `High LLM error rate detected (${errorRate.toFixed(1)}%). Check LLM service availability.`
      });
    }
    
    // Memory recommendations
    const totalMemory = (dbMetrics.cacheMemoryUsage ?? 0) + (llmMetrics.cacheSize ?? 0);
    if (totalMemory > 500 * 1024 * 1024) { // 500MB in bytes
      recommendations.push({
        type: 'memory',
        severity: 'medium',
        message: `High cache memory usage (${(totalMemory / 1024 / 1024).toFixed(1)}MB). Consider implementing cache eviction policies.`
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'general',
        severity: 'info',
        message: 'All optimization metrics are within acceptable ranges.'
      });
    }
    
    const response: RecommendationsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      recommendations,
      metrics: {
        database: {
          hitRate: dbHitRate,
          avgQueryTime: dbMetrics.avgExecutionTime
        },
        llm: {
          hitRate: llmHitRate,
          errorRate
        },
        memory: {
          totalUsage: totalMemory,
          totalUsageMB: totalMemory / 1024 / 1024
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to generate optimization recommendations', 'OPTIMIZATION_METRICS', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate optimization recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;