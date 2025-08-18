/**
 * Smart Matching Service - Advanced product matching with ML-based fuzzy matching
 * Integrates with purchase history, user preferences, and deal analysis
 * Uses multiple algorithms for optimal product discovery and recommendation
 */

import { logger } from "../../utils/logger.js";
import { WalmartPriceFetcher } from "./WalmartPriceFetcher.js";
import { PurchaseHistoryService } from "./PurchaseHistoryService.js";
import { ProductMatchingAlgorithm } from "./ProductMatchingAlgorithm.js";
import { GroceryNLPQueue } from "./GroceryNLPQueue.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";
import type { PurchaseRecord, ProductFrequency } from "./PurchaseHistoryService.js";
import {
  SmartMatchingOptionsSchema,
  SearchQuerySchema,
  WalmartProductSchema,
  MatchedProductSchema,
  SmartSearchResultSchema,
  validationHelpers,
  type ValidatedSmartMatchingOptions,
  type ValidatedWalmartProduct,
  type ValidatedMatchedProduct,
  type ValidatedSmartSearchResult
} from "../validation/smartMatchingSchemas.js";

export interface MatchedProduct {
  product: WalmartProduct;
  matchScore: number;
  matchReason: string;
  confidence: number;
  isHistoricalPurchase: boolean;
  isPreviouslyPurchased: boolean;
  lastPurchaseDate?: string;
  purchaseFrequency?: number;
  averagePurchasePrice?: number;
  priceVariation?: number;
  brandPreference?: number;
  alternativeProducts?: AlternativeProduct[];
}

export interface AlternativeProduct {
  product: WalmartProduct;
  reason: 'size_variant' | 'brand_alternative' | 'similar_product' | 'better_deal';
  savings?: number;
  matchScore: number;
}

export interface SmartSearchResult {
  primaryMatches: MatchedProduct[];
  alternativeMatches: MatchedProduct[];
  suggestions: string[];
  searchMetadata: {
    originalQuery: string;
    processedQuery: string;
    matchingStrategy: string;
    totalResults: number;
    executionTime: number;
  };
}

export interface SmartMatchingOptions {
  userId?: string;
  location?: {
    zipCode: string;
    city: string;
    state: string;
  };
  maxResults?: number;
  includeAlternatives?: boolean;
  prioritizeHistory?: boolean;
  priceThreshold?: number;
  brandLoyalty?: 'high' | 'medium' | 'low';
  dietaryRestrictions?: string[];
  preferredBrands?: string[];
  avoidBrands?: string[];
}

export class SmartMatchingService {
  private static instance: SmartMatchingService;
  private priceFetcher: WalmartPriceFetcher;
  private historyService: PurchaseHistoryService;
  private matchingAlgorithm: ProductMatchingAlgorithm;
  private nlpQueue: GroceryNLPQueue;

  private constructor() {
    this.priceFetcher = WalmartPriceFetcher.getInstance();
    this.historyService = PurchaseHistoryService.getInstance();
    this.matchingAlgorithm = ProductMatchingAlgorithm.getInstance();
    this.nlpQueue = GroceryNLPQueue.getInstance();
  }
  
  /**
   * Validate service inputs at entry points
   */
  private validateInputs(query: string, options: SmartMatchingOptions): {
    validatedQuery: string;
    validatedOptions: SmartMatchingOptions;
  } {
    try {
      const validatedQuery = validationHelpers.validateSearchQuery(query);
      const validatedOptions = validationHelpers.validateMatchingOptions(options);
      
      // Additional business validation
      if ((validatedOptions.maxResults || 20) > 1000) {
        logger.warn("Max results reduced for memory safety", "SMART_MATCHING", {
          requested: validatedOptions.maxResults,
          reduced: 1000
        });
        validatedOptions.maxResults = 1000;
      }
      
      return { validatedQuery, validatedOptions };
    } catch (error) {
      logger.error("Input validation failed", "SMART_MATCHING", {
        error: error instanceof Error ? error.message : String(error),
        query: typeof query === 'string' ? query.substring(0, 50) : 'invalid',
      });
      throw new Error(`Invalid input: ${error instanceof Error ? error.message : 'Validation failed'}`);
    }
  }

