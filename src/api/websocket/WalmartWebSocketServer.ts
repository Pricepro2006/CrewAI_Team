/**
 * WebSocket Server for Walmart Grocery Agent
 * Provides real-time updates for NLP processing, cart changes, and price updates
 */

import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";

export interface WSMessage {
  type: "nlp_processing" | "nlp_result" | "cart_update" | "price_update" | "product_match" | "error";
  data: any;
  timestamp: string;
  sessionId?: string;
  userId?: string;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  isAlive: boolean;
}

export class WalmartWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize WebSocket server
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
      }
    });

    this?.wss?.on("connection", (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat mechanism
    this.startHeartbeat();

    logger.info(`WebSocket server initialized at ${path}`, "WS_SERVER");
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any) {
    const clientId = this.generateClientId();
    const client: WSClient = {
      id: clientId,
      ws,
      isAlive: true
    };

    this?.clients?.set(clientId, client);
    logger.info(`New WebSocket client connected: ${clientId}`, "WS_SERVER");

    // Send welcome message
    this.sendToClient(client, {
      type: "nlp_processing",
      data: { 
        message: "Connected to Walmart Grocery Agent",
        clientId,
        features: ["nlp", "cart_sync", "price_updates"]
      },
      timestamp: new Date().toISOString()
    });

    // Handle client messages
    ws.on("message", (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleClientMessage(client, data);
      } catch (error) {
        logger.error(`Invalid message from client ${clientId}: ${error}`, "WS_SERVER");
        this.sendError(client, "Invalid message format");
      }
    });

    // Handle pong for heartbeat
    ws.on("pong", () => {
      client.isAlive = true;
    });

    // Handle client disconnect
    ws.on("close", () => {
      logger.info(`Client disconnected: ${clientId}`, "WS_SERVER");
      this?.clients?.delete(clientId);
    });

    ws.on("error", (error: any) => {
      logger.error(`WebSocket error for client ${clientId}: ${error}`, "WS_SERVER");
      this?.clients?.delete(clientId);
    });
  }

  /**
   * Handle messages from client
   */
  private handleClientMessage(client: WSClient, message: any) {
    switch (message.type) {
      case "auth":
        client.userId = message.userId || "";
        client.sessionId = message.sessionId;
        logger.info(`Client ${client.id} authenticated as user ${client.userId}`, "WS_SERVER");
        break;

      case "subscribe":
        // Handle subscription to specific events
        this.handleSubscription(client, message.events);
        break;

      case "ping":
        this.sendToClient(client, { 
          type: "nlp_processing", 
          data: { pong: true },
          timestamp: new Date().toISOString()
        });
        break;

      default:
        logger.warn(`Unknown message type from client ${client.id}: ${message.type}`, "WS_SERVER");
    }
  }

  /**
   * Handle event subscriptions
   */
  private handleSubscription(client: WSClient, events: string[]) {
    logger.info(`Client ${client.id} subscribed to: ${events.join(", ")}`, "WS_SERVER");
    // Store subscription preferences if needed
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WSClient, message: WSMessage) {
    if (client?.ws?.readyState === WebSocket.OPEN) {
      client?.ws?.send(JSON.stringify(message));
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
   * Broadcast message to all connected clients
   */
  broadcast(message: WSMessage) {
    this?.clients?.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, message: WSMessage) {
    this?.clients?.forEach(client => {
      if (client.userId === userId) {
        this.sendToClient(client, message);
      }
    });
  }

  /**
   * Send message to specific session
   */
  sendToSession(sessionId: string, message: WSMessage) {
    this?.clients?.forEach(client => {
      if (client.sessionId === sessionId) {
        this.sendToClient(client, message);
      }
    });
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
        count: products?.length || 0
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
    this.broadcast({
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
      this?.clients?.forEach((client, id) => {
        if (!client.isAlive) {
          logger.info(`Terminating inactive client: ${id}`, "WS_SERVER");
          client?.ws?.terminate();
          this?.clients?.delete(id);
          return;
        }

        client.isAlive = false;
        client?.ws?.ping();
      });
    }, 30000); // 30 second heartbeat
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
   * Handle upgrade for WebSocket connections
   */
  handleUpgrade(request: any, socket: any, head: Buffer, callback?: (ws: WebSocket) => void): void {
    logger.info('Handling WebSocket upgrade request', 'WS_SERVER', { 
      url: request.url,
      origin: request.headers.origin 
    });

    if (!this.wss) {
      logger.error('WebSocket server not initialized', 'WS_SERVER');
      socket.destroy();
      return;
    }

    try {
      this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        logger.info('WebSocket upgrade successful', 'WS_SERVER');
        this.wss?.emit('connection', ws, request);
        
        if (callback) {
          callback(ws);
        }
      });
    } catch (error) {
      logger.error('WebSocket upgrade failed', 'WS_SERVER', { error });
      socket.destroy();
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this?.clients?.size;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    logger.info("Shutting down WebSocket server", "WS_SERVER");
    
    this.stopHeartbeat();
    
    // Close all client connections
    this?.clients?.forEach(client => {
      client?.ws?.close(1000, "Server shutting down");
    });
    
    this?.clients?.clear();
    
    if (this.wss) {
      this?.wss?.close();
      this.wss = null;
    }
  }
}

// Export singleton instance
export const walmartWSServer = new WalmartWebSocketServer();