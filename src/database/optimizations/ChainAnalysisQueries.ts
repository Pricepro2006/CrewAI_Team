/**
 * Optimized Chain Analysis Queries for Email Pipeline
 * 
 * Provides efficient chain completeness analysis and grouping operations
 * Target: < 200ms for complex chain analysis queries
 */

import type Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";

export interface ChainCompletenessResult {
  chainId: string;
  emailCount: number;
  completenessScore: number;
  chainStatus: 'complete' | 'partial' | 'broken';
  recommendedPhase: number;
  firstEmailAt: string;
  lastEmailAt: string;
  avgProcessingTime?: number;
  primaryWorkflow?: string;
  priorityScore: number;
}

export interface ChainAnalysisStats {
  totalChains: number;
  completeChains: number;
  partialChains: number;
  brokenChains: number;
  avgComleteness: number;
  avgEmailsPerChain: number;
  processingDistribution: {
    phase1: number;
    phase2: number;
    phase3: number;
  };
}

export interface ChainProcessingBatch {
  chains: ChainCompletenessResult[];
  totalEmails: number;
  estimatedProcessingTime: number;
  batchId: string;
}

export class ChainAnalysisQueries {
  private db: Database.Database;
  private preparedStatements: Map<string, Database.Statement>;

  constructor(db: Database.Database) {
    this.db = db;
    this.preparedStatements = new Map();
    this.initializePreparedStatements();
  }

