/**
 * Product Matching Algorithm - Core ML-based matching algorithms
 * Implements fuzzy matching, semantic similarity, and scoring algorithms
 * Supports brand affinity, price sensitivity, and purchase pattern analysis
 */

import { logger } from "../../utils/logger.js";
import type { MatchedProduct, SmartMatchingOptions } from "./SmartMatchingService.js";
import type { ProductFrequency } from "./PurchaseHistoryService.js";

export interface SimilarityMetrics {
  lexicalSimilarity: number;
  semanticSimilarity: number;
  brandMatch: number;
  categoryMatch: number;
  sizeMatch: number;
  overallSimilarity: number;
}

export interface ComprehensiveScore {
  baseScore: number;
  historyBoost: number;
  brandBoost: number;
  priceBoost: number;
  freshnessBoost: number;
  availabilityBoost: number;
  totalScore: number;
  confidence: number;
  scoringBreakdown: Record<string, number>;
}

export interface ProductFeatures {
  brand?: string;
  category?: string;
  size?: string;
  unit?: string;
  keywords: string[];
  numericFeatures: Record<string, number>;
}

export class ProductMatchingAlgorithm {
  private static instance: ProductMatchingAlgorithm;
  private readonly COMMON_BRANDS = [
    'Great Value', 'Walmart', 'Equate', 'Marketside', 'Parent\'s Choice',
    'Coca-Cola', 'Pepsi', 'Dr Pepper', 'Sprite', 'Mountain Dew',
    'Kellogg\'s', 'General Mills', 'Post', 'Quaker', 'Nature Valley',
    'Lay\'s', 'Doritos', 'Cheetos', 'Pringles', 'Tostitos',
    'Tyson', 'Oscar Mayer', 'Hormel', 'Kraft', 'Campbell\'s'
  ];

  private readonly PRODUCT_CATEGORIES = [
    'dairy', 'meat', 'produce', 'bakery', 'frozen', 'pantry', 'beverages',
    'snacks', 'cereal', 'condiments', 'cleaning', 'personal care',
    'baby', 'pet', 'pharmacy', 'electronics', 'clothing'
  ];

