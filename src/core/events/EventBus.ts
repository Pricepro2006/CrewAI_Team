import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// Event schemas and types
export const BaseEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  version: z.number().default(1),
  source: z.string(), // Microservice that emitted the event
  timestamp: z.number(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(), // ID of the command that caused this event
  metadata: z.record(z.any()).default({}),
  payload: z.record(z.any())
});

export const EventEnvelopeSchema = z.object({
  event: BaseEventSchema,
  routingKey: z.string(),
  headers: z.record(z.string()).default({}),
  deliveryInfo: z.object({
    attempt: z.number().default(1),
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(1000),
    publishedAt: z.number(),
    expiresAt: z.number().optional()
  })
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

// Event handler interface
export interface EventHandler<T = any> {
  eventType: string;
  version?: number;
  handle(event: BaseEvent & { payload: T }): Promise<void>;
  onError?(event: BaseEvent & { payload: T }, error: Error): Promise<void>;
}

// Event bus configuration
export const EventBusConfigSchema = z.object({
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(3), // Separate DB for events
    keyPrefix: z.string().default('events:'),
    maxRetriesPerRequest: z.number().default(3)
  }),
  service: z.object({
    name: z.string(),
    version: z.string().default('1.0.0'),
    instanceId: z.string().default(() => nanoid(8))
  }),
  events: z.object({
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(1000),
    eventTtl: z.number().default(86400000), // 24 hours
    enableEventStore: z.boolean().default(true),
    enableMetrics: z.boolean().default(true)
  }),
  subscriptions: z.object({
    consumerGroup: z.string().optional(),
    batchSize: z.number().default(10),
    processingTimeout: z.number().default(30000),
    idleTimeout: z.number().default(5000)
  })
});

export type EventBusConfig = z.infer<typeof EventBusConfigSchema>;

/**
 * EventBus - Distributed event-driven communication system
 * 
 * Features:
 * - Redis-based pub/sub with persistence
 * - Event sourcing with replay capabilities
 * - Service discovery and routing
 * - Circuit breaker and retry patterns
 * - Event versioning and schema evolution
 * - Comprehensive monitoring and observability
 */
export class EventBus extends EventEmitter {
  private config: EventBusConfig;
  private publisherClient: Redis;
  private subscriberClient: Redis;
  private eventStoreClient: Redis;
  
  private handlers: Map<string, EventHandler[]> = new Map();
  private subscriptions: Set<string> = new Set();
  private isConnected = false;
  private isShuttingDown = false;
  
  // Metrics and monitoring
  private metrics = {
    published: 0,
    consumed: 0,
    errors: 0,
    retries: 0,
    lastActivity: Date.now()
  };
  
  // Circuit breaker state per event type
  private circuitBreakers: Map<string, {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open';
  }> = new Map();

  constructor(config: Partial<EventBusConfig> = {}) {
    super();
    
    this.config = EventBusConfigSchema.parse({
      ...config,
      service: {
        name: config.service?.name || 'unknown-service',
        ...config.service
      }
    });
    
    this.initializeRedisClients();
    this.setupEventHandlers();
    this.startHealthCheck();
  }

  private initializeRedisClients(): void {
    const redisConfig = {
      host: this?.config?.redis.host,
      port: this?.config?.redis.port,
      password: this?.config?.redis.password,
      db: this?.config?.redis.db,
      maxRetriesPerRequest: this?.config?.redis.maxRetriesPerRequest,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true
    };

    this.publisherClient = new Redis(redisConfig);
    this.subscriberClient = new Redis(redisConfig);
    this.eventStoreClient = new Redis(redisConfig);

    // Setup Redis event handlers
    this?.publisherClient?.on('connect', () => {
      this.emit('publisher:connected');
    });

    this?.publisherClient?.on('error', (error: any) => {
      this.emit('publisher:error', error);
    });

    this?.subscriberClient?.on('connect', () => {
      this.emit('subscriber:connected');
    });

    this?.subscriberClient?.on('error', (error: any) => {
      this.emit('subscriber:error', error);
    });
  }

