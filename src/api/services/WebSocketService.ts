import { EventEmitter } from "events";
import type { WebSocket } from "ws";
import { z } from "zod";
// import _ from "lodash"; // Commented out - types not available
import type { AuthenticatedWebSocket } from "../middleware/websocketAuth";
import { logger } from "../../utils/logger";

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
    priority: z.enum(["Critical", "High", "Medium", "Low"]),
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
    priority: z.enum(["Critical", "High", "Medium", "Low"]),
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
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

export class WebSocketService extends EventEmitter {
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();
  private healthInterval: NodeJS.Timeout | null = null;
  
  // Authentication tracking
  private authenticatedClients: Map<string, AuthenticatedWebSocket> = new Map();
  private clientPermissions: Map<string, Set<string>> = new Map();
  
  // Enhanced performance features (Agent 11 - 2025 Best Practices)
  private messageQueue: Map<string, WebSocketMessage[]> = new Map();
  private throttledBroadcasts: Map<string, (message: WebSocketMessage) => void> = new Map();
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
  private connectionHealthChecks: Map<string, NodeJS.Timeout> = new Map();
  private retryAttempts: Map<string, number> = new Map();

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
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, new Set());
    }
    this.clients.get(clientId)!.add(ws);

    // Track authenticated clients
    if (ws.isAuthenticated) {
      this.authenticatedClients.set(clientId, ws);
      
      // Store client permissions
      if (ws.permissions) {
        this.clientPermissions.set(clientId, new Set(ws.permissions));
      }
      
      logger.info("Authenticated WebSocket client registered", "WS_SERVICE", {
        clientId,
        userId: ws.userId,
        role: ws.userRole,
      });
    }

    // Clean up on disconnect
    ws.on("close", () => {
      this.unregisterClient(clientId, ws);
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string, ws: AuthenticatedWebSocket): void {
    const clientSockets = this.clients.get(clientId);
    if (clientSockets) {
      clientSockets.delete(ws);
      if (clientSockets.size === 0) {
        this.clients.delete(clientId);
        this.subscriptions.delete(clientId);
        this.authenticatedClients.delete(clientId);
        this.clientPermissions.delete(clientId);
        
        if (ws.isAuthenticated) {
          logger.info("Authenticated WebSocket client unregistered", "WS_SERVICE", {
            clientId,
            userId: ws.userId,
          });
        }
      }
    }
  }

  /**
   * Subscribe a client to specific message types
   */
  subscribe(clientId: string, types: string[]): void {
    if (!this.subscriptions.has(clientId)) {
      this.subscriptions.set(clientId, new Set());
    }
    const clientSubs = this.subscriptions.get(clientId)!;
    types.forEach((type) => clientSubs.add(type));
  }

  /**
   * Unsubscribe a client from specific message types
   */
  unsubscribe(clientId: string, types: string[]): void {
    const clientSubs = this.subscriptions.get(clientId);
    if (clientSubs) {
      types.forEach((type) => clientSubs.delete(type));
    }
  }

  /**
   * Broadcast a message to all subscribed clients
   */
  broadcast(message: WebSocketMessage, requiredPermission?: string): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((sockets, clientId) => {
      const clientSubs = this.subscriptions.get(clientId);

      // Check if client is subscribed to this message type
      if (clientSubs && (clientSubs.has(message.type) || clientSubs.has("*"))) {
        // Check permissions if required
        if (requiredPermission) {
          const permissions = this.clientPermissions.get(clientId);
          if (!permissions || !permissions.has(requiredPermission)) {
            return; // Skip this client if they don't have required permission
          }
        }
        
        sockets.forEach((ws) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(messageStr);
            this.performanceMetrics.messagesSent++;
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
    const sockets = this.clients.get(clientId);
    if (sockets) {
      const messageStr = JSON.stringify(message);
      sockets.forEach((ws) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client subscription info
   */
  getClientSubscriptions(clientId: string): string[] {
    const subs = this.subscriptions.get(clientId);
    return subs ? Array.from(subs) : [];
  }

  /**
   * Check if a client has a specific permission
   */
  hasPermission(clientId: string, permission: string): boolean {
    const permissions = this.clientPermissions.get(clientId);
    return permissions ? permissions.has(permission) : false;
  }

  /**
   * Get authenticated client info
   */
  getAuthenticatedClient(clientId: string): AuthenticatedWebSocket | undefined {
    return this.authenticatedClients.get(clientId);
  }

  /**
   * Check if client is authenticated
   */
  isClientAuthenticated(clientId: string): boolean {
    const client = this.authenticatedClients.get(clientId);
    return client ? client.isAuthenticated === true : false;
  }

  /**
   * Force disconnect a client
   */
  forceDisconnectClient(clientId: string): void {
    const sockets = this.clients.get(clientId);
    if (sockets) {
      sockets.forEach(ws => {
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
  private createThrottle(fn: (message: WebSocketMessage) => void, delay: number): (message: WebSocketMessage) => void {
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
    this.throttledBroadcasts.set('table_data', this.createThrottle((message: WebSocketMessage) => {
      this.broadcast(message);
    }, 200));
    
    // Stats updates - throttled to 500ms for dashboard widgets
    this.throttledBroadcasts.set('stats', this.createThrottle((message: WebSocketMessage) => {
      this.broadcast(message);
    }, 500));
    
    // Performance metrics - throttled to 1000ms
    this.throttledBroadcasts.set('performance', this.createThrottle((message: WebSocketMessage) => {
      this.broadcast(message);
    }, 1000));
  }
  
  /**
   * Enhanced broadcast with throttling support for high-frequency updates
   */
  private broadcastThrottled(messageType: string, message: WebSocketMessage): void {
    const throttledFunc = this.throttledBroadcasts.get(messageType);
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
    const cleanupInterval = setInterval(() => {
      // Clean up message queues that exceed max size
      this.messageQueue.forEach((queue, clientId) => {
        if (queue.length > this.MAX_MESSAGE_HISTORY) {
          this.messageQueue.set(clientId, queue.slice(-this.MAX_MESSAGE_HISTORY));
        }
      });
      
      // Clean up disconnected clients
      this.clients.forEach((sockets, clientId) => {
        const activeSockets = Array.from(sockets).filter(ws => ws.readyState === ws.OPEN);
        if (activeSockets.length === 0) {
          this.cleanupClient(clientId);
        } else if (activeSockets.length !== sockets.size) {
          // Update client with only active sockets
          this.clients.set(clientId, new Set(activeSockets));
        }
      });
      
      this.performanceMetrics.lastCleanup = Date.now();
    }, 30000); // Clean up every 30 seconds
    
    // Store reference for cleanup on shutdown
    this.healthInterval = cleanupInterval;
  }
  
  /**
   * Start performance monitoring with alerts
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const stats = this.getConnectionStats();
      
      // Check for performance issues
      if (stats.totalConnections > 1000) {
        this.broadcastPerformanceWarning('websocket', 'connections', stats.totalConnections, 1000, 'warning');
      }
      
      if (this.performanceMetrics.connectionErrors > 10) {
        this.broadcastPerformanceWarning('websocket', 'connection_errors', this.performanceMetrics.connectionErrors, 10, 'critical');
        this.performanceMetrics.connectionErrors = 0; // Reset after alert
      }
      
      // Update response time metrics
      this.performanceMetrics.averageResponseTime = this.calculateAverageResponseTime();
      
    }, 60000); // Monitor every minute
  }
  
  /**
   * Clean up client data completely
   */
  private cleanupClient(clientId: string): void {
    this.clients.delete(clientId);
    this.subscriptions.delete(clientId);
    this.messageQueue.delete(clientId);
    this.retryAttempts.delete(clientId);
    
    // Clear health check timeout
    const healthCheck = this.connectionHealthChecks.get(clientId);
    if (healthCheck) {
      clearTimeout(healthCheck);
      this.connectionHealthChecks.delete(clientId);
    }
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
  registerClientEnhanced(clientId: string, ws: WebSocket): void {
    this.registerClient(clientId, ws);
    
    // Setup health monitoring for this client
    const healthCheck = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.ping();
        } catch (error) {
          this.performanceMetrics.connectionErrors++;
          this.handleConnectionError(clientId, ws);
        }
      }
    }, 30000); // Ping every 30 seconds
    
    this.connectionHealthChecks.set(clientId, healthCheck);
    
    // Enhanced error handling
    ws.on('error', (error) => {
      this.performanceMetrics.connectionErrors++;
      this.handleConnectionError(clientId, ws);
    });
    
    ws.on('pong', () => {
      // Reset retry attempts on successful pong
      this.retryAttempts.delete(clientId);
    });
  }
  
  /**
   * Handle connection errors with retry logic
   */
  private handleConnectionError(clientId: string, ws: WebSocket): void {
    const attempts = this.retryAttempts.get(clientId) || 0;
    
    if (attempts < 3) {
      this.retryAttempts.set(clientId, attempts + 1);
      // Could implement retry logic here
    } else {
      // Max retries reached, clean up
      this.cleanupClient(clientId);
    }
  }
  
  /**
   * Get enhanced performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics & { connectionStats: ReturnType<WebSocketService['getConnectionStats']> } {
    return {
      ...this.performanceMetrics,
      connectionStats: this.getConnectionStats(),
    };
  }

  // Enhanced broadcast methods for table data (Agent 11)
  
  /**
   * Broadcast table data updates with throttling
   */
  broadcastEmailTableDataUpdated(rowCount: number, filters?: any): void {
    this.broadcastThrottled('table_data', {
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
    this.broadcastThrottled('stats', {
      type: "email.stats_updated",
      stats,
      timestamp: new Date(),
    });
  }
  
  /**
   * Broadcast batch creation events
   */
  broadcastEmailBatchCreated(batchId: string, successCount: number, errorCount: number): void {
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
    changedBy: string
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
    softDelete: boolean
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
    severity: "warning" | "critical"
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

    this.clients.forEach((sockets) => {
      totalConnections += sockets.size;
    });

    this.subscriptions.forEach((subs) => {
      subs.forEach((sub) => {
        subscriptionStats[sub] = (subscriptionStats[sub] || 0) + 1;
      });
    });

    // Collect authentication statistics
    this.authenticatedClients.forEach((ws) => {
      if (ws.userRole) {
        authStats.byRole[ws.userRole] = (authStats.byRole[ws.userRole] || 0) + 1;
      }
    });

    this.clientPermissions.forEach((permissions) => {
      permissions.forEach((perm) => {
        authStats.byPermission[perm] = (authStats.byPermission[perm] || 0) + 1;
      });
    });

    return {
      totalClients: this.clients.size,
      totalConnections,
      authenticatedClients: this.authenticatedClients.size,
      subscriptionStats,
      authStats,
    };
  }

  // Email-specific broadcast methods
  
  broadcastEmailAnalyzed(
    emailId: string,
    workflow: string,
    priority: "Critical" | "High" | "Medium" | "Low",
    actionSummary: string,
    confidence: number,
    slaStatus: "on-track" | "at-risk" | "overdue",
    state: string,
  ): void {
    this.broadcast({
      type: "email.analyzed",
      emailId,
      workflow,
      priority,
      actionSummary,
      confidence,
      slaStatus,
      state,
      timestamp: new Date(),
    }, "read"); // Require read permission
  }

  broadcastEmailStateChanged(
    emailId: string,
    oldState: string,
    newState: string,
    changedBy?: string,
  ): void {
    this.broadcast({
      type: "email.state_changed",
      emailId,
      oldState,
      newState,
      changedBy,
      timestamp: new Date(),
    }, "read"); // Require read permission
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
    priority: "Critical" | "High" | "Medium" | "Low",
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
}

// Singleton instance
export const wsService = new WebSocketService();
