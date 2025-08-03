#!/usr/bin/env tsx

/**
 * Optimized Phase 2 Processing
 * Process Phase 1 complete emails with LLM analysis using optimization infrastructure
 */

import Database from "better-sqlite3";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { OllamaOptimizer } from "../src/core/services/OllamaOptimizer.js";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";
import pLimit from "p-limit";

const logger = new Logger("Phase2OptimizedProcessor");
const DB_PATH = "./data/crewai_enhanced.db";

interface ProcessingOptions {
  limit?: number;
  concurrency?: number;
  mode?: "speed" | "balanced" | "quality";
  skipCache?: boolean;
  monitor?: boolean;
}

class Phase2OptimizedProcessor {
  private db: Database.Database;
  private service: EmailThreePhaseAnalysisService;
  private optimizer: OllamaOptimizer | undefined;
  private stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.db = new Database(DB_PATH, { readonly: false });
    this.service = new EmailThreePhaseAnalysisService();
    // Optimizer will be initialized in initialize() method
  }

  async initialize(mode: "speed" | "balanced" | "quality" = "balanced") {
    logger.info(`Initializing Phase 2 processor in ${mode} mode`);

    // Enable foreign keys
    this.db.pragma("foreign_keys = ON");

    // Initialize optimizer
    this.optimizer = new OllamaOptimizer("http://localhost:11434", {
      preloadModels:
        mode === "speed" ? ["qwen3:0.6b"] : ["llama3.2:3b", "qwen3:0.6b"],
      maxConcurrentInference: mode === "speed" ? 30 : 20,
      enableBatching: true,
      maxBatchSize: mode === "speed" ? 20 : 10,
    });
    await this.optimizer.initialize();
  }

  async processPhase2(options: ProcessingOptions = {}) {
    const {
      limit = 10000,
      concurrency = 20,
      mode = "balanced",
      skipCache = false,
      monitor = false,
    } = options;

    logger.info("Starting Phase 2 processing with options:", options);

    // Get Phase 1 complete emails
    const totalPhase1Complete = this.db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM emails_enhanced 
      WHERE status = 'phase1_complete'
    `,
      )
      .get();

    logger.info(`Total Phase 1 complete emails: ${totalPhase1Complete.count}`);

    // Get emails to process
    const emailsToProcess = this.db
      .prepare(
        `
      SELECT 
        id, 
        subject, 
        body_content, 
        sender_email, 
        received_date_time, 
        conversation_id,
        phase1_result
      FROM emails_enhanced
      WHERE status = 'phase1_complete'
      ORDER BY received_date_time DESC
      LIMIT ?
    `,
      )
      .all(limit);

    logger.info(`Processing ${emailsToProcess.length} emails with Phase 2`);

    // Create processing limiter
    const limiter = pLimit(concurrency);

    // Start monitoring if enabled
    let monitorInterval: NodeJS.Timeout | null = null;
    if (monitor) {
      monitorInterval = setInterval(() => this.logProgress(), 5000);
    }

    // Process emails with concurrency control
    const startTime = performance.now();
    const promises = emailsToProcess.map((email, index) =>
      limiter(async () => {
        try {
          await this.processSingleEmail(email, mode, skipCache);

          if (index % 100 === 0) {
            const elapsed = (performance.now() - startTime) / 1000;
            const rate = this.stats.succeeded / elapsed;
            logger.info(
              `Progress: ${this.stats.processed}/${emailsToProcess.length} (${Math.round(rate * 60)} emails/min)`,
            );
          }
        } catch (error) {
          logger.error(`Failed to process ${email.id}: ${error.message}`);
        }
      }),
    );

    // Wait for all processing to complete
    await Promise.all(promises);

    // Stop monitoring
    if (monitorInterval) {
      clearInterval(monitorInterval);
    }

    // Final summary
    this.logFinalSummary(emailsToProcess.length);
  }

  private async processSingleEmail(
    email: any,
    mode: string,
    skipCache: boolean,
  ): Promise<void> {
    this.stats.processed++;

    try {
      // Parse Phase 1 result
      const phase1Result = JSON.parse(email.phase1_result || "{}");

      // Skip if already has Phase 2 data
      if (phase1Result.workflow_state && !skipCache) {
        this.stats.skipped++;
        return;
      }

      // Prepare email data
      const emailData = {
        id: email.id,
        subject: email.subject || "",
        body: email.body_content || "",
        sender_email: email.sender_email,
        received_at: email.received_date_time,
        conversation_id: email.conversation_id,
        phase1_result: phase1Result,
      };

      // Select model based on mode
      const model = mode === "speed" ? "qwen3:0.6b" : "llama3.2:3b";
      const timeout = mode === "speed" ? 3000 : 5000;

      // Run Phase 2 with optimizer
      const phase2Result = await this.optimizer.processWithFallback(
        async () => {
          return await this.service.runPhase2(emailData, {
            skipCache,
            model,
            timeout,
            maxTokens: 800,
          });
        },
        {
          maxRetries: mode === "speed" ? 0 : 1,
          timeout,
          fallbackModel: "qwen3:0.6b",
        },
      );

      // Update database
      this.db
        .prepare(
          `
        UPDATE emails_enhanced 
        SET 
          status = 'phase2_complete',
          phase2_result = ?,
          workflow_state = ?,
          priority = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `,
        )
        .run(
          JSON.stringify(phase2Result),
          phase2Result.workflow_state || "unknown",
          phase2Result.priority || "normal",
          email.id,
        );

      // Save to phase2 table
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO email_analysis_phase2 (
          email_id, workflow_state, priority, action_items,
          key_topics, stakeholders, processing_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          email.id,
          phase2Result.workflow_state || "unknown",
          phase2Result.priority || "normal",
          JSON.stringify(phase2Result.action_items || []),
          JSON.stringify(phase2Result.key_topics || []),
          JSON.stringify(phase2Result.stakeholders || []),
          phase2Result.processing_time || 0,
        );

      this.stats.succeeded++;
    } catch (error) {
      this.stats.failed++;

      // Update status to indicate Phase 2 failed
      this.db
        .prepare(
          `
        UPDATE emails_enhanced 
        SET 
          status = 'phase2_failed',
          updated_at = datetime('now')
        WHERE id = ?
      `,
        )
        .run(email.id);

      throw error;
    }
  }

  private logProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.succeeded / elapsed;
    const eta =
      this.stats.processed > 0
        ? (106893 - this.stats.processed) / rate / 60
        : 0;

    logger.info(`
=== Phase 2 Progress ===
Processed: ${this.stats.processed}
Succeeded: ${this.stats.succeeded}
Failed: ${this.stats.failed}
Skipped: ${this.stats.skipped}
Rate: ${Math.round(rate * 60)} emails/min
ETA: ${Math.round(eta)} minutes
Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
=====================
    `);
  }

  private logFinalSummary(total: number) {
    const totalTime = (Date.now() - this.stats.startTime) / 1000;
    const successRate = (this.stats.succeeded / this.stats.processed) * 100;
    const throughput = (this.stats.succeeded / totalTime) * 60;

    logger.info(`
=============================
Phase 2 Processing Complete
=============================
Total emails: ${total}
Processed: ${this.stats.processed}
Succeeded: ${this.stats.succeeded}
Failed: ${this.stats.failed}
Skipped: ${this.stats.skipped}
Success rate: ${successRate.toFixed(1)}%
Total time: ${Math.round(totalTime)} seconds
Throughput: ${Math.round(throughput)} emails/minute
=============================
    `);

    // Get updated counts
    const statusCounts = this.db
      .prepare(
        `
      SELECT status, COUNT(*) as count 
      FROM emails_enhanced 
      GROUP BY status 
      ORDER BY count DESC
    `,
      )
      .all();

    logger.info("\nUpdated email status distribution:");
    statusCounts.forEach((row) => {
      logger.info(`${row.status}: ${row.count}`);
    });
  }

  async close() {
    if (this.optimizer) {
      await this.optimizer.close();
    }
    this.db.close();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options: ProcessingOptions = {
    limit: 10000,
    concurrency: 20,
    mode: "balanced",
    skipCache: false,
    monitor: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--limit":
        options.limit = parseInt(args[++i]) || 10000;
        break;
      case "--concurrency":
        options.concurrency = parseInt(args[++i]) || 20;
        break;
      case "--mode":
        options.mode = (args[++i] as any) || "balanced";
        break;
      case "--skip-cache":
        options.skipCache = true;
        break;
      case "--monitor":
        options.monitor = true;
        break;
    }
  }

  const processor = new Phase2OptimizedProcessor();

  try {
    await processor.initialize(options.mode);
    await processor.processPhase2(options);

    logger.info("\nNext steps:");
    logger.info("1. Run Phase 3 analysis on complete conversation chains");
    logger.info("2. Process by conversation for workflow detection");
    logger.info("3. Generate analytics and insights");
  } catch (error) {
    logger.error("Phase 2 processing failed:", error);
    process.exit(1);
  } finally {
    await processor.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
