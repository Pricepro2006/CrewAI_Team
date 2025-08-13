/**
 * Email chain types and interfaces
 */

export enum ChainType {
  QUOTE_REQUEST = "quote_request",
  ORDER_PROCESSING = "order_processing",
  SUPPORT_TICKET = "support_ticket",
  PROJECT_DISCUSSION = "project_discussion",
  GENERAL_INQUIRY = "general_inquiry",
  UNKNOWN = "unknown",
}

export enum ChainStage {
  START = "start",
  IN_PROGRESS = "in_progress",
  REVIEW = "review",
  COMPLETION = "completion",
  CLOSED = "closed",
}

export interface ChainCompleteness {
  score: number;
  is_complete: boolean;
  missing_stages: ChainStage[];
  confidence: number;
}

export interface EmailChain {
  id: string;
  chain_id: string;
  conversation_id: string;
  email_ids: string[];
  email_count: number;
  chain_type: ChainType;
  completeness_score: number;
  is_complete: boolean;
  missing_stages?: ChainStage[];
  start_time: Date;
  end_time: Date;
  duration_hours: number;
  participants: string[];
  key_entities: ChainEntity[];
  workflow_state: string;
  created_at: Date;
  updated_at?: Date;
  last_analyzed?: Date;
}

export interface ChainEntity {
  type: string;
  value: string;
  count: number;
  first_seen: Date;
  last_seen: Date;
}

export interface ChainStatistics {
  total: number;
  complete: number;
  incomplete: number;
  byType: Record<ChainType, number>;
  avgCompleteness: number;
  avgEmailCount: number;
  avgDurationHours: number;
  longestChain: {
    id: string;
    emailCount: number;
    durationHours: number;
  };
}

export interface ChainTemplate {
  id: string;
  chain_type: ChainType;
  stages: ChainStage[];
  typical_duration_hours: number;
  required_entities: string[];
  optional_entities: string[];
  created_at: Date;
}
