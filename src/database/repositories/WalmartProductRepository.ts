/**
 * Walmart Product Repository - Data access layer for Walmart product data
 * Handles product information, pricing, and substitutions
 */

type DatabaseInstance = any;
import { BaseRepository, type BaseEntity } from "./BaseRepository.js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";

// Types for Walmart product entities
export interface WalmartProduct extends BaseEntity {
  product_id: string;
  name: string;
  brand?: string;
  description?: string;
  category_path?: string;
  department?: string;
  current_price?: number;
  regular_price?: number;
  unit_price?: number;
  unit_measure?: string;
  in_stock?: boolean;
  stock_level?: number;
  online_only?: boolean;
  store_only?: boolean;
  upc?: string;
  sku?: string;
  model_number?: string;
  manufacturer?: string;
  thumbnail_url?: string;
  large_image_url?: string;
  average_rating?: number;
  review_count?: number;
  nutritional_info?: any;
  ingredients?: string;
  allergens?: string[];
  size_info?: string;
  weight_info?: string;
  product_attributes?: any;
  search_keywords?: string;
  embedding_vector?: Buffer;
  first_seen_at?: string;
  last_updated_at?: string;
  last_checked_at?: string;
}

// Alias for backward compatibility
export type ProductEntity = WalmartProduct;

export interface PriceHistory {
  id?: string;
  product_id: string;
  price: number;
  was_on_sale?: boolean;
  sale_percentage?: number;
  store_id?: string;
  availability?: string;
  recorded_at?: string;
}

export interface GrocerySubstitution extends BaseEntity {
  original_product_id?: string;
  substitute_product_id?: string;
  reason?: string;
  similarity_score?: number;
  price_difference?: number;
  user_id?: string;
  accepted?: boolean;
  rating?: number;
  feedback?: string;
  suggested_by?: "system" | "user" | "store";
  created_at?: string;
}

export interface UserPreferences extends BaseEntity {
  user_id: string;
  default_store_id?: string;
  preferred_brands?: any;
  avoided_brands?: string[];
  dietary_restrictions?: string[];
  allergens?: string[];
  preferred_organic?: boolean;
  preferred_local?: boolean;
  monthly_budget?: number;
  price_sensitivity?: "low" | "medium" | "high";
  typical_shop_day?: string;
  typical_shop_time?: string;
  avg_items_per_trip?: number;
  allow_substitutions?: boolean;
  substitution_rules?: any;
  notification_preferences?: any;
  language_preference?: string;
  assistant_personality?: "professional" | "friendly" | "helpful" | "concise";
  suggestion_frequency?: "minimal" | "moderate" | "frequent";
  onboarding_completed?: boolean;
  last_preference_review?: string;
  created_at?: string;
  updated_at?: string;
}

export class WalmartProductRepository extends BaseRepository<WalmartProduct> {
  constructor(db: DatabaseInstance) {
    super(db, "walmart_products");
  }

