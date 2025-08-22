/**
 * Database Module Index
 * Exports all database-related functionality for the CrewAI Team project
 * 
 * Supports both legacy direct database access and new adapter pattern
 * for gradual migration to database-agnostic architecture
 */

// Core Database Manager
export { DatabaseManager, getDatabaseManager } from "./DatabaseManager.js";

// Specialized Database Managers
export { WalmartDatabaseManager, getWalmartDatabaseManager } from "./WalmartDatabaseManager.js";
export { OptimizedWalmartDatabaseManager, getOptimizedWalmartDatabaseManager } from "./OptimizedWalmartDatabaseManager.js";

// Connection Pool Management
export {
  DatabaseConnectionPool,
  getDatabaseConnection,
  executeQuery,
  executeTransaction,
  shutdownConnectionPool,
} from "./ConnectionPool.js";
export { OptimizedConnectionPool, createOptimizedPool } from "./OptimizedConnectionPool.js";

// Optimized Query Executor (Performance Enhancement)
export { OptimizedQueryExecutor } from "./OptimizedQueryExecutor.js";
export { getOptimizedQueryExecutor, executeOptimizedQuery, getDatabaseStats, clearQueryCache } from "./query-optimizer.js";

// ============================================================================
// NEW: Database Adapter Pattern Exports (for gradual migration)
// ============================================================================
export { DatabaseFactory } from "./adapters/DatabaseFactory.js";
export { IDatabaseAdapter } from "./adapters/DatabaseAdapter.interface.js";
export { SQLiteCompatibilityShim, createCompatibilityShim, isCompatibilityShim } from "./adapters/SQLiteCompatibilityShim.js";
export type { 
  DatabaseConfig,
  SQLiteConfig,
  PostgreSQLConfig,
  DatabaseMetrics as AdapterMetrics,
  ITransactionAdapter 
} from "./adapters/DatabaseAdapter.interface.js";
export type {
  SqlValue,
  SqlParams,
  ExecuteResult,
  PreparedStatement,
  TransactionContext,
  HealthCheckResult,
  QueryMetrics,
  ConnectionMetrics,
  DatabaseAdapterError,
  ConnectionError,
  QueryError,
  TransactionError
} from "./adapters/types.js";

// ============================================================================
// Centralized Database Access with Feature Flag Support
// ============================================================================
import { OptimizedQueryExecutor as OptimizedQueryExecutorClass } from './OptimizedQueryExecutor.js';
import { PIIRedactor } from '../utils/PIIRedactor.js';
import { Logger } from '../utils/logger.js';
import { DatabaseFactory } from './adapters/DatabaseFactory.js';
import { SQLiteCompatibilityShim } from './adapters/SQLiteCompatibilityShim.js';
import { IDatabaseAdapter } from './adapters/DatabaseAdapter.interface.js';
import * as path from 'path';
import * as fs from 'fs';
import * as Database from 'better-sqlite3';

const logger = new Logger('DatabaseModule');

// Singleton instances for each database (legacy)
const instances = new Map<string, OptimizedQueryExecutorClass>();

// Singleton instances for adapter pattern
const adapterInstances = new Map<string, IDatabaseAdapter>();

// PII Redactor for security
const piiRedactor = new PIIRedactor({
  redactEmails: true,
  redactPhones: true,
  redactSSN: true,
  redactCreditCards: true,
  redactAPIKeys: true
});

// Feature flag system
const FEATURE_FLAGS = {
  USE_DATABASE_ADAPTER: process.env.USE_DATABASE_ADAPTER === 'true',
  ENABLE_ADAPTER_LOGGING: process.env.ENABLE_ADAPTER_LOGGING === 'true',
  PREFER_ADAPTER_FOR_NEW_INSTANCES: process.env.PREFER_ADAPTER_FOR_NEW_INSTANCES === 'true'
};

/**
 * Get database adapter instance (new pattern)
 * Returns an IDatabaseAdapter for database-agnostic operations
 */
export async function getDatabaseAdapter(dbPath?: string): Promise<IDatabaseAdapter> {
  const finalPath = dbPath || process.env.DATABASE_PATH || './data/crewai_enhanced.db';
  const absolutePath = path.resolve(finalPath);
  
  // Check for existing adapter instance
  if (adapterInstances.has(absolutePath)) {
    if (FEATURE_FLAGS.ENABLE_ADAPTER_LOGGING) {
      logger.debug('Returning existing adapter instance', absolutePath);
    }
    return adapterInstances.get(absolutePath)!;
  }
  
  // Create adapter based on configuration
  const config = DatabaseFactory.createConfigFromEnv();
  
  // Override path for SQLite if specified
  if (config.type === 'sqlite' && config.sqlite) {
    config.sqlite.databasePath = absolutePath;
  }
  
  if (FEATURE_FLAGS.ENABLE_ADAPTER_LOGGING) {
    logger.info('Creating new database adapter', { type: config.type, path: absolutePath });
  }
  
  const adapter = await DatabaseFactory.create(config, absolutePath);
  adapterInstances.set(absolutePath, adapter);
  
  return adapter;
}

