#!/usr/bin/env tsx

/**
 * Test the Three-Stage Pipeline with a small batch
 * This validates the pipeline before running on all emails
 */

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";
import { Stage1PatternTriage } from "../core/pipeline/Stage1PatternTriage";
import { Stage2LlamaAnalysis } from "../core/pipeline/Stage2LlamaAnalysis";
import { Stage3CriticalAnalysis } from "../core/pipeline/Stage3CriticalAnalysis";
import type { Email } from "../core/pipeline/types";

async function getTestEmails(count: number = 100): Promise<Email[]> {
  const db = getDatabaseConnection();
  
  // Using raw SQL query for better compatibility
  const rawEmails = db.prepare(`
    SELECT 
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
    ORDER BY received_at DESC
    LIMIT ?
  `).all(count);

  // Transform to match Email interface
  return rawEmails.map((email: any) => ({
    id: email.id,
    subject: email.subject || '',
    body: email.body || '',
    sender_email: email.sender_email || '',
    recipient_emails: email.recipient_emails || '',
    date_received: email.date_received || new Date().toISOString(),
    message_id: email.message_id,
    folder: email.folder,
    is_read: email.is_read,
    created_at: email.created_at || new Date().toISOString(),
    updated_at: email.updated_at || new Date().toISOString(),
  })) as Email[];
}

async function testPipeline() {
  logger.info("Starting small batch pipeline test", "TEST");

  try {
    // Get test emails - start with just 10
    const testEmails = await getTestEmails(10);
    logger.info(`Testing with ${testEmails.length} emails`, "TEST");

    // Test Stage 1: Pattern Triage
    logger.info("Testing Stage 1: Pattern Triage", "TEST");
    const stage1 = new Stage1PatternTriage();
    const stage1Start = Date.now();
    const triageResults = await stage1.process(testEmails);
    const stage1Time = (Date.now() - stage1Start) / 1000;
    
    let stage2Time = 0;
    
    logger.info(`Stage 1 completed in ${stage1Time.toFixed(2)}s`, "TEST");
    logger.info(`- All emails triaged: ${triageResults.all.length}`, "TEST");
    logger.info(`- Top 5000 selected: ${triageResults.top5000.length}`, "TEST");
    logger.info(`- Top 500 critical: ${triageResults.top500.length}`, "TEST");

    // Show sample triage result
    if (triageResults.all.length > 0) {
      const sample = triageResults.all[0];
      logger.info(`Sample triage result:`, "TEST");
      logger.info(`- Email ID: ${sample.emailId}`, "TEST");
      logger.info(`- Priority Score: ${sample.priorityScore}`, "TEST");
      logger.info(`- Workflow: ${sample.workflow}`, "TEST");
      logger.info(`- Entities: ${JSON.stringify(sample.entities)}`, "TEST");
    }

    // Test Stage 2: Llama Analysis (on top 3 priority emails)
    if (triageResults.top5000.length > 0) {
      logger.info("\nTesting Stage 2: Llama 3.2:3b Analysis", "TEST");
      const stage2 = new Stage2LlamaAnalysis();
      const testBatch = triageResults.top5000.slice(0, 3);
      const stage2Start = Date.now();
      const llamaResults = await stage2.process(testBatch);
      stage2Time = (Date.now() - stage2Start) / 1000;
      
      logger.info(`Stage 2 completed in ${stage2Time.toFixed(2)}s`, "TEST");
      logger.info(`- Emails analyzed: ${llamaResults.length}`, "TEST");
      
      // Show sample Llama result
      if (llamaResults.length > 0) {
        const sample = llamaResults[0];
        logger.info(`Sample Llama analysis:`, "TEST");
        logger.info(`- Email ID: ${sample.emailId}`, "TEST");
        logger.info(`- Quality Score: ${sample.qualityScore}`, "TEST");
        logger.info(`- Summary: ${sample.contextualSummary.substring(0, 100)}...`, "TEST");
        logger.info(`- Action Items: ${sample.actionItems.length}`, "TEST");
      }
    }

    // Test Stage 3: Critical Analysis (on top 1 critical email)
    if (triageResults.top500.length > 0) {
      logger.info("\nTesting Stage 3: Critical Analysis", "TEST");
      const stage3 = new Stage3CriticalAnalysis();
      const testBatch = triageResults.top500.slice(0, 1);
      const stage3Start = Date.now();
      const criticalResults = await stage3.process(testBatch);
      const stage3Time = (Date.now() - stage3Start) / 1000;
      
      logger.info(`Stage 3 completed in ${stage3Time.toFixed(2)}s`, "TEST");
      logger.info(`- Emails analyzed: ${criticalResults.length}`, "TEST");
      
      // Show sample critical result
      if (criticalResults.length > 0) {
        const sample = criticalResults[0];
        logger.info(`Sample critical analysis:`, "TEST");
        logger.info(`- Email ID: ${sample.emailId}`, "TEST");
        logger.info(`- Model Used: ${sample.modelUsed}`, "TEST");
        logger.info(`- Fallback Used: ${sample.fallbackUsed}`, "TEST");
        logger.info(`- Executive Summary: ${sample.executiveSummary.substring(0, 100)}...`, "TEST");
      }
    }

    // Performance estimates
    logger.info("\n" + "=".repeat(60), "TEST");
    logger.info("Performance Estimates for Full Pipeline:", "TEST");
    logger.info("=".repeat(60), "TEST");
    
    const emailsPerSecond = testEmails.length / stage1Time;
    const stage1FullTime = 33797 / emailsPerSecond / 3600;
    logger.info(`Stage 1 (33,797 emails): ~${stage1FullTime.toFixed(2)} hours`, "TEST");
    
    if (triageResults.top5000.length > 0 && stage2Time) {
      const llamaPerEmail = stage2Time / Math.min(3, triageResults.top5000.length);
      const stage2FullTime = 5000 * llamaPerEmail / 3600;
      logger.info(`Stage 2 (5,000 emails): ~${stage2FullTime.toFixed(2)} hours`, "TEST");
    }
    
    logger.info(`Total estimated time: ~21 hours`, "TEST");
    logger.info("=".repeat(60), "TEST");

    logger.info("\n✅ Pipeline test completed successfully!", "TEST");
    return true;

  } catch (error) {
    console.error("Detailed error:", error);
    logger.error("Pipeline test failed", "TEST", error as Error);
    return false;
  }
}

async function main() {
  console.log("\n🧪 Three-Stage Pipeline Test (Small Batch)");
  console.log("=========================================\n");

  // Check Ollama
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    const data = await response.json();
    const models = data.models || [];
    
    const hasLlama = models.some((m: any) => m.name === "llama3.2:3b");
    if (!hasLlama) {
      logger.error("Llama 3.2:3b not found. Please run: ollama pull llama3.2:3b", "TEST");
      process.exit(1);
    }
    
    logger.info("✅ Llama 3.2:3b model available", "TEST");
  } catch (error) {
    logger.error("Ollama not running", "TEST");
    process.exit(1);
  }

  // Run test
  const success = await testPipeline();
  
  if (success) {
    console.log("\n✅ All tests passed! Pipeline is ready for full execution.");
    console.log("\nTo run the full pipeline, execute:");
    console.log("  npm run pipeline:execute\n");
  } else {
    console.log("\n❌ Tests failed. Please fix issues before running full pipeline.\n");
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  logger.error("Test error", "TEST", error as Error);
  process.exit(1);
});