import type { WebSocketManager } from "./WebSocketManager.js";
import { logger } from "../../utils/logger.js";

/**
 * Workflow-specific WebSocket event types
 */
export enum WorkflowEvents {
  // Task lifecycle events
  TASK_CREATED = "workflow:task:created",
  TASK_UPDATED = "workflow:task:updated",
  TASK_COMPLETED = "workflow:task:completed",
  TASK_DELETED = "workflow:task:deleted",
  
  // Status change events
  STATUS_CHANGED = "workflow:status:changed",
  OWNER_CHANGED = "workflow:owner:changed",
  PRIORITY_CHANGED = "workflow:priority:changed",
  
  // SLA events
  SLA_WARNING = "workflow:sla:warning",
  SLA_VIOLATED = "workflow:sla:violated",
  SLA_MET = "workflow:sla:met",
  
  // Metrics events
  METRICS_UPDATED = "workflow:metrics:updated",
  CATEGORY_STATS_UPDATED = "workflow:category:updated",
  OWNER_WORKLOAD_UPDATED = "workflow:owner:updated",
  
  // Batch events
  BATCH_CREATED = "workflow:batch:created",
  BATCH_COMPLETED = "workflow:batch:completed",
  
  // System events
  SYNC_STARTED = "workflow:sync:started",
  SYNC_COMPLETED = "workflow:sync:completed",
  ANALYSIS_STARTED = "workflow:analysis:started",
  ANALYSIS_COMPLETED = "workflow:analysis:completed"
}

interface WorkflowTaskEvent {
  taskId: string;
  category?: string;
  status?: string;
  priority?: string;
  owner?: string;
  value?: number;
  timestamp?: string;
}

interface WorkflowStatusChangeEvent {
  taskId: string;
  oldStatus: string;
  newStatus: string;
  changedBy?: string;
  reason?: string;
  timestamp?: string;
}

interface WorkflowSLAEvent {
  taskId: string;
  title: string;
  owner: string;
  deadline: string;
  hoursRemaining?: number;
  hoursOverdue?: number;
  severity: "WARNING" | "CRITICAL" | "VIOLATED";
}

interface WorkflowMetricsEvent {
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
  timestamp: string;
}

interface WorkflowBatchEvent {
  batchId: string;
  emailCount: number;
  tasksCreated: number;
  processingTime: number;
  status: "started" | "completed" | "failed";
  errors?: string[];
}

/**
 * Handler for workflow-specific WebSocket events
 */
export class WorkflowWebSocketHandler {
  constructor(private wsManager: WebSocketManager) {}
  
  /**
   * Broadcast task created event
   */
  broadcastTaskCreated(task: WorkflowTaskEvent): void {
    logger.info("Broadcasting task created", "WORKFLOW_WS", { taskId: task.taskId });
    this.wsManager.broadcast(WorkflowEvents.TASK_CREATED, {
      ...task,
      timestamp: task.timestamp || new Date().toISOString()
    });
  }
  
  /**
   * Broadcast task updated event
   */
  broadcastTaskUpdated(taskId: string, updates: Partial<WorkflowTaskEvent>): void {
    logger.info("Broadcasting task updated", "WORKFLOW_WS", { taskId, updates });
    this.wsManager.broadcast(WorkflowEvents.TASK_UPDATED, {
      taskId,
      updates,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Broadcast task completed event
   */
  broadcastTaskCompleted(task: WorkflowTaskEvent): void {
    logger.info("Broadcasting task completed", "WORKFLOW_WS", { taskId: task.taskId });
    this.wsManager.broadcast(WorkflowEvents.TASK_COMPLETED, {
      ...task,
      timestamp: task.timestamp || new Date().toISOString()
    });
  }
  
  /**
   * Broadcast status change event
   */
  broadcastStatusChanged(event: WorkflowStatusChangeEvent): void {
    logger.info("Broadcasting status change", "WORKFLOW_WS", {
      taskId: event.taskId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus
    });
    
    this.wsManager.broadcast(WorkflowEvents.STATUS_CHANGED, {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    });
    
    // If status changed to COMPLETED, also broadcast task completed
    if (event.newStatus === "COMPLETED") {
      this.broadcastTaskCompleted({ taskId: event.taskId, status: "COMPLETED" });
    }
  }
  
  /**
   * Broadcast SLA warning event
   */
  broadcastSLAWarning(event: WorkflowSLAEvent): void {
    logger.warn("Broadcasting SLA warning", "WORKFLOW_WS", {
      taskId: event.taskId,
      hoursRemaining: event.hoursRemaining,
      severity: event.severity
    });
    
    this.wsManager.broadcast(WorkflowEvents.SLA_WARNING, event);
  }
  
  /**
   * Broadcast SLA violation event
   */
  broadcastSLAViolated(event: WorkflowSLAEvent): void {
    logger.error("Broadcasting SLA violation", "WORKFLOW_WS", {
      taskId: event.taskId,
      hoursOverdue: event.hoursOverdue
    });
    
    this.wsManager.broadcast(WorkflowEvents.SLA_VIOLATED, event);
  }
  
  /**
   * Broadcast metrics update event
   */
  broadcastMetricsUpdated(metrics: WorkflowMetricsEvent): void {
    logger.info("Broadcasting metrics update", "WORKFLOW_WS", {
      totalTasks: metrics.executive.total_tasks,
      criticalTasks: metrics.executive.red_tasks
    });
    
    this.wsManager.broadcast(WorkflowEvents.METRICS_UPDATED, metrics);
  }
  
  /**
   * Broadcast batch processing events
   */
  broadcastBatchEvent(event: WorkflowBatchEvent): void {
    const eventType = event.status === "started" 
      ? WorkflowEvents.BATCH_STARTED 
      : WorkflowEvents.BATCH_COMPLETED;
      
    logger.info(`Broadcasting batch ${event.status}`, "WORKFLOW_WS", {
      batchId: event.batchId,
      emailCount: event.emailCount,
      tasksCreated: event.tasksCreated
    });
    
    this.wsManager.broadcast(eventType, event);
  }
  
  /**
   * Broadcast sync events
   */
  broadcastSyncEvent(status: "started" | "completed", details?: any): void {
    const eventType = status === "started" 
      ? WorkflowEvents.SYNC_STARTED 
      : WorkflowEvents.SYNC_COMPLETED;
      
    logger.info(`Broadcasting sync ${status}`, "WORKFLOW_WS");
    
    this.wsManager.broadcast(eventType, {
      status,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
  
  /**
   * Broadcast analysis events
   */
  broadcastAnalysisEvent(emailId: string, phase: number, status: "started" | "completed"): void {
    const eventType = status === "started" 
      ? WorkflowEvents.ANALYSIS_STARTED 
      : WorkflowEvents.ANALYSIS_COMPLETED;
      
    logger.info(`Broadcasting analysis ${status}`, "WORKFLOW_WS", {
      emailId,
      phase
    });
    
    this.wsManager.broadcast(eventType, {
      emailId,
      phase,
      status,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Broadcast critical alert for high-priority events
   */
  broadcastCriticalAlert(taskId: string, message: string, details?: any): void {
    logger.error("Broadcasting critical alert", "WORKFLOW_WS", {
      taskId,
      message
    });
    
    this.wsManager.broadcast("workflow:critical:alert", {
      taskId,
      message,
      severity: "CRITICAL",
      timestamp: new Date().toISOString(),
      ...details
    });
  }
}