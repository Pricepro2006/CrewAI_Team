/**
 * Email Status Migration Strategy
 * Provides utilities for migrating existing code to use the new type-safe status system
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import {
  DatabaseEmailStatus,
  DatabaseWorkflowState,
} from '../core/types/email-status-types.js';
import {
  isDatabaseEmailStatus,
  isDatabaseWorkflowState,
} from '../core/validators/email-status-validator.js';

export class EmailStatusMigration {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  /**
   * Analyze current status values in the database
   */
  async analyzeCurrentStatuses(): Promise<{
    invalidStatuses: Array<{ id: string; status: string }>;
    invalidWorkflowStates: Array<{ id: string; workflow_state: string }>;
    statusDistribution: Record<string, number>;
    workflowStateDistribution: Record<string, number>;
  }> {
    logger.info('Analyzing current email statuses...');

    // Get all unique status values
    const statusRows = this.db
      .prepare('SELECT DISTINCT status, COUNT(*) as count FROM emails_enhanced GROUP BY status')
      .all() as Array<{ status: string; count: number }>;

    // Get all unique workflow_state values
    const workflowStateRows = this.db
      .prepare('SELECT DISTINCT workflow_state, COUNT(*) as count FROM emails_enhanced GROUP BY workflow_state')
      .all() as Array<{ workflow_state: string; count: number }>;

    // Find invalid statuses
    const allStatuses = this.db
      .prepare('SELECT id, status FROM emails_enhanced WHERE status IS NOT NULL')
      .all() as Array<{ id: string; status: string }>;
    const invalidStatuses = allStatuses?.filter(row => !isDatabaseEmailStatus(row.status));

    // Find invalid workflow states
    const allWorkflowStates = this.db
      .prepare('SELECT id, workflow_state FROM emails_enhanced WHERE workflow_state IS NOT NULL')
      .all() as Array<{ id: string; workflow_state: string }>;
    const invalidWorkflowStates = allWorkflowStates?.filter(row => !isDatabaseWorkflowState(row.workflow_state));

    // Create distribution maps
    const statusDistribution: Record<string, number> = {};
    statusRows.forEach(row => {
      statusDistribution[row.status] = row.count;
    });

    const workflowStateDistribution: Record<string, number> = {};
    workflowStateRows.forEach(row => {
      workflowStateDistribution[row.workflow_state] = row.count;
    });

    return {
      invalidStatuses,
      invalidWorkflowStates,
      statusDistribution,
      workflowStateDistribution,
    };
  }

  /**
   * Create backup of current data
   */
  async createBackup(): Promise<void> {
    logger.info('Creating backup of emails_enhanced table...');

    // Drop backup table if exists
    this?.db?.prepare('DROP TABLE IF EXISTS emails_enhanced_backup').run();

    // Create backup
    this?.db?.prepare('CREATE TABLE emails_enhanced_backup AS SELECT * FROM emails_enhanced').run();

    logger.info('Backup created successfully');
  }

  /**
   * Migrate invalid status values to valid ones
   */
  async migrateInvalidStatuses(dryRun: boolean = true): Promise<{
    migratedCount: number;
    migrations: Array<{ id: string; oldStatus: string; newStatus: DatabaseEmailStatus }>;
  }> {
    logger.info(`Starting status migration (dryRun: ${dryRun})...`);

    const migrations: Array<{ id: string; oldStatus: string; newStatus: DatabaseEmailStatus }> = [];

    // Define migration rules
    const statusMigrationRules: Record<string, DatabaseEmailStatus> = {
      // Common variations
      'new': 'pending',
      'imported': 'imported',
      'processing': 'active',
      'in_progress': 'active',
      'completed': 'analyzed',
      'complete': 'analyzed',
      'done': 'analyzed',
      'error': 'error',
      'failed': 'failed',
      // Add more rules as needed
    };

    // Get all records with invalid statuses
    const invalidRecords = this.db
      .prepare('SELECT id, status FROM emails_enhanced WHERE status IS NOT NULL')
      .all() as Array<{ id: string; status: string }>;

    for (const record of invalidRecords) {
      if (!isDatabaseEmailStatus(record.status)) {
        const newStatus = statusMigrationRules[record?.status?.toLowerCase()] || 'pending';
        migrations.push({
          id: record.id,
          oldStatus: record.status,
          newStatus,
        });

        if (!dryRun) {
          this.db
            .prepare('UPDATE emails_enhanced SET status = ? WHERE id = ?')
            .run(newStatus, record.id);
        }
      }
    }

    logger.info(`Migration ${dryRun ? 'would affect' : 'affected'} ${migrations?.length || 0} records`);

    return {
      migratedCount: migrations?.length || 0,
      migrations,
    };
  }

  /**
   * Migrate invalid workflow states to valid ones
   */
  async migrateInvalidWorkflowStates(dryRun: boolean = true): Promise<{
    migratedCount: number;
    migrations: Array<{ id: string; oldState: string; newState: DatabaseWorkflowState }>;
  }> {
    logger.info(`Starting workflow state migration (dryRun: ${dryRun})...`);

    const migrations: Array<{ id: string; oldState: string; newState: DatabaseWorkflowState }> = [];

    // Define migration rules
    const workflowStateMigrationRules: Record<string, DatabaseWorkflowState> = {
      // Common variations
      'start': 'START_POINT',
      'start_point': 'START_POINT',
      'beginning': 'START_POINT',
      'new': 'START_POINT',
      'progress': 'IN_PROGRESS',
      'in_progress': 'IN_PROGRESS',
      'processing': 'IN_PROGRESS',
      'active': 'IN_PROGRESS',
      'complete': 'COMPLETION',
      'completed': 'COMPLETION',
      'done': 'COMPLETION',
      'finished': 'COMPLETION',
      'error': 'error',
      'failed': 'error',
      // Add more rules as needed
    };

    // Get all records
    const records = this.db
      .prepare('SELECT id, workflow_state FROM emails_enhanced WHERE workflow_state IS NOT NULL')
      .all() as Array<{ id: string; workflow_state: string }>;

    for (const record of records) {
      if (!isDatabaseWorkflowState(record.workflow_state)) {
        const newState = workflowStateMigrationRules[record?.workflow_state?.toLowerCase()] || 'IN_PROGRESS';
        migrations.push({
          id: record.id,
          oldState: record.workflow_state,
          newState,
        });

        if (!dryRun) {
          this.db
            .prepare('UPDATE emails_enhanced SET workflow_state = ? WHERE id = ?')
            .run(newState, record.id);
        }
      }
    }

    logger.info(`Workflow state migration ${dryRun ? 'would affect' : 'affected'} ${migrations?.length || 0} records`);

    return {
      migratedCount: migrations?.length || 0,
      migrations,
    };
  }

  /**
   * Add database constraints to enforce valid values
   */
  async addDatabaseConstraints(): Promise<void> {
    logger.info('Adding database constraints...');

    // Note: SQLite doesn't support adding CHECK constraints to existing tables
    // We need to recreate the table with constraints

    const validStatuses = ['pending', 'imported', 'analyzed', 'phase1_complete', 
                          'phase2_complete', 'phase3_complete', 'failed', 'error', 'active'];
    const validWorkflowStates = ['START_POINT', 'IN_PROGRESS', 'COMPLETION', 
                                 'pending', 'in_progress', 'completed', 'error'];

    logger.info(`
      To add constraints, you need to:
      1. Create a new table with CHECK constraints
      2. Copy data from the old table
      3. Drop the old table
      4. Rename the new table
      
      Example SQL:
      CREATE TABLE emails_enhanced_new (
        ... existing columns ...,
        status TEXT CHECK (status IN (${validStatuses?.map(s => `'${s}'`).join(', ')})),
        workflow_state TEXT CHECK (workflow_state IN (${validWorkflowStates?.map(s => `'${s}'`).join(', ')}))
      );
    `);
  }

  /**
   * Generate migration report
   */
  async generateMigrationReport(): Promise<string> {
    const analysis = await this.analyzeCurrentStatuses();
    
    const report = `
# Email Status Migration Report
Generated: ${new Date().toISOString()}

## Current Status Distribution
${Object.entries(analysis.statusDistribution)
  .map(([status, count]) => `- ${status}: ${count} records`)
  .join('\n')}

## Current Workflow State Distribution
${Object.entries(analysis.workflowStateDistribution)
  .map(([state, count]) => `- ${state}: ${count} records`)
  .join('\n')}

## Invalid Records
- Invalid statuses: ${analysis?.invalidStatuses?.length} records
- Invalid workflow states: ${analysis?.invalidWorkflowStates?.length} records

## Recommended Actions
1. Create backup: \`await migration.createBackup()\`
2. Run dry migration: \`await migration.migrateInvalidStatuses(true)\`
3. Review migration plan
4. Run actual migration: \`await migration.migrateInvalidStatuses(false)\`
5. Add database constraints

## Sample Invalid Records
### Invalid Statuses
${analysis?.invalidStatuses?.slice(0, 5).map(r => `- ID: ${r.id}, Status: "${r.status}"`).join('\n')}

### Invalid Workflow States
${analysis?.invalidWorkflowStates?.slice(0, 5).map(r => `- ID: ${r.id}, State: "${r.workflow_state}"`).join('\n')}
    `;

    return report;
  }

  /**
   * Close database connection
   */
  close(): void {
    this?.db?.close();
  }
}

// Example usage script
export async function runMigration(dbPath: string): Promise<void> {
  const migration = new EmailStatusMigration(dbPath);
  
  try {
    // Generate report
    const report = await migration.generateMigrationReport();
    console.log(report);
    
    // Create backup
    await migration.createBackup();
    
    // Run migrations
    const statusMigration = await migration.migrateInvalidStatuses(false);
    const workflowMigration = await migration.migrateInvalidWorkflowStates(false);
    
    logger.info(`Migration complete:
      - Status migrations: ${statusMigration.migratedCount}
      - Workflow state migrations: ${workflowMigration.migratedCount}
    `);
    
  } finally {
    migration.close();
  }
}