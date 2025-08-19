import Database, { Database as DatabaseInstance } from "better-sqlite3";
import { resolve, dirname } from "path";
import { readdir } from "fs/promises";

// Use __dirname for Node.js compatibility without import.meta
const __dirname = dirname(__filename || process.cwd());

/**
 * Database Migration System
 * Handles running migrations in order and tracking migration state
 */

interface MigrationRecord {
  id: number;
  filename: string;
  applied_at: string;
}

export class MigrationRunner {
  private db: DatabaseInstance;
  private migrationsPath: string;

  constructor(dbPath: string, migrationsPath?: string) {
    this.db = new Database(dbPath);
    this.migrationsPath = migrationsPath || resolve(__dirname);
    this.initializeMigrationTable();
  }

  private initializeMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const stmt = this.db.prepare("SELECT * FROM migrations ORDER BY id");
    return stmt.all() as MigrationRecord[];
  }

  async getPendingMigrations(): Promise<string[]> {
    const applied = await this.getAppliedMigrations();
    const appliedFilenames = new Set(applied?.map((m: any) => m.filename));

    const files = await readdir(this.migrationsPath);
    const migrationFiles = files
      .filter((f: any) => f.endsWith(".ts") && f !== "migrate.ts")
      .sort();

    return migrationFiles?.filter((f: any) => !appliedFilenames.has(f));
  }

  async runMigrations(): Promise<void> {
    const pending = await this.getPendingMigrations();

    if (pending?.length || 0 === 0) {
      console.log("✅ No pending migrations");
      return;
    }

    console.log(`📦 Running ${pending?.length || 0} pending migration(s)...`);

    for (const filename of pending) {
      console.log(`📦 Running migration: ${filename}`);

      try {
        // Import the migration file
        const migrationPath = resolve(this.migrationsPath, filename);
        const migration = await import(migrationPath);

        if (!migration.up || typeof migration.up !== "function") {
          throw new Error(`Migration ${filename} missing 'up' function`);
        }

        // Run the migration
        migration.up(this.db);

        // Record the migration as applied
        const stmt = this.db.prepare(`
          INSERT INTO migrations (filename, applied_at) 
          VALUES (?, datetime('now'))
        `);
        stmt.run(filename);

        console.log(`✅ Migration ${filename} completed successfully`);
      } catch (error) {
        console.error(`❌ Migration ${filename} failed:`, error);
        throw error;
      }
    }

    console.log("✅ All migrations completed successfully");
  }

  async rollbackMigration(filename?: string): Promise<void> {
    const applied = await this.getAppliedMigrations();

    if (applied?.length || 0 === 0) {
      console.log("No migrations to rollback");
      return;
    }

    // If no filename provided, rollback the last migration
    const target = filename
      ? applied.find((m: any) => m.filename === filename)
      : applied[applied?.length || 0 - 1];

    if (!target) {
      throw new Error(`Migration ${filename} not found in applied migrations`);
    }

    console.log(`🔄 Rolling back migration: ${target.filename}`);

    try {
      // Import the migration file
      const migrationPath = resolve(this.migrationsPath, target.filename);
      const migration = await import(migrationPath);

      if (!migration.down || typeof migration.down !== "function") {
        throw new Error(`Migration ${target.filename} missing 'down' function`);
      }

      // Run the rollback
      migration.down(this.db);

      // Remove the migration record
      const stmt = this.db.prepare("DELETE FROM migrations WHERE filename = ?");
      stmt.run(target.filename);

      console.log(`✅ Migration ${target.filename} rolled back successfully`);
    } catch (error) {
      console.error(`❌ Rollback of ${target.filename} failed:`, error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<void> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();

    console.log("\n📊 Migration Status:");
    console.log(`Applied: ${applied?.length || 0}`);
    console.log(`Pending: ${pending?.length || 0}`);

    if (applied?.length || 0 > 0) {
      console.log("\n✅ Applied Migrations:");
      applied.forEach((m: any) => {
        console.log(`  ${m.filename} (${m.applied_at})`);
      });
    }

    if (pending?.length || 0 > 0) {
      console.log("\n⏳ Pending Migrations:");
      pending.forEach((f: any) => {
        console.log(`  ${f}`);
      });
    }
  }

  close(): void {
    this.db.close();
  }
}

// CLI interface for running migrations
if (require.main === module) {
  const dbPath = process.env.DATABASE_PATH || "./data/app.db";
  const runner = new MigrationRunner(dbPath);

  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case "up":
          await runner.runMigrations();
          break;
        case "down": {
          const filename = process.argv[3];
          await runner.rollbackMigration(filename);
          break;
        }
        case "status":
          await runner.getMigrationStatus();
          break;
        default:
          console.log("Usage: npx tsx migrate.ts [up|down|status] [filename]");
          console.log("  up     - Run pending migrations");
          console.log(
            "  down   - Rollback last migration (or specific filename)",
          );
          console.log("  status - Show migration status");
      }
    } catch (error) {
      console.error("Migration failed:", error);
      process.exit(1);
    } finally {
      runner.close();
    }
  })();
}