  private setupEventHandlers(): void {
    this.on('publisher:connected', () => {
      this.registerService();
    });

    this.on('subscriber:connected', () => {
      this.reestablishSubscriptions();
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private startHealthCheck(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  // Core event bus operations
  public async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await Promise.all([
        this?.publisherClient?.connect(),
        this?.subscriberClient?.connect(),
        this?.eventStoreClient?.connect()
      ]);

      this.isConnected = true;
      this.emit('connected');
      
      console.log(`EventBus connected for service: ${this?.config?.service.name}@${this?.config?.service.instanceId}`);
    } catch (error) {
      this.emit('connection:error', error);
      throw error;
    }
  }

  public async publish<T = any>(
    eventType: string,
    payload: T,
    options: {
      routingKey?: string;
      correlationId?: string;
      causationId?: string;
      metadata?: Record<string, any>;
      ttl?: number;
      priority?: number;
    } = {}
  ): Promise<string> {
    if (!this.isConnected) {
      throw new Error('EventBus is not connected');
    }

    const eventId = nanoid();
    const now = Date.now();

    const event: BaseEvent = {
      id: eventId,
      type: eventType,
      version: 1,
      source: this?.config?.service.name,
      timestamp: now,
      correlationId: options.correlationId,
      causationId: options.causationId,
      metadata: {
        ...options.metadata,
        serviceVersion: this?.config?.service.version,
        instanceId: this?.config?.service.instanceId
      },
      payload: payload as Record<string, any>
    };

    const envelope: EventEnvelope = {
      event,
      routingKey: options.routingKey || eventType,
      headers: {
        'content-type': 'application/json',
        'service': this?.config?.service.name,
        'priority': (options.priority || 5).toString()
      },
      deliveryInfo: {
        attempt: 1,
        maxRetries: this?.config?.events.maxRetries,
        retryDelay: this?.config?.events.retryDelay,
        publishedAt: now,
        expiresAt: options.ttl ? now + options.ttl : now + this?.config?.events.eventTtl
      }
    };

    try {
      // Validate event structure
      EventEnvelopeSchema.parse(envelope);

      // Store in event store if enabled
      if (this?.config?.events.enableEventStore) {
        await this.storeEvent(envelope);
      }

      // Publish to Redis streams for reliability
      const streamKey = this.getStreamKey(envelope.routingKey);
      const streamId = await this?.publisherClient?.xadd(
        streamKey,
        'MAXLEN', '~', '10000', // Keep last 10k events per stream
        '*', // Auto-generate stream ID
        'envelope', JSON.stringify(envelope)
      );

      // Also publish to pub/sub for real-time delivery
      await this?.publisherClient?.publish(
        this.getChannelKey(envelope.routingKey),
        JSON.stringify(envelope)
      );

      this?.metrics?.published++;
      this?.metrics?.lastActivity = Date.now();

      this.emit('event:published', {
        eventId,
        eventType,
        routingKey: envelope.routingKey,
        streamId
      });

      return eventId;

    } catch (error) {
      this?.metrics?.errors++;
      this.emit('event:publish_error', { eventId, eventType, error });
      throw error;
    }
  }

  public async subscribe<T = any>(
    eventType: string | string[],
    handler: EventHandler<T>,
    options: {
      routingPattern?: string;
      fromBeginning?: boolean;
      consumerGroup?: string;
      batchSize?: number;
    } = {}
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('EventBus is not connected');
    }

    const eventTypes = Array.isArray(eventType) ? eventType : [eventType];

    for (const type of eventTypes) {
      // Register handler
      if (!this?.handlers?.has(type)) {
        this?.handlers?.set(type, []);
      }
      this?.handlers?.get(type)!.push(handler);

      // Subscribe to pub/sub for real-time events
      const channelKey = this.getChannelKey(type);
      await this?.subscriberClient?.subscribe(channelKey);
      this?.subscriptions?.add(channelKey);

      // Setup stream consumer for reliability
      const streamKey = this.getStreamKey(type);
      const consumerGroup = options.consumerGroup || this.getConsumerGroup();
      
      try {
        await this?.subscriberClient?.xgroup(
          'CREATE', streamKey, consumerGroup, 
          options.fromBeginning ? '0' : '$', 
          'MKSTREAM'
        );
      } catch (error) {
        // Group might already exist
        if (!(error as Error).message.includes('BUSYGROUP')) {
          throw error;
        }
      }

      this.emit('subscription:created', { eventType: type, handler: handler?.constructor?.name });
    }

    // Start consuming if not already started
    this.startConsuming(options);
  }

  public unsubscribe(eventType: string, handler?: EventHandler): void {
    if (handler) {
      const handlers = this?.handlers?.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
        if (handlers?.length || 0 === 0) {
          this?.handlers?.delete(eventType);
        }
      }
    } else {
      this?.handlers?.delete(eventType);
    }

    // Unsubscribe from Redis if no more handlers
    if (!this?.handlers?.has(eventType)) {
      const channelKey = this.getChannelKey(eventType);
      this?.subscriberClient?.unsubscribe(channelKey);
      this?.subscriptions?.delete(channelKey);
    }

    this.emit('subscription:removed', { eventType, handler: handler?.constructor.name });
  }

