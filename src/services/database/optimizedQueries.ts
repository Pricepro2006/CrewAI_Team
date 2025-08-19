/**
 * Optimized Database Queries for CrewAI Team Email Processing
 * Target: <100ms response time for UI queries on 143,850 emails
 */

import { Database } from 'better-sqlite3';

export interface EmailListOptions {
  status?: string;
  phase?: number;
  minCompleteness?: number;
  workflowState?: string;
  sortBy?: 'priority' | 'date' | 'completeness';
  limit?: number;
  offset?: number;
}

export interface DashboardStats {
  totalEmails: number;
  totalChains: number;
  pendingCount: number;
  analyzedCount: number;
  phase1Count: number;
  phase2Count: number;
  phase3Count: number;
  highCompleteness: number;
  mediumCompleteness: number;
  lowCompleteness: number;
  processedLastHour: number;
  processedLast24h: number;
  avgCompleteness: number;
  avgConfidence: number;
  escalationCount: number;
  resolutionCount: number;
}

export interface ProcessingStatus {
  queueDepth: number;
  lastMinuteProcessed: number;
  avgPerMinute: number;
  phase1Pending: number;
  phase2Pending: number;
  estimatedMinutesRemaining: number | null;
}

export class OptimizedQueries {
  private db: Database;
  
  // Prepared statements for performance
  private emailListStmt: any;
  private dashboardStatsStmt: any;
  private chainDetailsStmt: any;
  private batchQueueStmt: any;
  private processingStatusStmt: any;
  private searchStmt: any;

  constructor(database: Database) {
    this.db = database;
    this.prepareStatements();
  }

