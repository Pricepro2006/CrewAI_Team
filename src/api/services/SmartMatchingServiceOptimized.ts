/**
 * Optimized Smart Matching Service Integration
 * 
 * Seamlessly integrates the optimized product matching algorithm
 * with the existing SmartMatchingService infrastructure
 */

import { SmartMatchingService, type SmartSearchResult, type SmartMatchingOptions, type MatchedProduct } from './SmartMatchingService.js';
import { OptimizedProductMatchingAlgorithm } from './OptimizedProductMatchingAlgorithm.js';
import { RedisCacheManager } from '../../core/cache/RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import type { WalmartProduct } from '../../types/walmart-grocery.js';

export class SmartMatchingServiceOptimized extends SmartMatchingService {
  private static optimizedInstance: SmartMatchingServiceOptimized;
  private optimizedAlgorithm: OptimizedProductMatchingAlgorithm;
  private cacheManager: RedisCacheManager;
  
  // Cache configuration
  private readonly SEARCH_CACHE_TTL = 1800; // 30 minutes
  private readonly MATCH_CACHE_TTL = 3600; // 1 hour
  private readonly PRODUCT_CACHE_TTL = 7200; // 2 hours
  
  constructor() {
    super();
    this.optimizedAlgorithm = OptimizedProductMatchingAlgorithm.getOptimizedInstance();
    this.cacheManager = RedisCacheManager.getInstance();
  }
  
  static getOptimizedInstance(): SmartMatchingServiceOptimized {
    if (!SmartMatchingServiceOptimized.optimizedInstance) {
      SmartMatchingServiceOptimized.optimizedInstance = new SmartMatchingServiceOptimized();
    }
    return SmartMatchingServiceOptimized.optimizedInstance;
  }
  
  /**
   * Enhanced smart matching with caching and optimization
   */
  async smartMatch(
    query: string,
    options: SmartMatchingOptions = {}
  ): Promise<SmartSearchResult> {
    const startTime = Date.now();
    
    // Generate cache key for the search
    const cacheKey = this.generateSearchCacheKey(query, options);
    
    // Check cache first
    try {
      const cachedResult = await this?.cacheManager?.get<SmartSearchResult>(
        `search:${cacheKey}`
      );
      
      if (cachedResult) {
        logger.info("Returning cached search result", "OPTIMIZED_MATCHING", {
          query,
          cacheKey,
          executionTime: Date.now() - startTime
        });
        
        // Update execution time in metadata
        cachedResult?.searchMetadata?.executionTime = Date.now() - startTime;
        return cachedResult;
      }
    } catch (error) {
      logger.warn("Cache retrieval error", "OPTIMIZED_MATCHING", { error });
    }
    
    // Perform optimized search
    const result = await this.performOptimizedSearch(query, options);
    
    // Cache the result
    try {
      await this?.cacheManager?.set(
        `search:${cacheKey}`,
        result,
        { ttl: this.SEARCH_CACHE_TTL }
      );
    } catch (error) {
      logger.warn("Failed to cache search result", "OPTIMIZED_MATCHING", { error });
    }
    
    // Update execution time
    result?.searchMetadata?.executionTime = Date.now() - startTime;
    
    // Log performance metrics
    const stats = this?.optimizedAlgorithm?.getPerformanceStats();
    logger.info("Optimized search completed", "OPTIMIZED_MATCHING", {
      query,
      totalResults: result?.searchMetadata?.totalResults,
      executionTime: result?.searchMetadata?.executionTime,
      cacheHitRate: stats.cacheHitRate,
      avgCalculationTime: stats.avgCalculationTime
    });
    
    return result;
  }
  
