/**
 * Email-RAG Integration Service
 * Connects email processing pipeline with RAG system for enhanced semantic search and context retrieval
 * Implements database-aligned validation patterns with Zod schemas
 */

import { z } from 'zod';
import { RAGSystem } from "./RAGSystem.js";
import { logger } from "../../utils/logger.js";
import type { EmailRecord } from "../../shared/types/email.js";

// Database-aligned Zod schemas mirroring email database constraints
const EmailStatusSchema = z.enum(['red', 'yellow', 'green'], {
  errorMap: () => ({ message: 'Status must be one of: red, yellow, green' })
});

const EmailWorkflowStateSchema = z.enum(['START_POINT', 'IN_PROGRESS', 'COMPLETION'], {
  errorMap: () => ({ message: 'Workflow state must be one of: START_POINT, IN_PROGRESS, COMPLETION' })
});

const EmailPrioritySchema = z.enum(['critical', 'high', 'medium', 'low'], {
  errorMap: () => ({ message: 'Priority must be one of: critical, high, medium, low' })
}).default('medium');

// Email content validation - mirrors database TEXT constraints
const EmailContentSchema = z.object({
  subject: z.string()
    .trim()
    .min(1, 'Subject cannot be empty')
    .max(500, 'Subject exceeds maximum length of 500 characters'),
  bodyText: z.string()
    .trim()
    .optional()
    .transform(val => val || ''),
  bodyHtml: z.string()
    .trim()
    .optional(),
  summary: z.string()
    .trim()
    .max(1000, 'Summary exceeds maximum length')
    .default('')
});

// Metadata validation with database field alignment
const EmailMetadataSchema = z.object({
  email_alias: z.string()
    .trim()
    .min(1, 'Email alias cannot be empty')
    .max(100, 'Email alias too long'),
  requested_by: z.string()
    .trim()
    .min(1, 'Requested by cannot be empty')
    .max(100, 'Requested by field too long'),
  workflow_type: z.string()
    .trim()
    .max(50, 'Workflow type too long')
    .optional(),
  source: z.enum(['manual', 'api', 'webhook', 'import']).default('manual'),
  isRead: z.boolean().default(false),
  hasAttachments: z.boolean().default(false)
});

// Complete email record validation schema
const EmailRecordValidationSchema = EmailContentSchema
  .merge(EmailMetadataSchema)
  .extend({
    status: EmailStatusSchema,
    priority: EmailPrioritySchema,
    workflow_state: EmailWorkflowStateSchema,
    timestamp: z.string().datetime('Invalid timestamp format'),
    receivedTime: z.string().datetime('Invalid received time format')
  });

// Search options validation
const EmailSearchOptionsSchema = z.object({
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Limit cannot exceed 1000')
    .default(10),
  sender: z.string()
    .trim()
    .max(255, 'Sender field too long')
    .optional(),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  }).optional(),
  includeBody: z.boolean().default(false),
  minScore: z.number()
    .min(0.0, 'Score cannot be negative')
    .max(1.0, 'Score cannot exceed 1.0')
    .optional()
});

// Indexing batch validation
const EmailBatchIndexingSchema = z.array(EmailRecordValidationSchema)
  .min(1, 'Email batch cannot be empty')
  .max(10000, 'Batch size cannot exceed 10,000 emails');

// Type-safe interfaces aligned with database schema
export interface EmailIndexingStatus {
  total: number;
  indexed: number;
  failed: number;
  errors: string[];
  duration: number;
}

export interface EmailSearchResult {
  emailId: string;
  subject: string;
  snippet: string;
  score: number;
  sender?: string;
  date?: string;
  relevantChunks?: string[];
}

// Validated email indexing status schema
const EmailIndexingStatusSchema = z.object({
  total: z.number().int().min(0, 'Total must be non-negative'),
  indexed: z.number().int().min(0, 'Indexed count must be non-negative'),
  failed: z.number().int().min(0, 'Failed count must be non-negative'),
  errors: z.array(z.string().max(500, 'Error message too long')).default([]),
  duration: z.number().min(0, 'Duration must be non-negative')
});

// Derive types from schemas for compile-time safety
export type ValidatedEmailRecord = z.infer<typeof EmailRecordValidationSchema>;
export type ValidatedEmailSearchOptions = z.infer<typeof EmailSearchOptionsSchema>;
export type ValidatedEmailIndexingStatus = z.infer<typeof EmailIndexingStatusSchema>;

export class EmailRAGIntegration {
  private ragSystem: RAGSystem;
  private indexingInProgress: boolean = false;
  private lastIndexedCount: number = 0;

  constructor(ragSystem: RAGSystem) {
    this.ragSystem = ragSystem;
  }

