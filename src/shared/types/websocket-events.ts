/**
 * WebSocket Event Type Definitions
 * Strongly typed event interfaces for all WebSocket communications
 */

import type {
  EmailRecord,
  EmailPriority,
  EmailWorkflowState,
  EmailSLAStatus,
} from './email.js';

// =====================================================
// Base Event Interfaces
// =====================================================

export interface BaseWebSocketEvent {
  id: string;
  timestamp: Date;
  source?: string;
  userId?: string;
  sessionId?: string;
}

export interface WebSocketError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable?: boolean;
}

// =====================================================
// Email Event Interfaces
// =====================================================

export interface EmailCreatedEvent extends BaseWebSocketEvent {
  type: 'email:created';
  data: {
    email: EmailRecord;
    source: 'manual' | 'auto' | 'import';
  };
}

export interface EmailUpdatedEvent extends BaseWebSocketEvent {
  type: 'email:updated';
  data: {
    emailId: string;
    updates: Partial<EmailRecord>;
    previousValues?: Partial<EmailRecord>;
    changedBy?: string;
  };
}

export interface EmailAnalyzedEvent extends BaseWebSocketEvent {
  type: 'email:analyzed';
  data: {
    emailId: string;
    workflow: string;
    priority: EmailPriority;
    actionSummary: string;
    confidence: number;
    slaStatus: EmailSLAStatus;
    state: EmailWorkflowState;
    analysisPhase: 1 | 2 | 3;
    modelUsed: string;
  };
}

export interface EmailStateChangedEvent extends BaseWebSocketEvent {
  type: 'email:state_changed';
  data: {
    emailId: string;
    oldState: EmailWorkflowState;
    newState: EmailWorkflowState;
    changedBy?: string;
    reason?: string;
  };
}

export interface EmailBulkUpdateEvent extends BaseWebSocketEvent {
  type: 'email:bulk_update';
  data: {
    action: 'status_change' | 'assign' | 'archive' | 'delete';
    emailIds: string[];
    results: {
      successful: number;
      failed: number;
      total: number;
      errors?: Array<{ emailId: string; error: string }>;
    };
  };
}

export interface EmailSLAAlertEvent extends BaseWebSocketEvent {
  type: 'email:sla_alert';
  data: {
    emailId: string;
    workflow: string;
    priority: EmailPriority;
    slaStatus: 'at-risk' | 'overdue';
    timeRemaining?: number; // minutes
    overdueDuration?: number; // minutes
    deadline: Date;
  };
}

export interface EmailAnalyticsUpdatedEvent extends BaseWebSocketEvent {
  type: 'email:analytics_updated';
  data: {
    totalEmails: number;
    workflowDistribution: Record<string, number>;
    slaCompliance: Record<string, number>;
    averageProcessingTime: number;
    criticalAlerts: Array<{
      id: string;
      message: string;
      severity: 'warning' | 'critical';
    }>;
  };
}

