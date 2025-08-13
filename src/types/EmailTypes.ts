/**
 * Email types and enums
 */

export enum AnalysisStatus {
  PENDING = "pending",
  ANALYZING = "analyzing",
  ANALYZED = "analyzed",
  FAILED = "failed",
  SKIPPED = "skipped",
}

export enum EmailPriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
  NONE = "none",
}

export enum EmailFolder {
  INBOX = "inbox",
  SENT = "sent",
  DRAFTS = "drafts",
  ARCHIVE = "archive",
  TRASH = "trash",
  SPAM = "spam",
}

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

export interface EmailRecord {
  id: string;
  message_id: string;
  subject: string;
  body_text: string;
  body_html?: string;
  from_address: string;
  to_addresses: string;
  cc_addresses?: string;
  bcc_addresses?: string;
  received_time: Date;
  sent_time?: Date;
  conversation_id?: string;
  thread_id?: string;
  in_reply_to?: string;
  references?: string;
  has_attachments: boolean;
  attachments?: EmailAttachment[];
  importance: string;
  folder: EmailFolder;
  status: AnalysisStatus;
  workflow_state?: string;
  priority?: EmailPriority;
  confidence_score?: number;
  analyzed_at?: Date;
  created_at: Date;
  updated_at?: Date;
  error_message?: string;
  thread_emails?: EmailRecord[];
}

export interface EmailEntity {
  id: string;
  email_id: string;
  entity_type: string;
  entity_value: string;
  confidence: number;
  extracted_by: string;
  created_at: Date;
}

export interface ActionItem {
  id: string;
  email_id: string;
  description: string;
  owner?: string;
  deadline?: Date;
  priority: EmailPriority;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  created_at: Date;
  updated_at?: Date;
}

export interface EmailStatistics {
  total: number;
  pending: number;
  analyzed: number;
  failed: number;
  byPriority: Record<EmailPriority, number>;
  byFolder: Record<EmailFolder, number>;
  avgResponseTime?: number;
  avgChainLength?: number;
}