  private readonly STOP_WORDS = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'among', 'a', 'an', 'as', 'are',
    'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can'
  ]);

  protected constructor() {}

  static getInstance(): ProductMatchingAlgorithm {
    if (!ProductMatchingAlgorithm.instance) {
      ProductMatchingAlgorithm.instance = new ProductMatchingAlgorithm();
    }
    return ProductMatchingAlgorithm.instance;
  }

  /**
   * Main similarity calculation method
   */
  async calculateSimilarity(query: string, productName: string): Promise<number> {
    try {
      const metrics = await this.calculateSimilarityMetrics(query, productName);
      return metrics.overallSimilarity;
    } catch (error) {
      logger.warn("Error calculating similarity", "MATCHING_ALGORITHM", { error });
      return 0;
    }
  }

  /**
   * Calculate comprehensive similarity metrics
   */
  async calculateSimilarityMetrics(query: string, productName: string): Promise<SimilarityMetrics> {
    const queryFeatures = this.extractFeatures(query);
    const productFeatures = this.extractFeatures(productName);

    // Calculate different types of similarity
    const lexicalSimilarity = this.calculateLexicalSimilarity(query, productName);
    const semanticSimilarity = this.calculateSemanticSimilarity(queryFeatures, productFeatures);
    const brandMatch = this.calculateBrandMatch(queryFeatures, productFeatures);
    const categoryMatch = this.calculateCategoryMatch(queryFeatures, productFeatures);
    const sizeMatch = this.calculateSizeMatch(queryFeatures, productFeatures);

    // Weighted combination
    const overallSimilarity = this.combineMetrics(
      lexicalSimilarity,
      semanticSimilarity,
      brandMatch,
      categoryMatch,
      sizeMatch
    );

    return {
      lexicalSimilarity,
      semanticSimilarity,
      brandMatch,
      categoryMatch,
      sizeMatch,
      overallSimilarity
    };
  }

  /**
   * Calculate comprehensive score for ranking
   */
  async calculateComprehensiveScore(
    match: MatchedProduct,
    originalQuery: string,
    userHistory: ProductFrequency[],
    options: SmartMatchingOptions
  ): Promise<ComprehensiveScore> {
    const baseScore = match.matchScore || 0;
    const scoringBreakdown: Record<string, number> = {
      baseMatch: baseScore
    };

    // History boost - reward products similar to user's purchase history
    const historyBoost = this.calculateHistoryBoost(match, userHistory);
    scoringBreakdown.historyBoost = historyBoost;

    // Brand boost - reward preferred brands
    const brandBoost = this.calculateBrandBoost(match, options);
    scoringBreakdown.brandBoost = brandBoost;

    // Price boost - reward products within price preferences
    const priceBoost = this.calculatePriceBoost(match, options, userHistory);
    scoringBreakdown.priceBoost = priceBoost;

    // Freshness boost - reward recently updated prices
    const freshnessBoost = this.calculateFreshnessBoost(match);
    scoringBreakdown.freshnessBoost = freshnessBoost;

    // Availability boost - reward in-stock items
    const availabilityBoost = this.calculateAvailabilityBoost(match);
    scoringBreakdown.availabilityBoost = availabilityBoost;

    // Dietary restriction penalties/boosts
    const dietaryAdjustment = this.calculateDietaryAdjustment(match, options);
    scoringBreakdown.dietaryAdjustment = dietaryAdjustment;

    // Calculate total score
    const totalScore = Math.max(0, Math.min(1, 
      baseScore + 
      historyBoost * 0.3 + 
      brandBoost * 0.2 + 
      priceBoost * 0.2 + 
      freshnessBoost * 0.1 + 
      availabilityBoost * 0.1 + 
      dietaryAdjustment * 0.1
    ));

    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(match, scoringBreakdown);

    return {
      baseScore,
      historyBoost,
      brandBoost,
      priceBoost,
      freshnessBoost,
      availabilityBoost,
      totalScore,
      confidence,
      scoringBreakdown
    };
  }

  /**
   * Extract features from product name or query
   */
  private extractFeatures(text: string): ProductFeatures {
    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/\s+/).filter(word => 
      word?.length || 0 > 1 && !this?.STOP_WORDS?.has(word)
    );

    // Extract brand
    let brand: string | undefined;
    for (const commonBrand of this.COMMON_BRANDS) {
      if (normalized.includes(commonBrand.toLowerCase())) {
        brand = commonBrand;
        break;
      }
    }

    // Extract category
    let category: string | undefined;
    for (const cat of this.PRODUCT_CATEGORIES) {
      if (normalized.includes(cat)) {
        category = cat;
        break;
      }
    }

    // Extract size information
    const sizeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|lb|lbs|pound|pounds|gal|gallon|gallons|ml|l|liter|liters|ct|count|pack)/i);
    let size: string | undefined;
    let unit: string | undefined;
    if (sizeMatch) {
      size = sizeMatch[1];
      unit = sizeMatch[2];
    }

    // Extract keywords (non-brand, non-size words)
    const keywords = words?.filter(word => {
      return !brand?.toLowerCase().includes(word) && 
             !sizeMatch?.[0].includes(word) &&
             word?.length || 0 > 2;
    });

    // Extract numeric features
    const numericFeatures: Record<string, number> = {};
    if (size) {
      numericFeatures.size = parseFloat(size);
    }
    numericFeatures.wordCount = words?.length || 0;
    numericFeatures.keywordCount = keywords?.length || 0;

    return {
      brand,
      category,
      size,
      unit,
      keywords,
      numericFeatures
    };
  }

  /**
   * Calculate lexical similarity using multiple algorithms
   */
  private calculateLexicalSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Exact match
    if (s1 === s2) return 1.0;

    // Jaccard similarity (word overlap)
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const jaccard = intersection.size / union.size;

    // Levenshtein distance similarity
    const levenshtein = this.calculateLevenshteinSimilarity(s1, s2);

    // N-gram similarity (character-level)
    const ngram = this.calculateNGramSimilarity(s1, s2, 2);

    // Substring containment
    const containment = this.calculateContainmentSimilarity(s1, s2);

    // Weighted combination
    return (jaccard * 0.4 + levenshtein * 0.3 + ngram * 0.2 + containment * 0.1);
  }

  /**
   * Calculate semantic similarity based on product features
   */
  private calculateSemanticSimilarity(features1: ProductFeatures, features2: ProductFeatures): number {
    let totalSimilarity = 0;
    let weightSum = 0;

    // Keyword similarity
    const keywordSim = this.calculateKeywordSimilarity(features1.keywords, features2.keywords);
    totalSimilarity += keywordSim * 0.5;
    weightSum += 0.5;

    // Category similarity
    if (features1.category && features2.category) {
      const categorySim = features1.category === features2.category ? 1.0 : 0.0;
      totalSimilarity += categorySim * 0.3;
      weightSum += 0.3;
    }

    // Size similarity (if both have size info)
    if (features1.size && features2.size && features1.unit === features2.unit) {
      const size1 = parseFloat(features1.size);
      const size2 = parseFloat(features2.size);
      const sizeDiff = Math.abs(size1 - size2);
      const maxSize = Math.max(size1, size2);
      const sizeSim = maxSize > 0 ? 1 - (sizeDiff / maxSize) : 1;
      totalSimilarity += sizeSim * 0.2;
      weightSum += 0.2;
    }

    return weightSum > 0 ? totalSimilarity / weightSum : 0;
  }

  /**
   * Calculate brand match score
   */
  private calculateBrandMatch(features1: ProductFeatures, features2: ProductFeatures): number {
    if (!features1.brand || !features2.brand) {
      return 0;
    }

    if (features1?.brand?.toLowerCase() === features2?.brand?.toLowerCase()) {
      return 1.0;
    }

    // Check for brand aliases or variants
    const brandAliases: Record<string, string[]> = {
      'Great Value': ['Walmart', 'GV'],
      'Equate': ['Walmart'],
      'Parent\'s Choice': ['Walmart']
    };

    for (const [mainBrand, aliases] of Object.entries(brandAliases)) {
      const brand1 = features1?.brand?.toLowerCase();
      const brand2 = features2?.brand?.toLowerCase();
      
      if ((brand1 === mainBrand.toLowerCase() && aliases.some(alias => brand2.includes(alias.toLowerCase()))) ||
          (brand2 === mainBrand.toLowerCase() && aliases.some(alias => brand1.includes(alias.toLowerCase())))) {
        return 0.8;
      }
    }

    return 0;
  }

  /**
   * Calculate category match score
   */
  private calculateCategoryMatch(features1: ProductFeatures, features2: ProductFeatures): number {
    if (!features1.category || !features2.category) {
      return 0;
    }

    if (features1.category === features2.category) {
      return 1.0;
    }

    // Related categories
    const relatedCategories: Record<string, string[]> = {
      'dairy': ['beverages'],
      'meat': ['frozen'],
      'produce': ['frozen'],
      'snacks': ['beverages'],
      'cereal': ['pantry'],
      'condiments': ['pantry']
    };

    const cat1 = features1?.category;
    const cat2 = features2?.category;

    if (relatedCategories[cat1]?.includes(cat2) || relatedCategories[cat2]?.includes(cat1)) {
      return 0.6;
    }

    return 0;
  }

  /**
   * Calculate size match score
   */
  protected calculateSizeMatch(features1: ProductFeatures, features2: ProductFeatures): number {
    const size1 = features1?.numericFeatures?.size;
    const size2 = features2?.numericFeatures?.size;

    if (size1 === undefined || size2 === undefined) {
      return 0;
    }

    if (features1.unit !== features2.unit) {
      return 0;
    }

    const sizeDiff = Math.abs(size1 - size2);
    const avgSize = (size1 + size2) / 2;
    
    if (avgSize === 0) return 1;
    
    const similarity = Math.max(0, 1 - (sizeDiff / avgSize));
    return similarity;
  }

  /**
   * Combine different similarity metrics with weights
   */
  private combineMetrics(
    lexical: number,
    semantic: number,
    brand: number,
    category: number,
    size: number
  ): number {
    // Dynamic weighting based on available information
    let totalWeight = 0;
    let weightedSum = 0;

    // Lexical similarity - always available, baseline weight
    weightedSum += lexical * 0.4;
    totalWeight += 0.4;

    // Semantic similarity - higher weight if available
    if (semantic > 0) {
      weightedSum += semantic * 0.3;
      totalWeight += 0.3;
    }

    // Brand match - high weight if exact match
    if (brand > 0) {
      weightedSum += brand * 0.2;
      totalWeight += 0.2;
    }

    // Category match - moderate weight
    if (category > 0) {
      weightedSum += category * 0.1;
      totalWeight += 0.1;
    }

    // Size match - moderate weight
    if (size > 0) {
      weightedSum += size * 0.1;
      totalWeight += 0.1;
    }

    // Normalize by actual weight used
    return totalWeight > 0 ? weightedSum / Math.max(totalWeight, 1.0) : lexical;
  }

  /**
   * Calculate history boost based on purchase patterns
   */
  private calculateHistoryBoost(match: MatchedProduct, userHistory: ProductFrequency[]): number {
    if (!match.isPreviouslyPurchased || userHistory?.length || 0 === 0) {
      return 0;
    }

    // Find the matching history item
    const historyItem = userHistory.find(h => 
      h.productName?.toLowerCase().includes(match?.product?.name?.toLowerCase().split(' ')[0] || '') ||
      match?.product?.name?.toLowerCase().includes(h.productName?.toLowerCase().split(' ')[0] || '')
    );

    if (!historyItem) {
      return 0;
    }

    // Calculate boost based on purchase frequency and recency
    let boost = 0;

    // Frequency boost (higher for frequently purchased items)
    const frequencyBoost = Math.min(0.3, historyItem.purchaseCount * 0.05);
    boost += frequencyBoost;

    // Recency boost (higher for recently purchased items)
    const lastPurchase = new Date(historyItem.lastPurchase);
    const daysSince = (Date.now() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 0.2 * Math.exp(-daysSince / 30)); // Exponential decay
    boost += recencyBoost;

    // Trend boost (higher for items with increasing purchase trend)
    if (historyItem.trend === 'increasing') {
      boost += 0.1;
    }

    return Math.min(0.5, boost); // Cap at 0.5
  }

  /**
   * Calculate brand boost based on preferences
   */
  private calculateBrandBoost(match: MatchedProduct, options: SmartMatchingOptions): number {
    const productBrand = this.extractFeatures(match?.product?.name).brand;
    
    if (!productBrand) {
      return 0;
    }

    // Preferred brands boost
    if (options.preferredBrands?.some(brand => 
      brand.toLowerCase() === productBrand.toLowerCase()
    )) {
      return 0.3;
    }

    // Avoided brands penalty
    if (options.avoidBrands?.some(brand => 
      brand.toLowerCase() === productBrand.toLowerCase()
    )) {
      return -0.3;
    }

    // Store brand boost for price-conscious users
    const storeBrands = ['Great Value', 'Walmart', 'Equate', 'Marketside'];
    if (storeBrands.some(brand => 
      brand.toLowerCase() === productBrand.toLowerCase()
    ) && options.brandLoyalty === 'low') {
      return 0.1;
    }

    return 0;
  }

  /**
   * Calculate price boost based on user's price sensitivity
   */
  private calculatePriceBoost(
    match: MatchedProduct,
    options: SmartMatchingOptions,
    userHistory: ProductFrequency[]
  ): number {
    const currentPrice = match?.product?.livePrice?.price || match?.product?.price || 0;
    
    if (currentPrice === 0) {
      return 0;
    }

    let boost = 0;

    // Price threshold boost
    if (options.priceThreshold && currentPrice <= options.priceThreshold) {
      const savings = (options.priceThreshold - currentPrice) / options.priceThreshold;
      boost += Math.min(0.2, savings);
    }

    // Historical price comparison
    if (match.averagePurchasePrice && match.averagePurchasePrice > 0) {
      const priceDiff = (match.averagePurchasePrice - currentPrice) / match.averagePurchasePrice;
      if (priceDiff > 0) {
        boost += Math.min(0.2, priceDiff); // Boost for better deals
      } else {
        boost += Math.max(-0.1, priceDiff * 0.5); // Small penalty for price increases
      }
    }

    // Sale price boost
    const salePrice = match?.product?.livePrice?.salePrice;
    const wasPrice = match?.product?.livePrice?.wasPrice;
    if (salePrice && wasPrice && salePrice < wasPrice) {
      const saleBoost = Math.min(0.15, (wasPrice - salePrice) / wasPrice);
      boost += saleBoost;
    }

    return boost;
  }

  /**
   * Calculate freshness boost based on price update recency
   */
  private calculateFreshnessBoost(match: MatchedProduct): number {
    const priceData = match?.product?.livePrice;
    if (!priceData?.lastUpdated) {
      return 0;
    }

    const hoursOld = (Date.now() - new Date(priceData.lastUpdated).getTime()) / (1000 * 60 * 60);
    
    // Fresh prices (< 1 hour) get full boost
    if (hoursOld < 1) return 0.1;
    
    // Recent prices (< 24 hours) get partial boost
    if (hoursOld < 24) return 0.05;
    
    // Old prices get no boost
    return 0;
  }

  /**
   * Calculate availability boost
   */
  private calculateAvailabilityBoost(match: MatchedProduct): number {
    const inStock = match?.product?.livePrice?.inStock ?? true;
    return inStock ? 0.1 : -0.2;
  }

  /**
   * Calculate dietary restriction adjustments
   */
  private calculateDietaryAdjustment(match: MatchedProduct, options: SmartMatchingOptions): number {
    if (!options.dietaryRestrictions?.length) {
      return 0;
    }

    const productName = match?.product?.name.toLowerCase();
    let adjustment = 0;

    for (const restriction of options.dietaryRestrictions) {
      switch (restriction.toLowerCase()) {
        case 'organic':
          if (productName.includes('organic')) {
            adjustment += 0.1;
          }
          break;
        
        case 'gluten-free':
        case 'gluten free':
          if (productName.includes('gluten free') || productName.includes('gluten-free')) {
            adjustment += 0.1;
          }
          break;
        
        case 'low-fat':
        case 'low fat':
          if (productName.includes('low fat') || productName.includes('low-fat') || productName.includes('reduced fat')) {
            adjustment += 0.1;
          }
          break;
        
        case 'sugar-free':
        case 'sugar free':
          if (productName.includes('sugar free') || productName.includes('sugar-free') || productName.includes('no sugar')) {
            adjustment += 0.1;
          }
          break;
      }
    }

    return Math.min(0.2, adjustment);
  }

  /**
   * Calculate confidence score based on data completeness
   */
  private calculateConfidence(match: MatchedProduct, breakdown: Record<string, number>): number {
    let confidence = match.confidence || 0.5;
    
    // Boost confidence if we have historical data
    if (match.isPreviouslyPurchased) {
      confidence += 0.2;
    }

    // Boost confidence if price data is fresh
    if (breakdown.freshnessBoost && breakdown.freshnessBoost > 0) {
      confidence += 0.1;
    }

    // Boost confidence if multiple scoring factors are present
    const activeFactors = Object.values(breakdown).filter(score => Math.abs(score) > 0.05).length;
    const factorBoost = Math.min(0.2, activeFactors * 0.05);
    confidence += factorBoost;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  // Helper methods for lexical similarity calculations

  private calculateLevenshteinSimilarity(s1: string, s2: string): number {
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1?.length || 0, s2?.length || 0);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  protected levenshteinDistance(s1: string, s2: string): number {
    const matrix = [];
    const n = s2?.length || 0;
    const m = s1?.length || 0;

    if (n === 0) return m;
    if (m === 0) return n;

    for (let i = 0; i <= n; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= m; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1]?.[j - 1] ?? 0;
        } else {
          matrix[i][j] = Math.min(
            (matrix[i - 1]?.[j - 1] ?? 0) + 1,
            (matrix[i]?.[j - 1] ?? 0) + 1,
            (matrix[i - 1]?.[j] ?? 0) + 1
          );
        }
      }
    }

    return matrix[n]?.[m] ?? 0;
  }

  private calculateNGramSimilarity(s1: string, s2: string, n: number): number {
    const ngrams1 = this.generateNGrams(s1, n);
    const ngrams2 = this.generateNGrams(s2, n);
    
    const set1 = new Set(ngrams1);
    const set2 = new Set(ngrams2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size === 0 ? 1 : intersection.size / union.size;
  }

  protected generateNGrams(text: string, n: number): string[] {
    const ngrams = [];
    for (let i = 0; i <= text?.length || 0 - n; i++) {
      ngrams.push(text.substring(i, i + n));
    }
    return ngrams;
  }

  private calculateContainmentSimilarity(s1: string, s2: string): number {
    if (s1?.length || 0 === 0 || s2?.length || 0 === 0) return 0;
    
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.8;
    }
    
    // Check for partial containment
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    
    let containedWords = 0;
    for (const word1 of words1) {
      if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
        containedWords++;
      }
    }
    
    return containedWords / Math.max(words1?.length || 0, words2?.length || 0);
  }

  private calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1?.length || 0 === 0 || keywords2?.length || 0 === 0) return 0;
    
    const set1 = new Set(keywords1?.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2?.map(k => k.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}