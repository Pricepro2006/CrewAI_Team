#!/usr/bin/env tsx

/**
 * Script to fix negative processing times in the database
 * Run with: pnpm tsx src/scripts/fix-negative-processing-times.ts
 */

import { getDatabaseManager } from "../database/DatabaseManager";
import { EmailAnalyticsService } from "../core/database/EmailAnalyticsService";
import { logger } from "../utils/logger";
import FixNegativeProcessingTimesMigration from "../database/migrations/006_fix_negative_processing_times";

async function main() {
  logger.info("Starting negative processing time fix", "SCRIPT");

  try {
    // Initialize database
    const dbManager = getDatabaseManager();
    const db = dbManager.getSQLiteDatabase();

    // Get initial statistics
    const emailAnalytics = EmailAnalyticsService.getInstance();
    const beforeStats = await emailAnalytics.getProcessingStats();
    
    logger.info("Before fix statistics:", "SCRIPT", {
      totalEmails: beforeStats.totalEmails,
      emailsWithNegativeTimes: beforeStats.emailsWithNegativeTimes,
      percentageWithIssues: ((beforeStats.emailsWithNegativeTimes / beforeStats.totalEmails) * 100).toFixed(2) + '%',
      avgStage1Time: beforeStats.avgStage1Time.toFixed(2) + 'ms',
      avgStage2Time: beforeStats.avgStage2Time.toFixed(2) + 'ms',
      avgTotalTime: beforeStats.avgTotalTime.toFixed(2) + 'ms'
    });

    // Run the migration
    logger.info("Running migration to fix negative processing times", "SCRIPT");
    const migration = new FixNegativeProcessingTimesMigration(db);
    await migration.up();

    // Use EmailAnalyticsService to fix any remaining issues
    logger.info("Running additional cleanup with EmailAnalyticsService", "SCRIPT");
    const fixResult = await emailAnalytics.fixNegativeProcessingTimes();
    
    logger.info("Additional cleanup results:", "SCRIPT", {
      fixed: fixResult.fixed,
      errors: fixResult.errors
    });

    // Get final statistics
    const afterStats = await emailAnalytics.getProcessingStats();
    
    logger.info("After fix statistics:", "SCRIPT", {
      totalEmails: afterStats.totalEmails,
      emailsWithNegativeTimes: afterStats.emailsWithNegativeTimes,
      percentageWithIssues: ((afterStats.emailsWithNegativeTimes / afterStats.totalEmails) * 100).toFixed(2) + '%',
      avgStage1Time: afterStats.avgStage1Time.toFixed(2) + 'ms',
      avgStage2Time: afterStats.avgStage2Time.toFixed(2) + 'ms',
      avgTotalTime: afterStats.avgTotalTime.toFixed(2) + 'ms'
    });

    // Verify all negative times are fixed
    if (afterStats.emailsWithNegativeTimes === 0) {
      logger.info("✅ SUCCESS: All negative processing times have been fixed!", "SCRIPT");
    } else {
      logger.error(`❌ ERROR: ${afterStats.emailsWithNegativeTimes} emails still have negative processing times`, "SCRIPT");
      
      // Show sample of remaining issues
      const remainingIssues = db.prepare(`
        SELECT 
          email_id,
          quick_processing_time,
          deep_processing_time,
          total_processing_time
        FROM email_analysis
        WHERE 
          quick_processing_time < 0 
          OR deep_processing_time < 0 
          OR total_processing_time < 0
        LIMIT 5
      `).all();
      
      logger.error("Sample of remaining issues:", "SCRIPT", remainingIssues);
    }

    // Create detailed report
    const report = db.prepare(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN quick_processing_time IS NOT NULL THEN 1 END) as with_quick_time,
        COUNT(CASE WHEN deep_processing_time IS NOT NULL THEN 1 END) as with_deep_time,
        MIN(quick_processing_time) as min_quick_time,
        MAX(quick_processing_time) as max_quick_time,
        MIN(deep_processing_time) as min_deep_time,
        MAX(deep_processing_time) as max_deep_time,
        MIN(total_processing_time) as min_total_time,
        MAX(total_processing_time) as max_total_time
      FROM email_analysis
    `).get() as any;

    logger.info("Final database report:", "SCRIPT", {
      totalRecords: report.total_records,
      recordsWithQuickTime: report.with_quick_time,
      recordsWithDeepTime: report.with_deep_time,
      quickTimeRange: `${report.min_quick_time}ms - ${report.max_quick_time}ms`,
      deepTimeRange: `${report.min_deep_time}ms - ${report.max_deep_time}ms`,
      totalTimeRange: `${report.min_total_time}ms - ${report.max_total_time}ms`
    });

    logger.info("Script completed successfully", "SCRIPT");
    process.exit(0);
  } catch (error) {
    logger.error("Script failed with error", "SCRIPT", error as Error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});