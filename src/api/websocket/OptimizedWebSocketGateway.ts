import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';

interface Connection {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastPing: number;
  messageQueue: any[];
  batchTimer?: NodeJS.Timeout;
  stats: {
    messagesSent: number;
    messagesReceived: number;
    bytesTransmitted: number;
    bytesReceived: number;
    connectedAt: number;
  };
}

interface WebSocketStats {
  connections: number;
  subscriptions: number;
  users: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransmitted: number;
  bytesReceived: number;
  batchesSent: number;
  averageLatency: number;
}

/**
 * Optimized WebSocket Gateway with:
 * - O(1) connection lookups using Maps
 * - Message batching to reduce network overhead
 * - Automatic cleanup of dead connections
 * - User-based broadcasting
 * - Memory leak prevention
 * - Compression support
 */
export class OptimizedWebSocketGateway extends EventEmitter {
  private wss?: WebSocketServer;
  private connections = new Map<string, Connection>();
  private subscriptions = new Map<string, Set<string>>(); // topic -> connection IDs
  private connectionsByUser = new Map<string, Set<string>>(); // userId -> connection IDs
  private batchInterval = 100; // ms
  private maxBatchSize = 50;
  private pingInterval = 30000; // 30 seconds
  private cleanupInterval?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private stats: WebSocketStats = {
    connections: 0,
    subscriptions: 0,
    users: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransmitted: 0,
    bytesReceived: 0,
    batchesSent: 0,
    averageLatency: 0
  };
  private latencyMeasurements: number[] = [];

