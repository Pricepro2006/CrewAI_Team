/**
 * Migration: Add pipeline_executions table
 * This table tracks the execution history of the three-stage pipeline
 */

import type { Database } from "better-sqlite3";

export function up(db: Database.Database): void {
  // Create pipeline_executions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at DATETIME NOT NULL,
      completed_at DATETIME,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      stage1_count INTEGER DEFAULT 0,
      stage2_count INTEGER DEFAULT 0,
      stage3_count INTEGER DEFAULT 0,
      total_emails INTEGER DEFAULT 0,
      execution_time_ms INTEGER,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for querying by status
    CREATE INDEX IF NOT EXISTS idx_pipeline_executions_status 
    ON pipeline_executions(status);

    -- Index for querying by date
    CREATE INDEX IF NOT EXISTS idx_pipeline_executions_started_at 
    ON pipeline_executions(started_at);
  `);

  console.log("✅ Created pipeline_executions table");
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_pipeline_executions_started_at;
    DROP INDEX IF EXISTS idx_pipeline_executions_status;
    DROP TABLE IF EXISTS pipeline_executions;
  `);

  console.log("✅ Dropped pipeline_executions table");
}
