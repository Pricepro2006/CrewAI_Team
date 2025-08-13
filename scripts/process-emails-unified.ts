#!/usr/bin/env tsx

/**
 * Unified Email Processing Script
 * Uses only crewai_enhanced.db with the fixed analysis service
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { EmailThreePhaseAnalysisServiceFixed } from "../src/core/services/EmailThreePhaseAnalysisServiceFixed.js";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { Logger } from "../src/utils/logger.js";
import cliProgress from "cli-progress";

const logger = new Logger("UnifiedEmailProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 50; // Process 50 conversations at a time

interface ProcessingStats {
  totalConversations: number;
  totalEmails: number;
  processedConversations: number;
  processedEmails: number;
  completeChains: number;
  incompleteChains: number;
  phase3Count: number;
  errors: number;
  jsonSuccesses: number;
  startTime: number;
}

interface ConversationInfo {
  conversation_id: string;
  email_count: number;
  first_subject: string;
  duration_hours: number;
  unique_senders: number;
}

class UnifiedEmailProcessor {
  private db: Database.Database;
  private analysisService: EmailThreePhaseAnalysisServiceFixed;
  private chainAnalyzer: EmailChainAnalyzer;
  private progressBar: cliProgress.SingleBar;
  private stats: ProcessingStats = {
    totalConversations: 0,
    totalEmails: 0,
    processedConversations: 0,
    processedEmails: 0,
    completeChains: 0,
    incompleteChains: 0,
    phase3Count: 0,
    errors: 0,
    jsonSuccesses: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH);
    this.analysisService = new EmailThreePhaseAnalysisServiceFixed(
      ENHANCED_DB_PATH,
    );
    this.chainAnalyzer = new EmailChainAnalyzer(ENHANCED_DB_PATH);

    this.progressBar = new cliProgress.SingleBar({
      format:
        "Progress |{bar}| {percentage}% | {value}/{total} Conversations | ETA: {eta}s",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.analysisService.on("phase:start", ({ phase, email }) => {
      logger.debug(`Phase ${phase} started for email ${email}`);
    });

    this.analysisService.on("phase:complete", ({ phase, result }) => {
      logger.debug(`Phase ${phase} completed`);
    });

    this.analysisService.on(
      "analysis:complete",
      ({ email, processingTime, phases }) => {
        this.stats.processedEmails++;
        if (phases === 3) {
          this.stats.phase3Count++;
        }
      },
    );

    this.analysisService.on("analysis:error", ({ email, error }) => {
      logger.error(`Analysis error for email ${email}:`, error);
      this.stats.errors++;
    });
  }

  async processAllEmails(): Promise<void> {
    console.log(chalk.cyan("\n🚀 Unified Email Processing Pipeline\n"));
    console.log(
      chalk.yellow("Using crewai_enhanced.db with fixed analysis service\n"),
    );

    // Get conversation statistics
    const conversations = await this.getConversations();
    this.stats.totalConversations = conversations.length;

    // Count total emails
    const emailCount = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM emails_enhanced
    `,
      )
      .get() as any;
    this.stats.totalEmails = emailCount.count;

    console.log(chalk.bold(`📊 Dataset Overview:`));
    console.log(
      `  Total conversations: ${chalk.green(this.stats.totalConversations.toLocaleString())}`,
    );
    console.log(
      `  Total emails: ${chalk.green(this.stats.totalEmails.toLocaleString())}`,
    );
    console.log(
      `  Average emails per conversation: ${chalk.green((this.stats.totalEmails / this.stats.totalConversations).toFixed(1))}\n`,
    );

    // Start progress bar
    this.progressBar.start(this.stats.totalConversations, 0);

    // Process in batches
    for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
      const batch = conversations.slice(i, i + BATCH_SIZE);

      // Process batch concurrently but with controlled concurrency
      const batchPromises = batch.map((conv) => this.processConversation(conv));
      await Promise.all(batchPromises);

      // Update progress
      this.progressBar.update(this.stats.processedConversations);

      // Log batch completion
      if ((i + BATCH_SIZE) % 500 === 0) {
        this.logProgress();
      }
    }

    // Stop progress bar
    this.progressBar.stop();

    // Display final statistics
    this.displayFinalStats();
    await this.cleanup();
  }

  private async getConversations(): Promise<ConversationInfo[]> {
    return this.db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MIN(subject) as first_subject,
        ROUND((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24, 1) as duration_hours,
        COUNT(DISTINCT sender_email) as unique_senders
      FROM emails_enhanced
      WHERE status = 'pending' OR status IS NULL OR status = ''
      GROUP BY conversation_id
      HAVING email_count > 1
      ORDER BY email_count DESC
    `,
      )
      .all() as ConversationInfo[];
  }

  private async processConversation(conv: ConversationInfo): Promise<void> {
    try {
      // Get all emails in conversation
      const emails = this.db
        .prepare(
          `
        SELECT 
          id, subject, body_content, sender_email,
          received_date_time, conversation_id, importance, has_attachments
        FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time
      `,
        )
        .all(conv.conversation_id);

      // Analyze chain completeness
      const chainAnalysis = await this.chainAnalyzer.analyzeChain(emails);

      // Process only first 3 emails per conversation (for efficiency)
      const emailsToProcess = emails.slice(0, Math.min(3, emails.length));

      for (const email of emailsToProcess) {
        try {
          await this.analysisService.analyzeEmail(email, {
            chainContext: {
              isComplete: chainAnalysis.isComplete,
              completenessScore: chainAnalysis.completenessScore,
              chainType: chainAnalysis.chainType,
              conversationId: conv.conversation_id,
            },
            qualityThreshold: 6.0,
            useHybridApproach: true,
            timeout: 30000,
          });

          this.stats.jsonSuccesses++;
        } catch (error: any) {
          logger.error(`Failed to process email ${email.id}:`, error.message);
          this.stats.errors++;
        }
      }

      // Update stats
      if (chainAnalysis.isComplete) {
        this.stats.completeChains++;
      } else {
        this.stats.incompleteChains++;
      }

      this.stats.processedConversations++;
    } catch (error: any) {
      logger.error(
        `Failed to process conversation ${conv.conversation_id}:`,
        error.message,
      );
      this.stats.errors++;
      this.stats.processedConversations++;
    }
  }

  private logProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
    const rate = this.stats.processedConversations / elapsed;

    console.log(
      chalk.dim(
        `\n  [Progress] ${this.stats.processedConversations}/${this.stats.totalConversations} conversations`,
      ),
    );
    console.log(
      chalk.dim(
        `  Rate: ${rate.toFixed(1)} conv/min | Errors: ${this.stats.errors}`,
      ),
    );
  }

  private displayFinalStats() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
    const serviceStats = this.analysisService.getStats();

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));

    console.log(chalk.cyan("📊 Processing Statistics:"));
    console.log(
      `  Total conversations: ${chalk.bold(this.stats.totalConversations.toLocaleString())}`,
    );
    console.log(
      `  Processed conversations: ${chalk.bold(this.stats.processedConversations.toLocaleString())}`,
    );
    console.log(
      `  Total emails: ${chalk.bold(this.stats.totalEmails.toLocaleString())}`,
    );
    console.log(
      `  Processed emails: ${chalk.bold(this.stats.processedEmails.toLocaleString())}`,
    );

    console.log(chalk.cyan("\n📊 Chain Analysis:"));
    console.log(
      `  Complete chains (3-phase): ${chalk.green(this.stats.completeChains.toLocaleString())} (${((this.stats.completeChains / this.stats.processedConversations) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Incomplete chains (2-phase): ${chalk.yellow(this.stats.incompleteChains.toLocaleString())} (${((this.stats.incompleteChains / this.stats.processedConversations) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Phase 3 analyses: ${chalk.blue(this.stats.phase3Count.toLocaleString())}`,
    );

    console.log(chalk.cyan("\n📊 Quality Metrics:"));
    console.log(
      `  JSON success rate: ${chalk.green((serviceStats.jsonSuccessRate * 100).toFixed(1) + "%")}`,
    );
    console.log(`  Total errors: ${chalk.red(this.stats.errors)}`);
    console.log(
      `  Average processing time: ${chalk.yellow(serviceStats.averageProcessingTime.toFixed(0) + "ms")}`,
    );

    console.log(chalk.cyan("\n⏱️  Performance:"));
    console.log(`  Total time: ${chalk.bold(elapsed.toFixed(1) + " minutes")}`);
    console.log(
      `  Processing rate: ${chalk.bold((this.stats.processedConversations / elapsed).toFixed(1) + " conv/min")}`,
    );
    console.log(
      `  Email rate: ${chalk.bold((this.stats.processedEmails / elapsed).toFixed(1) + " emails/min")}`,
    );

    // Show sample results
    const samples = this.db
      .prepare(
        `
      SELECT subject, workflow_state, priority, chain_type, chain_completeness_score
      FROM emails_enhanced
      WHERE analyzed_at IS NOT NULL
      ORDER BY analyzed_at DESC
      LIMIT 5
    `,
      )
      .all() as any[];

    if (samples.length > 0) {
      console.log(chalk.cyan("\n📊 Sample Results:"));
      samples.forEach((s) => {
        console.log(`  ${chalk.dim(s.subject.substring(0, 50) + "...")}`);
        console.log(
          `    State: ${chalk.bold(s.workflow_state)} | Priority: ${chalk.bold(s.priority)} | Type: ${chalk.bold(s.chain_type)} | Score: ${chalk.bold(s.chain_completeness_score + "%")}`,
        );
      });
    }
  }

  private async cleanup() {
    this.db.close();
    await this.analysisService.shutdown();
    await this.chainAnalyzer.close();
    logger.info("Cleanup complete");
  }
}

// Main execution
async function main() {
  const processor = new UnifiedEmailProcessor();

  try {
    await processor.processAllEmails();
  } catch (error) {
    logger.error("Fatal error during processing:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\n⚠️  Processing interrupted by user"));
  process.exit(0);
});

main();
