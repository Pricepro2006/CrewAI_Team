/**
 * IEMS Email Types
 * Types for the TD SYNNEX Email Management System integration
 */

export type EmailCategory = 'email-alias' | 'marketing-splunk' | 'vmware-tdsynnex';
export type EmailStatus = 'red' | 'yellow' | 'green';

export interface IEMSEmail {
  id: string;
  category: EmailCategory;
  emailAlias: string;
  requestedBy: string;
  subject: string;
  summary: string;
  status: EmailStatus;
  statusText?: string;
  assignedTo?: string;
  action?: string;
  receivedTime: Date;
  hasAttachments: boolean;
  priority: 'high' | 'medium' | 'low';
  rawData?: any;
}

export interface IEMSMailbox {
  email: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  expectedResponseTime: string;
  categories: string[];
  keyContacts: string[];
}

export interface IEMSDistributionList {
  email: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  categories: string[];
  members: string[];
  expectedResponseTime?: string;
  keyContacts?: string[];
}

export interface RawIEMSEmail {
  MessageID: string;
  Subject: string;
  SenderName: string;
  SenderEmail: string;
  Recipients: string; // JSON string with to/cc arrays
  ReceivedTime: string;
  BodyText: string;
  BodyHTML: string | null;
  HasAttachments: number;
  Importance: string;
  IsRead: number;
  FolderPath: string;
  ConversationID: string;
  ThreadID: string;
  MailboxSource: string;
  ExtractedAt: string;
  AnalyzedAt: string | null;
  SuggestedThemes: string | null;
  SuggestedCategory: string | null;
  KeyPhrases: string | null;
  FullAnalysis: {
    quick_summary?: string;
    workflow_type?: string;
    workflow_state?: string;
    quick_priority?: string;
    action_sla_status?: string;
    entities?: any;
    [key: string]: any;
  } | null;
  IsSynthetic: number;
  workflow_state: string | null;
}

export interface EmailBatch {
  batchNumber: number;
  emails: RawIEMSEmail[];
  processedAt?: Date;
}

export interface CategorizedEmails {
  emailAlias: IEMSEmail[];
  marketingSplunk: IEMSEmail[];
  vmwareTDSynnex: IEMSEmail[];
  totalCount: number;
  lastUpdated: Date;
}

export interface EmailStatusInfo {
  status: EmailStatus;
  text: string;
  reason: string;
}

export interface EmailActionRequest {
  emailId: string;
  action: 'assign' | 'complete' | 'escalate' | 'respond';
  data?: {
    assigneeId?: string;
    assigneeName?: string;
    notes?: string;
    response?: string;
  };
}