/**
 * Get optimized database instance (singleton pattern)
 * Enhanced to optionally return adapter-wrapped instance based on feature flag
 */
export function getDatabase(dbPath?: string): OptimizedQueryExecutorClass | IDatabaseAdapter {
  // If adapter mode is enabled, return a compatibility shim
  if (FEATURE_FLAGS.USE_DATABASE_ADAPTER) {
    logger.info('Database adapter mode enabled, creating compatibility layer');
    
    const finalPath = dbPath || process.env.DATABASE_PATH || './data/crewai_enhanced.db';
    const absolutePath = path.resolve(finalPath);
    
    // Check if we already have an adapter for this path
    if (adapterInstances.has(absolutePath)) {
      return adapterInstances.get(absolutePath)!;
    }
    
    // Create a regular OptimizedQueryExecutor first
    const executor = getLegacyDatabase(dbPath);
    
    // Wrap it in a compatibility shim
    // Note: This requires accessing the underlying database from OptimizedQueryExecutor
    // For now, we'll return the executor directly with a warning
    logger.warn('Adapter mode requested but returning legacy executor. Full adapter migration pending.');
    return executor;
  }
  
  // Legacy mode: return OptimizedQueryExecutor directly
  return getLegacyDatabase(dbPath);
}

/**
 * Internal function to get legacy database instance
 */