  /**
   * Perform optimized search with batch processing
   */
  private async performOptimizedSearch(
    query: string,
    options: SmartMatchingOptions
  ): Promise<SmartSearchResult> {
    const processedQuery = this.preprocessQuery(query);
    
    // Get products based on search strategy
    const products = await this.fetchProducts(processedQuery, options);
    
    if (!products || products.length === 0) {
      return this.createEmptyResult(query, processedQuery);
    }
    
    // Use batch processing for efficiency
    const productNames = products?.map(p => p.name);
    const batchResult = await this?.optimizedAlgorithm?.processBatch({
      queries: [processedQuery],
      products: productNames,
      options
    });
    
    // Get scores from batch result
    const scores = batchResult?.results?.get(processedQuery) || new Map();
    
    // Create matched products with scores
    const matchedProducts = await Promise.all(
      products?.map(async (product: any) => {
        const score = scores.get(product.name) || 0;
        return this.createMatchedProduct(product, score, processedQuery, options);
      })
    );
    
    // Sort by score
    matchedProducts.sort((a, b) => b.matchScore - a.matchScore);
    
    // Split into primary and alternative matches
    const threshold = 0.7;
    const primaryMatches = matchedProducts?.filter(m => m.matchScore >= threshold);
    const alternativeMatches = matchedProducts?.filter(
      m => m.matchScore < threshold && m.matchScore >= 0.5
    );
    
    // Generate suggestions based on top matches
    const suggestions = await this.generateSuggestions(
      processedQuery,
      primaryMatches,
      options
    );
    
    return {
      primaryMatches: primaryMatches.slice(0, options.maxResults || 10),
      alternativeMatches: alternativeMatches.slice(0, 5),
      suggestions,
      searchMetadata: {
        originalQuery: query,
        processedQuery,
        matchingStrategy: 'optimized_ml_batch',
        totalResults: matchedProducts?.length || 0,
        executionTime: 0 // Will be updated by caller
      }
    };
  }
  
  /**
   * Create matched product with optimized scoring
   */
  private async createMatchedProduct(
    product: WalmartProduct,
    matchScore: number,
    query: string,
    options: SmartMatchingOptions
  ): Promise<MatchedProduct> {
    // Get user history if available
    const userHistory = options.userId || "" 
      ? await this.getUserHistory(options.userId)
      : [];
    
    // Calculate comprehensive score
    const comprehensiveScore = await this?.optimizedAlgorithm?.calculateComprehensiveScore(
      {
        product,
        matchScore,
        matchReason: this.getMatchReason(matchScore),
        confidence: matchScore,
        isHistoricalPurchase: false,
        isPreviouslyPurchased: this.checkPreviousPurchase(product, userHistory)
      } as MatchedProduct,
      query,
      userHistory,
      options
    );
    
    return {
      product,
      matchScore: comprehensiveScore.totalScore,
      matchReason: this.getMatchReason(comprehensiveScore.totalScore),
      confidence: comprehensiveScore.confidence,
      isHistoricalPurchase: false,
      isPreviouslyPurchased: this.checkPreviousPurchase(product, userHistory),
      lastPurchaseDate: this.getLastPurchaseDate(product, userHistory),
      purchaseFrequency: this.getPurchaseFrequency(product, userHistory),
      averagePurchasePrice: this.getAveragePurchasePrice(product, userHistory),
      priceVariation: this.getPriceVariation(product, userHistory),
      brandPreference: comprehensiveScore?.scoringBreakdown?.brandBoost || 0
    };
  }
  
  /**
   * Preprocess query with spell correction and normalization
   */
  private preprocessQuery(query: string): string {
    // Basic preprocessing - the optimized algorithm handles spell correction
    return query.trim().toLowerCase();
  }
  