  /**
   * Initialize optimized prepared statements for chain analysis
   */
  private initializePreparedStatements(): void {
    // Fast chain completeness analysis with single scan
    this?.preparedStatements?.set('analyzeChainCompleteness', this?.db?.prepare(`
      WITH chain_metrics AS (
        SELECT 
          COALESCE(e.chain_id, 'orphan_' || e.id) as chain_id,
          COUNT(*) as email_count,
          MIN(e.received_at) as first_email_at,
          MAX(e.received_at) as last_email_at,
          AVG(e.completeness_score) as avg_completeness,
          MAX(e.completeness_score) as max_completeness,
          MIN(e.completeness_score) as min_completeness,
          AVG(e.processing_time_ms) as avg_processing_time,
          MODE() WITHIN GROUP (ORDER BY e.workflow_state) as primary_workflow,
          COUNT(DISTINCT e.from_address) as sender_count,
          COUNT(CASE WHEN e.processing_status = 'completed' THEN 1 END) as completed_count,
          AVG(CASE WHEN e.priority_score IS NOT NULL THEN e.priority_score ELSE 0.5 END) as priority_score
        FROM emails_enhanced e
        WHERE e.received_at >= date('now', '-30 days')
          AND (? IS NULL OR e.processing_status = ?)
        GROUP BY COALESCE(e.chain_id, 'orphan_' || e.id)
        HAVING email_count >= ?
      ),
      chain_classification AS (
        SELECT 
          *,
          CASE 
            WHEN avg_completeness >= 0.8 AND sender_count >= 2 THEN 'complete'
            WHEN avg_completeness >= 0.5 AND email_count >= 3 THEN 'partial'
            ELSE 'broken'
          END as chain_status,
          CASE 
            WHEN avg_completeness >= 0.8 THEN 1
            WHEN avg_completeness >= 0.6 THEN 2
            ELSE 3
          END as recommended_phase
        FROM chain_metrics
      )
      SELECT 
        chain_id,
        email_count,
        ROUND(avg_completeness, 3) as completeness_score,
        chain_status,
        recommended_phase,
        first_email_at,
        last_email_at,
        ROUND(avg_processing_time, 2) as avg_processing_time,
        primary_workflow,
        ROUND(priority_score, 3) as priority_score
      FROM chain_classification
      ORDER BY 
        CASE chain_status 
          WHEN 'complete' THEN 1 
          WHEN 'partial' THEN 2 
          ELSE 3 
        END,
        priority_score DESC,
        email_count DESC
      LIMIT ?
    `));

    // Fast chain statistics aggregation
    this?.preparedStatements?.set('getChainStatistics', this?.db?.prepare(`
      WITH chain_summary AS (
        SELECT 
          COALESCE(e.chain_id, 'orphan_' || e.id) as chain_id,
          COUNT(*) as email_count,
          AVG(e.completeness_score) as avg_completeness,
          COUNT(DISTINCT e.from_address) as sender_count,
          MAX(e.recommended_phase) as max_phase
        FROM emails_enhanced e
        WHERE e.received_at >= date('now', '-7 days')
        GROUP BY COALESCE(e.chain_id, 'orphan_' || e.id)
        HAVING email_count >= 1
      ),
      classification AS (
        SELECT 
          *,
          CASE 
            WHEN avg_completeness >= 0.8 AND sender_count >= 2 THEN 'complete'
            WHEN avg_completeness >= 0.5 AND email_count >= 3 THEN 'partial'
            ELSE 'broken'
          END as chain_status
        FROM chain_summary
      )
      SELECT 
        COUNT(*) as total_chains,
        SUM(CASE WHEN chain_status = 'complete' THEN 1 ELSE 0 END) as complete_chains,
        SUM(CASE WHEN chain_status = 'partial' THEN 1 ELSE 0 END) as partial_chains,
        SUM(CASE WHEN chain_status = 'broken' THEN 1 ELSE 0 END) as broken_chains,
        ROUND(AVG(avg_completeness), 3) as avg_completeness,
        ROUND(AVG(email_count), 1) as avg_emails_per_chain,
        SUM(CASE WHEN max_phase = 1 THEN 1 ELSE 0 END) as phase1_chains,
        SUM(CASE WHEN max_phase = 2 THEN 1 ELSE 0 END) as phase2_chains,
        SUM(CASE WHEN max_phase = 3 THEN 1 ELSE 0 END) as phase3_chains
      FROM classification
    `));

    // Optimized chain-based batch selection
    this?.preparedStatements?.set('selectChainBatch', this?.db?.prepare(`
      WITH priority_chains AS (
        SELECT 
          COALESCE(e.chain_id, 'orphan_' || e.id) as chain_id,
          COUNT(*) as email_count,
          AVG(e.completeness_score) as avg_completeness,
          AVG(COALESCE(e.priority_score, 0.5)) as priority_score,
          MIN(e.received_at) as first_email_at,
          COUNT(CASE WHEN e.processing_status = 'pending' THEN 1 END) as pending_count
        FROM emails_enhanced e
        WHERE e.processing_status IN ('pending', 'processing')
          AND e.recommended_phase = ?
        GROUP BY COALESCE(e.chain_id, 'orphan_' || e.id)
        HAVING pending_count > 0
        ORDER BY 
          priority_score DESC,
          avg_completeness DESC,
          pending_count DESC
        LIMIT ?
      )
      SELECT 
        pc.chain_id,
        pc.email_count,
        pc.avg_completeness as completeness_score,
        CASE 
          WHEN pc.avg_completeness >= 0.8 THEN 'complete'
          WHEN pc.avg_completeness >= 0.5 THEN 'partial'
          ELSE 'broken'
        END as chain_status,
        ? as recommended_phase,
        pc.first_email_at,
        datetime('now') as last_email_at,
        null as avg_processing_time,
        null as primary_workflow,
        pc.priority_score
      FROM priority_chains pc
    `));

    // Update chain completeness scores efficiently
    this?.preparedStatements?.set('updateChainCompleteness', this?.db?.prepare(`
      UPDATE emails_enhanced 
      SET 
        completeness_score = ?,
        recommended_phase = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE chain_id = ?
    `));

    // Bulk chain creation for orphaned emails
    this?.preparedStatements?.set('createChainForOrphans', this?.db?.prepare(`
      UPDATE emails_enhanced 
      SET 
        chain_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${Array(50).fill('?').join(',')}) -- Support up to 50 emails per chain
    `));

    logger.info("Chain analysis prepared statements initialized", "CHAIN_QUERIES");
  }