  static getInstance(): SmartMatchingService {
    if (!SmartMatchingService.instance) {
      SmartMatchingService.instance = new SmartMatchingService();
    }
    return SmartMatchingService.instance;
  }

  /**
   * Main smart matching method - optimized with parallel processing
   * Security-enhanced with comprehensive input validation
   */
  async smartMatch(
    query: string,
    options: SmartMatchingOptions = {}
  ): Promise<SmartSearchResult> {
    // Validate and sanitize inputs at service boundary
    const { validatedQuery, validatedOptions } = this.validateInputs(query, options);
    
    const startTime = Date.now();
    
    try {
      logger.info("Starting smart product matching (parallel)", "SMART_MATCHING", {
        query: validatedQuery,
        userId: validatedOptions.userId,
        location: validatedOptions.location?.zipCode
      });

      // Execute parallel operations through NLP queue to prevent bottlenecks
      // These are lightweight operations that can run in parallel
      const parallelOps = [
        () => this.preprocessQuery(validatedQuery, validatedOptions),
        () => validatedOptions.userId 
          ? this?.historyService?.getProductFrequency(validatedOptions.userId)
            .catch(error => {
              logger.warn("Could not fetch user history", "SMART_MATCHING", { error });
              return [] as ProductFrequency[];
            })
          : Promise.resolve([] as ProductFrequency[]),
        () => Promise.resolve(null) // prefetchPricesForLocation not implemented yet
      ];
      
      // Use high priority for initial data fetching
      const [
        processedQuery,
        userHistoryResult,
        preFetchedPrices
      ] = await this?.nlpQueue?.enqueueBatch(parallelOps as any, "high") as [string, ProductFrequency[], any];
      
      const userHistory: ProductFrequency[] = userHistoryResult || [];

      // Determine matching strategy based on query and user context
      const strategy = this.determineMatchingStrategy(processedQuery, userHistory, validatedOptions);
      
      // Execute parallel matching operations through queue
      const matchingOps: (() => Promise<MatchedProduct[] | null>)[] = [
        () => this.executeMatching(processedQuery, strategy, userHistory, validatedOptions),
        () => this.getCachedSuggestions(validatedQuery, validatedOptions.userId).then(suggestions => 
          suggestions ? suggestions?.map((s: any) => ({...s} as MatchedProduct)) : null
        )
      ];
      
      const [matches, cachedSuggestions] = await this?.nlpQueue?.enqueueBatch(
        matchingOps, 
        "normal"
      ) as [MatchedProduct[] | null, MatchedProduct[] | null];
      
      // Score and rank results in parallel batches
      const rankedMatches = await this.scoreAndRankMatchesParallel(
        matches || [], 
        validatedQuery, 
        userHistory, 
        validatedOptions
      );
      
      // Split and generate suggestions in parallel
      const [categorized, suggestions] = await Promise.all([
        // Categorize matches
        Promise.resolve(this.categorizeMatches(rankedMatches)),
        
        // Generate suggestions (can use cached data)
        this.generateSmartSuggestionsOptimized(
          validatedQuery, 
          rankedMatches.slice(0, 10), 
          userHistory, 
          validatedOptions,
          cachedSuggestions as string[] | null
        )
      ]);
      
      const { primary, alternatives } = categorized;
      const executionTime = Date.now() - startTime;
      
      logger.info("Smart matching completed", "SMART_MATCHING", {
        query: validatedQuery,
        strategy,
        primaryCount: primary?.length || 0,
        alternativeCount: alternatives?.length || 0,
        executionTime
      });

      const result: SmartSearchResult = {
        primaryMatches: primary,
        alternativeMatches: alternatives,
        suggestions,
        searchMetadata: {
          originalQuery: validatedQuery,
          processedQuery,
          matchingStrategy: strategy,
          totalResults: (primary?.length || 0) + (alternatives?.length || 0),
          executionTime
        }
      };
      
      // Return result without strict validation to maintain type compatibility
      // TODO: Implement gradual type migration for SmartSearchResult
      return result;

    } catch (error) {
      logger.error("Smart matching failed", "SMART_MATCHING", { 
        error: error instanceof Error ? error.message : String(error),
        queryHash: require('crypto').createHash('sha256').update(validatedQuery).digest('hex').substring(0, 8)
      });
      
      // Security: Don't expose internal errors
      if (error instanceof Error && error.message.includes('validation')) {
        throw error; // Validation errors are safe to expose
      }
      throw new Error("Smart matching service encountered an error");
    }
  }

