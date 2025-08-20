import { BaseRepository } from "./BaseRepository.js";
import type { IEmailRepository } from "./interfaces/IEmailRepository.js";
import type { PaginationOptions, PaginatedResult } from "./interfaces/IRepository.js";
import type {
  EmailRecord,
  EmailFolder,
} from "../../types/EmailTypes.js";
import { AnalysisStatus, EmailPriority } from "../../types/EmailTypes.js";
import { executeQuery, executeTransaction } from "../ConnectionPool.js";
import { logger } from "../../utils/logger.js";
import type { 
  DatabaseInstance, 
  DatabaseRow, 
  QueryParameters 
} from "../../shared/types/client.types.js";
// Use require for better-sqlite3 to avoid type issues
const Database = require("better-sqlite3");

/**
 * Database row type with string dates
 */
interface EmailDbRow {
  id: string;
  internet_message_id: string;
  subject: string;
  body_text: string;
  body_html?: string;
  from_address: string;
  to_addresses: string;
  cc_addresses?: string;
  bcc_addresses?: string;
  received_date_time: string;
  sent_date_time?: string;
  conversation_id?: string;
  thread_id?: string;
  in_reply_to?: string;
  references?: string;
  has_attachments: number;
  importance: string;
  folder: string;
  status: string;
  workflow_state?: string;
  priority?: string;
  confidence_score?: number;
  analyzed_at?: string;
  created_at: string;
  updated_at?: string;
  error_message?: string;
}

/**
 * Email repository implementation following the repository pattern
 * Note: Uses composition over inheritance to handle type mismatches
 */
export class EmailRepositoryImpl implements IEmailRepository {
  protected tableName = "emails";
  protected primaryKey = "id";

  constructor() {
    // No super call needed as we're not extending BaseRepository
  }

  /**
   * Generate a new UUID for entity ID
   */
  protected generateId(): string {
    return require('uuid').v4();
  }

