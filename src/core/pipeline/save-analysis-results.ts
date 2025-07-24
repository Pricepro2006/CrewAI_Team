import { getDatabaseConnection } from "@/database/connection";
import { logger } from "@/utils/logger";
import type { LlamaAnalysisResult, CriticalAnalysisResult } from "./types";

export interface AnalysisToSave {
  emailId: string;
  pipelineStage: number;
  priorityScore: number;
  llamaAnalysis?: LlamaAnalysisResult;
  phi4Analysis?: CriticalAnalysisResult;
  finalModelUsed: string;
}

/**
 * Save analysis results to the email_analysis table
 */
export async function saveAnalysisResults(
  analyses: AnalysisToSave[],
): Promise<void> {
  const db = getDatabaseConnection();

  // Prepare the insert statement
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO email_analysis (
      email_id,
      pipeline_stage,
      pipeline_priority_score,
      llama_analysis,
      phi4_analysis,
      final_model_used,
      analysis_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  // Use a transaction for batch insert
  const saveAll = db.transaction((analyses: AnalysisToSave[]) => {
    for (const analysis of analyses) {
      try {
        // Convert objects to JSON strings
        const llamaJson = analysis.llamaAnalysis
          ? JSON.stringify(analysis.llamaAnalysis)
          : null;

        const phi4Json = analysis.phi4Analysis
          ? JSON.stringify(analysis.phi4Analysis)
          : null;

        stmt.run(
          analysis.emailId,
          analysis.pipelineStage,
          analysis.priorityScore,
          llamaJson,
          phi4Json,
          analysis.finalModelUsed,
        );
      } catch (error) {
        logger.error(
          "Failed to save analysis for email",
          "SAVE_ANALYSIS",
          { emailId: analysis.emailId },
          error as Error,
        );
      }
    }
  });

  try {
    saveAll(analyses);
    logger.info(
      `Saved analysis results for ${analyses.length} emails`,
      "SAVE_ANALYSIS",
    );
  } catch (error) {
    logger.error(
      "Failed to save analysis results batch",
      "SAVE_ANALYSIS",
      error as Error,
    );
    throw error;
  }
}

/**
 * Create the compatibility view for EmailStorageService
 * This transforms the pipeline JSON into the expected schema
 */
export async function createCompatibilityView(): Promise<void> {
  const db = getDatabaseConnection();

  try {
    // Drop existing view if it exists
    db.exec(`DROP VIEW IF EXISTS email_analysis_view`);

    // Create view that transforms JSON to match EmailStorageService expectations
    db.exec(`
      CREATE VIEW email_analysis_view AS
      SELECT 
        ea.id,
        ea.email_id,
        
        -- Quick analysis fields (from Stage 1)
        COALESCE(
          json_extract(ea.llama_analysis, '$.workflow_state'),
          'NEW'
        ) as quick_workflow,
        
        CASE 
          WHEN ea.pipeline_priority_score >= 80 THEN 'critical'
          WHEN ea.pipeline_priority_score >= 60 THEN 'high'
          WHEN ea.pipeline_priority_score >= 40 THEN 'medium'
          ELSE 'low'
        END as quick_priority,
        
        COALESCE(
          json_extract(ea.llama_analysis, '$.intent'),
          'Information'
        ) as quick_intent,
        
        COALESCE(
          json_extract(ea.llama_analysis, '$.urgency_level'),
          'MEDIUM'
        ) as quick_urgency,
        
        -- Deep analysis fields (from Stage 2)
        COALESCE(
          json_extract(ea.llama_analysis, '$.business_process'),
          'General'
        ) as deep_workflow_primary,
        
        json_extract(ea.llama_analysis, '$.workflow_state') as workflow_state,
        json_extract(ea.llama_analysis, '$.contextual_summary') as contextual_summary,
        
        -- Entity extraction
        json_extract(ea.llama_analysis, '$.entities.po_numbers') as entities_po_numbers,
        json_extract(ea.llama_analysis, '$.entities.quote_numbers') as entities_quote_numbers,
        json_extract(ea.llama_analysis, '$.entities.case_numbers') as entities_case_numbers,
        json_extract(ea.llama_analysis, '$.entities.part_numbers') as entities_part_numbers,
        json_extract(ea.llama_analysis, '$.entities.companies') as entities_contacts,
        
        -- Action items and response
        json_extract(ea.llama_analysis, '$.action_items') as action_items,
        json_extract(ea.llama_analysis, '$.suggested_response') as suggested_response,
        
        -- Critical analysis (from Stage 3 if available)
        COALESCE(
          json_extract(ea.phi4_analysis, '$.executive_summary'),
          json_extract(ea.llama_analysis, '$.contextual_summary')
        ) as deep_summary,
        
        json_extract(ea.phi4_analysis, '$.business_impact') as business_impact,
        json_extract(ea.phi4_analysis, '$.sla_assessment') as sla_status,
        
        -- Metadata
        ea.final_model_used as analysis_model,
        ea.analysis_timestamp,
        json_extract(ea.llama_analysis, '$.quality_score') as confidence_score,
        
        -- Timestamps
        datetime('now') as created_at,
        datetime('now') as updated_at
        
      FROM email_analysis ea
      WHERE ea.llama_analysis IS NOT NULL
    `);

    logger.info(
      "Created email_analysis_view for compatibility",
      "SAVE_ANALYSIS",
    );
  } catch (error) {
    logger.error(
      "Failed to create compatibility view",
      "SAVE_ANALYSIS",
      error as Error,
    );
    throw error;
  }
}
