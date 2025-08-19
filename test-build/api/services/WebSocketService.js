import { EventEmitter } from "events";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
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
        services: z.record(z.enum([
            "healthy",
            "degraded",
            "down",
            "connected",
            "disconnected",
            "error",
            "timeout",
        ])),
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
    // Agent Processing Control message types
    z.object({
        type: z.literal("email.processing_started"),
        initiatedBy: z.string(),
        batchSize: z.number(),
        maxConcurrent: z.number(),
        timestamp: z.date(),
    }),
    z.object({
        type: z.literal("email.processing_stopped"),
        stoppedBy: z.string(),
        reason: z.string(),
        forceStop: z.boolean(),
        timestamp: z.date(),
    }),
    z.object({
        type: z.literal("email.agent_processed"),
        emailId: z.string(),
        agentType: z.string(),
        requestedBy: z.string(),
        result: z.any(),
        timestamp: z.date(),
    }),
    z.object({
        type: z.literal("email.processing_reset"),
        resetBy: z.string(),
        reason: z.string(),
        clearProgress: z.boolean(),
        timestamp: z.date(),
    }),
    z.object({
        type: z.literal("email.processing_progress"),
        processed: z.number(),
        total: z.number(),
        current: z.string(),
        percentage: z.number(),
        timestamp: z.date(),
    }),
    z.object({
        type: z.literal("email.ingestion.started"),
        source: z.string(),
        totalEmails: z.number(),
        timestamp: z.string(),
    }),
    z.object({
        type: z.literal("email.ingestion.completed"),
        source: z.string(),
        processed: z.number(),
        failed: z.number(),
        total: z.number(),
        timestamp: z.string(),
    }),
    z.object({
        type: z.literal("email.ingestion.failed"),
        source: z.string(),
        error: z.string(),
        timestamp: z.string(),
    }),
]);
export class WebSocketService extends EventEmitter {
    static instance = null;
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    clients = new Map();
    subscriptions = new Map();
    healthInterval = null;
    memoryCleanupInterval = null;
    performanceMonitorInterval = null;
    // Authentication tracking
    authenticatedClients = new Map();
    clientPermissions = new Map();
    // Enhanced performance features (Agent 11 - 2025 Best Practices)
    messageQueue = new Map();
    throttledBroadcasts = new Map();
    throttleTimers = new Map();
    performanceMetrics = {
        messagesSent: 0,
        messagesDropped: 0,
        averageResponseTime: 0,
        connectionErrors: 0,
        lastCleanup: Date.now(),
    };
    MAX_QUEUE_SIZE = 100; // Prevent memory leaks
    MAX_MESSAGE_HISTORY = 50; // Limit message history per client
    MAX_CLIENTS = 10000; // Prevent unbounded growth
    MAX_SUBSCRIPTIONS_PER_CLIENT = 100; // Limit subscriptions
    connectionHealthChecks = new Map();
    retryAttempts = new Map();
    clientCleanupHandlers = new Map();
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
    registerClient(clientId, ws) {
        // Check client limit to prevent unbounded growth
        if (this?.clients?.size >= this.MAX_CLIENTS && !this?.clients?.has(clientId)) {
            ws.close(1008, "Server at capacity");
            return;
        }
        if (!this?.clients?.has(clientId)) {
            this?.clients?.set(clientId, new Set());
        }
        this?.clients?.get(clientId).add(ws);
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
        ws.on("error", (error) => {
            logger.error(`WebSocket error for client ${clientId}: ${error.message}`, "WS_SERVICE");
            this.performanceMetrics.connectionErrors++;
        });
    }
    /**
     * Unregister a WebSocket client
     */
    unregisterClient(clientId, ws) {
        const clientSockets = this?.clients?.get(clientId);
        if (clientSockets) {
            clientSockets.delete(ws);
            if (clientSockets.size === 0) {
                // Complete cleanup to prevent memory leaks
                this.cleanupClient(clientId);
                if (ws.isAuthenticated) {
                    logger.info("Authenticated WebSocket client unregistered", "WS_SERVICE", {
                        clientId,
                        userId: ws.userId,
                    });
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
    subscribe(clientId, types) {
        if (!this?.subscriptions?.has(clientId)) {
            this?.subscriptions?.set(clientId, new Set());
        }
        const clientSubs = this?.subscriptions?.get(clientId);
        // Limit subscriptions per client to prevent memory issues
        types.forEach((type) => {
            if (clientSubs.size < this.MAX_SUBSCRIPTIONS_PER_CLIENT) {
                clientSubs.add(type);
            }
            else {
                logger.warn(`Client ${clientId} reached subscription limit`, "WS_SERVICE");
            }
        });
    }
    /**
     * Unsubscribe a client from specific message types
     */
    unsubscribe(clientId, types) {
        const clientSubs = this?.subscriptions?.get(clientId);
        if (clientSubs) {
            types.forEach((type) => clientSubs.delete(type));
        }
    }
    /**
     * Broadcast a message to all subscribed clients
     */
    broadcast(message, requiredPermission) {
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
    sendToClient(clientId, message) {
        const sockets = this?.clients?.get(clientId);
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
     * Send a message to a specific user (alias for sendToClient for backward compatibility)
     */
    sendToUser(userId, message) {
        this.sendToClient(userId, message);
    }
    /**
     * Get the number of connected clients
     */
    getClientCount() {
        return this?.clients?.size;
    }
    /**
     * Get client subscription info
     */
    getClientSubscriptions(clientId) {
        const subs = this?.subscriptions?.get(clientId);
        return subs ? Array.from(subs) : [];
    }
    /**
     * Check if a client has a specific permission
     */
    hasPermission(clientId, permission) {
        const permissions = this?.clientPermissions?.get(clientId);
        return permissions ? permissions.has(permission) : false;
    }
    /**
     * Get authenticated client info
     */
    getAuthenticatedClient(clientId) {
        return this?.authenticatedClients?.get(clientId);
    }
    /**
     * Check if client is authenticated
     */
    isClientAuthenticated(clientId) {
        const client = this?.authenticatedClients?.get(clientId);
        return client ? client.isAuthenticated === true : false;
    }
    /**
     * Force disconnect a client
     */
    forceDisconnectClient(clientId) {
        const sockets = this?.clients?.get(clientId);
        if (sockets) {
            sockets.forEach((ws) => {
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
    createThrottle(fn, delay) {
        let timeoutId = null;
        let lastMessage = null;
        return (message) => {
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
    setupThrottledBroadcasts() {
        // Table data updates - throttled to 200ms (researched best practice)
        this?.throttledBroadcasts?.set("table_data", this.createThrottle((message) => {
            this.broadcast(message);
        }, 200));
        // Stats updates - throttled to 500ms for dashboard widgets
        this?.throttledBroadcasts?.set("stats", this.createThrottle((message) => {
            this.broadcast(message);
        }, 500));
        // Performance metrics - throttled to 1000ms
        this?.throttledBroadcasts?.set("performance", this.createThrottle((message) => {
            this.broadcast(message);
        }, 1000));
    }
    /**
     * Enhanced broadcast with throttling support for high-frequency updates
     */
    broadcastThrottled(messageType, message) {
        const throttledFunc = this?.throttledBroadcasts?.get(messageType);
        if (throttledFunc) {
            throttledFunc(message);
        }
        else {
            this.broadcast(message);
        }
    }
    /**
     * Memory cleanup routine to prevent memory leaks
     */
    startMemoryCleanup() {
        this.memoryCleanupInterval = setInterval(() => {
            try {
                // Clean up message queues that exceed max size
                this?.messageQueue?.forEach((queue, clientId) => {
                    if (queue?.length || 0 > this.MAX_MESSAGE_HISTORY) {
                        this?.messageQueue?.set(clientId, queue.slice(-this.MAX_MESSAGE_HISTORY));
                    }
                });
                // Clean up disconnected clients
                this?.clients?.forEach((sockets, clientId) => {
                    const activeSockets = Array.from(sockets).filter((ws) => ws.readyState === ws.OPEN);
                    if (activeSockets?.length || 0 === 0) {
                        this.cleanupClient(clientId);
                    }
                    else if (activeSockets?.length || 0 !== sockets.size) {
                        // Update client with only active sockets
                        this?.clients?.set(clientId, new Set(activeSockets));
                    }
                });
                // Clean up orphaned data structures
                this.cleanupOrphanedData();
                this.performanceMetrics.lastCleanup = Date.now();
                // Log memory usage for monitoring
                const memUsage = process.memoryUsage();
                if (memUsage.heapUsed > memUsage.heapTotal * 0.9) {
                    logger.warn("High memory usage detected", "WS_SERVICE", {
                        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
                        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
                        clients: this?.clients?.size,
                    });
                }
            }
            catch (error) {
                logger.error(`Memory cleanup error: ${error}`, "WS_SERVICE");
            }
        }, 30000); // Clean up every 30 seconds
    }
    /**
     * Start performance monitoring with alerts
     */
    startPerformanceMonitoring() {
        this.performanceMonitorInterval = setInterval(() => {
            try {
                const stats = this.getConnectionStats();
                // Check for performance issues
                if (stats.totalConnections > 1000) {
                    this.broadcastPerformanceWarning("websocket", "connections", stats.totalConnections, 1000, "warning");
                }
                if (this.performanceMetrics.connectionErrors > 10) {
                    this.broadcastPerformanceWarning("websocket", "connection_errors", this.performanceMetrics.connectionErrors, 10, "critical");
                    this.performanceMetrics.connectionErrors = 0; // Reset after alert
                }
                // Update response time metrics
                this.performanceMetrics.averageResponseTime =
                    this.calculateAverageResponseTime();
                // Force garbage collection if available (requires --expose-gc flag)
                if (global.gc && this?.clients?.size === 0) {
                    global.gc();
                }
            }
            catch (error) {
                logger.error(`Performance monitoring error: ${error}`, "WS_SERVICE");
            }
        }, 60000); // Monitor every minute
    }
    /**
     * Clean up client data completely
     */
    cleanupClient(clientId) {
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
    cleanupOrphanedData() {
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
    calculateAverageResponseTime() {
        // Simple implementation - could be enhanced with actual timing measurements
        const baseTime = 10; // Base WebSocket response time in ms
        const connectionPenalty = Math.max(0, (this.getClientCount() - 100) * 0.1);
        return Math.round(baseTime + connectionPenalty);
    }
    /**
     * Enhanced client registration with health monitoring
     */
    registerClientEnhanced(clientId, ws) {
        this.registerClient(clientId, ws);
        // Setup health monitoring for this client
        const healthCheck = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                try {
                    ws.ping();
                }
                catch (error) {
                    this.performanceMetrics.connectionErrors++;
                    this.handleConnectionError(clientId, ws);
                }
            }
            else {
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
    handleConnectionError(clientId, ws) {
        const attempts = this?.retryAttempts?.get(clientId) || 0;
        if (attempts < 3) {
            this?.retryAttempts?.set(clientId, attempts + 1);
            logger.warn(`WebSocket connection error for client ${clientId}, attempt ${attempts + 1}/3`, "WS_SERVICE");
        }
        else {
            // Max retries reached, force disconnect and clean up
            logger.error(`Max connection errors reached for client ${clientId}, disconnecting`, "WS_SERVICE");
            ws.close(1006, "Connection unstable");
            this.cleanupClient(clientId);
        }
    }
    /**
     * Get enhanced performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            connectionStats: this.getConnectionStats(),
        };
    }
    /**
     * Get health status of the WebSocket service
     */
    getHealth() {
        const stats = this.getConnectionStats();
        const uptime = Date.now() - (this?.performanceMetrics?.lastCleanup || Date.now());
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
    broadcastEmailTableDataUpdated(rowCount, filters) {
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
    broadcastEmailStatsUpdated(stats) {
        this.broadcastThrottled("stats", {
            type: "email.stats_updated",
            stats,
            timestamp: new Date(),
        });
    }
    /**
     * Broadcast batch creation events
     */
    broadcastEmailBatchCreated(batchId, successCount, errorCount) {
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
    broadcastEmailBatchStatusUpdated(emailIds, successCount, errorCount, changedBy) {
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
    broadcastEmailBatchDeleted(emailIds, successCount, errorCount, softDelete) {
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
    broadcastPerformanceWarning(component, metric, value, threshold, severity) {
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
    broadcastAgentStatus(agentId, status) {
        this.broadcast({
            type: "agent.status",
            agentId,
            status,
            timestamp: new Date(),
        });
    }
    broadcastAgentTask(agentId, taskId, status, result, error) {
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
    broadcastPlanUpdate(planId, status, progress) {
        this.broadcast({
            type: "plan.update",
            planId,
            status,
            progress,
            timestamp: new Date(),
        });
    }
    broadcastChatMessage(conversationId, message) {
        this.broadcast({
            type: "chat.message",
            conversationId,
            message,
            timestamp: new Date(),
        });
    }
    broadcastTaskUpdate(taskId, status, progress, result, error) {
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
    broadcastRAGOperation(operation, status, details) {
        this.broadcast({
            type: "rag.operation",
            operation,
            status,
            details,
            timestamp: new Date(),
        });
    }
    broadcastSystemHealth(services, metrics) {
        this.broadcast({
            type: "system.health",
            services,
            metrics,
            timestamp: new Date(),
        });
    }
    broadcastSystemMetrics(metrics) {
        this.broadcast({
            type: "system.metrics",
            metrics,
            timestamp: new Date(),
        });
    }
    broadcastAgentPerformance(agentId, metrics) {
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
    getConnectionStats() {
        let totalConnections = 0;
        const subscriptionStats = {};
        const authStats = {
            byRole: {},
            byPermission: {},
        };
        this?.clients?.forEach((sockets) => {
            totalConnections += sockets.size;
        });
        this?.subscriptions?.forEach((subs) => {
            subs.forEach((sub) => {
                subscriptionStats[sub] = (subscriptionStats[sub] || 0) + 1;
            });
        });
        // Collect authentication statistics
        this?.authenticatedClients?.forEach((ws) => {
            if (ws.userRole) {
                authStats.byRole[ws.userRole] =
                    (authStats.byRole[ws.userRole] || 0) + 1;
            }
        });
        this?.clientPermissions?.forEach((permissions) => {
            permissions.forEach((perm) => {
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
    emitEmailUpdate(event) {
        this.broadcast({
            type: "email.updated",
            eventType: event.type,
            email: event.email,
            emailId: event.emailId,
            timestamp: new Date(),
        });
    }
    broadcastEmailAnalyzed(emailId, workflow, priority, actionSummary, confidence, slaStatus, state) {
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
    broadcastEmailStateChanged(emailId, oldState, newState, changedBy) {
        this.broadcast({
            type: "email.state_changed",
            emailId,
            oldState,
            newState,
            changedBy,
            timestamp: new Date(),
        }, "read"); // Require read permission
    }
    broadcastEmailBulkUpdate(action, emailIds, results) {
        this.broadcast({
            type: "email.bulk_update",
            action,
            emailIds,
            results,
            timestamp: new Date(),
        });
    }
    broadcastEmailSLAAlert(emailId, workflow, priority, slaStatus, timeRemaining, overdueDuration) {
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
    broadcastEmailAnalyticsUpdated(totalEmails, workflowDistribution, slaCompliance, averageProcessingTime) {
        this.broadcast({
            type: "email.analytics_updated",
            totalEmails,
            workflowDistribution,
            slaCompliance,
            averageProcessingTime,
            timestamp: new Date(),
        });
    }
    broadcastEmailProcessingProgress(progress) {
        this.broadcast({
            type: "email.processing_progress",
            ...progress,
            timestamp: new Date(),
        });
    }
    // Agent Processing Control WebSocket Methods
    broadcastEmailProcessingStarted(data) {
        this.broadcast({
            type: "email.processing_started",
            ...data,
        });
    }
    broadcastEmailProcessingStopped(data) {
        this.broadcast({
            type: "email.processing_stopped",
            ...data,
        });
    }
    broadcastEmailAgentProcessed(data) {
        this.broadcast({
            type: "email.agent_processed",
            ...data,
        });
    }
    broadcastEmailProcessingReset(data) {
        this.broadcast({
            type: "email.processing_reset",
            ...data,
        });
    }
    /**
     * Start periodic health broadcasts
     */
    startHealthMonitoring(intervalMs = 30000) {
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
                    percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
                },
                activeConnections: stats.totalConnections,
                responseTime: 0, // This could be populated from actual metrics
            });
        }, intervalMs);
    }
    /**
     * Stop health monitoring
     */
    stopHealthMonitoring() {
        if (this.healthInterval) {
            clearInterval(this.healthInterval);
            this.healthInterval = null;
        }
    }
    /**
     * Gracefully shutdown the WebSocket service
     */
    shutdown() {
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
        this?.throttleTimers?.forEach((timer) => {
            clearTimeout(timer);
        });
        this?.throttleTimers?.clear();
        // Clear all health check timers
        this?.connectionHealthChecks?.forEach((timer) => {
            clearTimeout(timer);
        });
        this?.connectionHealthChecks?.clear();
        // Close all active connections
        this?.clients?.forEach((sockets, clientId) => {
            sockets.forEach((ws) => {
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
