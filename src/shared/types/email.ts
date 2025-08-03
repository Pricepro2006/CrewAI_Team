/**
 * Email System Types
 * Comprehensive email management and processing types
 */

import type { BaseEntity, TimestampedEntity, Timestamp } from "./core.js";

// =====================================================
// Email Record Types
// =====================================================

export type EmailStatus = "red" | "yellow" | "green";
export type EmailWorkflowState = "START_POINT" | "IN_PROGRESS" | "COMPLETION";
export type EmailPriority = "critical" | "high" | "medium" | "low";
export type EmailSLAStatus = "on-track" | "at-risk" | "overdue";
export type EmailCategory =
  | "email-alias"
  | "marketing-splunk"
  | "vmware-tdsynnex"
  | "general";

export interface EmailRecord extends BaseEntity {
  // Core email fields
  subject: string;
  email_alias: string;
  requested_by: string;
  summary: string;

  // Status and workflow
  status: EmailStatus;
  status_text: string;
  workflow_state: EmailWorkflowState;
  workflow_type?: string;

  // Classification and priority
  category?: EmailCategory;
  priority: EmailPriority;

  // Timestamps
  timestamp: Timestamp;
  receivedTime: Timestamp;

  // Content and attachments
  bodyText?: string;
  bodyHtml?: string;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];

  // Assignment and tracking
  assignedTo?: string;
  assignedAt?: Timestamp;
  dueDate?: Timestamp;

  // Analysis and entities
  entities?: EmailEntityExtraction;
  analysis?: EmailAnalysis;
  tags?: string[];

  // Threading and relationships
  conversationId?: string;
  threadId?: string;
  parentEmailId?: string;
  relatedEmails?: string[];

  // Metadata
  isRead: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  source: "manual" | "api" | "webhook" | "import";

  // Processing flags
  isProcessed: boolean;
  processedAt?: Timestamp;
  processingVersion?: string;

  // Custom fields
  customFields?: Record<string, unknown>;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  checksum?: string;
  url?: string;
  thumbnailUrl?: string;
  extractedText?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailEntityExtraction {
  po_numbers?: string[];
  quote_numbers?: string[];
  case_numbers?: string[];
  part_numbers?: string[];
  customers?: string[];
  order_references?: string[];
  contacts?: EmailContact[];
  dates?: EmailDateEntity[];
  amounts?: EmailAmountEntity[];
  locations?: string[];
  organizations?: string[];
  products?: string[];
  services?: string[];
}

export interface EmailContact {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  organization?: string;
  confidence: number;
}

export interface EmailDateEntity {
  date: string;
  type: "due_date" | "delivery_date" | "meeting_date" | "deadline" | "general";
  confidence: number;
  context?: string;
}

export interface EmailAmountEntity {
  amount: number;
  currency: string;
  type: "price" | "cost" | "budget" | "fee" | "discount" | "general";
  confidence: number;
  context?: string;
}

export interface EmailAnalysis {
  // Quick analysis
  quickSummary?: string;
  sentiment?: "positive" | "negative" | "neutral";
  urgency?: "low" | "medium" | "high" | "critical";
  actionRequired?: boolean;

  // Classification
  intent?: string;
  topics?: string[];
  keywords?: string[];
  language?: string;

  // Advanced analysis
  deepAnalysis?: {
    mainPoints?: string[];
    actionItems?: EmailActionItem[];
    followUpRequired?: boolean;
    escalationNeeded?: boolean;
    businessImpact?: "low" | "medium" | "high" | "critical";
    riskLevel?: "low" | "medium" | "high" | "critical";
  };

  // Confidence scores
  confidence: {
    overall: number;
    classification: number;
    sentiment: number;
    urgency: number;
    entities: number;
  };

  // Processing metadata
  analyzedAt: Timestamp;
  analyzedBy: string; // Model or service used
  processingTime: number;
  version: string;
}

export interface EmailActionItem {
  id: string;
  description: string;
  type:
    | "task"
    | "follow_up"
    | "meeting"
    | "approval"
    | "information"
    | "decision";
  priority: EmailPriority;
  dueDate?: Timestamp;
  assignedTo?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  context?: string;
}

// =====================================================
// Email Dashboard Types
// =====================================================

export interface EmailDashboardStats {
  total: number;
  byStatus: {
    red: number;
    yellow: number;
    green: number;
  };
  byWorkflowState: {
    START_POINT: number;
    IN_PROGRESS: number;
    COMPLETION: number;
  };
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byCategory?: {
    [key in EmailCategory]: number;
  };
  trends: {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
  };
  averageResponseTime?: number;
  slaCompliance?: {
    onTime: number;
    overdue: number;
    atRisk: number;
  };
}

