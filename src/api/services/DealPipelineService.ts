/**
 * Real-Time Deal Detection Pipeline Service
 * Orchestrates continuous price monitoring, deal detection, and notification delivery
 */

import { Logger } from "../../utils/logger.js";
const logger = Logger.getInstance();
import { WalmartPriceFetcher } from "./WalmartPriceFetcher.js";
import { PriceHistoryService } from "./PriceHistoryService.js";
import { DealDetectionEngine } from "./DealDetectionEngine.js";
import { DealWebSocketService } from "./DealWebSocketService.js";
import { EventEmitter } from "events";
import type { WalmartProduct } from "../../types/walmart-grocery.js";
import type { DetectedDeal } from "./DealDetectionEngine.js";
import type { PriceRecord } from "./PriceHistoryService.js";

export interface PipelineConfig {
  // Processing intervals
  priceUpdateIntervalMs: number;       // How often to fetch new prices
  dealDetectionIntervalMs: number;     // How often to run deal detection
  alertCheckIntervalMs: number;        // How often to check user alerts
  
  // Batch processing settings
  maxProductsPerBatch: number;         // Max products to process at once
  maxConcurrentRequests: number;       // Max concurrent API requests
  delayBetweenRequestsMs: number;      // Delay between individual requests
  
  // Deal detection settings
  minSavingsPercentage: number;        // Minimum savings to consider a deal
  maxDealsPerRun: number;             // Maximum deals to process per run
  enableSeasonalDetection: boolean;    // Enable seasonal deal detection
  enableBulkDetection: boolean;        // Enable bulk discount detection
  
  // Notification settings
  enableRealTimeNotifications: boolean; // Enable real-time WebSocket notifications
  batchNotifications: boolean;          // Batch notifications vs send immediately
  maxNotificationsPerUser: number;      // Max notifications per user per hour
  
  // Data retention
  priceHistoryDays: number;            // Days to keep price history
  dealHistoryDays: number;             // Days to keep deal records
  cleanupIntervalHours: number;        // Hours between cleanup runs
}

export interface PipelineMetrics {
  // Processing stats
  totalProductsMonitored: number;
  pricesUpdatedLastHour: number;
  dealsDetectedLastHour: number;
  alertsTriggeredLastHour: number;
  
  // Performance metrics
  avgPriceUpdateTime: number;          // ms
  avgDealDetectionTime: number;        // ms
  successRate: number;                 // %
  errorRate: number;                   // %
  
  // System health
  lastPriceUpdateAt: string;
  lastDealDetectionAt: string;
  lastAlertCheckAt: string;
  queueSize: number;
  isHealthy: boolean;
  
  // Business metrics
  topCategories: Array<{
    category: string;
    dealCount: number;
    avgSavings: number;
  }>;
  recentDeals: DetectedDeal[];
}

export interface PipelineEvent {
  type: 'price_updated' | 'deal_detected' | 'alert_triggered' | 'error' | 'health_check';
  timestamp: string;
  data: any;
  metadata?: any;
}

export class DealPipelineService extends EventEmitter {
  private static instance: DealPipelineService;
  private config: PipelineConfig;
  
  // Service dependencies
  private priceFetcher: WalmartPriceFetcher;
  private priceHistory: PriceHistoryService;
  private dealDetection: DealDetectionEngine;
  private webSocket: DealWebSocketService;
  
  // Pipeline state
  private isRunning = false;
  private processingQueue: Array<{
    productId: string;
    priority: 'high' | 'normal' | 'low';
    addedAt: number;
  }> = [];
  
  // Timers
  private priceUpdateTimer?: NodeJS.Timeout;
  private dealDetectionTimer?: NodeJS.Timeout;
  private alertCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  
  // Metrics tracking
  private metrics: PipelineMetrics = {
    totalProductsMonitored: 0,
    pricesUpdatedLastHour: 0,
    dealsDetectedLastHour: 0,
    alertsTriggeredLastHour: 0,
    avgPriceUpdateTime: 0,
    avgDealDetectionTime: 0,
    successRate: 100,
    errorRate: 0,
    lastPriceUpdateAt: '',
    lastDealDetectionAt: '',
    lastAlertCheckAt: '',
    queueSize: 0,
    isHealthy: true,
    topCategories: [],
    recentDeals: []
  };
  
