import { IRepository } from "./IRepository.js";
import {
  EmailAnalysis,
  AnalysisPhase,
  AnalysisConfidence,
} from "../../../types/AnalysisTypes.js";

/**
 * Email analysis repository interface
 */
export interface IAnalysisRepository
  extends IRepository<EmailAnalysis, string> {
  /**
   * Find analysis by email ID
   */
  findByEmailId(emailId: string): Promise<EmailAnalysis | null>;

  /**
   * Find analyses by version
   */
  findByVersion(version: string): Promise<EmailAnalysis[]>;

  /**
   * Find analyses by workflow type
   */
  findByWorkflowType(workflowType: string): Promise<EmailAnalysis[]>;

  /**
   * Find analyses by confidence range
   */
  findByConfidenceRange(
    minConfidence: number,
    maxConfidence: number,
  ): Promise<EmailAnalysis[]>;

  /**
   * Find analyses with specific phase results
   */
  findByPhaseCompletion(phases: AnalysisPhase[]): Promise<EmailAnalysis[]>;

  /**
   * Update phase results
   */
  updatePhaseResults(
    analysisId: string,
    phase: AnalysisPhase,
    results: any,
  ): Promise<void>;

  /**
   * Update final summary
   */
  updateSummary(analysisId: string, summary: any): Promise<void>;

  /**
   * Get analysis statistics
   */
  getAnalysisStatistics(): Promise<{
    total: number;
    byVersion: Record<string, number>;
    byWorkflowType: Record<string, number>;
    avgConfidence: number;
    phase1Only: number;
    phase2Completed: number;
    phase3Completed: number;
  }>;

  /**
   * Find analyses for complete chains
   */
  findForCompleteChains(): Promise<EmailAnalysis[]>;

  /**
   * Batch create analyses
   */
  batchCreate(analyses: Omit<EmailAnalysis, "id">[]): Promise<EmailAnalysis[]>;

  /**
   * Find recent analyses
   */
  findRecent(limit: number): Promise<EmailAnalysis[]>;

  /**
   * Delete old analyses
   */
  deleteOlderThan(date: Date): Promise<number>;

  /**
   * Find analyses needing phase upgrade
   */
  findNeedingPhaseUpgrade(
    currentPhase: AnalysisPhase,
  ): Promise<EmailAnalysis[]>;
}
