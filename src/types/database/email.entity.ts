/**
 * Email Entity Types - Match Database Schema Exactly
 * 
 * These types represent the exact structure of the emails_enhanced table.
 * DO NOT transform field names here - use actual database column names.
 */

export interface EmailEntity {
  // Core identifiers
  id: string;
  internet_message_id: string | null;  // This is the RFC 5322 message ID
  conversation_id: string | null;

  // Email metadata
  subject: string;
  body_content: string | null;
  body_content_type: string;  // 'text' or 'html'
  body_preview: string | null;

  // Sender information
  sender_email: string;
  sender_name: string | null;

  // Timestamps (all from Microsoft)
  created_date_time: string;
  last_modified_date_time: string | null;
  received_date_time: string;
  sent_date_time: string | null;

  // Recipients (stored as JSON strings)
  to_recipients: string | null;  // JSON array
  cc_recipients: string | null;  // JSON array
  bcc_recipients: string | null; // JSON array

  // Microsoft Graph specific
  graph_id: string | null;
  parent_folder_id: string | null;
  web_link: string | null;
  change_key: string | null;

  // Email properties
  importance: string | null;
  has_attachments: boolean;
  is_read: boolean;
  is_draft: boolean;
  flag_status: string | null;
  categories: string | null;  // JSON array

  // Processing pipeline data
  phase_completed: number;
  phase_1_results: string | null;  // JSON
  phase_2_results: string | null;  // JSON
  phase_3_results: string | null;  // JSON
  workflow_state: string | null;   // JSON
  analyzed_at: string | null;
  processing_status: string;
  processing_errors: string | null; // JSON
  priority: string | null;
  confidence_score: number | null;

  // Chain analysis
  chain_id: string | null;
  chain_position: number | null;
  chain_length: number | null;
  chain_subject: string | null;
  chain_participants: string | null; // JSON
  chain_latest_date: string | null;
  chain_category: string | null;
  chain_sentiment: string | null;
  chain_priority: string | null;
  chain_completeness_score: number | null;
  is_complete_chain: boolean;
  recommended_phase: number | null;

  // Business intelligence
  business_value: number | null;
  business_context: string | null;
  business_priority: string | null;
  business_category: string | null;
  business_summary: string | null;
  requires_action: boolean;
  action_deadline: string | null;

  // Import tracking
  import_source: string | null;
  import_batch_id: string | null;
  imported_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Partial email entity for updates
 */
export type PartialEmailEntity = Partial<EmailEntity>;

/**
 * Email entity for inserts (without auto-generated fields)
 */
export type CreateEmailEntity = Omit<EmailEntity, 'created_at' | 'updated_at'>;

/**
 * Type guard to validate email entity
 */
export function isValidEmailEntity(obj: any): obj is EmailEntity {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.subject === 'string' &&
    typeof obj.sender_email === 'string' &&
    typeof obj.received_date_time === 'string' &&
    typeof obj.processing_status === 'string'
  );
}

/**
 * Column name mapping for SQL queries
 * Use these constants to avoid typos in column names
 */
export const EMAIL_COLUMNS = {
  ID: 'id',
  INTERNET_MESSAGE_ID: 'internet_message_id',
  CONVERSATION_ID: 'conversation_id',
  SUBJECT: 'subject',
  BODY_CONTENT: 'body_content',
  SENDER_EMAIL: 'sender_email',
  SENDER_NAME: 'sender_name',
  RECEIVED_DATE_TIME: 'received_date_time',
  WORKFLOW_STATE: 'workflow_state',
  PHASE_COMPLETED: 'phase_completed',
  PRIORITY: 'priority',
  CHAIN_ID: 'chain_id',
  IS_COMPLETE_CHAIN: 'is_complete_chain',
  CHAIN_COMPLETENESS_SCORE: 'chain_completeness_score',
} as const;