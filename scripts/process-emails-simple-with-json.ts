#!/usr/bin/env tsx

/**
 * Simple Email Processing with Proper JSON Format
 * Tests the JSON formatting fixes in a simple way
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { Ollama } from "ollama";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("SimpleJsonProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";

interface ConversationStats {
  conversation_id: string;
  email_count: number;
  first_subject: string;
  duration_hours: number;
  unique_senders: number;
}

class SimpleJsonProcessor {
  private db: Database.Database;
  private ollama: Ollama;
  private processedCount = 0;
  private successCount = 0;
  private jsonSuccessCount = 0;

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH, { readonly: true });
    this.ollama = new Ollama({ host: "http://localhost:11434" });
  }

  async processEmails(): Promise<void> {
    console.log(
      chalk.cyan("\n🚀 Testing JSON Format Fixes with Email Processing\n"),
    );

    // Get top 10 conversations
    const conversations = this.db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MIN(subject) as first_subject,
        ROUND((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24, 1) as duration_hours,
        COUNT(DISTINCT sender_email) as unique_senders
      FROM emails_enhanced
      GROUP BY conversation_id
      HAVING email_count > 1
      ORDER BY email_count DESC
      LIMIT 10
    `,
      )
      .all() as ConversationStats[];

    console.log(`Found ${conversations.length} conversations to test\n`);

    for (const conv of conversations) {
      await this.processConversation(conv);
    }

    this.displayStats();
    this.db.close();
  }

  private async processConversation(conv: ConversationStats): Promise<void> {
    this.processedCount++;

    console.log(
      chalk.gray(`\n[${this.processedCount}/10] ${conv.conversation_id}`),
    );
    console.log(
      `  Emails: ${conv.email_count} | Duration: ${conv.duration_hours}h | Senders: ${conv.unique_senders}`,
    );
    console.log(`  Subject: ${conv.first_subject.substring(0, 50)}...`);

    // Get first 3 emails
    const emails = this.db
      .prepare(
        `
      SELECT 
        id, subject, body_content, sender_email,
        received_date_time, importance
      FROM emails_enhanced
      WHERE conversation_id = ?
      ORDER BY received_date_time
      LIMIT 3
    `,
      )
      .all(conv.conversation_id);

    // Create conversation summary
    const summary = emails
      .map((e) => `From: ${e.sender_email}\nSubject: ${e.subject}\n`)
      .join("\n---\n");

    // Test LLM with JSON format
    try {
      const startTime = Date.now();

      const prompt = `Analyze this email conversation and provide a structured analysis.

Conversation:
${summary}

Provide your analysis in this exact JSON format:
{
  "topic": "main topic or request",
  "status": "open/pending/resolved",
  "priority": "high/medium/low",
  "type": "quote_request/order/support/other",
  "key_entities": ["list", "of", "important", "entities"],
  "next_action": "recommended next action"
}`;

      const response = await this.ollama.generate({
        model: "llama3.2:3b",
        prompt,
        stream: false,
        format: "json", // Force JSON output
        options: {
          temperature: 0.2,
          max_tokens: 300,
        },
      });

      const elapsed = Date.now() - startTime;

      // Try to parse JSON
      try {
        const analysis = JSON.parse(response.response);
        this.jsonSuccessCount++;

        console.log(chalk.green(`  ✓ Valid JSON response (${elapsed}ms)`));
        console.log(`    Topic: ${analysis.topic || "Unknown"}`);
        console.log(`    Status: ${analysis.status || "Unknown"}`);
        console.log(`    Priority: ${analysis.priority || "Unknown"}`);
        console.log(`    Type: ${analysis.type || "Unknown"}`);

        if (analysis.key_entities && analysis.key_entities.length > 0) {
          console.log(
            `    Entities: ${analysis.key_entities.slice(0, 3).join(", ")}`,
          );
        }

        this.successCount++;
      } catch (parseError) {
        console.log(chalk.red(`  ✗ Invalid JSON response (${elapsed}ms)`));
        console.log(`    Raw: ${response.response.substring(0, 100)}...`);
      }
    } catch (error: any) {
      console.log(chalk.red(`  ❌ Error: ${error.message}`));
    }
  }

  private displayStats(): void {
    console.log(chalk.green("\n\n✅ Test Complete!\n"));
    console.log(chalk.cyan("📊 Statistics:"));
    console.log(`  Total conversations: ${this.processedCount}`);
    console.log(`  Successful analyses: ${this.successCount}`);
    console.log(
      `  Valid JSON responses: ${this.jsonSuccessCount} (${((this.jsonSuccessCount / this.processedCount) * 100).toFixed(1)}%)`,
    );

    if (this.jsonSuccessCount === this.processedCount) {
      console.log(chalk.green("\n🎉 Perfect! All responses were valid JSON!"));
      console.log(chalk.yellow("The fans should be running now! 🌪️"));
    } else if (this.jsonSuccessCount > 0) {
      console.log(chalk.yellow("\n⚠️  Some responses were not valid JSON"));
    } else {
      console.log(
        chalk.red("\n❌ No valid JSON responses - check Ollama connection"),
      );
    }
  }
}

// Run the processor
async function main() {
  const processor = new SimpleJsonProcessor();
  await processor.processEmails();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
