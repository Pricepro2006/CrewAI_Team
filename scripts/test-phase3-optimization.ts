#!/usr/bin/env tsx

/**
 * Test Phase 3 Optimization
 * 
 * Measures the performance improvements in Phase 3 analysis
 */

import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";
import Database from "better-sqlite3";

const logger = new Logger("Phase3OptimizationTest");
const DB_PATH = "./data/crewai_enhanced.db";

async function testPhase3Optimization() {
  logger.info("Testing Phase 3 Optimization");
  logger.info("=============================");
  
  const db = new Database(DB_PATH, { readonly: true });
  const service = new EmailThreePhaseAnalysisService();
  
  // Get a sample of emails marked as complete chains
  const completeChains = db.prepare(`
    SELECT DISTINCT e.* 
    FROM emails e
    JOIN email_chain_analysis eca ON e.id = eca.email_id
    WHERE eca.is_complete_chain = 1
    AND eca.completeness_score >= 0.7
    LIMIT 5
  `).all();
  
  logger.info(`Found ${completeChains.length} complete chain emails to test`);
  
  if (completeChains.length === 0) {
    logger.warn("No complete chains found. Getting any analyzed emails...");
    const anyEmails = db.prepare(`
      SELECT * FROM emails 
      WHERE status = 'analyzed' 
      LIMIT 5
    `).all();
    
    if (anyEmails.length === 0) {
      logger.error("No emails found for testing");
      db.close();
      return;
    }
    
    completeChains.push(...anyEmails);
  }
  
  const results = [];
  
  for (const email of completeChains) {
    logger.info(`\nTesting email: ${email.id}`);
    logger.info(`Subject: ${email.subject}`);
    
    const startTime = Date.now();
    
    try {
      // Test with optimized settings
      const result = await service.analyzeEmail(email, {
        skipCache: true,
        forceAllPhases: true, // Force Phase 3 even if not complete
        timeout: 60000, // 1 minute timeout
      });
      
      const totalTime = Date.now() - startTime;
      const phase3Time = result.phase3_processing_time || 0;
      
      results.push({
        emailId: email.id,
        totalTime,
        phase3Time,
        success: true,
        hasStrategicInsights: !!result.strategic_insights,
        hasWorkflowIntelligence: !!result.workflow_intelligence,
      });
      
      logger.info(`✅ Success - Total: ${totalTime}ms, Phase 3: ${phase3Time}ms`);
      
      if (result.strategic_insights) {
        logger.info(`Strategic insights: ${JSON.stringify(result.strategic_insights)}`);
      }
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      results.push({
        emailId: email.id,
        totalTime,
        phase3Time: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      logger.error(`❌ Failed - ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Summary
  logger.info("\n=============================");
  logger.info("Test Summary");
  logger.info("=============================");
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  logger.info(`Total tests: ${results.length}`);
  logger.info(`Successful: ${successful.length}`);
  logger.info(`Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    const avgTotalTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
    const avgPhase3Time = successful.reduce((sum, r) => sum + r.phase3Time, 0) / successful.length;
    
    logger.info(`\nPerformance Metrics:`);
    logger.info(`Average total time: ${Math.round(avgTotalTime)}ms`);
    logger.info(`Average Phase 3 time: ${Math.round(avgPhase3Time)}ms`);
    logger.info(`Phase 3 as % of total: ${Math.round((avgPhase3Time / avgTotalTime) * 100)}%`);
    
    // Check if optimization is working
    if (avgPhase3Time < 60000) {
      logger.info(`\n✅ OPTIMIZATION SUCCESS - Phase 3 under 60 seconds!`);
    } else if (avgPhase3Time < 120000) {
      logger.info(`\n⚠️  PARTIAL SUCCESS - Phase 3 under 2 minutes`);
    } else {
      logger.error(`\n❌ OPTIMIZATION NEEDED - Phase 3 still over 2 minutes`);
    }
  }
  
  if (failed.length > 0) {
    logger.error(`\nFailed tests:`);
    failed.forEach(f => {
      logger.error(`- ${f.emailId}: ${f.error}`);
    });
  }
  
  db.close();
}

// Run the test
testPhase3Optimization().catch((error) => {
  logger.error("Test failed:", error);
  process.exit(1);
});