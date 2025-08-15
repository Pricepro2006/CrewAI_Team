/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-expect-error - BullMQ type definitions issue with v5
import { Queue, Worker } from "bullmq";
import { UnifiedEmailService } from "../../api/services/UnifiedEmailService.js";
import { logger } from "../../utils/logger.js";
import { metrics } from "../../api/monitoring/metrics.js";
import { io } from "../../api/websocket/index.js";

export interface EmailQueueJob {
  emailData: any; // Graph API email data
  receivedAt: Date;
  retryCount?: number;
}

export interface DeadLetterJob extends EmailQueueJob {
  failedAt: Date;
  error: {
    message: string;
    stack?: string;
  };
}

export interface EmailQueueConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class EmailQueueProcessor {
  private queue: any;
  private emailService: UnifiedEmailService;
  private config: Required<EmailQueueConfig>;

  constructor(config: EmailQueueConfig = {}) {
    this.config = {
      concurrency: config.concurrency || 5,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      redis: config.redis || {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: undefined,
      },
    };

    // Initialize services
    this.emailService = new UnifiedEmailService();

    // Try to initialize queue with Redis
    try {
      // Initialize queue
      this.queue = new Queue("email-notifications", {
        connection: this?.config?.redis,
        defaultJobOptions: {
          attempts: this?.config?.maxRetries,
          backoff: {
            type: "exponential",
            delay: this?.config?.retryDelay,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      });

      // Setup queue processing
      this.setupQueueHandlers();

      logger.info(
        "Email queue processor initialized with Redis",
        "EMAIL_QUEUE",
        {
          concurrency: this?.config?.concurrency,
          maxRetries: this?.config?.maxRetries,
        },
      );
    } catch (error) {
      logger.warn(
        "Redis connection failed, running without queue support",
        "EMAIL_QUEUE",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Queue will be undefined, methods will handle this gracefully
    }
  }

  /**
   * Add email to processing queue
   */
  async addEmailToQueue(emailData: any): Promise<string> {
    try {
      // If queue not available, process immediately
      if (!this.queue) {
        logger.info("Processing email directly (no queue)", "EMAIL_QUEUE", {
          subject: emailData.subject?.substring(0, 50),
        });

        const processedEmail =
          await this?.emailService?.processIncomingEmail(emailData);

        // Broadcast to connected clients
        if (io) {
          io.emit("email:processed", {
            emailId: processedEmail.id,
            subject: processedEmail.subject,
            from: processedEmail.from,
            priority: processedEmail.priority,
            workflowState: processedEmail.workflowState,
          });
        }

        return processedEmail.id;
      }

      const job = await this?.queue?.add(
        {
          emailData,
          receivedAt: new Date(),
        },
        {
          priority: this.getEmailPriority(emailData),
        },
      );

      metrics.increment("email_queue.job_added");
      logger.info("Email added to queue", "EMAIL_QUEUE", {
        jobId: job.id,
        subject: emailData.subject?.substring(0, 50),
      });

      return job.id as string;
    } catch (error) {
      logger.error("Failed to add email to queue", "EMAIL_QUEUE", {
        error: error instanceof Error ? error.message : String(error),
      });
      metrics.increment("email_queue.add_error");
      throw error;
    }
  }

  /**
   * Setup queue event handlers
   */
  private setupQueueHandlers(): void {
    if (!this.queue) {
      return; // No queue, no handlers needed
    }

    // Create worker for processing jobs
    const worker = new Worker(
      "email-notifications",
      async (job: any) => {
        return this.processEmailJob(job);
      },
      {
        connection: this?.config?.redis,
        concurrency: this?.config?.concurrency!,
      },
    );

    // Worker event handlers
    worker.on("completed", (job: any, result: any) => {
      metrics.increment("email_queue.job_completed");
      logger.info("Email processing completed", "EMAIL_QUEUE", {
        jobId: job.id,
        emailId: result.id,
        duration: Date.now() - job.timestamp,
      });
    });

    worker.on("failed", (job: any, err: Error) => {
      metrics.increment("email_queue.job_failed");
      logger.error("Email processing failed", "EMAIL_QUEUE", {
        jobId: job.id,
        attempt: job.attemptsMade,
        error: err.message,
      });
    });

    worker.on("stalled", (job: any) => {
      metrics.increment("email_queue.job_stalled");
      logger.warn("Email processing stalled", "EMAIL_QUEUE", {
        jobId: job.id,
      });
    });

    // Health monitoring
    setInterval(() => this.checkQueueHealth(), 60000); // Every minute
  }

  /**
   * Process individual email job
   */
  private async processEmailJob(job: any): Promise<any> {
    const startTime = Date.now();
    const { emailData, receivedAt } = job.data;

    try {
      logger.info("Processing email job", "EMAIL_QUEUE", {
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });

      // Update job progress
      await job.updateProgress(10);

      // Process email through unified service
      const processedEmail =
        await this?.emailService?.processIncomingEmail(emailData);

      await job.updateProgress(90);

      // Broadcast to connected clients
      if (io) {
        io.emit("email:processed", {
          emailId: processedEmail.id,
          subject: processedEmail.subject,
          from: processedEmail.from,
          priority: processedEmail.priority,
          workflowState: processedEmail.workflowState,
        });
      }

      await job.updateProgress(100);

      // Record metrics
      const processingTime = Date.now() - startTime;
      const queueTime = new Date(receivedAt).getTime() - job.timestamp;

      metrics.histogram("email_queue.processing_time", processingTime);
      metrics.histogram("email_queue.queue_time", queueTime);

      return {
        id: processedEmail.id,
        processingTime,
        queueTime,
      };
    } catch (error) {
      logger.error("Failed to process email job", "EMAIL_QUEUE", {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Add to dead letter queue if max retries exceeded
      if (job.attemptsMade >= this?.config?.maxRetries! - 1) {
        await this.addToDeadLetterQueue(job.data, error as Error);
      }

      throw error;
    }
  }

  /**
   * Get email priority based on content
   */
  private getEmailPriority(emailData: any): number {
    // Higher number = higher priority

    // Critical keywords
    if (this.containsCriticalKeywords(emailData)) {
      return 10;
    }

    // High importance flag
    if (emailData.importance === "high") {
      return 8;
    }

    // From VIP senders
    if (this.isVipSender(emailData.from?.emailAddress?.address)) {
      return 7;
    }

    // Has attachments (might be orders/quotes)
    if (emailData.hasAttachments) {
      return 5;
    }

    // Default priority
    return 3;
  }

  /**
   * Check for critical keywords
   */
  private containsCriticalKeywords(emailData: any): boolean {
    const criticalKeywords = [
      "urgent",
      "critical",
      "emergency",
      "asap",
      "immediately",
      "escalation",
      "complaint",
      "cancel order",
      "refund",
    ];

    const content =
      `${emailData.subject} ${emailData.body?.content}`.toLowerCase();
    return criticalKeywords.some((keyword: any) => content.includes(keyword));
  }

  /**
   * Check if sender is VIP
   */
  private isVipSender(email?: string): boolean {
    if (!email) return false;

    const vipDomains = [
      "@microsoft.com",
      "@google.com",
      "@amazon.com",
      "@apple.com",
    ];

    return vipDomains.some((domain: any) => email.endsWith(domain));
  }

  /**
   * Add failed job to dead letter queue
   */
  private async addToDeadLetterQueue(
    jobData: EmailQueueJob,
    error: Error,
  ): Promise<void> {
    if (!this.queue) {
      logger.error(
        "Failed to add to dead letter queue - no queue available",
        "EMAIL_QUEUE",
        {
          jobData,
          error: error.message,
        },
      );
      return;
    }

    try {
      const deadLetterJob: DeadLetterJob = {
        ...jobData,
        failedAt: new Date(),
        error: {
          message: error.message,
          stack: error.stack,
        },
      };

      await this?.queue?.add("dead-letter", deadLetterJob);

      metrics.increment("email_queue.dead_letter_added");
    } catch (dlqError) {
      logger.error("Failed to add to dead letter queue", "EMAIL_QUEUE", {
        error: dlqError instanceof Error ? dlqError.message : String(dlqError),
      });
    }
  }

  /**
   * Check queue health
   */
  private async checkQueueHealth(): Promise<void> {
    if (!this.queue) {
      return; // No queue to check
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this?.queue?.getWaitingCount(),
        this?.queue?.getActiveCount(),
        this?.queue?.getCompletedCount(),
        this?.queue?.getFailedCount(),
        this?.queue?.getDelayedCount(),
      ]);

      const health = {
        waiting,
        active,
        completed,
        failed,
        delayed,
        isHealthy: waiting < 1000 && failed < 100,
      };

      metrics.gauge("email_queue.waiting", waiting);
      metrics.gauge("email_queue.active", active);
      metrics.gauge("email_queue.failed", failed);

      if (!health.isHealthy) {
        logger.warn("Email queue health check failed", "EMAIL_QUEUE", health);
      }
    } catch (error) {
      logger.error("Failed to check queue health", "EMAIL_QUEUE", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    if (!this.queue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
        healthy: true,
        message: "Queue not available (Redis not connected)",
      };
    }

    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        this?.queue?.getWaitingCount(),
        this?.queue?.getActiveCount(),
        this?.queue?.getCompletedCount(),
        this?.queue?.getFailedCount(),
        this?.queue?.getDelayedCount(),
        this?.queue?.isPaused(),
      ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      healthy: waiting < 1000 && failed < 100,
    };
  }

  /**
   * Pause queue processing
   */
  async pause(): Promise<void> {
    if (!this.queue) {
      logger.info("No queue to pause (Redis not connected)", "EMAIL_QUEUE");
      return;
    }
    await this?.queue?.pause();
    logger.info("Email queue paused", "EMAIL_QUEUE");
  }

  /**
   * Resume queue processing
   */
  async resume(): Promise<void> {
    if (!this.queue) {
      logger.info("No queue to resume (Redis not connected)", "EMAIL_QUEUE");
      return;
    }
    await this?.queue?.resume();
    logger.info("Email queue resumed", "EMAIL_QUEUE");
  }

  /**
   * Gracefully shutdown queue
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down email queue processor", "EMAIL_QUEUE");

    if (!this.queue) {
      logger.info("No queue to shutdown (Redis not connected)", "EMAIL_QUEUE");
      return;
    }

    // Stop accepting new jobs
    await this?.queue?.pause();

    // Wait for active jobs to complete (max 30 seconds)
    const timeout = 30000;
    const startTime = Date.now();

    while ((await this?.queue?.getActiveCount()) > 0) {
      if (Date.now() - startTime > timeout) {
        logger.warn(
          "Timeout waiting for active jobs to complete",
          "EMAIL_QUEUE",
        );
        break;
      }
      await new Promise((resolve: any) => setTimeout(resolve, 1000));
    }

    // Close queue
    await this?.queue?.close();
    logger.info("Email queue processor shutdown complete", "EMAIL_QUEUE");
  }
}
