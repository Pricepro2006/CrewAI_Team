/**
 * Email analysis types and interfaces
 */

export enum AnalysisPhase {
  PHASE_1 = "phase_1",
  PHASE_2 = "phase_2",
  PHASE_3 = "phase_3",
}

export enum AnalysisConfidence {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export interface Phase1Results {
  basic_classification: {
    type: string;
    priority: string;
    urgency: boolean;
    requires_response: boolean;
  };
  entities: {
    po_numbers: string[];
    quotes: string[];
    cases: string[];
    parts: string[];
    people: string[];
    companies: string[];
  };
  key_phrases: string[];
  sentiment: "positive" | "negative" | "neutral";
  processing_time_ms: number;
}

export interface Phase2Results {
  enhanced_classification: {
    primary_intent: string;
    secondary_intents: string[];
    confidence: number;
  };
  missed_entities: {
    company_names: string[];
    people: string[];
    technical_terms: string[];
    deadlines: string[];
  };
  action_items: {
    task: string;
    owner?: string;
    deadline?: string;
    priority: string;
  }[];
  contextual_insights: {
    business_impact: string;
    recommended_actions: string[];
    risk_level: string;
  };
  processing_time_ms: number;
}

export interface Phase3Results {
  strategic_analysis: {
    workflow_position: string;
    chain_completeness: number;
    bottlenecks: string[];
    optimization_opportunities: string[];
  };
  pattern_recognition: {
    similar_chains: string[];
    typical_resolution_time: number;
    success_probability: number;
  };
  predictive_insights: {
    next_likely_action: string;
    estimated_completion: string;
    potential_escalations: string[];
  };
  roi_analysis: {
    time_saved: number;
    efficiency_gain: number;
    automation_potential: number;
  };
  processing_time_ms: number;
}

export interface AnalysisSummary {
  email_id: string;
  overall_priority: string;
  recommended_actions: string[];
  key_insights: string[];
  workflow_recommendations: string[];
  confidence_score: number;
}

export interface EmailAnalysis {
  id: string;
  email_id: string;
  analysis_version: string;
  phase1_results?: Phase1Results;
  phase2_results?: Phase2Results;
  phase3_results?: Phase3Results;
  final_summary: AnalysisSummary;
  confidence_score: number;
  workflow_type: string;
  chain_id?: string;
  is_complete_chain: boolean;
  total_processing_time_ms: number;
  phases_completed: AnalysisPhase[];
  created_at: Date;
  updated_at?: Date;
}

export interface AnalysisStatistics {
  total: number;
  byVersion: Record<string, number>;
  byWorkflowType: Record<string, number>;
  avgConfidence: number;
  phase1Only: number;
  phase2Completed: number;
  phase3Completed: number;
  avgProcessingTime: {
    phase1: number;
    phase2: number;
    phase3: number;
    total: number;
  };
}
