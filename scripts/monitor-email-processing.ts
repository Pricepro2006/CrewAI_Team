#!/usr/bin/env tsx

/**
 * Email Processing Monitor
 * Displays real-time statistics and progress
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { setInterval } from "timers";

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";

class ProcessingMonitor {
  private db: Database.Database;
  private startTime: number;
  private lastAnalyzedCount: number = 0;

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH, { readonly: true });
    this.startTime = Date.now();
  }

  displayStats() {
    console.clear();
    console.log(chalk.cyan("📊 Email Processing Monitor\n"));
    console.log(chalk.gray(`Updated: ${new Date().toLocaleTimeString()}\n`));

    // Get overall statistics
    const totalEmails = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM emails_enhanced
    `,
      )
      .get() as any;

    const analyzedEmails = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM emails_enhanced WHERE status = 'analyzed'
    `,
      )
      .get() as any;

    const pendingEmails = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM emails_enhanced 
      WHERE status = 'pending' OR status IS NULL OR status = ''
    `,
      )
      .get() as any;

    // Get conversation statistics
    const totalConversations = this.db
      .prepare(
        `
      SELECT COUNT(DISTINCT conversation_id) as count FROM emails_enhanced
    `,
      )
      .get() as any;

    const analyzedConversations = this.db
      .prepare(
        `
      SELECT COUNT(DISTINCT conversation_id) as count 
      FROM emails_enhanced 
      WHERE status = 'analyzed'
    `,
      )
      .get() as any;

    const completeChains = this.db
      .prepare(
        `
      SELECT COUNT(DISTINCT conversation_id) as count
      FROM emails_enhanced
      WHERE is_chain_complete = 1 AND status = 'analyzed'
    `,
      )
      .get() as any;

    // Get chain type distribution
    const chainTypes = this.db
      .prepare(
        `
      SELECT chain_type, COUNT(DISTINCT conversation_id) as count
      FROM emails_enhanced
      WHERE status = 'analyzed' AND chain_type IS NOT NULL
      GROUP BY chain_type
      ORDER BY count DESC
    `,
      )
      .all() as any[];

    // Get priority distribution
    const priorities = this.db
      .prepare(
        `
      SELECT priority, COUNT(*) as count
      FROM emails_enhanced
      WHERE status = 'analyzed' AND priority IS NOT NULL
      GROUP BY priority
      ORDER BY count DESC
    `,
      )
      .all() as any[];

    // Calculate processing rate
    const processedSinceStart = analyzedEmails.count;
    const elapsedMinutes = (Date.now() - this.startTime) / 1000 / 60;
    const emailsPerMinute = processedSinceStart / elapsedMinutes;

    // Calculate current rate (last check)
    const recentlyProcessed = analyzedEmails.count - this.lastAnalyzedCount;
    this.lastAnalyzedCount = analyzedEmails.count;

    // Display statistics
    console.log(chalk.cyan("📊 Overall Progress:"));
    console.log(
      `  Total emails: ${chalk.bold(totalEmails.count.toLocaleString())}`,
    );
    console.log(
      `  Analyzed: ${chalk.green(analyzedEmails.count.toLocaleString())} (${((analyzedEmails.count / totalEmails.count) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Pending: ${chalk.yellow(pendingEmails.count.toLocaleString())} (${((pendingEmails.count / totalEmails.count) * 100).toFixed(1)}%)`,
    );

    console.log(chalk.cyan("\n📊 Conversation Analysis:"));
    console.log(
      `  Total conversations: ${chalk.bold(totalConversations.count.toLocaleString())}`,
    );
    console.log(
      `  Analyzed conversations: ${chalk.green(analyzedConversations.count.toLocaleString())}`,
    );
    console.log(
      `  Complete chains: ${chalk.blue(completeChains.count.toLocaleString())} (${((completeChains.count / analyzedConversations.count) * 100).toFixed(1)}%)`,
    );

    console.log(chalk.cyan("\n📊 Chain Types:"));
    chainTypes.forEach((ct) => {
      const percentage = (
        (ct.count / analyzedConversations.count) *
        100
      ).toFixed(1);
      console.log(
        `  ${ct.chain_type}: ${chalk.bold(ct.count)} (${percentage}%)`,
      );
    });

    console.log(chalk.cyan("\n📊 Priority Distribution:"));
    priorities.forEach((p) => {
      const percentage = ((p.count / analyzedEmails.count) * 100).toFixed(1);
      const color =
        p.priority === "CRITICAL"
          ? chalk.red
          : p.priority === "HIGH"
            ? chalk.yellow
            : p.priority === "MEDIUM"
              ? chalk.blue
              : chalk.gray;
      console.log(
        `  ${color(p.priority)}: ${p.count.toLocaleString()} (${percentage}%)`,
      );
    });

    console.log(chalk.cyan("\n⏱️  Processing Rate:"));
    console.log(
      `  Average: ${chalk.bold(emailsPerMinute.toFixed(1))} emails/min`,
    );
    console.log(
      `  Current batch: ${chalk.bold(recentlyProcessed)} emails in last 10 seconds`,
    );
    console.log(
      `  Time elapsed: ${chalk.bold(elapsedMinutes.toFixed(1))} minutes`,
    );

    // Estimate completion time
    if (emailsPerMinute > 0) {
      const remainingEmails = pendingEmails.count;
      const estimatedMinutes = remainingEmails / emailsPerMinute;
      const eta = new Date(Date.now() + estimatedMinutes * 60 * 1000);
      console.log(
        `  ETA: ${chalk.green(eta.toLocaleTimeString())} (${estimatedMinutes.toFixed(0)} minutes)`,
      );
    }

    // Show recent emails
    const recentEmails = this.db
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

    if (recentEmails.length > 0) {
      console.log(chalk.cyan("\n📊 Recent Analyses:"));
      recentEmails.forEach((e) => {
        const subject =
          e.subject.substring(0, 60) + (e.subject.length > 60 ? "..." : "");
        console.log(`  ${chalk.dim(subject)}`);
        console.log(
          `    State: ${e.workflow_state} | Priority: ${e.priority} | Type: ${e.chain_type} | Score: ${e.chain_completeness_score}%`,
        );
      });
    }

    console.log(chalk.gray("\n[Press Ctrl+C to exit monitor]"));
  }

  start() {
    // Initial display
    this.displayStats();

    // Update every 10 seconds
    setInterval(() => {
      this.displayStats();
    }, 10000);
  }

  close() {
    this.db.close();
  }
}

// Main execution
const monitor = new ProcessingMonitor();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\nMonitor stopped"));
  monitor.close();
  process.exit(0);
});

monitor.start();
