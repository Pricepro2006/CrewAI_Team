import { EventEmitter } from "events";
import type { WebSocket } from "ws";
import { z } from "zod";
import type { AuthenticatedWebSocket } from "../middleware/websocketAuth";
export declare const WebSocketMessageSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"agent.status">;
    agentId: z.ZodString;
    status: z.ZodEnum<["idle", "busy", "error", "terminated"]>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "agent.status";
    timestamp: Date;
    status: "error" | "idle" | "busy" | "terminated";
    agentId: string;
}, {
    type: "agent.status";
    timestamp: Date;
    status: "error" | "idle" | "busy" | "terminated";
    agentId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.task">;
    agentId: z.ZodString;
    taskId: z.ZodString;
    status: z.ZodEnum<["started", "completed", "failed"]>;
    result: z.ZodOptional<z.ZodAny>;
    error: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "agent.task";
    timestamp: Date;
    status: "started" | "completed" | "failed";
    agentId: string;
    taskId: string;
    error?: string | undefined;
    result?: any;
}, {
    type: "agent.task";
    timestamp: Date;
    status: "started" | "completed" | "failed";
    agentId: string;
    taskId: string;
    error?: string | undefined;
    result?: any;
}>, z.ZodObject<{
    type: z.ZodLiteral<"plan.update">;
    planId: z.ZodString;
    status: z.ZodEnum<["created", "executing", "completed", "failed", "replanned"]>;
    progress: z.ZodOptional<z.ZodObject<{
        completed: z.ZodNumber;
        total: z.ZodNumber;
        currentStep: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        completed: number;
        total: number;
        currentStep?: string | undefined;
    }, {
        completed: number;
        total: number;
        currentStep?: string | undefined;
    }>>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "plan.update";
    timestamp: Date;
    status: "completed" | "failed" | "created" | "executing" | "replanned";
    planId: string;
    progress?: {
        completed: number;
        total: number;
        currentStep?: string | undefined;
    } | undefined;
}, {
    type: "plan.update";
    timestamp: Date;
    status: "completed" | "failed" | "created" | "executing" | "replanned";
    planId: string;
    progress?: {
        completed: number;
        total: number;
        currentStep?: string | undefined;
    } | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"chat.message">;
    conversationId: z.ZodString;
    message: z.ZodObject<{
        role: z.ZodEnum<["user", "assistant", "system"]>;
        content: z.ZodString;
        metadata: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: "user" | "assistant" | "system";
        metadata?: any;
    }, {
        content: string;
        role: "user" | "assistant" | "system";
        metadata?: any;
    }>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "chat.message";
    timestamp: Date;
    message: {
        content: string;
        role: "user" | "assistant" | "system";
        metadata?: any;
    };
    conversationId: string;
}, {
    type: "chat.message";
    timestamp: Date;
    message: {
        content: string;
        role: "user" | "assistant" | "system";
        metadata?: any;
    };
    conversationId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"task.update">;
    taskId: z.ZodString;
    status: z.ZodEnum<["queued", "executing", "completed", "failed"]>;
    progress: z.ZodOptional<z.ZodNumber>;
    result: z.ZodOptional<z.ZodAny>;
    error: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "task.update";
    timestamp: Date;
    status: "completed" | "failed" | "executing" | "queued";
    taskId: string;
    error?: string | undefined;
    result?: any;
    progress?: number | undefined;
}, {
    type: "task.update";
    timestamp: Date;
    status: "completed" | "failed" | "executing" | "queued";
    taskId: string;
    error?: string | undefined;
    result?: any;
    progress?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"rag.operation">;
    operation: z.ZodEnum<["indexing", "searching", "embedding"]>;
    status: z.ZodEnum<["started", "completed", "failed"]>;
    details: z.ZodOptional<z.ZodObject<{
        documentCount: z.ZodOptional<z.ZodNumber>;
        chunkCount: z.ZodOptional<z.ZodNumber>;
        duration: z.ZodOptional<z.ZodNumber>;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        error?: string | undefined;
        duration?: number | undefined;
        documentCount?: number | undefined;
        chunkCount?: number | undefined;
    }, {
        error?: string | undefined;
        duration?: number | undefined;
        documentCount?: number | undefined;
        chunkCount?: number | undefined;
    }>>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "rag.operation";
    timestamp: Date;
    operation: "embedding" | "indexing" | "searching";
    status: "started" | "completed" | "failed";
    details?: {
        error?: string | undefined;
        duration?: number | undefined;
        documentCount?: number | undefined;
        chunkCount?: number | undefined;
    } | undefined;
}, {
    type: "rag.operation";
    timestamp: Date;
    operation: "embedding" | "indexing" | "searching";
    status: "started" | "completed" | "failed";
    details?: {
        error?: string | undefined;
        duration?: number | undefined;
        documentCount?: number | undefined;
        chunkCount?: number | undefined;
    } | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"system.health">;
    services: z.ZodRecord<z.ZodString, z.ZodEnum<["healthy", "degraded", "down", "connected", "disconnected", "error", "timeout"]>>;
    metrics: z.ZodOptional<z.ZodObject<{
        cpu: z.ZodOptional<z.ZodNumber>;
        memory: z.ZodOptional<z.ZodNumber>;
        activeAgents: z.ZodOptional<z.ZodNumber>;
        queueLength: z.ZodOptional<z.ZodNumber>;
        responseTime: z.ZodOptional<z.ZodNumber>;
        uptime: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        cpu?: number | undefined;
        memory?: number | undefined;
        activeAgents?: number | undefined;
        queueLength?: number | undefined;
        responseTime?: number | undefined;
        uptime?: number | undefined;
    }, {
        cpu?: number | undefined;
        memory?: number | undefined;
        activeAgents?: number | undefined;
        queueLength?: number | undefined;
        responseTime?: number | undefined;
        uptime?: number | undefined;
    }>>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "system.health";
    timestamp: Date;
    services: Record<string, "timeout" | "error" | "healthy" | "degraded" | "down" | "connected" | "disconnected">;
    metrics?: {
        cpu?: number | undefined;
        memory?: number | undefined;
        activeAgents?: number | undefined;
        queueLength?: number | undefined;
        responseTime?: number | undefined;
        uptime?: number | undefined;
    } | undefined;
}, {
    type: "system.health";
    timestamp: Date;
    services: Record<string, "timeout" | "error" | "healthy" | "degraded" | "down" | "connected" | "disconnected">;
    metrics?: {
        cpu?: number | undefined;
        memory?: number | undefined;
        activeAgents?: number | undefined;
        queueLength?: number | undefined;
        responseTime?: number | undefined;
        uptime?: number | undefined;
    } | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"system.metrics">;
    metrics: z.ZodObject<{
        memoryUsage: z.ZodObject<{
            used: z.ZodNumber;
            total: z.ZodNumber;
            percentage: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            total: number;
            used: number;
            percentage: number;
        }, {
            total: number;
            used: number;
            percentage: number;
        }>;
        cpuUsage: z.ZodOptional<z.ZodNumber>;
        activeConnections: z.ZodNumber;
        requestsPerMinute: z.ZodOptional<z.ZodNumber>;
        responseTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        responseTime: number;
        memoryUsage: {
            total: number;
            used: number;
            percentage: number;
        };
        activeConnections: number;
        cpuUsage?: number | undefined;
        requestsPerMinute?: number | undefined;
    }, {
        responseTime: number;
        memoryUsage: {
            total: number;
            used: number;
            percentage: number;
        };
        activeConnections: number;
        cpuUsage?: number | undefined;
        requestsPerMinute?: number | undefined;
    }>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "system.metrics";
    timestamp: Date;
    metrics: {
        responseTime: number;
        memoryUsage: {
            total: number;
            used: number;
            percentage: number;
        };
        activeConnections: number;
        cpuUsage?: number | undefined;
        requestsPerMinute?: number | undefined;
    };
}, {
    type: "system.metrics";
    timestamp: Date;
    metrics: {
        responseTime: number;
        memoryUsage: {
            total: number;
            used: number;
            percentage: number;
        };
        activeConnections: number;
        cpuUsage?: number | undefined;
        requestsPerMinute?: number | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent.performance">;
    agentId: z.ZodString;
    metrics: z.ZodObject<{
        tasksCompleted: z.ZodNumber;
        averageResponseTime: z.ZodNumber;
        errorRate: z.ZodNumber;
        lastActivity: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        tasksCompleted: number;
        averageResponseTime: number;
        errorRate: number;
        lastActivity: Date;
    }, {
        tasksCompleted: number;
        averageResponseTime: number;
        errorRate: number;
        lastActivity: Date;
    }>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "agent.performance";
    timestamp: Date;
    agentId: string;
    metrics: {
        tasksCompleted: number;
        averageResponseTime: number;
        errorRate: number;
        lastActivity: Date;
    };
}, {
    type: "agent.performance";
    timestamp: Date;
    agentId: string;
    metrics: {
        tasksCompleted: number;
        averageResponseTime: number;
        errorRate: number;
        lastActivity: Date;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.analyzed">;
    emailId: z.ZodString;
    workflow: z.ZodString;
    priority: z.ZodEnum<["Critical", "High", "Medium", "Low"]>;
    actionSummary: z.ZodString;
    confidence: z.ZodNumber;
    slaStatus: z.ZodEnum<["on-track", "at-risk", "overdue"]>;
    state: z.ZodString;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.analyzed";
    timestamp: Date;
    confidence: number;
    emailId: string;
    priority: "Critical" | "High" | "Medium" | "Low";
    workflow: string;
    actionSummary: string;
    slaStatus: "on-track" | "at-risk" | "overdue";
    state: string;
}, {
    type: "email.analyzed";
    timestamp: Date;
    confidence: number;
    emailId: string;
    priority: "Critical" | "High" | "Medium" | "Low";
    workflow: string;
    actionSummary: string;
    slaStatus: "on-track" | "at-risk" | "overdue";
    state: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.state_changed">;
    emailId: z.ZodString;
    oldState: z.ZodString;
    newState: z.ZodString;
    changedBy: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.state_changed";
    timestamp: Date;
    emailId: string;
    oldState: string;
    newState: string;
    changedBy?: string | undefined;
}, {
    type: "email.state_changed";
    timestamp: Date;
    emailId: string;
    oldState: string;
    newState: string;
    changedBy?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.bulk_update">;
    action: z.ZodString;
    emailIds: z.ZodArray<z.ZodString, "many">;
    results: z.ZodObject<{
        successful: z.ZodNumber;
        failed: z.ZodNumber;
        total: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        failed: number;
        total: number;
        successful: number;
    }, {
        failed: number;
        total: number;
        successful: number;
    }>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.bulk_update";
    timestamp: Date;
    action: string;
    emailIds: string[];
    results: {
        failed: number;
        total: number;
        successful: number;
    };
}, {
    type: "email.bulk_update";
    timestamp: Date;
    action: string;
    emailIds: string[];
    results: {
        failed: number;
        total: number;
        successful: number;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.sla_alert">;
    emailId: z.ZodString;
    workflow: z.ZodString;
    priority: z.ZodEnum<["Critical", "High", "Medium", "Low"]>;
    slaStatus: z.ZodEnum<["at-risk", "overdue"]>;
    timeRemaining: z.ZodOptional<z.ZodNumber>;
    overdueDuration: z.ZodOptional<z.ZodNumber>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.sla_alert";
    timestamp: Date;
    emailId: string;
    priority: "Critical" | "High" | "Medium" | "Low";
    workflow: string;
    slaStatus: "at-risk" | "overdue";
    timeRemaining?: number | undefined;
    overdueDuration?: number | undefined;
}, {
    type: "email.sla_alert";
    timestamp: Date;
    emailId: string;
    priority: "Critical" | "High" | "Medium" | "Low";
    workflow: string;
    slaStatus: "at-risk" | "overdue";
    timeRemaining?: number | undefined;
    overdueDuration?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.analytics_updated">;
    totalEmails: z.ZodNumber;
    workflowDistribution: z.ZodRecord<z.ZodString, z.ZodNumber>;
    slaCompliance: z.ZodRecord<z.ZodString, z.ZodNumber>;
    averageProcessingTime: z.ZodNumber;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.analytics_updated";
    timestamp: Date;
    totalEmails: number;
    workflowDistribution: Record<string, number>;
    slaCompliance: Record<string, number>;
    averageProcessingTime: number;
}, {
    type: "email.analytics_updated";
    timestamp: Date;
    totalEmails: number;
    workflowDistribution: Record<string, number>;
    slaCompliance: Record<string, number>;
    averageProcessingTime: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.table_data_updated">;
    rowCount: z.ZodNumber;
    filters: z.ZodOptional<z.ZodAny>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.table_data_updated";
    timestamp: Date;
    rowCount: number;
    filters?: any;
}, {
    type: "email.table_data_updated";
    timestamp: Date;
    rowCount: number;
    filters?: any;
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.stats_updated">;
    stats: z.ZodObject<{
        total: z.ZodNumber;
        critical: z.ZodNumber;
        inProgress: z.ZodNumber;
        completed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        critical: number;
        completed: number;
        total: number;
        inProgress: number;
    }, {
        critical: number;
        completed: number;
        total: number;
        inProgress: number;
    }>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.stats_updated";
    timestamp: Date;
    stats: {
        critical: number;
        completed: number;
        total: number;
        inProgress: number;
    };
}, {
    type: "email.stats_updated";
    timestamp: Date;
    stats: {
        critical: number;
        completed: number;
        total: number;
        inProgress: number;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.batch_created">;
    batchId: z.ZodString;
    successCount: z.ZodNumber;
    errorCount: z.ZodNumber;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.batch_created";
    timestamp: Date;
    batchId: string;
    successCount: number;
    errorCount: number;
}, {
    type: "email.batch_created";
    timestamp: Date;
    batchId: string;
    successCount: number;
    errorCount: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.batch_status_updated">;
    emailIds: z.ZodArray<z.ZodString, "many">;
    successCount: z.ZodNumber;
    errorCount: z.ZodNumber;
    changedBy: z.ZodString;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.batch_status_updated";
    timestamp: Date;
    changedBy: string;
    emailIds: string[];
    successCount: number;
    errorCount: number;
}, {
    type: "email.batch_status_updated";
    timestamp: Date;
    changedBy: string;
    emailIds: string[];
    successCount: number;
    errorCount: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"email.batch_deleted">;
    emailIds: z.ZodArray<z.ZodString, "many">;
    successCount: z.ZodNumber;
    errorCount: z.ZodNumber;
    softDelete: z.ZodBoolean;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "email.batch_deleted";
    timestamp: Date;
    emailIds: string[];
    successCount: number;
    errorCount: number;
    softDelete: boolean;
}, {
    type: "email.batch_deleted";
    timestamp: Date;
    emailIds: string[];
    successCount: number;
    errorCount: number;
    softDelete: boolean;
}>, z.ZodObject<{
    type: z.ZodLiteral<"system.performance_warning">;
    component: z.ZodString;
    metric: z.ZodString;
    value: z.ZodNumber;
    threshold: z.ZodNumber;
    severity: z.ZodEnum<["warning", "critical"]>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "system.performance_warning";
    timestamp: Date;
    value: number;
    component: string;
    metric: string;
    threshold: number;
    severity: "critical" | "warning";
}, {
    type: "system.performance_warning";
    timestamp: Date;
    value: number;
    component: string;
    metric: string;
    threshold: number;
    severity: "critical" | "warning";
}>, z.ZodObject<{
    type: z.ZodLiteral<"walmart.price_update">;
    productId: z.ZodString;
    currentPrice: z.ZodNumber;
    previousPrice: z.ZodNumber;
    percentChange: z.ZodNumber;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "walmart.price_update";
    timestamp: Date;
    productId: string;
    currentPrice: number;
    previousPrice: number;
    percentChange: number;
}, {
    type: "walmart.price_update";
    timestamp: Date;
    productId: string;
    currentPrice: number;
    previousPrice: number;
    percentChange: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"walmart.stock_update">;
    productId: z.ZodString;
    inStock: z.ZodBoolean;
    quantity: z.ZodOptional<z.ZodNumber>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "walmart.stock_update";
    timestamp: Date;
    productId: string;
    inStock: boolean;
    quantity?: number | undefined;
}, {
    type: "walmart.stock_update";
    timestamp: Date;
    productId: string;
    inStock: boolean;
    quantity?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"walmart.deal_alert">;
    dealId: z.ZodString;
    dealDetails: z.ZodAny;
    affectedProducts: z.ZodArray<z.ZodString, "many">;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "walmart.deal_alert";
    timestamp: Date;
    dealId: string;
    affectedProducts: string[];
    dealDetails?: any;
}, {
    type: "walmart.deal_alert";
    timestamp: Date;
    dealId: string;
    affectedProducts: string[];
    dealDetails?: any;
}>, z.ZodObject<{
    type: z.ZodLiteral<"walmart.cart_sync">;
    cartData: z.ZodAny;
    sourceClientId: z.ZodString;
    timestamp: z.ZodDate;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "walmart.cart_sync";
    timestamp: Date;
    userId: string;
    sourceClientId: string;
    cartData?: any;
}, {
    type: "walmart.cart_sync";
    timestamp: Date;
    userId: string;
    sourceClientId: string;
    cartData?: any;
}>, z.ZodObject<{
    type: z.ZodLiteral<"walmart.recommendation">;
    recommendations: z.ZodArray<z.ZodAny, "many">;
    preferences: z.ZodAny;
    timestamp: z.ZodDate;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "walmart.recommendation";
    timestamp: Date;
    userId: string;
    recommendations: any[];
    preferences?: any;
}, {
    type: "walmart.recommendation";
    timestamp: Date;
    userId: string;
    recommendations: any[];
    preferences?: any;
}>]>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export declare class WebSocketService extends EventEmitter {
    private clients;
    private subscriptions;
    private healthInterval;
    private authenticatedClients;
    private clientPermissions;
    private messageQueue;
    private throttledBroadcasts;
    private throttleTimers;
    private performanceMetrics;
    private readonly MAX_QUEUE_SIZE;
    private readonly MAX_MESSAGE_HISTORY;
    private connectionHealthChecks;
    private retryAttempts;
    constructor();
    /**
     * Register a WebSocket client
     */
    registerClient(clientId: string, ws: AuthenticatedWebSocket): void;
    /**
     * Unregister a WebSocket client
     */
    unregisterClient(clientId: string, ws: AuthenticatedWebSocket): void;
    /**
     * Subscribe a client to specific message types
     */
    subscribe(clientId: string, types: string[]): void;
    /**
     * Unsubscribe a client from specific message types
     */
    unsubscribe(clientId: string, types: string[]): void;
    /**
     * Broadcast a message to all subscribed clients
     */
    broadcast(message: WebSocketMessage, requiredPermission?: string): void;
    /**
     * Send a message to a specific client
     */
    sendToClient(clientId: string, message: WebSocketMessage): void;
    /**
     * Send a message to a specific user (alias for sendToClient for backward compatibility)
     */
    sendToUser(userId: string, message: WebSocketMessage): void;
    /**
     * Get the number of connected clients
     */
    getClientCount(): number;
    /**
     * Get client subscription info
     */
    getClientSubscriptions(clientId: string): string[];
    /**
     * Check if a client has a specific permission
     */
    hasPermission(clientId: string, permission: string): boolean;
    /**
     * Get authenticated client info
     */
    getAuthenticatedClient(clientId: string): AuthenticatedWebSocket | undefined;
    /**
     * Check if client is authenticated
     */
    isClientAuthenticated(clientId: string): boolean;
    /**
     * Force disconnect a client
     */
    forceDisconnectClient(clientId: string): void;
    /**
     * Custom throttle implementation to replace lodash
     */
    private createThrottle;
    /**
     * Setup throttled broadcast functions for high-frequency updates
     */
    private setupThrottledBroadcasts;
    /**
     * Enhanced broadcast with throttling support for high-frequency updates
     */
    private broadcastThrottled;
    /**
     * Memory cleanup routine to prevent memory leaks
     */
    private startMemoryCleanup;
    /**
     * Start performance monitoring with alerts
     */
    private startPerformanceMonitoring;
    /**
     * Clean up client data completely
     */
    private cleanupClient;
    /**
     * Calculate average response time across connections
     */
    private calculateAverageResponseTime;
    /**
     * Enhanced client registration with health monitoring
     */
    registerClientEnhanced(clientId: string, ws: WebSocket): void;
    /**
     * Handle connection errors with retry logic
     */
    private handleConnectionError;
    /**
     * Get enhanced performance metrics
     */
    getPerformanceMetrics(): typeof this.performanceMetrics & {
        connectionStats: ReturnType<WebSocketService['getConnectionStats']>;
    };
    /**
     * Broadcast table data updates with throttling
     */
    broadcastEmailTableDataUpdated(rowCount: number, filters?: any): void;
    /**
     * Broadcast dashboard stats updates with throttling
     */
    broadcastEmailStatsUpdated(stats: {
        total: number;
        critical: number;
        inProgress: number;
        completed: number;
    }): void;
    /**
     * Broadcast batch creation events
     */
    broadcastEmailBatchCreated(batchId: string, successCount: number, errorCount: number): void;
    /**
     * Broadcast batch status updates
     */
    broadcastEmailBatchStatusUpdated(emailIds: string[], successCount: number, errorCount: number, changedBy: string): void;
    /**
     * Broadcast batch deletion events
     */
    broadcastEmailBatchDeleted(emailIds: string[], successCount: number, errorCount: number, softDelete: boolean): void;
    /**
     * Broadcast performance warnings
     */
    broadcastPerformanceWarning(component: string, metric: string, value: number, threshold: number, severity: "warning" | "critical"): void;
    broadcastAgentStatus(agentId: string, status: "idle" | "busy" | "error" | "terminated"): void;
    broadcastAgentTask(agentId: string, taskId: string, status: "started" | "completed" | "failed", result?: any, error?: string): void;
    broadcastPlanUpdate(planId: string, status: "created" | "executing" | "completed" | "failed" | "replanned", progress?: {
        completed: number;
        total: number;
        currentStep?: string;
    }): void;
    broadcastChatMessage(conversationId: string, message: {
        role: "user" | "assistant" | "system";
        content: string;
        metadata?: any;
    }): void;
    broadcastTaskUpdate(taskId: string, status: "queued" | "executing" | "completed" | "failed", progress?: number, result?: any, error?: string): void;
    broadcastRAGOperation(operation: "indexing" | "searching" | "embedding", status: "started" | "completed" | "failed", details?: {
        documentCount?: number;
        chunkCount?: number;
        duration?: number;
        error?: string;
    }): void;
    broadcastSystemHealth(services: Record<string, "healthy" | "degraded" | "down" | "connected" | "disconnected" | "error" | "timeout">, metrics?: {
        cpu?: number;
        memory?: number;
        activeAgents?: number;
        queueLength?: number;
        responseTime?: number;
        uptime?: number;
    }): void;
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
    }): void;
    broadcastAgentPerformance(agentId: string, metrics: {
        tasksCompleted: number;
        averageResponseTime: number;
        errorRate: number;
        lastActivity: Date;
    }): void;
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
    };
    /**
     * Emit email update event for assignment changes
     */
    emitEmailUpdate(event: {
        type: 'update' | 'delete' | 'create';
        email?: any;
        emailId?: string;
    }): void;
    broadcastEmailAnalyzed(emailId: string, workflow: string, priority: "Critical" | "High" | "Medium" | "Low", actionSummary: string, confidence: number, slaStatus: "on-track" | "at-risk" | "overdue", state: string): void;
    broadcastEmailStateChanged(emailId: string, oldState: string, newState: string, changedBy?: string): void;
    broadcastEmailBulkUpdate(action: string, emailIds: string[], results: {
        successful: number;
        failed: number;
        total: number;
    }): void;
    broadcastEmailSLAAlert(emailId: string, workflow: string, priority: "Critical" | "High" | "Medium" | "Low", slaStatus: "at-risk" | "overdue", timeRemaining?: number, overdueDuration?: number): void;
    broadcastEmailAnalyticsUpdated(totalEmails: number, workflowDistribution: Record<string, number>, slaCompliance: Record<string, number>, averageProcessingTime: number): void;
    /**
     * Start periodic health broadcasts
     */
    startHealthMonitoring(intervalMs?: number): void;
    /**
     * Stop health monitoring
     */
    stopHealthMonitoring(): void;
}
export declare const wsService: WebSocketService;
//# sourceMappingURL=WebSocketService.d.ts.map