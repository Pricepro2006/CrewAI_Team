#!/usr/bin/env tsx

/**
 * Email Processing with Ollama Server Management
 * Ensures fresh Ollama server before processing
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { Ollama } from "ollama";
import { Logger } from "../src/utils/logger.js";
import OllamaServerManager from "./manage-ollama-server.js";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";

const logger = new Logger("ManagedEmailProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const ANALYSIS_DB_PATH = "./data/crewai.db";

// Models to use for each phase
const MODELS = {
  phase2: "llama3.2:3b", // Fast, efficient for enhancement
  phase3: "doomgrave/phi-4:14b-tools-Q3_K_S", // Larger model for strategic analysis
};

interface ProcessingStats {
  totalConversations: number;
  processedConversations: number;
  completeChains: number;
  incompleteChains: number;
  totalEmails: number;
  processedEmails: number;
  phase3Count: number;
  errors: number;
  startTime: number;
}

class ManagedEmailProcessor {
  private enhancedDb: Database.Database;
  private analysisService: EmailThreePhaseAnalysisService;
  private ollamaManager: OllamaServerManager;
  private stats: ProcessingStats = {
    totalConversations: 0,
    processedConversations: 0,
    completeChains: 0,
    incompleteChains: 0,
    totalEmails: 0,
    processedEmails: 0,
    phase3Count: 0,
    errors: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.enhancedDb = new Database(ENHANCED_DB_PATH, { readonly: true });
    this.analysisService = new EmailThreePhaseAnalysisService(ANALYSIS_DB_PATH);
    this.ollamaManager = new OllamaServerManager();
  }

  async initialize(): Promise<boolean> {
    console.log(chalk.cyan("\n🔧 Initializing Email Processing System...\n"));

    // Restart Ollama with required models
    console.log(chalk.yellow("Step 1: Restarting Ollama server..."));
    const serverReady = await this.ollamaManager.restartOllamaWithModel(
      MODELS.phase2,
    );
    if (!serverReady) {
      console.error(chalk.red("Failed to initialize Ollama server"));
      return false;
    }

    // Load phase 3 model if available
    console.log(chalk.yellow("\nStep 2: Loading Phase 3 model..."));
    const phi4Available = await this.ollamaManager.ensureModelLoaded(
      MODELS.phase3,
    );
    if (!phi4Available) {
      console.log(
        chalk.yellow("⚠️  Phi-4 not available, will use Llama for all phases"),
      );
    }

    // Show system info
    await this.ollamaManager.getSystemInfo();

    console.log(chalk.green("\n✅ System initialized and ready!\n"));
    return true;
  }

  async processEmails(): Promise<void> {
    console.log(chalk.cyan("\n📧 Starting Email Processing Pipeline\n"));

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
        CASE WHEN COUNT(*) > 1 THEN 0 ELSE 1 END,  -- Multi-email first
        COUNT(*) DESC
      LIMIT 100
    `,
      )
      .all() as any[];

    this.stats.totalConversations = conversations.length;

    // Count total emails
    const emailCount = this.enhancedDb
      .prepare(
        `
      SELECT COUNT(*) as count FROM emails_enhanced 
      WHERE conversation_id IN (${conversations.map(() => "?").join(",")})
    `,
      )
      .get(...conversations.map((c) => c.conversation_id)) as any;
    this.stats.totalEmails = emailCount.count;

    console.log(
      chalk.yellow(
        `Found ${this.stats.totalConversations} conversations with ${this.stats.totalEmails} emails\n`,
      ),
    );

    // Process conversations
    for (const conv of conversations) {
      // Skip single emails
      if (conv.email_count === 1) {
        console.log(
          chalk.dim(
            `[${this.stats.processedConversations + 1}/${this.stats.totalConversations}] Skipping single email: ${conv.conversation_id}`,
          ),
        );
        this.stats.processedConversations++;
        continue;
      }

      await this.processConversation(conv);

      // Progress update every 10 conversations
      if (this.stats.processedConversations % 10 === 0) {
        this.displayProgress();
      }

      // Health check every 25 conversations
      if (this.stats.processedConversations % 25 === 0) {
        await this.performHealthCheck();
      }
    }

    this.displayFinalStats();
    await this.cleanup();
  }

  private async processConversation(conv: any): Promise<void> {
    try {
      console.log(
        chalk.cyan(
          `\n[${this.stats.processedConversations + 1}/${this.stats.totalConversations}] Processing ${conv.conversation_id}`,
        ),
      );
      console.log(
        `  📊 ${conv.email_count} emails | ${conv.duration_hours}h | ${conv.unique_senders} participants`,
      );
      console.log(`  📧 ${conv.first_subject.substring(0, 50)}...`);

      // Get all emails
      const emails = this.enhancedDb
        .prepare(
          `
        SELECT 
          id, subject, body_content as body, sender_email,
          received_date_time as received_at, importance, has_attachments
        FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time
      `,
        )
        .all(conv.conversation_id);

      // Simple chain analysis
      const chainAnalysis = this.analyzeChain(emails);
      console.log(
        `  ${chainAnalysis.isComplete ? chalk.green("✓ Complete") : chalk.yellow("⚡ Incomplete")} chain (${chainAnalysis.score}%)`,
      );

      // Process emails using three-phase analysis
      const sampleSize = Math.min(3, emails.length); // Process first 3 emails

      for (let i = 0; i < sampleSize; i++) {
        const email = emails[i];
        const startTime = Date.now();

        try {
          // Run three-phase analysis
          const result = await this.analysisService.analyzeEmail(email, {
            chainContext: {
              isComplete: chainAnalysis.isComplete,
              completenessScore: chainAnalysis.score,
              chainType: "email_chain",
              conversationId: conv.conversation_id,
            },
            qualityThreshold: 6.0,
            useHybridApproach: true,
            enableQualityLogging: false,
          });

          const processingTime = Date.now() - startTime;
          console.log(
            chalk.green(
              `    ✓ Email ${i + 1}/${sampleSize}: ${processingTime}ms`,
            ),
          );

          this.stats.processedEmails++;
          if (chainAnalysis.isComplete && chainAnalysis.score >= 70) {
            this.stats.phase3Count++;
          }
        } catch (error: any) {
          console.error(
            chalk.red(`    ❌ Email ${i + 1} failed: ${error.message}`),
          );
          this.stats.errors++;
        }
      }

      if (chainAnalysis.isComplete) {
        this.stats.completeChains++;
      } else {
        this.stats.incompleteChains++;
      }

      this.stats.processedConversations++;
    } catch (error: any) {
      console.error(chalk.red(`  ❌ Conversation failed: ${error.message}`));
      this.stats.errors++;
      this.stats.processedConversations++;
    }
  }

  private analyzeChain(emails: any[]): { isComplete: boolean; score: number } {
    const subjects = emails.map((e) => e.subject.toLowerCase());

    let score = 0;

    // Check for conversation flow
    if (
      subjects.some(
        (s) =>
          s.includes("request") || s.includes("quote") || s.includes("inquiry"),
      )
    )
      score += 30;
    if (subjects.some((s) => s.includes("re:") || s.includes("fw:")))
      score += 20;
    if (
      subjects.some(
        (s) =>
          s.includes("complete") ||
          s.includes("resolved") ||
          s.includes("thank"),
      )
    )
      score += 30;

    // Length bonus
    if (emails.length >= 3) score += 10;
    if (emails.length >= 5) score += 10;

    return {
      isComplete: score >= 70,
      score: Math.min(100, score),
    };
  }

  private async performHealthCheck(): Promise<void> {
    console.log(chalk.dim("\n🏥 Performing health check..."));

    const healthy = await this.ollamaManager.checkOllamaHealth();
    if (!healthy) {
      console.log(chalk.yellow("⚠️  Ollama unhealthy, restarting..."));
      await this.ollamaManager.restartOllamaWithModel(MODELS.phase2);
    } else {
      console.log(chalk.green("✓ Ollama healthy"));
    }
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
    console.log(
      `  Emails: ${this.stats.processedEmails}/${this.stats.totalEmails}`,
    );
    console.log(`  Complete chains: ${this.stats.completeChains}`);
    console.log(`  Phase 3 analyses: ${this.stats.phase3Count}`);
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
    console.log(
      `  Processed conversations: ${this.stats.processedConversations}`,
    );
    console.log(`  Total emails: ${this.stats.totalEmails}`);
    console.log(`  Processed emails: ${this.stats.processedEmails}`);
    console.log(`  Complete chains (3-phase): ${this.stats.completeChains}`);
    console.log(
      `  Incomplete chains (2-phase): ${this.stats.incompleteChains}`,
    );
    console.log(`  Phase 3 analyses: ${this.stats.phase3Count}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Total time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Avg rate: ${(this.stats.processedEmails / totalTime).toFixed(1)} emails/min`,
    );

    // Quality metrics
    const metrics = this.analysisService.getQualityMetrics();
    console.log(chalk.cyan("\n📊 Quality Metrics:"));
    console.log(`  Total responses: ${metrics.totalResponses}`);
    console.log(
      `  Avg quality score: ${metrics.averageQualityScore.toFixed(1)}/10`,
    );
    console.log(`  High quality rate: ${metrics.highQualityRate.toFixed(1)}%`);
    console.log(`  Fallback rate: ${metrics.fallbackRate.toFixed(1)}%`);
    console.log(`  Hybrid rate: ${metrics.hybridRate.toFixed(1)}%`);
  }

  private async cleanup(): Promise<void> {
    console.log(chalk.yellow("\n🧹 Cleaning up..."));
    this.enhancedDb.close();
    await this.analysisService.shutdown();
  }
}

// Main execution
async function main() {
  const processor = new ManagedEmailProcessor();

  // Initialize system
  const initialized = await processor.initialize();
  if (!initialized) {
    console.error(chalk.red("Failed to initialize system"));
    process.exit(1);
  }

  // Process emails
  await processor.processEmails();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
