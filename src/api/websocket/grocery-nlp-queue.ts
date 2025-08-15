/**
 * WebSocket Handler for Grocery NLP Queue Real-time Updates
 * Provides real-time queue status, metrics, and request updates
 */

import { WebSocket } from "ws";
import { getGroceryNLPQueue } from "../services/GroceryNLPQueue.js";
import { logger } from "../../utils/logger.js";
import type { WebSocketEvent } from "../types/grocery-nlp.types.js";

interface GroceryNLPWebSocketClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  lastActivity: number;
  metadata?: Record<string, any>;
}

export class GroceryNLPQueueWebSocketManager {
  private static instance: GroceryNLPQueueWebSocketManager;
  private clients = new Map<string, GroceryNLPWebSocketClient>();
  private queue = getGroceryNLPQueue();
  private heartbeatInterval: NodeJS.Timeout;
  private metricsInterval: NodeJS.Timeout;

  private constructor() {
    this.setupQueueListeners();
    this.startHeartbeat();
    this.startMetricsUpdates();
  }

  static getInstance(): GroceryNLPQueueWebSocketManager {
    if (!GroceryNLPQueueWebSocketManager.instance) {
      GroceryNLPQueueWebSocketManager.instance = new GroceryNLPQueueWebSocketManager();
    }
    return GroceryNLPQueueWebSocketManager.instance;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    const client: GroceryNLPWebSocketClient = {
      ws,
      id: clientId,
      subscriptions: new Set(),
      lastActivity: Date.now(),
      metadata: {
        userAgent: request.headers['user-agent'],
        ip: request?.connection?.remoteAddress,
        connectedAt: Date.now()
      }
    };

    this?.clients?.set(clientId, client);

    logger.info("Grocery NLP WebSocket client connected", "GROCERY_NLP_WS", {
      clientId,
      clientCount: this?.clients?.size,
      userAgent: client.metadata?.userAgent
    });

    // Send initial status
    this.sendToClient(client, {
      type: "queue_update",
      data: {
        queueSize: this?.queue?.getStatus().queueSize,
        activeRequests: this?.queue?.getStatus().activeRequests,
        estimatedWaitTime: this?.queue?.getStatus().estimatedWaitTime
      }
    });

    // Set up message handlers
    ws.on("message", (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        logger.error("Invalid WebSocket message", "GROCERY_NLP_WS", {
          clientId,
          error,
          data: data.toString()
        });
        
        this.sendError(client, "INVALID_MESSAGE", "Invalid JSON message");
      }
    });

    ws.on("close", (code, reason) => {
      this.handleDisconnection(clientId, code, reason?.toString());
    });

    ws.on("error", (error: any) => {
      logger.error("WebSocket error", "GROCERY_NLP_WS", {
        clientId,
        error
      });
    });

