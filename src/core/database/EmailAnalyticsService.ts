import Database from 'better-sqlite3';
import { logger } from '../../utils/logger';

export interface EmailStats {
  totalEmails: number;
  processedEmails: number;
  pendingEmails: number;
  averageProcessingTime: number;
  timestamp: Date;
}

export class EmailAnalyticsService {
  private db: Database.Database;

  constructor(databasePath: string = './data/app.db') {
    try {
      this.db = new Database(databasePath);
      logger.info('Database connection established', 'EMAIL_ANALYTICS');
    } catch (error) {
      logger.error('Failed to connect to database', 'EMAIL_ANALYTICS', { error });
      throw new Error('Database connection failed');
    }
  }

  /**
   * Get total count of all emails in database
   */
  getTotalEmailsCount(): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as total FROM emails');
      const result = stmt.get() as { total: number };
      return result.total;
    } catch (error) {
      logger.error('Error getting total emails count', 'EMAIL_ANALYTICS', { error });
      return 0;
    }
  }

  /**
   * Get count of processed emails
   */
  getProcessedEmailsCount(): number {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as total 
        FROM email_analysis 
        WHERE workflow_state = 'COMPLETE'
      `);
      const result = stmt.get() as { total: number };
      return result.total;
    } catch (error) {
      logger.error('Error getting processed emails count', 'EMAIL_ANALYTICS', { error });
      return 0;
    }
  }

  /**
   * Get count of pending emails
   */
  getPendingEmailsCount(): number {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as total 
        FROM emails e 
        LEFT JOIN email_analysis ea ON e.id = ea.email_id 
        WHERE ea.id IS NULL OR ea.workflow_state = 'PENDING'
      `);
      const result = stmt.get() as { total: number };
      return result.total;
    } catch (error) {
      logger.error('Error getting pending emails count', 'EMAIL_ANALYTICS', { error });
      return 0;
    }
  }

  /**
   * Calculate average processing time in milliseconds
   */
  getAverageProcessingTime(): number {
    try {
      const stmt = this.db.prepare(`
        SELECT AVG(processing_time_ms) as avg_time 
        FROM email_analysis 
        WHERE processing_time_ms IS NOT NULL
      `);
      const result = stmt.get() as { avg_time: number | null };
      return result.avg_time || 0;
    } catch (error) {
      logger.error('Error getting average processing time', 'EMAIL_ANALYTICS', { error });
      return 0;
    }
  }

  /**
   * Get aggregated email statistics
   */
  async getStats(): Promise<EmailStats> {
    try {
      const totalEmails = this.getTotalEmailsCount();
      const processedEmails = this.getProcessedEmailsCount();
      const pendingEmails = this.getPendingEmailsCount();
      const averageProcessingTime = this.getAverageProcessingTime();

      return {
        totalEmails,
        processedEmails,
        pendingEmails,
        averageProcessingTime,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error getting email statistics', 'EMAIL_ANALYTICS', { error });
      // Return graceful fallback
      return {
        totalEmails: 0,
        processedEmails: 0,
        pendingEmails: 0,
        averageProcessingTime: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close();
      logger.info('Database connection closed', 'EMAIL_ANALYTICS');
    } catch (error) {
      logger.error('Error closing database connection', 'EMAIL_ANALYTICS', { error });
    }
  }
}