  private async startConsuming(options: {
    batchSize?: number;
    processingTimeout?: number;
  } = {}): Promise<void> {
    const batchSize = options.batchSize || this?.config?.subscriptions.batchSize;
    const timeout = options.processingTimeout || this?.config?.subscriptions.processingTimeout;

    // Setup pub/sub message handler for real-time events
    this?.subscriberClient?.on('message', async (channel, message) => {
      try {
        const envelope = JSON.parse(message) as EventEnvelope;
        await this.processEvent(envelope, 'pubsub');
      } catch (error) {
        this.emit('consumption:error', { channel, error });
      }
    });

    // Start stream consumers for reliable processing
    this.startStreamConsumers(batchSize, timeout);
  }

  private async startStreamConsumers(batchSize: number, timeout: number): Promise<void> {
    const consumerGroup = this.getConsumerGroup();
    const consumerName = `consumer-${this?.config?.service.instanceId}`;

    // Get all subscribed stream keys
    const streamKeys = Array.from(this.subscriptions)
      .map(channel => channel.replace('channel:', 'stream:'));

    if (streamKeys?.length || 0 === 0) return;

    // Start consuming loop
    while (!this.isShuttingDown) {
      try {
        for (const streamKey of streamKeys) {
          const results = await this?.subscriberClient?.xreadgroup(
            'GROUP', consumerGroup, consumerName,
            'COUNT', batchSize.toString(),
            'BLOCK', this?.config?.subscriptions.idleTimeout.toString(),
            'STREAMS', streamKey, '>'
          );

          if (results && results?.length || 0 > 0) {
            const [, entries] = results[0];
            
            for (const [streamId, fields] of entries) {
              try {
                const envelopeData = fields[1]; // fields = ['envelope', '{...}']
                const envelope = JSON.parse(envelopeData) as EventEnvelope;
                
                await this.processEvent({
                  ...envelope,
                  deliveryInfo: {
                    ...envelope.deliveryInfo,
                    streamId
                  }
                }, 'stream');

                // Acknowledge processing
                await this?.subscriberClient?.xack(streamKey, consumerGroup, streamId);

              } catch (error) {
                this.emit('consumption:error', { streamKey, streamId, error });
              }
            }
          }
        }
      } catch (error) {
        if (!this.isShuttingDown) {
          this.emit('consumption:error', { error });
          await this.sleep(1000); // Brief pause before retrying
        }
      }
    }
  }

