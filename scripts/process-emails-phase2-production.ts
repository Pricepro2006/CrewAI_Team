#!/usr/bin/env tsx

/**
 * Production Phase 2 Processing
 * Optimized for processing all 106K+ emails efficiently
 */

import Database from "better-sqlite3";
import axios from "axios";
import { Logger } from "../src/utils/logger.js";
import * as fs from "fs";

const logger = new Logger("Phase2Production");
const DB_PATH = "./data/crewai_enhanced.db";
const OLLAMA_URL = "http://localhost:11434/api/generate";
const CHECKPOINT_FILE = "./data/phase2-checkpoint.json";

interface Checkpoint {
  lastProcessedId: string;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  startTime: number;
}

class Phase2ProductionProcessor {
  private db: Database.Database;
  private checkpoint: Checkpoint;

  constructor() {
    this.db = new Database(DB_PATH, { readonly: false });
    this.db.pragma("foreign_keys = ON");
    this.checkpoint = this.loadCheckpoint();
  }

  private loadCheckpoint(): Checkpoint {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, "utf-8");
      return JSON.parse(data);
    }
    return {
      lastProcessedId: "",
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      startTime: Date.now(),
    };
  }

  private saveCheckpoint() {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(this.checkpoint, null, 2));
  }

  private async callOllama(prompt: string, timeout = 8000): Promise<any> {
    try {
      const response = await axios.post(
        OLLAMA_URL,
        {
          model: "qwen3:0.6b",
          prompt,
          format: "json",
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            num_predict: 150,
            num_ctx: 512, // Smaller context for speed
          },
        },
        { timeout },
      );

      // Parse response
      try {
        return JSON.parse(response.data.response);
      } catch {
        const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Invalid JSON response");
      }
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        throw new Error("Timeout");
      }
      throw error;
    }
  }

  async process(batchSize: number = 50, maxConcurrent: number = 5) {
    logger.info("Starting Phase 2 production processing");
    logger.info(
      `Checkpoint: ${this.checkpoint.totalProcessed} already processed`,
    );

    // Get total count
    const totalCount = this.db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM emails_enhanced 
      WHERE status = 'phase1_complete'
    `,
      )
      .get();

    logger.info(`Total Phase 1 complete emails: ${totalCount.count}`);
    logger.info(
      `Remaining: ${totalCount.count - this.checkpoint.totalProcessed}`,
    );

    const continueProcessing = true;
    const startTime = this.checkpoint.startTime || Date.now();

    while (continueProcessing) {
      // Get next batch
      const query = this.checkpoint.lastProcessedId
        ? `SELECT * FROM emails_enhanced 
           WHERE status = 'phase1_complete' 
           AND id > ? 
           ORDER BY id 
           LIMIT ?`
        : `SELECT * FROM emails_enhanced 
           WHERE status = 'phase1_complete' 
           ORDER BY id 
           LIMIT ?`;

      const emails = this.checkpoint.lastProcessedId
        ? this.db.prepare(query).all(this.checkpoint.lastProcessedId, batchSize)
        : this.db.prepare(query).all(batchSize);

      if (emails.length === 0) {
        logger.info("No more emails to process");
        break;
      }

      // Process batch in chunks
      for (let i = 0; i < emails.length; i += maxConcurrent) {
        const chunk = emails.slice(i, i + maxConcurrent);
        const promises = chunk.map((email) => this.processEmail(email));
        await Promise.all(promises);
      }

      // Update checkpoint
      this.checkpoint.lastProcessedId = emails[emails.length - 1].id;
      this.saveCheckpoint();

      // Progress report
      const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
      const rate = this.checkpoint.totalSucceeded / elapsed;
      const remaining = totalCount.count - this.checkpoint.totalProcessed;
      const eta = remaining / rate;

      logger.info(`
=== Progress Report ===
Processed: ${this.checkpoint.totalProcessed}/${totalCount.count} (${Math.round((this.checkpoint.totalProcessed / totalCount.count) * 100)}%)
Succeeded: ${this.checkpoint.totalSucceeded}
Failed: ${this.checkpoint.totalFailed}
Rate: ${Math.round(rate)} emails/minute
ETA: ${Math.round(eta)} minutes (${Math.round(eta / 60)} hours)
Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
=====================
      `);

      // Check if we should continue
      if (process.env.PHASE2_LIMIT) {
        const limit = parseInt(process.env.PHASE2_LIMIT);
        if (this.checkpoint.totalProcessed >= limit) {
          logger.info(`Reached limit of ${limit} emails`);
          break;
        }
      }
    }

    this.complete();
  }

  private async processEmail(email: any): Promise<void> {
    try {
      const phase1 = JSON.parse(email.phase1_result || "{}");

      // Build minimal prompt for speed
      const prompt = `Email analysis:
Subject: ${(email.subject || "").substring(0, 100)}
Body: ${(email.body_content || "").substring(0, 300)}
Sentiment: ${phase1.sentiment}
Priority: ${phase1.priority}

Determine workflow state (ONE of: QUOTE_REQUEST, ORDER_PLACED, SUPPORT_INQUIRY, INFORMATION, NEGOTIATION, ESCALATION, OTHER) and business impact.

JSON response:`;

      const result = await this.callOllama(prompt);

      // Validate and fix result
      const workflow = result.workflow_state || "OTHER";
      const validWorkflows = [
        "QUOTE_REQUEST",
        "ORDER_PLACED",
        "SUPPORT_INQUIRY",
        "INFORMATION",
        "NEGOTIATION",
        "ESCALATION",
        "OTHER",
      ];
      const finalWorkflow = validWorkflows.includes(workflow)
        ? workflow
        : "OTHER";

      const priority = result.priority || phase1.priority || "medium";
      const validPriorities = ["critical", "high", "medium", "low"];
      const finalPriority = validPriorities.includes(priority)
        ? priority
        : "medium";

      // Update database
      this.db
        .prepare(
          `
        UPDATE emails_enhanced 
        SET status = 'phase2_complete',
            phase2_result = ?,
            workflow_state = ?,
            priority = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `,
        )
        .run(
          JSON.stringify({
            workflow_state: finalWorkflow,
            priority: finalPriority,
            action_items: result.action_items || [],
            business_impact: result.business_impact || "medium",
          }),
          finalWorkflow,
          finalPriority,
          email.id,
        );

      this.checkpoint.totalSucceeded++;
    } catch (error) {
      logger.debug(`Failed ${email.id.substring(0, 8)}: ${error.message}`);

      // Mark as failed
      this.db
        .prepare(
          `
        UPDATE emails_enhanced 
        SET status = 'phase2_failed',
            updated_at = datetime('now')
        WHERE id = ?
      `,
        )
        .run(email.id);

      this.checkpoint.totalFailed++;
    }

    this.checkpoint.totalProcessed++;
  }

  private complete() {
    const totalTime = (Date.now() - this.checkpoint.startTime) / 1000 / 60; // minutes

    logger.info(`
=============================
Phase 2 Production Complete
=============================
Total Processed: ${this.checkpoint.totalProcessed}
Succeeded: ${this.checkpoint.totalSucceeded}
Failed: ${this.checkpoint.totalFailed}
Success Rate: ${Math.round((this.checkpoint.totalSucceeded / this.checkpoint.totalProcessed) * 100)}%
Total Time: ${Math.round(totalTime)} minutes (${Math.round(totalTime / 60)} hours)
Average Rate: ${Math.round(this.checkpoint.totalSucceeded / totalTime)} emails/minute
=============================
    `);

    // Get final status counts
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

    logger.info("\nFinal email status distribution:");
    statusCounts.forEach((row) => {
      logger.info(`${row.status}: ${row.count}`);
    });

    // Clean up checkpoint file
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.renameSync(CHECKPOINT_FILE, `${CHECKPOINT_FILE}.completed`);
    }

    this.db.close();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const batchSize = parseInt(args[0]) || 50;
  const maxConcurrent = parseInt(args[1]) || 5;

  logger.info("Phase 2 Production Processor");
  logger.info(`Batch size: ${batchSize}`);
  logger.info(`Max concurrent: ${maxConcurrent}`);
  logger.info(`Checkpoint enabled: Will resume from last position`);

  const processor = new Phase2ProductionProcessor();

  try {
    await processor.process(batchSize, maxConcurrent);
  } catch (error) {
    logger.error("Processing failed:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("\nGraceful shutdown initiated...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("\nGraceful shutdown initiated...");
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
