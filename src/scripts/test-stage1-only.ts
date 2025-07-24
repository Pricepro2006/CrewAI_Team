#!/usr/bin/env tsx
/**
 * Test script to run only Stage 1 and verify saving
 */

import { PipelineOrchestrator } from "../core/pipeline/PipelineOrchestrator";
import { logger } from "../utils/logger";
import Database from "better-sqlite3";
import path from "path";

async function testStage1Only() {
  logger.info("Testing Stage 1 pipeline execution...", "STAGE1_TEST");

  const dbPath = path.join(process.cwd(), "data", "crewai.db");

  try {
    // Initialize pipeline with mock mode
    const pipeline = new PipelineOrchestrator({
      batchSize: 10,
      maxConcurrency: 1,
      stage2Limit: 0, // Don't run stage 2
      stage3Limit: 0, // Don't run stage 3
      mockMode: true,
    });

    // Run the pipeline
    logger.info("Starting pipeline...", "STAGE1_TEST");
    const results = await pipeline.runThreeStagePipeline();

    logger.info("Pipeline completed:", "STAGE1_TEST", {
      totalProcessed: results.summary.totalProcessed,
      stage1Count: results.stage1Results.length,
      executionTime: results.summary.executionTime,
    });

    // Check if data was saved
    const db = new Database(dbPath, { readonly: true });

    const savedCount = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM email_analysis 
      WHERE pipeline_stage IS NOT NULL 
      AND analysis_timestamp > datetime('now', '-5 minutes')
    `,
      )
      .get() as { count: number };

    logger.info(
      `Emails saved in last 5 minutes: ${savedCount.count}`,
      "STAGE1_TEST",
    );

    // Check execution record
    const latestExecution = db
      .prepare(
        `
      SELECT * FROM pipeline_executions 
      ORDER BY id DESC 
      LIMIT 1
    `,
      )
      .get() as any;

    logger.info("Latest execution record:", "STAGE1_TEST", latestExecution);

    db.close();
  } catch (error) {
    logger.error("Stage 1 test failed", "STAGE1_TEST", {}, error as Error);
    throw error;
  }
}

// Run test
testStage1Only()
  .then(() => {
    logger.info("Stage 1 test completed", "STAGE1_TEST");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Stage 1 test failed", "STAGE1_TEST", {}, error as Error);
    process.exit(1);
  });
