import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { z } from 'zod';
import { EventBus } from '../../core/events/EventBus.js';
import type { BaseEvent } from '../../core/events/EventBus.js';
import { EventMonitor } from '../../core/events/EventMonitor.js';
import { CircuitBreakerManager } from '../../core/events/CircuitBreaker.js';

// WebSocket message schemas
export const WebSocketMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['subscribe', 'unsubscribe', 'publish', 'ping', 'pong', 'batch']),
  payload: z.record(z.any()).optional(),
  timestamp: z.number().default(() => Date.now()),
  correlationId: z.string().optional()
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  eventTypes: z.array(z.string()),
  filters: z.object({
    source: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }).optional(),
  options: z.object({
    batching: z.boolean().default(false),
    batchSize: z.number().min(1).max(100).default(10),
    batchTimeout: z.number().min(100).max(10000).default(1000), // milliseconds
    compression: z.boolean().default(false),
    priority: z.enum(['low', 'normal', 'high']).default('normal')
  }).optional()
});

export const WebSocketConfigSchema = z.object({
  port: z.number().default(8080),
  path: z.string().default('/ws'),
  auth: z.object({
    enabled: z.boolean().default(true),
    tokenHeader: z.string().default('Authorization'),
    validateToken: z.function().optional() // (token: string) => Promise<boolean>
  }),
  limits: z.object({
    maxConnections: z.number().default(10000),
    maxSubscriptions: z.number().default(100), // per connection
    maxMessageSize: z.number().default(1024 * 1024), // 1MB
    rateLimiting: z.object({
      enabled: z.boolean().default(true),
      messagesPerMinute: z.number().default(120),
      windowMs: z.number().default(60000)
    })
  }),
  batching: z.object({
    enabled: z.boolean().default(true),
    defaultBatchSize: z.number().default(10),
    defaultTimeout: z.number().default(1000),
    maxBatchSize: z.number().default(100),
    compression: z.object({
      enabled: z.boolean().default(true),
      threshold: z.number().default(1024) // Compress batches larger than 1KB
    })
  }),
  heartbeat: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().default(30000), // 30 seconds
    timeout: z.number().default(60000) // 60 seconds
  }),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().default(60000) // 1 minute
  })
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type WebSocketConfig = z.infer<typeof WebSocketConfigSchema>;

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Map<string, Subscription>;
  metadata: Record<string, any>;
  stats: {
    connectedAt: number;
    lastActivity: number;
    messagesSent: number;
    messagesReceived: number;
    bytesTransmitted: number;
    bytesReceived: number;
  };
  rateLimiting: {
    messageCount: number;
    windowStart: number;
  };
  batching: {
    queue: BaseEvent[];
    timer?: NodeJS.Timeout;
    lastFlush: number;
  };
}

/**
 * WebSocketGateway - Real-time API gateway with advanced batching and routing
 * 
 * Features:
 * - High-performance WebSocket server with connection pooling
 * - Intelligent message batching with configurable strategies
 * - Event-driven pub/sub with selective subscriptions
 * - Authentication and authorization middleware
 * - Rate limiting and circuit breaker protection
 * - Real-time monitoring and health checks
 * - Compression and optimization for large payloads
 * - Integration with EventBus for microservice communication
 */
export class WebSocketGateway extends EventEmitter {
  private config: WebSocketConfig;
  private server?: WebSocketServer;
  private eventBus: EventBus;
  private monitor: EventMonitor;
  private circuitBreaker: CircuitBreakerManager;
  
