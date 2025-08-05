/**
 * Optimized Batch Processing Queries for Email Pipeline
 * 
 * Optimizes critical query patterns for processing 143k+ emails
 * Target: 60+ emails/minute throughput
 * Batch size: 1000 emails per batch
 */

import type Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

export interface BatchSelectionOptions {
  batchSize: number;
  phase?: 1 | 2 | 3;
  minCompleteness?: number;
  maxCompleteness?: number;
  priorityOrder?: boolean;
}

export interface EmailBatch {
  emails: EmailForProcessing[];
  batchId: string;
  totalSelected: number;
  estimatedProcessingTime: number;
}

export interface EmailForProcessing {
  id: string;
  chain_id?: string;
  subject: string;
  from_address: string;
  received_at: string;
  processing_status: string;
  recommended_phase: number;
  completeness_score: number;
  priority_score?: number;
  workflow_state?: string;
}

export class BatchProcessingQueries {
  private db: Database.Database;
  private preparedStatements: Map<string, Database.Statement>;

  constructor(db: Database.Database) {
    this.db = db;
    this.preparedStatements = new Map();
    this.initializePreparedStatements();
  }

  /**
   * Initialize all prepared statements for maximum performance
   */
  private initializePreparedStatements(): void {
    // Batch selection optimized for each phase
    this.preparedStatements.set('selectPhase1Batch', this.db.prepare(`
      SELECT 
        id, chain_id, subject, from_address, received_at,
        processing_status, recommended_phase, completeness_score,
        workflow_state, priority_score
      FROM emails_enhanced 
      WHERE processing_status = 'pending'
        AND recommended_phase = 1
        AND completeness_score >= ?
        AND completeness_score <= ?
      ORDER BY 
        priority_score DESC NULLS LAST,
        completeness_score ASC,
        received_at ASC
      LIMIT ?
    `));

    this.preparedStatements.set('selectPhase2Batch', this.db.prepare(`
      SELECT 
        id, chain_id, subject, from_address, received_at,
        processing_status, recommended_phase, completeness_score,
        workflow_state, priority_score
      FROM emails_enhanced 
      WHERE processing_status = 'pending'
        AND recommended_phase = 2
        AND completeness_score >= ?
        AND completeness_score <= ?
      ORDER BY 
        completeness_score DESC,
        priority_score DESC NULLS LAST,
        received_at ASC
      LIMIT ?
    `));

    this.preparedStatements.set('selectPhase3Batch', this.db.prepare(`
      SELECT 
        id, chain_id, subject, from_address, received_at,
        processing_status, recommended_phase, completeness_score,
        workflow_state, priority_score
      FROM emails_enhanced 
      WHERE processing_status = 'pending'
        AND recommended_phase = 3
        AND completeness_score >= ?
      ORDER BY 
        completeness_score DESC,
        priority_score DESC NULLS LAST,
        received_at ASC
      LIMIT ?
    `));

    // Optimized chain-aware batch selection
    this.preparedStatements.set('selectChainAwareBatch', this.db.prepare(`
      WITH chain_priorities AS (
        SELECT 
          ec.id as chain_id,
          ec.completeness_score as chain_completeness,
          ec.priority_score as chain_priority,
          COUNT(e.id) as pending_emails
        FROM email_chains ec
        JOIN emails_enhanced e ON e.chain_id = ec.id
        WHERE e.processing_status = 'pending'
          AND ec.recommended_phase = ?
        GROUP BY ec.id
        ORDER BY 
          ec.priority_score DESC NULLS LAST,
          ec.completeness_score DESC,
          pending_emails DESC
        LIMIT ?
      )
      SELECT 
        e.id, e.chain_id, e.subject, e.from_address, e.received_at,
        e.processing_status, e.recommended_phase, e.completeness_score,
        e.workflow_state, cp.chain_priority as priority_score
      FROM chain_priorities cp
      JOIN emails_enhanced e ON e.chain_id = cp.chain_id
      WHERE e.processing_status = 'pending'
      ORDER BY 
        cp.chain_priority DESC NULLS LAST,
        e.completeness_score DESC,
        e.received_at ASC
      LIMIT ?
    `));

    // Bulk status update optimization
    this.preparedStatements.set('updateProcessingStatus', this.db.prepare(`
      UPDATE emails_enhanced 
      SET 
        processing_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `));

    // Batch completion tracking
    this.preparedStatements.set('markBatchCompleted', this.db.prepare(`
      UPDATE emails_enhanced 
      SET 
        processing_status = 'completed',
        phase_completed = ?,
        processing_time_ms = ?,
        model_used = ?,
        tokens_used = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `));

    logger.info("Batch processing prepared statements initialized", "BATCH_QUERIES");
  }

