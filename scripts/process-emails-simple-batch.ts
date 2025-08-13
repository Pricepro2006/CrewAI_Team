#!/usr/bin/env tsx

/**
 * Simple Batch Email Processing
 * Process emails efficiently without complex dependencies
 */

import Database from "better-sqlite3";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";

const logger = new Logger("SimpleBatchProcessor");
const DB_PATH = "./data/crewai_enhanced.db";

interface ProcessingStats {
  totalEmails: number;
  processed: number;
  failed: number;
  startTime: number;
  avgProcessingTime: number;
}

async function processEmailsBatch(limit: number = 1000, offset: number = 0) {
  const db = new Database(DB_PATH, { readonly: false });
  const service = new EmailThreePhaseAnalysisService();
  
  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  
  // Get pending emails
  const emailsToProcess = db.prepare(`
    SELECT id, subject, body_content, sender_email, received_date_time, conversation_id
    FROM emails_enhanced
    WHERE status = 'pending'
    ORDER BY received_date_time DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  
  logger.info(`Found ${emailsToProcess.length} emails to process (limit: ${limit}, offset: ${offset})`);
  
  if (emailsToProcess.length === 0) {
    logger.info("No pending emails found");
    db.close();
    return;
  }
  
  const stats: ProcessingStats = {
    totalEmails: emailsToProcess.length,
    processed: 0,
    failed: 0,
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
  
  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStartTime = performance.now();
    
    logger.info(`\nBatch ${batchIndex + 1}/${batches.length} - ${batch.length} emails`);
    
    // Process emails in parallel within batch
    const promises = batch.map(async (email) => {
      const emailStartTime = performance.now();
      
      try {
        // Transform to expected format
        const emailData = {
          id: email.id,
          subject: email.subject || "",
          body: email.body_content || "",
          sender_email: email.sender_email,
          received_at: email.received_date_time,
          conversation_id: email.conversation_id
        };
        
        // Analyze with Phase 1 and 2 only for speed
        const result = await service.analyzeEmail(emailData, {
          skipCache: true,
          skipPhases: ["phase3"], // Skip Phase 3 for speed
          timeout: 20000, // 20 second timeout
        });
        
        const processingTime = performance.now() - emailStartTime;
        
        // Update email status
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
        
        // Save analysis results
        if (result.phase1) {
          try {
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
          } catch (err) {
            logger.warn(`Failed to save Phase 1 results for ${email.id}:`, err.message);
          }
        }
        
        if (result.phase2) {
          try {
            db.prepare(`
              INSERT OR REPLACE INTO email_analysis_phase2 (
                email_id, workflow_validation, workflow_state,
                risk_assessment, confidence, business_process,
                processing_time
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              email.id,
              result.phase2.workflow_validation || '',
              result.phase2.workflow_state || result.phase2.workflowValidation || '',
              result.phase2.risk_assessment || result.phase2.riskAssessment || 'low',
              result.phase2.confidence || 0.5,
              result.phase2.business_process || result.phase2.businessProcess || '',
              processingTime
            );
          } catch (err) {
            logger.warn(`Failed to save Phase 2 results for ${email.id}:`, err.message);
          }
        }
        
        stats.processed++;
        stats.avgProcessingTime = 
          (stats.avgProcessingTime * (stats.processed - 1) + processingTime) / stats.processed;
        
        logger.debug(`✅ ${email.id.substring(0, 8)}... processed in ${Math.round(processingTime)}ms`);
        
        return { success: true, processingTime };
        
      } catch (error) {
        stats.failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ ${email.id.substring(0, 8)}... failed: ${errorMsg}`);
        
        // Mark as error
        try {
          db.prepare(`
            UPDATE emails_enhanced 
            SET status = 'error',
                error_message = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(errorMsg, email.id);
        } catch (dbErr) {
          logger.error(`Failed to update error status:`, dbErr);
        }
        
        return { success: false, error: errorMsg };
      }
    });
    
    // Wait for batch to complete
    const results = await Promise.all(promises);
    
    const batchTime = performance.now() - batchStartTime;
    const successCount = results.filter(r => r.success).length;
    
    logger.info(`Batch complete: ${successCount}/${batch.length} successful in ${Math.round(batchTime)}ms`);
    
    // Progress update
    const elapsed = (Date.now() - stats.startTime) / 1000;
    const rate = stats.processed / elapsed;
    const remaining = stats.totalEmails - stats.processed - stats.failed;
    const eta = remaining > 0 ? remaining / rate : 0;
    
    logger.info(`Overall progress: ${stats.processed}/${stats.totalEmails} (${Math.round((stats.processed / stats.totalEmails) * 100)}%)`);
    logger.info(`Rate: ${rate.toFixed(1)} emails/sec (${(rate * 60).toFixed(0)} emails/min)`);
    if (remaining > 0) {
      logger.info(`ETA: ${Math.round(eta / 60)} minutes`);
    }
    
    // Small delay between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Final summary
  const totalTime = (Date.now() - stats.startTime) / 1000;
  const emailsPerMinute = (stats.processed / totalTime) * 60;
  
  logger.info("\n=============================");
  logger.info("Processing Complete");
  logger.info("=============================");
  logger.info(`Total emails: ${stats.totalEmails}`);
  logger.info(`Processed: ${stats.processed}`);
  logger.info(`Failed: ${stats.failed}`);
  logger.info(`Total time: ${Math.round(totalTime / 60)} minutes ${Math.round(totalTime % 60)} seconds`);
  logger.info(`Average rate: ${(stats.processed / totalTime).toFixed(1)} emails/sec`);
  logger.info(`Average processing time: ${Math.round(stats.avgProcessingTime)}ms per email`);
  
  if (emailsPerMinute >= 60) {
    logger.info(`\n✅ SUCCESS - Achieved ${Math.round(emailsPerMinute)} emails/minute!`);
  } else {
    logger.warn(`\n⚠️  Below target - Only ${Math.round(emailsPerMinute)} emails/minute (target: 60+)`);
  }
  
  // Check remaining emails
  const remainingCount = db.prepare(`
    SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'pending'
  `).get();
  
  logger.info(`\n📊 Remaining pending emails in database: ${remainingCount.count}`);
  
  // Save processing metrics
  try {
    db.prepare(`
      INSERT INTO processing_metrics (
        batch_id, emails_processed, processing_time,
        average_time_per_email, phase1_count, phase2_count,
        errors, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      `batch_${Date.now()}`,
      stats.processed,
      totalTime,
      stats.avgProcessingTime / 1000, // Convert to seconds
      stats.processed, // All emails get Phase 1
      stats.processed, // All emails get Phase 2
      stats.failed
    );
  } catch (err) {
    logger.warn("Failed to save processing metrics:", err.message);
  }
  
  db.close();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 1000;
  const offset = parseInt(args[1]) || 0;
  
  logger.info(`Starting email batch processing...`);
  logger.info(`Limit: ${limit}, Offset: ${offset}`);
  
  try {
    await processEmailsBatch(limit, offset);
  } catch (error) {
    logger.error("Processing failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}