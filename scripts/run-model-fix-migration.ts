#!/usr/bin/env tsx
/**
 * Script to run the model mismatch fix migration
 */

import Database from "better-sqlite3";
import { up } from "../src/database/migrations/021_fix_model_mismatch.js";
import { logger } from "../src/utils/logger.js";

const DB_PATH = "./data/walmart_grocery.db";

async function runMigration() {
  logger.info("Starting model mismatch fix migration", "MIGRATION");
  
  const db = new Database(DB_PATH);
  
  try {
    // Run the migration
    up(db);
    
    // Verify the fix
    const checkStmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN model_used = 'qwen3:0.6b' THEN 1 ELSE 0 END) as correct_model,
        SUM(CASE WHEN model_used != 'qwen3:0.6b' THEN 1 ELSE 0 END) as other_model
      FROM nlp_intents
    `);
    
    const stats = checkStmt.get() as any;
    
    logger.info(`Migration complete! Stats:`, "MIGRATION");
    logger.info(`Total records: ${stats.total}`, "MIGRATION");
    logger.info(`Correct model (qwen3:0.6b): ${stats.correct_model}`, "MIGRATION");
    logger.info(`Other models: ${stats.other_model}`, "MIGRATION");
    
  } catch (error) {
    logger.error(`Migration failed: ${error}`, "MIGRATION");
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the migration
runMigration().catch(console.error);