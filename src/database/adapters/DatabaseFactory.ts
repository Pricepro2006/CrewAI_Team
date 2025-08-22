/**
 * Database Factory for runtime database type selection
 * Allows switching between SQLite and PostgreSQL based on configuration
 */

import { IDatabaseAdapter, DatabaseConfig, SQLiteConfig, PostgreSQLConfig } from './DatabaseAdapter.interface.js';
import { PostgreSQLConnectionManager } from './PostgreSQLConnectionManager.js';
import { SQLiteAdapter } from './SQLiteAdapter.js';
import { DatabaseAdapterError } from './types.js';
import { Logger } from '../../utils/logger.js';
import appConfig from '../../config/app.config.js';

const logger = new Logger('DatabaseFactory');

export class DatabaseFactory {
  private static instances = new Map<string, IDatabaseAdapter>();
  
  /**
   * Create or retrieve a database adapter instance
   * @param config Database configuration
   * @param instanceKey Optional key for managing multiple instances
   */
  static async create(
    config: DatabaseConfig,
    instanceKey = 'default'
  ): Promise<IDatabaseAdapter> {
    // Check for existing instance
    const existingInstance = this.instances.get(instanceKey);
    if (existingInstance) {
      logger.debug(`Returning existing database adapter instance: ${instanceKey}`);
      return existingInstance;
    }

    logger.info(`Creating new database adapter: type=${config.type}, key=${instanceKey}`);
    
    let adapter: IDatabaseAdapter;
    
    switch (config.type) {
      case 'postgresql':
        if (!config.postgresql) {
          throw new DatabaseAdapterError(
            'PostgreSQL configuration is required when type is postgresql',
            'CONFIG_ERROR'
          );
        }
        adapter = new PostgreSQLConnectionManager(config.postgresql);
        break;
        
      case 'sqlite':
        if (!config.sqlite) {
          throw new DatabaseAdapterError(
            'SQLite configuration is required when type is sqlite',
            'CONFIG_ERROR'
          );
        }
        adapter = new SQLiteAdapter(config.sqlite);
        break;
        
      default:
        throw new DatabaseAdapterError(
          `Unsupported database type: ${config.type}`,
          'UNSUPPORTED_TYPE'
        );
    }
    
    // Initialize the adapter
    if (adapter.initialize) {
      await adapter.initialize();
    }
    
    // Store the instance
    this.instances.set(instanceKey, adapter);
    
    // Set up cleanup on process exit
    this.setupCleanup(instanceKey);
    
    return adapter;
  }
  
  /**
   * Create database configuration from environment variables
   */
  static createConfigFromEnv(): DatabaseConfig {
    const databaseType = process.env.DATABASE_TYPE || 'sqlite';
    
    if (databaseType === 'postgresql') {
      return {
        type: 'postgresql',
        postgresql: {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
          database: process.env.POSTGRES_DB || 'crewai_team',
          user: process.env.POSTGRES_USER || 'crewai_user',
          password: process.env.POSTGRES_PASSWORD || '',
          ssl: process.env.POSTGRES_SSL === 'true',
          maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
          minConnections: parseInt(process.env.POSTGRES_MIN_CONNECTIONS || '2', 10),
          idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
          connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '5000', 10),
          applicationName: 'CrewAI-Team'
        }
      };
    }
    
    // Default to SQLite
    return {
      type: 'sqlite',
      sqlite: {
        databasePath: process.env.SQLITE_DATABASE_PATH || appConfig.database.path,
        maxConnections: parseInt(process.env.SQLITE_MAX_CONNECTIONS || '10', 10),
        enableWAL: process.env.SQLITE_ENABLE_WAL !== 'false',
        enableForeignKeys: process.env.SQLITE_ENABLE_FOREIGN_KEYS !== 'false',
        cacheSize: parseInt(process.env.SQLITE_CACHE_SIZE || '10000', 10),
        busyTimeout: parseInt(process.env.SQLITE_BUSY_TIMEOUT || '5000', 10),
        memoryMap: parseInt(process.env.SQLITE_MEMORY_MAP || '268435456', 10), // 256MB
        readonly: process.env.SQLITE_READONLY === 'true'
      }
    };
  }
  
  /**
   * Get an existing adapter instance
   */
  static get(instanceKey = 'default'): IDatabaseAdapter | undefined {
    return this.instances.get(instanceKey);
  }
  
  /**
   * Close and remove a specific adapter instance
   */
  static async close(instanceKey = 'default'): Promise<void> {
    const adapter = this.instances.get(instanceKey);
    if (adapter) {
      logger.info(`Closing database adapter: ${instanceKey}`);
      await adapter.close();
      this.instances.delete(instanceKey);
    }
  }
  
  /**
   * Close all adapter instances
   */
  static async closeAll(): Promise<void> {
    logger.info('Closing all database adapters');
    const closePromises: Promise<void>[] = [];
    
    for (const [key, adapter] of this.instances) {
      logger.debug(`Closing adapter: ${key}`);
      closePromises.push(adapter.close());
    }
    
    await Promise.all(closePromises);
    this.instances.clear();
  }
  
  /**
   * Get health status of all adapters
   */
  static async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [key, adapter] of this.instances) {
      try {
        const health = await adapter.healthCheck();
        results.set(key, health.healthy);
      } catch (error) {
        logger.error(`Health check failed for ${key}:`, error);
        results.set(key, false);
      }
    }
    
    return results;
  }
  
  /**
   * Get metrics from all adapters
   */
  static getMetricsAll(): Map<string, any> {
    const metrics = new Map<string, any>();
    
    for (const [key, adapter] of this.instances) {
      metrics.set(key, adapter.getMetrics());
    }
    
    return metrics;
  }
  
  /**
   * Setup cleanup handlers for graceful shutdown
   */
  private static setupCleanup(instanceKey: string): void {
    const cleanup = async (): Promise<void> => {
      await this.close(instanceKey);
    };
    
    // Handle various shutdown signals
    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('SIGUSR2', cleanup); // For nodemon restarts
  }
  
  /**
   * Determine the best database type based on operation
   */
  static determineBestDatabase(operation: 'read' | 'write' | 'bulk'): 'sqlite' | 'postgresql' {
    const currentType = process.env.DATABASE_TYPE || 'sqlite';
    
    // If PostgreSQL is configured and available, use it for writes and bulk operations
    if (currentType === 'postgresql' && (operation === 'write' || operation === 'bulk')) {
      return 'postgresql';
    }
    
    // For reads, SQLite might be faster if data is local
    if (operation === 'read' && process.env.PREFER_SQLITE_FOR_READS === 'true') {
      return 'sqlite';
    }
    
    return currentType as 'sqlite' | 'postgresql';
  }
}