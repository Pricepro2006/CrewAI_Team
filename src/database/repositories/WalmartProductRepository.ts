/**
 * Walmart Product Repository - Data access layer for Walmart products
 * Handles product data, substitutions, and user preferences
 */

import type Database from "better-sqlite3";
import { BaseRepository } from "./BaseRepository";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";
import type { WalmartProduct } from "../../types/walmart-grocery";

// Database entity types
export interface ProductEntity {
  id: string;
  product_id: string;
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  department?: string;
  price: number;
  original_price?: number;
  currency?: string;
  unit?: string;
  size?: string;
  weight?: string;
  sku?: string;
  upc?: string;
  in_stock: boolean;
  stock_quantity?: number;
  store_id?: string;
  aisle_location?: string;
  image_url?: string;
  thumbnail_url?: string;
  rating?: number;
  review_count?: number;
  is_featured?: boolean;
  is_on_sale?: boolean;
  sale_end_date?: string;
  attributes?: any;
  nutritional_info?: any;
  created_at?: string;
  updated_at?: string;
}

export interface SubstitutionEntity {
  id: string;
  original_product_id: string;
  substitute_product_id: string;
  confidence_score: number;
  reason?: string;
  price_difference?: number;
  size_difference?: string;
  approved_count?: number;
  rejected_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserPreferencesEntity {
  id: string;
  user_id: string;
  preference_type: string;
  preference_value: any;
  created_at?: string;
  updated_at?: string;
}

export class WalmartProductRepository extends BaseRepository<ProductEntity> {
  constructor(db: Database.Database) {
    super(db, "walmart_products");
  }

