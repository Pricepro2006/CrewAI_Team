/**
 * Production-Ready Email Processing Worker Pool
 *
 * Implements a high-performance worker pool for parallel email processing
 * with automatic scaling, error recovery, and monitoring.
 */

import { Worker } from "worker_threads";
import { EventEmitter } from "events";
import { Queue, Worker as BullWorker } from "bullmq";
import { Logger } from "../../utils/logger.js";
import { performance } from "perf_hooks";
import type { Redis } from "ioredis";

const logger = new Logger("EmailProcessingWorkerPool");

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  maxJobsPerWorker: number;
  workerScriptPath: string;
  redisConnection: Redis;
  enableAutoScaling: boolean;
  scaleUpThreshold: number; // Queue depth threshold
  scaleDownThreshold: number;
  maxMemoryPerWorker: number; // MB
  enableMetrics: boolean;
}

export interface EmailProcessingJob {
  id: string;
  conversationId: string;
  emails: EmailJobData[];
  priority: "low" | "medium" | "high" | "critical";
  options: ProcessingOptions;
}

export interface EmailJobData {
  id: string;
  subject: string;
  body: string;
  sender_email: string;
  received_at: string;
  conversation_id: string;
}

export interface ProcessingOptions {
  skipCache?: boolean;
  forceAllPhases?: boolean;
  qualityThreshold?: number;
  timeout?: number;
}

export interface WorkerMetrics {
  workerId: string;
  processedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  currentMemoryUsage: number;
  cpuUsage: number;
  isIdle: boolean;
  lastActivityTime: Date;
}

export interface PoolMetrics {
  activeWorkers: number;
  idleWorkers: number;
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTime: number;
  queueDepth: number;
  throughput: number; // jobs per minute
}

interface WorkerInstance {
  id: string;
  worker: Worker;
  isProcessing: boolean;
  metrics: WorkerMetrics;
  lastError?: Error;
}

// ============================================
// WORKER POOL IMPLEMENTATION
// ============================================

export class EmailProcessingWorkerPool extends EventEmitter {
  private config: WorkerPoolConfig;
  private workers: Map<string, WorkerInstance> = new Map();
  private jobQueue: Queue<EmailProcessingJob>;
  private bullWorker?: BullWorker<EmailProcessingJob>;
  private isShuttingDown = false;
  private metricsInterval?: NodeJS.Timeout;
  private scaleInterval?: NodeJS.Timeout;
  private startTime = Date.now();
  private totalProcessed = 0;
  private totalFailed = 0;

  constructor(config: WorkerPoolConfig) {
    super();
    this.config = this.validateConfig(config);

    // Initialize job queue
    this.jobQueue = new Queue("email-processing", {
      connection: config.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });

    // Note: QueueScheduler is no longer needed in BullMQ v5+

    this.initialize();
  }

  /**
   * Validate and set defaults for configuration
   */
  private validateConfig(config: WorkerPoolConfig): WorkerPoolConfig {
    return {
      minWorkers: Math.max(1, config.minWorkers || 2),
      maxWorkers: Math.max(config.maxWorkers || 10, config.minWorkers || 2),
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      maxJobsPerWorker: config.maxJobsPerWorker || 100,
      workerScriptPath: config.workerScriptPath,
      redisConnection: config.redisConnection,
      enableAutoScaling: config.enableAutoScaling ?? true,
      scaleUpThreshold: config.scaleUpThreshold || 100,
      scaleDownThreshold: config.scaleDownThreshold || 10,
      maxMemoryPerWorker: config.maxMemoryPerWorker || 512, // MB
      enableMetrics: config.enableMetrics ?? true,
    };
  }

  /**
   * Initialize the worker pool
   */
  private async initialize(): Promise<void> {
    logger.info("Initializing worker pool", {
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
    });

    // Create minimum number of workers
    for (let i = 0; i < this.config.minWorkers; i++) {
      await this.createWorker();
    }

    // Start queue processor
    this.startQueueProcessor();

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    // Start auto-scaling
    if (this.config.enableAutoScaling) {
      this.startAutoScaling();
    }

    logger.info("Worker pool initialized successfully");
    this.emit("initialized", { workers: this.workers.size });
  }

  /**
   * Create a new worker instance
   */
  private async createWorker(): Promise<string> {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const worker = new Worker(this.config.workerScriptPath, {
      workerData: {
        workerId,
        maxMemory: this.config.maxMemoryPerWorker,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: this.config.maxMemoryPerWorker,
      },
    });

    const workerInstance: WorkerInstance = {
      id: workerId,
      worker,
      isProcessing: false,
      metrics: {
        workerId,
        processedJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0,
        currentMemoryUsage: 0,
        cpuUsage: 0,
        isIdle: true,
        lastActivityTime: new Date(),
      },
    };

    // Set up worker event handlers
    this.setupWorkerHandlers(workerInstance);

    this.workers.set(workerId, workerInstance);
    logger.info(`Created worker ${workerId}`);
    this.emit("workerCreated", { workerId });

    return workerId;
  }

