import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// Message queue configuration schema
export const MessageQueueConfigSchema = z.object({
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(1), // Separate DB for queues
    keyPrefix: z.string().default('queue:'),
    maxRetriesPerRequest: z.number().default(3),
    lazyConnect: z.boolean().default(true),
    enableOfflineQueue: z.boolean().default(false)
  }),
  queues: z.object({
    defaultTtl: z.number().default(86400), // 24 hours
    maxLength: z.number().default(10000),
    trimStrategy: z.enum(['MAXLEN', 'MINID']).default('MAXLEN'),
    retryLimit: z.number().default(5),
    retryBackoff: z.enum(['fixed', 'exponential', 'linear']).default('exponential'),
    deadLetterQueue: z.boolean().default(true)
  }),
  processing: z.object({
    batchSize: z.number().default(10),
    concurrency: z.number().default(5),
    processingTimeout: z.number().default(30000), // 30 seconds
    idleTimeout: z.number().default(5000), // 5 seconds
    blockTimeout: z.number().default(1000) // 1 second
  })
});

export type MessageQueueConfig = z.infer<typeof MessageQueueConfigSchema>;

// Message schemas
export const BaseMessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: z.record(z.any()),
  priority: z.number().min(0).max(10).default(5),
  createdAt: z.number(),
  scheduledAt: z.number().optional(),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(5),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional()
});

export const GroceryMessageSchema = BaseMessageSchema.extend({
  type: z.enum([
    'grocery:price_update',
    'grocery:inventory_sync', 
    'grocery:product_match',
    'grocery:deal_analysis',
    'grocery:nutrition_fetch',
    'grocery:review_analysis',
    'grocery:recommendation_generate'
  ]),
  payload: z.object({
    productId: z.string().optional(),
    storeId: z.string().optional(),
    userId: z.string().optional(),
    data: z.record(z.any()),
    source: z.string().optional()
  })
});

export type BaseMessage = z.infer<typeof BaseMessageSchema>;
export type GroceryMessage = z.infer<typeof GroceryMessageSchema>;

// Queue statistics interface
export interface QueueStats {
  name: string;
  length: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  lastProcessed: number | null;
  throughput: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
  errorRate: number;
  avgProcessingTime: number;
}

// Message processing result
export interface ProcessingResult {
  messageId: string;
  success: boolean;
  result?: any;
  error?: Error;
  processingTime: number;
  retryCount: number;
  shouldRetry: boolean;
}

// Queue consumer interface
export interface QueueConsumer<T = BaseMessage> {
  name: string;
  concurrency: number;
  process: (message: T) => Promise<any>;
  onError?: (error: Error, message: T) => Promise<void>;
  onRetry?: (message: T, retryCount: number) => Promise<boolean>;
}

/**
 * RedisMessageQueue
 * 
 * High-performance Redis-based message queue using Redis Streams.
 * Supports priority queuing, retries, dead letter queues, and batch processing.
 * Optimized for grocery data processing workloads.
 */
export class RedisMessageQueue extends EventEmitter {
  private config: MessageQueueConfig;
  private redisClient!: Redis;
  private subscriberClient!: Redis;
  private isConnected = false;
  private consumers: Map<string, QueueConsumer> = new Map();
  private processingQueues: Map<string, Set<string>> = new Map();
  private stats: Map<string, QueueStats> = new Map();
  private processingInterval?: NodeJS.Timeout;

  constructor(config: Partial<MessageQueueConfig> = {}) {
    super();
    
    this.config = MessageQueueConfigSchema.parse(config);
    this.initializeRedisClients();
    this.setupEventHandlers();
  }

