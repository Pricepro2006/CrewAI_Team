-- Migration: Comprehensive Grocery Performance Optimization
-- Version: 008
-- Description: Optimizes SQLite database for high-performance grocery queries
-- Author: Database Optimization Expert
-- Date: 2025-08-06

-- ============================================================================
-- PERFORMANCE OPTIMIZATION STRATEGY
-- ============================================================================
-- 1. Add covering indexes to eliminate table lookups
-- 2. Create compound indexes for complex JOIN operations
-- 3. Implement partial indexes for filtered queries
-- 4. Add full-text search capabilities for product names
-- 5. Create cache tables for expensive aggregations
-- 6. Optimize foreign key relationships
-- 7. Add proper indexes for analytics queries
-- ============================================================================

BEGIN TRANSACTION;

-- ============================================================================
-- PART 1: PRODUCT SEARCH OPTIMIZATION
-- ============================================================================

-- Full-text search virtual table for products (10x faster than LIKE queries)
CREATE VIRTUAL TABLE IF NOT EXISTS grocery_items_fts USING fts5(
    product_name,
    product_brand,
    product_category,
    product_subcategory,
    product_description,
    content=grocery_items,
    content_rowid=id,
    tokenize='porter unicode61'
);

-- Populate FTS table with existing data
INSERT INTO grocery_items_fts(product_name, product_brand, product_category, product_subcategory, product_description)
SELECT product_name, product_brand, product_category, product_subcategory, special_instructions 
FROM grocery_items;

-- Trigger to keep FTS in sync with main table
CREATE TRIGGER IF NOT EXISTS grocery_items_fts_insert 
AFTER INSERT ON grocery_items BEGIN
    INSERT INTO grocery_items_fts(
        rowid, product_name, product_brand, product_category, 
        product_subcategory, product_description
    ) VALUES (
        new.id, new.product_name, new.product_brand, new.product_category,
        new.product_subcategory, new.special_instructions
    );
END;

CREATE TRIGGER IF NOT EXISTS grocery_items_fts_update 
AFTER UPDATE ON grocery_items BEGIN
    UPDATE grocery_items_fts SET 
        product_name = new.product_name,
        product_brand = new.product_brand,
        product_category = new.product_category,
        product_subcategory = new.product_subcategory,
        product_description = new.special_instructions
    WHERE rowid = new.id;
END;

CREATE TRIGGER IF NOT EXISTS grocery_items_fts_delete 
AFTER DELETE ON grocery_items BEGIN
    DELETE FROM grocery_items_fts WHERE rowid = old.id;
END;

-- High-performance covering index for product searches
CREATE INDEX IF NOT EXISTS idx_grocery_items_search_covering ON grocery_items(
    product_name COLLATE NOCASE,
    product_brand COLLATE NOCASE,
    product_category,
    estimated_price,
    id,
    list_id,
    user_id,
    status,
    quantity
);