  /**
   * Set up event handlers for a worker
   */
  private setupWorkerHandlers(workerInstance: WorkerInstance): void {
    const { worker, id } = workerInstance;

    worker.on("message", (message) => {
      this.handleWorkerMessage(id, message);
    });

    worker.on("error", (error) => {
      logger.error(`Worker ${id} error:`, error);
      workerInstance.lastError = error;
      this.emit("workerError", { workerId: id, error });
      this.handleWorkerFailure(id);
    });

    worker.on("exit", (code) => {
      logger.info(`Worker ${id} exited with code ${code}`);
      this.workers.delete(id);
      this.emit("workerExit", { workerId: id, code });

      // Replace worker if not shutting down
      if (!this.isShuttingDown && this.workers.size < this.config.minWorkers) {
        this.createWorker();
      }
    });
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerId: string, message: any): void {
    const workerInstance = this.workers.get(workerId);
    if (!workerInstance) return;

    switch (message.type) {
      case "jobComplete":
        this.handleJobComplete(workerId, message.data);
        break;

      case "jobFailed":
        this.handleJobFailed(workerId, message.data);
        break;

      case "metrics":
        this.updateWorkerMetrics(workerId, message.data);
        break;

      case "heartbeat":
        workerInstance.metrics.lastActivityTime = new Date();
        break;

      default:
        logger.debug(`Unknown message type from worker ${workerId}:`, message);
    }
  }

  /**
   * Handle job completion
   */
  private handleJobComplete(workerId: string, data: any): void {
    const workerInstance = this.workers.get(workerId);
    if (!workerInstance) return;

    workerInstance.isProcessing = false;
    workerInstance.metrics.processedJobs++;
    workerInstance.metrics.lastActivityTime = new Date();

    // Update average processing time
    const { processingTime } = data;
    const { processedJobs, averageProcessingTime } = workerInstance.metrics;
    workerInstance.metrics.averageProcessingTime =
      (averageProcessingTime * (processedJobs - 1) + processingTime) /
      processedJobs;

    this.totalProcessed++;
    this.emit("jobComplete", { workerId, ...data });
  }

  /**
   * Handle job failure
   */
  private handleJobFailed(workerId: string, data: any): void {
    const workerInstance = this.workers.get(workerId);
    if (!workerInstance) return;

    workerInstance.isProcessing = false;
    workerInstance.metrics.failedJobs++;
    workerInstance.metrics.lastActivityTime = new Date();

    this.totalFailed++;
    this.emit("jobFailed", { workerId, ...data });
  }

  /**
   * Update worker metrics
   */
  private updateWorkerMetrics(
    workerId: string,
    metrics: Partial<WorkerMetrics>,
  ): void {
    const workerInstance = this.workers.get(workerId);
    if (!workerInstance) return;

    Object.assign(workerInstance.metrics, metrics);
  }

  /**
   * Handle worker failure and potential replacement
   */
  private async handleWorkerFailure(workerId: string): Promise<void> {
    const workerInstance = this.workers.get(workerId);
    if (!workerInstance) return;

    // Terminate the failed worker
    await workerInstance.worker.terminate();
    this.workers.delete(workerId);

    // Create replacement if needed
    if (!this.isShuttingDown && this.workers.size < this.config.minWorkers) {
      await this.createWorker();
    }
  }