  /**
   * Create or update a product
   */
  async upsertProduct(product: Partial<WalmartProduct>): Promise<ProductEntity> {
    const entity: ProductEntity = {
      id: uuidv4(),
      product_id: product.id!,
      name: product.name!,
      brand: product.brand,
      description: product.description,
      category: product.category,
      subcategory: product.subcategory,
      department: product.department,
      price: product.price || 0,
      original_price: product.originalPrice,
      currency: "USD",
      unit: product.unit,
      size: product.size,
      in_stock: product.inStock ?? true,
      stock_quantity: product.stockLevel,
      store_id: product.storeId,
      aisle_location: product.location?.aisle,
      image_url: product.imageUrl,
      thumbnail_url: product.thumbnailUrl,
      rating: product.ratings?.average,
      review_count: product.ratings?.count,
      nutritional_info: product.nutritionalInfo,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check if product already exists
    const existing = await this.findOne({ product_id: entity.product_id });
    
    if (existing) {
      // Update existing product
      const { id, created_at, ...updateData } = entity;
      await this.update(existing.id, updateData);
      return { ...existing, ...entity };
    } else {
      // Create new product
      return await this.create(entity);
    }
  }

  /**
   * Find product by Walmart product ID
   */
  async findByProductId(productId: string): Promise<ProductEntity | null> {
    return await this.findOne({ product_id: productId });
  }

  /**
   * Search products by name or brand
   */
  async searchProducts(
    query: string,
    options?: {
      category?: string;
      inStock?: boolean;
      storeId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ProductEntity[]> {
    const searchColumns = ["name", "brand", "description", "category"];
    const where: Record<string, any> = {};

    if (options?.category) {
      where.category = options.category;
    }
    if (options?.inStock !== undefined) {
      where.in_stock = options.inStock;
    }
    if (options?.storeId) {
      where.store_id = options.storeId;
    }

    return await this.search(query, searchColumns, {
      where,
      limit: options?.limit,
      offset: options?.offset
    });
  }

  /**
   * Get products by category
   */
  async getByCategory(
    category: string,
    options?: {
      subcategory?: string;
      inStock?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<ProductEntity[]> {
    const where: Record<string, any> = { category };

    if (options?.subcategory) {
      where.subcategory = options.subcategory;
    }
    if (options?.inStock !== undefined) {
      where.in_stock = options.inStock;
    }

    return await this.findAll({
      where,
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "name"
    });
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(limit: number = 10): Promise<ProductEntity[]> {
    return await this.findAll({
      where: { is_featured: true, in_stock: true },
      limit,
      orderBy: "updated_at",
      orderDirection: "DESC"
    });
  }

  /**
   * Get products on sale
   */
  async getOnSaleProducts(limit: number = 20): Promise<ProductEntity[]> {
    const now = new Date().toISOString();
    const query = `
      SELECT * FROM walmart_products 
      WHERE is_on_sale = 1 
        AND in_stock = 1 
        AND (sale_end_date IS NULL OR sale_end_date > ?)
      ORDER BY (original_price - price) DESC
      LIMIT ?
    `;
    
    return this.executeQuery<ProductEntity[]>(query, [now, limit]);
  }

  /**
   * Convert entity to WalmartProduct type
   */
  entityToProduct(entity: ProductEntity): WalmartProduct {
    return {
      id: entity.product_id,
      name: entity.name,
      brand: entity.brand,
      description: entity.description,
      category: entity.category!,
      subcategory: entity.subcategory,
      department: entity.department,
      price: entity.price,
      originalPrice: entity.original_price,
      unit: entity.unit || "each",
      size: entity.size,
      imageUrl: entity.image_url,
      thumbnailUrl: entity.thumbnail_url,
      inStock: entity.in_stock,
      stockLevel: entity.stock_quantity,
      storeId: entity.store_id,
      location: entity.aisle_location ? { aisle: entity.aisle_location } : undefined,
      ratings: entity.rating ? {
        average: entity.rating,
        count: entity.review_count || 0
      } : undefined,
      nutritionalInfo: entity.nutritional_info
    };
  }
}

export class SubstitutionRepository extends BaseRepository<SubstitutionEntity> {
  constructor(db: Database.Database) {
    super(db, "product_substitutions");
  }

  /**
   * Find substitutions for a product
   */
  async findSubstitutions(
    productId: string,
    limit: number = 5
  ): Promise<SubstitutionEntity[]> {
    return await this.findAll({
      where: { original_product_id: productId },
      limit,
      orderBy: "confidence_score",
      orderDirection: "DESC"
    });
  }

  /**
   * Add or update a substitution
   */
  async upsertSubstitution(data: {
    originalProductId: string;
    substituteProductId: string;
    confidence: number;
    reason?: string;
    priceDifference?: number;
  }): Promise<SubstitutionEntity> {
    const existing = await this.findOne({
      original_product_id: data.originalProductId,
      substitute_product_id: data.substituteProductId
    });

    const entity: Partial<SubstitutionEntity> = {
      confidence_score: data.confidence,
      reason: data.reason,
      price_difference: data.priceDifference,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      await this.update(existing.id, entity);
      return { ...existing, ...entity } as SubstitutionEntity;
    } else {
      return await this.create({
        original_product_id: data.originalProductId,
        substitute_product_id: data.substituteProductId,
        confidence_score: data.confidence,
        reason: data.reason,
        price_difference: data.priceDifference,
        approved_count: 0,
        rejected_count: 0
      });
    }
  }

  /**
   * Update substitution feedback
   */
  async updateFeedback(
    id: string,
    approved: boolean
  ): Promise<void> {
    const substitution = await this.findById(id);
    if (!substitution) return;

    await this.update(id, {
      approved_count: (substitution.approved_count || 0) + (approved ? 1 : 0),
      rejected_count: (substitution.rejected_count || 0) + (approved ? 0 : 1)
    });
  }
}

export class UserPreferencesRepository extends BaseRepository<UserPreferencesEntity> {
  constructor(db: Database.Database) {
    super(db, "user_preferences");
  }

  /**
   * Get all preferences for a user
   */
  async getUserPreferences(userId: string): Promise<Record<string, any>> {
    const prefs = await this.findAll({
      where: { user_id: userId }
    });

    const preferences: Record<string, any> = {};
    prefs.forEach(pref => {
      preferences[pref.preference_type] = pref.preference_value;
    });

    return preferences;
  }

  /**
   * Set a user preference
   */
  async setPreference(
    userId: string,
    type: string,
    value: any
  ): Promise<UserPreferencesEntity> {
    const existing = await this.findOne({
      user_id: userId,
      preference_type: type
    });

    if (existing) {
      await this.update(existing.id, {
        preference_value: value,
        updated_at: new Date().toISOString()
      });
      return { ...existing, preference_value: value };
    } else {
      return await this.create({
        user_id: userId,
        preference_type: type,
        preference_value: value
      });
    }
  }

  /**
   * Delete a user preference
   */
  async deletePreference(userId: string, type: string): Promise<boolean> {
    const deleted = await this.deleteWhere({
      user_id: userId,
      preference_type: type
    });
    return deleted > 0;
  }

  /**
   * Get preference value with default
   */
  async getPreference<T = any>(
    userId: string,
    type: string,
    defaultValue: T
  ): Promise<T> {
    const pref = await this.findOne({
      user_id: userId,
      preference_type: type
    });

    return pref ? pref.preference_value : defaultValue;
  }
}