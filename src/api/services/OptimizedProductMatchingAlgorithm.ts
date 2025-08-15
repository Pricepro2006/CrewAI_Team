/**
 * Optimized Product Matching Algorithm - High-performance ML-based matching
 * 
 * Performance optimizations:
 * - Multi-layer caching (Redis + LRU)
 * - Memoization for expensive calculations
 * - Batch processing capabilities
 * - Indexed searches with pre-computed features
 * - ML model for adaptive scoring
 * - Feedback loop for continuous improvement
 */

import { LRUCache } from 'lru-cache';
import { logger } from "../../utils/logger.js";
import { RedisCacheManager } from "../../core/cache/RedisCacheManager.js";
import { ProductMatchingAlgorithm } from "./ProductMatchingAlgorithm.js";
import type { SimilarityMetrics, ComprehensiveScore, ProductFeatures } from "./ProductMatchingAlgorithm.js";
import type { MatchedProduct, SmartMatchingOptions } from "./SmartMatchingService.js";
import type { ProductFrequency } from "./PurchaseHistoryService.js";
import crypto from 'crypto';

// ML model configuration for adaptive scoring
interface MLScoringModel {
  weights: {
    lexical: number;
    semantic: number;
    brand: number;
    category: number;
    size: number;
    history: number;
    price: number;
  };
  bias: number;
  learningRate: number;
}

// Feedback data for continuous learning
interface FeedbackData {
  query: string;
  productName: string;
  score: number;
  userFeedback: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
}

// Pre-computed features for fast lookups
interface PrecomputedFeatures {
  productId: string;
  features: ProductFeatures;
  embedding?: number[]; // For semantic similarity
  phonetic?: string; // For fuzzy matching
  ngrams?: Set<string>; // Pre-computed n-grams
  tokens?: Set<string>; // Tokenized words
}

// Batch processing request
interface BatchMatchRequest {
  queries: string[];
  products: string[];
  options?: SmartMatchingOptions;
}

// Batch processing result
interface BatchMatchResult {
  results: Map<string, Map<string, number>>; // query -> product -> score
  executionTime: number;
  cacheHitRate: number;
}

export class OptimizedProductMatchingAlgorithm extends ProductMatchingAlgorithm {
  private static optimizedInstance: OptimizedProductMatchingAlgorithm;
  private cacheManager: RedisCacheManager;
  
  // Multi-layer caching
  private similarityCache: LRUCache<string, number>;
  private featureCache: LRUCache<string, ProductFeatures>;
  private scoreCache: LRUCache<string, ComprehensiveScore>;
  private precomputedFeatures: Map<string, PrecomputedFeatures>;
  
  // Memoization maps
  private levenshteinMemo: Map<string, number>;
  private ngramMemo: Map<string, string[]>;
  private phoneticMemo: Map<string, string>;
  
  // ML model for adaptive scoring
  private mlModel: MLScoringModel;
  private feedbackHistory: FeedbackData[];
  
