#!/usr/bin/env tsx

/**
 * Monitor conversation processing progress
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");

function monitorProgress() {
  const db = new Database(DB_PATH, { readonly: true });

  console.clear();
  console.log(chalk.blue.bold("📊 Conversation Processing Monitor\n"));

  try {
    // Get total stats
    const totalStats = db
      .prepare(
        `
      SELECT 
        COUNT(DISTINCT conversation_id) as total_conversations,
        COUNT(*) as total_emails,
        SUM(CASE WHEN status = 'analyzed' THEN 1 ELSE 0 END) as analyzed_emails,
        SUM(CASE WHEN status IN ('pending', 'migrated') THEN 1 ELSE 0 END) as pending_emails,
        COUNT(DISTINCT CASE WHEN status = 'analyzed' THEN conversation_id END) as analyzed_conversations
      FROM emails_enhanced
    `,
      )
      .get() as any;

    // Get chain type distribution
    const chainTypes = db
      .prepare(
        `
      SELECT 
        chain_type,
        COUNT(DISTINCT conversation_id) as count,
        AVG(chain_completeness_score) as avg_score
      FROM emails_enhanced
      WHERE chain_type IS NOT NULL
      GROUP BY chain_type
      ORDER BY count DESC
    `,
      )
      .all() as any[];

    // Get recent progress
    const recentProgress = db
      .prepare(
        `
      SELECT 
        COUNT(*) as recent_count,
        MIN(analyzed_at) as oldest,
        MAX(analyzed_at) as newest
      FROM emails_enhanced
      WHERE analyzed_at > datetime('now', '-5 minutes')
    `,
      )
      .get() as any;

    // Display stats
    console.log(chalk.white("📧 Overall Progress:"));
    console.log(
      chalk.white(
        `   • Total conversations: ${totalStats.total_conversations.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Analyzed conversations: ${totalStats.analyzed_conversations.toLocaleString()} (${((totalStats.analyzed_conversations / totalStats.total_conversations) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.white(
        `   • Total emails: ${totalStats.total_emails.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Analyzed emails: ${totalStats.analyzed_emails.toLocaleString()} (${((totalStats.analyzed_emails / totalStats.total_emails) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.white(
        `   • Pending emails: ${totalStats.pending_emails.toLocaleString()}`,
      ),
    );

    console.log(chalk.cyan("\n🔄 Recent Activity (last 5 min):"));
    console.log(
      chalk.white(
        `   • Emails processed: ${recentProgress.recent_count.toLocaleString()}`,
      ),
    );
    if (recentProgress.recent_count > 0) {
      console.log(
        chalk.white(
          `   • Rate: ${(recentProgress.recent_count / 5).toFixed(1)} emails/min`,
        ),
      );
      console.log(chalk.white(`   • Latest: ${recentProgress.newest}`));
    }

    console.log(chalk.yellow("\n📈 Chain Type Distribution:"));
    chainTypes.forEach((type) => {
      console.log(
        chalk.white(
          `   • ${type.chain_type}: ${type.count} conversations (avg score: ${type.avg_score?.toFixed(1)}%)`,
        ),
      );
    });

    // Estimate completion time
    if (recentProgress.recent_count > 0 && totalStats.pending_emails > 0) {
      const rate = recentProgress.recent_count / 5; // per minute
      const minutesRemaining = totalStats.pending_emails / rate;
      const hoursRemaining = minutesRemaining / 60;

      console.log(
        chalk.green(
          `\n⏱️  Estimated completion: ${hoursRemaining.toFixed(1)} hours`,
        ),
      );
    }

    // Check for errors
    const errorCount = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM emails_enhanced 
      WHERE status = 'error'
    `,
      )
      .get() as any;

    if (errorCount.count > 0) {
      console.log(
        chalk.red(`\n⚠️  Errors: ${errorCount.count} emails failed processing`),
      );
    }

    // Get sample of current processing
    const currentSample = db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MAX(subject) as sample_subject
      FROM emails_enhanced
      WHERE status = 'analyzed' 
        AND analyzed_at > datetime('now', '-1 minute')
      GROUP BY conversation_id
      ORDER BY analyzed_at DESC
      LIMIT 3
    `,
      )
      .all() as any[];

    if (currentSample.length > 0) {
      console.log(chalk.magenta("\n🔍 Recently Processed:"));
      currentSample.forEach((conv) => {
        console.log(
          chalk.white(
            `   • ${conv.conversation_id.substring(0, 16)}... (${conv.email_count} emails)`,
          ),
        );
        console.log(
          chalk.gray(`     "${conv.sample_subject.substring(0, 50)}..."`),
        );
      });
    }
  } catch (error) {
    console.error(chalk.red("Error reading database:"), error);
  } finally {
    db.close();
  }
}

// Run monitor every 30 seconds
console.log(chalk.yellow("Starting monitor... Press Ctrl+C to stop\n"));
monitorProgress();
setInterval(monitorProgress, 30000);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\nMonitor stopped."));
  process.exit(0);
});
