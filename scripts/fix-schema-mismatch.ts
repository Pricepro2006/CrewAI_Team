#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import { logger } from '../src/utils/logger.js';

const ENHANCED_DB_PATH = './data/crewai_enhanced.db';

function fixSchemaMismatch() {
  const db = new Database(ENHANCED_DB_PATH);
  db.pragma('journal_mode = WAL');
  
  try {
    logger.info('Starting schema fix for enhanced database...');
    
    // 1. Add missing columns that EmailRepository expects
    const tableInfo = db.prepare('PRAGMA table_info(emails_enhanced)').all();
    const columnNames = tableInfo.map((col: any) => col.name);
    
    // Add graph_id if missing
    if (!columnNames.includes('graph_id')) {
      logger.info('Adding graph_id column...');
      db.exec('ALTER TABLE emails_enhanced ADD COLUMN graph_id TEXT');
    }
    
    // Add message_id as alias for internet_message_id if missing
    if (!columnNames.includes('message_id')) {
      logger.info('Adding message_id column as copy of internet_message_id...');
      db.exec('ALTER TABLE emails_enhanced ADD COLUMN message_id TEXT');
      db.exec('UPDATE emails_enhanced SET message_id = internet_message_id');
    }
    
    // Add workflow_state if missing (EmailRepository expects this)
    if (!columnNames.includes('workflow_state')) {
      logger.info('Adding workflow_state column...');
      db.exec('ALTER TABLE emails_enhanced ADD COLUMN workflow_state TEXT DEFAULT \'pending\'');
    }
    
    // Add category if missing
    if (!columnNames.includes('category')) {
      logger.info('Adding category column...');
      db.exec('ALTER TABLE emails_enhanced ADD COLUMN category TEXT');
    }
    
    // Add sentiment if missing
    if (!columnNames.includes('sentiment')) {
      logger.info('Adding sentiment column...');
      db.exec('ALTER TABLE emails_enhanced ADD COLUMN sentiment TEXT');
    }
    
    // Add importance_score if missing
    if (!columnNames.includes('importance_score')) {
      logger.info('Adding importance_score column...');
      db.exec('ALTER TABLE emails_enhanced ADD COLUMN importance_score INTEGER DEFAULT 0');
    }
    
    // 2. Create indexes that EmailRepository expects
    logger.info('Creating indexes...');
    
    // Create indexes safely (ignore if already exists)
    const createIndexSafely = (sql: string) => {
      try {
        db.exec(sql);
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    };
    
    createIndexSafely('CREATE INDEX idx_emails_enhanced_message_id ON emails_enhanced(message_id)');
    createIndexSafely('CREATE INDEX idx_emails_enhanced_graph_id ON emails_enhanced(graph_id)');
    createIndexSafely('CREATE INDEX idx_emails_enhanced_workflow_state ON emails_enhanced(workflow_state)');
    createIndexSafely('CREATE INDEX idx_emails_enhanced_category ON emails_enhanced(category)');
    createIndexSafely('CREATE INDEX idx_emails_enhanced_sentiment ON emails_enhanced(sentiment)');
    createIndexSafely('CREATE INDEX idx_emails_enhanced_importance_score ON emails_enhanced(importance_score)');
    createIndexSafely('CREATE INDEX idx_emails_enhanced_sender_received ON emails_enhanced(sender_email, received_date_time)');
    
    // 3. Create email_analysis view that maps enhanced columns to expected names
    logger.info('Creating compatibility view...');
    
    db.exec(`
      DROP VIEW IF EXISTS email_analysis;
      CREATE VIEW email_analysis AS
      SELECT 
        id,
        internet_message_id as message_id,
        subject,
        sender_email,
        sender_name,
        recipient_emails,
        received_date_time,
        body_text,
        has_attachments,
        attachment_names,
        category,
        sentiment,
        summary,
        key_points,
        action_items,
        importance_score,
        workflow_state,
        confidence_score,
        phase2_processing_status,
        phase2_processed_at,
        phase3_insights,
        phase3_processing_status,
        phase3_processed_at,
        thread_id,
        workflow_stage,
        created_at,
        updated_at
      FROM emails_enhanced;
    `);
    
    // 4. Verify the fix
    const testQuery = db.prepare('SELECT COUNT(*) as count FROM emails_enhanced WHERE message_id IS NOT NULL').get() as any;
    logger.info(`Successfully updated ${testQuery.count} emails with message_id`);
    
    logger.info('Schema fix completed successfully!');
    
  } catch (error) {
    logger.error('Error fixing schema:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run the fix
fixSchemaMismatch();