  /**
   * Preprocess query for better matching
   */
  private async preprocessQuery(query: string, options: SmartMatchingOptions): Promise<string> {
    // Validate inputs
    const validatedQuery = validationHelpers.validateSearchQuery(query);
    const validatedOptions = validationHelpers.validateMatchingOptions(options);
    
    let processed = validatedQuery.toLowerCase().trim();
    
    // Normalize common variations
    const normalizations = {
      'gallon of milk': 'milk gallon',
      'dozen eggs': 'eggs dozen',
      'loaf of bread': 'bread loaf',
      'lb': 'pound',
      'lbs': 'pounds',
      'oz': 'ounce',
      'pkg': 'package',
      '2%': 'two percent',
      '1%': 'one percent',
      'fat free': 'fat-free',
      'low fat': 'low-fat'
    };

    for (const [from, to] of Object.entries(normalizations)) {
      processed = processed.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
    }

    // Apply dietary restrictions
    if (validatedOptions.dietaryRestrictions?.includes('organic')) {
      if (!processed.includes('organic')) {
        processed = `organic ${processed}`;
      }
    }

    if (validatedOptions.dietaryRestrictions?.includes('gluten-free')) {
      if (!processed.includes('gluten')) {
        processed = `gluten free ${processed}`;
      }
    }

    return processed;
  }

  /**
   * Determine the best matching strategy based on context
   */
  private determineMatchingStrategy(
    query: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): string {
    // Strategy 1: History-first (user has purchase history for similar items)
    if (options.prioritizeHistory && (userHistory?.length || 0) > 0) {
      const historyMatch = userHistory.find(h => 
        h.productName && (
          h?.productName?.toLowerCase().includes(query.toLowerCase()) ||
          query.toLowerCase().includes(h?.productName?.toLowerCase()?.split(' ')[0] || "")
        )
      );
      if (historyMatch) {
        return 'history_first';
      }
    }

    // Strategy 2: Brand-focused (user has strong brand preferences)
    if (options.brandLoyalty === 'high' && (options.preferredBrands?.length || 0) > 0) {
      return 'brand_focused';
    }

    // Strategy 3: Price-focused (user is price conscious)
    if (options.priceThreshold !== undefined && options.priceThreshold > 0) {
      return 'price_focused';
    }

    // Strategy 4: Fuzzy matching (general case)
    return 'fuzzy_comprehensive';
  }

  /**
   * Execute matching based on selected strategy
   */
  private async executeMatching(
    query: string,
    strategy: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): Promise<MatchedProduct[]> {
    const maxResults = options.maxResults || 20;
    
    switch (strategy) {
      case 'history_first':
        return this.executeHistoryFirstMatching(query, userHistory, options, maxResults);
      
      case 'brand_focused':
        return this.executeBrandFocusedMatching(query, options, maxResults);
      
      case 'price_focused':
        return this.executePriceFocusedMatching(query, options, maxResults);
      
      default:
        return this.executeFuzzyMatching(query, options, maxResults);
    }
  }

