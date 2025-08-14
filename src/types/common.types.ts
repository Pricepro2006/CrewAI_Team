/**
 * Common Type Definitions for CrewAI Team
 * Replaces 'any' types with proper TypeScript interfaces
 */

import type Database from "better-sqlite3";

// Database and Query Types
export type DatabaseConnection = Database.Database;
export type DatabaseTransaction = Database.Transaction;

export interface DatabaseQueryParams {
  [key: string]: string | number | boolean | null;
}

export interface DatabaseRow {
  [key: string]: string | number | boolean | null;
}

export interface QueryResult<T = DatabaseRow> {
  data: T[];
  count: number;
  hasMore: boolean;
}

// Email Entity Types
export interface EmailEntity {
  type: 'po_number' | 'quote_number' | 'case_number' | 'part_number' | 'customer' | 'contact';
  value: string;
  confidence: number;
  extractedAt: string;
  source?: string;
}

export interface EmailRecipient {
  name: string;
  address: string;
  type: 'to' | 'cc' | 'bcc';
  domain?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  hasPreview: boolean;
  isInline: boolean;
}

// Business Intelligence Types
export interface BusinessIntelligenceData {
  workflow: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
  entities: EmailEntity[];
  businessValue: {
    estimated_value: number;
    currency: string;
    confidence: number;
  };
  priority: {
    level: 'critical' | 'high' | 'medium' | 'low';
    reasoning: string;
  };
  strategic_recommendations: {
    immediate_actions: Array<{
      action: string;
      priority: number;
      estimated_impact: string;
    }>;
    next_steps: string[];
  };
  customer_satisfaction: {
    risk_level: 'high' | 'medium' | 'low';
    indicators: string[];
  };
}

export interface ExecutiveAnalysisData {
  strategic_impact: {
    revenue_impact: number;
    customer_impact: string;
    operational_impact: string;
  };
  escalation_required: boolean;
  executive_summary: string;
  recommended_stakeholders: string[];
  timeline_criticality: 'immediate' | 'urgent' | 'standard';
}

// LLM and API Response Types
export interface LLMResponse<T = unknown> {
  success: boolean;
  data: T;
  model: string;
  tokens_used: number;
  response_time_ms: number;
  error?: string;
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

// Metadata and Configuration Types
export interface EmailMetadata {
  source: 'outlook' | 'gmail' | 'manual';
  imported_at: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  chain_id?: string;
  thread_id?: string;
  labels: string[];
  custom_fields: Record<string, string | number | boolean>;
}

export interface ServiceMetadata {
  service_name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  instance_id: string;
  health_status: 'healthy' | 'degraded' | 'unhealthy';
  last_heartbeat: string;
}

// Error and Response Types
export interface ServiceError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: string;
  trace_id?: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
  };
  meta?: Record<string, unknown>;
}

// Event and WebSocket Types
export interface WebSocketMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: string;
  source: string;
}

export interface EventData<T = unknown> {
  event_type: string;
  payload: T;
  metadata: {
    source: string;
    timestamp: string;
    version: string;
  };
}

// Filter and Search Types
export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'between';
  value: string | number | boolean | (string | number)[];
}

export interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchCriteria {
  filters: FilterCondition[];
  sort: SortCondition[];
  limit: number;
  offset: number;
  include_count: boolean;
}

// Performance and Monitoring Types
export interface PerformanceMetric {
  metric_name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
}

export interface ServiceHealth {
  service: string;
  status: 'up' | 'down' | 'degraded';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    details?: string;
  }>;
  uptime: number;
  response_time: number;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// Type Guards
export function isEmailEntity(obj: unknown): obj is EmailEntity {
  return typeof obj === 'object' && obj !== null && 
    'type' in obj && 'value' in obj && 'confidence' in obj;
}

export function isLLMResponse<T>(obj: unknown): obj is LLMResponse<T> {
  return typeof obj === 'object' && obj !== null && 
    'success' in obj && 'data' in obj && 'model' in obj;
}