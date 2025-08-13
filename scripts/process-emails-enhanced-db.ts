#!/usr/bin/env tsx

/**
 * Process Emails from Enhanced Database
 * Uses conversation-based processing with adaptive 3-phase analysis
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("EmailProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const ANALYSIS_DB_PATH = "./data/crewai.db";

interface ConversationBatch {
  conversation_id: string;
  email_count: number;
  emails: any[];
}

class EnhancedEmailProcessor {
  private enhancedDb: Database.Database;
  private analysisDb: Database.Database;
  private analysisService: EmailThreePhaseAnalysisService;
  private chainAnalyzer: EmailChainAnalyzer;
  private stats = {
    totalConversations: 0,
    processedConversations: 0,
    completeChains: 0,
    incompleteChains: 0,
    singleEmails: 0,
    errors: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.enhancedDb = new Database(ENHANCED_DB_PATH, { readonly: true });
    this.analysisDb = new Database(ANALYSIS_DB_PATH);
    this.analysisService = new EmailThreePhaseAnalysisService(ANALYSIS_DB_PATH);
    this.chainAnalyzer = new EmailChainAnalyzer();
  }

  async processAllConversations(): Promise<void> {
    console.log(chalk.cyan("\n🔄 Processing Emails by Conversation\n"));

    // Get all conversations ordered by size
    const conversations = this.enhancedDb
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count
      FROM emails_enhanced
      GROUP BY conversation_id
      ORDER BY email_count DESC
    `,
      )
      .all() as any[];

    this.stats.totalConversations = conversations.length;
    console.log(
      `Found ${chalk.bold(conversations.length.toLocaleString())} conversations to process\n`,
    );

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < conversations.length; i += batchSize) {
      const batch = conversations.slice(i, i + batchSize);

      for (const conv of batch) {
        await this.processConversation(conv);

        if ((this.stats.processedConversations + 1) % 50 === 0) {
          this.displayProgress();
        }
      }
    }

    this.displayFinalStats();
    await this.cleanup();
  }

  private async processConversation(conv: {
    conversation_id: string;
    email_count: number;
  }): Promise<void> {
    try {
      console.log(
        chalk.gray(
          `\n[${this.stats.processedConversations + 1}/${this.stats.totalConversations}] Processing conversation ${conv.conversation_id}`,
        ),
      );
      console.log(`  Emails: ${conv.email_count}`);

      // Skip single emails
      if (conv.email_count === 1) {
        console.log(chalk.dim("  ⏭️  Skipping single email"));
        this.stats.singleEmails++;
        this.stats.processedConversations++;
        return;
      }

      // Get all emails in conversation
      const emails = this.enhancedDb
        .prepare(
          `
        SELECT 
          id,
          subject,
          body_content as body,
          sender_email,
          sender_name,
          received_date_time as received_at,
          importance,
          has_attachments
        FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time
      `,
        )
        .all(conv.conversation_id);

      // Get recipients for each email
      for (const email of emails) {
        const recipients = this.enhancedDb
          .prepare(
            `
          SELECT email_address 
          FROM email_recipients 
          WHERE email_id = ? AND recipient_type = 'to'
        `,
          )
          .all(email.id)
          .map((r: any) => r.email_address);

        email.recipient_emails = recipients.join(", ");
      }

      // Analyze chain completeness
      const chainAnalysis = await this.chainAnalyzer.analyzeChain(emails);
      const isComplete = chainAnalysis.isComplete;
      const completenessScore = chainAnalysis.completenessScore;

      console.log(
        `  ${isComplete ? chalk.green("✓") : chalk.yellow("⚡")} ${isComplete ? "Complete" : "Incomplete"} chain (${completenessScore}%) - Using ${isComplete ? "3" : "2"}-phase analysis`,
      );
      console.log(
        `    Type: ${chainAnalysis.chainType} | Missing: ${chainAnalysis.missingElements.join(", ") || "None"}`,
      );

      // Process each email in the conversation
      for (const email of emails) {
        const analysisStartTime = Date.now();

        // Run analysis with quality validation
        const result = await this.analysisService.analyzeEmail(email, {
          chainContext: {
            isComplete,
            completenessScore,
            chainType: chainAnalysis.chainType,
            conversationId: conv.conversation_id,
          },
          qualityThreshold: 6.0,
          useHybridApproach: true,
          enableQualityLogging: false,
        });

        const processingTime = Date.now() - analysisStartTime;

        // Save to analysis database
        this.saveAnalysisResult(email.id, result, {
          conversationId: conv.conversation_id,
          chainComplete: isComplete,
          completenessScore,
          processingTime,
        });

        console.log(
          chalk.dim(
            `    ✓ ${email.subject.substring(0, 50)}... (${processingTime}ms)`,
          ),
        );
      }

      if (isComplete) {
        this.stats.completeChains++;
      } else {
        this.stats.incompleteChains++;
      }

      this.stats.processedConversations++;
    } catch (error: any) {
      logger.error(
        `Failed to process conversation ${conv.conversation_id}:`,
        error,
      );
      this.stats.errors++;
      this.stats.processedConversations++;
    }
  }

  private saveAnalysisResult(
    emailId: string,
    result: any,
    metadata: any,
  ): void {
    try {
      // Insert into analysis database
      const stmt = this.analysisDb.prepare(`
        INSERT OR REPLACE INTO emails (
          id, message_id, subject, body_text, from_address,
          to_addresses, received_time, conversation_id,
          has_attachments, importance, status,
          workflow_state, priority, confidence_score,
          chain_id, chain_completeness_score, chain_type,
          is_chain_complete, extracted_entities, key_phrases,
          sentiment_score, phase_3_applied, quality_metadata,
          analyzed_at, processing_time_ms
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      // Get email details from enhanced DB
      const email = this.enhancedDb
        .prepare(
          `
        SELECT * FROM emails_enhanced WHERE id = ?
      `,
        )
        .get(emailId) as any;

      stmt.run(
        emailId,
        email.internet_message_id || emailId,
        email.subject,
        email.body_content,
        email.sender_email,
        "", // to_addresses - would need to join with recipients
        email.received_date_time,
        metadata.conversationId,
        email.has_attachments,
        email.importance,
        "analyzed",
        result.workflow_state,
        result.priority,
        result.confidence,
        metadata.conversationId,
        metadata.completenessScore,
        result.chain_type || "unknown",
        metadata.chainComplete ? 1 : 0,
        JSON.stringify(result.entities || []),
        JSON.stringify(result.key_phrases || []),
        result.sentiment_score || 0,
        result.phase3Applied ? 1 : 0,
        JSON.stringify({
          qualityScore: result.qualityScore || 0,
          usedFallback: result.usedFallback || false,
          usedHybrid: result.usedHybrid || false,
        }),
        new Date().toISOString(),
        metadata.processingTime,
      );
    } catch (error: any) {
      logger.error("Failed to save analysis result:", error);
    }
  }

  private displayProgress(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60; // minutes
    const rate = this.stats.processedConversations / elapsed;
    const remaining =
      (this.stats.totalConversations - this.stats.processedConversations) /
      rate;

    console.log(chalk.cyan(`\n📊 Progress Update:`));
    console.log(
      `  Processed: ${this.stats.processedConversations}/${this.stats.totalConversations} (${((this.stats.processedConversations / this.stats.totalConversations) * 100).toFixed(1)}%)`,
    );
    console.log(`  Complete chains: ${this.stats.completeChains}`);
    console.log(`  Incomplete chains: ${this.stats.incompleteChains}`);
    console.log(`  Single emails skipped: ${this.stats.singleEmails}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Rate: ${rate.toFixed(1)} conversations/min`);
    console.log(`  Est. remaining: ${remaining.toFixed(0)} minutes\n`);
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000 / 60; // minutes

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(
      `  Total conversations: ${this.stats.totalConversations.toLocaleString()}`,
    );
    console.log(
      `  Processed: ${this.stats.processedConversations.toLocaleString()}`,
    );
    console.log(
      `  Complete chains (3-phase): ${this.stats.completeChains.toLocaleString()}`,
    );
    console.log(
      `  Incomplete chains (2-phase): ${this.stats.incompleteChains.toLocaleString()}`,
    );
    console.log(
      `  Single emails skipped: ${this.stats.singleEmails.toLocaleString()}`,
    );
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Total time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Average rate: ${(this.stats.processedConversations / totalTime).toFixed(1)} conversations/min`,
    );
  }

  private async cleanup(): Promise<void> {
    this.enhancedDb.close();
    this.analysisDb.close();
    await this.analysisService.shutdown();
    await this.chainAnalyzer.close();
  }
}

// Run the processor
async function main() {
  const processor = new EnhancedEmailProcessor();
  await processor.processAllConversations();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
