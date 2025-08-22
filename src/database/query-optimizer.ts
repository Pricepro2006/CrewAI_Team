/**
 * Query Optimizer Module
 * Provides singleton access to OptimizedQueryExecutor for database performance
 */

import { OptimizedQueryExecutor, type QueryStats } from './OptimizedQueryExecutor.js';
import { logger } from '../utils/logger.js';
import appConfig from '../config/app.config.js';

// Singleton instance
let queryExecutorInstance: OptimizedQueryExecutor | null = null;

/**
 * Get the singleton OptimizedQueryExecutor instance
 * Ensures all database queries share the same cache and optimizations
 */
export function getOptimizedQueryExecutor(): OptimizedQueryExecutor {
  if (!queryExecutorInstance) {
    const dbPath = appConfig.database.path || './data/crewai.db';
    queryExecutorInstance = new OptimizedQueryExecutor(dbPath);
    
    logger.info('Created singleton OptimizedQueryExecutor', 'DATABASE', {
      dbPath,
      cacheEnabled: true,
      indexesCreated: true
    });
    
    // Log performance stats periodically
    setInterval(() => {
      const stats = queryExecutorInstance!.getStats();
      const cacheHitRatio = queryExecutorInstance!.getCacheHitRatio();
      
      if (stats.totalQueries > 0) {
        logger.debug('Query performance stats', 'DATABASE', {
          totalQueries: stats.totalQueries,
          cacheHitRatio: `${cacheHitRatio.toFixed(1)}%`,
          avgExecutionTime: `${stats.avgExecutionTime.toFixed(2)}ms`,
          slowQueries: stats.slowQueries.length
        });
      }
    }, 60000); // Every minute
  }
  
  return queryExecutorInstance;
}

/**
 * Execute a query using the optimized executor
 * Convenience function for quick query execution
 */
export async function executeOptimizedQuery<T = any>(
  sql: string, 
  params?: any[]
): Promise<T> {
  const executor = getOptimizedQueryExecutor();
  return executor.execute<T>(sql, params);
}

/**
 * Get database performance statistics
 */
export function getDatabaseStats(): {
  queryStats: QueryStats;
  cacheHitRatio: number;
} {
  const executor = getOptimizedQueryExecutor();
  return {
    queryStats: executor.getStats(),
    cacheHitRatio: executor.getCacheHitRatio()
  };
}

/**
 * Clear query cache (useful for testing or after bulk updates)
 */
export function clearQueryCache(): void {
  const executor = getOptimizedQueryExecutor();
  executor.clearCache();
  logger.info('Query cache cleared', 'DATABASE');
}

// Cleanup on process exit
process.on('exit', () => {
  if (queryExecutorInstance) {
    queryExecutorInstance.close();
    logger.info('Database connections closed', 'DATABASE');
  }
});

process.on('SIGINT', () => {
  if (queryExecutorInstance) {
    queryExecutorInstance.close();
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  if (queryExecutorInstance) {
    queryExecutorInstance.close();
    process.exit(0);
  }
});