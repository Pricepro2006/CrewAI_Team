import { EventEmitter } from 'events';
import { z } from 'zod';
import type { BaseEvent } from '../../core/events/EventBus.js';
import pako from 'pako';

// Batching configuration schemas
export const BatchConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  strategy: z.enum(['size', 'time', 'hybrid', 'adaptive']),
  maxBatchSize: z.number().min(1).max(1000).default(50),
  maxWaitTime: z.number().min(10).max(60000).default(1000), // milliseconds
  compression: z.object({
    enabled: z.boolean().default(true),
    algorithm: z.enum(['gzip', 'deflate']).default('gzip'),
    threshold: z.number().min(100).default(1024) // Compress if batch > 1KB
  }),
  priority: z.object({
    enabled: z.boolean().default(false),
    levels: z.record(z.number()).default({
      'critical': 1,
      'high': 2,
      'normal': 3,
      'low': 4
    }),
    maxDelayByPriority: z.record(z.number()).default({
      'critical': 100,
      'high': 500,
      'normal': 1000,
      'low': 5000
    })
  }),
  adaptive: z.object({
    enabled: z.boolean().default(false),
    targetLatency: z.number().default(500), // milliseconds
    adjustmentFactor: z.number().min(0.1).max(2.0).default(1.2),
    minBatchSize: z.number().min(1).default(1),
    maxBatchSize: z.number().min(1).default(100),
    learningWindow: z.number().default(100) // Number of batches for learning
  })
});

export const BatchMetricsSchema = z.object({
  totalBatches: z.number().default(0),
  totalMessages: z.number().default(0),
  averageBatchSize: z.number().default(0),
  averageWaitTime: z.number().default(0),
  averageCompressionRatio: z.number().default(0),
  compressionSavings: z.number().default(0), // bytes saved
  latencyStats: z.object({
    p50: z.number().default(0),
    p90: z.number().default(0),
    p95: z.number().default(0),
    p99: z.number().default(0)
  }),
  errorRate: z.number().default(0),
  adaptiveStats: z.object({
    currentBatchSize: z.number().default(10),
    currentWaitTime: z.number().default(1000),
    adjustmentHistory: z.array(z.object({
      timestamp: z.number(),
      batchSize: z.number(),
      waitTime: z.number(),
      latency: z.number()
    })).default([])
  }).optional()
});

export type BatchConfig = z.infer<typeof BatchConfigSchema>;
export type BatchMetrics = z.infer<typeof BatchMetricsSchema>;

export interface BatchedMessage {
  id: string;
  events: BaseEvent[];
  metadata: {
    batchSize: number;
    compressionRatio?: number;
    priority: string;
    createdAt: number;
    flushReason: 'size' | 'time' | 'priority' | 'manual' | 'adaptive';
    originalSize: number;
    compressedSize?: number;
  };
}

export interface PendingMessage {
  event: BaseEvent;
  priority: string;
  addedAt: number;
  targetId: string; // Connection or subscription ID
}

/**
 * MessageBatcher - Advanced message batching system with multiple strategies
 * 
 * Features:
 * - Multiple batching strategies (size-based, time-based, hybrid, adaptive)
 * - Priority-based message handling
 * - Intelligent compression with threshold detection
 * - Adaptive batching based on performance metrics
 * - Real-time performance monitoring and adjustment
 * - Memory-efficient queue management
 * - Circuit breaker integration for downstream systems
 */
export class MessageBatcher extends EventEmitter {
  private config: BatchConfig;
  private metrics: BatchMetrics;
  
  // Message queues and state
  private pendingMessages = new Map<string, PendingMessage[]>(); // targetId -> messages
  private batchTimers = new Map<string, NodeJS.Timeout>(); // targetId -> timer
  private priorityQueues = new Map<string, Map<string, PendingMessage[]>>(); // targetId -> priority -> messages
  
  // Performance tracking
  private latencyBuffer: number[] = [];
  private adaptiveController?: AdaptiveBatchController;
  
