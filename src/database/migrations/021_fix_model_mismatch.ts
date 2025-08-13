/**
 * Migration to fix model mismatch
 * Updates default model from qwen2.5:0.5b to qwen3:0.6b
 */

import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

export function up(db: Database.Database): void {
  logger.info("Fixing model mismatch in database", "MIGRATION");
  
  try {
    // Update default value in nlp_intents table
    db.exec(`
      -- Drop and recreate the table with correct default
      -- First, backup existing data
      CREATE TABLE IF NOT EXISTS nlp_intents_backup AS SELECT * FROM nlp_intents;
      
      -- Drop the old table
      DROP TABLE IF EXISTS nlp_intents;
      
      -- Recreate with correct default
      CREATE TABLE nlp_intents (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_query TEXT NOT NULL,
        detected_intent TEXT NOT NULL,
        confidence_score REAL,
        entities TEXT,
        context TEXT,
        model_used TEXT DEFAULT 'qwen3:0.6b',
        response TEXT,
        user_id TEXT,
        session_id TEXT,
        feedback_rating INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Restore data with model name update
      INSERT INTO nlp_intents 
      SELECT 
        id,
        user_query,
        detected_intent,
        confidence_score,
        entities,
        context,
        CASE 
          WHEN model_used = 'qwen2.5:0.5b' THEN 'qwen3:0.6b'
          ELSE model_used
        END as model_used,
        response,
        user_id,
        session_id,
        feedback_rating,
        created_at
      FROM nlp_intents_backup;
      
      -- Drop backup table
      DROP TABLE nlp_intents_backup;
    `);
    
    // Update any existing records with old model name
    const updateStmt = db.prepare(`
      UPDATE nlp_intents 
      SET model_used = 'qwen3:0.6b' 
      WHERE model_used = 'qwen2.5:0.5b' OR model_used IS NULL
    `);
    
    const result = updateStmt.run();
    logger.info(`Updated ${result.changes} records with correct model name`, "MIGRATION");
    
    // Also check and update walmart_products table if it has model_used column
    const tableInfo = db.prepare("PRAGMA table_info(walmart_products)").all();
    const hasModelColumn = tableInfo.some((col: any) => col.name === "model_used");
    
    if (hasModelColumn) {
      const updateProductsStmt = db.prepare(`
        UPDATE walmart_products 
        SET model_used = 'qwen3:0.6b' 
        WHERE model_used = 'qwen2.5:0.5b' OR model_used IS NULL
      `);
      
      const productResult = updateProductsStmt.run();
      logger.info(`Updated ${productResult.changes} product records with correct model name`, "MIGRATION");
    }
    
    logger.info("Model mismatch fixed successfully", "MIGRATION");
  } catch (error) {
    logger.error(`Failed to fix model mismatch: ${error}`, "MIGRATION");
    throw error;
  }
}

export function down(db: Database.Database): void {
  // Reverting would change back to incorrect model
  logger.warn("Reverting model fix - this will restore the mismatch", "MIGRATION");
  
  db.exec(`
    UPDATE nlp_intents 
    SET model_used = 'qwen2.5:0.5b' 
    WHERE model_used = 'qwen3:0.6b'
  `);
}