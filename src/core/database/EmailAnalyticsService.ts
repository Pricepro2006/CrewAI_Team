/**
 * EmailAnalyticsService - Centralized service for recording email analysis metrics
 * Ensures data integrity and prevents negative processing times
 */

import { logger } from "@/utils/logger";
import { getDatabaseConnection } from "@/database/connection";
import type { Database } from "better-sqlite3";

export interface ProcessingTimeData {
  emailId: string;
  stage1Time?: number;
  stage2Time?: number;
  totalTime: number;
  stage1Model?: string;
  stage2Model?: string;
  timestamp?: Date;
}

export interface ProcessingTimeValidationResult {
  isValid: boolean;
  errors: string[];
  correctedData?: ProcessingTimeData;
}

export class EmailAnalyticsService {
  private static instance: EmailAnalyticsService;
  private db: Database;

  private constructor() {
    this.db = getDatabaseConnection();
  }

  public static getInstance(): EmailAnalyticsService {
    if (!EmailAnalyticsService.instance) {
      EmailAnalyticsService.instance = new EmailAnalyticsService();
    }
    return EmailAnalyticsService.instance;
  }

  /**
   * Validate processing time data to ensure all values are positive
   */
  public validateProcessingTime(data: ProcessingTimeData): ProcessingTimeValidationResult {
    const errors: string[] = [];
    const correctedData = { ...data };

    // Validate and correct stage1Time
    if (data.stage1Time !== undefined) {
      if (data.stage1Time < 0) {
        errors.push(`Negative stage1Time detected: ${data.stage1Time}ms`);
        correctedData.stage1Time = Math.abs(data.stage1Time);
      } else if (data.stage1Time > 300000) { // 5 minutes max
        errors.push(`Excessive stage1Time detected: ${data.stage1Time}ms`);
        correctedData.stage1Time = 300000;
      }
    }

    // Validate and correct stage2Time
    if (data.stage2Time !== undefined) {
      if (data.stage2Time < 0) {
        errors.push(`Negative stage2Time detected: ${data.stage2Time}ms`);
        correctedData.stage2Time = Math.abs(data.stage2Time);
      } else if (data.stage2Time > 600000) { // 10 minutes max
        errors.push(`Excessive stage2Time detected: ${data.stage2Time}ms`);
        correctedData.stage2Time = 600000;
      }
    }

    // Validate and correct totalTime
    if (data.totalTime < 0) {
      errors.push(`Negative totalTime detected: ${data.totalTime}ms`);
      correctedData.totalTime = Math.abs(data.totalTime);
    } else if (data.totalTime > 900000) { // 15 minutes max
      errors.push(`Excessive totalTime detected: ${data.totalTime}ms`);
      correctedData.totalTime = 900000;
    }

    // Ensure total time is at least the sum of stage times
    const minTotalTime = (correctedData.stage1Time || 0) + (correctedData.stage2Time || 0);
    if (correctedData.totalTime < minTotalTime) {
      errors.push(`Total time (${correctedData.totalTime}ms) is less than sum of stages (${minTotalTime}ms)`);
      correctedData.totalTime = minTotalTime;
    }

    return {
      isValid: errors.length === 0,
      errors,
      correctedData
    };
  }

