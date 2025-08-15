/**
 * Email Processing Notification Service
 * Bridges email processing events with WebSocket notifications
 */

import { emailProcessingWebSocket } from "../websocket/EmailProcessingWebSocket.js";
import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";

export interface EmailProcessingProgress {
  emailId: string;
  phase: 1 | 2 | 3;
  status: 'started' | 'completed' | 'failed';
  processingTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class EmailProcessingNotificationService {
  private static instance: EmailProcessingNotificationService;
  private dbManager: any;

  private constructor() {
    this.dbManager = getDatabaseManager();
    this.initializeStatsFromDatabase();
  }

  static getInstance(): EmailProcessingNotificationService {
    if (!EmailProcessingNotificationService.instance) {
      EmailProcessingNotificationService.instance = new EmailProcessingNotificationService();
    }
    return EmailProcessingNotificationService.instance;
  }

  /**
   * Initialize processing stats from database
   */
  private async initializeStatsFromDatabase(): Promise<void> {
    try {
      const stats = await this.dbManager.executeQuery((db: any) => {
        const totalEmails = db.prepare(`
          SELECT COUNT(*) as count FROM emails
        `).get();

        const phase1Complete = db.prepare(`
          SELECT COUNT(*) as count FROM emails 
          WHERE phase_1_results IS NOT NULL AND phase_1_results != '{}'
        `).get();

        const phase2Complete = db.prepare(`
          SELECT COUNT(*) as count FROM emails 
          WHERE phase_2_results IS NOT NULL AND phase_2_results != '{}'
        `).get();

        const phase3Complete = db.prepare(`
          SELECT COUNT(*) as count FROM emails 
          WHERE phase_3_results IS NOT NULL AND phase_3_results != '{}'
        `).get();

        const processedEmails = db.prepare(`
          SELECT COUNT(*) as count FROM emails 
          WHERE (phase_2_results IS NOT NULL AND phase_2_results != '{}') 
             OR (phase_3_results IS NOT NULL AND phase_3_results != '{}')
        `).get();

        return {
          totalEmails: totalEmails.count,
          phase1Complete: phase1Complete.count,
          phase2Complete: phase2Complete.count,
          phase3Complete: phase3Complete.count,
          processedEmails: processedEmails.count,
        };
      });

      emailProcessingWebSocket.updateStats({
        totalEmails: stats.totalEmails,
        processedEmails: stats.processedEmails,
        phase1Complete: stats.phase1Complete,
        phase2Complete: stats.phase2Complete,
        phase3Complete: stats.phase3Complete,
      });

      logger.info("Email processing stats initialized from database", "EMAIL_PROCESSING", stats);
    } catch (error) {
      logger.error("Failed to initialize email processing stats", "EMAIL_PROCESSING", { error });
    }
  }

  /**
   * Notify that email processing started
   */
  notifyProcessingStarted(progress: EmailProcessingProgress): void {
    if (progress.status !== 'started') return;

    emailProcessingWebSocket.emailProcessingStarted(progress.emailId, progress.phase);
    
    logger.debug("Email processing started notification sent", "EMAIL_PROCESSING", {
      emailId: progress.emailId,
      phase: progress.phase,
    });
  }

  /**
   * Notify that email processing completed
   */
  notifyProcessingCompleted(progress: EmailProcessingProgress): void {
    if (progress.status !== 'completed') return;

    const processingTime = progress.processingTime || 0;
    emailProcessingWebSocket.emailProcessingCompleted(progress.emailId, progress.phase, processingTime);

    logger.debug("Email processing completed notification sent", "EMAIL_PROCESSING", {
      emailId: progress.emailId,
      phase: progress.phase,
      processingTime,
    });
  }

  /**
   * Notify that email processing failed
   */
  notifyProcessingFailed(progress: EmailProcessingProgress): void {
    if (progress.status !== 'failed') return;

    const error = progress.error || 'Unknown error';
    emailProcessingWebSocket.emailProcessingError(progress.emailId, progress.phase, error);

    logger.warn("Email processing failed notification sent", "EMAIL_PROCESSING", {
      emailId: progress.emailId,
      phase: progress.phase,
      error,
    });
  }

  /**
   * Generic progress notification handler
   */
  notifyProgress(progress: EmailProcessingProgress): void {
    switch (progress.status) {
      case 'started':
        this.notifyProcessingStarted(progress);
        break;
      case 'completed':
        this.notifyProcessingCompleted(progress);
        break;
      case 'failed':
        this.notifyProcessingFailed(progress);
        break;
    }
  }

  /**
   * Batch notify multiple progress updates
   */
  notifyBatchProgress(progressArray: EmailProcessingProgress[]): void {
    progressArray.forEach(progress => this.notifyProgress(progress));
  }

  /**
   * Get current WebSocket statistics
   */
  getWebSocketStats(): {
    connectedClients: number;
    processingStats: any;
  } {
    return {
      connectedClients: emailProcessingWebSocket.getConnectedClients(),
      processingStats: emailProcessingWebSocket.getStats(),
    };
  }

  /**
   * Force refresh stats from database
   */
  async refreshStatsFromDatabase(): Promise<void> {
    await this.initializeStatsFromDatabase();
  }

  /**
   * Create a middleware function for email processing
   */
  createProcessingMiddleware() {
    return (emailId: string, phase: 1 | 2 | 3) => {
      const startTime = Date.now();
      
      // Notify processing started
      this.notifyProgress({
        emailId,
        phase,
        status: 'started',
      });

      return {
        success: (metadata?: Record<string, any>) => {
          const processingTime = Date.now() - startTime;
          this.notifyProgress({
            emailId,
            phase,
            status: 'completed',
            processingTime,
            metadata,
          });
        },
        error: (error: string | Error, metadata?: Record<string, any>) => {
          const processingTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : error;
          this.notifyProgress({
            emailId,
            phase,
            status: 'failed',
            processingTime,
            error: errorMessage,
            metadata,
          });
        }
      };
    };
  }

  /**
   * Update total email count (for when new emails are imported)
   */
  updateTotalEmailCount(newCount: number): void {
    emailProcessingWebSocket.updateStats({ totalEmails: newCount });
  }
}

// Export singleton instance
export const emailProcessingNotificationService = EmailProcessingNotificationService.getInstance();