  async upsertProduct(data: WalmartProduct): Promise<WalmartProduct> {
    const stmt = this?.db?.prepare(`
      INSERT INTO walmart_products (
        product_id, name, brand, description, category_path, department,
        current_price, regular_price, unit_price, unit_measure,
        in_stock, stock_level, online_only, store_only,
        upc, sku, model_number, manufacturer,
        thumbnail_url, large_image_url, average_rating, review_count,
        nutritional_info, ingredients, allergens,
        size_info, weight_info, product_attributes,
        search_keywords, embedding_vector,
        last_updated_at, last_checked_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(product_id) DO UPDATE SET
        name = excluded.name,
        brand = excluded.brand,
        description = excluded.description,
        category_path = excluded.category_path,
        department = excluded.department,
        current_price = excluded.current_price,
        regular_price = excluded.regular_price,
        unit_price = excluded.unit_price,
        unit_measure = excluded.unit_measure,
        in_stock = excluded.in_stock,
        stock_level = excluded.stock_level,
        online_only = excluded.online_only,
        store_only = excluded.store_only,
        upc = excluded.upc,
        sku = excluded.sku,
        model_number = excluded.model_number,
        manufacturer = excluded.manufacturer,
        thumbnail_url = excluded.thumbnail_url,
        large_image_url = excluded.large_image_url,
        average_rating = excluded.average_rating,
        review_count = excluded.review_count,
        nutritional_info = excluded.nutritional_info,
        ingredients = excluded.ingredients,
        allergens = excluded.allergens,
        size_info = excluded.size_info,
        weight_info = excluded.weight_info,
        product_attributes = excluded.product_attributes,
        search_keywords = excluded.search_keywords,
        embedding_vector = excluded.embedding_vector,
        last_updated_at = CURRENT_TIMESTAMP,
        last_checked_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      data.product_id,
      data.name,
      data.brand,
      data.description,
      data.category_path,
      data.department,
      data.current_price,
      data.regular_price,
      data.unit_price,
      data.unit_measure,
      data.in_stock ? 1 : 0,
      data.stock_level,
      data.online_only ? 1 : 0,
      data.store_only ? 1 : 0,
      data.upc,
      data.sku,
      data.model_number,
      data.manufacturer,
      data.thumbnail_url,
      data.large_image_url,
      data.average_rating,
      data.review_count,
      JSON.stringify(data.nutritional_info),
      data.ingredients,
      JSON.stringify(data.allergens),
      data.size_info,
      data.weight_info,
      JSON.stringify(data.product_attributes),
      data.search_keywords,
      data.embedding_vector,
    );

    logger.info(`Upserted Walmart product: ${data.product_id}`, "WALMART_REPO");
    return this.getProduct(data.product_id);
  }

  async getProduct(productId: string): Promise<WalmartProduct> {
    const row = this.db
      .prepare("SELECT * FROM walmart_products WHERE product_id = ?")
      .get(productId) as any;
    if (!row) {
      throw new Error(`Walmart product not found: ${productId}`);
    }
    return this.mapRowToProduct(row);
  }

  async searchProducts(
    query: string,
    limit: number = 20,
  ): Promise<WalmartProduct[]> {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM walmart_products 
      WHERE name LIKE ? OR brand LIKE ? OR search_keywords LIKE ?
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1
          WHEN brand LIKE ? THEN 2
          ELSE 3
        END,
        average_rating DESC
      LIMIT ?
    `,
      )
      .all(
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `${query}%`,
        `${query}%`,
        limit,
      ) as any[];

    return rows?.map((row: any) => this.mapRowToProduct(row));
  }

  async getProductsByCategory(
    category: string,
    inStockOnly: boolean = false,
  ): Promise<WalmartProduct[]> {
    let query = "SELECT * FROM walmart_products WHERE category_path LIKE ?";
    const params: any[] = [`%${category}%`];

    if (inStockOnly) {
      query += " AND in_stock = 1";
    }

    query += " ORDER BY average_rating DESC";

    const rows = this?.db?.prepare(query).all(...params) as any[];
    return rows?.map((row: any) => this.mapRowToProduct(row));
  }

  async recordPriceHistory(
    productId: string,
    price: number,
    onSale: boolean = false,
  ): Promise<void> {
    const product = await this.getProduct(productId);
    const salePercentage =
      onSale && product.regular_price
        ? Math.round((1 - price / product.regular_price) * 100)
        : null;

    const stmt = this?.db?.prepare(`
      INSERT INTO price_history (
        id, product_id, price, was_on_sale, sale_percentage
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(uuidv4(), productId, price, onSale ? 1 : 0, salePercentage);
  }

  async getPriceHistory(
    productId: string,
    days: number = 30,
  ): Promise<PriceHistory[]> {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM price_history 
      WHERE product_id = ? 
        AND recorded_at >= datetime('now', '-${days} days')
      ORDER BY recorded_at DESC
    `,
      )
      .all(productId) as any[];

    return rows?.map((row: any) => ({
      ...row,
      was_on_sale: !!row.was_on_sale,
    }));
  }

  async getLowestPrice(
    productId: string,
    days: number = 30,
  ): Promise<number | null> {
    const result = this.db
      .prepare(
        `
      SELECT MIN(price) as lowest_price
      FROM price_history 
      WHERE product_id = ? 
        AND recorded_at >= datetime('now', '-${days} days')
    `,
      )
      .get(productId) as { lowest_price: number | null };

    return result.lowest_price;
  }

  async findSimilarProducts(
    productId: string,
    limit: number = 5,
  ): Promise<WalmartProduct[]> {
    const product = await this.getProduct(productId);

    // Simple similarity based on category and brand
    const rows = this.db
      .prepare(
        `
      SELECT * FROM walmart_products 
      WHERE product_id != ?
        AND category_path = ?
        AND (brand = ? OR brand IS NULL)
        AND in_stock = 1
      ORDER BY 
        ABS(current_price - ?) ASC,
        average_rating DESC
      LIMIT ?
    `,
      )
      .all(
        productId,
        product.category_path,
        product.brand,
        product.current_price || 0,
        limit,
      ) as any[];

    return rows?.map((row: any) => this.mapRowToProduct(row));
  }

