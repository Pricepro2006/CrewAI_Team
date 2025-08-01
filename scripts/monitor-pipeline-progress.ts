#!/usr/bin/env tsx

/**
 * Real-time monitoring of email pipeline processing
 * Shows live stats, progress bars, and estimated completion time
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import chalk from "chalk";
import { createSpinner } from "nanospinner";

interface PipelineStats {
  total_emails: number;
  analyzed_emails: number;
  pending_emails: number;
  complete_chains: number;
  phase3_count: number;
  phase2_count: number;
  error_count: number;
  processing_rate: number;
  estimated_completion: Date | null;
}

class PipelineMonitor {
  private db: any;
  private isRunning: boolean = true;
  private spinner: any;

  constructor() {
    const dbManager = getDatabaseManager();
    this.db = dbManager.getSQLiteDatabase();
  }

  async startMonitoring() {
    console.clear();
    console.log(chalk.blue.bold("\n📊 Email Pipeline Monitor\n"));

    // Set up graceful shutdown
    process.on("SIGINT", () => {
      this.isRunning = false;
      if (this.spinner) this.spinner.stop();
      console.log(chalk.yellow("\n\n👋 Monitoring stopped"));
      process.exit(0);
    });

    // Main monitoring loop
    while (this.isRunning) {
      await this.displayStats();
      await this.sleep(5000); // Update every 5 seconds
    }
  }

  private async displayStats() {
    try {
      const stats = await this.gatherStats();

      // Clear and redraw
      console.clear();
      console.log(chalk.blue.bold("\n📊 Email Pipeline Monitor\n"));
      console.log(chalk.gray("Press Ctrl+C to stop monitoring\n"));

      // Overall progress
      const progressPercentage =
        (stats.analyzed_emails / stats.total_emails) * 100;
      this.drawProgressBar(
        "Overall Progress",
        progressPercentage,
        stats.analyzed_emails,
        stats.total_emails,
      );

      // Statistics boxes
      console.log(chalk.white.bold("\n📈 Live Statistics:\n"));

      const statsGrid = [
        ["Total Emails", stats.total_emails.toLocaleString(), chalk.cyan],
        ["Analyzed", stats.analyzed_emails.toLocaleString(), chalk.green],
        ["Pending", stats.pending_emails.toLocaleString(), chalk.yellow],
        [
          "Complete Chains",
          stats.complete_chains.toLocaleString(),
          chalk.magenta,
        ],
        ["3-Phase Analysis", stats.phase3_count.toLocaleString(), chalk.blue],
        ["2-Phase Analysis", stats.phase2_count.toLocaleString(), chalk.cyan],
        [
          "Errors",
          stats.error_count.toLocaleString(),
          stats.error_count > 0 ? chalk.red : chalk.green,
        ],
        ["Rate", `${stats.processing_rate.toFixed(1)}/min`, chalk.white],
      ];

      // Display in 2 columns
      for (let i = 0; i < statsGrid.length; i += 2) {
        const left = statsGrid[i];
        const right = statsGrid[i + 1] || ["", "", chalk.white];

        console.log(
          `${left[0].padEnd(20)} ${left[2](left[1].padStart(10))}    ` +
            `${right[0].padEnd(20)} ${right[2](right[1].padStart(10))}`,
        );
      }

      // Time estimates
      console.log(chalk.white.bold("\n⏱️  Time Estimates:\n"));

      if (stats.estimated_completion) {
        const remainingTime = stats.estimated_completion.getTime() - Date.now();
        const hours = Math.floor(remainingTime / (1000 * 60 * 60));
        const minutes = Math.floor(
          (remainingTime % (1000 * 60 * 60)) / (1000 * 60),
        );

        console.log(
          `Estimated completion: ${chalk.green(stats.estimated_completion.toLocaleTimeString())}`,
        );
        console.log(`Time remaining: ${chalk.yellow(`${hours}h ${minutes}m`)}`);
      } else {
        console.log(chalk.gray("Calculating estimates..."));
      }

      // Recent activity
      await this.displayRecentActivity();

      // Phase distribution chart
      await this.displayPhaseDistribution(stats);
    } catch (error) {
      console.error(chalk.red("Error gathering stats:"), error);
    }
  }

  private async gatherStats(): Promise<PipelineStats> {
    // Basic counts
    const totalEmails = this.db
      .prepare("SELECT COUNT(*) as count FROM emails")
      .get().count;
    const analyzedEmails = this.db
      .prepare('SELECT COUNT(*) as count FROM emails WHERE status = "analyzed"')
      .get().count;
    const pendingEmails = totalEmails - analyzedEmails;

    // Chain analysis
    const completeChains =
      this.db
        .prepare(
          `
      SELECT COUNT(DISTINCT chain_id) as count 
      FROM email_analysis 
      WHERE is_complete_chain = 1
    `,
        )
        .get().count || 0;

    // Phase counts
    const phase3Count =
      this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM email_analysis 
      WHERE phase3_results IS NOT NULL AND phase3_results != '{}'
    `,
        )
        .get().count || 0;

    const phase2Count =
      this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM email_analysis 
      WHERE phase2_results IS NOT NULL AND phase3_results IS NULL
    `,
        )
        .get().count || 0;

    // Error count
    const errorCount =
      this.db
        .prepare('SELECT COUNT(*) as count FROM emails WHERE status = "error"')
        .get().count || 0;

    // Calculate processing rate
    const recentAnalyzed =
      this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM emails 
      WHERE analyzed_at > datetime('now', '-5 minutes')
    `,
        )
        .get().count || 0;

    const processingRate = recentAnalyzed * 12; // Per minute (5 min sample * 12)

    // Estimate completion time
    let estimatedCompletion = null;
    if (processingRate > 0 && pendingEmails > 0) {
      const minutesRemaining = pendingEmails / processingRate;
      estimatedCompletion = new Date(Date.now() + minutesRemaining * 60 * 1000);
    }

    return {
      total_emails: totalEmails,
      analyzed_emails: analyzedEmails,
      pending_emails: pendingEmails,
      complete_chains: completeChains,
      phase3_count: phase3Count,
      phase2_count: phase2Count,
      error_count: errorCount,
      processing_rate: processingRate,
      estimated_completion: estimatedCompletion,
    };
  }

  private drawProgressBar(
    label: string,
    percentage: number,
    current: number,
    total: number,
  ) {
    const width = 40;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    const percentStr = `${percentage.toFixed(1)}%`.padStart(6);
    const countStr = `${current}/${total}`;

    console.log(
      `${label.padEnd(20)} ${bar} ${chalk.yellow(percentStr)} (${countStr})`,
    );
  }

  private async displayRecentActivity() {
    console.log(chalk.white.bold("\n📝 Recent Activity:\n"));

    const recentEmails = this.db
      .prepare(
        `
      SELECT 
        e.subject,
        e.workflow_state,
        e.priority,
        ea.workflow_type,
        e.analyzed_at
      FROM emails e
      LEFT JOIN email_analysis ea ON e.id = ea.email_id
      WHERE e.analyzed_at IS NOT NULL
      ORDER BY e.analyzed_at DESC
      LIMIT 5
    `,
      )
      .all();

    recentEmails.forEach((email) => {
      const subject = email.subject?.substring(0, 50) || "No subject";
      const type = email.workflow_type || "unknown";
      const priority = email.priority || "medium";
      const time = new Date(email.analyzed_at).toLocaleTimeString();

      const priorityColor =
        priority === "high"
          ? chalk.red
          : priority === "medium"
            ? chalk.yellow
            : chalk.green;

      console.log(
        `${chalk.gray(time)} | ${priorityColor("●")} ${subject.padEnd(50)} | ${chalk.cyan(type)}`,
      );
    });
  }

  private async displayPhaseDistribution(stats: PipelineStats) {
    console.log(chalk.white.bold("\n📊 Phase Distribution:\n"));

    const total = stats.phase3_count + stats.phase2_count;
    if (total === 0) {
      console.log(chalk.gray("No emails processed yet"));
      return;
    }

    const phase3Percent = (stats.phase3_count / total) * 100;
    const phase2Percent = (stats.phase2_count / total) * 100;

    // Visual bar chart
    const barWidth = 30;
    const phase3Bars = Math.round((phase3Percent / 100) * barWidth);
    const phase2Bars = barWidth - phase3Bars;

    console.log(
      "3-Phase: " +
        chalk.blue("█".repeat(phase3Bars)) +
        chalk.gray("░".repeat(barWidth - phase3Bars)) +
        ` ${phase3Percent.toFixed(1)}%`,
    );
    console.log(
      "2-Phase: " +
        chalk.cyan("█".repeat(phase2Bars)) +
        chalk.gray("░".repeat(barWidth - phase2Bars)) +
        ` ${phase2Percent.toFixed(1)}%`,
    );

    // Time savings
    const timeSaved = (stats.phase2_count * 80) / 3600; // 80 seconds saved per 2-phase email
    console.log(chalk.green(`\nTime saved: ${timeSaved.toFixed(1)} hours`));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run the monitor
async function main() {
  const monitor = new PipelineMonitor();
  await monitor.startMonitoring();
}

main().catch(console.error);
