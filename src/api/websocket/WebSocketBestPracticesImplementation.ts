/**
 * WebSocket Best Practices Implementation
 * Consolidated improvements from 2025 research
 * Implements reconnection, message queueing, and error recovery
 */

import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";
import * as crypto from "crypto";

// Connection states following best practices
export enum ConnectionState {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  DISCONNECTED = "DISCONNECTED",
  CLOSED = "CLOSED"
}

// Message priorities for queue management
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

// WebSocket close codes that should NOT trigger reconnection
const NO_RECONNECT_CODES = new Set([
  1000, // Normal closure
  1001, // Going away
  1008, // Policy violation
  1009, // Message too big
  1010, // Mandatory extension
  1011  // Internal server error
]);

export interface WSMessage {
  id?: string;
  type: string;
  payload: any;
  timestamp?: string;
  priority?: MessagePriority;
  sequenceNumber?: number;
  requiresAck?: boolean;
  retryCount?: number;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  state: ConnectionState;
  isAlive: boolean;
  reconnectToken?: string;
  lastActivity: Date;
  messageQueue: WSMessage[];
  subscriptions: Set<string>;
  reconnectCount: number;
  sequenceNumber: number;
  lastReceivedSequence: number;
  pendingAcks: Map<string, NodeJS.Timeout>;
  metrics: ClientMetrics;
}

export interface ClientMetrics {
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  errorsCount: number;
  reconnections: number;
  avgLatency: number;
  lastLatency: number;
}

export interface ReconnectionConfig {
  maxReconnectAttempts: number;
  initialReconnectDelay: number;
  maxReconnectDelay: number;
  reconnectBackoffMultiplier: number;
  messageQueueSize: number;
  sessionTimeout: number;
  heartbeatInterval: number;
  pingTimeout: number;
  ackTimeout: number;
  messageCompression: boolean;
  compressionThreshold: number;
}

