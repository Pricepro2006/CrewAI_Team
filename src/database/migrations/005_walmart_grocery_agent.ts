/**
 * Walmart Grocery Agent Migration
 * Creates tables for Walmart grocery shopping functionality
 */

import type Database from 'better-sqlite3';
import { logger } from '../../utils/logger';

export default class WalmartGroceryAgentMigration {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async up(): Promise<void> {
    logger.info('Running Walmart Grocery Agent migration...', 'MIGRATION');

    try {
      // Create walmart_products table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS walmart_products (
          id TEXT PRIMARY KEY,
          product_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          brand TEXT,
          description TEXT,
          category TEXT,
          subcategory TEXT,
          department TEXT,
          price REAL NOT NULL,
          original_price REAL,
          currency TEXT DEFAULT 'USD',
          unit TEXT DEFAULT 'each',
          size TEXT,
          weight TEXT,
          sku TEXT,
          upc TEXT,
          in_stock BOOLEAN DEFAULT 1,
          stock_quantity INTEGER,
          store_id TEXT,
          aisle_location TEXT,
          image_url TEXT,
          thumbnail_url TEXT,
          rating REAL,
          review_count INTEGER,
          is_featured BOOLEAN DEFAULT 0,
          is_on_sale BOOLEAN DEFAULT 0,
          sale_end_date TEXT,
          attributes JSON,
          nutritional_info JSON,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_walmart_products_product_id ON walmart_products(product_id);
        CREATE INDEX IF NOT EXISTS idx_walmart_products_category ON walmart_products(category);
        CREATE INDEX IF NOT EXISTS idx_walmart_products_in_stock ON walmart_products(in_stock);
        CREATE INDEX IF NOT EXISTS idx_walmart_products_store_id ON walmart_products(store_id);
      `);

      // Create grocery_lists table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS grocery_lists (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          list_name TEXT NOT NULL,
          description TEXT,
          list_type TEXT DEFAULT 'shopping',
          status TEXT DEFAULT 'active',
          store_preference TEXT,
          budget_limit REAL,
          estimated_total REAL,
          actual_total REAL,
          is_recurring BOOLEAN DEFAULT 0,
          recurrence_pattern JSON,
          next_shop_date TEXT,
          last_shopped_date TEXT,
          tags JSON,
          notes TEXT,
          shared_with JSON,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_id ON grocery_lists(user_id);
        CREATE INDEX IF NOT EXISTS idx_grocery_lists_status ON grocery_lists(status);
        CREATE INDEX IF NOT EXISTS idx_grocery_lists_list_type ON grocery_lists(list_type);
      `);

      // Create grocery_items table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS grocery_items (
          id TEXT PRIMARY KEY,
          list_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          brand_preference TEXT,
          product_id TEXT,
          category TEXT,
          quantity REAL DEFAULT 1,
          unit TEXT DEFAULT 'each',
          package_size TEXT,
          estimated_price REAL,
          actual_price REAL,
          discount_amount REAL,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'normal',
          aisle_location TEXT,
          added_to_cart_at TEXT,
          purchased_at TEXT,
          substitution_id TEXT,
          notes TEXT,
          dietary_flags JSON,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (list_id) REFERENCES grocery_lists(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES walmart_products(product_id)
        );

        CREATE INDEX IF NOT EXISTS idx_grocery_items_list_id ON grocery_items(list_id);
        CREATE INDEX IF NOT EXISTS idx_grocery_items_product_id ON grocery_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_grocery_items_status ON grocery_items(status);
      `);

      // Create shopping_sessions table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS shopping_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          list_id TEXT,
          session_type TEXT DEFAULT 'online',
          status TEXT DEFAULT 'active',
          items_total INTEGER DEFAULT 0,
          items_found INTEGER DEFAULT 0,
          items_substituted INTEGER DEFAULT 0,
          items_unavailable INTEGER DEFAULT 0,
          subtotal REAL,
          tax_amount REAL,
          delivery_fee REAL,
          tip_amount REAL,
          total_amount REAL,
          savings_amount REAL,
          started_at TEXT DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT,
          duration_minutes INTEGER,
          fulfillment_type TEXT,
          delivery_address JSON,
          delivery_time_slot TEXT,
          order_number TEXT,
          receipt_url TEXT,
          feedback_rating INTEGER,
          feedback_comment TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (list_id) REFERENCES grocery_lists(id)
        );

        CREATE INDEX IF NOT EXISTS idx_shopping_sessions_user_id ON shopping_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_shopping_sessions_status ON shopping_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_shopping_sessions_started_at ON shopping_sessions(started_at);
      `);

      // Create product_substitutions table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS product_substitutions (
          id TEXT PRIMARY KEY,
          original_product_id TEXT NOT NULL,
          substitute_product_id TEXT NOT NULL,
          confidence_score REAL NOT NULL,
          reason TEXT,
          price_difference REAL,
          size_difference TEXT,
          approved_count INTEGER DEFAULT 0,
          rejected_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (original_product_id) REFERENCES walmart_products(product_id),
          FOREIGN KEY (substitute_product_id) REFERENCES walmart_products(product_id),
          UNIQUE(original_product_id, substitute_product_id)
        );

        CREATE INDEX IF NOT EXISTS idx_substitutions_original ON product_substitutions(original_product_id);
        CREATE INDEX IF NOT EXISTS idx_substitutions_confidence ON product_substitutions(confidence_score);
      `);

      // Create user_preferences table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          preference_type TEXT NOT NULL,
          preference_value JSON NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          UNIQUE(user_id, preference_type)
        );

        CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_preferences_type ON user_preferences(preference_type);
      `);

      // Create price_tracking table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS price_tracking (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          price REAL NOT NULL,
          was_on_sale BOOLEAN DEFAULT 0,
          sale_percentage REAL,
          tracked_at TEXT DEFAULT CURRENT_TIMESTAMP,
          store_id TEXT,
          FOREIGN KEY (product_id) REFERENCES walmart_products(product_id)
        );

        CREATE INDEX IF NOT EXISTS idx_price_tracking_product_id ON price_tracking(product_id);
        CREATE INDEX IF NOT EXISTS idx_price_tracking_tracked_at ON price_tracking(tracked_at);
      `);

      // Create deal_alerts table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS deal_alerts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          alert_type TEXT NOT NULL,
          alert_config JSON NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          last_triggered_at TEXT,
          trigger_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_deal_alerts_user_id ON deal_alerts(user_id);
        CREATE INDEX IF NOT EXISTS idx_deal_alerts_is_active ON deal_alerts(is_active);
      `);

      logger.info('Walmart Grocery Agent migration completed successfully', 'MIGRATION');
    } catch (error) {
      logger.error(`Walmart Grocery Agent migration failed: ${error}`, 'MIGRATION');
      throw error;
    }
  }

  async down(): Promise<void> {
    logger.info('Rolling back Walmart Grocery Agent migration...', 'MIGRATION');

    try {
      // Drop tables in reverse order of dependencies
      const tables = [
        'deal_alerts',
        'price_tracking',
        'user_preferences',
        'product_substitutions',
        'shopping_sessions',
        'grocery_items',
        'grocery_lists',
        'walmart_products'
      ];

      for (const table of tables) {
        this.db.exec(`DROP TABLE IF EXISTS ${table}`);
      }

      logger.info('Walmart Grocery Agent migration rolled back successfully', 'MIGRATION');
    } catch (error) {
      logger.error(`Walmart Grocery Agent rollback failed: ${error}`, 'MIGRATION');
      throw error;
    }
  }
}