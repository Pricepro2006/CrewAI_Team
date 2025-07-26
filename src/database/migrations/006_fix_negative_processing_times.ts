/**
 * Migration: Fix Negative Processing Times
 * 
 * This migration fixes data integrity issues where processing times
 * have negative values (approximately 30% of email records).
 * It also adds CHECK constraints to prevent future occurrences.
 */

import type { Database } from "better-sqlite3";
import { logger } from "../../utils/logger";

export default class FixNegativeProcessingTimesMigration {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async up(): Promise<void> {
    logger.info("Starting migration: Fix negative processing times", "MIGRATION");

    try {
      // Start a transaction for data integrity
      const transaction = this.db.transaction(() => {
        // Step 1: Fix existing negative processing times in email_analysis table
        const fixEmailAnalysis = this.db.prepare(`
          UPDATE email_analysis
          SET 
            quick_processing_time = ABS(quick_processing_time)
          WHERE quick_processing_time < 0
        `);
        const quickFixed = fixEmailAnalysis.run();
        logger.info(`Fixed ${quickFixed.changes} negative quick_processing_time values`, "MIGRATION");

        const fixDeepProcessing = this.db.prepare(`
          UPDATE email_analysis
          SET 
            deep_processing_time = ABS(deep_processing_time)
          WHERE deep_processing_time < 0
        `);
        const deepFixed = fixDeepProcessing.run();
        logger.info(`Fixed ${deepFixed.changes} negative deep_processing_time values`, "MIGRATION");

        const fixTotalProcessing = this.db.prepare(`
          UPDATE email_analysis
          SET 
            total_processing_time = ABS(total_processing_time)
          WHERE total_processing_time < 0
        `);
        const totalFixed = fixTotalProcessing.run();
        logger.info(`Fixed ${totalFixed.changes} negative total_processing_time values`, "MIGRATION");

        // Step 2: Fix negative processing times in messages table
        const fixMessages = this.db.prepare(`
          UPDATE messages
          SET 
            processing_time = ABS(processing_time)
          WHERE processing_time < 0
        `);
        const messagesFixed = fixMessages.run();
        logger.info(`Fixed ${messagesFixed.changes} negative processing_time values in messages`, "MIGRATION");

        // Step 3: Fix any zero processing times that should have a value
        // Set minimum processing time to 1ms for non-null values
        const fixZeroTimes = this.db.prepare(`
          UPDATE email_analysis
          SET 
            quick_processing_time = 1
          WHERE quick_processing_time = 0 AND quick_processing_time IS NOT NULL
        `);
        const zeroFixed = fixZeroTimes.run();
        logger.info(`Fixed ${zeroFixed.changes} zero processing_time values`, "MIGRATION");

        // Step 4: Ensure total_processing_time is at least the sum of stage times
        const fixTotalConsistency = this.db.prepare(`
          UPDATE email_analysis
          SET total_processing_time = 
            COALESCE(quick_processing_time, 0) + COALESCE(deep_processing_time, 0)
          WHERE total_processing_time < (COALESCE(quick_processing_time, 0) + COALESCE(deep_processing_time, 0))
        `);
        const consistencyFixed = fixTotalConsistency.run();
        logger.info(`Fixed ${consistencyFixed.changes} inconsistent total_processing_time values`, "MIGRATION");

        // Step 5: Add CHECK constraints to prevent future negative values
        // Note: SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we need to recreate tables
        // For now, we'll create a trigger to prevent negative values
        
        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS prevent_negative_processing_times_insert
          BEFORE INSERT ON email_analysis
          BEGIN
            SELECT CASE
              WHEN NEW.quick_processing_time < 0 THEN
                RAISE(ABORT, 'quick_processing_time cannot be negative')
              WHEN NEW.deep_processing_time < 0 THEN
                RAISE(ABORT, 'deep_processing_time cannot be negative')
              WHEN NEW.total_processing_time < 0 THEN
                RAISE(ABORT, 'total_processing_time cannot be negative')
            END;
          END;
        `);

        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS prevent_negative_processing_times_update
          BEFORE UPDATE ON email_analysis
          BEGIN
            SELECT CASE
              WHEN NEW.quick_processing_time < 0 THEN
                RAISE(ABORT, 'quick_processing_time cannot be negative')
              WHEN NEW.deep_processing_time < 0 THEN
                RAISE(ABORT, 'deep_processing_time cannot be negative')
              WHEN NEW.total_processing_time < 0 THEN
                RAISE(ABORT, 'total_processing_time cannot be negative')
            END;
          END;
        `);

        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS prevent_negative_message_processing_time_insert
          BEFORE INSERT ON messages
          BEGIN
            SELECT CASE
              WHEN NEW.processing_time < 0 THEN
                RAISE(ABORT, 'processing_time cannot be negative')
            END;
          END;
        `);

        this.db.exec(`
          CREATE TRIGGER IF NOT EXISTS prevent_negative_message_processing_time_update
          BEFORE UPDATE ON messages
          BEGIN
            SELECT CASE
              WHEN NEW.processing_time < 0 THEN
                RAISE(ABORT, 'processing_time cannot be negative')
            END;
          END;
        `);

        logger.info("Added triggers to prevent negative processing times", "MIGRATION");

        // Step 6: Create index on processing_time columns for performance
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_email_analysis_processing_times 
          ON email_analysis(quick_processing_time, deep_processing_time, total_processing_time);
          
          CREATE INDEX IF NOT EXISTS idx_messages_processing_time 
          ON messages(processing_time);
        `);

        logger.info("Added indexes on processing_time columns", "MIGRATION");
      });

