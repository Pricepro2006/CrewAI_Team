#!/usr/bin/env node

/**
 * Database Migration Runner
 * Executes all pending database migrations including composite indexes
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync } from 'fs';
import { DatabaseMigrator } from '../database/migrations/DatabaseMigrator';
import { logger } from '../utils/logger';
import appConfig from '../config/app.config';

// Import all migrations
import { up as fixNegativeProcessingTimes, down as rollbackNegativeProcessingTimes } from '../database/migrations/006_fix_negative_processing_times';
import { up as addCompositeIndexes, down as rollbackCompositeIndexes } from '../database/migrations/007_add_composite_indexes';

interface MigrationModule {
  version: number;
  name: string;
  description: string;
  up: (db: Database.Database) => Promise<void>;
  down: (db: Database.Database) => Promise<void>;
}

// Define all migrations in order
const migrations: MigrationModule[] = [
  {
    version: 6,
    name: 'fix_negative_processing_times',
    description: 'Fix negative processing times in email_analysis table',
    up: fixNegativeProcessingTimes,
    down: rollbackNegativeProcessingTimes
  },
  {
    version: 7,
    name: 'add_composite_indexes',
    description: 'Add composite indexes for email analytics performance optimization',
    up: addCompositeIndexes,
    down: rollbackCompositeIndexes
  }
];

class MigrationRunner {
  private db: Database.Database;
  private migrator: DatabaseMigrator;

  constructor(dbPath?: string) {
    const databasePath = dbPath || appConfig.database.path;
    
    // Ensure database directory exists
    const dbDir = join(databasePath, '..');
    if (!existsSync(dbDir)) {
      throw new Error(`Database directory does not exist: ${dbDir}`);
    }

    logger.info(`Opening database at: ${databasePath}`, 'MIGRATION_RUNNER');
    
    this.db = new Database(databasePath);
    this.migrator = new DatabaseMigrator(this.db);
    
    // Enable foreign keys and optimizations
    this.setupDatabase();
  }

  private setupDatabase(): void {
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = MEMORY');
  }

  async runMigrations(targetVersion?: number): Promise<void> {
    try {
      logger.info('Starting database migrations', 'MIGRATION_RUNNER');

      // Get current version
      const currentVersion = await this.getCurrentDatabaseVersion();
      logger.info(`Current database version: ${currentVersion || 'none'}`, 'MIGRATION_RUNNER');

      // Filter migrations to run
      const migrationsToRun = migrations.filter(m => {
        if (targetVersion !== undefined) {
          return m.version > (currentVersion || 0) && m.version <= targetVersion;
        }
        return m.version > (currentVersion || 0);
      });

      if (migrationsToRun.length === 0) {
        logger.info('No migrations to run', 'MIGRATION_RUNNER');
        return;
      }

      logger.info(`Found ${migrationsToRun.length} migrations to run`, 'MIGRATION_RUNNER');

      // Create backup before migrations
      const backupPath = `${appConfig.database.path}.backup_${Date.now()}`;
      logger.info(`Creating backup at: ${backupPath}`, 'MIGRATION_RUNNER');
      await this.migrator.createBackup(backupPath);

      // Run each migration
      for (const migration of migrationsToRun) {
        logger.info(`Running migration ${migration.version}: ${migration.name}`, 'MIGRATION_RUNNER');
        
        const startTime = Date.now();
        
        try {
          await migration.up(this.db);
          
          // Record migration as applied
          this.recordMigration(migration.version, migration.name, Date.now() - startTime);
          
          logger.info(`✓ Migration ${migration.version} completed in ${Date.now() - startTime}ms`, 'MIGRATION_RUNNER');
        } catch (error) {
          logger.error(`✗ Migration ${migration.version} failed: ${error}`, 'MIGRATION_RUNNER');
          throw error;
        }
      }

      // Validate database integrity
      logger.info('Validating database integrity', 'MIGRATION_RUNNER');
      const validation = await this.migrator.validateIntegrity();
      
      if (!validation.valid) {
        logger.error('Database integrity check failed:', 'MIGRATION_RUNNER');
        validation.errors.forEach(error => logger.error(`  - ${error}`, 'MIGRATION_RUNNER'));
        throw new Error('Database integrity check failed');
      }

      logger.info('✓ All migrations completed successfully', 'MIGRATION_RUNNER');
      
      // Show final status
      await this.showStatus();

    } catch (error) {
      logger.error(`Migration failed: ${error}`, 'MIGRATION_RUNNER');
      throw error;
    }
  }

  async rollbackToVersion(version: number): Promise<void> {
    try {
      logger.info(`Rolling back to version ${version}`, 'MIGRATION_RUNNER');

      const currentVersion = await this.getCurrentDatabaseVersion();
      if (!currentVersion || currentVersion <= version) {
        logger.info('Nothing to rollback', 'MIGRATION_RUNNER');
        return;
      }

      // Get migrations to rollback (in reverse order)
      const migrationsToRollback = migrations
        .filter(m => m.version > version && m.version <= currentVersion)
        .reverse();

      logger.info(`Found ${migrationsToRollback.length} migrations to rollback`, 'MIGRATION_RUNNER');

      // Create backup before rollback
      const backupPath = `${appConfig.database.path}.rollback_${Date.now()}`;
      logger.info(`Creating backup at: ${backupPath}`, 'MIGRATION_RUNNER');
      await this.migrator.createBackup(backupPath);

      // Rollback each migration
      for (const migration of migrationsToRollback) {
        logger.info(`Rolling back migration ${migration.version}: ${migration.name}`, 'MIGRATION_RUNNER');
        
        const startTime = Date.now();
        
        try {
          await migration.down(this.db);
          
          // Remove migration record
          this.removeMigration(migration.version);
          
          logger.info(`✓ Rollback ${migration.version} completed in ${Date.now() - startTime}ms`, 'MIGRATION_RUNNER');
        } catch (error) {
          logger.error(`✗ Rollback ${migration.version} failed: ${error}`, 'MIGRATION_RUNNER');
          throw error;
        }
      }

      logger.info('✓ Rollback completed successfully', 'MIGRATION_RUNNER');
      
      // Show final status
      await this.showStatus();

    } catch (error) {
      logger.error(`Rollback failed: ${error}`, 'MIGRATION_RUNNER');
      throw error;
    }
  }

  async showStatus(): Promise<void> {
    const currentVersion = await this.getCurrentDatabaseVersion();
    const appliedMigrations = await this.getAppliedMigrations();
    
    console.log('\n=== Migration Status ===');
    console.log(`Current Version: ${currentVersion || 'none'}`);
    console.log(`Total Migrations: ${migrations.length}`);
    console.log(`Applied Migrations: ${appliedMigrations.length}`);
    console.log(`Pending Migrations: ${migrations.length - appliedMigrations.length}`);
    
    if (appliedMigrations.length > 0) {
      console.log('\nApplied Migrations:');
      appliedMigrations.forEach(m => {
        console.log(`  - v${m.version}: ${m.name} (${new Date(m.applied_at).toLocaleString()})`);
      });
    }
    
    const pendingMigrations = migrations.filter(m => 
      !appliedMigrations.some(applied => applied.version === m.version)
    );
    
    if (pendingMigrations.length > 0) {
      console.log('\nPending Migrations:');
      pendingMigrations.forEach(m => {
        console.log(`  - v${m.version}: ${m.name}`);
      });
    }
  }

  private async getCurrentDatabaseVersion(): Promise<number | null> {
    try {
      const result = this.db.prepare(`
        SELECT version FROM schema_migrations 
        ORDER BY version DESC 
        LIMIT 1
      `).get() as { version: number } | undefined;

      return result?.version || null;
    } catch (error) {
      // Table might not exist yet
      return null;
    }
  }

  private async getAppliedMigrations(): Promise<Array<{
    version: number;
    name: string;
    applied_at: string;
    execution_time: number;
  }>> {
    try {
      // Ensure migrations table exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          execution_time INTEGER NOT NULL
        );
      `);

      return this.db.prepare(`
        SELECT version, name, applied_at, execution_time
        FROM schema_migrations
        ORDER BY version ASC
      `).all() as Array<{
        version: number;
        name: string;
        applied_at: string;
        execution_time: number;
      }>;
    } catch (error) {
      return [];
    }
  }

  private recordMigration(version: number, name: string, executionTime: number): void {
    this.db.prepare(`
      INSERT INTO schema_migrations (version, name, execution_time)
      VALUES (?, ?, ?)
    `).run(version, name, executionTime);
  }

  private removeMigration(version: number): void {
    this.db.prepare(`
      DELETE FROM schema_migrations WHERE version = ?
    `).run(version);
  }

  close(): void {
    this.db.close();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';
  
  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'migrate':
        const targetVersion = args[1] ? parseInt(args[1]) : undefined;
        await runner.runMigrations(targetVersion);
        break;
        
      case 'rollback':
        const rollbackVersion = args[1] ? parseInt(args[1]) : 0;
        await runner.rollbackToVersion(rollbackVersion);
        break;
        
      case 'status':
        await runner.showStatus();
        break;
        
      default:
        console.log('Usage:');
        console.log('  npm run db:migrate [version]    - Run migrations up to version');
        console.log('  npm run db:rollback <version>   - Rollback to version');
        console.log('  npm run db:status               - Show migration status');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    runner.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { MigrationRunner };