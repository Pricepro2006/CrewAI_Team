#!/usr/bin/env tsx
/**
 * Test script to run pipeline on a small batch
 */

import { PipelineOrchestrator } from "../core/pipeline/PipelineOrchestrator";
import { logger } from "../utils/logger";
import Database from "better-sqlite3";
import path from "path";

async function testPipelineRun() {
  logger.info("Starting test pipeline run...", "PIPELINE_TEST");

  const dbPath = path.join(process.cwd(), "data", "app.db");
  const db = new Database(dbPath);

  try {
    // Get 5 emails without pipeline analysis
    const emails = db
      .prepare(
        `
      SELECT e.id, e.id as message_id, e.subject, e.body_preview as body, 
             e.sender_email, e.received_at as date_received
      FROM emails e
      WHERE e.id NOT IN (
        SELECT email_id FROM email_analysis WHERE pipeline_stage IS NOT NULL
      )
      LIMIT 5
    `,
      )
      .all() as any[];

    logger.info(`Found ${emails.length} emails to process`, "PIPELINE_TEST");

    if (emails.length === 0) {
      logger.info(
        "All emails already have pipeline analysis!",
        "PIPELINE_TEST",
      );
      return;
    }

    // Initialize pipeline
    const pipeline = new PipelineOrchestrator({
      batchSize: 5,
      maxConcurrency: 1,
      stage2Limit: 3,
      stage3Limit: 1,
      mockMode: true, // Use mock mode for testing
    });

    // Process emails
    logger.info("Processing emails through pipeline...", "PIPELINE_TEST");
    const results = await pipeline.runThreeStagePipeline();

    logger.info("Pipeline results:", "PIPELINE_TEST", {
      stage1Count: results.stage1Count,
      stage2Count: results.stage2Count,
      stage3Count: results.stage3Count,
      totalEmails: results.totalEmails,
      executionId: results.executionId,
    });

    // Verify data was saved
    const savedCount = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM email_analysis 
      WHERE pipeline_stage IS NOT NULL 
      AND email_id IN (${emails.map(() => "?").join(",")})
    `,
      )
      .get(...emails.map((e) => e.id)) as { count: number };

    logger.info(
      `Emails saved to database: ${savedCount.count}/${emails.length}`,
      "PIPELINE_TEST",
    );

    // Sample saved data
    const sampleData = db
      .prepare(
        `
      SELECT email_id, pipeline_stage, pipeline_priority_score, 
             final_model_used, analysis_timestamp
      FROM email_analysis
      WHERE pipeline_stage IS NOT NULL
      AND email_id = ?
      LIMIT 1
    `,
      )
      .get(emails[0].id) as any;

    if (sampleData) {
      logger.info("Sample saved pipeline data:", "PIPELINE_TEST", sampleData);
    }
  } catch (error) {
    logger.error("Pipeline test failed", "PIPELINE_TEST", {}, error as Error);
    throw error;
  } finally {
    db.close();
  }
}

// Run test
testPipelineRun()
  .then(() => {
    logger.info("Pipeline test completed successfully", "PIPELINE_TEST");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Pipeline test failed", "PIPELINE_TEST", {}, error as Error);
    process.exit(1);
  });
