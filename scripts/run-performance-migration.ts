#!/usr/bin/env tsx
/**
 * Script to run the performance optimization migration
 */

import Database from "better-sqlite3";
import { up } from "../src/database/migrations/022_add_performance_indexes.js";
import { logger } from "../src/utils/logger.js";

const DB_PATH = "./data/walmart_grocery.db";

async function runMigration() {
  logger.info("Starting performance optimization migration", "MIGRATION");
  
  const db = new Database(DB_PATH);
  
  try {
    // Run the migration
    up(db);
    
    // Verify indexes were created
    const indexCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='index' 
      AND name NOT LIKE 'sqlite_%'
    `).get() as any;
    
    logger.info(`Performance migration complete!`, "MIGRATION");
    logger.info(`Total custom indexes: ${indexCount.count}`, "MIGRATION");
    
    // Test query performance
    logger.info("Testing query performance...", "MIGRATION");
    
    const start = Date.now();
    const testQuery = db.prepare(`
      SELECT * FROM walmart_products 
      WHERE category_path LIKE '%Dairy%' 
      AND current_price < 10 
      AND in_stock = 1
      LIMIT 10
    `);
    
    const results = testQuery.all();
    const duration = Date.now() - start;
    
    logger.info(`Test query returned ${results.length} results in ${duration}ms`, "MIGRATION");
    
    // Show query plan
    const explainQuery = db.prepare(`
      EXPLAIN QUERY PLAN
      SELECT * FROM walmart_products 
      WHERE category_path LIKE '%Dairy%' 
      AND current_price < 10 
      AND in_stock = 1
      LIMIT 10
    `);
    
    const plan = explainQuery.all();
    logger.info("Query plan:", "MIGRATION");
    plan.forEach((step: any) => {
      logger.info(`  ${JSON.stringify(step)}`, "MIGRATION");
    });
    
  } catch (error) {
    logger.error(`Migration failed: ${error}`, "MIGRATION");
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the migration
runMigration().catch(console.error);