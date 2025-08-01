/**
 * Three-Stage Pipeline Orchestrator
 * Manages the execution of the email analysis pipeline
 */

import { logger } from "../../utils/logger.js";
import { Stage1PatternTriage } from "./Stage1PatternTriage.js";
import { Stage2LlamaAnalysis } from "./Stage2LlamaAnalysis.js";
import { Stage3CriticalAnalysis } from "./Stage3CriticalAnalysis.js";
import { getDatabaseConnection } from "../../database/connection.js";
import type {
  PipelineResults,
  TriageResults,
  LlamaAnalysisResults,
  CriticalAnalysisResults,
  Email,
  TriageResult,
  LlamaAnalysisResult,
  CriticalAnalysisResult,
  PipelineStatus,
} from "./types.js";

export class PipelineOrchestrator {
  private stage1: Stage1PatternTriage;
  private stage2: Stage2LlamaAnalysis;
  private stage3: Stage3CriticalAnalysis;
  private executionId?: number;

  constructor() {
    this.stage1 = new Stage1PatternTriage();
    this.stage2 = new Stage2LlamaAnalysis();
    this.stage3 = new Stage3CriticalAnalysis();
  }

  /**
   * Run the complete three-stage pipeline
   */
  async runThreeStagePipeline(): Promise<PipelineResults> {
    const startTime = Date.now();
    logger.info("Starting Three-Stage Pipeline Execution", "PIPELINE");

    try {
      // Create pipeline execution record
      this.executionId = await this.createExecutionRecord();

      // Get all emails
      const emails = await this.getAllEmails();
      logger.info(`Found ${emails.length} emails to process`, "PIPELINE");

      // Stage 1: Pattern-based triage
      logger.info("Starting Stage 1: Pattern Triage", "PIPELINE");
      const triageResults = await this.stage1.process(emails);
      await this.updateExecutionRecord(1, triageResults.all.length);

      // Stage 2: Llama 3.2:3b for priority emails (top 1000)
      logger.info(
        `Starting Stage 2: Llama Analysis for ${triageResults.top5000.length} priority emails (top 1000)`,
        "PIPELINE",
      );

      // Set up progress callback for real-time updates
      this.stage2.setProgressCallback(async (count: number) => {
        await this.updateExecutionRecord(2, count);
      });

      const priorityResults = await this.stage2.process(triageResults.top5000);
      // Final update handled by progress callback, no redundant update needed

      // Stage 3: Deep analysis for critical emails (top 100)
      logger.info(
        `Starting Stage 3: Deep Analysis for ${triageResults.top500.length} critical emails (top 100)`,
        "PIPELINE",
      );

      // Set up progress callback for real-time updates
      this.stage3.setProgressCallback(async (count: number) => {
        await this.updateExecutionRecord(3, count);
      });

      const criticalResults = await this.stage3.process(triageResults.top500);
      // Final update handled by progress callback, no redundant update needed

      // Consolidate results
      const results = await this.consolidateResults(
        triageResults,
        priorityResults,
        criticalResults,
      );

      // Mark execution as complete
      await this.completeExecution(startTime);

      logger.info("Pipeline execution completed successfully", "PIPELINE");
      return results;
    } catch (error) {
      logger.error("Pipeline execution failed", "PIPELINE", error as Error);
      await this.failExecution(error as Error);
      throw error;
    }
  }

  /**
   * Get all emails from the database
   */
  private async getAllEmails(): Promise<Email[]> {
    const db = getDatabaseConnection();
    const emails = db
      .prepare(
        `
      SELECT 
        id,
        message_id,
        subject,
        sender_email,
        recipients as recipient_emails,
        received_at as date_received,
        body_text as body,
        categories as folder,
        is_read,
        created_at,
        updated_at
      FROM emails_enhanced
      ORDER BY received_at DESC
    `,
      )
      .all() as Email[];

    return emails;
  }