-- Barcode lookup index (instant lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_grocery_items_upc_lookup ON grocery_items(upc_code) 
WHERE upc_code IS NOT NULL;

-- ============================================================================
-- PART 2: PURCHASE HISTORY OPTIMIZATION
-- ============================================================================

-- Compound index for purchase history queries with user filtering
CREATE INDEX IF NOT EXISTS idx_purchase_history_user_product_date ON purchase_history(
    user_id,
    product_name COLLATE NOCASE,
    product_brand COLLATE NOCASE,
    purchase_date DESC,
    unit_price,
    final_price
);

-- Index for price trend analysis (covering index)
CREATE INDEX IF NOT EXISTS idx_purchase_history_price_trends_covering ON purchase_history(
    upc_code,
    store_name,
    purchase_date DESC,
    unit_price,
    discount_amount,
    final_price
) WHERE upc_code IS NOT NULL;

-- Index for frequently bought together analysis
CREATE INDEX IF NOT EXISTS idx_purchase_history_basket_analysis ON purchase_history(
    shopping_trip_id,
    user_id,
    product_category,
    product_name,
    quantity
) WHERE shopping_trip_id IS NOT NULL;

-- Partial index for recent purchases (last 90 days)
CREATE INDEX IF NOT EXISTS idx_purchase_history_recent ON purchase_history(
    user_id,
    purchase_date DESC,
    product_name,
    product_brand,
    unit_price
) WHERE purchase_date >= date('now', '-90 days');

-- ============================================================================
-- PART 3: PRICE COMPARISON OPTIMIZATION
-- ============================================================================

-- Create price history table for fast lookups
CREATE TABLE IF NOT EXISTS price_history_cache (
    id TEXT PRIMARY KEY,
    upc_code TEXT NOT NULL,
    store_name TEXT NOT NULL,
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    avg_price DECIMAL(10,2),
    current_price DECIMAL(10,2),
    last_price DECIMAL(10,2),
    price_trend TEXT CHECK (price_trend IN ('up', 'down', 'stable')),
    volatility_score DECIMAL(5,2),
    sample_count INTEGER,
    first_seen TEXT,
    last_seen TEXT,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(upc_code, store_name)
);

-- Compound index for price comparisons
CREATE INDEX IF NOT EXISTS idx_price_history_cache_lookup ON price_history_cache(
    upc_code,
    store_name,
    current_price,
    last_updated DESC
);

-- Index for finding best prices
CREATE INDEX IF NOT EXISTS idx_price_history_cache_best_price ON price_history_cache(
    upc_code,
    min_price,
    store_name
);

-- ============================================================================
-- PART 4: INVENTORY AND STOCK OPTIMIZATION
-- ============================================================================

-- Create inventory tracking table
CREATE TABLE IF NOT EXISTS inventory_cache (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    stock_level INTEGER,
    availability_status TEXT CHECK (availability_status IN ('in_stock', 'low_stock', 'out_of_stock')),
    last_restocked TEXT,
    restock_frequency_days INTEGER,
    avg_daily_sales DECIMAL(10,2),
    days_until_outage INTEGER,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(product_id, store_id)
);

-- Index for stock queries
CREATE INDEX IF NOT EXISTS idx_inventory_cache_availability ON inventory_cache(
    store_id,
    availability_status,
    stock_level DESC
);

-- Index for restock predictions
CREATE INDEX IF NOT EXISTS idx_inventory_cache_restock ON inventory_cache(
    store_id,
    days_until_outage,
    product_id
) WHERE days_until_outage <= 7;

-- ============================================================================
-- PART 5: USER PREFERENCE OPTIMIZATION
-- ============================================================================

-- Compound index for preference-based recommendations
CREATE INDEX IF NOT EXISTS idx_user_preferences_recommendations ON user_preferences(
    user_id,
    overall_price_sensitivity,
    shopping_frequency,
    preferred_shopping_method
);

-- Index for dietary filtering
CREATE INDEX IF NOT EXISTS idx_user_preferences_dietary ON user_preferences(
    user_id,
    dietary_restrictions,
    allergens
) WHERE dietary_restrictions IS NOT NULL OR allergens IS NOT NULL;

-- Brand preference lookup optimization
CREATE INDEX IF NOT EXISTS idx_brand_preferences_lookup ON brand_preferences(
    user_id,
    preference_type,
    preference_strength DESC,
    brand_name COLLATE NOCASE,
    category
);

-- ============================================================================
-- PART 6: CACHE ANALYTICS OPTIMIZATION
-- ============================================================================

-- Create cache analytics table for monitoring access patterns
CREATE TABLE IF NOT EXISTS cache_analytics (
    id TEXT PRIMARY KEY,
    cache_key TEXT NOT NULL,
    cache_type TEXT NOT NULL,
    access_count INTEGER DEFAULT 0,
    hit_count INTEGER DEFAULT 0,
    miss_count INTEGER DEFAULT 0,
    avg_response_time_ms DECIMAL(10,2),
    last_accessed TEXT,
    data_size_bytes INTEGER,
    ttl_seconds INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    metadata TEXT
);

-- Index for cache key lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_analytics_key ON cache_analytics(cache_key);

-- Index for cache cleanup
CREATE INDEX IF NOT EXISTS idx_cache_analytics_expiry ON cache_analytics(expires_at) 
WHERE expires_at IS NOT NULL;

-- Index for hot cache identification
CREATE INDEX IF NOT EXISTS idx_cache_analytics_hot ON cache_analytics(
    access_count DESC,
    hit_count DESC,
    last_accessed DESC
);

-- ============================================================================
-- PART 7: DEAL AND ALERT OPTIMIZATION
-- ============================================================================

-- Compound index for active deal matching
CREATE INDEX IF NOT EXISTS idx_deal_alerts_matching_engine ON deal_alerts(
    status,
    user_id,
    product_category,
    target_price,
    price_drop_percentage
) WHERE status = 'active';

-- Index for deal notifications
CREATE INDEX IF NOT EXISTS idx_deal_notifications_delivery ON deal_notifications(
    user_id,
    sent_at DESC,
    delivery_status,
    was_clicked,
    was_purchased
);

-- Index for deal effectiveness tracking
CREATE INDEX IF NOT EXISTS idx_tracked_deals_matching ON tracked_deals(
    product_name COLLATE NOCASE,
    product_brand COLLATE NOCASE,
    current_price,
    is_expired,
    deal_quality_score DESC
) WHERE is_expired = false;

-- ============================================================================
-- PART 8: AGGREGATION AND REPORTING OPTIMIZATION
-- ============================================================================

-- Create materialized view for user shopping statistics
CREATE TABLE IF NOT EXISTS user_shopping_stats (
    user_id TEXT PRIMARY KEY,
    total_spent_30d DECIMAL(10,2),
    total_spent_90d DECIMAL(10,2),
    avg_basket_size DECIMAL(10,2),
    shopping_frequency_days DECIMAL(5,2),
    favorite_store TEXT,
    favorite_category TEXT,
    favorite_brand TEXT,
    price_sensitivity_score DECIMAL(3,2),
    loyalty_score DECIMAL(3,2),
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for stats lookups
CREATE INDEX IF NOT EXISTS idx_user_shopping_stats_updated ON user_shopping_stats(last_updated DESC);

-- ============================================================================
-- PART 9: QUERY PERFORMANCE VIEWS
-- ============================================================================

-- Create view for fast product search with prices
CREATE VIEW IF NOT EXISTS v_product_search AS
SELECT 
    gi.id,
    gi.product_name,
    gi.product_brand,
    gi.product_category,
    gi.upc_code,
    gi.estimated_price,
    phc.min_price,
    phc.avg_price,
    phc.current_price,
    phc.price_trend,
    phc.store_name as best_price_store
FROM grocery_items gi
LEFT JOIN price_history_cache phc ON gi.upc_code = phc.upc_code
WHERE phc.min_price = (
    SELECT MIN(min_price) 
    FROM price_history_cache 
    WHERE upc_code = gi.upc_code
) OR phc.upc_code IS NULL;

-- Create view for purchase recommendations
CREATE VIEW IF NOT EXISTS v_purchase_recommendations AS
SELECT 
    ph.user_id,
    ph.product_name,
    ph.product_brand,
    ph.product_category,
    COUNT(*) as purchase_count,
    AVG(ph.quantity) as avg_quantity,
    AVG(ph.unit_price) as avg_price,
    MAX(ph.purchase_date) as last_purchased,
    julianday('now') - julianday(MAX(ph.purchase_date)) as days_since_purchase,
    CASE 
        WHEN COUNT(*) >= 5 AND julianday('now') - julianday(MAX(ph.purchase_date)) > 
             (SELECT AVG(julianday(p2.purchase_date) - julianday(p1.purchase_date))
              FROM purchase_history p1
              JOIN purchase_history p2 ON p1.user_id = p2.user_id 
                AND p1.product_name = p2.product_name 
                AND p2.purchase_date > p1.purchase_date
              WHERE p1.user_id = ph.user_id AND p1.product_name = ph.product_name)
        THEN 'due_for_purchase'
        ELSE 'not_due'
    END as recommendation_status
FROM purchase_history ph
WHERE ph.purchase_date >= date('now', '-180 days')
GROUP BY ph.user_id, ph.product_name, ph.product_brand, ph.product_category
HAVING COUNT(*) >= 2;

-- ============================================================================
-- PART 10: STATISTICS UPDATE
-- ============================================================================

-- Update SQLite statistics for query optimizer
ANALYZE;

-- ============================================================================
-- PART 11: CLEANUP AND MAINTENANCE
-- ============================================================================

-- Create maintenance procedure documentation
CREATE TABLE IF NOT EXISTS db_maintenance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL,
    affected_tables TEXT,
    rows_affected INTEGER,
    execution_time_ms INTEGER,
    executed_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
);

-- Insert migration completion record
INSERT INTO db_maintenance_log (operation, affected_tables, notes)
VALUES (
    'grocery_performance_optimization',
    'grocery_items, purchase_history, user_preferences, deal_alerts, cache_analytics',
    'Comprehensive performance optimization with covering indexes, FTS, and cache tables'
);

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Save separately)
-- ============================================================================
-- To rollback this migration, run:
/*
BEGIN TRANSACTION;

-- Drop FTS tables and triggers
DROP TABLE IF EXISTS grocery_items_fts;
DROP TRIGGER IF EXISTS grocery_items_fts_insert;
DROP TRIGGER IF EXISTS grocery_items_fts_update;
DROP TRIGGER IF EXISTS grocery_items_fts_delete;

-- Drop new tables
DROP TABLE IF EXISTS price_history_cache;
DROP TABLE IF EXISTS inventory_cache;
DROP TABLE IF EXISTS cache_analytics;
DROP TABLE IF EXISTS user_shopping_stats;
DROP TABLE IF EXISTS db_maintenance_log;

-- Drop views
DROP VIEW IF EXISTS v_product_search;
DROP VIEW IF EXISTS v_purchase_recommendations;

-- Drop all new indexes (list each one)
DROP INDEX IF EXISTS idx_grocery_items_search_covering;
DROP INDEX IF EXISTS idx_grocery_items_upc_lookup;
DROP INDEX IF EXISTS idx_purchase_history_user_product_date;
DROP INDEX IF EXISTS idx_purchase_history_price_trends_covering;
DROP INDEX IF EXISTS idx_purchase_history_basket_analysis;
DROP INDEX IF EXISTS idx_purchase_history_recent;
DROP INDEX IF EXISTS idx_price_history_cache_lookup;
DROP INDEX IF EXISTS idx_price_history_cache_best_price;
DROP INDEX IF EXISTS idx_inventory_cache_availability;
DROP INDEX IF EXISTS idx_inventory_cache_restock;
DROP INDEX IF EXISTS idx_user_preferences_recommendations;
DROP INDEX IF EXISTS idx_user_preferences_dietary;
DROP INDEX IF EXISTS idx_brand_preferences_lookup;
DROP INDEX IF EXISTS idx_cache_analytics_key;
DROP INDEX IF EXISTS idx_cache_analytics_expiry;
DROP INDEX IF EXISTS idx_cache_analytics_hot;
DROP INDEX IF EXISTS idx_deal_alerts_matching_engine;
DROP INDEX IF EXISTS idx_deal_notifications_delivery;
DROP INDEX IF EXISTS idx_tracked_deals_matching;
DROP INDEX IF EXISTS idx_user_shopping_stats_updated;

COMMIT;
*/