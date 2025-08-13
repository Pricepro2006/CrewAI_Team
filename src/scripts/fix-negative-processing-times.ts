#!/usr/bin/env node

import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import path from "path";
import { up as fixNegativeProcessingTimes } from "../database/migrations/006_fix_negative_processing_times.js";

/**
 * Script to fix negative processing times in the database
 *
 * This script:
 * 1. Analyzes the current state of negative processing times
 * 2. Runs the migration to fix them
 * 3. Verifies the fix was successful
 * 4. Provides a detailed report
 */

async function main() {
  const dbPath = path.join(process.cwd(), "data", "app.db");

  logger.info(`Opening database: ${dbPath}`);
  const db = new Database(dbPath);

  try {
    // Enable foreign keys
    db.pragma("foreign_keys = ON");

    // 1. Analyze current state
    logger.info("Analyzing current database state...");

    const beforeStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN processing_time_ms < 0 THEN 1 END) as negative_records,
        MIN(processing_time_ms) as min_negative,
        MAX(processing_time_ms) as max_negative,
        AVG(CASE WHEN processing_time_ms >= 0 THEN processing_time_ms END) as avg_positive
      FROM email_analysis
    `,
      )
      .get() as any;

    logger.info("Before migration:", {
      totalRecords: beforeStats.total_records,
      negativeRecords: beforeStats.negative_records,
      percentageNegative:
        (
          (beforeStats.negative_records / beforeStats.total_records) *
          100
        ).toFixed(2) + "%",
      minNegative: beforeStats.min_negative,
      maxNegative: beforeStats.max_negative,
      avgPositive: Math.round(beforeStats.avg_positive || 0),
    });

    if (beforeStats.negative_records === 0) {
      logger.info(
        "No negative processing times found. Database is already clean!",
      );
      return;
    }

    // 2. Get some examples of negative values
    const examples = db
      .prepare(
        `
      SELECT 
        id, 
        email_id, 
        processing_time_ms,
        analysis_timestamp
      FROM email_analysis 
      WHERE processing_time_ms < 0 
      ORDER BY processing_time_ms ASC 
      LIMIT 10
    `,
      )
      .all() as any[];

    logger.info(
      "Example negative records:",
      examples.map((e) => ({
        emailId: String(e.email_id).substring(0, 8) + "...",
        processingTime: e.processing_time_ms,
        timestamp: e.analysis_timestamp,
      })),
    );

    // 3. Run the migration
    logger.info("Running migration to fix negative processing times...");
    fixNegativeProcessingTimes(db);

    // 4. Verify the fix
    logger.info("Verifying the fix...");

    const afterStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN processing_time_ms < 0 THEN 1 END) as negative_records,
        MIN(processing_time_ms) as min_time,
        MAX(processing_time_ms) as max_time,
        AVG(processing_time_ms) as avg_time
      FROM email_analysis
    `,
      )
      .get() as any;

    logger.info("After migration:", {
      totalRecords: afterStats.total_records,
      negativeRecords: afterStats.negative_records,
      minTime: afterStats.min_time,
      maxTime: afterStats.max_time,
      avgTime: Math.round(afterStats.avg_time || 0),
    });

    // 5. Check backup table
    const backupCount = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM email_analysis_backup_neg_times
    `,
      )
      .get() as any;

    logger.info(`Backup table contains ${backupCount.count} records`);

    // 6. Test triggers
    logger.info("Testing triggers to ensure future protection...");

    try {
      // This should fail
      db.prepare(
        `
        INSERT INTO email_analysis (
          id, email_id, processing_time_ms
        ) VALUES (?, ?, ?)
      `,
      ).run("test-negative-" + Date.now(), "test-email", -100);

      logger.error("TRIGGER TEST FAILED: Negative value was allowed!");
    } catch (error) {
      logger.info("✓ Trigger test passed: Negative values are now prevented");
    }

    // 7. Summary report
    logger.info("\n=== MIGRATION SUMMARY ===");
    logger.info(
      `Fixed ${beforeStats.negative_records} records with negative processing times`,
    );
    logger.info(
      `Database now has ${afterStats.negative_records} negative records (should be 0)`,
    );
    logger.info("Triggers installed to prevent future negative values");
    logger.info(
      "Backup data preserved in email_analysis_backup_neg_times table",
    );
    logger.info("=========================\n");

    if (afterStats.negative_records > 0) {
      logger.error("WARNING: Some negative records still exist!");
      process.exit(1);
    }
  } catch (error) {
    logger.error("Migration failed:", error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the script
main().catch((error) => {
  logger.error("Script failed:", error);
  process.exit(1);
});
