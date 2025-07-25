#!/usr/bin/env tsx
/**
 * Clean up duplicate stage_results records
 * Keep only the most recent record for each email_id
 */

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";

async function cleanupStageResults() {
  logger.info(
    "Starting cleanup of duplicate stage_results records...",
    "CLEANUP",
  );

  const db = getDatabaseConnection();

  try {
    // Get counts before cleanup
    const beforeStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT email_id) as unique_emails
      FROM stage_results
    `,
      )
      .get() as { total_records: number; unique_emails: number };

    logger.info("Before cleanup:", "CLEANUP", beforeStats);

    // Create temporary table with deduplicated records
    logger.info(
      "Creating temporary table with deduplicated records...",
      "CLEANUP",
    );

    db.exec(`
      CREATE TEMPORARY TABLE stage_results_cleaned AS
      SELECT * FROM stage_results sr1
      WHERE sr1.id = (
        SELECT sr2.id 
        FROM stage_results sr2 
        WHERE sr2.email_id = sr1.email_id 
        ORDER BY sr2.created_at DESC, sr2.id DESC 
        LIMIT 1
      )
    `);

    // Verify the temp table
    const tempStats = db
      .prepare(
        `
      SELECT COUNT(*) as cleaned_records FROM stage_results_cleaned
    `,
      )
      .get() as { cleaned_records: number };

    logger.info("Cleaned records ready:", "CLEANUP", tempStats);

    // Replace original table with cleaned data
    logger.info("Replacing original table with cleaned data...", "CLEANUP");

    db.exec("BEGIN TRANSACTION");

    try {
      // Clear the original table
      db.exec("DELETE FROM stage_results");

      // Insert cleaned data
      db.exec(`
        INSERT INTO stage_results 
        SELECT * FROM stage_results_cleaned
      `);

      db.exec("COMMIT");

      // Verify the cleanup
      const afterStats = db
        .prepare(
          `
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT email_id) as unique_emails
        FROM stage_results
      `,
        )
        .get() as { total_records: number; unique_emails: number };

      logger.info("After cleanup:", "CLEANUP", afterStats);

      // Clean up temp table
      db.exec("DROP TABLE stage_results_cleaned");

      logger.info("Cleanup completed successfully!", "CLEANUP", {
        recordsRemoved: beforeStats.total_records - afterStats.total_records,
        uniqueEmailsPreserved: afterStats.unique_emails,
      });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    logger.error("Cleanup failed", "CLEANUP", {}, error as Error);
    throw error;
  }
}

// Run cleanup
cleanupStageResults()
  .then(() => {
    logger.info("Stage results cleanup completed successfully", "CLEANUP");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Stage results cleanup failed", "CLEANUP", {}, error as Error);
    process.exit(1);
  });
