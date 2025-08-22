/**
 * Unified Database Connection Manager
 * Standardizes all database connections across CrewAI Team system
 * Provides consistent pooling for both main and Walmart databases
 */

import { DatabaseConnectionPool } from "./ConnectionPool.js";
import { OptimizedConnectionPool } from "./OptimizedConnectionPool.js";
import { DatabaseManager } from "./DatabaseManager.js";
import { OptimizedWalmartDatabaseManager } from "./OptimizedWalmartDatabaseManager.js";
import { logger } from "../utils/logger.js";
import type { Database as DatabaseType } from "better-sqlite3";

export interface UnifiedConnectionConfig {
  main: {
    path: string;
    maxConnections?: number;
    connectionTimeout?: number;
    idleTimeout?: number;
    enableWAL?: boolean;
    enableForeignKeys?: boolean;
    cacheSize?: number;
    memoryMap?: number;
    busyTimeout?: number;
  };
  walmart: {
    path: string;
    maxConnections?: number;
    minConnections?: number;
    connectionTimeout?: number;
    idleTimeout?: number;
    enableWAL?: boolean;
    enableForeignKeys?: boolean;
    cacheSize?: number;
    memoryMap?: number;
    busyTimeout?: number;
  };
}

export interface ConnectionPoolMetrics {
  main: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    totalQueries: number;
    avgQueryTime: number;
    memoryUsage: number;
  };
  walmart: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingQueries: number;
    totalQueries: number;
    avgQueryTime: number;
    slowQueries: number;
    errors: number;
  };
}

export class UnifiedConnectionManager {
  private static instance: UnifiedConnectionManager;
  private mainDbManager: DatabaseManager;
  private walmartDbManager: OptimizedWalmartDatabaseManager;
  private isInitialized: boolean = false;

  private constructor(config: UnifiedConnectionConfig) {
    // Initialize main database manager with optimized pooling
    this.mainDbManager = new DatabaseManager({
      sqlite: {
        path: config?.main?.path,
        maxConnections: config?.main?.maxConnections || 20,
        connectionTimeout: config?.main?.connectionTimeout || 10000,
        idleTimeout: config?.main?.idleTimeout || 60000,
        enableWAL: config?.main?.enableWAL !== false,
        enableForeignKeys: config?.main?.enableForeignKeys !== false,
        cacheSize: config?.main?.cacheSize || 20000,
        memoryMap: config?.main?.memoryMap || 536870912,
        busyTimeout: config?.main?.busyTimeout || 5000,
      },
    });

    // Initialize optimized Walmart database manager
    this.walmartDbManager = OptimizedWalmartDatabaseManager.getInstance({
      sqlite: {
        path: config?.walmart.path,
        maxConnections: config?.walmart.maxConnections || 15,
        minConnections: config?.walmart.minConnections || 3,
        connectionTimeout: config?.walmart.connectionTimeout || 5000,
        idleTimeout: config?.walmart.idleTimeout || 120000,
        enableWAL: config?.walmart.enableWAL !== false,
        enableForeignKeys: config?.walmart.enableForeignKeys !== false,
        cacheSize: config?.walmart.cacheSize || 15000,
        memoryMap: config?.walmart.memoryMap || 268435456,
        busyTimeout: config?.walmart.busyTimeout || 3000,
      },
    });

    logger.info("Unified Connection Manager initialized", "UNIFIED_DB", {
      mainDb: config?.main?.path,
      walmartDb: config?.walmart.path,
    });
  }

  /**
   * Get singleton instance with configuration
   */
  static getInstance(config?: UnifiedConnectionConfig): UnifiedConnectionManager {
    if (!UnifiedConnectionManager.instance) {
      if (!config) {
        throw new Error("Configuration required for first initialization");
      }
      UnifiedConnectionManager.instance = new UnifiedConnectionManager(config);
    }
    return UnifiedConnectionManager.instance;
  }

