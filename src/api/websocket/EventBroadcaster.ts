import { EventEmitter } from 'events';
import { z } from 'zod';
import Redis from 'ioredis';
import { EventBus } from '../../core/events/EventBus.js';
import type { BaseEvent } from '../../core/events/EventBus.js';
import { EventMonitor } from '../../core/events/EventMonitor.js';
import { CircuitBreakerManager } from '../../core/events/CircuitBreaker.js';
import { WebSocketGateway } from './WebSocketGateway.js';
import { MessageBatcher } from './MessageBatcher.js';
import { ConnectionManager } from './ConnectionManager.js';
import { SubscriptionManager } from './SubscriptionManager.js';

// Broadcasting configuration schemas
export const BroadcastConfigSchema = z.object({
  redis: z.object({
    keyPrefix: z.string().default('ws_broadcast:'),
    channelPrefix: z.string().default('ws_channel:'),
    db: z.number().default(3)
  }),
  scaling: z.object({
    enabled: z.boolean().default(true),
    nodeId: z.string().default(() => `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`),
    heartbeatInterval: z.number().default(30000), // 30 seconds
    nodeTimeout: z.number().default(90000) // 90 seconds
  }),
  performance: z.object({
    batchingEnabled: z.boolean().default(true),
    maxConcurrentBroadcasts: z.number().default(100),
    broadcastTimeout: z.number().default(5000), // 5 seconds
    retryAttempts: z.number().default(3),
    backoffBase: z.number().default(1000) // 1 second
  }),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().default(60000), // 1 minute
    detailedLogging: z.boolean().default(false)
  })
});

export const BroadcastMetricsSchema = z.object({
  totalBroadcasts: z.number().default(0),
  successfulBroadcasts: z.number().default(0),
  failedBroadcasts: z.number().default(0),
  totalRecipients: z.number().default(0),
  averageBroadcastTime: z.number().default(0),
  averageRecipientsPerBroadcast: z.number().default(0),
  circuitBreakerTrips: z.number().default(0),
  redisPublishes: z.number().default(0),
  localDeliveries: z.number().default(0)
});

export type BroadcastConfig = z.infer<typeof BroadcastConfigSchema>;
export type BroadcastMetrics = z.infer<typeof BroadcastMetricsSchema>;

export interface BroadcastResult {
  success: boolean;
  localRecipients: number;
  remoteNodes: number;
  totalRecipients: number;
  broadcastTime: number;
  errors: string[];
}

export interface NodeInfo {
  nodeId: string;
  address: string;
  lastSeen: number;
  activeConnections: number;
  totalBroadcasts: number;
}

/**
 * EventBroadcaster - Distributed real-time event broadcasting system
 * 
 * Features:
 * - Distributed event broadcasting across multiple WebSocket gateway nodes
 * - Redis pub/sub for cross-node communication
 * - Intelligent routing with subscription-aware broadcasting
 * - Circuit breaker protection for resilient broadcasting
 * - Performance optimization with connection pooling and batching
 * - Real-time metrics and health monitoring
 * - Automatic scaling and node discovery
 * - Failover and recovery mechanisms
 */
export class EventBroadcaster extends EventEmitter {
  private config: BroadcastConfig;
  private redis: Redis;
  private eventBus: EventBus;
  private monitor: EventMonitor;
  private circuitBreaker: CircuitBreakerManager;
  
  // WebSocket components
  private gateway: WebSocketGateway;
  private batcher: MessageBatcher;
  private connectionManager: ConnectionManager;
  private subscriptionManager: SubscriptionManager;
  
  // Broadcasting state
  private metrics: BroadcastMetrics;
  private activeNodes = new Map<string, NodeInfo>();
  private broadcastTimes: number[] = [];
  private concurrentBroadcasts = 0;
  
  // Timers
  private heartbeatTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private nodeCleanupTimer?: NodeJS.Timeout;

