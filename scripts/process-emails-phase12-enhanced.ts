#!/usr/bin/env tsx

/**
 * Process Emails with Phase 1 and 2 Only - Enhanced Version
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
  
  // Get emails that need processing - using correct table and column names
  const emailsToProcess = db.prepare(`
    SELECT id, subject, body_content, sender_email, received_date_time, conversation_id
    FROM emails_enhanced
    WHERE status = 'pending'
    ORDER BY received_date_time DESC
    LIMIT 5000
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
  
  // Process in batches of 20 (increased for better throughput)
  const batchSize = 20;
  const batches = [];
  for (let i = 0; i < emailsToProcess.length; i += batchSize) {
    batches.push(emailsToProcess.slice(i, i + batchSize));
  }
  
  logger.info(`Processing in ${batches.length} batches of ${batchSize}`);
  
  // Ensure analysis tables exist
  db.prepare(`
    CREATE TABLE IF NOT EXISTS email_analysis_phase1 (
      email_id TEXT PRIMARY KEY,
      entities TEXT,
      sentiment TEXT,
      intent TEXT,
      urgency TEXT,
      category TEXT,
      processing_time REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email_id) REFERENCES emails_enhanced(id)
    )
  `).run();
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS email_analysis_phase2 (
      email_id TEXT PRIMARY KEY,
      workflow_validation TEXT,
      risk_assessment TEXT,
      initial_response TEXT,
      confidence REAL,
      business_process TEXT,
      processing_time REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email_id) REFERENCES emails_enhanced(id)
    )
  `).run();
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    logger.info(`\nProcessing batch ${batchIndex + 1}/${batches.length}`);
    
    // Process emails in parallel within batch
    const batchPromises = batch.map(async (email) => {
      const emailStartTime = performance.now();
      
      try {
        // Transform email to expected format
        const emailData = {
          id: email.id,
          subject: email.subject,
          body: email.body_content,
          sender_email: email.sender_email,
          received_at: email.received_date_time,
          conversation_id: email.conversation_id
        };
        
        // Analyze with Phase 1 and 2 only
        const result = await service.analyzeEmail(emailData, {
          skipCache: true,
          skipPhases: ["phase3"], // Skip Phase 3
          timeout: 30000, // 30 second timeout
        });
        
        const processingTime = performance.now() - emailStartTime;
        
        // Update email status in emails_enhanced
        db.prepare(`
          UPDATE emails_enhanced 
          SET status = 'analyzed',
              analyzed_at = datetime('now'),
              phase1_result = ?,
              phase2_result = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(
          JSON.stringify(result.phase1 || {}),
          JSON.stringify(result.phase2 || {}),
          email.id
        );
        
        // Save Phase 1 results if available
        if (result.phase1) {
          db.prepare(`
            INSERT OR REPLACE INTO email_analysis_phase1 (
              email_id, entities, sentiment, intent,
              urgency, category, processing_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            email.id,
            JSON.stringify(result.phase1.entities || []),
            result.phase1.sentiment || 'neutral',
            result.phase1.intent || 'information',
            result.phase1.urgency || 'normal',
            result.phase1.category || 'general',
            processingTime
          );
        }
        
        // Save Phase 2 results if available
        if (result.phase2) {
          db.prepare(`
            INSERT OR REPLACE INTO email_analysis_phase2 (
              email_id, workflow_validation, risk_assessment,
              initial_response, confidence, business_process,
              processing_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            email.id,
            result.phase2.workflow_validation || result.phase2.workflow_state,
            result.phase2.risk_assessment || 'low',
            result.phase2.initial_response || result.phase2.suggestedResponse || '',
            result.phase2.confidence || 0.5,
            result.phase2.business_process || result.phase2.businessProcess || '',
            processingTime
          );
        }
        
        stats.processed++;
        stats.avgProcessingTime = 
          (stats.avgProcessingTime * (stats.processed - 1) + processingTime) / stats.processed;
        
        logger.debug(`✅ Processed ${email.id} in ${Math.round(processingTime)}ms`);
        
      } catch (error) {
        stats.failed++;
        logger.error(`❌ Failed to process ${email.id}:`, error);
        
        // Mark as error
        db.prepare(`
          UPDATE emails_enhanced 
          SET status = 'error',
              error_message = ?,
              updated_at = datetime('now')
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
    logger.info(`Rate: ${rate.toFixed(1)} emails/sec (${(rate * 60).toFixed(0)} emails/min)`);
    logger.info(`Avg processing time: ${Math.round(stats.avgProcessingTime)}ms`);
    if (remaining > 0) {
      logger.info(`ETA: ${Math.round(eta / 60)} minutes`);
    }
    
    // Small delay between batches to avoid overwhelming the system
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
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
  
  // Show remaining pending emails
  const remainingPending = db.prepare(`
    SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'pending'
  `).get();
  logger.info(`\nRemaining pending emails: ${remainingPending.count}`);
  
  db.close();
}

// Run the processor
processEmailsPhase12Only().catch((error) => {
  logger.error("Processing failed:", error);
  process.exit(1);
});