  /**
   * Get optimized batch for processing based on phase and strategy
   * Target: < 50ms for 1000 records
   */
  async getOptimizedBatch(options: BatchSelectionOptions): Promise<EmailBatch> {
    const startTime = performance.now();
    const batchId = `batch_${Date.now()}_phase${options.phase || 'auto'}`;

    try {
      let emails: EmailForProcessing[];
      
      if (options.phase) {
        emails = this.getPhaseSpecificBatch(options);
      } else {
        // Auto-select best phase based on current workload
        emails = await this.getAdaptiveBatch(options);
      }

      const executionTime = performance.now() - startTime;
      
      // Estimate processing time based on phase and complexity
      const estimatedProcessingTime = this.estimateProcessingTime(emails, options.phase);

      const batch: EmailBatch = {
        emails,
        batchId,
        totalSelected: emails.length,
        estimatedProcessingTime
      };

      logger.info(
        `Batch selected: ${emails.length} emails in ${executionTime.toFixed(2)}ms`,
        "BATCH_QUERIES"
      );

      return batch;
    } catch (error) {
      logger.error(`Failed to get optimized batch: ${error}`, "BATCH_QUERIES");
      throw error;
    }
  }

  /**
   * Get phase-specific batch using optimized query
   */
  private getPhaseSpecificBatch(options: BatchSelectionOptions): EmailForProcessing[] {
    const { phase, batchSize, minCompleteness = 0.0, maxCompleteness = 1.0 } = options;
    
    let stmt: Database.Statement;
    let params: any[];

    switch (phase) {
      case 1:
        stmt = this.preparedStatements.get('selectPhase1Batch')!;
        params = [minCompleteness, maxCompleteness, batchSize];
        break;
      case 2:
        stmt = this.preparedStatements.get('selectPhase2Batch')!;
        params = [minCompleteness, maxCompleteness, batchSize];
        break;
      case 3:
        stmt = this.preparedStatements.get('selectPhase3Batch')!;
        params = [minCompleteness, batchSize];
        break;
      default:
        throw new Error(`Invalid phase: ${phase}`);
    }

    return stmt.all(...params) as EmailForProcessing[];
  }

  /**
   * Adaptive batch selection - automatically chooses best processing strategy
   */
  private async getAdaptiveBatch(options: BatchSelectionOptions): Promise<EmailForProcessing[]> {
    // Get workload distribution
    const workloadStats = this.getWorkloadDistribution();
    
    // Select optimal phase based on current queue status
    const optimalPhase = this.determineOptimalPhase(workloadStats);
    
    // Get chain-aware batch for better processing efficiency
    if (optimalPhase === 2 || optimalPhase === 3) {
      return this.getChainAwareBatch(optimalPhase, options.batchSize);
    }
    
    // Fall back to phase-specific selection
    return this.getPhaseSpecificBatch({ ...options, phase: optimalPhase });
  }

  /**
   * Get chain-aware batch for complex processing phases
   */
  private getChainAwareBatch(phase: 2 | 3, batchSize: number): EmailForProcessing[] {
    const stmt = this.preparedStatements.get('selectChainAwareBatch')!;
    const maxChains = Math.ceil(batchSize / 10); // Limit chains to avoid overwhelming
    
    return stmt.all(phase, maxChains, batchSize) as EmailForProcessing[];
  }

  /**
   * Get current workload distribution for adaptive selection
   */
  private getWorkloadDistribution(): WorkloadStats {
    const stmt = this.db.prepare(`
      SELECT 
        recommended_phase,
        COUNT(*) as count,
        AVG(completeness_score) as avg_completeness,
        AVG(priority_score) as avg_priority
      FROM emails_enhanced 
      WHERE processing_status = 'pending'
      GROUP BY recommended_phase
      ORDER BY recommended_phase
    `);

    const results = stmt.all() as any[];
    
    return {
      phase1: results.find(r => r.recommended_phase === 1) || { count: 0, avg_completeness: 0, avg_priority: 0 },
      phase2: results.find(r => r.recommended_phase === 2) || { count: 0, avg_completeness: 0, avg_priority: 0 },
      phase3: results.find(r => r.recommended_phase === 3) || { count: 0, avg_completeness: 0, avg_priority: 0 },
      total: results.reduce((sum, r) => sum + r.count, 0)
    };
  }