  /**
   * Start processing jobs from the queue
   */
  private startQueueProcessor(): void {
    this.bullWorker = new BullWorker<EmailProcessingJob>(
      "email-processing",
      async (job) => {
        // Find available worker
        const workerId = await this.getAvailableWorker();
        if (!workerId) {
          throw new Error("No available workers");
        }

        const workerInstance = this.workers.get(workerId);
        if (!workerInstance) {
          throw new Error("Worker not found");
        }

        // Mark worker as busy
        workerInstance.isProcessing = true;
        workerInstance.metrics.isIdle = false;

        // Send job to worker
        const startTime = performance.now();

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Worker timeout"));
          }, job.data.options.timeout || 180000);

          const messageHandler = (message: any) => {
            if (message.type === "jobComplete" && message.jobId === job.id) {
              clearTimeout(timeout);
              workerInstance.worker.off("message", messageHandler);

              const processingTime = performance.now() - startTime;
              this.handleJobComplete(workerId, {
                jobId: job.id,
                processingTime,
                result: message.data,
              });

              resolve(message.data);
            } else if (
              message.type === "jobFailed" &&
              message.jobId === job.id
            ) {
              clearTimeout(timeout);
              workerInstance.worker.off("message", messageHandler);

              this.handleJobFailed(workerId, {
                jobId: job.id,
                error: message.error,
              });

              reject(new Error(message.error));
            }
          };

          workerInstance.worker.on("message", messageHandler);
          workerInstance.worker.postMessage({
            type: "processJob",
            job: job.data,
            jobId: job.id,
          });
        });
      },
      {
        connection: this.config.redisConnection,
        concurrency: this.config.maxWorkers,
        autorun: true,
      },
    );

    this.bullWorker.on("completed", (job) => {
      logger.debug(`Job ${job.id} completed`);
    });

    this.bullWorker.on("failed", (job, err) => {
      logger.error(`Job ${job?.id} failed:`, err);
    });
  }

  /**
   * Get an available worker
   */
  private async getAvailableWorker(): Promise<string | null> {
    // First, try to find an idle worker
    for (const [workerId, instance] of this.workers) {
      if (!instance.isProcessing && instance.metrics.isIdle) {
        return workerId;
      }
    }

    // If no idle workers and we can scale up, create a new one
    if (
      this.config.enableAutoScaling &&
      this.workers.size < this.config.maxWorkers
    ) {
      const workerId = await this.createWorker();
      return workerId;
    }

    // Wait for a worker to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const [workerId, instance] of this.workers) {
          if (!instance.isProcessing) {
            clearInterval(checkInterval);
            resolve(workerId);
            return;
          }
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 30000);
    });
  }

  /**
   * Add jobs to the processing queue
   */
  async addJobs(jobs: EmailProcessingJob[]): Promise<void> {
    const bulkJobs = jobs.map((job) => ({
      name: "process-emails",
      data: job,
      opts: {
        priority: this.getPriorityValue(job.priority),
        delay: 0,
      },
    }));

    await this.jobQueue.addBulk(bulkJobs);
    logger.info(`Added ${jobs.length} jobs to queue`);
    this.emit("jobsAdded", { count: jobs.length });
  }

  /**
   * Convert priority string to numeric value
   */
  private getPriorityValue(priority: EmailProcessingJob["priority"]): number {
    const priorityMap = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };
    return priorityMap[priority] || 3;
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getPoolMetrics();
      this.emit("metrics", metrics);

      // Log metrics
      logger.debug("Pool metrics:", {
        activeWorkers: metrics.activeWorkers,
        throughput: `${metrics.throughput.toFixed(2)} jobs/min`,
        queueDepth: metrics.queueDepth,
      });
    }, 10000); // Every 10 seconds
  }

  /**
   * Start auto-scaling
   */
  private startAutoScaling(): void {
    this.scaleInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      const metrics = this.getPoolMetrics();

      // Scale up if queue is deep
      if (
        metrics.queueDepth > this.config.scaleUpThreshold &&
        this.workers.size < this.config.maxWorkers
      ) {
        logger.info("Scaling up: high queue depth", {
          queueDepth: metrics.queueDepth,
          currentWorkers: this.workers.size,
        });
        await this.createWorker();
      }

      // Scale down if queue is shallow and we have idle workers
      if (
        metrics.queueDepth < this.config.scaleDownThreshold &&
        metrics.idleWorkers > 0 &&
        this.workers.size > this.config.minWorkers
      ) {
        // Find and remove an idle worker
        for (const [workerId, instance] of this.workers) {
          if (instance.metrics.isIdle && !instance.isProcessing) {
            logger.info("Scaling down: removing idle worker", { workerId });
            await instance.worker.terminate();
            this.workers.delete(workerId);
            break;
          }
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Get current pool metrics
   */
  getPoolMetrics(): PoolMetrics {
    let activeWorkers = 0;
    let idleWorkers = 0;
    let totalProcessingTime = 0;
    let totalJobs = 0;

    for (const instance of this.workers.values()) {
      if (instance.isProcessing) {
        activeWorkers++;
      } else {
        idleWorkers++;
      }

      totalJobs += instance.metrics.processedJobs;
      totalProcessingTime +=
        instance.metrics.averageProcessingTime * instance.metrics.processedJobs;
    }

    const averageProcessingTime =
      totalJobs > 0 ? totalProcessingTime / totalJobs : 0;
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    const throughput =
      elapsedMinutes > 0 ? this.totalProcessed / elapsedMinutes : 0;

    return {
      activeWorkers,
      idleWorkers,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      averageProcessingTime,
      queueDepth: this.jobQueue.count() || 0,
      throughput,
    };
  }

  /**
   * Get detailed worker metrics
   */
  getWorkerMetrics(): WorkerMetrics[] {
    return Array.from(this.workers.values()).map(
      (instance) => instance.metrics,
    );
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down worker pool...");
    this.isShuttingDown = true;

    // Stop intervals
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.scaleInterval) clearInterval(this.scaleInterval);

    // Close queue connections
    // QueueScheduler no longer needed in BullMQ v5+
    if (this.bullWorker) await this.bullWorker.close();
    await this.jobQueue.close();

    // Terminate all workers
    const terminationPromises = Array.from(this.workers.values()).map(
      async (instance) => {
        try {
          await instance.worker.terminate();
        } catch (error) {
          logger.error(`Error terminating worker ${instance.id}:`, error);
        }
      },
    );

    await Promise.all(terminationPromises);
    this.workers.clear();

    logger.info("Worker pool shutdown complete");
    this.emit("shutdown");
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createEmailProcessingWorkerPool(
  config: Partial<WorkerPoolConfig>,
): EmailProcessingWorkerPool {
  return new EmailProcessingWorkerPool(config as WorkerPoolConfig);
}
