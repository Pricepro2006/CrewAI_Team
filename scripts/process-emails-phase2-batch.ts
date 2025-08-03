#!/usr/bin/env tsx

/**
 * Batch Phase 2 Processing
 * Process Phase 1 complete emails in batches for efficiency
 */

import Database from "better-sqlite3";
import axios from "axios";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("Phase2BatchProcessor");
const DB_PATH = "./data/crewai_enhanced.db";
const OLLAMA_URL = "http://localhost:11434/api/generate";

async function callOllama(prompt: string, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.post(
        OLLAMA_URL,
        {
          model: "qwen3:0.6b", // Use faster model
          prompt,
          format: "json",
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            num_predict: 200, // Limit response size
          },
        },
        {
          timeout: 10000, // 10 seconds
        },
      );

      // Parse response
      try {
        return JSON.parse(response.data.response);
      } catch {
        // Try to extract JSON
        const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      if (i === retries) throw error;
      logger.warn(`Retry ${i + 1} after error: ${error.message}`);
    }
  }
}

async function processPhase2Batch(
  limit: number = 1000,
  batchSize: number = 10,
) {
  const db = new Database(DB_PATH, { readonly: false });
  db.pragma("foreign_keys = ON");

  logger.info(`Starting Phase 2 batch processing...`);

  // Get emails
  const emails = db
    .prepare(
      `
    SELECT id, subject, body_content, sender_email, phase1_result
    FROM emails_enhanced
    WHERE status = 'phase1_complete'
    LIMIT ?
  `,
    )
    .all(limit);

  logger.info(`Processing ${emails.length} emails in batches of ${batchSize}`);

  let processed = 0;
  let succeeded = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchPromises = batch.map(async (email) => {
      try {
        const phase1 = JSON.parse(email.phase1_result || "{}");

        const prompt = `Analyze this business email and return JSON with workflow state.
Subject: ${email.subject || ""}
Body: ${(email.body_content || "").substring(0, 500)}
Entities: ${JSON.stringify(phase1.entities || {})}

Choose ONE workflow_state: QUOTE_REQUEST, ORDER_PLACED, SUPPORT_INQUIRY, INFORMATION, NEGOTIATION, ESCALATION, OTHER
Choose ONE priority: critical, high, medium, low

Return JSON:
{"workflow_state":"","priority":"","action_items":[],"business_impact":"low|medium|high"}`;

        const result = await callOllama(prompt);

        // Update database
        db.prepare(
          `
          UPDATE emails_enhanced 
          SET status = 'phase2_complete',
              phase2_result = ?,
              workflow_state = ?,
              priority = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `,
        ).run(
          JSON.stringify(result),
          result.workflow_state || "OTHER",
          result.priority || "medium",
          email.id,
        );

        succeeded++;
      } catch (error) {
        logger.error(`Failed ${email.id.substring(0, 8)}: ${error.message}`);
        db.prepare(
          `
          UPDATE emails_enhanced 
          SET status = 'phase2_failed',
              updated_at = datetime('now')
          WHERE id = ?
        `,
        ).run(email.id);
      }
      processed++;
    });

    // Wait for batch to complete
    await Promise.all(batchPromises);

    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = succeeded / elapsed;
    logger.info(
      `Batch ${Math.floor(i / batchSize) + 1}: ${processed}/${emails.length} processed (${Math.round(rate * 60)} emails/min)`,
    );
  }

  // Summary
  const totalTime = (Date.now() - startTime) / 1000;
  logger.info(`
=============================
Phase 2 Batch Processing Complete
=============================
Total: ${emails.length}
Succeeded: ${succeeded}
Failed: ${processed - succeeded}
Time: ${Math.round(totalTime)}s
Rate: ${Math.round((succeeded / totalTime) * 60)} emails/minute
=============================
  `);

  db.close();
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 1000;
  const batchSize = parseInt(args[1]) || 10;

  try {
    await processPhase2Batch(limit, batchSize);
  } catch (error) {
    logger.error("Failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