  async findByProductId(productId: string): Promise<WalmartProduct | null> {
    try {
      return await this.getProduct(productId);
    } catch (error) {
      return null;
    }
  }

  override async findById(productId: string): Promise<WalmartProduct | null> {
    return this.findByProductId(productId);
  }

  async findByIds(productIds: string[]): Promise<WalmartProduct[]> {
    if (!productIds?.length || productIds.length === 0) return [];
    
    const placeholders = productIds?.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT * FROM walmart_products WHERE product_id IN (${placeholders})`)
      .all(...productIds) as any[];
    
    return rows?.map((row: any) => this.mapRowToProduct(row));
  }

  entityToProduct(entity: any): WalmartProduct {
    return this.mapRowToProduct(entity);
  }

  override async transaction<T>(callback: (repo: this) => Promise<T>): Promise<T> {
    // SQLite doesn't need explicit transaction management in most cases
    // but we can implement it if needed
    return await callback(this);
  }

  private mapRowToProduct(row: any): WalmartProduct {
    // Helper function to safely parse JSON
    const safeJsonParse = (jsonString: any, defaultValue: any) => {
      if (!jsonString || typeof jsonString !== 'string' || jsonString.trim() === '') return defaultValue;
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn("Failed to parse JSON field", "WALMART_REPO", { jsonString, error: errorMessage });
        return defaultValue;
      }
    };

    return {
      ...row,
      in_stock: !!row.in_stock,
      online_only: !!row.online_only,
      store_only: !!row.store_only,
      nutritional_info: safeJsonParse(row.nutritional_info, null),
      allergens: safeJsonParse(row.allergens, []),
      product_attributes: safeJsonParse(row.product_attributes, null),
    };
  }
}

export class SubstitutionRepository extends BaseRepository<GrocerySubstitution> {
  constructor(db: DatabaseInstance) {
    super(db, "grocery_substitutions");
  }

  async recordSubstitution(
    data: GrocerySubstitution,
  ): Promise<GrocerySubstitution> {
    const substitution: GrocerySubstitution = {
      ...data,
      id: data.id || uuidv4(),
      suggested_by: data.suggested_by || "system",
      created_at: data.created_at || new Date().toISOString(),
    };

    const stmt = this?.db?.prepare(`
      INSERT INTO grocery_substitutions (
        id, original_product_id, substitute_product_id, reason,
        similarity_score, price_difference, user_id, accepted,
        rating, feedback, suggested_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      substitution.id,
      substitution.original_product_id,
      substitution.substitute_product_id,
      substitution.reason,
      substitution.similarity_score,
      substitution.price_difference,
      substitution.user_id,
      substitution.accepted ? 1 : 0,
      substitution.rating,
      substitution.feedback,
      substitution.suggested_by,
    );

    return substitution;
  }

  async getSubstitutionHistory(
    productId: string,
  ): Promise<GrocerySubstitution[]> {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM grocery_substitutions 
      WHERE original_product_id = ? OR substitute_product_id = ?
      ORDER BY created_at DESC
    `,
      )
      .all(productId, productId) as any[];

    return rows?.map((row: any) => ({
      ...row,
      accepted: !!row.accepted,
    }));
  }

  async getAcceptedSubstitutions(
    userId: string,
  ): Promise<GrocerySubstitution[]> {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM grocery_substitutions 
      WHERE user_id = ? AND accepted = 1 AND rating >= 4
      ORDER BY created_at DESC
    `,
      )
      .all(userId) as any[];

    return rows?.map((row: any) => ({
      ...row,
      accepted: true,
    }));
  }

  async updateFeedback(
    id: string,
    accepted: boolean,
    rating?: number,
    feedback?: string,
  ): Promise<void> {
    const stmt = this?.db?.prepare(`
      UPDATE grocery_substitutions 
      SET accepted = ?, rating = ?, feedback = ?
      WHERE id = ?
    `);

    stmt.run(accepted ? 1 : 0, rating, feedback, id);
  }
}

export class UserPreferencesRepository extends BaseRepository<UserPreferences> {
  constructor(db: DatabaseInstance) {
    super(db, "grocery_user_preferences");
  }

