#!/usr/bin/env tsx

/**
 * Verified Phase 1+2 Email Processing
 * Properly runs Phase 1 (rule-based) and Phase 2 (Llama 3.2) analysis
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { Logger } from "../src/utils/logger.js";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { OllamaManager } from "../src/utils/ollama-manager.js";

const logger = new Logger("VerifiedPhase12Processor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 50; // Process 50 conversations at a time
const EMAILS_PER_BATCH = 10; // Process 10 emails at once (smaller for better monitoring)

interface ConversationInfo {
  conversation_id: string;
  email_count: number;
  emails: EmailRecord[];
}

interface EmailRecord {
  id: string;
  subject: string;
  body_content: string;
  sender_email: string;
  received_date_time: string;
  conversation_id: string;
}

interface ProcessingStats {
  totalConversations: number;
  processedConversations: number;
  totalEmails: number;
  processedEmails: number;
  phase1Count: number;
  phase2Count: number;
  errors: number;
  startTime: number;
  emailsPerMinute: number;
}

class VerifiedPhase12Processor {
  private db: Database.Database;
  private analysisService = new EmailThreePhaseAnalysisService();
  private stats: ProcessingStats = {
    totalConversations: 0,
    processedConversations: 0,
    totalEmails: 0,
    processedEmails: 0,
    phase1Count: 0,
    phase2Count: 0,
    errors: 0,
    startTime: Date.now(),
    emailsPerMinute: 0,
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
    console.log(chalk.cyan("\n🚀 Verified Phase 1+2 Email Processing\n"));

    // Verify Ollama is running
    console.log(chalk.yellow("Verifying Ollama service..."));
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      const data = await response.json();
      console.log(chalk.green("✓ Ollama is running"));
      
      // Check for required model
      const hasLlama = data.models?.some((m: any) => m.name.includes("llama3.2:3b"));
      if (!hasLlama) {
        console.log(chalk.yellow("⚠️  llama3.2:3b not found, pulling model..."));
        await OllamaManager.pullModel("llama3.2:3b");
      }
    } catch (error) {
      console.error(chalk.red("❌ Ollama is not running! Please start it with: ollama serve"));
      process.exit(1);
    }

    // Get total counts
    const counts = this.db
      .prepare(
        `SELECT 
          COUNT(DISTINCT conversation_id) as conv_count,
          COUNT(*) as email_count
         FROM emails_enhanced 
         WHERE status = 'imported'`
      )
      .get() as any;

    this.stats.totalConversations = counts.conv_count;
    this.stats.totalEmails = counts.email_count;

    console.log(
      chalk.bold(
        `📊 Found ${this.stats.totalConversations} conversations with ${this.stats.totalEmails} emails to process\n`
      )
    );

    if (this.stats.totalEmails === 0) {
      console.log(chalk.yellow("No emails to process"));
      return;
    }

    // Process conversations in batches
    let offset = 0;
    while (this.stats.processedConversations < this.stats.totalConversations) {
      const conversations = await this.getConversationBatch(offset);
      if (conversations.length === 0) break;

      await this.processBatch(conversations);

      offset += BATCH_SIZE;
      this.displayProgress();

      // Add small delay to not overwhelm Ollama
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.displayFinalStats();
    this.db.close();
  }

  private async getConversationBatch(offset: number): Promise<ConversationInfo[]> {
    // Get conversations
    const conversations = this.db
      .prepare(
        `SELECT 
          conversation_id,
          COUNT(*) as email_count
        FROM emails_enhanced
        WHERE status = 'imported'
        GROUP BY conversation_id
        ORDER BY email_count DESC
        LIMIT ? OFFSET ?`
      )
      .all(BATCH_SIZE, offset) as any[];

    // Load emails for each conversation
    const conversationsWithEmails: ConversationInfo[] = [];
    
    for (const conv of conversations) {
      const emails = this.db
        .prepare(
          `SELECT 
            id, subject, body_content, sender_email, 
            received_date_time, conversation_id
          FROM emails_enhanced
          WHERE conversation_id = ? AND status = 'imported'
          ORDER BY received_date_time`
        )
        .all(conv.conversation_id) as EmailRecord[];

      conversationsWithEmails.push({
        conversation_id: conv.conversation_id,
        email_count: conv.email_count,
        emails,
      });
    }

    return conversationsWithEmails;
  }

  private async processBatch(conversations: ConversationInfo[]): Promise<void> {
    // Prepare batch update statement
    const updateStmt = this.db.prepare(`
      UPDATE emails_enhanced SET
        workflow_state = ?,
        priority = ?,
        confidence_score = ?,
        analyzed_at = datetime('now'),
        chain_completeness_score = ?,
        extracted_entities = ?,
        status = 'analyzed',
        phase_completed = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    // Process each conversation
    for (const conv of conversations) {
      try {
        // Calculate chain score
        const chainScore = this.calculateChainScore(conv);
        
        console.log(chalk.blue(`\nProcessing conversation ${conv.conversation_id} (${conv.email_count} emails, score: ${chainScore})`));

        // Process emails in smaller batches
        for (let i = 0; i < conv.emails.length; i += EMAILS_PER_BATCH) {
          const emailBatch = conv.emails.slice(i, i + EMAILS_PER_BATCH);

          const batchUpdates = [];
          for (const email of emailBatch) {
            try {
              // Add chain info to email
              (email as any).chainAnalysis = {
                is_complete_chain: chainScore >= 70,
                completeness_score: chainScore,
                chain_type: "email_conversation",
              };

              // Run Phase 1+2 analysis (forceAllPhases = false ensures no Phase 3)
              const result = await this.analysisService.analyzeEmail(email, {
                skipCache: false,
                forceAllPhases: false,
              });

              // Track which phase was completed
              const phaseCompleted = result.strategic_insights ? 2 : 1;
              if (phaseCompleted === 2) {
                this.stats.phase2Count++;
              } else {
                this.stats.phase1Count++;
              }

              batchUpdates.push({
                workflow_state: result.workflow_state || "analyzed",
                priority: result.priority || "medium",
                confidence_score: result.confidence || 0.7,
                chain_completeness_score: chainScore,
                extracted_entities: JSON.stringify(result.entities || {}),
                phase_completed: phaseCompleted,
                id: email.id,
              });

              this.stats.processedEmails++;
              
              // Log progress every 10 emails
              if (this.stats.processedEmails % 10 === 0) {
                console.log(chalk.gray(`  Processed ${this.stats.processedEmails}/${this.stats.totalEmails} emails...`));
              }
            } catch (error: any) {
              logger.error(`Error processing email ${email.id}:`, error);
              this.stats.errors++;
            }
          }

          // Batch update database
          const transaction = this.db.transaction(() => {
            for (const update of batchUpdates) {
              updateStmt.run(
                update.workflow_state,
                update.priority,
                update.confidence_score,
                update.chain_completeness_score,
                update.extracted_entities,
                update.phase_completed,
                update.id
              );
            }
          });
          transaction();
        }

        this.stats.processedConversations++;
      } catch (error: any) {
        logger.error(`Error processing conversation ${conv.conversation_id}:`, error);
        this.stats.errors++;
      }
    }
  }

  private calculateChainScore(conv: ConversationInfo): number {
    let score = 0;

    // Base score on email count
    if (conv.email_count >= 5) score += 40;
    else if (conv.email_count >= 3) score += 30;
    else if (conv.email_count >= 2) score += 20;
    else score += 10;

    // Check for completion indicators in subjects
    const subjects = conv.emails.map(e => e.subject.toLowerCase());
    
    const hasStart = subjects.some(s => 
      s.includes("request") || s.includes("inquiry") || 
      s.includes("quote") || s.includes("need") ||
      s.includes("urgent") || s.includes("help")
    );
    
    const hasMiddle = subjects.some(s => 
      s.includes("re:") || s.includes("fw:") || 
      s.includes("update") || s.includes("follow") ||
      s.includes("regarding") || s.includes("status")
    );
    
    const hasEnd = subjects.some(s => 
      s.includes("complete") || s.includes("closed") || 
      s.includes("resolved") || s.includes("thank you") ||
      s.includes("delivered") || s.includes("done")
    );

    if (hasStart) score += 20;
    if (hasMiddle) score += 20;
    if (hasEnd) score += 20;

    return Math.min(100, score);
  }

  private displayProgress(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
    this.stats.emailsPerMinute = this.stats.processedEmails / elapsed;

    console.log(
      chalk.cyan(
        `\n📊 Progress: ${this.stats.processedConversations}/${this.stats.totalConversations} conversations`
      )
    );
    console.log(
      `  Emails: ${this.stats.processedEmails}/${this.stats.totalEmails}`
    );
    console.log(
      `  Phase 1: ${this.stats.phase1Count} | Phase 2: ${this.stats.phase2Count}`
    );
    console.log(`  Rate: ${this.stats.emailsPerMinute.toFixed(0)} emails/min`);
    console.log(`  Errors: ${this.stats.errors}`);
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000 / 60;
    const successRate =
      this.stats.totalEmails > 0
        ? ((this.stats.processedEmails / this.stats.totalEmails) * 100).toFixed(1)
        : "0";

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(`  Total Conversations: ${this.stats.totalConversations}`);
    console.log(`  Total Emails: ${this.stats.totalEmails}`);
    console.log(
      `  Successfully Processed: ${this.stats.processedEmails} (${successRate}%)`
    );
    console.log(`  Phase 1 Completions: ${this.stats.phase1Count}`);
    console.log(`  Phase 2 Completions: ${this.stats.phase2Count}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Total Time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Average Rate: ${(this.stats.processedEmails / totalTime).toFixed(0)} emails/min`
    );

    // Show sample results
    const samples = this.db
      .prepare(
        `SELECT subject, workflow_state, priority, confidence_score, phase_completed
         FROM emails_enhanced
         WHERE analyzed_at IS NOT NULL
         ORDER BY analyzed_at DESC
         LIMIT 5`
      )
      .all() as any[];

    if (samples.length > 0) {
      console.log(chalk.cyan("\n📋 Sample Results:"));
      samples.forEach((sample, index) => {
        console.log(`\n${index + 1}. ${sample.subject.substring(0, 60)}...`);
        console.log(
          `   State: ${sample.workflow_state} | Priority: ${sample.priority} | Phase: ${sample.phase_completed} | Confidence: ${(sample.confidence_score * 100).toFixed(0)}%`
        );
      });
    }

    console.log(chalk.green("\n✨ Emails processed with proper Phase 1+2 analysis!"));
    console.log(chalk.yellow("\n📌 Visit http://localhost:5173 to see the analyzed emails in the dashboard\n"));
  }
}

// Run the processor
async function main() {
  const processor = new VerifiedPhase12Processor();
  await processor.processEmails();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});