  private initializeRedisClients(): void {
    const redisConfig = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      lazyConnect: this.config.redis.lazyConnect,
      enableOfflineQueue: this.config.redis.enableOfflineQueue,
      maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
      retryDelayOnFailover: 100,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      }
    };

    this.redisClient = new Redis(redisConfig);
    this.subscriberClient = new Redis(redisConfig);
  }

  private setupEventHandlers(): void {
    this.redisClient.on('connect', () => {
      this.isConnected = true;
      this.emit('connected');
    });

    this.redisClient.on('error', (error: any) => {
      this.isConnected = false;
      this.emit('error', { source: 'redis', error });
    });

    this.redisClient.on('ready', () => {
      this.emit('ready');
      this.startProcessingLoop();
    });

    this.subscriberClient.on('error', (error: any) => {
      this.emit('error', { source: 'subscriber', error });
    });
  }

  // Core queue operations
  public async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await Promise.all([
        this.redisClient.connect(),
        this.subscriberClient.connect()
      ]);
      this.emit('queue:connected');
    } catch (error) {
      this.emit('queue:error', { operation: 'connect', error });
      throw error;
    }
  }

  public async enqueue<T extends BaseMessage>(
    queueName: string,
    message: T,
    options: {
      delay?: number;
      priority?: number;
      deduplicate?: boolean;
    } = {}
  ): Promise<string> {
    const messageId = message.id || nanoid();
    const now = Date.now();
    
    const queueMessage: T = {
      ...message,
      id: messageId,
      createdAt: now,
      scheduledAt: options.delay ? now + options.delay : now,
      priority: options.priority ?? message.priority ?? 5
    };

    // Validate message based on type
    if (message?.type?.startsWith('grocery:')) {
      GroceryMessageSchema.parse(queueMessage);
    } else {
      BaseMessageSchema.parse(queueMessage);
    }

    try {
      const streamKey = this.getStreamKey(queueName);
      
      // Check for deduplication
      if (options.deduplicate) {
        const exists = await this.checkMessageExists(queueName, messageId);
        if (exists) {
          this.emit('message:duplicate', { queueName, messageId });
          return messageId;
        }
      }

      // Add to Redis Stream
      await this.redisClient.xadd(
        streamKey,
        'MAXLEN', '~', String(this.config.queues.maxLength),
        '*', // Auto-generate stream ID
        'message', JSON.stringify(queueMessage)
      );

      // Handle delayed messages
      if (options.delay && queueMessage.scheduledAt) {
        await this.scheduleMessage(queueName, messageId, queueMessage.scheduledAt);
      }

      // Update stats
      await this.updateQueueStats(queueName, 'enqueued');

      this.emit('message:enqueued', {
        queueName,
        messageId,
        type: message.type,
        priority: queueMessage.priority,
        delayed: !!options.delay
      });

      return messageId;

    } catch (error) {
      this.emit('message:error', { 
        operation: 'enqueue', 
        queueName, 
        messageId, 
        error 
      });
      throw error;
    }
  }

  public async dequeue(
    queueName: string,
    count: number = 1
  ): Promise<BaseMessage[]> {
    try {
      const streamKey = this.getStreamKey(queueName);
      const consumerGroup = this.getConsumerGroup(queueName);
      const consumerName = `consumer-${process.pid}-${nanoid(8)}`;

      // Try to read new messages
      const results = await this.redisClient.xreadgroup(
      'GROUP', consumerGroup, consumerName,
      'COUNT', count.toString(),
      'BLOCK', this.config.processing.blockTimeout.toString(),
      'STREAMS', streamKey, '>'
      );

      const messages: BaseMessage[] = [];
      
      if (results && Array.isArray(results) && results.length > 0) {
      const [, streamEntries] = results[0] as [string, [string, string[]][] | undefined] || [, []];
        
        for (const [streamId, fields] of streamEntries || []) {
        const messageData = fields?.[1] || '{}'; // fields = ['message', '{...}']
        const message = JSON.parse(messageData) as BaseMessage;
          
          messages.push({
            ...message,
            metadata: {
              ...message.metadata,
              streamId,
              consumerGroup,
              consumerName
            }
          });
        }
      }

      this.emit('messages:dequeued', {
        queueName,
        count: messages?.length || 0,
        consumerName
      });

      return messages;

    } catch (error) {
      this.emit('message:error', {
        operation: 'dequeue',
        queueName,
        error
      });
      throw error;
    }
  }

  // Consumer management
  public async registerConsumer<T extends BaseMessage>(
    queueName: string,
    consumer: QueueConsumer<T>
  ): Promise<void> {
    try {
      // Ensure consumer group exists
      await this.ensureConsumerGroup(queueName);
      
      this.consumers.set(`${queueName}:${consumer.name}`, consumer as QueueConsumer);
      
      this.emit('consumer:registered', {
        queueName,
        consumerName: consumer.name,
        concurrency: consumer.concurrency
      });

    } catch (error) {
      this.emit('consumer:error', {
        operation: 'register',
        queueName,
        consumerName: consumer.name,
        error
      });
      throw error;
    }
  }

  public async startConsumer(queueName: string, consumerName: string): Promise<void> {
    const key = `${queueName}:${consumerName}`;
    const consumer = this.consumers.get(key);
    
    if (!consumer) {
      throw new Error(`Consumer ${consumerName} not found for queue ${queueName}`);
    }

    // Start concurrent workers
    const workers = [];
    for (let i = 0; i < consumer.concurrency; i++) {
      workers.push(this.startWorker(queueName, consumer, i));
    }

    await Promise.all(workers);
    
    this.emit('consumer:started', {
      queueName,
      consumerName,
      workers: consumer.concurrency
    });
  }

  private async startWorker(
    queueName: string,
    consumer: QueueConsumer,
    workerId: number
  ): Promise<void> {
    const workerName = `${consumer.name}-${workerId}`;
    
    while (true) {
      try {
        const messages = await this.dequeue(queueName, this.config.processing.batchSize);
        
        if ((messages?.length || 0) === 0) {
          await this.sleep(this.config.processing.idleTimeout);
          continue;
        }

        // Process messages concurrently within batch
        const processingPromises = messages?.map(message => 
          this.processMessage(queueName, consumer, message, workerName)
        );

        await Promise.allSettled(processingPromises);

      } catch (error) {
        this.emit('worker:error', {
          queueName,
          workerName,
          error
        });
        
        // Wait before retrying to prevent tight error loops
        await this.sleep(5000);
      }
    }
  }

  private async processMessage(
    queueName: string,
    consumer: QueueConsumer,
    message: BaseMessage,
    workerName: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const processingKey = `${queueName}:${message.id}`;
    
    try {
      // Mark message as processing
      this.addToProcessingQueue(queueName, message.id);
      
      this.emit('message:processing', {
        queueName,
        messageId: message.id,
        workerName,
        type: message.type
      });

      // Process with timeout
      const result = await Promise.race([
        consumer.process(message),
        this.createTimeoutPromise(this.config.processing.processingTimeout)
      ]);

      const processingTime = Date.now() - startTime;

      // Acknowledge successful processing
      await this.acknowledgeMessage(queueName, message);
      
      // Update stats
      await this.updateQueueStats(queueName, 'completed', processingTime);
      
      this.emit('message:completed', {
        queueName,
        messageId: message.id,
        result,
        processingTime,
        workerName
      });

      return {
        messageId: message.id,
        success: true,
        result,
        processingTime,
        retryCount: message.retryCount,
        shouldRetry: false
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const shouldRetry = await this.handleProcessingError(
        queueName,
        consumer,
        message,
        error as Error
      );

      return {
        messageId: message.id,
        success: false,
        error: error as Error,
        processingTime,
        retryCount: message.retryCount,
        shouldRetry
      };

    } finally {
      this.removeFromProcessingQueue(queueName, message.id);
    }
  }

  // Error handling and retry logic
  private async handleProcessingError(
    queueName: string,
    consumer: QueueConsumer,
    message: BaseMessage,
    error: Error
  ): Promise<boolean> {
    const shouldRetry = message.retryCount < message.maxRetries;
    
    this.emit('message:error', {
      queueName,
      messageId: message.id,
      error,
      retryCount: message.retryCount,
      shouldRetry
    });

    // Call consumer's error handler
    if (consumer.onError) {
      try {
        await consumer.onError(error, message);
      } catch (handlerError) {
        this.emit('consumer:error', {
          queueName,
          consumerName: consumer.name,
          error: handlerError,
          originalError: error
        });
      }
    }

    if (shouldRetry) {
      // Check if consumer wants to retry
      let consumerWantsRetry = true;
      if (consumer.onRetry) {
        try {
          consumerWantsRetry = await consumer.onRetry(message, message.retryCount + 1);
        } catch (handlerError) {
          consumerWantsRetry = false;
        }
      }

      if (consumerWantsRetry) {
        await this.retryMessage(queueName, message, error);
        return true;
      }
    }

    // Move to dead letter queue
    if (this.config.queues.deadLetterQueue) {
      await this.moveToDeadLetterQueue(queueName, message, error);
    }

    await this.updateQueueStats(queueName, 'failed');
    return false;
  }

  private async retryMessage(
    queueName: string,
    message: BaseMessage,
    error: Error
  ): Promise<void> {
    const retryMessage = {
      ...message,
      retryCount: message.retryCount + 1,
      scheduledAt: this.calculateRetryDelay(message.retryCount + 1),
      metadata: {
        ...message.metadata,
        lastError: error.message,
        retryHistory: [
          ...(message.metadata?.retryHistory || []),
          {
            attemptNumber: message.retryCount + 1,
            error: error.message,
            timestamp: Date.now()
          }
        ]
      }
    };

    await this.enqueue(queueName, retryMessage, {
      delay: retryMessage.scheduledAt! - Date.now()
    });

    await this.updateQueueStats(queueName, 'retrying');

    this.emit('message:retry', {
      queueName,
      messageId: message.id,
      retryCount: retryMessage.retryCount,
      delay: retryMessage.scheduledAt! - Date.now()
    });
  }

  // Utility methods
  private getStreamKey(queueName: string): string {
    return `${this.config.redis.keyPrefix}${queueName}:stream`;
  }

  private getConsumerGroup(queueName: string): string {
    return `${queueName}:processors`;
  }

  private getDeadLetterQueueKey(queueName: string): string {
    return `${this.config.redis.keyPrefix}${queueName}:dlq`;
  }

  private async ensureConsumerGroup(queueName: string): Promise<void> {
    try {
      const streamKey = this.getStreamKey(queueName);
      const consumerGroup = this.getConsumerGroup(queueName);
      
      await this.redisClient.xgroup('CREATE', streamKey, consumerGroup, '0', 'MKSTREAM');
    } catch (error) {
      // Group might already exist, check if it's a different error
      if (!(error as Error).message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  private async checkMessageExists(queueName: string, messageId: string): Promise<boolean> {
    const key = `${this.config.redis.keyPrefix}${queueName}:msg:${messageId}`;
    const exists = await this.redisClient.exists(key);
    return exists === 1;
  }

  private async scheduleMessage(
    queueName: string,
    messageId: string,
    scheduledAt: number
  ): Promise<void> {
    const key = `${this.config.redis.keyPrefix}${queueName}:scheduled`;
    await this.redisClient.zadd(key, String(scheduledAt), messageId);
  }

  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 1000; // 1 second
    const now = Date.now();

    switch (this.config.queues.retryBackoff) {
      case 'fixed':
        return now + baseDelay;
      case 'linear':
        return now + (baseDelay * retryCount);
      case 'exponential':
      default:
        return now + (baseDelay * Math.pow(2, retryCount - 1));
    }
  }

  private async acknowledgeMessage(queueName: string, message: BaseMessage): Promise<void> {
    const streamKey = this.getStreamKey(queueName);
    const consumerGroup = this.getConsumerGroup(queueName);
    const streamId = message.metadata?.streamId;

    if (streamId) {
      await this.redisClient.xack(streamKey, consumerGroup, streamId);
    }
  }

  private async moveToDeadLetterQueue(
    queueName: string,
    message: BaseMessage,
    error: Error
  ): Promise<void> {
    const dlqKey = this.getDeadLetterQueueKey(queueName);
    const dlqMessage = {
      ...message,
      metadata: {
        ...message.metadata,
        deadLetterReason: error.message,
        deadLetterTimestamp: Date.now(),
        originalQueue: queueName
      }
    };

    await this.redisClient.lpush(dlqKey, JSON.stringify(dlqMessage));
    
    this.emit('message:dead_letter', {
      queueName,
      messageId: message.id,
      error: error.message
    });
  }

  private addToProcessingQueue(queueName: string, messageId: string): void {
    if (!this.processingQueues.has(queueName)) {
      this.processingQueues.set(queueName, new Set());
    }
    this.processingQueues.get(queueName)!.add(messageId);
  }

  private removeFromProcessingQueue(queueName: string, messageId: string): void {
    const queue = this.processingQueues.get(queueName);
    if (queue) {
      queue.delete(messageId);
    }
  }

  private async updateQueueStats(
    queueName: string,
    operation: 'enqueued' | 'completed' | 'failed' | 'retrying',
    processingTime?: number
  ): Promise<void> {
    // Implementation would update Redis-based stats
    // For now, emit event for monitoring
    this.emit('stats:update', {
      queueName,
      operation,
      processingTime,
      timestamp: Date.now()
    });
  }

  private startProcessingLoop(): void {
    // Handle scheduled messages
    this.processingInterval = setInterval(async () => {
      try {
        await this.processScheduledMessages();
      } catch (error) {
        this.emit('processing:error', error);
      }
    }, 5000); // Check every 5 seconds
  }

  private async processScheduledMessages(): Promise<void> {
    // Check for scheduled messages that are ready to be processed
    // Implementation would move messages from scheduled set to main queue
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout')), timeout);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  public async getQueueStats(queueName: string): Promise<QueueStats | null> {
    return this.stats.get(queueName) || null;
  }

  public async getAllQueueStats(): Promise<QueueStats[]> {
    return Array.from(this.stats.values());
  }

  public async pauseQueue(queueName: string): Promise<void> {
    // Implementation for pausing queue processing
    this.emit('queue:paused', { queueName });
  }

  public async resumeQueue(queueName: string): Promise<void> {
    // Implementation for resuming queue processing
    this.emit('queue:resumed', { queueName });
  }

  public async clearQueue(queueName: string): Promise<number> {
    const streamKey = this.getStreamKey(queueName);
    const result = await this.redisClient.del(streamKey);
    
    this.emit('queue:cleared', { queueName, deletedMessages: result });
    return result;
  }

  public async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    await Promise.all([
      this.redisClient.quit(),
      this.subscriberClient.quit()
    ]);

    this.removeAllListeners();
    this.emit('shutdown');
  }
}