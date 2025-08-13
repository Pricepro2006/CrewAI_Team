import { IPaginatedRepository } from "./IRepository.js";
import {
  EmailRecord,
  AnalysisStatus,
  EmailPriority,
} from "../../../types/EmailTypes.js";

/**
 * Email repository interface
 */
export interface IEmailRepository
  extends IPaginatedRepository<EmailRecord, string> {
  /**
   * Find emails by conversation ID
   */
  findByConversationId(conversationId: string): Promise<EmailRecord[]>;

  /**
   * Find emails by status
   */
  findByStatus(
    status: AnalysisStatus,
    limit?: number,
    offset?: number,
  ): Promise<EmailRecord[]>;

  /**
   * Find pending analysis emails
   */
  findPendingAnalysis(limit: number, offset: number): Promise<EmailRecord[]>;

  /**
   * Find emails by message ID
   */
  findByMessageId(messageId: string): Promise<EmailRecord | null>;

  /**
   * Find emails by thread ID
   */
  findByThreadId(threadId: string): Promise<EmailRecord[]>;

  /**
   * Find emails within a date range
   */
  findByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number,
  ): Promise<EmailRecord[]>;

  /**
   * Update email analysis status
   */
  updateAnalysisStatus(
    id: string,
    status: AnalysisStatus,
    error?: string,
  ): Promise<void>;

  /**
   * Update email priority
   */
  updatePriority(id: string, priority: EmailPriority): Promise<void>;

  /**
   * Update workflow state
   */
  updateWorkflowState(
    id: string,
    workflowState: string,
    confidence?: number,
  ): Promise<void>;

  /**
   * Mark email as analyzed
   */
  markAsAnalyzed(id: string, analyzedAt: Date): Promise<void>;

  /**
   * Get email statistics
   */
  getStatistics(): Promise<{
    total: number;
    pending: number;
    analyzed: number;
    failed: number;
    byPriority: Record<EmailPriority, number>;
  }>;

  /**
   * Batch create emails
   */
  batchCreate(emails: Omit<EmailRecord, "id">[]): Promise<EmailRecord[]>;

  /**
   * Find emails with attachments
   */
  findWithAttachments(limit?: number): Promise<EmailRecord[]>;

  /**
   * Search emails by text
   */
  searchByText(
    searchText: string,
    fields: string[],
    limit?: number,
  ): Promise<EmailRecord[]>;
}