export interface EmailFilter {
  search?: string;
  emailAliases?: string[];
  requesters?: string[];
  statuses?: EmailStatus[];
  workflowStates?: EmailWorkflowState[];
  workflowTypes?: string[];
  priorities?: EmailPriority[];
  categories?: EmailCategory[];
  tags?: string[];
  assignedTo?: string[];

  // Date filters
  dateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  receivedDateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  dueDateRange?: {
    start: Timestamp;
    end: Timestamp;
  };

  // Boolean filters
  hasAttachments?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  isOverdue?: boolean;
  requiresAction?: boolean;

  // Advanced filters
  entities?: {
    hasPoNumbers?: boolean;
    hasQuoteNumbers?: boolean;
    hasCaseNumbers?: boolean;
    hasPartNumbers?: boolean;
    hasCustomers?: boolean;
  };

  // Analysis filters
  sentiment?: "positive" | "negative" | "neutral";
  urgency?: EmailPriority[];
  businessImpact?: EmailPriority[];
  riskLevel?: EmailPriority[];
}

export interface EmailSort {
  field: keyof EmailRecord | "relevance";
  direction: "asc" | "desc";
}

// =====================================================
// Email Processing Types
// =====================================================

export interface EmailBatch {
  id: string;
  batchNumber: number;
  emails: EmailRecord[];
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";

  // Progress tracking
  totalEmails: number;
  processedEmails: number;
  failedEmails: number;

  // Timing
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  // Processing details
  processingConfig?: EmailProcessingConfig;
  errors?: EmailProcessingError[];
  warnings?: EmailProcessingWarning[];

  // Results
  results?: EmailBatchResult;
}

export interface EmailProcessingConfig {
  enableAnalysis: boolean;
  enableEntityExtraction: boolean;
  enableSentimentAnalysis: boolean;
  enableActionItemExtraction: boolean;
  enableCategorization: boolean;

  // Processing limits
  maxConcurrentProcessing: number;
  processingTimeout: number;
  retryAttempts: number;

  // Analysis settings
  analysisModels?: {
    sentiment?: string;
    classification?: string;
    entityExtraction?: string;
    summarization?: string;
  };

  // Output settings
  saveRawData: boolean;
  saveProcessedData: boolean;
  generateReports: boolean;
}

export interface EmailProcessingError {
  emailId: string;
  stage: "parsing" | "analysis" | "entity_extraction" | "storage";
  error: string;
  timestamp: Timestamp;
  recoverable: boolean;
}

export interface EmailProcessingWarning {
  emailId: string;
  stage: "parsing" | "analysis" | "entity_extraction" | "validation";
  warning: string;
  timestamp: Timestamp;
}

export interface EmailBatchResult {
  summary: {
    totalProcessed: number;
    successful: number;
    failed: number;
    warnings: number;
  };

  // Analysis results
  sentimentDistribution?: {
    positive: number;
    negative: number;
    neutral: number;
  };

  urgencyDistribution?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  topCategories?: Array<{
    category: string;
    count: number;
  }>;

  topEntities?: {
    customers: Array<{ name: string; count: number }>;
    products: Array<{ name: string; count: number }>;
    poNumbers: Array<{ number: string; count: number }>;
  };

  // Performance metrics
  processingTime: number;
  averageEmailProcessingTime: number;
  throughput: number; // emails per second
}

// =====================================================
// Email Assignment Types
// =====================================================

export interface EmailAssignment extends BaseEntity {
  emailId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: Timestamp;

  // Assignment details
  reason?: string;
  priority?: EmailPriority;
  dueDate?: Timestamp;
  estimatedEffort?: number; // in minutes

  // Status tracking
  status:
    | "pending"
    | "accepted"
    | "in_progress"
    | "completed"
    | "declined"
    | "reassigned";
  statusChangedAt: Timestamp;
  statusChangedBy?: string;

  // Work tracking
  timeSpent?: number; // in minutes
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  // Notes and updates
  notes?: string;
  updates?: EmailAssignmentUpdate[];

  // Escalation
  escalated?: boolean;
  escalatedAt?: Timestamp;
  escalatedTo?: string;
  escalationReason?: string;
}

export interface EmailAssignmentUpdate {
  id: string;
  timestamp: Timestamp;
  updatedBy: string;
  type: "status_change" | "note" | "time_log" | "escalation" | "reassignment";
  description: string;
  metadata?: Record<string, unknown>;
}