  // Performance metrics
  private performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    avgCalculationTime: 0,
    totalCalculations: 0,
  };

  // Spell correction dictionary
  private spellCorrections: Map<string, string>;
  private commonMisspellings: Map<string, string[]>;
  
  // Brand and category synonyms
  private brandSynonyms: Map<string, Set<string>>;
  private categorySynonyms: Map<string, Set<string>>;

  private constructor() {
    super();
    
    // Initialize cache manager
    this.cacheManager = RedisCacheManager.getInstance();
    
    // Initialize LRU caches with optimal sizes
    this.similarityCache = new LRUCache<string, number>({
      max: 10000, // Store 10k most recent similarity calculations
      ttl: 1000 * 60 * 60, // 1 hour TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
    
    this.featureCache = new LRUCache<string, ProductFeatures>({
      max: 5000,
      ttl: 1000 * 60 * 60 * 24, // 24 hour TTL for features
    });
    
    this.scoreCache = new LRUCache<string, ComprehensiveScore>({
      max: 5000,
      ttl: 1000 * 60 * 30, // 30 minute TTL for scores
    });
    
    // Initialize memoization maps
    this.levenshteinMemo = new Map();
    this.ngramMemo = new Map();
    this.phoneticMemo = new Map();
    this.precomputedFeatures = new Map();
    
    // Initialize ML model with default weights
    this.mlModel = {
      weights: {
        lexical: 0.35,
        semantic: 0.25,
        brand: 0.15,
        category: 0.10,
        size: 0.05,
        history: 0.15,
        price: 0.10,
      },
      bias: 0.1,
      learningRate: 0.01,
    };
    
    this.feedbackHistory = [];
    
    // Initialize spell correction and synonym maps
    this.initializeSpellCorrection();
    this.initializeSynonyms();
    
    // Start background tasks
    this.startCacheWarming();
    this.startModelTraining();
  }

  static getOptimizedInstance(): OptimizedProductMatchingAlgorithm {
    if (!OptimizedProductMatchingAlgorithm.optimizedInstance) {
      OptimizedProductMatchingAlgorithm.optimizedInstance = new OptimizedProductMatchingAlgorithm();
    }
    return OptimizedProductMatchingAlgorithm.optimizedInstance;
  }

  /**
   * Enhanced similarity calculation with caching
   */
  async calculateSimilarity(query: string, productName: string): Promise<number> {
    const startTime = Date.now();
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(query, productName);
    
    // Check LRU cache first
    const cachedScore = this?.similarityCache?.get(cacheKey);
    if (cachedScore !== undefined) {
      this?.performanceMetrics?.cacheHits++;
      return cachedScore;
    }
    
    // Check Redis cache
    try {
      const redisScore = await this?.cacheManager?.get<number>(`similarity:${cacheKey}`);
      if (redisScore !== null) {
        this?.similarityCache?.set(cacheKey, redisScore);
        this?.performanceMetrics?.cacheHits++;
        return redisScore;
      }
    } catch (error) {
      logger.warn("Redis cache error", "OPTIMIZED_MATCHING", { error });
    }
    
    this?.performanceMetrics?.cacheMisses++;
    
    // Apply spell correction
    const correctedQuery = this.applySpellCorrection(query);
    
    // Calculate similarity with optimizations
    const metrics = await this.calculateOptimizedSimilarityMetrics(correctedQuery, productName);
    const score = metrics?.overallSimilarity;
    
    // Store in both caches
    this?.similarityCache?.set(cacheKey, score);
    try {
      await this?.cacheManager?.set(`similarity:${cacheKey}`, score, { ttl: 3600 });
    } catch (error) {
      logger.warn("Failed to cache similarity in Redis", "OPTIMIZED_MATCHING", { error });
    }
    
    // Update performance metrics
    const executionTime = Date.now() - startTime;
    this.updatePerformanceMetrics(executionTime);
    
    return score;
  }

  /**
   * Optimized similarity metrics calculation
   */
  private async calculateOptimizedSimilarityMetrics(
    query: string,
    productName: string
  ): Promise<SimilarityMetrics> {
    // Get pre-computed features if available
    const queryFeatures = await this.getOptimizedFeatures(query);
    const productFeatures = await this.getOptimizedFeatures(productName);
    
    // Parallel calculation of all metrics
    const [
      lexicalSimilarity,
      semanticSimilarity,
      brandMatch,
      categoryMatch,
      sizeMatch,
    ] = await Promise.all([
      this.calculateOptimizedLexicalSimilarity(query, productName),
      this.calculateOptimizedSemanticSimilarity(queryFeatures, productFeatures),
      this.calculateOptimizedBrandMatch(queryFeatures, productFeatures),
      this.calculateOptimizedCategoryMatch(queryFeatures, productFeatures),
      this.calculateSizeMatch(queryFeatures, productFeatures),
    ]);
    
    // Use ML model for weighted combination
    const overallSimilarity = this.calculateMLWeightedScore({
      lexicalSimilarity,
      semanticSimilarity,
      brandMatch,
      categoryMatch,
      sizeMatch,
    });
    
    return {
      lexicalSimilarity,
      semanticSimilarity,
      brandMatch,
      categoryMatch,
      sizeMatch,
      overallSimilarity,
    };
  }

  /**
   * Get optimized features with caching
   */
  private async getOptimizedFeatures(text: string): Promise<ProductFeatures> {
    const cacheKey = `features:${text}`;
    
    // Check LRU cache
    const cached = this?.featureCache?.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Check pre-computed features
    const precomputed = this?.precomputedFeatures?.get(text);
    if (precomputed) {
      return precomputed.features;
    }
    
    // Extract features with optimizations
    const features = this.extractOptimizedFeatures(text);
    
    // Cache the result
    this?.featureCache?.set(cacheKey, features);
    
    return features;
  }

  /**
   * Enhanced feature extraction with better parsing
   */
  private extractOptimizedFeatures(text: string): ProductFeatures {
    const normalized = text.toLowerCase().trim();
    
    // Apply phonetic encoding for fuzzy matching
    const phonetic = this.getPhoneticEncoding(normalized);
    
    // Enhanced tokenization
    const tokens = this.tokenizeAdvanced(normalized);
    
    // Extract brand with synonyms
    const brand = this.extractBrandWithSynonyms(normalized, tokens);
    
    // Extract category with synonyms
    const category = this.extractCategoryWithSynonyms(normalized, tokens);
    
    // Enhanced size extraction with unit conversion
    const { size, unit } = this.extractSizeWithConversion(normalized);
    
    // Extract keywords with stemming
    const keywords = this.extractKeywordsWithStemming(tokens, brand, size);
    
    // Extract numeric features
    const numericFeatures = this.extractNumericFeatures(normalized, tokens, size);
    
    return {
      brand,
      category,
      size,
      unit,
      keywords,
      numericFeatures,
    };
  }

  /**
   * Optimized lexical similarity with memoization
   */
  private async calculateOptimizedLexicalSimilarity(str1: string, str2: string): Promise<number> {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1.0;
    
    const memoKey = `${s1}|${s2}`;
    const reversed = `${s2}|${s1}`;
    
    // Check memoization
    if (this?.levenshteinMemo?.has(memoKey)) {
      return this?.levenshteinMemo?.get(memoKey)!;
    }
    if (this?.levenshteinMemo?.has(reversed)) {
      return this?.levenshteinMemo?.get(reversed)!;
    }
    
    // Use pre-computed n-grams for faster comparison
    const ngrams1 = this.getCachedNGrams(s1, 2);
    const ngrams2 = this.getCachedNGrams(s2, 2);
    
    // Fast Jaccard similarity with sets
    const set1 = new Set(ngrams1);
    const set2 = new Set(ngrams2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    const jaccard = union.size === 0 ? 0 : intersection.size / union.size;
    
    // Optimized Levenshtein with early termination
    const levenshtein = this.calculateOptimizedLevenshtein(s1, s2);
    
    // Weighted combination
    const similarity = jaccard * 0.6 + levenshtein * 0.4;
    
    // Memoize result
    this?.levenshteinMemo?.set(memoKey, similarity);
    
    // Limit memoization size
    if (this?.levenshteinMemo?.size > 10000) {
      const firstKey = this?.levenshteinMemo?.keys().next().value;
      this?.levenshteinMemo?.delete(firstKey);
    }
    
    return similarity;
  }

  /**
   * Optimized semantic similarity with embeddings
   */
  private async calculateOptimizedSemanticSimilarity(
    features1: ProductFeatures,
    features2: ProductFeatures
  ): Promise<number> {
    // Fast keyword overlap calculation
    const keywordSim = this.calculateFastKeywordSimilarity(
      features1.keywords,
      features2.keywords
    );
    
    // Category similarity with synonyms
    const categorySim = this.calculateCategorySimilarityWithSynonyms(
      features1.category,
      features2.category
    );
    
    // Size similarity with unit conversion
    const sizeSim = this.calculateSizeSimilarityWithConversion(
      features1,
      features2
    );
    
    // Weighted combination
    return keywordSim * 0.5 + categorySim * 0.3 + sizeSim * 0.2;
  }

  /**
   * Enhanced brand matching with synonyms
   */
  private calculateOptimizedBrandMatch(
    features1: ProductFeatures,
    features2: ProductFeatures
  ): number {
    if (!features1.brand || !features2.brand) {
      return 0;
    }
    
    const brand1 = features1?.brand?.toLowerCase();
    const brand2 = features2?.brand?.toLowerCase();
    
    // Exact match
    if (brand1 === brand2) {
      return 1.0;
    }
    
    // Check brand synonyms
    const synonyms1 = this?.brandSynonyms?.get(brand1);
    const synonyms2 = this?.brandSynonyms?.get(brand2);
    
    if (synonyms1?.has(brand2) || synonyms2?.has(brand1)) {
      return 0.9;
    }
    
    // Fuzzy brand matching for misspellings
    const brandSimilarity = this.calculateOptimizedLevenshtein(brand1, brand2);
    if (brandSimilarity > 0.8) {
      return brandSimilarity * 0.8;
    }
    
    return 0;
  }

  /**
   * Enhanced category matching with hierarchy
   */
  private calculateOptimizedCategoryMatch(
    features1: ProductFeatures,
    features2: ProductFeatures
  ): number {
    if (!features1.category || !features2.category) {
      return 0;
    }
    
    const cat1 = features1?.category?.toLowerCase();
    const cat2 = features2?.category?.toLowerCase();
    
    // Exact match
    if (cat1 === cat2) {
      return 1.0;
    }
    
    // Check category synonyms
    const synonyms1 = this?.categorySynonyms?.get(cat1);
    const synonyms2 = this?.categorySynonyms?.get(cat2);
    
    if (synonyms1?.has(cat2) || synonyms2?.has(cat1)) {
      return 0.8;
    }
    
    // Check category hierarchy (parent-child relationships)
    if (this.areCategoriesRelated(cat1, cat2)) {
      return 0.6;
    }
    
    return 0;
  }

  /**
   * Batch processing for multiple products
   */
  async processBatch(request: BatchMatchRequest): Promise<BatchMatchResult> {
    const startTime = Date.now();
    const results = new Map<string, Map<string, number>>();
    let cacheHits = 0;
    let totalRequests = 0;
    
    // Pre-warm cache for all products
    await this.prewarmProductFeatures(request.products);
    
    // Process in parallel batches
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < request?.queries?.length; i += batchSize) {
      const queryBatch = request?.queries?.slice(i, i + batchSize);
      
      const batchPromise = Promise.all(
        queryBatch?.map(async (query: any) => {
          const productScores = new Map<string, number>();
          
          await Promise.all(
            request?.products?.map(async (product: any) => {
              totalRequests++;
              
              // Check cache first
              const cacheKey = this.generateCacheKey(query, product);
              const cached = this?.similarityCache?.get(cacheKey);
              
              if (cached !== undefined) {
                cacheHits++;
                productScores.set(product, cached);
              } else {
                const score = await this.calculateSimilarity(query, product);
                productScores.set(product, score);
              }
            })
          );
          
          results.set(query, productScores);
        })
      );
      
      batches.push(batchPromise);
    }
    
    await Promise.all(batches);
    
    const executionTime = Date.now() - startTime;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;
    
    return {
      results,
      executionTime,
      cacheHitRate,
    };
  }

  /**
   * Pre-warm cache for frequently accessed products
   */
  private async prewarmProductFeatures(products: string[]): Promise<void> {
    const uncachedProducts = products?.filter(
      product => !this?.featureCache?.has(`features:${product}`)
    );
    
    if (uncachedProducts?.length || 0 === 0) {
      return;
    }
    
    // Extract features in parallel
    await Promise.all(
      uncachedProducts?.map(product => this.getOptimizedFeatures(product))
    );
  }

  /**
   * ML-based weighted score calculation
   */
  private calculateMLWeightedScore(metrics: {
    lexicalSimilarity: number;
    semanticSimilarity: number;
    brandMatch: number;
    categoryMatch: number;
    sizeMatch: number;
  }): number {
    const { weights, bias } = this.mlModel;
    
    const score = 
      metrics.lexicalSimilarity * weights.lexical +
      metrics.semanticSimilarity * weights.semantic +
      metrics.brandMatch * weights.brand +
      metrics.categoryMatch * weights.category +
      metrics.sizeMatch * weights.size +
      bias;
    
    // Sigmoid activation for 0-1 range
    return 1 / (1 + Math.exp(-score));
  }

  /**
   * Update ML model based on user feedback
   */
  async updateModelWithFeedback(feedback: FeedbackData): Promise<void> {
    this?.feedbackHistory?.push(feedback);
    
    // Store feedback in Redis for persistence
    try {
      await this?.cacheManager?.set(
        `feedback:${Date.now()}`,
        feedback,
        { ttl: 86400 * 30 } // Keep for 30 days
      );
    } catch (error) {
      logger.warn("Failed to store feedback", "OPTIMIZED_MATCHING", { error });
    }
    
    // Trigger model update if enough feedback collected
    if (this?.feedbackHistory?.length >= 100) {
      await this.trainModel();
    }
  }

  /**
   * Train ML model with collected feedback
   */
  private async trainModel(): Promise<void> {
    if (this?.feedbackHistory?.length < 50) {
      return;
    }
    
    logger.info("Training ML model with feedback", "OPTIMIZED_MATCHING", {
      feedbackCount: this?.feedbackHistory?.length,
    });
    
    // Simple gradient descent update
    const learningRate = this?.mlModel?.learningRate;
    const newWeights = { ...this?.mlModel?.weights };
    
    for (const feedback of this.feedbackHistory) {
      const expectedScore = feedback.userFeedback === 'positive' ? 1 : 
                          feedback.userFeedback === 'negative' ? 0 : 0.5;
      
      const actualScore = feedback?.score;
      const error = expectedScore - actualScore;
      
      // Update weights based on error
      Object.keys(newWeights).forEach(key => {
        const k = key as keyof typeof newWeights;
        newWeights[k] += learningRate * error * 0.1; // Small update
      });
    }
    
    // Normalize weights
    const sum = Object.values(newWeights).reduce((a: any, b: any) => a + b, 0);
    Object.keys(newWeights).forEach(key => {
      const k = key as keyof typeof newWeights;
      newWeights[k] = newWeights[k] / sum;
    });
    
    this?.mlModel?.weights = newWeights;
    
    // Clear old feedback
    this.feedbackHistory = this?.feedbackHistory?.slice(-100);
    
    logger.info("ML model updated", "OPTIMIZED_MATCHING", { newWeights });
  }

  /**
   * Initialize spell correction dictionary
   */
  private initializeSpellCorrection(): void {
    this.spellCorrections = new Map([
      ['chese', 'cheese'],
      ['chiken', 'chicken'],
      ['tomatoe', 'tomato'],
      ['potatoe', 'potato'],
      ['brocoli', 'broccoli'],
      ['yoghurt', 'yogurt'],
      ['spagetti', 'spaghetti'],
      ['avacado', 'avocado'],
      ['bannana', 'banana'],
      ['strawbery', 'strawberry'],
      ['rasberry', 'raspberry'],
      ['bluebery', 'blueberry'],
      ['pinapple', 'pineapple'],
      ['sandwhich', 'sandwich'],
      ['hamburguer', 'hamburger'],
    ]);
    
    this.commonMisspellings = new Map([
      ['cheese', ['chese', 'cheeze', 'chees']],
      ['chicken', ['chiken', 'chickin', 'chikn']],
      ['chocolate', ['choclate', 'chocolat', 'choclet']],
    ]);
  }

  /**
   * Initialize brand and category synonyms
   */
  private initializeSynonyms(): void {
    this.brandSynonyms = new Map([
      ['coca-cola', new Set(['coke', 'coca cola', 'cocacola'])],
      ['pepsi', new Set(['pepsi-cola', 'pepsi cola'])],
      ['great value', new Set(['gv', 'walmart brand', 'walmart'])],
      ['kelloggs', new Set(['kellogg', "kellogg's"])],
    ]);
    
    this.categorySynonyms = new Map([
      ['dairy', new Set(['milk products', 'milk', 'cheese'])],
      ['produce', new Set(['fruits', 'vegetables', 'fresh'])],
      ['beverages', new Set(['drinks', 'sodas', 'juice'])],
      ['snacks', new Set(['chips', 'crackers', 'cookies'])],
    ]);
  }

  /**
   * Apply spell correction to query
   */
  private applySpellCorrection(text: string): string {
    const words = text.toLowerCase().split(/\s+/);
    const corrected = words?.map(word => {
      return this?.spellCorrections?.get(word) || word;
    });
    return corrected.join(' ');
  }

  /**
   * Get phonetic encoding for fuzzy matching
   */
  private getPhoneticEncoding(text: string): string {
    if (this?.phoneticMemo?.has(text)) {
      return this?.phoneticMemo?.get(text)!;
    }
    
    // Simple phonetic encoding (Soundex-like)
    const encoded = text
      .toLowerCase()
      .replace(/[aeiou]/g, '')
      .replace(/(.)\1+/g, '$1');
    
    this?.phoneticMemo?.set(text, encoded);
    return encoded;
  }

  /**
   * Advanced tokenization with stemming
   */
  private tokenizeAdvanced(text: string): string[] {
    // Remove special characters but keep hyphens and apostrophes
    const cleaned = text.replace(/[^\w\s'-]/g, ' ');
    
    // Split on whitespace and filter
    const tokens = cleaned.split(/\s+/)
      .filter(token => token?.length || 0 > 1)
      .map(token => this.stemWord(token));
    
    return tokens;
  }

  /**
   * Simple word stemming
   */
  private stemWord(word: string): string {
    // Basic stemming rules
    if (word.endsWith('ies')) {
      return word.slice(0, -3) + 'y';
    }
    if (word.endsWith('es')) {
      return word.slice(0, -2);
    }
    if (word.endsWith('s') && !word.endsWith('ss')) {
      return word.slice(0, -1);
    }
    if (word.endsWith('ed')) {
      return word.slice(0, -2);
    }
    if (word.endsWith('ing')) {
      return word.slice(0, -3);
    }
    return word;
  }

  /**
   * Extract brand with synonym matching
   */
  private extractBrandWithSynonyms(text: string, tokens: string[]): string | undefined {
    const normalized = text.toLowerCase();
    
    // Check each brand and its synonyms
    for (const [brand, synonyms] of this.brandSynonyms) {
      if (normalized.includes(brand)) {
        return brand;
      }
      for (const synonym of synonyms) {
        if (normalized.includes(synonym)) {
          return brand;
        }
      }
    }
    
    // Fallback to original logic
    return undefined;
  }

  /**
   * Extract category with synonym matching
   */
  private extractCategoryWithSynonyms(text: string, tokens: string[]): string | undefined {
    const normalized = text.toLowerCase();
    
    // Check each category and its synonyms
    for (const [category, synonyms] of this.categorySynonyms) {
      if (normalized.includes(category)) {
        return category;
      }
      for (const synonym of synonyms) {
        if (normalized.includes(synonym)) {
          return category;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Extract size with unit conversion
   */
  private extractSizeWithConversion(text: string): { size?: string; unit?: string } {
    const sizePattern = /(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|lb|lbs|pound|pounds|gal|gallon|gallons|ml|l|liter|liters|ct|count|pack|kg|g|gram|grams)/i;
    const match = text.match(sizePattern);
    
    if (!match) {
      return {};
    }
    
    let size = match[1];
    let unit = match[2].toLowerCase();
    
    // Normalize units
    const unitMap: Record<string, string> = {
      'ounce': 'oz',
      'ounces': 'oz',
      'pound': 'lb',
      'pounds': 'lb',
      'lbs': 'lb',
      'gallon': 'gal',
      'gallons': 'gal',
      'liter': 'l',
      'liters': 'l',
      'gram': 'g',
      'grams': 'g',
    };
    
    unit = unitMap[unit] || unit;
    
    return { size, unit };
  }

  /**
   * Extract keywords with stemming
   */
  private extractKeywordsWithStemming(
    tokens: string[],
    brand?: string,
    size?: string
  ): string[] {
    return tokens?.filter(token => {
      // Filter out brand and size words
      if (brand && brand.toLowerCase().includes(token)) {
        return false;
      }
      if (size && token.includes(size)) {
        return false;
      }
      // Filter out common words
      return token?.length || 0 > 2;
    });
  }

  /**
   * Extract enhanced numeric features
   */
  private extractNumericFeatures(
    text: string,
    tokens: string[],
    size?: string
  ): Record<string, number> {
    const features: Record<string, number> = {
      textLength: text?.length || 0,
      wordCount: tokens?.length || 0,
      avgWordLength: tokens.reduce((sum: any, t: any) => sum + t?.length || 0, 0) / Math.max(tokens?.length || 0, 1),
      uniqueWords: new Set(tokens).size,
      numericCount: (text.match(/\d+/g) || []).length,
    };
    
    if (size) {
      features.size = parseFloat(size);
    }
    
    return features;
  }

  /**
   * Get cached n-grams
   */
  private getCachedNGrams(text: string, n: number): string[] {
    const key = `${text}:${n}`;
    
    if (this?.ngramMemo?.has(key)) {
      return this?.ngramMemo?.get(key)!;
    }
    
    const ngrams = this.generateNGrams(text, n);
    this?.ngramMemo?.set(key, ngrams);
    
    // Limit cache size
    if (this?.ngramMemo?.size > 5000) {
      const firstKey = this?.ngramMemo?.keys().next().value;
      this?.ngramMemo?.delete(firstKey);
    }
    
    return ngrams;
  }

  /**
   * Optimized Levenshtein with early termination
   */
  private calculateOptimizedLevenshtein(s1: string, s2: string): number {
    if (Math.abs(s1?.length || 0 - s2?.length || 0) > Math.max(s1?.length || 0, s2?.length || 0) * 0.5) {
      // Early termination if strings are too different in length
      return 0;
    }
    
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1?.length || 0, s2?.length || 0);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Fast keyword similarity calculation
   */
  private calculateFastKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1?.length || 0 === 0 || keywords2?.length || 0 === 0) {
      return 0;
    }
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    // Fast intersection calculation
    let intersection = 0;
    const smaller = set1.size < set2.size ? set1 : set2;
    const larger = set1.size < set2.size ? set2 : set1;
    
    for (const item of smaller) {
      if (larger.has(item)) {
        intersection++;
      }
    }
    
    const union = set1.size + set2.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Category similarity with synonym support
   */
  private calculateCategorySimilarityWithSynonyms(
    cat1?: string,
    cat2?: string
  ): number {
    if (!cat1 || !cat2) {
      return 0;
    }
    
    if (cat1 === cat2) {
      return 1.0;
    }
    
    const synonyms1 = this?.categorySynonyms?.get(cat1);
    const synonyms2 = this?.categorySynonyms?.get(cat2);
    
    if (synonyms1?.has(cat2) || synonyms2?.has(cat1)) {
      return 0.8;
    }
    
    return 0;
  }

  /**
   * Size similarity with unit conversion
   */
  private calculateSizeSimilarityWithConversion(
    features1: ProductFeatures,
    features2: ProductFeatures
  ): number {
    if (!features1.size || !features2.size) {
      return 0;
    }
    
    if (!features1.unit || !features2.unit) {
      return 0;
    }
    
    // Convert to common unit if needed
    const size1 = this.convertToCommonUnit(
      parseFloat(features1.size),
      features1.unit
    );
    const size2 = this.convertToCommonUnit(
      parseFloat(features2.size),
      features2.unit
    );
    
    const diff = Math.abs(size1 - size2);
    const avg = (size1 + size2) / 2;
    
    if (avg === 0) return 1;
    
    return Math.max(0, 1 - diff / avg);
  }

  /**
   * Convert size to common unit (ounces)
   */
  private convertToCommonUnit(size: number, unit: string): number {
    const conversions: Record<string, number> = {
      'oz': 1,
      'lb': 16,
      'g': 0.035274,
      'kg': 35.274,
      'l': 33.814,
      'ml': 0.033814,
      'gal': 128,
    };
    
    return size * (conversions[unit] || 1);
  }

  /**
   * Check if categories are related
   */
  private areCategoriesRelated(cat1: string, cat2: string): boolean {
    const relatedCategories: Record<string, string[]> = {
      'dairy': ['beverages', 'cheese', 'yogurt'],
      'meat': ['frozen', 'deli', 'seafood'],
      'produce': ['frozen', 'organic'],
      'snacks': ['beverages', 'candy'],
      'bakery': ['frozen', 'breakfast'],
    };
    
    return relatedCategories[cat1]?.includes(cat2) || 
           relatedCategories[cat2]?.includes(cat1) || 
           false;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: string, product: string): string {
    return crypto
      .createHash('md5')
      .update(`${query.toLowerCase()}:${product.toLowerCase()}`)
      .digest('hex');
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(executionTime: number): void {
    this?.performanceMetrics?.totalCalculations++;
    this?.performanceMetrics?.avgCalculationTime = 
      (this?.performanceMetrics?.avgCalculationTime * 
       (this?.performanceMetrics?.totalCalculations - 1) + 
       executionTime) / 
      this?.performanceMetrics?.totalCalculations;
  }

  /**
   * Start cache warming process
   */
  private async startCacheWarming(): Promise<void> {
    // Warm up common product features
    const commonProducts = [
      'milk', 'bread', 'eggs', 'cheese', 'chicken',
      'beef', 'pork', 'apples', 'bananas', 'oranges',
    ];
    
    for (const product of commonProducts) {
      await this.getOptimizedFeatures(product);
    }
    
    logger.info("Cache warming completed", "OPTIMIZED_MATCHING", {
      warmedProducts: commonProducts?.length || 0,
    });
  }

  /**
   * Start background model training
   */
  private startModelTraining(): void {
    // Train model every hour if feedback available
    setInterval(() => {
      if (this?.feedbackHistory?.length >= 50) {
        this.trainModel().catch(error => {
          logger.error("Model training failed", "OPTIMIZED_MATCHING", { error });
        });
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    cacheHitRate: number;
    avgCalculationTime: number;
    totalCalculations: number;
    cacheSize: number;
  } {
    const totalRequests = this?.performanceMetrics?.cacheHits + this?.performanceMetrics?.cacheMisses;
    const cacheHitRate = totalRequests > 0 
      ? this?.performanceMetrics?.cacheHits / totalRequests 
      : 0;
    
    return {
      cacheHitRate,
      avgCalculationTime: this?.performanceMetrics?.avgCalculationTime,
      totalCalculations: this?.performanceMetrics?.totalCalculations,
      cacheSize: this?.similarityCache?.size,
    };
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    this?.similarityCache?.clear();
    this?.featureCache?.clear();
    this?.scoreCache?.clear();
    this?.levenshteinMemo?.clear();
    this?.ngramMemo?.clear();
    this?.phoneticMemo?.clear();
    
    // Clear Redis caches
    try {
      await this?.cacheManager?.clearNamespace('similarity');
    } catch (error) {
      logger.warn("Failed to clear Redis cache", "OPTIMIZED_MATCHING", { error });
    }
    
    logger.info("All caches cleared", "OPTIMIZED_MATCHING");
  }
}