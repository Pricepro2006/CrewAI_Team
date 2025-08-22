/**
 * Unified Database Connection Manager V2
 * Uses database adapters for PostgreSQL/SQLite abstraction
 * Provides seamless switching between database types
 */

import { IDatabaseAdapter, DatabaseConfig } from './adapters/DatabaseAdapter.interface.js';
import { DatabaseFactory } from './adapters/DatabaseFactory.js';
import { SqlValue, SqlParams, ExecuteResult, HealthCheckResult } from './adapters/types.js';
import { Logger } from '../utils/logger.js';
import appConfig from '../config/app.config.js';

const logger = new Logger('UnifiedConnectionManagerV2');

export interface UnifiedConnectionConfigV2 {
  main: DatabaseConfig;
  walmart: DatabaseConfig;
  enableMetrics?: boolean;
  enableHealthChecks?: boolean;
  healthCheckInterval?: number; // milliseconds
}

export interface UnifiedMetrics {
  main: {
    healthy: boolean;
    metrics: any;
  };
  walmart: {
    healthy: boolean;
    metrics: any;
  };
  lastHealthCheck: Date;
}

export class UnifiedConnectionManagerV2 {
  private static instance: UnifiedConnectionManagerV2;
  private mainAdapter: IDatabaseAdapter | null = null;
  private walmartAdapter: IDatabaseAdapter | null = null;
  private config: UnifiedConnectionConfigV2;
  private isInitialized = false;
  private healthCheckTimer?: NodeJS.Timeout;

  private constructor(config: UnifiedConnectionConfigV2) {
    this.config = config;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: UnifiedConnectionConfigV2): UnifiedConnectionManagerV2 {
    if (!UnifiedConnectionManagerV2.instance) {
      if (!config) {
        config = UnifiedConnectionManagerV2.createDefaultConfig();
      }
      UnifiedConnectionManagerV2.instance = new UnifiedConnectionManagerV2(config);
    }
    return UnifiedConnectionManagerV2.instance;
  }