function getLegacyDatabase(dbPath?: string): OptimizedQueryExecutorClass {
  // Default to main database if no path specified - using crewai_enhanced.db as per documentation
  const finalPath = dbPath || process.env.DATABASE_PATH || './data/crewai_enhanced.db';
  const absolutePath = path.resolve(finalPath);
  
  // Return existing instance if available
  if (instances.has(absolutePath)) {
    return instances.get(absolutePath)!;
  }
  
  // Create new optimized instance
  logger.info('Creating new OptimizedQueryExecutor instance', absolutePath);
  
  // Ensure database directory exists
  const dbDir = path.dirname(absolutePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const instance = new OptimizedQueryExecutorClass(absolutePath);
  instances.set(absolutePath, instance);
  
  // Log initial stats
  const stats = instance.getStats();
  logger.info('Database instance created', `Path: ${absolutePath}, Cache: ${stats.totalQueries}, Instances: ${instances.size}`);
  
  return instance;
}

/**
 * Get database for Walmart grocery data
 */
export function getWalmartDatabase(): OptimizedQueryExecutorClass {
  return getDatabase('./walmart_grocery.db');
}

/**
 * Get database for email storage
 */
export function getEmailDatabase(): OptimizedQueryExecutorClass {
  return getDatabase('./emails.db');
}

/**
 * Execute query with PII detection and redaction
 * Prevents caching of sensitive data
 */
export async function executeSecure<T = any>(
  sql: string, 
  params?: any[], 
  dbPath?: string
): Promise<T> {
  const db = getDatabase(dbPath);
  
  // Check for PII in parameters
  if (params) {
    const paramsStr = JSON.stringify(params);
    if (piiRedactor.containsPII(paramsStr)) {
      const piiTypes = piiRedactor.detectPIITypes(paramsStr);
      logger.warn('PII detected in query parameters', `Types: ${piiTypes.join(',')}, Query: ${sql.substring(0, 50)}`);
      
      // For write queries with PII, execute without caching
      if (!sql.trim().toLowerCase().startsWith('select')) {
        // Direct execution bypassing cache for sensitive writes
        const result = await db.execute(sql, params);
        return result;
      }
    }
  }
  
  // Execute normally with caching for non-sensitive queries
  return db.execute<T>(sql, params);
}

/**
 * Execute transaction with multiple queries
 */
export async function executeTransactionOptimized<T = any>(
  queries: Array<{ sql: string; params?: any[] }>,
  dbPath?: string
): Promise<T[]> {
  const db = getDatabase(dbPath);
  return db.executeTransaction<T>(queries);
}

/**
 * Get database statistics for monitoring (centralized)
 */
export function getCentralizedDatabaseStats(dbPath?: string): {
  stats: any;
  cacheHitRatio: number;
  allInstances: string[];
} {
  const db = getDatabase(dbPath);
  const stats = db.getStats();
  const cacheHitRatio = db.getCacheHitRatio();
  
  return {
    stats,
    cacheHitRatio,
    allInstances: Array.from(instances.keys())
  };
}

/**
 * Clear cache for a specific database
 */
export function clearDatabaseCache(dbPath?: string): void {
  const db = getDatabase(dbPath);
  db.clearCache();
  logger.info('Database cache cleared', dbPath || 'default');
}

/**
 * Close all database connections (for graceful shutdown)
 */
export function closeAllDatabases(): void {
  for (const [dbPath, db] of Array.from(instances.entries())) {
    logger.info('Closing database connection', dbPath);
    db.close();
  }
  instances.clear();
}

// ============================================================================
// Helper Functions for Adapter Pattern Migration
// ============================================================================

/**
 * Check if adapter mode is enabled
 */
export function isAdapterModeEnabled(): boolean {
  return FEATURE_FLAGS.USE_DATABASE_ADAPTER;
}

/**
 * Convert legacy database to adapter
 * Useful for gradual migration of existing code
 */
export function convertToAdapter(db: OptimizedQueryExecutorClass | Database.Database): IDatabaseAdapter {
  if ('getMetrics' in db && 'healthCheck' in db) {
    // Already an adapter or has adapter-like interface
    return db as unknown as IDatabaseAdapter;
  }
  
  // Wrap in compatibility shim
  if (db instanceof Database.Database) {
    return new SQLiteCompatibilityShim(db);
  }
  
  // For OptimizedQueryExecutor, we need to access the underlying database
  // This would require modification to OptimizedQueryExecutor to expose the database
  logger.warn('Cannot convert OptimizedQueryExecutor to adapter without accessing underlying database');
  throw new Error('Conversion from OptimizedQueryExecutor to adapter not yet implemented');
}

/**
 * Execute query with automatic adapter selection
 * Works with both legacy and adapter patterns
 */
export async function executeUnified<T = any>(
  sql: string,
  params?: any[],
  dbPath?: string
): Promise<T> {
  if (FEATURE_FLAGS.USE_DATABASE_ADAPTER) {
    const adapter = await getDatabaseAdapter(dbPath);
    const result = await adapter.query<T>(sql, params);
    return result as unknown as T;
  }
  
  // Use legacy execution
  return executeSecure<T>(sql, params, dbPath);
}

/**
 * Execute transaction with automatic adapter selection
 */
export async function executeTransactionUnified<T = any>(
  queries: Array<{ sql: string; params?: any[] }>,
  dbPath?: string
): Promise<T[]> {
  if (FEATURE_FLAGS.USE_DATABASE_ADAPTER) {
    const adapter = await getDatabaseAdapter(dbPath);
    return adapter.transaction(async (tx) => {
      const results: T[] = [];
      for (const query of queries) {
        const result = await tx.execute(query.sql, query.params);
        results.push(result as unknown as T);
      }
      return results;
    });
  }
  
  // Use legacy transaction
  return executeTransactionOptimized<T>(queries, dbPath);
}

/**
 * Get unified database statistics
 * Works with both patterns
 */
export async function getUnifiedDatabaseStats(dbPath?: string): Promise<{
  stats: any;
  cacheHitRatio?: number;
  allInstances: string[];
  adapterMetrics?: any;
}> {
  const legacyStats = getCentralizedDatabaseStats(dbPath);
  
  if (FEATURE_FLAGS.USE_DATABASE_ADAPTER && adapterInstances.size > 0) {
    // Include adapter metrics if available
    const adapterMetrics = DatabaseFactory.getMetricsAll();
    return {
      ...legacyStats,
      adapterMetrics: Object.fromEntries(adapterMetrics)
    };
  }
  
  return legacyStats;
}

/**
 * Close all databases (both legacy and adapter instances)
 */
export async function closeAllDatabasesUnified(): Promise<void> {
  // Close legacy databases
  closeAllDatabases();
  
  // Close adapter instances
  if (adapterInstances.size > 0) {
    logger.info('Closing adapter database connections');
    await DatabaseFactory.closeAll();
    adapterInstances.clear();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing database connections');
  await closeAllDatabasesUnified();
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connections');
  await closeAllDatabasesUnified();
});

// Re-export legacy Database constructor for backwards compatibility
export { Database };

/**
 * MIGRATION HELPER: Drop-in replacement for new Database()
 * Use this to gradually migrate from direct Database usage
 */
export function createDatabase(path: string): any {
  logger.warn('DEPRECATED: Using legacy createDatabase. Migrate to getDatabase()', path);
  return getDatabase(path);
}

// Unified Connection Management (RECOMMENDED)
export {
  UnifiedConnectionManager,
  getUnifiedConnectionManager,
  createDefaultConfig,
} from "./UnifiedConnectionManager.js";

// Repository Pattern Implementation
export { BaseRepository } from "./repositories/BaseRepository.js";
export { UserRepository } from "./repositories/UserRepository.js";
export { EmailRepository } from "./repositories/EmailRepository.js";
export {
  DealRepository,
  DealItemRepository,
  ProductFamilyRepository,
} from "./repositories/DealRepository.js";

// Vector Database Management
export { ChromaDBManager } from "./vector/ChromaDBManager.js";

// File Storage System
export { FileStorageManager } from "./storage/FileStorageManager.js";

// Migration System
export { DatabaseMigrator } from "./migrations/DatabaseMigrator.js";

// Database Initialization
export {
  initializeDatabase,
  resetDatabase,
} from "./scripts/initializeDatabase.js";

// Type definitions
export type {
  // Base types
  BaseEntity,
  QueryOptions,
  PaginatedResult,
} from "./repositories/BaseRepository.js";

export type { User, CreateUserData } from "./repositories/UserRepository.js";
export type {
  EmailEntity,
  CreateEmailParams,
} from "./repositories/EmailRepository.js";
export type {
  Deal,
  DealItem,
  ProductFamily,
  CreateDealData,
  CreateDealItemData,
  DealQueryResult,
} from "./repositories/DealRepository.js";
export type {
  ChromaDocument,
  ChromaQueryResult,
  CollectionConfig,
} from "./vector/ChromaDBManager.js";
export type {
  StoredFile,
  FileMetadata,
  StorageConfig,
} from "./storage/FileStorageManager.js";
export type {
  Migration,
  MigrationResult,
} from "./migrations/DatabaseMigrator.js";

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Create a database configuration object
 * Useful for testing and custom configurations
 */
export function createDatabaseConfig(
  type: 'sqlite' | 'postgresql',
  options: Partial<import('./adapters/DatabaseAdapter.interface.js').SQLiteConfig | import('./adapters/DatabaseAdapter.interface.js').PostgreSQLConfig>
): import('./adapters/DatabaseAdapter.interface.js').DatabaseConfig {
  if (type === 'sqlite') {
    return {
      type: 'sqlite',
      sqlite: {
        databasePath: './data/crewai_enhanced.db',
        enableWAL: true,
        enableForeignKeys: true,
        ...options
      } as import('./adapters/DatabaseAdapter.interface.js').SQLiteConfig
    };
  }
  
  return {
    type: 'postgresql',
    postgresql: {
      host: 'localhost',
      port: 5432,
      database: 'crewai_team',
      user: 'crewai_user',
      password: '',
      ...options
    } as import('./adapters/DatabaseAdapter.interface.js').PostgreSQLConfig
  };
}

/**
 * Get feature flag status
 */
export function getFeatureFlags(): typeof FEATURE_FLAGS {
  return { ...FEATURE_FLAGS };
}

/**
 * Set feature flags (useful for testing)
 * Note: This only affects the current process
 */
export function setFeatureFlag(flag: keyof typeof FEATURE_FLAGS, value: boolean): void {
  FEATURE_FLAGS[flag] = value;
  logger.info(`Feature flag ${flag} set to ${value}`);
}

/**
 * Get all active database instances (both legacy and adapter)
 */
export function getAllDatabaseInstances(): {
  legacy: string[];
  adapters: string[];
} {
  return {
    legacy: Array.from(instances.keys()),
    adapters: Array.from(adapterInstances.keys())
  };
}

/**
 * Health check for all databases
 */
export async function healthCheckAll(): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  // Check legacy instances
  for (const [path, db] of instances) {
    try {
      // Perform a simple query to check health
      await db.execute('SELECT 1');
      results.set(`legacy:${path}`, true);
    } catch (error) {
      results.set(`legacy:${path}`, false);
    }
  }
  
  // Check adapter instances
  if (adapterInstances.size > 0) {
    const adapterHealth = await DatabaseFactory.healthCheckAll();
    for (const [key, healthy] of adapterHealth) {
      results.set(`adapter:${key}`, healthy);
    }
  }
  
  return results;
}

// Constants and configuration
export const DATABASE_CONSTANTS = {
  SQLITE: {
    DEFAULT_CACHE_SIZE: 10000,
    DEFAULT_MEMORY_MAP: 268435456, // 256MB
    DEFAULT_BUSY_TIMEOUT: 30000, // 30 seconds
    WAL_CHECKPOINT_INTERVAL: 60000, // 1 minute
  },
  CHROMADB: {
    DEFAULT_HOST: "localhost",
    DEFAULT_PORT: 8000,
    DEFAULT_TENANT: "default_tenant",
    DEFAULT_DATABASE: "crewai_team",
  },
  FILE_STORAGE: {
    DEFAULT_MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    SUPPORTED_EXTENSIONS: [
      ".pdf",
      ".doc",
      ".docx",
      ".xlsx",
      ".txt",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".zip",
    ],
    CATEGORIES: ["documents", "attachments", "images", "exports", "backups"],
  },
} as const;
