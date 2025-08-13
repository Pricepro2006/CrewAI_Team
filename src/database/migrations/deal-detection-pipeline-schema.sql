-- Real-Time Deal Detection Pipeline Schema
-- Supports continuous price monitoring, deal detection, and real-time notifications
-- Optimized for high-frequency writes and analytical queries

-- =============================================================================
-- PRICE TRACKING TABLES
-- =============================================================================

-- Enhanced price history with improved indexing for deal detection
CREATE TABLE IF NOT EXISTS price_history_enhanced (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    walmart_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    brand TEXT,
    
    -- Price data
    current_price REAL NOT NULL,
    sale_price REAL,
    was_price REAL,
    original_price REAL,
    
    -- Metadata
    store_location TEXT,
    store_id TEXT,
    source TEXT NOT NULL, -- 'api', 'scraper', 'cache'
    confidence_score REAL DEFAULT 1.0,
    
    -- Timestamps
    recorded_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Deal detection flags
    is_deal_candidate INTEGER DEFAULT 0,
    price_change_percentage REAL,
    price_trend TEXT, -- 'rising', 'falling', 'stable', 'volatile'
    
    UNIQUE(product_id, recorded_at)
);

-- Price aggregation table for efficient historical analysis
CREATE TABLE IF NOT EXISTS price_statistics (
    product_id TEXT PRIMARY KEY,
    walmart_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    
    -- Price statistics (rolling windows)
    current_price REAL NOT NULL,
    price_7d_avg REAL,
    price_30d_avg REAL,
    price_60d_avg REAL,
    price_90d_avg REAL,
    
    price_7d_min REAL,
    price_30d_min REAL,
    price_60d_min REAL,
    price_90d_min REAL,
    
    price_7d_max REAL,
    price_30d_max REAL,
    price_60d_max REAL,
    price_90d_max REAL,
    
    -- Volatility metrics
    price_volatility REAL DEFAULT 0.0,
    price_trend_direction TEXT DEFAULT 'stable',
    
    -- Update tracking
    first_tracked_at TEXT NOT NULL,
    last_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_count INTEGER DEFAULT 1,
    
    FOREIGN KEY (product_id) REFERENCES price_history_enhanced(product_id)
);

-- =============================================================================
-- DEAL DETECTION TABLES
-- =============================================================================

