#!/usr/bin/env tsx
/**
 * Create/Update Workflow Tasks Schema
 * Ensures database has proper structure for workflow intelligence
 */

import Database from "better-sqlite3";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWorkflowSchema() {
  console.log("📊 Creating Workflow Tasks Schema...\n");

  const db = new Database("./data/crewai.db");

  try {
    // Create workflow_tasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_tasks (
        task_id TEXT PRIMARY KEY,
        email_id TEXT NOT NULL,
        conversation_id TEXT,
        
        -- Workflow Classification
        workflow_category TEXT NOT NULL,
        workflow_state TEXT NOT NULL CHECK (workflow_state IN ('START_POINT', 'IN_PROGRESS', 'COMPLETION')),
        task_status TEXT NOT NULL CHECK (task_status IN ('RED', 'YELLOW', 'GREEN', 'COMPLETED')),
        
        -- Task Details
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL')),
        
        -- Ownership
        current_owner TEXT,
        owner_email TEXT,
        assigned_date TEXT,
        
        -- Entities
        po_numbers TEXT,
        quote_numbers TEXT,
        case_numbers TEXT,
        customers TEXT,
        dollar_value REAL DEFAULT 0,
        
        -- Tracking
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sla_deadline TEXT,
        completion_date TEXT,
        
        -- Grouping
        mailbox_source TEXT,
        category TEXT,
        group_name TEXT,
        
        -- Analysis Metadata
        analysis_phases TEXT,
        confidence_score REAL DEFAULT 0.0,
        processing_time REAL DEFAULT 0.0,
        full_analysis TEXT,
        
        -- Indexes for performance
        FOREIGN KEY (email_id) REFERENCES emails(id)
      )
    `);

    // Create indexes for common queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_tasks(task_status);
      CREATE INDEX IF NOT EXISTS idx_workflow_category ON workflow_tasks(workflow_category);
      CREATE INDEX IF NOT EXISTS idx_workflow_state ON workflow_tasks(workflow_state);
      CREATE INDEX IF NOT EXISTS idx_priority ON workflow_tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_owner ON workflow_tasks(current_owner);
      CREATE INDEX IF NOT EXISTS idx_created ON workflow_tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_sla ON workflow_tasks(sla_deadline);
      CREATE INDEX IF NOT EXISTS idx_dollar_value ON workflow_tasks(dollar_value);
    `);

    console.log("✅ Workflow tasks table created/verified");

    // Create workflow_status_history table for tracking changes
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        old_owner TEXT,
        new_owner TEXT,
        changed_by TEXT,
        change_reason TEXT,
        changed_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES workflow_tasks(task_id)
      )
    `);

    console.log("✅ Workflow status history table created/verified");

    // Create workflow_metrics view for dashboard
    db.exec(`
      CREATE VIEW IF NOT EXISTS workflow_metrics AS
      SELECT 
        workflow_category,
        task_status,
        COUNT(*) as count,
        AVG(dollar_value) as avg_dollar_value,
        SUM(dollar_value) as total_dollar_value,
        AVG(confidence_score) as avg_confidence,
        AVG(processing_time) as avg_processing_time
      FROM workflow_tasks
      GROUP BY workflow_category, task_status
    `);

    console.log("✅ Workflow metrics view created/verified");

    // Create daily_workflow_summary view
    db.exec(`
      CREATE VIEW IF NOT EXISTS daily_workflow_summary AS
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as red_count,
        SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) as yellow_count,
        SUM(CASE WHEN task_status = 'GREEN' THEN 1 ELSE 0 END) as green_count,
        SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
        SUM(dollar_value) as total_value,
        COUNT(DISTINCT current_owner) as unique_owners
      FROM workflow_tasks
      GROUP BY DATE(created_at)
    `);

    console.log("✅ Daily workflow summary view created/verified");

    // Check current schema
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `,
      )
      .all();

    console.log("\n📋 Current database tables:");
    tables.forEach((table: any) => {
      console.log(`   - ${table.name}`);
    });

    // Get workflow_tasks schema info
    const columns = db
      .prepare(
        `
      PRAGMA table_info(workflow_tasks)
    `,
      )
      .all();

    console.log("\n📊 Workflow tasks columns:");
    columns.forEach((col: any) => {
      console.log(`   - ${col.name} (${col.type})`);
    });

    // Check if we have any existing workflow data
    const workflowCount = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM workflow_tasks
    `,
      )
      .get() as any;

    console.log(`\n📈 Existing workflow tasks: ${workflowCount.count}`);

    if (workflowCount.count > 0) {
      const statusBreakdown = db
        .prepare(
          `
        SELECT 
          task_status,
          COUNT(*) as count
        FROM workflow_tasks
        GROUP BY task_status
      `,
        )
        .all();

      console.log("\n🚦 Status breakdown:");
      statusBreakdown.forEach((status: any) => {
        const emoji =
          {
            RED: "🔴",
            YELLOW: "🟡",
            GREEN: "🟢",
            COMPLETED: "✅",
          }[status.task_status] || "❓";
        console.log(`   ${emoji} ${status.task_status}: ${status.count}`);
      });
    }

    console.log("\n✅ Database schema ready for workflow intelligence!");
  } catch (error) {
    console.error("❌ Error creating schema:", error);
    throw error;
  } finally {
    db.close();
  }
}

// Run schema creation
createWorkflowSchema();
