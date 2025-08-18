/**
 * Email Database Schema Validation
 * 
 * Comprehensive Zod schemas that mirror database constraints for emails_enhanced
 * and related tables. Based on evidence from 143,221 emails in production.
 * 
 * @module emailSchemas
 * @version 1.0.0
 */

import { z } from 'zod';

/**
 * emails_enhanced table schema - Core email storage with adaptive pipeline
 * Mirrors SQLite CHECK constraints and field validations
 */
export const EmailsEnhancedSchema = z.object({
  // Core identification
  id: z.string().uuid('Invalid email ID format'),
  message_id: z.string().min(1, 'Message ID is required'),
  graph_id: z.string().optional(),
  
  // Email metadata
  subject: z.string().max(500, 'Subject too long'),
  sender_email: z.string().email('Invalid sender email format').max(255),
  sender_name: z.string().max(255).optional(),
  recipients: z.string().default('[]'), // JSON array
  cc_recipients: z.string().optional(), // JSON array
  bcc_recipients: z.string().optional(), // JSON array
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  body_preview: z.string().max(500).optional(),
  
  // Timestamps - ISO 8601 format for SQLite compatibility
  received_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid ISO 8601 date'),
  sent_at: z.string().optional(),
  processed_at: z.string().optional(),
  
  // Email properties
  importance: z.enum(['low', 'normal', 'high']).default('normal'),
  categories: z.string().default('[]'), // JSON array
  has_attachments: z.boolean().default(false),
  is_read: z.boolean().default(false),
  is_flagged: z.boolean().default(false),
  
  // Threading and conversation
  thread_id: z.string().optional(),
  conversation_id: z.string().optional(),
  conversation_id_ref: z.string().optional(), // Legacy support
  in_reply_to: z.string().optional(),
  references: z.string().optional(), // JSON array
  
  // Assignment and workflow
  status: z.enum(['new', 'in_progress', 'completed', 'archived', 'deleted']).default('new'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.string().optional(),
  assigned_at: z.string().optional(),
  due_date: z.string().optional(),
  
  // Workflow state management
  workflow_state: z.enum(['START_POINT', 'IN_PROGRESS', 'COMPLETION']).default('START_POINT'),
  workflow_type: z.string().optional(),
  workflow_chain_id: z.string().optional(),
  is_workflow_complete: z.boolean().default(false),
  
  // ===============================
  // ADAPTIVE PIPELINE FIELDS (Critical for Phase 4)
  // ===============================
  
  // Chain analysis for adaptive processing
  chain_id: z.string().optional(),
  completeness_score: z.number()
    .min(0.0, 'Completeness score must be >= 0.0')
    .max(1.0, 'Completeness score must be <= 1.0')
    .default(0.0), // Matches: CHECK (completeness_score >= 0.0 AND completeness_score <= 1.0)
  
  recommended_phase: z.number()
    .int('Phase must be an integer')
    .min(1, 'Phase must be 1, 2, or 3')
    .max(3, 'Phase must be 1, 2, or 3')
    .default(1), // Matches: CHECK (recommended_phase IN (1, 2, 3))
  
  // Processing metadata
  processing_status: z.enum(['pending', 'processing', 'completed', 'failed', 'skipped'])
    .default('pending'), // Matches: CHECK (processing_status IN (...))
  
  phase_completed: z.number()
    .int('Phase completed must be an integer')
    .min(0, 'Phase completed must be >= 0')
    .max(3, 'Phase completed must be <= 3')
    .default(0), // Matches: CHECK (phase_completed >= 0 AND phase_completed <= 3)
  
  analysis_confidence: z.number()
    .min(0, 'Confidence must be positive')
    .max(1, 'Confidence must be <= 1')
    .optional(),
  
  processing_version: z.string().optional(),
  error_message: z.string().max(1000).optional(),
  
  // Performance tracking
  processing_time_ms: z.number()
    .int('Processing time must be integer milliseconds')
    .min(0, 'Processing time cannot be negative')
    .optional(),
  
  model_used: z.string().max(100).optional(),
  tokens_used: z.number()
    .int('Token count must be integer')
    .min(0, 'Tokens cannot be negative')
    .optional(),
  
  // Entity extraction results
  entities: z.string()
    .default('[]')
    .transform(str => {
      try {
        return JSON.parse(str);
      } catch {
        return [];
      }
    }),
  
  analysis_results: z.string()
    .optional()
    .transform(str => {
      if (!str) return undefined;
      try {
        return JSON.parse(str);
      } catch {
        return {};
      }
    }),
  
  // Phase results - Complex JSON structures
  phase_1_results: z.string().optional(),
  phase_2_results: z.string().optional(),
  phase_3_results: z.string().optional(),
  
  // Audit fields
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().default(() => new Date().toISOString())
});

/**
 * email_chains table schema - Chain tracking and completeness
 */
export const EmailChainsSchema = z.object({
  id: z.string().uuid(),
  chain_id: z.string().min(1, 'Chain ID required'),
  root_email_id: z.string().uuid(),
  participant_count: z.number().int().min(1).default(1),
  message_count: z.number().int().min(1).default(1),
  
  // Chain analysis
  is_complete: z.boolean().default(false),
  completeness_score: z.number()
    .min(0.0)
    .max(1.0)
    .default(0.0),
  
  // Metadata
  first_message_date: z.string(),
  last_message_date: z.string(),
  last_activity: z.string(),
  
  // Processing status
  processing_status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  phase_recommended: z.number().int().min(1).max(3).default(1),
  
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().default(() => new Date().toISOString())
});

/**
 * processing_statistics table schema - Performance metrics
 * Tracks hourly processing statistics for monitoring
 */
export const ProcessingStatisticsSchema = z.object({
  id: z.number().int().optional(), // Auto-increment
  
  // Temporal identifier - YYYY-MM-DD-HH format
  date_hour: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}-\d{2}$/, 'Date hour must be YYYY-MM-DD-HH format'),
  
  // Processing counts
  emails_processed: z.number()
    .int('Count must be integer')
    .min(0, 'Count cannot be negative')
    .default(0),
  
  phase1_processed: z.number()
    .int()
    .min(0)
    .default(0),
  
  phase2_processed: z.number()
    .int()
    .min(0)
    .default(0),
  
  phase3_processed: z.number()
    .int()
    .min(0)
    .default(0),
  
  // Performance metrics
  avg_processing_time_ms: z.number()
    .min(0, 'Processing time cannot be negative')
    .optional(),
  
  min_processing_time_ms: z.number()
    .min(0)
    .optional(),
  
  max_processing_time_ms: z.number()
    .min(0)
    .optional(),
  
  // Resource usage
  total_tokens_used: z.number()
    .int()
    .min(0, 'Tokens cannot be negative')
    .default(0),
  
  avg_tokens_per_email: z.number()
    .min(0)
    .optional(),
  
  // Memory safety constraint (evidence-based from heap overflow prevention)
  peak_memory_mb: z.number()
    .max(4096, 'Memory usage exceeds safe limit')
    .optional(),
  
  // Error tracking
  failed_count: z.number()
    .int()
    .min(0)
    .default(0),
  
  skipped_count: z.number()
    .int()
    .min(0)
    .default(0),
  
  // Chain analysis
  chains_processed: z.number()
    .int()
    .min(0)
    .default(0),
  
  avg_chain_completeness: z.number()
    .min(0)
    .max(1)
    .optional(),
  
  created_at: z.string().default(() => new Date().toISOString())
});

