/**
 * Database Manager - Central database management system
 * Coordinates SQLite and ChromaDB operations with proper initialization
 */

import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";
import appConfig from "../config/app.config.js";
import { fileURLToPath } from "url";
import {
  DatabaseConnectionPool,
  getDatabaseConnection,
  executeQuery,
  executeTransaction,
  shutdownConnectionPool,
  type ConnectionPoolConfig,
} from "./ConnectionPool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(fileURLToPath(import.meta.url), "..");

// Repository imports
import { UserRepository } from "./repositories/UserRepository.js";
import { EmailRepository } from "./repositories/EmailRepository.js";
import {
  DealRepository,
  DealItemRepository,
  ProductFamilyRepository,
} from "./repositories/DealRepository.js";
import {
  GroceryListRepository,
  GroceryItemRepository,
  ShoppingSessionRepository,
} from "./repositories/GroceryRepository.js";
import {
  WalmartProductRepository,
  SubstitutionRepository,
  UserPreferencesRepository,
} from "./repositories/WalmartProductRepository.js";

// Vector database imports
import { ChromaDBManager } from "./vector/ChromaDBManager.js";
import { GroceryVectorCollections } from "./vector/GroceryVectorCollections.js";

// Migration system
import { DatabaseMigrator } from "./migrations/DatabaseMigrator.js";
import WalmartGroceryAgentMigration from "./migrations/005_walmart_grocery_agent.js";

export interface DatabaseConfig {
  sqlite: {
    path: string;
    enableWAL?: boolean;
    enableForeignKeys?: boolean;
    cacheSize?: number;
    memoryMap?: number;
    maxConnections?: number;
    connectionTimeout?: number;
    idleTimeout?: number;
    busyTimeout?: number;
  };
  chromadb: {
    host?: string;
    port?: number;
    ssl?: boolean;
    tenant?: string;
    database?: string;
  };
}

export class DatabaseManager {
  private connectionPool: DatabaseConnectionPool;
  private chromaManager: ChromaDBManager;
  private migrator: DatabaseMigrator;
  private isInitialized: boolean = false;

  // Repository instances
  public readonly users: UserRepository;
  public readonly emails: EmailRepository;
  public readonly deals: DealRepository;
  public readonly dealItems: DealItemRepository;
  public readonly productFamilies: ProductFamilyRepository;

  // Grocery repository instances
  public readonly groceryLists: GroceryListRepository;
  public readonly groceryItems: GroceryItemRepository;
  public readonly shoppingSessions: ShoppingSessionRepository;
  public readonly walmartProducts: WalmartProductRepository;
  public readonly substitutions: SubstitutionRepository;
  public readonly userPreferences: UserPreferencesRepository;