  /**
   * Initialize the integration and prepare for email indexing
   */
  async initialize(): Promise<void> {
    try {
      await this.ragSystem.initialize();
      logger.info("Email-RAG integration initialized successfully", "EMAIL_RAG_INTEGRATION");
    } catch (error) {
      logger.error(
        `Email-RAG integration initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      throw error;
    }
  }

  /**
   * Index a single email into the RAG system with validation
   */
  async indexEmail(email: EmailRecord): Promise<void> {
    try {
      // Validate email data against database schema constraints
      const validationResult = EmailRecordValidationSchema.safeParse({
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        summary: email.summary,
        email_alias: email.email_alias,
        requested_by: email.requested_by,
        workflow_type: email.workflow_type,
        source: email.source,
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
        status: email.status,
        priority: email.priority,
        workflow_state: email.workflow_state,
        timestamp: email.timestamp,
        receivedTime: email.receivedTime
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Email validation failed: ${errors}`);
      }

      const validatedEmail = validationResult.data;

      await this.ragSystem.indexEmailContent(email.id, {
        subject: validatedEmail.subject,
        body: validatedEmail.bodyText || validatedEmail.summary || '',
        sender: email.requested_by || undefined, // Map to available field
        recipients: undefined, // No direct recipient field in EmailRecord
        date: validatedEmail.receivedTime,
        metadata: {
          emailAlias: validatedEmail.email_alias,
          status: validatedEmail.status,
          workflowType: validatedEmail.workflow_type,
          priority: validatedEmail.priority,
          hasAttachments: validatedEmail.hasAttachments,
          isRead: validatedEmail.isRead,
          workflowState: validatedEmail.workflow_state,
          source: validatedEmail.source
        },
      });

      logger.debug(`Indexed email: ${email.id}`, "EMAIL_RAG_INTEGRATION");
    } catch (error) {
      logger.error(
        `Failed to index email ${email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      throw error;
    }
  }

  /**
   * Batch index multiple emails efficiently with validation
   */
  async batchIndexEmails(emails: EmailRecord[]): Promise<EmailIndexingStatus> {
    if (this.indexingInProgress) {
      throw new Error("Email indexing already in progress");
    }

    // Validate batch size and content
    const batchValidation = EmailBatchIndexingSchema.safeParse(
      emails.map(email => ({
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        summary: email.summary,
        email_alias: email.email_alias,
        requested_by: email.requested_by,
        workflow_type: email.workflow_type,
        source: email.source,
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
        status: email.status,
        priority: email.priority,
        workflow_state: email.workflow_state,
        timestamp: email.timestamp,
        receivedTime: email.receivedTime
      }))
    );

    if (!batchValidation.success) {
      const errors = batchValidation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Batch validation failed: ${errors}`);
    }

    this.indexingInProgress = true;
    const startTime = Date.now();