export interface EmailAssignmentRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rulePriority: number; // Rule execution order (lower numbers execute first)

  // Conditions
  conditions: EmailAssignmentCondition[];

  // Actions
  assignTo?: string;
  assignToRole?: string;
  assignToTeam?: string;
  priority?: EmailPriority; // Priority to assign to the email
  dueInHours?: number;
  addTags?: string[];
  setWorkflowState?: EmailWorkflowState;

  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  lastModifiedBy: string;
  lastModifiedAt: Timestamp;
}

export interface EmailAssignmentCondition {
  field: keyof EmailRecord | keyof EmailAnalysis | "entity" | "custom";
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "matches"
    | "greater_than"
    | "less_than";
  value: unknown;

  // Logical operators
  logicalOperator?: "and" | "or";

  // Nested conditions
  conditions?: EmailAssignmentCondition[];
}

// =====================================================
// Email Templates and Responses
// =====================================================

export interface EmailTemplate extends BaseEntity {
  name: string;
  description: string;
  category: string;

  // Template content
  subject: string;
  bodyHtml: string;
  bodyText: string;

  // Template variables
  variables: EmailTemplateVariable[];

  // Usage tracking
  usageCount: number;
  lastUsedAt?: Timestamp;

  // Access control
  isPublic: boolean;
  createdBy: string;
  sharedWith?: string[];

  // Versioning
  version: string;
  previousVersions?: string[];
}

export interface EmailTemplateVariable {
  name: string;
  type: "text" | "number" | "date" | "boolean" | "list" | "object";
  description: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    options?: unknown[];
  };
}

export interface EmailResponse extends BaseEntity {
  originalEmailId: string;
  templateId?: string;

  // Response content
  subject: string;
  bodyHtml: string;
  bodyText: string;

  // Recipients
  to: string[];
  cc?: string[];
  bcc?: string[];

  // Status
  status: "draft" | "pending" | "sent" | "failed" | "cancelled";
  sentAt?: Timestamp;

  // Tracking
  openedAt?: Timestamp[];
  clickedAt?: Timestamp[];
  repliedAt?: Timestamp;

  // Metadata
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Timestamp;

  // Attachments
  attachments?: EmailAttachment[];

  // Threading
  inReplyTo?: string;
  references?: string[];
}

// =====================================================
// Email Metrics and Reporting
// =====================================================

export interface EmailMetrics {
  // Volume metrics
  totalEmails: number;
  newEmails: number;
  processedEmails: number;
  pendingEmails: number;

  // Response metrics
  averageResponseTime: number; // in hours
  medianResponseTime: number;
  responseTimePercentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };

  // SLA metrics
  slaCompliance: number; // percentage
  onTimeResponses: number;
  overdueEmails: number;
  atRiskEmails: number;

  // Quality metrics
  resolutionRate: number; // percentage
  escalationRate: number;
  customerSatisfaction?: number;

  // Assignment metrics
  averageAssignmentTime: number;
  unassignedEmails: number;
  reassignmentRate: number;

  // Processing metrics
  processingTime: {
    average: number;
    min: number;
    max: number;
  };
  processingErrors: number;
  processingSuccessRate: number;

  // Trend data
  trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };

  // Breakdown by various dimensions
  byStatus: Record<EmailStatus, number>;
  byPriority: Record<EmailPriority, number>;
  byCategory: Record<EmailCategory, number>;
  byAssignee: Record<string, number>;

  // Time range
  periodStart: Timestamp;
  periodEnd: Timestamp;
  generatedAt: Timestamp;
}

export interface EmailReport {
  id: string;
  name: string;
  description: string;
  type:
    | "summary"
    | "detailed"
    | "trend"
    | "performance"
    | "compliance"
    | "custom";

  // Report configuration
  filters: EmailFilter;
  dateRange: {
    start: Timestamp;
    end: Timestamp;
  };
  groupBy: Array<keyof EmailRecord>;
  sortBy: EmailSort;

  // Data
  metrics: EmailMetrics;
  data: EmailRecord[];

  // Formatting
  format: "json" | "csv" | "excel" | "pdf" | "html";
  includeCharts: boolean;
  includeRawData: boolean;

  // Generation info
  generatedBy: string;
  generatedAt: Timestamp;
  expiresAt?: Timestamp;

  // Storage
  fileUrl?: string;
  fileSize?: number;
  downloadCount: number;
}