  constructor(config?: Partial<DatabaseConfig>) {
    const dbConfig: DatabaseConfig = {
      sqlite: {
        path: config?.sqlite?.path || appConfig.database.path,
        enableWAL: config?.sqlite?.enableWAL !== false,
        enableForeignKeys: config?.sqlite?.enableForeignKeys !== false,
        cacheSize: config?.sqlite?.cacheSize || 20000, // Increased for better performance
        memoryMap: config?.sqlite?.memoryMap || 536870912, // 512MB for better memory mapping
        maxConnections: config?.sqlite?.maxConnections || 20, // Increased pool size
        connectionTimeout: config?.sqlite?.connectionTimeout || 10000, // Reduced timeout
        idleTimeout: config?.sqlite?.idleTimeout || 60000, // 1 minute - more aggressive cleanup
        busyTimeout: config?.sqlite?.busyTimeout || 5000, // Reduced busy timeout for faster failover
      },
      chromadb: {
        host: config?.chromadb?.host || "localhost",
        port: config?.chromadb?.port || 8000,
        ssl: config?.chromadb?.ssl || false,
        tenant: config?.chromadb?.tenant || "default_tenant",
        database: config?.chromadb?.database || "crewai_team",
      },
    };

    // Initialize connection pool
    this.connectionPool = DatabaseConnectionPool.getInstance({
      databasePath: dbConfig.sqlite.path,
      maxConnections: dbConfig.sqlite.maxConnections,
      connectionTimeout: dbConfig.sqlite.connectionTimeout,
      idleTimeout: dbConfig.sqlite.idleTimeout,
      enableWAL: dbConfig.sqlite.enableWAL,
      enableForeignKeys: dbConfig.sqlite.enableForeignKeys,
      cacheSize: dbConfig.sqlite.cacheSize,
      memoryMap: dbConfig.sqlite.memoryMap,
      busyTimeout: dbConfig.sqlite.busyTimeout,
    });

    // Initialize ChromaDB manager
    this.chromaManager = new ChromaDBManager(dbConfig.chromadb);

    // Initialize migration system with pooled connection
    const migrationConnection = this.connectionPool.getConnection();
    this.migrator = new DatabaseMigrator(migrationConnection.getDatabase());

    // Initialize repositories with connection pool
    const repoConnection = this.connectionPool.getConnection();
    const db = repoConnection.getDatabase();

    this.users = new UserRepository(db);
    this.emails = new EmailRepository({ db });
    this.deals = new DealRepository(db);
    this.dealItems = new DealItemRepository(db);
    this.productFamilies = new ProductFamilyRepository(db);

    // Initialize grocery repositories
    this.groceryLists = new GroceryListRepository(db);
    this.groceryItems = new GroceryItemRepository(db);
    this.shoppingSessions = new ShoppingSessionRepository(db);
    this.walmartProducts = new WalmartProductRepository(db);
    this.substitutions = new SubstitutionRepository(db);
    this.userPreferences = new UserPreferencesRepository(db);

    logger.info(
      "DatabaseManager initialized with connection pool",
      "DB_MANAGER",
    );
  }

