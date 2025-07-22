/**
 * Database Module Index
 * Exports all database-related functionality for the CrewAI Team project
 */

// Core Database Manager
export { DatabaseManager, getDatabaseManager } from "./DatabaseManager";

// Repository Pattern Implementation
export { BaseRepository } from "./repositories/BaseRepository";
export { UserRepository } from "./repositories/UserRepository";
export { EmailRepository } from "./repositories/EmailRepository";
export {
  DealRepository,
  DealItemRepository,
  ProductFamilyRepository,
} from "./repositories/DealRepository";

// Vector Database Management
export { ChromaDBManager } from "./vector/ChromaDBManager";

// File Storage System
export { FileStorageManager } from "./storage/FileStorageManager";

// Migration System
export { DatabaseMigrator } from "./migrations/DatabaseMigrator";

// Database Initialization
export {
  initializeDatabase,
  resetDatabase,
} from "./scripts/initializeDatabase";

// Base type definitions
export type {
  BaseEntity,
  QueryOptions,
  PaginatedResult,
} from "./repositories/BaseRepository";

export type { User, CreateUserData } from "./repositories/UserRepository";
export type {
  CreateEmailParams,
  EmailQueryParams,
  EmailEntity,
} from "./repositories/EmailRepository";
export type {
  Deal,
  DealItem,
  ProductFamily,
  CreateDealData,
  CreateDealItemData,
  DealQueryResult,
} from "./repositories/DealRepository";
export type {
  ChromaDocument,
  ChromaQueryResult,
  CollectionConfig,
} from "./vector/ChromaDBManager";
export type {
  StoredFile,
  FileMetadata,
  StorageConfig,
} from "./storage/FileStorageManager";
export type { Migration, MigrationResult } from "./migrations/DatabaseMigrator";

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
