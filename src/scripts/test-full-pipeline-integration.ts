#!/usr/bin/env tsx
/**
 * Test script to verify pipeline integration is working
 */

import Database from "better-sqlite3";
import { PipelineAnalysisAdapter } from "../adapters/PipelineAnalysisAdapter";
import { logger } from "../utils/logger";
import path from "path";

async function testPipelineIntegration() {
  logger.info("Testing pipeline integration...", "INTEGRATION_TEST");

  // Use crewai.db where pipeline data is stored
  const dbPath = path.join(process.cwd(), "data", "crewai.db");
  const db = new Database(dbPath, { readonly: true });
  const adapter = new PipelineAnalysisAdapter();

  try {
    // Check pipeline data
    const pipelineCount = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM email_analysis 
      WHERE pipeline_stage IS NOT NULL
    `,
      )
      .get() as { count: number };

    logger.info(
      `Total pipeline records: ${pipelineCount.count}`,
      "INTEGRATION_TEST",
    );

    // Get sample data from each stage
    const stages = [1, 2, 3];

    for (const stage of stages) {
      const stageData = db
        .prepare(
          `
        SELECT * FROM email_analysis 
        WHERE pipeline_stage >= ? 
        LIMIT 1
      `,
        )
        .get(stage) as any;

      if (stageData) {
        logger.info(`Stage ${stage} sample:`, "INTEGRATION_TEST", {
          emailId: stageData.email_id,
          stage: stageData.pipeline_stage,
          model: stageData.final_model_used,
          hasLlama: !!stageData.llama_analysis,
          hasPhi4: !!stageData.phi4_analysis,
        });

        // Test adapter transformation
        try {
          const result = adapter.fromDatabase(stageData);
          logger.info(
            `Adapter transformation successful for stage ${stage}:`,
            "INTEGRATION_TEST",
            {
              hasQuick: !!result.quick,
              hasDeep: !!result.deep,
              priority: result.quick.priority,
              workflow: result.quick.workflow,
              confidence: result.metadata.confidence,
            },
          );

          // Log some deep analysis details
          if (result.deep && stage >= 2) {
            logger.info(`Deep analysis sample:`, "INTEGRATION_TEST", {
              summary: result.deep.summary.substring(0, 100) + "...",
              actionItems: result.deep.actionItems.length,
              entities: {
                po: result.deep.entities.po_numbers.length,
                quotes: result.deep.entities.quote_numbers.length,
                parts: result.deep.entities.part_numbers.length,
              },
            });
          }
        } catch (error) {
          logger.error(
            `Adapter transformation failed for stage ${stage}`,
            "INTEGRATION_TEST",
            {},
            error as Error,
          );
        }
      }
    }

    // Test batch transformation
    const batchData = db
      .prepare(
        `
      SELECT * FROM email_analysis 
      WHERE pipeline_stage IS NOT NULL 
      LIMIT 10
    `,
      )
      .all() as any[];

    const batchResults = await adapter.batchFromDatabase(batchData);
    logger.info(
      `Batch transformation: ${batchResults.length} successful`,
      "INTEGRATION_TEST",
    );

    // Summary
    logger.info("Integration Test Summary:", "INTEGRATION_TEST", {
      totalPipelineRecords: pipelineCount.count,
      adapterWorking: batchResults.length > 0,
      status: "SUCCESS",
    });
  } catch (error) {
    logger.error(
      "Integration test failed",
      "INTEGRATION_TEST",
      {},
      error as Error,
    );
    throw error;
  } finally {
    db.close();
  }
}

// Run test
testPipelineIntegration()
  .then(() => {
    logger.info(
      "✅ Pipeline integration test completed successfully",
      "INTEGRATION_TEST",
    );
    process.exit(0);
  })
  .catch((error) => {
    logger.error(
      "❌ Pipeline integration test failed",
      "INTEGRATION_TEST",
      {},
      error as Error,
    );
    process.exit(1);
  });