  /**
   * Initialize the database system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Database already initialized", "DB_MANAGER");
      return;
    }

    try {
      logger.info("Initializing database system...", "DB_MANAGER");

      // Step 1: Apply database migrations
      await this.applyMigrations();

      // Step 2: Initialize ChromaDB
      await this.initializeVectorDatabase();

      // Step 3: Verify database integrity
      await this.verifyDatabaseIntegrity();

      // Step 4: Seed initial data if needed
      await this.seedInitialData();

      this.isInitialized = true;
      logger.info("Database system initialized successfully", "DB_MANAGER");
    } catch (error) {
      logger.error(`Database initialization failed: ${error}`, "DB_MANAGER");
      throw error;
    }
  }

  /**
   * Apply database migrations
   */
  private async applyMigrations(): Promise<void> {
    try {
      logger.info("Applying database migrations...", "DB_MANAGER");

      // Load and apply the enhanced schema
      const schemaPath = join(__dirname, "schema/enhanced_schema.sql");
      const schemaSql = readFileSync(schemaPath, "utf8");

      // Split schema into individual statements and execute
      const statements = schemaSql
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

      for (const statement of statements) {
        try {
          this.db.exec(statement + ";");
        } catch (error) {
          // Log warning for statements that might already exist
          if (
            !(error instanceof Error) ||
            !error.message.includes("already exists")
          ) {
            logger.warn(
              `Migration statement warning: ${error instanceof Error ? error.message : String(error)}`,
              "DB_MANAGER",
            );
          }
        }
      }

      // Apply Walmart Grocery Agent migration
      const groceryMigration = new WalmartGroceryAgentMigration(this.db);
      try {
        await groceryMigration.up();
        logger.info(
          "Walmart Grocery Agent migration applied successfully",
          "DB_MANAGER",
        );
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("already exists")
        ) {
          logger.warn(
            `Grocery migration warning: ${error instanceof Error ? error.message : String(error)}`,
            "DB_MANAGER",
          );
        }
      }

      logger.info("Database migrations applied successfully", "DB_MANAGER");
    } catch (error) {
      logger.error(`Migration failed: ${error}`, "DB_MANAGER");
      throw error;
    }
  }

  /**
   * Initialize ChromaDB and create system collections
   */
  private async initializeVectorDatabase(): Promise<void> {
    try {
      logger.info("Initializing ChromaDB...", "DB_MANAGER");

      await this.chromaManager.initialize();
      await this.chromaManager.createSystemCollections();

      logger.info("ChromaDB initialized successfully", "DB_MANAGER");
    } catch (error) {
      logger.warn(`ChromaDB initialization failed: ${error}`, "DB_MANAGER");
      // Don't throw error - ChromaDB is optional
    }
  }

  /**
   * Verify database integrity
   */
  private async verifyDatabaseIntegrity(): Promise<void> {
    try {
      const integrity = await this.migrator.validateIntegrity();

      if (!integrity.valid) {
        logger.error(
          `Database integrity check failed: ${integrity.errors.join(", ")}`,
          "DB_MANAGER",
        );
        throw new Error("Database integrity validation failed");
      }

      logger.info("Database integrity verified", "DB_MANAGER");
    } catch (error) {
      logger.error(`Database integrity check failed: ${error}`, "DB_MANAGER");
      throw error;
    }
  }

  /**
   * Seed initial data if the database is empty
   */
  private async seedInitialData(): Promise<void> {
    try {
      // Check if we need to seed data
      const userCount = await this.users.count();
      const productFamilyCount = await this.productFamilies.count();

      if (userCount === 0 || productFamilyCount === 0) {
        logger.info("Seeding initial data...", "DB_MANAGER");

        // Create default admin user
        if (userCount === 0) {
          await this.users.createUser({
            email: "admin@crewai-team.local",
            name: "System Administrator",
            role: "admin",
            status: "active",
            permissions: ["*"],
          });
          logger.info("Created default admin user", "DB_MANAGER");
        }

        // Create product families
        if (productFamilyCount === 0) {
          await this.productFamilies.createProductFamily({
            family_code: "IPG",
            family_name: "Infrastructure Products Group",
            pricing_multiplier: 1.04,
            description: "Infrastructure products with 4% markup",
          });

          await this.productFamilies.createProductFamily({
            family_code: "PSG",
            family_name: "Personal Systems Group",
            pricing_multiplier: 1.0,
            description: "Personal systems with no markup",
          });

          logger.info("Created default product families", "DB_MANAGER");
        }

        logger.info("Initial data seeding completed", "DB_MANAGER");
      }
    } catch (error) {
      logger.error(`Data seeding failed: ${error}`, "DB_MANAGER");
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    sqlite: {
      size: number;
      tables: number;
      indexes: number;
      users: number;
      emails: number;
      deals: number;
      dealItems: number;
    };
    chromadb?: {
      connected: boolean;
      collections: number;
      documents: number;
    };
  }> {
    try {
      // SQLite statistics using connection pool
      const { tableCount, indexCount, size } =
        await this.connectionPool.executeQuery((db) => {
          const tableCountResult = db
            .prepare(
              `
          SELECT COUNT(*) as count 
          FROM sqlite_master 
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        `,
            )
            .get() as { count: number };

          const indexCountResult = db
            .prepare(
              `
          SELECT COUNT(*) as count 
          FROM sqlite_master 
          WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
        `,
            )
            .get() as { count: number };

          // Get page count and page size to calculate database size
          const pageCountResult = db.pragma("page_count", {
            simple: true,
          }) as number;
          const pageSizeResult = db.pragma("page_size", {
            simple: true,
          }) as number;
          const size = pageCountResult * pageSizeResult;

          return {
            tableCount: tableCountResult.count,
            indexCount: indexCountResult.count,
            size,
          };
        });

      const sqliteStats = {
        size,
        tables: tableCount,
        indexes: indexCount,
        users: await this.users.count(),
        emails: this.emails.count ? await this.emails.count() : 0,
        deals: await this.deals.count(),
        dealItems: await this.dealItems.count(),
      };

      // ChromaDB statistics
      let chromaStats;
      try {
        const health = await this.chromaManager.healthCheck();
        if (health.connected) {
          const collections = await this.chromaManager.listCollections();
          let totalDocuments = 0;

          for (const collection of collections) {
            const stats = await this.chromaManager.getCollectionStats(
              collection.name,
            );
            totalDocuments += stats.count;
          }

          chromaStats = {
            connected: true,
            collections: collections.length,
            documents: totalDocuments,
          };
        } else {
          chromaStats = {
            connected: false,
            collections: 0,
            documents: 0,
          };
        }
      } catch (error) {
        chromaStats = {
          connected: false,
          collections: 0,
          documents: 0,
        };
      }

      return {
        sqlite: sqliteStats,
        chromadb: chromaStats,
      };
    } catch (error) {
      logger.error(`Failed to get database statistics: ${error}`, "DB_MANAGER");
      throw error;
    }
  }

  /**
   * Execute a database transaction using connection pool
   */
  async transaction<T>(
    callback: (db: Database.Database) => Promise<T>,
  ): Promise<T> {
    return this.connectionPool.executeTransaction(async (db) => {
      return await callback(db);
    });
  }

  /**
   * Get direct access to ChromaDB manager
   */
  getVectorDatabase(): ChromaDBManager {
    return this.chromaManager;
  }

  /**
   * Get direct access to SQLite database (via connection pool)
   */
  getSQLiteDatabase(): Database.Database {
    const connection = this.connectionPool.getConnection();
    return connection.getDatabase();
  }

  /**
   * Get connection pool instance
   */
  getConnectionPool(): DatabaseConnectionPool {
    return this.connectionPool;
  }

  /**
   * Execute query using connection pool
   */
  async executeQuery<T>(queryFn: (db: Database.Database) => T): Promise<T> {
    return this.connectionPool.executeQuery(queryFn);
  }

  /**
   * Health check for all database systems
   */
  async healthCheck(): Promise<{
    sqlite: {
      connected: boolean;
      writable: boolean;
      integrity: boolean;
    };
    chromadb: {
      connected: boolean;
      version?: string;
      collections: number;
    };
    overall: boolean;
  }> {
    try {
      // SQLite health check
      const sqliteHealth = {
        connected: true,
        writable: false,
        integrity: false,
      };

      try {
        // Test write operation using connection pool
        await this.connectionPool.executeQuery((db) => {
          db.prepare("SELECT 1").get();
          return true;
        });
        sqliteHealth.writable = true;

        // Test integrity
        const integrity = await this.migrator.validateIntegrity();
        sqliteHealth.integrity = integrity.valid;
      } catch (error) {
        logger.warn(`SQLite health check warning: ${error}`, "DB_MANAGER");
        sqliteHealth.connected = false;
      }

      // ChromaDB health check
      const chromaHealth = await this.chromaManager.healthCheck();

      const overall =
        sqliteHealth.connected &&
        sqliteHealth.writable &&
        sqliteHealth.integrity;

      return {
        sqlite: sqliteHealth,
        chromadb: {
          connected: chromaHealth.connected,
          version: chromaHealth.version,
          collections: chromaHealth.collections,
        },
        overall,
      };
    } catch (error) {
      logger.error(`Database health check failed: ${error}`, "DB_MANAGER");
      return {
        sqlite: { connected: false, writable: false, integrity: false },
        chromadb: { connected: false, collections: 0 },
        overall: false,
      };
    }
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    try {
      // Close ChromaDB connections
      await this.chromaManager.close();

      // Shutdown connection pool
      await this.connectionPool.shutdown();

      this.isInitialized = false;
      logger.info("Database connections closed", "DB_MANAGER");
    } catch (error) {
      logger.error(
        `Failed to close database connections: ${error}`,
        "DB_MANAGER",
      );
      throw error;
    }
  }
}

// Create singleton instance
let databaseManager: DatabaseManager | null = null;

export function getDatabaseManager(
  config?: Partial<DatabaseConfig>,
): DatabaseManager {
  if (!databaseManager) {
    databaseManager = new DatabaseManager(config);
  }
  return databaseManager;
}

// Export for testing
export { DatabaseManager as DatabaseManagerClass };
