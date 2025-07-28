/**
 * Adapter for transforming pipeline analysis data to EmailStorageService format
 * Implements the database adapter pattern for clean separation of concerns
 */

import { logger } from "../utils/logger.js";
import { PipelineJsonParser } from "../services/PipelineJsonParser.js";
import type {
  PipelineEmailAnalysis,
  LlamaAnalysisData,
  Phi4AnalysisData,
} from "../types/pipeline-analysis.js";
import type {
  EmailAnalysisResult,
  QuickAnalysis,
  DeepWorkflowAnalysis,
  ProcessingMetadata,
} from "../types/analysis-results.js";

/**
 * Database adapter interface for type-safe transformations
 */
export interface DatabaseAdapter<TRaw, TDomain> {
  fromDatabase(raw: TRaw): TDomain;
  toDatabase(domain: TDomain): TRaw;
  validate(data: unknown): data is TRaw;
}

/**
 * Adapter for converting pipeline analysis data to domain models
 */
export class PipelineAnalysisAdapter
  implements DatabaseAdapter<PipelineEmailAnalysis, EmailAnalysisResult>
{
  private readonly logger = logger;
  private readonly parser: PipelineJsonParser;

  constructor() {
    this.parser = new PipelineJsonParser();
  }

  /**
   * Transform raw database record to domain model
   */
  fromDatabase(row: PipelineEmailAnalysis): EmailAnalysisResult {
    this.logger.debug(
      `Transforming pipeline data to domain model - emailId: ${row.email_id}, stage: ${row.pipeline_stage}, model: ${row.final_model_used}`,
    );

    // Parse JSON data
    const llamaData = this.parser.parseLlamaAnalysis(row.llama_analysis);
    const phi4Data = this.parser.parsePhi4Analysis(row.phi4_analysis);

    // Build the analysis result
    const result: EmailAnalysisResult = {
      emailId: row.email_id,
      quick: this.mapQuickAnalysis(row, llamaData),
      deep: this.mapDeepAnalysis(llamaData, phi4Data),
      metadata: this.mapProcessingMetadata(row),
    };

    // Include raw data for debugging if available
    if (process.env.NODE_ENV === "development") {
      result.rawData = {
        llamaAnalysis: llamaData,
        phi4Analysis: phi4Data,
      };
    }

    return result;
  }

  /**
   * Transform domain model back to database format (not typically needed for read-only adapter)
   */
  toDatabase(domain: EmailAnalysisResult): PipelineEmailAnalysis {
    throw new Error("toDatabase not implemented - pipeline data is read-only");
  }

  /**
   * Validate that data matches expected pipeline structure
   */
  validate(data: unknown): data is PipelineEmailAnalysis {
    if (!data || typeof data !== "object") return false;

    const record = data as any;

    return (
      typeof record.id === "number" &&
      typeof record.email_id === "string" &&
      typeof record.pipeline_stage === "number" &&
      typeof record.pipeline_priority_score === "number" &&
      typeof record.final_model_used === "string" &&
      typeof record.analysis_timestamp === "string"
    );
  }

  /**
   * Map to quick analysis structure
   */
  private mapQuickAnalysis(
    row: PipelineEmailAnalysis,
    llama?: Partial<LlamaAnalysisData>,
  ): QuickAnalysis {
    // Use Llama data if available, otherwise fall back to pattern-based data
    const priority = this.parser.mapPriorityScore(row.pipeline_priority_score);
    const workflow = llama?.workflow_state
      ? this.parser.mapWorkflowState(llama.workflow_state)
      : this.mapStageToWorkflow(row.pipeline_stage);

    const urgency = this.mapUrgencyLevel(
      llama?.urgency_level ||
        this.inferUrgencyFromScore(row.pipeline_priority_score),
    );

    const intent = this.mapIntent(llama?.intent);
    const category = llama?.business_process
      ? this.parser.mapBusinessProcess(llama.business_process)
      : "General";

    return {
      priority,
      urgency,
      workflow,
      intent,
      category,
    };
  }

  /**
   * Map to deep analysis structure
   */
  private mapDeepAnalysis(
    llama?: Partial<LlamaAnalysisData>,
    phi4?: Partial<Phi4AnalysisData>,
  ): DeepWorkflowAnalysis {
    // Combine insights from both models
    const summary =
      phi4?.executive_summary ||
      llama?.contextual_summary ||
      "No detailed analysis available";

    const workflowState = llama?.workflow_state
      ? this.parser.mapWorkflowState(llama.workflow_state)
      : "NEW";

    const businessProcess = llama?.business_process
      ? this.parser.mapBusinessProcess(llama.business_process)
      : "General";

    const actionItems = llama?.action_items
      ? this.parser.parseActionItems(llama.action_items)
      : [];

    const slaStatus = phi4?.sla_assessment || llama?.sla_status || "Within SLA";

    const entities = llama
      ? this.parser.extractEntities(llama)
      : this.getEmptyEntities();

    const businessImpact = this.parser.parseBusinessImpact(
      llama?.business_impact,
      phi4?.business_impact,
    );

    const suggestedResponse = llama?.suggested_response;

    const insights = this.combineInsights(
      llama?.contextual_summary,
      phi4?.deep_insights,
      phi4?.strategic_recommendations,
    );

    return {
      summary,
      workflowState,
      businessProcess,
      actionItems,
      slaStatus,
      entities,
      businessImpact,
      suggestedResponse,
      insights,
    };
  }

  /**
   * Map processing metadata
   */
  private mapProcessingMetadata(
    row: PipelineEmailAnalysis,
  ): ProcessingMetadata {
    // Determine confidence based on which models were used
    let confidence = 0;
    let model = row.final_model_used;

    if (row.pipeline_stage >= 3 && row.phi4_analysis) {
      confidence = 0.95; // Highest confidence with Phi-4 analysis
      model = "phi4-14b";
    } else if (row.pipeline_stage >= 2 && row.llama_analysis) {
      confidence = 0.85; // Good confidence with Llama analysis
      model = "llama-3.2:3b";
    } else {
      confidence = 0.65; // Pattern-based only
      model = "pattern";
    }

    return {
      analysisVersion: "1.1.0",
      model,
      timestamp: row.analysis_timestamp,
      confidence,
      dataSource: "pipeline",
    };
  }

  // Helper methods

  private mapStageToWorkflow(stage: number): QuickAnalysis["workflow"] {
    if (stage >= 3) return "COMPLETE";
    if (stage >= 2) return "IN_PROGRESS";
    return "NEW";
  }

  private mapUrgencyLevel(urgency: string): QuickAnalysis["urgency"] {
    const urgencyMap: Record<string, QuickAnalysis["urgency"]> = {
      immediate: "Immediate",
      critical: "Immediate",
      high: "High",
      medium: "Medium",
      low: "Low",
    };

    const normalized = urgency.toLowerCase();
    return urgencyMap[normalized] || "Medium";
  }

  private inferUrgencyFromScore(score: number): string {
    if (score >= 8) return "immediate";
    if (score >= 6) return "high";
    if (score >= 4) return "medium";
    return "low";
  }

  private mapIntent(intent?: string): QuickAnalysis["intent"] {
    const intentMap: Record<string, QuickAnalysis["intent"]> = {
      request: "Request",
      information: "Information",
      complaint: "Complaint",
      confirmation: "Confirmation",
      other: "Other",
    };

    const normalized = (intent || "other").toLowerCase();
    return intentMap[normalized] || "Other";
  }

  private getEmptyEntities(): DeepWorkflowAnalysis["entities"] {
    return {
      po_numbers: [],
      quote_numbers: [],
      case_numbers: [],
      part_numbers: [],
      companies: [],
      contacts: [],
      reference_numbers: [],
      order_references: [],
    };
  }

  private combineInsights(
    summary?: string,
    deepInsights?: string[],
    recommendations?: string[],
  ): string[] {
    const insights: string[] = [];

    // Add summary as first insight if substantial
    if (summary && summary.length > 50) {
      insights.push(summary);
    }

    // Add deep insights
    if (deepInsights && deepInsights.length > 0) {
      insights.push(...deepInsights);
    }

    // Add strategic recommendations
    if (recommendations && recommendations.length > 0) {
      insights.push(...recommendations);
    }

    // Ensure we have at least one insight
    if (insights.length === 0) {
      insights.push("Email processed successfully through analysis pipeline");
    }

    // Limit to reasonable number of insights
    return insights.slice(0, 5);
  }

  /**
   * Batch transform multiple records for efficiency
   */
  async batchFromDatabase(
    rows: PipelineEmailAnalysis[],
  ): Promise<EmailAnalysisResult[]> {
    this.logger.info(`Batch transforming ${rows.length} pipeline records`);

    const results: EmailAnalysisResult[] = [];
    const errors: Array<{ emailId: string; error: string }> = [];

    for (const row of rows) {
      try {
        const result = this.fromDatabase(row);
        results.push(result);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ emailId: row.email_id, error: errorMsg });
        this.logger.error(
          `Failed to transform pipeline record - emailId: ${row.email_id}, error: ${errorMsg}`,
        );
      }
    }

    if (errors.length > 0) {
      this.logger.warn(
        `Batch transformation completed with ${errors.length} errors - totalProcessed: ${rows.length}, successCount: ${results.length}, errorCount: ${errors.length}`,
      );
    }

    return results;
  }
}