    // Send welcome message
    this.sendToClient(client, {
      type: "connection_established",
      data: {
        clientId,
        timestamp: Date.now(),
        availableSubscriptions: ["queue_updates", "request_status", "metrics_updates"]
      }
    } as any);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string, code: number, reason?: string): void {
    const client = this?.clients?.get(clientId);
    if (client) {
      this?.clients?.delete(clientId);
      
      logger.info("Grocery NLP WebSocket client disconnected", "GROCERY_NLP_WS", {
        clientId,
        code,
        reason,
        clientCount: this?.clients?.size,
        sessionDuration: Date.now() - (client.metadata?.connectedAt || 0)
      });
    }
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(client: GroceryNLPWebSocketClient, message: any): void {
    client.lastActivity = Date.now();

    switch (message.type) {
      case "subscribe":
        this.handleSubscription(client, message.subscriptions || []);
        break;
        
      case "unsubscribe":
        this.handleUnsubscription(client, message.subscriptions || []);
        break;
        
      case "ping":
        this.sendToClient(client, {
          type: "pong",
          data: { timestamp: Date.now() }
        } as any);
        break;
        
      case "get_status":
        const status = this?.queue?.getStatus();
        this.sendToClient(client, {
          type: "queue_update",
          data: {
            queueSize: status.queueSize,
            activeRequests: status.activeRequests,
            estimatedWaitTime: status.estimatedWaitTime
          }
        });
        break;
        
      case "get_metrics":
        const metrics = this?.queue?.getMetrics();
        this.sendToClient(client, {
          type: "metrics_update",
          data: metrics
        });
        break;
        
      default:
        this.sendError(client, "UNKNOWN_MESSAGE_TYPE", `Unknown message type: ${message.type}`);
        break;
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscription(client: GroceryNLPWebSocketClient, subscriptions: string[]): void {
    const validSubscriptions = ["queue_updates", "request_status", "metrics_updates"];
    const addedSubscriptions: string[] = [];

    for (const subscription of subscriptions) {
      if (validSubscriptions.includes(subscription)) {
        client?.subscriptions?.add(subscription);
        addedSubscriptions.push(subscription);
      }
    }

    logger.debug("Client subscriptions updated", "GROCERY_NLP_WS", {
      clientId: client.id,
      addedSubscriptions,
      totalSubscriptions: Array.from(client.subscriptions)
    });

    this.sendToClient(client, {
      type: "subscription_updated",
      data: {
        added: addedSubscriptions,
        current: Array.from(client.subscriptions)
      }
    } as any);
  }

  /**
   * Handle unsubscription requests
   */
  private handleUnsubscription(client: GroceryNLPWebSocketClient, subscriptions: string[]): void {
    const removedSubscriptions: string[] = [];

    for (const subscription of subscriptions) {
      if (client?.subscriptions?.has(subscription)) {
        client?.subscriptions?.delete(subscription);
        removedSubscriptions.push(subscription);
      }
    }

    logger.debug("Client unsubscribed", "GROCERY_NLP_WS", {
      clientId: client.id,
      removedSubscriptions,
      remainingSubscriptions: Array.from(client.subscriptions)
    });

    this.sendToClient(client, {
      type: "subscription_updated",
      data: {
        removed: removedSubscriptions,
        current: Array.from(client.subscriptions)
      }
    } as any);
  }

  /**
   * Set up queue event listeners
   */
  private setupQueueListeners(): void {
    this?.queue?.on("queueUpdate", (event: WebSocketEvent) => {
      this.broadcastToSubscribers("queue_updates", event);
    });

    this?.queue?.on("requestStatus", (event: WebSocketEvent) => {
      this.broadcastToSubscribers("request_status", event);
    });

    this?.queue?.on("metricsUpdate", (event: WebSocketEvent) => {
      this.broadcastToSubscribers("metrics_updates", event);
    });
  }

  /**
   * Broadcast message to all clients subscribed to a topic
   */
  private broadcastToSubscribers(subscription: string, event: WebSocketEvent): void {
    let sentCount = 0;
    
    for (const client of this?.clients?.values()) {
      if (client?.subscriptions?.has(subscription)) {
        this.sendToClient(client, event);
        sentCount++;
      }
    }

    if (sentCount > 0) {
      logger.debug("Event broadcast", "GROCERY_NLP_WS", {
        subscription,
        eventType: event.type,
        clientCount: sentCount
      });
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: GroceryNLPWebSocketClient, message: any): void {
    if (client?.ws?.readyState === WebSocket.OPEN) {
      try {
        client?.ws?.send(JSON.stringify({
          ...message,
          timestamp: Date.now(),
          clientId: client.id
        }));
      } catch (error) {
        logger.error("Failed to send WebSocket message", "GROCERY_NLP_WS", {
          clientId: client.id,
          error
        });
        
        // Remove client if sending fails
        this?.clients?.delete(client.id);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: GroceryNLPWebSocketClient, code: string, message: string): void {
    this.sendToClient(client, {
      type: "error",
      data: {
        code,
        message,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Start heartbeat to clean up dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds timeout
      const toRemove: string[] = [];

      for (const [clientId, client] of this.clients) {
        if (client?.ws?.readyState !== WebSocket.OPEN) {
          toRemove.push(clientId);
        } else if (now - client.lastActivity > timeout) {
          // Ping inactive clients
          try {
            client?.ws?.ping();
          } catch (error) {
            toRemove.push(clientId);
          }
        }
      }

      // Remove dead connections
      for (const clientId of toRemove) {
        this?.clients?.delete(clientId);
        logger.debug("Removed inactive WebSocket client", "GROCERY_NLP_WS", {
          clientId
        });
      }
    }, 30000); // Run every 30 seconds
  }

  /**
   * Start periodic metrics updates
   */
  private startMetricsUpdates(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this?.queue?.getMetrics();
      
      this.broadcastToSubscribers("metrics_updates", {
        type: "metrics_update",
        data: metrics
      });
    }, 10000); // Send metrics every 10 seconds
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `nlp-ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this?.clients?.size;
  }

  /**
   * Get client information
   */
  getClientInfo(): Array<{
    id: string;
    subscriptions: string[];
    lastActivity: number;
    metadata?: Record<string, any>;
  }> {
    return Array.from(this?.clients?.values()).map(client => ({
      id: client.id,
      subscriptions: Array.from(client.subscriptions),
      lastActivity: client.lastActivity,
      metadata: client.metadata
    }));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Close all client connections
    for (const client of this?.clients?.values()) {
      if (client?.ws?.readyState === WebSocket.OPEN) {
        client?.ws?.close(1001, "Server shutting down");
      }
    }
    
    this?.clients?.clear();
  }
}

// Export singleton instance getter
export const getGroceryNLPQueueWebSocketManager = () => GroceryNLPQueueWebSocketManager.getInstance();