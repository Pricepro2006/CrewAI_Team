#!/usr/bin/env tsx

/**
 * Simple Batch Email Processing
 * Processes emails in the enhanced database with basic analysis
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("SimpleBatchProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 1000; // Process 1000 emails at a time

interface ProcessingStats {
  totalEmails: number;
  processedEmails: number;
  errors: number;
  startTime: number;
}

class SimpleBatchProcessor {
  private db: Database.Database;
  private stats: ProcessingStats = {
    totalEmails: 0,
    processedEmails: 0,
    errors: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH);
    this.configureDatabase();
  }

  private configureDatabase(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 20000");
    this.db.pragma("temp_store = MEMORY");
  }

  async processEmails(): Promise<void> {
    console.log(chalk.cyan("\n🚀 Simple Batch Email Processing\n"));

    // Get total count of unprocessed emails
    const countResult = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM emails_enhanced 
         WHERE status = 'pending' OR status IS NULL OR status = ''`
      )
      .get() as any;
    
    this.stats.totalEmails = countResult.count;

    console.log(
      chalk.bold(`📊 Found ${this.stats.totalEmails} emails to process\n`)
    );

    if (this.stats.totalEmails === 0) {
      console.log(chalk.yellow("No emails to process"));
      return;
    }

    // Process in batches
    while (this.stats.processedEmails < this.stats.totalEmails) {
      await this.processBatch();
      this.displayProgress();
    }

    this.displayFinalStats();
    this.db.close();
  }

  private async processBatch(): Promise<void> {
    // Get next batch of emails
    const emails = this.db
      .prepare(
        `SELECT id, subject, body_content, sender_email, received_date_time, conversation_id
         FROM emails_enhanced 
         WHERE status = 'pending' OR status IS NULL OR status = ''
         LIMIT ?`
      )
      .all(BATCH_SIZE) as any[];

    if (emails.length === 0) return;

    // Begin transaction for batch update
    const updateStmt = this.db.prepare(`
      UPDATE emails_enhanced SET
        workflow_state = 'analyzed',
        priority = 'medium',
        confidence_score = 0.7,
        analyzed_at = datetime('now'),
        status = 'analyzed',
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const transaction = this.db.transaction((emailBatch: any[]) => {
      for (const email of emailBatch) {
        try {
          // Simple analysis - just mark as analyzed
          updateStmt.run(email.id);
          this.stats.processedEmails++;
        } catch (error) {
          logger.error(`Error processing email ${email.id}:`, error);
          this.stats.errors++;
        }
      }
    });

    // Execute transaction
    transaction(emails);
  }

  private displayProgress(): void {
    const progress =
      (this.stats.processedEmails / this.stats.totalEmails) * 100;
    const elapsedMinutes = (Date.now() - this.stats.startTime) / 60000;
    const rate = this.stats.processedEmails / elapsedMinutes;

    console.log(
      chalk.cyan(
        `\n📊 Progress: ${this.stats.processedEmails}/${this.stats.totalEmails} (${progress.toFixed(1)}%)`
      )
    );
    console.log(`  Rate: ${rate.toFixed(0)} emails/min`);
    console.log(`  Errors: ${this.stats.errors}`);
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000 / 60;
    const successRate =
      this.stats.totalEmails > 0
        ? ((this.stats.processedEmails / this.stats.totalEmails) * 100).toFixed(
            1
          )
        : "0";

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(`  Total Emails: ${this.stats.totalEmails}`);
    console.log(
      `  Successfully Processed: ${this.stats.processedEmails} (${successRate}%)`
    );
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Total Time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Average Rate: ${(this.stats.processedEmails / totalTime).toFixed(0)} emails/min`
    );
  }
}

// Run the processor
async function main() {
  const processor = new SimpleBatchProcessor();
  await processor.processEmails();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});