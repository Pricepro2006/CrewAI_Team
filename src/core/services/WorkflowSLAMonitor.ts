import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";
import { WorkflowWebSocketHandler } from "../websocket/WorkflowWebSocketHandler.js";
import type { WebSocketManager } from "../websocket/WebSocketManager.js";

interface SLATask {
  task_id: string;
  title: string;
  current_owner: string;
  owner_email: string;
  sla_deadline: string;
  task_status: string;
  dollar_value: number;
  workflow_category: string;
}

interface SLAConfig {
  checkIntervalMinutes: number;
  warningThresholdHours: number;
  criticalThresholdHours: number;
  dbPath: string;
}

/**
 * Service to monitor workflow task SLAs and emit warnings/violations
 */
export class WorkflowSLAMonitor {
  private config: SLAConfig;
  private wsHandler?: WorkflowWebSocketHandler;
  private checkInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;
  
  constructor(wsManager?: WebSocketManager, config?: Partial<SLAConfig>) {
    this.config = {
      checkIntervalMinutes: 10,
      warningThresholdHours: 24,
      criticalThresholdHours: 4,
      dbPath: './data/crewai.db',
      ...config
    };
    
    if (wsManager) {
      this.wsHandler = new WorkflowWebSocketHandler(wsManager);
    }
  }
  
  /**
   * Start monitoring SLAs
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("SLA Monitor already running", "SLA_MONITOR");
      return;
    }
    
    this.isRunning = true;
    logger.info("Starting SLA Monitor", "SLA_MONITOR", {
      checkInterval: `${this.config.checkIntervalMinutes} minutes`,
      warningThreshold: `${this.config.warningThresholdHours} hours`,
      criticalThreshold: `${this.config.criticalThresholdHours} hours`
    });
    
    // Run initial check
    this.checkSLAs();
    
    // Set up periodic checks
    this.checkInterval = setInterval(
      () => this.checkSLAs(),
      this.config.checkIntervalMinutes * 60 * 1000
    );
  }
  
  /**
   * Stop monitoring SLAs
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    
    logger.info("Stopped SLA Monitor", "SLA_MONITOR");
  }
  
  /**
   * Check all active tasks for SLA status
   */
  private async checkSLAs(): Promise<void> {
    const db = new Database(this.config.dbPath);
    
    try {
      const startTime = Date.now();
      logger.info("Checking SLAs", "SLA_MONITOR");
      
      // Find tasks approaching SLA
      const approachingTasks = this.getApproachingSLATasks(db);
      
      // Find violated SLAs
      const violatedTasks = this.getViolatedSLATasks(db);
      
      // Process approaching SLAs
      for (const task of approachingTasks) {
        await this.processApproachingSLA(task, db);
      }
      
      // Process violated SLAs
      for (const task of violatedTasks) {
        await this.processViolatedSLA(task, db);
      }
      
      const duration = Date.now() - startTime;
      logger.info("SLA check completed", "SLA_MONITOR", {
        approaching: approachingTasks.length,
        violated: violatedTasks.length,
        duration: `${duration}ms`
      });
      
      // Broadcast metrics update if there were any SLA issues
      if (approachingTasks.length > 0 || violatedTasks.length > 0) {
        await this.broadcastMetricsUpdate(db);
      }
      
    } catch (error) {
      logger.error("SLA check failed", "SLA_MONITOR", { error });
    } finally {
      db.close();
    }
  }
  
  /**
   * Get tasks approaching SLA deadline
   */
  private getApproachingSLATasks(db: Database.Database): SLATask[] {
    const warningHours = this.config.warningThresholdHours;
    
    return db.prepare(`
      SELECT 
        task_id,
        title,
        current_owner,
        owner_email,
        sla_deadline,
        task_status,
        dollar_value,
        workflow_category,
        (julianday(sla_deadline) - julianday('now')) * 24 as hours_remaining
      FROM workflow_tasks
      WHERE task_status != 'COMPLETED'
        AND datetime(sla_deadline) > datetime('now')
        AND datetime(sla_deadline) < datetime('now', '+${warningHours} hours')
      ORDER BY sla_deadline
    `).all() as SLATask[];
  }
  
  /**
   * Get tasks that have violated SLA
   */
  private getViolatedSLATasks(db: Database.Database): SLATask[] {
    return db.prepare(`
      SELECT 
        task_id,
        title,
        current_owner,
        owner_email,
        sla_deadline,
        task_status,
        dollar_value,
        workflow_category,
        (julianday('now') - julianday(sla_deadline)) * 24 as hours_overdue
      FROM workflow_tasks
      WHERE task_status != 'COMPLETED'
        AND datetime(sla_deadline) < datetime('now')
        AND task_status != 'RED'
      ORDER BY sla_deadline
    `).all() as SLATask[];
  }
  