  /**
   * Perform fast chain completeness analysis
   * Target: < 200ms for 1000+ chains
   */
  async analyzeChainCompleteness(
    statusFilter?: string, 
    minEmailsPerChain: number = 2,
    limit: number = 1000
  ): Promise<ChainCompletenessResult[]> {
    const startTime = performance.now();
    
    try {
      const stmt = this?.preparedStatements?.get('analyzeChainCompleteness')!;
      const results = stmt.all(
        statusFilter || null, 
        statusFilter || null, 
        minEmailsPerChain, 
        limit
      ) as ChainCompletenessResult[];

      const executionTime = performance.now() - startTime;
      
      logger.info(
        `Chain analysis completed: ${results?.length || 0} chains in ${executionTime.toFixed(2)}ms`,
        "CHAIN_QUERIES"
      );

      return results;
    } catch (error) {
      logger.error(`Chain completeness analysis failed: ${error}`, "CHAIN_QUERIES");
      throw error;
    }
  }

  /**
   * Get comprehensive chain statistics
   * Target: < 100ms execution time
   */
  async getChainStatistics(): Promise<ChainAnalysisStats> {
    const startTime = performance.now();
    
    try {
      const stmt = this?.preparedStatements?.get('getChainStatistics')!;
      const result = stmt.get() as any;

      const executionTime = performance.now() - startTime;
      
      const stats: ChainAnalysisStats = {
        totalChains: result.total_chains || 0,
        completeChains: result.complete_chains || 0,
        partialChains: result.partial_chains || 0,
        brokenChains: result.broken_chains || 0,
        avgComleteness: result.avg_completeness || 0,
        avgEmailsPerChain: result.avg_emails_per_chain || 0,
        processingDistribution: {
          phase1: result.phase1_chains || 0,
          phase2: result.phase2_chains || 0,
          phase3: result.phase3_chains || 0,
        }
      };

      logger.info(
        `Chain statistics generated in ${executionTime.toFixed(2)}ms`,
        "CHAIN_QUERIES"
      );

      return stats;
    } catch (error) {
      logger.error(`Chain statistics generation failed: ${error}`, "CHAIN_QUERIES");
      throw error;
    }
  }

  /**
   * Get optimized chain-based processing batch
   * Prioritizes complete chains for better processing efficiency
   */
  async getChainBasedBatch(
    phase: 1 | 2 | 3, 
    maxChains: number = 50
  ): Promise<ChainProcessingBatch> {
    const startTime = performance.now();
    const batchId = `chain_batch_${Date.now()}_p${phase}`;
    
    try {
      const stmt = this?.preparedStatements?.get('selectChainBatch')!;
      const chains = stmt.all(phase, maxChains, phase) as ChainCompletenessResult[];

      // Calculate total emails in batch
      const totalEmails = chains.reduce((sum: any, chain: any) => sum + chain.emailCount, 0);
      
      // Estimate processing time based on phase and chain complexity
      const baseTimePerEmail = {
        1: 800,   // Rule-based
        2: 2500,  // Llama 3.2
        3: 4000   // Phi-4
      };
      
      const avgComplexity = chains.reduce((sum: any, chain: any) => sum + chain.completenessScore, 0) / chains?.length || 0 || 1;
      const estimatedProcessingTime = totalEmails * baseTimePerEmail[phase] * avgComplexity;

      const executionTime = performance.now() - startTime;
      
      const batch: ChainProcessingBatch = {
        chains,
        totalEmails,
        estimatedProcessingTime: Math.round(estimatedProcessingTime),
        batchId
      };

      logger.info(
        `Chain batch selected: ${chains?.length || 0} chains (${totalEmails} emails) in ${executionTime.toFixed(2)}ms`,
        "CHAIN_QUERIES"
      );

      return batch;
    } catch (error) {
      logger.error(`Chain batch selection failed: ${error}`, "CHAIN_QUERIES");
      throw error;
    }
  }

