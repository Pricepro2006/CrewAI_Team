/**
 * Email Status Type Definitions
 * Provides strict type safety for email status management across the application
 */

// Database status values (what's actually stored in the database)
export type DatabaseEmailStatus = 
  | 'pending'
  | 'imported'
  | 'analyzed'
  | 'phase1_complete'
  | 'phase2_complete'
  | 'phase3_complete'
  | 'failed'
  | 'error'
  | 'active';

// Database workflow states
export type DatabaseWorkflowState = 
  | 'START_POINT'
  | 'IN_PROGRESS'
  | 'COMPLETION'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'error';

// Application status values (what the UI/API expects)
export type ApplicationEmailStatus = 
  | 'unread'
  | 'read'
  | 'processing'
  | 'resolved'
  | 'escalated';

// Application workflow states for UI
export type ApplicationWorkflowState =
  | 'pending'
  | 'in_progress'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'archived';

// Color status used in UI
export type ColorStatus = 'red' | 'yellow' | 'green';

// Priority levels
export type EmailPriority = 'critical' | 'high' | 'medium' | 'low';

// Comprehensive email status mapping
export interface EmailStatusMapping {
  databaseStatus: DatabaseEmailStatus;
  databaseWorkflowState: DatabaseWorkflowState;
  applicationStatus: ApplicationEmailStatus;
  applicationWorkflowState: ApplicationWorkflowState;
  colorStatus: ColorStatus;
  displayText: string;
  description: string;
}

// Status transition rules
export interface StatusTransition {
  from: DatabaseEmailStatus;
  to: DatabaseEmailStatus;
  requiredConditions?: string[];
  allowedRoles?: string[];
}

// Email record with proper typing
export interface TypedEmailRecord {
  id: string;
  status: DatabaseEmailStatus;
  workflow_state: DatabaseWorkflowState;
  priority: EmailPriority;
  confidence_score?: number;
  [key: string]: any; // For additional fields
}

// API response with proper typing
export interface TypedEmailResponse {
  id: string;
  status: ApplicationEmailStatus;
  workflowState: ApplicationWorkflowState;
  colorStatus: ColorStatus;
  statusText: string;
  priority: EmailPriority;
  [key: string]: any; // For additional fields
}