  /**
   * Process a task approaching SLA
   */
  private async processApproachingSLA(task: any, db: Database.Database): Promise<void> {
    const hoursRemaining = Math.round(task.hours_remaining);
    const severity = hoursRemaining <= this.config.criticalThresholdHours ? "CRITICAL" : "WARNING";
    
    logger.warn(`Task approaching SLA`, "SLA_MONITOR", {
      taskId: task.task_id,
      title: task.title.substring(0, 50),
      hoursRemaining,
      severity
    });
    
    // Broadcast SLA warning
    if (this.wsHandler) {
      this.wsHandler.broadcastSLAWarning({
        taskId: task.task_id,
        title: task.title,
        owner: task.current_owner,
        deadline: task.sla_deadline,
        hoursRemaining,
        severity
      });
    }
    
    // Update task status to YELLOW if it's GREEN and approaching deadline
    if (task.task_status === 'GREEN' && severity === 'WARNING') {
      this.updateTaskStatus(db, task.task_id, 'YELLOW', 'Approaching SLA deadline');
    } else if (severity === 'CRITICAL' && task.task_status !== 'RED') {
      this.updateTaskStatus(db, task.task_id, 'RED', 'Critical - SLA deadline imminent');
    }
  }
  
  /**
   * Process a task that violated SLA
   */
  private async processViolatedSLA(task: any, db: Database.Database): Promise<void> {
    const hoursOverdue = Math.round(task.hours_overdue);
    
    logger.error(`Task violated SLA`, "SLA_MONITOR", {
      taskId: task.task_id,
      title: task.title.substring(0, 50),
      hoursOverdue,
      value: task.dollar_value
    });
    
    // Update task status to RED
    this.updateTaskStatus(db, task.task_id, 'RED', `SLA violated by ${hoursOverdue} hours`);
    
    // Broadcast SLA violation
    if (this.wsHandler) {
      this.wsHandler.broadcastSLAViolated({
        taskId: task.task_id,
        title: task.title,
        owner: task.current_owner,
        deadline: task.sla_deadline,
        hoursOverdue,
        severity: "VIOLATED"
      });
      
      // Also broadcast critical alert for high-value violations
      if (task.dollar_value > 50000) {
        this.wsHandler.broadcastCriticalAlert(
          task.task_id,
          `High-value task SLA violated: $${task.dollar_value.toLocaleString()}`,
          {
            owner: task.current_owner,
            category: task.workflow_category,
            hoursOverdue
          }
        );
      }
    }
  }
  
  /**
   * Update task status in database
   */
  private updateTaskStatus(db: Database.Database, taskId: string, newStatus: string, reason: string): void {
    try {
      // Get current status
      const currentTask = db.prepare('SELECT task_status FROM workflow_tasks WHERE task_id = ?').get(taskId) as any;
      
      if (!currentTask || currentTask.task_status === newStatus) {
        return;
      }
      
      // Update task status
      db.prepare(`
        UPDATE workflow_tasks 
        SET task_status = ?, updated_at = datetime('now')
        WHERE task_id = ?
      `).run(newStatus, taskId);
      
      // Log status change
      db.prepare(`
        INSERT INTO workflow_status_history (
          task_id, old_status, new_status, changed_by, reason, changed_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(
        taskId,
        currentTask.task_status,
        newStatus,
        'SLA Monitor',
        reason
      );
      
      // Broadcast status change
      if (this.wsHandler) {
        this.wsHandler.broadcastStatusChanged({
          taskId,
          oldStatus: currentTask.task_status,
          newStatus,
          changedBy: 'SLA Monitor',
          reason
        });
      }
      
    } catch (error) {
      logger.error("Failed to update task status", "SLA_MONITOR", { taskId, error });
    }
  }
  
  /**
   * Broadcast updated metrics after SLA changes
   */
  private async broadcastMetricsUpdate(db: Database.Database): Promise<void> {
    if (!this.wsHandler) return;
    
    try {
      const metrics = db.prepare(`
        SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN task_status = 'RED' THEN 1 ELSE 0 END) as red_tasks,
          SUM(CASE WHEN task_status = 'YELLOW' THEN 1 ELSE 0 END) as yellow_tasks,
          SUM(CASE WHEN task_status = 'GREEN' THEN 1 ELSE 0 END) as green_tasks,
          SUM(CASE WHEN task_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN task_status = 'RED' THEN dollar_value ELSE 0 END) as revenue_at_risk,
          COUNT(CASE WHEN datetime(sla_deadline) < datetime('now') 
               AND task_status != 'COMPLETED' THEN 1 END) as sla_violations
        FROM workflow_tasks
        WHERE created_at > datetime('now', '-7 days')
      `).get() as any;
      
      this.wsHandler.broadcastMetricsUpdated({
        executive: metrics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error("Failed to broadcast metrics", "SLA_MONITOR", { error });
    }
  }
  
  /**
   * Get current SLA statistics
   */
  getSLAStats(): any {
    const db = new Database(this.config.dbPath);
    
    try {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_active,
          SUM(CASE WHEN datetime(sla_deadline) < datetime('now', '+24 hours') 
               AND datetime(sla_deadline) > datetime('now') THEN 1 ELSE 0 END) as approaching_24h,
          SUM(CASE WHEN datetime(sla_deadline) < datetime('now', '+4 hours') 
               AND datetime(sla_deadline) > datetime('now') THEN 1 ELSE 0 END) as critical_4h,
          SUM(CASE WHEN datetime(sla_deadline) < datetime('now') THEN 1 ELSE 0 END) as violated,
          SUM(CASE WHEN datetime(sla_deadline) < datetime('now') THEN dollar_value ELSE 0 END) as violated_value
        FROM workflow_tasks
        WHERE task_status != 'COMPLETED'
      `).get();
      
      return {
        ...stats,
        isMonitoring: this.isRunning,
        checkInterval: this.config.checkIntervalMinutes,
        lastCheck: new Date().toISOString()
      };
      
    } finally {
      db.close();
    }
  }
}