-- Deal alerts and thresholds
CREATE TABLE IF NOT EXISTS deal_alerts_enhanced (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- Alert criteria
    product_id TEXT,
    walmart_id TEXT,
    category TEXT,
    search_query TEXT,
    
    -- Threshold conditions
    price_drop_percentage REAL, -- e.g., 20% drop
    price_drop_absolute REAL,   -- e.g., $5 drop
    target_price REAL,          -- e.g., alert when below $10
    deal_type TEXT,             -- 'price_drop', 'bulk_discount', 'seasonal', etc.
    
    -- Alert settings
    is_active INTEGER DEFAULT 1,
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    notification_methods TEXT,      -- JSON array: ['email', 'websocket', 'push']
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_checked_at TEXT,
    last_triggered_at TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Detected deals table
CREATE TABLE IF NOT EXISTS detected_deals (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    walmart_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    
    -- Deal information
    deal_type TEXT NOT NULL, -- 'price_drop', 'bulk_discount', 'seasonal', 'clearance'
    current_price REAL NOT NULL,
    original_price REAL,
    reference_price REAL,    -- Price we're comparing against (avg, max, etc.)
    savings_amount REAL NOT NULL,
    savings_percentage REAL NOT NULL,
    
    -- Deal quality metrics
    deal_score REAL DEFAULT 0.0,        -- 0-1 quality score
    confidence_score REAL DEFAULT 1.0,  -- How confident we are this is a real deal
    urgency_score REAL DEFAULT 0.0,     -- How urgent/time-sensitive this deal is
    
    -- Deal context
    comparison_period TEXT,   -- '30d', '60d', '90d'
    deal_reasons TEXT,        -- JSON array of reasons why this is a deal
    historical_low INTEGER DEFAULT 0, -- 1 if this is historical low price
    
    -- Availability and timing
    stock_status TEXT DEFAULT 'in_stock',
    estimated_stock_level TEXT, -- 'high', 'medium', 'low', 'unknown'
    deal_expires_at TEXT,
    
    -- Discovery and processing
    detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    first_seen_at TEXT,
    last_verified_at TEXT,
    verification_count INTEGER DEFAULT 1,
    
    -- User targeting
    target_users TEXT, -- JSON array of user IDs who might be interested
    
    FOREIGN KEY (product_id) REFERENCES price_history_enhanced(product_id)
);

-- Deal notifications log
CREATE TABLE IF NOT EXISTS deal_notifications (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    alert_id TEXT,
    
    -- Notification details
    notification_type TEXT NOT NULL, -- 'websocket', 'email', 'push'
    status TEXT DEFAULT 'pending',    -- 'pending', 'sent', 'delivered', 'failed'
    
    -- Content
    title TEXT,
    message TEXT,
    notification_data TEXT, -- JSON with additional data
    
    -- Timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT,
    delivered_at TEXT,
    
    -- User interaction
    viewed_at TEXT,
    clicked_at TEXT,
    dismissed_at TEXT,
    
    FOREIGN KEY (deal_id) REFERENCES detected_deals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES deal_alerts_enhanced(id) ON DELETE SET NULL
);

-- =============================================================================
-- BULK DISCOUNT ANALYSIS
-- =============================================================================

-- Track bulk discount opportunities
CREATE TABLE IF NOT EXISTS bulk_discount_analysis (
    id TEXT PRIMARY KEY,
    base_product_id TEXT NOT NULL,
    
    -- Product variants for bulk comparison
    small_size_id TEXT,
    medium_size_id TEXT,
    large_size_id TEXT,
    bulk_size_id TEXT,
    
    -- Price comparison
    small_price REAL,
    medium_price REAL,
    large_price REAL,
    bulk_price REAL,
    
    -- Unit price analysis
    small_unit_price REAL,
    medium_unit_price REAL,
    large_unit_price REAL,
    bulk_unit_price REAL,
    
    -- Recommendations
    best_value_size TEXT,
    bulk_savings_percentage REAL,
    recommended_quantity INTEGER,
    break_even_quantity INTEGER,
    
    -- Risk assessment
    storage_requirements TEXT,
    shelf_life_days INTEGER,
    risk_level TEXT, -- 'low', 'medium', 'high'
    
    -- Update tracking
    analyzed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SEASONAL PATTERNS
-- =============================================================================

-- Seasonal price patterns for predictive analysis
CREATE TABLE IF NOT EXISTS seasonal_price_patterns (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    product_pattern TEXT, -- 'produce', 'beverages', 'seasonal_items', etc.
    
    -- Seasonal data
    month INTEGER NOT NULL,
    week_of_year INTEGER,
    season TEXT, -- 'spring', 'summer', 'fall', 'winter'
    
    -- Price patterns
    typical_price_multiplier REAL NOT NULL, -- vs annual average
    demand_level TEXT NOT NULL, -- 'low', 'medium', 'high', 'peak'
    price_volatility REAL DEFAULT 0.0,
    
    -- Historical data
    historical_low_price REAL,
    historical_high_price REAL,
    sample_count INTEGER DEFAULT 1,
    
    -- Recommendations
    buying_recommendation TEXT, -- 'buy_now', 'wait', 'stock_up'
    confidence_level REAL DEFAULT 0.5,
    
    -- Timestamps
    pattern_created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(category, product_pattern, month)
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- Optimized for deal detection queries and real-time processing
-- =============================================================================

-- Price history indexes
CREATE INDEX IF NOT EXISTS idx_price_history_product_time 
ON price_history_enhanced(product_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_deal_candidates 
ON price_history_enhanced(is_deal_candidate, recorded_at DESC) 
WHERE is_deal_candidate = 1;

CREATE INDEX IF NOT EXISTS idx_price_history_price_changes 
ON price_history_enhanced(price_change_percentage, recorded_at DESC) 
WHERE price_change_percentage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_price_history_category_time 
ON price_history_enhanced(category, recorded_at DESC);

-- Price statistics indexes
CREATE INDEX IF NOT EXISTS idx_price_statistics_category 
ON price_statistics(category);

CREATE INDEX IF NOT EXISTS idx_price_statistics_updated 
ON price_statistics(last_updated_at DESC);

-- Deal alerts indexes
CREATE INDEX IF NOT EXISTS idx_deal_alerts_user_active 
ON deal_alerts_enhanced(user_id, is_active) 
WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_deal_alerts_product 
ON deal_alerts_enhanced(product_id, is_active);

CREATE INDEX IF NOT EXISTS idx_deal_alerts_category 
ON deal_alerts_enhanced(category, is_active);

CREATE INDEX IF NOT EXISTS idx_deal_alerts_check_time 
ON deal_alerts_enhanced(last_checked_at ASC) 
WHERE is_active = 1;

-- Detected deals indexes
CREATE INDEX IF NOT EXISTS idx_detected_deals_product 
ON detected_deals(product_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_detected_deals_score 
ON detected_deals(deal_score DESC, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_detected_deals_category_type 
ON detected_deals(category, deal_type, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_detected_deals_savings 
ON detected_deals(savings_percentage DESC, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_detected_deals_active 
ON detected_deals(detected_at DESC) 
WHERE deal_expires_at > datetime('now') OR deal_expires_at IS NULL;

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_deal_notifications_user 
ON deal_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_notifications_status 
ON deal_notifications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_notifications_deal 
ON deal_notifications(deal_id, user_id);

-- Seasonal patterns indexes
CREATE INDEX IF NOT EXISTS idx_seasonal_patterns_category_month 
ON seasonal_price_patterns(category, month);

CREATE INDEX IF NOT EXISTS idx_seasonal_patterns_season 
ON seasonal_price_patterns(season, demand_level);

-- =============================================================================
-- ANALYTICAL VIEWS FOR REAL-TIME DASHBOARD
-- =============================================================================

-- Real-time deal summary
CREATE VIEW IF NOT EXISTS v_active_deals_summary AS
SELECT 
    category,
    deal_type,
    COUNT(*) as deal_count,
    AVG(savings_percentage) as avg_savings_pct,
    AVG(deal_score) as avg_deal_score,
    MIN(detected_at) as first_detected,
    MAX(detected_at) as last_detected
FROM detected_deals 
WHERE (deal_expires_at > datetime('now') OR deal_expires_at IS NULL)
GROUP BY category, deal_type
ORDER BY deal_count DESC;

-- Price monitoring status
CREATE VIEW IF NOT EXISTS v_price_monitoring_status AS
SELECT 
    p.category,
    COUNT(DISTINCT p.product_id) as products_tracked,
    COUNT(*) as price_points,
    AVG(p.current_price) as avg_current_price,
    MIN(p.recorded_at) as oldest_record,
    MAX(p.recorded_at) as latest_record,
    COUNT(CASE WHEN p.is_deal_candidate = 1 THEN 1 END) as deal_candidates
FROM price_history_enhanced p
GROUP BY p.category
ORDER BY products_tracked DESC;

-- User alert activity
CREATE VIEW IF NOT EXISTS v_user_alert_activity AS
SELECT 
    a.user_id,
    COUNT(*) as total_alerts,
    COUNT(CASE WHEN a.is_active = 1 THEN 1 END) as active_alerts,
    COUNT(CASE WHEN a.last_triggered_at IS NOT NULL THEN 1 END) as triggered_alerts,
    MAX(a.last_triggered_at) as last_trigger,
    COUNT(DISTINCT n.id) as total_notifications
FROM deal_alerts_enhanced a
LEFT JOIN deal_notifications n ON a.id = n.alert_id
GROUP BY a.user_id
ORDER BY total_alerts DESC;

-- Deal performance metrics
CREATE VIEW IF NOT EXISTS v_deal_performance_metrics AS
SELECT 
    DATE(detected_at) as deal_date,
    category,
    deal_type,
    COUNT(*) as deals_detected,
    AVG(savings_percentage) as avg_savings_pct,
    AVG(deal_score) as avg_deal_score,
    COUNT(CASE WHEN historical_low = 1 THEN 1 END) as historical_lows,
    COUNT(DISTINCT product_id) as unique_products
FROM detected_deals
GROUP BY DATE(detected_at), category, deal_type
ORDER BY deal_date DESC, deals_detected DESC;

-- =============================================================================
-- TRIGGERS FOR AUTOMATED UPDATES
-- =============================================================================

-- Auto-update price statistics when new prices are recorded
CREATE TRIGGER IF NOT EXISTS update_price_statistics_on_insert
AFTER INSERT ON price_history_enhanced
BEGIN
    INSERT OR REPLACE INTO price_statistics (
        product_id, walmart_id, product_name, category,
        current_price, first_tracked_at, last_updated_at, update_count
    )
    VALUES (
        NEW.product_id, NEW.walmart_id, NEW.product_name, NEW.category,
        NEW.current_price, 
        COALESCE((SELECT first_tracked_at FROM price_statistics WHERE product_id = NEW.product_id), NEW.recorded_at),
        NEW.recorded_at,
        COALESCE((SELECT update_count FROM price_statistics WHERE product_id = NEW.product_id), 0) + 1
    );
END;

-- Update deal alert check timestamps
CREATE TRIGGER IF NOT EXISTS update_alert_timestamp
AFTER UPDATE ON deal_alerts_enhanced
WHEN NEW.last_checked_at != OLD.last_checked_at
BEGIN
  UPDATE deal_alerts_enhanced 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- Log notification status changes
CREATE TRIGGER IF NOT EXISTS log_notification_delivery
AFTER UPDATE ON deal_notifications
WHEN NEW.status != OLD.status
BEGIN
  UPDATE deal_notifications 
  SET delivered_at = CASE WHEN NEW.status = 'delivered' THEN CURRENT_TIMESTAMP ELSE OLD.delivered_at END,
      sent_at = CASE WHEN NEW.status = 'sent' AND OLD.sent_at IS NULL THEN CURRENT_TIMESTAMP ELSE OLD.sent_at END
  WHERE id = NEW.id;
END;

-- =============================================================================
-- SAMPLE DATA FOR TESTING
-- =============================================================================

-- Insert sample seasonal patterns
INSERT OR REPLACE INTO seasonal_price_patterns (
    id, category, product_pattern, month, season, 
    typical_price_multiplier, demand_level, buying_recommendation, confidence_level
) VALUES 
    ('seasonal_produce_summer', 'produce', 'seasonal_fruits', 7, 'summer', 0.8, 'peak', 'buy_now', 0.9),
    ('seasonal_produce_winter', 'produce', 'seasonal_fruits', 12, 'winter', 1.3, 'low', 'wait', 0.8),
    ('seasonal_beverages_summer', 'beverages', 'cold_drinks', 6, 'summer', 1.1, 'high', 'stock_up', 0.7),
    ('seasonal_frozen_winter', 'frozen', 'ice_cream', 1, 'winter', 0.9, 'low', 'buy_now', 0.6);

-- Performance monitoring query templates
/*
-- Check deal detection performance
SELECT 
    DATE(detected_at) as date,
    COUNT(*) as deals_found,
    AVG(deal_score) as avg_score,
    AVG(savings_percentage) as avg_savings
FROM detected_deals 
WHERE detected_at > datetime('now', '-7 days')
GROUP BY DATE(detected_at)
ORDER BY date DESC;

-- Monitor price tracking coverage
SELECT 
    category,
    COUNT(DISTINCT product_id) as products,
    COUNT(*) as price_records,
    MAX(recorded_at) as last_update
FROM price_history_enhanced 
WHERE recorded_at > datetime('now', '-24 hours')
GROUP BY category
ORDER BY products DESC;

-- User engagement with deals
SELECT 
    u.id as user_id,
    COUNT(n.id) as notifications,
    COUNT(CASE WHEN n.viewed_at IS NOT NULL THEN 1 END) as viewed,
    COUNT(CASE WHEN n.clicked_at IS NOT NULL THEN 1 END) as clicked,
    ROUND(
        100.0 * COUNT(CASE WHEN n.clicked_at IS NOT NULL THEN 1 END) / 
        NULLIF(COUNT(n.id), 0), 2
    ) as click_rate
FROM users u
LEFT JOIN deal_notifications n ON u.id = n.user_id 
WHERE n.created_at > datetime('now', '-30 days')
GROUP BY u.id
HAVING notifications > 0
ORDER BY click_rate DESC;
*/