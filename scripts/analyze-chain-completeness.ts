#!/usr/bin/env tsx

/**
 * Analyze email chain completeness in the database
 * This script provides insights into how many complete vs incomplete chains we have
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { logger } from "../src/utils/logger.js";
import chalk from "chalk";

async function analyzeChainCompleteness() {
  console.log(chalk.blue("\n📊 Email Chain Completeness Analysis\n"));

  try {
    // Initialize database
    const dbManager = getDatabaseManager();
    const db = dbManager.getSQLiteDatabase();

    // Initialize chain analyzer
    const analyzer = new EmailChainAnalyzer();

    // Get total email count
    const totalCountResult = db
      .prepare("SELECT COUNT(*) as count FROM emails")
      .get() as { count: number };
    const totalEmails = totalCountResult.count;

    console.log(
      chalk.yellow(
        `Total emails in database: ${totalEmails.toLocaleString()}\n`,
      ),
    );

    if (totalEmails === 0) {
      console.log(
        chalk.red(
          "No emails found in database. Please run email extraction first.",
        ),
      );
      return;
    }

    // Analyze a sample for quick results (analyzing all 51k+ emails would take time)
    const sampleSize = Math.min(1000, totalEmails);
    console.log(chalk.cyan(`Analyzing sample of ${sampleSize} emails...\n`));

    // Get sample emails
    const emails = db
      .prepare(
        `
      SELECT 
        id,
        subject,
        body_text,
        from_address,
        to_addresses,
        cc_addresses,
        received_time,
        message_id,
        in_reply_to,
        references,
        conversation_id,
        conversation_index
      FROM emails 
      ORDER BY received_time DESC
      LIMIT ?
    `,
      )
      .all(sampleSize);

    // Track results
    const results = {
      total_analyzed: 0,
      complete_chains: 0,
      incomplete_chains: 0,
      chain_types: {} as Record<string, number>,
      completeness_scores: [] as number[],
      by_score_range: {
        "0-25%": 0,
        "26-50%": 0,
        "51-70%": 0,
        "71-100%": 0,
      },
    };

    // Analyze each email
    const startTime = Date.now();
    let processedCount = 0;

    for (const email of emails) {
      const analysis = await analyzer.analyzeChain(email);

      results.total_analyzed++;
      results.completeness_scores.push(analysis.completeness_score);

      if (analysis.is_complete) {
        results.complete_chains++;
      } else {
        results.incomplete_chains++;
      }

      // Track chain types
      results.chain_types[analysis.chain_type] =
        (results.chain_types[analysis.chain_type] || 0) + 1;

      // Track score ranges
      const score = analysis.completeness_score * 100;
      if (score <= 25) results.by_score_range["0-25%"]++;
      else if (score <= 50) results.by_score_range["26-50%"]++;
      else if (score <= 70) results.by_score_range["51-70%"]++;
      else results.by_score_range["71-100%"]++;

      processedCount++;
      if (processedCount % 100 === 0) {
        process.stdout.write(`\rProcessed: ${processedCount}/${sampleSize}`);
      }
    }

    const processingTime = (Date.now() - startTime) / 1000;
    console.log(
      chalk.green(
        `\n\n✅ Analysis complete in ${processingTime.toFixed(2)}s\n`,
      ),
    );

    // Calculate statistics
    const avgCompleteness =
      results.completeness_scores.reduce((a, b) => a + b, 0) /
      results.completeness_scores.length;
    const completePercentage =
      (results.complete_chains / results.total_analyzed) * 100;

    // Display results
    console.log(chalk.white.bold("📈 Chain Completeness Results:"));
    console.log(chalk.white("─".repeat(50)));

    console.log(
      chalk.green(
        `  Complete chains (≥70%):   ${results.complete_chains} (${completePercentage.toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.yellow(
        `  Incomplete chains (<70%): ${results.incomplete_chains} (${(100 - completePercentage).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.cyan(
        `  Average completeness:     ${(avgCompleteness * 100).toFixed(1)}%`,
      ),
    );

    console.log(chalk.white("\n📊 Score Distribution:"));
    console.log(chalk.white("─".repeat(50)));
    Object.entries(results.by_score_range).forEach(([range, count]) => {
      const percentage = (count / results.total_analyzed) * 100;
      const bar = "█".repeat(Math.round(percentage / 2));
      console.log(
        `  ${range.padEnd(8)} ${count.toString().padStart(4)} (${percentage.toFixed(1).padStart(5)}%) ${bar}`,
      );
    });

    console.log(chalk.white("\n🏷️  Chain Types:"));
    console.log(chalk.white("─".repeat(50)));
    Object.entries(results.chain_types)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const percentage = (count / results.total_analyzed) * 100;
        console.log(
          `  ${type.padEnd(20)} ${count.toString().padStart(4)} (${percentage.toFixed(1).padStart(5)}%)`,
        );
      });

    // Processing time estimates
    console.log(chalk.white("\n⏱️  Processing Time Estimates:"));
    console.log(chalk.white("─".repeat(50)));

    const estimatedCompleteChains = Math.round(
      totalEmails * (completePercentage / 100),
    );
    const estimatedIncompleteChains = totalEmails - estimatedCompleteChains;

    const timePerComplete = 91; // seconds (all 3 phases)
    const timePerIncomplete = 11; // seconds (2 phases only)

    const totalTimeAllPhases = (totalEmails * timePerComplete) / 3600; // hours
    const totalTimeAdaptive =
      (estimatedCompleteChains * timePerComplete +
        estimatedIncompleteChains * timePerIncomplete) /
      3600;
    const timeSaved = totalTimeAllPhases - totalTimeAdaptive;

    console.log(
      `  If all emails used 3 phases:  ${totalTimeAllPhases.toFixed(1)} hours`,
    );
    console.log(
      `  With adaptive approach:        ${totalTimeAdaptive.toFixed(1)} hours`,
    );
    console.log(
      chalk.green(
        `  Time saved:                    ${timeSaved.toFixed(1)} hours (${((timeSaved / totalTimeAllPhases) * 100).toFixed(1)}%)`,
      ),
    );

    // Recommendations
    console.log(chalk.white("\n💡 Recommendations:"));
    console.log(chalk.white("─".repeat(50)));

    if (completePercentage < 20) {
      console.log(
        chalk.yellow("  ⚠️  Low percentage of complete chains detected."),
      );
      console.log(
        "     Consider pulling more historical emails to capture full workflows.",
      );
    } else if (completePercentage > 40) {
      console.log(
        chalk.green(
          "  ✅ Good percentage of complete chains for workflow learning!",
        ),
      );
      console.log(
        "     The adaptive approach will provide significant time savings.",
      );
    }

    // Next steps
    console.log(chalk.white("\n🚀 Next Steps:"));
    console.log(chalk.white("─".repeat(50)));
    console.log("  1. Run full three-phase analysis on all emails:");
    console.log(chalk.cyan("     npm run analyze:emails:three-phase"));
    console.log("  2. Monitor real-time progress in dashboard:");
    console.log(chalk.cyan("     http://localhost:3001/dashboard"));
    console.log("  3. Export workflow templates from complete chains:");
    console.log(chalk.cyan("     npm run export:workflows"));
  } catch (error) {
    logger.error("Failed to analyze chain completeness", "CHAIN_ANALYSIS", {
      error,
    });
    console.error(chalk.red("\n❌ Error:"), error);
    process.exit(1);
  }
}

// Run the analysis
analyzeChainCompleteness()
  .then(() => {
    console.log(chalk.green("\n✨ Analysis complete!\n"));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red("\n❌ Fatal error:"), error);
    process.exit(1);
  });
