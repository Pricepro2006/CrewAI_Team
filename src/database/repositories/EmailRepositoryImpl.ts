import { BaseRepository } from "./BaseRepository.js";
import { IEmailRepository } from "./interfaces/IEmailRepository.js";
import {
  EmailRecord,
  AnalysisStatus,
  EmailPriority,
  EmailFolder,
} from "../../types/EmailTypes.js";
import { executeQuery, executeTransaction } from "../ConnectionPool.js";
import { logger } from "../../utils/logger.js";
import Database from "better-sqlite3";

/**
 * Email repository implementation following the repository pattern
 */
export class EmailRepositoryImpl
  extends BaseRepository<EmailRecord>
  implements IEmailRepository
{
  constructor() {
    super(null as any, "emails"); // We'll use connection pool instead of direct db
    this.tableName = "emails";
    this.primaryKey = "id";
  }

  /**
   * Map database row to EmailRecord entity
   */
  protected mapRowToEntity(row: any): EmailRecord {
    return {
      id: row.id,
      message_id: row.message_id,
      subject: row.subject,
      body_text: row.body_text,
      body_html: row.body_html,
      from_address: row.from_address,
      to_addresses: row.to_addresses,
      cc_addresses: row.cc_addresses,
      bcc_addresses: row.bcc_addresses,
      received_time: new Date(row.received_time),
      sent_time: row.sent_time ? new Date(row.sent_time) : undefined,
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
  protected mapEntityToRow(entity: Partial<EmailRecord>): any {
    const row: any = {};

    if (entity.message_id !== undefined) row.message_id = entity.message_id;
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
      row.received_time = entity.received_time.toISOString();
    if (entity.sent_time !== undefined)
      row.sent_time = entity.sent_time?.toISOString();
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
      row.analyzed_at = entity.analyzed_at?.toISOString();
    if (entity.error_message !== undefined)
      row.error_message = entity.error_message;

    return row;
  }

  /**
   * Find emails by conversation ID
   */
  async findByConversationId(conversationId: string): Promise<EmailRecord[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName} 
        WHERE conversation_id = ? 
        ORDER BY received_time ASC
      `);
      const rows = stmt.all(conversationId);
      return rows.map((row) => this.mapRowToEntity(row));
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
    return executeQuery((db) => {
      let query = `SELECT * FROM ${this.tableName} WHERE status = ?`;
      const params: any[] = [status];

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);

        if (offset !== undefined) {
          query += " OFFSET ?";
          params.push(offset);
        }
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map((row) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find pending analysis emails
   */
  async findPendingAnalysis(
    limit: number,
    offset: number,
  ): Promise<EmailRecord[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE status IN (?, ?)
        ORDER BY received_time DESC
        LIMIT ? OFFSET ?
      `);
      const rows = stmt.all(
        AnalysisStatus.PENDING,
        AnalysisStatus.ANALYZING,
        limit,
        offset,
      );
      return rows.map((row) => this.mapRowToEntity(row));
    });
  }

  /**
   * Find email by message ID
   */
  async findByMessageId(messageId: string): Promise<EmailRecord | null> {
    return executeQuery((db) => {
      const stmt = db.prepare(
        `SELECT * FROM ${this.tableName} WHERE message_id = ?`,
      );
      const row = stmt.get(messageId);
      return row ? this.mapRowToEntity(row) : null;
    });
  }

  /**
   * Find emails by thread ID
   */
  async findByThreadId(threadId: string): Promise<EmailRecord[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName} 
        WHERE thread_id = ? 
        ORDER BY received_time ASC
      `);
      const rows = stmt.all(threadId);
      return rows.map((row) => this.mapRowToEntity(row));
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
    return executeQuery((db) => {
      let query = `
        SELECT * FROM ${this.tableName}
        WHERE received_time BETWEEN ? AND ?
        ORDER BY received_time DESC
      `;
      const params: any[] = [startDate.toISOString(), endDate.toISOString()];

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map((row) => this.mapRowToEntity(row));
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
    await executeQuery((db) => {
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
    await executeQuery((db) => {
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
    await executeQuery((db) => {
      let query = `
        UPDATE ${this.tableName}
        SET workflow_state = ?, updated_at = datetime('now')
      `;
      const params: any[] = [workflowState];

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
    await executeQuery((db) => {
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
    return executeQuery((db) => {
      // Total count
      const totalStmt = db.prepare(
        `SELECT COUNT(*) as count FROM ${this.tableName}`,
      );
      const total = (totalStmt.get() as any).count;

      // Status counts
      const statusStmt = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM ${this.tableName} 
        GROUP BY status
      `);
      const statusCounts = statusStmt.all() as any[];

      const pending =
        statusCounts.find((s) => s.status === AnalysisStatus.PENDING)?.count ||
        0;
      const analyzed =
        statusCounts.find((s) => s.status === AnalysisStatus.ANALYZED)?.count ||
        0;
      const failed =
        statusCounts.find((s) => s.status === AnalysisStatus.FAILED)?.count ||
        0;

      // Priority counts
      const priorityStmt = db.prepare(`
        SELECT priority, COUNT(*) as count 
        FROM ${this.tableName} 
        WHERE priority IS NOT NULL
        GROUP BY priority
      `);
      const priorityCounts = priorityStmt.all() as any[];

      const byPriority: Record<EmailPriority, number> = {
        [EmailPriority.CRITICAL]: 0,
        [EmailPriority.HIGH]: 0,
        [EmailPriority.MEDIUM]: 0,
        [EmailPriority.LOW]: 0,
        [EmailPriority.NONE]: 0,
      };

      priorityCounts.forEach((p) => {
        if (p.priority in byPriority) {
          byPriority[p.priority as EmailPriority] = p.count;
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
   * Batch create emails
   */
  async batchCreate(emails: Omit<EmailRecord, "id">[]): Promise<EmailRecord[]> {
    return executeTransaction((db) => {
      const insertStmt = db.prepare(`
        INSERT INTO ${this.tableName} (
          id, message_id, subject, body_text, body_html,
          from_address, to_addresses, cc_addresses, bcc_addresses,
          received_time, sent_time, conversation_id, thread_id,
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
          row.message_id,
          row.subject,
          row.body_text,
          row.body_html,
          row.from_address,
          row.to_addresses,
          row.cc_addresses,
          row.bcc_addresses,
          row.received_time,
          row.sent_time,
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
        `Batch created ${createdEmails.length} emails`,
        "EMAIL_REPOSITORY",
      );
      return createdEmails;
    });
  }

  /**
   * Find emails with attachments
   */
  async findWithAttachments(limit?: number): Promise<EmailRecord[]> {
    return executeQuery((db) => {
      let query = `
        SELECT * FROM ${this.tableName}
        WHERE has_attachments = 1
        ORDER BY received_time DESC
      `;
      const params: any[] = [];

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map((row) => this.mapRowToEntity(row));
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
    return executeQuery((db) => {
      // Validate fields are actual columns
      const validFields = [
        "subject",
        "body_text",
        "from_address",
        "to_addresses",
      ];
      const searchFields = fields.filter((f) => validFields.includes(f));

      if (searchFields.length === 0) {
        return [];
      }

      const conditions = searchFields
        .map((field) => `${field} LIKE ?`)
        .join(" OR ");
      const searchPattern = `%${searchText}%`;
      const params: any[] = searchFields.map(() => searchPattern);

      let query = `
        SELECT * FROM ${this.tableName}
        WHERE ${conditions}
        ORDER BY received_time DESC
      `;

      if (limit !== undefined) {
        query += " LIMIT ?";
        params.push(limit);
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map((row) => this.mapRowToEntity(row));
    });
  }

  /**
   * Override findById to use connection pool
   */
  async findById(id: string): Promise<EmailRecord | null> {
    return executeQuery((db) => {
      const stmt = db.prepare(
        `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
      );
      const row = stmt.get(id);
      return row ? this.mapRowToEntity(row) : null;
    });
  }

  /**
   * Override findAll to use connection pool
   */
  async findAll(filter?: Partial<EmailRecord>): Promise<EmailRecord[]> {
    return executeQuery((db) => {
      let query = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter).map((key) => {
          const columnName = this.toSnakeCase(key);
          params.push(filter[key as keyof EmailRecord]);
          return `${columnName} = ?`;
        });
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += " ORDER BY received_time DESC";

      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map((row) => this.mapRowToEntity(row));
    });
  }

  /**
   * Override create to use connection pool
   */
  async create(data: Omit<EmailRecord, "id">): Promise<EmailRecord> {
    return executeQuery((db) => {
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
      const values = columns.map((col) => row[col]);
      const placeholders = columns.map(() => "?").join(", ");

      const query = `INSERT INTO ${this.tableName} (id, ${columns.join(", ")}, created_at) VALUES (?, ${placeholders}, datetime('now'))`;
      const stmt = db.prepare(query);
      stmt.run(id, ...values);

      logger.info("Email created", "EMAIL_REPOSITORY", { emailId: id });
      return emailData;
    });
  }

  /**
   * Override update to use connection pool
   */
  async update(
    id: string,
    data: Partial<Omit<EmailRecord, "id" | "created_at">>,
  ): Promise<EmailRecord | null> {
    return executeQuery((db) => {
      const row = this.mapEntityToRow(data);
      const columns = Object.keys(row);

      if (columns.length === 0) {
        return this.findById(id);
      }

      const values = columns.map((col) => row[col]);
      values.push(id);

      const setClause = columns.map((col) => `${col} = ?`).join(", ");
      const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = datetime('now') WHERE ${this.primaryKey} = ?`;

      const stmt = db.prepare(query);
      const result = stmt.run(...values);

      if (result.changes === 0) {
        return null;
      }

      logger.info("Email updated", "EMAIL_REPOSITORY", { emailId: id });
      return this.findById(id);
    });
  }

  /**
   * Override delete to use connection pool
   */
  async delete(id: string): Promise<boolean> {
    return executeQuery((db) => {
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
   * Override count to use connection pool
   */
  async count(filter?: Partial<EmailRecord>): Promise<number> {
    return executeQuery((db) => {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter).map((key) => {
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
   * Override exists to use connection pool
   */
  async exists(id: string): Promise<boolean> {
    return executeQuery((db) => {
      const stmt = db.prepare(
        `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = ?) as exists`,
      );
      const result = stmt.get(id) as { exists: number };
      return result.exists === 1;
    });
  }
}
