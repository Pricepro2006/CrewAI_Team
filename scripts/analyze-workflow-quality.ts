#!/usr/bin/env tsx

/**
 * Analyze workflow quality and identify complete customer journeys
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { logger } from "../src/utils/logger.js";
import chalk from "chalk";
import { promises as fs } from "fs";
import path from "path";

interface WorkflowMetrics {
  workflow_type: string;
  total_chains: number;
  complete_chains: number;
  avg_completeness: number;
  avg_duration_hours: number;
  common_patterns: string[];
}

async function analyzeWorkflowQuality() {
  console.log(chalk.blue("\n🔄 Workflow Quality Analysis\n"));

  try {
    const dbManager = getDatabaseManager();
    const db = dbManager.getSQLiteDatabase();
    const analyzer = new EmailChainAnalyzer();

    // 1. Group emails by conversation
    console.log(chalk.yellow("📊 Grouping emails by conversation...\n"));

    const conversations = db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MIN(received_time) as start_time,
        MAX(received_time) as end_time,
        GROUP_CONCAT(id) as email_ids,
        GROUP_CONCAT(subject, '|||') as subjects
      FROM emails
      WHERE conversation_id IS NOT NULL AND conversation_id != ''
      GROUP BY conversation_id
      HAVING email_count >= 2
      ORDER BY email_count DESC
      LIMIT 500
    `,
      )
      .all() as any[];

    console.log(
      chalk.cyan(`Found ${conversations.length} conversations to analyze\n`),
    );

    // 2. Analyze each conversation for workflow patterns
    const workflowResults: Record<string, WorkflowMetrics> = {};
    let processedCount = 0;

    for (const conversation of conversations) {
      const emailIds = conversation.email_ids.split(",");
      const emails = db
        .prepare(
          `
        SELECT * FROM emails WHERE id IN (${emailIds.map(() => "?").join(",")})
        ORDER BY received_time
      `,
        )
        .all(...emailIds) as any[];

      // Analyze the first and last email to determine workflow completeness
      const firstEmail = emails[0];
      const lastEmail = emails[emails.length - 1];

      // Use chain analyzer on the full conversation
      const chainAnalysis = await analyzer.analyzeChain({
        ...lastEmail,
        thread_emails: emails,
      });

      // Categorize workflow type
      const workflowType = determineWorkflowType(emails);

      if (!workflowResults[workflowType]) {
        workflowResults[workflowType] = {
          workflow_type: workflowType,
          total_chains: 0,
          complete_chains: 0,
          avg_completeness: 0,
          avg_duration_hours: 0,
          common_patterns: [],
        };
      }

      const duration =
        (new Date(conversation.end_time).getTime() -
          new Date(conversation.start_time).getTime()) /
        (1000 * 60 * 60);

      workflowResults[workflowType].total_chains++;
      if (chainAnalysis.is_complete) {
        workflowResults[workflowType].complete_chains++;
      }
      workflowResults[workflowType].avg_completeness +=
        chainAnalysis.completeness_score;
      workflowResults[workflowType].avg_duration_hours += duration;

      processedCount++;
      if (processedCount % 50 === 0) {
        process.stdout.write(
          `\rProcessed: ${processedCount}/${conversations.length}`,
        );
      }
    }

    console.log("\n");

    // 3. Calculate averages and display results
    console.log(chalk.white.bold("\n📈 Workflow Quality Metrics:\n"));
    console.log(chalk.white("─".repeat(80)));
    console.log(
      chalk.white(
        "Workflow Type".padEnd(25) +
          "Total".padEnd(10) +
          "Complete".padEnd(12) +
          "Avg Score".padEnd(12) +
          "Avg Duration",
      ),
    );
    console.log(chalk.white("─".repeat(80)));

    const sortedWorkflows = Object.values(workflowResults).sort(
      (a, b) => b.total_chains - a.total_chains,
    );

    sortedWorkflows.forEach((workflow) => {
      workflow.avg_completeness =
        workflow.avg_completeness / workflow.total_chains;
      workflow.avg_duration_hours =
        workflow.avg_duration_hours / workflow.total_chains;

      const completePercentage =
        (workflow.complete_chains / workflow.total_chains) * 100;
      const scoreColor =
        workflow.avg_completeness >= 0.7
          ? chalk.green
          : workflow.avg_completeness >= 0.5
            ? chalk.yellow
            : chalk.red;

      console.log(
        workflow.workflow_type.padEnd(25) +
          workflow.total_chains.toString().padEnd(10) +
          `${workflow.complete_chains} (${completePercentage.toFixed(0)}%)`.padEnd(
            12,
          ) +
          scoreColor((workflow.avg_completeness * 100).toFixed(1) + "%").padEnd(
            12,
          ) +
          `${workflow.avg_duration_hours.toFixed(1)}h`,
      );
    });

    // 4. Identify high-value complete workflows
    console.log(chalk.white.bold("\n\n🌟 High-Value Complete Workflows:\n"));

    const completeWorkflows = db
      .prepare(
        `
      SELECT 
        c.conversation_id,
        c.email_count,
        c.subjects,
        JULIANDAY(c.end_time) - JULIANDAY(c.start_time) as duration_days
      FROM (
        SELECT 
          conversation_id,
          COUNT(*) as email_count,
          MIN(received_time) as start_time,
          MAX(received_time) as end_time,
          GROUP_CONCAT(subject, ' → ') as subjects
        FROM emails
        WHERE conversation_id IS NOT NULL AND conversation_id != ''
        GROUP BY conversation_id
        HAVING email_count >= 4
      ) c
      WHERE duration_days BETWEEN 0.5 AND 30
      ORDER BY email_count DESC
      LIMIT 10
    `,
      )
      .all() as any[];

    completeWorkflows.forEach((workflow, index) => {
      const subjectFlow = workflow.subjects
        .split(" → ")
        .map((s: string) => {
          if (s.length > 40) return s.substring(0, 40) + "...";
          return s;
        })
        .slice(0, 3)
        .join(" → ");

      console.log(
        chalk.cyan(
          `${index + 1}. ${workflow.email_count} emails over ${workflow.duration_days.toFixed(1)} days`,
        ),
      );
      console.log(chalk.gray(`   ${subjectFlow}`));
    });

    // 5. Generate workflow templates from complete chains
    console.log(chalk.white.bold("\n\n📝 Generating Workflow Templates...\n"));

    const templates = await generateWorkflowTemplates(db, sortedWorkflows);

    // Save templates to file
    const templatesPath = path.join(
      process.cwd(),
      "data",
      "workflow_templates.json",
    );
    await fs.mkdir(path.dirname(templatesPath), { recursive: true });
    await fs.writeFile(templatesPath, JSON.stringify(templates, null, 2));

    console.log(
      chalk.green(
        `✅ Saved ${templates.length} workflow templates to: ${templatesPath}`,
      ),
    );

    // 6. Recommendations
    console.log(
      chalk.white.bold("\n\n💡 Workflow Optimization Recommendations:\n"),
    );
    console.log(chalk.white("─".repeat(80)));

    const totalChains = sortedWorkflows.reduce(
      (sum, w) => sum + w.total_chains,
      0,
    );
    const totalComplete = sortedWorkflows.reduce(
      (sum, w) => sum + w.complete_chains,
      0,
    );
    const overallCompleteness = (totalComplete / totalChains) * 100;

    console.log(chalk.cyan(`\n📊 Overall Statistics:`));
    console.log(`   • Total workflow chains analyzed: ${totalChains}`);
    console.log(
      `   • Complete chains: ${totalComplete} (${overallCompleteness.toFixed(1)}%)`,
    );
    console.log(`   • Workflow types identified: ${sortedWorkflows.length}`);

    if (overallCompleteness < 30) {
      console.log(chalk.yellow("\n⚠️  Low workflow completeness detected:"));
      console.log("   • Consider pulling more historical emails");
      console.log("   • Focus on capturing full customer journeys");
      console.log("   • May need to adjust chain detection thresholds");
    } else {
      console.log(chalk.green("\n✅ Good workflow completeness!"));
      console.log("   • Sufficient complete chains for template extraction");
      console.log("   • Adaptive processing will provide significant benefits");
    }

    // Identify workflow improvement opportunities
    const lowScoreWorkflows = sortedWorkflows.filter(
      (w) => w.avg_completeness < 0.5,
    );
    if (lowScoreWorkflows.length > 0) {
      console.log(chalk.yellow("\n🔧 Workflows needing improvement:"));
      lowScoreWorkflows.forEach((w) => {
        console.log(
          `   • ${w.workflow_type}: Only ${(w.avg_completeness * 100).toFixed(1)}% complete on average`,
        );
      });
    }

    // Time-based insights
    const avgDuration =
      sortedWorkflows.reduce((sum, w) => sum + w.avg_duration_hours, 0) /
      sortedWorkflows.length;
    console.log(chalk.cyan(`\n⏱️  Timing Insights:`));
    console.log(
      `   • Average workflow duration: ${avgDuration.toFixed(1)} hours`,
    );

    const fastWorkflows = sortedWorkflows.filter(
      (w) => w.avg_duration_hours < 24,
    );
    const slowWorkflows = sortedWorkflows.filter(
      (w) => w.avg_duration_hours > 72,
    );

    if (fastWorkflows.length > 0) {
      console.log(
        `   • Fast workflows (<24h): ${fastWorkflows.map((w) => w.workflow_type).join(", ")}`,
      );
    }
    if (slowWorkflows.length > 0) {
      console.log(
        `   • Slow workflows (>72h): ${slowWorkflows.map((w) => w.workflow_type).join(", ")}`,
      );
    }
  } catch (error) {
    logger.error("Failed to analyze workflow quality", "WORKFLOW_ANALYSIS", {
      error,
    });
    console.error(chalk.red("\n❌ Error:"), error);
    process.exit(1);
  }
}

function determineWorkflowType(emails: any[]): string {
  const subjects = emails.map((e) => e.subject?.toLowerCase() || "").join(" ");
  const bodies = emails.map((e) => e.body_text?.toLowerCase() || "").join(" ");
  const combined = subjects + " " + bodies;

  if (combined.includes("quote") && combined.includes("order")) {
    return "Quote to Order";
  } else if (combined.includes("return") || combined.includes("rma")) {
    return "Returns Process";
  } else if (combined.includes("invoice") || combined.includes("payment")) {
    return "Billing & Payment";
  } else if (combined.includes("ship") || combined.includes("deliver")) {
    return "Shipping & Delivery";
  } else if (combined.includes("support") || combined.includes("ticket")) {
    return "Support Ticket";
  } else if (combined.includes("escalat") || combined.includes("urgent")) {
    return "Escalation";
  } else if (combined.includes("cancel")) {
    return "Cancellation";
  } else if (combined.includes("meeting") || combined.includes("schedule")) {
    return "Meeting Coordination";
  } else {
    return "General Inquiry";
  }
}

async function generateWorkflowTemplates(
  db: any,
  workflows: WorkflowMetrics[],
) {
  const templates = [];

  for (const workflow of workflows) {
    if (workflow.complete_chains === 0) continue;

    // Get examples of complete chains for this workflow type
    const examples = db
      .prepare(
        `
      SELECT 
        conversation_id,
        GROUP_CONCAT(subject, ' → ') as subject_flow,
        GROUP_CONCAT(
          CASE 
            WHEN body_text LIKE '%please%' OR body_text LIKE '%could you%' THEN 'request'
            WHEN body_text LIKE '%confirm%' OR body_text LIKE '%approved%' THEN 'confirmation'
            WHEN body_text LIKE '%complete%' OR body_text LIKE '%done%' THEN 'completion'
            WHEN body_text LIKE '%thank%' THEN 'acknowledgment'
            ELSE 'update'
          END, ' → '
        ) as action_flow
      FROM emails
      WHERE conversation_id IN (
        SELECT DISTINCT conversation_id 
        FROM emails 
        WHERE conversation_id IS NOT NULL 
        GROUP BY conversation_id 
        HAVING COUNT(*) >= 3
      )
      GROUP BY conversation_id
      LIMIT 5
    `,
      )
      .all() as any[];

    templates.push({
      workflow_type: workflow.workflow_type,
      template: {
        stages: extractStages(examples),
        avg_duration_hours: workflow.avg_duration_hours,
        success_indicators: [
          "complete",
          "done",
          "shipped",
          "resolved",
          "closed",
        ],
        common_patterns: examples.map((e) => e.action_flow).filter(Boolean),
        completeness_threshold: workflow.avg_completeness,
      },
      metrics: {
        total_instances: workflow.total_chains,
        complete_instances: workflow.complete_chains,
        success_rate: (workflow.complete_chains / workflow.total_chains) * 100,
      },
    });
  }

  return templates;
}

function extractStages(examples: any[]): string[] {
  const allStages = new Set<string>();

  examples.forEach((ex) => {
    if (ex.action_flow) {
      ex.action_flow.split(" → ").forEach((stage: string) => {
        allStages.add(stage.trim());
      });
    }
  });

  return Array.from(allStages);
}

// Run the analysis
analyzeWorkflowQuality()
  .then(() => {
    console.log(chalk.green("\n✨ Workflow quality analysis complete!\n"));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red("\n❌ Fatal error:"), error);
    process.exit(1);
  });
