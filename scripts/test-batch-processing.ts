#!/usr/bin/env tsx

/**
 * Test Batch Processing - Process 100 emails to verify system
 */

import Database from "better-sqlite3";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";

const logger = new Logger("TestBatchProcessor");
const DB_PATH = "./data/crewai_enhanced.db";

async function testBatchProcessing() {
  const db = new Database(DB_PATH, { readonly: false });
  const service = new EmailThreePhaseAnalysisService();
  
  // Get a small test batch of emails
  const testBatch = db.prepare(`
    SELECT id, subject, body_content, sender_email, received_date_time, conversation_id
    FROM emails_enhanced
    WHERE status = 'pending'
    ORDER BY received_date_time DESC
    LIMIT 100
  `).all();
  
  logger.info(`Testing with ${testBatch.length} emails`);
  
  if (testBatch.length === 0) {
    logger.info("No pending emails found for testing");
    db.close();
    return;
  }
  
  // Process in small batches of 5 for testing
  const batchSize = 5;
  const startTime = Date.now();
  let processed = 0;
  let failed = 0;
  
  for (let i = 0; i < testBatch.length; i += batchSize) {
    const batch = testBatch.slice(i, i + batchSize);
    logger.info(`\nProcessing test batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(testBatch.length/batchSize)}`);
    
    const batchPromises = batch.map(async (email) => {
      try {
        const emailData = {
          id: email.id,
          subject: email.subject || "No subject",
          body: email.body_content || "No content",
          sender_email: email.sender_email,
          received_at: email.received_date_time,
          conversation_id: email.conversation_id
        };
        
        const result = await service.analyzeEmail(emailData, {
          skipCache: true,
          skipPhases: ["phase3"],
          timeout: 30000
        });
        
        // Update status to mark as processed
        db.prepare(`
          UPDATE emails_enhanced 
          SET status = 'analyzed',
              analyzed_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(email.id);
        
        processed++;
        logger.info(`✅ Processed ${email.id.substring(0, 8)}... - ${email.subject?.substring(0, 50) || 'No subject'}`);
        
      } catch (error) {
        failed++;
        logger.error(`❌ Failed ${email.id.substring(0, 8)}...: ${error.message}`);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    logger.info(`Progress: ${processed + failed}/${testBatch.length} (Rate: ${rate.toFixed(1)} emails/sec)`);
  }
  
  // Summary
  const totalTime = (Date.now() - startTime) / 1000;
  logger.info("\n=============================");
  logger.info("Test Complete");
  logger.info("=============================");
  logger.info(`Total: ${testBatch.length} emails`);
  logger.info(`Processed: ${processed}`);
  logger.info(`Failed: ${failed}`);
  logger.info(`Time: ${totalTime.toFixed(1)}s`);
  logger.info(`Rate: ${(processed / totalTime).toFixed(1)} emails/sec (${((processed / totalTime) * 60).toFixed(0)} emails/min)`);
  
  db.close();
}

testBatchProcessing().catch((error) => {
  logger.error("Test failed:", error);
  process.exit(1);
});