  /**
   * Convert to snake_case for database columns
   */
  protected toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Map database row to EmailRecord entity
   */
  protected mapRowToEntity(row: DatabaseRow): EmailRecord {
    return {
      id: row.id,
      message_id: row.internet_message_id,  // Map from DB column name
      subject: row.subject,
      body_text: row.body_text,
      body_html: row.body_html,
      from_address: row.from_address,
      to_addresses: row.to_addresses,
      cc_addresses: row.cc_addresses,
      bcc_addresses: row.bcc_addresses,
      received_time: new Date(row.received_date_time),
      sent_time: row.sent_date_time ? new Date(row.sent_date_time) : undefined,
      conversation_id: row.conversation_id,
      thread_id: row.thread_id,
      in_reply_to: row.in_reply_to,
      references: row.references,
      has_attachments: Boolean(row.has_attachments),
      importance: row.importance,
      folder: row.folder as EmailFolder,
      status: row.status as AnalysisStatus,
      workflow_state: row.workflow_state,
      priority: row.priority as EmailPriority,
      confidence_score: row.confidence_score,
      analyzed_at: row.analyzed_at ? new Date(row.analyzed_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
      error_message: row.error_message,
    };
  }

  /**
   * Map EmailRecord entity to database row
   */
  protected mapEntityToRow(entity: Partial<EmailRecord>): DatabaseRow {
    const row: DatabaseRow = {};

    if (entity.message_id !== undefined) row.internet_message_id = entity.message_id;  // Map to DB column name
    if (entity.subject !== undefined) row.subject = entity.subject;
    if (entity.body_text !== undefined) row.body_text = entity.body_text;
    if (entity.body_html !== undefined) row.body_html = entity.body_html;
    if (entity.from_address !== undefined)
      row.from_address = entity.from_address;
    if (entity.to_addresses !== undefined)
      row.to_addresses = entity.to_addresses;
    if (entity.cc_addresses !== undefined)
      row.cc_addresses = entity.cc_addresses;
    if (entity.bcc_addresses !== undefined)
      row.bcc_addresses = entity.bcc_addresses;
    if (entity.received_time !== undefined)
      row.received_date_time = entity.received_time instanceof Date ? entity?.received_time?.toISOString() : entity.received_time;
    if (entity.sent_time !== undefined)
      row.sent_date_time = entity.sent_time ? (entity.sent_time instanceof Date ? entity?.sent_time?.toISOString() : entity.sent_time) : undefined;
    if (entity.conversation_id !== undefined)
      row.conversation_id = entity.conversation_id;
    if (entity.thread_id !== undefined) row.thread_id = entity.thread_id;
    if (entity.in_reply_to !== undefined) row.in_reply_to = entity.in_reply_to;
    if (entity.references !== undefined) row.references = entity.references;
    if (entity.has_attachments !== undefined)
      row.has_attachments = entity.has_attachments ? 1 : 0;
    if (entity.importance !== undefined) row.importance = entity.importance;
    if (entity.folder !== undefined) row.folder = entity.folder;
    if (entity.status !== undefined) row.status = entity.status;
    if (entity.workflow_state !== undefined)
      row.workflow_state = entity.workflow_state;
    if (entity.priority !== undefined) row.priority = entity.priority;
    if (entity.confidence_score !== undefined)
      row.confidence_score = entity.confidence_score;
    if (entity.analyzed_at !== undefined)
      row.analyzed_at = entity.analyzed_at ? (entity.analyzed_at instanceof Date ? entity?.analyzed_at?.toISOString() : entity.analyzed_at) : undefined;
    if (entity.error_message !== undefined)
      row.error_message = entity.error_message;

    return row;
  }

  /**
   * Find emails by conversation ID
   */
  async findByConversationId(conversationId: string): Promise<EmailRecord[]> {
    return executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName} 
        WHERE conversation_id = ? 
        ORDER BY received_date_time ASC
      `);
      const rows = stmt.all(conversationId) as DatabaseRow[];
      return rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find emails by status with pagination
   */
  async findByStatus(
    status: AnalysisStatus,
    limit?: number,
    offset?: number,
  ): Promise<EmailRecord[]> {
    return executeQuery((db: DatabaseInstance) => {
      let query = `SELECT * FROM ${this.tableName} WHERE status = ?`;
      const params: unknown[] = [status];

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);

        if (offset !== undefined) {
          query += " OFFSET ?";
          params.push(offset);
        }
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as DatabaseRow[];
      return rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find pending analysis emails
   */
  async findPendingAnalysis(
    limit: number,
    offset: number,
  ): Promise<EmailRecord[]> {
    return executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE status IN (?, ?)
        ORDER BY received_date_time DESC
        LIMIT ? OFFSET ?
      `);
      const rows = stmt.all(
        AnalysisStatus.PENDING,
        AnalysisStatus.ANALYZING,
        limit,
        offset,
      ) as DatabaseRow[];
      return rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find email by message ID
   */
  async findByMessageId(messageId: string): Promise<EmailRecord | null> {
    return executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(
        `SELECT * FROM ${this.tableName} WHERE internet_message_id = ?`,  // Use correct DB column name
      );
      const row = stmt.get(messageId) as DatabaseRow | undefined;
      return row ? this.mapRowToEntity(row) : null;
    });
  }

  /**
   * Find emails by thread ID
   */
  async findByThreadId(threadId: string): Promise<EmailRecord[]> {
    return executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName} 
        WHERE thread_id = ? 
        ORDER BY received_date_time ASC
      `);
      const rows = stmt.all(threadId) as DatabaseRow[];
      return rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find emails within date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number,
  ): Promise<EmailRecord[]> {
    return executeQuery((db: DatabaseInstance) => {
      let query = `
        SELECT * FROM ${this.tableName}
        WHERE received_date_time BETWEEN ? AND ?
        ORDER BY received_date_time DESC
      `;
      const params: unknown[] = [startDate.toISOString(), endDate.toISOString()];

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as DatabaseRow[];
      return rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
    });
  }

  /**
   * Update email analysis status
   */
  async updateAnalysisStatus(
    id: string,
    status: AnalysisStatus,
    error?: string,
  ): Promise<void> {
    await executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(`
        UPDATE ${this.tableName}
        SET status = ?, error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(status, error || null, id);
    });
  }

  /**
   * Update email priority
   */
  async updatePriority(id: string, priority: EmailPriority): Promise<void> {
    await executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(`
        UPDATE ${this.tableName}
        SET priority = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(priority, id);
    });
  }

  /**
   * Update workflow state
   */
  async updateWorkflowState(
    id: string,
    workflowState: string,
    confidence?: number,
  ): Promise<void> {
    await executeQuery((db: DatabaseInstance) => {
      let query = `
        UPDATE ${this.tableName}
        SET workflow_state = ?, updated_at = datetime('now')
      `;
      const params: unknown[] = [workflowState];

      if (confidence !== undefined) {
        query = query.replace(
          "updated_at = datetime('now')",
          "confidence_score = ?, updated_at = datetime('now')",
        );
        params.push(confidence);
      }

      query += " WHERE id = ?";
      params.push(id);

      const stmt = db.prepare(query);
      stmt.run(...params);
    });
  }

  /**
   * Mark email as analyzed
   */
  async markAsAnalyzed(id: string, analyzedAt: Date): Promise<void> {
    await executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(`
        UPDATE ${this.tableName}
        SET status = ?, analyzed_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(AnalysisStatus.ANALYZED, analyzedAt.toISOString(), id);
    });
  }

  /**
   * Get email statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    analyzed: number;
    failed: number;
    byPriority: Record<EmailPriority, number>;
  }> {
    return executeQuery((db: DatabaseInstance) => {
      // Total count
      const totalStmt = db.prepare(
        `SELECT COUNT(*) as count FROM ${this.tableName}`,
      );
      const total = (totalStmt.get() as DatabaseRow).count as number;

      // Status counts
      const statusStmt = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM ${this.tableName} 
        GROUP BY status
      `);
      const statusCounts = statusStmt.all() as DatabaseRow[];

      const pending =
        statusCounts.find((s: DatabaseRow) => s.status === AnalysisStatus.PENDING)?.count as number ||
        0;
      const analyzed =
        statusCounts.find((s: DatabaseRow) => s.status === AnalysisStatus.ANALYZED)?.count as number ||
        0;
      const failed =
        statusCounts.find((s: DatabaseRow) => s.status === AnalysisStatus.FAILED)?.count as number ||
        0;

      // Priority counts
      const priorityStmt = db.prepare(`
        SELECT priority, COUNT(*) as count 
        FROM ${this.tableName} 
        WHERE priority IS NOT NULL
        GROUP BY priority
      `);
      const priorityCounts = priorityStmt.all() as DatabaseRow[];

      const byPriority: Record<EmailPriority, number> = {
        [EmailPriority.CRITICAL]: 0,
        [EmailPriority.HIGH]: 0,
        [EmailPriority.MEDIUM]: 0,
        [EmailPriority.LOW]: 0,
        [EmailPriority.NONE]: 0,
      };

      priorityCounts.forEach((p: DatabaseRow) => {
        if (p.priority && p.priority in byPriority) {
          byPriority[p.priority as EmailPriority] = p.count as number;
        }
      });

      return {
        total,
        pending,
        analyzed,
        failed,
        byPriority,
      };
    });
  }

  /**
   * Batch create emails - adapter to handle EmailRecord type conversion
   */
  async batchCreate(emails: Omit<EmailRecord, "id">[]): Promise<EmailRecord[]> {
    return executeTransaction((db: DatabaseInstance) => {
      const insertStmt = db.prepare(`
        INSERT INTO ${this.tableName} (
          id, internet_message_id, subject, body_text, body_html,
          from_address, to_addresses, cc_addresses, bcc_addresses,
          received_date_time, sent_date_time, conversation_id, thread_id,
          in_reply_to, references, has_attachments, importance,
          folder, status, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
        )
      `);

      const createdEmails: EmailRecord[] = [];

      for (const email of emails) {
        const id = this.generateId();
        const row = this.mapEntityToRow(email);

        insertStmt.run(
          id,
          row.internet_message_id,  // Use correct column name
          row.subject,
          row.body_text,
          row.body_html,
          row.from_address,
          row.to_addresses,
          row.cc_addresses,
          row.bcc_addresses,
          row.received_date_time,
          row.sent_date_time,
          row.conversation_id,
          row.thread_id,
          row.in_reply_to,
          row.references,
          row.has_attachments,
          row.importance,
          row.folder,
          row.status || AnalysisStatus.PENDING,
        );

        createdEmails.push({
          ...email,
          id,
          created_at: new Date(),
        } as EmailRecord);
      }

      logger.info(
        `Batch created ${createdEmails?.length || 0} emails`,
        "EMAIL_REPOSITORY",
      );
      return createdEmails;
    });
  }

  /**
   * Find emails with attachments
   */
  async findWithAttachments(limit?: number): Promise<EmailRecord[]> {
    return executeQuery((db: DatabaseInstance) => {
      let query = `
        SELECT * FROM ${this.tableName}
        WHERE has_attachments = 1
        ORDER BY received_date_time DESC
      `;
      const params: unknown[] = [];

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as DatabaseRow[];
      return rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
    });
  }

  /**
   * Search emails by text across multiple fields
   */
  async searchByText(
    searchText: string,
    fields: string[],
    limit?: number,
  ): Promise<EmailRecord[]> {
    return executeQuery((db: DatabaseInstance) => {
      // Validate fields are actual columns
      const validFields = [
        "subject",
        "body_text",
        "from_address",
        "to_addresses",
      ];
      const searchFields = fields?.filter((f: string) => validFields.includes(f));

      if (searchFields?.length || 0 === 0) {
        return [];
      }

      const conditions = searchFields
        .map((field: string) => `${field} LIKE ?`)
        .join(" OR ");
      const searchPattern = `%${searchText}%`;
      const params: unknown[] = searchFields?.map(() => searchPattern);

      let query = `
        SELECT * FROM ${this.tableName}
        WHERE ${conditions}
        ORDER BY received_date_time DESC
      `;

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as DatabaseRow[];
      return rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<EmailRecord | null> {
    return executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(
        `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
      );
      const row = stmt.get(id) as DatabaseRow | undefined;
      return row ? this.mapRowToEntity(row) : null;
    });
  }

  /**
   * Find all entities with optional filtering
   */
  async findAll(filter?: Partial<EmailRecord>): Promise<EmailRecord[]> {
    return executeQuery((db: DatabaseInstance) => {
      let query = `SELECT * FROM ${this.tableName}`;
      const params: unknown[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter).map((key: string) => {
          const columnName = this.toSnakeCase(key);
          params.push(filter[key as keyof EmailRecord]);
          return `${columnName} = ?`;
        });
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += " ORDER BY received_date_time DESC";

      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
    });
  }

  /**
   * Create a new email record
   */
  async create(data: Omit<EmailRecord, "id">): Promise<EmailRecord> {
    return executeQuery((db: DatabaseInstance) => {
      const id = this.generateId();
      const now = new Date();
      const emailData: EmailRecord = {
        ...data,
        id,
        created_at: now,
        status: data.status || AnalysisStatus.PENDING,
      };

      const row = this.mapEntityToRow(emailData);
      const columns = Object.keys(row);
      const values = columns?.map((col: string) => row[col]);
      const placeholders = columns?.map(() => "?").join(", ");

      const query = `INSERT INTO ${this.tableName} (id, ${columns.join(", ")}, created_at) VALUES (?, ${placeholders}, datetime('now'))`;
      const stmt = db.prepare(query);
      stmt.run(id, ...values);

      logger.info("Email created", "EMAIL_REPOSITORY", { emailId: id });
      return emailData;
    });
  }

  /**
   * Update an email record
   */
  async update(
    id: string,
    data: Partial<EmailRecord>,
  ): Promise<EmailRecord | null> {
    return executeQuery(async (db: DatabaseInstance) => {
      const row = this.mapEntityToRow(data);
      const columns = Object.keys(row);

      if (columns?.length || 0 === 0) {
        return await this.findById(id);
      }

      const values = columns?.map((col: string) => row[col]);
      values.push(id);

      const setClause = columns?.map((col: string) => `${col} = ?`).join(", ");
      const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = datetime('now') WHERE ${this.primaryKey} = ?`;

      const stmt = db.prepare(query);
      const result = stmt.run(...values);

      if (result.changes === 0) {
        return null;
      }

      logger.info("Email updated", "EMAIL_REPOSITORY", { emailId: id });
      return await this.findById(id);
    });
  }

  /**
   * Delete an email record
   */
  async delete(id: string): Promise<boolean> {
    return executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(
        `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
      );
      const result = stmt.run(id);
      const deleted = result.changes > 0;

      if (deleted) {
        logger.info("Email deleted", "EMAIL_REPOSITORY", { emailId: id });
      }

      return deleted;
    });
  }

  /**
   * Count email records
   */
  async count(filter?: Partial<EmailRecord>): Promise<number> {
    return executeQuery((db: DatabaseInstance) => {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: unknown[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter).map((key: string) => {
          const columnName = this.toSnakeCase(key);
          params.push(filter[key as keyof EmailRecord]);
          return `${columnName} = ?`;
        });
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      const stmt = db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      return result.count;
    });
  }

  /**
   * Check if email exists
   */
  async exists(id: string): Promise<boolean> {
    return this.existsById(id);
  }

  /**
   * Check if email exists by ID
   */
  async existsById(id: string): Promise<boolean> {
    return executeQuery((db: DatabaseInstance) => {
      const stmt = db.prepare(
        `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = ?) as exists`,
      );
      const result = stmt.get(id) as { exists: number };
      return result.exists === 1;
    });
  }

  /**
   * Find emails with pagination
   */
  async findPaginated(options: PaginationOptions): Promise<PaginatedResult<EmailRecord>> {
    return executeQuery((db: DatabaseInstance) => {
      const { page, limit, orderBy, orderDirection, filter } = options;
      const offset = (page - 1) * limit;
      
      // Count total records
      let countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      const countParams: unknown[] = [];
      
      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter).map((key: string) => {
          const columnName = this.toSnakeCase(key);
          countParams.push(filter[key]);
          return `${columnName} = ?`;
        });
        countQuery += ` WHERE ${conditions.join(" AND ")}`;
      }
      
      const countStmt = db.prepare(countQuery);
      const { total } = countStmt.get(...countParams) as { total: number };
      
      // Get paginated data
      let dataQuery = `SELECT * FROM ${this.tableName}`;
      const dataParams: unknown[] = [];
      
      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter).map((key: string) => {
          const columnName = this.toSnakeCase(key);
          dataParams.push(filter[key]);
          return `${columnName} = ?`;
        });
        dataQuery += ` WHERE ${conditions.join(" AND ")}`;
      }
      
      const orderColumn = orderBy ? this.toSnakeCase(orderBy) : 'received_date_time';
      const direction = orderDirection || 'DESC';
      dataQuery += ` ORDER BY ${orderColumn} ${direction} LIMIT ? OFFSET ?`;
      dataParams.push(limit, offset);
      
      const dataStmt = db.prepare(dataQuery);
      const rows = dataStmt.all(...dataParams) as DatabaseRow[];
      const data = rows?.map((row: DatabaseRow) => this.mapRowToEntity(row));
      
      const totalPages = Math.ceil(total / limit);
      
      return {
        data,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      };
    });
  }
}
