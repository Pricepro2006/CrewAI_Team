#!/usr/bin/env tsx

/**
 * Import IEMS Email Batches - FIXED VERSION
 * Imports 6,760 batch files (5 emails each) from IEMS backup directory
 * Based on actual IEMS JSON structure with proper field mapping
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";
import * as fs from "fs/promises";
import { readFileSync } from "fs";
import { createHash } from "crypto";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");
const IEMS_BATCH_DIR =
  "/home/pricepro2006/iems_project/db_backups/email_batches";
const EMAILS_PER_BATCH = 5;

// Actual IEMS email structure from JSON files
interface IEMSEmail {
  MessageID: string;
  Subject: string;
  SenderEmail: string;
  SenderName: string;
  Recipients: string; // JSON string: {"to": [], "cc": []}
  ReceivedTime: string; // ISO format
  FolderPath: string;
  BodyText: string;
  HasAttachments: number; // 0 or 1
  Importance: string;
  MailboxSource: string;
  ThreadID: string;
  ConversationID: string; // Often empty
  BodyHTML?: string;
  IsRead: number; // 0 or 1
  ExtractedAt: string;
  AnalyzedAt?: string;
  SuggestedThemes?: string;
  SuggestedCategory?: string;
  KeyPhrases?: string;
  FullAnalysis?: string;
  IsSynthetic: number;
  workflow_state?: string;
}

interface Recipients {
  to: string[];
  cc: string[];
  bcc?: string[];
}

class IEMSEmailImporter {
  private db: Database.Database;
  private stats = {
    total: 0,
    imported: 0,
    duplicates: 0,
    errors: 0,
    batches: 0,
    conversationIds: new Set<string>(),
  };

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    // Ensure the enhanced schema exists
    this.initializeSchema();
  }

  private initializeSchema() {
    console.log(chalk.cyan("Verifying database schema..."));

    // Check if emails_enhanced table exists
    const tableExists = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='emails_enhanced'
    `,
      )
      .get();

    if (!tableExists) {
      console.log(chalk.red("❌ emails_enhanced table not found!"));
      console.log(chalk.yellow("Please run: npm run create-enhanced-schema"));
      process.exit(1);
    }

    // Check if email_recipients table exists
    const recipientsExists = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='email_recipients'
    `,
      )
      .get();

    if (!recipientsExists) {
      console.log(chalk.red("❌ email_recipients table not found!"));
      console.log(chalk.yellow("Please run: npm run create-enhanced-schema"));
      process.exit(1);
    }

    console.log(chalk.green("✅ Database schema verified"));
  }

  async importAllBatches(testMode = false) {
    console.log(
      chalk.blue.bold("\n📥 Importing IEMS Email Batches - FIXED VERSION\n"),
    );
    console.log(chalk.yellow(`Directory: ${IEMS_BATCH_DIR}`));
    console.log(
      chalk.yellow(
        `Expected: 6,760 files × ${EMAILS_PER_BATCH} emails = 33,800 emails`,
      ),
    );

    if (testMode) {
      console.log(chalk.cyan("🧪 TEST MODE: Processing first 10 files only\n"));
    } else {
      console.log(chalk.green("🚀 PRODUCTION MODE: Processing all files\n"));
    }

    const startTime = Date.now();

    try {
      // Get all batch files
      const files = await fs.readdir(IEMS_BATCH_DIR);
      let batchFiles = files
        .filter(
          (f) =>
            f.startsWith("emails_batch_") &&
            f.endsWith(".json") &&
            !f.includes("Zone.Identifier"),
        )
        .sort((a, b) => {
          const numA = parseInt(
            a.match(/emails_batch_(\d+)\.json/)?.[1] || "0",
          );
          const numB = parseInt(
            b.match(/emails_batch_(\d+)\.json/)?.[1] || "0",
          );
          return numA - numB;
        });

      // Limit for test mode
      if (testMode) {
        batchFiles = batchFiles.slice(0, 10);
      }

      console.log(
        chalk.cyan(`Found ${batchFiles.length} batch files to process\n`),
      );

      // Prepare statements - Fixed for actual schema
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO emails_enhanced (
          id, internet_message_id, subject, body_content, body_preview,
          sender_email, sender_name, created_date_time, received_date_time,
          conversation_id, importance, has_attachments, is_read,
          status, workflow_state, source_file, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          'pending', 'NEW', ?, CURRENT_TIMESTAMP
        )
      `);

      const insertRecipient = this.db.prepare(`
        INSERT OR IGNORE INTO email_recipients (
          email_id, recipient_type, email_address, name
        ) VALUES (?, ?, ?, ?)
      `);

      const checkDuplicate = this.db.prepare(`
        SELECT id FROM emails_enhanced WHERE id = ?
      `);

      // Process batches with transaction boundaries
      const batchSize = 50; // Smaller batches for better error recovery
      for (let i = 0; i < batchFiles.length; i += batchSize) {
        const batch = batchFiles.slice(i, i + batchSize);

        // Use transaction for each batch
        const transaction = this.db.transaction(() => {
          for (const file of batch) {
            try {
              this.processBatchFileSync(
                file,
                insertStmt,
                checkDuplicate,
                insertRecipient,
              );
              this.stats.batches++;
            } catch (error) {
              console.error(
                chalk.red(`Error processing ${file}:`),
                error.message,
              );
              this.stats.errors++;
            }
          }
        });

        try {
          transaction();
        } catch (error) {
          console.error(
            chalk.red(`Transaction failed for batch ${i}-${i + batchSize}:`),
            error.message,
          );
        }

        // Progress update
        if ((i + batchSize) % 500 === 0 || i + batchSize >= batchFiles.length) {
          this.displayProgress(
            Math.min(i + batchSize, batchFiles.length),
            batchFiles.length,
          );
        }
      }

      this.displayFinalResults(startTime);
    } catch (error) {
      console.error(chalk.red("Fatal error:"), error);
      throw error;
    } finally {
      this.db.close();
    }
  }

  private processBatchFileSync(
    filename: string,
    insertStmt: Database.Statement,
    checkDuplicate: Database.Statement,
    insertRecipient: Database.Statement,
  ) {
    const filePath = path.join(IEMS_BATCH_DIR, filename);
    const content = readFileSync(filePath, "utf-8");

    let emails: IEMSEmail[];
    try {
      emails = JSON.parse(content);
      if (!Array.isArray(emails)) {
        emails = [emails]; // Handle single email objects
      }
    } catch (error) {
      console.error(chalk.red(`Invalid JSON in ${filename}`));
      this.stats.errors++;
      return;
    }

    for (const email of emails) {
      this.stats.total++;

      try {
        // Generate consistent ID from MessageID
        const emailId = this.generateEmailId(email.MessageID);

        // Check for duplicate
        const existing = checkDuplicate.get(emailId);
        if (existing) {
          this.stats.duplicates++;
          continue;
        }

        // Parse recipients from JSON string
        const recipients = this.parseRecipientsJson(email.Recipients);

        // Use ThreadID as conversation_id (proper mapping!)
        const conversationId =
          email.ThreadID ||
          this.generateConversationId(email.Subject, email.SenderEmail);

        // Extract body preview
        const bodyPreview = this.extractBodyPreview(email.BodyText);

        // Insert email with proper field mapping
        insertStmt.run(
          emailId, // id
          email.MessageID, // internet_message_id
          email.Subject, // subject
          email.BodyText, // body_content
          bodyPreview, // body_preview
          email.SenderEmail, // sender_email
          email.SenderName || null, // sender_name
          email.ReceivedTime, // created_date_time (using ReceivedTime as fallback)
          email.ReceivedTime, // received_date_time
          conversationId, // conversation_id
          email.Importance || "normal", // importance
          email.HasAttachments ? 1 : 0, // has_attachments
          email.IsRead ? 1 : 0, // is_read
          filename, // source_file
        );

        // Insert recipients (to, cc, bcc)
        this.insertRecipients(emailId, recipients, insertRecipient);

        this.stats.imported++;
        this.stats.conversationIds.add(conversationId);
      } catch (error) {
        console.error(
          chalk.red(`Error importing email ${email.MessageID}:`),
          error.message,
        );
        this.stats.errors++;
      }
    }
  }

  private parseRecipientsJson(recipientsJson: string): Recipients {
    try {
      const parsed = JSON.parse(recipientsJson);
      return {
        to: parsed.to || [],
        cc: parsed.cc || [],
        bcc: parsed.bcc || [],
      };
    } catch (error) {
      console.warn(
        chalk.yellow(`Failed to parse recipients JSON: ${recipientsJson}`),
      );
      return { to: [], cc: [], bcc: [] };
    }
  }

  private insertRecipients(
    emailId: string,
    recipients: Recipients,
    insertRecipient: Database.Statement,
  ) {
    // Insert TO recipients
    for (const email of recipients.to) {
      insertRecipient.run(emailId, "to", email, null);
    }

    // Insert CC recipients
    for (const email of recipients.cc) {
      insertRecipient.run(emailId, "cc", email, null);
    }

    // Insert BCC recipients (if any)
    if (recipients.bcc) {
      for (const email of recipients.bcc) {
        insertRecipient.run(emailId, "bcc", email, null);
      }
    }
  }

  private generateEmailId(messageId: string): string {
    // Generate a shorter, more manageable ID from the long MessageID
    const hash = createHash("sha256").update(messageId).digest("hex");
    return `iems_${hash.substring(0, 16)}`;
  }

  private extractBodyPreview(bodyText: string): string {
    if (!bodyText) return "";

    // Remove HTML tags and extract plain text preview
    const plainText = bodyText
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return plainText.substring(0, 500);
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

    return `iems_conv_${hash.substring(0, 16)}`;
  }

  private displayProgress(current: number, total: number) {
    const percentage = ((current / total) * 100).toFixed(1);
    console.log(
      chalk.cyan(`\n📊 Progress: ${current}/${total} files (${percentage}%)`),
    );
    console.log(`   Imported: ${this.stats.imported.toLocaleString()} emails`);
    console.log(`   Duplicates: ${this.stats.duplicates.toLocaleString()}`);
    console.log(`   Errors: ${this.stats.errors}`);
  }

  private displayFinalResults(startTime: number) {
    const duration = (Date.now() - startTime) / 1000 / 60;

    console.log(chalk.green.bold("\n\n✅ IEMS Import Complete!\n"));
    console.log(chalk.white("📊 Final Results:"));
    console.log(
      chalk.white(
        `   • Batch files processed: ${this.stats.batches.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Total emails found: ${this.stats.total.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Successfully imported: ${this.stats.imported.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Duplicates skipped: ${this.stats.duplicates.toLocaleString()}`,
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
      chalk.white(`   • Import time: ${duration.toFixed(1)} minutes`),
    );

    // Database summary
    const dbStats = this.db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_emails,
        COUNT(DISTINCT conversation_id) as total_conversations,
        COUNT(DISTINCT sender_email) as unique_senders
      FROM emails_enhanced
    `,
      )
      .get() as any;

    console.log(chalk.cyan("\n📊 Database Summary:"));
    console.log(
      chalk.white(
        `   • Total emails now: ${dbStats.total_emails.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Total conversations: ${dbStats.total_conversations.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Unique senders: ${dbStats.unique_senders.toLocaleString()}`,
      ),
    );
  }
}

// Run the importer
async function main() {
  const testMode = process.argv.includes("--test");
  const importer = new IEMSEmailImporter();

  try {
    await importer.importAllBatches(testMode);
  } catch (error) {
    console.error(chalk.red("\n💥 Import failed:"), error);
    process.exit(1);
  }
}

// Execute main function
main().catch(console.error);
