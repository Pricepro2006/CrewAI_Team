-- Rollback Script for Grocery Performance Optimization
-- Version: 008
-- Description: Removes all optimizations added by 008_grocery_performance_optimization.sql
-- Usage: sqlite3 data/app.db < database/migrations/rollback-008-grocery-optimization.sql

BEGIN TRANSACTION;

-- Drop FTS tables and triggers
DROP TABLE IF EXISTS grocery_items_fts;
DROP TRIGGER IF EXISTS grocery_items_fts_insert;
DROP TRIGGER IF EXISTS grocery_items_fts_update;
DROP TRIGGER IF EXISTS grocery_items_fts_delete;

-- Drop cache tables
DROP TABLE IF EXISTS price_history_cache;
DROP TABLE IF EXISTS inventory_cache;
DROP TABLE IF EXISTS cache_analytics;
DROP TABLE IF EXISTS user_shopping_stats;
DROP TABLE IF EXISTS db_maintenance_log;

-- Drop views
DROP VIEW IF EXISTS v_product_search;
DROP VIEW IF EXISTS v_purchase_recommendations;

-- Drop all optimization indexes
-- Product search indexes
DROP INDEX IF EXISTS idx_grocery_items_search_covering;
DROP INDEX IF EXISTS idx_grocery_items_upc_lookup;

-- Purchase history indexes
DROP INDEX IF EXISTS idx_purchase_history_user_product_date;
DROP INDEX IF EXISTS idx_purchase_history_price_trends_covering;
DROP INDEX IF EXISTS idx_purchase_history_basket_analysis;
DROP INDEX IF EXISTS idx_purchase_history_recent;

-- Price history cache indexes
DROP INDEX IF EXISTS idx_price_history_cache_lookup;
DROP INDEX IF EXISTS idx_price_history_cache_best_price;

-- Inventory cache indexes
DROP INDEX IF EXISTS idx_inventory_cache_availability;
DROP INDEX IF EXISTS idx_inventory_cache_restock;

-- User preferences indexes
DROP INDEX IF EXISTS idx_user_preferences_recommendations;
DROP INDEX IF EXISTS idx_user_preferences_dietary;

-- Brand preferences indexes
DROP INDEX IF EXISTS idx_brand_preferences_lookup;

-- Cache analytics indexes
DROP INDEX IF EXISTS idx_cache_analytics_key;
DROP INDEX IF EXISTS idx_cache_analytics_expiry;
DROP INDEX IF EXISTS idx_cache_analytics_hot;

-- Deal alerts indexes
DROP INDEX IF EXISTS idx_deal_alerts_matching_engine;
DROP INDEX IF EXISTS idx_deal_notifications_delivery;
DROP INDEX IF EXISTS idx_tracked_deals_matching;

-- User shopping stats indexes
DROP INDEX IF EXISTS idx_user_shopping_stats_updated;

-- Log the rollback
INSERT INTO migrations_log (
    migration_name,
    operation,
    executed_at,
    notes
) VALUES (
    '008_grocery_performance_optimization',
    'ROLLBACK',
    datetime('now'),
    'Rolled back all performance optimizations'
);

COMMIT;

-- Analyze to update statistics after rollback
ANALYZE;

-- Print confirmation
SELECT 'Rollback complete: All grocery performance optimizations have been removed.' as message;