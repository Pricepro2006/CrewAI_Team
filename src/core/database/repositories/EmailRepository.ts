import type Database from "better-sqlite3";
import {
  BaseRepository,
  type BaseEntity,
  type QueryOptions,
  type PaginatedResult,
} from "../../../database/repositories/BaseRepository.js";
import { logger } from "../../../utils/logger.js";

export interface EmailEntity extends BaseEntity {
  graph_id?: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  to_addresses?: string; // JSON string
  received_at: string;
  is_read: boolean;
  has_attachments: boolean;
  body_preview?: string;
  body?: string;
  importance?: string;
  categories?: string; // JSON string
  raw_content?: string; // JSON string
  assignedTo?: string;
  lastUpdated?: string;
}

export interface EmailSearchFilters {
  sender_email?: string[];
  assignedTo?: string[];
  is_read?: boolean;
  has_attachments?: boolean;
  importance?: string[];
  dateRange?: { start: string; end: string };
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class EmailRepository extends BaseRepository<EmailEntity> {
  constructor(db: Database.Database) {
    super(db, "emails");
    this.initializeTable();
  }

  private initializeTable(): void {
    this?.db?.exec(this.getTableSchema());
  }

  protected getTableSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        graph_id TEXT UNIQUE,
        subject TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        sender_name TEXT,
        to_addresses TEXT,
        received_at TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        has_attachments INTEGER NOT NULL DEFAULT 0,
        body_preview TEXT,
        body TEXT,
        importance TEXT,
        categories TEXT,
        raw_content TEXT,
        assignedTo TEXT,
        lastUpdated TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
  }

  protected getIndexes(): string[] {
    return [
      "CREATE INDEX IF NOT EXISTS idx_emails_graph_id ON emails(graph_id)",
      "CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at)",
      "CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email)",
      "CREATE INDEX IF NOT EXISTS idx_emails_assignedTo ON emails(assignedTo)",
      "CREATE INDEX IF NOT EXISTS idx_emails_lastUpdated ON emails(lastUpdated)",
      "CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read)",
      "CREATE INDEX IF NOT EXISTS idx_emails_importance ON emails(importance)",
      "CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at)",
    ];
  }

  protected override sanitizeColumnName(column: string): string {
    const allowedColumns = [
      "id",
      "subject",
      "sender_email",
      "sender_name",
      "received_at",
      "is_read",
      "has_attachments",
      "importance",
      "assignedTo",
      "lastUpdated",
      "created_at",
      "updated_at",
    ];
    return allowedColumns.includes(column) ? column : "received_at";
  }

