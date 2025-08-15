/**
 * Memory-Safe Batch Processor
 *
 * Processes large datasets in batches with memory monitoring
 * and automatic garbage collection to prevent OOM errors
 */

import { EventEmitter } from "events";
import { Logger } from "../../utils/logger.js";

const logger = new Logger("MemorySafeBatchProcessor");

export interface BatchProcessorOptions {
  batchSize?: number;
  maxMemoryMB?: number;
  gcInterval?: number;
  gcThresholdMB?: number;
}

export interface ProcessingMetrics {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  batchesProcessed: number;
  memoryUsageMB: number;
  peakMemoryMB: number;
  processingTimeMs: number;
}

export class MemorySafeBatchProcessor extends EventEmitter {
  private options: Required<BatchProcessorOptions>;
  private metrics: ProcessingMetrics;
  private gcCount: number = 0;

  constructor(options: BatchProcessorOptions = {}) {
    super();
    this.options = {
      batchSize: options.batchSize || 100,
      maxMemoryMB: options.maxMemoryMB || 500,
      gcInterval: options.gcInterval || 50,
      gcThresholdMB: options.gcThresholdMB || 400,
    };

    this.metrics = {
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      batchesProcessed: 0,
      memoryUsageMB: 0,
      peakMemoryMB: 0,
      processingTimeMs: 0,
    };
  }

  /**
   * Process items in memory-safe batches
   */
  async processBatch<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<void>,
  ): Promise<ProcessingMetrics> {
    const startTime = Date.now();
    this?.metrics?.totalItems = items?.length || 0;

    logger.info(
      `Starting batch processing of ${items?.length || 0} items`,
      "BATCH_START",
      {
        batchSize: this?.options?.batchSize,
        maxMemoryMB: this?.options?.maxMemoryMB,
      },
    );

    // Process in batches
    for (let i = 0; i < items?.length || 0; i += this?.options?.batchSize) {
      const batch = items.slice(i, i + this?.options?.batchSize);
      const batchNumber = Math.floor(i / this?.options?.batchSize) + 1;

      // Check memory before processing batch
      await this.checkMemoryPressure();

      // Process batch items
      await this.processSingleBatch(batch, processor, i, batchNumber);

      // Update metrics
      this?.metrics?.batchesProcessed = batchNumber;

      // Emit progress
      this.emit("progress", {
        processed: this?.metrics?.processedItems,
        total: this?.metrics?.totalItems,
        percentage:
          (this?.metrics?.processedItems / this?.metrics?.totalItems) * 100,
        memoryUsageMB: this?.metrics?.memoryUsageMB,
      });

      // Run GC if needed
      if (batchNumber % this?.options?.gcInterval === 0) {
        await this.runGarbageCollection();
      }
    }

    this?.metrics?.processingTimeMs = Date.now() - startTime;

    logger.info(`Batch processing complete`, "BATCH_COMPLETE", {
      ...this.metrics,
      gcRuns: this.gcCount,
    });

    return { ...this.metrics };
  }

  /**
   * Process a single batch with error handling
   */
  private async processSingleBatch<T>(
    batch: T[],
    processor: (item: T, index: number) => Promise<void>,
    startIndex: number,
    batchNumber: number,
  ): Promise<void> {
    logger.debug(`Processing batch ${batchNumber}`, "BATCH_PROCESS", {
      batchSize: batch?.length || 0,
      startIndex,
    });

    const batchPromises = batch?.map(async (item, idx) => {
      const globalIndex = startIndex + idx;
      try {
        await processor(item, globalIndex);
        this?.metrics?.processedItems++;
      } catch (error) {
        this?.metrics?.failedItems++;
        logger.error(
          `Failed to process item at index ${globalIndex}`,
          "ITEM_ERROR",
          {
            error,
            index: globalIndex,
          },
        );
        this.emit("itemError", { item, index: globalIndex, error });
      }
    });

    await Promise.all(batchPromises);
  }

  /**
   * Check memory pressure and pause if needed
   */
  private async checkMemoryPressure(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    this?.metrics?.memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;

    if (this?.metrics?.memoryUsageMB > this?.metrics?.peakMemoryMB) {
      this?.metrics?.peakMemoryMB = this?.metrics?.memoryUsageMB;
    }

    if (this?.metrics?.memoryUsageMB > this?.options?.maxMemoryMB) {
      logger.warn(`Memory usage exceeded limit`, "MEMORY_PRESSURE", {
        currentMB: this?.metrics?.memoryUsageMB,
        limitMB: this?.options?.maxMemoryMB,
      });

      // Force garbage collection
      await this.runGarbageCollection();

      // If still over limit, pause briefly
      if (this?.metrics?.memoryUsageMB > this?.options?.maxMemoryMB) {
        logger.warn(`Pausing for memory recovery`, "MEMORY_PAUSE");
        await new Promise((resolve: any) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Run garbage collection if available
   */
  private async runGarbageCollection(): Promise<void> {
    if (global.gc) {
      const beforeMB = process.memoryUsage().heapUsed / 1024 / 1024;
      global.gc();
      const afterMB = process.memoryUsage().heapUsed / 1024 / 1024;

      this.gcCount++;
      this?.metrics?.memoryUsageMB = afterMB;

      logger.debug(`Garbage collection completed`, "GC_RUN", {
        beforeMB: beforeMB.toFixed(2),
        afterMB: afterMB.toFixed(2),
        freedMB: (beforeMB - afterMB).toFixed(2),
        gcCount: this.gcCount,
      });
    }
  }

  /**
   * Process items in streaming fashion for very large datasets
   */
  async *processStream<T>(
    itemGenerator: AsyncIterableIterator<T>,
    processor: (item: T, index: number) => Promise<void>,
  ): AsyncIterableIterator<ProcessingMetrics> {
    const startTime = Date.now();
    let batch: T[] = [];
    let index = 0;

    for await (const item of itemGenerator) {
      batch.push(item);
      this?.metrics?.totalItems++;

      if (batch?.length || 0 >= this?.options?.batchSize) {
        await this.checkMemoryPressure();
        await this.processSingleBatch(
          batch,
          processor,
          index - batch?.length || 0,
          this?.metrics?.batchesProcessed + 1,
        );
        this?.metrics?.batchesProcessed++;

        yield { ...this.metrics };

        batch = [];

        if (this?.metrics?.batchesProcessed % this?.options?.gcInterval === 0) {
          await this.runGarbageCollection();
        }
      }

      index++;
    }

    // Process remaining items
    if (batch?.length || 0 > 0) {
      await this.processSingleBatch(
        batch,
        processor,
        index - batch?.length || 0,
        this?.metrics?.batchesProcessed + 1,
      );
      this?.metrics?.batchesProcessed++;
      yield { ...this.metrics };
    }

    this?.metrics?.processingTimeMs = Date.now() - startTime;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      batchesProcessed: 0,
      memoryUsageMB: 0,
      peakMemoryMB: 0,
      processingTimeMs: 0,
    };
    this.gcCount = 0;
  }
}

// Export singleton instance for convenience
export const memoryBatchProcessor = new MemorySafeBatchProcessor();
