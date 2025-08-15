/**
 * Price History Service - Continuous price tracking and historical analysis
 * Handles price data ingestion, storage, and statistical analysis for deal detection
 */

import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import type Database from "better-sqlite3";
import type { WalmartProduct } from "../../types/walmart-grocery.js";

export interface PriceRecord {
  id: string;
  productId: string;
  walmartId: string;
  productName: string;
  category?: string;
  brand?: string;
  currentPrice: number;
  salePrice?: number;
  wasPrice?: number;
  originalPrice?: number;
  storeLocation?: string;
  storeId?: string;
  source: 'api' | 'scraper' | 'cache';
  confidenceScore: number;
  recordedAt: string;
  createdAt: string;
  isDealCandidate: boolean;
  priceChangePercentage?: number;
  priceTrend?: 'rising' | 'falling' | 'stable' | 'volatile';
}

export interface PriceStatistics {
  productId: string;
  walmartId: string;
  productName: string;
  category?: string;
  currentPrice: number;
  price7dAvg?: number;
  price30dAvg?: number;
  price60dAvg?: number;
  price90dAvg?: number;
  price7dMin?: number;
  price30dMin?: number;
  price60dMin?: number;
  price90dMin?: number;
  price7dMax?: number;
  price30dMax?: number;
  price60dMax?: number;
  price90dMax?: number;
  priceVolatility: number;
  priceTrendDirection: 'rising' | 'falling' | 'stable' | 'volatile';
  firstTrackedAt: string;
  lastUpdatedAt: string;
  updateCount: number;
}

export interface PriceComparisonResult {
  productId: string;
  currentPrice: number;
  comparisonPrice: number;
  comparisonPeriod: '7d' | '30d' | '60d' | '90d';
  priceChange: number;
  priceChangePercentage: number;
  isSignificantDrop: boolean;
  isDealCandidate: boolean;
  dealThresholds: {
    moderate: number; // 10%
    good: number;     // 20%
    excellent: number; // 30%
  };
}

export interface PriceTrendAnalysis {
  productId: string;
  trendDirection: 'rising' | 'falling' | 'stable' | 'volatile';
  volatilityScore: number;
  predictedNextPrice: number;
  confidence: number;
  priceHistory: Array<{
    price: number;
    date: string;
    source: string;
  }>;
}

export class PriceHistoryService {
  private static instance: PriceHistoryService;
  private db: Database.Database;
  
  // Deal detection thresholds
  private readonly DEAL_THRESHOLDS = {
    moderate: 0.10,  // 10% price drop
    good: 0.20,      // 20% price drop
    excellent: 0.30, // 30% price drop
  };

  // Price volatility thresholds
  private readonly VOLATILITY_THRESHOLDS = {
    stable: 0.05,    // < 5% coefficient of variation
    moderate: 0.15,  // 5-15% coefficient of variation
    high: 0.25,      // 15-25% coefficient of variation
    // > 25% = volatile
  };

  private constructor() {
    const dbManager = getDatabaseManager();
    this.db = dbManager.connectionPool?.getConnection().getDatabase() || 
              (() => { throw new Error("Database connection not available"); })();
  }

  static getInstance(): PriceHistoryService {
    if (!PriceHistoryService.instance) {
      PriceHistoryService.instance = new PriceHistoryService();
    }
    return PriceHistoryService.instance;
  }

