#!/usr/bin/env tsx

/**
 * Migrate emails from original crewai.db to enhanced database
 * Preserves all data including raw_content JSON
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";
import { createHash } from "crypto";

const SOURCE_DB = path.join(process.cwd(), "data/crewai.db");
const TARGET_DB = path.join(process.cwd(), "data/crewai_enhanced.db");

interface OriginalEmail {
  id: string;
  message_id: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  from_address: string;
  to_addresses: string;
  cc_addresses?: string;
  bcc_addresses?: string;
  received_time: string;
  sent_time?: string;
  conversation_id?: string;
  thread_id?: string;
  in_reply_to?: string;
  references?: string;
  has_attachments: number;
  importance?: string;
  folder?: string;
  status?: string;
  workflow_state?: string;
  priority?: string;
  confidence_score?: number;
  analyzed_at?: string;
  created_at: string;
  updated_at?: string;
  error_message?: string;
  body_preview?: string;
  sender_name?: string;
  categories?: string;
  raw_content?: string;
  assignedTo?: string;
  lastUpdated?: string;
  is_read?: number;
  received_at?: string;
}

interface RawContent {
  messageId?: string;
  internetMessageId?: string;
  conversationId?: string;
  subject?: string;
  body?: string;
  bodyPreview?: string;
  summary?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  receivedDate?: string;
  sentDate?: string;
  importance?: string;
  workflowState?: string;
  workflowType?: string;
  priority?: string;
  categories?: string[];
  recipients?: Array<{
    type: string;
    name?: string;
    email?: string;
  }>;
  attachments?: Array<{
    name: string;
    contentType?: string;
    size?: number;
  }>;
}

class EmailMigrator {
  private sourceDb: Database.Database;
  private targetDb: Database.Database;
  private stats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    withRawContent: 0,
    conversationIds: new Set<string>(),
  };

  constructor() {
    this.sourceDb = new Database(SOURCE_DB, { readonly: true });
    this.targetDb = new Database(TARGET_DB);
    this.targetDb.pragma("foreign_keys = ON");
  }

  async migrateAll() {
    console.log(
      chalk.blue.bold("\n🔄 Migrating Emails from Original Database\n"),
    );

    const startTime = Date.now();

    try {
      // Get all emails from source
      const emails = this.sourceDb
        .prepare(
          `
        SELECT * FROM emails 
        ORDER BY received_time ASC
      `,
        )
        .all() as OriginalEmail[];

      this.stats.total = emails.length;
      console.log(
        chalk.cyan(
          `Found ${emails.length.toLocaleString()} emails to migrate\n`,
        ),
      );

      // Process in batches
      const batchSize = 1000;
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, Math.min(i + batchSize, emails.length));
        await this.migrateBatch(
          batch,
          i / batchSize + 1,
          Math.ceil(emails.length / batchSize),
        );
      }

      this.displayResults(startTime);
    } catch (error) {
      console.error(chalk.red("Fatal error:"), error);
      throw error;
    } finally {
      this.sourceDb.close();
      this.targetDb.close();
    }
  }

  private async migrateBatch(
    emails: OriginalEmail[],
    batchNum: number,
    totalBatches: number,
  ) {
    console.log(
      chalk.yellow(`Processing batch ${batchNum}/${totalBatches}...`),
    );

    const insertEmail = this.targetDb.prepare(`
      INSERT OR REPLACE INTO emails_enhanced (
        id, internet_message_id, conversation_id,
        subject, body_content, body_content_type, body_preview,
        sender_email, sender_name,
        created_date_time, last_modified_date_time, received_date_time, sent_date_time,
        has_attachments, importance, is_read, is_draft,
        web_link, parent_folder_id, categories, flag_status,
        status, workflow_state, priority, confidence_score, analyzed_at,
        chain_id, chain_completeness_score, chain_type, is_chain_complete,
        extracted_entities, key_phrases, sentiment_score,
        created_at, updated_at, import_batch, source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRecipient = this.targetDb.prepare(`
      INSERT OR IGNORE INTO email_recipients (email_id, recipient_type, email_address, name)
      VALUES (?, ?, ?, ?)
    `);

    const insertAttachment = this.targetDb.prepare(`
      INSERT OR IGNORE INTO email_attachments (email_id, name, content_type, size, is_inline, content_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.targetDb.transaction((emails: OriginalEmail[]) => {
      for (const email of emails) {
        try {
          // Parse raw_content if available
          let rawData: RawContent = {};
          let conversationId = email.conversation_id;
          let internetMessageId = email.message_id;

          if (email.raw_content) {
            try {
              rawData = JSON.parse(email.raw_content);
              this.stats.withRawContent++;

              // Use data from raw_content if available
              if (rawData.conversationId)
                conversationId = rawData.conversationId;
              if (rawData.internetMessageId)
                internetMessageId = rawData.internetMessageId;
            } catch (e) {
              console.warn(`Failed to parse raw_content for ${email.id}`);
            }
          }

          // Generate conversation ID if not present
          if (!conversationId) {
            conversationId = this.generateConversationId(
              email.subject,
              email.from_address,
            );
          }

          // Determine body content type
          const bodyContent =
            email.body_html || email.body_text || rawData.body || "";
          const bodyContentType = email.body_html ? "html" : "text";

          insertEmail.run(
            email.id,
            internetMessageId,
            conversationId,
            email.subject,
            bodyContent,
            bodyContentType,
            email.body_preview ||
              rawData.bodyPreview ||
              bodyContent.substring(0, 255),
            email.from_address,
            email.sender_name || null,
            email.created_at,
            email.updated_at || null,
            email.received_time,
            email.sent_time || rawData.sentDate || null,
            email.has_attachments || (rawData.hasAttachments ? 1 : 0),
            email.importance || rawData.importance || "normal",
            email.is_read || (rawData.isRead ? 1 : 0),
            0, // is_draft
            null, // web_link
            email.folder || null,
            email.categories ||
              (rawData.categories ? JSON.stringify(rawData.categories) : null),
            null, // flag_status
            email.status || "migrated",
            email.workflow_state || rawData.workflowState || null,
            email.priority || rawData.priority || null,
            email.confidence_score || null,
            email.analyzed_at || null,
            email.conversation_id || null, // chain_id
            null, // chain_completeness_score
            rawData.workflowType || null, // chain_type
            0, // is_chain_complete
            null, // extracted_entities
            null, // key_phrases
            null, // sentiment_score
            email.created_at,
            email.updated_at || email.created_at,
            "original-db-migration",
            "crewai.db",
          );

          // Parse and insert recipients
          if (email.to_addresses) {
            const toRecipients = this.parseRecipients(email.to_addresses);
            for (const recipient of toRecipients) {
              insertRecipient.run(
                email.id,
                "to",
                recipient.email,
                recipient.name,
              );
            }
          }

          // Handle recipients from raw_content
          if (rawData.recipients) {
            for (const recipient of rawData.recipients) {
              if (recipient.email) {
                insertRecipient.run(
                  email.id,
                  recipient.type || "to",
                  recipient.email,
                  recipient.name || null,
                );
              }
            }
          }

          // Handle CC addresses
          if (email.cc_addresses) {
            const ccRecipients = this.parseRecipients(email.cc_addresses);
            for (const recipient of ccRecipients) {
              insertRecipient.run(
                email.id,
                "cc",
                recipient.email,
                recipient.name,
              );
            }
          }

          // Handle attachments from raw_content
          if (rawData.attachments) {
            for (const attachment of rawData.attachments) {
              insertAttachment.run(
                email.id,
                attachment.name,
                attachment.contentType || null,
                attachment.size || null,
                0, // is_inline
                null, // content_id
              );
            }
          }

          this.stats.migrated++;
          if (conversationId) {
            this.stats.conversationIds.add(conversationId);
          }
        } catch (error) {
          console.error(
            chalk.red(`Error migrating ${email.id}:`),
            error.message,
          );
          this.stats.errors++;
        }
      }
    });

    transaction(emails);
  }

  private parseRecipients(
    recipientString: string,
  ): Array<{ email: string; name: string | null }> {
    if (!recipientString) return [];

    const recipients: Array<{ email: string; name: string | null }> = [];

    try {
      // Handle JSON array format
      if (recipientString.startsWith("[")) {
        const parsed = JSON.parse(recipientString);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === "string") {
              recipients.push({ email: item, name: null });
            } else if (item.email || item.address) {
              recipients.push({
                email: item.email || item.address,
                name: item.name || null,
              });
            }
          }
          return recipients;
        }
      }
    } catch (e) {
      // Fall through to comma-separated parsing
    }

    // Handle comma-separated format
    const parts = recipientString
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      // Check if it has name and email format: "Name <email>"
      const match = part.match(/^(.+?)\s*<(.+?)>$/);
      if (match) {
        recipients.push({ email: match[2], name: match[1].trim() });
      } else {
        recipients.push({ email: part, name: null });
      }
    }

    return recipients;
  }

  private generateConversationId(subject: string, sender: string): string {
    // Clean subject for conversation grouping
    const cleanSubject = subject
      .toLowerCase()
      .replace(/^(re:|fw:|fwd:)\\s*/gi, "")
      .replace(/^\\[.*?\\]\\s*/, "")
      .trim();

    // Generate stable conversation ID
    const hash = createHash("md5")
      .update(cleanSubject)
      .update(sender.toLowerCase())
      .digest("hex");

    return `conv_${hash.substring(0, 16)}`;
  }

  private displayResults(startTime: number) {
    const duration = (Date.now() - startTime) / 1000;

    console.log(chalk.green.bold("\n\n✅ Migration Complete!\n"));
    console.log(chalk.white("📊 Results:"));
    console.log(
      chalk.white(
        `   • Total emails in source: ${this.stats.total.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Successfully migrated: ${this.stats.migrated.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(`   • Errors: ${this.stats.errors.toLocaleString()}`),
    );
    console.log(
      chalk.white(
        `   • With raw content: ${this.stats.withRawContent.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Unique conversations: ${this.stats.conversationIds.size.toLocaleString()}`,
      ),
    );
    console.log(chalk.white(`   • Migration time: ${duration.toFixed(1)}s`));

    // Verify migration
    console.log(chalk.cyan("\n📋 Verification:"));

    const targetCount = this.targetDb
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
      .get() as { count: number };

    console.log(
      chalk.white(
        `   • Emails in target DB: ${targetCount.count.toLocaleString()}`,
      ),
    );

    const recipientCount = this.targetDb
      .prepare("SELECT COUNT(*) as count FROM email_recipients")
      .get() as { count: number };

    console.log(
      chalk.white(
        `   • Recipients stored: ${recipientCount.count.toLocaleString()}`,
      ),
    );
  }
}

// Run the migrator
async function main() {
  const migrator = new EmailMigrator();
  await migrator.migrateAll();
}

main().catch(console.error);
