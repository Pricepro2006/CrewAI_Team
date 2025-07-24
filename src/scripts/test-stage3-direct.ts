#!/usr/bin/env tsx

/**
 * Direct test of Stage 3 Critical Analysis
 */

import { Stage3CriticalAnalysis } from "../core/pipeline/Stage3CriticalAnalysis";
import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";

async function testStage3() {
  console.log("\n🧪 Testing Stage 3 Critical Analysis Directly\n");

  try {
    // Get a test email
    const db = getDatabaseConnection();
    const email = db
      .prepare(
        `SELECT 
          id,
          message_id,
          subject,
          sender_email,
          recipients as recipient_emails,
          received_at as date_received,
          body_text as body,
          categories as folder,
          is_read,
          created_at,
          updated_at
        FROM emails_enhanced
        LIMIT 1`,
      )
      .get() as any;

    if (!email) {
      throw new Error("No email found in database");
    }

    logger.info(`Testing with email: ${email.id}`, "TEST");
    logger.info(`Subject: ${email.subject}`, "TEST");

    // Create Stage 3 instance
    const stage3 = new Stage3CriticalAnalysis();

    // Set a timeout for the entire test
    const testTimeout = setTimeout(() => {
      logger.error("Test timed out after 60 seconds", "TEST");
      process.exit(1);
    }, 60000);

    // Process the email
    const startTime = Date.now();
    logger.info("Starting Stage 3 processing...", "TEST");

    const results = await stage3.process([email]);

    clearTimeout(testTimeout);
    const elapsed = (Date.now() - startTime) / 1000;

    logger.info(`Stage 3 completed in ${elapsed.toFixed(2)}s`, "TEST");
    logger.info(`Results:`, "TEST");
    console.log(JSON.stringify(results, null, 2));

    process.exit(0);
  } catch (error) {
    logger.error("Stage 3 test failed", "TEST", error as Error);
    process.exit(1);
  }
}

// Run test
testStage3();