  /**
   * Determine optimal phase based on workload
   */
  private determineOptimalPhase(stats: WorkloadStats): 1 | 2 | 3 {
    // Prioritize Phase 1 for high-throughput processing
    if (stats.phase1.count > 5000) return 1;
    
    // Prioritize Phase 3 for high-value chains
    if (stats.phase3.count > 0 && stats.phase3.avg_priority > 0.7) return 3;
    
    // Default to Phase 2 for balanced processing
    if (stats.phase2.count > 0) return 2;
    
    // Fall back to available phase
    if (stats.phase1.count > 0) return 1;
    if (stats.phase3.count > 0) return 3;
    
    return 1; // Default fallback
  }

  /**
   * Estimate processing time based on email complexity and phase
   */
  private estimateProcessingTime(emails: EmailForProcessing[], phase?: number): number {
    const baseTimePerEmail = {
      1: 800,   // Rule-based: ~0.8s per email
      2: 2500,  // Llama 3.2: ~2.5s per email  
      3: 4000   // Phi-4: ~4s per email
    };

    const avgPhase = phase || emails.reduce((sum, e) => sum + e.recommended_phase, 0) / emails.length;
    const timePerEmail = baseTimePerEmail[Math.round(avgPhase) as keyof typeof baseTimePerEmail] || baseTimePerEmail[2];
    
    // Factor in complexity score
    const complexityMultiplier = emails.reduce((sum, e) => sum + (1 + e.completeness_score), 0) / emails.length;
    
    return Math.round(emails.length * timePerEmail * complexityMultiplier);
  }

  /**
   * Bulk update processing status with transaction optimization
   * Target: < 100ms for 1000 updates
   */
  async bulkUpdateProcessingStatus(
    emailIds: string[], 
    status: 'processing' | 'completed' | 'failed',
    additionalData?: {
      phase?: number;
      processingTime?: number;
      modelUsed?: string;
      tokensUsed?: number;
    }
  ): Promise<void> {
    const startTime = performance.now();
    
    return this.db.transaction(() => {
      const updateStmt = additionalData?.phase 
        ? this.preparedStatements.get('markBatchCompleted')!
        : this.preparedStatements.get('updateProcessingStatus')!;

      for (const emailId of emailIds) {
        if (additionalData?.phase) {
          updateStmt.run(
            additionalData.phase,
            additionalData.processingTime || 0,
            additionalData.modelUsed || 'unknown',
            additionalData.tokensUsed || 0,
            emailId
          );
        } else {
          updateStmt.run(status, emailId);
        }
      }
      
      const executionTime = performance.now() - startTime;
      logger.info(
        `Bulk updated ${emailIds.length} emails in ${executionTime.toFixed(2)}ms`,
        "BATCH_QUERIES"
      );
    })();
  }

  /**
   * Get processing statistics for monitoring
   */
  getProcessingStatistics(): ProcessingStatistics {
    const stmt = this.db.prepare(`
      SELECT 
        processing_status,
        recommended_phase,
        COUNT(*) as count,
        AVG(processing_time_ms) as avg_time_ms,
        AVG(completeness_score) as avg_completeness
      FROM emails_enhanced 
      WHERE received_at >= date('now', '-24 hours')
      GROUP BY processing_status, recommended_phase
      ORDER BY processing_status, recommended_phase
    `);

    const results = stmt.all() as any[];
    
    return {
      totalEmails: results.reduce((sum, r) => sum + r.count, 0),
      byStatus: this.groupBy(results, 'processing_status'),
      byPhase: this.groupBy(results, 'recommended_phase'),
      overallAvgTime: results.reduce((sum, r) => sum + (r.avg_time_ms || 0) * r.count, 0) / 
                     results.reduce((sum, r) => sum + r.count, 0) || 0
    };
  }

  private groupBy(array: any[], key: string): Record<string, any> {
    return array.reduce((groups, item) => {
      const groupKey = item[key];
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {});
  }

  /**
   * Cleanup prepared statements
   */
  close(): void {
    this.preparedStatements.clear();
    logger.info("Batch processing queries cleaned up", "BATCH_QUERIES");
  }
}

interface WorkloadStats {
  phase1: { count: number; avg_completeness: number; avg_priority: number };
  phase2: { count: number; avg_completeness: number; avg_priority: number };
  phase3: { count: number; avg_completeness: number; avg_priority: number };
  total: number;
}

interface ProcessingStatistics {
  totalEmails: number;
  byStatus: Record<string, any[]>;
  byPhase: Record<number, any[]>;
  overallAvgTime: number;
}