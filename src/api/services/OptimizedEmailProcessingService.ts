/**
 * Optimized Email Processing Service
 * High-performance database operations for Phase 2/3 email processing
 */

import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import { emailProcessingNotificationService } from "./EmailProcessingNotificationService.js";
import type Database from "better-sqlite3";

export interface EmailBatch {
  emails: Array<{
    id: string;
    subject: string;
    body: string;
    receivedDate: string;
    senderEmail: string;
    phase1Results?: any;
  }>;
  batchSize: number;
  targetPhase: 2 | 3;
}

export interface ProcessingResult {
  emailId: string;
  success: boolean;
  processingTime: number;
  results?: any;
  error?: string;
}

export interface BatchProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  totalTime: number;
  averageTime: number;
  throughput: number; // emails per second
}

export class OptimizedEmailProcessingService {
  private static instance: OptimizedEmailProcessingService;
  private dbManager: any;
  private readonly BATCH_SIZE = 50;
  private readonly MAX_CONCURRENT_BATCHES = 3;
  private activeBatches: Set<string> = new Set();

  private constructor() {
    this.dbManager = getDatabaseManager();
  }

  static getInstance(): OptimizedEmailProcessingService {
    if (!OptimizedEmailProcessingService.instance) {
      OptimizedEmailProcessingService.instance = new OptimizedEmailProcessingService();
    }
    return OptimizedEmailProcessingService.instance;
  }

  /**
   * Get emails ready for Phase 2 processing (optimized query)
   */
  async getEmailsForPhase2Processing(limit: number = this.BATCH_SIZE): Promise<EmailBatch> {
    return this.dbManager.executeQuery((db: Database.Database) => {
      const stmt = db.prepare(`
        SELECT 
          id,
          subject,
          body,
          received_date as receivedDate,
          sender_email as senderEmail,
          phase_1_results as phase1Results
        FROM emails 
        WHERE 
          phase_1_results IS NOT NULL 
          AND phase_1_results != '{}'
          AND (phase_2_results IS NULL OR phase_2_results = '{}')
          AND LENGTH(body) > 10
        ORDER BY received_date DESC
        LIMIT ?
      `);

      const emails = stmt.all(limit).map((row: any) => ({
        ...row,
        phase1Results: row.phase1Results ? JSON.parse(row.phase1Results) : null,
      }));

      return {
        emails,
        batchSize: emails.length,
        targetPhase: 2 as const,
      };
    });
  }

  /**
   * Get emails ready for Phase 3 processing (optimized query)
   */
  async getEmailsForPhase3Processing(limit: number = this.BATCH_SIZE): Promise<EmailBatch> {
    return this.dbManager.executeQuery((db: Database.Database) => {
      const stmt = db.prepare(`
        SELECT 
          id,
          subject,
          body,
          received_date as receivedDate,
          sender_email as senderEmail,
          phase_1_results as phase1Results,
          phase_2_results as phase2Results
        FROM emails 
        WHERE 
          phase_2_results IS NOT NULL 
          AND phase_2_results != '{}'
          AND (phase_3_results IS NULL OR phase_3_results = '{}')
          AND LENGTH(body) > 10
        ORDER BY received_date DESC
        LIMIT ?
      `);

      const emails = stmt.all(limit).map((row: any) => ({
        ...row,
        phase1Results: row.phase1Results ? JSON.parse(row.phase1Results) : null,
        phase2Results: row.phase2Results ? JSON.parse(row.phase2Results) : null,
      }));

      return {
        emails,
        batchSize: emails.length,
        targetPhase: 3 as const,
      };
    });
  }

  /**
   * Batch update email processing results with optimized transaction
   */
  async batchUpdateResults(
    results: ProcessingResult[],
    phase: 2 | 3
  ): Promise<BatchProcessingStats> {
    const startTime = Date.now();
    const phaseColumn = phase === 2 ? 'phase_2_results' : 'phase_3_results';
    
    const stats: BatchProcessingStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      totalTime: 0,
      averageTime: 0,
      throughput: 0,
    };

    await this.dbManager.executeQuery((db: Database.Database) => {
      const transaction = db.transaction((results: ProcessingResult[]) => {
        const updateStmt = db.prepare(`
          UPDATE emails 
          SET 
            ${phaseColumn} = ?,
            updated_at = datetime('now'),
            processing_time_phase_${phase} = ?
          WHERE id = ?
        `);

        for (const result of results) {
          try {
            updateStmt.run(
              JSON.stringify(result.results || {}),
              result.processingTime,
              result.emailId
            );
            
            if (result.success) {
              stats.successful++;
            } else {
              stats.failed++;
            }
            stats.totalProcessed++;
          } catch (error) {
            logger.error(`Failed to update email ${result.emailId}`, "EMAIL_PROCESSING", { error });
            stats.failed++;
          }
        }
      });

      transaction(results);
    });

    stats.totalTime = Date.now() - startTime;
    stats.averageTime = stats.totalProcessed > 0 ? stats.totalTime / stats.totalProcessed : 0;
    stats.throughput = stats.totalProcessed > 0 ? (stats.totalProcessed / stats.totalTime) * 1000 : 0;

    logger.info(`Batch update completed for phase ${phase}`, "EMAIL_PROCESSING", stats);
    
