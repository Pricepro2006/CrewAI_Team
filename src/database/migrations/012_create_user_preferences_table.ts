import type { Database } from "better-sqlite3";

/**
 * Migration: Create user preferences table
 * Version: 012  
 * Description: Creates comprehensive user preferences for brand preferences, dietary restrictions, price sensitivity, and shopping behavior
 */

export function up(db: Database.Database) {
  console.log("Creating user preferences table...");

  // Create user_preferences table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      
      -- Dietary Restrictions and Preferences
      dietary_restrictions TEXT, -- JSON array: ['gluten_free', 'dairy_free', 'nut_free', 'vegetarian', 'vegan', 'keto', 'paleo', etc.]
      dietary_preferences TEXT, -- JSON array: ['organic', 'non_gmo', 'local', 'sustainable', 'fair_trade', etc.]
      allergens TEXT, -- JSON array: ['nuts', 'dairy', 'eggs', 'shellfish', 'soy', 'wheat', etc.]
      medical_conditions TEXT, -- JSON array: ['diabetes', 'hypertension', 'celiac', etc.]
      calorie_target INTEGER, -- Daily calorie target
      macro_targets TEXT, -- JSON: {protein: 150, carbs: 200, fat: 80} in grams
      
      -- Brand Preferences
      preferred_brands TEXT, -- JSON array of preferred brand names
      avoided_brands TEXT, -- JSON array of brands to avoid
      brand_loyalty_level TEXT DEFAULT 'moderate' CHECK (brand_loyalty_level IN ('low', 'moderate', 'high', 'exclusive')),
      generic_brand_acceptance TEXT DEFAULT 'acceptable' CHECK (generic_brand_acceptance IN ('preferred', 'acceptable', 'avoid')),
      
      -- Price Sensitivity and Budget
      overall_price_sensitivity TEXT DEFAULT 'moderate' CHECK (overall_price_sensitivity IN ('very_low', 'low', 'moderate', 'high', 'very_high')),
      monthly_grocery_budget DECIMAL(10,2),
      weekly_grocery_budget DECIMAL(10,2),
      category_budgets TEXT, -- JSON: {produce: 100, meat: 150, dairy: 80, etc.}
      max_item_price_limits TEXT, -- JSON: {meat: 15.00, produce: 5.00, etc.}
      bulk_purchase_preference BOOLEAN DEFAULT false,
      coupon_usage_frequency TEXT DEFAULT 'sometimes' CHECK (coupon_usage_frequency IN ('never', 'rarely', 'sometimes', 'often', 'always')),
      sale_price_threshold DECIMAL(5,2) DEFAULT 0.20, -- Minimum discount % to consider a sale
      
      -- Shopping Behavior
      preferred_shopping_days TEXT, -- JSON array: ['saturday', 'sunday']
      preferred_shopping_times TEXT, -- JSON array: ['morning', 'afternoon', 'evening']
      preferred_stores TEXT, -- JSON array of store names/IDs
      store_loyalty_programs TEXT, -- JSON array of loyalty program memberships
      shopping_frequency TEXT DEFAULT 'weekly' CHECK (shopping_frequency IN ('daily', 'twice_weekly', 'weekly', 'bi_weekly', 'monthly')),
      average_shopping_duration INTEGER DEFAULT 60, -- Minutes
      preferred_shopping_method TEXT DEFAULT 'in_store' CHECK (preferred_shopping_method IN ('in_store', 'online', 'curbside', 'delivery', 'mixed')),
      
      -- Product Category Preferences
      produce_preferences TEXT, -- JSON: {freshness_priority: 'high', organic_preference: 'preferred', local_preference: 'important'}
      meat_preferences TEXT, -- JSON: {quality_grade: 'choice', organic: true, grass_fed: true, antibiotic_free: true}
      dairy_preferences TEXT, -- JSON: {fat_content: 'low_fat', organic: true, lactose_free: false}
      bread_preferences TEXT, -- JSON: {type: 'whole_grain', preservative_free: true}
      beverage_preferences TEXT, -- JSON: {sugar_content: 'low', caffeine: 'moderate', organic: false}
      
      -- Nutrition and Health Focus
      nutrition_label_reading TEXT DEFAULT 'sometimes' CHECK (nutrition_label_reading IN ('never', 'rarely', 'sometimes', 'often', 'always')),
      ingredient_scrutiny_level TEXT DEFAULT 'moderate' CHECK (ingredient_scrutiny_level IN ('low', 'moderate', 'high', 'very_high')),
      avoid_ingredients TEXT, -- JSON array: ['high_fructose_corn_syrup', 'artificial_colors', 'preservatives', etc.]
      prioritize_ingredients TEXT, -- JSON array: ['whole_grains', 'fiber', 'protein', etc.]
      sodium_sensitivity TEXT DEFAULT 'moderate' CHECK (sodium_sensitivity IN ('none', 'low', 'moderate', 'high')),
      sugar_sensitivity TEXT DEFAULT 'moderate' CHECK (sugar_sensitivity IN ('none', 'low', 'moderate', 'high')),
      
      -- Convenience and Lifestyle
      meal_prep_frequency TEXT DEFAULT 'weekly' CHECK (meal_prep_frequency IN ('never', 'monthly', 'weekly', 'daily')),
      cooking_skill_level TEXT DEFAULT 'intermediate' CHECK (cooking_skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
      cooking_time_preference TEXT DEFAULT 'moderate' CHECK (cooking_time_preference IN ('quick', 'moderate', 'long', 'varies')),
      convenience_food_acceptance TEXT DEFAULT 'moderate' CHECK (convenience_food_acceptance IN ('avoid', 'minimal', 'moderate', 'high')),
      kitchen_appliances TEXT, -- JSON array: ['microwave', 'blender', 'food_processor', 'instant_pot', etc.]
      
      -- Sustainability and Ethics
      environmental_consciousness TEXT DEFAULT 'moderate' CHECK (environmental_consciousness IN ('low', 'moderate', 'high', 'very_high')),
      packaging_preference TEXT DEFAULT 'minimal' CHECK (packaging_preference IN ('no_preference', 'minimal', 'recyclable', 'compostable')),
      local_sourcing_importance TEXT DEFAULT 'moderate' CHECK (local_sourcing_importance IN ('low', 'moderate', 'high', 'critical')),
      seasonal_eating_preference BOOLEAN DEFAULT false,
      food_waste_consciousness TEXT DEFAULT 'moderate' CHECK (food_waste_consciousness IN ('low', 'moderate', 'high', 'very_high')),
      
      -- Notification and Alert Preferences
      price_drop_notifications BOOLEAN DEFAULT true,
      deal_alert_notifications BOOLEAN DEFAULT true,
      expiration_warnings BOOLEAN DEFAULT true,
      shopping_reminders BOOLEAN DEFAULT false,
      budget_warnings BOOLEAN DEFAULT true,
      new_product_alerts BOOLEAN DEFAULT false,
      seasonal_recipe_suggestions BOOLEAN DEFAULT false,
      
      -- Alert Thresholds
      price_drop_threshold DECIMAL(5,2) DEFAULT 0.15, -- Alert when price drops by this percentage
      budget_warning_threshold DECIMAL(5,2) DEFAULT 0.80, -- Alert when 80% of budget is reached
      expiration_warning_days INTEGER DEFAULT 3, -- Days before expiration to warn
      low_inventory_threshold INTEGER DEFAULT 2, -- Alert when fewer than X items remain
      
      -- Communication Preferences
      notification_frequency TEXT DEFAULT 'daily' CHECK (notification_frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
      notification_methods TEXT, -- JSON array: ['email', 'push', 'sms']
      quiet_hours_start TEXT, -- HH:MM format
      quiet_hours_end TEXT, -- HH:MM format
      timezone TEXT DEFAULT 'America/New_York',
      
      -- Family and Household
      household_size INTEGER DEFAULT 1,
      adults_in_household INTEGER DEFAULT 1,
      children_in_household INTEGER DEFAULT 0,
      children_ages TEXT, -- JSON array of ages
      pet_food_needed BOOLEAN DEFAULT false,
      pet_types TEXT, -- JSON array: ['dog', 'cat', 'bird', etc.]
      
      -- Special Occasions and Seasons
      holiday_shopping_preferences TEXT, -- JSON: {thanksgiving: {budget: 200, preferences: []}, christmas: {}}
      birthday_months TEXT, -- JSON array of months with birthdays
      anniversary_dates TEXT, -- JSON array of important dates
      
      -- Learning and Adaptation
      auto_learn_preferences BOOLEAN DEFAULT true,
      share_data_for_recommendations BOOLEAN DEFAULT true,
      privacy_level TEXT DEFAULT 'standard' CHECK (privacy_level IN ('minimal', 'standard', 'enhanced', 'maximum')),
      
      -- Flexible metadata and custom fields
      custom_categories TEXT, -- JSON object for user-defined categories
      tags TEXT, -- JSON array of custom tags
      notes TEXT,
      metadata TEXT, -- JSON for additional flexible data
      
      -- Audit and timestamps
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_shopping_behavior_update TEXT,
      preferences_version INTEGER DEFAULT 1,
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create brand_preferences table for detailed brand tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS brand_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      category TEXT, -- Product category this brand preference applies to
      preference_type TEXT NOT NULL CHECK (preference_type IN ('preferred', 'avoided', 'neutral')),
      preference_strength INTEGER CHECK (preference_strength BETWEEN 1 AND 10), -- 1=slight, 10=absolute
      reason TEXT, -- 'quality', 'price', 'ethics', 'taste', 'health', etc.
      notes TEXT,
      
      -- Usage tracking
      times_purchased INTEGER DEFAULT 0,
      times_considered INTEGER DEFAULT 0,
      last_purchase_date TEXT,
      average_satisfaction DECIMAL(3,2), -- 0.00 to 5.00
      
      -- Price sensitivity for this brand
      price_premium_acceptable DECIMAL(5,2), -- % premium willing to pay
      sale_threshold DECIMAL(5,2), -- % discount to prefer over preferred brand
      
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, brand_name, category)
    );
  `);

  // Create dietary_goals table for tracking nutrition goals
  db.exec(`
    CREATE TABLE IF NOT EXISTS dietary_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      goal_type TEXT NOT NULL, -- 'weight_loss', 'muscle_gain', 'maintain', 'health_condition'
      target_value DECIMAL(10,2),
      current_value DECIMAL(10,2),
      target_date TEXT,
      
      -- Nutritional targets
      daily_calorie_target INTEGER,
      protein_target DECIMAL(8,2), -- grams
      carb_target DECIMAL(8,2), -- grams
      fat_target DECIMAL(8,2), -- grams
      fiber_target DECIMAL(8,2), -- grams
      sodium_limit DECIMAL(8,2), -- mg
      sugar_limit DECIMAL(8,2), -- grams
      
      -- Tracking preferences
      track_calories BOOLEAN DEFAULT true,
      track_macros BOOLEAN DEFAULT false,
      track_micros BOOLEAN DEFAULT false,
      track_water_intake BOOLEAN DEFAULT false,
      
      -- Goal metadata
      is_active BOOLEAN DEFAULT true,
      priority_level INTEGER DEFAULT 5 CHECK (priority_level BETWEEN 1 AND 10),
      created_by_system BOOLEAN DEFAULT false, -- AI-suggested vs user-created
      
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for user_preferences
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_preferences_price_sensitivity ON user_preferences(overall_price_sensitivity);
    CREATE INDEX IF NOT EXISTS idx_user_preferences_shopping_frequency ON user_preferences(shopping_frequency);
    CREATE INDEX IF NOT EXISTS idx_user_preferences_dietary ON user_preferences(dietary_restrictions, dietary_preferences);
  `);

  // Create indexes for brand_preferences
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_user_id ON brand_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_brand_name ON brand_preferences(brand_name);
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_category ON brand_preferences(category);
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_type ON brand_preferences(preference_type);
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_strength ON brand_preferences(preference_strength DESC);
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_user_brand ON brand_preferences(user_id, brand_name);
    CREATE INDEX IF NOT EXISTS idx_brand_preferences_last_purchase ON brand_preferences(last_purchase_date DESC);
  `);

  // Create indexes for dietary_goals
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dietary_goals_user_id ON dietary_goals(user_id);
    CREATE INDEX IF NOT EXISTS idx_dietary_goals_goal_type ON dietary_goals(goal_type);
    CREATE INDEX IF NOT EXISTS idx_dietary_goals_active ON dietary_goals(is_active);
    CREATE INDEX IF NOT EXISTS idx_dietary_goals_target_date ON dietary_goals(target_date);
    CREATE INDEX IF NOT EXISTS idx_dietary_goals_priority ON dietary_goals(priority_level DESC);
  `);

  console.log("✅ User preferences table created successfully");
}

export function down(db: Database.Database) {
  console.log("Dropping user preferences tables...");

  db.exec(`DROP TABLE IF EXISTS dietary_goals;`);
  db.exec(`DROP TABLE IF EXISTS brand_preferences;`);
  db.exec(`DROP TABLE IF EXISTS user_preferences;`);

  console.log("✅ User preferences tables dropped successfully");
}