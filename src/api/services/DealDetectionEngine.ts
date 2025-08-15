/**
 * Deal Detection Engine - Advanced deal detection with machine learning-style algorithms
 * Analyzes price patterns, seasonal trends, bulk opportunities, and user behavior
 */

import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import { PriceHistoryService } from "./PriceHistoryService.js";
import { WalmartPriceFetcher } from "./WalmartPriceFetcher.js";
import type Database from "better-sqlite3";
import type { WalmartProduct, ProductPrice, ProductCategory } from "../../types/walmart-grocery.js";
import type { PriceComparisonResult, PriceStatistics } from "./PriceHistoryService.js";

/**
 * Helper function to extract numeric price from ProductPrice union type
 */
function extractNumericPrice(price: ProductPrice | undefined | null): number {
  if (price === null || price === undefined) {
    return 0;
  }
  
  if (typeof price === 'number') {
    return price;
  }
  
  // If it's an object, return the regular price or sale price if available
  return price.sale || price.regular || 0;
}

/**
 * Helper function to extract category name from ProductCategory union type
 */
function extractCategoryName(category: ProductCategory | undefined | null): string | undefined {
  if (category === null || category === undefined) {
    return undefined;
  }
  
  if (typeof category === 'string') {
    return category;
  }
  
  // If it's an object, return the name property
  return category.name;
}

export interface DetectedDeal {
  id: string;
  productId: string;
  walmartId: string;
  productName: string;
  category?: string;
  
  // Deal information
  dealType: 'price_drop' | 'bulk_discount' | 'seasonal' | 'clearance' | 'competitor_match' | 'historical_low';
  currentPrice: number;
  originalPrice?: number;
  referencePrice: number; // Price we're comparing against
  savingsAmount: number;
  savingsPercentage: number;
  
  // Quality metrics
  dealScore: number;        // 0-1 composite quality score
  confidenceScore: number;  // How confident we are this is a real deal
  urgencyScore: number;     // How time-sensitive this deal is
  
  // Context
  comparisonPeriod: '7d' | '30d' | '60d' | '90d';
  dealReasons: string[];
  isHistoricalLow: boolean;
  
  // Availability
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  estimatedStockLevel?: 'high' | 'medium' | 'low';
  dealExpiresAt?: string;
  
  // Timing
  detectedAt: string;
  firstSeenAt?: string;
  lastVerifiedAt: string;
  verificationCount: number;
  
  // Targeting
  targetUsers?: string[]; // User IDs who might be interested
}

export interface DealAlert {
  id: string;
  userId: string;
  productId?: string;
  walmartId?: string;
  category?: string;
  searchQuery?: string;
  
  // Alert criteria
  priceDropPercentage?: number;
  priceDropAbsolute?: number;
  targetPrice?: number;
  dealType?: DetectedDeal['dealType'];
  
  // Settings
  isActive: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notificationMethods: ('email' | 'websocket' | 'push')[];
  
  // Timing
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  lastTriggeredAt?: string;
}

export interface BulkOpportunity {
  baseProductId: string;
  products: Array<{
    productId: string;
    size: string;
    price: number;
    unitPrice: number;
  }>;
  bestValueProduct: {
    productId: string;
    size: string;
    savingsVsSmallest: number;
    savingsPercentage: number;
  };
  recommendations: {
    quantity: number;
    totalSavings: number;
    riskLevel: 'low' | 'medium' | 'high';
    storageRequirements?: string;
    shelfLifeDays?: number;
  };
}

export interface SeasonalDealOpportunity {
  category: string;
  month: number;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  expectedPriceMultiplier: number; // vs annual average
  demandLevel: 'low' | 'medium' | 'high' | 'peak';
  buyingRecommendation: 'buy_now' | 'wait' | 'stock_up';
  confidenceLevel: number;
  typicalProducts: string[];
}

export class DealDetectionEngine {
  private static instance: DealDetectionEngine;
  private db: Database.Database;
  private priceHistory: PriceHistoryService;
  private priceFetcher: WalmartPriceFetcher;

