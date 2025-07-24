#!/usr/bin/env tsx
/**
 * Clean up duplicate email_analysis records
 * Keep only the most recent record for each email_id
 */

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";

async function cleanupDuplicateAnalysis() {
  logger.info(
    "Starting cleanup of duplicate email_analysis records...",
    "CLEANUP",
  );

  const db = getDatabaseConnection();

  try {
    // First, let's see the extent of the problem
    const duplicateStats = db
      .prepare(
        `
      SELECT 
        email_id,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(id) as record_ids
      FROM email_analysis 
      GROUP BY email_id 
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 10
    `,
      )
      .all();

    logger.info(`Found duplicate analysis records:`, "CLEANUP", {
      sampleDuplicates: duplicateStats,
    });

    // Get total counts before cleanup
    const beforeStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT email_id) as unique_emails
      FROM email_analysis
    `,
      )
      .get() as { total_records: number; unique_emails: number };

    logger.info("Before cleanup:", "CLEANUP", beforeStats);

    // Create a temporary table with the records we want to keep (most recent for each email_id)
    logger.info(
      "Creating temporary table with deduplicated records...",
      "CLEANUP",
    );

    db.exec(`
      CREATE TEMPORARY TABLE email_analysis_cleaned AS
      SELECT * FROM email_analysis ea1
      WHERE ea1.id = (
        SELECT ea2.id 
        FROM email_analysis ea2 
        WHERE ea2.email_id = ea1.email_id 
        ORDER BY ea2.analysis_timestamp DESC, ea2.id DESC 
        LIMIT 1
      )
    `);

    // Verify the temp table
    const tempStats = db
      .prepare(
        `
      SELECT COUNT(*) as cleaned_records FROM email_analysis_cleaned
    `,
      )
      .get() as { cleaned_records: number };

    logger.info("Cleaned records ready:", "CLEANUP", tempStats);

    // Backup the current table
    const backupName = `email_analysis_backup_${Date.now()}`;
    db.exec(`CREATE TABLE ${backupName} AS SELECT * FROM email_analysis`);
    logger.info(`Backup created: ${backupName}`, "CLEANUP");

    // Replace the original table with cleaned data
    logger.info("Replacing original table with cleaned data...", "CLEANUP");

    db.exec("BEGIN TRANSACTION");

    try {
      // Clear the original table
      db.exec("DELETE FROM email_analysis");

      // Insert cleaned data
      db.exec(`
        INSERT INTO email_analysis 
        SELECT * FROM email_analysis_cleaned
      `);

      db.exec("COMMIT");

      // Verify the cleanup
      const afterStats = db
        .prepare(
          `
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT email_id) as unique_emails
        FROM email_analysis
      `,
        )
        .get() as { total_records: number; unique_emails: number };

      logger.info("After cleanup:", "CLEANUP", afterStats);

      // Check for any remaining duplicates
      const remainingDuplicates = db
        .prepare(
          `
        SELECT COUNT(*) as duplicate_count
        FROM (
          SELECT email_id, COUNT(*) as cnt 
          FROM email_analysis 
          GROUP BY email_id 
          HAVING COUNT(*) > 1
        )
      `,
        )
        .get() as { duplicate_count: number };

      if (remainingDuplicates.duplicate_count === 0) {
        logger.info(
          "✅ Cleanup successful - no duplicates remaining!",
          "CLEANUP",
        );
      } else {
        logger.warn(
          `⚠️  ${remainingDuplicates.duplicate_count} emails still have duplicates`,
          "CLEANUP",
        );
      }

      // Clean up temp table
      db.exec("DROP TABLE email_analysis_cleaned");

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
cleanupDuplicateAnalysis()
  .then(() => {
    logger.info("Duplicate cleanup completed successfully", "CLEANUP");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Duplicate cleanup failed", "CLEANUP", {}, error as Error);
    process.exit(1);
  });