  private async processEvent(envelope: EventEnvelope, source: 'pubsub' | 'stream'): Promise<void> {
    const { event } = envelope;
    const eventType = event?.type;

    // Check if event has expired
    if (envelope?.deliveryInfo?.expiresAt && Date.now() > envelope?.deliveryInfo?.expiresAt) {
      this.emit('event:expired', { eventId: event.id, eventType });
      return;
    }

    // Check circuit breaker
    if (this.isCircuitOpen(eventType)) {
      this.emit('event:circuit_open', { eventId: event.id, eventType });
      return;
    }

    const handlers = this?.handlers?.get(eventType) || [];
    if (handlers?.length || 0 === 0) {
      this.emit('event:no_handlers', { eventId: event.id, eventType });
      return;
    }

    this.emit('event:processing_started', { 
      eventId: event.id, 
      eventType, 
      source,
      handlerCount: handlers?.length || 0 
    });

    // Process with each handler
    const processingPromises = handlers?.map(async (handler: any) => {
      const startTime = Date.now();
      
      try {
        await handler.handle(event);
        
        this.emit('event:handler_success', {
          eventId: event.id,
          eventType,
          handler: handler?.constructor?.name,
          processingTime: Date.now() - startTime
        });
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker(eventType);
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        this?.metrics?.errors++;
        
        // Record circuit breaker failure
        this.recordCircuitBreakerFailure(eventType);
        
        this.emit('event:handler_error', {
          eventId: event.id,
          eventType,
          handler: handler?.constructor?.name,
          error,
          processingTime
        });

        // Call error handler if available
        if (handler.onError) {
          try {
            await handler.onError(event, error as Error);
          } catch (errorHandlerError) {
            this.emit('event:error_handler_failed', {
              eventId: event.id,
              eventType,
              handler: handler?.constructor?.name,
              originalError: error,
              errorHandlerError
            });
          }
        }

        // Retry logic for stream-based events
        if (source === 'stream' && envelope?.deliveryInfo?.attempt < envelope?.deliveryInfo?.maxRetries) {
          await this.scheduleRetry(envelope);
        }

        throw error;
      }
    });

    try {
      await Promise.allSettled(processingPromises);
      this?.metrics?.consumed++;
      this?.metrics?.lastActivity = Date.now();
      
      this.emit('event:processing_completed', { eventId: event.id, eventType });
      
    } catch (error) {
      this.emit('event:processing_failed', { eventId: event.id, eventType, error });
    }
  }

  // Circuit breaker implementation
  private isCircuitOpen(eventType: string): boolean {
    const breaker = this?.circuitBreakers?.get(eventType);
    if (!breaker) return false;

    const now = Date.now();
    
    if (breaker.state === 'open') {
      // Check if we should try half-open
      if (now - breaker.lastFailure > 60000) { // 1 minute cooldown
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }
    
    return false;
  }

  private recordCircuitBreakerFailure(eventType: string): void {
    const breaker = this?.circuitBreakers?.get(eventType) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed' as const
    };

    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= 5) { // Open circuit after 5 failures
      breaker.state = 'open';
      this.emit('circuit_breaker:opened', { eventType, failures: breaker.failures });
    }

