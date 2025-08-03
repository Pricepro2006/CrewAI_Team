/**
 * Email WebSocket Event Emitter Service
 * Centralized service for emitting email-related WebSocket events
 * with proper typing and async handling
 */

import { wsService } from './WebSocketService';
import type {
  EmailCreatedEvent,
  EmailUpdatedEvent,
  EmailAnalyzedEvent,
  EmailStateChangedEvent,
  EmailBulkUpdateEvent,
  EmailSLAAlertEvent,
  EmailAnalyticsUpdatedEvent,
  EmailTableDataUpdatedEvent,
  EmailStatsUpdatedEvent,
  EmailBatchCreatedEvent,
  EmailBatchStatusUpdatedEvent,
  EmailBatchDeletedEvent,
} from '../../shared/types/websocket-events';
import type {
  EmailRecord,
  EmailPriority,
  EmailWorkflowState,
  EmailSLAStatus,
} from '../../shared/types/email';
import { logger } from '../../utils/logger';

export class EmailWebSocketEmitter {
  private static instance: EmailWebSocketEmitter;

  private constructor() {}

  static getInstance(): EmailWebSocketEmitter {
    if (!EmailWebSocketEmitter.instance) {
      EmailWebSocketEmitter.instance = new EmailWebSocketEmitter();
    }
    return EmailWebSocketEmitter.instance;
  }

  /**
   * Map lowercase priority to capitalized priority for WebSocket service
   */
  private mapPriorityToCapitalized(priority: EmailPriority): "Critical" | "High" | "Medium" | "Low" {
    const priorityMap: Record<EmailPriority, "Critical" | "High" | "Medium" | "Low"> = {
      'critical': 'Critical',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };
    return priorityMap[priority] || 'Medium';
  }

