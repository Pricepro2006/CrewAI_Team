import Database, { Database as DatabaseInstance } from "better-sqlite3";

/**
 * Migration: Create advanced grocery indexes and relationships
 * Version: 014
 * Description: Creates comprehensive indexes, views, and triggers for optimal grocery system performance
 */

export function up(db: DatabaseInstance) {
  console.log("Creating advanced grocery indexes and relationships...");

  // Advanced composite indexes for complex queries
  db.exec(`
    -- Purchase history analysis indexes
    CREATE INDEX IF NOT EXISTS idx_purchase_history_user_product_trend ON purchase_history(user_id, product_name, product_brand, purchase_date DESC);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_price_comparison ON purchase_history(upc_code, store_name, purchase_date DESC, unit_price);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_seasonal_analysis ON purchase_history(user_id, season, product_category, purchase_date DESC);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_loyalty_tracking ON purchase_history(user_id, store_name, purchase_date DESC, loyalty_points_earned);
    CREATE INDEX IF NOT EXISTS idx_purchase_history_budget_analysis ON purchase_history(user_id, purchase_date, product_category, final_price);
    
    -- Advanced grocery list indexes
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_status_priority ON grocery_lists(user_id, status, priority DESC);
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_recurring_schedule ON grocery_lists(is_recurring, next_occurrence_date) WHERE is_recurring = true;
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_shopping_schedule ON grocery_lists(user_id, shopping_date, status) WHERE status IN ('active', 'pending');
    
    -- Advanced grocery items indexes  
    CREATE INDEX IF NOT EXISTS idx_grocery_items_list_status_priority ON grocery_items(list_id, status, priority DESC);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_user_product_tracking ON grocery_items(user_id, product_name, product_brand, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_price_optimization ON grocery_items(product_name, product_brand, estimated_price, actual_price);
    CREATE INDEX IF NOT EXISTS idx_grocery_items_dietary_filtering ON grocery_items(user_id, is_organic, dietary_tags) WHERE is_organic = true OR dietary_tags IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_grocery_items_substitution_matching ON grocery_items(product_category, substitution_allowed, availability_status) WHERE substitution_allowed = true;
    
    -- Deal alert performance indexes
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_matching_engine ON deal_alerts(status, alert_type, product_name, product_brand, target_price) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_notification_schedule ON deal_alerts(user_id, alert_frequency, last_triggered_at, status) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_deal_alerts_effectiveness_analysis ON deal_alerts(user_id, effectiveness_score DESC, times_triggered DESC);
    
    -- Brand preference analysis indexes
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_recommendation_engine ON brand_preferences(user_id, preference_type, preference_strength DESC, category);
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_purchase_correlation ON brand_preferences(user_id, brand_name, times_purchased DESC, average_satisfaction DESC);
  `);

  // Create materialized views for common analytics queries
  db.exec(`
    -- User spending summary view
    CREATE VIEW IF NOT EXISTS v_user_spending_summary AS
    SELECT 
      p.user_id,
      COUNT(DISTINCT DATE(p.purchase_date)) as shopping_days_last_30,
      COUNT(*) as total_items_purchased,
      SUM(p.final_price) as total_spent,
      AVG(p.final_price) as avg_item_cost,
      SUM(CASE WHEN p.purchase_date >= DATE('now', '-7 days') THEN p.final_price ELSE 0 END) as spent_last_7_days,
      SUM(CASE WHEN p.purchase_date >= DATE('now', '-30 days') THEN p.final_price ELSE 0 END) as spent_last_30_days,
      COUNT(DISTINCT p.store_name) as unique_stores_visited,
      (SELECT store_name FROM purchase_history ph WHERE ph.user_id = p.user_id GROUP BY store_name ORDER BY COUNT(*) DESC LIMIT 1) as favorite_store
    FROM purchase_history p
    WHERE p.purchase_date >= DATE('now', '-30 days')
    GROUP BY p.user_id;
    
    -- Product price trends view
    CREATE VIEW IF NOT EXISTS v_product_price_trends AS
    SELECT 
      product_name,
      product_brand,
      upc_code,
      store_name,
      COUNT(*) as purchase_count,
      MIN(unit_price) as lowest_price,
      MAX(unit_price) as highest_price,
      AVG(unit_price) as average_price,
      (MAX(unit_price) - MIN(unit_price)) / MIN(unit_price) * 100 as price_volatility_percent,
      MIN(purchase_date) as first_seen,
      MAX(purchase_date) as last_seen,
      CASE 
        WHEN AVG(CASE WHEN purchase_date >= DATE('now', '-30 days') THEN unit_price END) > 
             AVG(CASE WHEN purchase_date < DATE('now', '-30 days') THEN unit_price END) 
        THEN 'increasing'
        WHEN AVG(CASE WHEN purchase_date >= DATE('now', '-30 days') THEN unit_price END) < 
             AVG(CASE WHEN purchase_date < DATE('now', '-30 days') THEN unit_price END) 
        THEN 'decreasing'
        ELSE 'stable'
      END as price_trend
    FROM purchase_history
    WHERE purchase_date >= DATE('now', '-90 days')
    GROUP BY product_name, product_brand, upc_code, store_name
    HAVING COUNT(*) >= 3;
    
    -- User grocery behavior analysis view
    CREATE VIEW IF NOT EXISTS v_user_grocery_behavior AS
    SELECT 
      u.id as user_id,
      u.email,
      COUNT(DISTINCT gl.id) as total_lists_created,
      COUNT(DISTINCT CASE WHEN gl.status = 'completed' THEN gl.id END) as completed_lists,
      COUNT(DISTINCT gi.id) as total_items_added,
      COUNT(DISTINCT CASE WHEN gi.status = 'purchased' THEN gi.id END) as items_purchased,
      ROUND(
        CAST(COUNT(DISTINCT CASE WHEN gi.status = 'purchased' THEN gi.id END) AS FLOAT) /
        NULLIF(COUNT(DISTINCT gi.id), 0) * 100, 2
      ) as purchase_completion_rate,
      COUNT(DISTINCT ph.id) as total_purchases,
      COALESCE(SUM(ph.final_price), 0) as total_spent,
      up.overall_price_sensitivity,
      up.shopping_frequency,
      (SELECT COUNT(*) FROM deal_alerts da WHERE da.user_id = u.id AND da.status = 'active') as active_alerts,
      (SELECT COUNT(*) FROM deal_notifications dn WHERE dn.user_id = u.id AND dn.was_clicked = true) as alert_clicks
    FROM users u
    LEFT JOIN user_preferences up ON u.id = up.user_id
    LEFT JOIN grocery_lists gl ON u.id = gl.user_id
    LEFT JOIN grocery_items gi ON u.id = gi.user_id
    LEFT JOIN purchase_history ph ON u.id = ph.user_id AND ph.purchase_date >= DATE('now', '-90 days')
    GROUP BY u.id, u.email, up.overall_price_sensitivity, up.shopping_frequency;
    
    -- Deal alert effectiveness view
    CREATE VIEW IF NOT EXISTS v_deal_alert_effectiveness AS
    SELECT 
      da.id as alert_id,
      da.user_id,
      da.alert_name,
      da.alert_type,
      da.product_name,
      da.product_brand,
      da.times_triggered,
      COUNT(dn.id) as notifications_sent,
      COUNT(CASE WHEN dn.was_clicked = true THEN 1 END) as notifications_clicked,
      COUNT(CASE WHEN dn.was_purchased = true THEN 1 END) as purchases_generated,
      COALESCE(SUM(dn.purchase_amount), 0) as total_purchase_value,
      ROUND(
        CAST(COUNT(CASE WHEN dn.was_clicked = true THEN 1 END) AS FLOAT) /
        NULLIF(COUNT(dn.id), 0) * 100, 2
      ) as click_through_rate,
      ROUND(
        CAST(COUNT(CASE WHEN dn.was_purchased = true THEN 1 END) AS FLOAT) /
        NULLIF(COUNT(dn.id), 0) * 100, 2
      ) as conversion_rate,
      da.effectiveness_score,
      da.created_at,
      da.last_triggered_at
    FROM deal_alerts da
    LEFT JOIN deal_notifications dn ON da.id = dn.alert_id
    WHERE da.status IN ('active', 'fulfilled')
    GROUP BY da.id, da.user_id, da.alert_name, da.alert_type, da.product_name, da.product_brand, 
             da.times_triggered, da.effectiveness_score, da.created_at, da.last_triggered_at;
  `);

  // Create triggers for automatic data maintenance
  db.exec(`
    -- Trigger to update grocery list total costs when items change
    CREATE TRIGGER IF NOT EXISTS update_grocery_list_costs
    AFTER INSERT ON grocery_items
    FOR EACH ROW
    BEGIN
      UPDATE grocery_lists 
      SET 
        total_estimated_cost = (
          SELECT COALESCE(SUM(estimated_price * quantity), 0) 
          FROM grocery_items 
          WHERE list_id = NEW.list_id
        ),
        total_actual_cost = (
          SELECT COALESCE(SUM(actual_price * quantity), 0) 
          FROM grocery_items 
          WHERE list_id = NEW.list_id AND actual_price IS NOT NULL
        ),
        updated_at = datetime('now')
      WHERE id = NEW.list_id;
    END;
    
    -- Trigger to update brand preferences based on purchases
    CREATE TRIGGER IF NOT EXISTS update_brand_preferences_on_purchase
    AFTER INSERT ON purchase_history
    FOR EACH ROW
    WHEN NEW.product_brand IS NOT NULL
    BEGIN
      INSERT OR REPLACE INTO brand_preferences (
        id, user_id, brand_name, category, preference_type, preference_strength,
        times_purchased, last_purchase_date, created_at, updated_at
      )
      VALUES (
        COALESCE(
          (SELECT id FROM brand_preferences WHERE user_id = NEW.user_id AND brand_name = NEW.product_brand AND category = NEW.product_category),
          'bp_' || NEW.user_id || '_' || LOWER(REPLACE(NEW.product_brand, ' ', '_')) || '_' || LOWER(REPLACE(NEW.product_category, ' ', '_'))
        ),
        NEW.user_id,
        NEW.product_brand,
        NEW.product_category,
        'preferred',
        CASE 
          WHEN (SELECT times_purchased FROM brand_preferences WHERE user_id = NEW.user_id AND brand_name = NEW.product_brand AND category = NEW.product_category) >= 5 
          THEN 8
          WHEN (SELECT times_purchased FROM brand_preferences WHERE user_id = NEW.user_id AND brand_name = NEW.product_brand AND category = NEW.product_category) >= 3 
          THEN 6
          ELSE 4
        END,
        COALESCE((SELECT times_purchased FROM brand_preferences WHERE user_id = NEW.user_id AND brand_name = NEW.product_brand AND category = NEW.product_category), 0) + 1,
        NEW.purchase_date,
        COALESCE((SELECT created_at FROM brand_preferences WHERE user_id = NEW.user_id AND brand_name = NEW.product_brand AND category = NEW.product_category), datetime('now')),
        datetime('now')
      );
    END;
    
    -- Trigger to update deal alert effectiveness scores
    CREATE TRIGGER IF NOT EXISTS update_deal_alert_effectiveness
    AFTER UPDATE OF was_clicked, was_purchased ON deal_notifications
    FOR EACH ROW
    WHEN NEW.was_clicked != OLD.was_clicked OR NEW.was_purchased != OLD.was_purchased
    BEGIN
      UPDATE deal_alerts 
      SET 
        effectiveness_score = (
          SELECT 
            ROUND(
              (CAST(COUNT(CASE WHEN dn.was_clicked = true THEN 1 END) AS FLOAT) * 0.3 +
               CAST(COUNT(CASE WHEN dn.was_purchased = true THEN 1 END) AS FLOAT) * 0.7) /
              NULLIF(COUNT(dn.id), 0), 3
            )
          FROM deal_notifications dn 
          WHERE dn.alert_id = NEW.alert_id
        ),
        updated_at = datetime('now')
      WHERE id = NEW.alert_id;
    END;
    
    -- Trigger to automatically update grocery item status based on purchase history
    CREATE TRIGGER IF NOT EXISTS sync_grocery_items_with_purchases
    AFTER INSERT ON purchase_history
    FOR EACH ROW
    WHEN NEW.list_id IS NOT NULL AND NEW.was_planned = true
    BEGIN
      UPDATE grocery_items 
      SET 
        status = 'purchased',
        actual_price = NEW.unit_price,
        purchase_date = NEW.purchase_date,
        updated_at = datetime('now')
      WHERE 
        list_id = NEW.list_id 
        AND product_name = NEW.product_name 
        AND (product_brand = NEW.product_brand OR product_brand IS NULL)
        AND status IN ('pending', 'in_cart');
    END;
  `);

  // Create stored procedures (SQLite functions) for common operations
  db.exec(`
    -- Note: SQLite doesn't support stored procedures, but we can document common query patterns
    -- These would be implemented in the application layer
    
    -- Common query patterns to implement in application:
    -- 1. get_user_spending_insights(user_id, days_back)
    -- 2. get_price_drop_opportunities(user_id, category)
    -- 3. get_shopping_list_recommendations(user_id, list_id)
    -- 4. get_deal_alert_suggestions(user_id)
    -- 5. get_budget_analysis(user_id, period)
    -- 6. get_brand_loyalty_analysis(user_id)
    -- 7. get_seasonal_shopping_patterns(user_id)
  `);

  console.log("✅ Advanced grocery indexes and relationships created successfully");
}

export function down(db: DatabaseInstance) {
  console.log("Dropping advanced grocery indexes and relationships...");

  // Drop triggers
  db.exec(`
    DROP TRIGGER IF EXISTS sync_grocery_items_with_purchases;
    DROP TRIGGER IF EXISTS update_deal_alert_effectiveness;
    DROP TRIGGER IF EXISTS update_brand_preferences_on_purchase;
    DROP TRIGGER IF EXISTS update_grocery_list_costs;
  `);

  // Drop views
  db.exec(`
    DROP VIEW IF EXISTS v_deal_alert_effectiveness;
    DROP VIEW IF EXISTS v_user_grocery_behavior;
    DROP VIEW IF EXISTS v_product_price_trends;
    DROP VIEW IF EXISTS v_user_spending_summary;
  `);

  // Drop advanced indexes (SQLite will drop them automatically when tables are dropped)
  console.log("✅ Advanced grocery indexes and relationships dropped successfully");
}