  /**
   * Create execution record in database
   */
  private async createExecutionRecord(): Promise<number> {
    const db = getDatabaseConnection();
    const result = db
      .prepare(
        `
      INSERT INTO pipeline_executions 
      (started_at, status, stage1_count, stage2_count, stage3_count)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(new Date().toISOString(), "running", 0, 0, 0);

    return result.lastInsertRowid as number;
  }

  /**
   * Update execution record with stage progress
   */
  private async updateExecutionRecord(
    stage: number,
    count: number,
  ): Promise<void> {
    if (!this.executionId) return;

    try {
      const db = getDatabaseConnection();
      const columnName = `stage${stage}_count`;

      db.prepare(
        `
        UPDATE pipeline_executions 
        SET ${columnName} = ?, updated_at = ?
        WHERE id = ?
      `,
      ).run(count, new Date().toISOString(), this.executionId);

      logger.debug(
        `Updated ${columnName} to ${count} for execution ${this.executionId}`,
        "PIPELINE",
      );
    } catch (error) {
      logger.error(
        `Failed to update execution record for stage ${stage}`,
        "PIPELINE",
        error as Error,
      );
      // Don't throw - progress tracking failure shouldn't stop processing
    }
  }

  /**
   * Mark execution as complete
   */
  private async completeExecution(startTime: number): Promise<void> {
    if (!this.executionId) return;

    const totalTime = (Date.now() - startTime) / 1000;
    const db = getDatabaseConnection();

    db.prepare(
      `
      UPDATE pipeline_executions 
      SET completed_at = ?,
          total_processing_time_seconds = ?,
          status = ?
      WHERE id = ?
    `,
    ).run(new Date().toISOString(), totalTime, "completed", this.executionId);
  }

  /**
   * Mark execution as failed
   */
  private async failExecution(error: Error): Promise<void> {
    if (!this.executionId) return;

    const db = getDatabaseConnection();
    db.prepare(
      `
      UPDATE pipeline_executions 
      SET completed_at = ?,
          status = ?,
          error_message = ?
      WHERE id = ?
    `,
    ).run(new Date().toISOString(), "failed", error.message, this.executionId);
  }

  /**
   * Consolidate results from all stages
   */
  private async consolidateResults(
    triageResults: TriageResults,
    priorityResults: LlamaAnalysisResults,
    criticalResults: CriticalAnalysisResults,
  ): Promise<PipelineResults> {
    // Create a map for efficient lookup
    const emailAnalysisMap = new Map<
      string,
      {
        emailId: string;
        stage1: TriageResult;
        stage2: LlamaAnalysisResult | null;
        stage3: CriticalAnalysisResult | null;
        finalScore: number;
        pipelineStage: number;
      }
    >();

    // Add triage results (all emails)
    for (const result of triageResults.all) {
      emailAnalysisMap.set(result.emailId, {
        emailId: result.emailId,
        stage1: result,
        stage2: null,
        stage3: null,
        finalScore: result.priorityScore,
        pipelineStage: 1,
      });
    }

    // Add Llama analysis results
    for (const result of priorityResults) {
      const existing = emailAnalysisMap.get(result.emailId);
      if (existing) {
        existing.stage2 = result;
        existing.finalScore = result.qualityScore || existing.finalScore;
        existing.pipelineStage = 2;
      }
    }

    // Add critical analysis results
    for (const result of criticalResults) {
      const existing = emailAnalysisMap.get(result.emailId);
      if (existing) {
        existing.stage3 = result;
        existing.finalScore = result.qualityScore || existing.finalScore;
        existing.pipelineStage = 3;
      }
    }

    // Save consolidated results to database
    await this.saveConsolidatedResults(Array.from(emailAnalysisMap.values()));

    return {
      totalEmails: triageResults.all.length,
      stage1Count: triageResults.all.length,
      stage2Count: priorityResults.length,
      stage3Count: criticalResults.length,
      executionId: this.executionId!,
      results: Array.from(emailAnalysisMap.values()),
    };
  }

  /**
   * Save consolidated results to database
   */
  private async saveConsolidatedResults(
    results: Array<{
      emailId: string;
      stage1: TriageResult;
      stage2: LlamaAnalysisResult | null;
      stage3: CriticalAnalysisResult | null;
      finalScore: number;
      pipelineStage: number;
    }>,
  ): Promise<void> {
    const db = getDatabaseConnection();

    // Update email_analysis table with pipeline results
    const updateStmt = db.prepare(`
      UPDATE email_analysis 
      SET pipeline_stage = ?,
          pipeline_priority_score = ?,
          llama_analysis = ?,
          phi4_analysis = ?,
          final_model_used = ?,
          analysis_timestamp = ?
      WHERE email_id = ?
    `);

    const insertStmt = this.executionId
      ? db.prepare(`
      INSERT INTO stage_results 
      (execution_id, email_id, stage, priority_score, processing_time_seconds, model_used, analysis_quality_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      : null;

    for (const result of results) {
      // Update email_analysis
      updateStmt.run(
        result.pipelineStage,
        result.finalScore,
        result.stage2 ? JSON.stringify(result.stage2) : null,
        result.stage3 ? JSON.stringify(result.stage3) : null,
        result.stage3
          ? result.stage3.modelUsed
          : result.stage2
            ? "llama3.2:3b"
            : "pattern",
        new Date().toISOString(),
        result.emailId,
      );

      // Insert stage results
      if (this.executionId && insertStmt) {
        insertStmt.run(
          this.executionId,
          result.emailId,
          result.pipelineStage,
          result.finalScore,
          result.stage3?.processingTime ||
            result.stage2?.processingTime ||
            result.stage1?.processingTime ||
            0,
          result.stage3
            ? result.stage3.modelUsed
            : result.stage2
              ? "llama3.2:3b"
              : "pattern",
          result.finalScore,
        );
      }
    }
  }

  /**
   * Get current pipeline status
   */
  async getStatus(): Promise<PipelineStatus> {
    if (!this.executionId) {
      return { status: "not_running" };
    }

    const db = getDatabaseConnection();
    const execution = db
      .prepare(
        `
      SELECT * FROM pipeline_executions
      WHERE id = ?
    `,
      )
      .get(this.executionId) as
      | {
          id: number;
          status: string;
          started_at: string;
          completed_at?: string;
          stage1_count: number;
          stage2_count: number;
          stage3_count: number;
          error_message?: string;
        }
      | undefined;

    return execution
      ? {
          status: execution.status as PipelineStatus["status"],
          executionId: execution.id,
          startedAt: execution.started_at,
          completedAt: execution.completed_at,
          stage1Progress: execution.stage1_count,
          stage2Progress: execution.stage2_count,
          stage3Progress: execution.stage3_count,
          errorMessage: execution.error_message,
        }
      : { status: "not_running" };
  }
}
