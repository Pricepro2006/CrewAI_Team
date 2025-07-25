#!/usr/bin/env tsx
/**
 * Test script to verify UI integration with pipeline data
 */

import Database from "better-sqlite3";
import { EmailStorageService } from "../api/services/EmailStorageService";
import { logger } from "../utils/logger";
import path from "path";

async function testUIIntegration() {
  logger.info("Testing UI integration with pipeline data...", "TEST_UI");

  const dbPath = path.join(process.cwd(), "data", "app.db");
  const service = new EmailStorageService(dbPath);

  try {
    // Test 1: Get dashboard stats
    const stats = await service.getDashboardStats();
    logger.info(`Total emails in database: ${stats.totalEmails}`, "TEST_UI");

    // Test 2: Get emails with analysis
    const tableViewResult = await service.getEmailsForTableView({
      pageSize: 5,
      page: 1,
    });

    const emailsWithAnalysis = tableViewResult.emails || [];
    logger.info(`Retrieved ${emailsWithAnalysis.length} emails`, "TEST_UI");

    // Test 3: Check if analysis data is present
    let analysisCount = 0;
    for (const email of emailsWithAnalysis) {
      const emailWithAnalysis = await service.getEmailWithAnalysis(email.id);
      if (emailWithAnalysis?.analysis) {
        analysisCount++;
        logger.info(`Email ${email.id} has analysis data:`, "TEST_UI", {
          quick: emailWithAnalysis.analysis.quick ? "Yes" : "No",
          deep: emailWithAnalysis.analysis.deep ? "Yes" : "No",
          metadata: emailWithAnalysis.analysis.processingMetadata ? "Yes" : "No",
        });

        // Log sample analysis data
        if (analysisCount === 1) {
          logger.info("Sample analysis data:", "TEST_UI", {
            priority: emailWithAnalysis.analysis.quick?.priority,
            workflow: emailWithAnalysis.analysis.quick?.workflow,
            businessProcess: emailWithAnalysis.analysis.deep?.detailedWorkflow?.primary,
            model: emailWithAnalysis.analysis.processingMetadata?.model,
            confidence: emailWithAnalysis.analysis.processingMetadata?.confidence,
          });
        }
      }
    }

    logger.info(
      `Emails with analysis: ${analysisCount}/${emailsWithAnalysis.length}`,
      "TEST_UI",
    );

    // Test 4: Test table view with search
    const searchTableResult = await service.getEmailsForTableView({
      search: "order",
      pageSize: 5,
      page: 1,
    });

    logger.info(
      `Search results for "order": ${searchTableResult.emails?.length || 0} emails`,
      "TEST_UI",
    );

    // Test 5: Check pipeline data directly
    const db = new Database(dbPath, { readonly: true });
    const pipelineCount = db
      .prepare("SELECT COUNT(*) as count FROM email_analysis")
      .get() as { count: number };
    logger.info(
      `Total pipeline analysis records: ${pipelineCount.count}`,
      "TEST_UI",
    );

    // Sample pipeline data
    const samplePipeline = db
      .prepare(
        `
      SELECT * FROM email_analysis 
      WHERE llama_analysis IS NOT NULL 
      LIMIT 1
    `,
      )
      .get() as any;

    if (samplePipeline) {
      logger.info("Sample pipeline record found:", "TEST_UI", {
        emailId: samplePipeline.email_id,
        stage: samplePipeline.pipeline_stage,
        model: samplePipeline.final_model_used,
        hasLlamaAnalysis: !!samplePipeline.llama_analysis,
        hasPhi4Analysis: !!samplePipeline.phi4_analysis,
      });
    }

    db.close();

    // Summary
    logger.info("UI Integration Test Summary:", "TEST_UI", {
      totalEmails: stats.totalEmails,
      pipelineRecords: pipelineCount.count,
      emailsWithAnalysis: analysisCount,
      integrationStatus: analysisCount > 0 ? "SUCCESS" : "NEEDS_PIPELINE_RUN",
    });

    if (analysisCount === 0) {
      logger.warn(
        "No emails have analysis data. Please run the pipeline first.",
        "TEST_UI",
      );
      logger.info("Run: npm run pipeline:run", "TEST_UI");
    } else {
      logger.info("✅ UI integration is working correctly!", "TEST_UI");
    }
  } catch (error) {
    logger.error("UI integration test failed", "TEST_UI", {}, error as Error);
    throw error;
  }
}

// Run the test
testUIIntegration()
  .then(() => {
    logger.info("UI integration test completed", "TEST_UI");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("UI integration test failed", "TEST_UI", {}, error as Error);
    process.exit(1);
  });
