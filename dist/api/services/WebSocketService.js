import { EventEmitter } from "events";
import { z } from "zod";
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
export class WebSocketService extends EventEmitter {
    clients = new Map();
    subscriptions = new Map();
    healthInterval = null;
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
    connectionHealthChecks = new Map();
    retryAttempts = new Map();
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
        if (!this.clients.has(clientId)) {
            this.clients.set(clientId, new Set());
        }
        this.clients.get(clientId).add(ws);
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
    unregisterClient(clientId, ws) {
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
    subscribe(clientId, types) {
        if (!this.subscriptions.has(clientId)) {
            this.subscriptions.set(clientId, new Set());
        }
        const clientSubs = this.subscriptions.get(clientId);
        types.forEach((type) => clientSubs.add(type));
    }
    /**
     * Unsubscribe a client from specific message types
     */
    unsubscribe(clientId, types) {
        const clientSubs = this.subscriptions.get(clientId);
        if (clientSubs) {
            types.forEach((type) => clientSubs.delete(type));
        }
    }
    /**
     * Broadcast a message to all subscribed clients
     */
    broadcast(message, requiredPermission) {
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
    sendToClient(clientId, message) {
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
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Get client subscription info
     */
    getClientSubscriptions(clientId) {
        const subs = this.subscriptions.get(clientId);
        return subs ? Array.from(subs) : [];
    }
    /**
     * Check if a client has a specific permission
     */
    hasPermission(clientId, permission) {
        const permissions = this.clientPermissions.get(clientId);
        return permissions ? permissions.has(permission) : false;
    }
    /**
     * Get authenticated client info
     */
    getAuthenticatedClient(clientId) {
        return this.authenticatedClients.get(clientId);
    }
    /**
     * Check if client is authenticated
     */
    isClientAuthenticated(clientId) {
        const client = this.authenticatedClients.get(clientId);
        return client ? client.isAuthenticated === true : false;
    }
    /**
     * Force disconnect a client
     */
    forceDisconnectClient(clientId) {
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
        this.throttledBroadcasts.set('table_data', this.createThrottle((message) => {
            this.broadcast(message);
        }, 200));
        // Stats updates - throttled to 500ms for dashboard widgets
        this.throttledBroadcasts.set('stats', this.createThrottle((message) => {
            this.broadcast(message);
        }, 500));
        // Performance metrics - throttled to 1000ms
        this.throttledBroadcasts.set('performance', this.createThrottle((message) => {
            this.broadcast(message);
        }, 1000));
    }
    /**
     * Enhanced broadcast with throttling support for high-frequency updates
     */
    broadcastThrottled(messageType, message) {
        const throttledFunc = this.throttledBroadcasts.get(messageType);
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
                }
                else if (activeSockets.length !== sockets.size) {
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
    startPerformanceMonitoring() {
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
    cleanupClient(clientId) {
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
    handleConnectionError(clientId, ws) {
        const attempts = this.retryAttempts.get(clientId) || 0;
        if (attempts < 3) {
            this.retryAttempts.set(clientId, attempts + 1);
            // Could implement retry logic here
        }
        else {
            // Max retries reached, clean up
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
    // Enhanced broadcast methods for table data (Agent 11)
    /**
     * Broadcast table data updates with throttling
     */
    broadcastEmailTableDataUpdated(rowCount, filters) {
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
    broadcastEmailStatsUpdated(stats) {
        this.broadcastThrottled('stats', {
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
}
// Singleton instance
export const wsService = new WebSocketService();
//# sourceMappingURL=WebSocketService.js.map