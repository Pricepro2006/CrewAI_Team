#!/usr/bin/env tsx

/**
 * Direct Phase 2 Processing using Ollama
 * Process Phase 1 complete emails directly with LLM
 */

import Database from "better-sqlite3";
import axios from "axios";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("Phase2DirectProcessor");
const DB_PATH = "./data/crewai_enhanced.db";
const OLLAMA_URL = "http://localhost:11434/api/generate";

// Phase 2 prompt template
const PHASE2_PROMPT = `You are analyzing business emails to extract workflow information. Based on the email content and Phase 1 analysis, determine the business workflow state and required actions.

Email Subject: {subject}
From: {sender}
Body: {body}

Phase 1 Analysis:
- Entities: {entities}
- Sentiment: {sentiment}
- Category: {category}
- Priority: {priority}

Analyze this email and provide a JSON response. Choose ONLY ONE workflow state from: QUOTE_REQUEST, ORDER_PLACED, SUPPORT_INQUIRY, INFORMATION, NEGOTIATION, ESCALATION, or OTHER.

Return ONLY valid JSON in this exact format:
{
  "workflow_state": "choose one state from the list above",
  "priority": "choose one: critical, high, medium, or low",
  "action_items": ["specific action needed", "another action if needed"],
  "key_topics": ["main topic discussed", "secondary topic if any"],
  "stakeholders": ["sender name/company", "recipient or mentioned party"],
  "next_steps": "brief description of what should happen next",
  "business_impact": "choose one: low, medium, or high",
  "sla_status": "choose one: on_track, at_risk, overdue, or not_applicable"
}`;

async function processPhase2Direct(limit: number = 100) {
  const db = new Database(DB_PATH, { readonly: false });

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Get Phase 1 complete emails
  const totalPhase1Complete = db
    .prepare(
      `
    SELECT COUNT(*) as count 
    FROM emails_enhanced 
    WHERE status = 'phase1_complete'
  `,
    )
    .get();

  logger.info(`Total Phase 1 complete emails: ${totalPhase1Complete.count}`);

  // Get emails to process
  const emailsToProcess = db
    .prepare(
      `
    SELECT 
      id, 
      subject, 
      body_content, 
      sender_email, 
      received_date_time, 
      conversation_id,
      phase1_result
    FROM emails_enhanced
    WHERE status = 'phase1_complete'
    ORDER BY received_date_time DESC
    LIMIT ?
  `,
    )
    .all(limit);

  logger.info(`Processing ${emailsToProcess.length} emails with Phase 2`);

  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const email of emailsToProcess) {
    try {
      logger.info(
        `Processing email ${processed + 1}/${emailsToProcess.length}: ${email.id.substring(0, 8)}...`,
      );

      // Parse Phase 1 result
      const phase1Result = JSON.parse(email.phase1_result || "{}");

      // Build prompt
      const cleanSubject = (email.subject || "No subject").substring(0, 200);
      const cleanSender = email.sender_email || "Unknown";
      const cleanBody = (email.body_content || "")
        .substring(0, 1000)
        .replace(/\s+/g, " ");
      const entitiesStr = JSON.stringify(phase1Result.entities || {});

      const prompt = PHASE2_PROMPT.replace("{subject}", cleanSubject)
        .replace("{sender}", cleanSender)
        .replace("{body}", cleanBody)
        .replace("{entities}", entitiesStr)
        .replace("{sentiment}", phase1Result.sentiment || "neutral")
        .replace("{category}", phase1Result.category || "general")
        .replace("{priority}", phase1Result.priority || "normal");

      // Call Ollama
      logger.debug("Calling Ollama API...");
      const response = await axios.post(
        OLLAMA_URL,
        {
          model: "llama3.2:3b",
          prompt,
          format: "json",
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            num_predict: 800,
          },
        },
        {
          timeout: 15000, // 15 second timeout
        },
      );

      // Parse response
      let phase2Result;
      try {
        phase2Result = JSON.parse(response.data.response);
      } catch (parseError) {
        // Extract JSON from response
        const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          phase2Result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Failed to extract JSON from response");
        }
      }

      // Update database
      db.prepare(
        `
        UPDATE emails_enhanced 
        SET 
          status = 'phase2_complete',
          phase2_result = ?,
          workflow_state = ?,
          priority = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(
        JSON.stringify(phase2Result),
        phase2Result.workflow_state || "unknown",
        phase2Result.priority || "normal",
        email.id,
      );

      succeeded++;
      processed++;

      if (processed % 10 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = succeeded / elapsed;
        logger.info(
          `Progress: ${processed}/${emailsToProcess.length} (${Math.round(rate * 60)} emails/min)`,
        );
      }
    } catch (error) {
      failed++;
      processed++;
      logger.error(`Failed ${email.id.substring(0, 8)}...: ${error.message}`);

      // Update status to indicate Phase 2 failed
      db.prepare(
        `
        UPDATE emails_enhanced 
        SET 
          status = 'phase2_failed',
          updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(email.id);
    }
  }

  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  const emailsPerMinute = (succeeded / totalTime) * 60;

  logger.info("\n=============================");
  logger.info("Phase 2 Processing Complete");
  logger.info("=============================");
  logger.info(`Total emails: ${emailsToProcess.length}`);
  logger.info(`Succeeded: ${succeeded}`);
  logger.info(`Failed: ${failed}`);
  logger.info(`Total time: ${Math.round(totalTime)} seconds`);
  logger.info(`Rate: ${Math.round(emailsPerMinute)} emails/minute`);

  // Get updated counts
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

  logger.info("\nUpdated email status distribution:");
  statusCounts.forEach((row) => {
    logger.info(`${row.status}: ${row.count}`);
  });

  db.close();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 100;

  logger.info(`Starting Phase 2 direct processing...`);
  logger.info(`Processing limit: ${limit}`);

  try {
    await processPhase2Direct(limit);

    logger.info("\nNext steps:");
    logger.info(
      "1. Process more emails with: npm run process-emails-phase2-direct 1000",
    );
    logger.info("2. Run Phase 3 analysis on complete conversation chains");
    logger.info("3. Process by conversation for workflow detection");
  } catch (error) {
    logger.error("Processing failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