  /**
   * Fetch products with caching
   */
  private async fetchProducts(
    query: string,
    options: SmartMatchingOptions
  ): Promise<WalmartProduct[]> {
    const cacheKey = `products:${query}:${options.location?.zipCode || 'default'}`;
    
    // Check cache
    try {
      const cached = await this?.cacheManager?.get<WalmartProduct[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      logger.warn("Product cache error", "OPTIMIZED_MATCHING", { error });
    }
    
    // Fetch from API
    // This would normally call your product API
    // For now, returning empty array as placeholder
    const products: WalmartProduct[] = [];
    
    // Cache the results
    if (products && products.length > 0) {
      try {
        await this?.cacheManager?.set(cacheKey, products, {
          ttl: this.PRODUCT_CACHE_TTL
        });
      } catch (error) {
        logger.warn("Failed to cache products", "OPTIMIZED_MATCHING", { error });
      }
    }
    
    return products;
  }
  
  /**
   * Generate search suggestions
   */
  private async generateSuggestions(
    query: string,
    matches: MatchedProduct[],
    options: SmartMatchingOptions
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Extract common terms from top matches
    if (matches && matches.length > 0) {
      const topProducts = matches.slice(0, 3);
      const commonTerms = new Set<string>();
      
      for (const match of topProducts) {
        const words = match?.product?.name.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 3 && !query.includes(word)) {
            commonTerms.add(word);
          }
        });
      }
      
