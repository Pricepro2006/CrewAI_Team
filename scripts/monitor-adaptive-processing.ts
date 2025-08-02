#!/usr/bin/env tsx

/**
 * Monitor Adaptive Email Processing Progress
 */

import Database from "better-sqlite3";
import chalk from "chalk";

const DB_PATH = "./data/crewai_enhanced.db";

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

async function monitor() {
  const db = new Database(DB_PATH, { readonly: true });

  console.clear();
  console.log(chalk.cyan.bold("\n📊 Email Processing Monitor\n"));

  // Get overall stats
  const stats = db
    .prepare(
      `
    SELECT 
      status,
      COUNT(*) as count
    FROM emails_enhanced
    GROUP BY status
  `,
    )
    .all() as any[];

  const totalEmails = stats.reduce((sum, s) => sum + s.count, 0);
  const analyzed = stats.find((s) => s.status === "analyzed")?.count || 0;
  const pending = stats.find((s) => s.status === "pending")?.count || 0;
  const imported = stats.find((s) => s.status === "imported")?.count || 0;
  const active = stats.find((s) => s.status === "active")?.count || 0;

  console.log(chalk.white("📈 Overall Progress:"));
  console.log(`  Total emails: ${totalEmails.toLocaleString()}`);
  console.log(
    `  ✅ Analyzed: ${analyzed.toLocaleString()} (${((analyzed / totalEmails) * 100).toFixed(1)}%)`,
  );
  console.log(`  🔄 Active: ${active.toLocaleString()}`);
  console.log(`  ⏳ Pending: ${pending.toLocaleString()}`);
  console.log(`  📥 Imported: ${imported.toLocaleString()}`);

  // Get conversation stats
  const convStats = db
    .prepare(
      `
    SELECT 
      COUNT(DISTINCT conversation_id) as total_conversations,
      COUNT(DISTINCT CASE WHEN status = 'analyzed' THEN conversation_id END) as analyzed_conversations
    FROM emails_enhanced
    WHERE conversation_id IS NOT NULL
  `,
    )
    .get() as any;

  console.log(chalk.cyan("\n📚 Conversation Progress:"));
  console.log(`  Total: ${convStats.total_conversations.toLocaleString()}`);
  console.log(
    `  Analyzed: ${convStats.analyzed_conversations.toLocaleString()} (${((convStats.analyzed_conversations / convStats.total_conversations) * 100).toFixed(1)}%)`,
  );

  // Get chain completeness stats
  const chainStats = db
    .prepare(
      `
    SELECT 
      chain_type,
      COUNT(DISTINCT conversation_id) as count,
      AVG(chain_completeness_score) as avg_score
    FROM emails_enhanced
    WHERE chain_completeness_score IS NOT NULL
    GROUP BY chain_type
    ORDER BY count DESC
    LIMIT 5
  `,
    )
    .all() as any[];

  if (chainStats.length > 0) {
    console.log(chalk.green("\n🔗 Chain Analysis:"));
    chainStats.forEach((stat) => {
      console.log(
        `  ${stat.chain_type || "unknown"}: ${stat.count} chains (avg: ${(stat.avg_score * 100).toFixed(0)}%)`,
      );
    });
  }

  // Get recent processing activity
  const recentActivity = db
    .prepare(
      `
    SELECT 
      id,
      subject,
      updated_at,
      status
    FROM emails_enhanced
    WHERE status IN ('active', 'analyzed')
    ORDER BY updated_at DESC
    LIMIT 5
  `,
    )
    .all() as any[];

  if (recentActivity.length > 0) {
    console.log(chalk.yellow("\n⚡ Recent Activity:"));
    recentActivity.forEach((email) => {
      const subject = email.subject?.substring(0, 50) || "No subject";
      console.log(`  [${email.status}] ${subject}...`);
    });
  }

  // Estimate completion time
  const startTime = db
    .prepare(
      `
    SELECT MIN(analyzed_at) as first_analyzed
    FROM emails_enhanced
    WHERE analyzed_at IS NOT NULL
  `,
    )
    .get() as any;

  if (startTime?.first_analyzed && analyzed > 0) {
    const elapsedMs = Date.now() - new Date(startTime.first_analyzed).getTime();
    const rate = analyzed / (elapsedMs / 1000 / 60); // emails per minute
    const remainingEmails = pending + imported;
    const estimatedMinutes = remainingEmails / rate;

    console.log(chalk.magenta("\n⏱️  Performance:"));
    console.log(`  Processing rate: ${rate.toFixed(1)} emails/min`);
    console.log(
      `  Estimated time remaining: ${formatTime(estimatedMinutes * 60 * 1000)}`,
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

  if (errorCount?.count > 0) {
    console.log(chalk.red(`\n⚠️  Errors: ${errorCount.count} emails failed`));
  }

  db.close();

  console.log(chalk.gray("\n\nRefreshing in 30 seconds... (Ctrl+C to exit)"));
}

// Run monitor
async function main() {
  while (true) {
    await monitor();
    await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 seconds
  }
}

main().catch(console.error);
