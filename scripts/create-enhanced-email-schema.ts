#!/usr/bin/env tsx

/**
 * Create Enhanced Email Schema
 * Supports full Microsoft Graph API email data structure
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");

async function main() {
  console.log(chalk.blue.bold("\n🔧 Creating Enhanced Email Schema\n"));

  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");

  try {
    // Drop existing tables if they exist
    console.log(chalk.yellow("Dropping existing tables..."));
    db.exec(`
      DROP TABLE IF EXISTS email_attachments;
      DROP TABLE IF EXISTS email_recipients;
      DROP TABLE IF EXISTS emails_enhanced;
    `);

    // Create enhanced emails table
    console.log(chalk.cyan("Creating enhanced emails table..."));
    db.exec(`
      CREATE TABLE emails_enhanced (
        -- Core identifiers
        id TEXT PRIMARY KEY,
        internet_message_id TEXT UNIQUE,
        conversation_id TEXT,
        
        -- Email metadata
        subject TEXT NOT NULL,
        body_content TEXT,
        body_content_type TEXT DEFAULT 'text',
        body_preview TEXT,
        
        -- Sender information
        sender_email TEXT NOT NULL,
        sender_name TEXT,
        
        -- Timestamps (all from Microsoft)
        created_date_time TEXT NOT NULL,
        last_modified_date_time TEXT,
        received_date_time TEXT NOT NULL,
        sent_date_time TEXT,
        
        -- Email properties
        importance TEXT DEFAULT 'normal',
        has_attachments INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 0,
        is_draft INTEGER DEFAULT 0,
        
        -- Threading and references
        in_reply_to TEXT,
        "references" TEXT,
        web_link TEXT,
        
        -- Folder and categories
        parent_folder_id TEXT,
        categories TEXT, -- JSON array
        flag_status TEXT,
        
        -- Analysis fields
        status TEXT DEFAULT 'pending',
        workflow_state TEXT,
        priority TEXT,
        confidence_score REAL,
        analyzed_at TEXT,
        
        -- Chain analysis results
        chain_id TEXT,
        chain_completeness_score REAL,
        chain_type TEXT,
        is_chain_complete INTEGER DEFAULT 0,
        
        -- Extracted entities and insights
        extracted_entities TEXT, -- JSON
        key_phrases TEXT, -- JSON array
        sentiment_score REAL,
        
        -- Audit fields
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        import_batch TEXT,
        source_file TEXT
      );
      
      -- Create recipients table (normalized)
      CREATE TABLE email_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        recipient_type TEXT NOT NULL, -- 'to', 'cc', 'bcc'
        email_address TEXT NOT NULL,
        name TEXT,
        FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
      );
      
      -- Create attachments table
      CREATE TABLE email_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        name TEXT NOT NULL,
        content_type TEXT,
        size INTEGER,
        is_inline INTEGER DEFAULT 0,
        content_id TEXT,
        FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
      );
      
      -- Create indexes for performance
      CREATE INDEX idx_emails_conversation_id ON emails_enhanced(conversation_id);
      CREATE INDEX idx_emails_internet_message_id ON emails_enhanced(internet_message_id);
      CREATE INDEX idx_emails_received_date_time ON emails_enhanced(received_date_time);
      CREATE INDEX idx_emails_sender_email ON emails_enhanced(sender_email);
      CREATE INDEX idx_emails_status ON emails_enhanced(status);
      CREATE INDEX idx_emails_chain_id ON emails_enhanced(chain_id);
      CREATE INDEX idx_emails_workflow_state ON emails_enhanced(workflow_state);
      CREATE INDEX idx_recipients_email_id ON email_recipients(email_id);
      CREATE INDEX idx_attachments_email_id ON email_attachments(email_id);
    `);

    console.log(chalk.green("✅ Enhanced schema created successfully!"));

    // Show table info
    console.log(chalk.cyan("\nTable structure:"));
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all();
    tables.forEach((table: any) => {
      console.log(chalk.white(`\n📋 Table: ${table.name}`));
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
      columns.forEach((col: any) => {
        console.log(
          `   ${col.name} (${col.type})${col.notnull ? " NOT NULL" : ""}${col.pk ? " PRIMARY KEY" : ""}`,
        );
      });
    });
  } catch (error) {
    console.error(chalk.red("Error creating schema:"), error);
    throw error;
  } finally {
    db.close();
  }
}

main().catch(console.error);
