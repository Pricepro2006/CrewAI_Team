import Database from "better-sqlite3";

/**
 * Migration: Create grocery base tables (grocery_lists and grocery_items)
 * Version: 010
 * Description: Creates foundational grocery system tables for user shopping lists and items
 */

export function up(db: Database) {
  console.log("Creating grocery base tables...");

  // Create grocery_lists table
  db.exec(`
    CREATE TABLE IF NOT EXISTS grocery_lists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'cancelled')),
      category TEXT DEFAULT 'general' CHECK (category IN ('general', 'weekly', 'monthly', 'special_occasion', 'bulk', 'meal_prep')),
      total_estimated_cost DECIMAL(10,2) DEFAULT 0.00,
      total_actual_cost DECIMAL(10,2) DEFAULT 0.00,
      store_preference TEXT,
      priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
      is_recurring BOOLEAN DEFAULT false,
      recurrence_pattern TEXT, -- JSON: {type: 'weekly', interval: 1, days: ['monday', 'friday']}
      next_occurrence_date TEXT,
      shared_with TEXT, -- JSON array of user IDs who can view/edit this list
      shopping_date TEXT,
      completed_date TEXT,
      notes TEXT,
      metadata TEXT, -- JSON for additional flexible data
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create grocery_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS grocery_items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      
      -- Product identification
      product_name TEXT NOT NULL,
      product_brand TEXT,
      product_category TEXT, -- 'produce', 'dairy', 'meat', 'pantry', 'frozen', 'beverages', etc.
      product_subcategory TEXT,
      upc_code TEXT,
      product_size TEXT, -- '1 lb', '64 oz', '12 pack', etc.
      
      -- Quantity and units
      quantity INTEGER NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'item', -- 'item', 'lb', 'oz', 'gallon', 'pack', etc.
      quantity_description TEXT, -- Human readable: "2 bags", "1 dozen", etc.
      
      -- Pricing information
      estimated_price DECIMAL(8,2),
      actual_price DECIMAL(8,2),
      price_per_unit DECIMAL(8,2),
      unit_of_measure TEXT, -- What the price_per_unit refers to
      
      -- Item status and metadata
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_cart', 'purchased', 'out_of_stock', 'cancelled')),
      priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
      is_essential BOOLEAN DEFAULT false,
      is_organic BOOLEAN DEFAULT false,
      
      -- Store and availability info
      preferred_store TEXT,
      aisle_location TEXT,
      shelf_location TEXT, -- 'top', 'middle', 'bottom', 'endcap', etc.
      availability_status TEXT DEFAULT 'unknown' CHECK (availability_status IN ('available', 'limited', 'out_of_stock', 'seasonal', 'unknown')),
      
      -- Nutritional preferences and restrictions
      dietary_tags TEXT, -- JSON array: ['gluten_free', 'organic', 'vegan', 'keto', etc.]
      allergen_warnings TEXT, -- JSON array: ['nuts', 'dairy', 'gluten', etc.]
      nutritional_notes TEXT,
      
      -- Purchase tracking
      purchase_date TEXT,
      expiration_date TEXT,
      lot_number TEXT,
      
      -- Notes and customization
      special_instructions TEXT, -- "Extra ripe", "Low sodium", etc.
      substitution_allowed BOOLEAN DEFAULT true,
      substitution_notes TEXT,
      notes TEXT,
      
      -- Relationships and recommendations
      recipe_reference TEXT, -- Link to recipe if this item is for specific cooking
      similar_items TEXT, -- JSON array of similar product IDs for recommendations
      
      -- Metadata
      metadata TEXT, -- JSON for flexible additional data
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (list_id) REFERENCES grocery_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create grocery_stores table for store information
  db.exec(`
    CREATE TABLE IF NOT EXISTS grocery_stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      chain_name TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip_code TEXT,
      phone TEXT,
      website TEXT,
      store_hours TEXT, -- JSON: {monday: '6:00-22:00', tuesday: '6:00-22:00', ...}
      
      -- Store features
      has_pharmacy BOOLEAN DEFAULT false,
      has_deli BOOLEAN DEFAULT false,
      has_bakery BOOLEAN DEFAULT false,
      has_gas_station BOOLEAN DEFAULT false,
      has_organic_section BOOLEAN DEFAULT false,
      has_curbside_pickup BOOLEAN DEFAULT false,
      has_delivery BOOLEAN DEFAULT false,
      
      -- Geographic and contact info
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      timezone TEXT,
      
      -- API integration
      api_store_id TEXT, -- External API store identifier
      supports_price_api BOOLEAN DEFAULT false,
      supports_inventory_api BOOLEAN DEFAULT false,
      
      -- Store metadata
      store_layout TEXT, -- JSON map of aisles and sections
      average_checkout_time INTEGER, -- Minutes
      busy_hours TEXT, -- JSON array of hour ranges when store is typically busy
      
      is_active BOOLEAN DEFAULT true,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create basic indexes for grocery_lists
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_id ON grocery_lists(user_id);
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_status ON grocery_lists(status);
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_category ON grocery_lists(category);
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_shopping_date ON grocery_lists(shopping_date);
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_priority ON grocery_lists(priority DESC);
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_created_at ON grocery_lists(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_recurring ON grocery_lists(is_recurring, next_occurrence_date);
  `);

  // Create basic indexes for grocery_items
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grocery_items_list_id ON grocery_items(list_id);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_user_id ON grocery_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_status ON grocery_items(status);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_category ON grocery_items(product_category);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_brand ON grocery_items(product_brand);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_upc ON grocery_items(upc_code);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_priority ON grocery_items(priority DESC);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_essential ON grocery_items(is_essential);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_purchase_date ON grocery_items(purchase_date);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_expiration ON grocery_items(expiration_date);
  `);

  // Create indexes for grocery_stores
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grocery_stores_name ON grocery_stores(name);
    CREATE INDEX IF NOT EXISTS idx_grocery_stores_chain ON grocery_stores(chain_name);
    CREATE INDEX IF NOT EXISTS idx_grocery_stores_city ON grocery_stores(city);
    CREATE INDEX IF NOT EXISTS idx_grocery_stores_zip ON grocery_stores(zip_code);
    CREATE INDEX IF NOT EXISTS idx_grocery_stores_location ON grocery_stores(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_grocery_stores_active ON grocery_stores(is_active);
    CREATE INDEX IF NOT EXISTS idx_grocery_stores_api ON grocery_stores(api_store_id);
  `);

  console.log("✅ Grocery base tables created successfully");
}

export function down(db: Database) {
  console.log("Dropping grocery base tables...");

  // Drop tables in reverse order due to foreign key constraints
  db.exec(`DROP TABLE IF EXISTS grocery_stores;`);
  db.exec(`DROP TABLE IF EXISTS grocery_items;`);
  db.exec(`DROP TABLE IF EXISTS grocery_lists;`);

  console.log("✅ Grocery base tables dropped successfully");
}