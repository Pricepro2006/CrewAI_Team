#!/usr/bin/env tsx

/**
 * Simple Conversation Analysis for Enhanced Database
 */

import Database from "better-sqlite3";
import chalk from "chalk";

const DB_PATH = "./data/crewai_enhanced.db";

async function analyzeConversations(): Promise<void> {
  const db = new Database(DB_PATH, { readonly: true });

  console.log(chalk.cyan("\n📊 Email Conversation Analysis\n"));

  // Get total counts
  const totalEmails = db
    .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
    .get() as any;
  const totalConversations = db
    .prepare(
      "SELECT COUNT(DISTINCT conversation_id) as count FROM emails_enhanced",
    )
    .get() as any;

  console.log(
    `Total emails in database: ${chalk.bold(totalEmails.count.toLocaleString())}`,
  );
  console.log(
    `Total conversations: ${chalk.bold(totalConversations.count.toLocaleString())}\n`,
  );

  // Get conversation size distribution
  const sizeDistribution = db
    .prepare(
      `
    SELECT 
      CASE 
        WHEN email_count = 1 THEN '1 email (single)'
        WHEN email_count BETWEEN 2 AND 5 THEN '2-5 emails'
        WHEN email_count BETWEEN 6 AND 10 THEN '6-10 emails'
        WHEN email_count BETWEEN 11 AND 20 THEN '11-20 emails'
        WHEN email_count BETWEEN 21 AND 50 THEN '21-50 emails'
        WHEN email_count BETWEEN 51 AND 100 THEN '51-100 emails'
        ELSE '100+ emails'
      END as range,
      COUNT(*) as conversation_count,
      SUM(email_count) as total_emails
    FROM (
      SELECT conversation_id, COUNT(*) as email_count
      FROM emails_enhanced
      GROUP BY conversation_id
    )
    GROUP BY range
    ORDER BY 
      CASE range
        WHEN '1 email (single)' THEN 1
        WHEN '2-5 emails' THEN 2
        WHEN '6-10 emails' THEN 3
        WHEN '11-20 emails' THEN 4
        WHEN '21-50 emails' THEN 5
        WHEN '51-100 emails' THEN 6
        ELSE 7
      END
  `,
    )
    .all() as any[];

  console.log(chalk.yellow("📊 Conversation Size Distribution:\n"));
  sizeDistribution.forEach((dist) => {
    const percentage = (
      (dist.conversation_count / totalConversations.count) *
      100
    ).toFixed(1);
    const emailPercentage = (
      (dist.total_emails / totalEmails.count) *
      100
    ).toFixed(1);
    const bar = "█".repeat(Math.round(parseInt(percentage) / 2));
    console.log(`${dist.range.padEnd(20)} ${bar}`);
    console.log(
      `  Conversations: ${dist.conversation_count.toLocaleString()} (${percentage}%)`,
    );
    console.log(
      `  Emails: ${dist.total_emails.toLocaleString()} (${emailPercentage}% of all emails)\n`,
    );
  });

  // Get top conversations by size
  const topConversations = db
    .prepare(
      `
    SELECT 
      conversation_id,
      COUNT(*) as email_count,
      MIN(subject) as first_subject,
      MAX(subject) as last_subject,
      COUNT(DISTINCT sender_email) as unique_senders,
      MIN(received_date_time) as start_date,
      MAX(received_date_time) as end_date,
      ROUND((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24, 1) as duration_hours
    FROM emails_enhanced
    GROUP BY conversation_id
    HAVING email_count > 10
    ORDER BY email_count DESC
    LIMIT 20
  `,
    )
    .all() as any[];

  console.log(chalk.yellow("📊 Top 20 Largest Conversations:\n"));
  topConversations.forEach((conv, index) => {
    console.log(
      `${(index + 1).toString().padStart(2)}. ${chalk.cyan(conv.conversation_id)}`,
    );
    console.log(
      `    Emails: ${chalk.bold(conv.email_count)} | Duration: ${conv.duration_hours}h | Senders: ${conv.unique_senders}`,
    );
    console.log(`    First: ${conv.first_subject.substring(0, 50)}...`);
    if (conv.first_subject !== conv.last_subject) {
      console.log(`    Last:  ${conv.last_subject.substring(0, 50)}...`);
    }
    console.log();
  });

  // Estimate completeness based on multi-email conversations
  const multiEmailConvs = db
    .prepare(
      `
    SELECT COUNT(*) as count 
    FROM (
      SELECT conversation_id 
      FROM emails_enhanced 
      GROUP BY conversation_id 
      HAVING COUNT(*) > 1
    )
  `,
    )
    .get() as any;

  const estimatedComplete = Math.round(multiEmailConvs.count * 0.3); // Assume 30% are complete chains
  const estimatedIncomplete = multiEmailConvs.count - estimatedComplete;

  console.log(chalk.cyan("📊 Chain Completeness Estimates:\n"));
  console.log(
    `Multi-email conversations: ${chalk.bold(multiEmailConvs.count.toLocaleString())}`,
  );
  console.log(
    `Estimated complete chains (≥70%): ${chalk.green(estimatedComplete.toLocaleString())} (~30%)`,
  );
  console.log(
    `Estimated incomplete chains (<70%): ${chalk.yellow(estimatedIncomplete.toLocaleString())} (~70%)`,
  );

  // Processing time estimates
  const avgProcessingTime = 30; // seconds per conversation
  const totalHours = (
    (totalConversations.count * avgProcessingTime) /
    3600
  ).toFixed(1);
  const completeChainHours = ((estimatedComplete * 90) / 3600).toFixed(1); // 90 seconds for complete chains
  const incompleteChainHours = ((estimatedIncomplete * 20) / 3600).toFixed(1); // 20 seconds for incomplete

  console.log(chalk.cyan("\n⏱️  Processing Time Estimates:\n"));
  console.log(`Total processing time: ${chalk.bold(totalHours)} hours`);
  console.log(`  Complete chains (3-phase): ${completeChainHours} hours`);
  console.log(`  Incomplete chains (2-phase): ${incompleteChainHours} hours`);
  console.log(`  Single emails (skip): minimal`);

  // Show import sources
  const importSources = db
    .prepare(
      `
    SELECT import_batch, COUNT(*) as count 
    FROM emails_enhanced 
    GROUP BY import_batch
  `,
    )
    .all() as any[];

  console.log(chalk.cyan("\n📊 Email Sources:\n"));
  importSources.forEach((source) => {
    const percentage = ((source.count / totalEmails.count) * 100).toFixed(1);
    console.log(
      `${(source.import_batch || "unknown").padEnd(25)} ${source.count.toLocaleString()} emails (${percentage}%)`,
    );
  });

  db.close();
}

analyzeConversations().catch(console.error);