  // Custom search implementation
  protected override buildWhereClause(conditions: Record<string, any>): {
    clause: string;
    params: any[];
  } {
    // Handle EmailSearchFilters if passed
    const options = conditions as EmailSearchFilters;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (options.sender_email?.length) {
      const placeholders = options?.sender_email?.map(() => "?").join(",");
      whereClauses.push(`sender_email IN (${placeholders})`);
      params.push(...options.sender_email);
    }

    if (options.assignedTo?.length) {
      const placeholders = options?.assignedTo?.map(() => "?").join(",");
      whereClauses.push(`assignedTo IN (${placeholders})`);
      params.push(...options.assignedTo);
    }

    if (typeof options.is_read === "boolean") {
      whereClauses.push("is_read = ?");
      params.push(options.is_read ? 1 : 0);
    }

    if (typeof options.has_attachments === "boolean") {
      whereClauses.push("has_attachments = ?");
      params.push(options.has_attachments ? 1 : 0);
    }

    if (options.importance?.length) {
      const placeholders = options?.importance?.map(() => "?").join(",");
      whereClauses.push(`importance IN (${placeholders})`);
      params.push(...options.importance);
    }

    if (options.search) {
      whereClauses.push(
        "(subject LIKE ? OR body_preview LIKE ? OR sender_name LIKE ?)",
      );
      const searchParam = `%${options.search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (options.dateRange) {
      whereClauses.push("received_at BETWEEN ? AND ?");
      params.push(options?.dateRange?.start, options?.dateRange?.end);
    }

    const clause =
      whereClauses?.length || 0 > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    return { clause, params };
  }

  // Enhanced search method
  async searchEmails(
    options: EmailSearchFilters & {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    },
  ): Promise<{
    data: EmailEntity[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.findPaginated(options.page || 1, options.pageSize || 50, {
      orderBy: options.sortBy || "received_at",
      orderDirection:
        (options.sortOrder?.toUpperCase() as "ASC" | "DESC") || "DESC",
      where: options,
    });
  }

  // Find emails by assignee
  async findByAssignee(assignee: string): Promise<EmailEntity[]> {
    const sql = `SELECT * FROM emails WHERE assignedTo = ? ORDER BY received_at DESC`;
    const stmt = this?.db?.prepare(sql);
    return stmt.all(assignee) as EmailEntity[];
  }

  // Find unassigned emails
  async findUnassigned(): Promise<EmailEntity[]> {
    const sql = `SELECT * FROM emails WHERE assignedTo IS NULL OR assignedTo = '' ORDER BY received_at DESC`;
    const stmt = this?.db?.prepare(sql);
    return stmt.all() as EmailEntity[];
  }

  // Get assignment workload distribution
  async getAssignmentWorkload(): Promise<Record<string, number>> {
    const sql = `
      SELECT assignedTo, COUNT(*) as count
      FROM emails
      WHERE assignedTo IS NOT NULL AND assignedTo != ''
      GROUP BY assignedTo
    `;
    const stmt = this?.db?.prepare(sql);
    const results = stmt.all() as Array<{ assignedTo: string; count: number }>;

    const workload: Record<string, number> = {};
    results.forEach((row: any) => {
      workload[row.assignedTo] = row.count;
    });

    return workload;
  }

  // Assign email to user
  async assignEmail(emailId: string, assignee: string): Promise<void> {
    await this.update(emailId, {
      assignedTo: assignee,
      lastUpdated: new Date().toISOString(),
    } as Partial<EmailEntity>);

    logger.info(`Email ${emailId} assigned to ${assignee}`, "EMAIL_REPOSITORY");
  }

  // Unassign email
  async unassignEmail(emailId: string): Promise<void> {
    await this.update(emailId, {
      assignedTo: undefined,
      lastUpdated: new Date().toISOString(),
    } as Partial<EmailEntity>);

    logger.info(`Email ${emailId} unassigned`, "EMAIL_REPOSITORY");
  }

  // Mark email as read/unread
  async markAsRead(emailId: string, isRead: boolean = true): Promise<void> {
    await this.update(emailId, {
      is_read: isRead,
      lastUpdated: new Date().toISOString(),
    } as Partial<EmailEntity>);

    logger.debug(
      `Email ${emailId} marked as ${isRead ? "read" : "unread"}`,
      "EMAIL_REPOSITORY",
    );
  }

  // Bulk assign emails
  async bulkAssign(emailIds: string[], assignee: string): Promise<void> {
    // Perform bulk updates
    const updatePromises = emailIds?.map((emailId: any) =>
      this.update(emailId, {
        assignedTo: assignee,
        lastUpdated: new Date().toISOString(),
      } as Partial<EmailEntity>),
    );

    await Promise.all(updatePromises);
    logger.info(
      `Bulk assigned ${emailIds?.length || 0} emails to ${assignee}`,
      "EMAIL_REPOSITORY",
    );
  }

  // Get email statistics
  async getEmailStats(): Promise<{
    totalEmails: number;
    unreadEmails: number;
    assignedEmails: number;
    unassignedEmails: number;
    withAttachments: number;
    byImportance: Record<string, number>;
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN assignedTo IS NOT NULL AND assignedTo != '' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN assignedTo IS NULL OR assignedTo = '' THEN 1 ELSE 0 END) as unassigned,
        SUM(CASE WHEN has_attachments = 1 THEN 1 ELSE 0 END) as with_attachments
      FROM emails
    `;

    const importanceQuery = `
      SELECT 
        COALESCE(importance, 'Normal') as importance,
        COUNT(*) as count
      FROM emails
      GROUP BY importance
    `;

    const stats = this?.db?.prepare(statsQuery).get() as any;
    const importanceResults = this?.db?.prepare(importanceQuery).all() as Array<{
      importance: string;
      count: number;
    }>;

    const byImportance: Record<string, number> = {};
    importanceResults.forEach((row: any) => {
      byImportance[row.importance] = row.count;
    });

    return {
      totalEmails: stats.total,
      unreadEmails: stats.unread,
      assignedEmails: stats.assigned,
      unassignedEmails: stats.unassigned,
      withAttachments: stats.with_attachments,
      byImportance,
    };
  }

  // Find emails by graph ID
  async findByGraphId(graphId: string): Promise<EmailEntity | null> {
    const sql = `SELECT * FROM emails WHERE graph_id = ?`;
    const stmt = this?.db?.prepare(sql);
    const result = stmt.get(graphId) as EmailEntity;
    return result || null;
  }

  // Find recent emails
  async findRecent(limit: number = 10): Promise<EmailEntity[]> {
    const sql = `SELECT * FROM emails ORDER BY received_at DESC LIMIT ?`;
    const stmt = this?.db?.prepare(sql);
    return stmt.all(limit) as EmailEntity[];
  }

  // Find emails in date range
  async findInDateRange(
    startDate: string,
    endDate: string,
  ): Promise<EmailEntity[]> {
    const sql = `
      SELECT * FROM emails 
      WHERE received_at BETWEEN ? AND ? 
      ORDER BY received_at DESC
    `;
    const stmt = this?.db?.prepare(sql);
    return stmt.all(startDate, endDate) as EmailEntity[];
  }

  // Create email with proper validation
  async createEmail(
    emailData: Omit<EmailEntity, "id" | "created_at" | "updated_at">,
  ): Promise<string> {
    // Validate required fields
    if (
      !emailData.subject ||
      !emailData.sender_email ||
      !emailData.received_at
    ) {
      throw new Error(
        "Missing required fields: subject, sender_email, or received_at",
      );
    }

    // Convert boolean values to integers for SQLite compatibility
    const processedData: Omit<EmailEntity, "id" | "created_at" | "updated_at"> =
      {
        ...emailData,
        is_read: emailData.is_read,
        has_attachments: emailData.has_attachments,
      };

    const createdEmail = await this.create(processedData);
    return createdEmail.id;
  }

  // Upsert email (insert or update based on graph_id)
  async upsertEmail(
    emailData: Omit<EmailEntity, "id" | "created_at" | "updated_at">,
  ): Promise<string> {
    if (emailData.graph_id) {
      const existing = await this.findByGraphId(emailData.graph_id);
      if (existing) {
        await this.update(existing.id, emailData as Partial<EmailEntity>);
        return existing.id;
      }
    }

    return this.createEmail(emailData);
  }
}
