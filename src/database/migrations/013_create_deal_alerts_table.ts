import Database from "better-sqlite3";

/**
 * Migration: Create deal alerts table
 * Version: 013
 * Description: Creates comprehensive deal alerts system for price drop alerts, notifications, and deal tracking
 */

export function up(db: Database) {
  console.log("Creating deal alerts tables...");

  // Create deal_alerts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS deal_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      
      -- Alert identification and metadata
      alert_name TEXT NOT NULL,
      alert_description TEXT,
      alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'stock_alert', 'sale_alert', 'coupon_alert', 'seasonal_alert', 'custom')),
      
      -- Product targeting
      product_name TEXT,
      product_brand TEXT,
      product_category TEXT,
      upc_code TEXT,
      sku TEXT,
      keywords TEXT, -- JSON array of keywords to match
      exact_match_required BOOLEAN DEFAULT false,
      
      -- Price thresholds and conditions
      target_price DECIMAL(10,2), -- Alert when price reaches this level
      price_drop_percentage DECIMAL(5,2), -- Alert when price drops by this %
      price_drop_amount DECIMAL(10,2), -- Alert when price drops by this amount
      maximum_acceptable_price DECIMAL(10,2), -- Don't alert above this price
      minimum_quality_threshold INTEGER CHECK (minimum_quality_threshold BETWEEN 1 AND 5),
      
      -- Store and availability preferences
      preferred_stores TEXT, -- JSON array of store names/IDs
      excluded_stores TEXT, -- JSON array of stores to exclude
      online_deals_included BOOLEAN DEFAULT true,
      in_store_deals_included BOOLEAN DEFAULT true,
      require_immediate_availability BOOLEAN DEFAULT false,
      
      -- Alert timing and frequency
      alert_frequency TEXT DEFAULT 'immediate' CHECK (alert_frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
      quiet_hours_start TEXT, -- HH:MM format
      quiet_hours_end TEXT, -- HH:MM format
      alert_days TEXT, -- JSON array: ['monday', 'tuesday', etc.] or ['weekdays', 'weekends', 'all']
      
      -- Alert status and lifecycle
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'fulfilled', 'cancelled')),
      priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
      max_alerts_per_day INTEGER DEFAULT 5,
      alerts_sent_today INTEGER DEFAULT 0,
      last_reset_date TEXT, -- When alerts_sent_today was last reset
      
      -- Expiration and auto-management
      expiration_date TEXT,
      auto_expire_after_days INTEGER DEFAULT 90,
      auto_pause_if_not_found_days INTEGER DEFAULT 30,
      auto_delete_after_fulfillment BOOLEAN DEFAULT false,
      
      -- Notification preferences
      notification_methods TEXT, -- JSON array: ['email', 'push', 'sms', 'webhook']
      email_notifications BOOLEAN DEFAULT true,
      push_notifications BOOLEAN DEFAULT true,
      sms_notifications BOOLEAN DEFAULT false,
      
      -- Advanced conditions
      conditions TEXT, -- JSON object with complex conditions
      seasonal_restrictions TEXT, -- JSON: {seasons: ['summer'], holidays: ['memorial_day']}
      quantity_requirements TEXT, -- JSON: {min_quantity: 1, bulk_discount_required: true}
      
      -- Tracking and analytics
      times_triggered INTEGER DEFAULT 0,
      times_clicked INTEGER DEFAULT 0,
      times_purchased INTEGER DEFAULT 0,
      total_savings_generated DECIMAL(10,2) DEFAULT 0.00,
      last_triggered_at TEXT,
      last_price_seen DECIMAL(10,2),
      last_availability_check TEXT,
      
      -- Learning and optimization
      effectiveness_score DECIMAL(3,2) DEFAULT 0.00, -- 0-1 based on user engagement
      user_satisfaction_rating INTEGER CHECK (user_satisfaction_rating BETWEEN 1 AND 5),
      auto_optimization_enabled BOOLEAN DEFAULT true,
      
      -- Metadata and customization
      tags TEXT, -- JSON array of custom tags
      notes TEXT,
      custom_webhook_url TEXT,
      metadata TEXT, -- JSON for additional data
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT DEFAULT 'user', -- 'user', 'system', 'ai_suggestion'
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create deal_notifications table for tracking sent notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS deal_notifications (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      
      -- Notification details
      notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'push', 'sms', 'webhook', 'in_app')),
      subject TEXT,
      message_content TEXT,
      
      -- Deal information that triggered the alert
      product_name TEXT NOT NULL,
      product_brand TEXT,
      product_category TEXT,
      store_name TEXT,
      original_price DECIMAL(10,2),
      sale_price DECIMAL(10,2),
      discount_percentage DECIMAL(5,2),
      discount_amount DECIMAL(10,2),
      
      -- Availability and urgency
      availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'limited', 'low_stock', 'out_of_stock')),
      urgency_level TEXT DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'high', 'urgent')),
      deal_expires_at TEXT,
      stock_level INTEGER,
      
      -- Delivery status
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
      delivery_attempt_count INTEGER DEFAULT 1,
      delivered_at TEXT,
      read_at TEXT,
      clicked_at TEXT,
      
      -- User interaction tracking
      was_clicked BOOLEAN DEFAULT false,
      was_purchased BOOLEAN DEFAULT false,
      purchase_amount DECIMAL(10,2),
      user_feedback TEXT, -- 'helpful', 'not_helpful', 'irrelevant', etc.
      user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
      
      -- External references
      deal_url TEXT,
      coupon_code TEXT,
      promotion_id TEXT,
      external_deal_id TEXT,
      
      -- Error handling
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      
      -- Metadata
      device_type TEXT, -- 'mobile', 'desktop', 'tablet'
      location_context TEXT, -- JSON with user location if available
      metadata TEXT, -- JSON
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (alert_id) REFERENCES deal_alerts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create deal_sources table for tracking where deals come from
  db.exec(`
    CREATE TABLE IF NOT EXISTS deal_sources (
      id TEXT PRIMARY KEY,
      source_name TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL CHECK (source_type IN ('api', 'scraper', 'feed', 'manual', 'partner')),
      base_url TEXT,
      api_endpoint TEXT,
      
      -- Source configuration
      is_active BOOLEAN DEFAULT true,
      polling_frequency_minutes INTEGER DEFAULT 60,
      last_poll_at TEXT,
      next_poll_at TEXT,
      
      -- Authentication and access
      requires_auth BOOLEAN DEFAULT false,
      auth_type TEXT, -- 'api_key', 'oauth', 'basic', 'bearer'
      auth_config TEXT, -- JSON with auth details (encrypted)
      
      -- Data quality and reliability
      reliability_score DECIMAL(3,2) DEFAULT 1.0, -- 0-1 score
      average_response_time INTEGER, -- milliseconds
      success_rate DECIMAL(5,4) DEFAULT 1.0000, -- 0-1
      last_error_at TEXT,
      consecutive_failures INTEGER DEFAULT 0,
      
      -- Supported features
      supports_price_tracking BOOLEAN DEFAULT true,
      supports_inventory_tracking BOOLEAN DEFAULT false,
      supports_historical_data BOOLEAN DEFAULT false,
      supported_categories TEXT, -- JSON array
      supported_stores TEXT, -- JSON array
      
      -- Rate limiting
      rate_limit_per_hour INTEGER,
      requests_this_hour INTEGER DEFAULT 0,
      hour_reset_at TEXT,
      
      -- Metadata
      description TEXT,
      contact_info TEXT,
      terms_of_service_url TEXT,
      data_freshness_minutes INTEGER DEFAULT 60,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create tracked_deals table for deals we're monitoring
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_deals (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      
      -- Deal identification
      external_deal_id TEXT, -- ID from the source system
      deal_url TEXT,
      product_name TEXT NOT NULL,
      product_brand TEXT,
      product_category TEXT,
      upc_code TEXT,
      sku TEXT,
      
      -- Store and availability
      store_name TEXT NOT NULL,
      store_location TEXT,
      availability_status TEXT DEFAULT 'unknown' CHECK (availability_status IN ('available', 'limited', 'out_of_stock', 'unknown')),
      stock_quantity INTEGER,
      
      -- Pricing information
      current_price DECIMAL(10,2) NOT NULL,
      original_price DECIMAL(10,2),
      discount_percentage DECIMAL(5,2),
      discount_amount DECIMAL(10,2),
      price_history TEXT, -- JSON array of {date, price} objects
      
      -- Deal timing
      deal_starts_at TEXT,
      deal_expires_at TEXT,
      last_updated_at TEXT,
      is_expired BOOLEAN DEFAULT false,
      
      -- Deal quality and metadata
      deal_quality_score DECIMAL(3,2), -- AI-computed quality score 0-1
      popularity_score DECIMAL(3,2), -- How popular this deal is
      tags TEXT, -- JSON array
      description TEXT,
      
      -- Matching and alerting
      matching_alerts_count INTEGER DEFAULT 0,
      notifications_sent INTEGER DEFAULT 0,
      clicks_generated INTEGER DEFAULT 0,
      purchases_generated INTEGER DEFAULT 0,
      
      -- Data validation
      is_validated BOOLEAN DEFAULT false,
      validation_confidence DECIMAL(3,2),
      validation_notes TEXT,
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (source_id) REFERENCES deal_sources(id) ON DELETE CASCADE
    );
  `);

  // Create comprehensive indexes for deal_alerts
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_user_id ON deal_alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_status ON deal_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_alert_type ON deal_alerts(alert_type);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_priority ON deal_alerts(priority DESC);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_product_name ON deal_alerts(product_name);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_product_brand ON deal_alerts(product_brand);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_upc ON deal_alerts(upc_code);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_expiration ON deal_alerts(expiration_date);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_last_triggered ON deal_alerts(last_triggered_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_effectiveness ON deal_alerts(effectiveness_score DESC);
    
    -- Composite indexes for alert matching
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_active_product ON deal_alerts(status, product_name, product_brand) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_active_category ON deal_alerts(status, product_category) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_user_active ON deal_alerts(user_id, status) WHERE status = 'active';
  `);

  // Create indexes for deal_notifications
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_alert_id ON deal_notifications(alert_id);
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_user_id ON deal_notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_sent_at ON deal_notifications(sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_delivery_status ON deal_notifications(delivery_status);
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_clicked ON deal_notifications(was_clicked);
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_purchased ON deal_notifications(was_purchased);
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_product ON deal_notifications(product_name, product_brand);
    
    -- Analytics indexes
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_user_engagement ON deal_notifications(user_id, was_clicked, was_purchased);
    CREATE INDEX IF NOT EXISTS idx_deal_notifications_effectiveness ON deal_notifications(alert_id, was_clicked, was_purchased, sent_at);
  `);

  // Create indexes for deal_sources
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_deal_sources_active ON deal_sources(is_active);
    CREATE INDEX IF NOT EXISTS idx_deal_sources_next_poll ON deal_sources(next_poll_at);
    CREATE INDEX IF NOT EXISTS idx_deal_sources_reliability ON deal_sources(reliability_score DESC);
    CREATE INDEX IF NOT EXISTS idx_deal_sources_source_type ON deal_sources(source_type);
  `);

  // Create indexes for tracked_deals
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_source_id ON tracked_deals(source_id);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_product_name ON tracked_deals(product_name);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_store_name ON tracked_deals(store_name);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_current_price ON tracked_deals(current_price);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_expires_at ON tracked_deals(deal_expires_at);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_quality_score ON tracked_deals(deal_quality_score DESC);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_updated_at ON tracked_deals(last_updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_upc ON tracked_deals(upc_code);
    
    -- Composite indexes for deal matching
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_product_store ON tracked_deals(product_name, store_name, current_price);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_brand_category ON tracked_deals(product_brand, product_category, current_price);
    CREATE INDEX IF NOT EXISTS idx_tracked_deals_active_deals ON tracked_deals(is_expired, availability_status, current_price) WHERE is_expired = false;
  `);

  console.log("✅ Deal alerts tables created successfully");
}

export function down(db: Database) {
  console.log("Dropping deal alerts tables...");

  db.exec(`DROP TABLE IF EXISTS tracked_deals;`);
  db.exec(`DROP TABLE IF EXISTS deal_sources;`);
  db.exec(`DROP TABLE IF EXISTS deal_notifications;`);
  db.exec(`DROP TABLE IF EXISTS deal_alerts;`);

  console.log("✅ Deal alerts tables dropped successfully");
}