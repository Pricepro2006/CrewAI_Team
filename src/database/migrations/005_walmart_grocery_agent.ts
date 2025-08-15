/**
 * Migration: Walmart Grocery Agent Database Schema
 * Adds tables for grocery shopping list management, product data, and agent interactions
 */

import type Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

export class WalmartGroceryAgentMigration {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async up(): Promise<void> {
    logger.info("Applying Walmart Grocery Agent migration...", "MIGRATION");

    try {
      // Create grocery-specific tables
      this.createGroceryListsTable();
      this.createGroceryItemsTable();
      this.createWalmartProductsTable();
      this.createPriceHistoryTable();
      this.createShoppingSessionsTable();
      this.createUserPreferencesTable();
      this.createSubstitutionsTable();
      this.createGroceryConversationsTable();

      // Add indexes for performance
      this.createIndexes();

      logger.info(
        "Walmart Grocery Agent migration completed successfully",
        "MIGRATION",
      );
    } catch (error) {
      logger.error(
        `Walmart Grocery Agent migration failed: ${error}`,
        "MIGRATION",
      );
      throw error;
    }
  }

  async down(): Promise<void> {
    logger.info("Rolling back Walmart Grocery Agent migration...", "MIGRATION");

    const tables = [
      "grocery_substitutions",
      "grocery_user_preferences",
      "shopping_sessions",
      "price_history",
      "walmart_products",
      "grocery_items",
      "grocery_lists",
      "grocery_conversations",
    ];

    for (const table of tables) {
      this?.db?.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    }

    logger.info("Walmart Grocery Agent migration rolled back", "MIGRATION");
  }

  private createGroceryListsTable(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS grocery_lists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        list_name TEXT NOT NULL,
        description TEXT,
        
        -- List metadata
        list_type TEXT DEFAULT 'shopping' CHECK (list_type IN ('shopping', 'pantry', 'recipe', 'recurring')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'template')),
        
        -- Shopping details
        store_preference TEXT DEFAULT 'walmart',
        budget_limit DECIMAL(10,2),
        estimated_total DECIMAL(10,2),
        actual_total DECIMAL(10,2),
        
        -- Scheduling
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern TEXT, -- JSON with recurrence rules
        next_shop_date DATE,
        last_shopped_date DATE,
        
        -- Metadata
        tags TEXT, -- JSON array of tags
        notes TEXT,
        shared_with TEXT, -- JSON array of user IDs
        