  // Performance tracking
  private recentTimings: {
    priceUpdates: number[];
    dealDetections: number[];
    errors: number;
    successes: number;
  } = {
    priceUpdates: [],
    dealDetections: [],
    errors: 0,
    successes: 0
  };

  private constructor(config: Partial<PipelineConfig> = {}) {
    super();
    
    this.config = {
      // Default configuration
      priceUpdateIntervalMs: 30 * 60 * 1000,      // 30 minutes
      dealDetectionIntervalMs: 15 * 60 * 1000,    // 15 minutes
      alertCheckIntervalMs: 5 * 60 * 1000,        // 5 minutes
      maxProductsPerBatch: 10,
      maxConcurrentRequests: 3,
      delayBetweenRequestsMs: 2000,                // 2 seconds
      minSavingsPercentage: 10,
      maxDealsPerRun: 100,
      enableSeasonalDetection: true,
      enableBulkDetection: true,
      enableRealTimeNotifications: true,
      batchNotifications: false,
      maxNotificationsPerUser: 10,
      priceHistoryDays: 180,
      dealHistoryDays: 30,
      cleanupIntervalHours: 24,
      ...config
    };

    // Initialize services
    this.priceFetcher = WalmartPriceFetcher.getInstance();
    this.priceHistory = PriceHistoryService.getInstance();
    this.dealDetection = DealDetectionEngine.getInstance();
    this.webSocket = DealWebSocketService.getInstance();
    
    this.setupEventHandlers();
  }

  static getInstance(config?: Partial<PipelineConfig>): DealPipelineService {
    if (!DealPipelineService.instance) {
      DealPipelineService.instance = new DealPipelineService(config);
    }
    return DealPipelineService.instance;
  }

  /**
   * Start the real-time pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Pipeline is already running", "DEAL_PIPELINE");
      return;
    }

    try {
      logger.info("Starting deal detection pipeline", "DEAL_PIPELINE", { config: this.config });
      
      this.isRunning = true;
      
      // Start all timers
      this.startPriceUpdateTimer();
      this.startDealDetectionTimer();
      this.startAlertCheckTimer();
      this.startCleanupTimer();
      this.startHealthCheckTimer();
      
      // Initial population of queue with stale products
      await this.populateInitialQueue();
      
      this.emit('pipeline_started', { timestamp: new Date().toISOString() });
      logger.info("Deal detection pipeline started successfully", "DEAL_PIPELINE");
      
    } catch (error) {
      logger.error("Failed to start pipeline", "DEAL_PIPELINE", { error });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the pipeline gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("Pipeline is not running", "DEAL_PIPELINE");
      return;
    }

    try {
      logger.info("Stopping deal detection pipeline", "DEAL_PIPELINE");
      
      this.isRunning = false;
      
      // Clear all timers
      if (this.priceUpdateTimer) clearInterval(this.priceUpdateTimer);
      if (this.dealDetectionTimer) clearInterval(this.dealDetectionTimer);
      if (this.alertCheckTimer) clearInterval(this.alertCheckTimer);
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
      
      // Clear processing queue
      this.processingQueue = [];
      
      this.emit('pipeline_stopped', { timestamp: new Date().toISOString() });
      logger.info("Deal detection pipeline stopped", "DEAL_PIPELINE");
      
    } catch (error) {
      logger.error("Error stopping pipeline", "DEAL_PIPELINE", { error });
      throw error;
    }
  }

  /**
   * Add product to monitoring queue
   */
  addProductToQueue(
    productId: string, 
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    // Avoid duplicates
    const existingIndex = this.processingQueue.findIndex(item => item.productId === productId);
    if (existingIndex >= 0) {
      // Update priority if higher
      const existingItem = this.processingQueue[existingIndex];
      if (existingItem && this.getPriorityValue(priority) > this.getPriorityValue(existingItem.priority)) {
        existingItem.priority = priority;
      }
      return;
    }

    this.processingQueue.push({
      productId,
      priority,
      addedAt: Date.now()
    });

    // Sort by priority
    this.processingQueue.sort((a, b) => 
      this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority)
    );

