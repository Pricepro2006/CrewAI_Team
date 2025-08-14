#!/usr/bin/env tsx
/**
 * Script to run the index migration for existing tables
 */

import Database from "better-sqlite3";
import { up } from "../src/database/migrations/023_add_existing_table_indexes.js";
import { logger } from "../src/utils/logger.js";

const DB_PATH = "./data/walmart_grocery.db";

async function runMigration() {
  logger.info("Starting index migration for existing tables", "MIGRATION");
  
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
    
    logger.info(`Index migration complete!`, "MIGRATION");
    logger.info(`Total custom indexes: ${indexCount.count}`, "MIGRATION");
    
    // Test query performance
    logger.info("Testing query performance...", "MIGRATION");
    
    // Test 1: Product search
    const start1 = Date.now();
    const searchQuery = db.prepare(`
      SELECT * FROM walmart_products 
      WHERE name LIKE '%milk%' 
      AND current_price < 10 
      AND in_stock = 1
      LIMIT 10
    `);
    const results1 = searchQuery.all();
    const duration1 = Date.now() - start1;
    logger.info(`Product search: ${results1.length} results in ${duration1}ms`, "MIGRATION");
    
    // Test 2: Order history lookup
    const start2 = Date.now();
    const orderQuery = db.prepare(`
      SELECT * FROM walmart_order_history 
      ORDER BY order_date DESC
      LIMIT 10
    `);
    const results2 = orderQuery.all();
    const duration2 = Date.now() - start2;
    logger.info(`Order history: ${results2.length} results in ${duration2}ms`, "MIGRATION");
    
    // Test 3: Price history
    const start3 = Date.now();
    const priceQuery = db.prepare(`
      SELECT * FROM price_history 
      WHERE product_id IN (
        SELECT product_id FROM walmart_products LIMIT 5
      )
      ORDER BY recorded_at DESC
      LIMIT 20
    `);
    const results3 = priceQuery.all();
    const duration3 = Date.now() - start3;
    logger.info(`Price history: ${results3.length} results in ${duration3}ms`, "MIGRATION");
    
    logger.info(`Average query time: ${Math.round((duration1 + duration2 + duration3) / 3)}ms`, "MIGRATION");
    
    // Show improved query plan
    const explainQuery = db.prepare(`
      EXPLAIN QUERY PLAN
      SELECT * FROM walmart_products 
      WHERE name LIKE '%milk%' 
      AND current_price < 10 
      AND in_stock = 1
      LIMIT 10
    `);
    
    const plan = explainQuery.all();
    logger.info("Query plan with indexes:", "MIGRATION");
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