export interface EmailTableDataUpdatedEvent extends BaseWebSocketEvent {
  type: 'email:table_data_updated';
  data: {
    rowCount: number;
    pageSize: number;
    currentPage: number;
    filters?: Record<string, unknown>;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

export interface EmailStatsUpdatedEvent extends BaseWebSocketEvent {
  type: 'email:stats_updated';
  data: {
    stats: {
      total: number;
      critical: number;
      inProgress: number;
      completed: number;
      pendingAssignment: number;
      todaysCount: number;
    };
  };
}

export interface EmailBatchCreatedEvent extends BaseWebSocketEvent {
  type: 'email:batch_created';
  data: {
    batchId: string;
    successCount: number;
    errorCount: number;
    source: 'manual' | 'auto' | 'import';
    totalSize: number;
  };
}

export interface EmailBatchStatusUpdatedEvent extends BaseWebSocketEvent {
  type: 'email:batch_status_updated';
  data: {
    emailIds: string[];
    successCount: number;
    errorCount: number;
    changedBy: string;
    newStatus: EmailWorkflowState;
  };
}

export interface EmailBatchDeletedEvent extends BaseWebSocketEvent {
  type: 'email:batch_deleted';
  data: {
    emailIds: string[];
    successCount: number;
    errorCount: number;
    softDelete: boolean;
    deletedBy: string;
  };
}

// =====================================================
// Workflow Event Interfaces
// =====================================================

export interface WorkflowTaskCreatedEvent extends BaseWebSocketEvent {
  type: 'workflow:task:created';
  data: {
    taskId: string;
    category: string;
    status: string;
    priority: string;
    owner: string;
    value: number;
    emailId: string;
  };
}

export interface WorkflowTaskUpdatedEvent extends BaseWebSocketEvent {
  type: 'workflow:task:updated';
  data: {
    taskId: string;
    updates: Record<string, unknown>;
    previousValues?: Record<string, unknown>;
  };
}

export interface WorkflowTaskCompletedEvent extends BaseWebSocketEvent {
  type: 'workflow:task:completed';
  data: {
    taskId: string;
    completedBy: string;
    completionTime: Date;
    outcome: string;
  };
}

export interface WorkflowStatusChangedEvent extends BaseWebSocketEvent {
  type: 'workflow:status:changed';
  data: {
    taskId: string;
    oldStatus: string;
    newStatus: string;
    changedBy?: string;
    reason?: string;
  };
}

export interface WorkflowSLAWarningEvent extends BaseWebSocketEvent {
  type: 'workflow:sla:warning';
  data: {
    taskId: string;
    title: string;
    owner: string;
    deadline: Date;
    hoursRemaining: number;
    severity: 'WARNING' | 'CRITICAL';
  };
}

export interface WorkflowSLAViolatedEvent extends BaseWebSocketEvent {
  type: 'workflow:sla:violated';
  data: {
    taskId: string;
    title: string;
    owner: string;
    deadline: Date;
    hoursOverdue: number;
    severity: 'VIOLATED';
  };
}

export interface WorkflowMetricsUpdatedEvent extends BaseWebSocketEvent {
  type: 'workflow:metrics:updated';
  data: {
    executive: {
      total_tasks: number;
      red_tasks: number;
      yellow_tasks: number;
      green_tasks: number;
      completed_tasks: number;
      revenue_at_risk: number;
      sla_violations: number;
    };
    categories?: Array<{
      workflow_category: string;
      count: number;
      critical_count: number;
      avg_value: number;
    }>;
    owners?: Array<{
      current_owner: string;
      active_tasks: number;
      critical_tasks: number;
      total_value: number;
    }>;
  };
}

// =====================================================
// System Event Interfaces
// =====================================================

export interface SystemHealthEvent extends BaseWebSocketEvent {
  type: 'system:health';
  data: {
    services: Record<string, 'healthy' | 'degraded' | 'down'>;
    metrics?: {
      cpu?: number;
      memory?: number;
      activeAgents?: number;
      queueLength?: number;
      responseTime?: number;
      uptime?: number;
    };
  };
}

export interface SystemMetricsEvent extends BaseWebSocketEvent {
  type: 'system:metrics';
  data: {
    metrics: {
      memoryUsage: {
        used: number;
        total: number;
        percentage: number;
      };
      cpuUsage?: number;
      activeConnections: number;
      requestsPerMinute?: number;
      responseTime: number;
    };
  };
}

export interface SystemPerformanceWarningEvent extends BaseWebSocketEvent {
  type: 'system:performance_warning';
  data: {
    component: string;
    metric: string;
    value: number;
    threshold: number;
    severity: 'warning' | 'critical';
  };
}

// =====================================================
// Agent Event Interfaces
// =====================================================

export interface AgentStatusEvent extends BaseWebSocketEvent {
  type: 'agent:status';
  data: {
    agentId: string;
    status: 'idle' | 'busy' | 'error' | 'terminated';
    currentTask?: string;
  };
}

export interface AgentTaskEvent extends BaseWebSocketEvent {
  type: 'agent:task';
  data: {
    agentId: string;
    taskId: string;
    status: 'started' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
  };
}

export interface AgentPerformanceEvent extends BaseWebSocketEvent {
  type: 'agent:performance';
  data: {
    agentId: string;
    metrics: {
      tasksCompleted: number;
      averageResponseTime: number;
      errorRate: number;
      lastActivity: Date;
    };
  };
}

// =====================================================
// Connection Event Interfaces
// =====================================================

export interface ConnectionEvent extends BaseWebSocketEvent {
  type: 'connect' | 'disconnect' | 'reconnect';
  data: {
    connectionId: string;
    attempt?: number;
    maxAttempts?: number;
    reason?: string;
  };
}

export interface SubscriptionEvent extends BaseWebSocketEvent {
  type: 'subscribe' | 'unsubscribe' | 'subscription:success' | 'subscription:error';
  data: {
    channel: string;
    success?: boolean;
    error?: WebSocketError;
  };
}

// =====================================================
// Union Types for Event Handling
// =====================================================

export type EmailWebSocketEvent =
  | EmailCreatedEvent
  | EmailUpdatedEvent
  | EmailAnalyzedEvent
  | EmailStateChangedEvent
  | EmailBulkUpdateEvent
  | EmailSLAAlertEvent
  | EmailAnalyticsUpdatedEvent
  | EmailTableDataUpdatedEvent
  | EmailStatsUpdatedEvent
  | EmailBatchCreatedEvent
  | EmailBatchStatusUpdatedEvent
  | EmailBatchDeletedEvent;

export type WorkflowWebSocketEvent =
  | WorkflowTaskCreatedEvent
  | WorkflowTaskUpdatedEvent
  | WorkflowTaskCompletedEvent
  | WorkflowStatusChangedEvent
  | WorkflowSLAWarningEvent
  | WorkflowSLAViolatedEvent
  | WorkflowMetricsUpdatedEvent;

export type SystemWebSocketEvent =
  | SystemHealthEvent
  | SystemMetricsEvent
  | SystemPerformanceWarningEvent;

export type AgentWebSocketEvent =
  | AgentStatusEvent
  | AgentTaskEvent
  | AgentPerformanceEvent;

export type ConnectionWebSocketEvent =
  | ConnectionEvent
  | SubscriptionEvent;

export type WebSocketEvent =
  | EmailWebSocketEvent
  | WorkflowWebSocketEvent
  | SystemWebSocketEvent
  | AgentWebSocketEvent
  | ConnectionWebSocketEvent;

// =====================================================
// Event Handler Types
// =====================================================

export type WebSocketEventHandler<T extends WebSocketEvent = WebSocketEvent> = (
  event: T
) => void | Promise<void>;

export interface WebSocketEventHandlers {
  // Email handlers
  onEmailCreated?: WebSocketEventHandler<EmailCreatedEvent>;
  onEmailUpdated?: WebSocketEventHandler<EmailUpdatedEvent>;
  onEmailAnalyzed?: WebSocketEventHandler<EmailAnalyzedEvent>;
  onEmailStateChanged?: WebSocketEventHandler<EmailStateChangedEvent>;
  onEmailBulkUpdate?: WebSocketEventHandler<EmailBulkUpdateEvent>;
  onEmailSLAAlert?: WebSocketEventHandler<EmailSLAAlertEvent>;
  onEmailAnalyticsUpdated?: WebSocketEventHandler<EmailAnalyticsUpdatedEvent>;
  onEmailTableDataUpdated?: WebSocketEventHandler<EmailTableDataUpdatedEvent>;
  onEmailStatsUpdated?: WebSocketEventHandler<EmailStatsUpdatedEvent>;
  onEmailBatchCreated?: WebSocketEventHandler<EmailBatchCreatedEvent>;
  onEmailBatchStatusUpdated?: WebSocketEventHandler<EmailBatchStatusUpdatedEvent>;
  onEmailBatchDeleted?: WebSocketEventHandler<EmailBatchDeletedEvent>;

  // Workflow handlers
  onWorkflowTaskCreated?: WebSocketEventHandler<WorkflowTaskCreatedEvent>;
  onWorkflowTaskUpdated?: WebSocketEventHandler<WorkflowTaskUpdatedEvent>;
  onWorkflowTaskCompleted?: WebSocketEventHandler<WorkflowTaskCompletedEvent>;
  onWorkflowStatusChanged?: WebSocketEventHandler<WorkflowStatusChangedEvent>;
  onWorkflowSLAWarning?: WebSocketEventHandler<WorkflowSLAWarningEvent>;
  onWorkflowSLAViolated?: WebSocketEventHandler<WorkflowSLAViolatedEvent>;
  onWorkflowMetricsUpdated?: WebSocketEventHandler<WorkflowMetricsUpdatedEvent>;

  // System handlers
  onSystemHealth?: WebSocketEventHandler<SystemHealthEvent>;
  onSystemMetrics?: WebSocketEventHandler<SystemMetricsEvent>;
  onSystemPerformanceWarning?: WebSocketEventHandler<SystemPerformanceWarningEvent>;

  // Agent handlers
  onAgentStatus?: WebSocketEventHandler<AgentStatusEvent>;
  onAgentTask?: WebSocketEventHandler<AgentTaskEvent>;
  onAgentPerformance?: WebSocketEventHandler<AgentPerformanceEvent>;

  // Connection handlers
  onConnect?: WebSocketEventHandler<ConnectionEvent>;
  onDisconnect?: WebSocketEventHandler<ConnectionEvent>;
  onReconnect?: WebSocketEventHandler<ConnectionEvent>;
  onSubscribe?: WebSocketEventHandler<SubscriptionEvent>;
  onUnsubscribe?: WebSocketEventHandler<SubscriptionEvent>;
  onSubscriptionSuccess?: WebSocketEventHandler<SubscriptionEvent>;
  onSubscriptionError?: WebSocketEventHandler<SubscriptionEvent>;

  // Generic handler for any event
  onEvent?: WebSocketEventHandler<WebSocketEvent>;
}

// =====================================================
// Type Guards
// =====================================================

export const isEmailEvent = (event: WebSocketEvent): event is EmailWebSocketEvent => {
  return event?.type?.startsWith('email:');
};

export const isWorkflowEvent = (event: WebSocketEvent): event is WorkflowWebSocketEvent => {
  return event?.type?.startsWith('workflow:');
};

export const isSystemEvent = (event: WebSocketEvent): event is SystemWebSocketEvent => {
  return event?.type?.startsWith('system:');
};

export const isAgentEvent = (event: WebSocketEvent): event is AgentWebSocketEvent => {
  return event?.type?.startsWith('agent:');
};

export const isConnectionEvent = (event: WebSocketEvent): event is ConnectionWebSocketEvent => {
  return ['connect', 'disconnect', 'reconnect', 'subscribe', 'unsubscribe'].includes(event.type) ||
    event?.type?.startsWith('subscription:');
};

// =====================================================
// Utility Types
// =====================================================

export type ExtractEventData<T extends WebSocketEvent> = T extends { data: infer D } ? D : never;

export type EventTypeToEvent<T extends WebSocketEvent['type']> = Extract<WebSocketEvent, { type: T }>;