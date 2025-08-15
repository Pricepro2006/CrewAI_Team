/**
 * Purchase History Service - Core business logic for purchase tracking and analysis
 * Handles purchase recording, pattern analysis, and reorder recommendations
 * Follows existing service patterns with singleton implementation
 */

import { logger } from "../../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import type { WalmartProductRepository } from "../../database/repositories/WalmartProductRepository.js";
import type Database from "better-sqlite3";

export interface PurchaseRecord {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  brand?: string;
  category?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  storeId?: string;
  storeLocation?: string;
  purchaseDate: string;
  paymentMethod?: "cash" | "card" | "digital" | "ebt";
  sessionId?: string; // Link to shopping session
  notes?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface PurchasePattern {
  productId: string;
  productName: string;
  brand?: string;
  category?: string;
  averageQuantity: number;
  averagePrice: number;
  purchaseFrequencyDays: number; // Average days between purchases
  lastPurchaseDate: string;
  totalPurchases: number;
  totalSpent: number;
  seasonalTrends?: SeasonalTrend[];
  preferredStore?: string;
  priceFlexibility: number; // How much price varies (standard deviation)
}

export interface SeasonalTrend {
  month: number;
  averageQuantity: number;
  averagePurchases: number;
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  brand?: string;
  category?: string;
  suggestedQuantity: number;
  expectedPrice: number;
  daysSinceLastPurchase: number;
  confidence: number; // 0-1 confidence score
  reason: "frequency" | "low_stock" | "seasonal" | "deal_opportunity";
  urgency: "low" | "medium" | "high" | "critical";
  estimatedReorderDate: string;
  potentialSavings?: number;
  alternativeProducts?: AlternativeProduct[];
}

export interface AlternativeProduct {
  productId: string;
  productName: string;
  brand?: string;
  price: number;
  savings: number;
  similarity: number; // 0-1 similarity score
}

export interface PurchaseFilters {
  userId?: string;
  productId?: string;
  category?: string;
  brand?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  storeId?: string;
  limit?: number;
  offset?: number;
  sortBy?: "date" | "amount" | "product" | "frequency";
  sortOrder?: "asc" | "desc";
}

export interface ProductFrequency {
  productId: string;
  productName: string;
  brand?: string;
  category?: string;
  purchaseCount: number;
  totalQuantity: number;
  totalSpent: number;
  averageQuantity: number;
  averagePrice: number;
  averageDaysBetween: number;
  firstPurchase: string;
  lastPurchase: string;
  frequency: "daily" | "weekly" | "monthly" | "seasonal" | "rare";
  trend: "increasing" | "stable" | "decreasing";
}

export interface PurchaseAnalytics {
  totalSpent: number;
  totalItems: number;
  averageBasketSize: number;
  averageItemPrice: number;
  mostFrequentCategory: string;
  mostExpensiveCategory: string;
  preferredBrands: string[];
  shoppingFrequency: number; // days between shopping trips
  seasonalSpending: SeasonalTrend[];
  priceConsciousness: "high" | "medium" | "low";
  loyaltyScore: number; // 0-1 brand loyalty score
}

export class PurchaseHistoryService {
  private static instance: PurchaseHistoryService;
  private db: Database.Database;
  private productRepo: WalmartProductRepository;

  private constructor() {
    const dbManager = getDatabaseManager();
    this.db = dbManager.connectionPool?.getConnection().getDatabase() || 
              (() => { throw new Error("Database connection not available"); })();
    this.productRepo = dbManager.walmartProducts;
    
    // Initialize tables if they don't exist
    this.initializeTables();
  }

  static getInstance(): PurchaseHistoryService {
    if (!PurchaseHistoryService.instance) {
      PurchaseHistoryService.instance = new PurchaseHistoryService();
    }
    return PurchaseHistoryService.instance;
  }

