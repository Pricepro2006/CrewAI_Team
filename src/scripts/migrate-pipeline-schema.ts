#!/usr/bin/env tsx
/**
 * Migration script to add pipeline columns to email_analysis table
 */

import Database from "better-sqlite3";
import { logger } from "../utils/logger";
import path from "path";

function migratePipelineSchema() {
  const dbPath = path.join(process.cwd(), "data", "app.db");
  const db = new Database(dbPath);

  logger.info("Starting pipeline schema migration...", "MIGRATION");

  try {
    // Begin transaction
    db.prepare("BEGIN").run();

    // Check if columns already exist
    const tableInfo = db
      .prepare("PRAGMA table_info(email_analysis)")
      .all() as any[];
    const columnNames = tableInfo.map((col) => col.name);

    const columnsToAdd = [
      { name: "pipeline_stage", type: "INTEGER" },
      { name: "pipeline_priority_score", type: "REAL" },
      { name: "llama_analysis", type: "TEXT" },
      { name: "phi4_analysis", type: "TEXT" },
      { name: "final_model_used", type: "TEXT" },
      { name: "analysis_timestamp", type: "TEXT" },
    ];

    let addedColumns = 0;

    for (const column of columnsToAdd) {
      if (!columnNames.includes(column.name)) {
        logger.info(`Adding column ${column.name}...`, "MIGRATION");
        db.prepare(
          `ALTER TABLE email_analysis ADD COLUMN ${column.name} ${column.type}`,
        ).run();
        addedColumns++;
      } else {
        logger.info(
          `Column ${column.name} already exists, skipping...`,
          "MIGRATION",
        );
      }
    }

    // Create indexes for better performance
    const indexesToCreate = [
      {
        name: "idx_email_analysis_pipeline",
        sql: "CREATE INDEX IF NOT EXISTS idx_email_analysis_pipeline ON email_analysis(pipeline_stage, pipeline_priority_score)",
      },
      {
        name: "idx_email_analysis_model",
        sql: "CREATE INDEX IF NOT EXISTS idx_email_analysis_model ON email_analysis(final_model_used)",
      },
      {
        name: "idx_email_analysis_timestamp",
        sql: "CREATE INDEX IF NOT EXISTS idx_email_analysis_timestamp ON email_analysis(analysis_timestamp)",
      },
    ];

    for (const index of indexesToCreate) {
      logger.info(`Creating index ${index.name}...`, "MIGRATION");
      db.prepare(index.sql).run();
    }

    // Create stage_results table if it doesn't exist
    logger.info("Creating stage_results table...", "MIGRATION");
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS stage_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        stage INTEGER NOT NULL,
        priority_score REAL,
        processing_time_ms INTEGER,
        result_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email_id, stage)
      )
    `,
    ).run();

    // Commit transaction
    db.prepare("COMMIT").run();

    logger.info(
      `Migration completed successfully! Added ${addedColumns} columns.`,
      "MIGRATION",
    );

    // Verify the schema
    const newTableInfo = db
      .prepare("PRAGMA table_info(email_analysis)")
      .all() as any[];
    const pipelineColumns = newTableInfo.filter(
      (col) =>
        col.name.includes("pipeline") ||
        col.name.includes("llama") ||
        col.name.includes("phi4"),
    );

    logger.info(`Pipeline columns in email_analysis table:`, "MIGRATION", {
      columns: pipelineColumns.map((col) => col.name),
    });
  } catch (error) {
    logger.error("Migration failed", "MIGRATION", {}, error as Error);
    db.prepare("ROLLBACK").run();
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
migratePipelineSchema();
