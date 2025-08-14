/**
 * Secure WebSocket Server for Walmart Grocery Agent
 * Features authentication, rate limiting, and secure message handling
 */

import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import jwt from "jsonwebtoken";
import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";
import { IncomingMessage } from "http";

export interface SecureWSMessage {
  type: "nlp_processing" | "nlp_result" | "cart_update" | "price_update" | "product_match" | "error" | "auth_success" | "heartbeat";
  data: any;
  timestamp: string;
  sessionId?: string;
  userId?: string;
  messageId: string;
}

export interface SecureWSClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
  isAlive: boolean;
  lastActivity: number;
  messageCount: number;
  rateLimitReset: number;
  subscriptions: Set<string>;
  ipAddress: string;
  userAgent: string;
}

export interface RateLimitConfig {
  maxMessagesPerMinute: number;
  maxMessagesPerHour: number;
  maxConnectionsPerIP: number;
}

export class SecureWalmartWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, SecureWSClient> = new Map();
  private ipConnections: Map<string, number> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private jwtSecret: string;
  private rateLimitConfig: RateLimitConfig;

  constructor(jwtSecret?: string, rateLimitConfig?: Partial<RateLimitConfig>) {
    super();
    
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || this.generateSecretKey();
    this.rateLimitConfig = {
      maxMessagesPerMinute: 60,
      maxMessagesPerHour: 1000,
      maxConnectionsPerIP: 10,
      ...rateLimitConfig
    };

    if (!jwtSecret && !process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET not provided, using generated key', 'SECURE_WS');
    }
  }

  private generateSecretKey(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Initialize secure WebSocket server
   */
  initialize(server: Server, path: string = "/ws/walmart/secure") {
    this.wss = new WebSocketServer({
      server,
      path,
      verifyClient: this.verifyClient.bind(this),
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        threshold: 1024,
        concurrencyLimit: 10
      }
    });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Start background processes
    this.startHeartbeat();
    this.startCleanup();

    logger.info(`Secure WebSocket server initialized at ${path}`, "SECURE_WS", {
      rateLimits: this.rateLimitConfig
    });
  }

  /**
   * Verify client connection before accepting
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    const ip = this.getClientIP(info.req);
    const currentConnections = this.ipConnections.get(ip) || 0;

    if (currentConnections >= this.rateLimitConfig.maxConnectionsPerIP) {
      logger.warn('Connection rejected: IP connection limit exceeded', 'SECURE_WS', { ip, currentConnections });
      return false;
    }

    return true;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: IncomingMessage): string {
    return req.headers['x-forwarded-for']?.toString().split(',')[0] ||
           req.headers['x-real-ip']?.toString() ||
           req.socket.remoteAddress ||
           'unknown';
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const clientId = this.generateClientId();
    const ipAddress = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Update IP connection count
    this.ipConnections.set(ipAddress, (this.ipConnections.get(ipAddress) || 0) + 1);

    const client: SecureWSClient = {
      id: clientId,
      ws,
      isAuthenticated: false,
      isAlive: true,
      lastActivity: Date.now(),
      messageCount: 0,
      rateLimitReset: Date.now() + 60000, // Reset every minute
      subscriptions: new Set(),
      ipAddress,
      userAgent
    };

    this.clients.set(clientId, client);
    logger.info(`New WebSocket client connected: ${clientId}`, "SECURE_WS", {
      ip: ipAddress,
      userAgent: userAgent.substring(0, 100)
    });

    // Send authentication challenge
    this.sendToClient(client, {
      type: "error",
      data: { 
        message: "Authentication required",
        authRequired: true,
        clientId
      },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId()
    });

    // Handle client messages
    ws.on("message", (message: Buffer) => {
      this.handleClientMessage(client, message);
    });

    // Handle pong for heartbeat
    ws.on("pong", () => {
      client.isAlive = true;
      client.lastActivity = Date.now();
    });

    // Handle client disconnect
    ws.on("close", () => {
      this.handleClientDisconnect(client);
    });

    ws.on("error", (error) => {
      logger.error(`WebSocket error for client ${clientId}`, "SECURE_WS", { error, ip: ipAddress });
      this.handleClientDisconnect(client);
    });
  }

  /**
   * Handle messages from client
   */
  private handleClientMessage(client: SecureWSClient, message: Buffer) {
    try {
      // Rate limiting check
      if (!this.checkRateLimit(client)) {
        this.sendError(client, "Rate limit exceeded");
        return;
      }

      const data = JSON.parse(message.toString());
      client.lastActivity = Date.now();

      // Validate message structure
      if (!data.type || typeof data.type !== 'string') {
        this.sendError(client, "Invalid message format");
        return;
      }

      switch (data.type) {
        case "auth":
          this.handleAuthentication(client, data);
          break;

        case "subscribe":
          if (client.isAuthenticated) {
            this.handleSubscription(client, data.events);
          } else {
            this.sendError(client, "Authentication required");
          }
          break;

        case "ping":
          if (client.isAuthenticated) {
            this.sendToClient(client, {
              type: "heartbeat",
              data: { pong: true },
              timestamp: new Date().toISOString(),
              messageId: this.generateMessageId()
            });
          }
          break;

        case "unsubscribe":
          if (client.isAuthenticated) {
            this.handleUnsubscription(client, data.events);
          }
          break;

        default:
          if (client.isAuthenticated) {
            logger.warn(`Unknown message type from client ${client.id}: ${data.type}`, "SECURE_WS");
            this.sendError(client, "Unknown message type");
          } else {
            this.sendError(client, "Authentication required");
          }
      }
    } catch (error) {
      logger.error(`Invalid message from client ${client.id}`, "SECURE_WS", { error });
      this.sendError(client, "Invalid message format");
    }
  }

  /**
   * Handle client authentication
   */
  private handleAuthentication(client: SecureWSClient, data: any) {
    try {
      if (!data.token) {
        this.sendError(client, "Authentication token required");
        return;
      }

      const decoded = jwt.verify(data.token, this.jwtSecret) as any;
      
      if (!decoded.sub || !decoded.email) {
        this.sendError(client, "Invalid token: missing user information");
        return;
      }

      // Set authenticated client info
      client.userId = decoded.sub;
      client.sessionId = decoded.sessionId || this.generateSessionId();
      client.isAuthenticated = true;

      logger.info(`Client ${client.id} authenticated as user ${client.userId}`, "SECURE_WS", {
        userId: client.userId,
        sessionId: client.sessionId,
        role: decoded.role
      });

      // Send success response
      this.sendToClient(client, {
        type: "auth_success",
        data: {
          message: "Authentication successful",
          userId: client.userId,
          sessionId: client.sessionId,
          features: ["nlp", "cart_sync", "price_updates", "real_time_notifications"]
        },
        timestamp: new Date().toISOString(),
        messageId: this.generateMessageId()
      });

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        this.sendError(client, "Authentication token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        this.sendError(client, "Invalid authentication token");
      } else {
        logger.error(`Authentication error for client ${client.id}`, "SECURE_WS", { error });
        this.sendError(client, "Authentication failed");
      }
    }
  }

  /**
   * Handle event subscriptions
   */
  private handleSubscription(client: SecureWSClient, events: string[]) {
    if (!Array.isArray(events)) {
      this.sendError(client, "Invalid subscription events format");
      return;
    }

    const validEvents = ["nlp_processing", "nlp_result", "cart_update", "price_update", "product_match"];
    const invalidEvents = events.filter(event => !validEvents.includes(event));

    if (invalidEvents.length > 0) {
      this.sendError(client, `Invalid subscription events: ${invalidEvents.join(", ")}`);
      return;
    }

    events.forEach(event => client.subscriptions.add(event));
    
    logger.info(`Client ${client.id} subscribed to: ${events.join(", ")}`, "SECURE_WS", {
      userId: client.userId,
      totalSubscriptions: client.subscriptions.size
    });
  }

  /**
   * Handle event unsubscriptions
   */
  private handleUnsubscription(client: SecureWSClient, events: string[]) {
    if (!Array.isArray(events)) return;
    
    events.forEach(event => client.subscriptions.delete(event));
    logger.info(`Client ${client.id} unsubscribed from: ${events.join(", ")}`, "SECURE_WS");
  }

  /**
   * Check rate limiting for client
   */
  private checkRateLimit(client: SecureWSClient): boolean {
    const now = Date.now();
    
    // Reset counters if window has passed
    if (now > client.rateLimitReset) {
      client.messageCount = 0;
      client.rateLimitReset = now + 60000; // Reset every minute
    }
    
    client.messageCount++;
    
    if (client.messageCount > this.rateLimitConfig.maxMessagesPerMinute) {
      logger.warn(`Rate limit exceeded for client ${client.id}`, "SECURE_WS", {
        userId: client.userId,
        messageCount: client.messageCount,
        ip: client.ipAddress
      });
      return false;
    }
    
    return true;
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: SecureWSClient, message: SecureWSMessage) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: SecureWSClient, error: string) {
    this.sendToClient(client, {
      type: "error",
      data: { error, timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      messageId: this.generateMessageId()
    });
  }

  /**
   * Broadcast message to authenticated clients with specific subscription
   */
  broadcastToSubscribed(eventType: string, message: Omit<SecureWSMessage, 'messageId'>) {
    const messageWithId = {
      ...message,
      messageId: this.generateMessageId()
    };

    this.clients.forEach(client => {
      if (client.isAuthenticated && client.subscriptions.has(eventType)) {
        this.sendToClient(client, messageWithId);
      }
    });
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, message: Omit<SecureWSMessage, 'messageId'>) {
    const messageWithId = {
      ...message,
      messageId: this.generateMessageId()
    };

    this.clients.forEach(client => {
      if (client.isAuthenticated && client.userId === userId) {
        this.sendToClient(client, messageWithId);
      }
    });
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(client: SecureWSClient) {
    logger.info(`Client disconnected: ${client.id}`, "SECURE_WS", {
      userId: client.userId,
      authenticated: client.isAuthenticated
    });

    // Update IP connection count
    const count = this.ipConnections.get(client.ipAddress) || 1;
    if (count <= 1) {
      this.ipConnections.delete(client.ipAddress);
    } else {
      this.ipConnections.set(client.ipAddress, count - 1);
    }

    this.clients.delete(client.id);
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          logger.info(`Terminating inactive client: ${id}`, "SECURE_WS");
          client.ws.terminate();
          this.handleClientDisconnect(client);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 second heartbeat
  }

  /**
   * Start cleanup process for stale connections
   */
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleTimeout = 5 * 60 * 1000; // 5 minutes

      this.clients.forEach((client, id) => {
        if (now - client.lastActivity > staleTimeout) {
          logger.info(`Cleaning up stale client: ${id}`, "SECURE_WS");
          client.ws.terminate();
          this.handleClientDisconnect(client);
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    const crypto = require('crypto');
    return `sws_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get server statistics
   */
  getStats() {
    const authenticatedClients = Array.from(this.clients.values())
      .filter(client => client.isAuthenticated).length;

    return {
      totalClients: this.clients.size,
      authenticatedClients,
      uniqueIPs: this.ipConnections.size,
      rateLimitConfig: this.rateLimitConfig
    };
  }

  /**
   * Shutdown server
   */
  shutdown() {
    logger.info("Shutting down secure WebSocket server", "SECURE_WS");
    
    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Close all client connections
    this.clients.forEach(client => {
      client.ws.close(1000, "Server shutting down");
    });
    
    this.clients.clear();
    this.ipConnections.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

// Export singleton instance
export const secureWalmartWSServer = new SecureWalmartWebSocketServer();