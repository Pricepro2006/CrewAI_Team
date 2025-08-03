#!/usr/bin/env tsx

/**
 * Fast Phase 2 Processing
 * Simple and fast Phase 2 processing using minimal prompts
 */

import Database from "better-sqlite3";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";

const logger = new Logger("Phase2Fast");
const DB_PATH = "./data/crewai_enhanced.db";

// Workflow detection patterns
const WORKFLOW_PATTERNS = {
  QUOTE_REQUEST: [
    /quote/i,
    /pricing/i,
    /cost/i,
    /price list/i,
    /quotation/i,
    /how much/i,
    /estimate/i,
    /proposal/i,
    /rfq/i,
    /rfi/i,
  ],
  ORDER_PLACED: [
    /order/i,
    /purchase/i,
    /po\s*#/i,
    /p\.o\./i,
    /ordered/i,
    /buy/i,
    /buying/i,
    /purchased/i,
    /ship/i,
    /delivery/i,
  ],
  SUPPORT_INQUIRY: [
    /help/i,
    /support/i,
    /issue/i,
    /problem/i,
    /error/i,
    /not working/i,
    /broken/i,
    /fix/i,
    /troubleshoot/i,
    /case\s*#/i,
  ],
  NEGOTIATION: [
    /negotiate/i,
    /discount/i,
    /better price/i,
    /deal/i,
    /special pricing/i,
    /volume discount/i,
    /terms/i,
  ],
  ESCALATION: [
    /urgent/i,
    /asap/i,
    /immediately/i,
    /escalate/i,
    /manager/i,
    /complaint/i,
    /disappointed/i,
    /unacceptable/i,
    /critical/i,
  ],
  INFORMATION: [
    /information/i,
    /details/i,
    /specs/i,
    /specification/i,
    /datasheet/i,
    /manual/i,
    /documentation/i,
    /inquiry/i,
  ],
};

// Priority patterns
const PRIORITY_PATTERNS = {
  critical: [/urgent/i, /asap/i, /critical/i, /emergency/i, /immediately/i],
  high: [/important/i, /priority/i, /soon/i, /quickly/i],
  low: [/fyi/i, /info/i, /no rush/i, /when you can/i],
};

function detectWorkflowState(email: any, phase1: any): string {
  const content =
    `${email.subject || ""} ${email.body_content || ""}`.toLowerCase();

  // Check patterns
  for (const [state, patterns] of Object.entries(WORKFLOW_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(content))) {
      return state;
    }
  }

  // Use Phase 1 hints
  if (phase1.category === "order") return "ORDER_PLACED";
  if (phase1.category === "support") return "SUPPORT_INQUIRY";
  if (phase1.category === "sales") return "QUOTE_REQUEST";

  return "OTHER";
}

function detectPriority(email: any, phase1: any): string {
  const content =
    `${email.subject || ""} ${email.body_content || ""}`.toLowerCase();

  // Check patterns
  for (const [priority, patterns] of Object.entries(PRIORITY_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(content))) {
      return priority;
    }
  }

  // Use Phase 1 priority
  return phase1.priority || "medium";
}

async function processPhase2Fast(limit: number = 10000) {
  const db = new Database(DB_PATH, { readonly: false });
  db.pragma("foreign_keys = ON");

  logger.info("Starting fast Phase 2 processing");

  // Get emails to process
  const emails = db
    .prepare(
      `
    SELECT id, subject, body_content, sender_email, phase1_result
    FROM emails_enhanced
    WHERE status = 'phase1_complete'
    ORDER BY id
    LIMIT ?
  `,
    )
    .all(limit);

  logger.info(`Processing ${emails.length} emails`);

  const startTime = performance.now();
  let processed = 0;
  let succeeded = 0;

  // Process emails
  const updateStmt = db.prepare(`
    UPDATE emails_enhanced 
    SET status = 'phase2_complete',
        phase2_result = ?,
        workflow_state = ?,
        priority = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  for (const email of emails) {
    try {
      const phase1 = JSON.parse(email.phase1_result || "{}");

      // Fast detection
      const workflowState = detectWorkflowState(email, phase1);
      const priority = detectPriority(email, phase1);

      // Determine business impact based on priority
      const businessImpact =
        priority === "critical"
          ? "high"
          : priority === "high"
            ? "medium"
            : "low";

      // Create Phase 2 result
      const phase2Result = {
        workflow_state: workflowState,
        priority: priority,
        action_items: [],
        business_impact: businessImpact,
        detection_method: "pattern_matching",
      };

      // Update database
      updateStmt.run(
        JSON.stringify(phase2Result),
        workflowState,
        priority,
        email.id,
      );

      succeeded++;
      processed++;

      if (processed % 1000 === 0) {
        const elapsed = (performance.now() - startTime) / 1000;
        const rate = processed / elapsed;
        logger.info(
          `Progress: ${processed}/${emails.length} (${Math.round(rate * 60)} emails/min)`,
        );
      }
    } catch (error) {
      processed++;
      logger.error(`Failed ${email.id.substring(0, 8)}: ${error.message}`);
    }
  }

  // Final summary
  const totalTime = (performance.now() - startTime) / 1000;
  const rate = succeeded / totalTime;

  logger.info(`
=============================
Fast Phase 2 Complete
=============================
Total: ${emails.length}
Succeeded: ${succeeded}
Failed: ${processed - succeeded}
Time: ${Math.round(totalTime)}s
Rate: ${Math.round(rate * 60)} emails/minute
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

  // Show workflow distribution
  const workflowCounts = db
    .prepare(
      `
    SELECT workflow_state, COUNT(*) as count 
    FROM emails_enhanced 
    WHERE status = 'phase2_complete'
    GROUP BY workflow_state 
    ORDER BY count DESC
  `,
    )
    .all();

  logger.info("\nWorkflow state distribution:");
  workflowCounts.forEach((row) => {
    logger.info(`${row.workflow_state}: ${row.count}`);
  });

  db.close();
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 10000;

  try {
    await processPhase2Fast(limit);
  } catch (error) {
    logger.error("Failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
