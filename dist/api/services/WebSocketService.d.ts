import { EventEmitter } from "events";
import type { WebSocket } from "ws";
import { z } from "zod";
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
    operation: "indexing" | "searching" | "embedding";
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
    operation: "indexing" | "searching" | "embedding";
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
}>]>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export declare class WebSocketService extends EventEmitter {
    private clients;
    private subscriptions;
    private healthInterval;
    constructor();
    /**
     * Register a WebSocket client
     */
    registerClient(clientId: string, ws: WebSocket): void;
    /**
     * Unregister a WebSocket client
     */
    unregisterClient(clientId: string, ws: WebSocket): void;
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
    broadcast(message: WebSocketMessage): void;
    /**
     * Send a message to a specific client
     */
    sendToClient(clientId: string, message: WebSocketMessage): void;
    /**
     * Get the number of connected clients
     */
    getClientCount(): number;
    /**
     * Get client subscription info
     */
    getClientSubscriptions(clientId: string): string[];
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
        subscriptionStats: Record<string, number>;
    };
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