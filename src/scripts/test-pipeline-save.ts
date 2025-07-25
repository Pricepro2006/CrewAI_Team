/**
 * Simple test to verify pipeline saves data to database
 */

import { getDatabaseConnection } from "../database/connection";
import { PipelineOrchestrator } from "../core/pipeline/PipelineOrchestrator";
import { logger } from "../utils/logger";

async function testPipelineSave() {
  const db = getDatabaseConnection();

  try {
    // Check how many emails we have
    const emailCount = db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
      .get() as { count: number };
    logger.info(`Found ${emailCount.count} total emails in database`, "TEST");

    // Check existing analysis
    const analysisCount = db
      .prepare("SELECT COUNT(*) as count FROM email_analysis")
      .get() as { count: number };
    logger.info(
      `Found ${analysisCount.count} existing analysis records`,
      "TEST",
    );

    // Get a small batch of emails without analysis
    const unanalyzedEmails = db
      .prepare(
        `
      SELECT ee.* 
      FROM emails_enhanced ee
      LEFT JOIN email_analysis ea ON ee.id = ea.email_id
      WHERE ea.email_id IS NULL
      LIMIT 5
    `,
      )
      .all();

    logger.info(
      `Found ${unanalyzedEmails.length} emails without analysis`,
      "TEST",
    );

    if (unanalyzedEmails.length === 0) {
      logger.warn(
        "No unanalyzed emails found. Getting first 5 emails to re-analyze.",
        "TEST",
      );
      const firstEmails = db
        .prepare("SELECT * FROM emails_enhanced LIMIT 5")
        .all();

      if (firstEmails.length === 0) {
        logger.error("No emails found in database!", "TEST");
        return;
      }

      // Test with first 5 emails
      await testWithEmails(firstEmails.map(formatEmail));
    } else {
      // Test with unanalyzed emails
      await testWithEmails(unanalyzedEmails.map(formatEmail));
    }
  } catch (error) {
    logger.error("Test failed", "TEST", error as Error);
  }
}

function formatEmail(dbEmail: any) {
  return {
    id: dbEmail.id,
    message_id: dbEmail.message_id,
    subject: dbEmail.subject,
    sender_email: dbEmail.sender_email,
    recipient_emails: dbEmail.recipients,
    date_received: dbEmail.received_at,
    body: dbEmail.body_text || "",
    folder: dbEmail.categories || "inbox",
    is_read: Boolean(dbEmail.is_read),
    created_at: dbEmail.created_at,
    updated_at: dbEmail.updated_at,
  };
}

async function testWithEmails(emails: any[]) {
  const db = getDatabaseConnection();
  const orchestrator = new PipelineOrchestrator();

  logger.info(`Testing pipeline with ${emails.length} emails`, "TEST");

  // Override getAllEmails to return our test batch
  orchestrator["getAllEmails"] = async () => emails;

  try {
    // Run just Stage 1 for quick test
    const stage1 = orchestrator["stage1"];
    const triageResults = await stage1.process(emails);

    logger.info(
      `Stage 1 completed: ${triageResults.all.length} emails triaged`,
      "TEST",
    );

    // Save results
    await orchestrator["saveConsolidatedResults"](
      triageResults.all.map((result) => ({
        emailId: result.emailId,
        stage1: result,
        stage2: null,
        stage3: null,
        finalScore: result.priorityScore,
        pipelineStage: 1,
      })),
    );

    // Verify saves
    const emailIds = emails.map((e) => e.id);
    const placeholders = emailIds.map(() => "?").join(", ");
    const savedAnalysis = db
      .prepare(
        `
      SELECT email_id, pipeline_stage, pipeline_priority_score, final_model_used 
      FROM email_analysis 
      WHERE email_id IN (${placeholders})
    `,
      )
      .all(...emailIds);

    logger.info(
      `✅ SUCCESS: Saved ${savedAnalysis.length} analysis records`,
      "TEST",
    );

    savedAnalysis.forEach((analysis: any) => {
      logger.info(
        `  Email ${analysis.email_id}: Stage ${analysis.pipeline_stage}, Score ${analysis.pipeline_priority_score}, Model ${analysis.final_model_used}`,
        "TEST",
      );
    });
  } catch (error) {
    logger.error("Pipeline test failed", "TEST", error as Error);
  }
}

// Run the test
testPipelineSave()
  .then(() => {
    logger.info("Test completed", "TEST");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Test failed", "TEST", error);
    process.exit(1);
  });
