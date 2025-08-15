import { EventEmitter } from "events";
import type { WebSocket } from "ws";
import { z } from "zod";
// import _ from "lodash"; // Commented out - types not available
import type { AuthenticatedWebSocket } from "../middleware/websocketAuth.js";
import { logger } from "../../utils/logger.js";
import {
  trackWebSocketConnection,
  trackWebSocketMessage,
} from "../middleware/monitoring.js";
import { metricsCollector } from "../../monitoring/MetricsCollector.js";
import { performanceMonitor } from "../../monitoring/PerformanceMonitor.js";

// Message types for WebSocket communication
export const WebSocketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("agent.status"),
    agentId: z.string(),
    status: z.enum(["idle", "busy", "error", "terminated"]),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("agent.task"),
    agentId: z.string(),
    taskId: z.string(),
    status: z.enum(["started", "completed", "failed"]),
    result: z.any().optional(),
    error: z.string().optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("plan.update"),
    planId: z.string(),
    status: z.enum([
      "created",
      "executing",
      "completed",
      "failed",
      "replanned",
    ]),
    progress: z
      .object({
        completed: z.number(),
        total: z.number(),
        currentStep: z.string().optional(),
      })
      .optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("chat.message"),
    conversationId: z.string(),
    message: z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
      metadata: z.any().optional(),
    }),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("task.update"),
    taskId: z.string(),
    status: z.enum(["queued", "executing", "completed", "failed"]),
    progress: z.number().min(0).max(100).optional(),
    result: z.any().optional(),
    error: z.string().optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("rag.operation"),
    operation: z.enum(["indexing", "searching", "embedding"]),
    status: z.enum(["started", "completed", "failed"]),
    details: z
      .object({
        documentCount: z.number().optional(),
        chunkCount: z.number().optional(),
        duration: z.number().optional(),
        error: z.string().optional(),
      })
      .optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("system.health"),
    services: z.record(
      z.enum([
        "healthy",
        "degraded",
        "down",
        "connected",
        "disconnected",
        "error",
        "timeout",
      ]),
    ),
    metrics: z
      .object({
        cpu: z.number().optional(),
        memory: z.number().optional(),
        activeAgents: z.number().optional(),
        queueLength: z.number().optional(),
        responseTime: z.number().optional(),
        uptime: z.number().optional(),
      })
      .optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("system.metrics"),
    metrics: z.object({
      memoryUsage: z.object({
        used: z.number(),
        total: z.number(),
        percentage: z.number(),
      }),
      cpuUsage: z.number().optional(),
      activeConnections: z.number(),
      requestsPerMinute: z.number().optional(),
      responseTime: z.number(),
    }),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("agent.performance"),
    agentId: z.string(),
    metrics: z.object({
      tasksCompleted: z.number(),
      averageResponseTime: z.number(),
      errorRate: z.number(),
      lastActivity: z.date(),
    }),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.analyzed"),
    emailId: z.string(),
    workflow: z.string(),
    priority: z.enum(["critical", "high", "medium", "low"]),
    actionSummary: z.string(),
    confidence: z.number(),
    slaStatus: z.enum(["on-track", "at-risk", "overdue"]),
    state: z.string(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.state_changed"),
    emailId: z.string(),
    oldState: z.string(),
    newState: z.string(),
    changedBy: z.string().optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.bulk_update"),
    action: z.string(),
    emailIds: z.array(z.string()),
    results: z.object({
      successful: z.number(),
      failed: z.number(),
      total: z.number(),
    }),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.sla_alert"),
    emailId: z.string(),
    workflow: z.string(),
    priority: z.enum(["critical", "high", "medium", "low"]),
    slaStatus: z.enum(["at-risk", "overdue"]),
    timeRemaining: z.number().optional(),
    overdueDuration: z.number().optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.analytics_updated"),
    totalEmails: z.number(),
    workflowDistribution: z.record(z.number()),
    slaCompliance: z.record(z.number()),
    averageProcessingTime: z.number(),
    timestamp: z.date(),
  }),
  // Enhanced table data events (Agent 11)
  z.object({
    type: z.literal("email.table_data_updated"),
    rowCount: z.number(),
    filters: z.any().optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.stats_updated"),
    stats: z.object({
      total: z.number(),
      critical: z.number(),
      inProgress: z.number(),
      completed: z.number(),
    }),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.batch_created"),
    batchId: z.string(),
    successCount: z.number(),
    errorCount: z.number(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.batch_status_updated"),
    emailIds: z.array(z.string()),
    successCount: z.number(),
    errorCount: z.number(),
    changedBy: z.string(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("email.batch_deleted"),
    emailIds: z.array(z.string()),
    successCount: z.number(),
    errorCount: z.number(),
    softDelete: z.boolean(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("system.performance_warning"),
    component: z.string(),
    metric: z.string(),
    value: z.number(),
    threshold: z.number(),
    severity: z.enum(["warning", "critical"]),
    timestamp: z.date(),
  }),
  // Walmart-specific message types
  z.object({
    type: z.literal("walmart.price_update"),
    productId: z.string(),
    currentPrice: z.number(),
    previousPrice: z.number(),
    percentChange: z.number(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("walmart.stock_update"),
    productId: z.string(),
    inStock: z.boolean(),
    quantity: z.number().optional(),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("walmart.deal_alert"),
    dealId: z.string(),
    dealDetails: z.any(),
    affectedProducts: z.array(z.string()),
    timestamp: z.date(),
  }),
  z.object({
    type: z.literal("walmart.cart_sync"),
    cartData: z.any(),
    sourceClientId: z.string(),
    timestamp: z.date(),
    userId: z.string(),
  }),
  z.object({
    type: z.literal("walmart.recommendation"),
    recommendations: z.array(z.any()),
    preferences: z.any(),
    timestamp: z.date(),
    userId: z.string(),
  }),
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

export class WebSocketService extends EventEmitter {
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();
  private healthInterval: NodeJS.Timeout | null = null;
  private memoryCleanupInterval: NodeJS.Timeout | null = null;
  private performanceMonitorInterval: NodeJS.Timeout | null = null;

  // Authentication tracking
  private authenticatedClients: Map<string, AuthenticatedWebSocket> = new Map();
  private clientPermissions: Map<string, Set<string>> = new Map();

  // Enhanced performance features (Agent 11 - 2025 Best Practices)
  private messageQueue: Map<string, WebSocketMessage[]> = new Map();
  private throttledBroadcasts: Map<
    string,
    (message: WebSocketMessage) => void
  > = new Map();
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private performanceMetrics = {
    messagesSent: 0,
    messagesDropped: 0,
    averageResponseTime: 0,
    connectionErrors: 0,
    lastCleanup: Date.now(),
  };
  private readonly MAX_QUEUE_SIZE = 100; // Prevent memory leaks
  private readonly MAX_MESSAGE_HISTORY = 50; // Limit message history per client
  private readonly MAX_CLIENTS = 10000; // Prevent unbounded growth
  private readonly MAX_SUBSCRIPTIONS_PER_CLIENT = 100; // Limit subscriptions
  private connectionHealthChecks: Map<string, NodeJS.Timeout> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private clientCleanupHandlers: Map<string, () => void> = new Map();

  constructor() {
    super();
    this.setMaxListeners(0); // No limit on listeners

    // Initialize throttled broadcast functions (Agent 11 - 2025 Performance)
    this.setupThrottledBroadcasts();

    // Start memory cleanup routine
    this.startMemoryCleanup();

    // Initialize performance monitoring
    this.startPerformanceMonitoring();
  }

  /**
   * Register a WebSocket client
   */
  registerClient(clientId: string, ws: AuthenticatedWebSocket): void {
    // Check client limit to prevent unbounded growth
    if (this?.clients?.size >= this.MAX_CLIENTS && !this?.clients?.has(clientId)) {
      ws.close(1008, "Server at capacity");
      return;
    }

    if (!this?.clients?.has(clientId)) {
      this?.clients?.set(clientId, new Set());
    }
    this?.clients?.get(clientId)!.add(ws);

    // Track authenticated clients
    if (ws.isAuthenticated) {
      this?.authenticatedClients?.set(clientId, ws);

      // Store client permissions
      if (ws.permissions) {
        this?.clientPermissions?.set(clientId, new Set(ws.permissions));
      }

      logger.info("Authenticated WebSocket client registered", "WS_SERVICE", {
        clientId,
        userId: ws.userId,
        role: ws.userRole,
      });
    }

    // Create cleanup handler to prevent memory leaks
    const cleanupHandler = () => {
      this.unregisterClient(clientId, ws);
    };

    // Store cleanup handler for later removal
    this?.clientCleanupHandlers?.set(clientId, cleanupHandler);

    // Clean up on disconnect
    ws.once("close", cleanupHandler);

    // Handle errors to prevent uncaught exceptions
    ws.on("error", (error: any) => {
      logger.error(
        `WebSocket error for client ${clientId}: ${error.message}`,
        "WS_SERVICE",
      );
      this?.performanceMetrics?.connectionErrors++;
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string, ws: AuthenticatedWebSocket): void {
    const clientSockets = this?.clients?.get(clientId);
    if (clientSockets) {
      clientSockets.delete(ws);
      if (clientSockets.size === 0) {
        // Complete cleanup to prevent memory leaks
        this.cleanupClient(clientId);

        if (ws.isAuthenticated) {
          logger.info(
            "Authenticated WebSocket client unregistered",
            "WS_SERVICE",
            {
              clientId,
              userId: ws.userId,
            },
          );
        }
      }
    }

    // Remove all event listeners to prevent memory leaks
    ws.removeAllListeners();

    // Remove cleanup handler reference
    this?.clientCleanupHandlers?.delete(clientId);
  }

  /**
   * Subscribe a client to specific message types
   */
  subscribe(clientId: string, types: string[]): void {
    if (!this?.subscriptions?.has(clientId)) {
      this?.subscriptions?.set(clientId, new Set());
    }
    const clientSubs = this?.subscriptions?.get(clientId)!;

    // Limit subscriptions per client to prevent memory issues
    types.forEach((type: any) => {
      if (clientSubs.size < this.MAX_SUBSCRIPTIONS_PER_CLIENT) {
        clientSubs.add(type);
      } else {
        logger.warn(
          `Client ${clientId} reached subscription limit`,
          "WS_SERVICE",
        );
      }
    });
  }

  /**
   * Unsubscribe a client from specific message types
   */
  unsubscribe(clientId: string, types: string[]): void {
    const clientSubs = this?.subscriptions?.get(clientId);
    if (clientSubs) {
      types.forEach((type: any) => clientSubs.delete(type));
    }
  }

  /**
   * Broadcast a message to all subscribed clients
   */
  broadcast(message: WebSocketMessage, requiredPermission?: string): void {
    const messageStr = JSON.stringify(message);

    this?.clients?.forEach((sockets, clientId) => {
      const clientSubs = this?.subscriptions?.get(clientId);

      // Check if client is subscribed to this message type
      if (clientSubs && (clientSubs.has(message.type) || clientSubs.has("*"))) {
        // Check permissions if required
        if (requiredPermission) {
          const permissions = this?.clientPermissions?.get(clientId);
          if (!permissions || !permissions.has(requiredPermission)) {
            return; // Skip this client if they don't have required permission
          }
        }

        sockets.forEach((ws: any) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(messageStr);
            this?.performanceMetrics?.messagesSent++;
          }
        });
      }
    });

    // Also emit as an event for internal listeners
    this.emit(message.type, message);
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): void {
    const sockets = this?.clients?.get(clientId);
    if (sockets) {
      const messageStr = JSON.stringify(message);
      sockets.forEach((ws: any) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  /**
   * Send a message to a specific user (alias for sendToClient for backward compatibility)
   */
  sendToUser(userId: string, message: WebSocketMessage): void {
    this.sendToClient(userId, message);
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this?.clients?.size;
  }

  /**
   * Get client subscription info
   */
  getClientSubscriptions(clientId: string): string[] {
    const subs = this?.subscriptions?.get(clientId);
    return subs ? Array.from(subs) : [];
  }

  /**
   * Check if a client has a specific permission
   */
  hasPermission(clientId: string, permission: string): boolean {
    const permissions = this?.clientPermissions?.get(clientId);
    return permissions ? permissions.has(permission) : false;
  }

  /**
   * Get authenticated client info
   */
  getAuthenticatedClient(clientId: string): AuthenticatedWebSocket | undefined {
    return this?.authenticatedClients?.get(clientId);
  }

  /**
   * Check if client is authenticated
   */
  isClientAuthenticated(clientId: string): boolean {
    const client = this?.authenticatedClients?.get(clientId);
    return client ? client.isAuthenticated === true : false;
  }

  /**
   * Force disconnect a client
   */
  forceDisconnectClient(clientId: string): void {
    const sockets = this?.clients?.get(clientId);
    if (sockets) {
      sockets.forEach((ws: any) => {
        ws.close(1008, "Forced disconnect");
      });
    }

    // Cleanup will happen in unregisterClient
    logger.info(`Force disconnected client: ${clientId}`, "WS_SERVICE");
  }

  // Enhanced Performance Methods (Agent 11 - 2025 Best Practices)

  /**
   * Custom throttle implementation to replace lodash
   */
  private createThrottle(
    fn: (message: WebSocketMessage) => void,
    delay: number,
  ): (message: WebSocketMessage) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastMessage: WebSocketMessage | null = null;

    return (message: WebSocketMessage) => {
      lastMessage = message;

      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (lastMessage) {
            fn(lastMessage);
          }
          timeoutId = null;
          lastMessage = null;
        }, delay);
      }
    };
  }

  /**
   * Setup throttled broadcast functions for high-frequency updates
   */
  private setupThrottledBroadcasts(): void {
    // Table data updates - throttled to 200ms (researched best practice)
    this?.throttledBroadcasts?.set(
      "table_data",
      this.createThrottle((message: WebSocketMessage) => {
        this.broadcast(message);
      }, 200),
    );

    // Stats updates - throttled to 500ms for dashboard widgets
    this?.throttledBroadcasts?.set(
      "stats",
      this.createThrottle((message: WebSocketMessage) => {
        this.broadcast(message);
      }, 500),
    );

    // Performance metrics - throttled to 1000ms
    this?.throttledBroadcasts?.set(
      "performance",
      this.createThrottle((message: WebSocketMessage) => {
        this.broadcast(message);
      }, 1000),
    );
  }

  /**
   * Enhanced broadcast with throttling support for high-frequency updates
   */
  private broadcastThrottled(
    messageType: string,
    message: WebSocketMessage,
  ): void {
    const throttledFunc = this?.throttledBroadcasts?.get(messageType);
    if (throttledFunc) {
      throttledFunc(message);
    } else {
      this.broadcast(message);
    }
  }

  /**
   * Memory cleanup routine to prevent memory leaks
   */
  private startMemoryCleanup(): void {
    this.memoryCleanupInterval = setInterval(() => {
      try {
        // Clean up message queues that exceed max size
        this?.messageQueue?.forEach((queue, clientId) => {
          if (queue?.length || 0 > this.MAX_MESSAGE_HISTORY) {
            this?.messageQueue?.set(
              clientId,
              queue.slice(-this.MAX_MESSAGE_HISTORY),
            );
          }
        });

        // Clean up disconnected clients
        this?.clients?.forEach((sockets, clientId) => {
          const activeSockets = Array.from(sockets).filter(
            (ws: any) => ws.readyState === ws.OPEN,
          );
          if (activeSockets?.length || 0 === 0) {
            this.cleanupClient(clientId);
          } else if (activeSockets?.length || 0 !== sockets.size) {
            // Update client with only active sockets
            this?.clients?.set(clientId, new Set(activeSockets));
          }
        });

        // Clean up orphaned data structures
        this.cleanupOrphanedData();

        this?.performanceMetrics?.lastCleanup = Date.now();

        // Log memory usage for monitoring
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > memUsage.heapTotal * 0.9) {
          logger.warn("High memory usage detected", "WS_SERVICE", {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
            clients: this?.clients?.size,
          });
        }
      } catch (error) {
        logger.error(`Memory cleanup error: ${error}`, "WS_SERVICE");
      }
    }, 30000); // Clean up every 30 seconds
  }

  /**
   * Start performance monitoring with alerts
   */
  private startPerformanceMonitoring(): void {
    this.performanceMonitorInterval = setInterval(() => {
      try {
        const stats = this.getConnectionStats();

        // Check for performance issues
        if (stats.totalConnections > 1000) {
          this.broadcastPerformanceWarning(
            "websocket",
            "connections",
            stats.totalConnections,
            1000,
            "warning",
          );
        }

        if (this?.performanceMetrics?.connectionErrors > 10) {
          this.broadcastPerformanceWarning(
            "websocket",
            "connection_errors",
            this?.performanceMetrics?.connectionErrors,
            10,
            "critical",
          );
          this?.performanceMetrics?.connectionErrors = 0; // Reset after alert
        }

        // Update response time metrics
        this?.performanceMetrics?.averageResponseTime =
          this.calculateAverageResponseTime();

        // Force garbage collection if available (requires --expose-gc flag)
        if (global.gc && this?.clients?.size === 0) {
          global.gc();
        }
      } catch (error) {
        logger.error(`Performance monitoring error: ${error}`, "WS_SERVICE");
      }
    }, 60000); // Monitor every minute
  }

  /**
   * Clean up client data completely
   */
  private cleanupClient(clientId: string): void {
    // Remove from all data structures
    this?.clients?.delete(clientId);
    this?.subscriptions?.delete(clientId);
    this?.authenticatedClients?.delete(clientId);
    this?.clientPermissions?.delete(clientId);
    this?.messageQueue?.delete(clientId);
    this?.retryAttempts?.delete(clientId);
    this?.clientCleanupHandlers?.delete(clientId);

    // Clear health check timeout
    const healthCheck = this?.connectionHealthChecks?.get(clientId);
    if (healthCheck) {
      clearTimeout(healthCheck);
      this?.connectionHealthChecks?.delete(clientId);
    }

    // Clear any throttle timers associated with this client
    const throttleTimer = this?.throttleTimers?.get(clientId);
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      this?.throttleTimers?.delete(clientId);
    }
  }

  /**
   * Clean up orphaned data structures
   */
  private cleanupOrphanedData(): void {
    // Clean up authenticated clients that don't have active connections
    const clientIds = new Set(this?.clients?.keys());

    this?.authenticatedClients?.forEach((_, clientId) => {
      if (!clientIds.has(clientId)) {
        this?.authenticatedClients?.delete(clientId);
      }
    });

    this?.clientPermissions?.forEach((_, clientId) => {
      if (!clientIds.has(clientId)) {
        this?.clientPermissions?.delete(clientId);
      }
    });

    this?.subscriptions?.forEach((_, clientId) => {
      if (!clientIds.has(clientId)) {
        this?.subscriptions?.delete(clientId);
      }
    });

    this?.messageQueue?.forEach((_, clientId) => {
      if (!clientIds.has(clientId)) {
        this?.messageQueue?.delete(clientId);
      }
    });

    this?.retryAttempts?.forEach((_, clientId) => {
      if (!clientIds.has(clientId)) {
        this?.retryAttempts?.delete(clientId);
      }
    });
  }

  /**
   * Calculate average response time across connections
   */
  private calculateAverageResponseTime(): number {
    // Simple implementation - could be enhanced with actual timing measurements
    const baseTime = 10; // Base WebSocket response time in ms
    const connectionPenalty = Math.max(0, (this.getClientCount() - 100) * 0.1);
    return Math.round(baseTime + connectionPenalty);
  }

  /**
   * Enhanced client registration with health monitoring
   */
  registerClientEnhanced(clientId: string, ws: AuthenticatedWebSocket): void {
    this.registerClient(clientId, ws);

    // Setup health monitoring for this client
    const healthCheck = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.ping();
        } catch (error) {
          this?.performanceMetrics?.connectionErrors++;
          this.handleConnectionError(clientId, ws);
        }
      } else {
        // Clean up if connection is no longer open
        clearInterval(healthCheck);
        this?.connectionHealthChecks?.delete(clientId);
      }
    }, 30000); // Ping every 30 seconds

    this?.connectionHealthChecks?.set(clientId, healthCheck);

    // Setup pong handler with proper cleanup
    const pongHandler = () => {
      // Reset retry attempts on successful pong
      this?.retryAttempts?.delete(clientId);
    };

    ws.on("pong", pongHandler);

    // Store reference to remove listener later
    ws.once("close", () => {
      ws.removeListener("pong", pongHandler);
    });
  }

  /**
   * Handle connection errors with retry logic
   */
  private handleConnectionError(
    clientId: string,
    ws: AuthenticatedWebSocket,
  ): void {
    const attempts = this?.retryAttempts?.get(clientId) || 0;

    if (attempts < 3) {
      this?.retryAttempts?.set(clientId, attempts + 1);
      logger.warn(
        `WebSocket connection error for client ${clientId}, attempt ${attempts + 1}/3`,
        "WS_SERVICE",
      );
    } else {
      // Max retries reached, force disconnect and clean up
      logger.error(
        `Max connection errors reached for client ${clientId}, disconnecting`,
        "WS_SERVICE",
      );
      ws.close(1006, "Connection unstable");
      this.cleanupClient(clientId);
    }
  }

  /**
   * Get enhanced performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics & {
    connectionStats: ReturnType<WebSocketService["getConnectionStats"]>;
  } {
    return {
      ...this.performanceMetrics,
      connectionStats: this.getConnectionStats(),
    };
  }

  /**
   * Get health status of the WebSocket service
   */
  getHealth(): {
    status: string;
    connections: number;
    uptime: number;
    metrics: any;
  } {
    const stats = this.getConnectionStats();
    const uptime =
      Date.now() - (this?.performanceMetrics?.lastCleanup || Date.now());

    return {
      status: stats.totalConnections > 0 ? "healthy" : "idle",
      connections: stats.totalConnections,
      uptime: uptime,
      metrics: this.getPerformanceMetrics(),
    };
  }

  // Enhanced broadcast methods for table data (Agent 11)

  /**
   * Broadcast table data updates with throttling
   */
  broadcastEmailTableDataUpdated(rowCount: number, filters?: any): void {
    this.broadcastThrottled("table_data", {
      type: "email.table_data_updated",
      rowCount,
      filters,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast dashboard stats updates with throttling
   */
  broadcastEmailStatsUpdated(stats: {
    total: number;
    critical: number;
    inProgress: number;
    completed: number;
  }): void {
    this.broadcastThrottled("stats", {
      type: "email.stats_updated",
      stats,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast batch creation events
   */
  broadcastEmailBatchCreated(
    batchId: string,
    successCount: number,
    errorCount: number,
  ): void {
    this.broadcast({
      type: "email.batch_created",
      batchId,
      successCount,
      errorCount,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast batch status updates
   */
  broadcastEmailBatchStatusUpdated(
    emailIds: string[],
    successCount: number,
    errorCount: number,
    changedBy: string,
  ): void {
    this.broadcast({
      type: "email.batch_status_updated",
      emailIds,
      successCount,
      errorCount,
      changedBy,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast batch deletion events
   */
  broadcastEmailBatchDeleted(
    emailIds: string[],
    successCount: number,
    errorCount: number,
    softDelete: boolean,
  ): void {
    this.broadcast({
      type: "email.batch_deleted",
      emailIds,
      successCount,
      errorCount,
      softDelete,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast performance warnings
   */
  broadcastPerformanceWarning(
    component: string,
    metric: string,
    value: number,
    threshold: number,
    severity: "warning" | "critical",
  ): void {
    this.broadcast({
      type: "system.performance_warning",
      component,
      metric,
      value,
      threshold,
      severity,
      timestamp: new Date(),
    });
  }

  // Convenience methods for common broadcasts

  broadcastAgentStatus(
    agentId: string,
    status: "idle" | "busy" | "error" | "terminated",
  ): void {
    this.broadcast({
      type: "agent.status",
      agentId,
      status,
      timestamp: new Date(),
    });
  }

  broadcastAgentTask(
    agentId: string,
    taskId: string,
    status: "started" | "completed" | "failed",
    result?: any,
    error?: string,
  ): void {
    this.broadcast({
      type: "agent.task",
      agentId,
      taskId,
      status,
      result,
      error,
      timestamp: new Date(),
    });
  }

  broadcastPlanUpdate(
    planId: string,
    status: "created" | "executing" | "completed" | "failed" | "replanned",
    progress?: { completed: number; total: number; currentStep?: string },
  ): void {
    this.broadcast({
      type: "plan.update",
      planId,
      status,
      progress,
      timestamp: new Date(),
    });
  }

  broadcastChatMessage(
    conversationId: string,
    message: {
      role: "user" | "assistant" | "system";
      content: string;
      metadata?: any;
    },
  ): void {
    this.broadcast({
      type: "chat.message",
      conversationId,
      message,
      timestamp: new Date(),
    });
  }

  broadcastTaskUpdate(
    taskId: string,
    status: "queued" | "executing" | "completed" | "failed",
    progress?: number,
    result?: any,
    error?: string,
  ): void {
    this.broadcast({
      type: "task.update",
      taskId,
      status,
      progress,
      result,
      error,
      timestamp: new Date(),
    });
  }

  broadcastRAGOperation(
    operation: "indexing" | "searching" | "embedding",
    status: "started" | "completed" | "failed",
    details?: {
      documentCount?: number;
      chunkCount?: number;
      duration?: number;
      error?: string;
    },
  ): void {
    this.broadcast({
      type: "rag.operation",
      operation,
      status,
      details,
      timestamp: new Date(),
    });
  }

  broadcastSystemHealth(
    services: Record<
      string,
      | "healthy"
      | "degraded"
      | "down"
      | "connected"
      | "disconnected"
      | "error"
      | "timeout"
    >,
    metrics?: {
      cpu?: number;
      memory?: number;
      activeAgents?: number;
      queueLength?: number;
      responseTime?: number;
      uptime?: number;
    },
  ): void {
    this.broadcast({
      type: "system.health",
      services,
      metrics,
      timestamp: new Date(),
    });
  }

  broadcastSystemMetrics(metrics: {
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    cpuUsage?: number;
    activeConnections: number;
    requestsPerMinute?: number;
    responseTime: number;
  }): void {
    this.broadcast({
      type: "system.metrics",
      metrics,
      timestamp: new Date(),
    });
  }

  broadcastAgentPerformance(
    agentId: string,
    metrics: {
      tasksCompleted: number;
      averageResponseTime: number;
      errorRate: number;
      lastActivity: Date;
    },
  ): void {
    this.broadcast({
      type: "agent.performance",
      agentId,
      metrics,
      timestamp: new Date(),
    });
  }

  /**
   * Get real-time connection statistics
   */
  getConnectionStats(): {
    totalClients: number;
    totalConnections: number;
    authenticatedClients: number;
    subscriptionStats: Record<string, number>;
    authStats: {
      byRole: Record<string, number>;
      byPermission: Record<string, number>;
    };
  } {
    let totalConnections = 0;
    const subscriptionStats: Record<string, number> = {};
    const authStats = {
      byRole: {} as Record<string, number>,
      byPermission: {} as Record<string, number>,
    };

    this?.clients?.forEach((sockets: any) => {
      totalConnections += sockets.size;
    });

    this?.subscriptions?.forEach((subs: any) => {
      subs.forEach((sub: any) => {
        subscriptionStats[sub] = (subscriptionStats[sub] || 0) + 1;
      });
    });

    // Collect authentication statistics
    this?.authenticatedClients?.forEach((ws: any) => {
      if (ws.userRole) {
        authStats.byRole[ws.userRole] =
          (authStats.byRole[ws.userRole] || 0) + 1;
      }
    });

    this?.clientPermissions?.forEach((permissions: any) => {
      permissions.forEach((perm: any) => {
        authStats.byPermission[perm] = (authStats.byPermission[perm] || 0) + 1;
      });
    });

    return {
      totalClients: this?.clients?.size,
      totalConnections,
      authenticatedClients: this?.authenticatedClients?.size,
      subscriptionStats,
      authStats,
    };
  }

  // Email-specific broadcast methods

  /**
   * Emit email update event for assignment changes
   */
  emitEmailUpdate(event: {
    type: "update" | "delete" | "create";
    email?: any;
    emailId?: string;
  }): void {
    this.broadcast({
      type: "email.updated",
      eventType: event.type,
      email: event.email,
      emailId: event.emailId,
      timestamp: new Date(),
    } as any);
  }

  broadcastEmailAnalyzed(
    emailId: string,
    workflow: string,
    priority: "critical" | "high" | "medium" | "low",
    actionSummary: string,
    confidence: number,
    slaStatus: "on-track" | "at-risk" | "overdue",
    state: string,
  ): void {
    this.broadcast(
      {
        type: "email.analyzed",
        emailId,
        workflow,
        priority,
        actionSummary,
        confidence,
        slaStatus,
        state,
        timestamp: new Date(),
      },
      "read",
    ); // Require read permission
  }

  broadcastEmailStateChanged(
    emailId: string,
    oldState: string,
    newState: string,
    changedBy?: string,
  ): void {
    this.broadcast(
      {
        type: "email.state_changed",
        emailId,
        oldState,
        newState,
        changedBy,
        timestamp: new Date(),
      },
      "read",
    ); // Require read permission
  }

  broadcastEmailBulkUpdate(
    action: string,
    emailIds: string[],
    results: {
      successful: number;
      failed: number;
      total: number;
    },
  ): void {
    this.broadcast({
      type: "email.bulk_update",
      action,
      emailIds,
      results,
      timestamp: new Date(),
    });
  }

  broadcastEmailSLAAlert(
    emailId: string,
    workflow: string,
    priority: "critical" | "high" | "medium" | "low",
    slaStatus: "at-risk" | "overdue",
    timeRemaining?: number,
    overdueDuration?: number,
  ): void {
    this.broadcast({
      type: "email.sla_alert",
      emailId,
      workflow,
      priority,
      slaStatus,
      timeRemaining,
      overdueDuration,
      timestamp: new Date(),
    });
  }

  broadcastEmailAnalyticsUpdated(
    totalEmails: number,
    workflowDistribution: Record<string, number>,
    slaCompliance: Record<string, number>,
    averageProcessingTime: number,
  ): void {
    this.broadcast({
      type: "email.analytics_updated",
      totalEmails,
      workflowDistribution,
      slaCompliance,
      averageProcessingTime,
      timestamp: new Date(),
    });
  }

  /**
   * Start periodic health broadcasts
   */
  startHealthMonitoring(intervalMs: number = 30000): void {
    // Clear any existing interval
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }

    this.healthInterval = setInterval(() => {
      // Get system metrics
      const memUsage = process.memoryUsage();
      const stats = this.getConnectionStats();

      this.broadcastSystemMetrics({
        memoryUsage: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round(
            (memUsage.heapUsed / memUsage.heapTotal) * 100,
          ),
        },
        activeConnections: stats.totalConnections,
        responseTime: 0, // This could be populated from actual metrics
      });
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  /**
   * Gracefully shutdown the WebSocket service
   */
  shutdown(): void {
    logger.info("Shutting down WebSocket service", "WS_SERVICE");

    // Stop all intervals
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }

    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }

    if (this.performanceMonitorInterval) {
      clearInterval(this.performanceMonitorInterval);
      this.performanceMonitorInterval = null;
    }

    // Clear all throttle timers
    this?.throttleTimers?.forEach((timer: any) => {
      clearTimeout(timer);
    });
    this?.throttleTimers?.clear();

    // Clear all health check timers
    this?.connectionHealthChecks?.forEach((timer: any) => {
      clearTimeout(timer);
    });
    this?.connectionHealthChecks?.clear();

    // Close all active connections
    this?.clients?.forEach((sockets, clientId) => {
      sockets.forEach((ws: any) => {
        if (ws.readyState === ws.OPEN) {
          ws.close(1001, "Server shutting down");
        }
      });
    });

    // Clear all data structures
    this?.clients?.clear();
    this?.subscriptions?.clear();
    this?.authenticatedClients?.clear();
    this?.clientPermissions?.clear();
    this?.messageQueue?.clear();
    this?.throttledBroadcasts?.clear();
    this?.retryAttempts?.clear();
    this?.clientCleanupHandlers?.clear();

    // Remove all event listeners
    this.removeAllListeners();

    logger.info("WebSocket service shutdown complete", "WS_SERVICE");
  }
}

// Singleton instance
export const wsService = new WebSocketService();

// Clean up on process exit
process.once("SIGINT", () => wsService.shutdown());
process.once("SIGTERM", () => wsService.shutdown());
