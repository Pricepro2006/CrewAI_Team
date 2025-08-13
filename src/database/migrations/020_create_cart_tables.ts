/**
 * Migration: Create Cart Tables
 * Creates tables for persistent cart storage with session and user support
 */

import type { Database } from "better-sqlite3";

export const up = (db: Database) => {
  // Shopping carts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_carts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      session_id TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'abandoned', 'converted', 'merged')),
      items_count INTEGER DEFAULT 0,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      shipping REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      metadata TEXT, -- JSON for additional data
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      converted_at DATETIME,
      merged_from TEXT, -- Reference to session cart that was merged
      
      -- Index for quick lookups
      CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
    );
    
    CREATE INDEX idx_carts_user_id ON shopping_carts(user_id);
    CREATE INDEX idx_carts_session_id ON shopping_carts(session_id);
    CREATE INDEX idx_carts_status ON shopping_carts(status);
    CREATE INDEX idx_carts_expires ON shopping_carts(expires_at);
    CREATE INDEX idx_carts_updated ON shopping_carts(updated_at);
  `);

  // Cart items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_image TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      sale_price REAL,
      total_price REAL GENERATED ALWAYS AS (
        COALESCE(sale_price, unit_price) * quantity
      ) STORED,
      savings REAL GENERATED ALWAYS AS (
        CASE 
          WHEN sale_price IS NOT NULL AND sale_price < unit_price 
          THEN (unit_price - sale_price) * quantity
          ELSE 0
        END
      ) STORED,
      metadata TEXT, -- JSON for product details, variants, etc
      notes TEXT,
      is_gift BOOLEAN DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (cart_id) REFERENCES shopping_carts(id) ON DELETE CASCADE,
      UNIQUE(cart_id, product_id),
      CHECK (quantity > 0),
      CHECK (unit_price >= 0),
      CHECK (sale_price IS NULL OR sale_price >= 0)
    );
    
    CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
    CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
    CREATE INDEX idx_cart_items_added ON cart_items(added_at);
  `);

  // Saved for later items
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_image TEXT,
      price REAL,
      metadata TEXT, -- JSON
      priority INTEGER DEFAULT 0,
      notes TEXT,
      moved_from_cart DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      UNIQUE(user_id, product_id)
    );
    
    CREATE INDEX idx_saved_items_user ON saved_items(user_id);
    CREATE INDEX idx_saved_items_product ON saved_items(product_id);
    CREATE INDEX idx_saved_items_priority ON saved_items(priority DESC);
  `);

  // Cart history for analytics
  db.exec(`
    CREATE TABLE IF NOT EXISTS cart_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN (
        'created', 'item_added', 'item_removed', 'item_updated',
        'cart_cleared', 'cart_abandoned', 'cart_recovered', 
        'cart_converted', 'cart_merged', 'cart_expired'
      )),
      product_id TEXT,
      quantity_change INTEGER,
      price_at_event REAL,
      metadata TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (cart_id) REFERENCES shopping_carts(id) ON DELETE CASCADE
    );
    
    CREATE INDEX idx_cart_events_cart ON cart_events(cart_id);
    CREATE INDEX idx_cart_events_type ON cart_events(event_type);
    CREATE INDEX idx_cart_events_created ON cart_events(created_at);
  `);

  // Recently viewed products for recommendations
  db.exec(`
    CREATE TABLE IF NOT EXISTS recently_viewed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      session_id TEXT,
      product_id TEXT NOT NULL,
      product_name TEXT,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      view_duration INTEGER, -- seconds
      interaction_type TEXT CHECK(interaction_type IN (
        'view', 'quick_view', 'compare', 'zoom'
      )),
      
      CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
    );
    
    CREATE INDEX idx_recently_viewed_user ON recently_viewed(user_id);
    CREATE INDEX idx_recently_viewed_session ON recently_viewed(session_id);
    CREATE INDEX idx_recently_viewed_product ON recently_viewed(product_id);
    CREATE INDEX idx_recently_viewed_at ON recently_viewed(viewed_at DESC);
  `);

  // Triggers for updated_at
  db.exec(`
    CREATE TRIGGER update_cart_timestamp 
    AFTER UPDATE ON shopping_carts
    FOR EACH ROW
    BEGIN
      UPDATE shopping_carts 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = NEW.id;
    END;
    
    CREATE TRIGGER update_cart_item_timestamp
    AFTER UPDATE ON cart_items
    FOR EACH ROW  
    BEGIN
      UPDATE cart_items 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = NEW.id;
      
      -- Also update parent cart
      UPDATE shopping_carts 
      SET updated_at = CURRENT_TIMESTAMP,
          items_count = (SELECT COUNT(*) FROM cart_items WHERE cart_id = NEW.cart_id),
          subtotal = (SELECT COALESCE(SUM(total_price), 0) FROM cart_items WHERE cart_id = NEW.cart_id)
      WHERE id = NEW.cart_id;
    END;
    
    CREATE TRIGGER log_cart_item_added
    AFTER INSERT ON cart_items
    FOR EACH ROW
    BEGIN
      INSERT INTO cart_events (cart_id, event_type, product_id, quantity_change, price_at_event)
      VALUES (NEW.cart_id, 'item_added', NEW.product_id, NEW.quantity, NEW.unit_price);
      
      UPDATE shopping_carts 
      SET items_count = (SELECT COUNT(*) FROM cart_items WHERE cart_id = NEW.cart_id),
          subtotal = (SELECT COALESCE(SUM(total_price), 0) FROM cart_items WHERE cart_id = NEW.cart_id)
      WHERE id = NEW.cart_id;
    END;
    
    CREATE TRIGGER log_cart_item_removed
    AFTER DELETE ON cart_items
    FOR EACH ROW
    BEGIN
      INSERT INTO cart_events (cart_id, event_type, product_id, quantity_change, price_at_event)
      VALUES (OLD.cart_id, 'item_removed', OLD.product_id, -OLD.quantity, OLD.unit_price);
      
      UPDATE shopping_carts 
      SET items_count = (SELECT COUNT(*) FROM cart_items WHERE cart_id = OLD.cart_id),
          subtotal = (SELECT COALESCE(SUM(total_price), 0) FROM cart_items WHERE cart_id = OLD.cart_id)
      WHERE id = OLD.cart_id;
    END;
  `);
};

export const down = (db: Database) => {
  db.exec(`
    DROP TRIGGER IF EXISTS log_cart_item_removed;
    DROP TRIGGER IF EXISTS log_cart_item_added;
    DROP TRIGGER IF EXISTS update_cart_item_timestamp;
    DROP TRIGGER IF EXISTS update_cart_timestamp;
    DROP TABLE IF EXISTS recently_viewed;
    DROP TABLE IF EXISTS cart_events;
    DROP TABLE IF EXISTS saved_items;
    DROP TABLE IF EXISTS cart_items;
    DROP TABLE IF EXISTS shopping_carts;
  `);
};