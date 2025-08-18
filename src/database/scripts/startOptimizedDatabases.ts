#!/usr/bin/env tsx

/**
 * Optimized Database Startup Script
 * Initializes the unified database connection manager with performance monitoring
 */

import { getUnifiedConnectionManager, createDefaultConfig } from "../UnifiedConnectionManager.js";
import { logger } from "../../utils/logger.js";
import appConfig from "../../config/app.config.js";

async function startOptimizedDatabases() {
  try {
    logger.info("Starting optimized database systems...", "DB_STARTUP");

    // Create optimized configuration
    const config = createDefaultConfig();
    
    // Override with app-specific paths
    if (config.main) {
      config.main.path = appConfig?.database?.path || config.main.path;
    }
    if (config.walmart) {
      config.walmart.path = process.env.WALMART_DB_PATH || "./data/walmart_grocery.db";
    }

    // Production optimizations
    if (process.env.NODE_ENV === 'production') {
      // Production settings for higher throughput
      if (config.main) {
        config.main.maxConnections = 30;
        config.main.cacheSize = 30000;
        config.main.memoryMap = 1073741824; // 1GB
        config.main.idleTimeout = 300000; // 5 minutes
      }
      
      if (config.walmart) {
        config.walmart.maxConnections = 25;
        config.walmart.minConnections = 5;
        config.walmart.cacheSize = 25000;
        config.walmart.idleTimeout = 300000; // 5 minutes
      }
    } else {
      // Development settings for faster iteration
      if (config.main) {
        config.main.maxConnections = 10;
        config.main.idleTimeout = 30000; // 30 seconds
      }
      if (config.walmart) {
        config.walmart.maxConnections = 8;
        config.walmart.minConnections = 2;
        config.walmart.idleTimeout = 60000; // 1 minute
      }
    }

    // Initialize unified connection manager
    const unifiedDb = getUnifiedConnectionManager(config);
    await unifiedDb.initialize();

    // Perform initial health check
    const health = await unifiedDb.healthCheck();
    if (!health.overall) {
      throw new Error(`Database health check failed: ${JSON.stringify(health)}`);
    }

    logger.info("Database health check passed", "DB_STARTUP", {
      main: health?.main?.healthy,
      walmart: health?.walmart.healthy,
    });

    // Get initial metrics
    const metrics = await unifiedDb.getMetrics();
    logger.info("Database metrics baseline", "DB_STARTUP", {
      main: {
        connections: metrics?.main?.totalConnections,
        maxConnections: config?.main?.maxConnections,
      },
      walmart: {
        connections: metrics?.walmart.totalConnections,
        maxConnections: config?.walmart.maxConnections,
        minConnections: config?.walmart.minConnections,
      },
    });

    // Start performance monitoring
    const monitoringInterval = unifiedDb.startMonitoring(
      process.env.NODE_ENV === 'production' ? 5 : 10 // minutes
    );

    // Optimize databases for better performance
    await unifiedDb.optimize();
    logger.info("Database optimization completed", "DB_STARTUP");

    // Set up graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down database systems...`, "DB_STARTUP");
      
      try {
        // Stop monitoring
        clearInterval(monitoringInterval);
        
        // Get final metrics
        const finalMetrics = await unifiedDb.getMetrics();
        logger.info("Final database metrics", "DB_STARTUP", {
          totalQueries: finalMetrics?.main?.totalQueries + finalMetrics?.walmart.totalQueries,
          avgQueryTime: (finalMetrics?.main?.avgQueryTime + finalMetrics?.walmart.avgQueryTime) / 2,
          uptime: process.uptime(),
        });

        // Graceful shutdown
        await unifiedDb.shutdown();
        logger.info("Database systems shut down successfully", "DB_STARTUP");
        
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error}`, "DB_STARTUP");
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: any) => {
      logger.error(`Uncaught exception: ${error}`, "DB_STARTUP");
      try {
        await unifiedDb.shutdown();
      } catch (shutdownError) {
        logger.error(`Shutdown error: ${shutdownError}`, "DB_STARTUP");
      }
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`, "DB_STARTUP");
      try {
        await unifiedDb.shutdown();
      } catch (shutdownError) {
        logger.error(`Shutdown error: ${shutdownError}`, "DB_STARTUP");
      }
      process.exit(1);
    });

    logger.info("Optimized database systems started successfully", "DB_STARTUP", {
      environment: process.env.NODE_ENV || 'development',
      mainDb: config?.main?.path,
      walmartDb: config?.walmart.path,
      monitoring: true,
    });

    return unifiedDb;

  } catch (error) {
    logger.error(`Failed to start database systems: ${error}`, "DB_STARTUP");
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startOptimizedDatabases().catch((error: any) => {
    console.error("Database startup failed:", error);
    process.exit(1);
  });
}

export { startOptimizedDatabases };