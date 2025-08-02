#!/usr/bin/env tsx

/**
 * Fix Email Schema Column Names
 * Renames sender_email → from_address and graph_id → message_id
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "../data/crewai.db");

async function main() {
  console.log("🔧 Email Schema Fix Script");
  console.log("========================\n");

  // Open database
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");

  try {
    // Check current schema
    console.log("📋 Checking current schema...");
    const columns = db.prepare(`PRAGMA table_info(emails)`).all();
    console.log("Current columns:", columns.map((c: any) => c.name).join(", "));

    // Check if we need to rename columns
    const hasSenderEmail = columns.some((c: any) => c.name === "sender_email");
    const hasFromAddress = columns.some((c: any) => c.name === "from_address");
    const hasGraphId = columns.some((c: any) => c.name === "graph_id");
    const hasMessageId = columns.some((c: any) => c.name === "message_id");

    console.log("\n🔍 Schema analysis:");
    console.log(`  - Has sender_email: ${hasSenderEmail}`);
    console.log(`  - Has from_address: ${hasFromAddress}`);
    console.log(`  - Has graph_id: ${hasGraphId}`);
    console.log(`  - Has message_id: ${hasMessageId}`);

    if (!hasSenderEmail && hasFromAddress && !hasGraphId && hasMessageId) {
      console.log("\n✅ Schema is already correct! No changes needed.");
      return;
    }

    if (hasSenderEmail && !hasFromAddress) {
      console.log("\n🔄 Need to rename sender_email → from_address");
    }

    if (hasGraphId && !hasMessageId) {
      console.log("🔄 Need to rename graph_id → message_id");
    }

    // Count records
    const count = db
      .prepare("SELECT COUNT(*) as count FROM emails")
      .get() as any;
    console.log(`\n📊 Total emails in database: ${count.count}`);

    // Begin transaction
    console.log("\n🚀 Starting schema migration...");

    db.exec("BEGIN TRANSACTION");

    try {
      // Step 1: Create temporary table with new schema
      console.log("1️⃣ Creating temporary table with correct schema...");

      db.exec(`
        CREATE TABLE emails_temp (
          id TEXT PRIMARY KEY,
          message_id TEXT UNIQUE,
          subject TEXT NOT NULL,
          body_text TEXT,
          body_html TEXT,
          from_address TEXT NOT NULL,
          to_addresses TEXT,
          cc_addresses TEXT,
          bcc_addresses TEXT,
          received_time TEXT NOT NULL,
          sent_time TEXT,
          conversation_id TEXT,
          thread_id TEXT,
          in_reply_to TEXT,
          "references" TEXT,
          has_attachments INTEGER DEFAULT 0,
          importance TEXT,
          folder TEXT DEFAULT 'inbox',
          status TEXT DEFAULT 'pending',
          workflow_state TEXT,
          priority TEXT,
          confidence_score REAL,
          analyzed_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          error_message TEXT,
          body_preview TEXT,
          sender_name TEXT,
          categories TEXT,
          raw_content TEXT,
          assignedTo TEXT,
          lastUpdated TEXT,
          is_read INTEGER DEFAULT 0
        )
      `);

      // Step 2: Copy data with column mapping
      console.log("2️⃣ Copying data with column name mapping...");

      // Build dynamic column mapping
      const sourceColumns: string[] = [];
      const targetColumns: string[] = [];

      // Map columns dynamically based on what exists
      const columnMap: Record<string, string> = {
        id: "id",
        graph_id: "message_id",
        message_id: "message_id",
        subject: "subject",
        body_text: "body_text",
        body_html: "body_html",
        body: "body_text",
        sender_email: "from_address",
        from_address: "from_address",
        to_addresses: "to_addresses",
        cc_addresses: "cc_addresses",
        bcc_addresses: "bcc_addresses",
        received_time: "received_time",
        received_at: "received_time", // Map received_at to received_time
        sent_time: "sent_time",
        conversation_id: "conversation_id",
        thread_id: "thread_id",
        in_reply_to: "in_reply_to",
        references: "references",
        has_attachments: "has_attachments",
        importance: "importance",
        folder: "folder",
        status: "status",
        workflow_state: "workflow_state",
        priority: "priority",
        confidence_score: "confidence_score",
        analyzed_at: "analyzed_at",
        created_at: "created_at",
        updated_at: "updated_at",
        error_message: "error_message",
        body_preview: "body_preview",
        sender_name: "sender_name",
        categories: "categories",
        raw_content: "raw_content",
        assignedTo: "assignedTo",
        lastUpdated: "lastUpdated",
        is_read: "is_read",
        received_at: "received_at",
      };

      // Build column lists based on what exists
      columns.forEach((col: any) => {
        const sourceName = col.name;
        const targetName = columnMap[sourceName];
        if (targetName) {
          sourceColumns.push(sourceName);
          targetColumns.push(targetName);
        }
      });

      // Special handling for received_at/received_time
      // The current schema has 'received_at', but new schema needs 'received_time'
      if (
        sourceColumns.includes("received_at") &&
        !targetColumns.includes("received_time")
      ) {
        const idx = sourceColumns.indexOf("received_at");
        targetColumns[idx] = "received_time";
      }

      const insertSQL = `
        INSERT INTO emails_temp (${targetColumns.join(", ")})
        SELECT ${sourceColumns.join(", ")}
        FROM emails
      `;

      console.log(
        "Mapping columns:",
        sourceColumns.length,
        "→",
        targetColumns.length,
      );
      db.exec(insertSQL);

      // Step 3: Drop old table and rename new one
      console.log("3️⃣ Replacing old table with migrated table...");
      db.exec("DROP TABLE emails");
      db.exec("ALTER TABLE emails_temp RENAME TO emails");

      // Step 4: Recreate indexes
      console.log("4️⃣ Recreating indexes...");
      const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id)",
        "CREATE INDEX IF NOT EXISTS idx_emails_from_address ON emails(from_address)",
        "CREATE INDEX IF NOT EXISTS idx_emails_received_time ON emails(received_time)",
        "CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status)",
        "CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id)",
        "CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON emails(conversation_id)",
        "CREATE INDEX IF NOT EXISTS idx_emails_assignedTo ON emails(assignedTo)",
        "CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority)",
      ];

      indexes.forEach((sql) => db.exec(sql));

      // Commit transaction
      db.exec("COMMIT");
      console.log("\n✅ Migration completed successfully!");

      // Verify
      console.log("\n📋 Verifying new schema...");
      const newColumns = db.prepare(`PRAGMA table_info(emails)`).all();
      console.log(
        "New columns:",
        newColumns.map((c: any) => c.name).join(", "),
      );

      const newCount = db
        .prepare("SELECT COUNT(*) as count FROM emails")
        .get() as any;
      console.log(`Total emails after migration: ${newCount.count}`);

      if (count.count === newCount.count) {
        console.log("✅ All records migrated successfully!");
      } else {
        console.warn(
          `⚠️ Record count mismatch: ${count.count} → ${newCount.count}`,
        );
      }
    } catch (error) {
      console.error("\n❌ Migration failed:", error);
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

main().catch(console.error);
