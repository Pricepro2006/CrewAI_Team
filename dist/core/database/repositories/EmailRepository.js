import { BaseRepository } from '../../../database/repositories/BaseRepository';
import { logger } from '../../../utils/logger';
export class EmailRepository extends BaseRepository {
    constructor(useConnectionPool = false) {
        super('emails', 'id', useConnectionPool);
    }
    initializeTable() {
        this.createTable();
    }
    getTableSchema() {
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
    getIndexes() {
        return [
            'CREATE INDEX IF NOT EXISTS idx_emails_graph_id ON emails(graph_id)',
            'CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at)',
            'CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email)',
            'CREATE INDEX IF NOT EXISTS idx_emails_assignedTo ON emails(assignedTo)',
            'CREATE INDEX IF NOT EXISTS idx_emails_lastUpdated ON emails(lastUpdated)',
            'CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read)',
            'CREATE INDEX IF NOT EXISTS idx_emails_importance ON emails(importance)',
            'CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at)',
        ];
    }
    sanitizeColumnName(column) {
        const allowedColumns = [
            'id', 'subject', 'sender_email', 'sender_name', 'received_at',
            'is_read', 'has_attachments', 'importance', 'assignedTo',
            'lastUpdated', 'created_at', 'updated_at'
        ];
        return allowedColumns.includes(column) ? column : 'received_at';
    }
    // Custom search implementation
    buildWhereClause(options) {
        const conditions = [];
        const params = [];
        if (options.sender_email?.length) {
            const placeholders = options.sender_email.map(() => '?').join(',');
            conditions.push(`sender_email IN (${placeholders})`);
            params.push(...options.sender_email);
        }
        if (options.assignedTo?.length) {
            const placeholders = options.assignedTo.map(() => '?').join(',');
            conditions.push(`assignedTo IN (${placeholders})`);
            params.push(...options.assignedTo);
        }
        if (typeof options.is_read === 'boolean') {
            conditions.push('is_read = ?');
            params.push(options.is_read ? 1 : 0);
        }
        if (typeof options.has_attachments === 'boolean') {
            conditions.push('has_attachments = ?');
            params.push(options.has_attachments ? 1 : 0);
        }
        if (options.importance?.length) {
            const placeholders = options.importance.map(() => '?').join(',');
            conditions.push(`importance IN (${placeholders})`);
            params.push(...options.importance);
        }
        if (options.search) {
            conditions.push('(subject LIKE ? OR body_preview LIKE ? OR sender_name LIKE ?)');
            const searchParam = `%${options.search}%`;
            params.push(searchParam, searchParam, searchParam);
        }
        if (options.dateRange) {
            conditions.push('received_at BETWEEN ? AND ?');
            params.push(options.dateRange.start, options.dateRange.end);
        }
        const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        return { sql, params };
    }
    // Enhanced search method
    async searchEmails(options) {
        return this.findAll({
            page: options.page || 1,
            pageSize: options.pageSize || 50,
            sortBy: options.sortBy || 'received_at',
            sortOrder: options.sortOrder || 'desc',
            ...options
        });
    }
    // Find emails by assignee
    async findByAssignee(assignee) {
        const sql = `SELECT * FROM emails WHERE assignedTo = ? ORDER BY received_at DESC`;
        const stmt = this.db.prepare(sql);
        return stmt.all(assignee);
    }
    // Find unassigned emails
    async findUnassigned() {
        const sql = `SELECT * FROM emails WHERE assignedTo IS NULL OR assignedTo = '' ORDER BY received_at DESC`;
        const stmt = this.db.prepare(sql);
        return stmt.all();
    }
    // Get assignment workload distribution
    async getAssignmentWorkload() {
        const sql = `
      SELECT assignedTo, COUNT(*) as count
      FROM emails
      WHERE assignedTo IS NOT NULL AND assignedTo != ''
      GROUP BY assignedTo
    `;
        const stmt = this.db.prepare(sql);
        const results = stmt.all();
        const workload = {};
        results.forEach(row => {
            workload[row.assignedTo] = row.count;
        });
        return workload;
    }
    // Assign email to user
    async assignEmail(emailId, assignee) {
        await this.update(emailId, {
            assignedTo: assignee,
            lastUpdated: new Date().toISOString()
        });
        logger.info(`Email ${emailId} assigned to ${assignee}`, 'EMAIL_REPOSITORY');
    }
    // Unassign email
    async unassignEmail(emailId) {
        await this.update(emailId, {
            assignedTo: null,
            lastUpdated: new Date().toISOString()
        });
        logger.info(`Email ${emailId} unassigned`, 'EMAIL_REPOSITORY');
    }
    // Mark email as read/unread
    async markAsRead(emailId, isRead = true) {
        await this.update(emailId, {
            is_read: isRead,
            lastUpdated: new Date().toISOString()
        });
        logger.debug(`Email ${emailId} marked as ${isRead ? 'read' : 'unread'}`, 'EMAIL_REPOSITORY');
    }
    // Bulk assign emails
    async bulkAssign(emailIds, assignee) {
        const updates = emailIds.map(id => ({
            id,
            data: {
                assignedTo: assignee,
                lastUpdated: new Date().toISOString()
            }
        }));
        await this.batchUpdate(updates);
        logger.info(`Bulk assigned ${emailIds.length} emails to ${assignee}`, 'EMAIL_REPOSITORY');
    }
    // Get email statistics
    async getEmailStats() {
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
        const stats = this.db.prepare(statsQuery).get();
        const importanceResults = this.db.prepare(importanceQuery).all();
        const byImportance = {};
        importanceResults.forEach(row => {
            byImportance[row.importance] = row.count;
        });
        return {
            totalEmails: stats.total,
            unreadEmails: stats.unread,
            assignedEmails: stats.assigned,
            unassignedEmails: stats.unassigned,
            withAttachments: stats.with_attachments,
            byImportance
        };
    }
    // Find emails by graph ID
    async findByGraphId(graphId) {
        const sql = `SELECT * FROM emails WHERE graph_id = ?`;
        const stmt = this.db.prepare(sql);
        const result = stmt.get(graphId);
        return result || null;
    }
    // Find recent emails
    async findRecent(limit = 10) {
        const sql = `SELECT * FROM emails ORDER BY received_at DESC LIMIT ?`;
        const stmt = this.db.prepare(sql);
        return stmt.all(limit);
    }
    // Find emails in date range
    async findInDateRange(startDate, endDate) {
        const sql = `
      SELECT * FROM emails 
      WHERE received_at BETWEEN ? AND ? 
      ORDER BY received_at DESC
    `;
        const stmt = this.db.prepare(sql);
        return stmt.all(startDate, endDate);
    }
    // Create email with proper validation
    async createEmail(emailData) {
        // Validate required fields
        if (!emailData.subject || !emailData.sender_email || !emailData.received_at) {
            throw new Error('Missing required fields: subject, sender_email, or received_at');
        }
        // Convert boolean values to integers for SQLite
        const processedData = {
            ...emailData,
            is_read: emailData.is_read ? 1 : 0,
            has_attachments: emailData.has_attachments ? 1 : 0,
        };
        return this.create(processedData);
    }
    // Upsert email (insert or update based on graph_id)
    async upsertEmail(emailData) {
        if (emailData.graph_id) {
            const existing = await this.findByGraphId(emailData.graph_id);
            if (existing) {
                await this.update(existing.id, emailData);
                return existing.id;
            }
        }
        return this.createEmail(emailData);
    }
}
//# sourceMappingURL=EmailRepository.js.map