  /**
   * Initialize both database systems
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Unified Connection Manager already initialized", "UNIFIED_DB");
      return;
    }

    try {
      logger.info("Initializing unified database systems...", "UNIFIED_DB");

      // Initialize main database system
      await this.mainDbManager.initialize();

      // Initialize Walmart database system
      await this.walmartDbManager.initialize();

      this.isInitialized = true;
      logger.info("All database systems initialized successfully", "UNIFIED_DB");
    } catch (error) {
      logger.error(`Unified database initialization failed: ${error}`, "UNIFIED_DB");
      throw error;
    }
  }

  /**
   * Get main database manager (emails, deals, etc.)
   */
  getMainDatabase(): DatabaseManager {
    return this.mainDbManager;
  }

  /**
   * Get Walmart database manager (grocery, products, etc.)
   */
  getWalmartDatabase(): OptimizedWalmartDatabaseManager {
    return this.walmartDbManager;
  }

  /**
   * Execute query on main database with connection pooling
   */
  async executeMainQuery<T>(queryFn: (db: DatabaseType) => T): Promise<T> {
    return this.mainDbManager.executeQuery(queryFn);
  }

  /**
   * Execute transaction on main database
   */
  async executeMainTransaction<T>(transactionFn: (db: DatabaseType) => Promise<T>): Promise<T> {
    return this.mainDbManager.transaction(transactionFn);
  }

  /**
   * Execute query on Walmart database with connection pooling
   */
  async executeWalmartQuery<T>(query: string, params: any[] = []): Promise<T> {
    return this.walmartDbManager.executeQuery<T>(query, params);
  }

  /**
   * Execute transaction on Walmart database
   */
  async executeWalmartTransaction<T>(callback: (db: any) => T): Promise<T> {
    return this.walmartDbManager.executeTransaction<T>(callback);
  }

  /**
   * Get comprehensive metrics for all database systems
   */
  async getMetrics(): Promise<ConnectionPoolMetrics> {
    const mainStats = this.mainDbManager.getConnectionPool().getStats();
    const walmartMetrics = this.walmartDbManager.getMetrics();

    return {
      main: {
        totalConnections: mainStats.totalConnections,
        activeConnections: mainStats.activeConnections,
        idleConnections: mainStats.idleConnections,
        totalQueries: mainStats.totalQueries,
        avgQueryTime: mainStats.avgQueryTime,
        memoryUsage: mainStats.memoryUsage,
      },
      walmart: {
        totalConnections: walmartMetrics.totalConnections,
        activeConnections: walmartMetrics.activeConnections,
        idleConnections: walmartMetrics.idleConnections,
        waitingQueries: walmartMetrics.waitingQueries,
        totalQueries: walmartMetrics.totalQueries,
        avgQueryTime: walmartMetrics.avgQueryTime,
        slowQueries: walmartMetrics.slowQueries,
        errors: walmartMetrics.errors,
      },
    };
  }

  /**
   * Health check for all database systems
   */
  async healthCheck(): Promise<{
    overall: boolean;
    main: {
      healthy: boolean;
      sqlite: any;
      chromadb: any;
    };
    walmart: {
      healthy: boolean;
      poolMetrics: any;
      connectionInfo: any[];
      errors: string[];
    };
  }> {
    try {
      const [mainHealth, walmartHealth] = await Promise.all([
        this.mainDbManager.healthCheck(),
        this.walmartDbManager.healthCheck(),
      ]);

      const overall = mainHealth.overall && walmartHealth.healthy;

      return {
        overall,
        main: {
          healthy: mainHealth.overall,
          sqlite: mainHealth.sqlite,
          chromadb: mainHealth.chromadb,
        },
        walmart: walmartHealth,
      };
    } catch (error) {
      logger.error(`Health check failed: ${error}`, "UNIFIED_DB");
      return {
        overall: false,
        main: {
          healthy: false,
          sqlite: { connected: false, writable: false, integrity: false },
          chromadb: { connected: false, collections: 0 },
        },
        walmart: {
          healthy: false,
          poolMetrics: {},
          connectionInfo: [],
          errors: [`Health check error: ${error}`],
        },
      };
    }
  }

