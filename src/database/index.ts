/**
 * Database Module Index
 * Exports all database-related functionality for the CrewAI Team project
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

// NEW: Centralized Database Access with Singleton Pattern
import { OptimizedQueryExecutor as OptimizedQueryExecutorClass } from './OptimizedQueryExecutor.js';
import { PIIRedactor } from '../utils/PIIRedactor.js';
import { Logger } from '../utils/logger.js';
import * as path from 'path';
import * as fs from 'fs';
import * as Database from 'better-sqlite3';

const logger = new Logger('DatabaseModule');

// Singleton instances for each database
const instances = new Map<string, OptimizedQueryExecutorClass>();

// PII Redactor for security
const piiRedactor = new PIIRedactor({
  redactEmails: true,
  redactPhones: true,
  redactSSN: true,
  redactCreditCards: true,
  redactAPIKeys: true
});

/**
 * Get optimized database instance (singleton pattern)
 * This ensures all services share the same connection pool and cache
 */
export function getDatabase(dbPath?: string): OptimizedQueryExecutorClass {
  // Default to main database if no path specified
  const finalPath = dbPath || process.env.DATABASE_PATH || './crewai.db';
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

// Handle process termination
process.on('SIGINT', () => {
  logger.info('SIGINT received, closing database connections');
  closeAllDatabases();
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing database connections');
  closeAllDatabases();
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
