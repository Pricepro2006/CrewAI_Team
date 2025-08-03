#!/usr/bin/env tsx

/**
 * Simple Phase 1+2 Email Processing
 * Runs Phase 1 (rule-based) and Phase 2 (Llama 3.2) with minimal dependencies
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 100; // Process 100 emails at a time

interface EmailRecord {
  id: string;
  subject: string;
  body_content: string;
  sender_email: string;
  received_date_time: string;
  conversation_id: string;
}

class SimplePhase12Processor {
  private db: Database.Database;
  private analysisService = new EmailThreePhaseAnalysisService();
  private processedCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH);
    // Disable foreign key constraints temporarily
    this.db.pragma("foreign_keys = OFF");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
  }

  async processAllEmails(): Promise<void> {
    console.log(chalk.cyan("\n🚀 Simple Phase 1+2 Email Processing\n"));

    // Get total count
    const { count } = this.db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'imported'")
      .get() as any;

    console.log(chalk.bold(`📊 Found ${count} emails to process\n`));

    if (count === 0) {
      console.log(chalk.yellow("No emails to process"));
      return;
    }

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

      await this.processBatch(emails);
      offset += BATCH_SIZE;

      // Display progress
      const elapsed = (Date.now() - this.startTime) / 1000 / 60;
      const rate = this.processedCount / elapsed;
      console.log(
        chalk.cyan(
          `\n📊 Progress: ${this.processedCount}/${count} emails (${rate.toFixed(0)} emails/min)`
        )
      );
    }

    this.displayFinalStats(count);
    this.db.close();
  }

  private async processBatch(emails: EmailRecord[]): Promise<void> {
    for (const email of emails) {
      try {
        // Add simple chain analysis
        (email as any).chainAnalysis = {
          is_complete_chain: false,
          completeness_score: 50,
          chain_type: "email_conversation",
        };

        // Run analysis
        console.log(chalk.gray(`Processing: ${email.subject.substring(0, 50)}...`));
        
        const result = await this.analysisService.analyzeEmail(email, {
          skipCache: false,
          forceAllPhases: false,
        });

        // Update database
        this.db
          .prepare(`
            UPDATE emails_enhanced SET
              workflow_state = ?,
              priority = ?,
              confidence_score = ?,
              analyzed_at = datetime('now'),
              chain_completeness_score = 50,
              extracted_entities = ?,
              status = 'analyzed',
              phase_completed = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `)
          .run(
            result.workflow_state || "analyzed",
            result.priority || "medium",
            result.confidence || 0.7,
            JSON.stringify(result.entities || {}),
            result.strategic_insights ? 2 : 1,
            email.id
          );

        this.processedCount++;
      } catch (error: any) {
        console.error(chalk.red(`Error processing email ${email.id}:`), error.message);
        this.errorCount++;
        
        // Mark as analyzed with error
        this.db
          .prepare(`
            UPDATE emails_enhanced SET
              status = 'analyzed',
              workflow_state = 'error',
              priority = 'low',
              confidence_score = 0.5,
              analyzed_at = datetime('now'),
              updated_at = datetime('now')
            WHERE id = ?
          `)
          .run(email.id);
      }
    }
  }

  private displayFinalStats(totalCount: number): void {
    const totalTime = (Date.now() - this.startTime) / 1000 / 60;
    const successRate = ((this.processedCount / totalCount) * 100).toFixed(1);

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(`  Total Emails: ${totalCount}`);
    console.log(`  Successfully Processed: ${this.processedCount} (${successRate}%)`);
    console.log(`  Errors: ${this.errorCount}`);
    console.log(`  Total Time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Average Rate: ${(this.processedCount / totalTime).toFixed(0)} emails/min`
    );

    console.log(chalk.green("\n✨ Emails processed with Phase 1+2 analysis!"));
    console.log(chalk.yellow("\n📌 Visit http://localhost:5173 to see the emails\n"));
  }
}

// Run the processor
async function main() {
  const processor = new SimplePhase12Processor();
  await processor.processAllEmails();
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});