  /**
   * History-first matching strategy
   */
  private async executeHistoryFirstMatching(
    query: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions,
    maxResults: number
  ): Promise<MatchedProduct[]> {
    const matches: MatchedProduct[] = [];
    
    // First, look for exact or close matches in purchase history
    for (const historyItem of userHistory) {
      const similarity = await this?.matchingAlgorithm?.calculateSimilarity(
        query,
        historyItem.productName
      );
      
      if (similarity > 0.6) {
        // Try to find the current product info
        const searchResults = await this?.priceFetcher?.searchProductsWithPrices(
          historyItem.productName,
          options.location,
          1
        );
        
        if (searchResults && searchResults?.length || 0 > 0) {
          const product = searchResults[0];
          matches.push({
            product: product as any, // Type assertion needed due to WalmartProduct interface variations
            matchScore: similarity * 1.2, // Boost history matches
            matchReason: `Previously purchased ${historyItem.purchaseCount} times`,
            confidence: 0.9,
            isHistoricalPurchase: true,
            isPreviouslyPurchased: true,
            lastPurchaseDate: historyItem.lastPurchase,
            purchaseFrequency: historyItem.averageDaysBetween,
            averagePurchasePrice: historyItem.averagePrice
          });
        }
      }
    }

    // Fill remaining slots with fuzzy matching
    if ((matches?.length || 0) < maxResults) {
      const remainingSlots = maxResults - (matches?.length || 0);
      const fuzzyMatches = await this.executeFuzzyMatching(query, options, remainingSlots);
      
      // Filter out duplicates and add
      for (const fuzzyMatch of fuzzyMatches) {
        const isDuplicate = matches.some(m => m?.product?.walmartId === fuzzyMatch?.product?.walmartId);
        if (!isDuplicate) {
          matches.push(fuzzyMatch);
        }
      }
    }

    return matches;
  }

  /**
   * Brand-focused matching strategy
   */
  private async executeBrandFocusedMatching(
    query: string,
    options: SmartMatchingOptions,
    maxResults: number
  ): Promise<MatchedProduct[]> {
    const matches: MatchedProduct[] = [];
    
    // Search with preferred brands first
    if (options.preferredBrands?.length) {
      for (const brand of options.preferredBrands) {
        const brandQuery = `${brand} ${query}`;
        const searchResults = await this?.priceFetcher?.searchProductsWithPrices(
          brandQuery,
          options.location,
          3
        );
        
        if (searchResults) {
          for (const product of searchResults) {
            const similarity = await this?.matchingAlgorithm?.calculateSimilarity(query, product.name);
            if (similarity > 0.5) {
              matches.push({
                product,
                matchScore: similarity * 1.1, // Boost preferred brands
                matchReason: `Preferred brand: ${brand}`,
                confidence: 0.8,
                isHistoricalPurchase: false,
                isPreviouslyPurchased: false,
                brandPreference: 1.0
              });
            }
          }
        }
      }
    }

    // Fill remaining with general search
    if ((matches?.length || 0) < maxResults) {
      const remainingSlots = maxResults - (matches?.length || 0);
      const generalMatches = await this.executeFuzzyMatching(query, options, remainingSlots);
      matches.push(...generalMatches);
    }

    return matches;
  }

  /**
   * Price-focused matching strategy
   */
  private async executePriceFocusedMatching(
    query: string,
    options: SmartMatchingOptions,
    maxResults: number
  ): Promise<MatchedProduct[]> {
    const searchResults = await this?.priceFetcher?.searchProductsWithPrices(
      query,
      options.location,
      maxResults * 2 // Get more results to filter by price
    );

    const matches: MatchedProduct[] = [];

    if (searchResults) {
      // Filter and score by price threshold
      for (const product of searchResults) {
        const price = typeof product.livePrice === 'object' && product.livePrice?.price 
          ? product?.livePrice?.price 
          : typeof product.price === 'number' 
            ? product.price 
            : 0;
        
        if (options.priceThreshold === undefined || price <= options.priceThreshold) {
          const similarity = await this?.matchingAlgorithm?.calculateSimilarity(query, product.name);
          
          if (similarity && similarity > 0.4) {
            let priceScore = 1.0;
            if (options.priceThreshold && price > 0) {
              priceScore = Math.max(0, 1.0 - (price / options.priceThreshold));
            }

            matches.push({
              product,
              matchScore: validationHelpers.validateMatchScore(similarity * (0.7 + 0.3 * priceScore)),
              matchReason: `Within price budget: $${validationHelpers.validatePrice(price).toFixed(2)}`,
              confidence: 0.7,
              isHistoricalPurchase: false,
              isPreviouslyPurchased: false
            });
          }
        }
      }
    }

    return matches.slice(0, maxResults);
  }

