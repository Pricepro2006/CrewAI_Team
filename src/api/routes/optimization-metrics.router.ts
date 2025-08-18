/**
 * Optimization Metrics Router
 * Exposes metrics for OptimizedQueryExecutor and CachedLLMProvider
 */

import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/index.js';
import { CachedLLMProvider } from '../../core/llm/CachedLLMProvider.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/optimization/database/metrics
 * Get OptimizedQueryExecutor metrics for all database instances
 */
router.get('/database/metrics', async (req: Request, res: Response) => {
  try {
    // Get metrics from main database
    const mainDb = getDatabase();
    const mainMetrics = mainDb.getMetrics();
    
    // Get metrics from walmart database if it exists
    let walmartMetrics = null;
    try {
      const walmartDb = getDatabase('./walmart_grocery.db');
      walmartMetrics = walmartDb.getMetrics();
    } catch (error) {
      // Walmart database might not exist
    }
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      databases: {
        main: mainMetrics,
        ...(walmartMetrics && { walmart: walmartMetrics })
      },
      summary: {
        totalCacheHits: mainMetrics.cacheHits + (walmartMetrics?.cacheHits || 0),
        totalCacheMisses: mainMetrics.cacheMisses + (walmartMetrics?.cacheMisses || 0),
        totalQueries: mainMetrics.totalQueries + (walmartMetrics?.totalQueries || 0),
        avgCacheHitRate: ((mainMetrics.cacheHits + (walmartMetrics?.cacheHits || 0)) / 
                         Math.max(1, mainMetrics.totalQueries + (walmartMetrics?.totalQueries || 0))) * 100,
        totalMemoryUsage: mainMetrics.cacheSize + (walmartMetrics?.cacheSize || 0)
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
    const metrics = db.getMetrics();
    
    const cacheStats = {
      success: true,
      timestamp: new Date().toISOString(),
      cache: {
        size: metrics.cacheSize,
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses,
        hitRate: (metrics.cacheHits / Math.max(1, metrics.cacheHits + metrics.cacheMisses)) * 100,
        evictions: metrics.cacheEvictions || 0,
        memoryUsage: metrics.cacheMemoryUsage || 0,
        entries: metrics.cacheEntries || 0,
        maxSize: metrics.maxCacheSize || 1000
      },
      prepared: {
        count: metrics.preparedStatements || 0,
        reused: metrics.preparedReused || 0,
        reuseRate: (metrics.preparedReused / Math.max(1, metrics.preparedStatements)) * 100
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
    const beforeMetrics = db.getMetrics();
    
    // Clear cache
    db.clearCache();
    
    const afterMetrics = db.getMetrics();
    
    res.json({
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
    });
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
    const metrics = provider.getMetrics();
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      llm: {
        ...metrics,
        hitRate: (metrics.cacheHits / Math.max(1, metrics.totalRequests)) * 100,
        avgLatency: metrics.totalRequests > 0 ? metrics.totalLatency / metrics.totalRequests : 0,
        deduplicationRate: (metrics.deduplicatedRequests / Math.max(1, metrics.totalRequests)) * 100
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
    const metrics = provider.getMetrics();
    const cacheDetails = provider.getCacheDetails();
    
    const cacheStats = {
      success: true,
      timestamp: new Date().toISOString(),
      cache: {
        size: cacheDetails.size,
        maxSize: cacheDetails.maxSize,
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses,
        hitRate: (metrics.cacheHits / Math.max(1, metrics.totalRequests)) * 100,
        evictions: cacheDetails.evictions || 0,
        memoryUsage: cacheDetails.memoryUsage || 0,
        ttl: cacheDetails.ttl || 3600000,
        oldestEntry: cacheDetails.oldestEntry || null,
        newestEntry: cacheDetails.newestEntry || null
      },
      deduplication: {
        active: metrics.deduplicatedRequests,
        saved: metrics.deduplicatedRequests,
        rate: (metrics.deduplicatedRequests / Math.max(1, metrics.totalRequests)) * 100
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
    const beforeMetrics = provider.getMetrics();
    
    // Clear cache
    provider.clearCache();
    
    const afterMetrics = provider.getMetrics();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'LLM cache cleared successfully',
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
    });
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
    const dbMetrics = mainDb.getMetrics();
    
    // LLM metrics
    const provider = CachedLLMProvider.getInstance();
    const llmMetrics = provider.getMetrics();
    
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      optimization: {
        database: {
          cacheHitRate: (dbMetrics.cacheHits / Math.max(1, dbMetrics.totalQueries)) * 100,
          totalQueries: dbMetrics.totalQueries,
          avgQueryTime: dbMetrics.avgQueryTime,
          cacheMemory: dbMetrics.cacheSize
        },
        llm: {
          cacheHitRate: (llmMetrics.cacheHits / Math.max(1, llmMetrics.totalRequests)) * 100,
          totalRequests: llmMetrics.totalRequests,
          avgLatency: llmMetrics.totalRequests > 0 ? llmMetrics.totalLatency / llmMetrics.totalRequests : 0,
          cacheMemory: llmMetrics.cacheSize
        },
        overall: {
          totalCacheHits: dbMetrics.cacheHits + llmMetrics.cacheHits,
          totalCacheMisses: dbMetrics.cacheMisses + llmMetrics.cacheMisses,
          totalOperations: dbMetrics.totalQueries + llmMetrics.totalRequests,
          avgCacheHitRate: ((dbMetrics.cacheHits + llmMetrics.cacheHits) / 
                           Math.max(1, dbMetrics.totalQueries + llmMetrics.totalRequests)) * 100,
          totalMemoryUsage: dbMetrics.cacheSize + llmMetrics.cacheSize
        }
      }
    };
    
    res.json(summary);
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
    const dbMetrics = mainDb.getMetrics();
    const provider = CachedLLMProvider.getInstance();
    const llmMetrics = provider.getMetrics();
    
    const recommendations = [];
    
    // Database recommendations
    const dbHitRate = (dbMetrics.cacheHits / Math.max(1, dbMetrics.totalQueries)) * 100;
    if (dbHitRate < 50) {
      recommendations.push({
        type: 'database',
        severity: 'medium',
        message: `Database cache hit rate is low (${dbHitRate.toFixed(1)}%). Consider increasing cache size or TTL.`
      });
    }
    
    if (dbMetrics.avgQueryTime > 100) {
      recommendations.push({
        type: 'database',
        severity: 'high',
        message: `Average query time is high (${dbMetrics.avgQueryTime.toFixed(1)}ms). Consider adding indexes or optimizing queries.`
      });
    }
    
    // LLM recommendations
    const llmHitRate = (llmMetrics.cacheHits / Math.max(1, llmMetrics.totalRequests)) * 100;
    if (llmHitRate < 30) {
      recommendations.push({
        type: 'llm',
        severity: 'low',
        message: `LLM cache hit rate is low (${llmHitRate.toFixed(1)}%). This is normal for diverse queries.`
      });
    }
    
    if (llmMetrics.errors > llmMetrics.totalRequests * 0.05) {
      recommendations.push({
        type: 'llm',
        severity: 'high',
        message: `High LLM error rate detected (${((llmMetrics.errors / Math.max(1, llmMetrics.totalRequests)) * 100).toFixed(1)}%). Check LLM service availability.`
      });
    }
    
    // Memory recommendations
    const totalMemory = dbMetrics.cacheSize + llmMetrics.cacheSize;
    if (totalMemory > 500 * 1024 * 1024) { // 500MB
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
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      recommendations,
      metrics: {
        database: {
          hitRate: dbHitRate,
          avgQueryTime: dbMetrics.avgQueryTime
        },
        llm: {
          hitRate: llmHitRate,
          errorRate: (llmMetrics.errors / Math.max(1, llmMetrics.totalRequests)) * 100
        },
        memory: {
          totalUsage: totalMemory,
          totalUsageMB: totalMemory / 1024 / 1024
        }
      }
    });
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