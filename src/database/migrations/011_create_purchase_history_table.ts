import Database from "better-sqlite3";

/**
 * Migration: Create purchase history table
 * Version: 011
 * Description: Creates comprehensive purchase history tracking with product details, prices, quantities, and dates
 */

export function up(db: Database) {
  console.log("Creating purchase history table...");

  // Create purchase_history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      
      -- Purchase transaction details
      transaction_id TEXT, -- Store receipt/transaction number
      purchase_date TEXT NOT NULL,
      purchase_time TEXT, -- HH:MM:SS format
      
      -- Store information
      store_id TEXT,
      store_name TEXT NOT NULL,
      store_location TEXT,
      cashier_id TEXT,
      register_number TEXT,
      
      -- Product details
      product_name TEXT NOT NULL,
      product_brand TEXT,
      product_category TEXT NOT NULL,
      product_subcategory TEXT,
      upc_code TEXT,
      sku TEXT,
      product_size TEXT,
      product_description TEXT,
      
      -- Quantity and measurements
      quantity DECIMAL(10,3) NOT NULL DEFAULT 1.0,
      unit TEXT DEFAULT 'item', -- 'item', 'lb', 'oz', 'gallon', 'pack', etc.
      weight_actual DECIMAL(10,3), -- For items sold by weight
      weight_unit TEXT, -- 'lb', 'oz', 'kg', 'g'
      
      -- Pricing details
      unit_price DECIMAL(10,4) NOT NULL,
      extended_price DECIMAL(10,2) NOT NULL, -- quantity * unit_price
      original_price DECIMAL(10,4), -- Before any discounts
      discount_amount DECIMAL(10,2) DEFAULT 0.00,
      discount_type TEXT, -- 'coupon', 'sale', 'loyalty', 'bulk', 'manufacturer'
      tax_amount DECIMAL(10,2) DEFAULT 0.00,
      final_price DECIMAL(10,2) NOT NULL, -- What was actually paid
      
      -- Payment and receipt info
      payment_method TEXT, -- 'cash', 'credit', 'debit', 'ebt', 'gift_card'
      currency TEXT DEFAULT 'USD',
      receipt_number TEXT,
      receipt_image_path TEXT,
      
      -- Nutritional and product attributes
      is_organic BOOLEAN DEFAULT false,
      is_gluten_free BOOLEAN DEFAULT false,
      is_vegan BOOLEAN DEFAULT false,
      is_vegetarian BOOLEAN DEFAULT false,
      dietary_attributes TEXT, -- JSON array of dietary tags
      allergen_info TEXT, -- JSON array of allergens
      nutritional_info TEXT, -- JSON with nutritional data if available
      
      -- Product lifecycle
      expiration_date TEXT,
      best_by_date TEXT,
      lot_number TEXT,
      production_date TEXT,
      
      -- Purchase context
      list_id TEXT, -- Which grocery list this was purchased from (if applicable)
      was_planned BOOLEAN DEFAULT false, -- Was this item on a grocery list?
      was_substitution BOOLEAN DEFAULT false, -- Was this a substitution for planned item?
      original_planned_item TEXT, -- What was originally planned if substitution
      
      -- Quality and satisfaction
      quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
      would_buy_again BOOLEAN,
      satisfaction_notes TEXT,
      
      -- Seasonal and trend data
      season TEXT, -- 'spring', 'summer', 'fall', 'winter'
      is_holiday_purchase BOOLEAN DEFAULT false,
      holiday_type TEXT, -- 'thanksgiving', 'christmas', 'easter', etc.
      
      -- Price tracking and comparison
      price_per_unit_standardized DECIMAL(10,4), -- Normalized to common unit (per lb, per oz, etc.)
      price_trend TEXT DEFAULT 'stable', -- 'up', 'down', 'stable', 'volatile'
      is_lowest_seen_price BOOLEAN DEFAULT false,
      is_highest_seen_price BOOLEAN DEFAULT false,
      price_comparison_data TEXT, -- JSON with price history and comparisons
      
      -- Return and exchange info
      is_returned BOOLEAN DEFAULT false,
      return_date TEXT,
      return_reason TEXT,
      refund_amount DECIMAL(10,2),
      
      -- Analytics and metadata
      shopping_trip_id TEXT, -- Group items from same shopping trip
      total_trip_amount DECIMAL(10,2), -- Total amount spent on this shopping trip
      trip_item_count INTEGER, -- How many different items in this trip
      time_in_store INTEGER, -- Minutes spent shopping (if tracked)
      
      -- External integrations
      loyalty_points_earned INTEGER DEFAULT 0,
      cashback_earned DECIMAL(10,2) DEFAULT 0.00,
      fuel_points_earned INTEGER DEFAULT 0,
      
      -- Data sources and validation
      data_source TEXT DEFAULT 'manual', -- 'manual', 'receipt_scan', 'api', 'import'
      data_confidence DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0 confidence in data accuracy
      verification_status TEXT DEFAULT 'unverified', -- 'verified', 'unverified', 'disputed'
      
      -- Flexible metadata
      tags TEXT, -- JSON array of custom tags
      notes TEXT,
      metadata TEXT, -- JSON for additional flexible data
      
      -- Audit trail
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT DEFAULT 'system',
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES grocery_stores(id) ON DELETE SET NULL,
      FOREIGN KEY (list_id) REFERENCES grocery_lists(id) ON DELETE SET NULL
    );
  `);

  // Create purchase_receipts table for receipt-level information
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_receipts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      
      -- Receipt identification
      receipt_number TEXT,
      transaction_id TEXT UNIQUE,
      
      -- Store and transaction details
      store_id TEXT,
      store_name TEXT NOT NULL,
      store_address TEXT,
      store_phone TEXT,
      
      -- Transaction timing
      purchase_date TEXT NOT NULL,
      purchase_time TEXT,
      cashier_id TEXT,
      register_number TEXT,
      
      -- Financial summary
      subtotal DECIMAL(10,2) NOT NULL,
      tax_total DECIMAL(10,2) DEFAULT 0.00,
      discount_total DECIMAL(10,2) DEFAULT 0.00,
      final_total DECIMAL(10,2) NOT NULL,
      amount_paid DECIMAL(10,2),
      change_given DECIMAL(10,2) DEFAULT 0.00,
      
      -- Payment breakdown
      payment_methods TEXT, -- JSON array of payment methods used
      tip_amount DECIMAL(10,2) DEFAULT 0.00,
      
      -- Receipt processing
      receipt_image_path TEXT,
      receipt_text TEXT, -- OCR extracted text
      processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
      processing_confidence DECIMAL(3,2),
      
      -- Loyalty and rewards
      loyalty_account_number TEXT,
      loyalty_points_earned INTEGER DEFAULT 0,
      loyalty_points_redeemed INTEGER DEFAULT 0,
      cashback_earned DECIMAL(10,2) DEFAULT 0.00,
      fuel_points_earned INTEGER DEFAULT 0,
      
      -- Coupons and discounts
      coupons_used TEXT, -- JSON array of coupon details
      manufacturer_coupons DECIMAL(10,2) DEFAULT 0.00,
      store_coupons DECIMAL(10,2) DEFAULT 0.00,
      digital_coupons DECIMAL(10,2) DEFAULT 0.00,
      
      -- Trip context
      shopping_trip_duration INTEGER, -- Minutes
      item_count INTEGER,
      
      -- Quality and validation
      is_validated BOOLEAN DEFAULT false,
      validation_date TEXT,
      validation_notes TEXT,
      
      -- Metadata
      tags TEXT, -- JSON array
      notes TEXT,
      metadata TEXT, -- JSON
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES grocery_stores(id) ON DELETE SET NULL
    );
  `);

  -- Create comprehensive indexes for purchase_history
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_purchase_history_user_id ON purchase_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_purchase_date ON purchase_history(purchase_date DESC);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_product_name ON purchase_history(product_name);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_product_brand ON purchase_history(product_brand);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_product_category ON purchase_history(product_category);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_store_name ON purchase_history(store_name);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_upc ON purchase_history(upc_code);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_transaction ON purchase_history(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_shopping_trip ON purchase_history(shopping_trip_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_list_id ON purchase_history(list_id);
    
    -- Price analysis indexes
    CREATE INDEX IF NOT EXISTS idx_purchase_history_price_trend ON purchase_history(product_name, product_brand, purchase_date);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_price_analysis ON purchase_history(upc_code, purchase_date, unit_price);
    
    -- Analytics indexes
    CREATE INDEX IF NOT EXISTS idx_purchase_history_seasonal ON purchase_history(season, product_category);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_dietary ON purchase_history(is_organic, is_gluten_free, is_vegan);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_quality ON purchase_history(quality_rating, would_buy_again);
    
    -- Composite indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_purchase_history_user_date_category ON purchase_history(user_id, purchase_date DESC, product_category);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_user_brand_category ON purchase_history(user_id, product_brand, product_category);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_user_store_date ON purchase_history(user_id, store_name, purchase_date DESC);
  `);

  -- Create indexes for purchase_receipts
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_user_id ON purchase_receipts(user_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_date ON purchase_receipts(purchase_date DESC);
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_store ON purchase_receipts(store_name);
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_transaction ON purchase_receipts(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_processing ON purchase_receipts(processing_status);
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_total ON purchase_receipts(final_total DESC);
    
    -- Composite indexes
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_user_store_date ON purchase_receipts(user_id, store_name, purchase_date DESC);
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_validation ON purchase_receipts(is_validated, purchase_date DESC);
  `);

  console.log("✅ Purchase history table created successfully");
}

export function down(db: Database) {
  console.log("Dropping purchase history table...");

  db.exec(`DROP TABLE IF EXISTS purchase_receipts;`);
  db.exec(`DROP TABLE IF EXISTS purchase_history;`);

  console.log("✅ Purchase history table dropped successfully");
}