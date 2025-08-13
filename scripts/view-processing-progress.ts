#!/usr/bin/env tsx

/**
 * View Processing Progress Dashboard
 * Real-time monitoring of email processing progress
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { performance } from "perf_hooks";

const DB_PATH = "./data/crewai_enhanced.db";

interface ProgressSession {
  session_id: string;
  session_start: string;
  total_emails: number;
  total_conversations: number;
  emails_processed: number;
  conversations_processed: number;
  emails_failed: number;
  phase2_only_count: number;
  phase3_count: number;
  avg_time_per_email: number;
  emails_per_minute: number;
  complete_chains_found: number;
  workflow_patterns: string;
  status: string;
  last_update: string;
}

interface ProcessingLog {
  conversation_id: string;
  chain_completeness: number;
  chain_type: string;
  phases_used: number;
  processing_time_ms: number;
  logged_at: string;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatPercentage(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";
}

async function viewProgress() {
  const db = new Database(DB_PATH, { readonly: true });

  console.clear();
  console.log(chalk.cyan.bold("\n📊 Email Processing Progress Dashboard\n"));
  console.log(chalk.gray(`Updated: ${new Date().toLocaleTimeString()}`));
  console.log(chalk.gray("=".repeat(80)));

  try {
    // Get all active sessions
    const sessions = db
      .prepare(
        `
      SELECT * FROM processing_progress 
      WHERE status = 'running' 
      ORDER BY session_start DESC
    `,
      )
      .all() as ProgressSession[];

    if (sessions.length === 0) {
      // Check for any session data
      const allSessions = db
        .prepare(
          `
        SELECT * FROM processing_progress 
        ORDER BY session_start DESC 
        LIMIT 5
      `,
        )
        .all() as ProgressSession[];

      if (allSessions.length === 0) {
        console.log(chalk.yellow("\n⚠️  No processing sessions found"));
        console.log(chalk.gray("Start email processing to see progress data"));
      } else {
        console.log(chalk.yellow("\n📝 Recent Processing Sessions:"));
        allSessions.forEach((session) => {
          const duration =
            new Date(session.last_update).getTime() -
            new Date(session.session_start).getTime();
          console.log(chalk.white(`\n${session.session_id}:`));
          console.log(`  Status: ${session.status}`);
          console.log(
            `  Processed: ${session.emails_processed}/${session.total_emails} emails`,
          );
          console.log(`  Duration: ${formatTime(duration)}`);
          console.log(
            `  Rate: ${session.emails_per_minute?.toFixed(1) || 0} emails/min`,
          );
        });
      }
    } else {
      // Show active sessions
      sessions.forEach((session, index) => {
        if (index > 0) console.log(chalk.gray("\n" + "-".repeat(80)));

        const sessionDuration =
          Date.now() - new Date(session.session_start).getTime();
        const progress = session.emails_processed / session.total_emails;

        console.log(
          chalk.green.bold(`\n🔄 Active Session: ${session.session_id}`),
        );
        console.log(
          chalk.white(
            `Started: ${new Date(session.session_start).toLocaleString()}`,
          ),
        );
        console.log(chalk.white(`Duration: ${formatTime(sessionDuration)}`));

        // Progress bar
        const barLength = 50;
        const filled = Math.floor(progress * barLength);
        const progressBar = "█".repeat(filled) + "░".repeat(barLength - filled);
        console.log(
          chalk.cyan(
            `\nProgress: [${progressBar}] ${formatPercentage(session.emails_processed, session.total_emails)}`,
          ),
        );

        // Email stats
        console.log(chalk.white("\n📧 Email Processing:"));
        console.log(
          `  Total: ${session.total_emails.toLocaleString()} emails in ${session.total_conversations.toLocaleString()} conversations`,
        );
        console.log(
          `  Processed: ${session.emails_processed.toLocaleString()} emails (${session.conversations_processed} conversations)`,
        );
        console.log(`  Failed: ${session.emails_failed || 0}`);

        // Phase breakdown
        console.log(chalk.magenta("\n🔍 Analysis Phases:"));
        console.log(`  2-Phase Only: ${session.phase2_only_count || 0} emails`);
        console.log(`  3-Phase (Deep): ${session.phase3_count || 0} emails`);
        const phase3Percentage =
          session.emails_processed > 0
            ? (
                ((session.phase3_count || 0) / session.emails_processed) *
                100
              ).toFixed(1)
            : "0";
        console.log(`  Deep Analysis Rate: ${phase3Percentage}%`);

        // Performance metrics
        console.log(chalk.yellow("\n⚡ Performance:"));
        console.log(
          `  Current Rate: ${session.emails_per_minute?.toFixed(1) || 0} emails/minute`,
        );
        console.log(
          `  Avg Time/Email: ${session.avg_time_per_email?.toFixed(1) || 0} seconds`,
        );

        // Time estimates
        const remainingEmails = session.total_emails - session.emails_processed;
        if (session.emails_per_minute && session.emails_per_minute > 0) {
          const estimatedMinutes = remainingEmails / session.emails_per_minute;
          console.log(
            `  Estimated Time Remaining: ${formatTime(estimatedMinutes * 60 * 1000)}`,
          );

          const estimatedCompletion = new Date(
            Date.now() + estimatedMinutes * 60 * 1000,
          );
          console.log(
            `  Estimated Completion: ${estimatedCompletion.toLocaleString()}`,
          );
        }

        // Workflow patterns
        if (session.workflow_patterns) {
          try {
            const patterns = JSON.parse(session.workflow_patterns);
            console.log(chalk.blue("\n🔗 Workflow Patterns Found:"));
            Object.entries(patterns).forEach(([type, count]) => {
              console.log(`  ${type}: ${count} chains`);
            });
            console.log(
              `  Complete Chains Total: ${session.complete_chains_found || 0}`,
            );
          } catch (e) {
            // Ignore JSON parse errors
          }
        }

        // Recent activity
        const recentLogs = db
          .prepare(
            `
          SELECT * FROM processing_logs 
          WHERE session_id = ? AND log_type = 'email'
          ORDER BY logged_at DESC 
          LIMIT 5
        `,
          )
          .all(session.session_id) as ProcessingLog[];

        if (recentLogs.length > 0) {
          console.log(chalk.green("\n📝 Recent Activity:"));
          recentLogs.forEach((log) => {
            const timeAgo = Date.now() - new Date(log.logged_at).getTime();
            console.log(
              `  ${formatTime(timeAgo)} ago: ${log.phases_used}-phase analysis (${(log.processing_time_ms / 1000).toFixed(1)}s)`,
            );
          });
        }

        // Error summary
        const errorCount = db
          .prepare(
            `
          SELECT COUNT(*) as count FROM processing_logs 
          WHERE session_id = ? AND log_type = 'error'
        `,
          )
          .get(session.session_id) as any;

        if (errorCount?.count > 0) {
          console.log(chalk.red(`\n⚠️  Errors: ${errorCount.count}`));
          const recentErrors = db
            .prepare(
              `
            SELECT error_message, logged_at FROM processing_logs 
            WHERE session_id = ? AND log_type = 'error'
            ORDER BY logged_at DESC 
            LIMIT 3
          `,
            )
            .all(session.session_id) as any[];

          recentErrors.forEach((error) => {
            console.log(
              chalk.red(`  - ${error.error_message?.substring(0, 60)}...`),
            );
          });
        }
      });
    }

    // Overall database stats
    console.log(chalk.gray("\n" + "=".repeat(80)));
    console.log(chalk.cyan.bold("\n📈 Overall Database Statistics:"));

    const dbStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'analyzed' THEN 1 END) as analyzed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'imported' THEN 1 END) as imported,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active
      FROM emails_enhanced
    `,
      )
      .get() as any;

    console.log(`  Total Emails: ${dbStats.total.toLocaleString()}`);
    console.log(
      `  ✅ Analyzed: ${dbStats.analyzed.toLocaleString()} (${formatPercentage(dbStats.analyzed, dbStats.total)})`,
    );
    console.log(`  🔄 Active: ${dbStats.active}`);
    console.log(`  ⏳ Pending: ${dbStats.pending.toLocaleString()}`);
    console.log(`  📥 Imported: ${dbStats.imported.toLocaleString()}`);
  } catch (error) {
    console.error(chalk.red("\n❌ Error reading progress data:"), error);
  } finally {
    db.close();
  }

  console.log(chalk.gray("\n\nRefreshing in 10 seconds... (Ctrl+C to exit)"));
}

// Auto-refresh every 10 seconds
async function main() {
  while (true) {
    await viewProgress();
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

main().catch(console.error);