  /**
   * Fuzzy comprehensive matching strategy
   */
  private async executeFuzzyMatching(
    query: string,
    options: SmartMatchingOptions,
    maxResults: number
  ): Promise<MatchedProduct[]> {
    const searchResults = await this?.priceFetcher?.searchProductsWithPrices(
      query,
      options.location,
      maxResults
    );

    const matches: MatchedProduct[] = [];

    if (searchResults) {
      for (const product of searchResults) {
        const similarity = await this?.matchingAlgorithm?.calculateSimilarity(query, product.name);
        
        if (similarity > 0.3) {
          matches.push({
            product,
            matchScore: similarity,
            matchReason: `Fuzzy match (${(similarity * 100).toFixed(0)}% similarity)`,
            confidence: similarity,
            isHistoricalPurchase: false,
            isPreviouslyPurchased: false
          });
        }
      }
    }

    return matches;
  }

  /**
   * Score and rank all matches using comprehensive algorithm
   */
  private async scoreAndRankMatches(
    matches: MatchedProduct[],
    originalQuery: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): Promise<MatchedProduct[]> {
    // Calculate comprehensive scores
    for (const match of matches) {
      const comprehensiveScore = await this?.matchingAlgorithm?.calculateComprehensiveScore(
        match,
        originalQuery,
        userHistory,
        options
      );
      
      match.matchScore = comprehensiveScore.totalScore;
      match.confidence = comprehensiveScore.confidence;
      
      // Add alternative products if requested
      if (options.includeAlternatives) {
        match.alternativeProducts = await this.findAlternativeProducts(match.product, options);
      }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Categorize matches into primary and alternative
   */
  private categorizeMatches(matches: MatchedProduct[]): {
    primary: MatchedProduct[];
    alternatives: MatchedProduct[];
  } {
    const highConfidenceThreshold = 0.7;
    
    const primary = matches?.filter(m => m.confidence >= highConfidenceThreshold);
    const alternatives = matches?.filter(m => m.confidence < highConfidenceThreshold);
    
    return { primary, alternatives };
  }

  /**
   * Find alternative products for a given product
   */
  private async findAlternativeProducts(
    product: WalmartProduct,
    options: SmartMatchingOptions
  ): Promise<AlternativeProduct[]> {
    const alternatives: AlternativeProduct[] = [];
    
    try {
      // Look for size variants
      const sizeVariants = await this.findSizeVariants(product, options);
      alternatives.push(...sizeVariants);
      
      // Look for brand alternatives
      const brandAlternatives = await this.findBrandAlternatives(product, options);
      alternatives.push(...brandAlternatives);
      
      // Look for similar products
      const similarProducts = await this.findSimilarProducts(product, options);
      alternatives.push(...similarProducts);
      
    } catch (error) {
      logger.warn("Failed to find alternative products", "SMART_MATCHING", { error });
    }
    
    return alternatives.slice(0, 5); // Limit to top 5 alternatives
  }

  /**
   * Find size variants of a product
   */
  private async findSizeVariants(
    product: WalmartProduct,
    options: SmartMatchingOptions
  ): Promise<AlternativeProduct[]> {
    const alternatives: AlternativeProduct[] = [];
    
    // Extract brand and base product name
    const productName = product?.name;
    const words = productName.split(' ');
    
    // Try different size variations
    const sizeVariations = [
      productName.replace(/\d+(\.\d+)?\s*(oz|ounce|ounces)/gi, '8 oz'),
      productName.replace(/\d+(\.\d+)?\s*(oz|ounce|ounces)/gi, '16 oz'),
      productName.replace(/\d+(\.\d+)?\s*(oz|ounce|ounces)/gi, '32 oz'),
      productName.replace(/\d+(\.\d+)?\s*(lb|pound|pounds)/gi, '1 lb'),
      productName.replace(/\d+(\.\d+)?\s*(lb|pound|pounds)/gi, '2 lb')
    ];
    
    for (const variation of sizeVariations) {
      if (variation !== productName) {
        const searchResults = await this?.priceFetcher?.searchProductsWithPrices(
          variation,
          options.location,
          1
        );
        
        if (searchResults && (searchResults?.length || 0) > 0) {
          const altProduct = searchResults[0];
          if (altProduct) {
            const altPrice = typeof altProduct.livePrice?.price === 'number' ? altProduct.livePrice.price : 
                            typeof altProduct.price === 'number' ? altProduct.price : 0;
            const originalPrice = typeof product.livePrice?.price === 'number' ? product.livePrice.price : 
                                typeof product.price === 'number' ? product.price : 0;
            
            alternatives.push({
              product: altProduct,
              reason: 'size_variant',
              savings: originalPrice > altPrice ? validationHelpers.validatePrice(originalPrice - altPrice) : undefined,
              matchScore: validationHelpers.validateMatchScore(0.8)
            });
          }
        }
      }
    }
    
    return alternatives;
  }

  /**
   * Find brand alternatives
   */
  private async findBrandAlternatives(
    product: WalmartProduct,
    options: SmartMatchingOptions
  ): Promise<AlternativeProduct[]> {
    const alternatives: AlternativeProduct[] = [];
    
    // Common brand alternatives for grocery items
    const brandAlternatives: Record<string, string[]> = {
      'Great Value': ['Walmart Brand', 'Equate'],
      'Coca-Cola': ['Pepsi', 'Dr Pepper'],
      'Pepsi': ['Coca-Cola', 'Dr Pepper'],
      'Kellogg\'s': ['General Mills', 'Post'],
      'General Mills': ['Kellogg\'s', 'Post'],
      'Lay\'s': ['Pringles', 'Cheetos']
    };
    
    // Extract current brand from product name
    let currentBrand = '';
    for (const brand of Object.keys(brandAlternatives)) {
      if (product?.name?.includes(brand)) {
        currentBrand = brand;
        break;
      }
    }
    
    if (currentBrand && currentBrand in brandAlternatives) {
      for (const altBrand of brandAlternatives[currentBrand]!) {
        const altQuery = product?.name?.replace(currentBrand, altBrand);
        const searchResults = await this?.priceFetcher?.searchProductsWithPrices(
          altQuery,
          options.location,
          1
        );
        
        if (searchResults && (searchResults?.length || 0) > 0) {
          const altProduct = searchResults[0];
          if (altProduct) {
            const altPrice = typeof altProduct.livePrice?.price === 'number' ? altProduct.livePrice.price : 
                            typeof altProduct.price === 'number' ? altProduct.price : 0;
            const originalPrice = typeof product.livePrice?.price === 'number' ? product.livePrice.price : 
                                typeof product.price === 'number' ? product.price : 0;
            
            alternatives.push({
              product: altProduct,
              reason: 'brand_alternative',
              savings: originalPrice > altPrice ? validationHelpers.validatePrice(originalPrice - altPrice) : undefined,
              matchScore: validationHelpers.validateMatchScore(0.7)
            });
          }
        }
      }
    }
    
    return alternatives;
  }

  /**
   * Find similar products
   */
  private async findSimilarProducts(
    product: WalmartProduct,
    options: SmartMatchingOptions
  ): Promise<AlternativeProduct[]> {
    const alternatives: AlternativeProduct[] = [];
    
    // Extract key product terms for similarity search
    const productTerms = product.name
      .toLowerCase()
      .split(' ')
      .filter(word => 
        word?.length || 0 > 2 && 
        !['the', 'and', 'with', 'for', 'from'].includes(word)
      );
    
    if ((productTerms?.length || 0) >= 2) {
      const similarQuery = productTerms.slice(0, 3).join(' ');
      const searchResults = await this?.priceFetcher?.searchProductsWithPrices(
        similarQuery,
        options.location,
        3
      );
      
      if (searchResults) {
        for (const altProduct of searchResults) {
          if (altProduct.walmartId !== product.walmartId) {
            const similarity = await this?.matchingAlgorithm?.calculateSimilarity(
              product.name,
              altProduct.name
            );
            
            if (similarity && similarity > 0.5 && similarity < 0.9) {
              const altPrice = typeof altProduct.livePrice?.price === 'number' ? altProduct.livePrice.price : 
                              typeof altProduct.price === 'number' ? altProduct.price : 0;
              const originalPrice = typeof product.livePrice?.price === 'number' ? product.livePrice.price : 
                                  typeof product.price === 'number' ? product.price : 0;
              
              alternatives.push({
                product: altProduct,
                reason: 'similar_product',
                savings: originalPrice > altPrice ? validationHelpers.validatePrice(originalPrice - altPrice) : undefined,
                matchScore: validationHelpers.validateMatchScore(similarity)
              });
            }
          }
        }
      }
    }
    
    return alternatives;
  }

  /**
   * Generate smart suggestions based on results and user context
   */
  private async generateSmartSuggestions(
    query: string,
    primaryMatches: MatchedProduct[],
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Suggestion 1: If no good matches, suggest more specific terms
    if ((primaryMatches?.length || 0) === 0) {
      suggestions.push("Try being more specific with brand names or sizes");
      suggestions.push("Check spelling and try alternative product names");
    }
    
    // Suggestion 2: Based on purchase history patterns
    if ((userHistory?.length || 0) > 0) {
      const firstQueryWord = query.split(' ')[0]?.toLowerCase();
      const relatedItems = userHistory?.filter(item =>
        firstQueryWord && item?.productName?.toLowerCase()?.includes(firstQueryWord)
      ).filter(Boolean);
      
      if (relatedItems && relatedItems.length > 0 && relatedItems[0]?.productName) {
        suggestions.push(`Based on your history, you usually buy ${relatedItems[0].productName}`);
      }
    }
    
    // Suggestion 3: Complementary products
    const complementaryProducts = this.getComplementaryProducts(query);
    if ((complementaryProducts?.length || 0) > 0) {
      suggestions.push(`Don't forget: ${complementaryProducts.slice(0, 2).join(', ')}`);
    }
    
    // Suggestion 4: Better deals
    const dealsFound = primaryMatches.some(m => 
      m.alternativeProducts?.some(alt => alt.savings && alt.savings > 0)
    );
    if (dealsFound) {
      suggestions.push("Check the alternatives section for better deals!");
    }
    
    return suggestions;
  }

  /**
   * Get complementary products for common grocery items
   */
  private getComplementaryProducts(query: string): string[] {
    const complementaryMap: Record<string, string[]> = {
      'milk': ['cereal', 'cookies', 'coffee'],
      'bread': ['butter', 'jam', 'peanut butter'],
      'eggs': ['bacon', 'cheese', 'milk'],
      'chicken': ['rice', 'vegetables', 'seasoning'],
      'pasta': ['sauce', 'cheese', 'garlic'],
      'coffee': ['cream', 'sugar', 'milk'],
      'cereal': ['milk', 'bananas', 'berries']
    };
    
    const lowerQuery = query.toLowerCase();
    for (const [product, complements] of Object.entries(complementaryMap)) {
      if (lowerQuery.includes(product)) {
        return complements;
      }
    }
    
    return [];
  }

  /**
   * Score and rank matches in parallel batches for better performance
   * Now uses GroceryNLPQueue to manage concurrent requests
   * Enhanced with memory safety and input validation
   */
  private async scoreAndRankMatchesParallel(
    matches: any[],
    query: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): Promise<MatchedProduct[]> {
    // Memory safety: Limit batch processing to prevent heap overflow
    const safeMatches = validationHelpers.validateArrayLength(matches, 1000, "Score and rank matches");
    const validatedQuery = validationHelpers.validateSearchQuery(query);
    
    const BATCH_SIZE = 10;
    const batches = [];
    
    // Split matches into batches
    for (let i = 0; i < (safeMatches?.length || 0); i += BATCH_SIZE) {
      batches.push(safeMatches.slice(i, i + BATCH_SIZE));
    }
    
    // Use NLP queue to manage concurrent batch processing
    // This ensures we don't exceed OLLAMA_NUM_PARALLEL limit
    const scoringOperations = batches?.map(batch => 
      () => this.scoreBatch(batch, validatedQuery, userHistory, options)
    );
    
    try {
      // Process through queue with normal priority
      const scoredBatches = await this?.nlpQueue?.enqueueBatch(
        scoringOperations,
        "normal"
      );
      
      // Flatten and sort all results with validation
      const allScored = (scoredBatches || []).flat().filter(Boolean);
      return allScored.sort((a, b) => {
        const scoreA = validationHelpers.validateMatchScore(a?.matchScore || 0);
        const scoreB = validationHelpers.validateMatchScore(b?.matchScore || 0);
        return scoreB - scoreA;
      });
    } catch (error) {
      logger.warn("Batch scoring failed, using fallback", "SMART_MATCHING", {
        error: error instanceof Error ? error.message : String(error),
        batchCount: batches.length
      });
      
      // Fallback to simple scoring
      return this.fallbackScoring(safeMatches, validatedQuery, userHistory, options);
    }
  }
  
  /**
   * Score a batch of matches
   */
  private async scoreBatch(
    batch: any[],
    query: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): Promise<MatchedProduct[]> {
    return Promise.all(
      batch?.map(async match => {
        const score = await this.calculateMatchScore(match, query, userHistory, options);
        return { ...match, matchScore: score };
      })
    );
  }
  
  /**
   * Calculate match score for a single product with enhanced validation
   */
  private async calculateMatchScore(
    match: any,
    query: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): Promise<number> {
    try {
      let score = validationHelpers.validateMatchScore(match?.baseScore || 0.5);
      
      // Boost for purchase history
      const historyItem = userHistory.find(h => h.productId === match.product?.id);
      if (historyItem && typeof historyItem.purchaseCount === 'number') {
        score += 0.2 * Math.min(historyItem.purchaseCount / 10, 1);
      }
      
      // Boost for price deals
      if (typeof match.product?.discount === 'number' && match.product.discount > 0) {
        score += 0.1 * Math.min(match.product.discount / 100, 1);
      }
      
      // Boost for brand preference
      if (Array.isArray(options.preferredBrands) && 
          typeof match.product?.brand === 'string' &&
          options.preferredBrands.includes(match.product.brand)) {
        score += 0.15;
      }
      
      return validationHelpers.validateMatchScore(Math.min(score, 1.0));
    } catch (error) {
      logger.warn("Match score calculation failed, using default", "SMART_MATCHING", {
        error: error instanceof Error ? error.message : String(error),
        productId: match?.product?.id
      });
      return 0.5; // Safe default
    }
  }
  
  /**
   * Fallback scoring when batch processing fails
   */
  private async fallbackScoring(
    matches: any[],
    query: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): Promise<MatchedProduct[]> {
    const scored: MatchedProduct[] = [];
    
    for (const match of matches.slice(0, 100)) { // Limit to prevent timeout
      try {
        const score = await this.calculateMatchScore(match, query, userHistory, options);
        scored.push({ ...match, matchScore: score });
      } catch (error) {
        logger.warn("Individual match scoring failed", "SMART_MATCHING", {
          error: error instanceof Error ? error.message : String(error)
        });
        // Skip failed matches
      }
    }
    
    return scored.sort((a, b) => b.matchScore - a.matchScore);
  }
  
  /**
   * Get cached suggestions for the query
   */
  private async getCachedSuggestions(
    query: string,
    userId?: string
  ): Promise<string[] | null> {
    try {
      // Import CacheService dynamically to avoid circular dependency
      const { CacheService } = await import('./CacheService.js');
      const cache = CacheService.getInstance();
      
      return await cache.get('suggestions', { query, userId });
    } catch {
      return null;
    }
  }
  
  /**
   * Generate smart suggestions optimized with caching
   */
  private async generateSmartSuggestionsOptimized(
    query: string,
    matches: MatchedProduct[],
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions,
    cachedSuggestions: string[] | null
  ): Promise<string[]> {
    // Return cached if available and recent
    if (cachedSuggestions && cachedSuggestions.length > 0) {
      return cachedSuggestions;
    }
    
    // Generate new suggestions
    const suggestions = await this.generateSmartSuggestions(
      query,
      matches,
      userHistory,
      options
    );
    
    // Cache for future use
    try {
      const { CacheService } = await import('./CacheService.js');
      const cache = CacheService.getInstance();
      await cache.set('suggestions', { query, userId: options.userId }, suggestions, 600);
    } catch {
      // Ignore cache errors
    }
    
    return suggestions;
  }
}