/**
 * Deal Recommendation Engine - Advanced deal discovery and analysis system
 * Analyzes price trends, bulk opportunities, seasonal patterns, and user behavior
 * Provides intelligent deal recommendations and savings optimization
 */

import { logger } from "../../utils/logger.js";
import { WalmartPriceFetcher } from "./WalmartPriceFetcher.js";
import { PurchaseHistoryService } from "./PurchaseHistoryService.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";
import type { PurchaseRecord, ProductFrequency } from "./PurchaseHistoryService.js";
import type Database from "better-sqlite3";

export interface Deal {
  id: string;
  productId: string;
  product: WalmartProduct;
  dealType: 'price_drop' | 'bulk_discount' | 'seasonal' | 'clearance' | 'competitor_match' | 'store_brand_alternative';
  currentPrice: number;
  originalPrice?: number;
  savings: number;
  savingsPercentage: number;
  validUntil?: string;
  dealScore: number;
  confidence: number;
  reasons: string[];
  bulkRecommendation?: BulkRecommendation;
  alternativeProducts?: AlternativeDeal[];
  userPersonalization?: DealPersonalization;
}

export interface BulkRecommendation {
  recommendedQuantity: number;
  totalSavings: number;
  breakEvenQuantity: number;
  shelfLife?: number;
  storageRequirements?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AlternativeDeal {
  product: WalmartProduct;
  currentPrice: number;
  savings: number;
  reason: string;
  switchRecommendation: 'strong' | 'moderate' | 'weak';
}

export interface DealPersonalization {
  userPurchaseFrequency?: number;
  lastPurchaseDate?: string;
  averageSpentOnCategory: number;
  personalizedScore: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  nextPurchasePrediction?: string;
}

export interface PriceTrend {
  productId: string;
  priceHistory: Array<{
    price: number;
    date: string;
    source: string;
  }>;
  trendDirection: 'rising' | 'falling' | 'stable' | 'volatile';
  volatilityScore: number;
  predictedNextPrice: number;
  confidence: number;
}

export interface DealDiscoveryOptions {
  userId?: string;
  categories?: string[];
  maxDeals?: number;
  minSavings?: number;
  minSavingsPercentage?: number;
  dealTypes?: Deal['dealType'][];
  priceRange?: {
    min: number;
    max: number;
  };
  includeAlternatives?: boolean;
  personalized?: boolean;
}

export interface SeasonalPattern {
  category: string;
  month: number;
  typicalPriceMultiplier: number;
  demandLevel: 'low' | 'medium' | 'high' | 'peak';
  recommendations: string[];
}

export class DealRecommendationEngine {
  private static instance: DealRecommendationEngine;
  private db: Database.Database;
  private priceFetcher: WalmartPriceFetcher;
  private historyService: PurchaseHistoryService;

  private constructor() {
    const dbManager = getDatabaseManager();
    this.db = dbManager.connectionPool?.getConnection().getDatabase() || 
              (() => { throw new Error("Database connection not available"); })();
    this.priceFetcher = WalmartPriceFetcher.getInstance();
    this.historyService = PurchaseHistoryService.getInstance();
    
    this.initializeTables();
  }

  static getInstance(): DealRecommendationEngine {
    if (!DealRecommendationEngine.instance) {
      DealRecommendationEngine.instance = new DealRecommendationEngine();
    }
    return DealRecommendationEngine.instance;
  }

  /**
   * Initialize database tables for deal tracking
   */
  private initializeTables(): void {
    try {
      // Price history table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS price_history (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          price REAL NOT NULL,
          sale_price REAL,
          was_price REAL,
          store_location TEXT,
          recorded_at TEXT NOT NULL,
          source TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);

      // Deal alerts table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS deal_alerts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          product_id TEXT,
          category TEXT,
          deal_type TEXT NOT NULL,
          threshold_price REAL,
          threshold_percentage REAL,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          triggered_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Seasonal patterns cache
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS seasonal_patterns (
          category TEXT NOT NULL,
          month INTEGER NOT NULL,
          avg_price_multiplier REAL NOT NULL,
          demand_level TEXT NOT NULL,
          last_updated TEXT NOT NULL,
          PRIMARY KEY (category, month)
        )
      `);

      // Create indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_price_history_product_date 
        ON price_history(product_id, recorded_at DESC)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_deal_alerts_user_active 
        ON deal_alerts(user_id, is_active)
      `);

