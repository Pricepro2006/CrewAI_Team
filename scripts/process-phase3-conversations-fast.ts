#!/usr/bin/env tsx

/**
 * Fast Phase 3 Processing for Conversations
 * Samples key emails from each conversation for workflow intelligence
 */

import Database from "better-sqlite3";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";

const logger = new Logger("Phase3Fast");
const DB_PATH = "./data/crewai_enhanced.db";

interface ConversationSummary {
  conversation_id: string;
  email_count: number;
  duration_hours: number;
  workflow_detected: string;
  key_findings: string[];
  business_outcome: string;
  participants: string[];
}

async function processPhase3Conversations(limit: number = 100) {
  const db = new Database(DB_PATH, { readonly: false });
  db.pragma("foreign_keys = ON");

  logger.info("Starting Phase 3 conversation analysis");

  // Get top conversations by email count
  const conversations = db
    .prepare(
      `
    SELECT 
      conversation_id,
      COUNT(*) as email_count,
      MIN(received_date_time) as start_date,
      MAX(received_date_time) as end_date,
      ROUND((JULIANDAY(MAX(received_date_time)) - JULIANDAY(MIN(received_date_time))) * 24, 1) as duration_hours
    FROM emails_enhanced
    WHERE status = 'phase2_complete' 
      AND conversation_id IS NOT NULL
    GROUP BY conversation_id
    HAVING email_count >= 3
    ORDER BY email_count DESC
    LIMIT ?
  `,
    )
    .all(limit) as any[];

  logger.info(`Processing ${conversations.length} conversations`);

  const startTime = performance.now();
  let processed = 0;

  // Process conversations
  for (const conv of conversations) {
    try {
      // Sample emails from the conversation
      const emails = db
        .prepare(
          `
        SELECT 
          id, subject, body_content, sender_email, 
          workflow_state, priority, phase2_result
        FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time
      `,
        )
        .all(conv.conversation_id) as any[];

      // Take first, middle, and last emails for analysis
      const sampleEmails = [
        emails[0], // First
        emails[Math.floor(emails.length / 2)], // Middle
        emails[emails.length - 1], // Last
      ];

      // Analyze workflow progression
      const workflowStates = emails
        .map((e) => e.workflow_state)
        .filter(Boolean);
      const dominantWorkflow = findDominantWorkflow(workflowStates);

      // Extract key findings
      const keyFindings = extractKeyFindings(sampleEmails);

      // Determine business outcome
      const businessOutcome = determineBusinessOutcome(
        emails,
        dominantWorkflow,
      );

      // Get unique participants
      const participants = [...new Set(emails.map((e) => e.sender_email))];

      // Create Phase 3 summary
      const summary: ConversationSummary = {
        conversation_id: conv.conversation_id,
        email_count: conv.email_count,
        duration_hours: conv.duration_hours || 0,
        workflow_detected: dominantWorkflow,
        key_findings: keyFindings,
        business_outcome: businessOutcome,
        participants: participants.slice(0, 5), // Top 5 participants
      };

      // Store Phase 3 results in each email
      const phase3Result = JSON.stringify({
        conversation_summary: summary,
        analysis_method: "fast_sampling",
        emails_analyzed: sampleEmails.length,
      });

      // Update all emails in conversation with Phase 3 result
      db.prepare(
        `
        UPDATE emails_enhanced
        SET status = 'phase3_complete',
            phase3_result = ?,
            updated_at = datetime('now')
        WHERE conversation_id = ?
      `,
      ).run(phase3Result, conv.conversation_id);

      processed++;

      if (processed % 10 === 0) {
        const elapsed = (performance.now() - startTime) / 1000;
        const rate = processed / elapsed;
        logger.info(
          `Progress: ${processed}/${conversations.length} (${Math.round(rate * 60)} conversations/min)`,
        );
      }
    } catch (error) {
      logger.error(
        `Failed conversation ${conv.conversation_id}: ${error.message}`,
      );
    }
  }

  // Final summary
  const totalTime = (performance.now() - startTime) / 1000;
  const rate = processed / totalTime;

  logger.info(`
=============================
Phase 3 Conversation Analysis Complete
=============================
Conversations processed: ${processed}
Time: ${Math.round(totalTime)}s
Rate: ${Math.round(rate * 60)} conversations/minute
=============================
  `);

  // Show status distribution
  const statusCounts = db
    .prepare(
      `
    SELECT status, COUNT(*) as count 
    FROM emails_enhanced 
    GROUP BY status 
    ORDER BY count DESC
  `,
    )
    .all();

  logger.info("\nEmail status distribution:");
  statusCounts.forEach((row) => {
    logger.info(`${row.status}: ${row.count}`);
  });

  // Show workflow distribution in Phase 3
  const phase3Emails = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM emails_enhanced
    WHERE status = 'phase3_complete'
  `,
    )
    .get();

  logger.info(`\nTotal Phase 3 complete emails: ${phase3Emails.count}`);

  db.close();
}

function findDominantWorkflow(workflows: string[]): string {
  const counts = workflows.reduce(
    (acc, w) => {
      acc[w] = (acc[w] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  let maxCount = 0;
  let dominant = "OTHER";

  for (const [workflow, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = workflow;
    }
  }

  return dominant;
}

function extractKeyFindings(emails: any[]): string[] {
  const findings: string[] = [];

  // Check for quotes/pricing
  if (emails.some((e) => e.workflow_state === "QUOTE_REQUEST")) {
    findings.push("Quote requested and processed");
  }

  // Check for orders
  if (emails.some((e) => e.workflow_state === "ORDER_PLACED")) {
    findings.push("Order placed successfully");
  }

  // Check for support issues
  if (emails.some((e) => e.workflow_state === "SUPPORT_INQUIRY")) {
    findings.push("Support issue addressed");
  }

  // Check for escalations
  if (
    emails.some(
      (e) => e.priority === "critical" || e.workflow_state === "ESCALATION",
    )
  ) {
    findings.push("Critical issue escalated");
  }

  return findings;
}

function determineBusinessOutcome(emails: any[], workflow: string): string {
  // Check last few emails for resolution indicators
  const lastEmails = emails.slice(-3);

  if (workflow === "QUOTE_REQUEST") {
    if (lastEmails.some((e) => e.workflow_state === "ORDER_PLACED")) {
      return "Quote converted to order";
    }
    return "Quote provided";
  }

  if (workflow === "ORDER_PLACED") {
    return "Order processed";
  }

  if (workflow === "SUPPORT_INQUIRY") {
    if (
      lastEmails.some((e) =>
        /resolved|fixed|working/i.test(e.body_content || ""),
      )
    ) {
      return "Issue resolved";
    }
    return "Support provided";
  }

  if (workflow === "ESCALATION") {
    return "Escalation handled";
  }

  return "Conversation completed";
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 100;

  try {
    await processPhase3Conversations(limit);
  } catch (error) {
    logger.error("Failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