  private prepareStatements(): void {
    // Email list query with filters
    this.emailListStmt = this?.db?.prepare(`
      SELECT 
        e.id,
        e.internet_message_id,
        e.subject,
        e.sender_email,
        e.sender_name,
        e.received_date_time,
        e.status,
        e.phase_completed,
        e.chain_completeness_score,
        e.workflow_state,
        e.priority,
        e.has_attachments,
        e.is_read,
        e.chain_id,
        CASE 
          WHEN e.chain_completeness_score >= 0.8 THEN 'high'
          WHEN e.chain_completeness_score >= 0.5 THEN 'medium'
          ELSE 'low'
        END as completeness_level
      FROM emails_enhanced e
      WHERE 1=1
        AND (@status IS NULL OR e.status = @status)
        AND (@phase IS NULL OR e.phase_completed = @phase)
        AND (@minCompleteness IS NULL OR e.chain_completeness_score >= @minCompleteness)
        AND (@workflowState IS NULL OR e.workflow_state = @workflowState)
      ORDER BY 
        CASE WHEN @sortBy = 'priority' THEN e.priority END DESC,
        CASE WHEN @sortBy = 'date' THEN e.received_date_time END DESC,
        CASE WHEN @sortBy = 'completeness' THEN e.chain_completeness_score END DESC,
        e.received_date_time DESC
      LIMIT @limit OFFSET @offset
    `);

    // Dashboard statistics
    this.dashboardStatsStmt = this?.db?.prepare(`
      SELECT 
        COUNT(*) as totalEmails,
        COUNT(DISTINCT chain_id) as totalChains,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingCount,
        COUNT(CASE WHEN status = 'analyzed' THEN 1 END) as analyzedCount,
        COUNT(CASE WHEN phase_completed = 1 THEN 1 END) as phase1Count,
        COUNT(CASE WHEN phase_completed = 2 THEN 1 END) as phase2Count,
        COUNT(CASE WHEN phase_completed = 3 THEN 1 END) as phase3Count,
        COUNT(CASE WHEN chain_completeness_score >= 0.8 THEN 1 END) as highCompleteness,
        COUNT(CASE WHEN chain_completeness_score >= 0.5 AND chain_completeness_score < 0.8 THEN 1 END) as mediumCompleteness,
        COUNT(CASE WHEN chain_completeness_score < 0.5 THEN 1 END) as lowCompleteness,
        COUNT(CASE WHEN datetime(analyzed_at) > datetime('now', '-1 hour') THEN 1 END) as processedLastHour,
        COUNT(CASE WHEN datetime(analyzed_at) > datetime('now', '-24 hours') THEN 1 END) as processedLast24h,
        ROUND(AVG(chain_completeness_score), 3) as avgCompleteness,
        ROUND(AVG(confidence_score), 3) as avgConfidence,
        COUNT(CASE WHEN workflow_state = 'escalation' THEN 1 END) as escalationCount,
        COUNT(CASE WHEN workflow_state = 'resolution' THEN 1 END) as resolutionCount
      FROM emails_enhanced
    `);

    // Chain details
    this.chainDetailsStmt = this?.db?.prepare(`
      SELECT 
        e.*,
        COUNT(*) OVER (PARTITION BY e.chain_id) as chain_email_count,
        MAX(e.chain_completeness_score) OVER (PARTITION BY e.chain_id) as chain_max_completeness,
        ROW_NUMBER() OVER (PARTITION BY e.chain_id ORDER BY e.received_date_time) as position_in_chain
      FROM emails_enhanced e
      WHERE e.chain_id = @chainId
      ORDER BY e.received_date_time
    `);

    // Batch processing queue
    this.batchQueueStmt = this?.db?.prepare(`
      WITH priority_emails AS (
        SELECT 
          id,
          chain_id,
          chain_completeness_score,
          CASE 
            WHEN priority = 'high' THEN 3
            WHEN priority = 'medium' THEN 2
            WHEN priority = 'low' THEN 1
            ELSE 0
          END as priority_score,
          CASE
            WHEN phase_completed = 1 AND chain_completeness_score >= 0.3 THEN 2
            WHEN phase_completed = 2 AND chain_completeness_score >= 0.7 THEN 3
            ELSE phase_completed
          END as target_phase
        FROM emails_enhanced
        WHERE status IN ('pending', 'imported')
      )
      SELECT 
        e.*,
        p.priority_score,
        p.target_phase
      FROM emails_enhanced e
      JOIN priority_emails p ON e.id = p.id
      ORDER BY 
        p.priority_score DESC,
        e.chain_completeness_score DESC,
        e.received_date_time DESC
      LIMIT @batchSize
    `);

    // Processing status
    this.processingStatusStmt = this?.db?.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM emails_enhanced WHERE status = 'pending') as queueDepth,
        (SELECT COUNT(*) FROM emails_enhanced 
         WHERE datetime(analyzed_at) > datetime('now', '-1 minute')) as lastMinuteProcessed,
        (SELECT COUNT(*) FROM emails_enhanced 
         WHERE datetime(analyzed_at) > datetime('now', '-5 minutes')) / 5.0 as avgPerMinute,
        (SELECT COUNT(*) FROM emails_enhanced 
         WHERE status = 'pending' AND phase_completed = 1) as phase1Pending,
        (SELECT COUNT(*) FROM emails_enhanced 
         WHERE status = 'pending' AND phase_completed = 2) as phase2Pending,
        CASE 
          WHEN (SELECT COUNT(*) FROM emails_enhanced 
                WHERE datetime(analyzed_at) > datetime('now', '-5 minutes')) > 0
          THEN (SELECT COUNT(*) FROM emails_enhanced WHERE status = 'pending') / 
               ((SELECT COUNT(*) FROM emails_enhanced 
                 WHERE datetime(analyzed_at) > datetime('now', '-5 minutes')) / 5.0)
          ELSE NULL
        END as estimatedMinutesRemaining
    `);

    // Search query
    this.searchStmt = this?.db?.prepare(`
      SELECT 
        e.id,
        e.subject,
        e.sender_email,
        e.sender_name,
        e.received_date_time,
        e.status,
        e.chain_completeness_score,
        substr(e.body_preview, 1, 200) as body_snippet
      FROM emails_enhanced e
      WHERE 
        (e.subject LIKE '%' || @searchTerm || '%' OR e.body_preview LIKE '%' || @searchTerm || '%')
        AND (@status IS NULL OR e.status = @status)
        AND (@senderEmail IS NULL OR e.sender_email = @senderEmail)
        AND (@startDate IS NULL OR date(e.received_date_time) >= date(@startDate))
        AND (@endDate IS NULL OR date(e.received_date_time) <= date(@endDate))
      ORDER BY e.received_date_time DESC
      LIMIT @limit OFFSET @offset
    `);
  }

  /**
   * Get paginated email list with filters
   * Target: <100ms response time
   */
  getEmailList(options: EmailListOptions = {}): any[] {
    const {
      status = null,
      phase = null,
      minCompleteness = null,
      workflowState = null,
      sortBy = 'date',
      limit = 20,
      offset = 0
    } = options;

    return this?.emailListStmt?.all({
      status,
      phase,
      minCompleteness,
      workflowState,
      sortBy,
      limit,
      offset
    });
  }

  /**
   * Get dashboard statistics
   * Target: <50ms response time
   */
  getDashboardStats(): DashboardStats {
    return this?.dashboardStatsStmt?.get();
  }

  /**
   * Get complete email chain
   * Target: <100ms response time
   */
  getChainDetails(chainId: string): any[] {
    return this?.chainDetailsStmt?.all({ chainId });
  }

  /**
   * Get next batch for processing
   * Target: <50ms response time
   */
  getProcessingBatch(batchSize: number = 20): any[] {
    return this?.batchQueueStmt?.all({ batchSize });
  }

  /**
   * Get real-time processing status
   * Target: <50ms response time
   */
  getProcessingStatus(): ProcessingStatus {
    return this?.processingStatusStmt?.get();
  }

  /**
   * Search emails with filters
   * Target: <200ms response time
   */
  searchEmails(
    searchTerm: string,
    filters: {
      status?: string;
      senderEmail?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): any[] {
    const {
      status = null,
      senderEmail = null,
      startDate = null,
      endDate = null,
      limit = 20,
      offset = 0
    } = filters;

    return this?.searchStmt?.all({
      searchTerm,
      status,
      senderEmail,
      startDate,
      endDate,
      limit,
      offset
    });
  }

  /**
   * Get emails by phase with intelligent routing
   * Based on chain completeness score thresholds
   */
  getPhaseReadyEmails(phase: 2 | 3, limit: number = 20): any[] {
    const minCompleteness = phase === 2 ? 0.3 : 0.7;
    const sourcePhase = phase - 1;
    
    const stmt = this?.db?.prepare(`
      SELECT * FROM emails_enhanced
      WHERE phase_completed = @sourcePhase
        AND chain_completeness_score >= @minCompleteness
        AND status IN ('pending', 'imported', ${phase === 3 ? "'phase2_complete'" : "''"})
      ORDER BY 
        priority DESC,
        chain_completeness_score DESC,
        received_date_time DESC
      LIMIT @limit
    `);
    
    return stmt.all({ sourcePhase, minCompleteness, limit });
  }

  /**
   * Update email processing status in batch
   * Optimized for bulk updates
   */
  updateBatchStatus(
    emailIds: string[],
    status: string,
    phase?: number
  ): void {
    const placeholders = emailIds?.map(() => '?').join(',');
    const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    
    if (phase !== undefined) {
      updateFields.push('phase_completed = ?');
    }
    
    const stmt = this?.db?.prepare(`
      UPDATE emails_enhanced
      SET ${updateFields.join(', ')}
      WHERE id IN (${placeholders})
    `);
    
    const params: any[] = [status];
    if (phase !== undefined) {
      params.push(phase);
    }
    params.push(...emailIds);
    
    stmt.run(...params);
  }

  /**
   * Get workflow pattern statistics
   * For intelligence extraction insights
   */
  getWorkflowPatterns(): any[] {
    const stmt = this?.db?.prepare(`
      WITH chain_workflows AS (
        SELECT 
          chain_id,
          workflow_state,
          COUNT(*) as state_count,
          AVG(confidence_score) as avg_confidence,
          GROUP_CONCAT(DISTINCT phase_completed) as phases_used
        FROM emails_enhanced
        WHERE chain_id IS NOT NULL 
          AND workflow_state IS NOT NULL
        GROUP BY chain_id, workflow_state
      )
      SELECT 
        workflow_state,
        COUNT(DISTINCT chain_id) as chain_count,
        SUM(state_count) as total_occurrences,
        AVG(avg_confidence) as overall_confidence,
        GROUP_CONCAT(DISTINCT phases_used) as phases_involved
      FROM chain_workflows
      GROUP BY workflow_state
      ORDER BY chain_count DESC
    `);
    
    return stmt.all();
  }

  /**
   * Clean up and close prepared statements
   */
  close(): void {
    // Prepared statements are automatically garbage collected
    // but we can explicitly set them to null if needed
    this.emailListStmt = null;
    this.dashboardStatsStmt = null;
    this.chainDetailsStmt = null;
    this.batchQueueStmt = null;
    this.processingStatusStmt = null;
    this.searchStmt = null;
  }
}