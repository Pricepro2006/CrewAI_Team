#!/usr/bin/env tsx

/**
 * Simple Email Processing Script
 * Processes emails directly without complex chain analysis
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { Ollama } from "ollama";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("SimpleEmailProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 10;

interface ProcessingStats {
  total: number;
  processed: number;
  errors: number;
  startTime: number;
}

class SimpleEmailProcessor {
  private db: Database.Database;
  private ollama: Ollama;
  private stats: ProcessingStats = {
    total: 0,
    processed: 0,
    errors: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH, { readonly: true });
    this.ollama = new Ollama({ host: "http://localhost:11434" });
  }

  async processEmails(): Promise<void> {
    console.log(chalk.cyan("\n🚀 Starting Simple Email Processing\n"));

    // Get conversations with multiple emails
    const conversations = this.db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MIN(subject) as first_subject
      FROM emails_enhanced
      GROUP BY conversation_id
      HAVING email_count > 1
      ORDER BY email_count DESC
      LIMIT 100
    `,
      )
      .all() as any[];

    this.stats.total = conversations.length;
    console.log(`Processing ${conversations.length} conversations...\n`);

    for (const conv of conversations) {
      await this.processConversation(conv);

      // Display progress every 10 conversations
      if (this.stats.processed % 10 === 0 && this.stats.processed > 0) {
        this.displayProgress();
      }
    }

    this.displayFinalStats();
    this.db.close();
  }

  private async processConversation(conv: any): Promise<void> {
    try {
      console.log(
        chalk.gray(
          `\n[${this.stats.processed + 1}/${this.stats.total}] Processing ${conv.conversation_id}`,
        ),
      );
      console.log(
        `  Emails: ${conv.email_count} | Subject: ${conv.first_subject.substring(0, 50)}...`,
      );

      // Get all emails in conversation
      const emails = this.db
        .prepare(
          `
        SELECT 
          id, subject, body_content, sender_email,
          received_date_time, importance
        FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time
        LIMIT 10
      `,
        )
        .all(conv.conversation_id);

      // Create a simple conversation summary
      const conversationText = emails
        .map(
          (e) =>
            `From: ${e.sender_email}\nSubject: ${e.subject}\nBody: ${(e.body_content || "").substring(0, 200)}...\n`,
        )
        .join("\n---\n");

      // Simple chain completeness check
      const hasStart = emails.some(
        (e) =>
          e.subject.toLowerCase().includes("request") ||
          e.subject.toLowerCase().includes("quote") ||
          e.subject.toLowerCase().includes("inquiry"),
      );

      const hasEnd = emails.some(
        (e) =>
          e.subject.toLowerCase().includes("complete") ||
          e.subject.toLowerCase().includes("closed") ||
          e.subject.toLowerCase().includes("resolved"),
      );

      const isComplete = hasStart && hasEnd;
      console.log(
        `  Chain: ${isComplete ? chalk.green("✓ Complete") : chalk.yellow("⚡ Incomplete")}`,
      );

      // Run simple LLM analysis
      const startTime = Date.now();

      const prompt = `Analyze this email conversation and identify:
1. Main topic or request
2. Current status (open/resolved/pending)
3. Priority level (high/medium/low)
4. Any action items

Conversation:
${conversationText.substring(0, 2000)}

Respond in JSON format.`;

      const response = await this.ollama.generate({
        model: "llama3.2:3b",
        prompt,
        stream: false,
        format: "json", // Force JSON output
        options: {
          temperature: 0.3,
          max_tokens: 200,
        },
      });

      const processingTime = Date.now() - startTime;
      console.log(`  ✓ Analyzed in ${processingTime}ms`);

      // Try to parse response
      try {
        const analysis = JSON.parse(response.response);
        console.log(`  Topic: ${analysis.main_topic || "Unknown"}`);
        console.log(`  Status: ${analysis.current_status || "Unknown"}`);
        console.log(`  Priority: ${analysis.priority_level || "medium"}`);
      } catch {
        console.log(`  ⚠️  Non-JSON response, using fallback`);
      }

      this.stats.processed++;
    } catch (error: any) {
      console.error(chalk.red(`  ❌ Error: ${error.message}`));
      this.stats.errors++;
      this.stats.processed++;
    }
  }

  private displayProgress(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.processed / elapsed;
    const remaining = (this.stats.total - this.stats.processed) / rate;

    console.log(
      chalk.cyan(
        `\n📊 Progress: ${this.stats.processed}/${this.stats.total} (${((this.stats.processed / this.stats.total) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      `  Rate: ${rate.toFixed(1)} conv/sec | Est. remaining: ${remaining.toFixed(0)}s`,
    );
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000;

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(`  Total: ${this.stats.total}`);
    console.log(`  Processed: ${this.stats.processed}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Time: ${totalTime.toFixed(1)}s`);
    console.log(
      `  Rate: ${(this.stats.processed / totalTime).toFixed(1)} conv/sec`,
    );
  }
}

// Run the processor
async function main() {
  const processor = new SimpleEmailProcessor();
  await processor.processEmails();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
