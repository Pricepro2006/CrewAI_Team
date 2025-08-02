#!/usr/bin/env tsx

/**
 * Import IEMS Email Batches
 * Handles the IEMS email format with ThreadID-based conversation grouping
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";
import * as fs from "fs/promises";
import { createHash } from "crypto";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");
const IEMS_BATCH_DIR =
  "/home/pricepro2006/iems_project/db_backups/email_batches";

interface IEMSEmail {
  MessageID: string;
  Subject: string;
  SenderEmail: string;
  SenderName?: string;
  Recipients: string; // JSON string with to/cc
  ReceivedTime: string;
  FolderPath?: string;
  BodyText?: string;
  BodyHTML?: string;
  HasAttachments: number;
  Importance: string;
  MailboxSource?: string;
  ThreadID?: string;
  ConversationID?: string;
  IsRead?: number;
  ExtractedAt?: string;
  AnalyzedAt?: string;
  workflow_state?: string;
}

class IEMSEmailImporter {
  private db: Database.Database;
  private stats = {
    total: 0,
    imported: 0,
    errors: 0,
    conversationIds: new Set<string>(),
    threadIds: new Set<string>(),
  };

  constructor() {
    this.db = new Database(DB_PATH);
    this.prepareStatements();
  }

  private insertEmailStmt!: Database.Statement;
  private insertRecipientStmt!: Database.Statement;

  private prepareStatements() {
    this.insertEmailStmt = this.db.prepare(`
      INSERT OR REPLACE INTO emails_enhanced (
        id, internet_message_id, conversation_id, subject, body_content,
        body_content_type, body_preview, sender_email, sender_name,
        created_date_time, last_modified_date_time, received_date_time,
        sent_date_time, importance, has_attachments, is_read, is_draft,
        in_reply_to, \`references\`, web_link, parent_folder_id, categories,
        flag_status, status, workflow_state, priority, confidence_score,
        analyzed_at, chain_id, chain_completeness_score, chain_type,
        is_chain_complete, extracted_entities, key_phrases, sentiment_score,
        created_at, updated_at, import_batch, source_file
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    this.insertRecipientStmt = this.db.prepare(`
      INSERT INTO email_recipients (email_id, recipient_type, email_address, name)
      VALUES (?, ?, ?, ?)
    `);
  }

  async importAllBatches(): Promise<void> {
    console.log(chalk.cyan("📥 Importing IEMS Email Batches\n"));

    const files = await fs.readdir(IEMS_BATCH_DIR);
    const jsonFiles = files.filter(
      (f) => f.startsWith("emails_batch_") && f.endsWith(".json"),
    );

    console.log(
      chalk.yellow(
        `Found ${jsonFiles.length} IEMS batch files to process...\n`,
      ),
    );

    // Process in chunks to avoid memory issues
    const chunkSize = 100;
    for (let i = 0; i < jsonFiles.length; i += chunkSize) {
      const chunk = jsonFiles.slice(i, i + chunkSize);
      console.log(
        chalk.gray(
          `Processing batch ${i + 1} to ${Math.min(i + chunkSize, jsonFiles.length)}...`,
        ),
      );

      for (const file of chunk) {
        try {
          const filePath = path.join(IEMS_BATCH_DIR, file);
          const content = await fs.readFile(filePath, "utf-8");
          const emails = JSON.parse(content) as IEMSEmail[];

          this.importBatch(emails, file);

          if ((i + chunk.indexOf(file) + 1) % 100 === 0) {
            console.log(
              chalk.gray(
                `Progress: ${i + chunk.indexOf(file) + 1}/${jsonFiles.length} files`,
              ),
            );
          }
        } catch (error: any) {
          console.error(chalk.red(`Failed to process ${file}:`), error.message);
          this.stats.errors++;
        }
      }
    }

    this.displayStats();
    this.db.close();
  }

  private importBatch(emails: IEMSEmail[], filename: string) {
    const transaction = this.db.transaction((emails: IEMSEmail[]) => {
      for (const email of emails) {
        try {
          // Generate conversation ID from ThreadID or create one
          const conversationId = email.ThreadID
            ? `thread_${createHash("md5").update(email.ThreadID).digest("hex").substring(0, 16)}`
            : `iems_${createHash("md5")
                .update(email.Subject + email.SenderEmail)
                .digest("hex")
                .substring(0, 16)}`;

          // Parse recipients
          let toRecipients: string[] = [];
          let ccRecipients: string[] = [];

          try {
            const recipientData = JSON.parse(email.Recipients);
            toRecipients = recipientData.to || [];
            ccRecipients = recipientData.cc || [];
          } catch {
            // Fallback for non-JSON format
            toRecipients = [email.Recipients];
          }

          // Extract body preview
          const bodyPreview = email.BodyText
            ? email.BodyText.replace(/<[^>]*>/g, "").substring(0, 255)
            : "";

          // Determine content type
          const contentType = email.BodyHTML ? "HTML" : "TEXT";

          // Insert email
          this.insertEmailStmt.run(
            email.MessageID,
            email.MessageID,
            conversationId,
            email.Subject,
            email.BodyText || email.BodyHTML || "",
            contentType,
            bodyPreview,
            email.SenderEmail,
            email.SenderName || null,
            email.ReceivedTime,
            null,
            email.ReceivedTime,
            null,
            email.Importance || "normal",
            email.HasAttachments,
            email.IsRead || 0,
            0,
            null,
            null,
            null,
            email.FolderPath || "inbox",
            null,
            null,
            "imported",
            email.workflow_state || null,
            null,
            null,
            email.AnalyzedAt || null,
            conversationId,
            null,
            null,
            null,
            null,
            null,
            null,
            new Date().toISOString(),
            null,
            "iems_import",
            filename,
          );

          // Insert recipients
          for (const recipient of toRecipients) {
            this.insertRecipientStmt.run(
              email.MessageID,
              "to",
              recipient,
              null,
            );
          }

          for (const recipient of ccRecipients) {
            this.insertRecipientStmt.run(
              email.MessageID,
              "cc",
              recipient,
              null,
            );
          }

          this.stats.imported++;
          this.stats.conversationIds.add(conversationId);
          if (email.ThreadID) {
            this.stats.threadIds.add(email.ThreadID);
          }
        } catch (error: any) {
          console.error(
            chalk.red(`Error importing ${email.MessageID}:`),
            error.message,
          );
          this.stats.errors++;
        }

        this.stats.total++;
      }
    });

    transaction(emails);
  }

  private displayStats() {
    console.log(chalk.green("\n✅ IEMS Import Complete!\n"));
    console.log(chalk.cyan("📊 Results:"));
    console.log(
      `   • Total emails processed: ${chalk.bold(this.stats.total.toLocaleString())}`,
    );
    console.log(
      `   • Successfully imported: ${chalk.bold(this.stats.imported.toLocaleString())}`,
    );
    console.log(
      `   • Errors: ${chalk.red(this.stats.errors.toLocaleString())}`,
    );
    console.log(
      `   • Unique conversations: ${chalk.bold(this.stats.conversationIds.size.toLocaleString())}`,
    );
    console.log(
      `   • Unique threads: ${chalk.bold(this.stats.threadIds.size.toLocaleString())}`,
    );

    // Show total counts in database
    const totalEmails = this.db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
      .get() as any;
    const totalConversations = this.db
      .prepare(
        "SELECT COUNT(DISTINCT conversation_id) as count FROM emails_enhanced",
      )
      .get() as any;

    console.log(chalk.cyan("\n📊 Database Totals:"));
    console.log(
      `   • Total emails in database: ${chalk.bold(totalEmails.count.toLocaleString())}`,
    );
    console.log(
      `   • Total conversations: ${chalk.bold(totalConversations.count.toLocaleString())}`,
    );
  }
}

// Run the importer
async function main() {
  const importer = new IEMSEmailImporter();
  await importer.importAllBatches();
}

main().catch(console.error);
