/**
 * Secure WebSocket Server for Walmart Grocery Agent
 * Implements comprehensive security measures including authentication, validation, and rate limiting
 */

import { WebSocketServer, WebSocket } from "ws";
import { Server, IncomingMessage } from "http";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from 'uuid';
import { logger } from "../../utils/logger.js";
import { WS_SECURITY_CONFIG } from "../../config/websocket-security.config.js";
import { 
  authenticateWebSocket, 
  AuthenticatedWebSocket, 
  hasPermission, 
  updateActivity, 
  cleanupSession 
} from "../middleware/websocket-auth-secure.js";
import { 
  validateInboundMessage, 
  validateOutboundMessage,
  sanitizeMessageForLogging,
  InboundMessage,
  OutboundMessage 
} from "../validation/websocket-schemas.js";
import { wsRateLimiter, ViolationType } from "../services/WebSocketRateLimiter.js";

export interface SecureWSClient {
  id: string;
  correlationId: string;
  ws: AuthenticatedWebSocket;
  userId?: string;
  sessionId?: string;
  isAlive: boolean;
  subscriptions: Set<string>;
  messageCount: number;
  connectionTime: number;
  lastActivity: number;
  ipAddress?: string;
}

export class SecureWalmartWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, SecureWSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  // Connection tracking
  private totalConnections = 0;
  private totalMessages = 0;
  private rejectedConnections = 0;
  private rejectedMessages = 0;

  constructor() {
    super();
    this.setupEventHandlers();
    logger.info('SecureWalmartWebSocketServer initialized', 'SECURE_WS');
  }

  /**
   * Initialize secure WebSocket server with comprehensive security
   */
  async initialize(server: Server, path: string = "/ws/walmart"): Promise<void> {
    try {
      // Create WebSocket server with security-optimized configuration
      this.wss = new WebSocketServer({ 
        noServer: true,
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
        maxPayload: WS_SECURITY_CONFIG.MESSAGE.MAX_PAYLOAD_BYTES,
      });

      // Setup connection handler
      this.wss.on("connection", async (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
        await this.handleSecureConnection(ws, req);
      });

      // Start heartbeat mechanism
      this.startHeartbeat();

      // Start metrics collection
      this.startMetricsCollection();

      logger.info(`Secure WebSocket server initialized at ${path}`, "SECURE_WS", {
        maxPayload: WS_SECURITY_CONFIG.MESSAGE.MAX_PAYLOAD_BYTES,
        heartbeatInterval: WS_SECURITY_CONFIG.HEARTBEAT.INTERVAL_MS,
        maxConnections: WS_SECURITY_CONFIG.CONNECTION.MAX_TOTAL_CONNECTIONS,
      });
    } catch (error) {
      logger.error('Failed to initialize secure WebSocket server', 'SECURE_WS', { error });
      throw error;
    }
  }

  /**
   * Handle new secure WebSocket connection with full security checks
   */
  private async handleSecureConnection(ws: AuthenticatedWebSocket, req: IncomingMessage): Promise<void> {
    const correlationId = uuidv4();
    const clientId = this.generateSecureClientId();
    const ipAddress = this.getClientIP(req);

    try {
      // Check connection limits first
      const connectionCheck = wsRateLimiter.checkConnectionLimit(ipAddress, clientId);
      if (!connectionCheck.allowed) {
        this.rejectedConnections++;
        logger.warn('Connection rejected due to rate limiting', 'SECURE_WS', {
          correlationId,
          ipAddress,
          violationType: connectionCheck.violationType,
          retryAfter: connectionCheck.retryAfter,
        });
        
        ws.close(1008, `Connection limit exceeded. Try again in ${connectionCheck.retryAfter} seconds`);
        return;
      }

      // Authenticate the WebSocket connection
      const isAuthenticated = await authenticateWebSocket(ws, req);
      
      if (!isAuthenticated) {
        this.rejectedConnections++;
        wsRateLimiter.removeConnection(ipAddress, clientId);
        return; // Connection already closed in authenticateWebSocket
      }

      // Create secure client record
      const client: SecureWSClient = {
        id: clientId,
        correlationId,
        ws,
        userId: ws.userId,
        sessionId: ws.sessionId,
        isAlive: true,
        subscriptions: new Set(),
        messageCount: 0,
        connectionTime: Date.now(),
        lastActivity: Date.now(),
        ipAddress,
      };

      this.clients.set(clientId, client);
      this.totalConnections++;

      logger.info('Secure WebSocket client connected', 'SECURE_WS', {
        correlationId,
        clientId,
        userId: ws.userId,
        sessionId: ws.sessionId,
        isAuthenticated: ws.isAuthenticated,
        ipAddress,
        totalConnections: this.clients.size,
      });

      // Send secure welcome message
      await this.sendSecureWelcomeMessage(client);

      // Setup message handlers
      this.setupClientMessageHandlers(client);

      // Setup disconnect handlers
      this.setupClientDisconnectHandlers(client);

    } catch (error) {
      logger.error('Error handling secure connection', 'SECURE_WS', {
        correlationId,
        error,
        ipAddress,
      });

      wsRateLimiter.removeConnection(ipAddress, clientId);
      ws.close(1011, 'Connection setup error');
    }
  }

  /**
   * Send secure welcome message with client capabilities
   */
  private async sendSecureWelcomeMessage(client: SecureWSClient): Promise<void> {
    const welcomeMessage: OutboundMessage = {
      type: 'nlp_processing',
      data: {
        message: 'Connected to Secure Walmart Grocery Agent',
        clientId: client.id,
        features: [
          'nlp_processing',
          'product_search', 
          'cart_management',
          'price_alerts',
          'deal_notifications',
          'secure_messaging'
        ],
        security: {
          authenticated: client.ws.isAuthenticated,
          permissions: client.ws.permissions || [],
          sessionTimeout: WS_SECURITY_CONFIG.AUTH.TOKEN_EXPIRY_MS,
          rateLimits: {
            messagesPerMinute: WS_SECURITY_CONFIG.MESSAGE.MAX_MESSAGES_PER_MINUTE,
            burstAllowance: Math.floor(WS_SECURITY_CONFIG.MESSAGE.MAX_MESSAGES_PER_MINUTE * 0.5),
          },
        },
      },
      timestamp: new Date().toISOString(),
      sessionId: client.sessionId,
      userId: client.userId,
    };

    await this.sendToClient(client, welcomeMessage);
  }

  /**
   * Setup message handlers for a client
   */
  private setupClientMessageHandlers(client: SecureWSClient): void {
    client.ws.on("message", async (message: Buffer) => {
      await this.handleClientMessage(client, message);
    });

    client.ws.on("pong", () => {
      client.isAlive = true;
      updateActivity(client.ws);
    });
  }

  /**
   * Setup disconnect handlers for a client
   */
  private setupClientDisconnectHandlers(client: SecureWSClient): void {
    client.ws.on("close", () => {
      this.handleClientDisconnect(client, 'Connection closed');
    });

    client.ws.on("error", (error: any) => {
      logger.error('WebSocket error', 'SECURE_WS', {
        correlationId: client.correlationId,
        clientId: client.id,
        error,
      });
      this.handleClientDisconnect(client, 'Connection error');
    });
  }

  /**
   * Handle incoming client messages with comprehensive security
   */
  private async handleClientMessage(client: SecureWSClient, messageBuffer: Buffer): Promise<void> {
    const correlationId = uuidv4();
    
    try {
      // Check rate limiting first
      const rateLimitResult = wsRateLimiter.checkMessageRate(
        client.id, 
        client.ipAddress || 'unknown',
        client.userId
      );

      if (!rateLimitResult.allowed) {
        this.rejectedMessages++;
        
        logger.warn('Message rejected due to rate limiting', 'SECURE_WS', {
          correlationId,
          clientId: client.id,
          violationType: rateLimitResult.violationType,
          retryAfter: rateLimitResult.retryAfter,
        });

        await this.sendErrorToClient(client, {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded: ${rateLimitResult.violationType}`,
          details: {
            retryAfter: rateLimitResult.retryAfter,
            remainingTokens: rateLimitResult.remainingTokens,
          },
          recoverable: true,
        }, correlationId);

        // Close connection for persistent abuse
        if (rateLimitResult.violationType === ViolationType.PERSISTENT_ABUSE) {
          client.ws.close(1008, 'Rate limit abuse detected');
        }

        return;
      }

      // Parse message
      let rawMessage: any;
      try {
        rawMessage = JSON.parse(messageBuffer.toString());
      } catch (parseError) {
        logger.warn('Invalid JSON in message', 'SECURE_WS', {
          correlationId,
          clientId: client.id,
          parseError,
        });

        await this.sendErrorToClient(client, {
          code: 'INVALID_JSON',
          message: 'Invalid JSON format in message',
          recoverable: false,
        }, correlationId);
        
        return;
      }

      // Validate message schema
      const validationResult = validateInboundMessage(rawMessage);
      
      if (!validationResult.success) {
        logger.warn('Message validation failed', 'SECURE_WS', {
          correlationId,
          clientId: client.id,
          errors: validationResult.error?.details,
          sanitizedMessage: sanitizeMessageForLogging(rawMessage),
        });

        await this.sendErrorToClient(client, {
          code: 'VALIDATION_ERROR',
          message: 'Message validation failed',
          details: validationResult.error?.details,
          recoverable: false,
        }, correlationId);
        
        return;
      }

      const message = validationResult.data!;
      client.messageCount++;
      client.lastActivity = Date.now();
      this.totalMessages++;
      updateActivity(client.ws);

      logger.debug('Processing validated message', 'SECURE_WS', {
        correlationId,
        clientId: client.id,
        messageType: message.type,
        sanitizedMessage: sanitizeMessageForLogging(message),
      });

      // Route message to appropriate handler
      await this.routeMessage(client, message, correlationId);

    } catch (error) {
      logger.error('Error handling client message', 'SECURE_WS', {
        correlationId,
        clientId: client.id,
        error,
      });

      await this.sendErrorToClient(client, {
        code: 'PROCESSING_ERROR',
        message: 'Error processing message',
        recoverable: true,
      }, correlationId);
    }
  }

  /**
   * Route validated messages to appropriate handlers
   */
  private async routeMessage(
    client: SecureWSClient, 
    message: InboundMessage, 
    correlationId: string
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'auth':
          await this.handleAuthMessage(client, message, correlationId);
          break;
        
        case 'subscribe':
          await this.handleSubscriptionMessage(client, message, correlationId);
          break;
        
        case 'unsubscribe':
          await this.handleUnsubscriptionMessage(client, message, correlationId);
          break;
        
        case 'ping':
          await this.handlePingMessage(client, message, correlationId);
          break;
        
        case 'product_search':
          await this.handleProductSearchMessage(client, message, correlationId);
          break;
        
        case 'nlp_message':
          await this.handleNLPMessage(client, message, correlationId);
          break;
        
        case 'cart_operation':
          await this.handleCartOperationMessage(client, message, correlationId);
          break;
        
        default:
          logger.warn('Unknown message type', 'SECURE_WS', {
            correlationId,
            clientId: client.id,
            messageType: message.type,
          });

          await this.sendErrorToClient(client, {
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${message.type}`,
            recoverable: false,
          }, correlationId);
      }
    } catch (error) {
      logger.error('Error routing message', 'SECURE_WS', {
        correlationId,
        clientId: client.id,
        messageType: message.type,
        error,
      });

      await this.sendErrorToClient(client, {
        code: 'ROUTING_ERROR',
        message: 'Error routing message',
        recoverable: true,
      }, correlationId);
    }
  }

  /**
   * Handle authentication messages
   */
  private async handleAuthMessage(
    client: SecureWSClient, 
    message: any, 
    correlationId: string
  ): Promise<void> {
    // Re-authentication not needed if already authenticated
    if (client.ws.isAuthenticated) {
      return;
    }

    logger.info('Client authentication attempted', 'SECURE_WS', {
      correlationId,
      clientId: client.id,
      userId: message.data.userId,
    });
  }

  /**
   * Handle subscription messages
   */
  private async handleSubscriptionMessage(
    client: SecureWSClient, 
    message: any, 
    correlationId: string
  ): Promise<void> {
    if (!hasPermission(client.ws, 'read')) {
      await this.sendErrorToClient(client, {
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions for subscription',
        recoverable: false,
      }, correlationId);
      return;
    }

    const { events } = message.data;
    
    for (const event of events) {
      client.subscriptions.add(event);
    }

    logger.info('Client subscribed to events', 'SECURE_WS', {
      correlationId,
      clientId: client.id,
      events,
      totalSubscriptions: client.subscriptions.size,
    });
  }

  /**
   * Handle unsubscription messages
   */
  private async handleUnsubscriptionMessage(
    client: SecureWSClient, 
    message: any, 
    correlationId: string
  ): Promise<void> {
    const { events } = message.data;
    
    if (events) {
      for (const event of events) {
        client.subscriptions.delete(event);
      }
    } else {
      // Unsubscribe from all
      client.subscriptions.clear();
    }

    logger.info('Client unsubscribed from events', 'SECURE_WS', {
      correlationId,
      clientId: client.id,
      events: events || 'all',
      remainingSubscriptions: client.subscriptions.size,
    });
  }

  /**
   * Handle ping messages
   */
  private async handlePingMessage(
    client: SecureWSClient, 
    message: any, 
    correlationId: string
  ): Promise<void> {
    await this.sendToClient(client, {
      type: 'nlp_processing',
      data: { 
        message: 'pong',
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle product search messages
   */
  private async handleProductSearchMessage(
    client: SecureWSClient, 
    message: any, 
    correlationId: string
  ): Promise<void> {
    if (!hasPermission(client.ws, 'read')) {
      await this.sendErrorToClient(client, {
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions for product search',
        recoverable: false,
      }, correlationId);
      return;
    }

    // TODO: Integrate with actual product search service
    // For now, emit event for external handling
    this.emit('product_search', {
      client,
      message,
      correlationId,
    });
  }

  /**
   * Handle NLP messages
   */
  private async handleNLPMessage(
    client: SecureWSClient, 
    message: any, 
    correlationId: string
  ): Promise<void> {
    if (!hasPermission(client.ws, 'read')) {
      await this.sendErrorToClient(client, {
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions for NLP processing',
        recoverable: false,
      }, correlationId);
      return;
    }

    // TODO: Integrate with actual NLP service
    // For now, emit event for external handling
    this.emit('nlp_message', {
      client,
      message,
      correlationId,
    });
  }

  /**
   * Handle cart operation messages
   */
  private async handleCartOperationMessage(
    client: SecureWSClient, 
    message: any, 
    correlationId: string
  ): Promise<void> {
    if (!hasPermission(client.ws, 'write')) {
      await this.sendErrorToClient(client, {
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions for cart operations',
        recoverable: false,
      }, correlationId);
      return;
    }

    // TODO: Integrate with actual cart service
    // For now, emit event for external handling
    this.emit('cart_operation', {
      client,
      message,
      correlationId,
    });
  }

  /**
   * Send validated message to client
   */
  private async sendToClient(client: SecureWSClient, message: OutboundMessage): Promise<void> {
    try {
      if (client.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      // Validate outbound message
      const validation = validateOutboundMessage(message);
      if (!validation.success) {
        logger.error('Outbound message validation failed', 'SECURE_WS', {
          clientId: client.id,
          error: validation.error,
          message: sanitizeMessageForLogging(message),
        });
        return;
      }

      const messageString = JSON.stringify(validation.data);
      client.ws.send(messageString);

    } catch (error) {
      logger.error('Error sending message to client', 'SECURE_WS', {
        clientId: client.id,
        error,
      });
    }
  }

  /**
   * Send error message to client
   */
  private async sendErrorToClient(
    client: SecureWSClient, 
    error: {
      code: string;
      message: string;
      details?: any;
      recoverable?: boolean;
    },
    correlationId?: string
  ): Promise<void> {
    const errorMessage: OutboundMessage = {
      type: 'error',
      data: error,
      timestamp: new Date().toISOString(),
      correlationId,
    };

    await this.sendToClient(client, errorMessage);
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(client: SecureWSClient, reason: string): void {
    logger.info('Secure WebSocket client disconnected', 'SECURE_WS', {
      correlationId: client.correlationId,
      clientId: client.id,
      reason,
      sessionDuration: Date.now() - client.connectionTime,
      messageCount: client.messageCount,
    });

    // Remove from rate limiter
    if (client.ipAddress) {
      wsRateLimiter.removeConnection(client.ipAddress, client.id);
    }

    // Cleanup session
    cleanupSession(client.ws);

    // Remove client
    this.clients.delete(client.id);
    this.totalConnections--;
  }

  /**
   * Generate secure client ID
   */
  private generateSecureClientId(): string {
    return `sws_${Date.now()}_${uuidv4().replace(/-/g, '').substring(0, 8)}`;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: IncomingMessage): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      return Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0].trim();
    }
    
    const xRealIP = req.headers['x-real-ip'];
    if (xRealIP) {
      return Array.isArray(xRealIP) ? xRealIP[0] : xRealIP;
    }

    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      for (const [clientId, client] of this.clients.entries()) {
        if (!client.isAlive) {
          logger.info('Terminating inactive WebSocket client', 'SECURE_WS', {
            clientId,
            lastActivity: new Date(client.lastActivity).toISOString(),
          });
          
          client.ws.terminate();
          this.handleClientDisconnect(client, 'Heartbeat timeout');
          continue;
        }

        client.isAlive = false;
        client.ws.ping();
      }
    }, WS_SECURITY_CONFIG.HEARTBEAT.INTERVAL_MS);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const rateLimiterStats = wsRateLimiter.getStats();
      
      logger.info('WebSocket metrics', 'SECURE_WS_METRICS', {
        activeConnections: this.clients.size,
        totalConnections: this.totalConnections,
        rejectedConnections: this.rejectedConnections,
        totalMessages: this.totalMessages,
        rejectedMessages: this.rejectedMessages,
        rateLimiterStats,
      });
    }, 60000); // Every minute
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Broadcast message to subscribed clients
   */
  async broadcast(eventType: string, data: any): Promise<void> {
    const message: OutboundMessage = {
      type: 'nlp_processing',
      data: {
        message: eventType,
        ...data,
      },
      timestamp: new Date().toISOString(),
    };

    const promises = Array.from(this.clients.values())
      .filter(client => client.subscriptions.has(eventType))
      .map(client => this.sendToClient(client, message));

    await Promise.allSettled(promises);
  }

  /**
   * Setup event handlers for external integration
   */
  private setupEventHandlers(): void {
    this.on('error', (error) => {
      logger.error('SecureWalmartWebSocketServer error', 'SECURE_WS', { error });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    logger.info('Starting graceful WebSocket server shutdown', 'SECURE_WS');

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close all client connections
    const closePromises = Array.from(this.clients.values()).map(client => {
      return new Promise<void>((resolve) => {
        client.ws.close(1001, 'Server shutdown');
        setTimeout(resolve, 1000); // Give time for graceful close
      });
    });

    await Promise.allSettled(closePromises);

    // Close server
    if (this.wss) {
      this.wss.close();
    }

    // Shutdown rate limiter
    wsRateLimiter.shutdown();

    logger.info('WebSocket server shutdown complete', 'SECURE_WS');
  }
}

// Export singleton instance
export const secureWalmartWSServer = new SecureWalmartWebSocketServer();