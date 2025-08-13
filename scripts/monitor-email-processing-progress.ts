#!/usr/bin/env node

import Database from "better-sqlite3";
import { Logger } from "../src/utils/logger.js";
import chalk from "chalk";

const logger = new Logger("ProcessingMonitor");
const DB_PATH = "./data/crewai.db";

interface ProcessingStats {
  totalConversations: number;
  processedConversations: number;
  totalEmails: number;
  processedEmails: number;
  completeChains: number;
  incompleteChains: number;
  averageQualityScore: number;
  phase3Count: number;
  phase2OnlyCount: number;
  fallbackCount: number;
  hybridCount: number;
  errorCount: number;
}

function getProcessingStats(db: Database.Database): ProcessingStats {
  // Get conversation stats
  const conversationStats = db
    .prepare(
      `
    SELECT 
      COUNT(DISTINCT conversation_id) as total_conversations,
      COUNT(DISTINCT CASE WHEN three_phase_analysis IS NOT NULL THEN conversation_id END) as processed_conversations
    FROM emails
    WHERE conversation_id IS NOT NULL
  `,
    )
    .get() as any;

  // Get email stats
  const emailStats = db
    .prepare(
      `
    SELECT 
      COUNT(*) as total_emails,
      COUNT(CASE WHEN three_phase_analysis IS NOT NULL THEN 1 END) as processed_emails,
      COUNT(CASE WHEN phase_3_applied = 1 THEN 1 END) as phase3_count,
      COUNT(CASE WHEN phase_3_applied = 0 AND three_phase_analysis IS NOT NULL THEN 1 END) as phase2_only_count
    FROM emails
  `,
    )
    .get() as any;

  // Get quality metrics
  const qualityStats = db
    .prepare(
      `
    SELECT 
      AVG(CAST(json_extract(quality_metadata, '$.qualityScore') AS REAL)) as avg_quality,
      COUNT(CASE WHEN json_extract(quality_metadata, '$.usedFallback') = 'true' THEN 1 END) as fallback_count,
      COUNT(CASE WHEN json_extract(quality_metadata, '$.usedHybrid') = 'true' THEN 1 END) as hybrid_count
    FROM emails
    WHERE quality_metadata IS NOT NULL
  `,
    )
    .get() as any;

  // Get chain completeness stats
  const chainStats = db
    .prepare(
      `
    SELECT 
      COUNT(CASE WHEN CAST(chain_completeness_score AS INTEGER) >= 70 THEN 1 END) as complete_chains,
      COUNT(CASE WHEN CAST(chain_completeness_score AS INTEGER) < 70 THEN 1 END) as incomplete_chains
    FROM (
      SELECT DISTINCT conversation_id, chain_completeness_score
      FROM emails
      WHERE conversation_id IS NOT NULL AND three_phase_analysis IS NOT NULL
    )
  `,
    )
    .get() as any;

  // Get error count
  const errorCount = db
    .prepare(
      `
    SELECT COUNT(*) as error_count
    FROM emails
    WHERE three_phase_analysis LIKE '%error%' OR three_phase_analysis LIKE '%Error%'
  `,
    )
    .get() as any;

  return {
    totalConversations: conversationStats.total_conversations || 0,
    processedConversations: conversationStats.processed_conversations || 0,
    totalEmails: emailStats.total_emails || 0,
    processedEmails: emailStats.processed_emails || 0,
    completeChains: chainStats.complete_chains || 0,
    incompleteChains: chainStats.incomplete_chains || 0,
    averageQualityScore: qualityStats.avg_quality || 0,
    phase3Count: emailStats.phase3_count || 0,
    phase2OnlyCount: emailStats.phase2_only_count || 0,
    fallbackCount: qualityStats.fallback_count || 0,
    hybridCount: qualityStats.hybrid_count || 0,
    errorCount: errorCount.error_count || 0,
  };
}

function displayStats(stats: ProcessingStats): void {
  console.clear();
  console.log(chalk.bold.cyan("\n📊 Email Processing Progress Monitor\n"));

  // Progress bars
  const conversationProgress =
    Math.round(
      (stats.processedConversations / stats.totalConversations) * 100,
    ) || 0;
  const emailProgress =
    Math.round((stats.processedEmails / stats.totalEmails) * 100) || 0;

  console.log(chalk.bold("Conversations:"));
  console.log(
    `${stats.processedConversations}/${stats.totalConversations} (${conversationProgress}%)`,
  );
  console.log(drawProgressBar(conversationProgress));

  console.log(chalk.bold("\nEmails:"));
  console.log(
    `${stats.processedEmails}/${stats.totalEmails} (${emailProgress}%)`,
  );
  console.log(drawProgressBar(emailProgress));

  // Chain analysis
  console.log(chalk.bold("\n🔗 Chain Analysis:"));
  console.log(`Complete chains (≥70%): ${chalk.green(stats.completeChains)}`);
  console.log(
    `Incomplete chains (<70%): ${chalk.yellow(stats.incompleteChains)}`,
  );

  // Phase distribution
  console.log(chalk.bold("\n📈 Phase Distribution:"));
  console.log(`3-Phase Analysis: ${chalk.green(stats.phase3Count)}`);
  console.log(`2-Phase Only: ${chalk.yellow(stats.phase2OnlyCount)}`);

  // Quality metrics
  console.log(chalk.bold("\n✨ Quality Metrics:"));
  console.log(
    `Average Quality Score: ${chalk.cyan(stats.averageQualityScore.toFixed(1))}/10`,
  );
  console.log(`Fallback Used: ${chalk.yellow(stats.fallbackCount)}`);
  console.log(`Hybrid Used: ${chalk.blue(stats.hybridCount)}`);
  console.log(`Errors: ${chalk.red(stats.errorCount)}`);

  // Estimated time remaining
  if (stats.processedEmails > 0 && emailProgress > 0 && emailProgress < 100) {
    const processingRate =
      (stats.processedEmails / (Date.now() - startTime)) * 1000 * 60; // emails per minute
    const remainingEmails = stats.totalEmails - stats.processedEmails;
    const estimatedMinutes = Math.ceil(remainingEmails / processingRate);
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;

    console.log(chalk.bold("\n⏱️  Estimated Time Remaining:"));
    console.log(
      `${hours}h ${minutes}m (at ${processingRate.toFixed(0)} emails/min)`,
    );
  }

  console.log(chalk.dim(`\nLast updated: ${new Date().toLocaleTimeString()}`));
  console.log(chalk.dim("Press Ctrl+C to exit"));
}

function drawProgressBar(percentage: number): string {
  const width = 40;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const filledBar = "█".repeat(filled);
  const emptyBar = "░".repeat(empty);

  const color =
    percentage < 30 ? chalk.red : percentage < 70 ? chalk.yellow : chalk.green;

  return `[${color(filledBar)}${chalk.gray(emptyBar)}]`;
}

const startTime = Date.now();

async function monitor(): Promise<void> {
  const db = new Database(DB_PATH, { readonly: true });

  try {
    setInterval(() => {
      try {
        const stats = getProcessingStats(db);
        displayStats(stats);
      } catch (error) {
        logger.error("Failed to get stats:", error);
      }
    }, 5000); // Update every 5 seconds

    // Initial display
    const stats = getProcessingStats(db);
    displayStats(stats);
  } catch (error) {
    logger.error("Monitor failed:", error);
    db.close();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\nShutting down monitor..."));
  process.exit(0);
});

monitor().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
