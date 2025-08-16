/**
 * Optimized WebSocket Service with efficient connection management
 * Fixes O(n) lookups, memory leaks, and synchronous processing issues
 */

import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { logger } from '../../utils/logger.js';
import { circuitBreakerManager } from './CircuitBreakerService.js';
import { OptimizedCacheService } from './OptimizedCacheService.js';

export interface ConnectionMetadata {
  id: string;
  userId?: string;
  ip: string;
  userAgent?: string;
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
  subscriptions: Set<string>;
}

export interface MessageBatch {
  messages: any[];
  timestamp: number;
  compressed: boolean;
}

export class OptimizedWebSocketService extends EventEmitter {
  private wss?: WebSocketServer;
  private connections = new Map<string, WebSocket>();
  private connectionMetadata = new Map<string, ConnectionMetadata>();
  private userConnections = new Map<string, Set<string>>(); // userId -> connectionIds
  private topicSubscriptions = new Map<string, Set<string>>(); // topic -> connectionIds
  private messageQueue = new Map<string, any[]>(); // connectionId -> pending messages
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private cache = new OptimizedCacheService({ max: 1000, ttl: 60000 });
  
  // Configuration
  private readonly config = {
    heartbeatInterval: 30000,
    cleanupInterval: 60000,
    messageTimeout: 5000,
    batchSize: 10,
    batchDelay: 100,
    maxConnectionsPerUser: 5,
    maxMessageSize: 1024 * 1024, // 1MB
    compressionThreshold: 1024 // 1KB
  };

  constructor() {
    super();
    this.setupCleanupTasks();
  }

