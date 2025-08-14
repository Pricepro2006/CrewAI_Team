/**
 * Batch Operations Utilities for tRPC API Optimization
 * Implements efficient bulk operations with transaction support and error handling
 */

import { z } from "zod";
import { logger } from "./logger.js";
import { TRPCError } from "@trpc/server";

// Batch operation types
export interface BatchOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  index: number;
  operationId?: string;
}

export interface BatchResult<T = any> {
  results: BatchOperationResult<T>[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    processingTime: number;
  };
  errors: string[];
}

export interface BatchOperationConfig {
  batchSize: number;
  maxConcurrency: number;
  continueOnError: boolean;
  useTransaction: boolean;
  timeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

// Default configuration
const defaultBatchConfig: BatchOperationConfig = {
  batchSize: 100,
  maxConcurrency: 5,
  continueOnError: true,
  useTransaction: false,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

// Validation schemas
export const batchOperationSchema = z.object({
  operations: z.array(z.any()).min(1).max(1000),
  config: z.object({
    batchSize: z.number().min(1).max(500).optional(),
    maxConcurrency: z.number().min(1).max(10).optional(),
    continueOnError: z.boolean().optional(),
    useTransaction: z.boolean().optional(),
    timeout: z.number().min(1000).max(300000).optional(),
    retryAttempts: z.number().min(0).max(5).optional(),
    retryDelay: z.number().min(100).max(10000).optional(),
  }).optional(),
});

export const bulkCreateSchema = z.object({
  items: z.array(z.record(z.any())).min(1).max(1000),
  config: batchOperationSchema.shape.config.optional(),
});

export const bulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.string(),
    data: z.record(z.any()),
  })).min(1).max(1000),
  config: batchOperationSchema.shape.config.optional(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(1000),
  config: batchOperationSchema.shape.config.optional(),
});

export type BulkCreateInput = z.infer<typeof bulkCreateSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;

/**
 * High-performance batch operation processor
 */
export class BatchProcessor<T = any> {
  private config: BatchOperationConfig;

  constructor(config: Partial<BatchOperationConfig> = {}) {
    this.config = { ...defaultBatchConfig, ...config };
  }

  /**
   * Process operations in batches with concurrency control
   */
  async processBatch<TInput, TOutput>(
    operations: TInput[],
    processor: (items: TInput[]) => Promise<TOutput[]>,
    config: Partial<BatchOperationConfig> = {}
  ): Promise<BatchResult<TOutput>> {
    const finalConfig = { ...this.config, ...config };
    const startTime = Date.now();
    
    logger.info("Starting batch processing", "BATCH_OPERATIONS", {
      totalOperations: operations.length,
      batchSize: finalConfig.batchSize,
      maxConcurrency: finalConfig.maxConcurrency,
    });

    const results: BatchOperationResult<TOutput>[] = [];
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    // Split operations into batches
    const batches = this.createBatches(operations, finalConfig.batchSize);
    
    // Process batches with concurrency control
    const semaphore = new Semaphore(finalConfig.maxConcurrency);
    
    const batchPromises = batches.map(async (batch, batchIndex) => {
      const permit = await semaphore.acquire();
      
      try {
        const batchResults = await this.processSingleBatch(
          batch,
          processor,
          batchIndex,
          finalConfig
        );
        
        results.push(...batchResults);
        
        // Update counters
        for (const result of batchResults) {
          if (result.success) {
            successful++;
          } else {
            failed++;
            if (result.error) {
              errors.push(result.error);
            }
          }
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown batch error';
        logger.error("Batch processing failed", "BATCH_OPERATIONS", {
          batchIndex,
          error: errorMessage,
        });
        
        // Mark all items in this batch as failed
        for (let i = 0; i < batch.length; i++) {
          results.push({
            success: false,
            error: errorMessage,
            index: batchIndex * finalConfig.batchSize + i,
          });
          failed++;
        }
        
        errors.push(errorMessage);
        
        if (!finalConfig.continueOnError) {
          throw error;
        }
      } finally {
        semaphore.release(permit);
      }
    });

    // Wait for all batches to complete
    await Promise.all(batchPromises);

    const processingTime = Date.now() - startTime;
    
    logger.info("Batch processing completed", "BATCH_OPERATIONS", {
      total: operations.length,
      successful,
      failed,
      skipped,
      processingTime,
    });

    return {
      results: results.sort((a, b) => a.index - b.index), // Ensure order
      summary: {
        total: operations.length,
        successful,
        failed,
        skipped,
        processingTime,
      },
      errors,
    };
  }

  /**
   * Process a single batch with error handling and retries
   */
  private async processSingleBatch<TInput, TOutput>(
    batch: TInput[],
    processor: (items: TInput[]) => Promise<TOutput[]>,
    batchIndex: number,
    config: BatchOperationConfig
  ): Promise<BatchOperationResult<TOutput>[]> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= config.retryAttempts) {
      try {
        const batchResults = await Promise.race([
          processor(batch),
          this.createTimeoutPromise<TOutput[]>(config.timeout),
        ]);

        // Convert results to BatchOperationResult format
        return batchResults.map((result, index) => ({
          success: true,
          data: result,
          index: batchIndex * config.batchSize + index,
          operationId: `batch_${batchIndex}_item_${index}`,
        }));

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        attempt++;

        if (attempt <= config.retryAttempts) {
          logger.warn("Batch operation failed, retrying", "BATCH_OPERATIONS", {
            batchIndex,
            attempt,
            error: lastError.message,
            retryDelay: config.retryDelay,
          });

          await this.delay(config.retryDelay);
        }
      }
    }

