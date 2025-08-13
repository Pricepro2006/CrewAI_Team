#!/usr/bin/env tsx

/**
 * Create Progress Tracking Table
 * Tracks email processing progress with detailed metrics
 */

import Database from "better-sqlite3";
import chalk from "chalk";

const DB_PATH = "./data/crewai_enhanced.db";

async function createProgressTracking() {
  console.log(chalk.blue.bold("🔧 Creating Progress Tracking System\n"));

  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");

  try {
    // Create progress tracking table
    console.log(chalk.cyan("Creating processing_progress table..."));
    db.exec(`
      CREATE TABLE IF NOT EXISTS processing_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        -- Session info
        session_id TEXT NOT NULL,
        session_start TEXT NOT NULL,
        
        -- Progress metrics
        total_emails INTEGER NOT NULL,
        total_conversations INTEGER NOT NULL,
        emails_processed INTEGER DEFAULT 0,
        conversations_processed INTEGER DEFAULT 0,
        emails_failed INTEGER DEFAULT 0,
        
        -- Processing breakdown
        phase2_only_count INTEGER DEFAULT 0,
        phase3_count INTEGER DEFAULT 0,
        
        -- Performance metrics
        avg_time_per_email REAL,
        emails_per_minute REAL,
        estimated_hours_remaining REAL,
        
        -- Chain analysis
        complete_chains_found INTEGER DEFAULT 0,
        workflow_patterns TEXT, -- JSON object with counts by type
        
        -- Status
        status TEXT DEFAULT 'running', -- running, paused, completed, failed
        last_update TEXT DEFAULT CURRENT_TIMESTAMP,
        
        -- Checkpoint info
        last_conversation_id TEXT,
        last_email_id TEXT,
        
        -- Resource usage
        memory_usage_mb REAL,
        cpu_usage_percent REAL,
        
        -- Metadata
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      );
      
      -- Create detailed progress logs table
      CREATE TABLE IF NOT EXISTS processing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        log_type TEXT NOT NULL, -- 'conversation', 'email', 'error', 'milestone'
        
        -- What was processed
        conversation_id TEXT,
        email_id TEXT,
        
        -- Results
        chain_completeness REAL,
        chain_type TEXT,
        phases_used INTEGER,
        processing_time_ms INTEGER,
        
        -- Error tracking
        error_message TEXT,
        error_phase INTEGER,
        
        -- Timestamp
        logged_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (session_id) REFERENCES processing_progress(session_id)
      );
      
      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_progress_session ON processing_progress(session_id);
      CREATE INDEX IF NOT EXISTS idx_progress_status ON processing_progress(status);
      CREATE INDEX IF NOT EXISTS idx_logs_session ON processing_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_logs_conversation ON processing_logs(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_logs_type ON processing_logs(log_type);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON processing_logs(logged_at);
    `);

    console.log(
      chalk.green("✅ Progress tracking tables created successfully!"),
    );

    // Show table structure
    console.log(chalk.cyan("\nTable structures created:"));

    const tables = ["processing_progress", "processing_logs"];
    tables.forEach((tableName) => {
      console.log(chalk.white(`\n📋 Table: ${tableName}`));
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      columns.forEach((col: any) => {
        console.log(
          `   ${col.name} (${col.type})${col.notnull ? " NOT NULL" : ""}${col.pk ? " PRIMARY KEY" : ""}`,
        );
      });
    });
  } catch (error) {
    console.error(chalk.red("Error creating progress tracking:"), error);
    throw error;
  } finally {
    db.close();
  }
}

// Create helper functions for the processing script to use
export function createProgressTracker(db: Database.Database) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    // Initialize a new session
    startSession(totalEmails: number, totalConversations: number) {
      const stmt = db.prepare(`
        INSERT INTO processing_progress (
          session_id, session_start, total_emails, total_conversations, status
        ) VALUES (?, datetime('now'), ?, ?, 'running')
      `);
      stmt.run(sessionId, totalEmails, totalConversations);
      return sessionId;
    },

    // Log conversation processing
    logConversation(
      conversationId: string,
      emailCount: number,
      chainScore: number,
      chainType: string,
    ) {
      const stmt = db.prepare(`
        INSERT INTO processing_logs (
          session_id, log_type, conversation_id, chain_completeness, chain_type
        ) VALUES (?, 'conversation', ?, ?, ?)
      `);
      stmt.run(sessionId, conversationId, chainScore, chainType);
    },

    // Log email processing
    logEmail(
      emailId: string,
      conversationId: string,
      phases: number,
      timeMs: number,
    ) {
      const stmt = db.prepare(`
        INSERT INTO processing_logs (
          session_id, log_type, email_id, conversation_id, phases_used, processing_time_ms
        ) VALUES (?, 'email', ?, ?, ?, ?)
      `);
      stmt.run(sessionId, emailId, conversationId, phases, timeMs);
    },

    // Log errors
    logError(error: string, emailId?: string, phase?: number) {
      const stmt = db.prepare(`
        INSERT INTO processing_logs (
          session_id, log_type, email_id, error_message, error_phase
        ) VALUES (?, 'error', ?, ?, ?)
      `);
      stmt.run(sessionId, emailId || null, error, phase || null);
    },

    // Update progress metrics
    updateProgress(metrics: {
      emailsProcessed: number;
      conversationsProcessed: number;
      phase2Count: number;
      phase3Count: number;
      avgTimePerEmail: number;
      emailsPerMinute: number;
      completeChains: number;
      workflowPatterns: any;
    }) {
      const stmt = db.prepare(`
        UPDATE processing_progress SET
          emails_processed = ?,
          conversations_processed = ?,
          phase2_only_count = ?,
          phase3_count = ?,
          avg_time_per_email = ?,
          emails_per_minute = ?,
          complete_chains_found = ?,
          workflow_patterns = ?,
          last_update = datetime('now')
        WHERE session_id = ?
      `);
      stmt.run(
        metrics.emailsProcessed,
        metrics.conversationsProcessed,
        metrics.phase2Count,
        metrics.phase3Count,
        metrics.avgTimePerEmail,
        metrics.emailsPerMinute,
        metrics.completeChains,
        JSON.stringify(metrics.workflowPatterns),
        sessionId,
      );
    },

    // Complete session
    completeSession() {
      const stmt = db.prepare(`
        UPDATE processing_progress 
        SET status = 'completed', completed_at = datetime('now')
        WHERE session_id = ?
      `);
      stmt.run(sessionId);
    },
  };
}

// Run if called directly
createProgressTracking().catch(console.error);
