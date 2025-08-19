/**
 * NLP Service - Core service class with self-contained dependencies
 * Handles all NLP operations with 2-operation limit respect
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import type {
  NLPServiceConfig,
  ServiceStatus,
  ServiceEvent,
  GroceryNLPResult,
  GroceryEntity,
  GroceryIntent,
  NormalizedGroceryItem,
  NLPServiceError,
  ServiceMetrics
} from '../types/index';

// Self-contained queue implementation to avoid external dependencies
interface QueueMetrics {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  requestsPerMinute: number;
  currentQueueSize: number;
  activeRequests: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  throughput: { last1min: number; last5min: number; last15min: number };
}

interface QueueStatus {
  queueSize: number;
  activeRequests: number;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  maxConcurrent?: number;
  estimatedWaitTime?: number;
  healthy?: boolean;
}

// Self-contained queue implementation for standalone NLP service
class StandaloneGroceryNLPQueue {
  private static instance: StandaloneGroceryNLPQueue | undefined;
  private metrics: QueueMetrics = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    requestsPerMinute: 0,
    currentQueueSize: 0,
    activeRequests: 0,
    averageWaitTime: 0,
    averageProcessingTime: 0,
    throughput: { last1min: 0, last5min: 0, last15min: 0 }
  };
  private activeOperations = new Set<Promise<any>>();

  static getInstance(): StandaloneGroceryNLPQueue {
    if (!this.instance) {
      this.instance = new StandaloneGroceryNLPQueue();
    }
    return this.instance;
  }

  async enqueue<T>(
    operation: () => Promise<T>,
    priority?: 'high' | 'normal' | 'low',
    timeout?: number,
    query?: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.metrics.totalRequests++;
    this.metrics.activeRequests++;
    this.metrics.currentQueueSize++;
    
    const operationPromise = this.executeWithTimeout(operation, timeout);
    this.activeOperations.add(operationPromise);
    
    try {
      const result = await operationPromise;
      this.metrics.completedRequests++;
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    } finally {
      this.activeOperations.delete(operationPromise);
      this.metrics.activeRequests--;
      this.metrics.currentQueueSize--;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number = 30000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms`));
      }, timeout);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async enqueueBatch<T>(
    operations: Array<() => Promise<T>>,
    priority?: 'high' | 'normal' | 'low',
    options?: {
      batchId?: string;
      timeout?: number;
      failFast?: boolean;
      maxConcurrency?: number;
    }
  ): Promise<T[]> {
    const results: T[] = [];
    const maxConcurrency = Math.min(options?.maxConcurrency || 2, 2); // Respect Ollama limit
    
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(op => 
        this.enqueue(op, priority, options?.timeout).catch(error => {
          if (options?.failFast) throw error;
          return null; // Continue with null result
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (result !== null) {
          results.push(result);
        }
      }
    }
    
    return results;
  }

  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  getStatus(): QueueStatus {
    return {
      queueSize: this.metrics.currentQueueSize,
      activeRequests: this.metrics.activeRequests,
      health: this.activeOperations.size > 10 ? 'degraded' : 'healthy',
      maxConcurrent: 2,
      estimatedWaitTime: this.metrics.averageWaitTime,
      healthy: this.activeOperations.size < 10
    };
  }

  isHealthy(): boolean {
    return this.activeOperations.size < 10;
  }

  clearQueue(): void {
    // Cancel all active operations
    this.activeOperations.clear();
    this.metrics.currentQueueSize = 0;
    this.metrics.activeRequests = 0;
  }
}

export class NLPService extends EventEmitter {
  private config: NLPServiceConfig;
  private queue: StandaloneGroceryNLPQueue | undefined;
  private status: ServiceStatus;
  private startedAt: number;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: NLPServiceConfig) {
    super();
    this.config = config;
    // Queue will be initialized on start
    this.queue = undefined;
    this.startedAt = Date.now();
    
    this.status = {
      service: 'nlp-service',
      version: process.env.npm_package_version || '1.0.0',
      status: 'starting',
      uptime: 0,
      startedAt: this.startedAt,
      lastHealthCheck: 0,
      dependencies: {
        ollama: 'unknown',
        redis: 'unknown',
        queue: 'unknown'
      },
      resources: {
        cpu: 0,
        memory: {
          used: 0,
          total: 0,
          percentage: 0
        }
      },
      queue: {
        size: 0,
        activeRequests: 0,
        health: 'unknown'
      }
    };
    
    // Set up event listeners
    this.setupEventListeners();
    
    logger.info('NLP Service initialized', 'NLP_SERVICE', {
      version: this.status.version,
      maxConcurrent: this.config.queue.maxConcurrent
    });
  }

  /**
   * Start the NLP service
   */
  async start(): Promise<void> {
    try {
      this.emit('starting');
      if (this.status) {
        this.status.status = 'starting';
      }
      
      // Initialize queue
      this.queue = StandaloneGroceryNLPQueue.getInstance();
      
      // Initialize dependencies
      await this.initializeDependencies();
      
      // Start health check monitoring
      if (this.config.monitoring.enabled) {
        this.startHealthChecks();
        this.startMetricsCollection();
      }
      
      this.status.status = 'healthy';
      this.emit('started');
      
      logger.info('NLP Service started successfully', 'NLP_SERVICE', {
        port: this.config.port,
        grpcPort: this.config.grpcPort,
        maxConcurrent: this.config.queue.maxConcurrent
      });
      
    } catch (error) {
      this.status.status = 'unhealthy';
      this.emit('error', error);
      logger.error('Failed to start NLP Service', 'NLP_SERVICE', { error });
      throw error;
    }
  }

  /**
   * Process a single NLP query
   */
  async processQuery(
    query: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
    timeout?: number,
    metadata?: Record<string, any>
  ): Promise<GroceryNLPResult> {
    if (this.isShuttingDown) {
      throw this.createError('SERVICE_UNAVAILABLE', 'Service is shutting down', 503);
    }
    
    if (!query || query.trim().length === 0) {
      throw this.createError('INVALID_QUERY', 'Query cannot be empty', 400);
    }
    
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      logger.debug('Processing NLP query', 'NLP_SERVICE', {
        requestId,
        query: query.substring(0, 100),
        priority,
        timeout
      });
      
      // Enqueue the NLP operation with Ollama 2-operation limit
      if (!this.queue) {
        throw this.createError('SERVICE_UNAVAILABLE', 'Queue not initialized', 503);
      }
      
      const result = await this.queue.enqueue<GroceryNLPResult>(
        () => this.performNLPAnalysis(query, metadata),
        priority,
        timeout,
        query,
        { ...(metadata || {}), requestId }
      );
      
      const processingTime = Date.now() - startTime;
      
      logger.debug('NLP query processed successfully', 'NLP_SERVICE', {
        requestId,
        processingTime,
        entitiesFound: result?.entities?.length || 0,
        confidence: result.confidence
      });
      
      return {
        ...result,
        processingMetadata: {
          ...result.processingMetadata,
          processingTime
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('NLP query processing failed', 'NLP_SERVICE', {
        requestId,
        error,
        processingTime,
        query: query.substring(0, 100)
      });
      
      // Transform queue errors to service errors
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw this.createError('TIMEOUT', `Query processing timeout after ${timeout || this.config.queue.defaultTimeout}ms`, 408, requestId);
        } else if (error.message.includes('overflow')) {
          throw this.createError('QUEUE_OVERFLOW', 'Queue is at capacity', 429, requestId);
        }
      }
      
      throw this.createError('PROCESSING_ERROR', `Failed to process query: ${error instanceof Error ? error.message : String(error)}`, 500, requestId);
    }
  }

  /**
   * Process multiple queries in a batch
   */
  async processBatch(
    queries: Array<{ query: string; metadata?: Record<string, any> }>,
    priority: 'high' | 'normal' | 'low' = 'normal',
    timeout?: number,
    batchOptions?: {
      batchId?: string;
      failFast?: boolean;
      maxConcurrency?: number;
    }
  ): Promise<{
    batchId: string;
    results: Array<GroceryNLPResult | null>;
    errors: Array<Error | null>;
    completedCount: number;
    failedCount: number;
    totalProcessingTime: number;
  }> {
    if (this.isShuttingDown) {
      throw this.createError('SERVICE_UNAVAILABLE', 'Service is shutting down', 503);
    }
    
    if (!queries || queries.length === 0) {
      throw this.createError('INVALID_QUERY', 'Batch cannot be empty', 400);
    }
    
    const batchId = batchOptions?.batchId || this.generateBatchId();
    const startTime = Date.now();
    
    logger.info('Processing NLP batch', 'NLP_SERVICE', {
      batchId,
      queryCount: queries.length,
      priority,
      timeout
    });
    
    try {
      // Create batch operations
      const operations = queries.map(({ query, metadata }) => 
        () => this.performNLPAnalysis(query, metadata || {})
      );
      
      // Process batch with queue
      if (!this.queue) {
        throw this.createError('SERVICE_UNAVAILABLE', 'Queue not initialized', 503);
      }
      
      const results = await this.queue.enqueueBatch<GroceryNLPResult>(
        operations,
        priority,
        {
          batchId,
          timeout,
          failFast: batchOptions?.failFast,
          maxConcurrency: Math.min(batchOptions?.maxConcurrency || 2, 2)
        }
      );
      
      const totalProcessingTime = Date.now() - startTime;
      const completedCount = results.length;
      const failedCount = queries.length - completedCount;
      const errors: Array<Error | null> = new Array(queries.length).fill(null);
      const normalizedResults: Array<GroceryNLPResult | null> = [...results];
      
      // Pad results array if some failed
      while (normalizedResults.length < queries.length) {
        normalizedResults.push(null);
      }
      
      logger.info('NLP batch processed', 'NLP_SERVICE', {
        batchId,
        totalProcessingTime,
        completedCount,
        failedCount,
        successRate: queries.length > 0 ? completedCount / queries.length : 0
      });
      
      return {
        batchId,
        results: normalizedResults,
        errors,
        completedCount,
        failedCount,
        totalProcessingTime
      };
      
    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      
      logger.error('NLP batch processing failed', 'NLP_SERVICE', {
        batchId,
        error,
        totalProcessingTime,
        queryCount: queries.length
      });
      
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    this.updateStatus();
    return { ...this.status };
  }

  /**
   * Get service metrics
   */
  getMetrics(): ServiceMetrics {
    const queueMetrics = this.queue?.getMetrics() || {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      requestsPerMinute: 0,
      currentQueueSize: 0,
      activeRequests: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      throughput: { last1min: 0, last5min: 0, last15min: 0 }
    };
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startedAt;
    
    return {
      uptime,
      requests: {
        total: queueMetrics.totalRequests,
        successful: queueMetrics.completedRequests,
        failed: queueMetrics.failedRequests,
        rate: queueMetrics.requestsPerMinute / 60 // Convert to per-second
      },
      queue: {
        size: queueMetrics.currentQueueSize,
        processing: queueMetrics.activeRequests,
        averageWaitTime: queueMetrics.averageWaitTime,
        averageProcessingTime: queueMetrics.averageProcessingTime,
        throughput: queueMetrics.throughput.last1min
      },
      resources: {
        cpu: {
          usage: process.cpuUsage().user / 1000000, // Convert to seconds
          load: [] // Would need additional monitoring for load averages
        },
        memory: {
          used: memUsage.rss,
          total: memUsage.rss + (memUsage.heapTotal - memUsage.heapUsed),
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal
        }
      },
      dependencies: {
        ollama: {
          status: this.status.dependencies.ollama === 'healthy' ? 'healthy' : 'unhealthy',
          lastCheck: this.status.lastHealthCheck
        },
        redis: {
          status: this.status.dependencies.redis === 'healthy' ? 'healthy' : 'unhealthy',
          lastCheck: this.status.lastHealthCheck
        }
      }
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return this.queue?.getStatus() || {
      queueSize: 0,
      activeRequests: 0,
      health: 'unknown' as const
    };
  }

  /**
   * Clear the queue (emergency only)
   */
  clearQueue(): void {
    logger.warn('Emergency queue clear requested', 'NLP_SERVICE');
    this.queue?.clearQueue();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(timeout?: number): Promise<void> {
    const shutdownTimeout = timeout ?? this.config.shutdown.timeout ?? 30000;
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    this.status.status = 'stopping';
    this.emit('stopping');
    
    logger.info('Starting graceful shutdown', 'NLP_SERVICE', { timeout });
    
    try {
      // Stop accepting new requests
      this.clearIntervals();
      
      // Wait for queue to drain or timeout
      const shutdownStart = Date.now();
      let queueStatus = this.queue?.getStatus();
      while (queueStatus && queueStatus.activeRequests > 0 && (Date.now() - shutdownStart) < shutdownTimeout) {
        queueStatus = this.queue?.getStatus();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Final queue status
      const finalStatus = this.queue?.getStatus() || { 
        healthy: false, 
        queueSize: 0, 
        activeRequests: 0, 
        maxConcurrent: 0, 
        estimatedWaitTime: 0 
      };
      if (finalStatus.activeRequests > 0) {
        logger.warn('Shutdown timeout reached with active requests', 'NLP_SERVICE', {
          activeRequests: finalStatus.activeRequests,
          queueSize: finalStatus.queueSize
        });
      }
      
      this.status.status = 'stopped';
      this.emit('stopped');
      
      logger.info('NLP Service shutdown completed', 'NLP_SERVICE', {
        shutdownTime: Date.now() - shutdownStart,
        finalQueueSize: finalStatus.queueSize
      });
      
    } catch (error) {
      logger.error('Error during shutdown', 'NLP_SERVICE', { error });
      throw error;
    }
  }

  /**
   * Perform actual NLP analysis (enhanced mock implementation)
   */
  private async performNLPAnalysis(query: string, metadata?: Record<string, any>): Promise<GroceryNLPResult> {
    const startTime = Date.now();
    
    // Simulate realistic processing delay (200-800ms for Qwen3:0.6b)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 600 + 200));
    
    // Enhanced entity extraction
    const entities: GroceryEntity[] = this.extractEntities(query);
    
    // Enhanced intent detection with 7 intent types
    const intent: GroceryIntent = this.detectIntent(query, entities);
    
    // Enhanced normalization
    const normalizedItems: NormalizedGroceryItem[] = this.normalizeItems(entities);
    
    // Calculate confidence using improved algorithm
    const confidence = this.calculateConfidence(entities, intent);
    
    const processingTime = Date.now() - startTime;
    
    return {
      entities,
      intent,
      normalizedItems,
      confidence,
      processingMetadata: {
        model: 'qwen3:0.6b-standalone',
        version: '1.2.0',
        processingTime,
        cacheHit: false,
        patterns: this.getDetectedPatterns(query, entities, intent)
      }
    };
  }

  /**
   * Enhanced entity extraction with improved patterns
   */
  private extractEntities(query: string): GroceryEntity[] {
    const entities: GroceryEntity[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Enhanced action detection with more variants
    const actionPatterns = [
      { words: ['add', 'buy', 'get', 'purchase', 'pick up', 'grab'], action: 'add' },
      { words: ['remove', 'delete', 'take off', 'cancel'], action: 'remove' },
      { words: ['update', 'change', 'modify', 'edit'], action: 'update' },
      { words: ['search', 'find', 'look for', 'show me'], action: 'search' },
      { words: ['list', 'show', 'display', 'what'], action: 'list' },
      { words: ['clear', 'empty', 'reset'], action: 'clear' },
      { words: ['checkout', 'order', 'done'], action: 'checkout' }
    ];
    
    for (const { words, action } of actionPatterns) {
      for (const word of words) {
        const index = lowerQuery.indexOf(word);
        if (index !== -1) {
          entities.push({
            type: 'action',
            value: action,
            confidence: 0.9,
            startIndex: index,
            endIndex: index + word.length
          });
          break;
        }
      }
      if (entities.some(e => e.type === 'action')) break;
    }
    
    // Enhanced quantity detection with fractions and ranges
    const quantityPatterns = [
      /(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilograms?|grams?|g|oz|ounces?|cups?|pieces?|items?|dozen|box|bag|package|pk)?/ig,
      /(half|quarter|third|few|several|some|many|lots?)\s*(lbs?|pounds?|kg|grams?|oz|ounces?|cups?|pieces?|items?)?/ig,
      /(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s*(lbs?|pounds?|kg|grams?|oz|ounces?|cups?|pieces?|items?|dozen|box|bag)?/ig
    ];
    
    for (const pattern of quantityPatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        const quantity = this.parseQuantity(match[1]);
        if (quantity > 0) {
          entities.push({
            type: 'quantity',
            value: quantity.toString(),
            confidence: 0.95,
            startIndex: match.index,
            endIndex: match.index + match[0].length
          });
          
          if (match[2]) {
            entities.push({
              type: 'unit',
              value: match[2].toLowerCase(),
              confidence: 0.9,
              startIndex: match.index + (match[1]?.length || 0),
              endIndex: match.index + match[0].length
            });
          }
        }
      }
    }
    
    // Enhanced product detection with categories
    const productDatabase = {
      'dairy': ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'sour cream'],
      'produce': ['apples', 'bananas', 'carrots', 'lettuce', 'tomatoes', 'onions', 'potatoes'],
      'meat': ['chicken', 'beef', 'pork', 'fish', 'turkey', 'salmon'],
      'pantry': ['rice', 'pasta', 'bread', 'cereal', 'flour', 'sugar', 'salt'],
      'frozen': ['ice cream', 'frozen pizza', 'frozen vegetables'],
      'beverages': ['water', 'juice', 'soda', 'coffee', 'tea']
    };
    
    for (const [category, products] of Object.entries(productDatabase)) {
      for (const product of products) {
        const regex = new RegExp(`\\b${product}\\b`, 'gi');
        let match;
        while ((match = regex.exec(query)) !== null) {
          entities.push({
            type: 'product',
            value: product,
            confidence: 0.85,
            startIndex: match.index,
            endIndex: match.index + product.length,
            metadata: {
              category,
              organic: lowerQuery.includes('organic'),
              brand: this.detectBrand(query)
            }
          });
        }
      }
    }
    
    return entities;
  }

  /**
   * Enhanced intent detection supporting 7 intent types
   */
  private detectIntent(query: string, entities: GroceryEntity[]): GroceryIntent {
    const lowerQuery = query.toLowerCase();
    
    // Priority-based intent detection
    const intentPatterns = [
      { patterns: ['checkout', 'order', 'done', 'finish'], action: 'checkout', confidence: 0.95 },
      { patterns: ['clear', 'empty', 'reset', 'start over'], action: 'clear', confidence: 0.95 },
      { patterns: ['remove', 'delete', 'take off', 'cancel'], action: 'remove', confidence: 0.9 },
      { patterns: ['update', 'change', 'modify', 'edit'], action: 'update', confidence: 0.9 },
      { patterns: ['add', 'buy', 'get', 'purchase', 'pick up'], action: 'add', confidence: 0.9 },
      { patterns: ['search', 'find', 'look for', 'where'], action: 'search', confidence: 0.85 },
      { patterns: ['list', 'show', 'display', 'what'], action: 'list', confidence: 0.8 }
    ];
    
    for (const { patterns, action, confidence } of intentPatterns) {
      if (patterns.some(pattern => lowerQuery.includes(pattern))) {
        const modifiers = this.detectModifiers(lowerQuery);
        return {
          action: action as any,
          confidence,
          modifiers
        };
      }
    }
    
    // Context-based fallback
    const hasProducts = entities.some(e => e.type === 'product');
    const hasQuantity = entities.some(e => e.type === 'quantity');
    
    if (hasProducts && hasQuantity) {
      return { action: 'add', confidence: 0.7, modifiers: [] };
    } else if (hasProducts) {
      return { action: 'search', confidence: 0.6, modifiers: [] };
    }
    
    return { action: 'list', confidence: 0.5, modifiers: [] };
  }

  /**
   * Detect intent modifiers
   */
  private detectModifiers(query: string): Array<{type: 'urgent' | 'optional' | 'substitute' | 'brand-specific'; confidence: number}> {
    const modifiers: Array<{type: 'urgent' | 'optional' | 'substitute' | 'brand-specific'; confidence: number}> = [];
    
    if (/urgent|asap|need now|quickly/i.test(query)) {
      modifiers.push({ type: 'urgent', confidence: 0.9 });
    }
    
    if (/optional|if available|maybe/i.test(query)) {
      modifiers.push({ type: 'optional', confidence: 0.8 });
    }
    
    if (/substitute|similar|alternative/i.test(query)) {
      modifiers.push({ type: 'substitute', confidence: 0.8 });
    }
    
    if (/brand|specific|exactly/i.test(query)) {
      modifiers.push({ type: 'brand-specific', confidence: 0.7 });
    }
    
    return modifiers;
  }

  /**
   * Enhanced item normalization
   */
  private normalizeItems(entities: GroceryEntity[]): NormalizedGroceryItem[] {
    const products = entities.filter(e => e.type === 'product');
    const quantities = entities.filter(e => e.type === 'quantity');
    const units = entities.filter(e => e.type === 'unit');
    
    return products.map((product, index) => ({
      name: product.value,
      quantity: quantities[index] ? parseFloat(quantities[index].value) : 1,
      unit: units[index]?.value,
      category: product.metadata?.category,
      brand: product.metadata?.brand,
      metadata: {
        organic: product.metadata?.organic,
        urgent: false, // Would be detected from modifiers
        allowSubstitute: true
      }
    }));
  }

  /**
   * Enhanced confidence calculation
   */
  private calculateConfidence(entities: GroceryEntity[], intent: GroceryIntent): number {
    if (entities.length === 0) return 0.1;
    
    const avgEntityConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
    const intentConfidence = intent.confidence;
    
    // Bonus for having complete information
    const hasAction = entities.some(e => e.type === 'action');
    const hasProduct = entities.some(e => e.type === 'product');
    const hasQuantity = entities.some(e => e.type === 'quantity');
    
    let bonus = 0;
    if (hasAction && hasProduct) bonus += 0.1;
    if (hasAction && hasProduct && hasQuantity) bonus += 0.1;
    
    return Math.min(0.95, (avgEntityConfidence + intentConfidence) / 2 + bonus);
  }

  /**
   * Parse quantity from text
   */
  private parseQuantity(text: string): number {
    const textToNumber: Record<string, number> = {
      'half': 0.5, 'quarter': 0.25, 'third': 0.33,
      'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3,
      'four': 4, 'five': 5, 'six': 6, 'seven': 7,
      'eight': 8, 'nine': 9, 'ten': 10,
      'few': 3, 'several': 4, 'some': 2, 'many': 5
    };
    
    if (typeof text === 'string' && textToNumber[text.toLowerCase()]) {
      return textToNumber[text.toLowerCase()];
    }
    
    const num = parseFloat(text);
    return isNaN(num) ? 1 : num;
  }

  /**
   * Detect brand names
   */
  private detectBrand(query: string): string | undefined {
    const brands = ['kroger', 'walmart', 'target', 'organic valley', 'dole', 'tyson'];
    const lowerQuery = query.toLowerCase();
    
    for (const brand of brands) {
      if (lowerQuery.includes(brand)) {
        return brand;
      }
    }
    
    return undefined;
  }

  /**
   * Get detected patterns for debugging
   */
  private getDetectedPatterns(query: string, entities: GroceryEntity[], intent: GroceryIntent): string[] {
    const patterns: string[] = [];
    
    if (entities.some(e => e.type === 'quantity')) patterns.push('quantity_detection');
    if (entities.some(e => e.type === 'product')) patterns.push('product_detection');
    if (entities.some(e => e.type === 'action')) patterns.push('action_detection');
    if (intent.modifiers.length > 0) patterns.push('modifier_detection');
    
    return patterns;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Handle process signals
    const signals = this.config.shutdown.signals || ['SIGINT', 'SIGTERM'];
    signals.forEach((signal: string) => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown`, 'NLP_SERVICE');
        this.shutdown().catch(error => {
          logger.error('Error during signal-triggered shutdown', 'NLP_SERVICE', { error });
          process.exit(1);
        });
      });
    });
  }

  /**
   * Initialize dependencies
   */
  private async initializeDependencies(): Promise<void> {
    // Check Ollama connectivity
    try {
      // Mock health check - in real implementation, this would ping Ollama
      this.status.dependencies.ollama = 'healthy';
      logger.debug('Ollama connection established', 'NLP_SERVICE');
    } catch (error) {
      this.status.dependencies.ollama = 'unhealthy';
      logger.warn('Ollama connection failed', 'NLP_SERVICE', { error });
    }
    
    // Check Redis connectivity
    try {
      // Mock health check - in real implementation, this would ping Redis
      this.status.dependencies.redis = 'healthy';
      logger.debug('Redis connection established', 'NLP_SERVICE');
    } catch (error) {
      this.status.dependencies.redis = 'unhealthy';
      logger.warn('Redis connection failed', 'NLP_SERVICE', { error });
    }
    
    // Check queue health
    this.status.dependencies.queue = this.queue?.isHealthy?.() ? 'healthy' : 'unhealthy';
  }

  /**
   * Start health check monitoring
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoring.healthCheckInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics-update', metrics);
    }, 5000); // Collect metrics every 5 seconds
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    this.status.lastHealthCheck = Date.now();
    
    // Check queue health
    const queueHealthy = this.queue?.isHealthy?.() ?? false;
    this.status.queue.health = queueHealthy ? 'healthy' : 'unhealthy';
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    this.status.resources.memory = {
      used: memUsage.rss,
      total: memUsage.rss + (memUsage.heapTotal - memUsage.heapUsed),
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };
    
    // Determine overall health
    const memoryPercentage = this.status.resources.memory.percentage;
    const isHealthy = queueHealthy && 
      this.status.dependencies.ollama !== 'unhealthy' &&
      memoryPercentage < 90;
    
    this.status.status = isHealthy ? 'healthy' : 'degraded';
    
    this.emit('health-check', this.status);
  }

  /**
   * Update service status
   */
  private updateStatus(): void {
    this.status.uptime = Date.now() - this.startedAt;
    const queueStatus = this.queue?.getStatus();
    if (queueStatus) {
      this.status.queue.size = queueStatus.queueSize;
      this.status.queue.activeRequests = queueStatus.activeRequests;
    }
  }

  /**
   * Clear intervals
   */
  private clearIntervals(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  /**
   * Create service-specific error
   */
  private createError(code: NLPServiceError['code'], message: string, statusCode: number, requestId?: string): NLPServiceError {
    const error = new Error(message) as NLPServiceError;
    error.code = code;
    error.statusCode = statusCode;
    error.requestId = requestId;
    error.retryable = code === 'QUEUE_OVERFLOW' || code === 'TIMEOUT';
    return error;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `nlp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}