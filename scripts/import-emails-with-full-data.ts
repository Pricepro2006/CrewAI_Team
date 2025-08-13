#!/usr/bin/env tsx

/**
 * Import Emails with Full Data Preservation
 * Handles both simplified and Microsoft Graph API formats
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";
import * as fs from "fs/promises";
import { createHash } from "crypto";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");

interface SimplifiedEmail {
  id: string;
  graph_id?: string | null;
  subject: string;
  body: string;
  body_preview?: string;
  sender_email: string;
  sender_name?: string;
  to_addresses: string; // JSON string array
  received_at: string;
  has_attachments?: number;
  importance?: string;
}

interface MicrosoftGraphEmail {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject: string;
  body: {
    contentType: string;
    content: string;
  };
  bodyPreview?: string;
  from: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  bccRecipients?: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  createdDateTime: string;
  lastModifiedDateTime?: string;
  receivedDateTime: string;
  sentDateTime?: string;
  hasAttachments: boolean;
  importance: string;
  isRead?: boolean;
  isDraft?: boolean;
  webLink?: string;
  parentFolderId?: string;
  categories?: string[];
  flag?: {
    flagStatus: string;
  };
  attachments?: Array<{
    name: string;
    contentType?: string;
    size?: number;
    isInline?: boolean;
    contentId?: string;
  }>;
}

class EmailImporter {
  private db: Database.Database;
  private stats = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    conversationIds: new Set<string>(),
    batchTypes: {
      simplified: 0,
      microsoftGraph: 0,
    },
  };

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("foreign_keys = ON");
  }

  async importAllBatches() {
    console.log(
      chalk.blue.bold(
        "\n📥 Importing All Email Batches with Full Data Preservation\n",
      ),
    );

    const startTime = Date.now();

    try {
      // Import May-July batches (simplified format)
      await this.importSimplifiedBatches();

      // Import missing-emails batches (Microsoft Graph format)
      await this.importMicrosoftGraphBatches();

      // Display results
      this.displayResults(startTime);
    } catch (error) {
      console.error(chalk.red("Fatal error:"), error);
      throw error;
    } finally {
      this.db.close();
    }
  }

  private async importSimplifiedBatches() {
    console.log(
      chalk.yellow("\n📁 Processing May-July batches (simplified format)...\n"),
    );

    const batchPath = path.join(
      process.cwd(),
      "data/email-batches/may-july-2025",
    );
    const files = await fs.readdir(batchPath);
    const jsonFiles = files
      .filter((f) => f.endsWith(".json") && f.includes("batch"))
      .sort();

    for (const file of jsonFiles) {
      console.log(chalk.gray(`Processing ${file}...`));
      const filePath = path.join(batchPath, file);
      const content = await fs.readFile(filePath, "utf-8");
      const emails = JSON.parse(content) as SimplifiedEmail[];

      await this.importSimplifiedBatch(emails, file);
      this.stats.batchTypes.simplified++;
    }
  }

  private async importMicrosoftGraphBatches() {
    console.log(
      chalk.yellow(
        "\n📁 Processing missing-emails batches (Microsoft Graph format)...\n",
      ),
    );

    const batchPath = path.join(
      process.cwd(),
      "data/email-batches/missing-emails",
    );
    const files = await fs.readdir(batchPath);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

    for (const file of jsonFiles) {
      console.log(chalk.gray(`Processing ${file}...`));
      const filePath = path.join(batchPath, file);
      const content = await fs.readFile(filePath, "utf-8");
      const batch = JSON.parse(content);

      if (batch.emails) {
        await this.importMicrosoftGraphBatch(batch.emails, file);
      }
      this.stats.batchTypes.microsoftGraph++;
    }
  }

  private async importSimplifiedBatch(
    emails: SimplifiedEmail[],
    sourceFile: string,
  ) {
    const insertEmail = this.db.prepare(`
      INSERT OR REPLACE INTO emails_enhanced (
        id, internet_message_id, conversation_id,
        subject, body_content, body_content_type, body_preview,
        sender_email, sender_name,
        created_date_time, received_date_time,
        has_attachments, importance,
        import_batch, source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRecipient = this.db.prepare(`
      INSERT INTO email_recipients (email_id, recipient_type, email_address, name)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((emails: SimplifiedEmail[]) => {
      for (const email of emails) {
        try {
          // Generate conversation ID from subject if not present
          const conversationId = this.generateConversationId(
            email.subject,
            email.sender_email,
          );

          insertEmail.run(
            email.id,
            email.graph_id || null,
            conversationId,
            email.subject,
            email.body,
            "text",
            email.body_preview || email.body.substring(0, 255),
            email.sender_email,
            email.sender_name || null,
            email.received_at,
            email.received_at,
            email.has_attachments || 0,
            email.importance || "normal",
            "simplified-import",
            sourceFile,
          );

          // Parse and insert recipients
          if (email.to_addresses) {
            const recipients = this.parseSimplifiedRecipients(
              email.to_addresses,
            );
            for (const recipient of recipients) {
              insertRecipient.run(email.id, "to", recipient, null);
            }
          }

          this.stats.imported++;
          this.stats.conversationIds.add(conversationId);
        } catch (error) {
          console.error(
            chalk.red(`Error importing ${email.id}:`),
            error.message,
          );
          this.stats.errors++;
        }

        this.stats.total++;
      }
    });

    transaction(emails);
  }

  private async importMicrosoftGraphBatch(
    emails: MicrosoftGraphEmail[],
    sourceFile: string,
  ) {
    const insertEmail = this.db.prepare(`
      INSERT OR REPLACE INTO emails_enhanced (
        id, internet_message_id, conversation_id,
        subject, body_content, body_content_type, body_preview,
        sender_email, sender_name,
        created_date_time, last_modified_date_time, received_date_time, sent_date_time,
        has_attachments, importance, is_read, is_draft,
        web_link, parent_folder_id, categories, flag_status,
        import_batch, source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRecipient = this.db.prepare(`
      INSERT INTO email_recipients (email_id, recipient_type, email_address, name)
      VALUES (?, ?, ?, ?)
    `);

    const insertAttachment = this.db.prepare(`
      INSERT INTO email_attachments (email_id, name, content_type, size, is_inline, content_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((emails: MicrosoftGraphEmail[]) => {
      for (const email of emails) {
        try {
          insertEmail.run(
            email.id,
            email.internetMessageId || null,
            email.conversationId ||
              this.generateConversationId(
                email.subject,
                email.from.emailAddress.address,
              ),
            email.subject,
            email.body.content,
            email.body.contentType,
            email.bodyPreview || email.body.content.substring(0, 255),
            email.from.emailAddress.address,
            email.from.emailAddress.name || null,
            email.createdDateTime,
            email.lastModifiedDateTime || null,
            email.receivedDateTime,
            email.sentDateTime || null,
            email.hasAttachments ? 1 : 0,
            email.importance,
            email.isRead ? 1 : 0,
            email.isDraft ? 1 : 0,
            email.webLink || null,
            email.parentFolderId || null,
            email.categories ? JSON.stringify(email.categories) : null,
            email.flag?.flagStatus || null,
            "microsoft-graph-import",
            sourceFile,
          );

          // Insert recipients
          for (const recipient of email.toRecipients || []) {
            insertRecipient.run(
              email.id,
              "to",
              recipient.emailAddress.address,
              recipient.emailAddress.name || null,
            );
          }

          for (const recipient of email.ccRecipients || []) {
            insertRecipient.run(
              email.id,
              "cc",
              recipient.emailAddress.address,
              recipient.emailAddress.name || null,
            );
          }

          for (const recipient of email.bccRecipients || []) {
            insertRecipient.run(
              email.id,
              "bcc",
              recipient.emailAddress.address,
              recipient.emailAddress.name || null,
            );
          }

          // Insert attachments
          for (const attachment of email.attachments || []) {
            insertAttachment.run(
              email.id,
              attachment.name,
              attachment.contentType || null,
              attachment.size || null,
              attachment.isInline ? 1 : 0,
              attachment.contentId || null,
            );
          }

          this.stats.imported++;
          if (email.conversationId) {
            this.stats.conversationIds.add(email.conversationId);
          }
        } catch (error) {
          console.error(
            chalk.red(`Error importing ${email.id}:`),
            error.message,
          );
          this.stats.errors++;
        }

        this.stats.total++;
      }
    });

    transaction(emails);
  }

  private parseSimplifiedRecipients(toAddresses: string): string[] {
    if (!toAddresses) return [];

    try {
      // Handle JSON array format
      if (toAddresses.startsWith("[")) {
        const parsed = JSON.parse(toAddresses);
        if (Array.isArray(parsed)) {
          return parsed
            .map((addr) => {
              if (typeof addr === "string") return addr;
              if (addr.email) return addr.email;
              if (addr.address) return addr.address;
              return "";
            })
            .filter(Boolean);
        }
      }

      // Handle comma-separated format
      return toAddresses
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } catch (error) {
      console.warn("Failed to parse recipients:", toAddresses);
      return [toAddresses];
    }
  }

  private generateConversationId(subject: string, sender: string): string {
    // Clean subject for conversation grouping
    const cleanSubject = subject
      .toLowerCase()
      .replace(/^(re:|fw:|fwd:)\s*/gi, "")
      .replace(/^\[.*?\]\s*/, "")
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

    console.log(chalk.green.bold("\n\n✅ Import Complete!\n"));
    console.log(chalk.white("📊 Results:"));
    console.log(
      chalk.white(
        `   • Total emails processed: ${this.stats.total.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Successfully imported: ${this.stats.imported.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(`   • Errors: ${this.stats.errors.toLocaleString()}`),
    );
    console.log(
      chalk.white(
        `   • Unique conversations: ${this.stats.conversationIds.size.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Simplified batches: ${this.stats.batchTypes.simplified}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Microsoft Graph batches: ${this.stats.batchTypes.microsoftGraph}`,
      ),
    );
    console.log(chalk.white(`   • Import time: ${duration.toFixed(1)}s`));

    // Show sample data
    console.log(chalk.cyan("\n📋 Sample imported data:"));

    const samples = this.db
      .prepare(
        `
      SELECT 
        e.conversation_id,
        COUNT(*) as email_count,
        MIN(e.subject) as sample_subject,
        GROUP_CONCAT(DISTINCT e.sender_email) as participants
      FROM emails_enhanced e
      GROUP BY e.conversation_id
      HAVING email_count > 1
      ORDER BY email_count DESC
      LIMIT 5
    `,
      )
      .all();

    samples.forEach((sample: any) => {
      console.log(chalk.gray(`\n   Conversation: ${sample.conversation_id}`));
      console.log(`     Emails: ${sample.email_count}`);
      console.log(`     Subject: ${sample.sample_subject.substring(0, 50)}...`);
      console.log(`     Participants: ${sample.participants}`);
    });
  }
}

// Run the importer
async function main() {
  const importer = new EmailImporter();
  await importer.importAllBatches();
}

main().catch(console.error);
