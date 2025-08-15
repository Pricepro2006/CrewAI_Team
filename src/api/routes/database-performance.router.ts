/**
 * Database Performance Monitoring API
 * 
 * Provides endpoints for monitoring database connection pool performance,
 * health status, and optimization metrics.
 */

import { Router, Request, Response } from 'express';
import { databaseManager } from '../../core/database/DatabaseManager.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/database/metrics
 * Get comprehensive metrics for all database pools
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = databaseManager.getAllMetrics();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        pools: metrics,
        summary: {
          totalPools: Object.keys(metrics).length,
          totalConnections: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.totalConnections, 0),
          totalActiveConnections: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.activeConnections, 0),
          totalQueries: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.totalQueries, 0),
          avgQueryTime: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.avgQueryTime, 0) / Object.keys(metrics).length,
          totalMemoryUsage: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.totalMemoryUsage, 0),
          totalErrors: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.errors, 0),
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get database metrics:', error as string);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/database/health
 * Get health status for all database pools
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await databaseManager.getHealthStatus();
    
    const overallHealth = Object.values(healthStatus).every(status => status.healthy);
    const totalErrors = Object.values(healthStatus).reduce((sum: any, status: any) => sum + status?.errors?.length, 0);
    
    res.status(overallHealth ? 200 : 503).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        healthy: overallHealth,
        databases: healthStatus,
        summary: {
          totalDatabases: Object.keys(healthStatus).length,
          healthyDatabases: Object.values(healthStatus).filter(status => status.healthy).length,
          totalErrors: totalErrors,
          errors: Object.values(healthStatus).flatMap(status => 
            status?.errors?.map(error => ({ database: status.database, error }))
          )
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get database health:', error as string);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database health status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/database/connections/:database
 * Get detailed connection metrics for a specific database
 */
router.get('/connections/:database', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { database } = req.params;
    
    if (database !== 'main' && database !== 'walmart') {
      return res.status(400).json({
        success: false,
        error: 'Invalid database name. Must be "main" or "walmart"'
      });
    }
    
    const pool = databaseManager.getPool(database as 'main' | 'walmart');
    const connectionMetrics = pool.getConnectionMetrics();
    const poolMetrics = pool.getMetrics();
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        database,
        poolMetrics,
        connections: connectionMetrics,
        summary: {
          totalConnections: connectionMetrics?.length || 0,
          activeConnections: connectionMetrics?.filter(conn => conn.isActive).length,
          avgQueryCount: connectionMetrics.reduce((sum: any, conn: any) => sum + conn.queryCount, 0) / connectionMetrics?.length || 0,
          avgQueryTime: connectionMetrics.reduce((sum: any, conn: any) => sum + conn.totalQueryTime / conn.queryCount, 0) / connectionMetrics?.length || 0,
          totalMemoryUsage: connectionMetrics.reduce((sum: any, conn: any) => sum + conn.memoryUsage, 0),
        }
      }
    });
  } catch (error) {
    logger.error(`Failed to get connection metrics for ${req?.params?.database}:`, error as string);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve connection metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/database/optimize/:database
 * Trigger optimization for a specific database
 */
router.post('/optimize/:database', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { database } = req.params;
    
    if (database !== 'main' && database !== 'walmart') {
      return res.status(400).json({
        success: false,
        error: 'Invalid database name. Must be "main" or "walmart"'
      });
    }
    
    const startTime = Date.now();
    
    // Run ANALYZE and optimization
    await databaseManager.execute(database as 'main' | 'walmart', (db: any) => {
      db.pragma('optimize');
      db.prepare('ANALYZE').run();
      return true;
    });
    
    const optimizationTime = Date.now() - startTime;
    
    logger.info(`Database optimization completed for ${database} in ${optimizationTime}ms`);
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        database,
        optimizationTime,
        message: `Database ${database} optimization completed successfully`
      }
    });
  } catch (error) {
    logger.error(`Failed to optimize database ${req?.params?.database}:`, error as string);
    return res.status(500).json({
      success: false,
      error: 'Database optimization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/database/checkpoint/:database
 * Trigger WAL checkpoint for a specific database
 */
router.post('/checkpoint/:database', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { database } = req.params;
    
    if (database !== 'main' && database !== 'walmart') {
      return res.status(400).json({
        success: false,
        error: 'Invalid database name. Must be "main" or "walmart"'
      });
    }
    
    const checkpointInfo = await databaseManager.execute(database as 'main' | 'walmart', (db: any) => {
      const info = db.prepare('PRAGMA wal_checkpoint(RESTART)').get() as any;
      return {
        totalPages: info ? info[0] : 0,
        pagesCheckpointed: info ? info[1] : 0,
        pagesInWal: info ? info[2] : 0
      };
    });
    
    logger.info(`WAL checkpoint completed for ${database}:`, JSON.stringify(checkpointInfo));
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        database,
        checkpointInfo,
        message: `WAL checkpoint completed for database ${database}`
      }
    });
  } catch (error) {
    logger.error(`Failed to checkpoint database ${req?.params?.database}:`, error as string);
    return res.status(500).json({
      success: false,
      error: 'Database checkpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/database/query-performance/:database
 * Get query performance statistics for a specific database
 */
router.get('/query-performance/:database', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { database } = req.params;
    
    if (database !== 'main' && database !== 'walmart') {
      return res.status(400).json({
        success: false,
        error: 'Invalid database name. Must be "main" or "walmart"'
      });
    }
    
    const pool = databaseManager.getPool(database as 'main' | 'walmart');
    const metrics = pool.getMetrics();
    const connectionMetrics = pool.getConnectionMetrics();
    
    // Calculate performance statistics
    const totalQueries = connectionMetrics.reduce((sum: any, conn: any) => sum + conn.queryCount, 0);
    const totalQueryTime = connectionMetrics.reduce((sum: any, conn: any) => sum + conn.totalQueryTime, 0);
    const avgQueryTime = totalQueries > 0 ? totalQueryTime / totalQueries : 0;
    
    const performanceStats = {
      database,
      totalQueries,
      totalQueryTime,
      avgQueryTime,
      queriesPerSecond: totalQueries / (metrics.uptime / 1000),
      errors: metrics.errors,
      errorRate: totalQueries > 0 ? (metrics.errors / totalQueries) * 100 : 0,
      connectionStats: {
        totalConnections: metrics.totalConnections,
        activeConnections: metrics.activeConnections,
        idleConnections: metrics.idleConnections,
        availableConnections: metrics.availableConnections,
        recycledConnections: metrics.recycledConnections,
      },
      memoryStats: {
        totalMemoryUsage: metrics.totalMemoryUsage,
        avgMemoryPerConnection: connectionMetrics?.length || 0 > 0 ? 
          connectionMetrics.reduce((sum: any, conn: any) => sum + conn.memoryUsage, 0) / connectionMetrics?.length || 0 : 0,
      },
      walStats: {
        checkpoints: metrics.checkpoints,
      }
    };
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: performanceStats
    });
  } catch (error) {
    logger.error(`Failed to get query performance for ${req?.params?.database}:`, error as string);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve query performance statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/database/status
 * Get overall database system status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const metrics = databaseManager.getAllMetrics();
    const healthStatus = await databaseManager.getHealthStatus();
    
    const systemStatus = {
      timestamp: new Date().toISOString(),
      healthy: Object.values(healthStatus).every(status => status.healthy),
      databases: Object.keys(metrics).length,
      totalConnections: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.totalConnections, 0),
      totalActiveConnections: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.activeConnections, 0),
      totalQueries: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.totalQueries, 0),
      totalErrors: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.errors, 0),
      totalMemoryUsage: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.totalMemoryUsage, 0),
      avgQueryTime: Object.values(metrics).reduce((sum: any, pool: any) => sum + pool.avgQueryTime, 0) / Object.keys(metrics).length,
      uptime: Math.max(...Object.values(metrics).map(pool => pool.uptime)),
      databases_detail: Object.fromEntries(
        Object.entries(metrics).map(([name, poolMetrics]) => [
          name,
          {
            healthy: healthStatus[name]?.healthy || false,
            connections: poolMetrics.totalConnections,
            queries: poolMetrics.totalQueries,
            avgQueryTime: poolMetrics.avgQueryTime,
            errors: poolMetrics.errors,
            memoryUsage: poolMetrics.totalMemoryUsage,
          }
        ])
      )
    };
    
    res.json({
      success: true,
      data: systemStatus
    });
  } catch (error) {
    logger.error('Failed to get database system status:', error as string);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database system status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;