import { Queue, type Job } from "bullmq";
import { UnifiedEmailService } from "@/api/services/UnifiedEmailService";
import { logger } from "@/utils/logger";
import { metrics } from "@/api/monitoring/metrics";
import { io } from "@/api/websocket";

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
  private queue: Queue<EmailQueueJob>;
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

    // Initialize queue
    this.queue = new Queue("email-notifications", {
      redis: this.config.redis,
      defaultJobOptions: {
        attempts: this.config.maxRetries,
        backoff: {
          type: "exponential",
          delay: this.config.retryDelay,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    // Initialize services
    this.emailService = new UnifiedEmailService();

    // Setup queue processing
    this.setupQueueHandlers();

    logger.info("Email queue processor initialized", "EMAIL_QUEUE", {
      concurrency: this.config.concurrency,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Add email to processing queue
   */
  async addEmailToQueue(emailData: any): Promise<string> {
    try {
      const job = await this.queue.add(
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
    // Process jobs
    this.queue.process(
      this.config.concurrency!,
      async (job: Job<EmailQueueJob>) => {
        return this.processEmailJob(job);
      },
    );

    // Queue event handlers
    this.queue.on("completed", (job: Job<EmailQueueJob>, result: any) => {
      metrics.increment("email_queue.job_completed");
      logger.info("Email processing completed", "EMAIL_QUEUE", {
        jobId: job.id,
        emailId: result.id,
        duration: Date.now() - job.timestamp,
      });
    });

    this.queue.on("failed", (job: Job<EmailQueueJob>, err: Error) => {
      metrics.increment("email_queue.job_failed");
      logger.error("Email processing failed", "EMAIL_QUEUE", {
        jobId: job.id,
        attempt: job.attemptsMade,
        error: err.message,
      });
    });

    this.queue.on("stalled", (job: Job<EmailQueueJob>) => {
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
  private async processEmailJob(job: Job<EmailQueueJob>): Promise<any> {
    const startTime = Date.now();
    const { emailData, receivedAt } = job.data;

    try {
      logger.info("Processing email job", "EMAIL_QUEUE", {
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });

      // Update job progress
      await job.progress(10);

      // Process email through unified service
      const processedEmail =
        await this.emailService.processIncomingEmail(emailData);

      await job.progress(90);

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

      await job.progress(100);

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
      if (job.attemptsMade >= this.config.maxRetries! - 1) {
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
    return criticalKeywords.some((keyword) => content.includes(keyword));
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

    return vipDomains.some((domain) => email.endsWith(domain));
  }

  /**
   * Add failed job to dead letter queue
   */
  private async addToDeadLetterQueue(
    jobData: EmailQueueJob,
    error: Error,
  ): Promise<void> {
    try {
      const deadLetterJob: DeadLetterJob = {
        ...jobData,
        failedAt: new Date(),
        error: {
          message: error.message,
          stack: error.stack,
        },
      };

      await this.queue.add("dead-letter", deadLetterJob);

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
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
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
    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
        this.queue.isPaused(),
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
    await this.queue.pause();
    logger.info("Email queue paused", "EMAIL_QUEUE");
  }

  /**
   * Resume queue processing
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info("Email queue resumed", "EMAIL_QUEUE");
  }

  /**
   * Gracefully shutdown queue
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down email queue processor", "EMAIL_QUEUE");

    // Stop accepting new jobs
    await this.queue.pause();

    // Wait for active jobs to complete (max 30 seconds)
    const timeout = 30000;
    const startTime = Date.now();

    while ((await this.queue.getActiveCount()) > 0) {
      if (Date.now() - startTime > timeout) {
        logger.warn(
          "Timeout waiting for active jobs to complete",
          "EMAIL_QUEUE",
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Close queue
    await this.queue.close();
    logger.info("Email queue processor shutdown complete", "EMAIL_QUEUE");
  }
}
