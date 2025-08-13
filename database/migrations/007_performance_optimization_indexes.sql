-- Performance Optimization Indexes for Walmart Grocery Agent
-- Addresses N+1 query problems and optimizes frequent queries

-- Indexes for purchase_records table
CREATE INDEX IF NOT EXISTS idx_purchase_records_seasonal_month 
ON purchase_records(user_id, CAST(strftime('%m', purchase_date) AS INTEGER));

CREATE INDEX IF NOT EXISTS idx_purchase_records_seasonal_week 
ON purchase_records(user_id, CAST(strftime('%W', purchase_date) AS INTEGER));

-- Composite index for pattern analysis queries
CREATE INDEX IF NOT EXISTS idx_purchase_records_pattern_analysis 
ON purchase_records(user_id, product_id, purchase_date DESC, quantity, unit_price);

-- Index for store preference queries
CREATE INDEX IF NOT EXISTS idx_purchase_records_store_preference 
ON purchase_records(user_id, product_id, store_id) WHERE store_id IS NOT NULL;

-- Indexes for walmart_products table
CREATE INDEX IF NOT EXISTS idx_walmart_products_price_range 
ON walmart_products(current_price, in_stock) WHERE in_stock = 1;

CREATE INDEX IF NOT EXISTS idx_walmart_products_category_brand 
ON walmart_products(category, brand, current_price);

-- Index for product search by name (using trigram-like matching)
CREATE INDEX IF NOT EXISTS idx_walmart_products_name_search 
ON walmart_products(name COLLATE NOCASE);

-- Indexes for grocery_lists table
CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_updated 
ON grocery_lists(user_id, updated_at DESC);

-- Indexes for grocery_items table
CREATE INDEX IF NOT EXISTS idx_grocery_items_list_product 
ON grocery_items(list_id, product_id, quantity);

-- Composite index for cart calculations
CREATE INDEX IF NOT EXISTS idx_grocery_items_cart_calc 
ON grocery_items(list_id, checked) WHERE checked = 0;

-- Indexes for shopping_sessions table
CREATE INDEX IF NOT EXISTS idx_shopping_sessions_user_active 
ON shopping_sessions(user_id, is_active, created_at DESC) WHERE is_active = 1;

-- Indexes for user_preferences table
CREATE INDEX IF NOT EXISTS idx_user_preferences_dietary 
ON user_preferences(user_id, dietary_restrictions);

-- Indexes for substitutions table
CREATE INDEX IF NOT EXISTS idx_substitutions_product_score 
ON substitutions(original_product_id, score DESC);

-- Partial indexes for frequently filtered queries
CREATE INDEX IF NOT EXISTS idx_purchase_records_recent 
ON purchase_records(user_id, purchase_date DESC) 
WHERE purchase_date > date('now', '-90 days');

CREATE INDEX IF NOT EXISTS idx_walmart_products_deals 
ON walmart_products(discount_percentage DESC, in_stock) 
WHERE discount_percentage > 0 AND in_stock = 1;

-- Index for analytics cache expiration
CREATE INDEX IF NOT EXISTS idx_purchase_analytics_cache_expiry 
ON purchase_analytics_cache(expires_at) 
WHERE expires_at > datetime('now');

-- Analyze tables to update statistics
ANALYZE purchase_records;
ANALYZE walmart_products;
ANALYZE grocery_lists;
ANALYZE grocery_items;
ANALYZE shopping_sessions;