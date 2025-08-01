/**
 * Email-related type definitions
 * Used across the email dashboard and components
 */

export type EmailStatus =
  | "pending"
  | "in_progress"
  | "under_review"
  | "approved"
  | "rejected"
  | "completed"
  | "archived";

export type EmailPriority = "low" | "medium" | "high" | "critical";

export interface EmailRecord {
  id: string;
  emailAlias: string;
  requestedBy: string;
  subject: string;
  summary: string;
  status: EmailStatus;
  priority: EmailPriority;
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface EmailData {
  id: string;
  subject: string;
  currentStatus: EmailStatus;
  assignedTo?: string;
  priority: EmailPriority;
  dueDate?: string;
  lastUpdated: string;
  statusHistory: StatusHistoryEntry[];
}

export interface StatusHistoryEntry {
  timestamp: string;
  from: EmailStatus;
  to: EmailStatus;
  user: string;
  comment?: string;
  metadata?: Record<string, any>;
}

export interface EmailWorkflowData extends EmailData {
  workflow?: {
    currentStep: string;
    completedSteps: string[];
    pendingSteps: string[];
  };
}

export interface EmailFilter {
  status?: EmailStatus[];
  priority?: EmailPriority[];
  assignedTo?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  tags?: string[];
  searchQuery?: string;
}
