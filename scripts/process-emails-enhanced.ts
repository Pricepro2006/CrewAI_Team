#!/usr/bin/env tsx

/**
 * Enhanced Email Processing Script
 * Uses the new EmailAnalysisServiceEnhanced that works directly with enhanced DB
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { EmailAnalysisServiceEnhanced } from "../src/core/services/EmailAnalysisServiceEnhanced.js";

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 100;

interface EmailRecord {
  id: string;
  subject: string;
  body_content: string;
  body_preview: string;
  sender_email: string;
  received_date_time: string;
  conversation_id: string;
}

interface ProcessingStats {
  total: number;
  processed: number;
  phase1Only: number;
  phase2Completed: number;
  errors: number;
  startTime: number;
  emailsPerMinute: number;
}

class EnhancedEmailProcessor {
  private db: Database.Database;
  private analysisService: EmailAnalysisServiceEnhanced;
  private stats: ProcessingStats = {
    total: 0,
    processed: 0,
    phase1Only: 0,
    phase2Completed: 0,
    errors: 0,
    startTime: Date.now(),
    emailsPerMinute: 0,
  };

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH);
    this.analysisService = new EmailAnalysisServiceEnhanced(ENHANCED_DB_PATH);
    this.configureDatabase();
  }

  private configureDatabase(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 20000");
  }

  async processEmails(runPhase2: boolean = true): Promise<void> {
    console.log(chalk.cyan(`\n🚀 Enhanced Email Processing (Phase 1${runPhase2 ? '+2' : ' only'})\n`));

    // Check Ollama if Phase 2 is enabled
    if (runPhase2) {
      console.log(chalk.yellow("Checking Ollama service..."));
      try {
        const response = await fetch("http://localhost:11434/api/tags");
        const data = await response.json();
        console.log(chalk.green("✓ Ollama is running"));
        
        const hasLlama = data.models?.some((m: any) => m.name.includes("llama3.2:3b"));
        if (!hasLlama) {
          console.log(chalk.red("❌ llama3.2:3b not found! Please pull the model first."));
          console.log(chalk.yellow("Run: ollama pull llama3.2:3b"));
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red("❌ Ollama is not running! Please start it with: ollama serve"));
        console.log(chalk.yellow("Falling back to Phase 1 only"));
        runPhase2 = false;
      }
    }

    // Get emails to process
    const { count } = this.db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'imported'")
      .get() as any;

    this.stats.total = count;

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
          SELECT id, subject, body_content, body_preview, 
                 sender_email, received_date_time, conversation_id
          FROM emails_enhanced
          WHERE status = 'imported'
          LIMIT ? OFFSET ?
        `)
        .all(BATCH_SIZE, offset) as EmailRecord[];

      if (emails.length === 0) break;

      await this.processBatch(emails, runPhase2);
      offset += BATCH_SIZE;

      this.displayProgress();
    }

    this.displayFinalStats();
    this.cleanup();
  }

  private async processBatch(emails: EmailRecord[], runPhase2: boolean): Promise<void> {
    for (const email of emails) {
      try {
        // Add basic chain analysis
        const emailWithChain = {
          ...email,
          body_content: email.body_content || email.body_preview,
          chainAnalysis: {
            is_complete_chain: false,
            completeness_score: 50,
            chain_type: "email_conversation",
          },
        };

        // Analyze email
        const result = await this.analysisService.analyzeEmail(emailWithChain, { runPhase2 });

        // Save results
        await this.analysisService.saveAnalysis(emailWithChain, result);

        // Update stats
        this.stats.processed++;
        if (result.phase_completed === 1) {
          this.stats.phase1Only++;
        } else {
          this.stats.phase2Completed++;
        }

        // Log progress every 10 emails
        if (this.stats.processed % 10 === 0) {
          console.log(chalk.gray(`  Processed ${this.stats.processed}/${this.stats.total} emails...`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Error processing email ${email.id}:`), error.message);
        this.stats.errors++;
      }
    }
  }

  private displayProgress(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
    this.stats.emailsPerMinute = this.stats.processed / elapsed;

    console.log(
      chalk.cyan(
        `\n📊 Progress: ${this.stats.processed}/${this.stats.total} emails`
      )
    );
    console.log(`  Phase 1 only: ${this.stats.phase1Only}`);
    console.log(`  Phase 2 completed: ${this.stats.phase2Completed}`);
    console.log(`  Rate: ${this.stats.emailsPerMinute.toFixed(0)} emails/min`);
    console.log(`  Errors: ${this.stats.errors}`);
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000 / 60;
    const successRate = ((this.stats.processed / this.stats.total) * 100).toFixed(1);

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(`  Total Emails: ${this.stats.total}`);
    console.log(`  Successfully Processed: ${this.stats.processed} (${successRate}%)`);
    console.log(`  Phase 1 Only: ${this.stats.phase1Only}`);
    console.log(`  Phase 2 Completed: ${this.stats.phase2Completed}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Total Time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Average Rate: ${(this.stats.processed / totalTime).toFixed(0)} emails/min`
    );

    // Show sample results
    const samples = this.db
      .prepare(`
        SELECT subject, workflow_state, priority, confidence_score, phase_completed
        FROM emails_enhanced
        WHERE analyzed_at IS NOT NULL
        ORDER BY analyzed_at DESC
        LIMIT 5
      `)
      .all() as any[];

    if (samples.length > 0) {
      console.log(chalk.cyan("\n📋 Sample Results:"));
      samples.forEach((sample, index) => {
        console.log(`\n${index + 1}. ${sample.subject.substring(0, 60)}...`);
        console.log(
          `   State: ${sample.workflow_state} | Priority: ${sample.priority} | Phase: ${sample.phase_completed || 1} | Confidence: ${(sample.confidence_score * 100).toFixed(0)}%`
        );
      });
    }

    console.log(chalk.green("\n✨ Enhanced email processing complete!"));
    console.log(chalk.yellow("\n📌 Visit http://localhost:5173 to see the results\n"));
  }

  private cleanup(): void {
    this.analysisService.close();
    this.db.close();
  }
}

// Run the processor
async function main() {
  const args = process.argv.slice(2);
  const runPhase2 = !args.includes("--phase1-only");
  
  if (!runPhase2) {
    console.log(chalk.yellow("Running Phase 1 only (rule-based analysis)"));
  }

  const processor = new EnhancedEmailProcessor();
  await processor.processEmails(runPhase2);
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});