      // Create suggestions from common terms
      commonTerms.forEach(term => {
        suggestions.push(`${query} ${term}`);
      });
    }
    
    // Add category-based suggestions
    const categories = this.extractCategories(matches);
    categories.forEach(category => {
      if (!query.includes(category)) {
        suggestions.push(`${category} ${query}`);
      }
    });
    
    return suggestions.slice(0, 5);
  }
  
  /**
   * Extract categories from matched products
   */
  private extractCategories(matches: MatchedProduct[]): string[] {
    const categories = new Set<string>();
    
    for (const match of matches) {
      // Extract category from product metadata if available
      if ('category' in match.product) {
        categories.add((match.product as any).category);
      }
    }
    
    return Array.from(categories);
  }
  
  /**
   * Get user purchase history
   */
  private async getUserHistory(userId: string): Promise<any[]> {
    // This would fetch from your database
    // Placeholder implementation
    return [];
  }
  
  /**
   * Check if product was previously purchased
   */
  private checkPreviousPurchase(product: WalmartProduct, history: any[]): boolean {
    return history.some(h => 
      h.productName?.toLowerCase().includes(product?.name?.toLowerCase().split(' ')[0])
    );
  }
  
  /**
   * Get last purchase date
   */
  private getLastPurchaseDate(product: WalmartProduct, history: any[]): string | undefined {
    const purchase = history.find(h => 
      h.productName?.toLowerCase().includes(product?.name?.toLowerCase().split(' ')[0])
    );
    return purchase?.lastPurchase;
  }
  
  /**
   * Get purchase frequency
   */
  private getPurchaseFrequency(product: WalmartProduct, history: any[]): number | undefined {
    const purchase = history.find(h => 
      h.productName?.toLowerCase().includes(product?.name?.toLowerCase().split(' ')[0])
    );
    return purchase?.purchaseCount;
  }
  
  /**
   * Get average purchase price
   */
  private getAveragePurchasePrice(product: WalmartProduct, history: any[]): number | undefined {
    const purchase = history.find(h => 
      h.productName?.toLowerCase().includes(product?.name?.toLowerCase().split(' ')[0])
    );
    return purchase?.avgPrice;
  }
  
  /**
   * Get price variation
   */
  private getPriceVariation(product: WalmartProduct, history: any[]): number | undefined {
    const purchase = history.find(h => 
      h.productName?.toLowerCase().includes(product?.name?.toLowerCase().split(' ')[0])
    );
    if (!purchase?.avgPrice) return undefined;
    
    const currentPrice = product.livePrice?.price || product.price || 0;
    return Math.abs(currentPrice - purchase.avgPrice) / purchase.avgPrice;
  }
  
  /**
   * Get match reason based on score
   */
  private getMatchReason(score: number): string {
    if (score >= 0.95) return 'Exact Match';
    if (score >= 0.9) return 'Near Perfect Match';
    if (score >= 0.8) return 'Strong Match';
    if (score >= 0.7) return 'Good Match';
    if (score >= 0.6) return 'Moderate Match';
    if (score >= 0.5) return 'Partial Match';
    return 'Weak Match';
  }
  
  /**
   * Create empty result
   */
  private createEmptyResult(originalQuery: string, processedQuery: string): SmartSearchResult {
    return {
      primaryMatches: [],
      alternativeMatches: [],
      suggestions: [
        `Try searching for "${processedQuery.split(' ')[0]}"`,
        'Check spelling and try again',
        'Use fewer or different keywords'
      ],
      searchMetadata: {
        originalQuery,
        processedQuery,
        matchingStrategy: 'optimized_ml_batch',
        totalResults: 0,
        executionTime: 0
      }
    };
  }
  
  /**
   * Generate cache key for search
   */
  private generateSearchCacheKey(query: string, options: SmartMatchingOptions): string {
    const components = [
      query.toLowerCase(),
      options.userId || 'anonymous',
      options.location?.zipCode || 'default',
      options.maxResults || 10,
      options.brandLoyalty || 'medium',
      options.priceThreshold || 'none',
      (options.dietaryRestrictions || []).sort().join(','),
      (options.preferredBrands || []).sort().join(',')
    ];
    
    return Buffer.from(components.join('|')).toString('base64');
  }
  
  /**
   * Provide feedback for continuous learning
   */
  async provideFeedback(
    query: string,
    productName: string,
    score: number,
    feedback: 'positive' | 'negative' | 'neutral'
  ): Promise<void> {
    await this?.optimizedAlgorithm?.updateModelWithFeedback({
      query,
      productName,
      score,
      userFeedback: feedback,
      timestamp: new Date()
    });
    
    logger.info("Feedback recorded", "OPTIMIZED_MATCHING", {
      query,
      productName,
      feedback
    });
  }
  
  /**
   * Get service performance metrics
   */
  getPerformanceMetrics(): {
    algorithmStats: any;
    cacheStats: any;
  } {
    const algorithmStats = this?.optimizedAlgorithm?.getPerformanceStats();
    
    // Get cache stats from Redis manager
    const cacheStats = {
      searchCacheTTL: this.SEARCH_CACHE_TTL,
      matchCacheTTL: this.MATCH_CACHE_TTL,
      productCacheTTL: this.PRODUCT_CACHE_TTL
    };
    
    return {
      algorithmStats,
      cacheStats
    };
  }
  
  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    await this?.optimizedAlgorithm?.clearCaches();
    
    try {
      await this?.cacheManager?.clearNamespace('search');
      await this?.cacheManager?.clearNamespace('products');
    } catch (error) {
      logger.warn("Failed to clear Redis caches", "OPTIMIZED_MATCHING", { error });
    }
    
    logger.info("All caches cleared", "OPTIMIZED_MATCHING");
  }
  
  /**
   * Warm up caches with common queries
   */
  async warmUpCaches(commonQueries: string[]): Promise<void> {
    logger.info("Starting cache warm-up", "OPTIMIZED_MATCHING", {
      queryCount: commonQueries?.length || 0
    });
    
    const startTime = Date.now();
    
    // Process queries in batches
    const batchSize = 10;
    for (let i = 0; i < (commonQueries?.length || 0); i += batchSize) {
      const batch = commonQueries.slice(i, i + batchSize);
      
      await Promise.all(
        batch?.map(query => 
          this.smartMatch(query, { maxResults: 5 })
            .catch(error => {
              logger.warn("Cache warm-up error", "OPTIMIZED_MATCHING", {
                query,
                error
              });
            })
        )
      );
    }
    
    const executionTime = Date.now() - startTime;
    logger.info("Cache warm-up completed", "OPTIMIZED_MATCHING", {
      queryCount: commonQueries?.length || 0,
      executionTime,
      avgTimePerQuery: executionTime / (commonQueries?.length || 1)
    });
  }
}