  // Detection thresholds
  private readonly DEAL_THRESHOLDS = {
    minimal: { percentage: 5, score: 0.3 },      // 5% off - minimal deal
    moderate: { percentage: 10, score: 0.5 },    // 10% off - moderate deal
    good: { percentage: 20, score: 0.7 },        // 20% off - good deal
    excellent: { percentage: 30, score: 0.9 },   // 30% off - excellent deal
    exceptional: { percentage: 50, score: 1.0 }  // 50% off - exceptional deal
  };

  // Seasonal patterns
  private readonly SEASONAL_PATTERNS = {
    produce: {
      peakMonths: [6, 7, 8], // Summer
      offPeakMonths: [12, 1, 2], // Winter
      items: ['fruits', 'vegetables', 'berries']
    },
    beverages: {
      peakMonths: [6, 7, 8], // Summer  
      offPeakMonths: [12, 1, 2], // Winter
      items: ['soda', 'juice', 'water']
    },
    frozen: {
      peakMonths: [12, 1, 2], // Winter
      offPeakMonths: [6, 7, 8], // Summer
      items: ['ice cream', 'frozen meals']
    }
  };

  private constructor() {
    const dbManager = getDatabaseManager();
    this.db = dbManager.connectionPool?.getConnection().getDatabase() || 
              (() => { throw new Error("Database connection not available"); })();
    this.priceHistory = PriceHistoryService.getInstance();
    this.priceFetcher = WalmartPriceFetcher.getInstance();
  }

  static getInstance(): DealDetectionEngine {
    if (!DealDetectionEngine.instance) {
      DealDetectionEngine.instance = new DealDetectionEngine();
    }
    return DealDetectionEngine.instance;
  }

  /**
   * Main deal detection method - analyzes price changes and identifies deals
   */
  async detectDeals(
    productId: string,
    product: WalmartProduct,
    options: {
      checkSeasonality?: boolean;
      checkBulkOpportunities?: boolean;
      minSavingsPercentage?: number;
      comparisonPeriods?: Array<'7d' | '30d' | '60d' | '90d'>;
    } = {}
  ): Promise<DetectedDeal[]> {
    try {
      const deals: DetectedDeal[] = [];
      const comparisonPeriods = options.comparisonPeriods || ['30d', '60d', '90d'];
      const minSavings = options.minSavingsPercentage || 10;

      // Get price comparison data
      const comparisons = await this?.priceHistory?.comparePriceWithHistory(productId, comparisonPeriods);
      
      for (const comparison of comparisons) {
        if (Math.abs(comparison.priceChangePercentage) >= minSavings && comparison.isSignificantDrop) {
          const deal = await this.createDealFromComparison(product, comparison);
          if (deal) {
            deals.push(deal);
          }
        }
      }

      // Check for historical low prices
      const historicalLowDeal = await this.checkHistoricalLow(product);
      if (historicalLowDeal) {
        deals.push(historicalLowDeal);
      }

      // Check seasonal opportunities
      if (options.checkSeasonality) {
        const seasonalDeal = await this.checkSeasonalOpportunity(product);
        if (seasonalDeal) {
          deals.push(seasonalDeal);
        }
      }

      // Check bulk opportunities
      if (options.checkBulkOpportunities) {
        const bulkDeals = await this.checkBulkOpportunities(product);
        deals.push(...bulkDeals);
      }

      // Score and rank deals
      const scoredDeals = await this.scoreDeals(deals);
      
      // Store detected deals
      for (const deal of scoredDeals) {
        await this.storeDeal(deal);
      }

      logger.info("Deal detection completed", "DEAL_DETECTION", {
        productId,
        dealsFound: scoredDeals?.length || 0,
        topScore: scoredDeals[0]?.dealScore
      });

      return scoredDeals;

    } catch (error) {
      logger.error("Deal detection failed", "DEAL_DETECTION", { error, productId });
      return [];
    }
  }

