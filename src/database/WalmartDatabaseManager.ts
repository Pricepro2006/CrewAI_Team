/**
 * Walmart Database Manager - Dedicated database management for Walmart Grocery Agent
 * Uses separate walmart_grocery.db to maintain separation of concerns
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { logger } from "../utils/logger.js";
import { walmartConfig, type WalmartDatabaseConfig } from "../config/walmart.config.js";

// Repository imports
import {
  WalmartProductRepository,
  SubstitutionRepository,
  UserPreferencesRepository,
} from "./repositories/WalmartProductRepository.js";
import {
  GroceryListRepository,
  GroceryItemRepository,
  ShoppingSessionRepository,
} from "./repositories/GroceryRepository.js";

export class WalmartDatabaseManager {
  private static instance: WalmartDatabaseManager;
  private db: Database.Database;
  private isInitialized: boolean = false;

  // Repository instances
  public readonly walmartProducts: WalmartProductRepository;
  public readonly substitutions: SubstitutionRepository;
  public readonly userPreferences: UserPreferencesRepository;
  public readonly groceryLists: GroceryListRepository;
  public readonly groceryItems: GroceryItemRepository;
  public readonly shoppingSessions: ShoppingSessionRepository;

  private constructor(config?: Partial<WalmartDatabaseConfig>) {
    const dbConfig = {
      ...walmartConfig,
      ...config,
    };

    // Ensure data directory exists
    const dbPath = dbConfig?.sqlite?.path;
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
      logger.info(`Created data directory: ${dataDir}`, "WALMART_DB");
    }

    // Initialize database connection
    this.db = new Database(dbPath);
    
    // Configure database settings
    this?.db?.pragma(`journal_mode = ${dbConfig?.sqlite?.enableWAL ? 'WAL' : 'DELETE'}`);
    this?.db?.pragma(`foreign_keys = ${dbConfig?.sqlite?.enableForeignKeys ? 'ON' : 'OFF'}`);
    this?.db?.pragma(`cache_size = ${dbConfig?.sqlite?.cacheSize}`);
    this?.db?.pragma(`mmap_size = ${dbConfig?.sqlite?.memoryMap}`);
    this?.db?.pragma(`busy_timeout = ${dbConfig?.sqlite?.busyTimeout}`);

    // Initialize repositories
    this.walmartProducts = new WalmartProductRepository(this.db);
    this.substitutions = new SubstitutionRepository(this.db);
    this.userPreferences = new UserPreferencesRepository(this.db);
    this.groceryLists = new GroceryListRepository(this.db);
    this.groceryItems = new GroceryItemRepository(this.db);
    this.shoppingSessions = new ShoppingSessionRepository(this.db);

    logger.info(
      `Walmart Database Manager initialized with database at: ${dbPath}`,
      "WALMART_DB"
    );
  }

  static getInstance(config?: Partial<WalmartDatabaseConfig>): WalmartDatabaseManager {
    if (!WalmartDatabaseManager.instance) {
      WalmartDatabaseManager.instance = new WalmartDatabaseManager(config);
    }
    return WalmartDatabaseManager.instance;
  }

  /**
   * Initialize the Walmart database with schema and sample data
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Walmart database already initialized", "WALMART_DB");
      return;
    }

    try {
      logger.info("Initializing Walmart database...", "WALMART_DB");

      // Create tables if they don't exist
      await this.createTables();

      // Insert sample data if tables are empty
      await this.seedSampleData();

      this.isInitialized = true;
      logger.info("Walmart database initialized successfully", "WALMART_DB");
    } catch (error) {
      logger.error(`Walmart database initialization failed: ${error}`, "WALMART_DB");
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const createTablesSql = `
      -- Walmart Products Table
      CREATE TABLE IF NOT EXISTS walmart_products (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        product_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        brand TEXT,
        description TEXT,
        category_path TEXT,
        department TEXT,
        current_price REAL,
        regular_price REAL,
        unit_price REAL,
        unit_measure TEXT,
        in_stock BOOLEAN DEFAULT 1,
        stock_level INTEGER,
        online_only BOOLEAN DEFAULT 0,
        store_only BOOLEAN DEFAULT 0,
        upc TEXT,
        sku TEXT,
        model_number TEXT,
        manufacturer TEXT,
        thumbnail_url TEXT,
        large_image_url TEXT,
        average_rating REAL,
        review_count INTEGER,
        nutritional_info TEXT,
        ingredients TEXT,
        allergens TEXT,
        size_info TEXT,
        weight_info TEXT,
        product_attributes TEXT,
        search_keywords TEXT,
        embedding_vector BLOB,
        first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Grocery Lists Table
      CREATE TABLE IF NOT EXISTS grocery_lists (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        list_name TEXT NOT NULL,
        description TEXT,
        list_type TEXT DEFAULT 'shopping',
        status TEXT DEFAULT 'active',
        store_id TEXT,
        estimated_total REAL DEFAULT 0,
        actual_total REAL,
        items_count INTEGER DEFAULT 0,
        completed_at DATETIME,
        shared_with TEXT,
        tags TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Grocery Items Table
      CREATE TABLE IF NOT EXISTS grocery_items (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        list_id TEXT NOT NULL,
        product_id TEXT,
        item_name TEXT NOT NULL,
        brand_preference TEXT,
        quantity REAL DEFAULT 1,
        unit TEXT DEFAULT 'each',
        category TEXT,
        estimated_price REAL,
        actual_price REAL,
        coupon_applied BOOLEAN DEFAULT 0,
        coupon_amount REAL,
        substitution_allowed BOOLEAN DEFAULT 1,
        substitute_product_id TEXT,
        notes TEXT,
        priority INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending',
        found_in_store BOOLEAN,
        aisle_location TEXT,
        checked_at DATETIME,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES grocery_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES walmart_products(product_id) ON DELETE SET NULL
      );

      -- User Preferences Table
      CREATE TABLE IF NOT EXISTS grocery_user_preferences (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT UNIQUE NOT NULL,
        default_store_id TEXT,
        preferred_brands TEXT,
        avoided_brands TEXT,
        dietary_restrictions TEXT,
        allergens TEXT,
        preferred_organic BOOLEAN DEFAULT 0,
        preferred_local BOOLEAN DEFAULT 0,
        monthly_budget REAL,
        price_sensitivity TEXT DEFAULT 'medium',
        typical_shop_day TEXT,
        typical_shop_time TEXT,
        avg_items_per_trip INTEGER,
        allow_substitutions BOOLEAN DEFAULT 1,
        substitution_rules TEXT,
        notification_preferences TEXT,
        language_preference TEXT DEFAULT 'en',
        assistant_personality TEXT DEFAULT 'helpful',
        suggestion_frequency TEXT DEFAULT 'moderate',
        onboarding_completed BOOLEAN DEFAULT 0,
        last_preference_review DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Price History Table
      CREATE TABLE IF NOT EXISTS price_history (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        product_id TEXT NOT NULL,
        price REAL NOT NULL,
        was_on_sale BOOLEAN DEFAULT 0,
        sale_percentage REAL,
        store_id TEXT,
        availability TEXT,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES walmart_products(product_id) ON DELETE CASCADE
      );

      -- NLP Intents Table for Qwen3:0.6b
      CREATE TABLE IF NOT EXISTS nlp_intents (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_query TEXT NOT NULL,
        detected_intent TEXT NOT NULL,
        confidence_score REAL,
        entities TEXT,
        context TEXT,
        model_used TEXT DEFAULT 'qwen2.5:0.5b',
        response TEXT,
        user_id TEXT,
        session_id TEXT,
        feedback_rating INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Shopping Sessions Table
      CREATE TABLE IF NOT EXISTS shopping_sessions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        list_id TEXT,
        store_id TEXT,
        session_type TEXT DEFAULT 'online',
        status TEXT DEFAULT 'active',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        items_total INTEGER DEFAULT 0,
        items_found INTEGER DEFAULT 0,
        items_substituted INTEGER DEFAULT 0,
        items_unavailable INTEGER DEFAULT 0,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        delivery_fee REAL DEFAULT 0,
        tip_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        savings_amount REAL DEFAULT 0,
        payment_method TEXT,
        delivery_address TEXT,
        delivery_time TEXT,
        notes TEXT,
        feedback_rating INTEGER,
        feedback_text TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES grocery_lists(id) ON DELETE SET NULL
      );

      -- Grocery Substitutions Table
      CREATE TABLE IF NOT EXISTS grocery_substitutions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        original_product_id TEXT,
        substitute_product_id TEXT,
        reason TEXT,
        similarity_score REAL,
        price_difference REAL,
        user_id TEXT,
        accepted BOOLEAN,
        rating INTEGER,
        feedback TEXT,
        suggested_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (original_product_id) REFERENCES walmart_products(product_id) ON DELETE CASCADE,
        FOREIGN KEY (substitute_product_id) REFERENCES walmart_products(product_id) ON DELETE CASCADE
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_walmart_products_name ON walmart_products(name);
      CREATE INDEX IF NOT EXISTS idx_walmart_products_brand ON walmart_products(brand);
      CREATE INDEX IF NOT EXISTS idx_walmart_products_category ON walmart_products(category_path);
      CREATE INDEX IF NOT EXISTS idx_walmart_products_search ON walmart_products(search_keywords);
      CREATE INDEX IF NOT EXISTS idx_grocery_lists_user ON grocery_lists(user_id);
      CREATE INDEX IF NOT EXISTS idx_grocery_items_list ON grocery_items(list_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_user ON nlp_intents(user_id);
      CREATE INDEX IF NOT EXISTS idx_shopping_sessions_user ON shopping_sessions(user_id);
    `;

    try {
      this?.db?.exec(createTablesSql);
      logger.info("Walmart database tables created successfully", "WALMART_DB");
    } catch (error) {
      logger.error(`Failed to create Walmart database tables: ${error}`, "WALMART_DB");
      throw error;
    }
  }

  /**
   * Seed sample data for testing
   */
  private async seedSampleData(): Promise<void> {
    // Check if data already exists
    const productCount = this?.db?.prepare("SELECT COUNT(*) as count FROM walmart_products").get() as { count: number };
    
    if (productCount.count > 0) {
      logger.info(`Walmart database already has ${productCount.count} products`, "WALMART_DB");
      return;
    }

    const sampleProducts = [
      {
        product_id: "WM_MILK_001",
        name: "Great Value Whole Milk",
        brand: "Great Value",
        description: "Fresh whole milk with vitamin D",
        category_path: "Dairy & Eggs/Milk",
        department: "Dairy",
        current_price: 3.98,
        regular_price: 3.98,
        unit_price: 0.062,
        unit_measure: "fl oz",
        in_stock: 1,
        stock_level: 50,
        search_keywords: "milk whole dairy vitamin d gallon"
      },
      {
        product_id: "WM_MILK_002",
        name: "Horizon Organic 2% Milk",
        brand: "Horizon",
        description: "Organic 2% reduced fat milk",
        category_path: "Dairy & Eggs/Milk",
        department: "Dairy",
        current_price: 5.48,
        regular_price: 5.48,
        unit_price: 0.086,
        unit_measure: "fl oz",
        in_stock: 1,
        stock_level: 30,
        search_keywords: "milk organic 2% reduced fat horizon dairy"
      },
      {
        product_id: "WM_MILK_003",
        name: "Fairlife Lactose-Free Milk",
        brand: "Fairlife",
        description: "Ultra-filtered lactose-free milk",
        category_path: "Dairy & Eggs/Milk",
        department: "Dairy",
        current_price: 4.98,
        regular_price: 4.98,
        unit_price: 0.094,
        unit_measure: "fl oz",
        in_stock: 1,
        stock_level: 25,
        search_keywords: "milk lactose free fairlife filtered dairy"
      },
      {
        product_id: "WM_MILK_004",
        name: "Silk Almond Milk Unsweetened",
        brand: "Silk",
        description: "Plant-based almond milk, unsweetened",
        category_path: "Dairy & Eggs/Plant-Based Milk",
        department: "Dairy",
        current_price: 3.28,
        regular_price: 3.28,
        unit_price: 0.051,
        unit_measure: "fl oz",
        in_stock: 1,
        stock_level: 40,
        search_keywords: "milk almond plant based silk dairy alternative unsweetened"
      },
      {
        product_id: "WM_MILK_005",
        name: "Great Value Skim Milk",
        brand: "Great Value",
        description: "Fat-free skim milk with vitamins A & D",
        category_path: "Dairy & Eggs/Milk",
        department: "Dairy",
        current_price: 3.78,
        regular_price: 3.78,
        unit_price: 0.059,
        unit_measure: "fl oz",
        in_stock: 1,
        stock_level: 45,
        search_keywords: "milk skim fat free nonfat dairy vitamin"
      }
    ];

    const insertStmt = this?.db?.prepare(`
      INSERT INTO walmart_products (
        product_id, name, brand, description, category_path, department,
        current_price, regular_price, unit_price, unit_measure,
        in_stock, stock_level, search_keywords
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const insertMany = this?.db?.transaction((products: any) => {
        for (const product of products) {
          insertStmt.run(
            product.product_id,
            product.name,
            product.brand,
            product.description,
            product.category_path,
            product.department,
            product.current_price,
            product.regular_price,
            product.unit_price,
            product.unit_measure,
            product.in_stock,
            product.stock_level,
            product.search_keywords
          );
        }
      });

      insertMany(sampleProducts);
      logger.info(`Inserted ${sampleProducts?.length || 0} sample products into Walmart database`, "WALMART_DB");
    } catch (error) {
      logger.error(`Failed to seed sample data: ${error}`, "WALMART_DB");
      throw error;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this?.db?.close();
      logger.info("Walmart database connection closed", "WALMART_DB");
    }
  }

  /**
   * Get database instance (for direct queries)
   */
  getDatabase(): Database.Database {
    return this.db;
  }
}

// Export singleton getter
export function getWalmartDatabaseManager(): WalmartDatabaseManager {
  return WalmartDatabaseManager.getInstance();
}