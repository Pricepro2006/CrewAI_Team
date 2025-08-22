import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let db = null;
/**
 * Get or create database connection
 */
export function getDatabaseConnection(config = {}) {
    if (db && db.open) {
        return db;
    }
    const { filename = process.env.DATABASE_PATH ||
        path.join(process.cwd(), "data", "crewai_enhanced.db"), readonly = false, verbose = process.env.NODE_ENV === "development", } = config;
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
        // Register close handler with proper error handling
        const closeHandler = () => {
            try {
                closeDatabaseConnection();
            }
            catch (error) {
                logger.error("Error in close handler", "DATABASE", { error });
            }
        };
        process.on("exit", closeHandler);
        process.on("SIGINT", () => {
            closeHandler();
            process.exit(0);
        });
        process.on("SIGTERM", () => {
            closeHandler();
            process.exit(0);
        });
        return db;
    }
    catch (error) {
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
export function closeDatabaseConnection() {
    if (db && db.open) {
        try {
            db.close();
            logger.info("Database connection closed", "DATABASE");
        }
        catch (error) {
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
export async function runMigration(migrationPath) {
    try {
        const connection = getDatabaseConnection();
        const migration = fs.readFileSync(migrationPath, "utf-8");
        connection.exec(migration);
        logger.info("Database migration executed", "DATABASE", { migrationPath });
    }
    catch (error) {
        logger.error("Failed to execute database migration", "DATABASE", {
            error: error instanceof Error ? error.message : String(error),
            migrationPath,
        });
        // Don't throw during migrations to allow recovery
        // throw error;
    }
}
/**
 * Check if database is initialized
 */
export function isDatabaseInitialized() {
    try {
        const connection = getDatabaseConnection();
        const result = connection
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='emails_enhanced'")
            .get();
        return !!result;
    }
    catch (error) {
        return false;
    }
}
/**
 * Initialize database with schema
 */
export async function initializeDatabase() {
    try {
        if (isDatabaseInitialized()) {
            logger.info("Database already initialized", "DATABASE");
            return;
        }
        const schemaPath = path.join(__dirname, "schema", "enhanced_schema.sql");
        if (!fs.existsSync(schemaPath)) {
            logger.warn("Schema file not found, skipping initialization", "DATABASE", { schemaPath });
            return;
        }
        await runMigration(schemaPath);
        logger.info("Database initialized with schema", "DATABASE");
    }
    catch (error) {
        logger.error("Failed to initialize database", "DATABASE", {
            error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw to allow system to continue
    }
}