  private connections = new Map<string, ClientConnection>();
  private subscriptions = new Map<string, Set<string>>(); // eventType -> connectionIds
  private metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    totalBatches: 0,
    averageBatchSize: 0,
    averageLatency: 0,
    bytesTransmitted: 0,
    connectionErrors: 0,
    authFailures: 0
  };

  private heartbeatTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    config: Partial<WebSocketConfig> = {},
    eventBus: EventBus,
    monitor: EventMonitor,
    circuitBreaker: CircuitBreakerManager
  ) {
    super();
    
    this.config = WebSocketConfigSchema.parse(config);
    this.eventBus = eventBus;
    this.monitor = monitor;
    this.circuitBreaker = circuitBreaker;

    this.setupEventBusIntegration();
    this.startPeriodicTasks();
  }

  private setupEventBusIntegration(): void {
    // Listen to all events from EventBus and broadcast to subscribers
    this?.eventBus?.on('event_published', (data: { event: BaseEvent }) => {
      this.broadcastEvent(data.event);
    });

    // Monitor event bus health
    this?.eventBus?.on('error', (error: any) => {
      this.emit('eventbus_error', error);
    });
  }

  private startPeriodicTasks(): void {
    if (this?.config?.heartbeat.enabled) {
      this.heartbeatTimer = setInterval(() => {
        this.performHeartbeat();
      }, this?.config?.heartbeat.interval);
    }

    if (this?.config?.monitoring.enabled) {
      this.metricsTimer = setInterval(() => {
        this.updateMetrics();
        this.emit('metrics', { ...this.metrics, timestamp: Date.now() });
      }, this?.config?.monitoring.metricsInterval);
    }

    // Cleanup inactive connections
    this.cleanupTimer = setInterval(() => {
      this.cleanupConnections();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Server lifecycle
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({
          port: this?.config?.port,
          path: this?.config?.path,
          maxPayload: this?.config?.limits.maxMessageSize,
          perMessageDeflate: this?.config?.batching.compression.enabled,
          verifyClient: (info, callback) => {
            // Handle async verification properly
            this.verifyClient(info, callback).catch((error: any) => {
              console.error('WebSocket verification error:', error);
              callback(false);
            });
          }
        });

        this?.server?.on('connection', (ws, request) => {
          this.handleConnection(ws, request);
        });

        this?.server?.on('error', (error: any) => {
          if (this.metrics.connectionErrors) { this.metrics.connectionErrors++ };
          this.emit('server_error', error);
          reject(error);
        });

        this?.server?.on('listening', () => {
          console.log(`WebSocket Gateway listening on port ${this?.config?.port}${this?.config?.path}`);
          this.emit('server_started', {
            port: this?.config?.port,
            path: this?.config?.path
          });
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve: any) => {
      // Clean up timers
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (this.metricsTimer) clearInterval(this.metricsTimer);
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);

      // Close all connections
      for (const connection of this?.connections?.values()) {
        this.closeConnection(connection.id, 'server_shutdown');
      }

      if (this.server) {
        this?.server?.close(() => {
          this.emit('server_stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Connection management
  private async verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }, callback: (result: boolean) => void): Promise<void> {
    try {
      // Check connection limits
      if (this?.connections?.size >= this?.config?.limits.maxConnections) {
        callback(false);
        return;
      }

      // Proper async auth check
      if (this?.config?.auth.enabled) {
        const authHeader = info?.req?.headers[this?.config?.auth.tokenHeader.toLowerCase()] as string;
        
        if (!authHeader) {
          if (this.metrics.authFailures) { this.metrics.authFailures++ };
          callback(false);
          return;
        }

        // Extract token from Bearer format if present
        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : authHeader;

        // Validate token asynchronously
        if (this?.config?.auth.validateToken) {
          try {
            const isValid = await this?.config?.auth.validateToken(token);
            if (!isValid) {
              if (this.metrics.authFailures) { this.metrics.authFailures++ };
              callback(false);
              return;
            }
          } catch (error) {
            this.emit('auth_error', error);
            if (this.metrics.authFailures) { this.metrics.authFailures++ };
            callback(false);
            return;
          }
        }
      }

      callback(true);

    } catch (error) {
      this.emit('auth_error', error);
      callback(false);
    }
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const userId = this.extractUserId(request);

    const connection: ClientConnection = {
      id: connectionId,
      ws,
      userId,
      subscriptions: new Map(),
      metadata: {
        userAgent: request.headers['user-agent'],
        origin: request?.headers?.origin,
        ip: request?.socket?.remoteAddress
      },
      stats: {
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransmitted: 0,
        bytesReceived: 0
      },
      rateLimiting: {
        messageCount: 0,
        windowStart: Date.now()
      },
      batching: {
        queue: [],
        lastFlush: Date.now()
      }
    };

    this?.connections?.set(connectionId, connection);
    if (this.metrics.totalConnections) { this.metrics.totalConnections++ };
    if (this.metrics.activeConnections) { this.metrics.activeConnections++ };

    // Set up WebSocket event handlers
    ws.on('message', (data: any) => {
      this.handleMessage(connectionId, data);
    });

    ws.on('close', (code, reason) => {
      this.handleClose(connectionId, code, reason);
    });

    ws.on('error', (error: any) => {
      this.handleError(connectionId, error);
    });

    ws.on('pong', () => {
      connection?.stats?.lastActivity = Date.now();
    });

    this.emit('connection_opened', {
      connectionId,
      userId,
      metadata: connection.metadata
    });

    // Send welcome message
    this.sendMessage(connectionId, {
      id: this.generateMessageId(),
      type: 'ping',
      payload: {
        connectionId,
        serverTime: Date.now(),
        capabilities: {
          batching: this?.config?.batching.enabled,
          compression: this?.config?.batching.compression.enabled,
          maxBatchSize: this?.config?.batching.maxBatchSize
        }
      }
    });
  }

  private handleMessage(connectionId: string, data: Buffer | string): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    try {
      // Rate limiting check
      if (!this.checkRateLimit(connection)) {
        this.sendError(connectionId, 'rate_limit_exceeded', 'Too many messages');
        return;
      }

      const message = this.parseMessage(data);
      if (!message) return;

      connection?.stats?.messagesReceived++;
      connection?.stats?.bytesReceived += Buffer.isBuffer(data) ? data?.length || 0 : Buffer.byteLength(data);
      connection?.stats?.lastActivity = Date.now();

      this.processMessage(connectionId, message);

    } catch (error) {
      this.emit('message_error', { connectionId, error });
      this.sendError(connectionId, 'invalid_message', 'Failed to process message');
    }
  }

  private processMessage(connectionId: string, message: WebSocketMessage): void {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(connectionId, message);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(connectionId, message);
        break;

      case 'publish':
        this.handlePublish(connectionId, message);
        break;

      case 'ping':
        this.handlePing(connectionId, message);
        break;

      case 'pong':
        this.handlePong(connectionId, message);
        break;

      case 'batch':
        this.handleBatchRequest(connectionId, message);
        break;

      default:
        this.sendError(connectionId, 'unknown_message_type', `Unknown message type: ${message.type}`);
    }
  }

  // Message handlers
  private handleSubscribe(connectionId: string, message: WebSocketMessage): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    try {
      const subscription = SubscriptionSchema.parse(message.payload);

      // Check subscription limits
      if (connection?.subscriptions?.size >= this?.config?.limits.maxSubscriptions) {
        this.sendError(connectionId, 'subscription_limit_exceeded', 'Too many subscriptions');
        return;
      }

      connection?.subscriptions?.set(subscription.id, subscription);

      // Add to global subscription index
      subscription?.eventTypes?.forEach(eventType => {
        if (!this?.subscriptions?.has(eventType)) {
          this?.subscriptions?.set(eventType, new Set());
        }
        this?.subscriptions?.get(eventType)!.add(connectionId);
      });

      this.emit('subscription_created', {
        connectionId,
        subscriptionId: subscription.id,
        eventTypes: subscription.eventTypes
      });

      this.sendMessage(connectionId, {
        id: this.generateMessageId(),
        type: 'subscribe',
        payload: {
          subscriptionId: subscription.id,
          status: 'success',
          message: 'Subscription created successfully'
        },
        correlationId: message.correlationId
      });

    } catch (error) {
      this.sendError(connectionId, 'invalid_subscription', 'Invalid subscription format', message.correlationId);
    }
  }

  private handleUnsubscribe(connectionId: string, message: WebSocketMessage): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    const subscriptionId = message.payload?.subscriptionId;
    if (!subscriptionId) {
      this.sendError(connectionId, 'missing_subscription_id', 'Subscription ID is required');
      return;
    }

    const subscription = connection?.subscriptions?.get(subscriptionId);
    if (!subscription) {
      this.sendError(connectionId, 'subscription_not_found', 'Subscription not found');
      return;
    }

    // Remove from global subscription index
    subscription?.eventTypes?.forEach(eventType => {
      const subscribers = this.subscriptions.get(eventType);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this?.subscriptions?.delete(eventType);
        }
      }
    });

    connection?.subscriptions?.delete(subscriptionId);

    this.emit('subscription_removed', {
      connectionId,
      subscriptionId,
      eventTypes: subscription.eventTypes
    });

    this.sendMessage(connectionId, {
      id: this.generateMessageId(),
      type: 'unsubscribe',
      payload: {
        subscriptionId,
        status: 'success',
        message: 'Subscription removed successfully'
      },
      correlationId: message.correlationId
    });
  }

  private async handlePublish(connectionId: string, message: WebSocketMessage): Promise<void> {
    try {
      const event: BaseEvent = {
        id: message.payload?.id || this.generateMessageId(),
        type: message.payload?.type,
        source: `websocket:${connectionId}`,
        timestamp: Date.now(),
        payload: message.payload?.payload || {},
        metadata: {
          ...message.payload?.metadata,
          connectionId,
          publishedAt: Date.now()
        }
      };

      // Use circuit breaker for event bus publishing
      await this?.circuitBreaker?.execute(
        'event_publishing',
        async () => {
          await this?.eventBus?.publish(event.type, event.payload, {
            source: event.source,
            metadata: event.metadata,
            correlationId: message.correlationId
          });
        },
        {
          fallbackValue: null,
          useCache: false
        }
      );

      this.sendMessage(connectionId, {
        id: this.generateMessageId(),
        type: 'publish',
        payload: {
          eventId: event.id,
          status: 'success',
          message: 'Event published successfully'
        },
        correlationId: message.correlationId
      });

    } catch (error) {
      this.sendError(connectionId, 'publish_failed', 'Failed to publish event', message.correlationId);
    }
  }

  private handlePing(connectionId: string, message: WebSocketMessage): void {
    this.sendMessage(connectionId, {
      id: this.generateMessageId(),
      type: 'pong',
      payload: {
        serverTime: Date.now(),
        connectionId
      },
      correlationId: message.correlationId
    });
  }

  private handlePong(connectionId: string, message: WebSocketMessage): void {
    const connection = this?.connections?.get(connectionId);
    if (connection) {
      connection?.stats?.lastActivity = Date.now();
    }
  }

  private handleBatchRequest(connectionId: string, message: WebSocketMessage): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    const action = message.payload?.action;
    switch (action) {
      case 'flush':
        this.flushBatch(connectionId);
        break;

      case 'configure':
        const batchConfig = message.payload?.config;
        if (batchConfig) {
          // Update batching configuration for this connection
          // This would update subscription-specific batching settings
        }
        break;

      default:
        this.sendError(connectionId, 'invalid_batch_action', 'Invalid batch action');
    }
  }

  // Event broadcasting
  private broadcastEvent(event: BaseEvent): void {
    const subscribers = this?.subscriptions?.get(event.type);
    if (!subscribers || subscribers.size === 0) return;

    for (const connectionId of subscribers) {
      const connection = this?.connections?.get(connectionId);
      if (!connection) {
        // Clean up stale subscription
        subscribers.delete(connectionId);
        continue;
      }

      // Check if event matches subscription filters
      const matchingSubscriptions = this.getMatchingSubscriptions(connection, event);
      
      for (const subscription of matchingSubscriptions) {
        if (subscription.options?.batching) {
          this.addToBatch(connectionId, event, subscription);
        } else {
          this.sendEventDirectly(connectionId, event, subscription);
        }
      }
    }
  }

  private getMatchingSubscriptions(connection: ClientConnection, event: BaseEvent): Subscription[] {
    const matching: Subscription[] = [];

    for (const subscription of connection?.subscriptions?.values()) {
      if (!subscription?.eventTypes?.includes(event.type)) continue;

      if (subscription.filters) {
        // Apply filters
        if (subscription?.filters?.source && event.source !== subscription?.filters?.source) {
          continue;
        }

        if (subscription?.filters?.metadata) {
          const matches = Object.entries(subscription?.filters?.metadata).every(
            ([key, value]) => event.metadata[key] === value
          );
          if (!matches) continue;
        }
      }

      matching.push(subscription);
    }

    return matching;
  }

  // Batching system
  private addToBatch(connectionId: string, event: BaseEvent, subscription: Subscription): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    connection?.batching?.queue.push(event);

    const batchSize = subscription.options?.batchSize || this?.config?.batching.defaultBatchSize;
    const timeout = subscription.options?.batchTimeout || this?.config?.batching.defaultTimeout;

    // Check if batch is ready to flush
    if (connection?.batching?.queue?.length || 0 >= batchSize) {
      this.flushBatch(connectionId);
    } else if (!connection?.batching?.timer) {
      // Set timer for batch timeout
      connection?.batching?.timer = setTimeout(() => {
        this.flushBatch(connectionId);
      }, timeout);
    }
  }

  private flushBatch(connectionId: string): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection || connection?.batching?.queue?.length || 0 === 0) return;

    const events = [...connection?.batching?.queue];
    connection?.batching?.queue = [];
    connection?.batching?.lastFlush = Date.now();

    // Clear timeout timer
    if (connection?.batching?.timer) {
      clearTimeout(connection?.batching?.timer);
      connection?.batching?.timer = undefined;
    }

    const batchMessage: WebSocketMessage = {
      id: this.generateMessageId(),
      type: 'batch',
      payload: {
        events,
        batchSize: events?.length || 0,
        timestamp: Date.now()
      }
    };

    this.sendMessage(connectionId, batchMessage);

    if (this.metrics.totalBatches) { this.metrics.totalBatches++ };
    this.updateAverageBatchSize(events?.length || 0);

    this.emit('batch_sent', {
      connectionId,
      eventCount: events?.length || 0,
      batchId: batchMessage.id
    });
  }

  private sendEventDirectly(connectionId: string, event: BaseEvent, subscription: Subscription): void {
    this.sendMessage(connectionId, {
      id: this.generateMessageId(),
      type: 'publish',
      payload: {
        event,
        subscriptionId: subscription.id,
        priority: subscription.options?.priority || 'normal'
      }
    });
  }

  // Connection management utilities
  private sendMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection || connection?.ws?.readyState !== WebSocket.OPEN) return;

    try {
      const serialized = JSON.stringify(message);
      connection?.ws?.send(serialized);

      connection?.stats?.messagesSent++;
      connection?.stats?.bytesTransmitted += Buffer.byteLength(serialized);
      if (this.metrics.totalMessages) { this.metrics.totalMessages++ };

    } catch (error) {
      this.emit('send_error', { connectionId, error });
      this.closeConnection(connectionId, 'send_error');
    }
  }

  private sendError(connectionId: string, code: string, message: string, correlationId?: string): void {
    this.sendMessage(connectionId, {
      id: this.generateMessageId(),
      type: 'ping', // Using ping as error type not in schema
      payload: {
        error: true,
        code,
        message,
        timestamp: Date.now()
      },
      correlationId
    });
  }

  private handleClose(connectionId: string, code: number, reason: Buffer): void {
    this.closeConnection(connectionId, 'client_disconnect', code);
  }

  private handleError(connectionId: string, error: Error): void {
    this.emit('connection_error', { connectionId, error });
    this.closeConnection(connectionId, 'error');
  }

  private closeConnection(connectionId: string, reason: string, code?: number): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    // Clean up batch timer
    if (connection?.batching?.timer) {
      clearTimeout(connection?.batching?.timer);
    }

    // Remove from subscription indexes
    for (const subscription of connection?.subscriptions?.values()) {
      subscription?.eventTypes?.forEach(eventType => {
        const subscribers = this.subscriptions.get(eventType);
        if (subscribers) {
          subscribers.delete(connectionId);
          if (subscribers.size === 0) {
            this?.subscriptions?.delete(eventType);
          }
        }
      });
    }

    this?.connections?.delete(connectionId);
    if (this.metrics.activeConnections) { this.metrics.activeConnections-- };

    if (connection?.ws?.readyState === WebSocket.OPEN) {
      connection?.ws?.close(code || 1000, reason);
    }

    this.emit('connection_closed', {
      connectionId,
      reason,
      code,
      stats: connection.stats,
      duration: Date.now() - connection?.stats?.connectedAt
    });
  }

  // Utility methods
  private parseMessage(data: Buffer | string): WebSocketMessage | null {
    try {
      const json = JSON.parse(data.toString());
      return WebSocketMessageSchema.parse(json);
    } catch (error) {
      return null;
    }
  }

  private checkRateLimit(connection: ClientConnection): boolean {
    if (!this?.config?.limits.rateLimiting.enabled) return true;

    const now = Date.now();
    const windowMs = this?.config?.limits.rateLimiting.windowMs;

    // Reset window if needed
    if (now - connection?.rateLimiting?.windowStart > windowMs) {
      connection?.rateLimiting?.windowStart = now;
      connection?.rateLimiting?.messageCount = 0;
    }

    connection?.rateLimiting?.messageCount++;
    return connection?.rateLimiting?.messageCount <= this?.config?.limits.rateLimiting.messagesPerMinute;
  }

  private performHeartbeat(): void {
    const timeout = this?.config?.heartbeat.timeout;
    const now = Date.now();

    for (const [connectionId, connection] of this.connections) {
      if (now - connection?.stats?.lastActivity > timeout) {
        this.closeConnection(connectionId, 'heartbeat_timeout');
      } else if (connection?.ws?.readyState === WebSocket.OPEN) {
        connection?.ws?.ping();
      }
    }
  }

  private cleanupConnections(): void {
    for (const [connectionId, connection] of this.connections) {
      if (connection?.ws?.readyState === WebSocket.CLOSED ||
          connection?.ws?.readyState === WebSocket.CLOSING) {
        this.closeConnection(connectionId, 'cleanup');
      }
    }
  }

  private updateMetrics(): void {
    let totalLatency = 0;
    let latencyCount = 0;

    for (const connection of this?.connections?.values()) {
      const latency = Date.now() - connection?.stats?.lastActivity;
      totalLatency += latency;
      latencyCount++;
    }

    if (latencyCount > 0) {
      if (this.metrics) {

        this.metrics.averageLatency = totalLatency / latencyCount;

      }
    }

    // Update bytes transmitted
    if (this.metrics) {

      this.metrics.bytesTransmitted = Array.from(this?.connections?.values())
      .reduce((total: any, conn: any) => total + conn?.stats?.bytesTransmitted, 0);

    }
  }

  private updateAverageBatchSize(newSize: number): void {
    if (this?.metrics?.totalBatches === 1) {
      if (this.metrics) {

        this.metrics.averageBatchSize = newSize;

      }
    } else {
      if (this.metrics) {

        this.metrics.averageBatchSize = (this?.metrics?.averageBatchSize * (this?.metrics?.totalBatches - 1) + newSize) / 
        this?.metrics?.totalBatches;

      }
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private extractUserId(request: IncomingMessage): string | undefined {
    // Extract user ID from token or headers
    const authHeader = request?.headers?.authorization;
    if (authHeader) {
      // In production, decode JWT or validate token to get user ID
      return 'user_' + Math.random().toString(36).substr(2, 9);
    }
    return undefined;
  }

  // Public API methods
  public getMetrics() {
    return {
      ...this.metrics,
      connections: {
        total: this?.connections?.size,
        byUserId: this.getConnectionsByUser()
      },
      subscriptions: {
        total: Array.from(this?.subscriptions?.values()).reduce((sum: any, set: any) => sum + set.size, 0),
        byEventType: Array.from(this?.subscriptions?.entries()).map(([eventType, connections]) => ({
          eventType,
          subscribers: connections.size
        }))
      }
    };
  }

  private getConnectionsByUser(): Record<string, number> {
    const userCounts: Record<string, number> = {};
    
    for (const connection of this?.connections?.values()) {
      const userId = connection.userId || "" || 'anonymous';
      userCounts[userId] = (userCounts[userId] || 0) + 1;
    }

    return userCounts;
  }

  public getConnection(connectionId: string): ClientConnection | undefined {
    return this?.connections?.get(connectionId);
  }

  public getConnections(): ClientConnection[] {
    return Array.from(this?.connections?.values());
  }

  public getSubscriptionStats(): {
    totalSubscriptions: number;
    subscriptionsByEventType: Record<string, number>;
    topEventTypes: Array<{ eventType: string; subscribers: number }>;
  } {
    const subscriptionsByEventType: Record<string, number> = {};
    
    for (const [eventType, subscribers] of this.subscriptions) {
      subscriptionsByEventType[eventType] = subscribers.size;
    }

    const topEventTypes = Object.entries(subscriptionsByEventType)
      .map(([eventType, subscribers]) => ({ eventType, subscribers }))
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, 10);

    return {
      totalSubscriptions: Object.values(subscriptionsByEventType).reduce((sum: any, count: any) => sum + count, 0),
      subscriptionsByEventType,
      topEventTypes
    };
  }

  public async broadcast(eventType: string, payload: any, options: {
    source?: string;
    metadata?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
  } = {}): Promise<number> {
    const event: BaseEvent = {
      id: this.generateMessageId(),
      type: eventType,
      source: options.source || 'websocket_gateway',
      timestamp: Date.now(),
      payload,
      metadata: options.metadata || {}
    };

    this.broadcastEvent(event);

    const subscribers = this.subscriptions.get(eventType);
    return subscribers ? subscribers.size : 0;
  }

  public isHealthy(): boolean {
    return this.server !== undefined && 
           this?.connections?.size > 0 && 
           this?.metrics?.connectionErrors < this?.metrics?.totalConnections * 0.1; // Less than 10% error rate
  }

  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connections: number;
    uptime: number;
    errorRate: number;
    lastError?: string;
  } {
    const errorRate = this?.metrics?.totalConnections > 0 
      ? this?.metrics?.connectionErrors / this?.metrics?.totalConnections 
      : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!this.server) {
      status = 'unhealthy';
    } else if (errorRate > 0.1 || this?.connections?.size === 0) {
      status = 'degraded';
    }

    return {
      status,
      connections: this?.connections?.size,
      uptime: Date.now() - (this.metricsTimer ? Date.now() - this?.config?.monitoring.metricsInterval : Date.now()),
      errorRate
    };
  }
}