  /**
   * Record email processing times with validation and data integrity checks
   */
  public async recordEmailProcessed(data: ProcessingTimeData): Promise<void> {
    try {
      // Validate the processing time data
      const validation = this.validateProcessingTime(data);
      
      if (!validation.isValid) {
        logger.warn(
          "Processing time validation failed, auto-correcting",
          "EMAIL_ANALYTICS",
          {
            emailId: data.emailId,
            errors: validation.errors,
            originalData: data,
            correctedData: validation.correctedData
          }
        );
      }

      const correctedData = validation.correctedData || data;

      // Check if record exists
      const existing = this.db.prepare(`
        SELECT email_id FROM email_analysis WHERE email_id = ?
      `).get(correctedData.emailId);

      if (existing) {
        // Update existing record
        const stmt = this.db.prepare(`
          UPDATE email_analysis
          SET 
            quick_processing_time = COALESCE(?, quick_processing_time),
            deep_processing_time = COALESCE(?, deep_processing_time),
            total_processing_time = ?,
            quick_model = COALESCE(?, quick_model),
            deep_model = COALESCE(?, deep_model),
            updated_at = datetime('now')
          WHERE email_id = ?
        `);

        stmt.run(
          correctedData.stage1Time,
          correctedData.stage2Time,
          correctedData.totalTime,
          correctedData.stage1Model,
          correctedData.stage2Model,
          correctedData.emailId
        );

        logger.debug(
          "Updated email processing times",
          "EMAIL_ANALYTICS",
          {
            emailId: correctedData.emailId,
            stage1Time: correctedData.stage1Time,
            stage2Time: correctedData.stage2Time,
            totalTime: correctedData.totalTime
          }
        );
      } else {
        logger.warn(
          "Email analysis record not found, cannot update processing times",
          "EMAIL_ANALYTICS",
          { emailId: correctedData.emailId }
        );
      }

      // Record metrics for monitoring
      this.recordMetrics(correctedData);

    } catch (error) {
      logger.error(
        "Failed to record email processing times",
        "EMAIL_ANALYTICS",
        { emailId: data.emailId },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Record processing time metrics for monitoring
   */
  private recordMetrics(data: ProcessingTimeData): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO processing_metrics (
          email_id,
          stage1_time,
          stage2_time,
          total_time,
          recorded_at
        ) VALUES (?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        data.emailId,
        data.stage1Time || null,
        data.stage2Time || null,
        data.totalTime
      );
    } catch (error) {
      // Don't throw, just log - metrics are not critical
      logger.debug(
        "Failed to record processing metrics",
        "EMAIL_ANALYTICS",
        error as Error
      );
    }
  }

  /**
   * Get processing time statistics
   */
  public async getProcessingStats(): Promise<{
    avgStage1Time: number;
    avgStage2Time: number;
    avgTotalTime: number;
    totalEmails: number;
    emailsWithNegativeTimes: number;
  }> {
    const stats = this.db.prepare(`
      SELECT 
        AVG(CASE WHEN quick_processing_time >= 0 THEN quick_processing_time END) as avg_stage1_time,
        AVG(CASE WHEN deep_processing_time >= 0 THEN deep_processing_time END) as avg_stage2_time,
        AVG(CASE WHEN total_processing_time >= 0 THEN total_processing_time END) as avg_total_time,
        COUNT(*) as total_emails,
        SUM(CASE 
          WHEN quick_processing_time < 0 
            OR deep_processing_time < 0 
            OR total_processing_time < 0 
          THEN 1 
          ELSE 0 
        END) as emails_with_negative_times
      FROM email_analysis
    `).get() as any;

    return {
      avgStage1Time: stats.avg_stage1_time || 0,
      avgStage2Time: stats.avg_stage2_time || 0,
      avgTotalTime: stats.avg_total_time || 0,
      totalEmails: stats.total_emails || 0,
      emailsWithNegativeTimes: stats.emails_with_negative_times || 0
    };
  }

  /**
   * Fix existing negative processing times in the database
   * This is a one-time cleanup operation
   */
  public async fixNegativeProcessingTimes(): Promise<{
    fixed: number;
    errors: number;
  }> {
    let fixed = 0;
    let errors = 0;

    try {
      const negativeRecords = this.db.prepare(`
        SELECT 
          email_id,
          quick_processing_time,
          deep_processing_time,
          total_processing_time
        FROM email_analysis
        WHERE 
          quick_processing_time < 0 
          OR deep_processing_time < 0 
          OR total_processing_time < 0
      `).all() as any[];

      logger.info(
        `Found ${negativeRecords.length} records with negative processing times`,
        "EMAIL_ANALYTICS"
      );

      const updateStmt = this.db.prepare(`
        UPDATE email_analysis
        SET 
          quick_processing_time = ?,
          deep_processing_time = ?,
          total_processing_time = ?,
          updated_at = datetime('now')
        WHERE email_id = ?
      `);

      for (const record of negativeRecords) {
        try {
          const correctedQuick = record.quick_processing_time < 0 
            ? Math.abs(record.quick_processing_time) 
            : record.quick_processing_time;
          
          const correctedDeep = record.deep_processing_time < 0 
            ? Math.abs(record.deep_processing_time) 
            : record.deep_processing_time;
          
          const correctedTotal = record.total_processing_time < 0 
            ? Math.abs(record.total_processing_time) 
            : record.total_processing_time;

          // Ensure total is at least sum of stages
          const minTotal = (correctedQuick || 0) + (correctedDeep || 0);
          const finalTotal = Math.max(correctedTotal, minTotal);

          updateStmt.run(
            correctedQuick,
            correctedDeep,
            finalTotal,
            record.email_id
          );

          fixed++;
        } catch (error) {
          errors++;
          logger.error(
            "Failed to fix negative times for email",
            "EMAIL_ANALYTICS",
            { emailId: record.email_id },
            error as Error
          );
        }
      }

      logger.info(
        `Fixed ${fixed} records, ${errors} errors`,
        "EMAIL_ANALYTICS"
      );

      return { fixed, errors };
    } catch (error) {
      logger.error(
        "Failed to fix negative processing times",
        "EMAIL_ANALYTICS",
        error as Error
      );
      throw error;
    }
  }

  /**
   * Calculate proper processing time from timestamps
   * This ensures we never get negative values
   */
  public static calculateProcessingTime(startTime: number, endTime?: number): number {
    const end = endTime || Date.now();
    const duration = end - startTime;
    
    // Ensure non-negative
    if (duration < 0) {
      logger.warn(
        "Negative duration calculated, using absolute value",
        "EMAIL_ANALYTICS",
        { startTime, endTime: end, duration }
      );
      return Math.abs(duration);
    }
    
    return duration;
  }

  /**
   * Safe time calculation helper for use in other services
   */
  public static safeTimeCalculation(operation: () => number): number {
    try {
      const time = operation();
      return time < 0 ? Math.abs(time) : time;
    } catch (error) {
      logger.error(
        "Error in time calculation",
        "EMAIL_ANALYTICS",
        error as Error
      );
      return 0;
    }
  }
}

// Export singleton instance
export const emailAnalytics = EmailAnalyticsService.getInstance();