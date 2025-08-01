#!/usr/bin/env tsx
/**
 * Run the actual three-phase LLM analysis pipeline on test emails
 */

import { PipelineOrchestrator } from "../src/core/pipeline/PipelineOrchestrator.js";
import { logger } from "../src/utils/logger.js";
import { getDatabaseConnection } from "../src/database/connection.js";

async function runThreePhaseAnalysis() {
  console.log("🚀 Starting Three-Phase Email Analysis Pipeline\n");

  try {
    // First check if we have emails in the database
    const db = getDatabaseConnection();
    const emailCount = db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
      .get() as { count: number };
    console.log(`📧 Found ${emailCount.count} emails in database\n`);

    if (emailCount.count === 0) {
      console.log(
        "❌ No emails found in database. Please run email import first.",
      );
      return;
    }

    // Create the pipeline orchestrator
    const orchestrator = new PipelineOrchestrator();

    console.log("🔬 Running three-phase analysis pipeline...\n");
    console.log("Phase 1: Pattern-based triage (all emails)");
    console.log("Phase 2: Llama 3.2:3b analysis (top 1000)");
    console.log("Phase 3: Phi-4 14B critical analysis (top 100)\n");

    // Run the pipeline
    const results = await orchestrator.runThreeStagePipeline();

    console.log("\n✅ Pipeline completed!");
    console.log(`📊 Results:`);
    console.log(`   - Total emails processed: ${results.totalEmails}`);
    console.log(`   - Stage 1 (Pattern triage): ${results.stage1Count} emails`);
    console.log(`   - Stage 2 (Llama analysis): ${results.stage2Count} emails`);
    console.log(
      `   - Stage 3 (Critical analysis): ${results.stage3Count} emails`,
    );
    console.log(`   - Execution ID: ${results.executionId}`);

    // Check some results in the database
    const analysisCount = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN pipeline_stage >= 2 THEN 1 END) as llama_analyzed,
        COUNT(CASE WHEN pipeline_stage = 3 THEN 1 END) as phi_analyzed
      FROM email_analysis
      WHERE pipeline_stage IS NOT NULL
    `,
      )
      .get() as { total: number; llama_analyzed: number; phi_analyzed: number };

    console.log(`\n📊 Database Analysis Results:`);
    console.log(`   - Total analyzed: ${analysisCount.total}`);
    console.log(`   - Llama analyzed: ${analysisCount.llama_analyzed}`);
    console.log(`   - Phi-4 analyzed: ${analysisCount.phi_analyzed}`);
  } catch (error) {
    console.error("❌ Pipeline failed:", error);
    logger.error("Pipeline execution failed", "SCRIPT", error as Error);
  }
}

// Run the analysis
runThreePhaseAnalysis().catch(console.error);