  /**
   * Batch process multiple products for deal detection
   */
  async detectDealsBatch(
    products: Array<{ productId: string; product: WalmartProduct }>,
    options: {
      maxConcurrent?: number;
      delayMs?: number;
      checkSeasonality?: boolean;
      checkBulkOpportunities?: boolean;
    } = {}
  ): Promise<DetectedDeal[]> {
    const { maxConcurrent = 5, delayMs = 1000 } = options;
    const allDeals: DetectedDeal[] = [];

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < products?.length || 0; i += maxConcurrent) {
      const batch = products.slice(i, i + maxConcurrent);
      
      const batchPromises = batch?.map(({ productId, product }) =>
        this.detectDeals(productId, product, options).catch(error => {
          logger.warn("Failed to detect deals for product", "DEAL_DETECTION", { error, productId });
          return [];
        })
      );

      const batchResults = await Promise.all(batchPromises);
      allDeals.push(...batchResults.flat());

      // Add delay between batches
      if (i + maxConcurrent < products?.length || 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    logger.info("Batch deal detection completed", "DEAL_DETECTION", {
      productsProcessed: products?.length || 0,
      totalDealsFound: allDeals?.length || 0
    });

    return allDeals;
  }

  /**
   * Create deal alert for user
   */
  async createDealAlert(alert: Omit<DealAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const stmt = this?.db?.prepare(`
        INSERT INTO deal_alerts_enhanced (
          id, user_id, product_id, walmart_id, category, search_query,
          price_drop_percentage, price_drop_absolute, target_price, deal_type,
          is_active, priority, notification_methods, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        alertId,
        alert.userId,
        alert.productId,
        alert.walmartId,
        alert.category,
        alert.searchQuery,
        alert.priceDropPercentage,
        alert.priceDropAbsolute,
        alert.targetPrice,
        alert.dealType,
        alert.isActive ? 1 : 0,
        alert.priority,
        JSON.stringify(alert.notificationMethods),
        now,
        now
      );

      logger.info("Deal alert created", "DEAL_DETECTION", { alertId, userId: alert.userId });
      return alertId;

    } catch (error) {
      logger.error("Failed to create deal alert", "DEAL_DETECTION", { error });
      throw error;
    }
  }

  /**
   * Check active alerts and trigger notifications
   */
  async checkDealAlerts(): Promise<void> {
    try {
      const stmt = this?.db?.prepare(`
        SELECT * FROM deal_alerts_enhanced 
        WHERE is_active = 1 
        AND (last_checked_at IS NULL OR last_checked_at < datetime('now', '-1 hour'))
        ORDER BY priority DESC, created_at ASC
      `);

      const alerts = stmt.all() as any[];

      for (const alertRow of alerts) {
        try {
          const alert: DealAlert = {
            id: alertRow.id,
            userId: alertRow.user_id,
            productId: alertRow.product_id,
            walmartId: alertRow.walmart_id,
            category: alertRow.category,
            searchQuery: alertRow.search_query,
            priceDropPercentage: alertRow.price_drop_percentage,
            priceDropAbsolute: alertRow.price_drop_absolute,
            targetPrice: alertRow.target_price,
            dealType: alertRow.deal_type,
            isActive: alertRow.is_active === 1,
            priority: alertRow.priority,
            notificationMethods: JSON.parse(alertRow.notification_methods || '[]'),
            createdAt: alertRow.created_at,
            updatedAt: alertRow.updated_at,
            lastCheckedAt: alertRow.last_checked_at,
            lastTriggeredAt: alertRow.last_triggered_at
          };

          await this.checkSingleAlert(alert);

          // Update last checked time
          const updateStmt = this?.db?.prepare(`
            UPDATE deal_alerts_enhanced 
            SET last_checked_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `);
          updateStmt.run(alert.id);

        } catch (error) {
          logger.warn("Failed to check individual alert", "DEAL_DETECTION", { 
            error, 
            alertId: alertRow.id 
          });
        }
      }

    } catch (error) {
      logger.error("Failed to check deal alerts", "DEAL_DETECTION", { error });
    }
  }

  /**
   * Get active deals for display
   */
  async getActiveDeals(
    filters: {
      category?: string;
      dealType?: DetectedDeal['dealType'];
      minSavingsPercentage?: number;
      minDealScore?: number;
      limit?: number;
    } = {}
  ): Promise<DetectedDeal[]> {
    try {
      let query = `
        SELECT * FROM detected_deals 
        WHERE (deal_expires_at > datetime('now') OR deal_expires_at IS NULL)
      `;
      const params: any[] = [];

      if (filters.category) {
        query += ` AND category = ?`;
        params.push(filters.category);
      }

      if (filters.dealType) {
        query += ` AND deal_type = ?`;
        params.push(filters.dealType);
      }

      if (filters.minSavingsPercentage) {
        query += ` AND savings_percentage >= ?`;
        params.push(filters.minSavingsPercentage);
      }

      if (filters.minDealScore) {
        query += ` AND deal_score >= ?`;
        params.push(filters.minDealScore);
      }

      query += ` ORDER BY deal_score DESC, detected_at DESC LIMIT ?`;
      params.push(filters.limit || 50);

      const stmt = this?.db?.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows?.map(this.mapRowToDeal);

    } catch (error) {
      logger.error("Failed to get active deals", "DEAL_DETECTION", { error });
      return [];
    }
  }

  /**
   * Get deal statistics for dashboard
   */
  async getDealStatistics(period: '24h' | '7d' | '30d' = '24h'): Promise<{
    totalDeals: number;
    dealsByType: Record<string, number>;
    averageSavings: number;
    topCategories: Array<{ category: string; count: number; avgSavings: number }>;
    trendData: Array<{ date: string; deals: number; avgScore: number }>;
  }> {
    try {
      const periodHours = period === '24h' ? 24 : period === '7d' ? 168 : 720;
      
      const stmt = this?.db?.prepare(`
        SELECT 
          deal_type,
          category,
          COUNT(*) as count,
          AVG(savings_percentage) as avg_savings,
          AVG(deal_score) as avg_score,
          DATE(detected_at) as date
        FROM detected_deals 
        WHERE detected_at > datetime('now', '-${periodHours} hours')
        GROUP BY deal_type, category, DATE(detected_at)
        ORDER BY detected_at DESC
      `);

      const data = stmt.all() as any[];

      const totalDeals = data.reduce((sum: any, row: any) => sum + row.count, 0);
      const dealsByType: Record<string, number> = {};
      const categoryStats: Record<string, { count: number; totalSavings: number }> = {};
      const trendData: Record<string, { deals: number; totalScore: number; count: number }> = {};

      for (const row of data) {
        dealsByType[row.deal_type] = (dealsByType[row.deal_type] || 0) + row.count;
        
        if (!categoryStats[row.category]) {
          categoryStats[row.category] = { count: 0, totalSavings: 0 };
        }
        categoryStats[row.category]!.count += row.count;
        categoryStats[row.category]!.totalSavings += row.avg_savings * row.count;

        if (!trendData[row.date]) {
          trendData[row.date] = { deals: 0, totalScore: 0, count: 0 };
        }
        trendData[row.date]!.deals += row.count;
        trendData[row.date]!.totalScore += row.avg_score * row.count;
        trendData[row.date]!.count += row.count;
      }

      const averageSavings = data.reduce((sum: any, row: any) => sum + row.avg_savings * row.count, 0) / totalDeals || 0;
      
      const topCategories = Object.entries(categoryStats)
        .map(([category, stats]) => ({
          category,
          count: stats.count,
          avgSavings: stats.totalSavings / stats.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const trendDataArray = Object.entries(trendData)
        .map(([date, stats]) => ({
          date,
          deals: stats.deals,
          avgScore: stats.totalScore / stats.count
        }))
        .sort((a, b) => a?.date?.localeCompare(b.date));

      return {
        totalDeals,
        dealsByType,
        averageSavings,
        topCategories,
        trendData: trendDataArray
      };

    } catch (error) {
      logger.error("Failed to get deal statistics", "DEAL_DETECTION", { error });
      return {
        totalDeals: 0,
        dealsByType: {},
        averageSavings: 0,
        topCategories: [],
        trendData: []
      };
    }
  }

  // Private helper methods

  private async createDealFromComparison(
    product: WalmartProduct,
    comparison: PriceComparisonResult
  ): Promise<DetectedDeal | null> {
    try {
      const now = new Date().toISOString();
      const dealId = `deal_${comparison.productId}_${Date.now()}`;

      const dealReasons = [
        `${Math.abs(comparison.priceChangePercentage).toFixed(1)}% below ${comparison.comparisonPeriod} average`,
        `Save $${Math.abs(comparison.priceChange).toFixed(2)} vs recent average`
      ];

      if (Math.abs(comparison.priceChangePercentage) >= 20) {
        dealReasons.push("Significant price drop detected");
      }

      const deal: DetectedDeal = {
        id: dealId,
        productId: comparison.productId,
        walmartId: product.walmartId || product.id,
        productName: product.name,
        category: extractCategoryName(product.category),
        dealType: 'price_drop',
        currentPrice: comparison.currentPrice,
        originalPrice: comparison.comparisonPrice,
        referencePrice: comparison.comparisonPrice,
        savingsAmount: Math.abs(comparison.priceChange),
        savingsPercentage: Math.abs(comparison.priceChangePercentage),
        dealScore: 0, // Will be calculated in scoreDeals
        confidenceScore: 0.8,
        urgencyScore: 0.5,
        comparisonPeriod: comparison.comparisonPeriod,
        dealReasons,
        isHistoricalLow: false, // Will be determined later
        stockStatus: product.inStock ? 'in_stock' : 'unknown',
        detectedAt: now,
        lastVerifiedAt: now,
        verificationCount: 1
      };

      return deal;

    } catch (error) {
      logger.warn("Failed to create deal from comparison", "DEAL_DETECTION", { error });
      return null;
    }
  }

  private async checkHistoricalLow(product: WalmartProduct): Promise<DetectedDeal | null> {
    try {
      const stats = await this?.priceHistory?.getPriceStatistics(product.walmartId || product.id);
      if (!stats) return null;

      const currentPrice = product.livePrice?.price || extractNumericPrice(product.price);
      const historicalLow = Math.min(
        stats.price30dMin || currentPrice,
        stats.price60dMin || currentPrice,
        stats.price90dMin || currentPrice
      );

      // Check if current price is at or near historical low
      if (currentPrice <= historicalLow * 1.02) { // Within 2% of historical low
        const dealId = `historical_low_${product.walmartId || product.id}_${Date.now()}`;
        const now = new Date().toISOString();

        return {
          id: dealId,
          productId: product.walmartId || product.id,
          walmartId: product.walmartId || product.id,
          productName: product.name,
          category: extractCategoryName(product.category),
          dealType: 'historical_low',
          currentPrice,
          referencePrice: historicalLow,
          savingsAmount: 0,
          savingsPercentage: 0,
          dealScore: 0.9, // Historical lows get high score
          confidenceScore: 0.9,
          urgencyScore: 0.8, // High urgency for historical lows
          comparisonPeriod: '90d',
          dealReasons: ['Historical low price', 'Rare pricing opportunity'],
          isHistoricalLow: true,
          stockStatus: product.inStock ? 'in_stock' : 'unknown',
          detectedAt: now,
          lastVerifiedAt: now,
          verificationCount: 1
        };
      }

      return null;

    } catch (error) {
      logger.warn("Failed to check historical low", "DEAL_DETECTION", { error });
      return null;
    }
  }

  private async checkSeasonalOpportunity(product: WalmartProduct): Promise<DetectedDeal | null> {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const category = extractCategoryName(product.category)?.toLowerCase() || '';

      for (const [seasonalCategory, pattern] of Object.entries(this.SEASONAL_PATTERNS)) {
        if (category.includes(seasonalCategory) || 
            pattern?.items?.some(item => category.includes(item) || product?.name?.toLowerCase().includes(item))) {
          
          if (pattern?.offPeakMonths?.includes(currentMonth)) {
            // This is off-peak season - likely good deals
            const currentPrice = product.livePrice?.price || extractNumericPrice(product.price);
            const seasonalDiscount = 0.15; // Assume 15% seasonal discount
            const originalPrice = currentPrice / (1 - seasonalDiscount);

            const dealId = `seasonal_${product.walmartId || product.id}_${Date.now()}`;
            const now = new Date().toISOString();

            return {
              id: dealId,
              productId: product.walmartId || product.id,
              walmartId: product.walmartId || product.id,
              productName: product.name,
              category: extractCategoryName(product.category),
              dealType: 'seasonal',
              currentPrice,
              originalPrice,
              referencePrice: originalPrice,
              savingsAmount: originalPrice - currentPrice,
              savingsPercentage: seasonalDiscount * 100,
              dealScore: 0.6,
              confidenceScore: 0.7,
              urgencyScore: 0.4, // Seasonal deals are less urgent
              comparisonPeriod: '30d',
              dealReasons: [
                `Off-peak seasonal pricing for ${seasonalCategory}`,
                `${Math.round(seasonalDiscount * 100)}% seasonal discount`
              ],
              isHistoricalLow: false,
              stockStatus: product.inStock ? 'in_stock' : 'unknown',
              detectedAt: now,
              lastVerifiedAt: now,
              verificationCount: 1
            };
          }
        }
      }

      return null;

    } catch (error) {
      logger.warn("Failed to check seasonal opportunity", "DEAL_DETECTION", { error });
      return null;
    }
  }

  private async checkBulkOpportunities(product: WalmartProduct): Promise<DetectedDeal[]> {
    try {
      // This is a simplified implementation
      // In a real system, you'd search for different sizes of the same product
      const deals: DetectedDeal[] = [];

      // For demonstration, assume bulk discount if product name suggests larger size
      const currentPrice = product.livePrice?.price || extractNumericPrice(product.price);
      const name = product?.name?.toLowerCase();

      if (name.includes('bulk') || name.includes('family') || name.includes('value') || 
          name.match(/\b\d+\s*(pack|count|lb|oz|gallon)\b/)) {
        
        const bulkDiscount = 0.12; // Assume 12% bulk discount
        const regularPrice = currentPrice / (1 - bulkDiscount);

        const dealId = `bulk_${product.walmartId || product.id}_${Date.now()}`;
        const now = new Date().toISOString();

        deals.push({
          id: dealId,
          productId: product.walmartId || product.id,
          walmartId: product.walmartId || product.id,
          productName: product.name,
          category: extractCategoryName(product.category),
          dealType: 'bulk_discount',
          currentPrice,
          originalPrice: regularPrice,
          referencePrice: regularPrice,
          savingsAmount: regularPrice - currentPrice,
          savingsPercentage: bulkDiscount * 100,
          dealScore: 0.6,
          confidenceScore: 0.6,
          urgencyScore: 0.3, // Bulk deals are less urgent
          comparisonPeriod: '30d',
          dealReasons: [
            'Bulk size offers better unit pricing',
            `Save ${Math.round(bulkDiscount * 100)}% by buying larger quantity`
          ],
          isHistoricalLow: false,
          stockStatus: product.inStock ? 'in_stock' : 'unknown',
          detectedAt: now,
          lastVerifiedAt: now,
          verificationCount: 1
        });
      }

      return deals;

    } catch (error) {
      logger.warn("Failed to check bulk opportunities", "DEAL_DETECTION", { error });
      return [];
    }
  }

  private async scoreDeals(deals: DetectedDeal[]): Promise<DetectedDeal[]> {
    for (const deal of deals) {
      let score = 0;

      // Base score from savings percentage
      const savingsPercent = deal?.savingsPercentage;
      if (savingsPercent >= this?.DEAL_THRESHOLDS?.exceptional.percentage) {
        score = this?.DEAL_THRESHOLDS?.exceptional.score;
      } else if (savingsPercent >= this?.DEAL_THRESHOLDS?.excellent.percentage) {
        score = this?.DEAL_THRESHOLDS?.excellent.score;
      } else if (savingsPercent >= this?.DEAL_THRESHOLDS?.good.percentage) {
        score = this?.DEAL_THRESHOLDS?.good.score;
      } else if (savingsPercent >= this?.DEAL_THRESHOLDS?.moderate.percentage) {
        score = this?.DEAL_THRESHOLDS?.moderate.score;
      } else {
        score = this?.DEAL_THRESHOLDS?.minimal.score;
      }

      // Boost for historical lows
      if (deal.isHistoricalLow) {
        score = Math.min(1.0, score + 0.2);
      }

      // Boost for high-confidence deals
      score = Math.min(1.0, score + (deal.confidenceScore - 0.7) * 0.3);

      // Penalty for low stock
      if (deal.stockStatus === 'low_stock') {
        score *= 0.9;
      } else if (deal.stockStatus === 'out_of_stock') {
        score *= 0.5;
      }

      // Deal type specific adjustments
      switch (deal.dealType) {
        case 'price_drop':
          score = Math.min(1.0, score + 0.1);
          break;
        case 'historical_low':
          score = Math.min(1.0, score + 0.2);
          break;
        case 'clearance':
          score = Math.min(1.0, score + 0.15);
          break;
      }

      deal.dealScore = Math.max(0, Math.min(1.0, score));
    }

    return deals.sort((a, b) => b.dealScore - a.dealScore);
  }

  private async storeDeal(deal: DetectedDeal): Promise<void> {
    try {
      const stmt = this?.db?.prepare(`
        INSERT OR REPLACE INTO detected_deals (
          id, product_id, walmart_id, product_name, category,
          deal_type, current_price, original_price, reference_price,
          savings_amount, savings_percentage, deal_score, confidence_score,
          urgency_score, comparison_period, deal_reasons, historical_low,
          stock_status, estimated_stock_level, deal_expires_at,
          detected_at, first_seen_at, last_verified_at, verification_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        deal.id,
        deal.productId,
        deal.walmartId,
        deal.productName,
        deal.category,
        deal.dealType,
        deal.currentPrice,
        deal.originalPrice,
        deal.referencePrice,
        deal.savingsAmount,
        deal.savingsPercentage,
        deal.dealScore,
        deal.confidenceScore,
        deal.urgencyScore,
        deal.comparisonPeriod,
        JSON.stringify(deal.dealReasons),
        deal.isHistoricalLow ? 1 : 0,
        deal.stockStatus,
        deal.estimatedStockLevel,
        deal.dealExpiresAt,
        deal.detectedAt,
        deal.firstSeenAt,
        deal.lastVerifiedAt,
        deal.verificationCount
      );

    } catch (error) {
      logger.warn("Failed to store deal", "DEAL_DETECTION", { error, dealId: deal.id });
    }
  }

  private async checkSingleAlert(alert: DealAlert): Promise<void> {
    try {
      // Implementation for checking individual alerts and triggering notifications
      // This would integrate with the notification system
      logger.debug("Checking deal alert", "DEAL_DETECTION", { alertId: alert.id });
      
    } catch (error) {
      logger.warn("Failed to check alert", "DEAL_DETECTION", { error, alertId: alert.id });
    }
  }

  private mapRowToDeal(row: any): DetectedDeal {
    return {
      id: row.id,
      productId: row.product_id,
      walmartId: row.walmart_id,
      productName: row.product_name,
      category: row.category,
      dealType: row.deal_type,
      currentPrice: row.current_price,
      originalPrice: row.original_price,
      referencePrice: row.reference_price,
      savingsAmount: row.savings_amount,
      savingsPercentage: row.savings_percentage,
      dealScore: row.deal_score,
      confidenceScore: row.confidence_score,
      urgencyScore: row.urgency_score,
      comparisonPeriod: row.comparison_period,
      dealReasons: JSON.parse(row.deal_reasons || '[]'),
      isHistoricalLow: row.historical_low === 1,
      stockStatus: row.stock_status,
      estimatedStockLevel: row.estimated_stock_level,
      dealExpiresAt: row.deal_expires_at,
      detectedAt: row.detected_at,
      firstSeenAt: row.first_seen_at,
      lastVerifiedAt: row.last_verified_at,
      verificationCount: row.verification_count
    };
  }
}