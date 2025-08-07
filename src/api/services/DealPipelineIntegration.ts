/**
 * Deal Pipeline Integration Service
 * Integrates the new real-time deal detection pipeline with existing services
 */

import { logger } from "../../utils/logger.js";
import { DealRecommendationEngine } from "./DealRecommendationEngine.js";
import { WalmartPriceFetcher } from "./WalmartPriceFetcher.js";
import { PriceHistoryService } from "./PriceHistoryService.js";
import { DealDetectionEngine } from "./DealDetectionEngine.js";
import { DealPipelineService } from "./DealPipelineService.js";
import { DealWebSocketService } from "./DealWebSocketService.js";
import { DealPipelineMonitor } from "./DealPipelineMonitor.js";
import { PurchaseHistoryService } from "./PurchaseHistoryService.js";
import { PreferenceLearningService } from "./PreferenceLearningService.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";
import type { Deal } from "./DealRecommendationEngine.js";
import type { DetectedDeal } from "./DealDetectionEngine.js";
import type { ProductFrequency, PurchaseRecord } from "./PurchaseHistoryService.js";

export interface IntegratedDealResult {
  // Legacy deal format (DealRecommendationEngine)
  legacyDeal?: Deal;
  
  // New deal format (DealDetectionEngine)
  newDeal?: DetectedDeal;
  
  // Enhanced metadata
  userPersonalization?: {
    relevanceScore: number;
    userPurchaseHistory: ProductFrequency[];
    recommendedAction: 'buy_now' | 'add_to_watchlist' | 'wait_for_better_deal';
    nextPurchasePrediction?: string;
  };
  
  // Integration metadata
  source: 'legacy_engine' | 'new_pipeline' | 'hybrid';
  confidence: number;
  integrationVersion: string;
}

export interface UserDealPreferences {
  userId: string;
  preferredCategories: string[];
  maxPrice?: number;
  minSavingsPercentage: number;
  dealTypes: string[];
  notificationFrequency: 'immediate' | 'hourly' | 'daily';
  learningEnabled: boolean;
}

export class DealPipelineIntegration {
  private static instance: DealPipelineIntegration;
  
  // Service instances
  private legacyDealEngine: DealRecommendationEngine;
  private newDealEngine: DealDetectionEngine;
  private priceFetcher: WalmartPriceFetcher;
  private priceHistory: PriceHistoryService;
  private pipelineService: DealPipelineService;
  private webSocketService: DealWebSocketService;
  private monitor: DealPipelineMonitor;
  private purchaseHistory: PurchaseHistoryService;
  private preferenceLearning: PreferenceLearningService;
  
  // Integration state
  private isIntegrationActive = false;
  private migrationProgress = 0; // 0-100%
  private hybridMode = true; // Run both engines for comparison
  
  // Performance tracking
  private performanceStats = {
    legacyEngineDeals: 0,
    newPipelineDeals: 0,
    hybridDeals: 0,
    totalRequests: 0,
    avgResponseTime: 0,
    userSatisfactionScore: 0,
  };

  private constructor() {
    // Initialize service instances
    this.legacyDealEngine = DealRecommendationEngine.getInstance();
    this.newDealEngine = DealDetectionEngine.getInstance();
    this.priceFetcher = WalmartPriceFetcher.getInstance();
    this.priceHistory = PriceHistoryService.getInstance();
    this.pipelineService = DealPipelineService.getInstance();
    this.webSocketService = DealWebSocketService.getInstance();
    this.monitor = DealPipelineMonitor.getInstance();
    this.purchaseHistory = PurchaseHistoryService.getInstance();
    this.preferenceLearning = PreferenceLearningService.getInstance();
    
    this.setupEventHandlers();
  }

  static getInstance(): DealPipelineIntegration {
    if (!DealPipelineIntegration.instance) {
      DealPipelineIntegration.instance = new DealPipelineIntegration();
    }
    return DealPipelineIntegration.instance;
  }

