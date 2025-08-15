/**
 * Email Processing Queue Service
 *
 * Manages email processing jobs with Redis-backed queues,
 * priority handling, and comprehensive monitoring.
 */

import { Queue, Worker, QueueEvents } from "bullmq";
import type { Job, JobOptions } from "bullmq";
import Redis from "ioredis";
import { EventEmitter } from "events";
import { Logger } from "../../utils/logger.js";
import { z } from "zod";

const logger = Logger.getInstance();

// ============================================
// TYPE DEFINITIONS
// ============================================

export const EmailJobSchema = z.object({
  conversationId: z.string(),
  emails: z.array(
    z.object({
      id: z.string(),
      subject: z.string(),
      body: z.string(),
      sender_email: z.string(),
      received_at: z.string(),
      importance: z.string().optional(),
      has_attachments: z.boolean().optional(),
    }),
  ),
  priority: z.enum(["low", "medium", "high", "critical"]),
  options: z
    .object({
      skipCache: z.boolean().optional(),
      forceAllPhases: z.boolean().optional(),
      qualityThreshold: z.number().optional(),
      timeout: z.number().optional(),
      retryAttempts: z.number().optional(),
    })
    .optional(),
  metadata: z
    .object({
      source: z.string().optional(),
      requestId: z.string().optional(),
      userId: z.string().optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
});

export type EmailJob = z.infer<typeof EmailJobSchema>;

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  queues: {
    phase1: string;
    phase2: string;
    phase3: string;
    results: string;
  };
  concurrency: {
    phase1: number;
    phase2: number;
    phase3: number;
  };
  retryStrategy: {
    attempts: number;
    backoff: {
      type: "exponential" | "fixed";
      delay: number;
    };
  };
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    enableEvents: boolean;
  };
}

export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  processingRate: number; // jobs per minute
  averageProcessingTime: number; // milliseconds
  errorRate: number; // percentage
}

export interface JobResult {
  jobId: string;
  conversationId: string;
  emailsProcessed: number;
  phases: number;
  processingTime: number;
  results: Array<{
    emailId: string;
    workflow_state: string;
    priority: string;
    confidence: number;
    entities: Record<string, any>;
  }>;
  errors?: string[];
}

// ============================================
// QUEUE SERVICE IMPLEMENTATION
// ============================================

export class EmailProcessingQueueService extends EventEmitter {
  private config: QueueConfig;
  private redisConnection: Redis;
  private queues: Map<string, any> = new Map();
  private schedulers: Map<string, any> = new Map();
  private workers: Map<string, any> = new Map();
  private queueEvents: Map<string, any> = new Map();
  private metricsInterval?: NodeJS.Timeout;
  private metrics: Map<string, QueueMetrics> = new Map();
  private isShuttingDown = false;

  constructor(config: QueueConfig) {
    super();
    this.config = config;
    this.redisConnection = new Redis(config.redis);
    this.initialize();
  }

  /**
   * Initialize queues, schedulers, and workers
   */
  private async initialize(): Promise<void> {
    logger.info("Initializing queue service...");

    // Create queues for each phase
    for (const [phase, queueName] of Object.entries(this.config.queues)) {
      await this.createQueue(phase, queueName);
    }

    // Start monitoring if enabled
    if (this.config.monitoring.enableMetrics) {
      this.startMetricsCollection();
    }

    logger.info("Queue service initialized successfully");
    this.emit("initialized");
  }