    this.metrics.queueSize = this.processingQueue.length;
    
    logger.debug("Product added to monitoring queue", "DEAL_PIPELINE", { 
      productId, 
      priority, 
      queueSize: this.processingQueue.length 
    });
  }

  /**
   * Add multiple products to queue
   */
  addProductsBatch(
    productIds: string[], 
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    for (const productId of productIds) {
      this.addProductToQueue(productId, priority);
    }
    
    logger.info("Batch added to monitoring queue", "DEAL_PIPELINE", { 
      count: productIds.length, 
      priority,
      queueSize: this.processingQueue.length 
    });
  }

  /**
   * Get current pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(newConfig: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart timers if running
    if (this.isRunning) {
      this.restartTimers();
    }
    
    logger.info("Pipeline configuration updated", "DEAL_PIPELINE", { config: this.config });
    this.emit('config_updated', { config: this.config });
  }

  /**
   * Force immediate price check for a product
   */
  async checkProductImmediately(productId: string): Promise<DetectedDeal[]> {
    try {
      logger.info("Running immediate product check", "DEAL_PIPELINE", { productId });
      
      // Get current live price
      const livePrice = await this.priceFetcher.fetchProductPrice(productId);
      if (!livePrice) {
        throw new Error("Could not fetch live price");
      }

      // Create mock product for processing
      const product: WalmartProduct = {
        id: productId,
        walmartId: productId,
        name: `Product ${productId}`,
        brand: '',
        category: { id: '1', name: 'General', path: ['General'], level: 1 },
        description: '',
        price: livePrice.price,
        images: [],
        inStock: livePrice.inStock,
        ratings: undefined,
        size: '',
        unit: '',
        searchKeywords: [],
        featured: false,
        dateAdded: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        livePrice: {
          price: livePrice.price,
          salePrice: livePrice.salePrice,
          wasPrice: livePrice.wasPrice,
          inStock: livePrice.inStock,
          lastUpdated: livePrice.lastUpdated.toISOString()
        }
      };

      // Record price
      await this.priceHistory.recordPrice(product, {
        currentPrice: livePrice.price,
        salePrice: livePrice.salePrice,
        wasPrice: livePrice.wasPrice,
        source: livePrice.source as any,
        confidenceScore: 1.0,
        storeLocation: livePrice.storeLocation || undefined
      });

      // Detect deals
      const deals = await this.dealDetection.detectDeals(productId, product, {
        checkSeasonality: this.config.enableSeasonalDetection,
        checkBulkOpportunities: this.config.enableBulkDetection,
        minSavingsPercentage: this.config.minSavingsPercentage
      });

      // Send notifications for any deals found
      for (const deal of deals) {
        await this.notifyDealDetected(deal);
      }

      logger.info("Immediate product check completed", "DEAL_PIPELINE", { 
        productId, 
        dealsFound: deals.length 
      });

      return deals;

    } catch (error) {
      logger.error("Failed immediate product check", "DEAL_PIPELINE", { error, productId });
      throw error;
    }
  }

  // Private methods

  private setupEventHandlers(): void {
    // Handle pipeline events
    this.on('price_updated', this.handlePriceUpdated.bind(this));
    this.on('deal_detected', this.handleDealDetected.bind(this));
    this.on('error', this.handleError.bind(this));
    
    // Handle WebSocket events
    this.webSocket.on('user_connected', (userId: string) => {
      logger.debug("User connected to deal notifications", "DEAL_PIPELINE", { userId });
    });
  }

  private async populateInitialQueue(): Promise<void> {
    try {
      // Get products that haven't been updated recently
      const staleProducts = await this.priceHistory.getStaleProducts(
        this.config.priceUpdateIntervalMs / (60 * 60 * 1000), // Convert to hours
        100 // Limit initial batch
      );

      if (staleProducts.length > 0) {
        this.addProductsBatch(staleProducts, 'normal');
        logger.info("Populated initial queue with stale products", "DEAL_PIPELINE", { 
          count: staleProducts.length 
        });
      }
    } catch (error) {
      logger.warn("Failed to populate initial queue", "DEAL_PIPELINE", { error });
    }
  }

  private startPriceUpdateTimer(): void {
    this.priceUpdateTimer = setInterval(
      () => this.processPriceUpdates(),
      this.config.priceUpdateIntervalMs
    );
    logger.debug("Price update timer started", "DEAL_PIPELINE");
  }

  private startDealDetectionTimer(): void {
    this.dealDetectionTimer = setInterval(
      () => this.processDealDetection(),
      this.config.dealDetectionIntervalMs
    );
    logger.debug("Deal detection timer started", "DEAL_PIPELINE");
  }

  private startAlertCheckTimer(): void {
    this.alertCheckTimer = setInterval(
      () => this.processAlertChecks(),
      this.config.alertCheckIntervalMs
    );
    logger.debug("Alert check timer started", "DEAL_PIPELINE");
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(
      () => this.performCleanup(),
      this.config.cleanupIntervalHours * 60 * 60 * 1000
    );
    logger.debug("Cleanup timer started", "DEAL_PIPELINE");
  }

  private startHealthCheckTimer(): void {
    this.healthCheckTimer = setInterval(
      () => this.performHealthCheck(),
      5 * 60 * 1000 // Every 5 minutes
    );
    logger.debug("Health check timer started", "DEAL_PIPELINE");
  }

  private restartTimers(): void {
    // Stop existing timers
    if (this.priceUpdateTimer) clearInterval(this.priceUpdateTimer);
    if (this.dealDetectionTimer) clearInterval(this.dealDetectionTimer);
    if (this.alertCheckTimer) clearInterval(this.alertCheckTimer);

    // Start with new configuration
    this.startPriceUpdateTimer();
    this.startDealDetectionTimer();
    this.startAlertCheckTimer();
  }

  private async processPriceUpdates(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();
    try {
      logger.debug("Starting price update batch", "DEAL_PIPELINE", { 
        queueSize: this.processingQueue.length 
      });

      // Get batch of products to process
      const batch = this.processingQueue.splice(0, this.config.maxProductsPerBatch);
      if (batch.length === 0) {
        logger.debug("No products in queue for price updates", "DEAL_PIPELINE");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Process batch with concurrency control
      for (let i = 0; i < batch.length; i += this.config.maxConcurrentRequests) {
        const concurrentBatch = batch.slice(i, i + this.config.maxConcurrentRequests);
        
        const promises = concurrentBatch.map(async (item) => {
          try {
            const livePrice = await this.priceFetcher.fetchProductPrice(item.productId);
            if (livePrice) {
              // Create minimal product object for recording
              const product: WalmartProduct = {
                id: item.productId,
                walmartId: item.productId,
                name: `Product ${item.productId}`,
                brand: '',
                category: { id: '1', name: 'General', path: ['General'], level: 1 },
                description: '',
                price: livePrice.price,
                images: [],
                inStock: livePrice.inStock,
                ratings: undefined,
                reviewCount: 0,
                size: '',
                unit: '',
                searchKeywords: [],
                featured: false,
                dateAdded: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                livePrice: {
                  price: livePrice.price,
                  salePrice: livePrice.salePrice,
                  wasPrice: livePrice.wasPrice,
                  inStock: livePrice.inStock,
                  lastUpdated: livePrice.lastUpdated.toISOString()
                }
              };

              await this.priceHistory.recordPrice(product, {
                currentPrice: livePrice.price,
                salePrice: livePrice.salePrice,
                wasPrice: livePrice.wasPrice,
                source: livePrice.source as any,
                confidenceScore: 1.0,
                storeLocation: livePrice.storeLocation || undefined
              });

              this.emit('price_updated', { productId: item.productId, price: livePrice.price });
              successCount++;
            }
          } catch (error) {
            logger.warn("Failed to update price for product", "DEAL_PIPELINE", { 
              error, 
              productId: item.productId 
            });
            errorCount++;
          }
        });

        await Promise.all(promises);
        
        // Add delay between concurrent batches
        if (i + this.config.maxConcurrentRequests < batch.length) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenRequestsMs));
        }
      }

      const duration = Date.now() - startTime;
      this.recentTimings.priceUpdates.push(duration);
      this.recentTimings.priceUpdates = this.recentTimings.priceUpdates.slice(-10); // Keep last 10

      this.metrics.pricesUpdatedLastHour += successCount;
      this.metrics.lastPriceUpdateAt = new Date().toISOString();
      this.metrics.queueSize = this.processingQueue.length;
      this.recentTimings.successes += successCount;
      this.recentTimings.errors += errorCount;

      logger.info("Price update batch completed", "DEAL_PIPELINE", {
        processed: batch.length,
        successes: successCount,
        errors: errorCount,
        durationMs: duration,
        queueRemaining: this.processingQueue.length
      });

    } catch (error) {
      logger.error("Price update batch failed", "DEAL_PIPELINE", { error });
      this.emit('error', { type: 'price_update_batch', error });
    }
  }

  private async processDealDetection(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();
    try {
      logger.debug("Starting deal detection run", "DEAL_PIPELINE");

      // Get deal candidates from recent price changes
      const dealCandidates = await this.priceHistory.findDealCandidates(
        undefined, // All categories
        this.config.minSavingsPercentage,
        this.config.maxDealsPerRun
      );

      if (dealCandidates.length === 0) {
        logger.debug("No deal candidates found", "DEAL_PIPELINE");
        return;
      }

      let dealsDetected = 0;
      for (const candidate of dealCandidates) {
        try {
          // Create product object from price record
          const product: WalmartProduct = {
            id: candidate.productId,
            walmartId: candidate.walmartId,
            name: candidate.productName,
            brand: candidate.brand || '',
            category: candidate.category ? { 
              id: '1', 
              name: candidate.category, 
              path: [candidate.category], 
              level: 1 
            } : { id: '1', name: 'General', path: ['General'], level: 1 },
            description: '',
            price: candidate.currentPrice,
            images: [],
            inStock: true,
            ratings: undefined,
            reviewCount: 0,
            size: '',
            unit: '',
            searchKeywords: [],
            featured: false,
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            livePrice: {
              price: candidate.currentPrice,
              salePrice: candidate.salePrice,
              wasPrice: candidate.wasPrice,
              inStock: true,
              storeLocation: candidate.storeLocation,
              lastUpdated: new Date(candidate.recordedAt).toISOString(),
              source: candidate.source as 'api' | 'scraper' | 'cache'
            }
          };

          const deals = await this.dealDetection.detectDeals(candidate.productId, product, {
            checkSeasonality: this.config.enableSeasonalDetection,
            checkBulkOpportunities: this.config.enableBulkDetection,
            minSavingsPercentage: this.config.minSavingsPercentage
          });

          dealsDetected += deals.length;
          
          for (const deal of deals) {
            this.emit('deal_detected', deal);
            await this.notifyDealDetected(deal);
          }

        } catch (error) {
          logger.warn("Failed to detect deals for candidate", "DEAL_PIPELINE", { 
            error, 
            productId: candidate.productId 
          });
        }
      }

      const duration = Date.now() - startTime;
      this.recentTimings.dealDetections.push(duration);
      this.recentTimings.dealDetections = this.recentTimings.dealDetections.slice(-10);

      this.metrics.dealsDetectedLastHour += dealsDetected;
      this.metrics.lastDealDetectionAt = new Date().toISOString();

      logger.info("Deal detection run completed", "DEAL_PIPELINE", {
        candidates: dealCandidates.length,
        dealsDetected,
        durationMs: duration
      });

    } catch (error) {
      logger.error("Deal detection run failed", "DEAL_PIPELINE", { error });
      this.emit('error', { type: 'deal_detection', error });
    }
  }

  private async processAlertChecks(): Promise<void> {
    if (!this.isRunning) return;

    try {
      logger.debug("Checking deal alerts", "DEAL_PIPELINE");
      
      await this.dealDetection.checkDealAlerts();
      
      this.metrics.lastAlertCheckAt = new Date().toISOString();
      
    } catch (error) {
      logger.error("Alert check failed", "DEAL_PIPELINE", { error });
      this.emit('error', { type: 'alert_check', error });
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      logger.info("Starting pipeline cleanup", "DEAL_PIPELINE");

      // Clean up old price history
      const deletedPrices = await this.priceHistory.cleanupOldPriceHistory(this.config.priceHistoryDays);
      
      logger.info("Pipeline cleanup completed", "DEAL_PIPELINE", {
        deletedPriceRecords: deletedPrices
      });

    } catch (error) {
      logger.error("Pipeline cleanup failed", "DEAL_PIPELINE", { error });
    }
  }

  private performHealthCheck(): void {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);

    // Calculate recent performance metrics
    this.metrics.avgPriceUpdateTime = this.recentTimings.priceUpdates.length > 0 ?
      this.recentTimings.priceUpdates.reduce((sum, time) => sum + time, 0) / this.recentTimings.priceUpdates.length : 0;

    this.metrics.avgDealDetectionTime = this.recentTimings.dealDetections.length > 0 ?
      this.recentTimings.dealDetections.reduce((sum, time) => sum + time, 0) / this.recentTimings.dealDetections.length : 0;

    const totalOperations = this.recentTimings.successes + this.recentTimings.errors;
    this.metrics.successRate = totalOperations > 0 ? (this.recentTimings.successes / totalOperations) * 100 : 100;
    this.metrics.errorRate = totalOperations > 0 ? (this.recentTimings.errors / totalOperations) * 100 : 0;

    // Determine health status
    const isHealthy = this.metrics.errorRate < 10 && // Less than 10% error rate
                     this.metrics.queueSize < 1000 && // Queue not too large
                     this.isRunning;

    this.metrics.isHealthy = isHealthy;

    // Reset hourly counters
    this.metrics.pricesUpdatedLastHour = 0;
    this.metrics.dealsDetectedLastHour = 0;
    this.metrics.alertsTriggeredLastHour = 0;

    // Reset performance counters
    this.recentTimings.successes = 0;
    this.recentTimings.errors = 0;

    this.emit('health_check', { metrics: this.metrics });
    
    if (!isHealthy) {
      logger.warn("Pipeline health check failed", "DEAL_PIPELINE", { metrics: this.metrics });
    }
  }

  private async notifyDealDetected(deal: DetectedDeal): Promise<void> {
    if (!this.config.enableRealTimeNotifications) return;

    try {
      // Send WebSocket notification to all connected users
      this.webSocket.broadcastDealNotification(deal);

      this.metrics.alertsTriggeredLastHour++;

      logger.debug("Deal notification sent", "DEAL_PIPELINE", {
        dealId: deal.id,
        productId: deal.productId,
        savings: deal.savingsPercentage
      });

    } catch (error) {
      logger.warn("Failed to send deal notification", "DEAL_PIPELINE", { error, dealId: deal.id });
    }
  }

  private handlePriceUpdated(data: { productId: string; price: number }): void {
    logger.debug("Price updated event", "DEAL_PIPELINE", data);
  }

  private handleDealDetected(deal: DetectedDeal): void {
    logger.info("Deal detected event", "DEAL_PIPELINE", {
      dealId: deal.id,
      productName: deal.productName,
      savings: `${deal.savingsPercentage.toFixed(1)}%`,
      score: deal.dealScore.toFixed(2)
    });
  }

  private handleError(data: { type: string; error: any }): void {
    logger.error("Pipeline error event", "DEAL_PIPELINE", data);
    this.recentTimings.errors++;
  }

  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
    }
  }
}