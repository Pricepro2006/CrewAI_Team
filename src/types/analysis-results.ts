/**
 * Type definitions for analysis results that map to EmailStorageService schema
 * These types represent the transformed data structure expected by the UI
 */

import type {
  PriorityLevel,
  WorkflowState,
  BusinessProcess,
} from "./pipeline-analysis.js";

/**
 * Quick analysis results (triage stage)
 */
export interface QuickAnalysis {
  priority: PriorityLevel;
  urgency: "Immediate" | "High" | "Medium" | "Low";
  workflow: WorkflowState;
  intent: "Request" | "Information" | "Complaint" | "Confirmation" | "Other";
  category: BusinessProcess;
}

/**
 * Deep workflow analysis results
 */
export interface DeepWorkflowAnalysis {
  summary: string;
  workflowState: WorkflowState;
  businessProcess: BusinessProcess;
  actionItems: ActionItem[];
  slaStatus: string;
  entities: ExtractedEntities;
  businessImpact: BusinessImpact;
  suggestedResponse?: string;
  insights: string[];
}

/**
 * Extracted entities from email content
 */
export interface ExtractedEntities {
  po_numbers: string[];
  quote_numbers: string[];
  case_numbers: string[];
  part_numbers: string[];
  companies: string[];
  contacts: string[];
  reference_numbers: string[];
  order_references: string[];
}

/**
 * Action item structure
 */
export interface ActionItem {
  task: string;
  priority: PriorityLevel;
  deadline?: string;
  owner?: string;
  status?: "Pending" | "In Progress" | "Complete";
}

/**
 * Business impact assessment
 */
export interface BusinessImpact {
  revenue?: number | string;
  customerSatisfaction: "Positive" | "Neutral" | "Negative" | "Critical";
  urgencyReason: string;
  riskLevel?: "High" | "Medium" | "Low";
}

/**
 * Processing metadata
 */
export interface ProcessingMetadata {
  analysisVersion: string;
  model: string;
  timestamp: string;
  confidence: number;
  processingTime?: number;
  dataSource: "pipeline" | "legacy" | "manual";
}

/**
 * Complete email analysis result
 */
export interface EmailAnalysisResult {
  emailId: string;
  quick: QuickAnalysis;
  deep: DeepWorkflowAnalysis;
  metadata: ProcessingMetadata;
  rawData?: {
    llamaAnalysis?: any;
    phi4Analysis?: any;
  };
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  results: EmailAnalysisResult[];
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  processingTime: number;
  errors?: Array<{
    emailId: string;
    error: string;
  }>;
}

// Re-export types from pipeline-analysis for convenience
export type {
  PipelineStage,
  WorkflowState,
  PriorityLevel,
  BusinessProcess,
} from "./pipeline-analysis.js";
