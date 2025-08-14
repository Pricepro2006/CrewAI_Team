/**
 * Type Definitions for Email Storage Service
 * Replaces 'any' types in EmailStorageService.ts
 */

import type { 
  EmailEntity, 
  EmailRecipient, 
  EmailMetadata, 
  BusinessIntelligenceData,
  DatabaseQueryParams,
  DatabaseRow
} from './common.types.js';

// Email Storage Interfaces
export interface EmailRecord {
  id: string;
  graph_id?: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  to?: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  body: string;
  body_preview?: string;
  received_date: string;
  has_attachments: boolean;
  is_read: boolean;
  workflow_type?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  entities: EmailEntity[];
  recipients: EmailRecipient[];
  metadata: EmailMetadata;
  
  // Analysis Results
  phase_1_results?: Phase1Results;
  phase_2_results?: Phase2Results;
  phase_3_results?: Phase3Results;
  
  // Chain Information
  chain_id?: string;
  thread_id?: string;
  is_complete_chain?: boolean;
  chain_position?: number;
  
  // Status Tracking
  status: 'red' | 'yellow' | 'green';
  status_text?: string;
  status_updated_by?: string;
  status_updated_at?: string;
}

export interface Phase1Results {
  entities: EmailEntity[];
  workflow_detected: string;
  priority_assessment: string;
  confidence_score: number;
  processing_time_ms: number;
  extracted_at: string;
}

export interface Phase2Results {
  business_intelligence: BusinessIntelligenceData;
  enhanced_entities: EmailEntity[];
  workflow_refinement: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
  action_items: Array<{
    type: string;
    description: string;
    priority: number;
    due_date?: string;
  }>;
  processing_time_ms: number;
  model_used: string;
  tokens_consumed: number;
}

export interface Phase3Results {
  executive_analysis: {
    strategic_impact: number;
    escalation_required: boolean;
    stakeholder_involvement: string[];
    executive_summary: string;
    timeline_critical: boolean;
  };
  business_context: {
    customer_relationship_impact: string;
    revenue_implications: number;
    operational_considerations: string[];
  };
  recommended_actions: Array<{
    action: string;
    assignee?: string;
    timeline: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  processing_time_ms: number;
  model_used: string;
  confidence_score: number;
}

// Database Operation Interfaces
export interface EmailQueryOptions {
  include_analysis?: boolean;
  include_entities?: boolean;
  include_recipients?: boolean;
  limit?: number;
  offset?: number;
  order_by?: string;
  order_direction?: 'ASC' | 'DESC';
}

export interface EmailInsertData {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  body: string;
  received_date: Date;
  workflow_type?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  has_attachments?: boolean;
  is_read?: boolean;
  entities?: EmailEntity[];
  recipients?: EmailRecipient[];
}

export interface EmailUpdateData {
  subject?: string;
  body?: string;
  workflow_type?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'red' | 'yellow' | 'green';
  status_text?: string;
  status_updated_by?: string;
  phase_1_results?: Phase1Results;
  phase_2_results?: Phase2Results;
  phase_3_results?: Phase3Results;
  entities?: EmailEntity[];
  recipients?: EmailRecipient[];
}

// Database Transaction Types
export interface DatabaseTransaction {
  run: (sql: string, params?: DatabaseQueryParams) => { lastInsertRowid: number; changes: number };
  get: (sql: string, params?: DatabaseQueryParams) => DatabaseRow | undefined;
  all: (sql: string, params?: DatabaseQueryParams) => DatabaseRow[];
  iterate: (sql: string, params?: DatabaseQueryParams) => IterableIterator<DatabaseRow>;
  exec: (sql: string) => void;
}

export interface DatabaseConnection {
  run: (sql: string, params?: DatabaseQueryParams) => { lastInsertRowid: number; changes: number };
  get: (sql: string, params?: DatabaseQueryParams) => DatabaseRow | undefined;
  all: (sql: string, params?: DatabaseQueryParams) => DatabaseRow[];
  iterate: (sql: string, params?: DatabaseQueryParams) => IterableIterator<DatabaseRow>;
  transaction: <T>(fn: (trx: DatabaseTransaction) => T) => T;
  close: () => void;
}

// Service Configuration
export interface EmailStorageConfig {
  database_path: string;
  enable_connection_pool: boolean;
  pool_size?: number;
  enable_sla_monitoring: boolean;
  sla_thresholds: {
    critical_hours: number;
    high_hours: number;
    medium_hours: number;
    low_hours: number;
  };
  performance_tracking: {
    enable_query_monitoring: boolean;
    slow_query_threshold_ms: number;
    enable_connection_metrics: boolean;
  };
}

// Service Statistics
export interface ServiceStatistics {
  total_emails: number;
  emails_by_status: Record<'red' | 'yellow' | 'green', number>;
  emails_by_priority: Record<'critical' | 'high' | 'medium' | 'low', number>;
  analysis_completion: {
    phase_1_complete: number;
    phase_2_complete: number;
    phase_3_complete: number;
  };
  performance_metrics: {
    avg_query_time_ms: number;
    cache_hit_rate: number;
    connection_pool_utilization: number;
  };
  sla_metrics: {
    on_time: number;
    at_risk: number;
    overdue: number;
  };
}

// Connection Pool Types
export interface PoolConnection {
  database: DatabaseConnection;
  cache: Map<string, unknown>;
  lazy_loader: {
    get: <T>(key: string, factory: () => T) => T;
    clear: () => void;
  };
  is_healthy: boolean;
  last_used: Date;
  created_at: Date;
}

export interface PoolStatistics {
  total_connections: number;
  active_connections: number;
  idle_connections: number;
  pending_requests: number;
  avg_wait_time_ms: number;
  connection_errors: number;
  pool_efficiency: number;
}