  /**
   * Initialize the integration system
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing deal pipeline integration", "DEAL_INTEGRATION");
      
      // Start monitoring
      await this.monitor.startMonitoring();
      
      // Start the new pipeline
      await this.pipelineService.start();
      
      // Begin migration process
      await this.startMigrationProcess();
      
      this.isIntegrationActive = true;
      
      logger.info("Deal pipeline integration initialized", "DEAL_INTEGRATION", {
        hybridMode: this.hybridMode,
        migrationProgress: this.migrationProgress
      });
      
    } catch (error) {
      logger.error("Failed to initialize deal pipeline integration", "DEAL_INTEGRATION", { error });
      throw error;
    }
  }

  /**
   * Get integrated deals for a user
   */
  async getDealsForUser(
    userId: string,
    preferences: UserDealPreferences,
    limit: number = 20
  ): Promise<IntegratedDealResult[]> {
    const startTime = Date.now();
    
    try {
      this.performanceStats.totalRequests++;
      
      // Get user purchase history for personalization
      const userHistory = await this.purchaseHistory.getProductFrequency(userId);
      
      const results: IntegratedDealResult[] = [];
      
      if (this.hybridMode) {
        // Run both engines and combine results
        const [legacyDeals, newDeals] = await Promise.all([
          this.getLegacyDeals(userId, preferences, userHistory, Math.ceil(limit / 2)),
          this.getNewPipelineDeals(userId, preferences, userHistory, Math.ceil(limit / 2))
        ]);
        
        // Combine and deduplicate
        const combined = await this.combineAndRankDeals(legacyDeals, newDeals, userHistory);
        results.push(...combined.slice(0, limit));
        
        this.performanceStats.hybridDeals++;
        
      } else if (this.migrationProgress >= 100) {
        // Use new pipeline exclusively
        const newDeals = await this.getNewPipelineDeals(userId, preferences, userHistory, limit);
        results.push(...newDeals);
        
        this.performanceStats.newPipelineDeals++;
        
      } else {
        // Use legacy engine
        const legacyDeals = await this.getLegacyDeals(userId, preferences, userHistory, limit);
        results.push(...legacyDeals);
        
        this.performanceStats.legacyEngineDeals++;
      }
      
      // Apply user learning
      if (preferences.learningEnabled) {
        await this.applyUserLearning(userId, results);
      }
      
      // Update performance stats
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime);
      
      logger.info("Integrated deals retrieved", "DEAL_INTEGRATION", {
        userId,
        dealCount: results.length,
        responseTime,
        source: this.hybridMode ? 'hybrid' : this.migrationProgress >= 100 ? 'new_pipeline' : 'legacy'
      });
      
      return results;
      
    } catch (error) {
      logger.error("Failed to get integrated deals", "DEAL_INTEGRATION", { error, userId });
      throw error;
    }
  }

  /**
   * Process a new product price and detect deals using integrated approach
   */
  async processProductPrice(
    product: WalmartProduct,
    userId?: string
  ): Promise<IntegratedDealResult[]> {
    try {
      // Record price in history service
      await this.priceHistory.recordPrice(product, {
        currentPrice: product.livePrice?.price || product.price || 0,
        salePrice: product.livePrice?.salePrice,
        wasPrice: product.livePrice?.wasPrice,
        source: product.livePrice?.source || 'api',
        confidenceScore: 1.0,
        storeLocation: product.livePrice?.storeLocation
      });
      
      // Detect deals using new engine
      const newDeals = await this.newDealEngine.detectDeals(
        product.walmartId || product.id,
        product,
        {
          checkSeasonality: true,
          checkBulkOpportunities: true,
          minSavingsPercentage: 10
        }
      );
      
      const results: IntegratedDealResult[] = newDeals.map(deal => ({
        newDeal: deal,
        source: 'new_pipeline' as const,
        confidence: deal.confidenceScore,
        integrationVersion: '1.0.0'
      }));
      
      // If deals detected, add to pipeline queue for monitoring
      if (results.length > 0) {
        this.pipelineService.addProductToQueue(product.walmartId || product.id, 'high');
        
        // Notify via WebSocket
        for (const result of results) {
          if (result.newDeal) {
            this.webSocketService.broadcastDealNotification(result.newDeal);
          }
        }
      }
      
      return results;
      
    } catch (error) {
      logger.error("Failed to process product price", "DEAL_INTEGRATION", { error });
      return [];
    }
  }

  /**
   * Search for products with integrated deal detection
   */
  async searchProductsWithDeals(
    query: string,
    userId?: string,
    location?: { zipCode: string; city?: string; state?: string }
  ): Promise<Array<WalmartProduct & { integratedDeals: IntegratedDealResult[] }>> {
    try {
      // Search for products using price fetcher
      const products = await this.priceFetcher.searchProductsWithPrices(
        query,
        location || { zipCode: '29301', city: 'Spartanburg', state: 'SC' },
        10
      );
      
      const results = [];
      
      for (const product of products) {
        // Process each product for deals
        const deals = await this.processProductPrice(product, userId);
        
        results.push({
          ...product,
          integratedDeals: deals
        });
      }
      
      logger.info("Product search with deals completed", "DEAL_INTEGRATION", {
        query,
        productsFound: products.length,
        totalDeals: results.reduce((sum, p) => sum + p.integratedDeals.length, 0)
      });
      
      return results;
      
    } catch (error) {
      logger.error("Failed to search products with deals", "DEAL_INTEGRATION", { error, query });
      return [];
    }
  }

  /**
   * Get pipeline integration status
   */
  getIntegrationStatus(): {
    isActive: boolean;
    migrationProgress: number;
    hybridMode: boolean;
    performanceStats: typeof this.performanceStats;
    healthStatus: any;
  } {
    return {
      isActive: this.isIntegrationActive,
      migrationProgress: this.migrationProgress,
      hybridMode: this.hybridMode,
      performanceStats: { ...this.performanceStats },
      healthStatus: this.monitor.getHealthStatus()
    };
  }

  /**
   * Update migration progress and settings
   */
  async updateMigrationSettings(settings: {
    migrationProgress?: number;
    hybridMode?: boolean;
  }): Promise<void> {
    try {
      if (settings.migrationProgress !== undefined) {
        this.migrationProgress = Math.max(0, Math.min(100, settings.migrationProgress));
      }
      
      if (settings.hybridMode !== undefined) {
        this.hybridMode = settings.hybridMode;
      }
      
      logger.info("Migration settings updated", "DEAL_INTEGRATION", {
        migrationProgress: this.migrationProgress,
        hybridMode: this.hybridMode
      });
      
    } catch (error) {
      logger.error("Failed to update migration settings", "DEAL_INTEGRATION", { error });
      throw error;
    }
  }

  // Private methods

  private async getLegacyDeals(
    userId: string,
    preferences: UserDealPreferences,
    userHistory: ProductFrequency[],
    limit: number
  ): Promise<IntegratedDealResult[]> {
    try {
      const legacyDeals = await this.legacyDealEngine.discoverDeals({
        userId,
        categories: preferences.preferredCategories,
        maxDeals: limit,
        minSavings: 5, // Lower threshold for legacy
        minSavingsPercentage: Math.max(5, preferences.minSavingsPercentage - 5), // Be more permissive
        dealTypes: preferences.dealTypes as Deal['dealType'][],
        priceRange: preferences.maxPrice ? { min: 0, max: preferences.maxPrice } : undefined,
        includeAlternatives: true,
        personalized: true
      });
      
      return legacyDeals.map(deal => ({
        legacyDeal: deal,
        userPersonalization: {
          relevanceScore: this.calculateRelevanceScore(deal, userHistory),
          userPurchaseHistory: userHistory.filter(h => 
            h.productName.toLowerCase().includes(deal.product.name.toLowerCase().split(' ')[0])
          ),
          recommendedAction: this.getRecommendedAction(deal, userHistory),
        },
        source: 'legacy_engine' as const,
        confidence: deal.confidence,
        integrationVersion: '1.0.0'
      }));
      
    } catch (error) {
      logger.warn("Failed to get legacy deals", "DEAL_INTEGRATION", { error, userId });
      return [];
    }
  }

  private async getNewPipelineDeals(
    userId: string,
    preferences: UserDealPreferences,
    userHistory: ProductFrequency[],
    limit: number
  ): Promise<IntegratedDealResult[]> {
    try {
      // Get active deals from new detection engine
      const activeDeals = await this.newDealEngine.getActiveDeals({
        minSavingsPercentage: preferences.minSavingsPercentage,
        minDealScore: 0.3,
        limit
      });
      
      // Filter based on user preferences
      const filteredDeals = activeDeals.filter(deal => {
        // Category filter
        if (preferences.preferredCategories.length > 0 && deal.category) {
          const categoryMatch = preferences.preferredCategories.some(cat => 
            deal.category!.toLowerCase().includes(cat.toLowerCase())
          );
          if (!categoryMatch) return false;
        }
        
        // Price filter
        if (preferences.maxPrice && deal.currentPrice > preferences.maxPrice) {
          return false;
        }
        
        // Deal type filter
        if (preferences.dealTypes.length > 0) {
          if (!preferences.dealTypes.includes(deal.dealType)) return false;
        }
        
        return true;
      });
      
      return filteredDeals.map(deal => ({
        newDeal: deal,
        userPersonalization: {
          relevanceScore: this.calculateNewDealRelevance(deal, userHistory),
          userPurchaseHistory: userHistory.filter(h => 
            h.productName.toLowerCase().includes(deal.productName.toLowerCase().split(' ')[0])
          ),
          recommendedAction: this.getNewDealAction(deal, userHistory),
        },
        source: 'new_pipeline' as const,
        confidence: deal.confidenceScore,
        integrationVersion: '1.0.0'
      }));
      
    } catch (error) {
      logger.warn("Failed to get new pipeline deals", "DEAL_INTEGRATION", { error, userId });
      return [];
    }
  }

  private async combineAndRankDeals(
    legacyResults: IntegratedDealResult[],
    newResults: IntegratedDealResult[],
    userHistory: ProductFrequency[]
  ): Promise<IntegratedDealResult[]> {
    // Combine results
    const combined = [...legacyResults, ...newResults];
    
    // Remove duplicates based on product ID
    const seenProducts = new Set<string>();
    const deduplicated = combined.filter(result => {
      const productId = result.legacyDeal?.productId || result.newDeal?.productId || '';
      if (seenProducts.has(productId)) {
        return false;
      }
      seenProducts.add(productId);
      return true;
    });
    
    // Rank by combined score
    deduplicated.sort((a, b) => {
      const scoreA = this.calculateCombinedScore(a, userHistory);
      const scoreB = this.calculateCombinedScore(b, userHistory);
      return scoreB - scoreA;
    });
    
    return deduplicated;
  }

  private calculateCombinedScore(result: IntegratedDealResult, userHistory: ProductFrequency[]): number {
    let baseScore = 0;
    
    if (result.legacyDeal) {
      baseScore = result.legacyDeal.dealScore;
    } else if (result.newDeal) {
      baseScore = result.newDeal.dealScore;
    }
    
    // Boost score based on user personalization
    if (result.userPersonalization) {
      baseScore += result.userPersonalization.relevanceScore * 0.3;
    }
    
    // Boost score for new pipeline (during migration)
    if (result.source === 'new_pipeline') {
      baseScore += 0.1;
    }
    
    return baseScore;
  }

  private calculateRelevanceScore(deal: Deal, userHistory: ProductFrequency[]): number {
    // Check if user has purchased similar products
    const relevantHistory = userHistory.filter(h => 
      h.productName.toLowerCase().includes(deal.product.name.toLowerCase().split(' ')[0])
    );
    
    if (relevantHistory.length === 0) return 0.3; // Low relevance for new products
    
    // Higher score for frequently purchased items
    const avgFrequency = relevantHistory.reduce((sum, h) => sum + h.purchaseCount, 0) / relevantHistory.length;
    return Math.min(1.0, 0.5 + (avgFrequency / 10)); // Scale based on frequency
  }

  private calculateNewDealRelevance(deal: DetectedDeal, userHistory: ProductFrequency[]): number {
    const relevantHistory = userHistory.filter(h => 
      h.productName.toLowerCase().includes(deal.productName.toLowerCase().split(' ')[0])
    );
    
    if (relevantHistory.length === 0) return 0.3;
    
    const avgFrequency = relevantHistory.reduce((sum, h) => sum + h.purchaseCount, 0) / relevantHistory.length;
    return Math.min(1.0, 0.5 + (avgFrequency / 10));
  }

  private getRecommendedAction(deal: Deal, userHistory: ProductFrequency[]): 'buy_now' | 'add_to_watchlist' | 'wait_for_better_deal' {
    if (deal.dealScore >= 0.8) return 'buy_now';
    if (deal.dealScore >= 0.6) return 'add_to_watchlist';
    return 'wait_for_better_deal';
  }

  private getNewDealAction(deal: DetectedDeal, userHistory: ProductFrequency[]): 'buy_now' | 'add_to_watchlist' | 'wait_for_better_deal' {
    if (deal.dealScore >= 0.8 && deal.urgencyScore >= 0.7) return 'buy_now';
    if (deal.dealScore >= 0.6) return 'add_to_watchlist';
    return 'wait_for_better_deal';
  }

  private async applyUserLearning(userId: string, results: IntegratedDealResult[]): Promise<void> {
    try {
      // Update user preferences based on deal interactions
      const preferences = await this.preferenceLearning.updateUserPreferences(userId, {
        viewedDeals: results.map(r => ({
          productId: r.legacyDeal?.productId || r.newDeal?.productId || '',
          category: r.legacyDeal?.product?.category?.name || r.newDeal?.category || '',
          dealType: r.legacyDeal?.dealType || r.newDeal?.dealType || 'price_drop',
          savingsPercentage: r.legacyDeal?.savingsPercentage || r.newDeal?.savingsPercentage || 0,
        }))
      });
      
      logger.debug("Applied user learning", "DEAL_INTEGRATION", { userId, preferences });
      
    } catch (error) {
      logger.warn("Failed to apply user learning", "DEAL_INTEGRATION", { error, userId });
    }
  }

  private async startMigrationProcess(): Promise<void> {
    // Start with hybrid mode to compare performance
    this.hybridMode = true;
    this.migrationProgress = 25; // 25% - hybrid mode enabled
    
    // Monitor performance for gradual migration
    setTimeout(() => {
      this.migrationProgress = 50; // 50% - collecting comparison data
    }, 24 * 60 * 60 * 1000); // After 1 day
    
    setTimeout(() => {
      this.migrationProgress = 75; // 75% - favoring new pipeline
    }, 7 * 24 * 60 * 60 * 1000); // After 1 week
    
    // Full migration after 2 weeks if performance is good
    setTimeout(async () => {
      const healthStatus = this.monitor.getHealthStatus();
      if (healthStatus.overall === 'healthy') {
        this.migrationProgress = 100; // 100% - full migration
        this.hybridMode = false;
        logger.info("Migration completed - using new pipeline exclusively", "DEAL_INTEGRATION");
      }
    }, 14 * 24 * 60 * 60 * 1000); // After 2 weeks
    
    logger.info("Migration process started", "DEAL_INTEGRATION", {
      initialProgress: this.migrationProgress,
      hybridMode: this.hybridMode
    });
  }

  private setupEventHandlers(): void {
    // Listen for new deals from the pipeline
    this.pipelineService.on('deal_detected', (deal: DetectedDeal) => {
      logger.debug("New deal detected from pipeline", "DEAL_INTEGRATION", {
        dealId: deal.id,
        productName: deal.productName,
        savings: deal.savingsPercentage
      });
    });
    
    // Listen for price updates
    this.pipelineService.on('price_updated', (data: { productId: string; price: number }) => {
      // Add to monitoring queue for deal detection
      this.pipelineService.addProductToQueue(data.productId, 'normal');
    });
    
    // Listen for pipeline health changes
    this.monitor.on('alert_created', (data: { alertId: string; alert: any }) => {
      if (data.alert.type === 'error') {
        // If new pipeline has errors, fall back to legacy temporarily
        this.hybridMode = true;
        logger.warn("Pipeline error detected, enabling hybrid mode", "DEAL_INTEGRATION", {
          alertId: data.alertId
        });
      }
    });
  }

  private updatePerformanceStats(responseTime: number): void {
    // Update rolling average response time
    this.performanceStats.avgResponseTime = 
      (this.performanceStats.avgResponseTime * 0.9) + (responseTime * 0.1);
  }
}