  /**
   * Initialize purchase history tables
   */
  private initializeTables(): void {
    try {
      // Purchase records table
      this?.db?.exec(`
        CREATE TABLE IF NOT EXISTS purchase_records (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          brand TEXT,
          category TEXT,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          store_id TEXT,
          store_location TEXT,
          purchase_date TEXT NOT NULL,
          payment_method TEXT,
          session_id TEXT,
          notes TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Purchase analytics cache table
      this?.db?.exec(`
        CREATE TABLE IF NOT EXISTS purchase_analytics_cache (
          user_id TEXT PRIMARY KEY,
          analytics_data TEXT NOT NULL,
          last_updated TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for performance
      this?.db?.exec(`
        CREATE INDEX IF NOT EXISTS idx_purchase_records_user_date 
        ON purchase_records(user_id, purchase_date DESC)
      `);

      this?.db?.exec(`
        CREATE INDEX IF NOT EXISTS idx_purchase_records_product 
        ON purchase_records(product_id, user_id)
      `);

      this?.db?.exec(`
        CREATE INDEX IF NOT EXISTS idx_purchase_records_category 
        ON purchase_records(category, user_id)
      `);

      logger.info("Purchase history tables initialized", "PURCHASE_HISTORY_SERVICE");
    } catch (error) {
      logger.error("Failed to initialize purchase history tables", "PURCHASE_HISTORY_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Record a new purchase to the database
   */
  async trackPurchase(purchase: Omit<PurchaseRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<PurchaseRecord> {
    try {
      const now = new Date().toISOString();
      const purchaseRecord: PurchaseRecord = {
        ...purchase,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        metadata: purchase.metadata ? JSON.stringify(purchase.metadata) : null
      };

      const stmt = this?.db?.prepare(`
        INSERT INTO purchase_records (
          id, user_id, product_id, product_name, brand, category,
          quantity, unit_price, total_price, store_id, store_location,
          purchase_date, payment_method, session_id, notes, metadata,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        purchaseRecord.id,
        purchaseRecord.userId,
        purchaseRecord.productId,
        purchaseRecord.productName,
        purchaseRecord.brand,
        purchaseRecord.category,
        purchaseRecord.quantity,
        purchaseRecord.unitPrice,
        purchaseRecord.totalPrice,
        purchaseRecord.storeId,
        purchaseRecord.storeLocation,
        purchaseRecord.purchaseDate,
        purchaseRecord.paymentMethod,
        purchaseRecord.sessionId,
        purchaseRecord.notes,
        purchaseRecord.metadata,
        purchaseRecord.createdAt,
        purchaseRecord.updatedAt
      );

      logger.info("Purchase tracked successfully", "PURCHASE_HISTORY_SERVICE", {
        purchaseId: purchaseRecord.id,
        userId: purchase.userId,
        productId: purchase.productId,
        totalPrice: purchase.totalPrice
      });

      // Invalidate analytics cache for this user
      await this.invalidateAnalyticsCache(purchase.userId);

      return {
        ...purchaseRecord,
        metadata: purchase.metadata
      };

    } catch (error) {
      logger.error("Failed to track purchase", "PURCHASE_HISTORY_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Analyze purchase patterns to identify buying behaviors and frequencies
   * Optimized to eliminate N+1 queries with batch loading
   */
  async analyzePurchasePatterns(userId: string): Promise<PurchasePattern[]> {
    try {
      // Single optimized query that includes all necessary data
      const stmt = this?.db?.prepare(`
        WITH purchase_stats AS (
          SELECT 
            product_id,
            product_name,
            brand,
            category,
            COUNT(*) as total_purchases,
            AVG(quantity) as avg_quantity,
            AVG(unit_price) as avg_price,
            SUM(total_price) as total_spent,
            MIN(purchase_date) as first_purchase,
            MAX(purchase_date) as last_purchase,
            AVG(julianday(purchase_date) - LAG(julianday(purchase_date)) OVER (
              PARTITION BY product_id ORDER BY purchase_date
            )) as avg_days_between,
            -- Calculate price flexibility inline
            SQRT(AVG((unit_price - AVG(unit_price) OVER (PARTITION BY product_id)) * 
                     (unit_price - AVG(unit_price) OVER (PARTITION BY product_id)))) as price_flexibility
          FROM purchase_records 
          WHERE user_id = ?
          GROUP BY product_id, product_name, brand, category
          HAVING total_purchases > 1
        ),
        seasonal_data AS (
          SELECT 
            product_id,
            CAST(strftime('%m', purchase_date) AS INTEGER) as month,
            AVG(quantity) as avg_monthly_quantity,
            COUNT(*) as monthly_purchases
          FROM purchase_records
          WHERE user_id = ?
          GROUP BY product_id, month
        ),
        store_preference AS (
          SELECT 
            product_id,
            store_id,
            COUNT(*) as store_count,
            ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY COUNT(*) DESC) as rank
          FROM purchase_records
          WHERE user_id = ? AND store_id IS NOT NULL
          GROUP BY product_id, store_id
        )
        SELECT 
          ps.*,
          CASE 
            WHEN ps.avg_days_between IS NULL THEN 0
            ELSE COALESCE(ps.avg_days_between, 0)
          END as frequency_days,
          GROUP_CONCAT(
            CASE WHEN sd.month IS NOT NULL 
            THEN json_object('month', sd.month, 'averageQuantity', sd.avg_monthly_quantity, 'averagePurchases', sd.monthly_purchases)
            END
          ) as seasonal_trends_json,
          sp.store_id as preferred_store
        FROM purchase_stats ps
        LEFT JOIN seasonal_data sd ON ps.product_id = sd.product_id
        LEFT JOIN store_preference sp ON ps.product_id = sp.product_id AND sp.rank = 1
        GROUP BY ps.product_id, ps.product_name, ps.brand, ps.category, 
                 ps.total_purchases, ps.avg_quantity, ps.avg_price, ps.total_spent,
                 ps.first_purchase, ps.last_purchase, ps.avg_days_between, 
                 ps.price_flexibility, sp.store_id
        ORDER BY ps.total_purchases DESC, ps.last_purchase DESC
      `);

      const rows = stmt.all(userId, userId, userId);
      
      const patterns: PurchasePattern[] = rows?.map((row: any) => {
        // Parse seasonal trends from JSON string
        let seasonalTrends: SeasonalTrend[] = [];
        if (row.seasonal_trends_json) {
          const trendsArray = row?.seasonal_trends_json?.split(',')
            .filter((s: string) => s && s !== 'null')
            .map((s: string) => {
              try {
                return JSON.parse(s);
              } catch {
                return null;
              }
            })
            .filter(Boolean);
          seasonalTrends = trendsArray;
        }

        return {
          productId: row.product_id,
          productName: row.product_name,
          brand: row.brand,
          category: row.category,
          averageQuantity: Math.round(row.avg_quantity * 100) / 100,
          averagePrice: Math.round(row.avg_price * 100) / 100,
          purchaseFrequencyDays: Math.round((row.frequency_days || 0) * 100) / 100,
          lastPurchaseDate: row.last_purchase,
          totalPurchases: row.total_purchases,
          totalSpent: Math.round(row.total_spent * 100) / 100,
          seasonalTrends,
          preferredStore: row.preferred_store,
          priceFlexibility: Math.round((row.price_flexibility || 0) * 100) / 100
        };
      });

      logger.info("Purchase patterns analyzed (optimized)", "PURCHASE_HISTORY_SERVICE", {
        userId,
        patternsCount: patterns?.length || 0
      });

      return patterns;
    } catch (error) {
      logger.error("Failed to analyze purchase patterns", "PURCHASE_HISTORY_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Retrieve purchase history with filtering and pagination
   */
  async getUserHistory(filters: PurchaseFilters = {}): Promise<{
    purchases: PurchaseRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        userId,
        productId,
        category,
        brand,
        dateFrom,
        dateTo,
        minAmount,
        maxAmount,
        storeId,
        limit = 50,
        offset = 0,
        sortBy = "date",
        sortOrder = "desc"
      } = filters;

      // Build dynamic WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];

      if (userId) {
        conditions.push("user_id = ?");
        params.push(userId);
      }

      if (productId) {
        conditions.push("product_id = ?");
        params.push(productId);
      }

      if (category) {
        conditions.push("category = ?");
        params.push(category);
      }

      if (brand) {
        conditions.push("brand = ?");
        params.push(brand);
      }

      if (dateFrom) {
        conditions.push("purchase_date >= ?");
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push("purchase_date <= ?");
        params.push(dateTo);
      }

      if (minAmount !== undefined) {
        conditions.push("total_price >= ?");
        params.push(minAmount);
      }

      if (maxAmount !== undefined) {
        conditions.push("total_price <= ?");
        params.push(maxAmount);
      }

      if (storeId) {
        conditions.push("store_id = ?");
        params.push(storeId);
      }

      const whereClause = conditions?.length || 0 > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Build ORDER BY clause
      const orderByMap = {
        date: "purchase_date",
        amount: "total_price",
        product: "product_name",
        frequency: "product_id" // This would need a subquery for true frequency
      };

      const orderByColumn = orderByMap[sortBy] || "purchase_date";
      const orderClause = `ORDER BY ${orderByColumn} ${sortOrder.toUpperCase()}`;

      // Get total count
      const countStmt = this?.db?.prepare(`
        SELECT COUNT(*) as total FROM purchase_records ${whereClause}
      `);
      const totalResult = countStmt.get(...params) as { total: number };

      // Get purchases
      const dataStmt = this?.db?.prepare(`
        SELECT * FROM purchase_records 
        ${whereClause} 
        ${orderClause} 
        LIMIT ? OFFSET ?
      `);
      
      const rows = dataStmt.all(...params, limit, offset);

      const purchases: PurchaseRecord[] = rows?.map((row: any) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));

      const result = {
        purchases,
        total: totalResult.total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit
      };

      logger.info("User purchase history retrieved", "PURCHASE_HISTORY_SERVICE", {
        userId,
        total: result.total,
        returned: purchases?.length || 0
      });

      return result;
    } catch (error) {
      logger.error("Failed to get user history", "PURCHASE_HISTORY_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Calculate how often items are purchased with frequency analysis
   */
  async getProductFrequency(userId: string, productId?: string): Promise<ProductFrequency[]> {
    try {
      const stmt = this?.db?.prepare(`
        WITH product_frequency AS (
          SELECT 
            product_id,
            product_name,
            brand,
            category,
            COUNT(*) as purchase_count,
            SUM(quantity) as total_quantity,
            SUM(total_price) as total_spent,
            AVG(quantity) as avg_quantity,
            AVG(unit_price) as avg_price,
            MIN(purchase_date) as first_purchase,
            MAX(purchase_date) as last_purchase,
            (julianday(MAX(purchase_date)) - julianday(MIN(purchase_date))) / NULLIF(COUNT(*) - 1, 0) as avg_days_between
          FROM purchase_records 
          WHERE user_id = ? ${productId ? 'AND product_id = ?' : ''}
          GROUP BY product_id, product_name, brand, category
        ),
        trend_analysis AS (
          SELECT 
            product_id,
            -- Simple trend calculation based on recent vs old purchases
            CASE 
              WHEN COUNT(CASE WHEN julianday('now') - julianday(purchase_date) <= 30 THEN 1 END) > 
                   COUNT(CASE WHEN julianday('now') - julianday(purchase_date) BETWEEN 31 AND 90 THEN 1 END)
              THEN 'increasing'
              WHEN COUNT(CASE WHEN julianday('now') - julianday(purchase_date) <= 30 THEN 1 END) < 
                   COUNT(CASE WHEN julianday('now') - julianday(purchase_date) BETWEEN 31 AND 90 THEN 1 END)
              THEN 'decreasing'
              ELSE 'stable'
            END as trend
          FROM purchase_records
          WHERE user_id = ? ${productId ? 'AND product_id = ?' : ''}
          GROUP BY product_id
        )
        SELECT 
          pf.*,
          ta.trend,
          CASE 
            WHEN avg_days_between <= 1 THEN 'daily'
            WHEN avg_days_between <= 7 THEN 'weekly'  
            WHEN avg_days_between <= 31 THEN 'monthly'
            WHEN avg_days_between <= 90 THEN 'seasonal'
            ELSE 'rare'
          END as frequency
        FROM product_frequency pf
        LEFT JOIN trend_analysis ta ON pf.product_id = ta.product_id
        ORDER BY purchase_count DESC, last_purchase DESC
      `);

      const params = productId ? [userId, productId, userId, productId] : [userId, userId];
      const rows = stmt.all(...params);

      const frequencies: ProductFrequency[] = rows?.map((row: any) => ({
        productId: row.product_id,
        productName: row.product_name,
        brand: row.brand,
        category: row.category,
        purchaseCount: row.purchase_count,
        totalQuantity: row.total_quantity,
        totalSpent: Math.round(row.total_spent * 100) / 100,
        averageQuantity: Math.round(row.avg_quantity * 100) / 100,
        averagePrice: Math.round(row.avg_price * 100) / 100,
        averageDaysBetween: Math.round((row.avg_days_between || 0) * 100) / 100,
        firstPurchase: row.first_purchase,
        lastPurchase: row.last_purchase,
        frequency: row.frequency,
        trend: row.trend || 'stable'
      }));

      logger.info("Product frequency calculated", "PURCHASE_HISTORY_SERVICE", {
        userId,
        productId,
        frequenciesCount: frequencies?.length || 0
      });

      return frequencies;
    } catch (error) {
      logger.error("Failed to calculate product frequency", "PURCHASE_HISTORY_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Suggest items for reorder based on purchase intervals and patterns
   */
  async suggestReorders(userId: string, daysAhead: number = 7): Promise<ReorderSuggestion[]> {
    try {
      // Get purchase patterns for analysis
      const patterns = await this.analyzePurchasePatterns(userId);
      const suggestions: ReorderSuggestion[] = [];
      const now = new Date();

      for (const pattern of patterns) {
        // Skip items with insufficient purchase history
        if (pattern.totalPurchases < 2 || pattern.purchaseFrequencyDays === 0) {
          continue;
        }

        const lastPurchase = new Date(pattern.lastPurchaseDate);
        const daysSinceLastPurchase = Math.floor(
          (now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Calculate expected reorder date
        const expectedReorderDate = new Date(lastPurchase.getTime() + 
          pattern.purchaseFrequencyDays * 24 * 60 * 60 * 1000);

        const daysUntilReorder = Math.floor(
          (expectedReorderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine if item should be suggested for reorder
        let shouldSuggest = false;
        let reason: ReorderSuggestion['reason'] = 'frequency';
        let urgency: ReorderSuggestion['urgency'] = 'low';
        let confidence = 0;

        if (daysUntilReorder <= daysAhead) {
          shouldSuggest = true;
          
          // Determine urgency based on how overdue the item is
          if (daysSinceLastPurchase > pattern.purchaseFrequencyDays * 1.5) {
            urgency = 'critical';
            reason = 'low_stock';
            confidence = 0.9;
          } else if (daysSinceLastPurchase > pattern.purchaseFrequencyDays * 1.2) {
            urgency = 'high';
            confidence = 0.8;
          } else if (daysUntilReorder <= 0) {
            urgency = 'medium';
            confidence = 0.7;
          } else {
            urgency = 'low';
            confidence = 0.6;
          }

          // Check for seasonal patterns
          const currentMonth = now.getMonth() + 1;
          const seasonalTrend = pattern.seasonalTrends?.find(t => t.month === currentMonth);
          if (seasonalTrend && seasonalTrend.averagePurchases > 1.5) {
            reason = 'seasonal';
            confidence = Math.min(confidence + 0.1, 1.0);
          }
        }

        if (shouldSuggest) {
          // Get alternative products if available
          const alternatives = await this.getAlternativeProducts(pattern.productId, pattern.category);

          // Check for potential savings
          let potentialSavings = 0;
          const currentPrice = await this.getCurrentPrice(pattern.productId);
          if (currentPrice && currentPrice < pattern.averagePrice * 0.9) {
            potentialSavings = (pattern.averagePrice - currentPrice) * pattern.averageQuantity;
            reason = 'deal_opportunity';
            confidence = Math.min(confidence + 0.2, 1.0);
          }

          suggestions.push({
            productId: pattern.productId,
            productName: pattern.productName,
            brand: pattern.brand,
            category: pattern.category,
            suggestedQuantity: Math.ceil(pattern.averageQuantity),
            expectedPrice: pattern.averagePrice,
            daysSinceLastPurchase,
            confidence: Math.round(confidence * 100) / 100,
            reason,
            urgency,
            estimatedReorderDate: expectedReorderDate.toISOString(),
            potentialSavings: potentialSavings > 0 ? Math.round(potentialSavings * 100) / 100 : undefined,
            alternativeProducts: alternatives
          });
        }
      }

      // Sort by urgency and confidence
      const urgencyOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      suggestions.sort((a, b) => {
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
          return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        }
        return b.confidence - a.confidence;
      });

      logger.info("Reorder suggestions generated", "PURCHASE_HISTORY_SERVICE", {
        userId,
        suggestionsCount: suggestions?.length || 0,
        daysAhead
      });

      return suggestions;
    } catch (error) {
      logger.error("Failed to generate reorder suggestions", "PURCHASE_HISTORY_SERVICE", { error });
      throw error;
    }
  }

  /**
   * Get comprehensive purchase analytics for a user
   */
  async getPurchaseAnalytics(userId: string, useCache: boolean = true): Promise<PurchaseAnalytics> {
    try {
      // Check cache first
      if (useCache) {
        const cached = await this.getCachedAnalytics(userId);
        if (cached) {
          logger.debug("Using cached purchase analytics", "PURCHASE_HISTORY_SERVICE", { userId });
          return cached;
        }
      }

      // Calculate analytics
      const stmt = this?.db?.prepare(`
        SELECT 
          COUNT(*) as total_purchases,
          SUM(total_price) as total_spent,
          SUM(quantity) as total_items,
          AVG(total_price) as avg_basket_size,
          AVG(unit_price) as avg_item_price,
          COUNT(DISTINCT purchase_date) as unique_shopping_days,
          (julianday(MAX(purchase_date)) - julianday(MIN(purchase_date))) / NULLIF(COUNT(DISTINCT purchase_date) - 1, 0) as avg_days_between_shopping
        FROM purchase_records 
        WHERE user_id = ?
      `);

      const basicStats = stmt.get(userId) as any;

      // Get category statistics
      const categoryStmt = this?.db?.prepare(`
        SELECT 
          category,
          SUM(total_price) as category_spent,
          COUNT(*) as category_purchases
        FROM purchase_records 
        WHERE user_id = ?
        GROUP BY category
        ORDER BY category_spent DESC
      `);

      const categoryStats = categoryStmt.all(userId);

      // Get brand preferences
      const brandStmt = this?.db?.prepare(`
        SELECT 
          brand,
          COUNT(*) as brand_purchases
        FROM purchase_records 
        WHERE user_id = ? AND brand IS NOT NULL
        GROUP BY brand
        ORDER BY brand_purchases DESC
        LIMIT 10
      `);

      const brandStats = brandStmt.all(userId);

      // Get seasonal spending
      const seasonalStmt = this?.db?.prepare(`
        SELECT 
          CAST(strftime('%m', purchase_date) AS INTEGER) as month,
          AVG(quantity) as avg_quantity,
          COUNT(*) as avg_purchases
        FROM purchase_records 
        WHERE user_id = ?
        GROUP BY month
        ORDER BY month
      `);

      const seasonalStats = seasonalStmt.all(userId);

      // Calculate derived metrics
      const analytics: PurchaseAnalytics = {
        totalSpent: Math.round((basicStats.total_spent || 0) * 100) / 100,
        totalItems: basicStats.total_items || 0,
        averageBasketSize: Math.round((basicStats.avg_basket_size || 0) * 100) / 100,
        averageItemPrice: Math.round((basicStats.avg_item_price || 0) * 100) / 100,
        mostFrequentCategory: categoryStats[0]?.category || "Unknown",
        mostExpensiveCategory: categoryStats.reduce((max: any, cat: any) => 
          cat.category_spent > (max?.category_spent || 0) ? cat : max
        )?.category || "Unknown",
        preferredBrands: brandStats.slice(0, 5).map(b => b.brand),
        shoppingFrequency: Math.round((basicStats.avg_days_between_shopping || 0) * 100) / 100,
        seasonalSpending: seasonalStats?.map(s => ({
          month: s.month,
          averageQuantity: s.avg_quantity,
          averagePurchases: s.avg_purchases
        })),
        priceConsciousness: this.calculatePriceConsciousness(basicStats.avg_item_price),
        loyaltyScore: this.calculateLoyaltyScore(brandStats)
      };

      // Cache the results
      await this.cacheAnalytics(userId, analytics);

      logger.info("Purchase analytics calculated", "PURCHASE_HISTORY_SERVICE", {
        userId,
        totalSpent: analytics.totalSpent,
        totalItems: analytics.totalItems
      });

      return analytics;
    } catch (error) {
      logger.error("Failed to get purchase analytics", "PURCHASE_HISTORY_SERVICE", { error });
      throw error;
    }
  }

  // Helper methods

  private async calculatePriceFlexibility(userId: string, productId: string): Promise<number> {
    const stmt = this?.db?.prepare(`
      SELECT AVG(unit_price) as avg_price, 
             AVG((unit_price - (SELECT AVG(unit_price) FROM purchase_records WHERE user_id = ? AND product_id = ?)) * 
                 (unit_price - (SELECT AVG(unit_price) FROM purchase_records WHERE user_id = ? AND product_id = ?))) as variance
      FROM purchase_records 
      WHERE user_id = ? AND product_id = ?
    `);

    const result = stmt.get(userId, productId, userId, productId, userId, productId) as any;
    return Math.sqrt(result.variance || 0);
  }

  private async getSeasonalTrends(userId: string, productId: string): Promise<SeasonalTrend[]> {
    const stmt = this?.db?.prepare(`
      SELECT 
        CAST(strftime('%m', purchase_date) AS INTEGER) as month,
        AVG(quantity) as averageQuantity,
        COUNT(*) as averagePurchases
      FROM purchase_records 
      WHERE user_id = ? AND product_id = ?
      GROUP BY month
      ORDER BY month
    `);

    return stmt.all(userId, productId) as SeasonalTrend[];
  }

  private async getPreferredStore(userId: string, productId: string): Promise<string | undefined> {
    const stmt = this?.db?.prepare(`
      SELECT store_id, COUNT(*) as count
      FROM purchase_records 
      WHERE user_id = ? AND product_id = ? AND store_id IS NOT NULL
      GROUP BY store_id
      ORDER BY count DESC
      LIMIT 1
    `);

    const result = stmt.get(userId, productId) as any;
    return result?.store_id;
  }

  private async getAlternativeProducts(productId: string, category?: string): Promise<AlternativeProduct[]> {
    // This would integrate with the WalmartProductRepository to find similar products
    // For now, return empty array as placeholder
    return [];
  }

  private async getCurrentPrice(productId: string): Promise<number | null> {
    try {
      const product = await this?.productRepo?.findById(productId);
      return product?.current_price || null;
    } catch {
      return null;
    }
  }

  private calculatePriceConsciousness(avgItemPrice: number): "high" | "medium" | "low" {
    // Simple heuristic based on average item price
    if (avgItemPrice < 5) return "high";
    if (avgItemPrice < 15) return "medium";
    return "low";
  }

  private calculateLoyaltyScore(brandStats: any[]): number {
    if (brandStats?.length || 0 === 0) return 0;
    
    const totalPurchases = brandStats.reduce((sum: any, brand: any) => sum + brand.brand_purchases, 0);
    const topBrandPurchases = brandStats[0]?.brand_purchases || 0;
    
    return Math.round((topBrandPurchases / totalPurchases) * 100) / 100;
  }

  private async getCachedAnalytics(userId: string): Promise<PurchaseAnalytics | null> {
    try {
      const stmt = this?.db?.prepare(`
        SELECT analytics_data, expires_at 
        FROM purchase_analytics_cache 
        WHERE user_id = ? AND expires_at > datetime('now')
      `);

      const cached = stmt.get(userId) as any;
      if (cached) {
        return JSON.parse(cached.analytics_data);
      }
      return null;
    } catch {
      return null;
    }
  }

  private async cacheAnalytics(userId: string, analytics: PurchaseAnalytics): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      
      const stmt = this?.db?.prepare(`
        INSERT OR REPLACE INTO purchase_analytics_cache (user_id, analytics_data, last_updated, expires_at)
        VALUES (?, ?, datetime('now'), ?)
      `);

      stmt.run(userId, JSON.stringify(analytics), expiresAt);
    } catch (error) {
      logger.warn("Failed to cache analytics", "PURCHASE_HISTORY_SERVICE", { error });
    }
  }

  private async invalidateAnalyticsCache(userId: string): Promise<void> {
    try {
      const stmt = this?.db?.prepare(`DELETE FROM purchase_analytics_cache WHERE user_id = ?`);
      stmt.run(userId);
    } catch (error) {
      logger.warn("Failed to invalidate analytics cache", "PURCHASE_HISTORY_SERVICE", { error });
    }
  }

  /**
   * Clean up old purchase records and cache entries
   */
  async cleanup(olderThanDays: number = 730): Promise<{ deletedRecords: number; deletedCache: number }> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
      
      // Delete old purchase records
      const deleteRecordsStmt = this?.db?.prepare(`
        DELETE FROM purchase_records 
        WHERE purchase_date < ?
      `);
      const deletedRecords = deleteRecordsStmt.run(cutoffDate).changes;

      // Delete expired cache entries
      const deleteCacheStmt = this?.db?.prepare(`
        DELETE FROM purchase_analytics_cache 
        WHERE expires_at < datetime('now')
      `);
      const deletedCache = deleteCacheStmt.run().changes;

      logger.info("Purchase history cleanup completed", "PURCHASE_HISTORY_SERVICE", {
        deletedRecords,
        deletedCache,
        cutoffDate
      });

      return { deletedRecords, deletedCache };
    } catch (error) {
      logger.error("Failed to cleanup purchase history", "PURCHASE_HISTORY_SERVICE", { error });
      throw error;
    }
  }
}