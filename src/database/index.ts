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