  // Cleanup and monitoring
  private metricsTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<BatchConfig> = {}) {
    super();
    
    this.config = BatchConfigSchema.parse({
      id: config.id || `batcher_${Date.now()}`,
      name: config.name || 'Default Message Batcher',
      ...config
    });
    
    this.metrics = BatchMetricsSchema.parse({});
    
    this.setupAdaptiveController();
    this.startPeriodicTasks();
    
    console.log(`MessageBatcher "${this?.config?.name}" initialized with strategy: ${this?.config?.strategy}`);
  }

  private setupAdaptiveController(): void {
    if (this?.config?.strategy === 'adaptive' && this?.config?.adaptive.enabled) {
      this.adaptiveController = new AdaptiveBatchController(
        this?.config?.adaptive.targetLatency,
        this?.config?.adaptive.adjustmentFactor,
        this?.config?.adaptive.learningWindow
      );
      
      if (this.metrics) {

      
        this.metrics.adaptiveStats = {
        currentBatchSize: this?.config?.maxBatchSize,
        currentWaitTime: this?.config?.maxWaitTime,
        adjustmentHistory: []
      };

      
      }
    }
  }

  private startPeriodicTasks(): void {
    // Metrics collection and reporting
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
      this.emit('metrics', { ...this.metrics, timestamp: Date.now() });
      
      // Adaptive learning
      if (this.adaptiveController) {
        this.performAdaptiveLearning();
      }
    }, 10000); // Every 10 seconds

    // Cleanup stale batches and expired timers
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }

  // Core batching API
  public addMessage(targetId: string, event: BaseEvent, options: {
    priority?: string;
    force?: boolean;
  } = {}): void {
    const priority = options.priority || 'normal';
    
    const pendingMessage: PendingMessage = {
      event,
      priority,
      addedAt: Date.now(),
      targetId
    };

    // Add to appropriate queue based on strategy
    if (this?.config?.priority.enabled) {
      this.addToPriorityQueue(targetId, pendingMessage);
    } else {
      this.addToQueue(targetId, pendingMessage);
    }

    // Check if immediate flush is needed
    if (options.force || this.shouldFlushImmediately(targetId, priority)) {
      this.flushBatch(targetId, 'priority');
      return;
    }

    // Set up timer for time-based flushing
    this.setupBatchTimer(targetId, priority);
    
    // Check size-based flushing
    if (this.shouldFlushBySize(targetId)) {
      this.flushBatch(targetId, 'size');
    }
  }

  public flushBatch(targetId: string, reason: BatchedMessage['metadata']['flushReason'] = 'manual'): BatchedMessage | null {
    const messages = this.getMessagesForTarget(targetId);
    
    if (messages?.length || 0 === 0) {
      return null;
    }

    // Clear timer
    const timer = this?.batchTimers?.get(targetId);
    if (timer) {
      clearTimeout(timer);
      this?.batchTimers?.delete(targetId);
    }

    // Create batch
    const batch = this.createBatch(targetId, messages, reason);
    
    // Clear queues
    this.clearQueuesForTarget(targetId);
    
    // Update metrics
    this.updateBatchMetrics(batch);
    
    // Record latency for adaptive learning
    if (reason !== 'manual') {
      const avgWaitTime = messages.reduce((sum: any, msg: any) => sum + (Date.now() - msg.addedAt), 0) / messages?.length || 0;
      this?.latencyBuffer?.push(avgWaitTime);
      
      if (this?.latencyBuffer?.length > 1000) {
        this.latencyBuffer = this?.latencyBuffer?.slice(-1000);
      }
    }

    this.emit('batch_created', {
      batch,
      targetId,
      reason,
      messageCount: messages?.length || 0
    });

    return batch;
  }

  public flushAllBatches(reason: BatchedMessage['metadata']['flushReason'] = 'manual'): BatchedMessage[] {
    const batches: BatchedMessage[] = [];
    
    for (const targetId of this?.pendingMessages?.keys()) {
      const batch = this.flushBatch(targetId, reason);
      if (batch) {
        batches.push(batch);
      }
    }
    
    return batches;
  }

  // Queue management
  private addToQueue(targetId: string, message: PendingMessage): void {
    if (!this?.pendingMessages?.has(targetId)) {
      this?.pendingMessages?.set(targetId, []);
    }
    
    this?.pendingMessages?.get(targetId)!.push(message);
  }

  private addToPriorityQueue(targetId: string, message: PendingMessage): void {
    if (!this?.priorityQueues?.has(targetId)) {
      this?.priorityQueues?.set(targetId, new Map());
    }
    
    const targetQueues = this?.priorityQueues?.get(targetId)!;
    if (!targetQueues.has(message.priority)) {
      targetQueues.set(message.priority, []);
    }
    
    targetQueues.get(message.priority)!.push(message);
  }

  private getMessagesForTarget(targetId: string): PendingMessage[] {
    if (this?.config?.priority.enabled) {
      return this.getMessagesFromPriorityQueues(targetId);
    } else {
      return this?.pendingMessages?.get(targetId) || [];
    }
  }

  private getMessagesFromPriorityQueues(targetId: string): PendingMessage[] {
    const targetQueues = this?.priorityQueues?.get(targetId);
    if (!targetQueues) return [];

    const messages: PendingMessage[] = [];
    const priorities = Object.keys(this.config?.priority?.levels || {})
      .sort((a, b) => (this.config?.priority?.levels?.[a] || 0) - (this.config?.priority?.levels?.[b] || 0));

    for (const priority of priorities) {
      const priorityMessages = targetQueues.get(priority) || [];
      messages.push(...priorityMessages);
    }

    return messages;
  }

  private clearQueuesForTarget(targetId: string): void {
    this?.pendingMessages?.delete(targetId);
    this?.priorityQueues?.delete(targetId);
  }

  // Batch creation and compression
  private createBatch(targetId: string, messages: PendingMessage[], reason: BatchedMessage['metadata']['flushReason']): BatchedMessage {
    const events = messages?.map(msg => msg.event);
    const highestPriority = this.getHighestPriority(messages);
    
    const batchId = this.generateBatchId();
    const originalData = JSON.stringify(events);
    const originalSize = Buffer.byteLength(originalData);
    
    let compressedSize: number | undefined;
    let compressionRatio: number | undefined;

    // Apply compression if enabled and threshold is met
    if (this?.config?.compression.enabled && originalSize > this?.config?.compression.threshold) {
      try {
        const compressed = this.compressData(originalData);
        compressedSize = compressed?.length ?? 0;
        compressionRatio = compressedSize > 0 ? originalSize / compressedSize : 1;
        
        if (this.metrics) {
          this.metrics.compressionSavings += (originalSize - compressedSize);
        }
      } catch (error) {
        this.emit('compression_error', { targetId, batchId, error });
      }
    }

    return {
      id: batchId,
      events,
      metadata: {
        batchSize: events?.length || 0,
        compressionRatio,
        priority: highestPriority,
        createdAt: Date.now(),
        flushReason: reason,
        originalSize,
        compressedSize
      }
    };
  }

  private compressData(data: string): Buffer {
    switch (this?.config?.compression.algorithm) {
      case 'gzip':
        return Buffer.from(pako.gzip(data));
      case 'deflate':
        return Buffer.from(pako.deflate(data));
      default:
        throw new Error(`Unsupported compression algorithm: ${this?.config?.compression.algorithm}`);
    }
  }

  private getHighestPriority(messages: PendingMessage[]): string {
    if (!this?.config?.priority.enabled || messages?.length || 0 === 0) {
      return 'normal';
    }

    return messages.reduce((highest: any, msg: any) => {
      const currentLevel = this.config?.priority?.levels?.[msg.priority] || 999;
      const highestLevel = this.config?.priority?.levels?.[highest] || 999;
      return currentLevel < highestLevel ? msg.priority : highest;
    }, messages[0]?.priority || 'normal');
  }

  // Flushing logic
  private shouldFlushImmediately(targetId: string, priority: string): boolean {
    if (!this?.config?.priority.enabled) return false;

    const maxDelay = this?.config?.priority.maxDelayByPriority[priority];
    if (!maxDelay) return false;

    const messages = this.getMessagesForTarget(targetId);
    const oldestMessage = messages.find(msg => msg.priority === priority);
    
    if (oldestMessage) {
      const age = Date.now() - oldestMessage.addedAt;
      return age >= maxDelay;
    }

    return false;
  }

  private shouldFlushBySize(targetId: string): boolean {
    const messages = this.getMessagesForTarget(targetId);
    const currentBatchSize = this.adaptiveController?.getCurrentBatchSize() || this?.config?.maxBatchSize;
    
    return (messages?.length || 0) >= currentBatchSize;
  }

  private setupBatchTimer(targetId: string, priority: string): void {
    // Don't create multiple timers for the same target
    if (this?.batchTimers?.has(targetId)) return;

    const maxWaitTime = this?.config?.priority.enabled 
      ? this?.config?.priority.maxDelayByPriority[priority] || this?.config?.maxWaitTime
      : this?.config?.maxWaitTime;

    const currentWaitTime = this.adaptiveController?.getCurrentWaitTime() || maxWaitTime;

    const timer = setTimeout(() => {
      this?.batchTimers?.delete(targetId);
      this.flushBatch(targetId, 'time');
    }, currentWaitTime);

    this?.batchTimers?.set(targetId, timer);
  }

  // Adaptive learning
  private performAdaptiveLearning(): void {
    if (!this.adaptiveController || (this.latencyBuffer?.length ?? 0) < 10) return;

    const currentLatency = this.calculateAverageLatency();
    const adjustment = this.adaptiveController.adjustParameters(currentLatency);

    if (adjustment.batchSizeChanged || adjustment.waitTimeChanged) {
      if (this.metrics?.adaptiveStats) {
        this.metrics.adaptiveStats.currentBatchSize = adjustment.newBatchSize;
        this.metrics.adaptiveStats.currentWaitTime = adjustment.newWaitTime;
        
        this.metrics.adaptiveStats.adjustmentHistory.push({
          timestamp: Date.now(),
          batchSize: adjustment.newBatchSize,
          waitTime: adjustment.newWaitTime,
          latency: currentLatency
        });
        // Keep history manageable
        if (this.metrics.adaptiveStats.adjustmentHistory.length > 100) {
          this.metrics.adaptiveStats.adjustmentHistory = 
            this.metrics.adaptiveStats.adjustmentHistory.slice(-100);
        }
      }

      this.emit('adaptive_adjustment', {
        reason: adjustment.reason,
        previousBatchSize: this?.config?.maxBatchSize,
        newBatchSize: adjustment.newBatchSize,
        previousWaitTime: this?.config?.maxWaitTime,
        newWaitTime: adjustment.newWaitTime,
        currentLatency
      });
    }
  }

  // Metrics and monitoring
  private updateMetrics(): void {
    const totalMessages = this?.metrics?.totalMessages;
    const totalBatches = this?.metrics?.totalBatches;

    if (totalBatches > 0) {
      if (this.metrics) {

        this.metrics.averageBatchSize = totalMessages / totalBatches;

      }
    }

    // Calculate latency percentiles
    if (this?.latencyBuffer?.length > 0) {
      const sorted = [...this.latencyBuffer].sort((a, b) => a - b);
      if (this.metrics) {

        this.metrics.latencyStats = {
        p50: this.calculatePercentile(sorted, 0.5),
        p90: this.calculatePercentile(sorted, 0.9),
        p95: this.calculatePercentile(sorted, 0.95),
        p99: this.calculatePercentile(sorted, 0.99)
      };

      }
    }
  }

  private updateBatchMetrics(batch: BatchedMessage): void {
    if (this.metrics.totalBatches) { this.metrics.totalBatches++ };
    if (this.metrics && batch?.metadata?.batchSize) {
      this.metrics.totalMessages += batch.metadata.batchSize;
    }

    if (batch?.metadata?.compressionRatio) {
      const currentAvg = this?.metrics?.averageCompressionRatio;
      const newAvg = (currentAvg * (this?.metrics?.totalBatches - 1) + batch?.metadata?.compressionRatio) / this?.metrics?.totalBatches;
      if (this.metrics) {

        this.metrics.averageCompressionRatio = newAvg;

      }
    }
  }

  private calculateAverageLatency(): number {
    if (this?.latencyBuffer?.length === 0) return 0;
    return this?.latencyBuffer?.reduce((sum: any, latency: any) => sum + latency, 0) / this?.latencyBuffer?.length;
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if ((sortedArray?.length || 0) === 0) return 0;
    
    const index = Math.ceil((sortedArray?.length || 0) * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, (sortedArray?.length || 0) - 1))] || 0;
  }

  private performCleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    // Clean up old pending messages
    for (const [targetId, messages] of this.pendingMessages) {
      const filtered = messages?.filter(msg => now - msg.addedAt < maxAge);
      
      if (filtered?.length || 0 !== messages?.length || 0) {
        if (filtered?.length || 0 === 0) {
          this?.pendingMessages?.delete(targetId);
        } else {
          this?.pendingMessages?.set(targetId, filtered);
        }
        
        this.emit('cleanup_performed', {
          targetId,
          removedMessages: messages?.length || 0 - filtered?.length || 0
        });
      }
    }

    // Clean up priority queues
    for (const [targetId, priorityMap] of this.priorityQueues) {
      let hasMessages = false;
      
      for (const [priority, messages] of priorityMap) {
        const filtered = messages?.filter(msg => now - msg.addedAt < maxAge);
        
        if (filtered?.length || 0 === 0) {
          priorityMap.delete(priority);
        } else {
          priorityMap.set(priority, filtered);
          hasMessages = true;
        }
      }
      
      if (!hasMessages) {
        this?.priorityQueues?.delete(targetId);
      }
    }
  }

  // Utility methods
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // Public API methods
  public getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  public getConfig(): BatchConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<BatchConfig>): void {
    const newConfig = { ...this.config, ...updates };
    BatchConfigSchema.parse(newConfig); // Validate
    
    this.config = newConfig;
    
    // Reinitialize adaptive controller if strategy changed
    if (updates.strategy === 'adaptive' || updates.adaptive) {
      this.setupAdaptiveController();
    }
    
    this.emit('config_updated', { 
      previousConfig: this.config, 
      newConfig,
      timestamp: Date.now()
    });
  }

  public getPendingMessageCount(targetId?: string): number {
    if (targetId) {
      return this.getMessagesForTarget(targetId).length;
    }
    
    let total = 0;
    for (const targetId of this?.pendingMessages?.keys()) {
      total += this.getMessagesForTarget(targetId).length;
    }
    
    return total;
  }

  public getQueueStatus(): {
    totalPendingMessages: number;
    targetCount: number;
    activeTimers: number;
    oldestMessage?: { targetId: string; age: number };
  } {
    let totalPending = 0;
    let oldestMessage: { targetId: string; age: number } | undefined;
    const now = Date.now();

    for (const [targetId, messages] of this.pendingMessages) {
      totalPending += messages?.length || 0;
      
      const oldest = messages.reduce((oldest: any, msg: any) => 
        msg.addedAt < oldest.addedAt ? msg : oldest
      );
      
      const age = now - oldest.addedAt;
      if (!oldestMessage || age > oldestMessage.age) {
        oldestMessage = { targetId, age };
      }
    }

    return {
      totalPendingMessages: totalPending,
      targetCount: this?.pendingMessages?.size,
      activeTimers: this?.batchTimers?.size,
      oldestMessage
    };
  }

  public async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this?.batchTimers?.values()) {
      clearTimeout(timer);
    }
    this?.batchTimers?.clear();

    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    // Flush all pending batches
    const finalBatches = this.flushAllBatches('manual');
    
    this.emit('shutdown', {
      finalBatchCount: finalBatches?.length || 0,
      totalMessagesProcessed: this?.metrics?.totalMessages
    });
  }
}

