#!/usr/bin/env tsx

/**
 * Optimal Email Processing with Three-Phase Analysis
 * Uses existing Ollama server and applies all quality controls
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("OptimalEmailProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const ANALYSIS_DB_PATH = "./data/crewai_enhanced.db"; // Use the same enhanced database

interface ProcessingStats {
  totalConversations: number;
  processedConversations: number;
  completeChains: number;
  incompleteChains: number;
  singleEmails: number;
  totalEmails: number;
  processedEmails: number;
  phase3Count: number;
  errors: number;
  startTime: number;
}

class OptimalEmailProcessor {
  private enhancedDb: Database.Database;
  private analysisService: EmailThreePhaseAnalysisService;
  private stats: ProcessingStats = {
    totalConversations: 0,
    processedConversations: 0,
    completeChains: 0,
    incompleteChains: 0,
    singleEmails: 0,
    totalEmails: 0,
    processedEmails: 0,
    phase3Count: 0,
    errors: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.enhancedDb = new Database(ENHANCED_DB_PATH, { readonly: true });
    this.analysisService = new EmailThreePhaseAnalysisService(ANALYSIS_DB_PATH);
  }

  async processEmails(): Promise<void> {
    console.log(chalk.cyan("\n🚀 Optimal Email Processing Pipeline\n"));
    console.log(
      chalk.yellow(
        "Using adaptive three-phase analysis with quality validation\n",
      ),
    );

    // Get all conversations
    const conversations = this.enhancedDb
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MIN(subject) as first_subject,
        MAX(subject) as last_subject,
        COUNT(DISTINCT sender_email) as unique_senders,
        ROUND((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24, 1) as duration_hours
      FROM emails_enhanced
      GROUP BY conversation_id
      ORDER BY 
        CASE WHEN COUNT(*) > 1 THEN 0 ELSE 1 END,  -- Multi-email conversations first
        COUNT(*) DESC
      LIMIT 500  -- Process first 500 conversations
    `,
      )
      .all() as any[];

    this.stats.totalConversations = conversations.length;

    // Count emails
    const multiEmailConvs = conversations.filter((c) => c.email_count > 1);
    this.stats.totalEmails = conversations.reduce(
      (sum, c) => sum + c.email_count,
      0,
    );

    console.log(chalk.yellow(`📊 Dataset Overview:`));
    console.log(`  Total conversations: ${this.stats.totalConversations}`);
    console.log(`  Multi-email conversations: ${multiEmailConvs.length}`);
    console.log(
      `  Single emails: ${this.stats.totalConversations - multiEmailConvs.length}`,
    );
    console.log(`  Total emails: ${this.stats.totalEmails}\n`);

    // Process conversations
    for (const conv of conversations) {
      await this.processConversation(conv);

      // Progress update every 25 conversations
      if (
        this.stats.processedConversations % 25 === 0 &&
        this.stats.processedConversations > 0
      ) {
        this.displayProgress();
      }
    }

    this.displayFinalStats();
    await this.cleanup();
  }

  private async processConversation(conv: any): Promise<void> {
    try {
      // Skip single emails
      if (conv.email_count === 1) {
        this.stats.singleEmails++;
        this.stats.processedConversations++;
        return;
      }

      console.log(
        chalk.gray(
          `\n[${this.stats.processedConversations + 1}/${this.stats.totalConversations}] ${conv.conversation_id}`,
        ),
      );
      console.log(
        `  📊 ${conv.email_count} emails | ${conv.duration_hours}h | ${conv.unique_senders} senders`,
      );

      // Get all emails in conversation
      const emails = this.enhancedDb
        .prepare(
          `
        SELECT 
          id, 
          subject, 
          body_content as body, 
          sender_email,
          received_date_time as received_at, 
          importance, 
          has_attachments
        FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time
      `,
        )
        .all(conv.conversation_id);

      // Add recipient info
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
      const chainAnalysis = this.analyzeChainCompleteness(emails);
      console.log(
        `  ${chainAnalysis.isComplete ? chalk.green("✓") : chalk.yellow("⚡")} ${chainAnalysis.score}% complete - ${chainAnalysis.type}`,
      );

      // Process sample emails (first 3 or all if fewer)
      const samplesToProcess = Math.min(3, emails.length);

      for (let i = 0; i < samplesToProcess; i++) {
        const email = emails[i];
        const startTime = Date.now();

        try {
          // Run three-phase analysis with quality validation
          const result = await this.analysisService.analyzeEmail(email, {
            chainContext: {
              isComplete: chainAnalysis.isComplete,
              completenessScore: chainAnalysis.score,
              chainType: chainAnalysis.type,
              conversationId: conv.conversation_id,
            },
            qualityThreshold: 6.0,
            useHybridApproach: true,
            enableQualityLogging: false,
          });

          const processingTime = Date.now() - startTime;
          const phases =
            chainAnalysis.isComplete && chainAnalysis.score >= 70
              ? "1+2+3"
              : "1+2";

          console.log(
            chalk.dim(
              `    ✓ Email ${i + 1}: ${processingTime}ms (phases: ${phases})`,
            ),
          );

          this.stats.processedEmails++;
          if (phases === "1+2+3") {
            this.stats.phase3Count++;
          }
        } catch (error: any) {
          const errorMsg = error.message.includes("timeout")
            ? "Timeout"
            : error.message.substring(0, 50);
          console.log(chalk.red(`    ❌ Email ${i + 1}: ${errorMsg}`));
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
        error,
      );
      this.stats.errors++;
      this.stats.processedConversations++;
    }
  }

  private analyzeChainCompleteness(emails: any[]): {
    isComplete: boolean;
    score: number;
    type: string;
  } {
    const subjects = emails.map((e) => e.subject.toLowerCase());
    const bodies = emails.map((e) =>
      (e.body || "").toLowerCase().substring(0, 500),
    );

    let score = 0;
    let type = "unknown";

    // Detect chain type
    const allText = [...subjects, ...bodies].join(" ");
    if (
      allText.includes("quote") &&
      (allText.includes("request") || allText.includes("pricing"))
    ) {
      type = "quote_request";
    } else if (
      allText.includes("order") ||
      allText.includes("po ") ||
      allText.includes("purchase")
    ) {
      type = "order_processing";
    } else if (
      allText.includes("support") ||
      allText.includes("issue") ||
      allText.includes("problem")
    ) {
      type = "support_ticket";
    } else if (
      allText.includes("meeting") ||
      allText.includes("schedule") ||
      allText.includes("calendar")
    ) {
      type = "scheduling";
    }

    // Score based on workflow indicators
    const hasStart = subjects.some(
      (s) =>
        s.includes("request") ||
        s.includes("inquiry") ||
        s.includes("quote") ||
        s.includes("need") ||
        s.includes("looking for") ||
        s.includes("interested"),
    );

    const hasProgress = subjects.some(
      (s) =>
        s.includes("re:") ||
        s.includes("fw:") ||
        s.includes("update") ||
        s.includes("follow"),
    );

    const hasResolution = subjects.some(
      (s) =>
        s.includes("complete") ||
        s.includes("closed") ||
        s.includes("resolved") ||
        s.includes("thank you") ||
        s.includes("delivered") ||
        s.includes("shipped") ||
        s.includes("approved") ||
        s.includes("confirmed"),
    );

    // Calculate score
    if (hasStart) score += 35;
    if (hasProgress) score += 30;
    if (hasResolution) score += 35;

    // Bonus for conversation length
    if (emails.length >= 3) score += 10;
    if (emails.length >= 5 && hasProgress) score += 10;

    // Cap at 100
    score = Math.min(100, score);

    return {
      isComplete: score >= 70,
      score,
      type,
    };
  }

  private displayProgress(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60; // minutes
    const convRate = this.stats.processedConversations / elapsed;
    const emailRate = this.stats.processedEmails / elapsed;
    const remaining =
      (this.stats.totalConversations - this.stats.processedConversations) /
      convRate;

    console.log(chalk.cyan("\n📊 Progress Update:"));
    console.log(
      `  Conversations: ${this.stats.processedConversations}/${this.stats.totalConversations} (${((this.stats.processedConversations / this.stats.totalConversations) * 100).toFixed(1)}%)`,
    );
    console.log(`  Emails analyzed: ${this.stats.processedEmails}`);
    console.log(
      `  Complete chains: ${this.stats.completeChains} (${this.stats.phase3Count} with phase 3)`,
    );
    console.log(`  Incomplete chains: ${this.stats.incompleteChains}`);
    console.log(`  Single emails skipped: ${this.stats.singleEmails}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(
      `  Rate: ${convRate.toFixed(1)} conv/min | ${emailRate.toFixed(1)} emails/min`,
    );
    console.log(`  Est. remaining: ${remaining.toFixed(0)} minutes`);
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000 / 60;

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(`  Total conversations: ${this.stats.totalConversations}`);
    console.log(`  Processed: ${this.stats.processedConversations}`);
    console.log(
      `  - Complete chains: ${this.stats.completeChains} (${((this.stats.completeChains / this.stats.processedConversations) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  - Incomplete chains: ${this.stats.incompleteChains} (${((this.stats.incompleteChains / this.stats.processedConversations) * 100).toFixed(1)}%)`,
    );
    console.log(`  - Single emails: ${this.stats.singleEmails}`);
    console.log(`  Emails analyzed: ${this.stats.processedEmails}`);
    console.log(`  Phase 3 analyses: ${this.stats.phase3Count}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Total time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Processing rate: ${(this.stats.processedEmails / totalTime).toFixed(1)} emails/min`,
    );

    // Show quality metrics
    const metrics = this.analysisService.getQualityMetrics();
    if (metrics.totalResponses > 0) {
      console.log(chalk.cyan("\n📊 Quality Metrics:"));
      console.log(`  Total LLM responses: ${metrics.totalResponses}`);
      console.log(
        `  Average quality score: ${metrics.averageQualityScore.toFixed(1)}/10`,
      );
      console.log(
        `  High quality rate: ${(metrics.highQualityRate * 100).toFixed(1)}%`,
      );
      console.log(
        `  Fallback usage: ${(metrics.fallbackRate * 100).toFixed(1)}%`,
      );
      console.log(`  Hybrid usage: ${(metrics.hybridRate * 100).toFixed(1)}%`);
    }
  }

  private async cleanup(): Promise<void> {
    this.enhancedDb.close();
    await this.analysisService.shutdown();
  }
}

// Main execution
async function main() {
  const processor = new OptimalEmailProcessor();
  await processor.processEmails();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