  /**
   * Create a queue with scheduler and event monitoring
   */
  private async createQueue(phase: string, queueName: string): Promise<void> {
    // Create queue
    const queue = new Queue(queueName, {
      connection: this.redisConnection.duplicate(),
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
          count: 5000, // Keep max 5000 failed jobs
        },
        attempts: this.config.retryStrategy.attempts,
        backoff: this.config.retryStrategy.backoff,
      },
    });

    this.queues.set(phase, queue);

    // Note: QueueScheduler is deprecated in newer BullMQ versions
    // We'll remove the scheduler logic for now
    // this.schedulers.set(phase, null);

    // Create queue events for monitoring
    if (this.config.monitoring.enableEvents) {
      const events = new QueueEvents(queueName, {
        connection: this.redisConnection.duplicate(),
      });

      this.setupQueueEventHandlers(phase, events);
      this.queueEvents.set(phase, events);
    }

    // Initialize metrics
    this.metrics.set(phase, {
      queueName,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: false,
      processingRate: 0,
      averageProcessingTime: 0,
      errorRate: 0,
    });

    logger.debug(`Created queue for ${phase}: ${queueName}`);
  }

  /**
   * Set up event handlers for queue monitoring
   */
  private setupQueueEventHandlers(phase: string, events: any): void {
    events.on("completed", ({ jobId, returnvalue, prev }: any) => {
      this.emit("job:completed", {
        phase,
        jobId,
        result: returnvalue,
        processingTime: Date.now() - parseInt(prev),
      });
    });

    events.on("failed", ({ jobId, failedReason, prev }: any) => {
      this.emit("job:failed", {
        phase,
        jobId,
        reason: failedReason,
        attempts: prev,
      });
    });

    events.on("progress", ({ jobId, data }: any) => {
      this.emit("job:progress", {
        phase,
        jobId,
        progress: data,
      });
    });

    events.on("delayed", ({ jobId, delay }: any) => {
      this.emit("job:delayed", {
        phase,
        jobId,
        delay,
      });
    });

    events.on("stalled", ({ jobId }: any) => {
      logger.warn(`Job ${jobId} stalled in ${phase} queue`);
      this.emit("job:stalled", { phase, jobId });
    });
  }

  /**
   * Add email processing job to the appropriate queue
   */
  async addJob(
    job: EmailJob,
    phase: "phase1" | "phase2" | "phase3" = "phase1",
  ): Promise<Job> {
    // Validate job data
    const validatedJob = EmailJobSchema.parse(job);

    const queue = this.queues.get(phase);
    if (!queue) {
      throw new Error(`Queue for ${phase} not found`);
    }

    // Calculate priority value (lower number = higher priority)
    const priorityValue = this.getPriorityValue(validatedJob.priority);

    // Add job to queue
    const queueJob = await queue.add(`process-${phase}`, validatedJob, {
      priority: priorityValue,
      delay: 0,
      attempts:
        validatedJob.options?.retryAttempts ||
        this.config.retryStrategy.attempts,
    });

    logger.debug(`Added job ${queueJob.id} to ${phase} queue`, undefined, {
      conversationId: validatedJob.conversationId,
      emailCount: validatedJob.emails.length,
      priority: validatedJob.priority,
    });

    this.emit("job:added", {
      phase,
      jobId: queueJob.id,
      conversationId: validatedJob.conversationId,
    });

    return queueJob;
  }

  /**
   * Add multiple jobs in bulk
   */
  async addBulkJobs(
    jobs: EmailJob[],
    phase: "phase1" | "phase2" | "phase3" = "phase1",
  ): Promise<Job[]> {
    const queue = this.queues.get(phase);
    if (!queue) {
      throw new Error(`Queue for ${phase} not found`);
    }

    // Validate and prepare jobs
    const bulkJobs = jobs.map((job) => {
      const validatedJob = EmailJobSchema.parse(job);
      return {
        name: `process-${phase}`,
        data: validatedJob,
        opts: {
          priority: this.getPriorityValue(validatedJob.priority),
          delay: 0,
          attempts:
            validatedJob.options?.retryAttempts ||
            this.config.retryStrategy.attempts,
        },
      };
    });

    // Add jobs in bulk
    const queueJobs = await queue.addBulk(bulkJobs);

    logger.info(`Added ${queueJobs.length} jobs to ${phase} queue`);
    this.emit("jobs:bulk-added", {
      phase,
      count: queueJobs.length,
    });

    return queueJobs;
  }

  /**
   * Process jobs from a specific phase queue
   */
  async startWorker(
    phase: "phase1" | "phase2" | "phase3",
    processor: (job: Job<EmailJob>) => Promise<JobResult>,
  ): Promise<any> {
    const queueName = this.config.queues[phase];
    const concurrency = this.config.concurrency[phase];

    const worker = new Worker(
      queueName,
      async (job: Job<EmailJob>) => {
        const startTime = Date.now();

        try {
          // Update progress
          await job.progress({ status: "processing", startTime });

          // Process the job
          const result = await processor(job);

          // Update metrics
          this.updateJobMetrics(phase, true, Date.now() - startTime);

          return result;
        } catch (error) {
          // Update metrics
          this.updateJobMetrics(phase, false, Date.now() - startTime);

          logger.error(`Job ${job.id} failed in ${phase}:`, error);
          throw error;
        }
      },
      {
        connection: this.redisConnection.duplicate(),
        concurrency,
        autorun: true,
      },
    );

    // Set up worker event handlers
    this.setupWorkerEventHandlers(phase, worker);

    this.workers.set(phase, worker);
    logger.info(`Started worker for ${phase} with concurrency ${concurrency}`);

    return worker;
  }

  /**
   * Set up worker event handlers
   */
  private setupWorkerEventHandlers(phase: string, worker: any): void {
    worker.on("completed", (job: any, result: any) => {
      logger.debug(`Worker completed job ${job.id} in ${phase}`);
    });

    worker.on("failed", (job: any, error: any) => {
      logger.error(`Worker failed job ${job?.id} in ${phase}:`, error);
    });

    worker.on("error", (error) => {
      logger.error(`Worker error in ${phase}:`, error);
      this.emit("worker:error", { phase, error });
    });

    worker.on("stalled", (jobId) => {
      logger.warn(`Job ${jobId} stalled in ${phase} worker`);
    });
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string, phase: string): Promise<Job | undefined> {
    const queue = this.queues.get(phase);
    if (!queue) return undefined;

    return (queue as any).getJob(jobId);
  }

  /**
   * Get jobs by status
   */
  async getJobs(
    phase: string,
    status: "waiting" | "active" | "completed" | "failed" | "delayed",
    start = 0,
    end = -1,
  ): Promise<Job[]> {
    const queue = this.queues.get(phase);
    if (!queue) return [];

    switch (status) {
      case "waiting":
        return (queue as any).getWaiting(start, end);
      case "active":
        return (queue as any).getActive(start, end);
      case "completed":
        return (queue as any).getCompleted(start, end);
      case "failed":
        return (queue as any).getFailed(start, end);
      case "delayed":
        return (queue as any).getDelayed(start, end);
      default:
        return [];
    }
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(phase: string, limit = 100): Promise<number> {
    const queue = this.queues.get(phase);
    if (!queue) return 0;

    const failedJobs = await queue.getFailed(0, limit);
    let retryCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retryCount++;
      } catch (error) {
        logger.error(`Failed to retry job ${job.id}:`, error);
      }
    }

    logger.info(`Retried ${retryCount} failed jobs in ${phase}`);
    return retryCount;
  }

  /**
   * Clean completed/failed jobs
   */
  async cleanJobs(
    phase: string,
    grace: number,
    limit = 1000,
    status: "completed" | "failed" = "completed",
  ): Promise<string[]> {
    const queue = this.queues.get(phase);
    if (!queue) return [];

    return queue.clean(grace, limit, status);
  }

  /**
   * Pause/resume queue
   */
  async pauseQueue(phase: string): Promise<void> {
    const queue = this.queues.get(phase);
    if (queue) {
      await queue.pause();
      const metrics = this.metrics.get(phase);
      if (metrics) metrics.paused = true;
      logger.info(`Paused ${phase} queue`);
    }
  }

  async resumeQueue(phase: string): Promise<void> {
    const queue = this.queues.get(phase);
    if (queue) {
      await queue.resume();
      const metrics = this.metrics.get(phase);
      if (metrics) metrics.paused = false;
      logger.info(`Resumed ${phase} queue`);
    }
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(
    phase?: string,
  ): Promise<QueueMetrics | Map<string, QueueMetrics>> {
    if (phase) {
      const metrics = await this.calculateQueueMetrics(phase);
      return metrics;
    }

    // Get metrics for all queues
    const allMetrics = new Map<string, QueueMetrics>();
    for (const [phase] of Array.from(this.queues.keys())) {
      const metrics = await this.calculateQueueMetrics(phase);
      allMetrics.set(phase, metrics);
    }
    return allMetrics;
  }

  /**
   * Calculate metrics for a specific queue
   */
  private async calculateQueueMetrics(phase: string): Promise<QueueMetrics> {
    const queue = this.queues.get(phase);
    const metrics = this.metrics.get(phase);

    if (!queue || !metrics) {
      throw new Error(`Queue ${phase} not found`);
    }

    // Get current counts
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    // Update metrics
    metrics.waiting = waiting;
    metrics.active = active;
    metrics.completed = completed;
    metrics.failed = failed;
    metrics.delayed = delayed;

    return { ...metrics };
  }

  /**
   * Update job processing metrics
   */
  private updateJobMetrics(
    phase: string,
    success: boolean,
    processingTime: number,
  ): void {
    const metrics = this.metrics.get(phase);
    if (!metrics) return;

    if (success) {
      metrics.completed++;
    } else {
      metrics.failed++;
    }

    // Update average processing time
    const totalJobs = metrics.completed + metrics.failed;
    if (totalJobs > 0) {
      metrics.averageProcessingTime =
        (metrics.averageProcessingTime * (totalJobs - 1) + processingTime) /
        totalJobs;

      // Update error rate
      metrics.errorRate = (metrics.failed / totalJobs) * 100;
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      const allMetrics = await this.getQueueMetrics();
      this.emit("metrics:update", allMetrics);

      // Log summary
      if (allMetrics instanceof Map) {
        for (const [phase, metrics] of Array.from(allMetrics.entries())) {
          logger.debug(
            `Queue ${phase}: ${metrics.active} active, ${metrics.waiting} waiting`,
          );
        }
      }
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Get priority value (lower number = higher priority)
   */
  private getPriorityValue(priority: EmailJob["priority"]): number {
    const priorityMap = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };
    return priorityMap[priority];
  }

  /**
   * Get queue health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    queues: Record<
      string,
      {
        healthy: boolean;
        issues: string[];
      }
    >;
  }> {
    let overallHealthy = true;
    const queueHealth: Record<string, { healthy: boolean; issues: string[] }> =
      {};

    for (const [phase, queue] of Array.from(this.queues.entries())) {
      const issues: string[] = [];
      let healthy = true;

      try {
        const metrics = await this.calculateQueueMetrics(phase);

        // Check for issues
        if (metrics.paused) {
          issues.push("Queue is paused");
          healthy = false;
        }

        if (metrics.errorRate > 50) {
          issues.push(`High error rate: ${metrics.errorRate.toFixed(1)}%`);
          healthy = false;
        }

        if (metrics.waiting > 10000) {
          issues.push(`Large backlog: ${metrics.waiting} waiting jobs`);
        }

        if (metrics.averageProcessingTime > 60000) {
          issues.push(
            `Slow processing: ${(metrics.averageProcessingTime / 1000).toFixed(1)}s average`,
          );
        }

        // Check if queue is responsive
        await queue.client.ping();
      } catch (error) {
        issues.push(
          `Queue error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        healthy = false;
      }

      queueHealth[phase] = { healthy, issues };
      if (!healthy) overallHealthy = false;
    }

    return {
      healthy: overallHealthy,
      queues: queueHealth,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info("Shutting down queue service...");

    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close workers first
    for (const [phase, worker] of Array.from(this.workers.entries())) {
      logger.debug(`Closing worker for ${phase}...`);
      await worker.close();
    }

    // Close queue events
    for (const [phase, events] of Array.from(this.queueEvents.entries())) {
      logger.debug(`Closing events for ${phase}...`);
      await events.close();
    }

    // Close schedulers (deprecated in newer BullMQ versions)
    for (const [phase, scheduler] of Array.from(this.schedulers.entries())) {
      logger.debug(`Closing scheduler for ${phase}...`);
      if (scheduler && scheduler.close) {
        await scheduler.close();
      }
    }

    // Close queues
    for (const [phase, queue] of Array.from(this.queues.entries())) {
      logger.debug(`Closing queue for ${phase}...`);
      await queue.close();
    }

    // Close Redis connection
    await this.redisConnection.quit();

    logger.info("Queue service shutdown complete");
    this.emit("shutdown");
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createEmailProcessingQueueService(
  config: Partial<QueueConfig>,
): EmailProcessingQueueService {
  const defaultConfig: QueueConfig = {
    redis: {
      host: "localhost",
      port: 6379,
    },
    queues: {
      phase1: "email-processing-phase1",
      phase2: "email-processing-phase2",
      phase3: "email-processing-phase3",
      results: "email-processing-results",
    },
    concurrency: {
      phase1: 10,
      phase2: 5,
      phase3: 3,
    },
    retryStrategy: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
    monitoring: {
      enableMetrics: true,
      metricsInterval: 10000,
      enableEvents: true,
    },
    ...config,
  };

  return new EmailProcessingQueueService(defaultConfig);
}
