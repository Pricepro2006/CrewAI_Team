import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { logger } from "../../src/utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Migration {
  id: number;
  filename: string;
  applied_at: Date;
}

export class MigrationRunner {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(databasePath: string = "./data/app.db") {
    this.db = new Database(databasePath);
    this.migrationsPath = path.join(__dirname, ".");
    this.initializeMigrationsTable();
  }

  private initializeMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async runMigrations(): Promise<void> {
    try {
      const files = fs
        .readdirSync(this.migrationsPath)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      const appliedMigrations = this.getAppliedMigrations();

      for (const file of files) {
        if (!appliedMigrations.includes(file)) {
          await this.runMigration(file);
        }
      }

      logger.info("All migrations completed successfully", "MIGRATION");
    } catch (error) {
      logger.error("Migration failed", "MIGRATION", { error });
      throw error;
    }
  }

  private getAppliedMigrations(): string[] {
    const rows = this.db.prepare("SELECT filename FROM migrations").all() as {
      filename: string;
    }[];
    return rows.map((r) => r.filename);
  }

  private async runMigration(filename: string): Promise<void> {
    const filePath = path.join(this.migrationsPath, filename);
    const sql = fs.readFileSync(filePath, "utf-8");

    logger.info(`Running migration: ${filename}`, "MIGRATION");

    try {
      this.db.transaction(() => {
        // Execute the migration
        this.db.exec(sql);

        // Record the migration
        this.db
          .prepare("INSERT INTO migrations (filename) VALUES (?)")
          .run(filename);
      })();

      logger.info(`Migration completed: ${filename}`, "MIGRATION");
    } catch (error) {
      logger.error(`Migration failed: ${filename}`, "MIGRATION", { error });
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

// Run migrations if called directly
if (process.argv[1] === __filename) {
  const runner = new MigrationRunner();
  runner
    .runMigrations()
    .then(() => {
      logger.info("Migration runner completed", "MIGRATION");
      runner.close();
    })
    .catch((error) => {
      logger.error("Migration runner failed", "MIGRATION", { error });
      runner.close();
      process.exit(1);
    });
}
