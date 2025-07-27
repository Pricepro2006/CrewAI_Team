import type Database from "better-sqlite3";
import { logger } from "@/utils/logger";
import { metrics } from "@/api/monitoring/metrics";
import type {
  UnifiedEmailData,
  WorkflowState,
} from "@/types/unified-email.types";
import { z } from "zod";
import { DatabaseInputSchemas } from "../security/SqlInjectionProtection";

export interface EmailRepositoryConfig {
  db: Database.Database;
}

export interface EmailEntity {
  type: string;
  value: string;
  format?: string;
  confidence?: number;
  extractionMethod?: string;
}

export interface CreateEmailParams {
  graphId: string;
  messageId: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  bodyPreview?: string;
  senderEmail: string;
  senderName?: string;
  recipients: Array<{ address: string; name?: string }>;
  ccRecipients?: Array<{ address: string; name?: string }>;
  bccRecipients?: Array<{ address: string; name?: string }>;
  receivedAt: Date;
  sentAt?: Date;
  importance?: string;
  categories?: string[];
  hasAttachments: boolean;
  isRead?: boolean;
  isFlagged?: boolean;
  threadId?: string;
  conversationId?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface UpdateEmailParams {
  status?: string;
  priority?: string;
  assignedTo?: string;
  assignedAt?: Date;
  dueDate?: Date;
  workflowState?: WorkflowState;
  workflowType?: string;
  workflowChainId?: string;
  isWorkflowComplete?: boolean;
  analysisConfidence?: number;
  processedAt?: Date;
  processingVersion?: string;
}

// Validation schema for email query parameters
const EmailQueryParamsSchema = z.object({
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  search: DatabaseInputSchemas.searchQuery.optional(),
  senderEmails: z.array(DatabaseInputSchemas.email).optional(),
  statuses: z.array(DatabaseInputSchemas.emailStatus).optional(),
  priorities: z.array(DatabaseInputSchemas.emailPriority).optional(),
  workflowStates: z.array(z.string()).optional(),
  workflowTypes: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.date(),
    end: z.date()
  }).optional(),
  assignedTo: z.string().optional(),
  hasAttachments: z.boolean().optional(),
  isRead: z.boolean().optional(),
  threadId: z.string().optional(),
  conversationId: z.string().optional()
});

export interface EmailQueryParams {
  offset?: number;
  limit?: number;
  search?: string;
  senderEmails?: string[];
  statuses?: string[];
  priorities?: string[];
  workflowStates?: WorkflowState[];
  workflowTypes?: string[];
  dateRange?: { start: Date; end: Date };
  assignedTo?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  threadId?: string;
  conversationId?: string;
}

export class EmailRepository {
  private db: Database.Database;
  private statements: Map<string, any> = new Map();

  constructor(config: EmailRepositoryConfig) {
    this.db = config.db;
    this.prepareStatements();
  }

