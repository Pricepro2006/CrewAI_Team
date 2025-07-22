import { BaseRepository } from '../../../database/repositories/BaseRepository';
export interface EmailEntity {
    id: string;
    graph_id?: string;
    subject: string;
    sender_email: string;
    sender_name?: string;
    to_addresses?: string;
    received_at: string;
    is_read: boolean;
    has_attachments: boolean;
    body_preview?: string;
    body?: string;
    importance?: string;
    categories?: string;
    raw_content?: string;
    assignedTo?: string;
    lastUpdated?: string;
    created_at: string;
    updated_at: string;
}
export interface EmailSearchFilters {
    sender_email?: string[];
    assignedTo?: string[];
    is_read?: boolean;
    has_attachments?: boolean;
    importance?: string[];
    dateRange?: {
        start: string;
        end: string;
    };
    search?: string;
}
export declare class EmailRepository extends BaseRepository<EmailEntity> {
    constructor(useConnectionPool?: boolean);
    protected initializeTable(): void;
    protected getTableSchema(): string;
    protected getIndexes(): string[];
    protected sanitizeColumnName(column: string): string;
    protected buildWhereClause(options: EmailSearchFilters): {
        sql: string;
        params: any[];
    };
    searchEmails(options: EmailSearchFilters & {
        page?: number;
        pageSize?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{
        data: EmailEntity[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;
    findByAssignee(assignee: string): Promise<EmailEntity[]>;
    findUnassigned(): Promise<EmailEntity[]>;
    getAssignmentWorkload(): Promise<Record<string, number>>;
    assignEmail(emailId: string, assignee: string): Promise<void>;
    unassignEmail(emailId: string): Promise<void>;
    markAsRead(emailId: string, isRead?: boolean): Promise<void>;
    bulkAssign(emailIds: string[], assignee: string): Promise<void>;
    getEmailStats(): Promise<{
        totalEmails: number;
        unreadEmails: number;
        assignedEmails: number;
        unassignedEmails: number;
        withAttachments: number;
        byImportance: Record<string, number>;
    }>;
    findByGraphId(graphId: string): Promise<EmailEntity | null>;
    findRecent(limit?: number): Promise<EmailEntity[]>;
    findInDateRange(startDate: string, endDate: string): Promise<EmailEntity[]>;
    createEmail(emailData: Omit<EmailEntity, 'id' | 'created_at' | 'updated_at'>): Promise<string>;
    upsertEmail(emailData: Omit<EmailEntity, 'id' | 'created_at' | 'updated_at'>): Promise<string>;
}
//# sourceMappingURL=EmailRepository.d.ts.map