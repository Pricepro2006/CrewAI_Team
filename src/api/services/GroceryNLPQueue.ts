/**
 * GroceryNLPQueue - Manages concurrent NLP requests for grocery parsing
 * Ensures we don't exceed OLLAMA_NUM_PARALLEL limit while maintaining performance
 * 
 * This queue system prevents bottlenecks by:
 * 1. Limiting concurrent Ollama requests to OLLAMA_NUM_PARALLEL (default: 2)
 * 2. Batching requests when possible for efficiency
 * 3. Providing fallback mechanisms for non-critical operations
 */

import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import type {
  QueueItem,
  QueueMetrics,
  RequestFingerprint,
  QueueSnapshot,
  QueueConfiguration,
  WebSocketEvent,
  QueueItemStatus
} from "../types/grocery-nlp.types.js";

interface QueuedRequest<T> extends QueueItem {
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

// Use QueueMetrics from types file

export class GroceryNLPQueue extends EventEmitter {
  private static instance: GroceryNLPQueue;
  private queue: QueuedRequest<any>[] = [];
  private activeRequests = 0;
  private maxConcurrent: number;
  private metrics: QueueMetrics;
  private requestTimings = new Map<string, number>();
  private isProcessing = false;
  
  // New features
  private requestFingerprints = new Map<string, RequestFingerprint>();
  private persistenceEnabled = true;
  private persistencePath: string;
  private deduplicationEnabled = true;
  private deduplicationTTL = 5 * 60 * 1000; // 5 minutes
  private configuration: QueueConfiguration;
  
  // Configuration
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 2;
  private readonly HIGH_PRIORITY = 10;
  private readonly NORMAL_PRIORITY = 5;
  private readonly LOW_PRIORITY = 1;

  private constructor() {
    super();
    
    // Get max concurrent from environment or default to 2
    this.maxConcurrent = parseInt(process.env.OLLAMA_NUM_PARALLEL || "2");
    
    // Initialize persistence path
    this.persistencePath = process.env.NLP_QUEUE_PERSISTENCE_PATH || 
      path.join(process.cwd(), 'data', 'nlp-queue');
    
    this.configuration = {
      maxConcurrent: this.maxConcurrent,
      defaultTimeout: this.DEFAULT_TIMEOUT,
      maxRetries: this.MAX_RETRIES,
      persistenceEnabled: this.persistenceEnabled,
      deduplicationEnabled: this.deduplicationEnabled,
      deduplicationTTL: this.deduplicationTTL,
      healthCheck: {
        maxQueueSize: 50,
        maxErrorRate: 0.1,
        maxProcessingTime: 5000
      }
    };
    
    this.metrics = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      currentQueueSize: 0,
      activeRequests: 0,
      successRate: 0,
      requestsPerMinute: 0,
      peakQueueSize: 0,
      throughput: {
        last1min: 0,
        last5min: 0,
        last15min: 0
      }
    };
    
    // Initialize persistence and recovery
    this.initializePersistence();
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    logger.info("GroceryNLPQueue initialized", "NLP_QUEUE", {
      maxConcurrent: this.maxConcurrent,
      persistenceEnabled: this.persistenceEnabled,
      deduplicationEnabled: this.deduplicationEnabled
    });
  }

  static getInstance(): GroceryNLPQueue {
    if (!GroceryNLPQueue.instance) {
      GroceryNLPQueue.instance = new GroceryNLPQueue();
    }
    return GroceryNLPQueue.instance;
  }