  /**
   * Initialize WebSocket server with optimizations
   */
  async initialize(server: any, path: string = '/ws'): Promise<void> {
    this.wss = new WebSocketServer({
      server,
      path,
      maxPayload: this?.config?.maxMessageSize,
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 1, // Fast compression
          memLevel: 4,
          strategy: 0
        },
        threshold: this?.config?.compressionThreshold
      },
      clientTracking: false // We manage connections ourselves
    });

    this?.wss?.on('connection', (ws, req) => this.handleConnection(ws, req));
    this?.wss?.on('error', (error: any) => this.handleServerError(error));

    logger.info(`WebSocket server initialized on path ${path}`, "WS_OPTIMIZED");
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const metadata: ConnectionMetadata = {
      id: connectionId,
      ip: req?.socket?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      subscriptions: new Set()
    };

    // Store connection with O(1) lookup
    this?.connections?.set(connectionId, ws);
    this?.connectionMetadata?.set(connectionId, metadata);

    // Set up event handlers
    ws.on('message', (data: any) => this.handleMessage(connectionId, data));
    ws.on('close', () => this.handleClose(connectionId));
    ws.on('error', (error: any) => this.handleError(connectionId, error));
    ws.on('pong', () => this.handlePong(connectionId));

    // Send welcome message
    this.sendDirect(connectionId, {
      type: 'welcome',
      connectionId,
      timestamp: Date.now()
    });

    this.emit('connection', { connectionId, metadata });
    logger.debug(`WebSocket connection established: ${connectionId}`, "WS_OPTIMIZED");
  }

  private async handleMessage(connectionId: string, data: any): Promise<void> {
    const metadata = this?.connectionMetadata?.get(connectionId);
    if (!metadata) return;

    metadata.lastActivity = new Date();
    metadata.messageCount++;

    try {
      const message = JSON.parse(data.toString());
      
      // Use circuit breaker for processing
      await circuitBreakerManager.create(`ws-message-${connectionId}`, {
        threshold: 10,
        timeout: 5000
      }).execute(async () => {
        await this.processMessage(connectionId, message);
      });
    } catch (error) {
      logger.error(`Failed to process WebSocket message`, "WS_OPTIMIZED", { connectionId, error });
      this.sendError(connectionId, 'Invalid message format');
    }
  }

  private async processMessage(connectionId: string, message: any): Promise<void> {
    const { type, payload } = message;

    switch (type) {
      case 'subscribe':
        await this.handleSubscribe(connectionId, payload);
        break;
      case 'unsubscribe':
        await this.handleUnsubscribe(connectionId, payload);
        break;
      case 'authenticate':
        await this.handleAuthenticate(connectionId, payload);
        break;
      case 'ping':
        this.sendDirect(connectionId, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        this.emit('message', { connectionId, type, payload });
    }
  }

  private async handleSubscribe(connectionId: string, payload: any): Promise<void> {
    const { topics } = payload;
    const metadata = this?.connectionMetadata?.get(connectionId);
    if (!metadata) return;

    for (const topic of topics) {
      // Add to connection's subscriptions
      metadata?.subscriptions?.add(topic);

      // Add to topic index for O(1) broadcast
      if (!this?.topicSubscriptions?.has(topic)) {
        this?.topicSubscriptions?.set(topic, new Set());
      }
      this?.topicSubscriptions?.get(topic)!.add(connectionId);
    }

    this.sendDirect(connectionId, {
      type: 'subscribed',
      topics,
      timestamp: Date.now()
    });
  }

  private async handleUnsubscribe(connectionId: string, payload: any): Promise<void> {
    const { topics } = payload;
    const metadata = this?.connectionMetadata?.get(connectionId);
    if (!metadata) return;

    for (const topic of topics) {
      // Remove from connection's subscriptions
      metadata?.subscriptions?.delete(topic);

      // Remove from topic index
      const subscribers = this?.topicSubscriptions?.get(topic);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this?.topicSubscriptions?.delete(topic);
        }
      }
    }

    this.sendDirect(connectionId, {
      type: 'unsubscribed',
      topics,
      timestamp: Date.now()
    });
  }

  private async handleAuthenticate(connectionId: string, payload: any): Promise<void> {
    const { userId, token } = payload;
    const metadata = this?.connectionMetadata?.get(connectionId);
    if (!metadata) return;

    // Validate token (simplified)
    if (token) {
      metadata.userId = userId;

      // Track user connections
      if (!this?.userConnections?.has(userId)) {
        this?.userConnections?.set(userId, new Set());
      }
      const userConns = this?.userConnections?.get(userId)!;
      
      // Enforce connection limit per user
      if (userConns.size >= this?.config?.maxConnectionsPerUser) {
        const oldestConn = Array.from(userConns)[0];
        if (oldestConn) {
          this.closeConnection(oldestConn, 'max_connections_exceeded');
          userConns.delete(oldestConn);
        }
      }
      
      userConns.add(connectionId);

      this.sendDirect(connectionId, {
        type: 'authenticated',
        userId,
        timestamp: Date.now()
      });
    }
  }

  private handleClose(connectionId: string): void {
    this.cleanupConnection(connectionId);
    this.emit('disconnection', { connectionId });
    logger.debug(`WebSocket connection closed: ${connectionId}`, "WS_OPTIMIZED");
  }

  private handleError(connectionId: string, error: Error): void {
    logger.error(`WebSocket error`, "WS_OPTIMIZED", { connectionId, error });
    this.emit('error', { connectionId, error });
  }

  private handlePong(connectionId: string): void {
    const metadata = this?.connectionMetadata?.get(connectionId);
    if (metadata) {
      metadata.lastActivity = new Date();
    }
  }

  private handleServerError(error: Error): void {
    logger.error(`WebSocket server error`, "WS_OPTIMIZED", { error });
    this.emit('serverError', error);
  }

  private cleanupConnection(connectionId: string): void {
    // Get metadata before cleanup
    const metadata = this?.connectionMetadata?.get(connectionId);
    
    // Remove from all indexes
    if (metadata) {
      // Remove from user connections
      if (metadata.userId) {
        const userConns = this?.userConnections?.get(metadata.userId);
        if (userConns) {
          userConns.delete(connectionId);
          if (userConns.size === 0) {
            this?.userConnections?.delete(metadata.userId);
          }
        }
      }

      // Remove from topic subscriptions
      for (const topic of metadata.subscriptions) {
        const subscribers = this?.topicSubscriptions?.get(topic);
        if (subscribers) {
          subscribers.delete(connectionId);
          if (subscribers.size === 0) {
            this?.topicSubscriptions?.delete(topic);
          }
        }
      }
    }

    // Clear batch timer
    const timer = this?.batchTimers?.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this?.batchTimers?.delete(connectionId);
    }

    // Clear message queue
    this?.messageQueue?.delete(connectionId);

    // Remove connection and metadata
    this?.connections?.delete(connectionId);
    this?.connectionMetadata?.delete(connectionId);
  }

  /**
   * Send message directly (no batching)
   */
  sendDirect(connectionId: string, message: any): boolean {
    const ws = this?.connections?.get(connectionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error(`Failed to send WebSocket message`, "WS_OPTIMIZED", { connectionId, error });
      this.handleError(connectionId, error as Error);
      return false;
    }
  }

  /**
   * Queue message for batching
   */
  send(connectionId: string, message: any): void {
    if (!this?.connections?.has(connectionId)) return;

    // Add to queue
    if (!this?.messageQueue?.has(connectionId)) {
      this?.messageQueue?.set(connectionId, []);
    }
    this?.messageQueue?.get(connectionId)!.push(message);

    // Schedule batch send
    if (!this?.batchTimers?.has(connectionId)) {
      const timer = setTimeout(() => {
        this.flushMessageQueue(connectionId);
      }, this?.config?.batchDelay);
      this?.batchTimers?.set(connectionId, timer);
    }

    // Flush immediately if batch size reached
    const queue = this?.messageQueue?.get(connectionId)!;
    if (queue?.length || 0 >= this?.config?.batchSize) {
      this.flushMessageQueue(connectionId);
    }
  }

  private flushMessageQueue(connectionId: string): void {
    const queue = this?.messageQueue?.get(connectionId);
    if (!queue || queue?.length || 0 === 0) return;

    // Clear timer
    const timer = this?.batchTimers?.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this?.batchTimers?.delete(connectionId);
    }

    // Send batch
    const batch: MessageBatch = {
      messages: queue,
      timestamp: Date.now(),
      compressed: queue?.length || 0 > 3
    };

    this.sendDirect(connectionId, {
      type: 'batch',
      payload: batch
    });

    // Clear queue
    this?.messageQueue?.set(connectionId, []);
  }

  /**
   * Broadcast to topic subscribers (optimized)
   */
  async broadcast(topic: string, message: any): Promise<number> {
    const subscribers = this?.topicSubscriptions?.get(topic);
    if (!subscribers || subscribers.size === 0) {
      return 0;
    }

    // Check cache for duplicate broadcasts
    const cacheKey = `broadcast:${topic}:${JSON.stringify(message)}`;
    const cached = await this?.cache?.get(cacheKey);
    if (cached) {
      logger.debug(`Skipping duplicate broadcast to ${topic}`, "WS_OPTIMIZED");
      return 0;
    }

    // Mark as sent
    await this?.cache?.set(cacheKey, true, 1000); // 1 second deduplication

    // Send to all subscribers
    let sent = 0;
    for (const connectionId of subscribers) {
      if (this.send(connectionId, message)) {
        sent++;
      }
    }

    this.emit('broadcast', { topic, subscribers: sent });
    return sent;
  }

  /**
   * Broadcast to specific user
   */
  broadcastToUser(userId: string, message: any): number {
    const connections = this?.userConnections?.get(userId);
    if (!connections || connections.size === 0) {
      return 0;
    }

    let sent = 0;
    for (const connectionId of connections) {
      if (this.send(connectionId, message)) {
        sent++;
      }
    }

    return sent;
  }

  private sendError(connectionId: string, error: string): void {
    this.sendDirect(connectionId, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  private setupCleanupTasks(): void {
    // Heartbeat to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      for (const [connectionId, ws] of this.connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          this.cleanupConnection(connectionId);
        }
      }
    }, this?.config?.heartbeatInterval);

    // Cleanup inactive connections
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes

      for (const [connectionId, metadata] of this.connectionMetadata) {
        const inactive = now - metadata?.lastActivity?.getTime();
        if (inactive > timeout) {
          logger.info(`Closing inactive connection: ${connectionId}`, "WS_OPTIMIZED");
          this.closeConnection(connectionId, 'inactive');
        }
      }
    }, this?.config?.cleanupInterval);
  }

  closeConnection(connectionId: string, reason: string): void {
    const ws = this?.connections?.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, reason);
    }
    this.cleanupConnection(connectionId);
  }

  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    connections: number;
    users: number;
    topics: number;
    queued: number;
    metadata: ConnectionMetadata[];
  } {
    let queuedMessages = 0;
    for (const queue of this?.messageQueue?.values()) {
      queuedMessages += queue?.length || 0;
    }

    return {
      connections: this?.connections?.size,
      users: this?.userConnections?.size,
      topics: this?.topicSubscriptions?.size,
      queued: queuedMessages,
      metadata: Array.from(this?.connectionMetadata?.values())
    };
  }

  /**
   * Shutdown service gracefully
   */
  async shutdown(): Promise<void> {
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Flush all message queues
    for (const connectionId of this?.messageQueue?.keys()) {
      this.flushMessageQueue(connectionId);
    }

    // Close all connections
    for (const [connectionId, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, 'server_shutdown');
      }
    }

    // Clear all data structures
    this?.connections?.clear();
    this?.connectionMetadata?.clear();
    this?.userConnections?.clear();
    this?.topicSubscriptions?.clear();
    this?.messageQueue?.clear();
    this?.batchTimers?.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve: any) => {
        this.wss!.close(() => resolve());
      });
    }

    this.removeAllListeners();
    logger.info('WebSocket service shut down', "WS_OPTIMIZED");
  }
}

// Export singleton instance
export const optimizedWSService = new OptimizedWebSocketService();