  /**
   * Record new price data for a product
   */
  async recordPrice(
    product: WalmartProduct,
    priceData: {
      currentPrice: number;
      salePrice?: number;
      wasPrice?: number;
      source: 'api' | 'scraper' | 'cache';
      confidenceScore?: number;
      storeLocation?: string;
      storeId?: string;
    }
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const recordId = `${product.walmartId || product.id}_${Date.now()}`;
      
      // Get previous price for comparison
      const previousPrice = await this.getLatestPrice(product.walmartId || product.id);
      
      // Calculate price change
      let priceChangePercentage: number | undefined;
      let priceTrend: 'rising' | 'falling' | 'stable' | 'volatile' | undefined;
      let isDealCandidate = false;

      if (previousPrice && previousPrice.currentPrice > 0) {
        const change = priceData.currentPrice - previousPrice.currentPrice;
        priceChangePercentage = (change / previousPrice.currentPrice) * 100;
        
        // Determine trend
        if (Math.abs(priceChangePercentage) < 2) {
          priceTrend = 'stable';
        } else if (priceChangePercentage > 0) {
          priceTrend = 'rising';
        } else {
          priceTrend = 'falling';
          
          // Check if this is a potential deal
          isDealCandidate = Math.abs(priceChangePercentage) >= (this?.DEAL_THRESHOLDS?.moderate * 100);
        }
      }

      // Insert price record
      const insertStmt = this?.db?.prepare(`
        INSERT INTO price_history_enhanced (
          id, product_id, walmart_id, product_name, category, brand,
          current_price, sale_price, was_price, original_price,
          store_location, store_id, source, confidence_score,
          recorded_at, created_at, is_deal_candidate,
          price_change_percentage, price_trend
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        recordId,
        product.walmartId || product.id,
        product.walmartId || product.id,
        product.name,
        product.category?.name,
        product.brand,
        priceData.currentPrice,
        priceData.salePrice,
        priceData.wasPrice,
        priceData.wasPrice, // Use wasPrice as originalPrice if available
        priceData.storeLocation,
        priceData.storeId,
        priceData.source,
        priceData.confidenceScore || 1.0,
        now,
        now,
        isDealCandidate ? 1 : 0,
        priceChangePercentage,
        priceTrend
      );

      // Update or create price statistics (handled by trigger)
      await this.updatePriceStatistics(product.walmartId || product.id);

      logger.debug("Price recorded", "PRICE_HISTORY", {
        productId: product.walmartId || product.id,
        price: priceData.currentPrice,
        change: priceChangePercentage?.toFixed(2) + '%',
        isDealCandidate
      });

    } catch (error) {
      logger.error("Failed to record price", "PRICE_HISTORY", { error });
      throw error;
    }
  }

  /**
   * Record multiple prices in batch for efficiency
   */
  async recordPricesBatch(
    priceRecords: Array<{
      product: WalmartProduct;
      priceData: {
        currentPrice: number;
        salePrice?: number;
        wasPrice?: number;
        source: 'api' | 'scraper' | 'cache';
        confidenceScore?: number;
        storeLocation?: string;
        storeId?: string;
      };
    }>
  ): Promise<void> {
    try {
      const transaction = this?.db?.transaction(() => {
        for (const record of priceRecords) {
          this.recordPrice(record.product, record.priceData);
        }
      });

      transaction();
      
      logger.info("Batch price recording completed", "PRICE_HISTORY", {
        count: priceRecords?.length || 0
      });

    } catch (error) {
      logger.error("Failed to record price batch", "PRICE_HISTORY", { error });
      throw error;
    }
  }

  /**
   * Get latest price for a product
   */
  async getLatestPrice(productId: string): Promise<PriceRecord | null> {
    try {
      const stmt = this?.db?.prepare(`
        SELECT * FROM price_history_enhanced 
        WHERE product_id = ? OR walmart_id = ?
        ORDER BY recorded_at DESC 
        LIMIT 1
      `);

      const row = stmt.get(productId, productId) as any;
      
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        productId: row.product_id,
        walmartId: row.walmart_id,
        productName: row.product_name,
        category: row.category,
        brand: row.brand,
        currentPrice: row.current_price,
        salePrice: row.sale_price,
        wasPrice: row.was_price,
        originalPrice: row.original_price,
        storeLocation: row.store_location,
        storeId: row.store_id,
        source: row.source,
        confidenceScore: row.confidence_score,
        recordedAt: row.recorded_at,
        createdAt: row.created_at,
        isDealCandidate: row.is_deal_candidate === 1,
        priceChangePercentage: row.price_change_percentage,
        priceTrend: row.price_trend
      };

    } catch (error) {
      logger.error("Failed to get latest price", "PRICE_HISTORY", { error, productId });
      return null;
    }
  }

  /**
   * Get price history for a product within a date range
   */
  async getPriceHistory(
    productId: string, 
    days: number = 30,
    limit: number = 100
  ): Promise<PriceRecord[]> {
    try {
      const stmt = this?.db?.prepare(`
        SELECT * FROM price_history_enhanced 
        WHERE (product_id = ? OR walmart_id = ?)
        AND recorded_at >= datetime('now', '-${days} days')
        ORDER BY recorded_at DESC 
        LIMIT ?
      `);

      const rows = stmt.all(productId, productId, limit) as any[];
      
      return rows?.map(row => ({
        id: row.id,
        productId: row.product_id,
        walmartId: row.walmart_id,
        productName: row.product_name,
        category: row.category,
        brand: row.brand,
        currentPrice: row.current_price,
        salePrice: row.sale_price,
        wasPrice: row.was_price,
        originalPrice: row.original_price,
        storeLocation: row.store_location,
        storeId: row.store_id,
        source: row.source,
        confidenceScore: row.confidence_score,
        recordedAt: row.recorded_at,
        createdAt: row.created_at,
        isDealCandidate: row.is_deal_candidate === 1,
        priceChangePercentage: row.price_change_percentage,
        priceTrend: row.price_trend
      }));

    } catch (error) {
      logger.error("Failed to get price history", "PRICE_HISTORY", { error, productId });
      return [];
    }
  }

  /**
   * Get price statistics for a product
   */
  async getPriceStatistics(productId: string): Promise<PriceStatistics | null> {
    try {
      const stmt = this?.db?.prepare(`
        SELECT * FROM price_statistics 
        WHERE product_id = ?
      `);

      const row = stmt.get(productId) as any;
      
      if (!row) {
        return null;
      }

      return {
        productId: row.product_id,
        walmartId: row.walmart_id,
        productName: row.product_name,
        category: row.category,
        currentPrice: row.current_price,
        price7dAvg: row.price_7d_avg,
        price30dAvg: row.price_30d_avg,
        price60dAvg: row.price_60d_avg,
        price90dAvg: row.price_90d_avg,
        price7dMin: row.price_7d_min,
        price30dMin: row.price_30d_min,
        price60dMin: row.price_60d_min,
        price90dMin: row.price_90d_min,
        price7dMax: row.price_7d_max,
        price30dMax: row.price_30d_max,
        price60dMax: row.price_60d_max,
        price90dMax: row.price_90d_max,
        priceVolatility: row.price_volatility,
        priceTrendDirection: row.price_trend_direction,
        firstTrackedAt: row.first_tracked_at,
        lastUpdatedAt: row.last_updated_at,
        updateCount: row.update_count
      };

    } catch (error) {
      logger.error("Failed to get price statistics", "PRICE_HISTORY", { error, productId });
      return null;
    }
  }

  /**
   * Compare current price with historical averages
   */
  async comparePriceWithHistory(
    productId: string,
    periods: Array<'7d' | '30d' | '60d' | '90d'> = ['30d', '60d', '90d']
  ): Promise<PriceComparisonResult[]> {
    try {
      const stats = await this.getPriceStatistics(productId);
      if (!stats) {
        return [];
      }

      const results: PriceComparisonResult[] = [];

      for (const period of periods) {
        let comparisonPrice: number;
        
        switch (period) {
          case '7d':
            comparisonPrice = stats.price7dAvg || stats.currentPrice;
            break;
          case '30d':
            comparisonPrice = stats.price30dAvg || stats.currentPrice;
            break;
          case '60d':
            comparisonPrice = stats.price60dAvg || stats.currentPrice;
            break;
          case '90d':
            comparisonPrice = stats.price90dAvg || stats.currentPrice;
            break;
        }

        if (comparisonPrice > 0) {
          const priceChange = stats.currentPrice - comparisonPrice;
          const priceChangePercentage = (priceChange / comparisonPrice) * 100;
          
          const isSignificantDrop = priceChangePercentage <= -(this?.DEAL_THRESHOLDS?.moderate * 100);
          const isDealCandidate = Math.abs(priceChangePercentage) >= (this?.DEAL_THRESHOLDS?.moderate * 100);

          results.push({
            productId,
            currentPrice: stats.currentPrice,
            comparisonPrice,
            comparisonPeriod: period,
            priceChange,
            priceChangePercentage,
            isSignificantDrop,
            isDealCandidate,
            dealThresholds: {
              moderate: this?.DEAL_THRESHOLDS?.moderate * 100,
              good: this?.DEAL_THRESHOLDS?.good * 100,
              excellent: this?.DEAL_THRESHOLDS?.excellent * 100
            }
          });
        }
      }

      return results;

    } catch (error) {
      logger.error("Failed to compare price with history", "PRICE_HISTORY", { error, productId });
      return [];
    }
  }

  /**
   * Analyze price trends using statistical methods
   */
  async analyzePriceTrends(productId: string, days: number = 30): Promise<PriceTrendAnalysis | null> {
    try {
      const history = await this.getPriceHistory(productId, days);
      
      if (history?.length || 0 < 3) {
        return null; // Need at least 3 data points for analysis
      }

      const prices = history?.map(h => h.currentPrice);
      const priceHistory = history?.map(h => ({
        price: h.currentPrice,
        date: h.recordedAt,
        source: h.source
      }));

      const trendDirection = this.calculateTrendDirection(prices);
      const volatilityScore = this.calculateVolatility(prices);
      const predictedNextPrice = this.predictNextPrice(prices);
      const confidence = this.calculatePredictionConfidence(prices, volatilityScore);

      return {
        productId,
        trendDirection,
        volatilityScore,
        predictedNextPrice,
        confidence,
        priceHistory
      };

    } catch (error) {
      logger.error("Failed to analyze price trends", "PRICE_HISTORY", { error, productId });
      return null;
    }
  }

  /**
   * Find potential deal candidates based on significant price drops
   */
  async findDealCandidates(
    category?: string,
    minSavingsPercentage: number = 15,
    limit: number = 50
  ): Promise<PriceRecord[]> {
    try {
      let query = `
        SELECT * FROM price_history_enhanced 
        WHERE is_deal_candidate = 1 
        AND price_change_percentage <= ?
      `;
      const params: any[] = [-Math.abs(minSavingsPercentage)];

      if (category) {
        query += ` AND category = ?`;
        params.push(category);
      }

      query += ` ORDER BY price_change_percentage ASC, recorded_at DESC LIMIT ?`;
      params.push(limit);

      const stmt = this?.db?.prepare(query);
      const rows = stmt.all(...params) as any[];
      
      return rows?.map(row => ({
        id: row.id,
        productId: row.product_id,
        walmartId: row.walmart_id,
        productName: row.product_name,
        category: row.category,
        brand: row.brand,
        currentPrice: row.current_price,
        salePrice: row.sale_price,
        wasPrice: row.was_price,
        originalPrice: row.original_price,
        storeLocation: row.store_location,
        storeId: row.store_id,
        source: row.source,
        confidenceScore: row.confidence_score,
        recordedAt: row.recorded_at,
        createdAt: row.created_at,
        isDealCandidate: row.is_deal_candidate === 1,
        priceChangePercentage: row.price_change_percentage,
        priceTrend: row.price_trend
      }));

    } catch (error) {
      logger.error("Failed to find deal candidates", "PRICE_HISTORY", { error });
      return [];
    }
  }

  /**
   * Get products that haven't been updated recently (for refresh priority)
   */
  async getStaleProducts(hoursThreshold: number = 24, limit: number = 100): Promise<string[]> {
    try {
      const stmt = this?.db?.prepare(`
        SELECT DISTINCT product_id 
        FROM price_statistics 
        WHERE last_updated_at < datetime('now', '-${hoursThreshold} hours')
        ORDER BY last_updated_at ASC 
        LIMIT ?
      `);

      const rows = stmt.all(limit) as any[];
      return rows?.map(row => row.product_id);

    } catch (error) {
      logger.error("Failed to get stale products", "PRICE_HISTORY", { error });
      return [];
    }
  }

  /**
   * Update price statistics for a product (recalculate averages, min/max, etc.)
   */
  private async updatePriceStatistics(productId: string): Promise<void> {
    try {
      // Get recent price history for calculations
      const history7d = await this.getPriceHistory(productId, 7);
      const history30d = await this.getPriceHistory(productId, 30);
      const history60d = await this.getPriceHistory(productId, 60);
      const history90d = await this.getPriceHistory(productId, 90);

      if (history30d?.length || 0 === 0) return;

      const current = history30d[0];
      const prices30d = history30d?.map(h => h.currentPrice);
      const prices60d = history60d?.map(h => h.currentPrice);
      const prices90d = history90d?.map(h => h.currentPrice);

      // Calculate statistics
      const stats = {
        price7dAvg: history7d?.length || 0 > 0 ? this.calculateAverage(history7d?.map(h => h.currentPrice)) : null,
        price30dAvg: this.calculateAverage(prices30d),
        price60dAvg: history60d?.length || 0 > 0 ? this.calculateAverage(prices60d) : null,
        price90dAvg: history90d?.length || 0 > 0 ? this.calculateAverage(prices90d) : null,
        
        price7dMin: history7d?.length || 0 > 0 ? Math.min(...history7d?.map(h => h.currentPrice)) : null,
        price30dMin: Math.min(...prices30d),
        price60dMin: history60d?.length || 0 > 0 ? Math.min(...prices60d) : null,
        price90dMin: history90d?.length || 0 > 0 ? Math.min(...prices90d) : null,
        
        price7dMax: history7d?.length || 0 > 0 ? Math.max(...history7d?.map(h => h.currentPrice)) : null,
        price30dMax: Math.max(...prices30d),
        price60dMax: history60d?.length || 0 > 0 ? Math.max(...prices60d) : null,
        price90dMax: history90d?.length || 0 > 0 ? Math.max(...prices90d) : null,
        
        priceVolatility: this.calculateVolatility(prices30d),
        priceTrendDirection: this.calculateTrendDirection(prices30d)
      };

      // Update statistics table
      const updateStmt = this?.db?.prepare(`
        UPDATE price_statistics SET
          price_7d_avg = ?, price_30d_avg = ?, price_60d_avg = ?, price_90d_avg = ?,
          price_7d_min = ?, price_30d_min = ?, price_60d_min = ?, price_90d_min = ?,
          price_7d_max = ?, price_30d_max = ?, price_60d_max = ?, price_90d_max = ?,
          price_volatility = ?, price_trend_direction = ?,
          last_updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `);

      updateStmt.run(
        stats.price7dAvg, stats.price30dAvg, stats.price60dAvg, stats.price90dAvg,
        stats.price7dMin, stats.price30dMin, stats.price60dMin, stats.price90dMin,
        stats.price7dMax, stats.price30dMax, stats.price60dMax, stats.price90dMax,
        stats.priceVolatility, stats.priceTrendDirection,
        productId
      );

    } catch (error) {
      logger.warn("Failed to update price statistics", "PRICE_HISTORY", { error, productId });
    }
  }

  // Statistical helper methods

  private calculateAverage(prices: number[]): number {
    if (prices?.length || 0 === 0) return 0;
    return prices.reduce((sum: any, price: any) => sum + price, 0) / prices?.length || 0;
  }

  private calculateTrendDirection(prices: number[]): 'rising' | 'falling' | 'stable' | 'volatile' {
    if (prices?.length || 0 < 3) return 'stable';

    const firstHalf = prices.slice(0, Math.floor(prices?.length || 0 / 2));
    const secondHalf = prices.slice(Math.floor(prices?.length || 0 / 2));

    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);

    if (firstAvg === 0) return 'stable';

    const percentChange = Math.abs((secondAvg - firstAvg) / firstAvg) * 100;
    const direction = secondAvg > firstAvg ? 'rising' : 'falling';

    if (percentChange < 5) return 'stable';
    if (percentChange > 20) return 'volatile';
    return direction;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices?.length || 0 < 2) return 0;

    const mean = this.calculateAverage(prices);
    if (mean === 0) return 0;

    const variance = prices.reduce((sum: any, price: any) => sum + Math.pow(price - mean, 2), 0) / prices?.length || 0;
    const standardDeviation = Math.sqrt(variance);

    return standardDeviation / mean; // Coefficient of variation
  }

  private predictNextPrice(prices: number[]): number {
    if (prices?.length || 0 < 3) return prices[prices?.length || 0 - 1];

    // Simple linear regression for prediction
    const n = prices?.length || 0;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum: any, val: any) => sum + val, 0);
    const sumY = prices.reduce((sum: any, val: any) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * prices[i], 0);
    const sumXX = x.reduce((sum: any, val: any) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return Math.max(0, slope * n + intercept); // Predict next point, ensure non-negative
  }

  private calculatePredictionConfidence(prices: number[], volatility: number): number {
    // Lower volatility and more data points = higher confidence
    const baseConfidence = 0.7;
    const volatilityPenalty = Math.min(0.4, volatility * 2);
    const dataBonus = Math.min(0.2, prices?.length || 0 / 50); // More data = higher confidence
    
    return Math.max(0.3, Math.min(0.95, baseConfidence - volatilityPenalty + dataBonus));
  }

  /**
   * Clean up old price history data (keep recent data for performance)
   */
  async cleanupOldPriceHistory(daysToKeep: number = 180): Promise<number> {
    try {
      const stmt = this?.db?.prepare(`
        DELETE FROM price_history_enhanced 
        WHERE recorded_at < datetime('now', '-${daysToKeep} days')
        AND is_deal_candidate = 0
      `);

      const result = stmt.run();
      const deletedCount = result.changes || 0;

      if (deletedCount > 0) {
        logger.info("Cleaned up old price history", "PRICE_HISTORY", {
          deletedRecords: deletedCount,
          daysToKeep
        });
      }

      return deletedCount;

    } catch (error) {
      logger.error("Failed to cleanup old price history", "PRICE_HISTORY", { error });
      return 0;
    }
  }
}