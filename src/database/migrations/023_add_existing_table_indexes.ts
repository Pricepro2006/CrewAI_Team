/**
 * Migration to add performance indexes to existing Walmart Grocery tables
 * Focuses only on tables that actually exist
 */

import Database, { Database as DatabaseInstance } from "better-sqlite3";
import { logger } from "../../utils/logger.js";

export function up(db: DatabaseInstance): void {
  logger.info("Adding performance indexes to existing tables", "MIGRATION");
  
  try {
    // Enable Write-Ahead Logging for better concurrency
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = 10000");
    db.pragma("temp_store = MEMORY");
    
    // walmart_products indexes
    db.exec(`
      -- Primary search index for product name and description
      CREATE INDEX IF NOT EXISTS idx_products_name 
      ON walmart_products(name);
      
      CREATE INDEX IF NOT EXISTS idx_products_brand 
      ON walmart_products(brand);
      
      -- Category path and department for filtering
      CREATE INDEX IF NOT EXISTS idx_products_category 
      ON walmart_products(category_path, department);
      
      -- Price range queries
      CREATE INDEX IF NOT EXISTS idx_products_price 
      ON walmart_products(current_price);
      
      -- Stock status for availability filtering
      CREATE INDEX IF NOT EXISTS idx_products_stock 
      ON walmart_products(in_stock, stock_level);
      
      -- Product ID for quick lookups
      CREATE INDEX IF NOT EXISTS idx_products_product_id 
      ON walmart_products(product_id);
    `);
    
    // walmart_order_history indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_history_date 
      ON walmart_order_history(order_date DESC);
      
      CREATE INDEX IF NOT EXISTS idx_order_history_id 
      ON walmart_order_history(order_id);
    `);
    
    // walmart_order_items indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order 
      ON walmart_order_items(order_id);
      
      CREATE INDEX IF NOT EXISTS idx_order_items_product 
      ON walmart_order_items(product_id);
    `);
    
    // grocery_lists indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_grocery_lists_user 
      ON grocery_lists(user_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_grocery_lists_name 
      ON grocery_lists(name);
    `);
    
    // grocery_items indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_grocery_items_list 
      ON grocery_items(list_id);
      
      CREATE INDEX IF NOT EXISTS idx_grocery_items_product 
      ON grocery_items(product_id);
    `);
    
    // price_alerts indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_price_alerts_user 
      ON price_alerts(user_id);
      
      CREATE INDEX IF NOT EXISTS idx_price_alerts_product 
      ON price_alerts(product_id);
      
      CREATE INDEX IF NOT EXISTS idx_price_alerts_active 
      ON price_alerts(is_active);
    `);
    
    // price_history indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_price_history_product_date 
      ON price_history(product_id, recorded_at DESC);
    `);
    
    // nlp_intents indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_user 
      ON nlp_intents(user_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_session 
      ON nlp_intents(session_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_intent 
      ON nlp_intents(detected_intent);
    `);
    
    // shopping_sessions indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user 
      ON shopping_sessions(user_id, created_at DESC);
    `);
    
    // store_locations indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_store_locations_zip 
      ON store_locations(zip_code);
      
      CREATE INDEX IF NOT EXISTS idx_store_locations_city 
      ON store_locations(city, state);
    `);
    
    // Run ANALYZE to update query planner statistics
    db.exec("ANALYZE");
    
    // Get index count for verification
    const indexCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").get() as any;
    logger.info(`Created/verified ${indexCount.count} indexes`, "MIGRATION");
    
  } catch (error) {
    logger.error(`Failed to add performance indexes: ${error}`, "MIGRATION");
    throw error;
  }
}

export function down(db: DatabaseInstance): void {
  logger.warn("Removing performance indexes - this will degrade performance", "MIGRATION");
  
  // Drop all custom indexes (keep automatic ones)
  const indexes = [
    "idx_products_name",
    "idx_products_brand",
    "idx_products_category",
    "idx_products_price",
    "idx_products_stock",
    "idx_products_product_id",
    "idx_order_history_date",
    "idx_order_history_id",
    "idx_order_items_order",
    "idx_order_items_product",
    "idx_grocery_lists_user",
    "idx_grocery_lists_name",
    "idx_grocery_items_list",
    "idx_grocery_items_product",
    "idx_price_alerts_user",
    "idx_price_alerts_product",
    "idx_price_alerts_active",
    "idx_price_history_product_date",
    "idx_nlp_intents_user",
    "idx_nlp_intents_session",
    "idx_nlp_intents_intent",
    "idx_sessions_user",
    "idx_store_locations_zip",
    "idx_store_locations_city"
  ];
  
  indexes.forEach(indexName => {
    try {
      db.exec(`DROP INDEX IF EXISTS ${indexName}`);
    } catch (error) {
      logger.error(`Failed to drop index ${indexName}: ${error}`, "MIGRATION");
    }
  });
}