#!/usr/bin/env tsx

/**
 * Process Imported Emails with Adaptive 3-Phase Analysis
 * Specifically targets emails with status='imported'
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { Logger } from "../src/utils/logger.js";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { OllamaManager } from "../src/utils/ollama-manager.js";

const logger = new Logger("ImportedEmailProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 50; // Process 50 conversations at a time
const EMAILS_PER_CONVERSATION = 3; // Process first 3 emails per conversation

interface ConversationInfo {
  conversation_id: string;
  email_count: number;
  first_subject: string;
  duration_hours: number;
}

interface ProcessingStats {
  totalConversations: number;
  processedConversations: number;
  totalEmails: number;
  processedEmails: number;
  completeChains: number;
  incompleteChains: number;
  phase3Count: number;
  errors: number;
  startTime: number;
}

class ImportedEmailProcessor {
  private db: Database.Database;
  private analysisService = new EmailThreePhaseAnalysisService();
  private chainAnalyzer = new EmailChainAnalyzer(ENHANCED_DB_PATH);
  private stats: ProcessingStats = {
    totalConversations: 0,
    processedConversations: 0,
    totalEmails: 0,
    processedEmails: 0,
    completeChains: 0,
    incompleteChains: 0,
    phase3Count: 0,
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
    console.log(chalk.cyan("\n🚀 Processing Imported Emails with Adaptive Analysis\n"));

    // Check Ollama
    console.log(chalk.yellow("Checking Ollama service..."));
    const ollamaReady = await OllamaManager.initialize([
      "llama3.2:3b",
      "doomgrave/phi-4:14b-tools-Q3_K_S",
    ]);
    if (!ollamaReady) {
      throw new Error("Failed to initialize Ollama service");
    }
    console.log(chalk.green("✓ Ollama service ready\n"));

    // Get count of conversations with imported emails
    const countResult = this.db
      .prepare(
        `SELECT COUNT(DISTINCT conversation_id) as count 
         FROM emails_enhanced 
         WHERE status = 'imported'`
      )
      .get() as any;
    
    this.stats.totalConversations = countResult.count;

    // Get total email count
    const emailCountResult = this.db
      .prepare(
        `SELECT COUNT(*) as count 
         FROM emails_enhanced 
         WHERE status = 'imported'`
      )
      .get() as any;
    
    this.stats.totalEmails = emailCountResult.count;

    console.log(
      chalk.bold(
        `📊 Found ${this.stats.totalConversations} conversations with ${this.stats.totalEmails} imported emails\n`
      )
    );

    if (this.stats.totalConversations === 0) {
      console.log(chalk.yellow("No imported emails to process"));
      return;
    }

    // Process in batches
    let offset = 0;
    while (this.stats.processedConversations < this.stats.totalConversations) {
      const conversations = await this.getConversationBatch(offset);
      if (conversations.length === 0) break;

      for (const conv of conversations) {
        await this.processConversation(conv);
      }

      offset += BATCH_SIZE;
      this.displayProgress();
    }

    this.displayFinalStats();
    this.db.close();
  }

  private async getConversationBatch(offset: number): Promise<ConversationInfo[]> {
    return this.db
      .prepare(
        `SELECT 
          conversation_id,
          COUNT(*) as email_count,
          MIN(subject) as first_subject,
          ROUND((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24, 1) as duration_hours
        FROM emails_enhanced
        WHERE status = 'imported'
        GROUP BY conversation_id
        ORDER BY email_count DESC
        LIMIT ? OFFSET ?`
      )
      .all(BATCH_SIZE, offset) as ConversationInfo[];
  }

  private async processConversation(conv: ConversationInfo): Promise<void> {
    try {
      console.log(
        chalk.gray(
          `\n[${this.stats.processedConversations + 1}/${this.stats.totalConversations}] ${conv.conversation_id}`
        )
      );
      console.log(
        `  📊 ${conv.email_count} emails | ${conv.duration_hours}h duration`
      );

      // Get emails in conversation
      const emails = this.db
        .prepare(
          `SELECT id, subject, body_content, sender_email, received_date_time, conversation_id
           FROM emails_enhanced
           WHERE conversation_id = ? AND status = 'imported'
           ORDER BY received_date_time
           LIMIT ?`
        )
        .all(conv.conversation_id, EMAILS_PER_CONVERSATION) as any[];

      // Analyze chain completeness
      const chainAnalysis = await this.chainAnalyzer.analyzeConversation(conv.conversation_id);
      console.log(
        `  ${chainAnalysis.is_complete ? chalk.green("✓") : chalk.yellow("⚡")} Chain: ${chainAnalysis.completeness_score}% - ${chainAnalysis.chain_type}`
      );

      // Process emails
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const startTime = Date.now();

        try {
          // Add chain analysis to email object
          (email as any).chainAnalysis = chainAnalysis;

          // Run analysis
          const result = await this.analysisService.analyzeEmail(email);

          // Update database
          this.updateEmailRecord(email.id, result, chainAnalysis);

          const processingTime = Date.now() - startTime;
          const phases = chainAnalysis.is_complete && chainAnalysis.completeness_score >= 70 ? 3 : 2;
          
          console.log(
            chalk.green(
              `    ✓ Email ${i + 1}: ${processingTime}ms (${phases} phases)`
            )
          );

          this.stats.processedEmails++;
          if (phases === 3) {
            this.stats.phase3Count++;
          }
        } catch (error: any) {
          console.error(chalk.red(`    ❌ Email ${i + 1}: ${error.message}`));
          this.stats.errors++;
        }
      }

      // Update chain stats
      if (chainAnalysis.is_complete) {
        this.stats.completeChains++;
      } else {
        this.stats.incompleteChains++;
      }

      this.stats.processedConversations++;
    } catch (error: any) {
      console.error(chalk.red(`  ❌ Conversation error: ${error.message}`));
      this.stats.errors++;
      this.stats.processedConversations++;
    }
  }

  private updateEmailRecord(
    emailId: string,
    result: any,
    chainAnalysis: any
  ): void {
    const stmt = this.db.prepare(`
      UPDATE emails_enhanced SET
        workflow_state = ?,
        priority = ?,
        confidence_score = ?,
        analyzed_at = datetime('now'),
        chain_completeness_score = ?,
        chain_type = ?,
        is_chain_complete = ?,
        extracted_entities = ?,
        status = 'analyzed',
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      result.workflow_state || "pending",
      result.priority || "medium",
      result.confidence || 0.5,
      chainAnalysis.completeness_score,
      chainAnalysis.chain_type,
      chainAnalysis.is_complete ? 1 : 0,
      JSON.stringify(result.entities || {}),
      emailId
    );
  }

  private displayProgress(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
    const rate = this.stats.processedConversations / elapsed;

    console.log(
      chalk.cyan(
        `\n📊 Progress: ${this.stats.processedConversations}/${this.stats.totalConversations} conversations`
      )
    );
    console.log(
      `  Emails: ${this.stats.processedEmails}/${this.stats.totalEmails}`
    );
    console.log(
      `  Complete chains: ${this.stats.completeChains} | Phase 3: ${this.stats.phase3Count}`
    );
    console.log(`  Rate: ${rate.toFixed(1)} conv/min`);
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000 / 60;

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(
      `  Conversations: ${this.stats.processedConversations}/${this.stats.totalConversations}`
    );
    console.log(
      `  Emails: ${this.stats.processedEmails}/${this.stats.totalEmails}`
    );
    console.log(
      `  Complete chains (3-phase): ${this.stats.completeChains} (${((this.stats.completeChains / this.stats.processedConversations) * 100).toFixed(1)}%)`
    );
    console.log(
      `  Incomplete chains (2-phase): ${this.stats.incompleteChains}`
    );
    console.log(`  Phase 3 analyses: ${this.stats.phase3Count}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Rate: ${(this.stats.processedEmails / totalTime).toFixed(1)} emails/min`
    );
  }
}

// Run the processor
async function main() {
  const processor = new ImportedEmailProcessor();
  await processor.processEmails();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});