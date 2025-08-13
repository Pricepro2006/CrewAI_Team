#!/usr/bin/env tsx

/**
 * Analyze Email Chain Completeness in Enhanced Database
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";

const DB_PATH = "./data/crewai_enhanced.db";

interface ConversationStats {
  conversation_id: string;
  email_count: number;
  duration_hours: number;
  participants: string;
  subject_sample: string;
  first_email: string;
  last_email: string;
}

async function analyzeChainCompleteness(): Promise<void> {
  const db = new Database(DB_PATH, { readonly: true });
  const analyzer = new EmailChainAnalyzer();

  console.log(chalk.cyan("\n📊 Email Chain Completeness Analysis\n"));

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

  // Get conversation statistics
  const conversationStats = db
    .prepare(
      `
    SELECT 
      conversation_id,
      COUNT(*) as email_count,
      (julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24 as duration_hours,
      GROUP_CONCAT(DISTINCT sender_email) as participants,
      MIN(subject) as subject_sample,
      MIN(received_date_time) as first_email,
      MAX(received_date_time) as last_email
    FROM emails_enhanced
    GROUP BY conversation_id
    HAVING email_count > 1
    ORDER BY email_count DESC
    LIMIT 100
  `,
    )
    .all() as ConversationStats[];

  console.log(
    chalk.yellow("Analyzing top 100 conversations for completeness...\n"),
  );

  let completeChains = 0;
  let incompleteChains = 0;
  const scoreDistribution: Record<string, number> = {};

  // Analyze each conversation
  for (const conv of conversationStats) {
    // Get all emails in conversation
    const emails = db
      .prepare(
        `
      SELECT 
        e.id, e.subject, e.body_content as body, e.sender_email, 
        GROUP_CONCAT(r.email_address) as recipient_emails,
        e.received_date_time as received_at, e.importance, e.has_attachments
      FROM emails_enhanced e
      LEFT JOIN email_recipients r ON e.id = r.email_id AND r.recipient_type = 'to'
      WHERE e.conversation_id = ?
      GROUP BY e.id
      ORDER BY e.received_date_time
    `,
      )
      .all(conv.conversation_id) as any[];

    if (emails.length > 0) {
      const analysis = await analyzer.analyzeChain(emails);

      // Track score distribution
      const scoreRange = Math.floor(analysis.completenessScore / 10) * 10;
      scoreDistribution[`${scoreRange}-${scoreRange + 9}%`] =
        (scoreDistribution[`${scoreRange}-${scoreRange + 9}%`] || 0) + 1;

      if (analysis.isComplete) {
        completeChains++;
      } else {
        incompleteChains++;
      }

      // Display sample results
      if (conversationStats.indexOf(conv) < 10) {
        console.log(chalk.gray(`Conversation: ${conv.conversation_id}`));
        console.log(
          `  Emails: ${conv.email_count} | Duration: ${conv.duration_hours.toFixed(1)}h`,
        );
        console.log(`  Subject: ${conv.subject_sample.substring(0, 60)}...`);
        console.log(
          `  Completeness: ${analysis.isComplete ? chalk.green("✓") : chalk.yellow("⚡")} ${analysis.completenessScore}%`,
        );
        console.log(
          `  Type: ${analysis.chainType} | Missing: ${analysis.missingElements.join(", ") || "None"}`,
        );
        console.log();
      }
    }
  }

  // Display summary
  console.log(chalk.cyan("\n📊 Summary Statistics:\n"));
  console.log(
    `Complete chains (≥70%): ${chalk.green(completeChains)} (${((completeChains / conversationStats.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Incomplete chains (<70%): ${chalk.yellow(incompleteChains)} (${((incompleteChains / conversationStats.length) * 100).toFixed(1)}%)`,
  );

  console.log(chalk.cyan("\n📊 Score Distribution:\n"));
  Object.entries(scoreDistribution)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([range, count]) => {
      const percentage = ((count / conversationStats.length) * 100).toFixed(1);
      const bar = "█".repeat(Math.round(parseInt(percentage) / 2));
      console.log(`${range.padEnd(10)} ${bar} ${count} (${percentage}%)`);
    });

  // Get email count distribution
  const emailDistribution = db
    .prepare(
      `
    SELECT 
      CASE 
        WHEN email_count = 1 THEN '1 email'
        WHEN email_count BETWEEN 2 AND 5 THEN '2-5 emails'
        WHEN email_count BETWEEN 6 AND 10 THEN '6-10 emails'
        WHEN email_count BETWEEN 11 AND 20 THEN '11-20 emails'
        WHEN email_count BETWEEN 21 AND 50 THEN '21-50 emails'
        ELSE '50+ emails'
      END as range,
      COUNT(*) as conversation_count
    FROM (
      SELECT conversation_id, COUNT(*) as email_count
      FROM emails_enhanced
      GROUP BY conversation_id
    )
    GROUP BY range
    ORDER BY 
      CASE range
        WHEN '1 email' THEN 1
        WHEN '2-5 emails' THEN 2
        WHEN '6-10 emails' THEN 3
        WHEN '11-20 emails' THEN 4
        WHEN '21-50 emails' THEN 5
        ELSE 6
      END
  `,
    )
    .all() as any[];

  console.log(chalk.cyan("\n📊 Conversation Size Distribution:\n"));
  emailDistribution.forEach((dist) => {
    const percentage = (
      (dist.conversation_count / totalConversations.count) *
      100
    ).toFixed(1);
    const bar = "█".repeat(Math.round(parseInt(percentage) / 2));
    console.log(
      `${dist.range.padEnd(15)} ${bar} ${dist.conversation_count.toLocaleString()} (${percentage}%)`,
    );
  });

  // Estimate processing time
  const avgProcessingTime = 30; // seconds per conversation
  const estimatedHours = (
    (totalConversations.count * avgProcessingTime) /
    3600
  ).toFixed(1);

  console.log(chalk.cyan("\n⏱️  Processing Estimates:\n"));
  console.log(
    `Total conversations to process: ${chalk.bold(totalConversations.count.toLocaleString())}`,
  );
  console.log(`Estimated processing time: ${chalk.bold(estimatedHours)} hours`);
  console.log(
    `Complete chains (3-phase): ~${Math.round((completeChains / conversationStats.length) * totalConversations.count).toLocaleString()}`,
  );
  console.log(
    `Incomplete chains (2-phase): ~${Math.round((incompleteChains / conversationStats.length) * totalConversations.count).toLocaleString()}`,
  );

  db.close();
  await analyzer.close();
}

analyzeChainCompleteness().catch(console.error);
