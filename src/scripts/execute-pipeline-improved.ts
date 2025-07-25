#!/usr/bin/env tsx

/**
 * Improved Pipeline Execution Script
 * Handles timeout issues, progress tracking, and recovery
 * Updated: July 24, 2025
 */

import { PipelineOrchestrator } from "../core/pipeline/PipelineOrchestrator";
import { logger } from "../utils/logger";
import { MODEL_CONFIG } from "../config/models.config";

interface ExecutionMetrics {
  startTime: number;
  stage1Time?: number;
  stage2Time?: number;
  stage3Time?: number;
  totalEmails: number;
  stage1Count: number;
  stage2Count: number;
  stage3Count: number;
  successRate: number;
}

class ImprovedPipelineExecutor {
  private orchestrator: PipelineOrchestrator;
  private metrics: ExecutionMetrics;
  private isRunning = false;

  constructor() {
    this.orchestrator = new PipelineOrchestrator();
    this.metrics = {
      startTime: Date.now(),
      totalEmails: 0,
      stage1Count: 0,
      stage2Count: 0,
      stage3Count: 0,
      successRate: 0,
    };
  }

  /**
   * Execute the complete pipeline with improved error handling
   */
  async execute(): Promise<void> {
    this.isRunning = true;

    // Set up graceful shutdown
    this.setupGracefulShutdown();

    try {
      logger.info(
        "🚀 Starting Improved Three-Stage Pipeline Execution",
        "EXECUTOR",
      );
      this.logConfiguration();

      // Pre-flight checks
      await this.performPreflightChecks();

      // Execute pipeline
      const results = await this.orchestrator.runThreeStagePipeline();

      // Update metrics
      this.updateMetrics(results);

      // Log final results
      this.logCompletionResults();
    } catch (error) {
      logger.error("❌ Pipeline execution failed", "EXECUTOR", error as Error);
      await this.handleExecutionFailure(error as Error);
      process.exit(1);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Log current configuration
   */
  private logConfiguration(): void {
    logger.info("📋 Pipeline Configuration:", "EXECUTOR");
    logger.info(
      `  • Llama 3.2:3b timeout: ${MODEL_CONFIG.timeouts.primary / 1000}s per email`,
      "EXECUTOR",
    );
    logger.info(
      `  • Batch size: ${MODEL_CONFIG.batchSizes.primary} emails`,
      "EXECUTOR",
    );
    logger.info(
      `  • Batch timeout: ${MODEL_CONFIG.timeouts.batch / 1000}s`,
      "EXECUTOR",
    );
    logger.info(
      `  • Target emails: Stage 1: ${MODEL_CONFIG.pipeline.stages.triage.targetEmails}, Stage 2: ${MODEL_CONFIG.pipeline.stages.priority.targetEmails}, Stage 3: ${MODEL_CONFIG.pipeline.stages.critical.targetEmails}`,
      "EXECUTOR",
    );
  }

  /**
   * Perform pre-flight checks
   */
  private async performPreflightChecks(): Promise<void> {
    logger.info("🔍 Performing pre-flight checks...", "EXECUTOR");

    // Check if Ollama is running
    try {
      const axios = (await import("axios")).default;
      await axios.get(`${MODEL_CONFIG.api.ollamaUrl}/api/tags`, {
        timeout: 5000,
      });
      logger.info("✅ Ollama is running and accessible", "EXECUTOR");
    } catch (error) {
      throw new Error(
        `❌ Ollama is not accessible at ${MODEL_CONFIG.api.ollamaUrl}. Please start Ollama first.`,
      );
    }

    // Check if model is available
    try {
      const axios = (await import("axios")).default;
      const response = await axios.get(
        `${MODEL_CONFIG.api.ollamaUrl}/api/tags`,
        { timeout: 5000 },
      );
      const models = response.data.models || [];
      const hasLlama = models.some(
        (model: any) => model.name === MODEL_CONFIG.models.primary,
      );

      if (!hasLlama) {
        throw new Error(
          `❌ Model ${MODEL_CONFIG.models.primary} is not available. Please pull it first: ollama pull ${MODEL_CONFIG.models.primary}`,
        );
      }

      logger.info(
        `✅ Model ${MODEL_CONFIG.models.primary} is available`,
        "EXECUTOR",
      );
    } catch (error) {
      if ((error as any).message.includes("Model")) {
        throw error;
      }
      logger.warn(
        "⚠️  Could not verify model availability, continuing...",
        "EXECUTOR",
      );
    }

    logger.info("✅ Pre-flight checks completed", "EXECUTOR");
  }

  /**
   * Update execution metrics
   */
  private updateMetrics(results: any): void {
    this.metrics.totalEmails = results.totalEmails;
    this.metrics.stage1Count = results.stage1Count;
    this.metrics.stage2Count = results.stage2Count;
    this.metrics.stage3Count = results.stage3Count;
    this.metrics.successRate =
      (results.stage2Count /
        Math.min(
          results.stage1Count,
          MODEL_CONFIG.pipeline.stages.priority.targetEmails,
        )) *
      100;
  }

  /**
   * Log completion results
   */
  private logCompletionResults(): void {
    const totalTime = (Date.now() - this.metrics.startTime) / 1000;

    logger.info("🎉 Pipeline Execution Completed Successfully!", "EXECUTOR");
    logger.info("📊 Final Metrics:", "EXECUTOR");
    logger.info(
      `  • Total Emails Processed: ${this.metrics.totalEmails.toLocaleString()}`,
      "EXECUTOR",
    );
    logger.info(
      `  • Stage 1 (Pattern Triage): ${this.metrics.stage1Count.toLocaleString()} emails`,
      "EXECUTOR",
    );
    logger.info(
      `  • Stage 2 (Llama Analysis): ${this.metrics.stage2Count.toLocaleString()} emails`,
      "EXECUTOR",
    );
    logger.info(
      `  • Stage 3 (Critical Analysis): ${this.metrics.stage3Count.toLocaleString()} emails`,
      "EXECUTOR",
    );
    logger.info(
      `  • Stage 2 Success Rate: ${this.metrics.successRate.toFixed(1)}%`,
      "EXECUTOR",
    );
    logger.info(
      `  • Total Execution Time: ${(totalTime / 3600).toFixed(2)} hours`,
      "EXECUTOR",
    );
    logger.info(
      `  • Average Time per Email: ${(totalTime / this.metrics.totalEmails).toFixed(2)}s`,
      "EXECUTOR",
    );
  }

  /**
   * Handle execution failure
   */
  private async handleExecutionFailure(error: Error): Promise<void> {
    logger.error("💥 Execution Failed - Error Details:", "EXECUTOR");
    logger.error(`  • Error: ${error.message}`, "EXECUTOR");
    logger.error(
      `  • Time to Failure: ${((Date.now() - this.metrics.startTime) / 1000 / 60).toFixed(1)} minutes`,
      "EXECUTOR",
    );

    // Save current state for potential recovery
    const status = await this.orchestrator.getStatus();
    if (status && status.id) {
      logger.info(
        `💾 Execution record ID: ${status.id} (for recovery)`,
        "EXECUTOR",
      );
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const signals = ["SIGTERM", "SIGINT", "SIGUSR2"] as const;

    signals.forEach((signal) => {
      process.on(signal, async () => {
        if (this.isRunning) {
          logger.info(
            `🛑 Received ${signal}, initiating graceful shutdown...`,
            "EXECUTOR",
          );

          // Get current status
          const status = await this.orchestrator.getStatus();
          if (status) {
            logger.info(
              `💾 Current progress saved - Execution ID: ${status.id}`,
              "EXECUTOR",
            );
            logger.info(
              `  • Stage 1: ${status.stage1_count || 0} emails`,
              "EXECUTOR",
            );
            logger.info(
              `  • Stage 2: ${status.stage2_count || 0} emails`,
              "EXECUTOR",
            );
            logger.info(
              `  • Stage 3: ${status.stage3_count || 0} emails`,
              "EXECUTOR",
            );
          }

          process.exit(0);
        }
      });
    });
  }
}

// Main execution
async function main() {
  const executor = new ImprovedPipelineExecutor();
  await executor.execute();
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("🚨 Unhandled Promise Rejection", "EXECUTOR", reason as Error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("🚨 Uncaught Exception", "EXECUTOR", error);
  process.exit(1);
});

if (require.main === module) {
  main().catch((error) => {
    logger.error("🚨 Fatal Error", "EXECUTOR", error);
    process.exit(1);
  });
}

export { ImprovedPipelineExecutor };
