import type * as Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";
import { metrics } from "../../api/monitoring/metrics.js";
import type {
  UnifiedEmailData,
  WorkflowState,
} from "../../types/unified-email.types.js";
import { z } from "zod";
// Import removed - SQL injection protection schemas defined inline

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

// SQL Injection Protection schemas
const DatabaseInputSchemas = {
  searchQuery: z.string().max(500).regex(/^[a-zA-Z0-9\s\-_@.]+$/),
  email: z.string().email(),
  emailStatus: z.enum(['pending', 'new', 'processing', 'completed', 'archived', 'failed']),
  emailPriority: z.enum(['low', 'medium', 'high', 'critical'])
};

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
  dateRange: z
    .object({
      start: z.date(),
      end: z.date(),
    })
    .optional(),
  assignedTo: z.string().optional(),
  hasAttachments: z.boolean().optional(),
  isRead: z.boolean().optional(),
  threadId: z.string().optional(),
  conversationId: z.string().optional(),
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
  private statements: Map<string, Database.Statement> = new Map();

  constructor(config: EmailRepositoryConfig) {
    this.db = config.db;
    console.log('[EmailRepository] Database path:', this.db?.name || 'Unknown database');
    this.prepareStatements();
  }

  private prepareStatements(): void {
    // Check if table exists and create if needed
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS emails_enhanced (
          id TEXT PRIMARY KEY,
          graph_id TEXT UNIQUE,
          internet_message_id TEXT,
          subject TEXT,
          body_content TEXT,
          body_content_type TEXT DEFAULT 'text',
          body_preview TEXT,
          sender_email TEXT,
          sender_name TEXT,
          received_date_time TEXT,
          sent_date_time TEXT,
          importance TEXT,
          categories TEXT,
          has_attachments INTEGER DEFAULT 0,
          is_read INTEGER DEFAULT 0,
          is_flagged INTEGER DEFAULT 0,
          thread_id TEXT,
          conversation_id_ref TEXT,
          in_reply_to TEXT,
          "references" TEXT,
          status TEXT DEFAULT 'pending',
          priority INTEGER DEFAULT 0,
          assigned_to TEXT,
          assigned_at TEXT,
          due_date TEXT,
          processed_at TEXT,
          processing_version TEXT,
          analysis_confidence REAL,
          analysis_result TEXT,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        );
        
        CREATE TABLE IF NOT EXISTS email_recipients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email_id TEXT NOT NULL,
          recipient_type TEXT NOT NULL,
          email_address TEXT NOT NULL,
          name TEXT,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (email_id) REFERENCES emails_enhanced(id)
        );
        
        CREATE TABLE IF NOT EXISTS email_attachments (
          id TEXT PRIMARY KEY,
          email_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          content_type TEXT,
          size_bytes INTEGER,
          content_id TEXT,
          is_inline INTEGER DEFAULT 0,
          storage_path TEXT,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (email_id) REFERENCES emails_enhanced(id)
        );
        
        CREATE TABLE IF NOT EXISTS workflow_chains (
          id TEXT PRIMARY KEY,
          workflow_type TEXT NOT NULL,
          start_email_id TEXT,
          current_state TEXT,
          email_count INTEGER DEFAULT 0,
          is_complete INTEGER DEFAULT 0,
          completed_at TEXT,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (start_email_id) REFERENCES emails_enhanced(id)
        );
      `);
      console.log('[EmailRepository] Tables created successfully');
    } catch (err) {
      console.log('[EmailRepository] Table creation error:', err);
      // Tables might already exist, that's ok
    }

    // Insert statements
    this.statements.set(
      "insertEmail",
      this.db.prepare(`
      INSERT OR REPLACE INTO emails_enhanced (
        id, graph_id, internet_message_id, subject, body_content, body_content_type, body_preview,
        sender_email, sender_name,
        received_date_time, sent_date_time, importance, categories, has_attachments,
        is_read, is_flagged, thread_id, conversation_id_ref, in_reply_to,
        "references", status, priority, created_at, updated_at
      ) VALUES (
        @id, @graphId, @messageId, @subject, @bodyText, 'text', @bodyPreview,
        @senderEmail, @senderName,
        @receivedDateTime, @sentDateTime, @importance, @categories, @hasAttachments,
        @isRead, @isFlagged, @threadId, @conversationIdRef, @inReplyTo,
        @references, @status, @priority, @createdAt, @updatedAt
      )
    `),
    );

    this.statements.set(
      "insertRecipient",
      this.db.prepare(`
      INSERT INTO email_recipients (
        email_id, recipient_type, email_address, name
      ) VALUES (
        @emailId, @recipientType, @emailAddress, @name
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

    this.statements.set(
      "getEmailRecipients",
      this.db.prepare(`
      SELECT recipient_type, email_address, name 
      FROM email_recipients 
      WHERE email_id = ? 
      ORDER BY recipient_type, email_address
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
      WHERE received_date_time >= date('now', 'start of day')
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
        receivedDateTime: params?.receivedAt?.toISOString(),
        sentDateTime: params.sentAt?.toISOString() || null,
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

      this.statements.get("insertEmail")!.run(emailData);

      // Insert recipients
      const insertRecipient = this.statements.get("insertRecipient")!;
      
      // Insert 'to' recipients
      for (const recipient of params.recipients) {
        insertRecipient.run({
          emailId: id,
          recipientType: 'to',
          emailAddress: recipient.address,
          name: recipient.name || null
        });
      }
      
      // Insert 'cc' recipients
      if (params.ccRecipients) {
        for (const recipient of params.ccRecipients) {
          insertRecipient.run({
            emailId: id,
            recipientType: 'cc',
            emailAddress: recipient.address,
            name: recipient.name || null
          });
        }
      }
      
      // Insert 'bcc' recipients
      if (params.bccRecipients) {
        for (const recipient of params.bccRecipients) {
          insertRecipient.run({
            emailId: id,
            recipientType: 'bcc',
            emailAddress: recipient.address,
            name: recipient.name || null
          });
        }
      }

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

      const result = this.statements.get("updateEmail")!.run(updateData) as Database.RunResult;

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
      const insertEntity = this.statements.get("insertEntity")!;

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

      metrics.increment("email_repository.entities_stored", entities?.length || 0);
      metrics.histogram(
        "email_repository.store_entities_duration",
        Date.now() - startTime,
      );

      logger.info("Email entities stored", "EMAIL_REPOSITORY", {
        emailId,
        entityCount: entities?.length || 0,
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
          this.statements.get("updateWorkflowChain")!.run({
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
      this.statements.get("linkEmailToChain")!.run({
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
        whereClauses.push(
          `(subject LIKE ? OR body_content LIKE ? OR sender_email LIKE ?)`,
        );
        const searchPattern = `%${validatedParams.search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      if (validatedParams.senderEmails?.length) {
        const placeholders = validatedParams.senderEmails
          .map(() => "?")
          .join(",");
        whereClauses.push(`sender_email IN (${placeholders})`);
        queryParams.push(...validatedParams.senderEmails);
      }

      if (validatedParams.statuses?.length) {
        const placeholders = validatedParams?.statuses?.map(() => "?").join(",");
        whereClauses.push(`status IN (${placeholders})`);
        queryParams.push(...validatedParams.statuses);
      }

      if (validatedParams.priorities?.length) {
        const placeholders = validatedParams.priorities
          .map(() => "?")
          .join(",");
        whereClauses.push(`priority IN (${placeholders})`);
        queryParams.push(...validatedParams.priorities);
      }

      if (validatedParams.dateRange) {
        whereClauses.push(`received_date_time >= ? AND received_date_time <= ?`);
        queryParams.push(
          validatedParams?.dateRange?.start.toISOString(),
          validatedParams?.dateRange?.end.toISOString(),
        );
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
      const whereClause =
        whereClauses?.length || 0 > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const baseQuery = `FROM emails_enhanced ${whereClause}`;

      // Count query
      const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
      const { total } = this.db.prepare(countQuery).get(...queryParams) as { total: number };

      // Data query with ordering and pagination
      let dataQuery = `SELECT * ${baseQuery} ORDER BY received_date_time DESC`;
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
      const emails = this.db.prepare(dataQuery).all(...dataParams) as any[];

      // PERFORMANCE OPTIMIZATION: Load related data in bulk to avoid N+1 queries
      if (emails?.length || 0 > 0) {
        const emailIds = emails?.map((e: any) => e.id);
        const placeholders = emailIds?.map(() => '?').join(',');
        
        // Bulk load entities from new BI entities table (optimized for performance)
        const allEntities = this.db.prepare(`
          SELECT email_id, entity_type, entity_value, confidence_score 
          FROM email_entities_bi 
          WHERE email_id IN (${placeholders})
          ORDER BY email_id, confidence_score DESC
        `).all(...emailIds);
        
        // Bulk load attachments (FIXED: filename -> name, size_bytes -> size)
        const allAttachments = this.db.prepare(`
          SELECT email_id, name as filename, size as size_bytes 
          FROM email_attachments 
          WHERE email_id IN (${placeholders})
          ORDER BY email_id
        `).all(...emailIds);
        
        // Bulk load recipients
        const allRecipients = this.db.prepare(`
          SELECT email_id, recipient_type, email_address, name 
          FROM email_recipients 
          WHERE email_id IN (${placeholders})
          ORDER BY email_id, recipient_type
        `).all(...emailIds);
        
        // Group related data by email_id for efficient assignment
        const entitiesByEmail = new Map();
        const attachmentsByEmail = new Map();
        const recipientsByEmail = new Map();
        
        allEntities.forEach((entity: any) => {
          if (!entitiesByEmail.has(entity.email_id)) {
            entitiesByEmail.set(entity.email_id, []);
          }
          
          // Direct entity data from normalized BI table (much more efficient)
          entitiesByEmail.get(entity.email_id).push({
            type: entity.entity_type,
            value: entity.entity_value,
            confidence: entity.confidence_score
          });
        });
        
        allAttachments.forEach((attachment: any) => {
          if (!attachmentsByEmail.has(attachment.email_id)) {
            attachmentsByEmail.set(attachment.email_id, []);
          }
          attachmentsByEmail.get(attachment.email_id).push({
            filename: attachment.filename,
            size: attachment.size_bytes
          });
        });
        
        allRecipients.forEach((recipient: any) => {
          if (!recipientsByEmail.has(recipient.email_id)) {
            recipientsByEmail.set(recipient.email_id, { to: [], cc: [], bcc: [] });
          }
          const recipientGroup = recipientsByEmail.get(recipient.email_id);
          recipientGroup[recipient.recipient_type].push({
            address: recipient.email_address,
            name: recipient.name
          });
        });
        
        // Assign related data to emails
        for (const email of emails as any[]) {
          email.entities = entitiesByEmail.get(email.id) || [];
          email.attachments = attachmentsByEmail.get(email.id) || [];
          const recipients = recipientsByEmail.get(email.id) || { to: [], cc: [], bcc: [] };
          email.recipients = recipients.to;
          email.ccRecipients = recipients.cc;
          email.bccRecipients = recipients.bcc;
        }
      }

      metrics.histogram(
        "email_repository.query_duration",
        Date.now() - startTime,
      );
      metrics.increment("email_repository.emails_queried", emails?.length || 0);

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
      const email = this.statements.get("getEmailById")!.get(emailId) as any;

      if (!email) {
        return null;
      }

      // Load related data
      email.entities = this.statements.get("getEmailEntities")!.all(emailId);
      email.attachments = this.statements
        .get("getEmailAttachments")!
        .all(emailId);

      // Load recipients and organize by type
      const recipients = this.statements.get("getEmailRecipients")!.all(emailId) as any[];
      email.recipients = recipients.filter((r: any) => r.recipient_type === 'to')
        .map((r: any) => ({ address: r.email_address, name: r.name }));
      email.ccRecipients = recipients.filter((r: any) => r.recipient_type === 'cc')
        .map((r: any) => ({ address: r.email_address, name: r.name }));
      email.bccRecipients = recipients.filter((r: any) => r.recipient_type === 'bcc')
        .map((r: any) => ({ address: r.email_address, name: r.name }));

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
      const email = this.statements.get("getEmailByGraphId")!.get(graphId) as any;

      if (!email) {
        return null;
      }

      // Load related data
      email.entities = this.statements.get("getEmailEntities")!.all(email.id);
      email.attachments = this.statements
        .get("getEmailAttachments")!
        .all(email.id);

      // Load recipients and organize by type
      const recipients = this.statements.get("getEmailRecipients")!.all(email.id) as any[];
      email.recipients = recipients.filter((r: any) => r.recipient_type === 'to')
        .map((r: any) => ({ address: r.email_address, name: r.name }));
      email.ccRecipients = recipients.filter((r: any) => r.recipient_type === 'cc')
        .map((r: any) => ({ address: r.email_address, name: r.name }));
      email.bccRecipients = recipients.filter((r: any) => r.recipient_type === 'bcc')
        .map((r: any) => ({ address: r.email_address, name: r.name }));

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
      const todaysCount = (this.statements.get("countTodaysEmails")!.get() as { count: number }).count;

      const urgentCount =
        (this.statements
          .get("countByPriority")!
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
          )[0] as { count: number } | undefined)?.count || 0;

      const unassignedCount = (this.statements
        .get("countUnassigned")!
        .get() as { count: number }).count;

      const workflowStats = this.statements.get("getWorkflowStats")!.get({
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

    this.statements.get("createWorkflowChain")!.run({
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
   * Count total emails in the repository
   */
  async count(): Promise<number> {
    try {
      const result = this.db
        .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
        .get() as { count: number };
      return result.count;
    } catch (error) {
      logger.error("Failed to count emails", "EMAIL_REPOSITORY", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Close prepared statements and database connection
   */
  close(): void {
    this.statements.clear();
    logger.info("Email repository closed", "EMAIL_REPOSITORY");
  }
}
