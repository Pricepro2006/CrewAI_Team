#!/usr/bin/env tsx

/**
 * Phase 1 Only Email Processing
 * Runs only Phase 1 (rule-based) analysis for quick results
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { EmailEntityExtractor } from "../src/services/EmailEntityExtractor.js";

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 1000; // Process 1000 emails at a time (fast rule-based)

interface EmailRecord {
  id: string;
  subject: string;
  body_content: string;
  sender_email: string;
  received_date_time: string;
  conversation_id: string;
}

class Phase1Processor {
  private db: Database.Database;
  private entityExtractor = new EmailEntityExtractor();
  private processedCount = 0;
  private startTime = Date.now();

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH);
    this.db.pragma("foreign_keys = OFF");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
  }

  async processAllEmails(): Promise<void> {
    console.log(chalk.cyan("\n🚀 Phase 1 Rule-Based Email Processing\n"));

    // Get total count
    const { count } = this.db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'imported'")
      .get() as any;

    console.log(chalk.bold(`📊 Found ${count} emails to process\n`));

    if (count === 0) {
      console.log(chalk.yellow("No emails to process"));
      return;
    }

    // Prepare update statement
    const updateStmt = this.db.prepare(`
      UPDATE emails_enhanced SET
        workflow_state = ?,
        priority = ?,
        confidence_score = ?,
        analyzed_at = datetime('now'),
        chain_completeness_score = 50,
        extracted_entities = ?,
        status = 'analyzed',
        phase_completed = 1,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    // Process in batches
    let offset = 0;
    while (offset < count) {
      const emails = this.db
        .prepare(`
          SELECT id, subject, body_content, sender_email, 
                 received_date_time, conversation_id
          FROM emails_enhanced
          WHERE status = 'imported'
          LIMIT ? OFFSET ?
        `)
        .all(BATCH_SIZE, offset) as EmailRecord[];

      if (emails.length === 0) break;

      // Process batch with transaction
      const transaction = this.db.transaction(() => {
        for (const email of emails) {
          try {
            // Extract entities with rule-based system
            const entities = this.entityExtractor.extractEntities(email);
            
            // Determine workflow state and priority
            const { workflow_state, priority } = this.analyzeEmail(email, entities);

            updateStmt.run(
              workflow_state,
              priority,
              0.7, // Phase 1 confidence
              JSON.stringify(entities),
              email.id
            );

            this.processedCount++;
          } catch (error: any) {
            console.error(chalk.red(`Error processing ${email.id}:`), error.message);
          }
        }
      });

      transaction();
      offset += BATCH_SIZE;

      // Display progress
      const elapsed = (Date.now() - this.startTime) / 1000 / 60;
      const rate = this.processedCount / elapsed;
      console.log(
        chalk.cyan(
          `📊 Progress: ${this.processedCount}/${count} emails (${rate.toFixed(0)} emails/min)`
        )
      );
    }

    this.displayFinalStats(count);
    this.db.close();
  }

  private analyzeEmail(email: EmailRecord, entities: any): { workflow_state: string; priority: string } {
    const subject = email.subject.toLowerCase();
    const body = email.body_content.toLowerCase();
    const combined = subject + " " + body;

    // Determine workflow state
    let workflow_state = "pending";
    if (
      combined.includes("complete") || 
      combined.includes("resolved") || 
      combined.includes("closed") ||
      combined.includes("delivered")
    ) {
      workflow_state = "completed";
    } else if (
      combined.includes("in progress") || 
      combined.includes("working on") || 
      combined.includes("processing") ||
      subject.includes("re:") ||
      subject.includes("fw:")
    ) {
      workflow_state = "in_progress";
    }

    // Determine priority
    let priority = "medium";
    if (
      combined.includes("urgent") || 
      combined.includes("critical") || 
      combined.includes("asap") ||
      combined.includes("immediately") ||
      combined.includes("emergency")
    ) {
      priority = "critical";
    } else if (
      combined.includes("high priority") || 
      combined.includes("important") ||
      combined.includes("priority")
    ) {
      priority = "high";
    } else if (
      combined.includes("low priority") || 
      combined.includes("when possible") ||
      combined.includes("no rush")
    ) {
      priority = "low";
    }

    return { workflow_state, priority };
  }

  private displayFinalStats(totalCount: number): void {
    const totalTime = (Date.now() - this.startTime) / 1000 / 60;
    const successRate = ((this.processedCount / totalCount) * 100).toFixed(1);

    console.log(chalk.green("\n\n✅ Phase 1 Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(`  Total Emails: ${totalCount}`);
    console.log(`  Successfully Processed: ${this.processedCount} (${successRate}%)`);
    console.log(`  Total Time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Average Rate: ${(this.processedCount / totalTime).toFixed(0)} emails/min`
    );

    // Show sample results
    const samples = this.db
      .prepare(`
        SELECT subject, workflow_state, priority, confidence_score
        FROM emails_enhanced
        WHERE phase_completed = 1
        ORDER BY analyzed_at DESC
        LIMIT 5
      `)
      .all() as any[];

    if (samples.length > 0) {
      console.log(chalk.cyan("\n📋 Sample Results:"));
      samples.forEach((sample, index) => {
        console.log(`\n${index + 1}. ${sample.subject.substring(0, 60)}...`);
        console.log(
          `   State: ${sample.workflow_state} | Priority: ${sample.priority} | Confidence: ${(sample.confidence_score * 100).toFixed(0)}%`
        );
      });
    }

    console.log(chalk.green("\n✨ Phase 1 analysis complete!"));
    console.log(chalk.yellow("📌 Run Phase 2 separately for enhanced analysis"));
    console.log(chalk.yellow("\n📌 Visit http://localhost:5173 to see the emails\n"));
  }
}

// Run the processor
async function main() {
  const processor = new Phase1Processor();
  await processor.processAllEmails();
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});