export class BestPracticeWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private reconnectTokens: Map<string, string> = new Map();
  private messageHistory: Map<string, WSMessage[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  private config: ReconnectionConfig = {
    maxReconnectAttempts: 5,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 30000,
    reconnectBackoffMultiplier: 1.5,
    messageQueueSize: 100,
    sessionTimeout: 300000, // 5 minutes
    heartbeatInterval: 30000, // 30 seconds
    pingTimeout: 5000, // 5 seconds
    ackTimeout: 10000, // 10 seconds
    messageCompression: true,
    compressionThreshold: 1024 // 1KB
  };

  constructor(config?: Partial<ReconnectionConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize WebSocket server with best practices
   */
  initialize(server: Server, path: string = "/ws/enhanced") {
    const perMessageDeflate = this?.config?.messageCompression ? {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
      threshold: this?.config?.compressionThreshold
    } : false;

    this.wss = new WebSocketServer({ 
      server,
      path,
      perMessageDeflate,
      verifyClient: this?.verifyClient?.bind(this),
      handleProtocols: this?.handleProtocols?.bind(this),
      clientTracking: true,
      maxPayload: 100 * 1024 * 1024 // 100MB max message size
    });

    this?.wss?.on("connection", this?.handleConnection?.bind(this));
    this?.wss?.on("error", this?.handleServerError?.bind(this));

    // Start maintenance tasks
    this.startHeartbeat();
    this.startCleanup();
    this.startMetricsCollection();

    logger.info(`Best Practice WebSocket server initialized at ${path}`, "WS_SERVER");
  }

  /**
   * Verify client with authentication and rate limiting
   */
  private verifyClient(info: any, callback: (result: boolean, code?: number, message?: string) => void) {
    const url = new URL(info?.req?.url, `http://${info?.req?.headers.host}`);
    const reconnectToken = url?.searchParams?.get("reconnectToken");
    const authToken = info?.req?.headers.authorization;
    
    // Check reconnection token
    if (reconnectToken && this?.reconnectTokens?.has(reconnectToken)) {
      callback(true);
      return;
    }
    
    // Check authentication
    if (authToken) {
      // Validate auth token here
      // For now, accept all authenticated connections
      callback(true);
      return;
    }
    
    // Rate limiting check
    const clientIp = info?.req?.connection.remoteAddress;
    if (this.isRateLimited(clientIp)) {
      callback(false, 429, "Too Many Requests");
      return;
    }
    
    // Accept connection
    callback(true);
  }

  /**
   * Handle protocol negotiation
   */
  private handleProtocols(protocols: Set<string>, request: any): string | false {
    // Prefer JSON protocol
    if (protocols.has("json")) return "json";
    if (protocols.has("msgpack")) return "msgpack";
    return false;
  }

  /**
   * Check if client is rate limited
   */
  private isRateLimited(clientIp: string): boolean {
    // Implement rate limiting logic here
    // For now, return false
    return false;
  }

  /**
   * Handle new connection with session recovery
   */
  private handleConnection(ws: WebSocket, req: any) {
    const url = new URL(req.url, `http://${req?.headers?.host}`);
    const reconnectToken = url?.searchParams?.get("reconnectToken");
    
    let client: WSClient;
    
    if (reconnectToken && this?.reconnectTokens?.has(reconnectToken)) {
      // Session recovery
      client = this.recoverSession(ws, reconnectToken);
    } else {
      // New connection
      client = this.createNewClient(ws);
    }

    this.setupClientHandlers(ws, client);
    this.sendWelcomeMessage(client);
  }

  /**
   * Recover existing session
   */
  private recoverSession(ws: WebSocket, reconnectToken: string): WSClient {
    const clientId = this?.reconnectTokens?.get(reconnectToken)!;
    const existingClient = this?.clients?.get(clientId);
    
    if (existingClient) {
      logger.info(`Client ${clientId} session recovered`, "WS_SERVER");
      
      // Update client with new WebSocket
      existingClient.ws = ws;
      existingClient.state = ConnectionState.CONNECTED;
      existingClient.isAlive = true;
      existingClient.lastActivity = new Date();
      existingClient.reconnectCount++;
      if (existingClient?.metrics?.reconnections !== undefined) {
        existingClient.metrics.reconnections++;
      }
      
      // Send queued messages
      this.flushMessageQueue(existingClient);
      
      // Send recovery confirmation
      this.sendToClient(existingClient, {
        type: "session_recovered",
        payload: { 
          reconnectCount: existingClient.reconnectCount,
          queuedMessages: existingClient?.messageQueue?.length,
          lastSequence: existingClient.lastReceivedSequence
        },
        timestamp: new Date().toISOString()
      });
      
      return existingClient;
    }
    
    // Token exists but client not found, create new
    return this.createNewClient(ws);
  }

  /**
   * Create new client with metrics
   */
  private createNewClient(ws: WebSocket): WSClient {
    const clientId = this.generateClientId();
    const reconnectToken = this.generateReconnectToken();
    
    const client: WSClient = {
      id: clientId,
      ws,
      state: ConnectionState.CONNECTED,
      isAlive: true,
      reconnectToken,
      lastActivity: new Date(),
      messageQueue: [],
      subscriptions: new Set(),
      reconnectCount: 0,
      sequenceNumber: 0,
      lastReceivedSequence: 0,
      pendingAcks: new Map(),
      metrics: {
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        errorsCount: 0,
        reconnections: 0,
        avgLatency: 0,
        lastLatency: 0
      }
    };
    
    this?.clients?.set(clientId, client);
    this?.reconnectTokens?.set(reconnectToken, clientId);
    
    logger.info(`New client created: ${clientId}`, "WS_SERVER");
    
    return client;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupClientHandlers(ws: WebSocket, client: WSClient) {
    // Message handler with validation
    ws.on("message", (message: Buffer) => {
      const startTime = Date.now();
      
      try {
        const data = this.parseMessage(message);
        client.lastActivity = new Date();
        if (client?.metrics?.messagesReceived !== undefined) {
          client.metrics.messagesReceived++;
        }
        if (client?.metrics?.bytesReceived !== undefined) {
          client.metrics.bytesReceived += message?.length || 0;
        }
        
        // Validate message
        if (!this.validateMessage(data)) {
          throw new Error("Invalid message format");
        }
        
        // Update sequence tracking
        if (data.sequenceNumber) {
          client.lastReceivedSequence = data.sequenceNumber;
        }
        
        // Calculate latency
        const latency = Date.now() - startTime;
        if (client?.metrics) {
          client.metrics.lastLatency = latency;
        }
        if (client?.metrics?.avgLatency !== undefined && client?.metrics?.messagesReceived !== undefined) {
          client.metrics.avgLatency = 
            (client.metrics.avgLatency * (client.metrics.messagesReceived - 1) + latency) / 
            client.metrics.messagesReceived;
        }
        
        this.handleClientMessage(client, data);
        
      } catch (error) {
        if (client?.metrics?.errorsCount !== undefined) {
          client.metrics.errorsCount++;
        }
        logger.error(`Message error from client ${client.id}: ${error}`, "WS_SERVER");
        this.sendError(client, "Invalid message", true);
      }
    });

    // Pong handler for heartbeat
    ws.on("pong", (data: Buffer) => {
      client.isAlive = true;
      client.lastActivity = new Date();
      
      // Calculate round-trip time if ping included timestamp
      if (data && data.length === 8) {
        const pingTime = data.readBigInt64BE();
        const rtt = Date.now() - Number(pingTime);
        if (client?.metrics) {
          client.metrics.lastLatency = rtt;
        }
      }
    });

    // Close handler
    ws.on("close", (code: number, reason: Buffer) => {
      logger.info(`Client ${client.id} disconnected: ${code} - ${reason}`, "WS_SERVER");
      client.state = ConnectionState.DISCONNECTED;
      
      // Determine if session should be preserved
      if (this.shouldPreserveSession(code)) {
        this.preserveClientSession(client);
      } else {
        this.removeClient(client);
      }
      
      this.emit("client:disconnect", { client, code, reason });
    });

    // Error handler
    ws.on("error", (error: Error) => {
      if (client?.metrics?.errorsCount !== undefined) {
        client.metrics.errorsCount++;
      }
      logger.error(`WebSocket error for client ${client.id}: ${error.message}`, "WS_SERVER");
      this.handleClientError(client, error);
    });
  }

  /**
   * Parse and validate incoming message
   */
  private parseMessage(message: Buffer): any {
    // Try to parse as JSON first
    try {
      return JSON.parse(message.toString());
    } catch {
      // Try other formats if needed (msgpack, etc.)
      throw new Error("Unsupported message format");
    }
  }

  /**
   * Validate message structure
   */
  private validateMessage(message: any): boolean {
    // Basic validation
    if (!message || typeof message !== "object") return false;
    if (!message.type || typeof message.type !== "string") return false;
    
    // Additional validation based on message type
    switch (message.type) {
      case "auth":
        return message.token && typeof message.token === "string";
      case "ping":
        return true;
      case "subscribe":
        return Array.isArray(message.events);
      default:
        return true;
    }
  }

  /**
   * Handle validated client message
   */
  private handleClientMessage(client: WSClient, message: any) {
    // Send acknowledgment if required
    if (message.id && message.requiresAck) {
      this.sendAcknowledgment(client, message.id);
    }

    switch (message.type) {
      case "auth":
        this.handleAuth(client, message);
        break;

      case "subscribe":
        this.handleSubscription(client, message.events);
        break;

      case "unsubscribe":
        this.handleUnsubscription(client, message.events);
        break;

      case "ping":
        this.handlePing(client, message);
        break;

      case "metrics":
        this.handleMetricsRequest(client);
        break;

      default:
        // Emit for external handling
        this.emit("client:message", { client, message });
    }
  }

  /**
   * Send acknowledgment for message
   */
  private sendAcknowledgment(client: WSClient, messageId: string) {
    this.sendToClient(client, {
      type: "ack",
      payload: { messageId, received: Date.now() },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle authentication
   */
  private handleAuth(client: WSClient, message: any) {
    // Validate token
    // For now, accept all auth attempts
    client.userId = message.userId || "";
    client.sessionId = message.sessionId || this.generateSessionId();
    
    logger.info(`Client ${client.id} authenticated as user ${client.userId}`, "WS_SERVER");
    
    // Send auth confirmation
    this.sendToClient(client, {
      type: "auth_success",
      payload: {
        sessionId: client.sessionId,
        reconnectToken: client.reconnectToken,
        features: ["reconnection", "message_queue", "heartbeat", "compression"]
      },
      timestamp: new Date().toISOString()
    });
    
    this.emit("client:auth", client);
  }

  /**
   * Handle ping with timestamp
   */
  private handlePing(client: WSClient, message: any) {
    this.sendToClient(client, {
      type: "pong",
      payload: { 
        clientTime: message.timestamp,
        serverTime: Date.now()
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle metrics request
   */
  private handleMetricsRequest(client: WSClient) {
    this.sendToClient(client, {
      type: "metrics",
      payload: {
        ...client.metrics,
        connectionUptime: Date.now() - client?.lastActivity?.getTime(),
        queueSize: client?.messageQueue?.length
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send message to client with retries
   */
  private sendToClient(client: WSClient, message: WSMessage, retryCount = 0) {
    // Add metadata
    message.id = message.id || this.generateMessageId();
    message.sequenceNumber = ++client.sequenceNumber;
    message.timestamp = message.timestamp || new Date().toISOString();
    
    if (client?.ws?.readyState === WebSocket.OPEN) {
      try {
        const data = JSON.stringify(message);
        client?.ws?.send(data);
        
        if (client?.metrics?.messagesSent !== undefined) {
          client.metrics.messagesSent++;
        }
        if (client?.metrics?.bytesSent !== undefined) {
          client.metrics.bytesSent += data?.length || 0;
        }
        
        // Set up acknowledgment timeout if required
        if (message.requiresAck) {
          const timeout = setTimeout(() => {
            this.handleAckTimeout(client, message);
          }, this?.config?.ackTimeout);
          
          client?.pendingAcks?.set(message.id!, timeout);
        }
        
        // Store in history for important messages
        if (this.shouldStoreInHistory(message)) {
          this.addToHistory(client.sessionId!, message);
        }
        
      } catch (error) {
        logger.error(`Failed to send message to client ${client.id}: ${error}`, "WS_SERVER");
        
        // Retry or queue
        if (retryCount < 3) {
          setTimeout(() => {
            this.sendToClient(client, message, retryCount + 1);
          }, 1000 * (retryCount + 1));
        } else {
          this.queueMessage(client, message);
        }
      }
    } else {
      // Queue message for later delivery
      this.queueMessage(client, message);
    }
  }

  /**
   * Handle acknowledgment timeout
   */
  private handleAckTimeout(client: WSClient, message: WSMessage) {
    client?.pendingAcks?.delete(message.id!);
    
    logger.warn(`Acknowledgment timeout for message ${message.id} to client ${client.id}`, "WS_SERVER");
    
    // Retry high-priority messages
    if (message.priority && message.priority >= MessagePriority.HIGH) {
      message.retryCount = (message.retryCount || 0) + 1;
      if (message.retryCount <= 3) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Queue message with priority
   */
  private queueMessage(client: WSClient, message: WSMessage) {
    // Remove old messages if queue is full
    if (client?.messageQueue?.length >= this?.config?.messageQueueSize) {
      // Remove lowest priority message
      const lowestPriorityIndex = client?.messageQueue?.reduce((minIdx, msg, idx, arr) => 
        (msg.priority || 0) < (arr[minIdx]?.priority || 0) ? idx : minIdx, 0);
      
      client?.messageQueue?.splice(lowestPriorityIndex, 1);
    }
    
    // Add message to queue
    client?.messageQueue?.push(message);
    
    // Sort by priority
    client?.messageQueue?.sort((a, b) => 
      (b.priority || MessagePriority.NORMAL) - (a.priority || MessagePriority.NORMAL)
    );
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(client: WSClient) {
    const queue = [...client.messageQueue];
    client.messageQueue = [];
    
    queue.forEach(message => {
      this.sendToClient(client, message);
    });
  }

  /**
   * Determine if message should be stored in history
   */
  private shouldStoreInHistory(message: WSMessage): boolean {
    const importantTypes = ["auth_success", "session_recovered", "critical_update"];
    return importantTypes.includes(message.type) || 
           message.priority === MessagePriority.CRITICAL;
  }

  /**
   * Add message to session history
   */
  private addToHistory(sessionId: string, message: WSMessage) {
    if (!this?.messageHistory?.has(sessionId)) {
      this?.messageHistory?.set(sessionId, []);
    }
    
    const history = this?.messageHistory?.get(sessionId)!;
    history.push(message);
    
    // Keep only last 100 messages
    if (history?.length || 0 > 100) {
      history.shift();
    }
  }

  /**
   * Determine if session should be preserved
   */
  private shouldPreserveSession(closeCode: number): boolean {
    return !NO_RECONNECT_CODES.has(closeCode);
  }

  /**
   * Preserve client session for reconnection
   */
  private preserveClientSession(client: WSClient) {
    client.state = ConnectionState.DISCONNECTED;
    logger.info(`Preserving session for client ${client.id}`, "WS_SERVER");
    
    // Session will be cleaned up by cleanup interval if not reconnected
  }

  /**
   * Remove client completely
   */
  private removeClient(client: WSClient) {
    // Clear pending acknowledgments
    client?.pendingAcks?.forEach(timeout => clearTimeout(timeout));
    client?.pendingAcks?.clear();
    
    // Remove reconnect token
    if (client.reconnectToken) {
      this?.reconnectTokens?.delete(client.reconnectToken);
    }
    
    // Remove from clients map
    this?.clients?.delete(client.id);
    
    // Clean up message history if no other clients in session
    if (client.sessionId) {
      const otherClientsInSession = Array.from(this?.clients?.values())
        .filter(c => c.id !== client.id && c.sessionId === client.sessionId);
      
      if (otherClientsInSession?.length || 0 === 0) {
        this?.messageHistory?.delete(client.sessionId);
      }
    }
    
    logger.info(`Client ${client.id} removed`, "WS_SERVER");
  }

  /**
   * Handle client error
   */
  private handleClientError(client: WSClient, error: Error) {
    // Try to send error notification
    if (client?.ws?.readyState === WebSocket.OPEN) {
      this.sendError(client, error.message, true);
    }
    
    this.emit("client:error", { client, error });
  }

  /**
   * Handle server error
   */
  private handleServerError(error: Error) {
    logger.error(`WebSocket server error: ${error.message}`, "WS_SERVER");
    this.emit("server:error", error);
  }

  /**
   * Send error message to client
   */
  private sendError(client: WSClient, error: string, recoverable: boolean) {
    this.sendToClient(client, {
      type: "error",
      payload: { error, recoverable },
      timestamp: new Date().toISOString(),
      priority: MessagePriority.HIGH
    });
  }

  /**
   * Send welcome message
   */
  private sendWelcomeMessage(client: WSClient) {
    this.sendToClient(client, {
      type: "welcome",
      payload: {
        clientId: client.id,
        reconnectToken: client.reconnectToken,
        sessionId: client.sessionId,
        config: {
          heartbeatInterval: this?.config?.heartbeatInterval,
          maxReconnectAttempts: this?.config?.maxReconnectAttempts,
          features: ["reconnection", "message_queue", "heartbeat", "compression", "metrics"]
        }
      },
      timestamp: new Date().toISOString(),
      priority: MessagePriority.HIGH
    });
  }

  /**
   * Handle subscription
   */
  private handleSubscription(client: WSClient, events: string[]) {
    events.forEach(event => client?.subscriptions?.add(event));
    logger.info(`Client ${client.id} subscribed to: ${events.join(", ")}`, "WS_SERVER");
    
    this.sendToClient(client, {
      type: "subscription_confirmed",
      payload: { events },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscription(client: WSClient, events: string[]) {
    events.forEach(event => client?.subscriptions?.delete(event));
    logger.info(`Client ${client.id} unsubscribed from: ${events.join(", ")}`, "WS_SERVER");
    
    this.sendToClient(client, {
      type: "unsubscription_confirmed",
      payload: { events },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast to all clients
   */
  broadcast(message: WSMessage, filter?: (client: WSClient) => boolean) {
    this?.clients?.forEach(client => {
      if (!filter || filter(client)) {
        this.sendToClient(client, message);
      }
    });
  }

  /**
   * Send to subscribers of specific event
   */
  sendToSubscribers(event: string, message: WSMessage) {
    this.broadcast(message, client => client?.subscriptions?.has(event));
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const pingData = Buffer.allocUnsafe(8);
      pingData.writeBigInt64BE(BigInt(now));
      
      this?.clients?.forEach((client, id) => {
        if (client.state !== ConnectionState.CONNECTED) return;
        
        if (!client.isAlive && client?.ws?.readyState === WebSocket.OPEN) {
          // Client didn't respond to last ping
          logger.info(`Client ${id} failed heartbeat check`, "WS_SERVER");
          client?.ws?.terminate();
          return;
        }
        
        // Send ping with timestamp
        if (client?.ws?.readyState === WebSocket.OPEN) {
          client.isAlive = false;
          client?.ws?.ping(pingData);
        }
      });
    }, this?.config?.heartbeatInterval);
  }

  /**
   * Start cleanup interval
   */
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this?.config?.sessionTimeout;
      
      this?.clients?.forEach((client, id) => {
        const lastActivityTime = client?.lastActivity?.getTime();
        
        // Remove disconnected clients after timeout
        if (client.state === ConnectionState.DISCONNECTED && 
            (now - lastActivityTime) > timeout) {
          logger.info(`Removing inactive client: ${id}`, "WS_SERVER");
          this.removeClient(client);
        }
      });
      
      // Clean up old message history
      this?.messageHistory?.forEach((history, sessionId) => {
        const hasActiveClient = Array.from(this?.clients?.values())
          .some(client => client.sessionId === sessionId);
        
        if (!hasActiveClient) {
          this?.messageHistory?.delete(sessionId);
        }
      });
    }, 60000); // Run every minute
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getServerMetrics();
      this.emit("metrics", metrics);
      
      // Log metrics
      logger.info(`Server metrics: ${JSON.stringify(metrics)}`, "WS_METRICS");
    }, 60000); // Every minute
  }

  /**
   * Stop all intervals
   */
  private stopAllIntervals() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  }

  /**
   * Generate reconnect token
   */
  private generateReconnectToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * Get server metrics
   */
  getServerMetrics() {
    const connected = Array.from(this?.clients?.values())
      .filter(c => c.state === ConnectionState.CONNECTED).length;
    
    const disconnected = Array.from(this?.clients?.values())
      .filter(c => c.state === ConnectionState.DISCONNECTED).length;
    
    const totalMessages = Array.from(this?.clients?.values())
      .reduce((sum: any, c: any) => sum + c?.metrics?.messagesSent + c?.metrics?.messagesReceived, 0);
    
    const totalBytes = Array.from(this?.clients?.values())
      .reduce((sum: any, c: any) => sum + c?.metrics?.bytesSent + c?.metrics?.bytesReceived, 0);
    
    const avgLatency = Array.from(this?.clients?.values())
      .reduce((sum: any, c: any) => sum + c?.metrics?.avgLatency, 0) / Math.max(this?.clients?.size, 1);
    
    return {
      connected,
      disconnected,
      total: this?.clients?.size,
      sessions: this?.messageHistory?.size,
      reconnectTokens: this?.reconnectTokens?.size,
      totalMessages,
      totalBytes,
      avgLatency: Math.round(avgLatency * 100) / 100
    };
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    logger.info("Shutting down Best Practice WebSocket server", "WS_SERVER");
    
    this.stopAllIntervals();
    
    // Notify all clients
    this.broadcast({
      type: "server_shutdown",
      payload: { 
        message: "Server shutting down",
        reconnectable: false
      },
      timestamp: new Date().toISOString(),
      priority: MessagePriority.CRITICAL
    });
    
    // Close all connections
    this?.clients?.forEach(client => {
      client?.ws?.close(1001, "Server shutting down");
    });
    
    // Clear data
    this?.clients?.clear();
    this?.reconnectTokens?.clear();
    this?.messageHistory?.clear();
    
    if (this.wss) {
      this?.wss?.close();
      this.wss = null;
    }
    
    this.emit("server:shutdown");
  }
}

// Export singleton instance
export const bestPracticeWSServer = new BestPracticeWebSocketServer();

export default BestPracticeWebSocketServer;