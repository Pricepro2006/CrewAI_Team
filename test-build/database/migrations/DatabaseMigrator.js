/**
 * Database Migration System
 * Handles database schema migrations with version control and rollback support
 */
import { readFileSync } from "fs";
import { join } from "path";
import { logger } from "../../utils/logger.js";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(fileURLToPath(import.meta.url), "..");
export class DatabaseMigrator {
    db;
    migrationsPath;
    constructor(db, migrationsPath) {
        this.db = db;
        this.migrationsPath = migrationsPath || join(__dirname, "./migrations");
        this.initializeMigrationsTable();
    }
    /**
     * Initialize the migrations table to track applied migrations
     */
    initializeMigrationsTable() {
        this?.db?.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        execution_time INTEGER NOT NULL,
        checksum TEXT
      );
    `);
    }
    /**
     * Get the current database schema version
     */
    async getCurrentVersion() {
        const result = this.db
            .prepare(`
      SELECT version FROM schema_migrations 
      ORDER BY version DESC 
      LIMIT 1
    `)
            .get();
        return result?.version || null;
    }
    /**
     * Get list of applied migrations
     */
    async getAppliedMigrations() {
        return this.db
            .prepare(`
      SELECT version, name, applied_at, execution_time
      FROM schema_migrations
      ORDER BY version ASC
    `)
            .all();
    }
    /**
     * Check if a migration has been applied
     */
    async isMigrationApplied(version) {
        const result = this.db
            .prepare(`
      SELECT 1 FROM schema_migrations WHERE version = ?
    `)
            .get(version);
        return !!result;
    }
    /**
     * Apply a single migration
     */
    async applyMigration(migration) {
        const startTime = Date.now();
        try {
            // Check if migration is already applied
            if (await this.isMigrationApplied(migration.version)) {
                return {
                    version: migration.version,
                    name: migration.name,
                    success: false,
                    error: "Migration already applied",
                    executionTime: 0,
                };
            }
            // Check dependencies
            if (migration.dependencies) {
                for (const depVersion of migration.dependencies) {
                    if (!(await this.isMigrationApplied(depVersion))) {
                        return {
                            version: migration.version,
                            name: migration.name,
                            success: false,
                            error: `Dependency migration ${depVersion} not applied`,
                            executionTime: Date.now() - startTime,
                        };
                    }
                }
            }
            // Apply migration in a transaction
            const transaction = this?.db?.transaction(() => {
                // Execute the migration SQL
                this?.db?.exec(migration.up);
                // Record the migration as applied
                this.db
                    .prepare(`
          INSERT INTO schema_migrations (version, name, execution_time, checksum)
          VALUES (?, ?, ?, ?)
        `)
                    .run(migration.version, migration.name, Date.now() - startTime, this.calculateChecksum(migration.up));
            });
            transaction();
            const executionTime = Date.now() - startTime;
            logger.info(`Applied migration ${migration.version}: ${migration.name} (${executionTime}ms)`, "DB_MIGRATION");
            return {
                version: migration.version,
                name: migration.name,
                success: true,
                executionTime,
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to apply migration ${migration.version}: ${errorMessage}`, "DB_MIGRATION");
            return {
                version: migration.version,
                name: migration.name,
                success: false,
                error: errorMessage,
                executionTime,
            };
        }
    }
    /**
     * Rollback a migration
     */
    async rollbackMigration(migration) {
        const startTime = Date.now();
        try {
            // Check if migration is applied
            if (!(await this.isMigrationApplied(migration.version))) {
                return {
                    version: migration.version,
                    name: migration.name,
                    success: false,
                    error: "Migration not applied",
                    executionTime: 0,
                };
            }
            if (!migration.down) {
                return {
                    version: migration.version,
                    name: migration.name,
                    success: false,
                    error: "No rollback SQL provided",
                    executionTime: 0,
                };
            }
            // Rollback migration in a transaction
            const transaction = this?.db?.transaction(() => {
                // Execute the rollback SQL
                this?.db?.exec(migration.down);
                // Remove the migration record
                this.db
                    .prepare(`
          DELETE FROM schema_migrations WHERE version = ?
        `)
                    .run(migration.version);
            });
            transaction();
            const executionTime = Date.now() - startTime;
            logger.info(`Rolled back migration ${migration.version}: ${migration.name} (${executionTime}ms)`, "DB_MIGRATION");
            return {
                version: migration.version,
                name: migration.name,
                success: true,
                executionTime,
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to rollback migration ${migration.version}: ${errorMessage}`, "DB_MIGRATION");
            return {
                version: migration.version,
                name: migration.name,
                success: false,
                error: errorMessage,
                executionTime,
            };
        }
    }
    /**
     * Apply all pending migrations
     */
    async migrate(migrations) {
        const results = [];
        // Sort migrations by version
        const sortedMigrations = migrations.sort((a, b) => a?.version?.localeCompare(b.version));
        for (const migration of sortedMigrations) {
            const result = await this.applyMigration(migration);
            results.push(result);
            // Stop on first failure
            if (!result.success) {
                logger.error(`Migration failed at ${migration.version}. Stopping migration process.`, "DB_MIGRATION");
                break;
            }
        }
        return results;
    }
    /**
     * Rollback to a specific version
     */
    async rollbackTo(targetVersion, migrations) {
        const results = [];
        const appliedMigrations = await this.getAppliedMigrations();
        // Find migrations to rollback (all versions after target)
        const migrationsToRollback = appliedMigrations
            .filter((applied) => applied.version > targetVersion)
            .sort((a, b) => b?.version?.localeCompare(a.version)); // Reverse order for rollback
        for (const appliedMigration of migrationsToRollback) {
            const migration = migrations.find((m) => m.version === appliedMigration.version);
            if (!migration) {
                logger.warn(`Migration definition not found for version ${appliedMigration.version}`, "DB_MIGRATION");
                continue;
            }
            const result = await this.rollbackMigration(migration);
            results.push(result);
            // Stop on first failure
            if (!result.success) {
                logger.error(`Rollback failed at ${migration.version}. Stopping rollback process.`, "DB_MIGRATION");
                break;
            }
        }
        return results;
    }
    /**
     * Get migration status
     */
    async getStatus(migrations) {
        const currentVersion = await getCurrentVersion();
        const appliedMigrations = await this.getAppliedMigrations();
        const appliedVersions = appliedMigrations?.map((m) => m.version);
        const pendingMigrations = migrations
            .filter((m) => !appliedVersions.includes(m.version))
            .map((m) => m.version);
        return {
            currentVersion,
            appliedMigrations: appliedVersions,
            pendingMigrations,
            totalMigrations: migrations?.length || 0,
        };
    }
    /**
     * Create a new migration file template
     */
    createMigrationTemplate(name, description) {
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .split("T")[0];
        const version = `${timestamp}_${name.toLowerCase().replace(/\s+/g, "_")}`;
        return `/**
 * Migration: ${name}
 * Version: ${version}
 * Description: ${description}
 */

export const migration_${version.replace(/-/g, "_")} = {
  version: '${version}',
  name: '${name}',
  description: '${description}',
  
  up: \`
    -- Add your migration SQL here
    
  \`,
  
  down: \`
    -- Add your rollback SQL here (optional)
    
  \`
};
`;
    }
    /**
     * Load migration from SQL file
     */
    loadMigrationFromFile(filePath) {
        try {
            const content = readFileSync(filePath, "utf8");
            // Parse migration metadata from comments
            const versionMatch = content.match(/-- Version: (.+)/);
            const nameMatch = content.match(/-- Name: (.+)/);
            const descriptionMatch = content.match(/-- Description: (.+)/);
            const version = versionMatch?.[1]?.trim() || "unknown";
            const name = nameMatch?.[1]?.trim() || "Unknown Migration";
            const description = descriptionMatch?.[1]?.trim() || "No description";
            // Extract SQL sections
            const upMatch = content.match(/-- UP\s*\n([\s\S]*?)(?=-- DOWN|$)/);
            const downMatch = content.match(/-- DOWN\s*\n([\s\S]*?)$/);
            const up = upMatch?.[1]?.trim() || content;
            const down = downMatch?.[1]?.trim();
            return {
                version,
                name,
                description,
                up,
                down,
            };
        }
        catch (error) {
            throw new Error(`Failed to load migration from ${filePath}: ${error}`);
        }
    }
    /**
     * Calculate checksum for migration content
     */
    calculateChecksum(content) {
        let hash = 0;
        for (let i = 0; i < content?.length || 0; i++) {
            const char = content.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    /**
     * Backup database before migration
     */
    async createBackup(backupPath) {
        try {
            this?.db?.backup(backupPath);
            logger.info(`Database backup created at ${backupPath}`, "DB_MIGRATION");
        }
        catch (error) {
            logger.error(`Failed to create database backup: ${error}`, "DB_MIGRATION");
            throw error;
        }
    }
    /**
     * Validate database integrity after migration
     */
    async validateIntegrity() {
        const errors = [];
        try {
            // Run PRAGMA integrity_check
            const integrityResult = this.db
                .prepare("PRAGMA integrity_check")
                .all();
            for (const result of integrityResult) {
                if (result.integrity_check !== "ok") {
                    errors.push(`Integrity check failed: ${result.integrity_check}`);
                }
            }
            // Check foreign key constraints
            const foreignKeyResult = this.db
                .prepare("PRAGMA foreign_key_check")
                .all();
            if (foreignKeyResult?.length || 0 > 0) {
                errors.push(`Foreign key violations found: ${foreignKeyResult?.length || 0} issues`);
            }
            return {
                valid: errors?.length || 0 === 0,
                errors,
            };
        }
        catch (error) {
            errors.push(`Validation failed: ${error}`);
            return {
                valid: false,
                errors,
            };
        }
    }
}
// Helper function to get current version (used by external callers)
async function getCurrentVersion() {
    // This would be implemented based on the specific database instance
    return null;
}