  private prepareStatements(): void {
    // Insert statements
    this.statements.set(
      "insertEmail",
      this.db.prepare(`
      INSERT INTO emails_enhanced (
        id, graph_id, message_id, subject, body_text, body_html, body_preview,
        sender_email, sender_name, recipients, cc_recipients, bcc_recipients,
        received_at, sent_at, importance, categories, has_attachments,
        is_read, is_flagged, thread_id, conversation_id_ref, in_reply_to,
        "references", status, priority, created_at, updated_at
      ) VALUES (
        @id, @graphId, @messageId, @subject, @bodyText, @bodyHtml, @bodyPreview,
        @senderEmail, @senderName, @recipients, @ccRecipients, @bccRecipients,
        @receivedAt, @sentAt, @importance, @categories, @hasAttachments,
        @isRead, @isFlagged, @threadId, @conversationIdRef, @inReplyTo,
        @references, @status, @priority, @createdAt, @updatedAt
      )
    `),
    );

    this.statements.set(
      "insertAttachment",
      this.db.prepare(`
      INSERT INTO email_attachments (
        id, email_id, filename, content_type, size_bytes, content_id,
        is_inline, storage_path, created_at
      ) VALUES (
        @id, @emailId, @filename, @contentType, @sizeBytes, @contentId,
        @isInline, @storagePath, @createdAt
      )
    `),
    );

    this.statements.set(
      "insertEntity",
      this.db.prepare(`
      INSERT INTO email_entities (
        id, email_id, entity_type, entity_value, entity_format,
        confidence, extraction_method, verified, created_at
      ) VALUES (
        @id, @emailId, @entityType, @entityValue, @entityFormat,
        @confidence, @extractionMethod, @verified, @createdAt
      )
    `),
    );

    // Update statements
    this.statements.set(
      "updateEmail",
      this.db.prepare(`
      UPDATE emails_enhanced SET
        status = COALESCE(@status, status),
        priority = COALESCE(@priority, priority),
        assigned_to = COALESCE(@assignedTo, assigned_to),
        assigned_at = COALESCE(@assignedAt, assigned_at),
        due_date = COALESCE(@dueDate, due_date),
        processed_at = COALESCE(@processedAt, processed_at),
        processing_version = COALESCE(@processingVersion, processing_version),
        analysis_confidence = COALESCE(@analysisConfidence, analysis_confidence),
        updated_at = @updatedAt
      WHERE id = @id
    `),
    );

    // Query statements
    this.statements.set(
      "getEmailById",
      this.db.prepare(`
      SELECT * FROM emails_enhanced WHERE id = ?
    `),
    );

    this.statements.set(
      "getEmailByGraphId",
      this.db.prepare(`
      SELECT * FROM emails_enhanced WHERE graph_id = ?
    `),
    );

    this.statements.set(
      "getEmailEntities",
      this.db.prepare(`
      SELECT * FROM email_entities WHERE email_id = ? ORDER BY confidence DESC
    `),
    );

    this.statements.set(
      "getEmailAttachments",
      this.db.prepare(`
      SELECT * FROM email_attachments WHERE email_id = ?
    `),
    );

    // Workflow chain statements
    this.statements.set(
      "createWorkflowChain",
      this.db.prepare(`
      INSERT INTO workflow_chains (
        id, workflow_type, start_email_id, current_state, email_count,
        is_complete, created_at, updated_at
      ) VALUES (
        @id, @workflowType, @startEmailId, @currentState, @emailCount,
        @isComplete, @createdAt, @updatedAt
      )
    `),
    );

    this.statements.set(
      "updateWorkflowChain",
      this.db.prepare(`
      UPDATE workflow_chains SET
        current_state = @currentState,
        email_count = email_count + 1,
        is_complete = @isComplete,
        completed_at = @completedAt,
        updated_at = @updatedAt
      WHERE id = @id
    `),
    );

    this.statements.set(
      "linkEmailToChain",
      this.db.prepare(`
      INSERT INTO workflow_chain_emails (
        chain_id, email_id, sequence_number, created_at
      ) VALUES (
        @chainId, @emailId, @sequenceNumber, @createdAt
      )
    `),
    );

    // Analytics queries
    this.statements.set(
      "countTodaysEmails",
      this.db.prepare(`
      SELECT COUNT(*) as count FROM emails_enhanced 
      WHERE received_at >= date('now', 'start of day')
    `),
    );

    this.statements.set(
      "countByPriority",
      this.db.prepare(`
      SELECT COUNT(*) as count FROM emails_enhanced 
      WHERE priority IN (${new Array(10).fill("?").join(",")})
    `),
    );

    this.statements.set(
      "countUnassigned",
      this.db.prepare(`
      SELECT COUNT(*) as count FROM emails_enhanced 
      WHERE assigned_to IS NULL AND status NOT IN ('completed', 'archived')
    `),
    );

    this.statements.set(
      "getWorkflowStats",
      this.db.prepare(`
      SELECT 
        COUNT(DISTINCT wc.id) as total_chains,
        SUM(CASE WHEN wc.is_complete = 1 THEN 1 ELSE 0 END) as complete_chains,
        AVG(wc.email_count) as avg_emails_per_chain,
        AVG(CASE 
          WHEN wc.is_complete = 1 
          THEN (julianday(wc.completed_at) - julianday(wc.created_at)) * 24 
          ELSE NULL 
        END) as avg_completion_hours
      FROM workflow_chains wc
      WHERE (@startDate IS NULL OR wc.created_at >= @startDate)
        AND (@endDate IS NULL OR wc.created_at <= @endDate)
    `),
    );
  }