        -- Audit
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
      )
      .run();
  }

  private createGroceryItemsTable(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS grocery_items (
        id TEXT PRIMARY KEY,
        list_id TEXT NOT NULL,
        
        -- Item details
        item_name TEXT NOT NULL,
        brand_preference TEXT,
        product_id TEXT, -- Walmart product ID if matched
        category TEXT,
        
        -- Quantity and units
        quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
        unit TEXT DEFAULT 'each', -- each, lb, oz, etc.
        package_size TEXT,
        
        -- Pricing
        estimated_price DECIMAL(10,2),
        actual_price DECIMAL(10,2),
        discount_amount DECIMAL(10,2),
        
        -- Item status
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_cart', 'purchased', 'unavailable', 'substituted', 'removed')),
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('essential', 'high', 'normal', 'low')),
        
        -- Shopping metadata
        aisle_location TEXT,
        added_to_cart_at TIMESTAMP,
        purchased_at TIMESTAMP,
        substitution_id TEXT,
        
        -- Notes and preferences
        notes TEXT,
        dietary_flags TEXT, -- JSON array: ['organic', 'gluten-free', etc.]
        
        -- Audit
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (list_id) REFERENCES grocery_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES walmart_products(product_id) ON DELETE SET NULL,
        FOREIGN KEY (substitution_id) REFERENCES grocery_items(id) ON DELETE SET NULL
      )
    `,
      )
      .run();
  }

  private createWalmartProductsTable(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS walmart_products (
        product_id TEXT PRIMARY KEY, -- Walmart's product ID
        
        -- Product information
        name TEXT NOT NULL,
        brand TEXT,
        description TEXT,
        category_path TEXT, -- Full category hierarchy
        department TEXT,
        
        -- Pricing
        current_price DECIMAL(10,2),
        regular_price DECIMAL(10,2),
        unit_price DECIMAL(10,2),
        unit_measure TEXT,
        
        -- Availability
        in_stock BOOLEAN DEFAULT TRUE,
        stock_level INTEGER,
        online_only BOOLEAN DEFAULT FALSE,
        store_only BOOLEAN DEFAULT FALSE,
        
        -- Product details
        upc TEXT,
        sku TEXT,
        model_number TEXT,
        manufacturer TEXT,
        
        -- Images and media
        thumbnail_url TEXT,
        large_image_url TEXT,
        
        -- Ratings and reviews
        average_rating DECIMAL(3,2),
        review_count INTEGER,
        
        -- Nutritional info (for food items)
        nutritional_info TEXT, -- JSON with detailed nutrition
        ingredients TEXT,
        allergens TEXT, -- JSON array
        
        -- Metadata
        size_info TEXT,
        weight_info TEXT,
        product_attributes TEXT, -- JSON with various attributes
        
        -- Search and matching
        search_keywords TEXT,
        embedding_vector BLOB, -- For similarity matching
        
        -- Audit
        first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_checked_at TIMESTAMP
      )
    `,
      )
      .run();
  }

  private createPriceHistoryTable(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS price_history (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        
        -- Price data
        price DECIMAL(10,2) NOT NULL,
        was_on_sale BOOLEAN DEFAULT FALSE,
        sale_percentage DECIMAL(5,2),
        
        -- Context
        store_id TEXT,
        availability TEXT,
        
        -- Timestamp
        recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (product_id) REFERENCES walmart_products(product_id) ON DELETE CASCADE,
        INDEX idx_price_history_product_date (product_id, recorded_at)
      )
    `,
      )
      .run();
  }

  private createShoppingSessionsTable(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS shopping_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        list_id TEXT,
        
        -- Session details
        session_type TEXT DEFAULT 'online' CHECK (session_type IN ('online', 'in_store', 'pickup', 'delivery')),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'cancelled')),
        
        -- Shopping progress
        items_total INTEGER DEFAULT 0,
        items_found INTEGER DEFAULT 0,
        items_substituted INTEGER DEFAULT 0,
        items_unavailable INTEGER DEFAULT 0,
        
        -- Financial summary
        subtotal DECIMAL(10,2),
        tax_amount DECIMAL(10,2),
        delivery_fee DECIMAL(10,2),
        tip_amount DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        savings_amount DECIMAL(10,2),
        
        -- Timing
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        duration_minutes INTEGER,
        
        -- Delivery/Pickup details
        fulfillment_type TEXT,
        delivery_address TEXT,
        delivery_time_slot TEXT,
        
        -- Metadata
        order_number TEXT,
        receipt_url TEXT,
        feedback_rating INTEGER,
        feedback_comment TEXT,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (list_id) REFERENCES grocery_lists(id) ON DELETE SET NULL
      )
    `,
      )
      .run();
  }

  private createUserPreferencesTable(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS grocery_user_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        
        -- Shopping preferences
        default_store_id TEXT,
        preferred_brands TEXT, -- JSON object by category
        avoided_brands TEXT, -- JSON array
        
        -- Dietary preferences
        dietary_restrictions TEXT, -- JSON array: ['vegetarian', 'gluten-free', etc.]
        allergens TEXT, -- JSON array
        preferred_organic BOOLEAN DEFAULT FALSE,
        preferred_local BOOLEAN DEFAULT FALSE,
        
        -- Budget preferences
        monthly_budget DECIMAL(10,2),
        price_sensitivity TEXT DEFAULT 'medium' CHECK (price_sensitivity IN ('low', 'medium', 'high')),
        
        -- Shopping behavior
        typical_shop_day TEXT, -- Day of week
        typical_shop_time TEXT, -- Time of day
        avg_items_per_trip INTEGER,
        
        -- Substitution preferences
        allow_substitutions BOOLEAN DEFAULT TRUE,
        substitution_rules TEXT, -- JSON with detailed rules
        
        -- Communication preferences
        notification_preferences TEXT, -- JSON with notification settings
        language_preference TEXT DEFAULT 'en',
        
        -- AI assistant preferences
        assistant_personality TEXT DEFAULT 'helpful' CHECK (assistant_personality IN ('professional', 'friendly', 'helpful', 'concise')),
        suggestion_frequency TEXT DEFAULT 'moderate' CHECK (suggestion_frequency IN ('minimal', 'moderate', 'frequent')),
        
        -- Metadata
        onboarding_completed BOOLEAN DEFAULT FALSE,
        last_preference_review TIMESTAMP,
        
        -- Audit
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
      )
      .run();
  }

  private createSubstitutionsTable(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS grocery_substitutions (
        id TEXT PRIMARY KEY,
        original_product_id TEXT,
        substitute_product_id TEXT,
        
        -- Substitution details
        reason TEXT,
        similarity_score DECIMAL(3,2), -- 0-1 score
        price_difference DECIMAL(10,2),
        
        -- User feedback
        user_id TEXT,
        accepted BOOLEAN,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        feedback TEXT,
        
        -- Metadata
        suggested_by TEXT DEFAULT 'system' CHECK (suggested_by IN ('system', 'user', 'store')),
        
        -- Audit
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (original_product_id) REFERENCES walmart_products(product_id) ON DELETE CASCADE,
        FOREIGN KEY (substitute_product_id) REFERENCES walmart_products(product_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `,
      )
      .run();
  }

  private createGroceryConversationsTable(): void {
    this.db
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS grocery_conversations (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        
        -- Context
        list_id TEXT,
        session_id TEXT,
        
        -- Conversation metadata
        intent_type TEXT, -- 'create_list', 'add_items', 'find_deals', etc.
        extracted_entities TEXT, -- JSON with extracted items, quantities, etc.
        
        -- State management
        conversation_state TEXT, -- JSON with current state
        pending_actions TEXT, -- JSON array of actions to take
        
        -- Performance metrics
        understanding_confidence DECIMAL(3,2),
        task_completion_rate DECIMAL(3,2),
        
        -- Audit
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (list_id) REFERENCES grocery_lists(id) ON DELETE SET NULL,
        FOREIGN KEY (session_id) REFERENCES shopping_sessions(id) ON DELETE SET NULL
      )
    `,
      )
      .run();
  }

  private createIndexes(): void {
    // Grocery lists indexes
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_status ON grocery_lists(user_id, status)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_grocery_lists_next_shop ON grocery_lists(next_shop_date)",
      )
      .run();

    // Grocery items indexes
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_grocery_items_list_status ON grocery_items(list_id, status)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_grocery_items_product ON grocery_items(product_id)",
      )
      .run();

    // Walmart products indexes
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_walmart_products_category ON walmart_products(category_path)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_walmart_products_brand ON walmart_products(brand)",
      )
      .run();
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_walmart_products_search ON walmart_products(name, search_keywords)",
      )
      .run();

    // Shopping sessions indexes
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_shopping_sessions_user ON shopping_sessions(user_id, status)",
      )
      .run();

    // Substitutions indexes
    this.db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_substitutions_products ON grocery_substitutions(original_product_id, substitute_product_id)",
      )
      .run();
  }

  // Migration metadata
  static get version(): number {
    return 5;
  }

  static get name(): string {
    return "walmart_grocery_agent";
  }

  static get description(): string {
    return "Add tables for Walmart grocery shopping agent functionality";
  }
}

export default WalmartGroceryAgentMigration;