  /**
   * Get database statistics for monitoring
   */
  async getStatistics(): Promise<{
    main: any;
    walmart: any;
    combined: {
      totalConnections: number;
      totalQueries: number;
      avgQueryTime: number;
      memoryUsage: number;
    };
  }> {
    const [mainStats, metrics] = await Promise.all([
      this.mainDbManager.getStatistics(),
      this.getMetrics(),
    ]);

    const combined = {
      totalConnections: metrics.main.totalConnections + metrics.walmart.totalConnections,
      totalQueries: metrics.main.totalQueries + metrics.walmart.totalQueries,
      avgQueryTime: (metrics.main.avgQueryTime + metrics.walmart.avgQueryTime) / 2,
      memoryUsage: metrics.main.memoryUsage, // Main DB memory usage (Walmart uses separate tracking)
    };

    return {
      main: mainStats,
      walmart: {
        metrics: metrics.walmart,
        connectionInfo: this.walmartDbManager.getConnectionInfo(),
      },
      combined,
    };
  }

  /**
   * Optimize all databases
   */
  async optimize(): Promise<void> {
    try {
      logger.info("Optimizing all databases...", "UNIFIED_DB");

      // Optimize main database (run through connection pool)
      await this.executeMainQuery((db: any) => {
        db.exec("ANALYZE");
        db.pragma("optimize");
        return true;
      });

      // Optimize Walmart database
      await this.walmartDbManager.getConnectionPool().optimizeDatabase();

      logger.info("Database optimization completed", "UNIFIED_DB");
    } catch (error) {
      logger.error(`Database optimization failed: ${error}`, "UNIFIED_DB");
      throw error;
    }
  }

  /**
   * Graceful shutdown of all database systems
   */
  async shutdown(): Promise<void> {
    try {
      logger.info("Shutting down all database systems...", "UNIFIED_DB");

      // Shutdown both database managers
      await Promise.all([
        this.mainDbManager.close(),
        this.walmartDbManager.close(),
      ]);

      this.isInitialized = false;
      logger.info("All database systems shut down successfully", "UNIFIED_DB");
    } catch (error) {
      logger.error(`Database shutdown failed: ${error}`, "UNIFIED_DB");
      throw error;
    }
  }

  /**
   * Monitor connection pools with periodic reporting
   */
  startMonitoring(intervalMinutes: number = 5): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        const health = await this.healthCheck();

        logger.info(
          "Unified Database Pool Status",
          "UNIFIED_DB",
          {
            overall: health.overall,
            main: {
              connections: `${metrics?.main?.activeConnections}/${metrics?.main?.totalConnections}`,
              queries: metrics?.main?.totalQueries,
              avgTime: `${Math.round(metrics?.main?.avgQueryTime)}ms`,
              memory: `${Math.round(metrics?.main?.memoryUsage / 1024 / 1024)}MB`,
            },
            walmart: {
              connections: `${metrics?.walmart.activeConnections}/${metrics?.walmart.totalConnections}`,
              queries: metrics?.walmart.totalQueries,
              avgTime: `${Math.round(metrics?.walmart.avgQueryTime)}ms`,
              waiting: metrics?.walmart.waitingQueries,
              errors: metrics?.walmart.errors,
              slowQueries: metrics?.walmart.slowQueries,
            },
          }
        );
      } catch (error) {
        logger.error(`Monitoring update failed: ${error}`, "UNIFIED_DB");
      }
    }, intervalMinutes * 60 * 1000);
  }
}

// Default configuration factory
export function createDefaultConfig(): UnifiedConnectionConfig {
  return {
    main: {
      path: "./data/crewai_team.db",
      maxConnections: 20,
      connectionTimeout: 10000,
      idleTimeout: 60000,
      enableWAL: true,
      enableForeignKeys: true,
      cacheSize: 20000,
      memoryMap: 536870912, // 512MB
      busyTimeout: 5000,
    },
    walmart: {
      path: "./data/walmart_grocery.db",
      maxConnections: 15,
      minConnections: 3,
      connectionTimeout: 5000,
      idleTimeout: 120000,
      enableWAL: true,
      enableForeignKeys: true,
      cacheSize: 15000,
      memoryMap: 268435456, // 256MB
      busyTimeout: 3000,
    },
  };
}

// Export singleton getter with default config
export function getUnifiedConnectionManager(config?: UnifiedConnectionConfig): UnifiedConnectionManager {
  return UnifiedConnectionManager.getInstance(config || createDefaultConfig());
}