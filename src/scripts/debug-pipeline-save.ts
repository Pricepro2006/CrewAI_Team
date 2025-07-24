#!/usr/bin/env tsx
/**
 * Debug script to trace pipeline save issues
 */

import Database from "better-sqlite3";
import { logger } from "../utils/logger";
import path from "path";

async function debugPipelineSave() {
  logger.info("Debugging pipeline save issue...", "DEBUG");

  const dbPath = path.join(process.cwd(), "data", "crewai.db");
  const db = new Database(dbPath, { readonly: true });

  try {
    // Check latest execution
    const latestExecution = db
      .prepare(
        `
      SELECT * FROM pipeline_executions 
      ORDER BY id DESC 
      LIMIT 1
    `,
      )
      .get() as any;

    logger.info("Latest execution:", "DEBUG", latestExecution);

    // Check email_analysis records
    const analysisCount = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total,
        COUNT(pipeline_stage) as with_pipeline,
        COUNT(llama_analysis) as with_llama,
        COUNT(phi4_analysis) as with_phi4
      FROM email_analysis
    `,
      )
      .get() as any;

    logger.info("Email analysis counts:", "DEBUG", analysisCount);

    // Check stage_results
    const stageResults = db
      .prepare(
        `
      SELECT 
        stage,
        COUNT(*) as count,
        AVG(priority_score) as avg_score,
        AVG(processing_time_seconds) as avg_time
      FROM stage_results
      GROUP BY stage
    `,
      )
      .all() as any[];

    logger.info("Stage results summary:", "DEBUG");
    stageResults.forEach((result) => {
      logger.info(`Stage ${result.stage}:`, "DEBUG", result);
    });

    // Check if there are any records with execution_id
    if (latestExecution) {
      const executionRecords = db
        .prepare(
          `
        SELECT COUNT(*) as count
        FROM stage_results
        WHERE execution_id = ?
      `,
        )
        .get(latestExecution.id) as any;

      logger.info(
        `Records for execution ${latestExecution.id}: ${executionRecords.count}`,
        "DEBUG",
      );
    }

    // Sample email_analysis records
    const sampleAnalysis = db
      .prepare(
        `
      SELECT 
        email_id,
        pipeline_stage,
        pipeline_priority_score,
        final_model_used,
        analysis_timestamp,
        LENGTH(llama_analysis) as llama_length,
        LENGTH(phi4_analysis) as phi4_length
      FROM email_analysis
      WHERE pipeline_stage IS NOT NULL
      ORDER BY analysis_timestamp DESC
      LIMIT 5
    `,
      )
      .all() as any[];

    logger.info("Sample email_analysis records:", "DEBUG");
    sampleAnalysis.forEach((record) => {
      logger.info(`Email ${record.email_id}:`, "DEBUG", record);
    });

    // Check for recent saves
    const recentSaves = db
      .prepare(
        `
      SELECT 
        datetime(analysis_timestamp) as saved_at,
        COUNT(*) as count
      FROM email_analysis
      WHERE pipeline_stage IS NOT NULL
      AND analysis_timestamp > datetime('now', '-1 hour')
      GROUP BY datetime(analysis_timestamp)
      ORDER BY saved_at DESC
      LIMIT 10
    `,
      )
      .all() as any[];

    logger.info("Recent saves:", "DEBUG");
    recentSaves.forEach((save) => {
      logger.info(`${save.saved_at}: ${save.count} records`, "DEBUG");
    });
  } catch (error) {
    logger.error("Debug failed", "DEBUG", {}, error as Error);
  } finally {
    db.close();
  }
}

// Run debug
debugPipelineSave();
