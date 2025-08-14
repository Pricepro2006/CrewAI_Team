/**
 * Script to run database migrations manually
 * Usage: pnpm tsx src/database/scripts/runMigrations.ts
 */

import { getDatabaseManager } from "../DatabaseManager.js";
import { logger } from "../../utils/logger.js";
import FixNegativeProcessingTimesMigration from "../migrations/006_fix_negative_processing_times";

async function runMigrations() {
  logger.info("Starting manual database migration", "MIGRATION_RUNNER");

  try {
    // Get database manager instance
    const dbManager = getDatabaseManager();
    
    // Initialize database system
    await dbManager.initialize();
    
    // Get SQLite database instance
    const db = dbManager.getSQLiteDatabase();
    
    // Check current foreign key status
    const fkStatus = db.pragma("foreign_keys", { simple: true });
    logger.info(`Foreign keys status: ${fkStatus ? "ENABLED" : "DISABLED"}`, "MIGRATION_RUNNER");
    
    // Run specific migrations
    logger.info("Running Fix Negative Processing Times migration...", "MIGRATION_RUNNER");
    const migration = new FixNegativeProcessingTimesMigration(db);
    
    try {
      await migration.up();
      logger.info("Migration completed successfully", "MIGRATION_RUNNER");
    } catch (error) {
      if (error.message.includes("already exists") || error.message.includes("trigger") || error.message.includes("index")) {
        logger.info("Migration already applied or partially applied", "MIGRATION_RUNNER");
      } else {
        throw error;
      }
    }
    
    // Verify database integrity
    logger.info("Verifying database integrity...", "MIGRATION_RUNNER");
    
    // Check for negative processing times
    const negativeCheck = db.prepare(`
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN quick_processing_time < 0 THEN 1 ELSE 0 END) as negative_quick,
        SUM(CASE WHEN deep_processing_time < 0 THEN 1 ELSE 0 END) as negative_deep,
        SUM(CASE WHEN total_processing_time < 0 THEN 1 ELSE 0 END) as negative_total
      FROM email_analysis
    `).get() as any;
    
    logger.info(
      `Email Analysis Records - Total: ${negativeCheck.total_records}, ` +
      `Negative quick: ${negativeCheck.negative_quick}, ` +
      `Negative deep: ${negativeCheck.negative_deep}, ` +
      `Negative total: ${negativeCheck.negative_total}`,
      "MIGRATION_RUNNER"
    );
    
    // Check foreign key violations
    const fkViolations = db.pragma("foreign_key_check");
    if (fkViolations.length > 0) {
      logger.warn(`Found ${fkViolations.length} foreign key violations:`, "MIGRATION_RUNNER");
      fkViolations.forEach((violation: any) => {
        logger.warn(`  Table: ${violation.table}, Row: ${violation.rowid}, Parent: ${violation.parent}`, "MIGRATION_RUNNER");
      });
    } else {
      logger.info("No foreign key violations found", "MIGRATION_RUNNER");
    }
    
    // Get database statistics
    const stats = await dbManager.getStatistics();
    logger.info(`Database Statistics:`, "MIGRATION_RUNNER");
    logger.info(`  Tables: ${stats.sqlite.tables}`, "MIGRATION_RUNNER");
    logger.info(`  Indexes: ${stats.sqlite.indexes}`, "MIGRATION_RUNNER");
    logger.info(`  Emails: ${stats.sqlite.emails}`, "MIGRATION_RUNNER");
    logger.info(`  Deals: ${stats.sqlite.deals}`, "MIGRATION_RUNNER");
    
    // Close database
    await dbManager.close();
    
    logger.info("Migration runner completed successfully", "MIGRATION_RUNNER");
    process.exit(0);
  } catch (error) {
    logger.error(`Migration failed: ${error}`, "MIGRATION_RUNNER");
    process.exit(1);
  }
}

// Run migrations
runMigrations();