    this?.circuitBreakers?.set(eventType, breaker);
  }

  private resetCircuitBreaker(eventType: string): void {
    const breaker = this?.circuitBreakers?.get(eventType);
    if (breaker && breaker.state !== 'closed') {
      breaker.failures = 0;
      breaker.state = 'closed';
      this?.circuitBreakers?.set(eventType, breaker);
      
      this.emit('circuit_breaker:closed', { eventType });
    }
  }

  // Utility methods
  private getStreamKey(routingKey: string): string {
    return `${this?.config?.redis.keyPrefix}stream:${routingKey}`;
  }

  private getChannelKey(routingKey: string): string {
    return `${this?.config?.redis.keyPrefix}channel:${routingKey}`;
  }

  private getConsumerGroup(): string {
    return this?.config?.subscriptions.consumerGroup || 
           `${this?.config?.service.name}-consumers`;
  }

  private async storeEvent(envelope: EventEnvelope): Promise<void> {
    const storeKey = `${this?.config?.redis.keyPrefix}store:${envelope?.event?.id}`;
    await this?.eventStoreClient?.setex(
      storeKey,
      Math.floor(this?.config?.events.eventTtl / 1000),
      JSON.stringify(envelope)
    );
  }

  private async scheduleRetry(envelope: EventEnvelope): Promise<void> {
    const retryEnvelope = {
      ...envelope,
      deliveryInfo: {
        ...envelope.deliveryInfo,
        attempt: envelope?.deliveryInfo?.attempt + 1
      }
    };

    const delay = envelope?.deliveryInfo?.retryDelay * Math.pow(2, envelope?.deliveryInfo?.attempt - 1);
    
    this?.metrics?.retries++;
    
    setTimeout(async () => {
      try {
        const streamKey = this.getStreamKey(envelope.routingKey);
        await this?.publisherClient?.xadd(
          streamKey,
          'MAXLEN', '~', '10000',
          '*',
          'envelope', JSON.stringify(retryEnvelope)
        );
        
        this.emit('event:retried', {
          eventId: envelope?.event?.id,
          attempt: retryEnvelope?.deliveryInfo?.attempt,
          delay
        });
      } catch (error) {
        this.emit('event:retry_failed', {
          eventId: envelope?.event?.id,
          error
        });
      }
    }, delay);
  }

  private async registerService(): Promise<void> {
    const serviceKey = `${this?.config?.redis.keyPrefix}services:${this?.config?.service.name}`;
    const serviceInfo = {
      name: this?.config?.service.name,
      version: this?.config?.service.version,
      instanceId: this?.config?.service.instanceId,
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      subscriptions: Array.from(this.subscriptions)
    };

    await this?.publisherClient?.setex(
      `${serviceKey}:${this?.config?.service.instanceId}`,
      60, // 60 seconds TTL
      JSON.stringify(serviceInfo)
    );

    // Refresh registration every 30 seconds
    setTimeout(() => {
      if (!this.isShuttingDown) {
        this.registerService();
      }
    }, 30000);
  }

  private async reestablishSubscriptions(): Promise<void> {
    for (const subscription of this.subscriptions) {
      await this?.subscriberClient?.subscribe(subscription);
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      await Promise.all([
        this?.publisherClient?.ping(),
        this?.subscriberClient?.ping(),
        this?.eventStoreClient?.ping()
      ]);
      
      this.emit('health:check_passed');
    } catch (error) {
      this.emit('health:check_failed', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  public getMetrics() {
    return {
      ...this.metrics,
      handlers: this?.handlers?.size,
      subscriptions: this?.subscriptions?.size,
      circuitBreakers: Array.from(this?.circuitBreakers?.entries()).map(([eventType, breaker]) => ({
        eventType,
        ...breaker
      })),
      uptime: Date.now() - this?.metrics?.lastActivity
    };
  }

  public getHandlers(): Map<string, EventHandler[]> {
    return new Map(this.handlers);
  }

  public getSubscriptions(): Set<string> {
    return new Set(this.subscriptions);
  }

  public isHealthy(): boolean {
    return this.isConnected && !this.isShuttingDown;
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.emit('shutting_down');

    try {
      // Close all Redis connections
      await Promise.all([
        this?.publisherClient?.quit(),
        this?.subscriberClient?.quit(),
        this?.eventStoreClient?.quit()
      ]);
      
      this.isConnected = false;
      this.emit('shutdown_complete');
      
    } catch (error) {
      this.emit('shutdown_error', error);
    }
  }
}