/**
 * Email Batch Processor using Three-Phase Analysis
 * Processes multiple emails concurrently with the three-phase approach
 */

import PQueue from "p-queue";
import { EmailThreePhaseAnalysisService } from "../services/EmailThreePhaseAnalysisService.js";
import { EmailAnalysisCache } from "../cache/EmailAnalysisCache.js";
import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";

interface EmailInput {
  id: string;
  message_id?: string;
  subject: string;
  body?: string;
  body_preview?: string;
  sender_email: string;
  sender_name?: string;
  recipient_emails: string;
  received_at: string;
  importance?: string;
  has_attachments?: boolean;
}

interface BatchProcessingOptions {
  concurrency?: number;
  timeout?: number;
  useCaching?: boolean;
  retryAttempts?: number;
  priority?: "low" | "medium" | "high" | "critical";
}

interface BatchResult {
  emailId: string;
  success: boolean;
  analysis?: any;
  error?: string;
  fromCache?: boolean;
  processingTime?: number;
  phasesCompleted?: number;
}

interface BatchProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  cacheHits: number;
  averageTime: number;
}

export class EmailThreePhaseBatchProcessor extends EventEmitter {
  private queue: PQueue;
  private analysisService: EmailThreePhaseAnalysisService;
  private cache: EmailAnalysisCache;
  private options: Required<BatchProcessingOptions>;
  private progress: BatchProgress = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    cacheHits: 0,
    averageTime: 0,
  };

  constructor(
    analysisService?: EmailThreePhaseAnalysisService,
    cache?: EmailAnalysisCache,
    options?: BatchProcessingOptions,
  ) {
    super();

    // Use provided services or create new ones
    this.analysisService =
      analysisService || new EmailThreePhaseAnalysisService();
    this.cache =
      cache || new EmailAnalysisCache({ maxSize: 2000, ttl: 3600000 });

    this.options = {
      concurrency: options?.concurrency || 5,
      timeout: options?.timeout || 180000, // 3 minutes per email max
      useCaching: options?.useCaching !== false,
      retryAttempts: options?.retryAttempts || 2,
      priority: options?.priority || "high",
    };

    this.queue = new PQueue({
      concurrency: this?.options?.concurrency,
      timeout: this?.options?.timeout,
      throwOnTimeout: true,
    });

    // Set up event forwarding from analysis service
    this.setupEventForwarding();

    logger.info(
      "Three-phase email batch processor initialized",
      "BATCH_PROCESSOR",
      {
        concurrency: this?.options?.concurrency,
        timeout: this?.options?.timeout,
        caching: this?.options?.useCaching,
      },
    );
  }

  /**
   * Process multiple emails in batch with three-phase analysis
   */
  async processBatch(emails: EmailInput[]): Promise<BatchResult[]> {
    const startTime = Date.now();
    const results: BatchResult[] = [];

    // Reset progress
    this.progress = {
      total: emails?.length || 0,
      processed: 0,
      successful: 0,
      failed: 0,
      cacheHits: 0,
      averageTime: 0,
    };

    logger.info(
      `Starting three-phase batch processing of ${emails?.length || 0} emails`,
      "BATCH_PROCESSOR",
    );

    // Emit batch start event
    this.emit("batch:start", { total: emails?.length || 0 });

    // Add all emails to the queue
    const promises = emails?.map((email, index) =>
      this?.queue?.add(async () => {
        const result = await this.processEmail(email, index + 1);
        results.push(result);

        // Update progress
        this?.progress?.processed++;
        if (result.success) this?.progress?.successful++;
        else this?.progress?.failed++;
        if (result.fromCache) this?.progress?.cacheHits++;

        // Calculate average time
        const totalProcessingTime = results.reduce(
          (sum, r) => sum + (r.processingTime || 0),
          0,
        );
        this?.progress?.averageTime = Math.round(
          totalProcessingTime / results?.length || 0,
        );

        // Emit progress event
        this.emit("batch:progress", {
          ...this.progress,
          percentage: (this?.progress?.processed / this?.progress?.total) * 100,
        });

        return result;
      }),
    );

    // Wait for all to complete
    await Promise.all(promises);

    const totalTime = Date.now() - startTime;

    // Final statistics
    const stats = {
      total: emails?.length || 0,
      successful: this?.progress?.successful,
      failed: this?.progress?.failed,
      cacheHits: this?.progress?.cacheHits,
      totalTime: totalTime,
      avgTime: Math.round(totalTime / emails?.length || 0),
      throughput: Math.round((emails?.length || 0 / totalTime) * 1000), // emails per second
    };

    logger.info(
      "Three-phase batch processing completed",
      "BATCH_PROCESSOR",
      stats,
    );

    // Emit batch complete event
    this.emit("batch:complete", stats);

    return results;
  }

  /**
   * Process single email with three-phase analysis
   */
  private async processEmail(
    email: EmailInput,
    position: number,
    attempt = 1,
  ): Promise<BatchResult> {
    const startTime = Date.now();

    try {
      logger.debug(
        `Processing email ${position}/${this?.progress?.total}: ${email.subject?.substring(0, 50)}...`,
      );

      // Check cache first if enabled
      if (this?.options?.useCaching && this?.cache?.has(email.id)) {
        const cached = this?.cache?.get(email.id);
        if (cached) {
          logger.debug(`Cache hit for email ${email.id}`);
          return {
            emailId: email.id,
            success: true,
            analysis: cached,
            fromCache: true,
            processingTime: Date.now() - startTime,
            phasesCompleted: 3, // Assume complete analysis was cached
          };
        }
      }

      // Process email through three phases
      const analysis = await this?.analysisService?.analyzeEmail(email, {
        skipCache: !this?.options?.useCaching,
        priority: this?.options?.priority,
        timeout: this?.options?.timeout,
      });

      // Calculate phases completed
      let phasesCompleted = 1;
      if (analysis.phase2_processing_time) phasesCompleted = 2;
      if ('phase3_processing_time' in analysis && analysis.phase3_processing_time) phasesCompleted = 3;

      // Cache the complete analysis
      if (this?.options?.useCaching && phasesCompleted === 3) {
        this?.cache?.set(email.id, analysis);
      }

      return {
        emailId: email.id,
        success: true,
        analysis,
        fromCache: false,
        processingTime: Date.now() - startTime,
        phasesCompleted,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Retry logic
      if (attempt < this?.options?.retryAttempts) {
        logger.warn(
          `Retrying email ${email.id} (attempt ${attempt + 1}/${this?.options?.retryAttempts})`,
          "BATCH_PROCESSOR",
        );

        // Exponential backoff
        await new Promise((resolve: any) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt)),
        );

        return this.processEmail(email, position, attempt + 1);
      }

      logger.error(`Failed to process email ${email.id}`, "BATCH_PROCESSOR", {
        error: errorMessage,
        attempts: attempt,
      });

      return {
        emailId: email.id,
        success: false,
        error: errorMessage,
        processingTime: Date.now() - startTime,
        phasesCompleted: 0,
      };
    }
  }

  /**
   * Process emails in smaller chunks for better memory management
   */
  async processLargeBatch(
    emails: EmailInput[],
    chunkSize = 100,
  ): Promise<BatchResult[]> {
    const allResults: BatchResult[] = [];
    const totalChunks = Math.ceil(emails?.length || 0 / chunkSize);

    logger.info(
      `Processing ${emails?.length || 0} emails in ${totalChunks} chunks`,
      "BATCH_PROCESSOR",
    );

    for (let i = 0; i < emails?.length || 0; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;

      logger.info(
        `Processing chunk ${chunkNumber}/${totalChunks}`,
        "BATCH_PROCESSOR",
      );

      const chunkResults = await this.processBatch(chunk);
      allResults.push(...chunkResults);

      // Emit chunk complete event
      this.emit("chunk:complete", {
        chunkNumber,
        totalChunks,
        chunkResults: chunkResults?.length || 0,
        totalProcessed: allResults?.length || 0,
      });

      // Small delay between chunks to avoid overwhelming the system
      if (i + chunkSize < emails?.length || 0) {
        await new Promise((resolve: any) => setTimeout(resolve, 1000));
      }
    }

    return allResults;
  }

  /**
   * Set up event forwarding from analysis service
   */
  private setupEventForwarding(): void {
    // Forward phase events
    this?.analysisService?.on("phase:start", (data: any) => {
      this.emit("email:phase:start", data);
    });

    this?.analysisService?.on("phase:complete", (data: any) => {
      this.emit("email:phase:complete", data);
    });

    this?.analysisService?.on("analysis:complete", (data: any) => {
      this.emit("email:complete", data);
    });

    this?.analysisService?.on("analysis:error", (data: any) => {
      this.emit("email:error", data);
    });
  }

  /**
   * Get current queue statistics
   */
  getQueueStats() {
    return {
      size: this?.queue?.size,
      pending: this?.queue?.pending,
      isPaused: this?.queue?.isPaused,
      concurrency: this?.options?.concurrency,
      cacheStats: this?.cache?.getStats(),
    };
  }

  /**
   * Pause processing
   */
  pause(): void {
    this?.queue?.pause();
    logger.info("Batch processing paused", "BATCH_PROCESSOR");
  }

  /**
   * Resume processing
   */
  resume(): void {
    this?.queue?.start();
    logger.info("Batch processing resumed", "BATCH_PROCESSOR");
  }

  /**
   * Clear the processing queue
   */
  clear(): void {
    this?.queue?.clear();
    logger.info("Processing queue cleared", "BATCH_PROCESSOR");
  }

  /**
   * Update processing options
   */
  updateOptions(options: Partial<BatchProcessingOptions>): void {
    if (options.concurrency !== undefined) {
      this?.options?.concurrency = options.concurrency;
      this?.queue?.concurrency = options.concurrency;
    }

    if (options.timeout !== undefined) {
      this?.options?.timeout = options.timeout;
      this?.queue?.timeout = options.timeout;
    }

    if (options.useCaching !== undefined) {
      this?.options?.useCaching = options.useCaching;
    }

    if (options.retryAttempts !== undefined) {
      this?.options?.retryAttempts = options.retryAttempts;
    }

    if (options.priority !== undefined) {
      this?.options?.priority = options.priority;
    }

    logger.info(
      "Batch processor options updated",
      "BATCH_PROCESSOR",
      this.options,
    );
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down batch processor", "BATCH_PROCESSOR");

    // Clear the queue
    this.clear();

    // Shut down the analysis service
    await this?.analysisService?.shutdown();

    // Remove all listeners
    this.removeAllListeners();

    logger.info("Batch processor shutdown complete", "BATCH_PROCESSOR");
  }
}

// Export singleton instance for convenience
export const emailBatchProcessor = new EmailThreePhaseBatchProcessor();
