import Database, { Database as DatabaseInstance } from "better-sqlite3";
import { logger } from "../../utils/logger.js";

/**
 * Migration: Adaptive Email Pipeline Schema Optimization
 * Version: 009
 * Date: 2025-08-04
 * 
 * This migration optimizes the database schema for the adaptive email pipeline
 * that will process 143,850+ emails with real-time analysis and monitoring.
 * 
 * Key additions:
 * - Chain analysis fields for adaptive processing
 * - Performance optimization indexes
 * - Statistics and monitoring tables
 * - Views for real-time dashboard
 */

export async function up(db: DatabaseInstance): Promise<void> {
  logger.info("Starting migration: Adaptive Email Pipeline Schema Optimization", "MIGRATION");

  try {
    db.exec("BEGIN TRANSACTION");

    // =====================================================
    // MODIFY emails_enhanced TABLE
    // =====================================================
    
    logger.info("Adding adaptive pipeline fields to emails_enhanced", "MIGRATION");
    
    // Add new columns for adaptive pipeline
    const newColumns = [
      'chain_id TEXT',
      'completeness_score REAL DEFAULT 0.0 CHECK (completeness_score >= 0.0 AND completeness_score <= 1.0)',
      'recommended_phase INTEGER DEFAULT 1 CHECK (recommended_phase IN (1, 2, 3))',
      'processing_time_ms INTEGER',
      'model_used TEXT',
      'tokens_used INTEGER'
    ];

    for (const column of newColumns) {
      try {
        db.exec(`ALTER TABLE emails_enhanced ADD COLUMN ${column}`);
        logger.info(`Added column: ${column.split(' ')[0]}`, "MIGRATION");
      } catch (error) {
        // Column might already exist, log and continue
        logger.warn(`Column ${column.split(' ')[0]} may already exist: ${error}`, "MIGRATION");
      }
    }

    // =====================================================
    // CREATE email_chains TABLE
    // =====================================================
    
    logger.info("Creating email_chains table", "MIGRATION");
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_chains (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        
        -- Chain identification
        chain_type TEXT NOT NULL DEFAULT 'conversation' CHECK (chain_type IN ('conversation', 'thread', 'workflow')),
        subject_hash TEXT,
        
        -- Chain metrics
        email_count INTEGER DEFAULT 0,
        completeness_score REAL DEFAULT 0.0 CHECK (completeness_score >= 0.0 AND completeness_score <= 1.0),
        chain_status TEXT DEFAULT 'active' CHECK (chain_status IN ('active', 'complete', 'broken', 'partial')),
        
        -- Processing recommendations
        recommended_phase INTEGER DEFAULT 1 CHECK (recommended_phase IN (1, 2, 3)),
        priority_score REAL DEFAULT 0.5,
        
        -- Timeline
        first_email_at TEXT,
        last_email_at TEXT,
        last_activity_at TEXT,
        
        -- Analysis results
        primary_workflow TEXT,
        confidence_score REAL,
        key_entities TEXT DEFAULT '[]',
        
        -- Audit fields
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // =====================================================
    // CREATE processing_statistics TABLE
    // =====================================================
    
    logger.info("Creating processing_statistics table", "MIGRATION");
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS processing_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Time window
        date_hour TEXT NOT NULL,
        date_day TEXT NOT NULL,
        
        -- Processing metrics
        emails_processed INTEGER DEFAULT 0,
        emails_pending INTEGER DEFAULT 0,
        emails_failed INTEGER DEFAULT 0,
        
        -- Phase distribution
        phase1_processed INTEGER DEFAULT 0,
        phase2_processed INTEGER DEFAULT 0,
        phase3_processed INTEGER DEFAULT 0,
        
        -- Chain analysis
        complete_chains INTEGER DEFAULT 0,
        partial_chains INTEGER DEFAULT 0,
        broken_chains INTEGER DEFAULT 0,
        
        -- Performance metrics
        avg_processing_time_ms REAL,
        max_processing_time_ms INTEGER,
        min_processing_time_ms INTEGER,
        p95_processing_time_ms INTEGER,
        
        -- Resource usage
        total_tokens_used INTEGER DEFAULT 0,
        avg_tokens_per_email REAL,
        
        -- Timestamps
        calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(date_hour, date_day)
      );
    `);

    // =====================================================
    // CREATE PERFORMANCE INDEXES
    // =====================================================
    
    logger.info("Creating performance indexes for adaptive pipeline", "MIGRATION");

    // Primary lookup indexes for new fields
    const primaryIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_emails_chain_id ON emails_enhanced(chain_id)',
      'CREATE INDEX IF NOT EXISTS idx_emails_recommended_phase ON emails_enhanced(recommended_phase)',
      'CREATE INDEX IF NOT EXISTS idx_emails_completeness_score ON emails_enhanced(completeness_score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_emails_processing_time ON emails_enhanced(processing_time_ms) WHERE processing_time_ms IS NOT NULL'
    ];

    for (const indexSql of primaryIndexes) {
      db.exec(indexSql);
      logger.info(`Created index: ${indexSql.match(/idx_[a-z_]+/)?.[0]}`, "MIGRATION");
    }

    // Composite indexes for common query patterns
    const compositeIndexes = [
      // Batch processing optimization
      'CREATE INDEX IF NOT EXISTS idx_emails_batch_processing ON emails_enhanced(processing_status, recommended_phase, received_at DESC)',
      
      // Chain analysis optimization
      'CREATE INDEX IF NOT EXISTS idx_emails_chain_completeness ON emails_enhanced(chain_id, completeness_score DESC) WHERE chain_id IS NOT NULL',
      
      // Phase-based processing
      'CREATE INDEX IF NOT EXISTS idx_emails_phase_status ON emails_enhanced(recommended_phase, processing_status, completeness_score DESC)',
      
      // Performance monitoring
      'CREATE INDEX IF NOT EXISTS idx_emails_performance_tracking ON emails_enhanced(model_used, processing_time_ms, tokens_used) WHERE processing_time_ms IS NOT NULL',
      
      // Workflow and phase completion
      'CREATE INDEX IF NOT EXISTS idx_emails_workflow_phase_complete ON emails_enhanced(workflow_state, phase_completed, recommended_phase)'
    ];

    for (const indexSql of compositeIndexes) {
      db.exec(indexSql);
      logger.info(`Created composite index: ${indexSql.match(/idx_[a-z_]+/)?.[0]}`, "MIGRATION");
    }

    // Email chains indexes
    const chainIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_chains_status_score ON email_chains(chain_status, completeness_score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_chains_recommended_phase ON email_chains(recommended_phase, priority_score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_chains_activity ON email_chains(last_activity_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_chains_type_status ON email_chains(chain_type, chain_status)',
      'CREATE INDEX IF NOT EXISTS idx_chains_subject_hash ON email_chains(subject_hash, created_at DESC)'
    ];

    for (const indexSql of chainIndexes) {
      db.exec(indexSql);
      logger.info(`Created chain index: ${indexSql.match(/idx_[a-z_]+/)?.[0]}`, "MIGRATION");
    }

    // Statistics indexes
    const statsIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_stats_date_hour ON processing_statistics(date_hour DESC)',
      'CREATE INDEX IF NOT EXISTS idx_stats_date_day ON processing_statistics(date_day DESC)',
      'CREATE INDEX IF NOT EXISTS idx_stats_calculated ON processing_statistics(calculated_at DESC)'
    ];

    for (const indexSql of statsIndexes) {
      db.exec(indexSql);
      logger.info(`Created stats index: ${indexSql.match(/idx_[a-z_]+/)?.[0]}`, "MIGRATION");
    }

    // =====================================================
    // CREATE MONITORING VIEWS
    // =====================================================
    
    logger.info("Creating monitoring views", "MIGRATION");

    // Real-time processing dashboard
    db.exec(`
      CREATE VIEW IF NOT EXISTS v_processing_dashboard AS
      SELECT 
        -- Current processing status
        COUNT(*) as total_emails,
        SUM(CASE WHEN processing_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN processing_status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed,
        
        -- Phase distribution
        SUM(CASE WHEN recommended_phase = 1 THEN 1 ELSE 0 END) as phase1_recommended,
        SUM(CASE WHEN recommended_phase = 2 THEN 1 ELSE 0 END) as phase2_recommended,
        SUM(CASE WHEN recommended_phase = 3 THEN 1 ELSE 0 END) as phase3_recommended,
        
        -- Processing performance
        AVG(processing_time_ms) as avg_processing_time,
        MAX(processing_time_ms) as max_processing_time,
        
        -- Chain analysis
        COUNT(DISTINCT chain_id) as total_chains,
        AVG(completeness_score) as avg_completeness_score
      FROM emails_enhanced
      WHERE received_at >= date('now', '-7 days');
    `);

    // Chain completeness analysis
    db.exec(`
      CREATE VIEW IF NOT EXISTS v_chain_completeness AS
      SELECT 
        ec.chain_status,
        COUNT(*) as chain_count,
        ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM email_chains), 2) as percentage,
        AVG(ec.completeness_score) as avg_completeness,
        AVG(ec.email_count) as avg_emails_per_chain,
        AVG(CASE 
          WHEN ec.last_email_at IS NOT NULL AND ec.first_email_at IS NOT NULL 
          THEN julianday(ec.last_email_at) - julianday(ec.first_email_at)
          ELSE 0 
        END) as avg_duration_days
      FROM email_chains ec
      GROUP BY ec.chain_status
      ORDER BY chain_count DESC;
    `);

    // Processing performance metrics
    db.exec(`
      CREATE VIEW IF NOT EXISTS v_processing_performance AS
      SELECT 
        DATE(received_at) as processing_date,
        COUNT(*) as emails_processed,
        AVG(processing_time_ms) as avg_time_ms,
        MIN(processing_time_ms) as min_time_ms,
        MAX(processing_time_ms) as max_time_ms,
        
        -- Phase distribution
        SUM(CASE WHEN phase_completed >= 1 THEN 1 ELSE 0 END) as phase1_completed,
        SUM(CASE WHEN phase_completed >= 2 THEN 1 ELSE 0 END) as phase2_completed,
        SUM(CASE WHEN phase_completed >= 3 THEN 1 ELSE 0 END) as phase3_completed,
        
        -- Error rates
        ROUND(100.0 * SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_percent
      FROM emails_enhanced
      WHERE processing_time_ms IS NOT NULL
      GROUP BY DATE(received_at)
      ORDER BY processing_date DESC;
    `);

    // =====================================================
    // ADD TRIGGERS FOR TIMESTAMP UPDATES
    // =====================================================
    
    logger.info("Creating triggers for timestamp management", "MIGRATION");

    // Update timestamp trigger for email_chains
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_email_chains_timestamp 
      AFTER UPDATE ON email_chains
      FOR EACH ROW
      BEGIN
        UPDATE email_chains SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    // Auto-update chain statistics trigger
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_chain_stats_on_email_change
      AFTER UPDATE OF chain_id, completeness_score ON emails_enhanced
      FOR EACH ROW
      WHEN NEW.chain_id IS NOT NULL
      BEGIN
        UPDATE email_chains 
        SET 
          email_count = (
            SELECT COUNT(*) 
            FROM emails_enhanced 
            WHERE chain_id = NEW.chain_id
          ),
          completeness_score = (
            SELECT AVG(completeness_score) 
            FROM emails_enhanced 
            WHERE chain_id = NEW.chain_id
          ),
          last_activity_at = CURRENT_TIMESTAMP
        WHERE id = NEW.chain_id;
      END;
    `);

    // =====================================================
    // OPTIMIZE DATABASE FOR LARGE DATASET
    // =====================================================

    logger.info("Optimizing database configuration for large dataset", "MIGRATION");

    // Set optimal pragmas for large dataset performance
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA cache_size = 20000");      // 20,000 pages (~80MB cache)
    db.exec("PRAGMA temp_store = MEMORY");
    db.exec("PRAGMA mmap_size = 536870912");   // 512MB memory mapping

    // Update table statistics for query optimizer
    const tablesToAnalyze = [
      'emails_enhanced',
      'email_chains', 
      'processing_statistics',
      'workflow_chains',
      'email_analysis'
    ];

    for (const table of tablesToAnalyze) {
      try {
        db.exec(`ANALYZE ${table}`);
        logger.info(`Updated statistics for table: ${table}`, "MIGRATION");
      } catch (error) {
        logger.warn(`Could not analyze table ${table}: ${error}`, "MIGRATION");
      }
    }

    // =====================================================
    // CREATE INITIAL STATISTICS ENTRY
    // =====================================================

    logger.info("Creating initial statistics entry", "MIGRATION");

    const currentHour = new Date().toISOString().slice(0, 13).replace('T', '-');
    const currentDay = new Date().toISOString().slice(0, 10);

    db.exec(`
      INSERT OR IGNORE INTO processing_statistics (
        date_hour, 
        date_day,
        emails_processed,
        emails_pending,
        calculated_at
      ) VALUES (
        '${currentHour}',
        '${currentDay}',
        (SELECT COUNT(*) FROM emails_enhanced WHERE processing_status = 'completed'),
        (SELECT COUNT(*) FROM emails_enhanced WHERE processing_status = 'pending'),
        CURRENT_TIMESTAMP
      );
    `);

    db.exec("COMMIT");

    logger.info("Successfully completed adaptive email pipeline schema optimization", "MIGRATION");

    // Log summary of changes
    const indexCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type = 'index' AND name LIKE 'idx_%'
    `).get() as { count: number };

    const tableCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type = 'table'
    `).get() as { count: number };

    const viewCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type = 'view' AND name LIKE 'v_%'
    `).get() as { count: number };

    logger.info(`Migration summary - Tables: ${tableCount.count}, Indexes: ${indexCount.count}, Views: ${viewCount.count}`, "MIGRATION");

  } catch (error) {
    db.exec("ROLLBACK");
    logger.error(`Failed to apply adaptive email pipeline schema migration: ${error}`, "MIGRATION");
    throw error;
  }
}

/**
 * Rollback migration: Remove adaptive pipeline schema changes
 */
export async function down(db: DatabaseInstance): Promise<void> {
  logger.info("Rolling back: Adaptive Email Pipeline Schema", "MIGRATION");

  try {
    db.exec("BEGIN TRANSACTION");

    // Drop views
    const viewsToRemove = [
      'v_processing_dashboard',
      'v_chain_completeness', 
      'v_processing_performance'
    ];

    for (const view of viewsToRemove) {
      db.exec(`DROP VIEW IF EXISTS ${view}`);
      logger.info(`Dropped view: ${view}`, "MIGRATION");
    }

    // Drop triggers
    const triggersToRemove = [
      'update_email_chains_timestamp',
      'update_chain_stats_on_email_change'
    ];

    for (const trigger of triggersToRemove) {
      db.exec(`DROP TRIGGER IF EXISTS ${trigger}`);
      logger.info(`Dropped trigger: ${trigger}`, "MIGRATION");
    }

    // Drop indexes
    const indexesToRemove = [
      'idx_emails_chain_id',
      'idx_emails_recommended_phase',
      'idx_emails_completeness_score',
      'idx_emails_processing_time',
      'idx_emails_batch_processing',
      'idx_emails_chain_completeness',
      'idx_emails_phase_status',
      'idx_emails_performance_tracking',
      'idx_emails_workflow_phase_complete',
      'idx_chains_status_score',
      'idx_chains_recommended_phase',
      'idx_chains_activity',
      'idx_chains_type_status',
      'idx_chains_subject_hash',
      'idx_stats_date_hour',
      'idx_stats_date_day',
      'idx_stats_calculated'
    ];

    for (const index of indexesToRemove) {
      try {
        db.exec(`DROP INDEX IF EXISTS ${index}`);
        logger.info(`Dropped index: ${index}`, "MIGRATION");
      } catch (error) {
        logger.warn(`Failed to drop index ${index}: ${error}`, "MIGRATION");
      }
    }

    // Drop tables
    db.exec("DROP TABLE IF EXISTS processing_statistics");
    db.exec("DROP TABLE IF EXISTS email_chains");
    logger.info("Dropped adaptive pipeline tables", "MIGRATION");

    // Note: We don't remove columns from emails_enhanced as SQLite doesn't support DROP COLUMN
    // The columns will remain but won't be used
    logger.info("Note: New columns in emails_enhanced remain (SQLite limitation)", "MIGRATION");

    db.exec("COMMIT");
    logger.info("Successfully rolled back adaptive email pipeline schema", "MIGRATION");

  } catch (error) {
    db.exec("ROLLBACK");
    logger.error(`Failed to rollback adaptive email pipeline schema: ${error}`, "MIGRATION");
    throw error;
  }
}

// Export migration metadata
export const migration = {
  version: 9,
  name: "adaptive_email_pipeline_schema",
  description: "Optimize database schema for adaptive email pipeline processing 143k+ emails",
  dependencies: ["007"], // Depends on composite indexes migration
  up,
  down,
};