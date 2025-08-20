/**
 * Type Definitions for Business Analysis Services
 * Replaces 'any' types in OptimizedBusinessAnalysisService.ts and related files
 */

import type { 
  BusinessIntelligenceData, 
  ExecutiveAnalysisData, 
  LLMResponse,
  PerformanceMetric
} from './common.types.js';
import type { EmailRecord, Phase1Results, Phase2Results, Phase3Results } from './email-storage.types.js';

// Enhanced Analysis Result Types
export interface BusinessAnalysisResult {
  email_id: string;
  processing_start: string;
  processing_end: string;
  phase1_results: Phase1Results;
  phase2_results?: EnhancedPhase2Results;
  phase3_results?: EnhancedPhase3Results;
  performance_metrics: {
    total_time_ms: number;
    llm_calls: number;
    tokens_consumed: number;
    cache_hits: number;
    context_optimization_applied: boolean;
  };
  quality_scores: {
    entity_extraction_confidence: number;
    business_intelligence_quality: number;
    strategic_analysis_completeness: number;
  };
}

export interface EnhancedPhase2Results extends Phase2Results {
  business_intelligence: BusinessIntelligenceData;
  context_optimizations: {
    thread_context_applied: boolean;
    business_context_applied: boolean;
    historical_patterns_used: boolean;
  };
  confidence_indicators: {
    workflow_detection: number;
    entity_extraction: number;
    priority_assessment: number;
    business_value_estimation: number;
  };
}

export interface EnhancedPhase3Results extends Omit<Phase3Results, 'executive_analysis'> {
  executive_analysis: ExecutiveAnalysisData;
  strategic_context: {
    business_impact_score: number;
    customer_relationship_risk: 'low' | 'medium' | 'high';
    revenue_impact_category: 'minimal' | 'moderate' | 'significant' | 'critical';
    operational_complexity: number;
  };
  stakeholder_analysis: {
    required_approvals: string[];
    notification_list: string[];
    escalation_path: string[];
    timeline_constraints: {
      sla_deadline?: string;
      business_deadline?: string;
      regulatory_deadline?: string;
    };
  };
}

// Batch Processing Types
export interface BatchProcessingOptions {
  batch_size: number;
  max_concurrency: number;
  prioritize_high_value: boolean;
  use_context_optimization: boolean;
  enable_smart_caching: boolean;
  performance_target: 'speed' | 'quality' | 'balanced';
  model_preferences: {
    phase2_model: 'llama3.2:3b';
    phase3_model: 'phi-4';
  };
  retry_configuration: {
    max_retries: number;
    retry_delay_ms: number;
    exponential_backoff: boolean;
  };
  quality_gates: {
    minimum_confidence_score: number;
    require_business_value: boolean;
    validate_entities: boolean;
  };
}

export interface BatchProcessingResult {
  batch_id: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total_emails: number;
    processed_count: number;
    success_count: number;
    error_count: number;
    skipped_count: number;
  };
  performance_summary: {
    avg_processing_time_ms: number;
    throughput_emails_per_minute: number;
    token_efficiency: number;
    cache_hit_rate: number;
    context_optimization_rate: number;
  };
  quality_summary: {
    avg_confidence_score: number;
    business_insight_quality: number;
    entity_extraction_accuracy: number;
  };
  errors: Array<{
    email_id: string;
    error_type: string;
    error_message: string;
    occurred_at: string;
    retry_count: number;
  }>;
}

// Context Management Types
export interface BusinessContext {
  customer_profile?: {
    name: string;
    tier: 'enterprise' | 'mid-market' | 'small-business';
    relationship_manager: string;
    contract_value: number;
    support_level: string;
  };
  historical_interactions: {
    recent_emails: number;
    avg_response_time_hours: number;
    escalation_frequency: number;
    satisfaction_trend: 'improving' | 'stable' | 'declining';
  };
  business_rules: {
    auto_escalation_keywords: string[];
    priority_customers: string[];
    restricted_actions: string[];
    compliance_requirements: string[];
  };
  market_context?: {
    industry_sector: string;
    seasonal_factors: string[];
    competitive_landscape: string;
    regulatory_environment: string[];
  };
}