  /**
   * Emit email created event
   */
  async emitEmailCreated(
    email: EmailRecord,
    source: 'manual' | 'auto' | 'import' = 'auto'
  ): Promise<void> {
    try {
      const event: EmailCreatedEvent = {
        id: crypto.randomUUID(),
        type: 'email:created',
        timestamp: new Date(),
        data: {
          email,
          source,
        },
      };

      wsService.broadcast({
        type: 'email.created',
        ...event.data,
        timestamp: event.timestamp,
      } as any);

      logger.info('Email created event emitted', 'EMAIL_WS', {
        emailId: email.id,
        source,
      });
    } catch (error) {
      logger.error('Failed to emit email created event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit email updated event
   */
  async emitEmailUpdated(
    emailId: string,
    updates: Partial<EmailRecord>,
    previousValues?: Partial<EmailRecord>,
    changedBy?: string
  ): Promise<void> {
    try {
      const event: EmailUpdatedEvent = {
        id: crypto.randomUUID(),
        type: 'email:updated',
        timestamp: new Date(),
        userId: changedBy,
        data: {
          emailId,
          updates,
          previousValues,
          changedBy,
        },
      };

      wsService.broadcast({
        type: 'email.updated',
        ...event.data,
        timestamp: event.timestamp,
      } as any);

      // Also emit table data updated for UI refresh
      await this.emitTableDataUpdated();

      logger.info('Email updated event emitted', 'EMAIL_WS', {
        emailId,
        updatedFields: Object.keys(updates),
      });
    } catch (error) {
      logger.error('Failed to emit email updated event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit email analyzed event
   */
  async emitEmailAnalyzed(
    emailId: string,
    analysis: {
      workflow: string;
      priority: EmailPriority;
      actionSummary: string;
      confidence: number;
      slaStatus: EmailSLAStatus;
      state: EmailWorkflowState;
      analysisPhase: 1 | 2 | 3;
      modelUsed: string;
    }
  ): Promise<void> {
    try {
      const event: EmailAnalyzedEvent = {
        id: crypto.randomUUID(),
        type: 'email:analyzed',
        timestamp: new Date(),
        data: {
          emailId,
          ...analysis,
        },
      };

      wsService.broadcastEmailAnalyzed(
        emailId,
        analysis.workflow,
        this.mapPriorityToCapitalized(analysis.priority),
        analysis.actionSummary,
        analysis.confidence,
        analysis.slaStatus,
        analysis.state
      );

      // Update stats after analysis
      await this.emitStatsUpdated();

      logger.info('Email analyzed event emitted', 'EMAIL_WS', {
        emailId,
        workflow: analysis.workflow,
        phase: analysis.analysisPhase,
      });
    } catch (error) {
      logger.error('Failed to emit email analyzed event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit email state changed event
   */
  async emitEmailStateChanged(
    emailId: string,
    oldState: EmailWorkflowState,
    newState: EmailWorkflowState,
    changedBy?: string,
    reason?: string
  ): Promise<void> {
    try {
      const event: EmailStateChangedEvent = {
        id: crypto.randomUUID(),
        type: 'email:state_changed',
        timestamp: new Date(),
        userId: changedBy,
        data: {
          emailId,
          oldState,
          newState,
          changedBy,
          reason,
        },
      };

      wsService.broadcastEmailStateChanged(
        emailId,
        oldState,
        newState,
        changedBy
      );

      // Update stats after state change
      await this.emitStatsUpdated();

      logger.info('Email state changed event emitted', 'EMAIL_WS', {
        emailId,
        oldState,
        newState,
      });
    } catch (error) {
      logger.error('Failed to emit email state changed event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit email bulk update event
   */
  async emitEmailBulkUpdate(
    action: 'status_change' | 'assign' | 'archive' | 'delete',
    emailIds: string[],
    results: {
      successful: number;
      failed: number;
      errors?: Array<{ emailId: string; error: string }>;
    }
  ): Promise<void> {
    try {
      const event: EmailBulkUpdateEvent = {
        id: crypto.randomUUID(),
        type: 'email:bulk_update',
        timestamp: new Date(),
        data: {
          action,
          emailIds,
          results: {
            successful: results.successful,
            failed: results.failed,
            total: emailIds.length,
            errors: results.errors,
          },
        },
      };

      wsService.broadcastEmailBulkUpdate(
        action,
        emailIds,
        event.data.results
      );

      // Update table and stats after bulk update
      await Promise.all([
        this.emitTableDataUpdated(),
        this.emitStatsUpdated(),
      ]);

      logger.info('Email bulk update event emitted', 'EMAIL_WS', {
        action,
        total: emailIds.length,
        successful: results.successful,
        failed: results.failed,
      });
    } catch (error) {
      logger.error('Failed to emit email bulk update event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit email SLA alert event
   */
  async emitEmailSLAAlert(
    emailId: string,
    alert: {
      workflow: string;
      priority: EmailPriority;
      slaStatus: 'at-risk' | 'overdue';
      timeRemaining?: number;
      overdueDuration?: number;
      deadline: Date;
    }
  ): Promise<void> {
    try {
      const event: EmailSLAAlertEvent = {
        id: crypto.randomUUID(),
        type: 'email:sla_alert',
        timestamp: new Date(),
        data: {
          emailId,
          ...alert,
        },
      };

      wsService.broadcastEmailSLAAlert(
        emailId,
        alert.workflow,
        this.mapPriorityToCapitalized(alert.priority),
        alert.slaStatus,
        alert.timeRemaining,
        alert.overdueDuration
      );

      logger.warn('Email SLA alert event emitted', 'EMAIL_WS', {
        emailId,
        slaStatus: alert.slaStatus,
        workflow: alert.workflow,
      });
    } catch (error) {
      logger.error('Failed to emit email SLA alert event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit email analytics updated event
   */
  async emitEmailAnalyticsUpdated(analytics: {
    totalEmails: number;
    workflowDistribution: Record<string, number>;
    slaCompliance: Record<string, number>;
    averageProcessingTime: number;
    criticalAlerts?: Array<{
      id: string;
      message: string;
      severity: 'warning' | 'critical';
    }>;
  }): Promise<void> {
    try {
      const event: EmailAnalyticsUpdatedEvent = {
        id: crypto.randomUUID(),
        type: 'email:analytics_updated',
        timestamp: new Date(),
        data: {
          ...analytics,
          criticalAlerts: analytics.criticalAlerts || [],
        },
      };

      wsService.broadcastEmailAnalyticsUpdated(
        analytics.totalEmails,
        analytics.workflowDistribution,
        analytics.slaCompliance,
        analytics.averageProcessingTime
      );

      logger.info('Email analytics updated event emitted', 'EMAIL_WS', {
        totalEmails: analytics.totalEmails,
      });
    } catch (error) {
      logger.error('Failed to emit email analytics updated event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit table data updated event (throttled)
   */
  async emitTableDataUpdated(
    rowCount?: number,
    filters?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Use throttled broadcast for high-frequency updates
      wsService.broadcastEmailTableDataUpdated(rowCount || 0, filters);

      logger.debug('Email table data updated event emitted', 'EMAIL_WS');
    } catch (error) {
      logger.error('Failed to emit email table data updated event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit stats updated event (throttled)
   */
  async emitStatsUpdated(stats?: {
    total: number;
    critical: number;
    inProgress: number;
    completed: number;
  }): Promise<void> {
    try {
      if (stats) {
        wsService.broadcastEmailStatsUpdated(stats);
      } else {
        // Fetch current stats from database if not provided
        // This would need to be implemented based on your data source
        logger.debug('Stats update requested without data', 'EMAIL_WS');
      }
    } catch (error) {
      logger.error('Failed to emit email stats updated event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit batch created event
   */
  async emitBatchCreated(
    batchId: string,
    successCount: number,
    errorCount: number,
    source: 'manual' | 'auto' | 'import' = 'auto',
    totalSize: number
  ): Promise<void> {
    try {
      const event: EmailBatchCreatedEvent = {
        id: crypto.randomUUID(),
        type: 'email:batch_created',
        timestamp: new Date(),
        data: {
          batchId,
          successCount,
          errorCount,
          source,
          totalSize,
        },
      };

      wsService.broadcastEmailBatchCreated(
        batchId,
        successCount,
        errorCount
      );

      // Update stats after batch creation
      await this.emitStatsUpdated();

      logger.info('Email batch created event emitted', 'EMAIL_WS', {
        batchId,
        totalSize,
        successCount,
        errorCount,
      });
    } catch (error) {
      logger.error('Failed to emit email batch created event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit batch status updated event
   */
  async emitBatchStatusUpdated(
    emailIds: string[],
    newStatus: EmailWorkflowState,
    successCount: number,
    errorCount: number,
    changedBy: string
  ): Promise<void> {
    try {
      const event: EmailBatchStatusUpdatedEvent = {
        id: crypto.randomUUID(),
        type: 'email:batch_status_updated',
        timestamp: new Date(),
        userId: changedBy,
        data: {
          emailIds,
          successCount,
          errorCount,
          changedBy,
          newStatus,
        },
      };

      wsService.broadcastEmailBatchStatusUpdated(
        emailIds,
        successCount,
        errorCount,
        changedBy
      );

      // Update table and stats after batch status update
      await Promise.all([
        this.emitTableDataUpdated(),
        this.emitStatsUpdated(),
      ]);

      logger.info('Email batch status updated event emitted', 'EMAIL_WS', {
        emailCount: emailIds.length,
        newStatus,
        successCount,
        errorCount,
      });
    } catch (error) {
      logger.error('Failed to emit email batch status updated event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Emit batch deleted event
   */
  async emitBatchDeleted(
    emailIds: string[],
    successCount: number,
    errorCount: number,
    softDelete: boolean,
    deletedBy: string
  ): Promise<void> {
    try {
      const event: EmailBatchDeletedEvent = {
        id: crypto.randomUUID(),
        type: 'email:batch_deleted',
        timestamp: new Date(),
        userId: deletedBy,
        data: {
          emailIds,
          successCount,
          errorCount,
          softDelete,
          deletedBy,
        },
      };

      wsService.broadcastEmailBatchDeleted(
        emailIds,
        successCount,
        errorCount,
        softDelete
      );

      // Update table and stats after batch deletion
      await Promise.all([
        this.emitTableDataUpdated(),
        this.emitStatsUpdated(),
      ]);

      logger.info('Email batch deleted event emitted', 'EMAIL_WS', {
        emailCount: emailIds.length,
        softDelete,
        successCount,
        errorCount,
      });
    } catch (error) {
      logger.error('Failed to emit email batch deleted event', 'EMAIL_WS', { error });
    }
  }

  /**
   * Batch emit multiple events
   */
  async emitBatch(events: Array<() => Promise<void>>): Promise<void> {
    try {
      await Promise.all(events.map(event => event()));
    } catch (error) {
      logger.error('Failed to emit batch events', 'EMAIL_WS', { error });
    }
  }
}

// Export singleton instance
export const emailWebSocketEmitter = EmailWebSocketEmitter.getInstance();