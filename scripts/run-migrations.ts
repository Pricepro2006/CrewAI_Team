import Database from 'better-sqlite3';
import { readdir, readFile } from 'fs/promises';
import { resolve, join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

interface Migration {
  id: string;
  name: string;
  applied_at: string;
}

async function runMigrations() {
  console.log('🔧 Running database migrations...');

  const dbPath = process.env.DATABASE_PATH || './data/app.db';
  const db = new Database(dbPath);

  try {
    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    // Get list of applied migrations
    const appliedMigrations = db.prepare('SELECT id FROM migrations').all() as Migration[];
    const appliedIds = new Set(appliedMigrations.map(m => m.id));

    // Read migration files
    const migrationsDir = resolve('./src/scripts/migration');
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    console.log(`Found ${sqlFiles.length} migration files`);

    // Run each migration that hasn't been applied
    for (const file of sqlFiles) {
      const migrationId = file.replace('.sql', '');
      
      if (appliedIds.has(migrationId)) {
        console.log(`✓ Migration ${migrationId} already applied`);
        continue;
      }

      console.log(`📝 Running migration: ${file}`);
      
      const sqlPath = join(migrationsDir, file);
      const sql = await readFile(sqlPath, 'utf-8');

      // Execute migration in a transaction
      const startTransaction = db.prepare('BEGIN');
      const commitTransaction = db.prepare('COMMIT');
      const rollbackTransaction = db.prepare('ROLLBACK');

      try {
        startTransaction.run();
        
        // Execute the migration SQL
        db.exec(sql);
        
        // Record migration as applied
        db.prepare('INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)')
          .run(migrationId, file, new Date().toISOString());
        
        commitTransaction.run();
        console.log(`✅ Migration ${migrationId} applied successfully`);
      } catch (error) {
        rollbackTransaction.run();
        console.error(`❌ Migration ${migrationId} failed:`, error);
        throw error;
      }
    }

    // Show migration status
    const finalMigrations = db.prepare('SELECT * FROM migrations ORDER BY applied_at DESC').all();
    console.log(`\n📊 Migration Status:`);
    console.log(`Total migrations applied: ${finalMigrations.length}`);

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migrations
runMigrations().catch(console.error);