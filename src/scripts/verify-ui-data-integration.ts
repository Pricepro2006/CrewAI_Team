#!/usr/bin/env tsx
/**
 * Verify that UI can properly access and transform pipeline data
 */

import { getDatabaseConnection } from "../database/connection";
import { PipelineAnalysisAdapter } from "../adapters/PipelineAnalysisAdapter";
import { logger } from "../utils/logger";
import type { PipelineEmailAnalysis } from "../types/pipeline-analysis";

async function verifyUIDataIntegration() {
  logger.info(
    "Verifying UI data integration with pipeline analysis...",
    "VERIFY",
  );

  const db = getDatabaseConnection();
  const adapter = new PipelineAnalysisAdapter();

  try {
    // 1. Check if email_analysis table has the correct structure
    logger.info("1. Checking email_analysis table structure...", "VERIFY");

    const columns = db
      .prepare(`PRAGMA table_info(email_analysis)`)
      .all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    const expectedColumns = [
      "id",
      "email_id",
      "pipeline_stage",
      "pipeline_priority_score",
      "llama_analysis",
      "phi4_analysis",
      "final_model_used",
      "analysis_timestamp",
    ];

    const actualColumns = columns.map((c) => c.name);
    const missingColumns = expectedColumns.filter(
      (col) => !actualColumns.includes(col),
    );

    if (missingColumns.length > 0) {
      logger.error(`Missing columns: ${missingColumns.join(", ")}`, "VERIFY");
      return false;
    }

    logger.info("✅ Table structure is correct", "VERIFY", {
      columns: actualColumns,
    });

    // 2. Test data retrieval
    logger.info("2. Testing data retrieval...", "VERIFY");

    const sampleRecords = db
      .prepare(
        `
      SELECT * FROM email_analysis 
      ORDER BY pipeline_priority_score DESC 
      LIMIT 5
    `,
      )
      .all() as PipelineEmailAnalysis[];

    if (sampleRecords.length === 0) {
      logger.error("No analysis records found in database", "VERIFY");
      return false;
    }

    logger.info(
      `✅ Retrieved ${sampleRecords.length} sample records`,
      "VERIFY",
    );

    // 3. Test adapter transformation
    logger.info("3. Testing adapter transformation...", "VERIFY");

    let successfulTransformations = 0;
    let failedTransformations = 0;

    for (const record of sampleRecords) {
      try {
        const domainModel = adapter.fromDatabase(record);

        // Verify the transformation result
        if (domainModel.quick && domainModel.deep && domainModel.metadata) {
          successfulTransformations++;

          logger.debug("Transformation successful", "VERIFY", {
            emailId: record.email_id,
            priority: domainModel.quick.priority,
            workflow: domainModel.quick.workflow,
            model: domainModel.metadata.model,
          });
        } else {
          failedTransformations++;
          logger.warn("Incomplete transformation result", "VERIFY", {
            emailId: record.email_id,
            hasQuick: !!domainModel.quick,
            hasDeep: !!domainModel.deep,
            hasMetadata: !!domainModel.metadata,
          });
        }
      } catch (error) {
        failedTransformations++;
        logger.error(
          `Transformation failed for email ${record.email_id}`,
          "VERIFY",
          {
            error: (error as Error).message,
          },
        );
      }
    }

    logger.info("Transformation results:", "VERIFY", {
      successful: successfulTransformations,
      failed: failedTransformations,
      successRate: `${((successfulTransformations / sampleRecords.length) * 100).toFixed(1)}%`,
    });

    // 4. Test stage distribution
    logger.info("4. Checking stage distribution...", "VERIFY");

    const stageStats = db
      .prepare(
        `
      SELECT 
        pipeline_stage,
        COUNT(*) as count,
        final_model_used,
        MIN(pipeline_priority_score) as min_score,
        MAX(pipeline_priority_score) as max_score,
        AVG(pipeline_priority_score) as avg_score
      FROM email_analysis 
      GROUP BY pipeline_stage, final_model_used
      ORDER BY pipeline_stage
    `,
      )
      .all() as Array<{
      pipeline_stage: number;
      count: number;
      final_model_used: string;
      min_score: number;
      max_score: number;
      avg_score: number;
    }>;

    logger.info("Stage distribution:", "VERIFY", {
      stages: stageStats,
    });

    // 5. Test email lookup functionality
    logger.info("5. Testing email lookup functionality...", "VERIFY");

    const emailTest = db
      .prepare(
        `
      SELECT e.id, e.subject, e.sender_email, a.pipeline_priority_score
      FROM emails_enhanced e
      JOIN email_analysis a ON e.id = a.email_id
      WHERE a.pipeline_priority_score > 90
      ORDER BY a.pipeline_priority_score DESC
      LIMIT 3
    `,
      )
      .all() as Array<{
      id: string;
      subject: string;
      sender_email: string;
      pipeline_priority_score: number;
    }>;

    if (emailTest.length > 0) {
      logger.info("✅ Email-analysis join working correctly", "VERIFY", {
        highPriorityEmails: emailTest.map((e) => ({
          id: e.id,
          subject: e.subject.substring(0, 50) + "...",
          score: e.pipeline_priority_score,
        })),
      });
    } else {
      logger.warn("⚠️  No high-priority emails found in join test", "VERIFY");
    }

    // Summary
    const allTestsPassed =
      missingColumns.length === 0 &&
      sampleRecords.length > 0 &&
      successfulTransformations > failedTransformations;

    if (allTestsPassed) {
      logger.info("🎉 UI data integration verification PASSED!", "VERIFY", {
        totalRecords: sampleRecords.length,
        transformationSuccessRate: `${((successfulTransformations / sampleRecords.length) * 100).toFixed(1)}%`,
        stagesProcessed: stageStats.length,
      });
    } else {
      logger.error("❌ UI data integration verification FAILED", "VERIFY");
    }

    return allTestsPassed;
  } catch (error) {
    logger.error(
      "Verification failed with error",
      "VERIFY",
      {},
      error as Error,
    );
    return false;
  }
}

// Run verification
verifyUIDataIntegration()
  .then((success) => {
    if (success) {
      logger.info("✅ Verification completed successfully", "VERIFY");
      process.exit(0);
    } else {
      logger.error("❌ Verification failed", "VERIFY");
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error("Verification crashed", "VERIFY", {}, error as Error);
    process.exit(1);
  });
