/**
 * Email Repository - Handles all email-related database operations
 * Uses the enhanced email schema with proper indexing and relationships
 */

import type Database from "better-sqlite3";
import { BaseRepository } from "./BaseRepository";
import type {
  BaseEntity,
  PaginatedResult,
  QueryOptions,
} from "./BaseRepository";
import { logger } from "../../utils/logger";

export interface EmailEnhanced extends BaseEntity {
  graph_id?: string;
  message_id: string;

  // Email content
  subject: string;
  body_text?: string;
  body_html?: string;
  body_preview?: string;

  // Sender/Recipient info
  sender_email: string;
  sender_name?: string;
  recipients?: string; // JSON array
  cc_recipients?: string; // JSON array
  bcc_recipients?: string; // JSON array

  // Email metadata
  received_at: string;
  sent_at?: string;
  importance?: string;
  categories?: string; // JSON array
  has_attachments: boolean;
  is_read: boolean;
  is_flagged: boolean;

  // Threading
  thread_id?: string;
  conversation_id_ref?: string;
  in_reply_to?: string;
  references?: string; // JSON array

  // Workflow fields
  status: "new" | "in_progress" | "completed" | "archived";
  priority: "critical" | "high" | "medium" | "low";
  assigned_to?: string;
  assigned_at?: string;
  due_date?: string;

  // Processing metadata
  processed_at?: string;
  processing_version?: string;
  analysis_confidence?: number;
}

export interface EmailEntity extends BaseEntity {
  email_id: string;
  entity_type: string;
  entity_value: string;
  entity_format?: string;
  confidence: number;
  extraction_method?: string;
  verified: boolean;
}

export interface EmailAttachment extends BaseEntity {
  email_id: string;
  filename: string;
  content_type?: string;
  size_bytes?: number;
  content_id?: string;
  is_inline: boolean;
  storage_path?: string;
  checksum?: string;
  virus_scan_result?: string;
}

export interface CreateEmailData {
  message_id: string;
  subject: string;
  sender_email: string;
  received_at: string;
  body_text?: string;
  body_html?: string;
  body_preview?: string;
  sender_name?: string;
  recipients?: any[];
  cc_recipients?: any[];
  bcc_recipients?: any[];
  importance?: string;
  categories?: string[];
  has_attachments?: boolean;
  is_read?: boolean;
  thread_id?: string;
  in_reply_to?: string;
  priority?: EmailEnhanced["priority"];
  status?: EmailEnhanced["status"];
}

export interface EmailSearchOptions extends QueryOptions {
  status?: string[];
  priority?: string[];
  assigned_to?: string;
  dateRange?: { start: string; end: string };
  hasAttachments?: boolean;
  isRead?: boolean;
  searchText?: string;
}

export class EmailRepository extends BaseRepository<EmailEnhanced> {
  constructor(db: Database.Database) {
    super(db, "emails_enhanced");
  }

  /**
   * Create a new email with proper validation
   */
  async createEmail(emailData: CreateEmailData): Promise<EmailEnhanced> {
    // Check for duplicate message ID
    const existingEmail = await this.findByMessageId(emailData.message_id);
    if (existingEmail) {
      throw new Error(
        `Email with message_id ${emailData.message_id} already exists`,
      );
    }

    const emailToCreate = {
      ...emailData,
      recipients: emailData.recipients
        ? JSON.stringify(emailData.recipients)
        : undefined,
      cc_recipients: emailData.cc_recipients
        ? JSON.stringify(emailData.cc_recipients)
        : undefined,
      bcc_recipients: emailData.bcc_recipients
        ? JSON.stringify(emailData.bcc_recipients)
        : undefined,
      categories: emailData.categories
        ? JSON.stringify(emailData.categories)
        : undefined,
      has_attachments: emailData.has_attachments || false,
      is_read: emailData.is_read || false,
      is_flagged: false,
      status: emailData.status || "new",
      priority: emailData.priority || "medium",
    };

    return this.create(emailToCreate);
  }

  /**
   * Find email by message ID
   */
  async findByMessageId(messageId: string): Promise<EmailEnhanced | null> {
    return this.findOne({ message_id: messageId });
  }

