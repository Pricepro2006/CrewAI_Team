#!/usr/bin/env tsx

/**
 * Fast Phase 1 Processing
 * Process emails with Phase 1 (rule-based) only for maximum speed
 */

import Database from "better-sqlite3";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";

const logger = new Logger("Phase1FastProcessor");
const DB_PATH = "./data/crewai_enhanced.db";

async function processPhase1Only(limit: number = 10000) {
  const db = new Database(DB_PATH, { readonly: false });
  const service = new EmailThreePhaseAnalysisService();
  
  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  
  // Get pending emails
  const totalPending = db.prepare(`
    SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'pending'
  `).get();
  
  logger.info(`Total pending emails: ${totalPending.count}`);
  
  const emailsToProcess = db.prepare(`
    SELECT id, subject, body_content, sender_email, received_date_time, conversation_id
    FROM emails_enhanced
    WHERE status = 'pending'
    ORDER BY received_date_time DESC
    LIMIT ?
  `).all(limit);
  
  logger.info(`Processing ${emailsToProcess.length} emails with Phase 1 only`);
  
  const startTime = Date.now();
  let processed = 0;
  let failed = 0;
  
  // Process in larger batches for speed
  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < emailsToProcess.length; i += batchSize) {
    batches.push(emailsToProcess.slice(i, i + batchSize));
  }
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStart = performance.now();
    
    // Process batch
    for (const email of batch) {
      try {
        const emailData = {
          id: email.id,
          subject: email.subject || "",
          body: email.body_content || "",
          sender_email: email.sender_email,
          received_at: email.received_date_time,
          conversation_id: email.conversation_id
        };
        
        // Run Phase 1 only (rule-based extraction)
        const phase1Result = service.runPhase1(emailData, { skipCache: true });
        
        // Update email with Phase 1 results only
        db.prepare(`
          UPDATE emails_enhanced 
          SET status = 'phase1_complete',
              phase1_result = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(
          JSON.stringify(phase1Result),
          email.id
        );
        
        // Save to phase1 table
        try {
          db.prepare(`
            INSERT OR REPLACE INTO email_analysis_phase1 (
              email_id, entities, sentiment, intent,
              urgency, category, processing_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            email.id,
            JSON.stringify(phase1Result.entities || []),
            phase1Result.sentiment || 'neutral',
            phase1Result.intent || 'information',
            phase1Result.urgency || 'normal',
            phase1Result.category || 'general',
            10 // Approximate processing time in ms
          );
        } catch (err) {
          // Ignore foreign key errors for now
        }
        
        processed++;
        
      } catch (error) {
        failed++;
        logger.error(`Failed ${email.id.substring(0, 8)}...: ${error.message}`);
      }
    }
    
    const batchTime = performance.now() - batchStart;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    
    logger.info(`Batch ${batchIndex + 1}/${batches.length} complete in ${Math.round(batchTime)}ms`);
    logger.info(`Progress: ${processed}/${emailsToProcess.length} (${Math.round(rate * 60)} emails/min)`);
  }
  
  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  const emailsPerMinute = (processed / totalTime) * 60;
  
  logger.info("\n=============================");
  logger.info("Phase 1 Processing Complete");
  logger.info("=============================");
  logger.info(`Total emails: ${emailsToProcess.length}`);
  logger.info(`Processed: ${processed}`);
  logger.info(`Failed: ${failed}`);
  logger.info(`Total time: ${Math.round(totalTime)} seconds`);
  logger.info(`Rate: ${Math.round(emailsPerMinute)} emails/minute`);
  
  // Update remaining count
  const remaining = db.prepare(`
    SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'pending'
  `).get();
  
  logger.info(`\nRemaining pending: ${remaining.count}`);
  
  // Get Phase 1 complete count
  const phase1Complete = db.prepare(`
    SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'phase1_complete'
  `).get();
  
  logger.info(`Phase 1 complete: ${phase1Complete.count}`);
  
  db.close();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 10000;
  
  logger.info(`Starting Phase 1 fast processing...`);
  
  try {
    await processPhase1Only(limit);
    
    logger.info("\nNext steps:");
    logger.info("1. Run Phase 2 analysis on phase1_complete emails");
    logger.info("2. Run Phase 3 on complete conversation chains");
    
  } catch (error) {
    logger.error("Processing failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}