  /**
   * Bulk update chain completeness scores
   * Optimized for processing large numbers of chains
   */
  async updateChainCompleteness(
    updates: Array<{
      chainId: string;
      completenessScore: number;
      recommendedPhase: number;
    }>
  ): Promise<void> {
    const startTime = performance.now();
    
    return this?.db?.transaction(() => {
      const stmt = this?.preparedStatements?.get('updateChainCompleteness')!;
      
      for (const update of updates) {
        stmt.run(
          update.completenessScore,
          update.recommendedPhase,
          update.chainId
        );
      }
      
      const executionTime = performance.now() - startTime;
      logger.info(
        `Updated ${updates?.length || 0} chain completeness scores in ${executionTime.toFixed(2)}ms`,
        "CHAIN_QUERIES"
      );
    })();
  }

  /**
   * Create chains for orphaned emails to improve processing efficiency
   * Groups emails by subject similarity and temporal proximity
   */
  async createChainsForOrphans(limit: number = 1000): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Find orphaned emails (no chain_id)
      const orphanStmt = this?.db?.prepare(`
        SELECT 
          id, subject, from_address, received_at,
          substr(subject, 1, 50) as subject_prefix
        FROM emails_enhanced 
        WHERE chain_id IS NULL 
          AND processing_status = 'pending'
        ORDER BY received_at DESC
        LIMIT ?
      `);
      
      const orphans = orphanStmt.all(limit) as any[];
      
      if (orphans?.length || 0 === 0) {
        return 0;
      }

      // Group orphans by subject similarity and create chains
      const chainGroups = this.groupOrphansBySubject(orphans);
      let chainsCreated = 0;
      
      return this?.db?.transaction(() => {
        for (const group of chainGroups) {
          if (group?.emails?.length >= 2) {
            const chainId = `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Update emails in batches of 50
            const batches = this.chunkArray(group?.emails?.map(e => e.id), 50);
            
            for (const batch of batches) {
              const placeholders = Array(batch?.length || 0).fill('?').join(',');
              const updateStmt = this?.db?.prepare(`
                UPDATE emails_enhanced 
                SET 
                  chain_id = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id IN (${placeholders})
              `);
              
              updateStmt.run(chainId, ...batch);
            }
            
            chainsCreated++;
          }
        }
        
        const executionTime = performance.now() - startTime;
        logger.info(
          `Created ${chainsCreated} chains for ${orphans?.length || 0} orphaned emails in ${executionTime.toFixed(2)}ms`,
          "CHAIN_QUERIES"
        );
        
        return chainsCreated;
      })();
      
    } catch (error) {
      logger.error(`Chain creation for orphans failed: ${error}`, "CHAIN_QUERIES");
      throw error;
    }
  }

  /**
   * Group orphaned emails by subject similarity
   */
  private groupOrphansBySubject(orphans: any[]): Array<{emails: any[], subjectPattern: string}> {
    const groups: Map<string, any[]> = new Map();
    
    for (const email of orphans) {
      // Create a normalized subject pattern for grouping
      const pattern = this.normalizeSubjectForGrouping(email.subject);
      
      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      groups.get(pattern)!.push(email);
    }
    
    return Array.from(groups.entries())
      .map(([pattern, emails]) => ({
        emails,
        subjectPattern: pattern
      }))
      .filter(group => group?.emails?.length >= 2) // Only create chains for 2+ emails
      .sort((a, b) => b?.emails?.length - a?.emails?.length); // Process larger groups first
  }

  /**
   * Normalize email subject for grouping by removing common variations
   */
  private normalizeSubjectForGrouping(subject: string): string {
    return subject
      .toLowerCase()
      .replace(/^(re:|fwd?:|fw:)\s*/g, '') // Remove reply/forward prefixes
      .replace(/\[[^\]]*\]/g, '') // Remove bracketed content
      .replace(/\d+/g, '#') // Replace numbers with placeholder
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 50); // Limit length for consistent grouping
  }

  /**
   * Utility function to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array?.length || 0; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Cleanup prepared statements
   */
  close(): void {
    this?.preparedStatements?.clear();
    logger.info("Chain analysis queries cleaned up", "CHAIN_QUERIES");
  }
}