    try {
      logger.info(`Starting batch indexing of ${emails.length} emails`, "EMAIL_RAG_INTEGRATION");

      const emailData = emails.map(email => ({
        id: email.id,
        subject: email.subject || 'No Subject',
        body: email.bodyText || email.summary || '',
        sender: email.requested_by || undefined,
        recipients: undefined, // Not available in current schema
        date: email.receivedTime,
        metadata: {
          emailAlias: email.email_alias,
          status: email.status,
          workflowType: email.workflow_type,
          priority: email.priority,
          hasAttachments: email.hasAttachments,
          isRead: email.isRead,
          workflowState: email.workflow_state,
          source: email.source
        },
      }));

      const result = await this.ragSystem.batchIndexEmails(emailData);
      this.lastIndexedCount += result.indexed;

      const duration = Date.now() - startTime;
      
      // Validate result against schema
      const statusResult: EmailIndexingStatus = {
        total: emails.length,
        indexed: result.indexed,
        failed: result.failed,
        errors: result.errors,
        duration,
      };

      const validatedStatus = EmailIndexingStatusSchema.parse(statusResult);
      
      logger.info(
        `Batch indexing completed: ${validatedStatus.indexed}/${validatedStatus.total} emails indexed in ${validatedStatus.duration}ms`,
        "EMAIL_RAG_INTEGRATION"
      );

      return validatedStatus;
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Search emails using semantic similarity
   */
  async searchEmails(
    query: string,
    options: {
      limit?: number;
      sender?: string;
      dateRange?: { from?: string; to?: string };
      includeBody?: boolean;
      minScore?: number;
    } = {}
  ): Promise<EmailSearchResult[]> {
    try {
      const results = await this.ragSystem.searchEmails(query, {
        limit: options.limit || 10,
        sender: options.sender,
        dateRange: options.dateRange,
        includeBody: options.includeBody || false,
      });

      // Filter by minimum score if specified
      const filteredResults = options.minScore 
        ? results.filter(result => result.score >= options.minScore!)
        : results;

      return filteredResults.map(result => ({
        emailId: result.emailId,
        subject: result.subject,
        snippet: result.snippet,
        score: result.score,
        sender: result.sender,
        date: result.date,
        relevantChunks: [], // Could be enhanced to show specific matching chunks
      }));
    } catch (error) {
      logger.error(
        `Email search failed for query "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      throw error;
    }
  }

  /**
   * Get email context for LLM enhancement
   */
  async getEmailContextForLLM(
    query: string,
    options: {
      limit?: number;
      focusArea?: 'subject' | 'body' | 'both';
      timeframe?: 'recent' | 'all';
    } = {}
  ): Promise<string> {
    try {
      const context = await this.ragSystem.getEmailContext(query, options);
      
      if (context) {
        logger.debug(`Retrieved email context for LLM (${context.length} chars)`, "EMAIL_RAG_INTEGRATION");
      }

      return context;
    } catch (error) {
      logger.error(
        `Failed to get email context for query "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      return ""; // Return empty context rather than failing
    }
  }

  /**
   * Enhanced search that combines traditional email queries with RAG
   */
  async hybridEmailSearch(
    query: string,
    traditionalResults: EmailRecord[],
    options: {
      ragWeight?: number; // 0-1, how much to weight RAG results vs traditional
      combineLimit?: number;
    } = {}
  ): Promise<{
    combined: EmailSearchResult[];
    ragOnly: EmailSearchResult[];
    traditional: EmailRecord[];
  }> {
    const ragWeight = options.ragWeight || 0.7;
    const combineLimit = options.combineLimit || 20;

    try {
      // Get RAG results
      const ragResults = await this.searchEmails(query, { limit: combineLimit });

      // Convert traditional results to search result format
      const traditionalSearchResults: EmailSearchResult[] = traditionalResults.map((email, index) => ({
        emailId: email.id,
        subject: email.subject || 'No Subject',
        snippet: (email.bodyText || email.summary || '').substring(0, 300),
        score: Math.max(0.1, 1.0 - (index * 0.1)), // Decreasing score based on position, minimum 0.1
        sender: email.requested_by,
        date: email.receivedTime,
      }));

      // Combine and rerank results
      const allResults = new Map<string, EmailSearchResult>();

      // Add traditional results
      traditionalSearchResults.forEach(result => {
        allResults.set(result.emailId, {
          ...result,
          score: result.score * (1 - ragWeight),
        });
      });

      // Add or merge RAG results
      ragResults.forEach(result => {
        const existing = allResults.get(result.emailId);
        if (existing) {
          // Combine scores if email appears in both
          existing.score = existing.score + (result.score * ragWeight);
          existing.relevantChunks = result.relevantChunks;
        } else {
          allResults.set(result.emailId, {
            ...result,
            score: result.score * ragWeight,
          });
        }
      });

      // Sort by combined score and limit
      const combined = Array.from(allResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, combineLimit);

      logger.info(
        `Hybrid search completed: ${combined.length} combined results from ${traditionalResults.length} traditional + ${ragResults.length} RAG`,
        "EMAIL_RAG_INTEGRATION"
      );

      return {
        combined,
        ragOnly: ragResults,
        traditional: traditionalResults,
      };
    } catch (error) {
      logger.error(
        `Hybrid email search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      
      // Fallback to traditional results only
      return {
        combined: traditionalResults.map((email, index) => ({
          emailId: email.id,
          subject: email.subject || 'No Subject',
          snippet: (email.bodyText || email.summary || '').substring(0, 300),
          score: Math.max(0.1, 1.0 - (index * 0.1)),
          sender: email.requested_by,
          date: email.receivedTime,
        })),
        ragOnly: [],
        traditional: traditionalResults,
      };
    }
  }

  /**
   * Get indexing statistics
   */
  async getIndexingStats(): Promise<{
    totalDocuments: number;
    emailDocuments: number;
    indexingInProgress: boolean;
    lastIndexedCount: number;
    systemHealth: 'healthy' | 'degraded' | 'error';
  }> {
    try {
      const ragStats = await this.ragSystem.getStats();
      const healthStatus = await this.ragSystem.getHealthStatus();

      // Count email documents specifically
      const allDocs = await this.ragSystem.getAllDocuments(10000);
      const emailDocs = allDocs.filter(doc => doc.metadata.type === 'email');

      return {
        totalDocuments: ragStats.totalDocuments,
        emailDocuments: emailDocs.length,
        indexingInProgress: this.indexingInProgress,
        lastIndexedCount: this.lastIndexedCount,
        systemHealth: healthStatus.status,
      };
    } catch (error) {
      logger.error(
        `Failed to get indexing stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      
      return {
        totalDocuments: 0,
        emailDocuments: 0,
        indexingInProgress: this.indexingInProgress,
        lastIndexedCount: this.lastIndexedCount,
        systemHealth: 'error',
      };
    }
  }

  /**
   * Clear all email documents from the RAG system
   */
  async clearEmailIndex(): Promise<void> {
    try {
      // Note: This is a simplified implementation
      // A more sophisticated approach would selectively delete only email documents
      await this.ragSystem.clear();
      this.lastIndexedCount = 0;
      
      logger.info("Email index cleared", "EMAIL_RAG_INTEGRATION");
    } catch (error) {
      logger.error(
        `Failed to clear email index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      throw error;
    }
  }

  /**
   * Check if the integration is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      const healthStatus = await this.ragSystem.getHealthStatus();
      return healthStatus.status !== 'error';
    } catch (error) {
      return false;
    }
  }
}