  /**
   * Create default configuration from environment
   */
  static createDefaultConfig(): UnifiedConnectionConfigV2 {
    const databaseType = process.env.DATABASE_TYPE || 'sqlite';
    
    if (databaseType === 'postgresql') {
      return {
        main: {
          type: 'postgresql',
          postgresql: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
            database: process.env.POSTGRES_DB || 'crewai_main',
            user: process.env.POSTGRES_USER || 'crewai_user',
            password: process.env.POSTGRES_PASSWORD || '',
            ssl: process.env.POSTGRES_SSL === 'true',
            maxConnections: 20,
            minConnections: 5,
            applicationName: 'CrewAI-Main'
          }
        },
        walmart: {
          type: 'postgresql',
          postgresql: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
            database: process.env.POSTGRES_WALMART_DB || 'crewai_walmart',
            user: process.env.POSTGRES_USER || 'crewai_user',
            password: process.env.POSTGRES_PASSWORD || '',
            ssl: process.env.POSTGRES_SSL === 'true',
            maxConnections: 15,
            minConnections: 3,
            applicationName: 'CrewAI-Walmart'
          }
        },
        enableMetrics: true,
        enableHealthChecks: true,
        healthCheckInterval: 60000 // 1 minute
      };
    }
    
    // Default to SQLite
    return {
      main: {
        type: 'sqlite',
        sqlite: {
          databasePath: process.env.SQLITE_DATABASE_PATH || appConfig.database.path,
          maxConnections: 20,
          enableWAL: true,
          enableForeignKeys: true,
          cacheSize: 20000,
          busyTimeout: 5000,
          memoryMap: 536870912 // 512MB
        }
      },
      walmart: {
        type: 'sqlite',
        sqlite: {
          databasePath: process.env.WALMART_DB_PATH || './data/walmart_grocery.db',
          maxConnections: 15,
          enableWAL: true,
          enableForeignKeys: true,
          cacheSize: 15000,
          busyTimeout: 3000,
          memoryMap: 268435456 // 256MB
        }
      },
      enableMetrics: true,
      enableHealthChecks: true,
      healthCheckInterval: 60000
    };
  }

  /**
   * Initialize database connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('UnifiedConnectionManagerV2 already initialized');
      return;
    }

    try {
      logger.info('Initializing UnifiedConnectionManagerV2');

      // Create main database adapter
      this.mainAdapter = await DatabaseFactory.create(this.config.main, 'main');
      logger.info('Main database adapter initialized', 'MAIN_DB', {
        type: this.config.main.type
      });

      // Create Walmart database adapter
      this.walmartAdapter = await DatabaseFactory.create(this.config.walmart, 'walmart');
      logger.info('Walmart database adapter initialized', 'WALMART_DB', {
        type: this.config.walmart.type
      });

      // Start health checks if enabled
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      this.isInitialized = true;
      logger.info('UnifiedConnectionManagerV2 initialization complete');
    } catch (error) {
      logger.error('Failed to initialize UnifiedConnectionManagerV2', 'INIT_ERROR', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute query on main database
   */
  async executeMainQuery<T = Record<string, SqlValue>>(
    sql: string,
    params?: SqlParams
  ): Promise<T[]> {
    await this.ensureInitialized();
    return this.mainAdapter!.query<T>(sql, params);
  }

  /**
   * Execute query on Walmart database
   */
  async executeWalmartQuery<T = Record<string, SqlValue>>(
    sql: string,
    params?: SqlParams
  ): Promise<T[]> {
    await this.ensureInitialized();
    return this.walmartAdapter!.query<T>(sql, params);
  }

  /**
   * Execute single row query on main database
   */
  async executeMainQueryOne<T = Record<string, SqlValue>>(
    sql: string,
    params?: SqlParams
  ): Promise<T | null> {
    await this.ensureInitialized();
    return this.mainAdapter!.queryOne<T>(sql, params);
  }

  /**
   * Execute single row query on Walmart database
   */
  async executeWalmartQueryOne<T = Record<string, SqlValue>>(
    sql: string,
    params?: SqlParams
  ): Promise<T | null> {
    await this.ensureInitialized();
    return this.walmartAdapter!.queryOne<T>(sql, params);
  }

  /**
   * Execute update/insert/delete on main database
   */
  async executeMainCommand(
    sql: string,
    params?: SqlParams
  ): Promise<ExecuteResult> {
    await this.ensureInitialized();
    return this.mainAdapter!.execute(sql, params);
  }

  /**
   * Execute update/insert/delete on Walmart database
   */
  async executeWalmartCommand(
    sql: string,
    params?: SqlParams
  ): Promise<ExecuteResult> {
    await this.ensureInitialized();
    return this.walmartAdapter!.execute(sql, params);
  }

  /**
   * Execute transaction on main database
   */
  async executeMainTransaction<T>(
    fn: (tx: any) => Promise<T>
  ): Promise<T> {
    await this.ensureInitialized();
    return this.mainAdapter!.transaction(fn);
  }

  /**
   * Execute transaction on Walmart database
   */
  async executeWalmartTransaction<T>(
    fn: (tx: any) => Promise<T>
  ): Promise<T> {
    await this.ensureInitialized();
    return this.walmartAdapter!.transaction(fn);
  }

  /**
   * Get direct access to main adapter (for advanced operations)
   */
  getMainAdapter(): IDatabaseAdapter {
    if (!this.mainAdapter) {
      throw new Error('Main adapter not initialized');
    }
    return this.mainAdapter;
  }

  /**
   * Get direct access to Walmart adapter (for advanced operations)
   */
  getWalmartAdapter(): IDatabaseAdapter {
    if (!this.walmartAdapter) {
      throw new Error('Walmart adapter not initialized');
    }
    return this.walmartAdapter;
  }

  /**
   * Get metrics for both databases
   */
  async getMetrics(): Promise<UnifiedMetrics> {
    await this.ensureInitialized();

    const [mainHealth, walmartHealth] = await Promise.all([
      this.mainAdapter!.healthCheck(),
      this.walmartAdapter!.healthCheck()
    ]);

    return {
      main: {
        healthy: mainHealth.healthy,
        metrics: this.mainAdapter!.getMetrics()
      },
      walmart: {
        healthy: walmartHealth.healthy,
        metrics: this.walmartAdapter!.getMetrics()
      },
      lastHealthCheck: new Date()
    };
  }

  /**
   * Perform health check on both databases
   */
  async healthCheck(): Promise<{
    overall: boolean;
    main: HealthCheckResult;
    walmart: HealthCheckResult;
  }> {
    await this.ensureInitialized();

    const [mainHealth, walmartHealth] = await Promise.all([
      this.mainAdapter!.healthCheck(),
      this.walmartAdapter!.healthCheck()
    ]);

    return {
      overall: mainHealth.healthy && walmartHealth.healthy,
      main: mainHealth,
      walmart: walmartHealth
    };
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (!health.overall) {
          logger.warn('Database health check failed', 'HEALTH_CHECK', {
            main: health.main.healthy,
            walmart: health.walmart.healthy
          });
        }
      } catch (error) {
        logger.error('Health check error', 'HEALTH_CHECK_ERROR', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.config.healthCheckInterval || 60000);
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Ensure manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down UnifiedConnectionManagerV2');

    // Stop health checks
    this.stopHealthChecks();

    // Close database connections
    const closePromises: Promise<void>[] = [];

    if (this.mainAdapter) {
      closePromises.push(this.mainAdapter.close());
    }

    if (this.walmartAdapter) {
      closePromises.push(this.walmartAdapter.close());
    }

    await Promise.all(closePromises);

    this.mainAdapter = null;
    this.walmartAdapter = null;
    this.isInitialized = false;

    logger.info('UnifiedConnectionManagerV2 shutdown complete');
  }

  /**
   * Reset instance (for testing)
   */
  static reset(): void {
    if (UnifiedConnectionManagerV2.instance) {
      UnifiedConnectionManagerV2.instance.shutdown().catch(error => {
        logger.error('Error during reset shutdown', 'RESET_ERROR', { error });
      });
      UnifiedConnectionManagerV2.instance = null as any;
    }
  }
}

// Export convenience functions for backward compatibility
export function getUnifiedConnectionManager(
  config?: UnifiedConnectionConfigV2
): UnifiedConnectionManagerV2 {
  return UnifiedConnectionManagerV2.getInstance(config);
}

export function createDefaultConfig(): UnifiedConnectionConfigV2 {
  return UnifiedConnectionManagerV2.createDefaultConfig();
}