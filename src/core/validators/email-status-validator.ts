/**
 * Email Status Runtime Validation
 * Uses Zod for runtime type validation and data integrity
 */

import { z } from 'zod';
import {
  DatabaseEmailStatus,
  DatabaseWorkflowState,
  ApplicationEmailStatus,
  ApplicationWorkflowState,
  ColorStatus,
  EmailPriority,
} from '../types/email-status-types.js';

// Database status schema
export const DatabaseEmailStatusSchema = z.enum([
  'pending',
  'imported',
  'analyzed',
  'phase1_complete',
  'phase2_complete',
  'phase3_complete',
  'failed',
  'error',
  'active'
]);

// Database workflow state schema
export const DatabaseWorkflowStateSchema = z.enum([
  'START_POINT',
  'IN_PROGRESS',
  'COMPLETION',
  'pending',
  'in_progress',
  'completed',
  'error'
]);

// Application status schema
export const ApplicationEmailStatusSchema = z.enum([
  'unread',
  'read',
  'processing',
  'resolved',
  'escalated'
]);

// Application workflow state schema
export const ApplicationWorkflowStateSchema = z.enum([
  'pending',
  'in_progress',
  'under_review',
  'approved',
  'rejected',
  'completed',
  'archived'
]);

// Color status schema
export const ColorStatusSchema = z.enum(['red', 'yellow', 'green']);

// Priority schema
export const EmailPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

// Database email record schema
export const DatabaseEmailRecordSchema = z.object({
  id: z.string(),
  status: DatabaseEmailStatusSchema,
  workflow_state: DatabaseWorkflowStateSchema,
  priority: EmailPrioritySchema,
  confidence_score: z.number().min(0).max(1).optional(),
  subject: z.string(),
  sender_email: z.string().email().optional(),
  received_date_time: z.string(),
  body_content: z.string().optional(),
  has_attachments: z.union([z.boolean(), z.number()]).optional(),
  extracted_entities: z.string().optional(),
  chain_completeness_score: z.number().optional(),
  is_chain_complete: z.union([z.boolean(), z.number()]).optional(),
}).passthrough(); // Allow additional fields

// API email response schema
export const APIEmailResponseSchema = z.object({
  id: z.string(),
  status: ApplicationEmailStatusSchema,
  workflowState: ApplicationWorkflowStateSchema,
  colorStatus: ColorStatusSchema,
  statusText: z.string(),
  priority: EmailPrioritySchema,
  email_alias: z.string().optional(),
  requested_by: z.string().optional(),
  subject: z.string(),
  summary: z.string().optional(),
  received_date: z.string(),
  is_read: z.boolean(),
  has_attachments: z.boolean(),
}).passthrough(); // Allow additional fields

// Status update request schema
export const StatusUpdateRequestSchema = z.object({
  emailId: z.string(),
  newStatus: DatabaseEmailStatusSchema,
  newWorkflowState: DatabaseWorkflowStateSchema.optional(),
  reason: z.string().optional(),
  performedBy: z.string().optional(),
});

// Batch status update schema
export const BatchStatusUpdateSchema = z.object({
  emailIds: z.array(z.string()).min(1),
  newStatus: DatabaseEmailStatusSchema,
  newWorkflowState: DatabaseWorkflowStateSchema.optional(),
  reason: z.string().optional(),
  performedBy: z.string().optional(),
});

// Query filters schema
export const EmailQueryFiltersSchema = z.object({
  status: z.array(DatabaseEmailStatusSchema).optional(),
  workflowState: z.array(DatabaseWorkflowStateSchema).optional(),
  priority: z.array(EmailPrioritySchema).optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  search: z.string().optional(),
  page: z.number().positive().default(1),
  pageSize: z.number().positive().max(100).default(50),
  sortBy: z.string().default('received_date_time'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Validate database email record
 */
export function validateDatabaseEmailRecord(data: unknown): DatabaseEmailRecordSchema {
  try {
    return DatabaseEmailRecordSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid email record: ${error?.errors?.map(e => `${e?.path?.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate API email response
 */
export function validateAPIEmailResponse(data: unknown): APIEmailResponseSchema {
  try {
    return APIEmailResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid API response: ${error?.errors?.map(e => `${e?.path?.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate status update request
 */
export function validateStatusUpdateRequest(data: unknown): StatusUpdateRequestSchema {
  try {
    return StatusUpdateRequestSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid status update request: ${error?.errors?.map(e => `${e?.path?.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Type guard for database email status
 */
export function isDatabaseEmailStatus(value: unknown): value is DatabaseEmailStatus {
  return DatabaseEmailStatusSchema.safeParse(value).success;
}

/**
 * Type guard for database workflow state
 */
export function isDatabaseWorkflowState(value: unknown): value is DatabaseWorkflowState {
  return DatabaseWorkflowStateSchema.safeParse(value).success;
}

/**
 * Sanitize and validate email record from database
 */
export function sanitizeEmailRecord(rawData: any): DatabaseEmailRecordSchema {
  // Handle numeric boolean values (SQLite returns 0/1 for booleans)
  const sanitized = {
    ...rawData,
    has_attachments: rawData.has_attachments === 1 || rawData.has_attachments === true,
    is_chain_complete: rawData.is_chain_complete === 1 || rawData.is_chain_complete === true,
  };

  return validateDatabaseEmailRecord(sanitized);
}

// Export type aliases for convenience
export type DatabaseEmailRecordSchema = z.infer<typeof DatabaseEmailRecordSchema>;
export type APIEmailResponseSchema = z.infer<typeof APIEmailResponseSchema>;
export type StatusUpdateRequestSchema = z.infer<typeof StatusUpdateRequestSchema>;
export type BatchStatusUpdateSchema = z.infer<typeof BatchStatusUpdateSchema>;
export type EmailQueryFiltersSchema = z.infer<typeof EmailQueryFiltersSchema>;