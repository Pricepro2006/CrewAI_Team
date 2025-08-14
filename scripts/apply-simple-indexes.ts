#!/usr/bin/env tsx
/**
 * Simple script to apply essential performance indexes
 */

import Database from "better-sqlite3";
import { logger } from "../src/utils/logger.js";

const DB_PATH = "./data/walmart_grocery.db";

async function applyIndexes() {
  logger.info("Applying essential performance indexes", "INDEXES");
  
  const db = new Database(DB_PATH);
  
  try {
    // Enable WAL mode for better concurrency
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = 10000");
    db.pragma("temp_store = MEMORY");
    
    const indexes = [
      // Product indexes
      "CREATE INDEX IF NOT EXISTS idx_products_name ON walmart_products(name)",
      "CREATE INDEX IF NOT EXISTS idx_products_brand ON walmart_products(brand)",
      "CREATE INDEX IF NOT EXISTS idx_products_price ON walmart_products(current_price)",
      "CREATE INDEX IF NOT EXISTS idx_products_stock ON walmart_products(in_stock)",
      "CREATE INDEX IF NOT EXISTS idx_products_id ON walmart_products(product_id)",
      
      // Order history
      "CREATE INDEX IF NOT EXISTS idx_order_number ON walmart_order_history(order_number)",
      
      // Order items
      "CREATE INDEX IF NOT EXISTS idx_order_items_product ON walmart_order_items(product_id)",
      
      // Grocery lists
      "CREATE INDEX IF NOT EXISTS idx_grocery_lists_user ON grocery_lists(user_id)",
      
      // Grocery items
      "CREATE INDEX IF NOT EXISTS idx_grocery_items_list ON grocery_items(list_id)",
      
      // Price alerts
      "CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active)",
      
      // NLP intents
      "CREATE INDEX IF NOT EXISTS idx_nlp_intent ON nlp_intents(detected_intent)",
      
      // Sessions
      "CREATE INDEX IF NOT EXISTS idx_sessions_user ON shopping_sessions(user_id)"
    ];
    
    let created = 0;
    for (const indexSql of indexes) {
      try {
        db.exec(indexSql);
        created++;
        logger.info(`✓ ${indexSql.match(/idx_\w+/)?.[0]}`, "INDEX");
      } catch (error) {
        logger.warn(`Failed: ${indexSql.match(/idx_\w+/)?.[0]} - ${error}`, "INDEX");
      }
    }
    
    // Run ANALYZE to update statistics
    db.exec("ANALYZE");
    
    logger.info(`Successfully created ${created} indexes`, "INDEXES");
    
    // Test performance
    logger.info("Testing query performance...", "INDEXES");
    
    // Before creating FTS, test regular search
    const start1 = Date.now();
    const results1 = db.prepare("SELECT COUNT(*) as count FROM walmart_products WHERE name LIKE '%milk%'").get() as any;
    const duration1 = Date.now() - start1;
    
    const start2 = Date.now();
    const results2 = db.prepare("SELECT COUNT(*) as count FROM walmart_products WHERE current_price < 10").get() as any;
    const duration2 = Date.now() - start2;
    
    const start3 = Date.now();
    const results3 = db.prepare("SELECT COUNT(*) as count FROM walmart_products WHERE in_stock = 1").get() as any;
    const duration3 = Date.now() - start3;
    
    logger.info("Query Performance:", "INDEXES");
    logger.info(`  Name search: ${results1.count} products in ${duration1}ms`, "INDEXES");
    logger.info(`  Price filter: ${results2.count} products in ${duration2}ms`, "INDEXES");
    logger.info(`  Stock filter: ${results3.count} products in ${duration3}ms`, "INDEXES");
    logger.info(`  Average: ${Math.round((duration1 + duration2 + duration3) / 3)}ms`, "INDEXES");
    
    // Get total index count
    const indexCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").get() as any;
    logger.info(`Total indexes in database: ${indexCount.count}`, "INDEXES");
    
  } catch (error) {
    logger.error(`Failed to apply indexes: ${error}`, "INDEXES");
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the script
applyIndexes().catch(console.error);