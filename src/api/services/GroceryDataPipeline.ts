import { EventEmitter } from 'events';
import { RedisMessageQueue } from './RedisMessageQueue.js';
import type { GroceryMessage, QueueConsumer } from './RedisMessageQueue.js';
import { UnifiedCacheManager } from './UnifiedCacheManager.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// Grocery processing schemas
export const PriceUpdateSchema = z.object({
  productId: z.string(),
  storeId: z.string(),
  newPrice: z.number().positive(),
  oldPrice: z.number().positive().optional(),
  currency: z.string().default('USD'),
  effectiveDate: z.number(),
  source: z.string(),
  confidence: z.number().min(0).max(1).default(1.0)
});

export const InventoryUpdateSchema = z.object({
  productId: z.string(),
  storeId: z.string(),
  quantity: z.number().min(0),
  inStock: z.boolean(),
  lastUpdated: z.number(),
  source: z.string(),
  threshold: z.number().optional()
});

export const ProductMatchSchema = z.object({
  sourceProductId: z.string(),
  targetProductId: z.string(),
  confidence: z.number().min(0).max(1),
  matchType: z.enum(['exact', 'fuzzy', 'category', 'brand']),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean()])),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).default('pending')
});

export const DealAnalysisSchema = z.object({
  dealId: z.string(),
  productId: z.string(),
  storeId: z.string(),
  originalPrice: z.number(),
  discountPrice: z.number(),
  discountPercent: z.number(),
  validFrom: z.number(),
  validTo: z.number(),
  dealType: z.enum(['percentage', 'fixed_amount', 'bogo', 'bulk']),
  conditions: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

export const NutritionDataSchema = z.object({
  productId: z.string(),
  calories: z.number().optional(),
  servingSize: z.string().optional(),
  nutrients: z.record(z.number()).optional(),
  allergens: z.array(z.string()).default([]),
  dietaryFlags: z.array(z.string()).default([]),
  source: z.string(),
  lastUpdated: z.number()
});

export type PriceUpdate = z.infer<typeof PriceUpdateSchema>;
export type InventoryUpdate = z.infer<typeof InventoryUpdateSchema>;
export type ProductMatch = z.infer<typeof ProductMatchSchema>;
export type DealAnalysis = z.infer<typeof DealAnalysisSchema>;
export type NutritionData = z.infer<typeof NutritionDataSchema>;

// Processing results
export interface ProcessingResult {
  messageId: string;
  messageType: string;
  success: boolean;
  processingTime: number;
  result?: ProcessingResultData;
  error?: string;
  cacheUpdated?: boolean;
  dependentJobs?: string[];
}

// Union type for different processing result data types
export type ProcessingResultData = 
  | PriceUpdateResult
  | InventoryUpdateResult
  | ProductMatchResult
  | DealAnalysisResult
  | NutritionData
  | ReviewAnalysisResult
  | RecommendationResult;

export interface PriceUpdateResult {
  productId: string;
  storeId: string;
  priceChange: string;
  effectiveDate: number;
}

export interface InventoryUpdateResult {
  productId: string;
  storeId: string;
  inStock: boolean;
  quantity: number;
}

export interface ProductMatchResult {
  confidence: number;
  matchScore: number;
  attributes: Record<string, string | number | boolean>;
  verificationNeeded: boolean;
}

export interface DealAnalysisResult {
  quality: number;
  competitiveness: number;
  historicalComparison: string;
  recommendation: string;
}

export interface ReviewAnalysisResult {
  overallSentiment: 'positive' | 'negative';
  sentimentScore: number;
  averageRating: number;
  reviewCount: number;
  topKeywords: string[];
  issues: string[];
}

export interface RecommendationResult {
  userId: string;
  recommendations: ProductRecommendation[];
  generatedAt: number;
}

export interface ProductRecommendation {
  productId: string;
  score: number;
  reason: string;
  category: string;
  rank: number;
}

export interface Review {
  id: string;
  rating: number;
  text: string;
  author: string;
  date: number;
}

// Pipeline configuration
export const GroceryPipelineConfigSchema = z.object({
  queues: z.object({
    priceUpdates: z.string().default('grocery:price_updates'),
    inventorySync: z.string().default('grocery:inventory_sync'),
    productMatching: z.string().default('grocery:product_matching'),
    dealAnalysis: z.string().default('grocery:deal_analysis'),
    nutritionFetch: z.string().default('grocery:nutrition_fetch'),
    reviewAnalysis: z.string().default('grocery:review_analysis'),
    recommendations: z.string().default('grocery:recommendations')
  }),
  processing: z.object({
    batchSize: z.number().default(20),
    concurrency: z.number().default(3),
    enableCaching: z.boolean().default(true),
    cacheInvalidation: z.boolean().default(true),
    dependencyProcessing: z.boolean().default(true),
    deadLetterRetention: z.number().default(604800) // 7 days
  }),
  integrations: z.object({
    walmartApi: z.boolean().default(true),
    nutritionApi: z.boolean().default(true),
    reviewSentiment: z.boolean().default(true),
    priceComparison: z.boolean().default(true)
  })
});

export type GroceryPipelineConfig = z.infer<typeof GroceryPipelineConfigSchema>;

// Processing statistics interface
export interface ProcessingStatistics {
  completed: number;
  failed: number;
  retry: number;
  totalProcessingTime: number;
  avgProcessingTime: number;
}

// Queue statistics interface
export interface QueueStatistics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

// Event data interfaces
export interface MessageCompletedEvent {
  queueName: string;
  messageId: string;
  processingTime: number;
  result?: ProcessingResultData;
}

export interface MessageErrorEvent {
  queueName: string;
  messageId: string;
  error: string;
  stack?: string;
}

export interface MessageRetryEvent {
  queueName: string;
  messageId: string;
  retryCount: number;
  nextRetryAt: number;
}

export interface CacheHitEvent {
  cacheKey: string;
  cacheType: string;
  ttl: number;
}

export interface JobProcessingEvent {
  type: string;
  messageId: string;
  productId?: string;
  storeId?: string;
  userId?: string;
  context?: string;
  reviewCount?: number;
  sourceProductId?: string;
  targetProductId?: string;
  dealId?: string;
}

/**
 * GroceryDataPipeline
 * 
 * Comprehensive data processing pipeline for grocery-related operations.
 * Handles price updates, inventory sync, product matching, deal analysis,
 * nutrition data fetching, and recommendation generation.
 */
export class GroceryDataPipeline extends EventEmitter {
  private config: GroceryPipelineConfig;
  private messageQueue: RedisMessageQueue;
  private cacheManager: UnifiedCacheManager;
  private consumers: Map<string, QueueConsumer> = new Map();
  private processingStats: Map<string, ProcessingStatistics> = new Map();
  private isRunning = false;

  constructor(
    messageQueue: RedisMessageQueue,
    cacheManager: UnifiedCacheManager,
    config: Partial<GroceryPipelineConfig> = {}
  ) {
    super();
    
    this.config = GroceryPipelineConfigSchema.parse(config);
    this.messageQueue = messageQueue;
    this.cacheManager = cacheManager;
    
    this.setupEventHandlers();
    this.initializeConsumers();
  }

  private setupEventHandlers(): void {
    this?.messageQueue?.on('message:completed', (data: MessageCompletedEvent) => {
      this.emit('job:completed', data);
      this.updateProcessingStats(data.queueName, 'completed', data.processingTime);
    });

    this?.messageQueue?.on('message:error', (data: MessageErrorEvent) => {
      this.emit('job:failed', data);
      this.updateProcessingStats(data.queueName, 'failed');
    });

    this?.messageQueue?.on('message:retry', (data: MessageRetryEvent) => {
      this.emit('job:retry', data);
      this.updateProcessingStats(data.queueName, 'retry');
    });

    this?.cacheManager?.on('cache:hit', (data: CacheHitEvent) => {
      this.emit('cache:hit', data);
    });
  }

  private initializeConsumers(): void {
    // Price Updates Consumer
    this?.consumers?.set('price_updates', {
      name: 'price_processor',
      concurrency: this?.config?.processing.concurrency,
      process: ((message: GroceryMessage) => this.processPriceUpdate(message)),
      onError: ((error: Error, message: GroceryMessage) => this.handleProcessingError(error, message)),
      onRetry: ((message: GroceryMessage, retryCount: number) => this.shouldRetryJob(message, retryCount))
    });

    // Inventory Sync Consumer
    this?.consumers?.set('inventory_sync', {
      name: 'inventory_processor',
      concurrency: this?.config?.processing.concurrency,
      process: ((message: GroceryMessage) => this.processInventoryUpdate(message)),
      onError: ((error: Error, message: GroceryMessage) => this.handleProcessingError(error, message)),
      onRetry: ((message: GroceryMessage, retryCount: number) => this.shouldRetryJob(message, retryCount))
    });

    // Product Matching Consumer
    this?.consumers?.set('product_matching', {
      name: 'matching_processor',
      concurrency: Math.floor(this?.config?.processing.concurrency / 2), // CPU intensive
      process: ((message: GroceryMessage) => this.processProductMatch(message)),
      onError: ((error: Error, message: GroceryMessage) => this.handleProcessingError(error, message)),
      onRetry: ((message: GroceryMessage, retryCount: number) => this.shouldRetryJob(message, retryCount))
    });

    // Deal Analysis Consumer
    this?.consumers?.set('deal_analysis', {
      name: 'deal_processor',
      concurrency: this?.config?.processing.concurrency,
      process: ((message: GroceryMessage) => this.processDealAnalysis(message)),
      onError: ((error: Error, message: GroceryMessage) => this.handleProcessingError(error, message)),
      onRetry: ((message: GroceryMessage, retryCount: number) => this.shouldRetryJob(message, retryCount))
    });

    // Nutrition Fetch Consumer
    this?.consumers?.set('nutrition_fetch', {
      name: 'nutrition_processor',
      concurrency: 2, // Limited by external API
      process: ((message: GroceryMessage) => this.processNutritionFetch(message)),
      onError: ((error: Error, message: GroceryMessage) => this.handleProcessingError(error, message)),
      onRetry: ((message: GroceryMessage, retryCount: number) => this.shouldRetryJob(message, retryCount))
    });

    // Review Analysis Consumer
    this?.consumers?.set('review_analysis', {
      name: 'review_processor',
      concurrency: this?.config?.processing.concurrency,
      process: ((message: GroceryMessage) => this.processReviewAnalysis(message)),
      onError: ((error: Error, message: GroceryMessage) => this.handleProcessingError(error, message)),
      onRetry: ((message: GroceryMessage, retryCount: number) => this.shouldRetryJob(message, retryCount))
    });

    // Recommendation Generation Consumer
    this?.consumers?.set('recommendations', {
      name: 'recommendation_processor',
      concurrency: 1, // Sequential processing for consistency
      process: ((message: GroceryMessage) => this.processRecommendationGeneration(message)),
      onError: ((error: Error, message: GroceryMessage) => this.handleProcessingError(error, message)),
      onRetry: ((message: GroceryMessage, retryCount: number) => this.shouldRetryJob(message, retryCount))
    });
  }

  // Processing methods for each job type
  private async processPriceUpdate(message: GroceryMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const priceData = PriceUpdateSchema.parse(message?.payload?.data);
      
      this.emit('job:processing', {
        type: 'price_update',
        messageId: message.id,
        productId: priceData.productId,
        storeId: priceData.storeId
      });

      // Validate price change
      const priceChange = priceData.oldPrice 
        ? ((priceData.newPrice - priceData.oldPrice) / priceData.oldPrice) * 100
        : 0;

      // Update pricing service cache
      if (this?.config?.processing.enableCaching) {
        await this.updatePriceCache(priceData);
      }

      // Check if this triggers deal analysis
      const dependentJobs = [];
      if (priceChange < -10) { // Significant discount
        dependentJobs.push(await this.enqueueDealAnalysis(priceData));
      }

      // Update price history
      await this.updatePriceHistory(priceData);

      const result: ProcessingResult = {
        messageId: message.id,
        messageType: 'price_update',
        success: true,
        processingTime: Date.now() - startTime,
        result: {
          productId: priceData.productId,
          storeId: priceData.storeId,
          priceChange: priceChange.toFixed(2) + '%',
          effectiveDate: priceData.effectiveDate
        } as PriceUpdateResult,
        cacheUpdated: true,
        dependentJobs
      };

      this.emit('price:updated', result);
      return result;

    } catch (error) {
      return {
        messageId: message.id,
        messageType: 'price_update',
        success: false,
        processingTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  private async processInventoryUpdate(message: GroceryMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const inventoryData = InventoryUpdateSchema.parse(message?.payload?.data);
      
      this.emit('job:processing', {
        type: 'inventory_sync',
        messageId: message.id,
        productId: inventoryData.productId,
        storeId: inventoryData.storeId
      });

      // Update inventory cache
      if (this?.config?.processing.enableCaching) {
        await this.updateInventoryCache(inventoryData);
      }

      // Check for low stock alerts
      const dependentJobs = [];
      if (inventoryData.threshold && inventoryData.quantity <= inventoryData.threshold) {
        // Trigger stock alert processing
        dependentJobs.push('stock_alert_generated');
      }

      const result: ProcessingResult = {
        messageId: message.id,
        messageType: 'inventory_sync',
        success: true,
        processingTime: Date.now() - startTime,
        result: {
          productId: inventoryData.productId,
          storeId: inventoryData.storeId,
          inStock: inventoryData.inStock,
          quantity: inventoryData.quantity
        } as InventoryUpdateResult,
        cacheUpdated: true,
        dependentJobs
      };

      this.emit('inventory:updated', result);
      return result;

    } catch (error) {
      return {
        messageId: message.id,
        messageType: 'inventory_sync',
        success: false,
        processingTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  private async processProductMatch(message: GroceryMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const matchData = ProductMatchSchema.parse(message?.payload?.data);
      
      this.emit('job:processing', {
        type: 'product_match',
        messageId: message.id,
        sourceProductId: matchData.sourceProductId,
        targetProductId: matchData.targetProductId
      });

      // Perform ML-based product matching
      const matchResult = await this.performProductMatching(matchData);
      
      // Update product relationship cache
      if (this?.config?.processing.enableCaching && matchResult.confidence > 0.8) {
        await this.updateProductMatchCache(matchData, matchResult);
      }

      const result: ProcessingResult = {
        messageId: message.id,
        messageType: 'product_match',
        success: true,
        processingTime: Date.now() - startTime,
        result: matchResult,
        cacheUpdated: matchResult.confidence > 0.8
      };

      this.emit('product:matched', result);
      return result;

    } catch (error) {
      return {
        messageId: message.id,
        messageType: 'product_match',
        success: false,
        processingTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  private async processDealAnalysis(message: GroceryMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const dealData = DealAnalysisSchema.parse(message?.payload?.data);
      
      this.emit('job:processing', {
        type: 'deal_analysis',
        messageId: message.id,
        dealId: dealData.dealId,
        productId: dealData.productId
      });

      // Analyze deal quality and market competitiveness
      const analysisResult = await this.analyzeDeal(dealData);
      
      // Update deals cache
      if (this?.config?.processing.enableCaching) {
        await this.updateDealCache(dealData, analysisResult);
      }

      // Generate recommendations if deal is good
      const dependentJobs = [];
      if (analysisResult.quality > 0.7) {
        dependentJobs.push(await this.enqueueRecommendationGeneration(dealData));
      }

      const result: ProcessingResult = {
        messageId: message.id,
        messageType: 'deal_analysis',
        success: true,
        processingTime: Date.now() - startTime,
        result: analysisResult,
        cacheUpdated: true,
        dependentJobs
      };

      this.emit('deal:analyzed', result);
      return result;

    } catch (error) {
      return {
        messageId: message.id,
        messageType: 'deal_analysis',
        success: false,
        processingTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  private async processNutritionFetch(message: GroceryMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const productId = message?.payload?.productId;
      if (!productId) {
        throw new Error('Product ID required for nutrition fetch');
      }

      this.emit('job:processing', {
        type: 'nutrition_fetch',
        messageId: message.id,
        productId
      });

      // Fetch nutrition data from external API
      const nutritionData = await this.fetchNutritionData(productId);
      
      // Validate and parse nutrition data
      const validatedData = NutritionDataSchema.parse(nutritionData);
      
      // Update nutrition cache
      if (this?.config?.processing.enableCaching) {
        await this.updateNutritionCache(productId, validatedData);
      }

      const result: ProcessingResult = {
        messageId: message.id,
        messageType: 'nutrition_fetch',
        success: true,
        processingTime: Date.now() - startTime,
        result: validatedData,
        cacheUpdated: true
      };

      this.emit('nutrition:fetched', result);
      return result;

    } catch (error) {
      return {
        messageId: message.id,
        messageType: 'nutrition_fetch',
        success: false,
        processingTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  private async processReviewAnalysis(message: GroceryMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const reviewData = message?.payload?.data as { productId: string; reviews: Review[] };
      const { productId, reviews } = reviewData;
      
      this.emit('job:processing', {
        type: 'review_analysis',
        messageId: message.id,
        productId,
        reviewCount: reviews?.length || 0
      } as JobProcessingEvent);

      // Perform sentiment analysis on reviews
      const analysisResult = await this.analyzeReviews(productId, reviews);
      
      // Update review sentiment cache
      if (this?.config?.processing.enableCaching) {
        await this.updateReviewCache(productId, analysisResult);
      }

      const result: ProcessingResult = {
        messageId: message.id,
        messageType: 'review_analysis',
        success: true,
        processingTime: Date.now() - startTime,
        result: analysisResult,
        cacheUpdated: true
      };

      this.emit('reviews:analyzed', result);
      return result;

    } catch (error) {
      return {
        messageId: message.id,
        messageType: 'review_analysis',
        success: false,
        processingTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  private async processRecommendationGeneration(message: GroceryMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const { userId } = message.payload;
      const context = 'context' in message.payload ? message?.payload?.context : undefined;
      
      this.emit('job:processing', {
        type: 'recommendation_generation',
        messageId: message.id,
        userId,
        context
      });

      // Generate personalized recommendations
      const recommendations = await this.generateRecommendations(userId || '', context);
      
      // Update user recommendations cache
      if (this?.config?.processing.enableCaching) {
        await this.updateRecommendationCache(userId || '', recommendations);
      }

      const result: ProcessingResult = {
        messageId: message.id,
        messageType: 'recommendation_generation',
        success: true,
        processingTime: Date.now() - startTime,
        result: {
          userId,
          recommendations: recommendations.slice(0, 20), // Top 20 recommendations
          generatedAt: Date.now()
        } as RecommendationResult,
        cacheUpdated: true
      };

      this.emit('recommendations:generated', result);
      return result;

    } catch (error) {
      return {
        messageId: message.id,
        messageType: 'recommendation_generation',
        success: false,
        processingTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }

  // Helper methods for processing
  private async updatePriceCache(priceData: PriceUpdate): Promise<void> {
    const cacheKey = `price:${priceData.productId}:${priceData.storeId}`;
    await this?.cacheManager?.getCentralCache().set(cacheKey, priceData, {
      ttl: 3600, // 1 hour
      tags: [`pricing`, `product:${priceData.productId}`, `store:${priceData.storeId}`]
    });
  }

  private async updateInventoryCache(inventoryData: InventoryUpdate): Promise<void> {
    const cacheKey = `inventory:${inventoryData.productId}:${inventoryData.storeId}`;
    await this?.cacheManager?.getCentralCache().set(cacheKey, inventoryData, {
      ttl: 1800, // 30 minutes
      tags: [`inventory`, `product:${inventoryData.productId}`, `store:${inventoryData.storeId}`]
    });
  }

  private async updateProductMatchCache(matchData: ProductMatch, result: ProductMatchResult): Promise<void> {
    const cacheKey = `match:${matchData.sourceProductId}:${matchData.targetProductId}`;
    await this?.cacheManager?.getCentralCache().set(cacheKey, { ...matchData, ...result }, {
      ttl: 86400, // 24 hours
      tags: [`product_match`, `product:${matchData.sourceProductId}`, `product:${matchData.targetProductId}`]
    });
  }

  private async updateDealCache(dealData: DealAnalysis, analysisResult: DealAnalysisResult): Promise<void> {
    const cacheKey = `deal:${dealData.dealId}`;
    await this?.cacheManager?.getCentralCache().set(cacheKey, { ...dealData, analysis: analysisResult }, {
      ttl: 7200, // 2 hours
      tags: [`deal`, `product:${dealData.productId}`, `store:${dealData.storeId}`]
    });
  }

  private async updateNutritionCache(productId: string, nutritionData: NutritionData): Promise<void> {
    const cacheKey = `nutrition:${productId}`;
    await this?.cacheManager?.getCentralCache().set(cacheKey, nutritionData, {
      ttl: 604800, // 7 days (nutrition data changes rarely)
      tags: [`nutrition`, `product:${productId}`]
    });
  }

  private async updateReviewCache(productId: string, analysisResult: ReviewAnalysisResult): Promise<void> {
    const cacheKey = `reviews:${productId}`;
    await this?.cacheManager?.getCentralCache().set(cacheKey, analysisResult, {
      ttl: 14400, // 4 hours
      tags: [`reviews`, `product:${productId}`]
    });
  }

  private async updateRecommendationCache(userId: string, recommendations: ProductRecommendation[]): Promise<void> {
    const cacheKey = `recommendations:${userId}`;
    await this?.cacheManager?.getCentralCache().set(cacheKey, recommendations, {
      ttl: 3600, // 1 hour
      tags: [`recommendations`, `user:${userId}`]
    });
  }

  // Mock implementations for external integrations
  private async updatePriceHistory(priceData: PriceUpdate): Promise<void> {
    // Implementation would update price history database
    this.emit('price:history_updated', {
      productId: priceData.productId,
      storeId: priceData.storeId,
      price: priceData.newPrice,
      timestamp: priceData.effectiveDate
    });
  }

  private async performProductMatching(matchData: ProductMatch): Promise<ProductMatchResult> {
    // Mock ML-based product matching
    return {
      confidence: Math.random() * 0.4 + 0.6, // 0.6 - 1.0
      matchScore: Math.random() * 100,
      attributes: matchData.attributes,
      verificationNeeded: Math.random() < 0.3
    };
  }

  private async analyzeDeal(dealData: DealAnalysis): Promise<DealAnalysisResult> {
    // Mock deal analysis
    const quality = dealData.discountPercent > 20 ? 0.8 : 0.4;
    return {
      quality,
      competitiveness: Math.random(),
      historicalComparison: 'better_than_average',
      recommendation: quality > 0.7 ? 'promote' : 'monitor'
    };
  }

  private async fetchNutritionData(productId: string): Promise<NutritionData> {
    // Mock nutrition API call
    return {
      productId,
      calories: Math.floor(Math.random() * 400) + 100,
      servingSize: '100g',
      nutrients: {
        protein: Math.random() * 20,
        carbs: Math.random() * 50,
        fat: Math.random() * 20,
        sodium: Math.random() * 1000
      },
      allergens: ['gluten', 'milk'].filter(() => Math.random() < 0.3),
      dietaryFlags: ['vegetarian', 'organic'].filter(() => Math.random() < 0.2),
      source: 'nutrition_api',
      lastUpdated: Date.now()
    };
  }

  private async analyzeReviews(productId: string, reviews: Review[]): Promise<ReviewAnalysisResult> {
    // Mock review sentiment analysis
    return {
      overallSentiment: Math.random() > 0.5 ? 'positive' : 'negative',
      sentimentScore: Math.random(),
      averageRating: Math.random() * 2 + 3, // 3-5 stars
      reviewCount: reviews?.length || 0,
      topKeywords: ['quality', 'price', 'taste'],
      issues: Math.random() < 0.3 ? ['packaging', 'freshness'] : []
    };
  }

  private async generateRecommendations(userId: string, context: unknown): Promise<ProductRecommendation[]> {
    // Mock recommendation generation
    const count = Math.floor(Math.random() * 15) + 10; // 10-25 recommendations
    return Array.from({ length: count }, (_, i) => ({
      productId: `PROD_${nanoid(6)}`,
      score: Math.random(),
      reason: 'based_on_purchase_history',
      category: 'grocery',
      rank: i + 1
    }));
  }

  // Job enqueueing helpers
  private async enqueueDealAnalysis(priceData: PriceUpdate): Promise<string> {
    const dealMessage: GroceryMessage = {
      id: nanoid(),
      type: 'grocery:deal_analysis',
      payload: {
        productId: priceData.productId,
        storeId: priceData.storeId,
        data: {
          dealId: nanoid(),
          productId: priceData.productId,
          storeId: priceData.storeId,
          originalPrice: priceData.oldPrice || priceData.newPrice * 1.2,
          discountPrice: priceData.newPrice,
          discountPercent: priceData.oldPrice 
            ? ((priceData.oldPrice - priceData.newPrice) / priceData.oldPrice) * 100
            : 20,
          validFrom: Date.now(),
          validTo: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
          dealType: 'percentage' as const,
          conditions: { source: 'price_update_trigger' }
        }
      },
      priority: 6, // Higher priority for deal analysis
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      tags: ['deal_analysis', 'price_triggered']
    };

    return await this?.messageQueue?.enqueue(this?.config?.queues.dealAnalysis, dealMessage);
  }

  private async enqueueRecommendationGeneration(dealData: DealAnalysis): Promise<string> {
    const recMessage: GroceryMessage = {
      id: nanoid(),
      type: 'grocery:recommendation_generate',
      payload: {
        productId: dealData.productId,
        storeId: dealData.storeId,
        data: {
          trigger: 'good_deal',
          dealId: dealData.dealId,
          productId: dealData.productId,
          context: 'deal_based_recommendation'
        }
      },
      priority: 4, // Lower priority for recommendations
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 2,
      tags: ['recommendation', 'deal_triggered']
    };

    return await this?.messageQueue?.enqueue(this?.config?.queues.recommendations, recMessage);
  }

  // Error handling and retry logic
  private async handleProcessingError(error: Error, message: GroceryMessage): Promise<void> {
    this.emit('job:error', {
      messageId: message.id,
      messageType: message.type,
      error: error.message,
      payload: message.payload
    });
  }

  private async shouldRetryJob(message: GroceryMessage, retryCount: number): Promise<boolean> {
    // Don't retry certain types of errors
    const nonRetryableErrors = ['validation_error', 'invalid_product_id', 'permission_denied'];
    const errorType = message.metadata?.lastError?.toLowerCase() || '';
    
    if (nonRetryableErrors.some(err => errorType.includes(err))) {
      return false;
    }

    // Limit retries based on message type
    const maxRetries: Record<string, number> = {
      'grocery:price_update': 5,
      'grocery:inventory_sync': 3,
      'grocery:product_match': 2,
      'grocery:deal_analysis': 3,
      'grocery:nutrition_fetch': 4, // External API might be temporarily down
      'grocery:review_analysis': 2,
      'grocery:recommendation_generate': 1
    };

    const typeMaxRetries = maxRetries[message.type] || 3;
    return retryCount <= typeMaxRetries;
  }

  private updateProcessingStats(queueName: string, operation: string, processingTime?: number): void {
    if (!this?.processingStats?.has(queueName)) {
      this?.processingStats?.set(queueName, {
        completed: 0,
        failed: 0,
        retry: 0,
        totalProcessingTime: 0,
        avgProcessingTime: 0
      });
    }

    const stats = this?.processingStats?.get(queueName)!;
    stats[operation]++;

    if (processingTime && operation === 'completed') {
      stats.totalProcessingTime += processingTime;
      stats.avgProcessingTime = stats.totalProcessingTime / stats.completed;
    }

    this?.processingStats?.set(queueName, stats);
  }

  // Public API methods
  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.emit('pipeline:starting');

    // Connect message queue
    await this?.messageQueue?.connect();

    // Register and start all consumers
    for (const [queueType, consumer] of this.consumers) {
      const queueConfig = this?.config?.queues as Record<string, string>;
      const queueName = queueConfig[queueType];
      if (queueName) {
        await this?.messageQueue?.registerConsumer(queueName, consumer);
        await this?.messageQueue?.startConsumer(queueName, consumer.name);
      }
    }

    this.isRunning = true;
    this.emit('pipeline:started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.emit('pipeline:stopping');
    
    // Graceful shutdown of consumers
    this.isRunning = false;
    
    this.emit('pipeline:stopped');
  }

  // Job submission methods
  public async submitPriceUpdate(priceData: PriceUpdate): Promise<string> {
    const message: GroceryMessage = {
      id: nanoid(),
      type: 'grocery:price_update',
      payload: {
        productId: priceData.productId,
        storeId: priceData.storeId,
        data: priceData
      },
      priority: 7, // High priority for price updates
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 5,
      tags: ['price_update']
    };

    return await this?.messageQueue?.enqueue(this?.config?.queues.priceUpdates, message);
  }

  public async submitInventorySync(inventoryData: InventoryUpdate): Promise<string> {
    const message: GroceryMessage = {
      id: nanoid(),
      type: 'grocery:inventory_sync',
      payload: {
        productId: inventoryData.productId,
        storeId: inventoryData.storeId,
        data: inventoryData
      },
      priority: 6,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      tags: ['inventory_sync']
    };

    return await this?.messageQueue?.enqueue(this?.config?.queues.inventorySync, message);
  }

  public async submitProductMatch(matchData: ProductMatch): Promise<string> {
    const message: GroceryMessage = {
      id: nanoid(),
      type: 'grocery:product_match',
      payload: {
        data: matchData
      },
      priority: 4,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 2,
      tags: ['product_match']
    };

    return await this?.messageQueue?.enqueue(this?.config?.queues.productMatching, message);
  }

  public async submitNutritionFetch(productId: string): Promise<string> {
    const message: GroceryMessage = {
      id: nanoid(),
      type: 'grocery:nutrition_fetch',
      payload: {
        productId,
        data: { productId, requestedAt: Date.now() }
      },
      priority: 3,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 4,
      tags: ['nutrition_fetch']
    };

    return await this?.messageQueue?.enqueue(this?.config?.queues.nutritionFetch, message);
  }

  public getProcessingStats(): Map<string, ProcessingStatistics> {
    return new Map(this.processingStats);
  }

  public async getQueueStats(): Promise<QueueStatistics[]> {
    return await this?.messageQueue?.getAllQueueStats();
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public async shutdown(): Promise<void> {
    await this.stop();
    await this?.messageQueue?.shutdown();
    this.removeAllListeners();
  }
}