  /**
   * Find emails by thread ID
   */
  async findByThreadId(threadId: string): Promise<EmailEnhanced[]> {
    return this.findAll({
      where: { thread_id: threadId },
      orderBy: "received_at",
      orderDirection: "ASC",
    });
  }

  /**
   * Find emails assigned to a specific user
   */
  async findAssignedEmails(
    userId: string,
    options: EmailSearchOptions = {},
  ): Promise<PaginatedResult<EmailEnhanced>> {
    const searchOptions = {
      ...options,
      where: {
        ...options.where,
        assigned_to: userId,
      },
    };

    return this.findEmailsWithSearch(searchOptions);
  }

  /**
   * Find unassigned emails
   */
  async findUnassignedEmails(
    options: EmailSearchOptions = {},
  ): Promise<PaginatedResult<EmailEnhanced>> {
    const searchOptions = {
      ...options,
      where: {
        ...options.where,
        assigned_to: null,
      },
    };

    return this.findEmailsWithSearch(searchOptions);
  }

  /**
   * Advanced email search with filtering
   */
  async findEmailsWithSearch(
    options: EmailSearchOptions = {},
  ): Promise<PaginatedResult<EmailEnhanced>> {
    const {
      status,
      priority,
      assigned_to,
      dateRange,
      hasAttachments,
      isRead,
      searchText,
      limit = 50,
      offset = 0,
      orderBy = "received_at",
      orderDirection = "DESC",
    } = options;

    const whereConditions: Record<string, any> = {};
    const additionalClauses: string[] = [];
    const additionalParams: any[] = [];

    // Basic filters
    if (status?.length) {
      whereConditions.status = status;
    }

    if (priority?.length) {
      whereConditions.priority = priority;
    }

    if (assigned_to !== undefined) {
      whereConditions.assigned_to = assigned_to;
    }

    if (hasAttachments !== undefined) {
      whereConditions.has_attachments = hasAttachments;
    }

    if (isRead !== undefined) {
      whereConditions.is_read = isRead;
    }

    // Date range filter
    if (dateRange) {
      additionalClauses.push("received_at BETWEEN ? AND ?");
      additionalParams.push(dateRange.start, dateRange.end);
    }

    // Text search
    if (searchText?.trim()) {
      additionalClauses.push(
        "(subject LIKE ? OR body_text LIKE ? OR sender_name LIKE ? OR sender_email LIKE ?)",
      );
      const searchPattern = `%${searchText}%`;
      additionalParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
    }

    // Build the query
    const { clause: whereClause, params: whereParams } =
      this.buildWhereClause(whereConditions);
    const orderClause = this.buildOrderClause(orderBy, orderDirection);

    const baseQuery = `SELECT * FROM ${this.tableName}`;
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    let allParams = whereParams;

    // Combine where conditions
    let finalWhereClause = whereClause;
    if (additionalClauses.length > 0) {
      const additionalWhere = additionalClauses.join(" AND ");
      if (finalWhereClause) {
        finalWhereClause += ` AND ${additionalWhere}`;
      } else {
        finalWhereClause = `WHERE ${additionalWhere}`;
      }
      allParams = [...allParams, ...additionalParams];
    }

    // Get total count
    const totalQuery = `${countQuery} ${finalWhereClause}`;
    const totalResult = this.executeQuery<{ total: number }>(
      totalQuery,
      allParams,
      "get",
    );
    const total = totalResult?.total || 0;

    // Get paginated data
    const dataQuery = `${baseQuery} ${finalWhereClause} ${orderClause} LIMIT ? OFFSET ?`;
    const dataParams = [...allParams, limit, offset];
    const data = this.executeQuery<EmailEnhanced[]>(dataQuery, dataParams);

    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Assign email to user
   */
  async assignEmail(
    emailId: string,
    userId: string,
  ): Promise<EmailEnhanced | null> {
    const now = new Date().toISOString();
    return this.update(emailId, {
      assigned_to: userId,
      assigned_at: now,
    });
  }

  /**
   * Unassign email from user
   */
  async unassignEmail(emailId: string): Promise<EmailEnhanced | null> {
    return this.update(emailId, {
      assigned_to: undefined,
      assigned_at: undefined,
    });
  }

  /**
   * Update email status
   */
  async updateEmailStatus(
    emailId: string,
    status: EmailEnhanced["status"],
  ): Promise<EmailEnhanced | null> {
    return this.update(emailId, { status });
  }

  /**
   * Update email priority
   */
  async updateEmailPriority(
    emailId: string,
    priority: EmailEnhanced["priority"],
  ): Promise<EmailEnhanced | null> {
    return this.update(emailId, { priority });
  }

  /**
   * Mark email as read/unread
   */
  async markAsRead(
    emailId: string,
    isRead: boolean = true,
  ): Promise<EmailEnhanced | null> {
    return this.update(emailId, { is_read: isRead });
  }

  /**
   * Flag/unflag email
   */
  async flagEmail(
    emailId: string,
    isFlagged: boolean = true,
  ): Promise<EmailEnhanced | null> {
    return this.update(emailId, { is_flagged: isFlagged });
  }

  /**
   * Set email due date
   */
  async setDueDate(
    emailId: string,
    dueDate: string,
  ): Promise<EmailEnhanced | null> {
    return this.update(emailId, { due_date: dueDate });
  }

  /**
   * Get email statistics
   */
  async getEmailStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    unassigned: number;
    overdue: number;
  }> {
    const total = await this.count();

    // Status distribution
    const statusQuery = `
      SELECT status, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY status
    `;
    const statusResults =
      this.executeQuery<Array<{ status: string; count: number }>>(statusQuery);
    const byStatus: Record<string, number> = {};
    statusResults.forEach((r) => (byStatus[r.status] = r.count));

    // Priority distribution
    const priorityQuery = `
      SELECT priority, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY priority
    `;
    const priorityResults =
      this.executeQuery<Array<{ priority: string; count: number }>>(
        priorityQuery,
      );
    const byPriority: Record<string, number> = {};
    priorityResults.forEach((r) => (byPriority[r.priority] = r.count));

    // Unassigned count
    const unassigned = await this.count({ assigned_to: null });

    // Overdue count
    const overdueQuery = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE due_date IS NOT NULL 
        AND due_date < datetime('now')
        AND status NOT IN ('completed', 'archived')
    `;
    const overdueResult = this.executeQuery<{ count: number }>(
      overdueQuery,
      [],
      "get",
    );
    const overdue = overdueResult?.count || 0;

    return {
      total,
      byStatus,
      byPriority,
      unassigned,
      overdue,
    };
  }

  /**
   * Get workload by assignee
   */
  async getWorkloadByAssignee(): Promise<
    Array<{
      assignee: string;
      total: number;
      new: number;
      in_progress: number;
      completed: number;
      overdue: number;
    }>
  > {
    const query = `
      SELECT 
        assigned_to as assignee,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN due_date IS NOT NULL AND due_date < datetime('now') AND status NOT IN ('completed', 'archived') THEN 1 ELSE 0 END) as overdue
      FROM ${this.tableName}
      WHERE assigned_to IS NOT NULL
      GROUP BY assigned_to
      ORDER BY total DESC
    `;

    return this.executeQuery<
      Array<{
        assignee: string;
        total: number;
        new: number;
        in_progress: number;
        completed: number;
        overdue: number;
      }>
    >(query);
  }
}

/**
 * Email Entity Repository - Handles extracted entities from emails
 */
export class EmailEntityRepository extends BaseRepository<EmailEntity> {
  constructor(db: Database.Database) {
    super(db, "email_entities");
  }

  /**
   * Find entities by email ID
   */
  async findByEmailId(emailId: string): Promise<EmailEntity[]> {
    return this.findAll({ where: { email_id: emailId } });
  }

  /**
   * Find entities by type
   */
  async findByType(entityType: string): Promise<EmailEntity[]> {
    return this.findAll({ where: { entity_type: entityType } });
  }

  /**
   * Find entities by value
   */
  async findByValue(entityValue: string): Promise<EmailEntity[]> {
    return this.findAll({ where: { entity_value: entityValue } });
  }

  /**
   * Create entity with validation
   */
  async createEntity(entityData: {
    email_id: string;
    entity_type: string;
    entity_value: string;
    entity_format?: string;
    confidence?: number;
    extraction_method?: string;
    verified?: boolean;
  }): Promise<EmailEntity> {
    const entityToCreate = {
      ...entityData,
      confidence: entityData.confidence || 1.0,
      extraction_method: entityData.extraction_method || "manual",
      verified: entityData.verified || false,
    };

    return this.create(entityToCreate);
  }

  /**
   * Verify an entity
   */
  async verifyEntity(entityId: string): Promise<EmailEntity | null> {
    return this.update(entityId, { verified: true });
  }

  /**
   * Get entity statistics
   */
  async getEntityStatistics(): Promise<{
    byType: Record<string, number>;
    byConfidence: { high: number; medium: number; low: number };
    verified: number;
    unverified: number;
  }> {
    // By type
    const typeQuery = `
      SELECT entity_type, COUNT(*) as count
      FROM ${this.tableName}
      GROUP BY entity_type
    `;
    const typeResults =
      this.executeQuery<Array<{ entity_type: string; count: number }>>(
        typeQuery,
      );
    const byType: Record<string, number> = {};
    typeResults.forEach((r) => (byType[r.entity_type] = r.count));

    // By confidence level
    const confidenceQuery = `
      SELECT 
        SUM(CASE WHEN confidence >= 0.8 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN confidence >= 0.5 AND confidence < 0.8 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN confidence < 0.5 THEN 1 ELSE 0 END) as low
      FROM ${this.tableName}
    `;
    const confidenceResult = this.executeQuery<{
      high: number;
      medium: number;
      low: number;
    }>(confidenceQuery, [], "get");
    const byConfidence = confidenceResult || { high: 0, medium: 0, low: 0 };

    // Verification status
    const verified = await this.count({ verified: true });
    const unverified = await this.count({ verified: false });

    return {
      byType,
      byConfidence,
      verified,
      unverified,
    };
  }
}

/**
 * Email Attachment Repository
 */
export class EmailAttachmentRepository extends BaseRepository<EmailAttachment> {
  constructor(db: Database.Database) {
    super(db, "email_attachments");
  }

  /**
   * Find attachments by email ID
   */
  async findByEmailId(emailId: string): Promise<EmailAttachment[]> {
    return this.findAll({ where: { email_id: emailId } });
  }

  /**
   * Create attachment with validation
   */
  async createAttachment(attachmentData: {
    email_id: string;
    filename: string;
    content_type?: string;
    size_bytes?: number;
    content_id?: string;
    is_inline?: boolean;
    storage_path?: string;
    checksum?: string;
    virus_scan_result?: string;
  }): Promise<EmailAttachment> {
    const attachmentToCreate = {
      ...attachmentData,
      is_inline: attachmentData.is_inline || false,
    };

    return this.create(attachmentToCreate);
  }

  /**
   * Get attachment statistics
   */
  async getAttachmentStatistics(): Promise<{
    total: number;
    totalSize: number;
    byContentType: Record<string, number>;
    virusScanned: number;
    cleanAttachments: number;
  }> {
    const total = await this.count();

    // Total size
    const sizeQuery = `SELECT SUM(size_bytes) as total_size FROM ${this.tableName}`;
    const sizeResult = this.executeQuery<{ total_size: number }>(
      sizeQuery,
      [],
      "get",
    );
    const totalSize = sizeResult?.total_size || 0;

    // By content type
    const typeQuery = `
      SELECT content_type, COUNT(*) as count
      FROM ${this.tableName}
      WHERE content_type IS NOT NULL
      GROUP BY content_type
    `;
    const typeResults =
      this.executeQuery<Array<{ content_type: string; count: number }>>(
        typeQuery,
      );
    const byContentType: Record<string, number> = {};
    typeResults.forEach((r) => (byContentType[r.content_type] = r.count));

    // Virus scan stats
    const virusScanned = await this.count({
      virus_scan_result: { operator: "IS NOT", value: null },
    });
    const cleanAttachments = await this.count({ virus_scan_result: "clean" });

    return {
      total,
      totalSize,
      byContentType,
      virusScanned,
      cleanAttachments,
    };
  }
}