/**
 * Input validation for email processing requests
 * Memory-safe limits based on evidence from 143,221 emails
 */
export const EmailProcessingRequestSchema = z.object({
  email_ids: z.array(z.string().uuid())
    .max(1000, 'Too many emails - max 1000 to prevent heap overflow'),
  
  processing_options: z.object({
    force_reprocess: z.boolean().default(false),
    skip_phase1: z.boolean().default(false),
    skip_phase2: z.boolean().default(false),
    skip_phase3: z.boolean().default(false),
    max_processing_time_ms: z.number()
      .min(100)
      .max(300000) // 5 minutes max
      .default(30000), // 30 seconds default
    model_override: z.string().optional()
  }).optional(),
  
  batch_options: z.object({
    batch_size: z.number()
      .int()
      .min(1)
      .max(100, 'Batch size too large - max 100')
      .default(10),
    parallel_workers: z.number()
      .int()
      .min(1)
      .max(10, 'Too many workers - max 10')
      .default(3)
  }).optional()
});

/**
 * Query validation for email search/filtering
 */
export const EmailQuerySchema = z.object({
  // Search parameters
  search: z.string().max(200, 'Search query too long').optional(),
  
  // Filters
  status: z.array(z.enum(['new', 'in_progress', 'completed', 'archived', 'deleted'])).optional(),
  priority: z.array(z.enum(['low', 'medium', 'high', 'urgent'])).optional(),
  processing_status: z.array(z.enum(['pending', 'processing', 'completed', 'failed', 'skipped'])).optional(),
  
  // Date range
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  
  // Chain filters
  chain_id: z.string().optional(),
  min_completeness: z.number().min(0).max(1).optional(),
  
  // Pagination - Memory safe limits
  limit: z.number()
    .int()
    .min(1)
    .max(1000, 'Limit too high - max 1000 records')
    .default(100),
  
  offset: z.number()
    .int()
    .min(0)
    .default(0),
  
  // Sorting
  sort_by: z.enum(['received_at', 'processed_at', 'completeness_score', 'priority']).default('received_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

/**
 * Helper functions for validation
 */
export const validationHelpers = {
  /**
   * Validate and sanitize email data before database insertion
   */
  validateEmailData: (data: unknown) => {
    return EmailsEnhancedSchema.safeParse(data);
  },
  
  /**
   * Validate processing request with memory safety
   */
  validateProcessingRequest: (request: unknown) => {
    return EmailProcessingRequestSchema.safeParse(request);
  },
  
  /**
   * Validate query parameters for email search
   */
  validateEmailQuery: (query: unknown) => {
    return EmailQuerySchema.safeParse(query);
  },
  
  /**
   * Check if array length exceeds memory-safe limit
   */
  validateArrayLength: <T>(arr: T[], maxLength: number, context: string): T[] => {
    if (arr && arr.length > maxLength) {
      console.warn(`Array length (${arr.length}) exceeds safe limit (${maxLength}) in ${context}`);
      return arr.slice(0, maxLength);
    }
    return arr || [];
  }
};

// Type exports for use in services
export type EmailsEnhanced = z.infer<typeof EmailsEnhancedSchema>;
export type EmailChains = z.infer<typeof EmailChainsSchema>;
export type ProcessingStatistics = z.infer<typeof ProcessingStatisticsSchema>;
export type EmailProcessingRequest = z.infer<typeof EmailProcessingRequestSchema>;
export type EmailQuery = z.infer<typeof EmailQuerySchema>;