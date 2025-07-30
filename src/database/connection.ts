import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | null = null;

export interface DatabaseConfig {
  filename?: string;
  readonly?: boolean;
  verbose?: boolean;
}

/**
 * Get or create database connection
 */
export function getDatabaseConnection(
  config: DatabaseConfig = {},
): Database.Database {
  if (db && db.open) {
    return db;
  }

  const {
    filename = process.env.DATABASE_PATH ||
      path.join(process.cwd(), "data", "crewai.db"),
    readonly = false,
    verbose = process.env.NODE_ENV === "development",
  } = config;

  try {
    // Ensure directory exists
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create database connection
    db = new Database(filename, {
      readonly,
      verbose: verbose ? console.log : undefined,
    });

    // Enable foreign keys and optimizations
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = 10000");
    db.pragma("temp_store = MEMORY");
    db.pragma("mmap_size = 268435456"); // 256MB

    logger.info("Database connection established", "DATABASE", { filename });

    // Register close handler
    process.on("exit", () => closeDatabaseConnection());
    process.on("SIGINT", () => {
      closeDatabaseConnection();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      closeDatabaseConnection();
      process.exit(0);
    });

    return db;
  } catch (error) {
    logger.error("Failed to establish database connection", "DATABASE", {
      error: error instanceof Error ? error.message : String(error),
      filename,
    });
    throw error;
  }
}

/**
 * Close database connection
 */
export function closeDatabaseConnection(): void {
  if (db && db.open) {
    try {
      db.close();
      logger.info("Database connection closed", "DATABASE");
    } catch (error) {
      logger.error("Error closing database connection", "DATABASE", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  db = null;
}

/**
 * Execute database migration
 */
export async function runMigration(migrationPath: string): Promise<void> {
  const connection = getDatabaseConnection();

  try {
    const migration = fs.readFileSync(migrationPath, "utf-8");
    connection.exec(migration);

    logger.info("Database migration executed", "DATABASE", { migrationPath });
  } catch (error) {
    logger.error("Failed to execute database migration", "DATABASE", {
      error: error instanceof Error ? error.message : String(error),
      migrationPath,
    });
    throw error;
  }
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  try {
    const connection = getDatabaseConnection();
    const result = connection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='emails_enhanced'",
      )
      .get();

    return !!result;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize database with schema
 */
export async function initializeDatabase(): Promise<void> {
  if (isDatabaseInitialized()) {
    logger.info("Database already initialized", "DATABASE");
    return;
  }

  const schemaPath = path.join(__dirname, "schema", "enhanced_schema.sql");
  await runMigration(schemaPath);

  logger.info("Database initialized with schema", "DATABASE");
}