    return stats;
  }

  /**
   * Process emails in parallel batches with connection pooling
   */
  async processEmailsInBatches(
    emailBatch: EmailBatch,
    processingFunction: (email: any) => Promise<any>
  ): Promise<BatchProcessingStats> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeBatches.add(batchId);

    try {
      const results: ProcessingResult[] = [];
      const chunks = this.chunkArray(emailBatch.emails, Math.ceil(emailBatch.emails.length / this.MAX_CONCURRENT_BATCHES));
      
      // Process chunks in parallel
      const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
        logger.debug(`Processing chunk ${chunkIndex + 1}/${chunks.length}`, "EMAIL_PROCESSING", {
          batchId,
          chunkSize: chunk.length,
        });

        const chunkResults = await Promise.allSettled(
          chunk.map(async (email) => {
            const startTime = Date.now();
            const notification = emailProcessingNotificationService.createProcessingMiddleware()(
              email.id,
              emailBatch.targetPhase
            );

            try {
              const result = await processingFunction(email);
              const processingTime = Date.now() - startTime;

              notification.success({ result });

              return {
                emailId: email.id,
                success: true,
                processingTime,
                results: result,
              } as ProcessingResult;
            } catch (error) {
              const processingTime = Date.now() - startTime;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              notification.error(errorMessage);

              return {
                emailId: email.id,
                success: false,
                processingTime,
                error: errorMessage,
              } as ProcessingResult;
            }
          })
        );

        return chunkResults.map(result => 
          result.status === 'fulfilled' ? result.value : {
            emailId: 'unknown',
            success: false,
            processingTime: 0,
            error: 'Promise rejected',
          } as ProcessingResult
        );
      });

      // Wait for all chunks to complete
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults.flat());

      // Batch update database
      const stats = await this.batchUpdateResults(results, emailBatch.targetPhase);

      logger.info(`Batch processing completed`, "EMAIL_PROCESSING", {
        batchId,
        phase: emailBatch.targetPhase,
        ...stats,
      });

      return stats;
    } finally {
      this.activeBatches.delete(batchId);
    }
  }

  /**
   * Get processing queue status
   */
  async getProcessingQueueStatus(): Promise<{
    phase2Ready: number;
    phase3Ready: number;
    activeBatches: number;
    estimatedWaitTime: number;
  }> {
    const [phase2Count, phase3Count] = await Promise.all([
      this.dbManager.executeQuery((db: Database.Database) => {
        const stmt = db.prepare(`
          SELECT COUNT(*) as count FROM emails 
          WHERE 
            phase_1_results IS NOT NULL 
            AND phase_1_results != '{}'
            AND (phase_2_results IS NULL OR phase_2_results = '{}')
        `);
        const result1 = stmt.get() as any;
        return result1?.count ?? 0;
      }),
      this.dbManager.executeQuery((db: Database.Database) => {
        const stmt = db.prepare(`
          SELECT COUNT(*) as count FROM emails 
          WHERE 
            phase_2_results IS NOT NULL 
            AND phase_2_results != '{}'
            AND (phase_3_results IS NULL OR phase_3_results = '{}')
        `);
        const result2 = stmt.get() as any;
        return result2?.count ?? 0;
      })
    ]);

    const activeBatches = this.activeBatches.size;
    const estimatedWaitTime = Math.max(phase2Count, phase3Count) * 2; // Rough estimate in seconds

    return {
      phase2Ready: phase2Count,
      phase3Ready: phase3Count,
      activeBatches,
      estimatedWaitTime,
    };
  }

  /**
   * Get processing performance metrics
   */
  async getProcessingMetrics(): Promise<{
    totalEmailsProcessed: number;
    phase2Completed: number;
    phase3Completed: number;
    averagePhase2Time: number;
    averagePhase3Time: number;
    processingRate: number;
  }> {
    return this.dbManager.executeQuery((db: Database.Database) => {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as totalEmails,
          SUM(CASE WHEN phase_2_results IS NOT NULL AND phase_2_results != '{}' THEN 1 ELSE 0 END) as phase2Completed,
          SUM(CASE WHEN phase_3_results IS NOT NULL AND phase_3_results != '{}' THEN 1 ELSE 0 END) as phase3Completed,
          AVG(CASE WHEN processing_time_phase_2 > 0 THEN processing_time_phase_2 ELSE NULL END) as avgPhase2Time,
          AVG(CASE WHEN processing_time_phase_3 > 0 THEN processing_time_phase_3 ELSE NULL END) as avgPhase3Time
        FROM emails
      `).get() as any;

      const phase2Count = stats?.phase2Completed ?? 0;
      const phase3Count = stats?.phase3Completed ?? 0;
      const totalEmails = stats?.totalEmails ?? 1;
      
      const processingRate = (phase2Count + phase3Count) > 0 
        ? (phase2Count + phase3Count) / totalEmails * 100 
        : 0;

      return {
        totalEmailsProcessed: totalEmails,
        phase2Completed: phase2Count,
        phase3Completed: phase3Count,
        averagePhase2Time: stats?.avgPhase2Time ?? 0,
        averagePhase3Time: stats?.avgPhase3Time ?? 0,
        processingRate: Math.round(processingRate * 100) / 100,
      };
    });
  }

  /**
   * Utility method to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Wait for active batches to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeBatches.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info(`Waiting for ${this.activeBatches.size} active batches to complete...`, "EMAIL_PROCESSING");
    }

    if (this.activeBatches.size > 0) {
      logger.warn(`Forcing shutdown with ${this.activeBatches.size} active batches`, "EMAIL_PROCESSING");
    }

    this.activeBatches.clear();
    logger.info("OptimizedEmailProcessingService shut down", "EMAIL_PROCESSING");
  }
}

// Export singleton instance
export const optimizedEmailProcessingService = OptimizedEmailProcessingService.getInstance();