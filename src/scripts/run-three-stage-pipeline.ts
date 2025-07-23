#!/usr/bin/env tsx

/**
 * Execute the Three-Stage Email Analysis Pipeline
 * This script orchestrates the complete pipeline execution
 */

import { PipelineOrchestrator } from "../core/pipeline/PipelineOrchestrator";
import { logger } from "../utils/logger";
import { getDatabaseConnection } from "../database/connection";
import * as fs from "fs/promises";
import * as path from "path";

async function checkPrerequisites(): Promise<boolean> {
  logger.info("Checking prerequisites...", "PIPELINE");

  // Check if Llama 3.2:3b is available
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    const data = await response.json();
    const models = data.models || [];
    
    const hasLlama = models.some((m: any) => m.name === "llama3.2:3b");
    if (!hasLlama) {
      logger.error("Llama 3.2:3b model not found. Please run: ollama pull llama3.2:3b", "PIPELINE");
      return false;
    }

    // Check for Phi-4 (optional)
    const hasPhi4 = models.some((m: any) => m.name.includes("phi-4"));
    if (!hasPhi4) {
      logger.warn("Phi-4 model not found. Stage 3 will use Llama 3.2:3b fallback", "PIPELINE");
    }

  } catch (error) {
    logger.error("Ollama not running. Please start Ollama first", "PIPELINE");
    return false;
  }

  // Check database
  try {
    const db = getDatabaseConnection();
    const emailCount = db.prepare("SELECT COUNT(*) as count FROM emails_enhanced").get() as { count: number };

    logger.info(`Found ${emailCount?.count || 0} emails in database`, "PIPELINE");

    if (!emailCount?.count) {
      logger.error("No emails found in database", "PIPELINE");
      return false;
    }

  } catch (error) {
    logger.error("Database connection failed", "PIPELINE", error as Error);
    return false;
  }

  // Check disk space (rough estimate: 2GB needed)
  const stats = await fs.statfs("/");
  const freeGB = stats.bfree * stats.bsize / (1024 * 1024 * 1024);
  if (freeGB < 2) {
    logger.warn(`Low disk space: ${freeGB.toFixed(2)}GB free`, "PIPELINE");
  }

  return true;
}

async function createProgressMonitor(orchestrator: PipelineOrchestrator) {
  const interval = setInterval(async () => {
    const status = await orchestrator.getStatus();
    if (status.status === 'running') {
      const total = 33797;
      const stage1Progress = (status.stage1_count || 0) / total * 100;
      const stage2Progress = (status.stage2_count || 0) / 5000 * 100;
      const stage3Progress = (status.stage3_count || 0) / 500 * 100;

      console.clear();
      console.log("=".repeat(60));
      console.log("Three-Stage Pipeline Progress");
      console.log("=".repeat(60));
      console.log(`Stage 1 (Pattern Triage):  [${progressBar(stage1Progress)}] ${stage1Progress.toFixed(1)}%`);
      console.log(`Stage 2 (Llama Analysis):  [${progressBar(stage2Progress)}] ${stage2Progress.toFixed(1)}%`);
      console.log(`Stage 3 (Critical):        [${progressBar(stage3Progress)}] ${stage3Progress.toFixed(1)}%`);
      console.log("=".repeat(60));
    }
  }, 5000); // Update every 5 seconds

  return () => clearInterval(interval);
}

function progressBar(percentage: number): string {
  const width = 40;
  const filled = Math.round(width * percentage / 100);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

async function main() {
  console.log("\n🚀 Three-Stage Email Analysis Pipeline");
  console.log("=====================================\n");

  // Check prerequisites
  if (!await checkPrerequisites()) {
    process.exit(1);
  }

  // Create backup
  logger.info("Creating database backup...", "PIPELINE");
  const backupPath = `data/app.db.backup-pipeline-${Date.now()}`;
  await fs.copyFile("data/app.db", backupPath);
  logger.info(`Backup created: ${backupPath}`, "PIPELINE");

  // Initialize orchestrator
  const orchestrator = new PipelineOrchestrator();

  // Start progress monitor
  const stopMonitor = await createProgressMonitor(orchestrator);

  try {
    logger.info("Starting pipeline execution...", "PIPELINE");
    const startTime = Date.now();

    // Run the pipeline
    const results = await orchestrator.runThreeStagePipeline();

    stopMonitor();

    const totalTime = (Date.now() - startTime) / 1000;
    const hours = Math.floor(totalTime / 3600);
    const minutes = Math.floor((totalTime % 3600) / 60);
    const seconds = Math.floor(totalTime % 60);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("Pipeline Execution Complete!");
    console.log("=".repeat(60));
    console.log(`Total Emails Processed: ${results.totalEmails}`);
    console.log(`Stage 1 (Pattern Triage): ${results.stage1Count} emails`);
    console.log(`Stage 2 (Llama Analysis): ${results.stage2Count} emails`);
    console.log(`Stage 3 (Critical Analysis): ${results.stage3Count} emails`);
    console.log(`Total Time: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`Execution ID: ${results.executionId}`);
    console.log("=".repeat(60));

    // Generate report
    const reportPath = `pipeline_report_${results.executionId}.json`;
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    logger.info(`Detailed report saved: ${reportPath}`, "PIPELINE");

  } catch (error) {
    stopMonitor();
    logger.error("Pipeline execution failed", "PIPELINE", error as Error);
    console.error("\n❌ Pipeline failed:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info("Received interrupt signal, shutting down gracefully...", "PIPELINE");
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info("Received termination signal, shutting down gracefully...", "PIPELINE");
  process.exit(0);
});

// Run the pipeline
main().catch((error) => {
  logger.error("Unhandled error", "PIPELINE", error as Error);
  process.exit(1);
});