  /**
   * Create a new email record
   */
  async createEmail(params: CreateEmailParams): Promise<string> {
    const startTime = Date.now();

    try {
      const id = this.generateId("email");
      const now = new Date().toISOString();

      const emailData = {
        id,
        graphId: params.graphId,
        messageId: params.messageId,
        subject: params.subject,
        bodyText: params.bodyText,
        bodyHtml: params.bodyHtml,
        bodyPreview: params.bodyPreview || params.bodyText?.substring(0, 255),
        senderEmail: params.senderEmail,
        senderName: params.senderName,
        recipients: JSON.stringify(params.recipients),
        ccRecipients: params.ccRecipients
          ? JSON.stringify(params.ccRecipients)
          : null,
        bccRecipients: params.bccRecipients
          ? JSON.stringify(params.bccRecipients)
          : null,
        receivedAt: params.receivedAt.toISOString(),
        sentAt: params.sentAt?.toISOString() || null,
        importance: params.importance || "normal",
        categories: params.categories
          ? JSON.stringify(params.categories)
          : null,
        hasAttachments: params.hasAttachments ? 1 : 0,
        isRead: params.isRead ? 1 : 0,
        isFlagged: params.isFlagged ? 1 : 0,
        threadId: params.threadId,
        conversationIdRef: params.conversationId,
        inReplyTo: params.inReplyTo,
        references: params.references
          ? JSON.stringify(params.references)
          : null,
        status: "new",
        priority: "medium",
        createdAt: now,
        updatedAt: now,
      };

      this.statements.get("insertEmail").run(emailData);

      metrics.increment("email_repository.email_created");
      metrics.histogram(
        "email_repository.create_duration",
        Date.now() - startTime,
      );

      logger.info("Email created in database", "EMAIL_REPOSITORY", {
        emailId: id,
        graphId: params.graphId,
      });

      return id;
    } catch (error) {
      logger.error("Failed to create email", "EMAIL_REPOSITORY", {
        error: error instanceof Error ? error.message : String(error),
        graphId: params.graphId,
      });
      metrics.increment("email_repository.create_error");
      throw error;
    }
  }

  /**
   * Update an email record
   */
  async updateEmail(emailId: string, params: UpdateEmailParams): Promise<void> {
    const startTime = Date.now();

    try {
      const updateData = {
        id: emailId,
        ...params,
        updatedAt: new Date().toISOString(),
      };

      const result = this.statements.get("updateEmail").run(updateData);

      if (result.changes === 0) {
        throw new Error(`Email not found: ${emailId}`);
      }

      metrics.increment("email_repository.email_updated");
      metrics.histogram(
        "email_repository.update_duration",
        Date.now() - startTime,
      );

      logger.info("Email updated", "EMAIL_REPOSITORY", { emailId });
    } catch (error) {
      logger.error("Failed to update email", "EMAIL_REPOSITORY", {
        error: error instanceof Error ? error.message : String(error),
        emailId,
      });
      metrics.increment("email_repository.update_error");
      throw error;
    }
  }

