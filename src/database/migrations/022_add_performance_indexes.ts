/**
 * Migration to add performance indexes to Walmart Grocery database
 * Addresses: No indexes, single connection bottleneck, 200-500ms search times
 */

import Database, { Database as DatabaseInstance } from "better-sqlite3";
import { logger } from "../../utils/logger.js";

export function up(db: DatabaseInstance): void {
  logger.info("Adding performance indexes to database", "MIGRATION");
  
  try {
    // Enable Write-Ahead Logging for better concurrency
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = 10000");
    db.pragma("temp_store = MEMORY");
    
    // walmart_products indexes
    db.exec(`
      -- Primary search index for product name and description
      CREATE INDEX IF NOT EXISTS idx_products_name_desc 
      ON walmart_products(name, description);
      
      -- Category path and department for filtering
      CREATE INDEX IF NOT EXISTS idx_products_category 
      ON walmart_products(category_path, department);
      
      -- Price range queries
      CREATE INDEX IF NOT EXISTS idx_products_price 
      ON walmart_products(current_price);
      
      -- Stock status for availability filtering
      CREATE INDEX IF NOT EXISTS idx_products_stock 
      ON walmart_products(in_stock, stock_level);
      
      -- Brand filtering
      CREATE INDEX IF NOT EXISTS idx_products_brand 
      ON walmart_products(brand);
      
      -- Full-text search index
      CREATE VIRTUAL TABLE IF NOT EXISTS walmart_products_fts USING fts5(
        product_id UNINDEXED,
        name,
        description,
        brand,
        category_path,
        content=walmart_products
      );
      
      -- Populate FTS table
      INSERT OR IGNORE INTO walmart_products_fts(product_id, name, description, brand, category_path)
      SELECT product_id, name, description, brand, category_path FROM walmart_products;
      
      -- Trigger to keep FTS updated
      CREATE TRIGGER IF NOT EXISTS products_fts_insert 
      AFTER INSERT ON walmart_products BEGIN
        INSERT INTO walmart_products_fts(product_id, name, description, brand, category_path)
        VALUES (new.product_id, new.name, new.description, new.brand, new.category_path);
      END;
      
      CREATE TRIGGER IF NOT EXISTS products_fts_update 
      AFTER UPDATE ON walmart_products BEGIN
        UPDATE walmart_products_fts 
        SET name = new.name, 
            description = new.description,
            brand = new.brand,
            category_path = new.category_path
        WHERE product_id = new.product_id;
      END;
      
      CREATE TRIGGER IF NOT EXISTS products_fts_delete 
      AFTER DELETE ON walmart_products BEGIN
        DELETE FROM walmart_products_fts WHERE product_id = old.product_id;
      END;
    `);
    
    // walmart_orders indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_orders_user 
      ON walmart_orders(user_id, order_date DESC);
      
      CREATE INDEX IF NOT EXISTS idx_orders_status 
      ON walmart_orders(order_status, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_orders_date 
      ON walmart_orders(order_date DESC);
    `);
    
    // walmart_order_items indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order 
      ON walmart_order_items(order_id);
      
      CREATE INDEX IF NOT EXISTS idx_order_items_product 
      ON walmart_order_items(product_id);
      
      CREATE INDEX IF NOT EXISTS idx_order_items_order_product 
      ON walmart_order_items(order_id, product_id);
    `);
    
    // grocery_lists indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_grocery_lists_user 
      ON grocery_lists(user_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_grocery_lists_active 
      ON grocery_lists(is_active, user_id);
    `);
    
    // grocery_list_items indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_grocery_items_list 
      ON grocery_list_items(list_id);
      
      CREATE INDEX IF NOT EXISTS idx_grocery_items_product 
      ON grocery_list_items(product_id);
      
      CREATE INDEX IF NOT EXISTS idx_grocery_items_completed 
      ON grocery_list_items(list_id, is_completed);
    `);
    
    // shopping_cart indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cart_user_session 
      ON shopping_cart(user_id, session_id);
      
      CREATE INDEX IF NOT EXISTS idx_cart_product 
      ON shopping_cart(product_id);
      
      CREATE INDEX IF NOT EXISTS idx_cart_added 
      ON shopping_cart(added_at DESC);
    `);
    
    // price_alerts indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_price_alerts_user 
      ON price_alerts(user_id, is_active);
      
      CREATE INDEX IF NOT EXISTS idx_price_alerts_product 
      ON price_alerts(product_id, is_active);
      
      CREATE INDEX IF NOT EXISTS idx_price_alerts_active 
      ON price_alerts(is_active, target_price);
    `);
    
    // price_history indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_price_history_product 
      ON price_history(product_id, recorded_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_price_history_date 
      ON price_history(recorded_at DESC);
    `);
    
    // nlp_intents indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_user 
      ON nlp_intents(user_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_session 
      ON nlp_intents(session_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_intent 
      ON nlp_intents(detected_intent, confidence_score DESC);
    `);
    
    // shopping_sessions indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user 
      ON shopping_sessions(user_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_sessions_active 
      ON shopping_sessions(is_active, last_activity DESC);
    `);
    
    // Run ANALYZE to update query planner statistics
    db.exec("ANALYZE");
    
    // Get index count for verification
    const indexCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as any;
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
    "idx_products_name_desc",
    "idx_products_category",
    "idx_products_price",
    "idx_products_stock",
    "idx_products_brand",
    "idx_orders_user",
    "idx_orders_status",
    "idx_orders_date",
    "idx_order_items_order",
    "idx_order_items_product",
    "idx_order_items_order_product",
    "idx_grocery_lists_user",
    "idx_grocery_lists_active",
    "idx_grocery_items_list",
    "idx_grocery_items_product",
    "idx_grocery_items_completed",
    "idx_cart_user_session",
    "idx_cart_product",
    "idx_cart_added",
    "idx_price_alerts_user",
    "idx_price_alerts_product",
    "idx_price_alerts_active",
    "idx_price_history_product",
    "idx_price_history_date",
    "idx_nlp_intents_user",
    "idx_nlp_intents_session",
    "idx_nlp_intents_intent",
    "idx_sessions_user",
    "idx_sessions_active"
  ];
  
  indexes.forEach(indexName => {
    try {
      db.exec(`DROP INDEX IF EXISTS ${indexName}`);
    } catch (error) {
      logger.error(`Failed to drop index ${indexName}: ${error}`, "MIGRATION");
    }
  });
  
  // Drop FTS table and triggers
  db.exec(`
    DROP TRIGGER IF EXISTS products_fts_insert;
    DROP TRIGGER IF EXISTS products_fts_update;
    DROP TRIGGER IF EXISTS products_fts_delete;
    DROP TABLE IF EXISTS walmart_products_fts;
  `);
}