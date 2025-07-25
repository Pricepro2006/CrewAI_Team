/**
 * Integration test to verify the pipeline JSON parsing works with EmailStorageService
 */

import { getDatabaseConnection } from "../database/connection";
import { EmailStorageService } from "../api/services/EmailStorageService";
import { logger } from "../utils/logger";

async function testPipelineIntegration() {
  const db = getDatabaseConnection();

  try {
    logger.info("Starting pipeline integration test", "TEST");

    // Initialize EmailStorageService
    const emailService = new EmailStorageService();

    // Get a few emails with pipeline analysis
    const sampleEmails = db
      .prepare(
        `
      SELECT email_id 
      FROM email_analysis 
      WHERE llama_analysis IS NOT NULL
      LIMIT 5
    `,
      )
      .all() as Array<{ email_id: string }>;

    logger.info(
      `Found ${sampleEmails.length} emails with pipeline analysis`,
      "TEST",
    );

    if (sampleEmails.length === 0) {
      logger.warn(
        "No emails with pipeline analysis found. Run the pipeline first.",
        "TEST",
      );
      return;
    }

    // Test individual email retrieval
    logger.info("\n=== Testing individual email retrieval ===", "TEST");
    for (const { email_id } of sampleEmails) {
      try {
        const emailWithAnalysis =
          await emailService.getEmailWithAnalysis(email_id);

        if (emailWithAnalysis) {
          logger.info(`✅ Email ${email_id}:`, "TEST");
          logger.info(`  - Subject: ${emailWithAnalysis.subject}`, "TEST");
          logger.info(
            `  - Priority: ${emailWithAnalysis.analysis.quick.priority}`,
            "TEST",
          );
          logger.info(
            `  - Workflow: ${emailWithAnalysis.analysis.quick.workflow}`,
            "TEST",
          );
          logger.info(
            `  - Business Process: ${emailWithAnalysis.analysis.deep.detailedWorkflow.primary}`,
            "TEST",
          );
          logger.info(
            `  - Entities: POs=${emailWithAnalysis.analysis.deep.entities.poNumbers.length}, ` +
              `Quotes=${emailWithAnalysis.analysis.deep.entities.quoteNumbers.length}, ` +
              `Parts=${emailWithAnalysis.analysis.deep.entities.partNumbers.length}`,
            "TEST",
          );
          logger.info(
            `  - Action Items: ${emailWithAnalysis.analysis.deep.actionItems.length}`,
            "TEST",
          );
          logger.info(
            `  - SLA Status: ${emailWithAnalysis.analysis.deep.actionItems[0]?.slaStatus || "N/A"}`,
            "TEST",
          );
          logger.info(
            `  - Model: ${emailWithAnalysis.analysis.processingMetadata.models.stage2}`,
            "TEST",
          );
        } else {
          logger.error(`❌ Failed to retrieve email ${email_id}`, "TEST");
        }
      } catch (error) {
        logger.error(`❌ Error retrieving email ${email_id}: ${error}`, "TEST");
      }
    }

    // Test batch loading
    logger.info("\n=== Testing batch email loading ===", "TEST");
    const emailIds = sampleEmails.map((e) => e.email_id);

    try {
      const emailMap = await emailService.batchLoadEmailsWithAnalysis(emailIds);

      logger.info(
        `✅ Batch loaded ${emailMap.size} emails successfully`,
        "TEST",
      );

      // Verify all requested emails were loaded
      for (const emailId of emailIds) {
        if (emailMap.has(emailId)) {
          const email = emailMap.get(emailId)!;
          logger.info(
            `  - ${emailId}: ${email.analysis.quick.priority} priority, ` +
              `${email.analysis.deep.detailedWorkflow.primary}`,
            "TEST",
          );
        } else {
          logger.error(`  - ${emailId}: NOT FOUND in batch results`, "TEST");
        }
      }
    } catch (error) {
      logger.error(`❌ Batch loading failed: ${error}`, "TEST");
    }

    // Test edge cases
    logger.info("\n=== Testing edge cases ===", "TEST");

    // Test non-existent email
    try {
      const nonExistent =
        await emailService.getEmailWithAnalysis("non-existent-id");
      if (nonExistent === null) {
        logger.info(
          "✅ Correctly returned null for non-existent email",
          "TEST",
        );
      } else {
        logger.error(
          "❌ Should have returned null for non-existent email",
          "TEST",
        );
      }
    } catch (error) {
      logger.error(`❌ Error handling non-existent email: ${error}`, "TEST");
    }

    // Test email without analysis
    const emailWithoutAnalysis = db
      .prepare(
        `
      SELECT id FROM emails 
      WHERE id NOT IN (SELECT email_id FROM email_analysis)
      LIMIT 1
    `,
      )
      .get() as { id: string } | undefined;

    if (emailWithoutAnalysis) {
      try {
        const result = await emailService.getEmailWithAnalysis(
          emailWithoutAnalysis.id,
        );
        if (result === null) {
          logger.info(
            "✅ Correctly returned null for email without analysis",
            "TEST",
          );
        } else {
          logger.error(
            "❌ Should have returned null for email without analysis",
            "TEST",
          );
        }
      } catch (error) {
        logger.error(
          `❌ Error handling email without analysis: ${error}`,
          "TEST",
        );
      }
    }

    // Performance test
    logger.info("\n=== Performance test ===", "TEST");
    const perfTestIds = db
      .prepare(
        `
      SELECT email_id FROM email_analysis 
      WHERE llama_analysis IS NOT NULL
      LIMIT 100
    `,
      )
      .all() as Array<{ email_id: string }>;

    if (perfTestIds.length >= 50) {
      const startTime = Date.now();
      const perfResults = await emailService.batchLoadEmailsWithAnalysis(
        perfTestIds.map((e) => e.email_id),
      );
      const endTime = Date.now();

      const duration = endTime - startTime;
      const avgTime = duration / perfTestIds.length;

      logger.info(
        `✅ Loaded ${perfResults.size} emails in ${duration}ms`,
        "TEST",
      );
      logger.info(
        `  - Average time per email: ${avgTime.toFixed(2)}ms`,
        "TEST",
      );
      logger.info(
        `  - Throughput: ${(1000 / avgTime).toFixed(0)} emails/second`,
        "TEST",
      );
    }

    logger.info("\n=== Integration test completed successfully ===", "TEST");
  } catch (error) {
    logger.error("Integration test failed", "TEST", error as Error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  testPipelineIntegration()
    .then(() => {
      logger.info("Test completed", "TEST");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Test failed", "TEST", error);
      process.exit(1);
    });
}
