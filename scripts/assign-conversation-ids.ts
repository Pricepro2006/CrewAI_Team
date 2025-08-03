#!/usr/bin/env tsx

/**
 * Assign conversation IDs to emails based on subject similarity
 * Groups emails with similar subjects (ignoring RE:, FW:, etc) into conversations
 */

import Database from "better-sqlite3";
import { createHash } from "crypto";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("ConversationAssigner");
const DB_PATH = "./data/crewai_enhanced.db";

// Patterns to clean subjects for conversation grouping
const SUBJECT_CLEANERS = [
  /^(RE:|FW:|FWD:|Re:|Fw:|Fwd:)\s*/gi,
  /\[.*?\]/g, // Remove bracketed content
  /\s+/g, // Normalize whitespace
];

function cleanSubject(subject: string): string {
  if (!subject) return "";

  let cleaned = subject;
  for (const pattern of SUBJECT_CLEANERS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  return cleaned.trim().toLowerCase();
}

function generateConversationId(cleanedSubject: string): string {
  if (!cleanedSubject)
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create a hash of the cleaned subject
  const hash = createHash("md5").update(cleanedSubject).digest("hex");
  return `conv_${hash.substring(0, 16)}`;
}

async function assignConversationIds() {
  const db = new Database(DB_PATH, { readonly: false });
  db.pragma("foreign_keys = ON");

  logger.info("Starting conversation ID assignment");

  // Get all emails without conversation_id
  const emails = db
    .prepare(
      `
    SELECT id, subject, sender_email, received_date_time
    FROM emails_enhanced
    WHERE conversation_id IS NULL OR conversation_id = ''
    ORDER BY received_date_time ASC
  `,
    )
    .all() as any[];

  logger.info(`Found ${emails.length} emails without conversation IDs`);

  // Group emails by cleaned subject
  const conversationGroups = new Map<string, string>();
  const updateStmt = db.prepare(`
    UPDATE emails_enhanced 
    SET conversation_id = ?, 
        updated_at = datetime('now')
    WHERE id = ?
  `);

  let assigned = 0;
  let uniqueConversations = 0;

  // Process in transaction for performance
  const transaction = db.transaction(() => {
    for (const email of emails) {
      const cleanedSubject = cleanSubject(email.subject || "");

      // Check if we've seen this subject before
      let conversationId = conversationGroups.get(cleanedSubject);

      if (!conversationId) {
        // New conversation
        conversationId = generateConversationId(cleanedSubject);
        conversationGroups.set(cleanedSubject, conversationId);
        uniqueConversations++;
      }

      // Update the email
      updateStmt.run(conversationId, email.id);
      assigned++;

      if (assigned % 1000 === 0) {
        logger.info(`Progress: ${assigned}/${emails.length} emails assigned`);
      }
    }
  });

  transaction();

  // Get final statistics
  const stats = db
    .prepare(
      `
    SELECT 
      COUNT(DISTINCT conversation_id) as total_conversations,
      COUNT(*) as total_emails,
      AVG(email_count) as avg_emails_per_conversation,
      MAX(email_count) as max_emails_in_conversation
    FROM (
      SELECT conversation_id, COUNT(*) as email_count
      FROM emails_enhanced
      WHERE conversation_id IS NOT NULL
      GROUP BY conversation_id
    )
  `,
    )
    .get() as any;

  logger.info(`
=============================
Conversation Assignment Complete
=============================
Emails processed: ${assigned}
Unique conversations: ${uniqueConversations}
Total conversations: ${stats.total_conversations}
Total emails: ${stats.total_emails}
Avg emails per conversation: ${Math.round(stats.avg_emails_per_conversation * 10) / 10}
Max emails in conversation: ${stats.max_emails_in_conversation}
=============================
  `);

  // Show top conversations
  const topConversations = db
    .prepare(
      `
    SELECT 
      conversation_id,
      COUNT(*) as email_count,
      MIN(subject) as sample_subject,
      MIN(received_date_time) as first_email,
      MAX(received_date_time) as last_email
    FROM emails_enhanced
    WHERE conversation_id IS NOT NULL
    GROUP BY conversation_id
    ORDER BY email_count DESC
    LIMIT 10
  `,
    )
    .all() as any[];

  logger.info("\nTop 10 conversations by email count:");
  topConversations.forEach((conv, idx) => {
    logger.info(
      `${idx + 1}. ${conv.conversation_id.substring(0, 16)}... (${conv.email_count} emails)`,
    );
    logger.info(`   Subject: ${conv.sample_subject?.substring(0, 50)}...`);
  });

  db.close();
}

// Main
async function main() {
  try {
    await assignConversationIds();
  } catch (error) {
    logger.error("Failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