  constructor(
    config: Partial<BroadcastConfig>,
    redis: Redis,
    eventBus: EventBus,
    monitor: EventMonitor,
    circuitBreaker: CircuitBreakerManager,
    gateway: WebSocketGateway,
    batcher: MessageBatcher,
    connectionManager: ConnectionManager,
    subscriptionManager: SubscriptionManager
  ) {
    super();
    
    this.config = BroadcastConfigSchema.parse(config);
    this.redis = redis;
    this.eventBus = eventBus;
    this.monitor = monitor;
    this.circuitBreaker = circuitBreaker;
    
    this.gateway = gateway;
    this.batcher = batcher;
    this.connectionManager = connectionManager;
    this.subscriptionManager = subscriptionManager;
    
    this.metrics = BroadcastMetricsSchema.parse({});
    
    this.setupRedisSubscriptions();
    this.setupEventBusIntegration();
    this.startPeriodicTasks();
    
    console.log(`EventBroadcaster initialized for node: ${this?.config?.scaling.nodeId}`);
  }

  private setupRedisSubscriptions(): void {
    if (!this?.config?.scaling.enabled) return;

    // Subscribe to broadcast channel
    const broadcastChannel = `${this?.config?.redis.channelPrefix}broadcast`;
    this?.redis.subscribe(broadcastChannel, (err: any) => {
      if (err) {
        this.emit('redis_subscription_error', { channel: broadcastChannel, error: err as Error });
      } else {
        console.log(`Subscribed to Redis channel: ${broadcastChannel}`);
      }
    });

    // Subscribe to node discovery channel
    const discoveryChannel = `${this?.config?.redis.channelPrefix}discovery`;
    this?.redis.subscribe(discoveryChannel, (err: any) => {
      if (err) {
        this.emit('redis_subscription_error', { channel: discoveryChannel, error: err as Error });
      }
    });

    // Handle incoming messages
    this?.redis.on('message', (channel: string, message: string) => {
      this.handleRedisMessage(channel, message);
    });
  }

  private setupEventBusIntegration(): void {
    // Listen for events from the event bus and broadcast them
    this?.eventBus?.on('event_published', async (data: { event: BaseEvent }) => {
      await this.broadcastEvent(data.event);
    });

    // Monitor event bus health
    this?.eventBus?.on('error', (error: any) => {
      this.emit('eventbus_error', error as Error);
    });
  }

  private startPeriodicTasks(): void {
    if (this?.config?.scaling.enabled) {
      // Send heartbeat to announce this node
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, this?.config?.scaling.heartbeatInterval);

      // Clean up inactive nodes
      this.nodeCleanupTimer = setInterval(() => {
        this.cleanupInactiveNodes();
      }, this?.config?.scaling.nodeTimeout);
    }