      logger.info("Deal recommendation tables initialized", "DEAL_ENGINE");
    } catch (error) {
      logger.error("Failed to initialize deal tables", "DEAL_ENGINE", { error });
      throw error;
    }
  }

  /**
   * Discover deals based on user preferences and market analysis
   */
  async discoverDeals(options: DealDiscoveryOptions = {}): Promise<Deal[]> {
    try {
      logger.info("Starting deal discovery", "DEAL_ENGINE", { options });

      const deals: Deal[] = [];

      // Get user context if available
      let userHistory: ProductFrequency[] = [];
      if (options.userId) {
        try {
          userHistory = await this.historyService.getProductFrequency(options.userId);
        } catch (error) {
          logger.warn("Could not fetch user history for deals", "DEAL_ENGINE", { error });
        }
      }

      // Discover different types of deals
      const dealDiscoveryMethods = [
        () => this.discoverPriceDropDeals(options, userHistory),
        () => this.discoverBulkDiscountDeals(options, userHistory),
        () => this.discoverSeasonalDeals(options, userHistory),
        () => this.discoverStoreBrandAlternatives(options, userHistory),
        () => this.discoverClearanceDeals(options, userHistory)
      ];

      // Run all discovery methods
      for (const method of dealDiscoveryMethods) {
        try {
          const methodDeals = await method();
          deals.push(...methodDeals);
        } catch (error) {
          logger.warn("Deal discovery method failed", "DEAL_ENGINE", { error });
        }
      }

      // Deduplicate and score deals
      const uniqueDeals = this.deduplicateDeals(deals);
      const scoredDeals = await this.scoreAndRankDeals(uniqueDeals, options, userHistory);

      // Apply filters and limits
      let filteredDeals = scoredDeals;

      if (options.minSavings !== undefined) {
        filteredDeals = filteredDeals.filter(deal => deal.savings >= options.minSavings!);
      }

      if (options.minSavingsPercentage !== undefined) {
        filteredDeals = filteredDeals.filter(deal => deal.savingsPercentage >= options.minSavingsPercentage!);
      }

      if (options.dealTypes?.length) {
        filteredDeals = filteredDeals.filter(deal => options.dealTypes!.includes(deal.dealType));
      }

      if (options.priceRange) {
        filteredDeals = filteredDeals.filter(deal => 
          deal.currentPrice >= options.priceRange!.min && 
          deal.currentPrice <= options.priceRange!.max
        );
      }

      const maxDeals = options.maxDeals || 20;
      const finalDeals = filteredDeals.slice(0, maxDeals);

      // Add personalization if requested
      if (options.personalized && options.userId) {
        await this.addPersonalization(finalDeals, options.userId, userHistory);
      }

      // Add alternatives if requested
      if (options.includeAlternatives) {
        await this.addAlternativeDeals(finalDeals, options);
      }

      logger.info("Deal discovery completed", "DEAL_ENGINE", {
        totalFound: deals.length,
        afterFiltering: finalDeals.length,
        userId: options.userId
      });

      return finalDeals;

    } catch (error) {
      logger.error("Deal discovery failed", "DEAL_ENGINE", { error });
      throw error;
    }
  }

  /**
   * Track price for deal monitoring
   */
  async trackPrice(productId: string, product: WalmartProduct): Promise<void> {
    try {
      const now = new Date().toISOString();
      const price = product.livePrice?.price || product.price || 0;
      const salePrice = product.livePrice?.salePrice;
      const wasPrice = product.livePrice?.wasPrice;
      const source = product.livePrice?.source || 'unknown';
      const location = product.livePrice?.storeLocation;

      const stmt = this.db.prepare(`
        INSERT INTO price_history (id, product_id, price, sale_price, was_price, store_location, recorded_at, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const id = `${productId}_${Date.now()}`;
      stmt.run(id, productId, price, salePrice, wasPrice, location, now, source, now);

      logger.debug("Price tracked", "DEAL_ENGINE", { productId, price });
    } catch (error) {
      logger.warn("Failed to track price", "DEAL_ENGINE", { error, productId });
    }
  }

  /**
   * Analyze price trends for a product
   */
  async analyzePriceTrends(productId: string, days: number = 30): Promise<PriceTrend | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT price, recorded_at, source
        FROM price_history
        WHERE product_id = ? AND recorded_at >= datetime('now', '-${days} days')
        ORDER BY recorded_at ASC
      `);

      const history = stmt.all(productId);

      if (history.length < 3) {
        return null; // Need at least 3 data points
      }

      const priceHistory = history.map((row: any) => ({
        price: row.price,
        date: row.recorded_at,
        source: row.source
      }));

      // Calculate trend direction
      const prices = priceHistory.map(h => h.price);
      const trendDirection = this.calculateTrendDirection(prices);
      const volatilityScore = this.calculateVolatility(prices);
      const predictedNextPrice = this.predictNextPrice(prices);
      const confidence = this.calculatePredictionConfidence(prices, volatilityScore);

      return {
        productId,
        priceHistory,
        trendDirection,
        volatilityScore,
        predictedNextPrice,
        confidence
      };

    } catch (error) {
      logger.error("Failed to analyze price trends", "DEAL_ENGINE", { error, productId });
      return null;
    }
  }

  /**
   * Discover price drop deals
   */
  private async discoverPriceDropDeals(
    options: DealDiscoveryOptions,
    userHistory: ProductFrequency[]
  ): Promise<Deal[]> {
    const deals: Deal[] = [];

    // Focus on products from user history first
    const targetProducts = userHistory.length > 0 ? userHistory.slice(0, 10) : [];

    for (const historyItem of targetProducts) {
      try {
        // Get current price
        const searchResults = await this.priceFetcher.searchProductsWithPrices(
          historyItem.productName,
          { zipCode: '29301', city: 'Spartanburg', state: 'SC' },
          1
        );

        if (searchResults && searchResults.length > 0) {
          const product = searchResults[0];
          const currentPrice = product.livePrice?.price || product.price || 0;
          const averageHistoricalPrice = historyItem.averagePrice;

          // Calculate savings
          if (currentPrice > 0 && averageHistoricalPrice > currentPrice) {
            const savings = averageHistoricalPrice - currentPrice;
            const savingsPercentage = (savings / averageHistoricalPrice) * 100;

            if (savingsPercentage >= 10) { // At least 10% savings
              const deal: Deal = {
                id: `price_drop_${product.walmartId || product.id}_${Date.now()}`,
                productId: product.walmartId || product.id,
                product,
                dealType: 'price_drop',
                currentPrice,
                originalPrice: averageHistoricalPrice,
                savings,
                savingsPercentage,
                dealScore: savingsPercentage / 100, // Initial score
                confidence: 0.8,
                reasons: [
                  `${savingsPercentage.toFixed(0)}% below your average purchase price`,
                  `Save $${savings.toFixed(2)} compared to usual price`
                ]
              };

              deals.push(deal);
            }
          }
        }
      } catch (error) {
        logger.warn("Error checking price drop for product", "DEAL_ENGINE", { 
          error, 
          product: historyItem.productName 
        });
      }
    }

    return deals;
  }

  /**
   * Discover bulk discount deals
   */
  private async discoverBulkDiscountDeals(
    options: DealDiscoveryOptions,
    userHistory: ProductFrequency[]
  ): Promise<Deal[]> {
    const deals: Deal[] = [];

    // Focus on frequently purchased items
    const frequentItems = userHistory.filter(item => 
      item.purchaseCount >= 3 && item.frequency === 'weekly' || item.frequency === 'monthly'
    ).slice(0, 5);

    for (const item of frequentItems) {
      try {
        const searchResults = await this.priceFetcher.searchProductsWithPrices(
          item.productName,
          { zipCode: '29301', city: 'Spartanburg', state: 'SC' },
          3 // Get multiple size options
        );

        if (searchResults && searchResults.length >= 2) {
          // Find bulk opportunities by comparing different sizes
          const sorted = searchResults.sort((a, b) => {
            const priceA = a.livePrice?.price || a.price || 0;
            const priceB = b.livePrice?.price || b.price || 0;
            return priceA - priceB;
          });

          const smallest = sorted[0];
          const largest = sorted[sorted.length - 1];

          const smallPrice = smallest.livePrice?.price || smallest.price || 0;
          const largePrice = largest.livePrice?.price || largest.price || 0;

          // Estimate unit savings (simplified)
          if (largePrice > smallPrice && largePrice < smallPrice * 2) {
            const estimatedUnitSavings = (smallPrice * 2) - largePrice;
            const savingsPercentage = (estimatedUnitSavings / (smallPrice * 2)) * 100;

            if (savingsPercentage >= 15) {
              const deal: Deal = {
                id: `bulk_${largest.walmartId || largest.id}_${Date.now()}`,
                productId: largest.walmartId || largest.id,
                product: largest,
                dealType: 'bulk_discount',
                currentPrice: largePrice,
                originalPrice: smallPrice * 2,
                savings: estimatedUnitSavings,
                savingsPercentage,
                dealScore: savingsPercentage / 100,
                confidence: 0.7,
                reasons: [
                  `Buy larger size and save ${savingsPercentage.toFixed(0)}%`,
                  `Better unit price than smaller sizes`
                ],
                bulkRecommendation: {
                  recommendedQuantity: Math.ceil(item.averageQuantity * 2),
                  totalSavings: estimatedUnitSavings,
                  breakEvenQuantity: 1,
                  riskLevel: item.frequency === 'weekly' ? 'low' : 'medium'
                }
              };

              deals.push(deal);
            }
          }
        }
      } catch (error) {
        logger.warn("Error checking bulk deals for product", "DEAL_ENGINE", { 
          error, 
          product: item.productName 
        });
      }
    }

    return deals;
  }

  /**
   * Discover seasonal deals
   */
  private async discoverSeasonalDeals(
    options: DealDiscoveryOptions,
    userHistory: ProductFrequency[]
  ): Promise<Deal[]> {
    const deals: Deal[] = [];
    const currentMonth = new Date().getMonth() + 1;

    // Seasonal categories and their peak/off-peak months
    const seasonalCategories = {
      'produce': {
        peakMonths: [6, 7, 8], // Summer
        offPeakMonths: [12, 1, 2], // Winter
        items: ['fruits', 'vegetables', 'berries', 'tomatoes']
      },
      'beverages': {
        peakMonths: [6, 7, 8], // Summer
        offPeakMonths: [12, 1, 2], // Winter
        items: ['soda', 'juice', 'water', 'sports drinks']
      },
      'frozen': {
        peakMonths: [12, 1, 2], // Winter
        offPeakMonths: [6, 7, 8], // Summer
        items: ['ice cream', 'frozen meals', 'frozen vegetables']
      }
    };

    for (const [category, info] of Object.entries(seasonalCategories)) {
      if (info.offPeakMonths.includes(currentMonth)) {
        // This category should have deals during off-peak
        for (const item of info.items) {
          try {
            const searchResults = await this.priceFetcher.searchProductsWithPrices(
              item,
              { zipCode: '29301', city: 'Spartanburg', state: 'SC' },
              2
            );

            if (searchResults) {
              for (const product of searchResults) {
                const currentPrice = product.livePrice?.price || product.price || 0;
                
                // Mock seasonal discount (in real implementation, would compare to historical data)
                const seasonalDiscount = 0.15; // 15% off during off-peak
                const originalPrice = currentPrice / (1 - seasonalDiscount);
                const savings = originalPrice - currentPrice;
                const savingsPercentage = seasonalDiscount * 100;

                const deal: Deal = {
                  id: `seasonal_${product.walmartId || product.id}_${Date.now()}`,
                  productId: product.walmartId || product.id,
                  product,
                  dealType: 'seasonal',
                  currentPrice,
                  originalPrice,
                  savings,
                  savingsPercentage,
                  dealScore: savingsPercentage / 100,
                  confidence: 0.6,
                  reasons: [
                    `Seasonal deal - ${category} items on sale`,
                    `Off-peak pricing for ${item}`
                  ]
                };

                deals.push(deal);
              }
            }
          } catch (error) {
            logger.warn("Error checking seasonal deals", "DEAL_ENGINE", { error, item });
          }
        }
      }
    }

    return deals.slice(0, 10); // Limit seasonal deals
  }

  /**
   * Discover store brand alternatives
   */
  private async discoverStoreBrandAlternatives(
    options: DealDiscoveryOptions,
    userHistory: ProductFrequency[]
  ): Promise<Deal[]> {
    const deals: Deal[] = [];

    // Focus on name brand items from history
    const nameBrandItems = userHistory.filter(item => {
      const name = item.productName.toLowerCase();
      const storeBrands = ['great value', 'walmart', 'equate', 'marketside'];
      return !storeBrands.some(brand => name.includes(brand));
    }).slice(0, 5);

    for (const item of nameBrandItems) {
      try {
        // Search for store brand alternative
        const storeBrandQuery = `great value ${item.productName.split(' ').slice(-2).join(' ')}`;
        const searchResults = await this.priceFetcher.searchProductsWithPrices(
          storeBrandQuery,
          { zipCode: '29301', city: 'Spartanburg', state: 'SC' },
          1
        );

        if (searchResults && searchResults.length > 0) {
          const storeBrandProduct = searchResults[0];
          const storeBrandPrice = storeBrandProduct.livePrice?.price || storeBrandProduct.price || 0;
          const originalPrice = item.averagePrice;

          if (storeBrandPrice > 0 && originalPrice > storeBrandPrice) {
            const savings = originalPrice - storeBrandPrice;
            const savingsPercentage = (savings / originalPrice) * 100;

            if (savingsPercentage >= 20) { // At least 20% savings for store brand switch
              const deal: Deal = {
                id: `store_brand_${storeBrandProduct.walmartId || storeBrandProduct.id}_${Date.now()}`,
                productId: storeBrandProduct.walmartId || storeBrandProduct.id,
                product: storeBrandProduct,
                dealType: 'store_brand_alternative',
                currentPrice: storeBrandPrice,
                originalPrice,
                savings,
                savingsPercentage,
                dealScore: savingsPercentage / 100,
                confidence: 0.8,
                reasons: [
                  `Switch to store brand and save ${savingsPercentage.toFixed(0)}%`,
                  `Great Value alternative to ${item.productName}`,
                  `Same quality, lower price`
                ]
              };

              deals.push(deal);
            }
          }
        }
      } catch (error) {
        logger.warn("Error checking store brand alternatives", "DEAL_ENGINE", { 
          error, 
          product: item.productName 
        });
      }
    }

    return deals;
  }

  /**
   * Discover clearance deals (mock implementation)
   */
  private async discoverClearanceDeals(
    options: DealDiscoveryOptions,
    userHistory: ProductFrequency[]
  ): Promise<Deal[]> {
    // In a real implementation, this would query clearance sections or APIs
    // For now, return empty array as clearance deals are unpredictable
    return [];
  }

  /**
   * Deduplicate deals by product ID
   */
  private deduplicateDeals(deals: Deal[]): Deal[] {
    const seen = new Set<string>();
    return deals.filter(deal => {
      if (seen.has(deal.productId)) {
        return false;
      }
      seen.add(deal.productId);
      return true;
    });
  }

  /**
   * Score and rank deals
   */
  private async scoreAndRankDeals(
    deals: Deal[],
    options: DealDiscoveryOptions,
    userHistory: ProductFrequency[]
  ): Promise<Deal[]> {
    for (const deal of deals) {
      let score = deal.dealScore;

      // Boost score based on user history
      const userItem = userHistory.find(h => 
        h.productName.toLowerCase().includes(deal.product.name.toLowerCase().split(' ')[0])
      );

      if (userItem) {
        score += 0.3; // Significant boost for items in purchase history
        
        // Additional boost for frequently purchased items
        if (userItem.purchaseCount >= 5) {
          score += 0.2;
        }
        
        // Boost based on purchase frequency
        if (userItem.frequency === 'weekly') {
          score += 0.2;
        } else if (userItem.frequency === 'monthly') {
          score += 0.1;
        }
      }

      // Boost score based on savings percentage
      if (deal.savingsPercentage >= 30) {
        score += 0.2;
      } else if (deal.savingsPercentage >= 20) {
        score += 0.1;
      }

      // Deal type specific scoring
      switch (deal.dealType) {
        case 'price_drop':
          score += 0.1; // Timely price drops are valuable
          break;
        case 'bulk_discount':
          score += userItem ? 0.15 : 0.05; // More valuable if user buys this regularly
          break;
        case 'store_brand_alternative':
          score += 0.1; // Consistent savings
          break;
        case 'seasonal':
          score += 0.05; // Moderate boost for seasonal
          break;
      }

      deal.dealScore = Math.min(1.0, score);
    }

    return deals.sort((a, b) => b.dealScore - a.dealScore);
  }

  /**
   * Add personalization to deals
   */
  private async addPersonalization(
    deals: Deal[],
    userId: string,
    userHistory: ProductFrequency[]
  ): Promise<void> {
    for (const deal of deals) {
      const userItem = userHistory.find(h => 
        h.productName.toLowerCase().includes(deal.product.name.toLowerCase().split(' ')[0])
      );

      if (userItem) {
        // Calculate next purchase prediction
        const daysSinceLastPurchase = Math.floor(
          (Date.now() - new Date(userItem.lastPurchase).getTime()) / (1000 * 60 * 60 * 24)
        );

        let urgency: DealPersonalization['urgency'] = 'low';
        if (daysSinceLastPurchase >= userItem.averageDaysBetween * 1.5) {
          urgency = 'critical';
        } else if (daysSinceLastPurchase >= userItem.averageDaysBetween) {
          urgency = 'high';
        } else if (daysSinceLastPurchase >= userItem.averageDaysBetween * 0.7) {
          urgency = 'medium';
        }

        const nextPurchaseDate = new Date(
          new Date(userItem.lastPurchase).getTime() + 
          userItem.averageDaysBetween * 24 * 60 * 60 * 1000
        );

        deal.userPersonalization = {
          userPurchaseFrequency: userItem.averageDaysBetween,
          lastPurchaseDate: userItem.lastPurchase,
          averageSpentOnCategory: userItem.totalSpent / userItem.purchaseCount,
          personalizedScore: deal.dealScore + (urgency === 'critical' ? 0.3 : urgency === 'high' ? 0.2 : 0.1),
          urgency,
          nextPurchasePrediction: nextPurchaseDate.toISOString()
        };
      }
    }
  }

  /**
   * Add alternative deals
   */
  private async addAlternativeDeals(deals: Deal[], options: DealDiscoveryOptions): Promise<void> {
    // Implementation would search for alternative products
    // For brevity, this is a simplified version
    for (const deal of deals) {
      deal.alternativeProducts = []; // Placeholder
    }
  }

  // Helper methods for price trend analysis

  private calculateTrendDirection(prices: number[]): 'rising' | 'falling' | 'stable' | 'volatile' {
    if (prices.length < 3) return 'stable';

    const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
    const secondHalf = prices.slice(Math.floor(prices.length / 2));

    const firstAvg = firstHalf.reduce((sum, p) => sum + p, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p, 0) / secondHalf.length;

    const percentChange = Math.abs((secondAvg - firstAvg) / firstAvg) * 100;
    const direction = secondAvg > firstAvg ? 'rising' : 'falling';

    if (percentChange < 5) return 'stable';
    if (percentChange > 20) return 'volatile';
    return direction;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);

    return standardDeviation / mean; // Coefficient of variation
  }

  private predictNextPrice(prices: number[]): number {
    if (prices.length < 3) return prices[prices.length - 1];

    // Simple linear regression for prediction
    const n = prices.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = prices.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * prices[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return slope * n + intercept; // Predict next point
  }

  private calculatePredictionConfidence(prices: number[], volatility: number): number {
    // Lower volatility = higher confidence
    const baseConfidence = 0.7;
    const volatilityPenalty = Math.min(0.4, volatility * 2);
    return Math.max(0.3, baseConfidence - volatilityPenalty);
  }
}