      // Execute the transaction
      transaction();

      // Verify the fix
      const verifyResult = this.db.prepare(`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN quick_processing_time < 0 THEN 1 ELSE 0 END) as negative_quick,
          SUM(CASE WHEN deep_processing_time < 0 THEN 1 ELSE 0 END) as negative_deep,
          SUM(CASE WHEN total_processing_time < 0 THEN 1 ELSE 0 END) as negative_total
        FROM email_analysis
      `).get() as any;

      logger.info(
        `Verification - Total records: ${verifyResult.total_records}, ` +
        `Negative quick: ${verifyResult.negative_quick}, ` +
        `Negative deep: ${verifyResult.negative_deep}, ` +
        `Negative total: ${verifyResult.negative_total}`,
        "MIGRATION"
      );

      if (verifyResult.negative_quick > 0 || verifyResult.negative_deep > 0 || verifyResult.negative_total > 0) {
        throw new Error("Migration failed: Negative processing times still exist");
      }

      logger.info("Migration completed successfully: Fixed negative processing times", "MIGRATION");
    } catch (error) {
      logger.error(`Migration failed: ${error}`, "MIGRATION");
      throw error;
    }
  }

  async down(): Promise<void> {
    logger.info("Reverting migration: Fix negative processing times", "MIGRATION");

    try {
      // Remove triggers
      this.db.exec(`
        DROP TRIGGER IF EXISTS prevent_negative_processing_times_insert;
        DROP TRIGGER IF EXISTS prevent_negative_processing_times_update;
        DROP TRIGGER IF EXISTS prevent_negative_message_processing_time_insert;
        DROP TRIGGER IF EXISTS prevent_negative_message_processing_time_update;
      `);

      // Remove indexes
      this.db.exec(`
        DROP INDEX IF EXISTS idx_email_analysis_processing_times;
        DROP INDEX IF EXISTS idx_messages_processing_time;
      `);

      logger.info("Migration reverted: Removed triggers and indexes", "MIGRATION");
    } catch (error) {
      logger.error(`Migration revert failed: ${error}`, "MIGRATION");
      throw error;
    }
  }

  /**
   * Get migration metadata
   */
  get metadata() {
    return {
      version: 6,
      name: "fix_negative_processing_times",
      description: "Fix negative processing times and add constraints to prevent future occurrences",
      createdAt: new Date("2025-01-26"),
      dependencies: []
    };
  }
}