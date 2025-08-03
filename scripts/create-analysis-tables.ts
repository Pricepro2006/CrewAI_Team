#!/usr/bin/env tsx

/**
 * Create Analysis Tables for Email Processing
 * 
 * Creates the necessary tables for storing Phase 1, 2, and 3 analysis results
 */

import Database from "better-sqlite3";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("CreateAnalysisTables");
const DB_PATH = "./data/crewai_enhanced.db";

function createAnalysisTables() {
  const db = new Database(DB_PATH, { readonly: false });
  
  try {
    // Enable foreign keys
    db.pragma("foreign_keys = ON");
    
    // Create Phase 1 analysis table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS email_analysis_phase1 (
        email_id TEXT PRIMARY KEY,
        entities TEXT,
        sentiment TEXT,
        intent TEXT,
        urgency TEXT,
        category TEXT,
        key_topics TEXT,
        processing_time REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
      )
    `).run();
    logger.info("✅ Created email_analysis_phase1 table");
    
    // Create Phase 2 analysis table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS email_analysis_phase2 (
        email_id TEXT PRIMARY KEY,
        workflow_validation TEXT,
        workflow_state TEXT,
        risk_assessment TEXT,
        initial_response TEXT,
        suggested_response TEXT,
        confidence REAL,
        business_process TEXT,
        priority TEXT,
        processing_time REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
      )
    `).run();
    logger.info("✅ Created email_analysis_phase2 table");
    
    // Create Phase 3 analysis table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS email_analysis_phase3 (
        email_id TEXT PRIMARY KEY,
        strategic_insights TEXT,
        workflow_pattern TEXT,
        business_impact TEXT,
        recommendations TEXT,
        chain_context TEXT,
        processing_time REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
      )
    `).run();
    logger.info("✅ Created email_analysis_phase3 table");
    
    // Create indexes for performance
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_phase1_created 
      ON email_analysis_phase1(created_at)
    `).run();
    
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_phase2_created 
      ON email_analysis_phase2(created_at)
    `).run();
    
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_phase2_workflow 
      ON email_analysis_phase2(workflow_state)
    `).run();
    
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_phase3_created 
      ON email_analysis_phase3(created_at)
    `).run();
    
    logger.info("✅ Created indexes for analysis tables");
    
    // Create chain analysis table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS email_chain_analysis (
        conversation_id TEXT PRIMARY KEY,
        chain_type TEXT,
        completeness_score REAL,
        total_emails INTEGER,
        workflow_detected BOOLEAN,
        workflow_stage TEXT,
        participants TEXT,
        date_range TEXT,
        analysis_version TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    logger.info("✅ Created email_chain_analysis table");
    
    // Create processing metrics table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS processing_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT,
        emails_processed INTEGER,
        processing_time REAL,
        average_time_per_email REAL,
        phase1_count INTEGER,
        phase2_count INTEGER,
        phase3_count INTEGER,
        errors INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    logger.info("✅ Created processing_metrics table");
    
    // Verify tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name LIKE 'email_%' 
      ORDER BY name
    `).all();
    
    logger.info("\n📊 Database tables:");
    tables.forEach(table => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      logger.info(`  - ${table.name}: ${count.count} records`);
    });
    
    // Check foreign key status
    const fkStatus = db.pragma("foreign_keys");
    logger.info(`\n🔗 Foreign keys enabled: ${fkStatus[0].foreign_keys === 1 ? 'Yes' : 'No'}`);
    
    db.close();
    logger.info("\n✅ All analysis tables created successfully!");
    
  } catch (error) {
    logger.error("Failed to create tables:", error);
    db.close();
    process.exit(1);
  }
}

// Run the script
createAnalysisTables();