    if (this?.config?.monitoring.enabled) {
      // Collect and emit metrics
      this.metricsTimer = setInterval(() => {
        this.updateMetrics();
        this.emit('metrics', { ...this.metrics, timestamp: Date.now() });
      }, this?.config?.monitoring.metricsInterval);
    }
  }

  // Core broadcasting functionality
  public async broadcastEvent(
    event: BaseEvent,
    options: {
      targetNodes?: string[];
      excludeNodes?: string[];
      localOnly?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    } = {}
  ): Promise<BroadcastResult> {
    const startTime = Date.now();
    
    // Check concurrent broadcast limit
    if (this.concurrentBroadcasts >= this?.config?.performance.maxConcurrentBroadcasts) {
      return {
        success: false,
        localRecipients: 0,
        remoteNodes: 0,
        totalRecipients: 0,
        broadcastTime: Date.now() - startTime,
        errors: ['Concurrent broadcast limit exceeded']
      };
    }

    this.concurrentBroadcasts++;
    
    try {
      if (this.metrics.totalBroadcasts) { this.metrics.totalBroadcasts++ };
      
      const result = await this?.circuitBreaker?.execute(
        'event_broadcasting',
        async () => {
          return await this.executeBroadcast(event, options);
        },
        {
          fallbackValue: {
            success: false,
            localRecipients: 0,
            remoteNodes: 0,
            totalRecipients: 0,
            broadcastTime: Date.now() - startTime,
            errors: ['Circuit breaker fallback']
          }
        }
      );

      if (result.success) {
        if (this.metrics.successfulBroadcasts) { this.metrics.successfulBroadcasts++ };
        if (this.metrics) {
          this.metrics.totalRecipients += result.totalRecipients;
        }
      } else {
        if (this.metrics.failedBroadcasts) { this.metrics.failedBroadcasts++ };
      }

      this.updateBroadcastTime(result.broadcastTime);
      
      this.emit('broadcast_completed', {
        eventId: event.id,
        eventType: event.type,
        result,
        options
      });

      return result;

    } catch (error) {
      if (this.metrics.failedBroadcasts) { this.metrics.failedBroadcasts++ };
      this.emit('broadcast_error', {
        eventId: event.id,
        error,
        options
      });
      
      return {
        success: false,
        localRecipients: 0,
        remoteNodes: 0,
        totalRecipients: 0,
        broadcastTime: Date.now() - startTime,
        errors: [(error as Error).message]
      };
      
    } finally {
      this.concurrentBroadcasts--;
    }
  }

  private async executeBroadcast(
    event: BaseEvent,
    options: any
  ): Promise<BroadcastResult> {
    const errors: string[] = [];
    let localRecipients = 0;
    let remoteNodes = 0;

    // Local broadcast through subscription manager
    try {
      const routingResult = await this?.subscriptionManager?.routeEvent(event);
      localRecipients = routingResult.subscriptionsMatched;
      if (this.metrics.localDeliveries) { this.metrics.localDeliveries++ };
    } catch (error) {
      errors.push(`Local broadcast failed: ${(error as Error).message}`);
    }

    // Remote broadcast via Redis (if scaling enabled and not local-only)
    if (this?.config?.scaling.enabled && !options.localOnly) {
      try {
        remoteNodes = await this.broadcastToRemoteNodes(event, options);
        if (this.metrics.redisPublishes) { this.metrics.redisPublishes++ };
      } catch (error) {
        errors.push(`Remote broadcast failed: ${(error as Error).message}`);
      }
    }

    const totalRecipients = localRecipients + remoteNodes;
    
    return {
      success: (errors?.length || 0) === 0 || totalRecipients > 0,
      localRecipients,
      remoteNodes,
      totalRecipients,
      broadcastTime: Date.now(),
      errors
    };
  }

  private async broadcastToRemoteNodes(event: BaseEvent, options: any): Promise<number> {
    const broadcastMessage = {
      type: 'broadcast',
      nodeId: this?.config?.scaling.nodeId,
      event,
      options,
      timestamp: Date.now()
    };

    // Determine target nodes
    let targetNodes = Array.from(this?.activeNodes?.keys());
    
    if (options.targetNodes) {
      targetNodes = targetNodes?.filter(nodeId => options?.targetNodes?.includes(nodeId));
    }
    
    if (options.excludeNodes) {
      targetNodes = targetNodes?.filter(nodeId => !options?.excludeNodes?.includes(nodeId));
    }

    // Remove self from targets
    targetNodes = targetNodes?.filter(nodeId => nodeId !== this?.config?.scaling.nodeId);

    if (targetNodes?.length || 0 === 0) return 0;

    // Publish to Redis
    const channel = `${this?.config?.redis.channelPrefix}broadcast`;
    await this?.redis.publish(channel, JSON.stringify(broadcastMessage));

    return targetNodes?.length || 0;
  }

  // Redis message handling
  private async handleRedisMessage(channel: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      
      if (channel.endsWith('broadcast')) {
        await this.handleRemoteBroadcast(data);
      } else if (channel.endsWith('discovery')) {
        this.handleNodeDiscovery(data);
      }
      
    } catch (error) {
      this.emit('redis_message_error', { channel, message, error: error as Error });
    }
  }

  private async handleRemoteBroadcast(data: any): Promise<void> {
    // Ignore messages from self
    if (data.nodeId === this?.config?.scaling.nodeId) return;

    // Update node activity
    if (this?.activeNodes?.has(data.nodeId)) {
      const nodeInfo = this?.activeNodes?.get(data.nodeId)!;
      nodeInfo.lastSeen = Date.now();
      nodeInfo.totalBroadcasts++;
    }

    // Process the broadcast locally
    if (data.type === 'broadcast' && data.event) {
      try {
        await this?.subscriptionManager?.routeEvent(data.event);
        
        this.emit('remote_broadcast_received', {
          fromNode: data.nodeId,
          eventId: data.event?.id,
          eventType: data.event?.type
        });
        
      } catch (error) {
        this.emit('remote_broadcast_error', {
          fromNode: data.nodeId,
          eventId: data.event?.id,
          error: error as Error
        });
      }
    }
  }

  private handleNodeDiscovery(data: any): void {
    if (data.nodeId === this?.config?.scaling.nodeId) return;

    if (data.type === 'heartbeat') {
      this?.activeNodes?.set(data.nodeId, {
        nodeId: data.nodeId,
        address: data.address || 'unknown',
        lastSeen: Date.now(),
        activeConnections: data.activeConnections || 0,
        totalBroadcasts: data.totalBroadcasts || 0
      });

      this.emit('node_discovered', {
        nodeId: data.nodeId,
        nodeInfo: this?.activeNodes?.get(data.nodeId)
      });
    }
  }

  // Node management
  private sendHeartbeat(): void {
    if (!this?.config?.scaling.enabled) return;

    const heartbeatMessage = {
      type: 'heartbeat',
      nodeId: this?.config?.scaling.nodeId,
      address: process.env.NODE_ADDRESS || 'localhost',
      activeConnections: this?.connectionManager?.getConnectionCount(),
      totalBroadcasts: this?.metrics?.totalBroadcasts,
      timestamp: Date.now()
    };

    const channel = `${this?.config?.redis.channelPrefix}discovery`;
    this?.redis.publish(channel, JSON.stringify(heartbeatMessage));
  }

  private cleanupInactiveNodes(): void {
    const now = Date.now();
    const timeout = this?.config?.scaling.nodeTimeout;
    const inactiveNodes: string[] = [];

    for (const [nodeId, nodeInfo] of this.activeNodes) {
      if (now - nodeInfo.lastSeen > timeout) {
        inactiveNodes.push(nodeId);
      }
    }

    for (const nodeId of inactiveNodes) {
      this?.activeNodes?.delete(nodeId);
      this.emit('node_removed', { nodeId });
    }

    if (inactiveNodes?.length || 0 > 0) {
      console.log(`Cleaned up ${inactiveNodes?.length || 0} inactive nodes`);
    }
  }

  // Targeted broadcasting
  public async broadcastToUsers(
    userIds: string[],
    event: BaseEvent,
    options: any = {}
  ): Promise<BroadcastResult> {
    // Add user filtering to the event metadata
    const targetedEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        targetUsers: userIds
      }
    };

    return await this.broadcastEvent(targetedEvent, {
      ...options,
      priority: options.priority || 'normal'
    });
  }

  public async broadcastToRoles(
    roles: string[],
    event: BaseEvent,
    options: any = {}
  ): Promise<BroadcastResult> {
    const targetedEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        targetRoles: roles
      }
    };

    return await this.broadcastEvent(targetedEvent, {
      ...options,
      priority: options.priority || 'normal'
    });
  }

  public async broadcastToSubscribers(
    eventType: string,
    payload: any,
    options: {
      source?: string;
      metadata?: Record<string, any>;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      localOnly?: boolean;
    } = {}
  ): Promise<BroadcastResult> {
    const event: BaseEvent = {
      id: this.generateEventId(),
      type: eventType,
      source: options.source || 'event_broadcaster',
      timestamp: Date.now(),
      payload,
      metadata: options.metadata || {},
      version: 1
    };

    return await this.broadcastEvent(event, options);
  }

  // Metrics and monitoring
  private updateMetrics(): void {
    if (this?.broadcastTimes?.length > 0) {
      const sum = this?.broadcastTimes?.reduce((total: any, time: any) => total + time, 0);
      if (this.metrics) {

        this.metrics.averageBroadcastTime = sum / this?.broadcastTimes?.length;

      }
    }

    if (this?.metrics?.totalBroadcasts > 0) {
      if (this.metrics) {

        this.metrics.averageRecipientsPerBroadcast = this?.metrics?.totalRecipients / this?.metrics?.totalBroadcasts;

      }
    }
  }

  private updateBroadcastTime(time: number): void {
    this?.broadcastTimes?.push(time);
    
    // Keep only recent measurements
    if (this?.broadcastTimes?.length > 1000) {
      this.broadcastTimes = this?.broadcastTimes?.slice(-500);
    }
  }

  // Utility methods
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  public getMetrics(): BroadcastMetrics & {
    activeNodes: number;
    concurrentBroadcasts: number;
  } {
    return {
      ...this.metrics,
      activeNodes: this?.activeNodes?.size,
      concurrentBroadcasts: this.concurrentBroadcasts
    };
  }

  public getActiveNodes(): NodeInfo[] {
    return Array.from(this?.activeNodes?.values());
  }

  public getNodeInfo(nodeId: string): NodeInfo | undefined {
    return this?.activeNodes?.get(nodeId);
  }

  public async testBroadcast(eventType: string = 'test'): Promise<BroadcastResult> {
    const testEvent: BaseEvent = {
      id: this.generateEventId(),
      type: eventType,
      source: 'broadcast_test',
      timestamp: Date.now(),
      payload: { test: true, timestamp: Date.now() },
      metadata: { test: true },
      version: 1
    };

    return await this.broadcastEvent(testEvent, { priority: 'normal' });
  }

  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    broadcastsPerSecond: number;
    errorRate: number;
    averageLatency: number;
    activeNodes: number;
    concurrentBroadcasts: number;
    issues: string[];
  } {
    const issues: string[] = [];
    
    const errorRate = this?.metrics?.totalBroadcasts > 0 
      ? this?.metrics?.failedBroadcasts / this?.metrics?.totalBroadcasts 
      : 0;

    const broadcastsPerSecond = this?.broadcastTimes?.length > 0 
      ? this?.broadcastTimes?.length / 60 // Approximate over last period
      : 0;

    if (this.concurrentBroadcasts >= this?.config?.performance.maxConcurrentBroadcasts * 0.8) {
      issues.push('High concurrent broadcast usage');
    }

    if (this?.metrics?.averageBroadcastTime > 1000) {
      issues.push(`High broadcast latency: ${Math.round(this?.metrics?.averageBroadcastTime)}ms`);
    }

    if (errorRate > 0.05) {
      issues.push(`High error rate: ${Math.round(errorRate * 100)}%`);
    }

    if (this?.config?.scaling.enabled && this?.activeNodes?.size === 0) {
      issues.push('No other nodes discovered');
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (issues?.length || 0 > 2 || errorRate > 0.1) {
      status = 'unhealthy';
    } else if (issues?.length || 0 > 0 || errorRate > 0.02) {
      status = 'degraded';
    }

    return {
      status,
      broadcastsPerSecond,
      errorRate,
      averageLatency: this?.metrics?.averageBroadcastTime,
      activeNodes: this?.activeNodes?.size,
      concurrentBroadcasts: this.concurrentBroadcasts,
      issues
    };
  }

  public async shutdown(): Promise<void> {
    console.log('Shutting down EventBroadcaster...');

    // Clear timers
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.nodeCleanupTimer) clearInterval(this.nodeCleanupTimer);

    // Unsubscribe from Redis
    if (this?.config?.scaling.enabled) {
      try {
        await this?.redis.unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing from Redis:', error);
      }
    }

    // Clear state
    this?.activeNodes?.clear();
    this.broadcastTimes = [];

    this.emit('shutdown', {
      totalBroadcasts: this?.metrics?.totalBroadcasts,
      successfulBroadcasts: this?.metrics?.successfulBroadcasts
    });
  }
}