export interface ThreadContext {
  thread_id: string;
  email_count: number;
  participants: string[];
  timeline: {
    started_at: string;
    last_activity: string;
    response_times: number[];
  };
  conversation_flow: {
    initiation: 'inbound' | 'outbound';
    current_state: 'active' | 'waiting' | 'resolved' | 'escalated';
    decision_points: string[];
    action_items_status: 'pending' | 'in-progress' | 'completed';
  };
  sentiment_tracking: {
    initial_sentiment: 'positive' | 'neutral' | 'negative';
    current_sentiment: 'positive' | 'neutral' | 'negative';
    sentiment_trajectory: 'improving' | 'stable' | 'declining';
  };
}

// LLM Integration Types
export interface LLMCallOptions {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  context_window_optimization: boolean;
  response_format: 'text' | 'json';
  timeout_ms: number;
  retry_configuration: {
    max_retries: number;
    exponential_backoff: boolean;
  };
}

export interface OptimizedLLMResponse extends LLMResponse {
  context_optimization: {
    original_token_count: number;
    optimized_token_count: number;
    compression_ratio: number;
    optimization_techniques: string[];
  };
  quality_metrics: {
    response_coherence: number;
    instruction_following: number;
    factual_accuracy: number;
    structured_output_validity: number;
  };
  performance_data: {
    queue_time_ms: number;
    inference_time_ms: number;
    post_processing_time_ms: number;
    cache_status: 'hit' | 'miss' | 'partial';
  };
}

// Service Performance Types
export interface ServicePerformanceMetrics {
  total_processed: number;
  average_processing_time: number;
  context_optimization_rate: number;
  token_efficiency: number;
  business_insight_quality: number;
  cache_hit_rate: number;
  error_rate: number;
  throughput_emails_per_minute: number;
  resource_utilization: {
    cpu_usage_percent: number;
    memory_usage_mb: number;
    disk_io_operations: number;
    network_requests: number;
  };
  sla_compliance: {
    on_time_percentage: number;
    avg_response_delay_minutes: number;
    escalation_rate: number;
  };
}

// Historical Data Types
export interface HistoricalDataPoint {
  timestamp: string;
  email_id: string;
  customer_name?: string;
  workflow_type: string;
  business_value: number;
  resolution_time_hours: number;
  satisfaction_score?: number;
  escalation_occurred: boolean;
  lessons_learned?: string[];
}

export interface HistoricalPattern {
  pattern_type: 'seasonal' | 'customer-specific' | 'workflow-based' | 'value-based';
  pattern_description: string;
  confidence_score: number;
  occurrence_frequency: number;
  impact_metrics: {
    avg_processing_time_change: number;
    success_rate_impact: number;
    customer_satisfaction_impact: number;
  };
  applicable_conditions: string[];
  recommended_actions: string[];
}

// Quality Validation Types
export interface QualityValidationResult {
  passed: boolean;
  validation_timestamp: string;
  checks_performed: Array<{
    check_name: string;
    status: 'passed' | 'failed' | 'warning';
    score: number;
    details: string;
    recommendations?: string[];
  }>;
  overall_quality_score: number;
  improvement_suggestions: string[];
  reprocessing_recommended: boolean;
}

// Event and Monitoring Types
export interface AnalysisEvent {
  event_id: string;
  event_type: 'analysis_started' | 'analysis_completed' | 'analysis_failed' | 'quality_issue' | 'escalation_triggered';
  timestamp: string;
  email_id: string;
  event_data: {
    phase: 1 | 2 | 3;
    processing_time_ms?: number;
    error_details?: string;
    quality_scores?: Record<string, number>;
    business_impact?: string;
  };
  correlation_id: string;
  service_instance: string;
}