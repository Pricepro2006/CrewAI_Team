#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_PATH = process.env.DATABASE_PATH || './data/app.db';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');

interface MigrationRecord {
  id: number;
  filename: string;
  executed_at: string;
}

class MigrationRunner {
  private db: Database.Database;

  constructor(databasePath: string) {
    this.db = new Database(databasePath);
    this.createMigrationsTable();
  }

  private createMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private getExecutedMigrations(): Set<string> {
    const stmt = this.db.prepare('SELECT filename FROM migrations');
    const rows = stmt.all() as MigrationRecord[];
    return new Set(rows.map(row => row.filename));
  }

  private getMigrationFiles(): string[] {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
  }

  public async runMigrations(): Promise<void> {
    const executedMigrations = this.getExecutedMigrations();
    const migrationFiles = this.getMigrationFiles();
    let migrationsRun = 0;

    logger.info(`Found ${migrationFiles.length} migration files`, 'MIGRATION');

    for (const filename of migrationFiles) {
      if (executedMigrations.has(filename)) {
        logger.debug(`Skipping already executed migration: ${filename}`, 'MIGRATION');
        continue;
      }

      logger.info(`Running migration: ${filename}`, 'MIGRATION');
      
      try {
        const filePath = path.join(MIGRATIONS_DIR, filename);
        const sql = fs.readFileSync(filePath, 'utf-8');
        
        // Run migration in a transaction
        this.db.transaction(() => {
          // Execute the migration SQL
          this.db.exec(sql);
          
          // Record the migration
          const stmt = this.db.prepare('INSERT INTO migrations (filename) VALUES (?)');
          stmt.run(filename);
        })();
        
        logger.info(`Successfully executed migration: ${filename}`, 'MIGRATION');
        migrationsRun++;
      } catch (error) {
        logger.error(`Failed to execute migration: ${filename}`, 'MIGRATION', { error });
        throw error;
      }
    }

    if (migrationsRun === 0) {
      logger.info('No new migrations to run', 'MIGRATION');
    } else {
      logger.info(`Successfully ran ${migrationsRun} migrations`, 'MIGRATION');
    }
  }

  public close(): void {
    this.db.close();
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${__filename}`) {
  (async () => {
    try {
      logger.info('Starting database migration', 'MIGRATION');
      
      const runner = new MigrationRunner(DATABASE_PATH);
      await runner.runMigrations();
      runner.close();
      
      logger.info('Database migration completed successfully', 'MIGRATION');
      process.exit(0);
    } catch (error) {
      logger.error('Database migration failed', 'MIGRATION', { error });
      process.exit(1);
    }
  })();
}