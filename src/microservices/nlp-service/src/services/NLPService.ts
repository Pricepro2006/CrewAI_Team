/**
 * NLP Service - Core service class that integrates with GroceryNLPQueue
 * Handles all NLP operations with 2-operation limit respect
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { GroceryNLPQueue } from '../../../api/services/GroceryNLPQueue.js';
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
} from '../types/index.js';

export class NLPService extends EventEmitter {
  private config: NLPServiceConfig;
  private queue: GroceryNLPQueue;
  private status: ServiceStatus;
  private startedAt: number;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: NLPServiceConfig) {
    super();
    this.config = config;
    this.queue = GroceryNLPQueue.getInstance();
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
      version: this?.status?.version,
      maxConcurrent: this?.config?.queue.maxConcurrent
    });
  }

  /**
   * Start the NLP service
   */
  async start(): Promise<void> {
    try {
      this.emit('starting');
      this?.status?.status = 'starting';
      
      // Initialize dependencies
      await this.initializeDependencies();
      
      // Start health check monitoring
      if (this?.config?.monitoring.enabled) {
        this.startHealthChecks();
        this.startMetricsCollection();
      }
      
      this?.status?.status = 'healthy';
      this.emit('started');
      
      logger.info('NLP Service started successfully', 'NLP_SERVICE', {
        port: this?.config?.port,
        grpcPort: this?.config?.grpcPort,
        maxConcurrent: this?.config?.queue.maxConcurrent
      });
      
    } catch (error) {
      this?.status?.status = 'unhealthy';
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
      const result = await this?.queue?.enqueue<GroceryNLPResult>(
        () => this.performNLPAnalysis(query, metadata),
        priority,
        timeout,
        query,
        { ...metadata, requestId }
      );
      
      const processingTime = Date.now() - startTime;
      
      logger.debug('NLP query processed successfully', 'NLP_SERVICE', {
        requestId,
        processingTime,
        entitiesFound: result?.entities?.length,
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
        if (error?.message?.includes('timeout')) {
          throw this.createError('TIMEOUT', `Query processing timeout after ${timeout || this?.config?.queue.defaultTimeout}ms`, 408, requestId);
        } else if (error?.message?.includes('overflow')) {
          throw this.createError('QUEUE_OVERFLOW', 'Queue is at capacity', 429, requestId);
        }
      }
      
      throw this.createError('PROCESSING_ERROR', `Failed to process query: ${error}`, 500, requestId);
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
    
    if (!queries || queries?.length || 0 === 0) {
      throw this.createError('INVALID_QUERY', 'Batch cannot be empty', 400);
    }
    
    const batchId = batchOptions?.batchId || this.generateBatchId();
    const startTime = Date.now();
    
    logger.info('Processing NLP batch', 'NLP_SERVICE', {
      batchId,
      queryCount: queries?.length || 0,
      priority,
      timeout
    });
    
    try {
      // Create batch operations
      const operations = queries?.map(({ query, metadata }) => 
        () => this.performNLPAnalysis(query, metadata)
      );
      
      // Process batch with queue
      const results = await this?.queue?.enqueueBatch<GroceryNLPResult>(
        operations,
        priority,
        {
          batchId,
          timeout,
          failFast: batchOptions?.failFast,
          maxConcurrency: batchOptions?.maxConcurrency
        }
      );
      
      const totalProcessingTime = Date.now() - startTime;
      const completedCount = results?.length || 0;
      const failedCount = queries?.length || 0 - completedCount;
      const errors: Array<Error | null> = new Array(queries?.length || 0).fill(null);
      const normalizedResults: Array<GroceryNLPResult | null> = [...results];
      
      // Pad results array if some failed
      while (normalizedResults?.length || 0 < queries?.length || 0) {
        normalizedResults.push(null);
      }
      
      logger.info('NLP batch processed', 'NLP_SERVICE', {
        batchId,
        totalProcessingTime,
        completedCount,
        failedCount,
        successRate: completedCount / queries?.length || 0
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
        queryCount: queries?.length || 0
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
    const queueMetrics = this?.queue?.getMetrics();
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
        throughput: queueMetrics?.throughput?.last1min
      },
      resources: {
        cpu: {
          usage: process.cpuUsage().user / 1000000, // Convert to seconds
          load: [] // Would need additional monitoring for load averages
        },
        memory: {
          used: memUsage.used,
          total: memUsage.used + memUsage.available || memUsage.heapTotal * 2,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal
        }
      },
      dependencies: {
        ollama: {
          status: this?.status?.dependencies.ollama,
          lastCheck: this?.status?.lastHealthCheck
        },
        redis: {
          status: this?.status?.dependencies.redis,
          lastCheck: this?.status?.lastHealthCheck
        }
      }
    };
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return this?.queue?.getStatus();
  }

  /**
   * Clear the queue (emergency only)
   */
  clearQueue(): void {
    logger.warn('Emergency queue clear requested', 'NLP_SERVICE');
    this?.queue?.clearQueue();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(timeout: number = this?.config?.shutdown.timeout): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    this?.status?.status = 'stopping';
    this.emit('stopping');
    
    logger.info('Starting graceful shutdown', 'NLP_SERVICE', { timeout });
    
    try {
      // Stop accepting new requests
      this.clearIntervals();
      
      // Wait for queue to drain or timeout
      const shutdownStart = Date.now();
      while (this?.queue?.getStatus().activeRequests > 0 && (Date.now() - shutdownStart) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Final queue status
      const finalStatus = this?.queue?.getStatus();
      if (finalStatus.activeRequests > 0) {
        logger.warn('Shutdown timeout reached with active requests', 'NLP_SERVICE', {
          activeRequests: finalStatus.activeRequests,
          queueSize: finalStatus.queueSize
        });
      }
      
      this?.status?.status = 'stopped';
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
   * Perform actual NLP analysis (mock implementation - replace with real NLP)
   */
  private async performNLPAnalysis(query: string, metadata?: Record<string, any>): Promise<GroceryNLPResult> {
    // This would integrate with Ollama or other NLP models
    // For now, providing a comprehensive mock implementation
    
    const startTime = Date.now();
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Mock entity extraction
    const entities: GroceryEntity[] = this.extractEntities(query);
    
    // Mock intent detection
    const intent: GroceryIntent = this.detectIntent(query, entities);
    
    // Mock normalization
    const normalizedItems: NormalizedGroceryItem[] = this.normalizeItems(entities);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(entities, intent);
    
    const processingTime = Date.now() - startTime;
    
    return {
      entities,
      intent,
      normalizedItems,
      confidence,
      processingMetadata: {
        model: 'mock-nlp-v1',
        version: '1.0.0',
        processingTime,
        cacheHit: false,
        patterns: ['quantity_product', 'action_detection']
      }
    };
  }

  /**
   * Mock entity extraction
   */
  private extractEntities(query: string): GroceryEntity[] {
    const entities: GroceryEntity[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Action words
    const actions = ['add', 'buy', 'get', 'purchase', 'remove', 'delete', 'clear'];
    for (const action of actions) {
      const index = lowerQuery.indexOf(action);
      if (index !== -1) {
        entities.push({
          type: 'action',
          value: action,
          confidence: 0.9,
          startIndex: index,
          endIndex: index + action?.length || 0
        });
        break;
      }
    }
    
    // Quantities (simple regex)
    const quantityMatch = query.match(/(\d+)\s*(lbs?|pounds?|kg|grams?|oz|ounces?|cups?|pieces?|items?)?/i);
    if (quantityMatch) {
      entities.push({
        type: 'quantity',
        value: quantityMatch[1],
        confidence: 0.95,
        startIndex: quantityMatch.index || 0,
        endIndex: (quantityMatch.index || 0) + quantityMatch[0].length
      });
      
      if (quantityMatch[2]) {
        entities.push({
          type: 'unit',
          value: quantityMatch[2],
          confidence: 0.9,
          startIndex: (quantityMatch.index || 0) + quantityMatch[1].length,
          endIndex: (quantityMatch.index || 0) + quantityMatch[0].length
        });
      }
    }
    
    // Common products (mock detection)
    const products = ['milk', 'bread', 'eggs', 'cheese', 'butter', 'apples', 'bananas', 'chicken', 'beef', 'rice'];
    for (const product of products) {
      const index = lowerQuery.indexOf(product);
      if (index !== -1) {
        entities.push({
          type: 'product',
          value: product,
          confidence: 0.85,
          startIndex: index,
          endIndex: index + product?.length || 0,
          metadata: {
            category: this.getCategoryForProduct(product)
          }
        });
      }
    }
    
    return entities;
  }

  /**
   * Mock intent detection
   */
  private detectIntent(query: string, entities: GroceryEntity[]): GroceryIntent {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('add') || lowerQuery.includes('buy') || lowerQuery.includes('get')) {
      return {
        action: 'add',
        confidence: 0.9,
        modifiers: []
      };
    } else if (lowerQuery.includes('remove') || lowerQuery.includes('delete')) {
      return {
        action: 'remove',
        confidence: 0.9,
        modifiers: []
      };
    } else if (lowerQuery.includes('search') || lowerQuery.includes('find')) {
      return {
        action: 'search',
        confidence: 0.85,
        modifiers: []
      };
    } else if (lowerQuery.includes('list') || lowerQuery.includes('show')) {
      return {
        action: 'list',
        confidence: 0.8,
        modifiers: []
      };
    }
    
    // Default to add if products are mentioned
    const hasProducts = entities.some(e => e.type === 'product');
    return {
      action: hasProducts ? 'add' : 'search',
      confidence: hasProducts ? 0.7 : 0.6,
      modifiers: []
    };
  }

  /**
   * Mock item normalization
   */
  private normalizeItems(entities: GroceryEntity[]): NormalizedGroceryItem[] {
    const products = entities?.filter(e => e.type === 'product');
    const quantities = entities?.filter(e => e.type === 'quantity');
    const units = entities?.filter(e => e.type === 'unit');
    
    return products?.map((product, index) => ({
      name: product.value,
      quantity: quantities[index] ? parseInt(quantities[index].value) : 1,
      unit: units[index]?.value,
      category: product.metadata?.category,
      metadata: {
        organic: product.metadata?.organic
      }
    }));
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(entities: GroceryEntity[], intent: GroceryIntent): number {
    if (entities?.length || 0 === 0) return 0.1;
    
    const avgEntityConfidence = entities.reduce((sum: any, e: any) => sum + e.confidence, 0) / entities?.length || 0;
    return (avgEntityConfidence + intent.confidence) / 2;
  }

  /**
   * Get category for product (mock)
   */
  private getCategoryForProduct(product: string): string {
    const categories: Record<string, string> = {
      'milk': 'dairy',
      'cheese': 'dairy',
      'butter': 'dairy',
      'bread': 'bakery',
      'eggs': 'dairy',
      'apples': 'produce',
      'bananas': 'produce',
      'chicken': 'meat',
      'beef': 'meat',
      'rice': 'pantry'
    };
    
    return categories[product] || 'general';
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen to queue events
    this?.queue?.on('queueUpdate', (event: any) => {
      this?.status?.queue.size = event?.data?.queueSize;
      this?.status?.queue.activeRequests = event?.data?.activeRequests;
    });
    
    // Handle process signals
    this?.config?.shutdown.signals.forEach(signal => {
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
    // Check Ollama connectivity (mock)
    try {
      // This would be a real health check to Ollama
      this?.status?.dependencies.ollama = 'healthy';
      logger.debug('Ollama connection established', 'NLP_SERVICE');
    } catch (error) {
      this?.status?.dependencies.ollama = 'unhealthy';
      logger.warn('Ollama connection failed', 'NLP_SERVICE', { error });
    }
    
    // Check Redis connectivity (mock)
    try {
      // This would be a real health check to Redis
      this?.status?.dependencies.redis = 'healthy';
      logger.debug('Redis connection established', 'NLP_SERVICE');
    } catch (error) {
      this?.status?.dependencies.redis = 'unhealthy';
      logger.warn('Redis connection failed', 'NLP_SERVICE', { error });
    }
    
    // Check queue health
    this?.status?.dependencies.queue = this?.queue?.isHealthy() ? 'healthy' : 'unhealthy';
  }

  /**
   * Start health check monitoring
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this?.config?.monitoring.healthCheckInterval);
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
    this?.status?.lastHealthCheck = Date.now();
    
    // Check queue health
    const queueHealthy = this?.queue?.isHealthy();
    this?.status?.queue.health = queueHealthy ? 'healthy' : 'unhealthy';
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    this?.status?.resources.memory = {
      used: memUsage.used,
      total: memUsage.used + (memUsage.available || memUsage.heapTotal * 2),
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };
    
    // Determine overall health
    const isHealthy = queueHealthy && 
      this?.status?.dependencies.ollama !== 'unhealthy' &&
      this?.status?.resources.memory.percentage < 90;
    
    this?.status?.status = isHealthy ? 'healthy' : 'degraded';
    
    this.emit('health-check', this.status);
  }

  /**
   * Update service status
   */
  private updateStatus(): void {
    this?.status?.uptime = Date.now() - this.startedAt;
    const queueStatus = this?.queue?.getStatus();
    this?.status?.queue.size = queueStatus.queueSize;
    this?.status?.queue.activeRequests = queueStatus.activeRequests;
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