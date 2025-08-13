/**
 * Type definitions for pipeline email analysis data
 * These types represent the raw data structure from the email_analysis table
 */

/**
 * Raw pipeline email analysis record from database
 */
export interface PipelineEmailAnalysis {
  id: number;
  email_id: string;
  pipeline_stage: number;
  pipeline_priority_score: number;
  llama_analysis: string | null;
  phi4_analysis: string | null;
  final_model_used: string;
  analysis_timestamp: string;
}

/**
 * Llama 3.2:3b analysis data structure (Stage 2)
 */
export interface LlamaAnalysisData {
  workflow_state: string;
  business_process: string;
  intent: string;
  urgency_level: string;
  entities: {
    po_numbers: string[];
    quote_numbers: string[];
    case_numbers: string[];
    part_numbers: string[];
    companies: string[];
    contacts?: string[];
    reference_numbers?: string[];
  };
  contextual_summary: string;
  action_items: Array<{
    task: string;
    priority: string;
    deadline?: string;
    owner?: string;
  }>;
  suggested_response?: string;
  quality_score: number;
  sla_status?: string;
  business_impact?: {
    revenue?: string;
    customer_satisfaction?: string;
  };
}

/**
 * Phi-4 14B analysis data structure (Stage 3)
 */
export interface Phi4AnalysisData {
  executive_summary: string;
  business_impact: {
    revenue_impact?: number;
    customer_satisfaction: string;
    urgency_reason: string;
    risk_assessment?: string;
  };
  sla_assessment: string;
  deep_insights: string[];
  strategic_recommendations?: string[];
  quality_score: number;
  confidence_level?: number;
}

/**
 * Stage result types for mapping
 */
export type PipelineStage = 1 | 2 | 3;

export type WorkflowState =
  | "NEW"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETE"
  | "BLOCKED"
  | "CANCELLED";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

export type BusinessProcess =
  | "Order Management"
  | "Quote Processing"
  | "Customer Support"
  | "Technical Support"
  | "Billing"
  | "General";

/**
 * Validation result for parsed data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