/**
 * AdaptiveBatchController - Manages adaptive batching parameters
 */
class AdaptiveBatchController {
  private targetLatency: number;
  private adjustmentFactor: number;
  private learningWindow: number;
  private currentBatchSize: number = 10;
  private currentWaitTime: number = 1000;
  private performanceHistory: Array<{ latency: number; batchSize: number; waitTime: number }> = [];

  constructor(targetLatency: number, adjustmentFactor: number, learningWindow: number) {
    this.targetLatency = targetLatency;
    this.adjustmentFactor = adjustmentFactor;
    this.learningWindow = learningWindow;
  }

  public adjustParameters(currentLatency: number): {
    batchSizeChanged: boolean;
    waitTimeChanged: boolean;
    newBatchSize: number;
    newWaitTime: number;
    reason: string;
  } {
    this?.performanceHistory?.push({
      latency: currentLatency,
      batchSize: this.currentBatchSize,
      waitTime: this.currentWaitTime
    });

    // Keep history manageable
    if (this?.performanceHistory?.length > this.learningWindow) {
      this.performanceHistory = this?.performanceHistory?.slice(-this.learningWindow);
    }

    const previousBatchSize = this?.currentBatchSize;
    const previousWaitTime = this?.currentWaitTime;
    let reason = 'no_change';

    if (currentLatency > this.targetLatency * 1.2) {
      // Latency too high - reduce batch size and wait time
      this.currentBatchSize = Math.max(1, Math.floor(this.currentBatchSize / this.adjustmentFactor));
      this.currentWaitTime = Math.max(100, Math.floor(this.currentWaitTime / this.adjustmentFactor));
      reason = 'latency_too_high';
    } else if (currentLatency < this.targetLatency * 0.8) {
      // Latency acceptable - can increase batch size for efficiency
      this.currentBatchSize = Math.min(100, Math.ceil(this.currentBatchSize * this.adjustmentFactor));
      this.currentWaitTime = Math.min(5000, Math.ceil(this.currentWaitTime * this.adjustmentFactor));
      reason = 'latency_acceptable';
    }

    return {
      batchSizeChanged: this.currentBatchSize !== previousBatchSize,
      waitTimeChanged: this.currentWaitTime !== previousWaitTime,
      newBatchSize: this.currentBatchSize,
      newWaitTime: this.currentWaitTime,
      reason
    };
  }

  public getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }

  public getCurrentWaitTime(): number {
    return this.currentWaitTime;
  }
}