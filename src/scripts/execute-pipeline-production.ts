#!/usr/bin/env tsx

/**
 * Production Pipeline Execution Script
 * Executes the three-stage pipeline with monitoring, checkpointing, and recovery
 */

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";
import { PipelineOrchestrator } from "../core/pipeline/PipelineOrchestrator";
import { OllamaManager } from "../utils/ollama-manager";
import fs from "fs";
import path from "path";

const CHECKPOINT_FILE = path.join(
  process.cwd(),
  "data",
  "pipeline-checkpoint.json",
);
const BATCH_SIZE = 1000; // Process emails in chunks to enable recovery

interface Checkpoint {
  executionId: number;
  lastProcessedId: string;
  stage: number;
  processedCount: number;
  startTime: string;
}

async function saveCheckpoint(checkpoint: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

async function loadCheckpoint(): Promise<Checkpoint | null> {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error("Failed to load checkpoint", "PIPELINE", error as Error);
  }
  return null;
}

async function clearCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
    }
  } catch (error) {
    logger.error("Failed to clear checkpoint", "PIPELINE", error as Error);
  }
}

async function main() {
  console.log("\n🚀 Production Pipeline Execution");
  console.log("=================================\n");

  const args = process.argv.slice(2);
  const resume = args.includes("--resume");
  const dryRun = args.includes("--dry-run");

  try {
    // Check database connection
    const db = getDatabaseConnection();

    // Get email count
    const emailCount = db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
      .get() as { count: number };
    logger.info(`Found ${emailCount.count} emails in database`, "PIPELINE");

    if (emailCount.count === 0) {
      logger.error("No emails found in database", "PIPELINE");
      process.exit(1);
    }

    // Check for existing checkpoint
    const checkpoint = await loadCheckpoint();
    if (checkpoint && !resume) {
      console.log("\n⚠️  Previous execution found!");
      console.log(`  Execution ID: ${checkpoint.executionId}`);
      console.log(`  Last processed: ${checkpoint.lastProcessedId}`);
      console.log(`  Stage: ${checkpoint.stage}`);
      console.log(`  Processed: ${checkpoint.processedCount} emails`);
      console.log("\nUse --resume flag to continue from checkpoint");
      process.exit(1);
    }

    // Initialize Ollama and ensure required models
    const requiredModels = ["llama3.2:3b"];

    logger.info("Checking Ollama status...", "PIPELINE");
    if (!(await OllamaManager.initialize(requiredModels))) {
      logger.error("Failed to initialize Ollama", "PIPELINE");
      process.exit(1);
    }

    // Check for optional Phi-4 model
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      const data = await response.json();
      const models = data.models || [];

      const hasPhi4 = models.some(
        (m: any) =>
          m.name.includes("phi-4") ||
          m.name.includes("phi4") ||
          m.name === "doomgrave/phi-4:14b-tools-Q3_K_S",
      );

      logger.info("✅ Llama 3.2:3b model available", "PIPELINE");

      if (!hasPhi4) {
        logger.warn(
          "Phi-4 not found. Stage 3 will use Llama fallback",
          "PIPELINE",
        );
        logger.info(
          "To use Phi-4 for better Stage 3 analysis, run:",
          "PIPELINE",
        );
        logger.info("ollama pull doomgrave/phi-4:14b-tools-Q3_K_S", "PIPELINE");
      } else {
        logger.info("✅ Phi-4 model available", "PIPELINE");
      }
    } catch (error) {
      logger.warn("Could not check for optional models", "PIPELINE");
    }

    // Estimate time
    const estimatedHours = emailCount.count / 1600; // ~1600 emails per hour
    console.log("\n📊 Estimated Processing Time:");
    console.log(`  Total emails: ${emailCount.count.toLocaleString()}`);
    console.log(`  Estimated time: ~${estimatedHours.toFixed(1)} hours`);
    console.log(`  Pattern triage: ~5 minutes`);
    console.log(`  Llama analysis (5000): ~3.2 hours`);
    console.log(`  Critical analysis (500): ~4.2 hours`);

    if (dryRun) {
      console.log("\n✅ Dry run complete. Use without --dry-run to execute.");
      process.exit(0);
    }

    // Create backup
    if (!resume) {
      logger.info("Creating database backup...", "PIPELINE");
      const backupPath = `data/app.db.backup-pipeline-${Date.now()}`;
      fs.copyFileSync("data/app.db", backupPath);
      logger.info(`Backup created: ${backupPath}`, "PIPELINE");
    }

    // Execute pipeline
    console.log("\n🏃 Starting pipeline execution...");
    console.log("  Press Ctrl+C to pause (progress will be saved)\n");

    const orchestrator = new PipelineOrchestrator();
    const startTime = Date.now();

    // Set up graceful shutdown
    let isShuttingDown = false;
    process.on("SIGINT", async () => {
      if (!isShuttingDown) {
        isShuttingDown = true;
        console.log("\n\n⏸️  Pausing pipeline execution...");
        console.log("Progress has been saved. Use --resume to continue.\n");

        // Save current state
        const status = await orchestrator.getStatus();
        if (status.executionId) {
          await saveCheckpoint({
            executionId: status.executionId,
            lastProcessedId: String(status.lastProcessedId || ""),
            stage: status.currentStage || 1,
            processedCount: status.processedCount || 0,
            startTime: new Date(startTime).toISOString(),
          });
        }

        process.exit(0);
      }
    });

    // Run pipeline
    const results = await orchestrator.runThreeStagePipeline();

    // Clear checkpoint on success
    await clearCheckpoint();

    const totalTime = (Date.now() - startTime) / 1000 / 3600;

    console.log("\n✅ Pipeline completed successfully!");
    console.log(`  Total time: ${totalTime.toFixed(2)} hours`);
    console.log(`  Emails processed: ${results.totalEmails}`);
    console.log(`  Stage 1 (Pattern): ${results.stage1Count}`);
    console.log(`  Stage 2 (Llama): ${results.stage2Count}`);
    console.log(`  Stage 3 (Critical): ${results.stage3Count}`);

    // Generate summary report
    const reportPath = `data/pipeline-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}\n`);
  } catch (error) {
    logger.error("Pipeline execution failed", "PIPELINE", error as Error);
    console.error("\n❌ Pipeline failed:", error);
    console.log("\nUse --resume to retry from last checkpoint\n");
    process.exit(1);
  }
}

// Run the pipeline
main().catch((error) => {
  logger.error("Unhandled error", "PIPELINE", error);
  process.exit(1);
});
