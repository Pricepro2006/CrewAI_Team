/**
 * Enhanced WebSocket Server with Automatic Reconnection
 * Implements error recovery, exponential backoff, and connection resilience
 */

import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";
import * as crypto from "crypto";

export interface WSMessage {
  id?: string;
  type: "nlp_processing" | "nlp_result" | "cart_update" | "price_update" | 
        "product_match" | "error" | "heartbeat" | "reconnect" | "auth" | "ack";
  data: any;
  timestamp: string;
  sessionId?: string;
  userId?: string;
  sequenceNumber?: number;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  isAlive: boolean;
  reconnectToken?: string;
  lastActivity: Date;
  messageQueue: WSMessage[];
  subscriptions: Set<string>;
  reconnectCount: number;
  sequenceNumber: number;
}

export interface ReconnectionConfig {
  maxReconnectAttempts: number;
  initialReconnectDelay: number;
  maxReconnectDelay: number;
  reconnectBackoffMultiplier: number;
  messageQueueSize: number;
  sessionTimeout: number;
  heartbeatInterval: number;
}

export class EnhancedWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private reconnectTokens: Map<string, string> = new Map();
  private messageHistory: Map<string, WSMessage[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private config: ReconnectionConfig = {
    maxReconnectAttempts: 5,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 30000,
    reconnectBackoffMultiplier: 1.5,
    messageQueueSize: 100,
    sessionTimeout: 300000, // 5 minutes
    heartbeatInterval: 30000 // 30 seconds
  };

  constructor(config?: Partial<ReconnectionConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize WebSocket server with enhanced features
   */
  initialize(server: Server, path: string = "/ws/walmart") {
    this.wss = new WebSocketServer({ 
      server,
      path,
      perMessageDeflate: {
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
        threshold: 1024
      },
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on("connection", this.handleConnection.bind(this));
    this.wss.on("error", this.handleServerError.bind(this));

    // Start maintenance tasks
    this.startHeartbeat();
    this.startCleanup();

    logger.info(`Enhanced WebSocket server initialized at ${path}`, "WS_SERVER");
  }

  /**
   * Verify client connection (for security and reconnection)
   */
  private verifyClient(info: any, callback: (result: boolean, code?: number, message?: string) => void) {
    // Check for reconnection token
    const url = new URL(info.req.url, `http://${info.req.headers.host}`);
    const reconnectToken = url.searchParams.get("reconnectToken");
    
    if (reconnectToken && this.reconnectTokens.has(reconnectToken)) {
      callback(true);
    } else {
      // Perform other authentication checks here
      callback(true); // For now, accept all connections
    }
  }

  /**
   * Handle new WebSocket connection with reconnection support
   */
  private handleConnection(ws: WebSocket, req: any) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const reconnectToken = url.searchParams.get("reconnectToken");
    
    let client: WSClient;
    
    if (reconnectToken && this.reconnectTokens.has(reconnectToken)) {
      // Reconnection
      const clientId = this.reconnectTokens.get(reconnectToken)!;
      const existingClient = this.clients.get(clientId);
      
      if (existingClient) {
        logger.info(`Client ${clientId} reconnected`, "WS_SERVER");
        
        // Update client with new WebSocket
        existingClient.ws = ws;
        existingClient.isAlive = true;
        existingClient.lastActivity = new Date();
        existingClient.reconnectCount++;
        
        client = existingClient;
        
        // Send queued messages
        this.flushMessageQueue(client);
        
        // Send reconnection success
        this.sendToClient(client, {
          type: "reconnect",
          data: { 
            success: true, 
            reconnectCount: client.reconnectCount,
            queuedMessages: client.messageQueue.length
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Token exists but client not found, create new
        client = this.createNewClient(ws);
      }
    } else {
      // New connection
      client = this.createNewClient(ws);
    }

    this.setupClientHandlers(ws, client);
    
    // Send welcome message
    this.sendToClient(client, {
      type: "auth",
      data: { 
        message: "Connected to Enhanced Walmart Grocery Agent",
        clientId: client.id,
        reconnectToken: client.reconnectToken,
        features: ["nlp", "cart_sync", "price_updates", "auto_reconnect"],
        config: {
          heartbeatInterval: this.config.heartbeatInterval,
          maxReconnectAttempts: this.config.maxReconnectAttempts
        }
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create new client with enhanced properties
   */
  private createNewClient(ws: WebSocket): WSClient {
    const clientId = this.generateClientId();
    const reconnectToken = this.generateReconnectToken();
    
    const client: WSClient = {
      id: clientId,
      ws,
      isAlive: true,
      reconnectToken,
      lastActivity: new Date(),
      messageQueue: [],
      subscriptions: new Set(),
      reconnectCount: 0,
      sequenceNumber: 0
    };
    
    this.clients.set(clientId, client);
    this.reconnectTokens.set(reconnectToken, clientId);
    
    logger.info(`New WebSocket client created: ${clientId}`, "WS_SERVER");
    
    return client;
  }

  /**
   * Setup WebSocket event handlers for client
   */
  private setupClientHandlers(ws: WebSocket, client: WSClient) {
    // Handle client messages
    ws.on("message", (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        client.lastActivity = new Date();
        this.handleClientMessage(client, data);
      } catch (error) {
        logger.error(`Invalid message from client ${client.id}: ${error}`, "WS_SERVER");
        this.sendError(client, "Invalid message format");
      }
    });

    // Handle pong for heartbeat
    ws.on("pong", () => {
      client.isAlive = true;
      client.lastActivity = new Date();
    });

    // Handle client disconnect
    ws.on("close", (code: number, reason: Buffer) => {
      logger.info(`Client ${client.id} disconnected: ${code} - ${reason}`, "WS_SERVER");
      this.handleClientDisconnect(client);
    });

    // Handle WebSocket errors
    ws.on("error", (error: Error) => {
      logger.error(`WebSocket error for client ${client.id}: ${error.message}`, "WS_SERVER");
      this.handleClientError(client, error);
    });
  }

  /**
   * Handle client disconnection with session preservation
   */
  private handleClientDisconnect(client: WSClient) {
    client.isAlive = false;
    
    // Keep client in memory for potential reconnection
    // Will be cleaned up by cleanup interval if not reconnected
    this.emit("client:disconnect", client.id);
  }

  /**
   * Handle client errors with recovery
   */
  private handleClientError(client: WSClient, error: Error) {
    logger.error(`Client ${client.id} error: ${error.message}`, "WS_SERVER");
    
    // Try to send error notification if connection is still open
    if (client.ws.readyState === WebSocket.OPEN) {
      this.sendError(client, `Connection error: ${error.message}`);
    }
    
    this.emit("client:error", { clientId: client.id, error });
  }

  /**
   * Handle server-level errors
   */
  private handleServerError(error: Error) {
    logger.error(`WebSocket server error: ${error.message}`, "WS_SERVER");
    this.emit("server:error", error);
  }

  /**
   * Handle messages from client with acknowledgment
   */
  private handleClientMessage(client: WSClient, message: any) {
    // Send acknowledgment if message has an ID
    if (message.id) {
      this.sendToClient(client, {
        type: "ack",
        data: { messageId: message.id },
        timestamp: new Date().toISOString()
      });
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

      case "heartbeat":
        this.handleHeartbeat(client);
        break;

      case "ping":
        this.sendToClient(client, { 
          type: "heartbeat", 
          data: { pong: true },
          timestamp: new Date().toISOString()
        });
        break;

      default:
        // Emit custom event for handling by external systems
        this.emit("client:message", { client, message });
    }
  }

  /**
   * Handle authentication
   */
  private handleAuth(client: WSClient, message: any) {
    client.userId = message.userId;
    client.sessionId = message.sessionId;
    logger.info(`Client ${client.id} authenticated as user ${client.userId}`, "WS_SERVER");
    
    // Restore any previous session state
    if (client.sessionId && this.messageHistory.has(client.sessionId)) {
      const history = this.messageHistory.get(client.sessionId)!;
      // Send last N messages from history
      const recentHistory = history.slice(-10);
      recentHistory.forEach(msg => this.sendToClient(client, msg));
    }
    
    this.emit("client:auth", client);
  }

  /**
   * Handle event subscriptions
   */
  private handleSubscription(client: WSClient, events: string[]) {
    events.forEach(event => client.subscriptions.add(event));
    logger.info(`Client ${client.id} subscribed to: ${events.join(", ")}`, "WS_SERVER");
  }

  /**
   * Handle event unsubscriptions
   */
  private handleUnsubscription(client: WSClient, events: string[]) {
    events.forEach(event => client.subscriptions.delete(event));
    logger.info(`Client ${client.id} unsubscribed from: ${events.join(", ")}`, "WS_SERVER");
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(client: WSClient) {
    client.isAlive = true;
    client.lastActivity = new Date();
  }

  /**
   * Send message to specific client with queueing
   */
  private sendToClient(client: WSClient, message: WSMessage) {
    // Add sequence number for message ordering
    message.sequenceNumber = ++client.sequenceNumber;
    
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
        
        // Store in history if it's an important message
        if (message.sessionId && ["nlp_result", "cart_update", "price_update"].includes(message.type)) {
          this.addToHistory(message.sessionId, message);
        }
      } catch (error) {
        logger.error(`Failed to send message to client ${client.id}: ${error}`, "WS_SERVER");
        this.queueMessage(client, message);
      }
    } else {
      // Queue message for later delivery
      this.queueMessage(client, message);
    }
  }

  /**
   * Queue message for later delivery
   */
  private queueMessage(client: WSClient, message: WSMessage) {
    if (client.messageQueue.length >= this.config.messageQueueSize) {
      // Remove oldest message if queue is full
      client.messageQueue.shift();
    }
    client.messageQueue.push(message);
  }

  /**
   * Flush message queue for reconnected client
   */
  private flushMessageQueue(client: WSClient) {
    const queue = [...client.messageQueue];
    client.messageQueue = [];
    
    queue.forEach(message => {
      this.sendToClient(client, message);
    });
  }

  /**
   * Add message to session history
   */
  private addToHistory(sessionId: string, message: WSMessage) {
    if (!this.messageHistory.has(sessionId)) {
      this.messageHistory.set(sessionId, []);
    }
    
    const history = this.messageHistory.get(sessionId)!;
    history.push(message);
    
    // Keep only last 100 messages per session
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: WSClient, error: string) {
    this.sendToClient(client, {
      type: "error",
      data: { error },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to all connected clients with filtering
   */
  broadcast(message: WSMessage, filter?: (client: WSClient) => boolean) {
    this.clients.forEach(client => {
      if (!filter || filter(client)) {
        this.sendToClient(client, message);
      }
    });
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, message: WSMessage) {
    this.broadcast(message, client => client.userId === userId);
  }

  /**
   * Send message to specific session
   */
  sendToSession(sessionId: string, message: WSMessage) {
    message.sessionId = sessionId;
    this.broadcast(message, client => client.sessionId === sessionId);
  }

  /**
   * Send to clients subscribed to specific events
   */
  sendToSubscribers(event: string, message: WSMessage) {
    this.broadcast(message, client => client.subscriptions.has(event));
  }

  /**
   * Notify NLP processing started
   */
  notifyNLPProcessingStart(sessionId: string, query: string) {
    this.sendToSession(sessionId, {
      type: "nlp_processing",
      data: {
        status: "started",
        query,
        message: "Understanding your request..."
      },
      timestamp: new Date().toISOString(),
      sessionId
    });
  }

  /**
   * Notify NLP processing completed
   */
  notifyNLPResult(sessionId: string, result: any) {
    this.sendToSession(sessionId, {
      type: "nlp_result",
      data: result,
      timestamp: new Date().toISOString(),
      sessionId
    });
  }

  /**
   * Notify product matches found
   */
  notifyProductMatches(sessionId: string, products: any[]) {
    this.sendToSession(sessionId, {
      type: "product_match",
      data: {
        products,
        count: products.length
      },
      timestamp: new Date().toISOString(),
      sessionId
    });
  }

  /**
   * Notify cart update
   */
  notifyCartUpdate(userId: string, cart: any) {
    this.sendToUser(userId, {
      type: "cart_update",
      data: cart,
      timestamp: new Date().toISOString(),
      userId
    });
  }

  /**
   * Notify price update
   */
  notifyPriceUpdate(productId: string, oldPrice: number, newPrice: number) {
    this.sendToSubscribers("price_updates", {
      type: "price_update",
      data: {
        productId,
        oldPrice,
        newPrice,
        change: newPrice - oldPrice,
        changePercent: ((newPrice - oldPrice) / oldPrice * 100).toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, id) => {
        if (!client.isAlive && client.ws.readyState === WebSocket.OPEN) {
          // Client didn't respond to last ping
          logger.info(`Terminating unresponsive client: ${id}`, "WS_SERVER");
          client.ws.terminate();
          return;
        }

        // Send ping to active connections
        if (client.ws.readyState === WebSocket.OPEN) {
          client.isAlive = false;
          client.ws.ping();
          
          // Also send heartbeat message
          this.sendToClient(client, {
            type: "heartbeat",
            data: { 
              serverTime: now,
              nextHeartbeat: this.config.heartbeatInterval
            },
            timestamp: new Date().toISOString()
          });
        }
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Start cleanup interval for disconnected clients
   */
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.sessionTimeout;
      
      this.clients.forEach((client, id) => {
        const lastActivityTime = client.lastActivity.getTime();
        
        // Remove clients that have been disconnected for too long
        if (client.ws.readyState !== WebSocket.OPEN && 
            (now - lastActivityTime) > timeout) {
          logger.info(`Removing inactive client: ${id}`, "WS_SERVER");
          
          // Clean up reconnect token
          if (client.reconnectToken) {
            this.reconnectTokens.delete(client.reconnectToken);
          }
          
          // Clean up message history if no other clients in session
          if (client.sessionId) {
            const otherClientsInSession = Array.from(this.clients.values())
              .filter(c => c.id !== id && c.sessionId === client.sessionId);
            
            if (otherClientsInSession.length === 0) {
              this.messageHistory.delete(client.sessionId);
            }
          }
          
          this.clients.delete(id);
        }
      });
      
      // Clean up old message history
      this.messageHistory.forEach((history, sessionId) => {
        const hasActiveClient = Array.from(this.clients.values())
          .some(client => client.sessionId === sessionId);
        
        if (!hasActiveClient) {
          this.messageHistory.delete(sessionId);
        }
      });
    }, 60000); // Run every minute
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Stop cleanup
   */
  private stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate reconnect token
   */
  private generateReconnectToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return Array.from(this.clients.values())
      .filter(client => client.ws.readyState === WebSocket.OPEN)
      .length;
  }

  /**
   * Get total clients (including disconnected with valid sessions)
   */
  getTotalClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client statistics
   */
  getStatistics() {
    const connected = this.getClientCount();
    const total = this.getTotalClientCount();
    const sessions = new Set(
      Array.from(this.clients.values())
        .map(c => c.sessionId)
        .filter(Boolean)
    ).size;
    
    return {
      connected,
      disconnected: total - connected,
      total,
      sessions,
      messageHistorySize: this.messageHistory.size,
      reconnectTokens: this.reconnectTokens.size
    };
  }

  /**
   * Shutdown WebSocket server gracefully
   */
  shutdown() {
    logger.info("Shutting down Enhanced WebSocket server", "WS_SERVER");
    
    this.stopHeartbeat();
    this.stopCleanup();
    
    // Notify all clients of shutdown
    this.broadcast({
      type: "error",
      data: { 
        error: "Server shutting down",
        reconnectable: false
      },
      timestamp: new Date().toISOString()
    });
    
    // Close all client connections
    this.clients.forEach(client => {
      client.ws.close(1001, "Server shutting down");
    });
    
    // Clear all data
    this.clients.clear();
    this.reconnectTokens.clear();
    this.messageHistory.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    this.emit("server:shutdown");
  }
}

// Export singleton instance
export const enhancedWSServer = new EnhancedWebSocketServer();

export default EnhancedWebSocketServer;