  /**
   * Add a request to the queue with priority and deduplication
   */
  async enqueue<T>(
    operation: () => Promise<T>,
    priority: "high" | "normal" | "low" = "normal",
    timeout?: number,
    query?: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const priorityValue = this.getPriorityValue(priority);
      const requestId = this.generateRequestId();
      
      // Check for duplicate request
      if (this.deduplicationEnabled && query) {
        const fingerprint = this.generateFingerprint(query, metadata);
        const existingFingerprint = this?.requestFingerprints?.get(fingerprint);
        
        if (existingFingerprint && (Date.now() - existingFingerprint.lastSeen) < this.deduplicationTTL) {
          logger.debug("Duplicate request detected", "NLP_QUEUE", {
            fingerprint,
            originalCount: existingFingerprint.count
          });
          
          existingFingerprint.count++;
          existingFingerprint.lastSeen = Date.now();
          
          // Find existing request in queue or processing
          const existingRequest = this?.queue?.find(r => r.metadata?.fingerprint === fingerprint);
          if (existingRequest) {
            // Attach to existing request
            const originalResolve = existingRequest?.resolve;
            const originalReject = existingRequest?.reject;
            
            existingRequest.resolve = (value: T) => {
              originalResolve(value);
              resolve(value);
            };
            
            existingRequest.reject = (error: any) => {
              originalReject(error);
              reject(error);
            };
            
            return;
          }
        } else {
          // Create new fingerprint
          this?.requestFingerprints?.set(fingerprint, {
            hash: fingerprint,
            query,
            metadata,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            count: 1
          });
        }
      }
      
      const request: QueuedRequest<T> = {
        id: requestId,
        priority: priorityValue,
        status: "pending" as QueueItemStatus,
        query: query || "unknown",
        metadata: {
          ...metadata,
          fingerprint: query ? this.generateFingerprint(query, metadata) : undefined
        },
        operation,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0,
        timeout: timeout || this.DEFAULT_TIMEOUT
      };
      
      // Add to queue
      this?.queue?.push(request);
      this.sortQueue();
      
      // Update metrics
      if (this.metrics) {
        this.metrics.totalRequests++;
      }
      if (this.metrics && this.queue) {
        this.metrics.currentQueueSize = this.queue.length;
      }
      if (this.metrics && this.queue) {
        this.metrics.peakQueueSize = Math.max(this.metrics.peakQueueSize, this.queue.length);
      }
      
      // Emit queue update event
      this.emitQueueUpdate();
      
      // Check for queue overflow and reject if necessary
      if (this?.queue?.length > this?.configuration?.healthCheck.maxQueueSize * 1.5) {
        logger.error("NLP queue overflow - rejecting request", "NLP_QUEUE", {
          queueSize: this?.queue?.length,
          activeRequests: this.activeRequests,
          threshold: this?.configuration?.healthCheck.maxQueueSize,
          requestId: requestId
        });
        
        throw new Error(`Queue overflow: ${this?.queue?.length} items in queue (max: ${this?.configuration?.healthCheck.maxQueueSize})`);
      }
      
      // Log warning if queue is getting large
      if (this?.queue?.length > this?.configuration?.healthCheck.maxQueueSize) {
        logger.warn("NLP queue growing large", "NLP_QUEUE", {
          queueSize: this?.queue?.length,
          activeRequests: this.activeRequests,
          threshold: this?.configuration?.healthCheck.maxQueueSize,
          requestId: requestId
        });
      }
      
      // Start processing if not already running
      this.processQueue();
      
      // Persist queue state
      if (this.persistenceEnabled) {
        this.persistQueueState().catch(error => {
          logger.error("Failed to persist queue state", "NLP_QUEUE", { error });
        });
      }
      
      // Set timeout for this request
      if (request.timeout) {
        setTimeout(() => {
          const index = this?.queue?.findIndex(r => r.id === requestId);
          if (index !== -1) {
            this?.queue?.splice(index, 1);
            request.status = "timeout";
            reject(new Error(`Request timeout after ${request.timeout}ms`));
            if (this.metrics) {
              this.metrics.timeoutRequests++;
            }
            this.emitRequestStatus(requestId, "timeout", undefined, "Request timeout");
          }
        }, request.timeout);
      }
    });
  }

  /**
   * Process multiple operations in a batch (for efficiency)
   */
  async enqueueBatch<T>(
    operations: Array<() => Promise<T>>,
    priority: "high" | "normal" | "low" = "normal",
    batchOptions?: {
      batchId?: string;
      timeout?: number;
      failFast?: boolean;
      maxConcurrency?: number;
    }
  ): Promise<T[]> {
    const batchId = batchOptions?.batchId || `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timeout = batchOptions?.timeout;
    const failFast = batchOptions?.failFast || false;
    const maxConcurrency = Math.min(
      batchOptions?.maxConcurrency || this.maxConcurrent,
      this.maxConcurrent,
      operations?.length || 0
    );
    
    // Check if batch operation would cause overflow
    const projectedQueueSize = this?.queue?.length + operations?.length || 0;
    if (projectedQueueSize > this?.configuration?.healthCheck.maxQueueSize * 1.5) {
      logger.error("Batch operation would cause queue overflow - rejecting", "NLP_QUEUE", {
        batchId,
        currentQueueSize: this?.queue?.length,
        operationCount: operations?.length || 0,
        projectedSize: projectedQueueSize,
        maxSize: this?.configuration?.healthCheck.maxQueueSize
      });
      
      throw new Error(`Batch overflow: Would add ${operations?.length || 0} items to queue of ${this?.queue?.length} (max: ${this?.configuration?.healthCheck.maxQueueSize})`);
    }
    
    logger.info("Processing batch operation", "NLP_QUEUE", {
      batchId,
      operationCount: operations?.length || 0,
      priority,
      maxConcurrency,
      failFast
    });

    const results: (T | null)[] = [];
    const errors: (Error | null)[] = [];
    let completedCount = 0;
    let failedCount = 0;

    try {
      if (failFast) {
        // Fail fast mode: if any operation fails, cancel all
        const batchResults = await Promise.all(
          operations?.map((op, index) => 
            this.enqueue(
              op,
              priority,
              timeout,
              `batch-operation-${index}`,
              { batchId, batchIndex: index }
            ).catch(error => {
              failedCount++;
              throw error;
            })
          )
        );
        results.push(...batchResults);
        completedCount = batchResults?.length || 0;
      } else {
        // Process in chunks with error tolerance
        const chunks = this.chunkArray(operations, maxConcurrency);
        
        for (const chunk of chunks) {
          const chunkPromises = chunk?.map((op, index) => 
            this.enqueue(
              op,
              priority,
              timeout,
              `batch-operation-${results?.length || 0 + index}`,
              { batchId, batchIndex: results?.length || 0 + index }
            ).then(result => {
              completedCount++;
              return result;
            }).catch(error => {
              failedCount++;
              errors[results?.length || 0 + index] = error;
              return null;
            })
          );
          
          const chunkResults = await Promise.allSettled(chunkPromises);
          
          for (const result of chunkResults) {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              results.push(null);
            }
          }
        }
      }

      logger.info("Batch operation completed", "NLP_QUEUE", {
        batchId,
        completedCount,
        failedCount,
        totalOperations: operations?.length || 0,
        successRate: completedCount / operations?.length || 0
      });

      // Emit batch completion event
      this.emit('batchCompleted', {
        batchId,
        completedCount,
        failedCount,
        results: results?.filter(r => r !== null),
        errors: errors?.filter(e => e !== null)
      });

      return results?.filter((result: any): result is T => result !== null);

    } catch (error) {
      logger.error("Batch operation failed", "NLP_QUEUE", {
        batchId,
        error,
        completedCount,
        failedCount,
        totalOperations: operations?.length || 0
      });

      this.emit('batchFailed', {
        batchId,
        error,
        completedCount,
        failedCount,
        totalOperations: operations?.length || 0
      });

      throw error;
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array?.length || 0; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    while (this?.queue?.length > 0 && this.activeRequests < this.maxConcurrent) {
      const request = this?.queue?.shift();
      if (!request) break;
      
      this.activeRequests++;
      if (this.metrics) {
        this.metrics.activeRequests = this.activeRequests;
      }
      if (this.metrics && this.queue) {
        this.metrics.currentQueueSize = this.queue.length;
      }
      
      // Track wait time
      const waitTime = Date.now() - request.timestamp;
      this.updateAverageWaitTime(waitTime);
      
      // Process the request
      this.processRequest(request);
    }
    
    this.isProcessing = false;
  }

  /**
   * Process a single request
   */
  private async processRequest<T>(request: QueuedRequest<T>): Promise<void> {
    const startTime = Date.now();
    request.startedAt = startTime;
    request.status = "processing";
    request.queueTime = startTime - request.timestamp;
    
    // Emit status update
    this.emitRequestStatus(request.id, "processing");
    
    try {
      logger.debug("Processing NLP request", "NLP_QUEUE", {
        id: request.id,
        priority: request.priority,
        activeRequests: this.activeRequests,
        queueSize: this?.queue?.length
      });
      
      const result = await request.operation();
      
      // Track processing time
      const processingTime = Date.now() - startTime;
      request.processingTime = processingTime;
      request.completedAt = Date.now();
      request.status = "completed";
      
      this.updateAverageProcessingTime(processingTime);
      
      request.resolve(result);
      if (this.metrics) {
        this.metrics.completedRequests++;
      }
      this.updateSuccessRate();
      
      // Emit status update
      this.emitRequestStatus(request.id, "completed", result);
      
      logger.debug("NLP request completed", "NLP_QUEUE", {
        id: request.id,
        processingTime
      });
      
    } catch (error) {
      request.error = error instanceof Error ? error.message : String(error);
      request.status = "failed";
      request.completedAt = Date.now();
      
      logger.error("NLP request failed", "NLP_QUEUE", {
        id: request.id,
        error,
        retries: request.retries
      });
      
      // Retry logic
      if (request.retries < this.MAX_RETRIES) {
        request.retries++;
        request.timestamp = Date.now(); // Reset timestamp for retry
        request.status = "pending";
        request.startedAt = undefined;
        request.completedAt = undefined;
        request.error = undefined;
        this?.queue?.unshift(request); // Add back to front of queue
        this.sortQueue();
        
        // Emit retry status
        this.emitRequestStatus(request.id, "pending");
      } else {
        request.reject(error);
        if (this.metrics) {
          this.metrics.failedRequests++;
        }
        this.updateSuccessRate();
        
        // Emit failure status
        this.emitRequestStatus(request.id, "failed", undefined, request.error);
      }
    } finally {
      this.activeRequests--;
      if (this.metrics) {
        this.metrics.activeRequests = this.activeRequests;
      }
      
      // Emit queue update
      this.emitQueueUpdate();
      
      // Continue processing queue
      if (this?.queue?.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Get priority value from string
   */
  private getPriorityValue(priority: "high" | "normal" | "low"): number {
    switch (priority) {
      case "high":
        return this.HIGH_PRIORITY;
      case "normal":
        return this.NORMAL_PRIORITY;
      case "low":
        return this.LOW_PRIORITY;
      default:
        return this.NORMAL_PRIORITY;
    }
  }

  /**
   * Sort queue by priority (higher priority first)
   */
  private sortQueue(): void {
    this?.queue?.sort((a, b) => {
      // First by priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then by timestamp (FIFO for same priority)
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `nlp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update average wait time metric
   */
  private updateAverageWaitTime(waitTime: number): void {
    const totalWaitTime = this?.metrics?.averageWaitTime * (this?.metrics?.completedRequests + this?.metrics?.failedRequests);
    const newTotal = this?.metrics?.completedRequests + this?.metrics?.failedRequests + 1;
    if (this.metrics) {
      this.metrics.averageWaitTime = (totalWaitTime + waitTime) / newTotal;
    }
  }

  /**
   * Update average processing time metric
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const totalProcessingTime = this?.metrics?.averageProcessingTime * this?.metrics?.completedRequests;
    const newTotal = this?.metrics?.completedRequests + 1;
    if (this.metrics) {
      this.metrics.averageProcessingTime = (totalProcessingTime + processingTime) / newTotal;
    }
  }

  /**
   * Update success rate metric
   */
  private updateSuccessRate(): void {
    if (this.metrics && this.metrics.totalRequests === 0) {
      this.metrics.successRate = 0;
      return;
    }
    
    if (this.metrics) {
      this.metrics.successRate = this.metrics.completedRequests / this.metrics.totalRequests;
    }
  }

  /**
   * Get current queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear the queue (emergency use only)
   */
  clearQueue(): void {
    const clearedCount = this?.queue?.length;
    
    // Reject all pending requests
    this?.queue?.forEach(request => {
      request.reject(new Error("Queue cleared"));
    });
    
    this.queue = [];
    if (this.metrics) {
      this.metrics.currentQueueSize = 0;
    }
    
    logger.warn("NLP queue cleared", "NLP_QUEUE", {
      clearedCount,
      activeRequests: this.activeRequests
    });
  }

  /**
   * Check if queue has capacity for new requests
   */
  hasCapacity(additionalItems: number = 1): boolean {
    return (this?.queue?.length + additionalItems) <= this?.configuration?.healthCheck.maxQueueSize;
  }

  /**
   * Check if queue is healthy
   */
  isHealthy(): boolean {
    const queueSizeHealthy = this?.queue?.length < this?.configuration?.healthCheck.maxQueueSize;
    const errorRateHealthy = !this.metrics || this.metrics.totalRequests === 0 || 
      (this?.metrics?.failedRequests / this?.metrics?.totalRequests) < this?.configuration?.healthCheck.maxErrorRate;
    const processingTimeHealthy = this?.metrics?.averageProcessingTime < this?.configuration?.healthCheck.maxProcessingTime;
    
    return queueSizeHealthy && errorRateHealthy && processingTimeHealthy;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    healthy: boolean;
    queueSize: number;
    activeRequests: number;
    maxConcurrent: number;
    metrics: QueueMetrics;
    estimatedWaitTime: number;
  } {
    const estimatedWaitTime = this.calculateEstimatedWaitTime();
    
    return {
      healthy: this.isHealthy(),
      queueSize: this?.queue?.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent,
      metrics: this.getMetrics(),
      estimatedWaitTime
    };
  }

  /**
   * Initialize persistence system
   */
  private async initializePersistence(): Promise<void> {
    if (!this.persistenceEnabled) return;

    try {
      // Ensure persistence directory exists
      await fs.mkdir(this.persistencePath, { recursive: true });
      
      // Attempt to recover from previous session
      await this.recoverFromPersistence();
      
      logger.info("Persistence system initialized", "NLP_QUEUE", {
        persistencePath: this.persistencePath
      });
    } catch (error) {
      logger.error("Failed to initialize persistence", "NLP_QUEUE", { error });
      this.persistenceEnabled = false;
    }
  }

  /**
   * Persist current queue state to disk
   */
  private async persistQueueState(): Promise<void> {
    if (!this.persistenceEnabled) return;

    try {
      const snapshot: QueueSnapshot = {
        timestamp: Date.now(),
        version: "1.0.0",
        items: this?.queue?.map(item => ({
          id: item.id,
          priority: item.priority,
          status: item.status,
          query: item.query,
          metadata: item.metadata,
          timestamp: item.timestamp,
          startedAt: item.startedAt,
          completedAt: item.completedAt,
          retries: item.retries,
          timeout: item.timeout,
          error: item.error,
          processingTime: item.processingTime,
          queueTime: item.queueTime
        })),
        metrics: this.metrics,
        configuration: this.configuration
      };

      const snapshotPath = path.join(this.persistencePath, 'queue-snapshot.json');
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
      
      logger.debug("Queue state persisted", "NLP_QUEUE", {
        itemCount: snapshot?.items?.length,
        timestamp: snapshot.timestamp
      });
    } catch (error) {
      logger.error("Failed to persist queue state", "NLP_QUEUE", { error });
    }
  }

  /**
   * Recover queue state from persistence
   */
  private async recoverFromPersistence(): Promise<void> {
    if (!this.persistenceEnabled) return;

    try {
      const snapshotPath = path.join(this.persistencePath, 'queue-snapshot.json');
      const data = await fs.readFile(snapshotPath, 'utf8');
      const snapshot: QueueSnapshot = JSON.parse(data);

      // Only recover recent snapshots (within last hour)
      const maxAge = 60 * 60 * 1000; // 1 hour
      if (Date.now() - snapshot.timestamp > maxAge) {
        logger.info("Snapshot too old, skipping recovery", "NLP_QUEUE", {
          age: Date.now() - snapshot.timestamp
        });
        return;
      }

      // Restore metrics (but not queue items as operations are not serializable)
      this.metrics = { ...this.metrics, ...snapshot.metrics };
      
      logger.info("Recovered from persistence", "NLP_QUEUE", {
        snapshotAge: Date.now() - snapshot.timestamp,
        itemCount: snapshot?.items?.length
      });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error("Failed to recover from persistence", "NLP_QUEUE", { error });
      }
    }
  }

  /**
   * Generate fingerprint for deduplication
   */
  private generateFingerprint(query: string, metadata?: Record<string, any>): string {
    const data = JSON.stringify({ query: query.trim().toLowerCase(), metadata });
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Clean up old fingerprints
   */
  private cleanupFingerprints(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [fingerprint, data] of Array.from(this.requestFingerprints.entries())) {
      if (now - data.lastSeen > this.deduplicationTTL) {
        toDelete.push(fingerprint);
      }
    }

    toDelete.forEach(fingerprint => {
      this.requestFingerprints.delete(fingerprint);
    });

    if (toDelete.length > 0) {
      logger.debug("Cleaned up fingerprints", "NLP_QUEUE", {
        cleaned: toDelete.length,
        remaining: this.requestFingerprints.size
      });
    }
  }

  /**
   * Calculate estimated wait time for new requests
   */
  private calculateEstimatedWaitTime(): number {
    if (!this.queue || this.queue.length === 0) return 0;
    
    const availableSlots = Math.max(0, this.maxConcurrent - this.activeRequests);
    const queuePosition = Math.max(0, this?.queue?.length - availableSlots);
    
    return queuePosition * (this?.metrics?.averageProcessingTime || 1000);
  }

  /**
   * Emit queue update event
   */
  private emitQueueUpdate(): void {
    const event: WebSocketEvent = {
      type: "queue_update",
      data: {
        queueSize: this?.queue?.length,
        activeRequests: this.activeRequests,
        estimatedWaitTime: this.calculateEstimatedWaitTime()
      }
    };

    this.emit('queueUpdate', event);
  }

  /**
   * Emit request status event
   */
  private emitRequestStatus(
    requestId: string,
    status: QueueItemStatus,
    result?: any,
    error?: string
  ): void {
    const event: WebSocketEvent = {
      type: "request_status",
      data: {
        requestId,
        status,
        result,
        error
      }
    };

    this.emit('requestStatus', event);
  }

  /**
   * Emit metrics update event
   */
  private emitMetricsUpdate(): void {
    const event: WebSocketEvent = {
      type: "metrics_update",
      data: this.getMetrics()
    };

    this.emit('metricsUpdate', event);
  }

  /**
   * Cancel a queued request
   */
  cancelRequest(requestId: string): boolean {
    const index = this?.queue?.findIndex(r => r.id === requestId);
    
    if (index !== -1) {
      const request = this.queue[index];
      this?.queue?.splice(index, 1);
      
      if (request) {
        request.reject(new Error("Request cancelled"));
        request.status = "failed";
      }
      
      if (this.metrics && this.queue) {
        this.metrics.currentQueueSize = this.queue.length;
      }
      this.emitQueueUpdate();
      this.emitRequestStatus(requestId, "failed", undefined, "Request cancelled");
      
      logger.debug("Request cancelled", "NLP_QUEUE", { requestId });
      return true;
    }
    
    return false;
  }

  /**
   * Get configuration
   */
  getConfiguration(): QueueConfiguration {
    return { ...this.configuration };
  }

  /**
   * Update configuration
   */
  updateConfiguration(updates: Partial<QueueConfiguration>): void {
    this.configuration = { ...this.configuration, ...updates };
    
    // Apply relevant updates
    if (updates.maxConcurrent) {
      this.maxConcurrent = updates.maxConcurrent;
    }
    
    if (updates.deduplicationEnabled !== undefined) {
      this.deduplicationEnabled = updates.deduplicationEnabled;
    }
    
    if (updates.deduplicationTTL) {
      this.deduplicationTTL = updates.deduplicationTTL;
    }

    logger.info("Configuration updated", "NLP_QUEUE", { updates });
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): QueueItem | undefined {
    const request = this?.queue?.find(r => r.id === requestId);
    if (!request) return undefined;

    return {
      id: request.id,
      priority: request.priority,
      status: request.status,
      query: request.query,
      metadata: request.metadata,
      timestamp: request.timestamp,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
      retries: request.retries,
      timeout: request.timeout,
      error: request.error,
      processingTime: request.processingTime,
      queueTime: request.queueTime
    };
  }

  /**
   * Get all queue items
   */
  getQueueItems(): QueueItem[] {
    return this?.queue?.map(request => ({
      id: request.id,
      priority: request.priority,
      status: request.status,
      query: request.query,
      metadata: request.metadata,
      timestamp: request.timestamp,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
      retries: request.retries,
      timeout: request.timeout,
      error: request.error,
      processingTime: request.processingTime,
      queueTime: request.queueTime
    }));
  }

  /**
   * Start cleanup interval for fingerprints
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupFingerprints();
    }, 5 * 60 * 1000); // Run every 5 minutes
  }
}

// Export singleton instance getter
export const getGroceryNLPQueue = () => GroceryNLPQueue.getInstance();