  async upsertPreferences(data: UserPreferences): Promise<UserPreferences> {
    const preferences: UserPreferences = {
      ...data,
      id: data.id || uuidv4(),
      preferred_organic: data.preferred_organic ?? false,
      preferred_local: data.preferred_local ?? false,
      price_sensitivity: data.price_sensitivity || "medium",
      allow_substitutions: data.allow_substitutions ?? true,
      language_preference: data.language_preference || "en",
      assistant_personality: data.assistant_personality || "helpful",
      suggestion_frequency: data.suggestion_frequency || "moderate",
      onboarding_completed: data.onboarding_completed ?? false,
    };

    const stmt = this?.db?.prepare(`
      INSERT INTO grocery_user_preferences (
        id, user_id, default_store_id, preferred_brands, avoided_brands,
        dietary_restrictions, allergens, preferred_organic, preferred_local,
        monthly_budget, price_sensitivity, typical_shop_day, typical_shop_time,
        avg_items_per_trip, allow_substitutions, substitution_rules,
        notification_preferences, language_preference, assistant_personality,
        suggestion_frequency, onboarding_completed, last_preference_review
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        default_store_id = excluded.default_store_id,
        preferred_brands = excluded.preferred_brands,
        avoided_brands = excluded.avoided_brands,
        dietary_restrictions = excluded.dietary_restrictions,
        allergens = excluded.allergens,
        preferred_organic = excluded.preferred_organic,
        preferred_local = excluded.preferred_local,
        monthly_budget = excluded.monthly_budget,
        price_sensitivity = excluded.price_sensitivity,
        typical_shop_day = excluded.typical_shop_day,
        typical_shop_time = excluded.typical_shop_time,
        avg_items_per_trip = excluded.avg_items_per_trip,
        allow_substitutions = excluded.allow_substitutions,
        substitution_rules = excluded.substitution_rules,
        notification_preferences = excluded.notification_preferences,
        language_preference = excluded.language_preference,
        assistant_personality = excluded.assistant_personality,
        suggestion_frequency = excluded.suggestion_frequency,
        onboarding_completed = excluded.onboarding_completed,
        last_preference_review = excluded.last_preference_review,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      preferences.id,
      preferences.user_id,
      preferences.default_store_id,
      JSON.stringify(preferences.preferred_brands),
      JSON.stringify(preferences.avoided_brands),
      JSON.stringify(preferences.dietary_restrictions),
      JSON.stringify(preferences.allergens),
      preferences.preferred_organic ? 1 : 0,
      preferences.preferred_local ? 1 : 0,
      preferences.monthly_budget,
      preferences.price_sensitivity,
      preferences.typical_shop_day,
      preferences.typical_shop_time,
      preferences.avg_items_per_trip,
      preferences.allow_substitutions ? 1 : 0,
      JSON.stringify(preferences.substitution_rules),
      JSON.stringify(preferences.notification_preferences),
      preferences.language_preference,
      preferences.assistant_personality,
      preferences.suggestion_frequency,
      preferences.onboarding_completed ? 1 : 0,
      preferences.last_preference_review,
    );

    const result = await this.getPreferences(preferences.user_id);
    if (!result) {
      throw new Error(`Failed to retrieve preferences after upsert for user: ${preferences.user_id}`);
    }
    return result;
  }

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const row = this.db
      .prepare("SELECT * FROM grocery_user_preferences WHERE user_id = ?")
      .get(userId) as any;
    if (!row) {
      return null;
    }
    return this.mapRowToPreferences(row);
  }

  async updatePreference<K extends keyof UserPreferences>(
    userId: string,
    key: K,
    value: UserPreferences[K],
  ): Promise<UserPreferences> {
    const preferences = await this.getPreferences(userId);
    if (!preferences) {
      throw new Error(`User preferences not found: ${userId}`);
    }

    const updates: Partial<UserPreferences> = { [key]: value };
    return this.upsertPreferences({ ...preferences, ...updates });
  }

  async completeOnboarding(userId: string): Promise<UserPreferences> {
    return this.updatePreference(userId, "onboarding_completed", true);
  }

  private mapRowToPreferences(row: any): UserPreferences {
    return {
      ...row,
      preferred_organic: !!row.preferred_organic,
      preferred_local: !!row.preferred_local,
      allow_substitutions: !!row.allow_substitutions,
      onboarding_completed: !!row.onboarding_completed,
      preferred_brands: row.preferred_brands
        ? JSON.parse(row.preferred_brands)
        : {},
      avoided_brands: row.avoided_brands ? JSON.parse(row.avoided_brands) : [],
      dietary_restrictions: row.dietary_restrictions
        ? JSON.parse(row.dietary_restrictions)
        : [],
      allergens: row.allergens ? JSON.parse(row.allergens) : [],
      substitution_rules: row.substitution_rules
        ? JSON.parse(row.substitution_rules)
        : {},
      notification_preferences: row.notification_preferences
        ? JSON.parse(row.notification_preferences)
        : {},
    };
  }
}
