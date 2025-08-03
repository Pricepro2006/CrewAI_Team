#!/usr/bin/env tsx

/**
 * Simple Phase 2 Processing
 * Process Phase 1 complete emails with LLM analysis
 */

import Database from "better-sqlite3";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("Phase2SimpleProcessor");
const DB_PATH = "./data/crewai_enhanced.db";

async function processPhase2(limit: number = 100) {
  const db = new Database(DB_PATH, { readonly: false });
  const service = new EmailThreePhaseAnalysisService();

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Get Phase 1 complete emails
  const totalPhase1Complete = db
    .prepare(
      `
    SELECT COUNT(*) as count 
    FROM emails_enhanced 
    WHERE status = 'phase1_complete'
  `,
    )
    .get();

  logger.info(`Total Phase 1 complete emails: ${totalPhase1Complete.count}`);

  // Get emails to process
  const emailsToProcess = db
    .prepare(
      `
    SELECT 
      id, 
      subject, 
      body_content, 
      sender_email, 
      received_date_time, 
      conversation_id,
      phase1_result
    FROM emails_enhanced
    WHERE status = 'phase1_complete'
    ORDER BY received_date_time DESC
    LIMIT ?
  `,
    )
    .all(limit);

  logger.info(`Processing ${emailsToProcess.length} emails with Phase 2`);

  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const email of emailsToProcess) {
    try {
      // Parse Phase 1 result
      const phase1Result = JSON.parse(email.phase1_result || "{}");

      // Prepare email data
      const emailData = {
        id: email.id,
        subject: email.subject || "",
        body: email.body_content || "",
        sender_email: email.sender_email,
        received_at: email.received_date_time,
        conversation_id: email.conversation_id,
        phase1_result: phase1Result,
      };

      // Run full analysis (will use cached Phase 1 results)
      const analysisResult = await service.analyzeEmail(emailData, {
        skipPhase3: true, // Only run Phase 1 and 2
        model: "llama3.2:3b",
        timeout: 10000, // 10 seconds
        maxTokens: 800,
        skipCache: false,
      });

      // Extract Phase 2 results from the analysis
      const phase2Result = analysisResult.phase2Results;

      // Update database
      db.prepare(
        `
        UPDATE emails_enhanced 
        SET 
          status = 'phase2_complete',
          phase2_result = ?,
          workflow_state = ?,
          priority = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(
        JSON.stringify(phase2Result),
        phase2Result.workflow_state ||
          analysisResult.workflow_state ||
          "unknown",
        phase2Result.priority || analysisResult.priority || "normal",
        email.id,
      );

      // Save to phase2 table
      try {
        db.prepare(
          `
          INSERT OR REPLACE INTO email_analysis_phase2 (
            email_id, workflow_state, priority, action_items,
            key_topics, stakeholders, processing_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          email.id,
          phase2Result.workflow_state ||
            analysisResult.workflow_state ||
            "unknown",
          phase2Result.priority || analysisResult.priority || "normal",
          JSON.stringify(phase2Result.action_items || []),
          JSON.stringify(phase2Result.key_topics || []),
          JSON.stringify(phase2Result.stakeholders || []),
          phase2Result.phase2_processing_time || 0,
        );
      } catch (err) {
        // Ignore foreign key errors
      }

      succeeded++;
      processed++;

      if (processed % 10 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = succeeded / elapsed;
        logger.info(
          `Progress: ${processed}/${emailsToProcess.length} (${Math.round(rate * 60)} emails/min)`,
        );
      }
    } catch (error) {
      failed++;
      processed++;
      logger.error(`Failed ${email.id.substring(0, 8)}...: ${error.message}`);

      // Update status to indicate Phase 2 failed
      db.prepare(
        `
        UPDATE emails_enhanced 
        SET 
          status = 'phase2_failed',
          updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(email.id);
    }
  }

  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  const emailsPerMinute = (succeeded / totalTime) * 60;

  logger.info("\n=============================");
  logger.info("Phase 2 Processing Complete");
  logger.info("=============================");
  logger.info(`Total emails: ${emailsToProcess.length}`);
  logger.info(`Succeeded: ${succeeded}`);
  logger.info(`Failed: ${failed}`);
  logger.info(`Total time: ${Math.round(totalTime)} seconds`);
  logger.info(`Rate: ${Math.round(emailsPerMinute)} emails/minute`);

  // Get updated counts
  const statusCounts = db
    .prepare(
      `
    SELECT status, COUNT(*) as count 
    FROM emails_enhanced 
    GROUP BY status 
    ORDER BY count DESC
  `,
    )
    .all();

  logger.info("\nUpdated email status distribution:");
  statusCounts.forEach((row) => {
    logger.info(`${row.status}: ${row.count}`);
  });

  db.close();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 100;

  logger.info(`Starting Phase 2 processing...`);
  logger.info(`Processing limit: ${limit}`);

  try {
    await processPhase2(limit);

    logger.info("\nNext steps:");
    logger.info(
      "1. Process more emails with: npm run process-emails-phase2-simple 1000",
    );
    logger.info("2. Run Phase 3 analysis on complete conversation chains");
    logger.info("3. Process by conversation for workflow detection");
  } catch (error) {
    logger.error("Processing failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
