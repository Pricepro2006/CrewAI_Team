import Database from 'better-sqlite3';
import { config } from 'dotenv';
import { logger } from '../src/utils/logger';

// Load environment variables
config();

interface Migration {
  version: number;
  description: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create enhanced email analysis schema',
    sql: `
      -- Create emails table
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        graph_id TEXT UNIQUE,
        subject TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        sender_name TEXT,
        to_addresses TEXT,
        received_at TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        has_attachments INTEGER NOT NULL DEFAULT 0,
        body_preview TEXT,
        body TEXT,
        importance TEXT,
        categories TEXT,
        raw_content TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Create enhanced email analysis table
      CREATE TABLE IF NOT EXISTS email_analysis (
        id TEXT PRIMARY KEY,
        email_id TEXT NOT NULL,
        
        -- Quick analysis (Stage 1)
        quick_workflow TEXT,
        quick_priority TEXT,
        quick_intent TEXT,
        quick_urgency TEXT,
        quick_confidence REAL,
        quick_suggested_state TEXT,
        quick_model TEXT,
        quick_processing_time INTEGER,
        
        -- Deep analysis (Stage 2)
        deep_workflow_primary TEXT,
        deep_workflow_secondary TEXT,
        deep_workflow_related TEXT,
        deep_confidence REAL,
        
        -- Entity extraction
        entities_po_numbers TEXT,
        entities_quote_numbers TEXT,
        entities_case_numbers TEXT,
        entities_part_numbers TEXT,
        entities_order_references TEXT,
        entities_contacts TEXT,
        
        -- Action items
        action_summary TEXT,
        action_details TEXT,
        action_sla_status TEXT,
        
        -- Workflow state
        workflow_state TEXT DEFAULT 'New',
        workflow_state_updated_at TEXT,
        workflow_suggested_next TEXT,
        workflow_estimated_completion TEXT,
        workflow_blockers TEXT,
        
        -- Business impact
        business_impact_revenue REAL,
        business_impact_satisfaction TEXT,
        business_impact_urgency_reason TEXT,
        
        -- Context and relationships
        contextual_summary TEXT,
        suggested_response TEXT,
        related_emails TEXT,
        thread_position INTEGER,
        
        -- Processing metadata
        deep_model TEXT,
        deep_processing_time INTEGER,
        total_processing_time INTEGER,
        
        -- Timestamps
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
      );

      -- Create workflow patterns table
      CREATE TABLE IF NOT EXISTS workflow_patterns (
        id TEXT PRIMARY KEY,
        pattern_name TEXT NOT NULL,
        workflow_category TEXT NOT NULL,
        trigger_keywords TEXT,
        typical_entities TEXT,
        average_completion_time INTEGER,
        success_rate REAL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Create performance indexes
      CREATE INDEX IF NOT EXISTS idx_emails_graph_id ON emails(graph_id);
      CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
      CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email);
      CREATE INDEX IF NOT EXISTS idx_email_analysis_email_id ON email_analysis(email_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_primary ON email_analysis(deep_workflow_primary);
      CREATE INDEX IF NOT EXISTS idx_workflow_state ON email_analysis(workflow_state);
      CREATE INDEX IF NOT EXISTS idx_sla_status ON email_analysis(action_sla_status);
      CREATE INDEX IF NOT EXISTS idx_workflow_patterns_category ON workflow_patterns(workflow_category);
    `
  },
  {
    version: 2,
    description: 'Seed TD SYNNEX workflow patterns',
    sql: `
      INSERT OR IGNORE INTO workflow_patterns (
        id, pattern_name, workflow_category, success_rate, 
        average_completion_time, trigger_keywords, typical_entities
      ) VALUES 
        ('wp_order_management', 'Standard Order Processing', 'Order Management', 0.973, 7200000, 'order,purchase,PO,buy,procurement', 'po_numbers,order_references,part_numbers'),
        ('wp_shipping_logistics', 'Express Shipping Request', 'Shipping/Logistics', 0.965, 14400000, 'shipping,delivery,logistics,tracking,freight', 'tracking_numbers,order_references,contacts'),
        ('wp_quote_processing', 'Quote to Order Conversion', 'Quote Processing', 0.892, 86400000, 'quote,pricing,estimate,CAS,TS,WQ', 'quote_numbers,part_numbers,contacts'),
        ('wp_customer_support', 'Technical Support Case', 'Customer Support', 0.915, 28800000, 'support,issue,problem,help,ticket', 'case_numbers,contacts,part_numbers'),
        ('wp_deal_registration', 'Partner Deal Registration', 'Deal Registration', 0.883, 259200000, 'deal,registration,partner,reseller', 'contacts,order_references'),
        ('wp_approval_workflows', 'Manager Approval Request', 'Approval Workflows', 0.947, 43200000, 'approval,authorize,manager,escalate', 'contacts,order_references,po_numbers'),
        ('wp_renewal_processing', 'Contract Renewal', 'Renewal Processing', 0.871, 604800000, 'renewal,contract,extend,expire', 'contacts,order_references'),
        ('wp_vendor_management', 'Vendor RMA Process', 'Vendor Management', 0.824, 345600000, 'RMA,return,vendor,defective', 'case_numbers,part_numbers,contacts');
    `
  },
  {
    version: 3,
    description: 'Create schema version tracking table',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `
  }
];

async function runMigrations(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH || './data/app.db';
  const db = new Database(dbPath);

  logger.info('Starting email schema migration...', 'MIGRATION');
  
  try {
    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get current schema version
    const currentVersion = (db.prepare(`
      SELECT COALESCE(MAX(version), 0) as version FROM schema_migrations
    `).get() as any).version;

    logger.info(`Current schema version: ${currentVersion}`, 'MIGRATION');

    // Apply pending migrations
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        logger.info(`Applying migration ${migration.version}: ${migration.description}`, 'MIGRATION');
        
        try {
          // Run migration in a transaction
          const transaction = db.transaction(() => {
            db.exec(migration.sql);
            db.prepare(`
              INSERT INTO schema_migrations (version, description) VALUES (?, ?)
            `).run(migration.version, migration.description);
          });
          
          transaction();
          logger.info(`Migration ${migration.version} applied successfully`, 'MIGRATION');
        } catch (error) {
          logger.error(`Migration ${migration.version} failed`, 'MIGRATION', { error });
          throw error;
        }
      }
    }

    // Verify final schema version
    const finalVersion = (db.prepare(`
      SELECT COALESCE(MAX(version), 0) as version FROM schema_migrations
    `).get() as any).version;

    logger.info(`Email schema migration completed. Final version: ${finalVersion}`, 'MIGRATION');
    
    // Display migration history
    const migrationHistory = db.prepare(`
      SELECT version, description, applied_at FROM schema_migrations ORDER BY version
    `).all();
    
    logger.info('Migration history:', 'MIGRATION');
    migrationHistory.forEach((migration: any) => {
      logger.info(`  v${migration.version}: ${migration.description} (${migration.applied_at})`, 'MIGRATION');
    });

    // Run schema validation
    await validateSchema(db);

  } catch (error) {
    logger.error('Migration failed', 'MIGRATION', { error });
    throw error;
  } finally {
    db.close();
  }
}

async function validateSchema(db: Database.Database): Promise<void> {
  logger.info('Validating email schema...', 'MIGRATION');
  
  // Check that all required tables exist
  const requiredTables = ['emails', 'email_analysis', 'workflow_patterns'];
  const existingTables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})
  `).all(...requiredTables);
  
  if (existingTables.length !== requiredTables.length) {
    throw new Error(`Missing required tables. Expected: ${requiredTables.join(', ')}, Found: ${existingTables.map((t: any) => t.name).join(', ')}`);
  }

  // Check that workflow patterns were seeded
  const patternCount = (db.prepare(`
    SELECT COUNT(*) as count FROM workflow_patterns
  `).get() as any).count;
  
  if (patternCount === 0) {
    throw new Error('Workflow patterns not seeded');
  }

  // Check that indexes exist
  const requiredIndexes = [
    'idx_emails_graph_id',
    'idx_emails_received_at',
    'idx_email_analysis_email_id',
    'idx_workflow_primary',
    'idx_workflow_state',
    'idx_sla_status'
  ];
  
  const existingIndexes = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='index' AND name IN (${requiredIndexes.map(() => '?').join(',')})
  `).all(...requiredIndexes);
  
  if (existingIndexes.length !== requiredIndexes.length) {
    logger.warn('Some indexes may be missing', 'MIGRATION', {
      expected: requiredIndexes.length,
      found: existingIndexes.length
    });
  }

  logger.info('Schema validation completed successfully', 'MIGRATION');
  logger.info(`  - Tables: ${existingTables.length}/${requiredTables.length}`, 'MIGRATION');
  logger.info(`  - Workflow patterns: ${patternCount}`, 'MIGRATION');
  logger.info(`  - Indexes: ${existingIndexes.length}/${requiredIndexes.length}`, 'MIGRATION');
}

// Run migrations if this script is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runMigrations().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { runMigrations, validateSchema };