  /**
   * Store email entities
   */
  async storeEmailEntities(
    emailId: string,
    entities: EmailEntity[],
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const insertEntity = this.statements.get("insertEntity");

      const transaction = this.db.transaction(() => {
        for (const entity of entities) {
          const entityData = {
            id: this.generateId("entity"),
            emailId,
            entityType: entity.type,
            entityValue: entity.value,
            entityFormat: entity.format || null,
            confidence: entity.confidence || 1.0,
            extractionMethod: entity.extractionMethod || "pipeline",
            verified: 0,
            createdAt: new Date().toISOString(),
          };

          insertEntity.run(entityData);
        }
      });

      transaction();

      metrics.increment("email_repository.entities_stored", entities.length);
      metrics.histogram(
        "email_repository.store_entities_duration",
        Date.now() - startTime,
      );

      logger.info("Email entities stored", "EMAIL_REPOSITORY", {
        emailId,
        entityCount: entities.length,
      });
    } catch (error) {
      logger.error("Failed to store email entities", "EMAIL_REPOSITORY", {
        error: error instanceof Error ? error.message : String(error),
        emailId,
      });
      metrics.increment("email_repository.store_entities_error");
      throw error;
    }
  }

  /**
   * Create or update workflow chain
   */
  async createOrUpdateWorkflowChain(params: {
    emailId: string;
    workflowType: string;
    workflowState: WorkflowState;
    conversationId?: string;
    isComplete?: boolean;
  }): Promise<string> {
    const startTime = Date.now();

    try {
      // Check if chain exists for conversation
      let chainId: string;

      if (params.conversationId) {
        const existingChain = this.db
          .prepare(
            `
          SELECT wc.* FROM workflow_chains wc
          JOIN workflow_chain_emails wce ON wc.id = wce.chain_id
          JOIN emails_enhanced e ON wce.email_id = e.id
          WHERE e.conversation_id_ref = ? AND wc.is_complete = 0
          ORDER BY wc.created_at DESC
          LIMIT 1
        `,
          )
          .get(params.conversationId) as any;

        if (existingChain) {
          chainId = existingChain.id;

          // Update existing chain
          this.statements.get("updateWorkflowChain").run({
            id: chainId,
            currentState: params.workflowState,
            isComplete: params.isComplete ? 1 : 0,
            completedAt: params.isComplete ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
          });
        } else {
          chainId = this.createNewWorkflowChain(params);
        }
      } else {
        chainId = this.createNewWorkflowChain(params);
      }

      // Link email to chain
      const sequenceNumber = this.getNextSequenceNumber(chainId);
      this.statements.get("linkEmailToChain").run({
        chainId,
        emailId: params.emailId,
        sequenceNumber,
        createdAt: new Date().toISOString(),
      });

      metrics.increment("email_repository.workflow_chain_updated");
      metrics.histogram(
        "email_repository.workflow_chain_duration",
        Date.now() - startTime,
      );

      return chainId;
    } catch (error) {
      logger.error(
        "Failed to create/update workflow chain",
        "EMAIL_REPOSITORY",
        {
          error: error instanceof Error ? error.message : String(error),
          emailId: params.emailId,
        },
      );
      metrics.increment("email_repository.workflow_chain_error");
      throw error;
    }
  }

  /**
   * Query emails with filters
   */
  async queryEmails(
    params: EmailQueryParams,
  ): Promise<{ emails: any[]; total: number }> {
    const startTime = Date.now();

    try {
      // Validate input parameters
      const validatedParams = EmailQueryParamsSchema.parse(params);
      
      const whereClauses: string[] = [];
      const queryParams: any[] = [];

      // Build WHERE clauses with proper parameterization using validated params
      if (validatedParams.search) {
        whereClauses.push(`(subject LIKE ? OR body_text LIKE ? OR sender_email LIKE ?)`);
        const searchPattern = `%${validatedParams.search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      if (validatedParams.senderEmails?.length) {
        const placeholders = validatedParams.senderEmails.map(() => '?').join(',');
        whereClauses.push(`sender_email IN (${placeholders})`);
        queryParams.push(...validatedParams.senderEmails);
      }

      if (validatedParams.statuses?.length) {
        const placeholders = validatedParams.statuses.map(() => '?').join(',');
        whereClauses.push(`status IN (${placeholders})`);
        queryParams.push(...validatedParams.statuses);
      }

      if (validatedParams.priorities?.length) {
        const placeholders = validatedParams.priorities.map(() => '?').join(',');
        whereClauses.push(`priority IN (${placeholders})`);
        queryParams.push(...validatedParams.priorities);
      }

      if (validatedParams.dateRange) {
        whereClauses.push(`received_at >= ? AND received_at <= ?`);
        queryParams.push(validatedParams.dateRange.start.toISOString(), validatedParams.dateRange.end.toISOString());
      }

      if (validatedParams.assignedTo !== undefined) {
        if (validatedParams.assignedTo === null) {
          whereClauses.push(`assigned_to IS NULL`);
        } else {
          whereClauses.push(`assigned_to = ?`);
          queryParams.push(validatedParams.assignedTo);
        }
      }

      if (validatedParams.hasAttachments !== undefined) {
        whereClauses.push(`has_attachments = ?`);
        queryParams.push(validatedParams.hasAttachments ? 1 : 0);
      }

      if (validatedParams.isRead !== undefined) {
        whereClauses.push(`is_read = ?`);
        queryParams.push(validatedParams.isRead ? 1 : 0);
      }

      if (validatedParams.threadId) {
        whereClauses.push(`thread_id = ?`);
        queryParams.push(validatedParams.threadId);
      }

      if (validatedParams.conversationId) {
        whereClauses.push(`conversation_id_ref = ?`);
        queryParams.push(validatedParams.conversationId);
      }

      // Build final queries
      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const baseQuery = `FROM emails_enhanced ${whereClause}`;
      
      // Count query
      const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
      const { total } = this.db.prepare(countQuery).get(...queryParams) as any;

      // Data query with ordering and pagination
      let dataQuery = `SELECT * ${baseQuery} ORDER BY received_at DESC`;
      const dataParams = [...queryParams];
      
      if (validatedParams.limit) {
        dataQuery += ` LIMIT ?`;
        dataParams.push(validatedParams.limit);
        
        if (validatedParams.offset) {
          dataQuery += ` OFFSET ?`;
          dataParams.push(validatedParams.offset);
        }
      }

      // Execute query
      const emails = this.db.prepare(dataQuery).all(...dataParams);

      // Load entities for each email
      for (const email of emails as any[]) {
        email.entities = this.statements.get("getEmailEntities").all(email.id);
        email.attachments = this.statements
          .get("getEmailAttachments")
          .all(email.id);
      }

      metrics.histogram(
        "email_repository.query_duration",
        Date.now() - startTime,
      );
      metrics.increment("email_repository.emails_queried", emails.length);

      return { emails, total };
    } catch (error) {
      logger.error("Failed to query emails", "EMAIL_REPOSITORY", {
        error: error instanceof Error ? error.message : String(error),
      });
      metrics.increment("email_repository.query_error");
      throw error;
    }
  }

  /**
   * Get email by ID
   */
  async getEmailById(emailId: string): Promise<any | null> {
    try {
      const email = this.statements.get("getEmailById").get(emailId);

      if (!email) {
        return null;
      }

      // Load related data
      email.entities = this.statements.get("getEmailEntities").all(emailId);
      email.attachments = this.statements
        .get("getEmailAttachments")
        .all(emailId);

      return email;
    } catch (error) {
      logger.error("Failed to get email by ID", "EMAIL_REPOSITORY", {
        error: error instanceof Error ? error.message : String(error),
        emailId,
      });
      throw error;
    }
  }

  /**
   * Get email by Graph ID
   */
  async getEmailByGraphId(graphId: string): Promise<any | null> {
    try {
      const email = this.statements.get("getEmailByGraphId").get(graphId);

      if (!email) {
        return null;
      }

      // Load related data
      email.entities = this.statements.get("getEmailEntities").all(email.id);
      email.attachments = this.statements
        .get("getEmailAttachments")
        .all(email.id);

      return email;
    } catch (error) {
      logger.error("Failed to get email by Graph ID", "EMAIL_REPOSITORY", {
        error: error instanceof Error ? error.message : String(error),
        graphId,
      });
      throw error;
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<any> {
    try {
      const todaysCount = this.statements.get("countTodaysEmails").get().count;

      const urgentCount =
        this.statements
          .get("countByPriority")
          .all(
            "critical",
            "high",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          )[0]?.count || 0;

      const unassignedCount = this.statements
        .get("countUnassigned")
        .get().count;

      const workflowStats = this.statements.get("getWorkflowStats").get({
        startDate: dateRange?.start?.toISOString() || null,
        endDate: dateRange?.end?.toISOString() || null,
      });

      return {
        todaysCount,
        urgentCount,
        unassignedCount,
        workflowStats,
      };
    } catch (error) {
      logger.error("Failed to get analytics", "EMAIL_REPOSITORY", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Helper methods

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${timestamp}${random}`;
  }

  private createNewWorkflowChain(params: any): string {
    const chainId = this.generateId("chain");
    const now = new Date().toISOString();

    this.statements.get("createWorkflowChain").run({
      id: chainId,
      workflowType: params.workflowType,
      startEmailId: params.emailId,
      currentState: params.workflowState,
      emailCount: 1,
      isComplete: params.isComplete ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });

    return chainId;
  }

  private getNextSequenceNumber(chainId: string): number {
    const result = this.db
      .prepare(
        `
      SELECT MAX(sequence_number) as max_seq 
      FROM workflow_chain_emails 
      WHERE chain_id = ?
    `,
      )
      .get(chainId) as any;

    return (result?.max_seq || 0) + 1;
  }

  /**
   * Close prepared statements and database connection
   */
  close(): void {
    this.statements.clear();
    logger.info("Email repository closed", "EMAIL_REPOSITORY");
  }
}