  constructor(private port: number = 8080) {
    super();
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ 
          port: this.port,
          perMessageDeflate: {
            zlibDeflateOptions: {
              level: 1, // Fast compression
              memLevel: 8,
              strategy: 0
            },
            threshold: 1024 // Only compress messages > 1KB
          }
        });

        this?.wss?.on('connection', (ws, req) => this.handleConnection(ws, req));
        
        this?.wss?.on('listening', () => {
          console.log(`✅ Optimized WebSocket server listening on port ${this.port}`);
          this.startMaintenanceTasks();
          resolve();
        });

        this?.wss?.on('error', (error: any) => {
          console.error('WebSocket server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const connectionId = this.generateId();
    const connection: Connection = {
      id: connectionId,
      ws,
      subscriptions: new Set(),
      lastPing: Date.now(),
      messageQueue: [],
      stats: {
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransmitted: 0,
        bytesReceived: 0,
        connectedAt: Date.now()
      }
    };

    this?.connections?.set(connectionId, connection);
    this?.stats?.connections++;
    
    // Set up event handlers
    ws.on('message', (data: any) => this.handleMessage(connectionId, data));
    ws.on('close', () => this.handleClose(connectionId));
    ws.on('error', (error: any) => this.handleError(connectionId, error));
    ws.on('pong', () => {
      connection.lastPing = Date.now();
      this.updateLatency(connectionId);
    });

    // Send welcome message
    this.sendMessage(connectionId, { 
      type: 'connected', 
      connectionId,
      timestamp: Date.now()
    });

    this.emit('connection', { connectionId, ip: req?.socket?.remoteAddress });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, data: any): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    try {
      const message = JSON.parse(data.toString());
      
      connection?.stats?.messagesReceived++;
      connection?.stats?.bytesReceived += Buffer.byteLength(data);
      this?.stats?.messagesReceived++;
      this?.stats?.bytesReceived += Buffer.byteLength(data);
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(connectionId, message.topics || [message.topic]);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(connectionId, message.topics || [message.topic]);
          break;
          
        case 'authenticate':
          this.handleAuthenticate(connectionId, message.userId);
          break;
          
        case 'ping':
          this.sendMessage(connectionId, { type: 'pong', timestamp: Date.now() });
          break;
          
        case 'message':
          this.emit('message', { connectionId, data: message.data });
          break;
          
        default:
          this.emit('custom', { connectionId, message });
      }
    } catch (error) {
      console.error(`Error handling message from ${connectionId}:`, error);
      this.sendError(connectionId, 'Invalid message format');
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(connectionId: string, topics: string[]): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    for (const topic of topics) {
      // Add to connection's subscriptions
      connection?.subscriptions?.add(topic);
      
      // Add to global subscription index
      if (!this?.subscriptions?.has(topic)) {
        this?.subscriptions?.set(topic, new Set());
      }
      this?.subscriptions?.get(topic)!.add(connectionId);
    }

    this?.stats?.subscriptions = this.countTotalSubscriptions();
    
    this.sendMessage(connectionId, { 
      type: 'subscribed', 
      topics,
      success: true 
    });
    
    this.emit('subscribe', { connectionId, topics });
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(connectionId: string, topics: string[]): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    for (const topic of topics) {
      // Remove from connection's subscriptions
      connection?.subscriptions?.delete(topic);
      
      // Remove from global subscription index
      const topicSubs = this?.subscriptions?.get(topic);
      if (topicSubs) {
        topicSubs.delete(connectionId);
        if (topicSubs.size === 0) {
          this?.subscriptions?.delete(topic);
        }
      }
    }

    this?.stats?.subscriptions = this.countTotalSubscriptions();
    
    this.sendMessage(connectionId, { 
      type: 'unsubscribed', 
      topics,
      success: true 
    });
    
    this.emit('unsubscribe', { connectionId, topics });
  }

  /**
   * Handle authentication
   */
  private handleAuthenticate(connectionId: string, userId: string): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    // Remove from old user mapping if exists
    if (connection.userId) {
      const oldUserConnections = this?.connectionsByUser?.get(connection.userId);
      if (oldUserConnections) {
        oldUserConnections.delete(connectionId);
        if (oldUserConnections.size === 0) {
          this?.connectionsByUser?.delete(connection.userId);
        }
      }
    }

    // Set new user ID
    connection.userId = userId;
    
    // Update user -> connections mapping
    if (!this?.connectionsByUser?.has(userId)) {
      this?.connectionsByUser?.set(userId, new Set());
    }
    this?.connectionsByUser?.get(userId)!.add(connectionId);
    
    this?.stats?.users = this?.connectionsByUser?.size;

    this.sendMessage(connectionId, { 
      type: 'authenticated', 
      userId,
      success: true 
    });
    
    this.emit('authenticate', { connectionId, userId });
  }

  /**
   * Handle connection close
   */
  private handleClose(connectionId: string): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    // Clean up subscriptions
    for (const topic of connection.subscriptions) {
      const topicSubs = this?.subscriptions?.get(topic);
      if (topicSubs) {
        topicSubs.delete(connectionId);
        if (topicSubs.size === 0) {
          this?.subscriptions?.delete(topic);
        }
      }
    }

    // Clean up user mapping
    if (connection.userId) {
      const userConnections = this?.connectionsByUser?.get(connection.userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this?.connectionsByUser?.delete(connection.userId);
        }
      }
    }

    // Clear batch timer
    if (connection.batchTimer) {
      clearTimeout(connection.batchTimer);
    }

    // Update stats
    this?.stats?.connections--;
    this?.stats?.subscriptions = this.countTotalSubscriptions();
    this?.stats?.users = this?.connectionsByUser?.size;

    this?.connections?.delete(connectionId);
    this.emit('disconnect', { connectionId });
  }

  /**
   * Handle connection error
   */
  private handleError(connectionId: string, error: Error): void {
    console.error(`WebSocket error for ${connectionId}:`, error);
    this.emit('error', { connectionId, error });
    this.handleClose(connectionId);
  }

  /**
   * Broadcast message to topic subscribers with batching
   */
  broadcast(topic: string, data: any): void {
    const subscribers = this?.subscriptions?.get(topic);
    if (!subscribers || subscribers.size === 0) return;

    const message = { 
      type: 'broadcast',
      topic, 
      data, 
      timestamp: Date.now() 
    };

    for (const connectionId of subscribers) {
      this.queueMessage(connectionId, message);
    }
  }

  /**
   * Broadcast to specific user (all their connections)
   */
  broadcastToUser(userId: string, data: any): void {
    const connections = this?.connectionsByUser?.get(userId);
    if (!connections) return;

    const message = {
      type: 'user_message',
      data,
      timestamp: Date.now()
    };

    for (const connectionId of connections) {
      this.queueMessage(connectionId, message);
    }
  }

  /**
   * Queue message for batching
   */
  private queueMessage(connectionId: string, message: any): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection || connection?.ws?.readyState !== WebSocket.OPEN) return;

    connection?.messageQueue?.push(message);

    // If batch timer not set, set it
    if (!connection.batchTimer) {
      connection.batchTimer = setTimeout(() => {
        this.flushMessageQueue(connectionId);
      }, this.batchInterval);
    }

    // Flush immediately if batch size reached
    if (connection?.messageQueue?.length >= this.maxBatchSize) {
      if (connection.batchTimer) {
        clearTimeout(connection.batchTimer);
        connection.batchTimer = undefined;
      }
      this.flushMessageQueue(connectionId);
    }
  }

  /**
   * Flush message queue (send batched messages)
   */
  private flushMessageQueue(connectionId: string): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection || connection?.messageQueue?.length === 0) return;

    const messages = connection?.messageQueue?.splice(0);
    connection.batchTimer = undefined;

    // Send as batch if multiple messages, otherwise send single
    const payload = messages?.length || 0 === 1 
      ? messages[0] 
      : { type: 'batch', messages, count: messages?.length || 0 };

    this.sendMessage(connectionId, payload);
    
    if (messages?.length || 0 > 1) {
      this?.stats?.batchesSent++;
    }
  }

  /**
   * Send message directly (bypasses batching)
   */
  private sendMessage(connectionId: string, message: any): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection || connection?.ws?.readyState !== WebSocket.OPEN) return;

    try {
      const data = JSON.stringify(message);
      connection?.ws?.send(data);
      
      connection?.stats?.messagesSent++;
      connection?.stats?.bytesTransmitted += Buffer.byteLength(data);
      this?.stats?.messagesSent++;
      this?.stats?.bytesTransmitted += Buffer.byteLength(data);
      
    } catch (error) {
      console.error(`Error sending message to ${connectionId}:`, error);
      this.handleError(connectionId, error as Error);
    }
  }

  /**
   * Send error message
   */
  private sendError(connectionId: string, error: string): void {
    this.sendMessage(connectionId, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  /**
   * Start maintenance tasks (ping, cleanup)
   */
  private startMaintenanceTasks(): void {
    // Ping all connections periodically
    this.pingTimer = setInterval(() => {
      for (const [id, connection] of this.connections) {
        if (connection?.ws?.readyState === WebSocket.OPEN) {
          connection?.ws?.ping();
        }
      }
    }, this.pingInterval);

    // Clean up dead connections
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.pingInterval * 2;

      for (const [id, connection] of this.connections) {
        if (now - connection.lastPing > timeout) {
          console.warn(`Closing inactive connection: ${id}`);
          connection?.ws?.terminate();
          this.handleClose(id);
        }
      }
    }, this.pingInterval);
  }

  /**
   * Update latency measurement
   */
  private updateLatency(connectionId: string): void {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return;

    const latency = Date.now() - connection.lastPing;
    this?.latencyMeasurements?.push(latency);
    
    // Keep only last 100 measurements
    if (this?.latencyMeasurements?.length > 100) {
      this?.latencyMeasurements?.shift();
    }
    
    // Calculate average
    if (this?.latencyMeasurements?.length > 0) {
      const sum = this?.latencyMeasurements?.reduce((a: any, b: any) => a + b, 0);
      this?.stats?.averageLatency = sum / this?.latencyMeasurements?.length;
    }
  }

  /**
   * Count total subscriptions across all connections
   */
  private countTotalSubscriptions(): number {
    let total = 0;
    for (const connection of this?.connections?.values()) {
      total += connection?.subscriptions?.size;
    }
    return total;
  }

  /**
   * Generate unique connection ID
   */
  private generateId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): Connection | undefined {
    return this?.connections?.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): Connection[] {
    const connectionIds = this?.connectionsByUser?.get(userId);
    if (!connectionIds) return [];
    
    const connections: Connection[] = [];
    for (const id of connectionIds) {
      const conn = this?.connections?.get(id);
      if (conn) connections.push(conn);
    }
    return connections;
  }

  /**
   * Get statistics
   */
  getStats(): WebSocketStats & { 
    topicStats: Array<{ topic: string; subscribers: number }> 
  } {
    const topicStats = Array.from(this?.subscriptions?.entries())
      .map(([topic, subs]) => ({ topic, subscribers: subs.size }))
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, 10); // Top 10 topics

    return {
      ...this.stats,
      topicStats
    };
  }

  /**
   * Shutdown the WebSocket server
   */
  async shutdown(): Promise<void> {
    // Clear timers
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Close all connections
    for (const connection of this?.connections?.values()) {
      connection?.ws?.close(1000, 'Server shutdown');
    }

    // Close server
    return new Promise((resolve: any) => {
      if (this.wss) {
        this?.wss?.close(() => {
          console.log('WebSocket server shut down');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Export singleton instance
export const websocketGateway = new OptimizedWebSocketGateway();