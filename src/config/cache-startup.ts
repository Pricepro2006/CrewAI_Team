/**
 * Cache System Startup Configuration
 * 
 * This file should be imported and executed during application startup
 * to initialize the comprehensive Redis caching layer.
 */

import { 
  initializeCaching, 
  cacheMonitor, 
  executeCacheWarmingStrategy,
  monitorCacheHealth,
  shutdownCaching 
} from '../core/cache/index.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../api/monitoring/metrics.js';

/**
 * Initialize the caching system during application startup
 */
export async function startupCacheSystem(): Promise<void> {
  try {
    logger.info('Starting cache system initialization', 'CACHE_STARTUP');

    // Initialize core caching services
    await initializeCaching();

    // Set up cache warming jobs
    await setupCacheWarmingSchedule();

    // Set up health monitoring
    await setupHealthMonitoring();

    // Register shutdown handlers
    setupShutdownHandlers();

    logger.info('Cache system startup completed successfully', 'CACHE_STARTUP');
    metrics.increment('cache_startup.success');

  } catch (error) {
    logger.error('Cache system startup failed', 'CACHE_STARTUP', {
      error: error instanceof Error ? error.message : String(error),
    });
    metrics.increment('cache_startup.error');
    throw error;
  }
}

/**
 * Set up cache warming schedule
 */
async function setupCacheWarmingSchedule(): Promise<void> {
  try {
    // Register custom warming jobs
    cacheMonitor.registerWarmingJob({
      id: 'startup_cache_warming',
      name: 'Startup Cache Warming',
      priority: 100,
      schedule: '0 0 * * *', // Daily at midnight
      handler: async () => {
        return await warmCacheOnStartup();
      },
    });

    // Execute initial cache warming
    setTimeout(async () => {
      try {
        await executeCacheWarmingStrategy();
        logger.info('Initial cache warming completed', 'CACHE_STARTUP');
      } catch (error) {
        logger.error('Initial cache warming failed', 'CACHE_STARTUP', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 30000); // Wait 30 seconds after startup

    logger.info('Cache warming schedule set up', 'CACHE_STARTUP');

  } catch (error) {
    logger.error('Failed to set up cache warming schedule', 'CACHE_STARTUP', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Set up health monitoring with alerts
 */
async function setupHealthMonitoring(): Promise<void> {
  try {
    // Set up periodic health checks
    setInterval(async () => {
      try {
        await monitorCacheHealth();
      } catch (error) {
        logger.error('Periodic cache health check failed', 'CACHE_STARTUP', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 300000); // Every 5 minutes

    // Set up alert handling
    cacheMonitor.on('alert:created', (alert: any) => {
      // Log the alert
      logger.warn('Cache alert triggered', 'CACHE_STARTUP', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
      });

      // Report to metrics
      metrics.increment('cache_alerts.created', 1, { type: alert.type, severity: alert.severity });

      // Handle critical alerts
      if (alert.severity === 'critical') {
        handleCriticalCacheAlert(alert);
      }
    });

    logger.info('Cache health monitoring set up', 'CACHE_STARTUP');

  } catch (error) {
    logger.error('Failed to set up cache health monitoring', 'CACHE_STARTUP', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle critical cache alerts
 */
function handleCriticalCacheAlert(alert: any): void {
  logger.error('CRITICAL CACHE ALERT', 'CACHE_STARTUP', {
    alertId: alert.id,
    message: alert.message,
    metadata: alert.metadata,
  });

  // In production, you might want to:
  // - Send notifications to PagerDuty
  // - Send Slack alerts
  // - Trigger automated recovery procedures
  // - Scale cache resources

  metrics.increment('cache_alerts.critical');
}

/**
 * Warm cache on startup with essential data
 */
async function warmCacheOnStartup(): Promise<number> {
  let totalWarmed = 0;

  try {
    logger.info('Starting startup cache warming', 'CACHE_STARTUP');

    // Execute the main warming strategy
    await executeCacheWarmingStrategy();

    // Additional startup-specific warming could go here
    // For example:
    // - Pre-load frequently accessed user data
    // - Cache common LLM prompts
    // - Pre-populate session data

    logger.info('Startup cache warming completed', 'CACHE_STARTUP', {
      totalWarmed,
    });

    return totalWarmed;

  } catch (error) {
    logger.error('Startup cache warming failed', 'CACHE_STARTUP', {
      error: error instanceof Error ? error.message : String(error),
    });
    return totalWarmed;
  }
}

/**
 * Set up graceful shutdown handlers
 */
function setupShutdownHandlers(): void {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down cache system...`, 'CACHE_STARTUP');
    
    try {
      await shutdownCaching();
      logger.info('Cache system shutdown completed', 'CACHE_STARTUP');
    } catch (error) {
      logger.error('Cache system shutdown failed', 'CACHE_STARTUP', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Handle different shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

  logger.info('Cache shutdown handlers registered', 'CACHE_STARTUP');
}

/**
 * Check if caching system is ready
 */
export async function isCacheSystemReady(): Promise<boolean> {
  try {
    const health = await cacheMonitor.performHealthCheck();
    return health.healthy;
  } catch (error) {
    logger.error('Cache readiness check failed', 'CACHE_STARTUP', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get cache system status for health endpoints
 */
export async function getCacheSystemStatus(): Promise<any> {
  try {
    const health = await cacheMonitor.performHealthCheck();
    const report = await cacheMonitor.generatePerformanceReport();
    
    return {
      status: health.healthy ? 'healthy' : 'unhealthy',
      health,
      report,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Failed to get cache system status', 'CACHE_STARTUP', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date(),
    };
  }
}