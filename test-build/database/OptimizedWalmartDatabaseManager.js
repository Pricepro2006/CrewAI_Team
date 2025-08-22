/**
 * Optimized Walmart Database Manager - Connection pooled version
 * Replaces the single-connection approach with proper pooling for microservice architecture
 */
import { OptimizedConnectionPool } from "./OptimizedConnectionPool.js";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { logger } from "../utils/logger.js";
import { walmartConfig } from "../config/walmart.config.js";
// Repository imports
import { WalmartProductRepository, SubstitutionRepository, UserPreferencesRepository, } from "./repositories/WalmartProductRepository.js";
import { GroceryListRepository, GroceryItemRepository, ShoppingSessionRepository, } from "./repositories/GroceryRepository.js";
export class OptimizedWalmartDatabaseManager {
    static instance;
    connectionPool;
    isInitialized = false;
    config;
    // Lazy-loaded repository instances for optimal memory usage
    _walmartProducts = null;
    _substitutions = null;
    _userPreferences = null;
    _groceryLists = null;
    _groceryItems = null;
    _shoppingSessions = null;
    constructor(config) {
        this.config = {
            ...walmartConfig,
            ...config,
        };
        // Ensure data directory exists
        const dbPath = this?.config?.sqlite.path;
        const dataDir = dirname(dbPath);
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
            logger.info(`Created data directory: ${dataDir}`, "WALMART_DB_OPTIMIZED");
        }
        // Initialize optimized connection pool
        this.connectionPool = new OptimizedConnectionPool(dbPath, {
            maxConnections: this?.config?.sqlite.maxConnections || 15, // Higher for microservices
            minConnections: this?.config?.sqlite.minConnections || 3, // Keep minimum connections warm
            connectionTimeout: this?.config?.sqlite.connectionTimeout || 5000, // Faster timeout for microservices
            idleTimeout: this?.config?.sqlite.idleTimeout || 120000, // 2 minutes - more aggressive cleanup
            retryAttempts: 3,
            retryDelay: 500,
            enableWAL: this?.config?.sqlite.enableWAL,
            enableForeignKeys: this?.config?.sqlite.enableForeignKeys,
            cacheSize: this?.config?.sqlite.cacheSize,
            pragmaSettings: {
                journal_mode: 'WAL',
                synchronous: 'NORMAL',
                cache_size: -(this?.config?.sqlite.cacheSize * 1024), // Convert to KB
                temp_store: 'MEMORY',
                mmap_size: this?.config?.sqlite.memoryMap,
                busy_timeout: this?.config?.sqlite.busyTimeout,
                wal_autocheckpoint: 1000,
                optimize: 1,
                // Microservice optimizations
                page_size: 4096,
                cache_spill: 5000,
                automatic_index: 1,
            },
        });
        // Set up performance monitoring
        this.setupPerformanceMonitoring();
        logger.info(`Optimized Walmart Database Manager initialized with connection pool`, "WALMART_DB_OPTIMIZED", {
            dbPath,
            poolConfig: {
                maxConnections: this?.config?.sqlite.maxConnections,
                minConnections: this?.config?.sqlite.minConnections,
            }
        });
    }
    static getInstance(config) {
        if (!OptimizedWalmartDatabaseManager.instance) {
            OptimizedWalmartDatabaseManager.instance = new OptimizedWalmartDatabaseManager(config);
        }
        return OptimizedWalmartDatabaseManager.instance;
    }
    /**
     * Set up performance monitoring for the connection pool
     */
    setupPerformanceMonitoring() {
        // Log pool metrics every 5 minutes
        setInterval(() => {
            const metrics = this?.connectionPool?.getMetrics();
            logger.info("Walmart DB Pool Metrics", "WALMART_DB_OPTIMIZED", {
                connections: {
                    total: metrics.totalConnections,
                    active: metrics.activeConnections,
                    idle: metrics.idleConnections,
                    waiting: metrics.waitingQueries,
                },
                performance: {
                    totalQueries: metrics.totalQueries,
                    avgQueryTime: Math.round(metrics.avgQueryTime * 100) / 100,
                    slowQueries: metrics.slowQueries,
                    errors: metrics.errors,
                },
                percentiles: metrics.queryTimePercentiles,
            });
        }, 5 * 60 * 1000); // 5 minutes
        // Set up pool event listeners
        this?.connectionPool?.on('connection-created', (data) => {
            logger.debug(`Walmart DB connection created: ${data.connectionId} (${data.connectionTime}ms)`, "WALMART_DB_OPTIMIZED");
        });
        this?.connectionPool?.on('query-error', (data) => {
            logger.error(`Walmart DB query error: ${data.error}`, "WALMART_DB_OPTIMIZED");
        });
        this?.connectionPool?.on('pool-error', (error) => {
            logger.error(`Walmart DB pool error: ${error}`, "WALMART_DB_OPTIMIZED");
        });
    }
    /**
     * Lazy-loaded repository getters for optimal connection management
     */
    get walmartProducts() {
        if (!this._walmartProducts) {
            this._walmartProducts = new WalmartProductRepository(this.getSharedDatabase());
        }
        return this._walmartProducts;
    }
    get substitutions() {
        if (!this._substitutions) {
            this._substitutions = new SubstitutionRepository(this.getSharedDatabase());
        }
        return this._substitutions;
    }
    get userPreferences() {
        if (!this._userPreferences) {
            this._userPreferences = new UserPreferencesRepository(this.getSharedDatabase());
        }
        return this._userPreferences;
    }
    get groceryLists() {
        if (!this._groceryLists) {
            this._groceryLists = new GroceryListRepository(this.getSharedDatabase());
        }
        return this._groceryLists;
    }
    get groceryItems() {
        if (!this._groceryItems) {
            this._groceryItems = new GroceryItemRepository(this.getSharedDatabase());
        }
        return this._groceryItems;
    }
    get shoppingSessions() {
        if (!this._shoppingSessions) {
            this._shoppingSessions = new ShoppingSessionRepository(this.getSharedDatabase());
        }
        return this._shoppingSessions;
    }
    /**
     * Get shared database instance from pool
     */
    getSharedDatabase() {
        return this?.connectionPool?.getConnection().then(conn => conn.db);
    }
    /**
     * Initialize the Walmart database with schema and sample data
     */
    async initialize() {
        if (this.isInitialized) {
            logger.warn("Optimized Walmart database already initialized", "WALMART_DB_OPTIMIZED");
            return;
        }
        try {
            logger.info("Initializing optimized Walmart database...", "WALMART_DB_OPTIMIZED");
            // Create tables if they don't exist
            await this.createTables();
            // Insert sample data if tables are empty
            await this.seedSampleData();
            // Optimize database for performance
            await this?.connectionPool?.optimizeDatabase();
            this.isInitialized = true;
            logger.info("Optimized Walmart database initialized successfully", "WALMART_DB_OPTIMIZED");
        }
        catch (error) {
            logger.error(`Optimized Walmart database initialization failed: ${error}`, "WALMART_DB_OPTIMIZED");
            throw error;
        }
    }
    /**
     * Create database tables using connection pool
     */
    async createTables() {
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

      -- NLP Intents Table for Qwen3:0.6b model
      CREATE TABLE IF NOT EXISTS nlp_intents (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_query TEXT NOT NULL,
        detected_intent TEXT NOT NULL,
        confidence_score REAL,
        entities TEXT,
        context TEXT,
        model_used TEXT DEFAULT 'qwen3:0.6b',
        response TEXT,
        user_id TEXT,
        session_id TEXT,
        feedback_rating INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

      -- Create optimized indexes for microservice performance
      CREATE INDEX IF NOT EXISTS idx_walmart_products_name ON walmart_products(name);
      CREATE INDEX IF NOT EXISTS idx_walmart_products_brand ON walmart_products(brand);
      CREATE INDEX IF NOT EXISTS idx_walmart_products_category ON walmart_products(category_path);
      CREATE INDEX IF NOT EXISTS idx_walmart_products_price ON walmart_products(current_price);
      CREATE INDEX IF NOT EXISTS idx_walmart_products_search ON walmart_products(search_keywords);
      CREATE INDEX IF NOT EXISTS idx_walmart_products_stock ON walmart_products(in_stock, stock_level);
      CREATE INDEX IF NOT EXISTS idx_grocery_lists_user ON grocery_lists(user_id);
      CREATE INDEX IF NOT EXISTS idx_grocery_lists_status ON grocery_lists(status);
      CREATE INDEX IF NOT EXISTS idx_grocery_items_list ON grocery_items(list_id);
      CREATE INDEX IF NOT EXISTS idx_grocery_items_status ON grocery_items(status);
      CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(recorded_at);
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_user ON nlp_intents(user_id);
      CREATE INDEX IF NOT EXISTS idx_nlp_intents_session ON nlp_intents(session_id);
      CREATE INDEX IF NOT EXISTS idx_shopping_sessions_user ON shopping_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_shopping_sessions_status ON shopping_sessions(status);
    `;
        try {
            await this?.connectionPool?.executeQuery(createTablesSql);
            logger.info("Optimized Walmart database tables created successfully", "WALMART_DB_OPTIMIZED");
        }
        catch (error) {
            logger.error(`Failed to create optimized Walmart database tables: ${error}`, "WALMART_DB_OPTIMIZED");
            throw error;
        }
    }
    /**
     * Seed sample data for testing using connection pool
     */
    async seedSampleData() {
        try {
            // Check if data already exists using connection pool
            const productCount = await this?.connectionPool?.executeQuery("SELECT COUNT(*) as count FROM walmart_products");
            if (productCount[0].count > 0) {
                logger.info(`Optimized Walmart database already has ${productCount[0].count} products`, "WALMART_DB_OPTIMIZED");
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
                // Additional sample products...
            ];
            // Use transaction for bulk insert
            await this?.connectionPool?.executeTransaction((db) => {
                const insertStmt = db.prepare(`
          INSERT INTO walmart_products (
            product_id, name, brand, description, category_path, department,
            current_price, regular_price, unit_price, unit_measure,
            in_stock, stock_level, search_keywords
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
                for (const product of sampleProducts) {
                    insertStmt.run(product.product_id, product.name, product.brand, product.description, product.category_path, product.department, product.current_price, product.regular_price, product.unit_price, product.unit_measure, product.in_stock, product.stock_level, product.search_keywords);
                }
                return sampleProducts?.length || 0;
            });
            logger.info(`Inserted ${sampleProducts?.length || 0} sample products into optimized Walmart database`, "WALMART_DB_OPTIMIZED");
        }
        catch (error) {
            logger.error(`Failed to seed sample data: ${error}`, "WALMART_DB_OPTIMIZED");
            throw error;
        }
    }
    /**
     * Get connection pool instance for advanced operations
     */
    getConnectionPool() {
        return this.connectionPool;
    }
    /**
     * Execute query with automatic connection management
     */
    async executeQuery(query, params = []) {
        return this?.connectionPool?.executeQuery(query, params);
    }
    /**
     * Execute transaction with automatic rollback on error
     */
    async executeTransaction(callback) {
        return this?.connectionPool?.executeTransaction(callback);
    }
    /**
     * Get performance metrics
     */
    getMetrics() {
        return this?.connectionPool?.getMetrics();
    }
    /**
     * Get detailed connection information
     */
    getConnectionInfo() {
        return this?.connectionPool?.getConnectionInfo();
    }
    /**
     * Health check for the Walmart database system
     */
    async healthCheck() {
        const errors = [];
        let healthy = true;
        try {
            // Test basic connectivity
            await this.executeQuery("SELECT 1 as test");
        }
        catch (error) {
            healthy = false;
            errors.push(`Database connectivity test failed: ${error}`);
        }
        const poolMetrics = this.getMetrics();
        const connectionInfo = this.getConnectionInfo();
        // Check for concerning metrics
        if (poolMetrics.activeConnections === 0 && poolMetrics.totalConnections === 0) {
            errors.push("No database connections available");
            healthy = false;
        }
        if (poolMetrics.errors > 0) {
            errors.push(`Database errors detected: ${poolMetrics.errors}`);
        }
        return {
            healthy,
            poolMetrics,
            connectionInfo,
            errors,
        };
    }
    /**
     * Close all connections and clean up
     */
    async close() {
        try {
            await this?.connectionPool?.close();
            logger.info("Optimized Walmart database connection pool closed", "WALMART_DB_OPTIMIZED");
        }
        catch (error) {
            logger.error(`Error closing optimized Walmart database: ${error}`, "WALMART_DB_OPTIMIZED");
            throw error;
        }
    }
}
// Export singleton getter
export function getOptimizedWalmartDatabaseManager() {
    return OptimizedWalmartDatabaseManager.getInstance();
}
