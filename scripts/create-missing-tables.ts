#!/usr/bin/env tsx

/**
 * Create missing database tables
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import chalk from "chalk";

async function createMissingTables() {
  console.log(chalk.blue.bold("\n📦 Creating missing database tables...\n"));

  const dbManager = getDatabaseManager();
  const db = dbManager.getSQLiteDatabase();

  try {
    // Create action_items table
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS action_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        description TEXT NOT NULL,
        owner TEXT,
        deadline TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `,
    ).run();
    console.log(chalk.green("✓ Created action_items table"));

    // Create workflow_templates table
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id TEXT UNIQUE,
        workflow_type TEXT NOT NULL,
        template_data TEXT,
        email_count INTEGER,
        duration_hours REAL,
        completeness_score REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `,
    ).run();
    console.log(chalk.green("✓ Created workflow_templates table"));

    // Create email_analysis table if missing
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS email_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL UNIQUE,
        analysis_version TEXT,
        phase1_results TEXT,
        phase2_results TEXT,
        phase3_results TEXT,
        final_summary TEXT,
        confidence_score REAL,
        workflow_type TEXT,
        chain_id TEXT,
        is_complete_chain INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `,
    ).run();
    console.log(chalk.green("✓ Created/verified email_analysis table"));

    // Create email_entities table if missing
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS email_entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_value TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        extracted_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email_id, entity_type, entity_value)
      )
    `,
    ).run();
    console.log(chalk.green("✓ Created/verified email_entities table"));

    // Create workflow_summary table
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS workflow_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_date TEXT NOT NULL,
        total_emails INTEGER,
        new_emails INTEGER,
        total_chains INTEGER,
        complete_chains INTEGER,
        incomplete_chains INTEGER,
        emails_processed INTEGER,
        phase3_count INTEGER,
        phase2_only_count INTEGER,
        processing_time_seconds REAL,
        errors INTEGER,
        memory_peak_mb REAL,
        checkpoints_created INTEGER,
        retries INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `,
    ).run();
    console.log(chalk.green("✓ Created/verified workflow_summary table"));

    // Create workflow_type_summary table
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS workflow_type_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_type TEXT UNIQUE,
        template_count INTEGER,
        avg_duration_hours REAL,
        avg_email_count REAL,
        avg_completeness_score REAL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `,
    ).run();
    console.log(chalk.green("✓ Created/verified workflow_type_summary table"));

    // Add columns to emails table if missing
    const columns = [
      { name: "workflow_state", type: "TEXT" },
      { name: "priority", type: 'TEXT DEFAULT "medium"' },
      { name: "confidence_score", type: "REAL" },
      { name: "analyzed_at", type: "TEXT" },
      { name: "chain_completeness_score", type: "REAL" },
    ];

    for (const column of columns) {
      try {
        db.prepare(
          `ALTER TABLE emails ADD COLUMN ${column.name} ${column.type}`,
        ).run();
        console.log(
          chalk.green(`✓ Added column ${column.name} to emails table`),
        );
      } catch (e) {
        // Column already exists
        console.log(
          chalk.yellow(
            `⚠ Column ${column.name} already exists in emails table`,
          ),
        );
      }
    }

    console.log(
      chalk.green.bold("\n✨ All tables created/verified successfully!\n"),
    );
  } catch (error) {
    console.error(chalk.red("\n❌ Error creating tables:"), error);
    throw error;
  }
}

// Run the script
createMissingTables().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
