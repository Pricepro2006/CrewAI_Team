#!/usr/bin/env tsx

/**
 * Analyze email patterns to identify workflows, common topics, and business processes
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { logger } from "../src/utils/logger.js";
import chalk from "chalk";

interface EmailPattern {
  pattern_type: string;
  count: number;
  examples: string[];
  keywords: string[];
}

async function analyzeEmailPatterns() {
  console.log(chalk.blue("\n🔍 Email Pattern Analysis\n"));

  try {
    const dbManager = getDatabaseManager();
    const db = dbManager.getSQLiteDatabase();

    // 1. Analyze subject line patterns
    console.log(chalk.yellow("📧 Analyzing subject line patterns...\n"));

    const subjectPatterns = db
      .prepare(
        `
      SELECT 
        CASE
          WHEN LOWER(subject) LIKE '%quote%' THEN 'Quote Request'
          WHEN LOWER(subject) LIKE '%order%' THEN 'Order Processing'
          WHEN LOWER(subject) LIKE '%return%' OR LOWER(subject) LIKE '%rma%' THEN 'Returns/RMA'
          WHEN LOWER(subject) LIKE '%invoice%' OR LOWER(subject) LIKE '%payment%' THEN 'Billing/Payment'
          WHEN LOWER(subject) LIKE '%ship%' OR LOWER(subject) LIKE '%deliver%' THEN 'Shipping/Delivery'
          WHEN LOWER(subject) LIKE '%urgent%' OR LOWER(subject) LIKE '%critical%' THEN 'Urgent/Escalation'
          WHEN LOWER(subject) LIKE '%support%' OR LOWER(subject) LIKE '%help%' THEN 'Support Request'
          WHEN LOWER(subject) LIKE '%meeting%' OR LOWER(subject) LIKE '%call%' THEN 'Meeting/Call'
          WHEN subject LIKE 'RE:%' OR subject LIKE 'FW:%' THEN 'Reply/Forward'
          ELSE 'Other'
        END as pattern_type,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT subject, '|||') as examples
      FROM emails
      GROUP BY pattern_type
      ORDER BY count DESC
    `,
      )
      .all() as any[];

    console.log(chalk.white.bold("Subject Line Patterns:"));
    console.log(chalk.white("─".repeat(60)));

    subjectPatterns.forEach((pattern) => {
      const percentage =
        (pattern.count / subjectPatterns.reduce((sum, p) => sum + p.count, 0)) *
        100;
      const examples = pattern.examples
        ? pattern.examples.split("|||").slice(0, 3)
        : [];

      console.log(
        chalk.cyan(
          `\n${pattern.pattern_type}: ${pattern.count} emails (${percentage.toFixed(1)}%)`,
        ),
      );
      examples.forEach((example) => {
        if (example.length > 50) example = example.substring(0, 50) + "...";
        console.log(chalk.gray(`  → "${example}"`));
      });
    });

    // 2. Analyze sender domains
    console.log(chalk.yellow("\n\n📮 Analyzing sender domains...\n"));

    const senderDomains = db
      .prepare(
        `
      SELECT 
        SUBSTR(from_address, INSTR(from_address, '@') + 1) as domain,
        COUNT(*) as count,
        COUNT(DISTINCT SUBSTR(from_address, 1, INSTR(from_address, '@') - 1)) as unique_senders
      FROM emails
      WHERE from_address LIKE '%@%'
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 20
    `,
      )
      .all() as any[];

    console.log(chalk.white.bold("Top Sender Domains:"));
    console.log(chalk.white("─".repeat(60)));

    senderDomains.forEach((domain, index) => {
      console.log(
        `${(index + 1).toString().padStart(2)}. ${domain.domain.padEnd(30)} ${domain.count.toString().padStart(6)} emails (${domain.unique_senders} senders)`,
      );
    });

    // 3. Analyze email threads
    console.log(chalk.yellow("\n\n🔗 Analyzing email threads...\n"));

    const threadStats = db
      .prepare(
        `
      SELECT 
        COUNT(DISTINCT conversation_id) as unique_threads,
        COUNT(*) as total_emails,
        AVG(thread_length) as avg_thread_length,
        MAX(thread_length) as max_thread_length
      FROM (
        SELECT 
          conversation_id,
          COUNT(*) as thread_length
        FROM emails
        WHERE conversation_id IS NOT NULL AND conversation_id != ''
        GROUP BY conversation_id
      )
    `,
      )
      .get() as any;

    const threadDistribution = db
      .prepare(
        `
      SELECT 
        CASE
          WHEN thread_length = 1 THEN 'Single Email'
          WHEN thread_length BETWEEN 2 AND 3 THEN '2-3 Emails'
          WHEN thread_length BETWEEN 4 AND 5 THEN '4-5 Emails'
          WHEN thread_length BETWEEN 6 AND 10 THEN '6-10 Emails'
          ELSE '10+ Emails'
        END as thread_size,
        COUNT(*) as thread_count,
        SUM(thread_length) as total_emails
      FROM (
        SELECT 
          conversation_id,
          COUNT(*) as thread_length
        FROM emails
        WHERE conversation_id IS NOT NULL AND conversation_id != ''
        GROUP BY conversation_id
      )
      GROUP BY thread_size
      ORDER BY 
        CASE thread_size
          WHEN 'Single Email' THEN 1
          WHEN '2-3 Emails' THEN 2
          WHEN '4-5 Emails' THEN 3
          WHEN '6-10 Emails' THEN 4
          ELSE 5
        END
    `,
      )
      .all() as any[];

    console.log(chalk.white.bold("Thread Statistics:"));
    console.log(chalk.white("─".repeat(60)));
    console.log(
      `Unique threads: ${threadStats.unique_threads?.toLocaleString() || 0}`,
    );
    console.log(
      `Average thread length: ${threadStats.avg_thread_length?.toFixed(1) || 0} emails`,
    );
    console.log(`Longest thread: ${threadStats.max_thread_length || 0} emails`);

    console.log(chalk.white("\nThread Size Distribution:"));
    threadDistribution.forEach((dist) => {
      const percentage = (dist.total_emails / threadStats.total_emails) * 100;
      console.log(
        `  ${dist.thread_size.padEnd(15)} ${dist.thread_count.toString().padStart(6)} threads (${percentage.toFixed(1)}% of emails)`,
      );
    });

    // 4. Analyze time patterns
    console.log(chalk.yellow("\n\n⏰ Analyzing time patterns...\n"));

    const hourlyDistribution = db
      .prepare(
        `
      SELECT 
        CAST(strftime('%H', received_time) AS INTEGER) as hour,
        COUNT(*) as count
      FROM emails
      GROUP BY hour
      ORDER BY hour
    `,
      )
      .all() as any[];

    const dayOfWeekDistribution = db
      .prepare(
        `
      SELECT 
        CASE CAST(strftime('%w', received_time) AS INTEGER)
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day_of_week,
        COUNT(*) as count
      FROM emails
      GROUP BY day_of_week
      ORDER BY 
        CASE day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END
    `,
      )
      .all() as any[];

    console.log(chalk.white.bold("Email Volume by Hour (UTC):"));
    console.log(chalk.white("─".repeat(60)));

    const maxHourly = Math.max(...hourlyDistribution.map((h) => h.count));
    hourlyDistribution.forEach((hour) => {
      const bar = "█".repeat(Math.round((hour.count / maxHourly) * 30));
      console.log(
        `${hour.hour.toString().padStart(2, "0")}:00 ${bar} ${hour.count}`,
      );
    });

    console.log(chalk.white.bold("\nEmail Volume by Day of Week:"));
    console.log(chalk.white("─".repeat(60)));

    dayOfWeekDistribution.forEach((day) => {
      const percentage =
        (day.count /
          dayOfWeekDistribution.reduce((sum, d) => sum + d.count, 0)) *
        100;
      console.log(
        `${day.day_of_week.padEnd(10)} ${day.count.toString().padStart(6)} (${percentage.toFixed(1)}%)`,
      );
    });

    // 5. Identify workflow candidates
    console.log(chalk.yellow("\n\n🔄 Identifying workflow candidates...\n"));

    const workflowCandidates = db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MIN(received_time) as start_time,
        MAX(received_time) as end_time,
        GROUP_CONCAT(DISTINCT 
          CASE
            WHEN LOWER(subject) LIKE '%quote%' THEN 'quote'
            WHEN LOWER(subject) LIKE '%order%' THEN 'order'
            WHEN LOWER(subject) LIKE '%ship%' THEN 'ship'
            WHEN LOWER(subject) LIKE '%deliver%' THEN 'deliver'
            WHEN LOWER(subject) LIKE '%complete%' THEN 'complete'
            WHEN LOWER(subject) LIKE '%close%' THEN 'close'
            ELSE NULL
          END
        ) as workflow_stages
      FROM emails
      WHERE conversation_id IS NOT NULL AND conversation_id != ''
      GROUP BY conversation_id
      HAVING email_count >= 3
        AND workflow_stages LIKE '%,%'
      ORDER BY email_count DESC
      LIMIT 10
    `,
      )
      .all() as any[];

    console.log(chalk.white.bold("Top Workflow Candidates:"));
    console.log(chalk.white("─".repeat(60)));

    workflowCandidates.forEach((workflow, index) => {
      const duration =
        new Date(workflow.end_time).getTime() -
        new Date(workflow.start_time).getTime();
      const durationDays = Math.round(duration / (1000 * 60 * 60 * 24));

      console.log(
        chalk.cyan(
          `\n${index + 1}. Thread with ${workflow.email_count} emails (${durationDays} days)`,
        ),
      );
      console.log(
        chalk.gray(`   Stages: ${workflow.workflow_stages || "various"}`),
      );
    });

    // Summary and recommendations
    console.log(chalk.white.bold("\n\n📊 Analysis Summary:"));
    console.log(chalk.white("─".repeat(60)));

    const hasGoodThreads = threadStats.avg_thread_length > 2.5;
    const hasWorkflowPatterns = workflowCandidates.length > 5;
    const businessHours = hourlyDistribution
      .filter((h) => h.hour >= 8 && h.hour <= 17)
      .reduce((sum, h) => sum + h.count, 0);
    const totalEmails = hourlyDistribution.reduce((sum, h) => sum + h.count, 0);
    const businessHoursPercentage = (businessHours / totalEmails) * 100;

    console.log(
      chalk.green("✓ Email Volume:"),
      totalEmails.toLocaleString(),
      "total emails",
    );
    console.log(
      chalk.green("✓ Thread Quality:"),
      hasGoodThreads ? "Good" : "Low",
      `(avg ${threadStats.avg_thread_length?.toFixed(1)} emails/thread)`,
    );
    console.log(
      chalk.green("✓ Workflow Potential:"),
      hasWorkflowPatterns ? "High" : "Low",
      `(${workflowCandidates.length} candidates found)`,
    );
    console.log(
      chalk.green("✓ Business Hours:"),
      `${businessHoursPercentage.toFixed(1)}% during 8AM-5PM`,
    );

    console.log(chalk.white.bold("\n💡 Recommendations:"));
    console.log(chalk.white("─".repeat(60)));

    if (!hasGoodThreads) {
      console.log(
        chalk.yellow(
          "• Consider pulling more historical emails to capture complete threads",
        ),
      );
    }

    if (hasWorkflowPatterns) {
      console.log(
        chalk.green(
          "• Good candidates for workflow template extraction identified",
        ),
      );
      console.log(
        chalk.green("• Run adaptive three-phase analysis to maximize learning"),
      );
    }

    if (businessHoursPercentage > 80) {
      console.log(
        chalk.cyan(
          "• Schedule heavy processing during off-hours for minimal impact",
        ),
      );
    }
  } catch (error) {
    logger.error("Failed to analyze email patterns", "PATTERN_ANALYSIS", {
      error,
    });
    console.error(chalk.red("\n❌ Error:"), error);
    process.exit(1);
  }
}

// Run the analysis
analyzeEmailPatterns()
  .then(() => {
    console.log(chalk.green("\n✨ Pattern analysis complete!\n"));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red("\n❌ Fatal error:"), error);
    process.exit(1);
  });