    // All retries failed
    const errorMessage = lastError?.message || 'Unknown error after retries';
    
    return batch.map((_, index) => ({
      success: false,
      error: errorMessage,
      index: batchIndex * config.batchSize + index,
      operationId: `batch_${batchIndex}_item_${index}`,
    }));
  }

  /**
   * Create batches from operations array
   */
  private createBatches<T>(operations: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Create timeout promise for operation timeout
   */
  private createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.queue.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  release(permit?: () => void): void {
    this.permits++;
    
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}

/**
 * Specialized batch operations for common use cases
 */
export class WalmartBatchOperations {
  private processor: BatchProcessor;

  constructor(config: Partial<BatchOperationConfig> = {}) {
    this.processor = new BatchProcessor(config);
  }

  /**
   * Bulk create products with validation
   */
  async bulkCreateProducts(
    products: any[],
    repository: any,
    config?: Partial<BatchOperationConfig>
  ): Promise<BatchResult> {
    return this.processor.processBatch(
      products,
      async (batch) => {
        // Use repository transaction for consistency
        return repository.transaction(async () => {
          const results = [];
          for (const product of batch) {
            const created = await repository.create(product);
            results.push(created);
          }
          return results;
        });
      },
      config
    );
  }

  /**
   * Bulk update products with optimistic locking
   */
  async bulkUpdateProducts(
    updates: Array<{ id: string; data: any; version?: number }>,
    repository: any,
    config?: Partial<BatchOperationConfig>
  ): Promise<BatchResult> {
    return this.processor.processBatch(
      updates,
      async (batch) => {
        return repository.transaction(async () => {
          const results = [];
          for (const { id, data, version } of batch) {
            // Check version for optimistic locking if provided
            if (version !== undefined) {
              const current = await repository.findById(id);
              if (current?.version !== version) {
                throw new Error(`Version conflict for product ${id}`);
              }
            }
            
            const updated = await repository.update(id, data);
            results.push(updated);
          }
          return results;
        });
      },
      config
    );
  }

  /**
   * Bulk delete with dependency checking
   */
  async bulkDeleteProducts(
    ids: string[],
    repository: any,
    config?: Partial<BatchOperationConfig>
  ): Promise<BatchResult> {
    return this.processor.processBatch(
      ids,
      async (batch) => {
        return repository.transaction(async () => {
          const results = [];
          for (const id of batch) {
            // Check for dependencies before deletion
            const dependencies = await repository.checkDependencies(id);
            if (dependencies.length > 0) {
              throw new Error(`Cannot delete product ${id}: has dependencies`);
            }
            
            const deleted = await repository.delete(id);
            results.push(deleted);
          }
          return results;
        });
      },
      config
    );
  }

  /**
   * Bulk price updates with history tracking
   */
  async bulkUpdatePrices(
    priceUpdates: Array<{ productId: string; newPrice: number; reason?: string }>,
    repository: any,
    config?: Partial<BatchOperationConfig>
  ): Promise<BatchResult> {
    return this.processor.processBatch(
      priceUpdates,
      async (batch) => {
        return repository.transaction(async () => {
          const results = [];
          for (const { productId, newPrice, reason } of batch) {
            // Get current price for history
            const product = await repository.findById(productId);
            if (!product) {
              throw new Error(`Product not found: ${productId}`);
            }
            
            const oldPrice = product.current_price;
            
            // Update price
            await repository.updatePrice(productId, newPrice);
            
            // Record price history
            await repository.addPriceHistory({
              product_id: productId,
              old_price: oldPrice,
              new_price: newPrice,
              change_reason: reason || 'bulk_update',
              changed_at: new Date().toISOString(),
            });
            
            results.push({ productId, oldPrice, newPrice });
          }
          return results;
        });
      },
      config
    );
  }

  /**
   * Bulk inventory sync with external source
   */
  async bulkSyncInventory(
    inventoryUpdates: Array<{ productId: string; stockLevel: number; location?: string }>,
    repository: any,
    config?: Partial<BatchOperationConfig>
  ): Promise<BatchResult> {
    return this.processor.processBatch(
      inventoryUpdates,
      async (batch) => {
        const results = [];
        
        // Group by location for efficiency
        const byLocation = batch.reduce((acc, item) => {
          const location = item.location || 'default';
          if (!acc[location]) acc[location] = [];
          acc[location].push(item);
          return acc;
        }, {} as Record<string, typeof batch>);
        
        for (const [location, items] of Object.entries(byLocation)) {
          await repository.transaction(async () => {
            for (const { productId, stockLevel } of items) {
              const updated = await repository.updateInventory(productId, stockLevel, location);
              results.push(updated);
            }
          });
        }
        
        return results;
      },
      config
    );
  }
}

/**
 * Batch operation monitoring and analytics
 */
export class BatchOperationMonitor {
  private static metrics = new Map<string, {
    totalOperations: number;
    averageTime: number;
    successRate: number;
    lastRun: Date;
  }>();

  /**
   * Record batch operation metrics
   */
  static recordMetrics(operationType: string, result: BatchResult): void {
    const existing = this.metrics.get(operationType) || {
      totalOperations: 0,
      averageTime: 0,
      successRate: 0,
      lastRun: new Date(),
    };

    const successRate = result.summary.successful / result.summary.total;
    
    // Update running averages
    const newTotal = existing.totalOperations + result.summary.total;
    const newAvgTime = (
      (existing.averageTime * existing.totalOperations + result.summary.processingTime) / 
      newTotal
    );
    const newSuccessRate = (
      (existing.successRate * existing.totalOperations + successRate * result.summary.total) / 
      newTotal
    );

    this.metrics.set(operationType, {
      totalOperations: newTotal,
      averageTime: newAvgTime,
      successRate: newSuccessRate,
      lastRun: new Date(),
    });

    logger.info("Batch operation metrics updated", "BATCH_MONITOR", {
      operationType,
      totalOperations: newTotal,
      averageTime: Math.round(newAvgTime),
      successRate: Math.round(newSuccessRate * 100) / 100,
    });
  }

  /**
   * Get metrics for operation type
   */
  static getMetrics(operationType?: string): Record<string, any> {
    if (operationType) {
      return this.metrics.get(operationType) || null;
    }
    
    return Object.fromEntries(this.metrics);
  }

  /**
   * Clear metrics
   */
  static clearMetrics(): void {
    this.metrics.clear();
  }
}

/**
 * Utility functions for batch operations
 */
export const BatchUtils = {
  /**
   * Validate batch operation limits
   */
  validateBatchSize(operations: any[], maxSize: number = 1000): void {
    if (operations.length > maxSize) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Batch size exceeds maximum allowed (${maxSize}). Got ${operations.length}.`,
      });
    }
  },

  /**
   * Estimate batch processing time
   */
  estimateProcessingTime(
    operationCount: number,
    avgOperationTime: number,
    batchSize: number,
    concurrency: number
  ): number {
    const batches = Math.ceil(operationCount / batchSize);
    const parallelBatches = Math.ceil(batches / concurrency);
    return parallelBatches * avgOperationTime;
  },

  /**
   * Split large operations into manageable chunks
   */
  chunkOperations<T>(operations: T[], maxChunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < operations.length; i += maxChunkSize) {
      chunks.push(operations.slice(i, i + maxChunkSize));
    }
    return chunks;
  },

  /**
   * Merge batch results from multiple processors
   */
  mergeBatchResults(...results: BatchResult[]): BatchResult {
    const mergedResults: BatchOperationResult[] = [];
    const mergedErrors: string[] = [];
    let totalProcessingTime = 0;
    let totalOperations = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const result of results) {
      mergedResults.push(...result.results);
      mergedErrors.push(...result.errors);
      totalProcessingTime = Math.max(totalProcessingTime, result.summary.processingTime);
      totalOperations += result.summary.total;
      totalSuccessful += result.summary.successful;
      totalFailed += result.summary.failed;
      totalSkipped += result.summary.skipped;
    }

    return {
      results: mergedResults,
      summary: {
        total: totalOperations,
        successful: totalSuccessful,
        failed: totalFailed,
        skipped: totalSkipped,
        processingTime: totalProcessingTime,
      },
      errors: mergedErrors,
    };
  },
};

// Export singleton instances
export const batchProcessor = new BatchProcessor();
export const walmartBatchOps = new WalmartBatchOperations();
export const batchMonitor = BatchOperationMonitor;