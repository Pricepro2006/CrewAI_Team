#!/usr/bin/env tsx

/**
 * Process Emails with Phase 1 and 2 Only
 * 
 * Efficiently processes large batches of emails using only Phase 1 and 2
 * to get them analyzed quickly. Phase 3 can be run later on complete chains.
 */

import Database from "better-sqlite3";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";

const logger = new Logger("EmailPhase12Processor");
const DB_PATH = "./data/crewai_enhanced.db";

interface ProcessingStats {
  totalEmails: number;
  processed: number;
  failed: number;
  skipped: number;
  startTime: number;
  avgProcessingTime: number;
}

async function processEmailsPhase12Only() {
  const db = new Database(DB_PATH, { readonly: false });
  const service = new EmailThreePhaseAnalysisService();
  
  // Get emails that need processing
  const emailsToProcess = db.prepare(`
    SELECT id, subject, body, sender_email, received_at, conversation_id
    FROM emails
    WHERE status = 'pending'
    ORDER BY received_at DESC
    LIMIT 1000
  `).all();
  
  logger.info(`Found ${emailsToProcess.length} emails to process`);
  
  if (emailsToProcess.length === 0) {
    logger.info("No pending emails found");
    db.close();
    return;
  }
  
  const stats: ProcessingStats = {
    totalEmails: emailsToProcess.length,
    processed: 0,
    failed: 0,
    skipped: 0,
    startTime: Date.now(),
    avgProcessingTime: 0,
  };
  
  // Process in batches of 10
  const batchSize = 10;
  const batches = [];
  for (let i = 0; i < emailsToProcess.length; i += batchSize) {
    batches.push(emailsToProcess.slice(i, i + batchSize));
  }
  
  logger.info(`Processing in ${batches.length} batches of ${batchSize}`);
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    logger.info(`\nProcessing batch ${batchIndex + 1}/${batches.length}`);
    
    // Process emails in parallel within batch
    const batchPromises = batch.map(async (email) => {
      const emailStartTime = performance.now();
      
      try {
        // Analyze with Phase 1 and 2 only
        const result = await service.analyzeEmail(email, {
          skipCache: true,
          skipPhases: ["phase3"], // Skip Phase 3
          timeout: 30000, // 30 second timeout
        });
        
        const processingTime = performance.now() - emailStartTime;
        
        // Update email status
        db.prepare(`
          UPDATE emails 
          SET status = 'analyzed',
              analysis_version = 'v1.2',
              workflow_state = ?,
              priority = ?,
              confidence_score = ?,
              last_updated = datetime('now')
          WHERE id = ?
        `).run(
          result.workflow_validation || result.workflow_state,
          result.priority,
          result.confidence || 0.5,
          email.id
        );
        
        // Save Phase 2 results
        db.prepare(`
          INSERT OR REPLACE INTO email_analysis_phase2 (
            email_id, workflow_validation, risk_assessment,
            initial_response, confidence, business_process,
            processing_time, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          email.id,
          result.workflow_validation,
          result.risk_assessment,
          result.initial_response,
          result.confidence,
          result.business_process,
          processingTime
        );
        
        stats.processed++;
        stats.avgProcessingTime = 
          (stats.avgProcessingTime * (stats.processed - 1) + processingTime) / stats.processed;
        
        logger.debug(`✅ Processed ${email.id} in ${Math.round(processingTime)}ms`);
        
      } catch (error) {
        stats.failed++;
        logger.error(`❌ Failed to process ${email.id}:`, error);
        
        // Mark as error
        db.prepare(`
          UPDATE emails 
          SET status = 'error',
              error_message = ?,
              last_updated = datetime('now')
          WHERE id = ?
        `).run(
          error instanceof Error ? error.message : String(error),
          email.id
        );
      }
    });
    
    // Wait for batch to complete
    await Promise.all(batchPromises);
    
    // Progress update
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rate = stats.processed / elapsed;
    const remaining = stats.totalEmails - stats.processed - stats.failed;
    const eta = remaining / rate;
    
    logger.info(`Progress: ${stats.processed}/${stats.totalEmails} (${Math.round((stats.processed / stats.totalEmails) * 100)}%)`);
    logger.info(`Rate: ${rate.toFixed(1)} emails/sec, ETA: ${Math.round(eta / 60)} minutes`);
    logger.info(`Avg processing time: ${Math.round(stats.avgProcessingTime)}ms`);
    
    // Small delay between batches to avoid overwhelming the system
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Final summary
  const totalTime = (Date.now() - stats.startTime) / 1000;
  
  logger.info("\n=============================");
  logger.info("Processing Complete");
  logger.info("=============================");
  logger.info(`Total emails: ${stats.totalEmails}`);
  logger.info(`Processed: ${stats.processed}`);
  logger.info(`Failed: ${stats.failed}`);
  logger.info(`Skipped: ${stats.skipped}`);
  logger.info(`Total time: ${Math.round(totalTime / 60)} minutes`);
  logger.info(`Average rate: ${(stats.processed / totalTime).toFixed(1)} emails/sec`);
  logger.info(`Average processing time: ${Math.round(stats.avgProcessingTime)}ms per email`);
  
  // Check if we achieved the target
  const emailsPerMinute = (stats.processed / totalTime) * 60;
  if (emailsPerMinute >= 60) {
    logger.info(`\n✅ SUCCESS - Achieved ${Math.round(emailsPerMinute)} emails/minute!`);
  } else {
    logger.warn(`\n⚠️  Below target - Only ${Math.round(emailsPerMinute)} emails/minute (target: 60+)`);
  }
  
  db.close();
}

// Run the processor
processEmailsPhase12Only().catch((error) => {
  logger.error("Processing failed:", error);
  process.exit(1);
});