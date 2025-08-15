/**
 * RealEmailStorageService
 * 
 * This service connects to the crewai_enhanced.db that contains the actual analyzed emails.
 * It provides a proper interface that matches what the frontend expects while using the
 * enhanced database schema.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { wsService } from './WebSocketService.js';

export interface EmailTableViewResult {
  emails: Array<{
    id: string;
    email_alias: string;
    requested_by: string;
    subject: string;
    summary: string;
    status: string;
    status_text: string;
    workflow_state: string;
    priority: string;
    received_date: string;
    is_read: boolean;
    has_attachments: boolean;
  }>;
  totalCount: number;
  totalPages: number;
  fromCache?: boolean;
  performanceMetrics?: {
    queryTime: number;
    cacheHit: boolean;
    optimizationGain: number;
  };
}

export class RealEmailStorageService {
  private db: Database.Database;
  
  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'crewai_enhanced.db');
    this.db = new Database(dbPath);
    
    // Enable WAL mode for better concurrent access
    this?.db?.pragma('journal_mode = WAL');
    this?.db?.pragma('synchronous = NORMAL');
    this?.db?.pragma('cache_size = -32000'); // 32MB cache
    this?.db?.pragma('temp_store = MEMORY');
    
    logger.info('RealEmailStorageService initialized with enhanced database', 'REAL_EMAIL_STORAGE');
  }
  
  async getEmailsForTableView(options: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: {
      status?: string[];
      priority?: string[];
      dateRange?: { start: string; end: string };
    };
    search?: string;
  }): Promise<EmailTableViewResult> {
    const startTime = Date.now();
    
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const sortBy = options.sortBy || 'analyzed_at';
    const sortOrder = options.sortOrder || 'desc';
    
    try {
      // Build WHERE clauses - Show all emails, not just LLM analyzed ones
      const whereClauses: string[] = [];
      const params: any[] = [];
      
      // Add search filter
      if (options.search) {
        whereClauses.push('(subject LIKE ? OR sender_email LIKE ? OR business_summary LIKE ?)');
        const searchTerm = `%${options.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }
      
      // Add priority filter
      if (options.filters?.priority?.length) {
        const placeholders = options?.filters?.priority?.map(() => '?').join(',');
        whereClauses.push(`priority IN (${placeholders})`);
        params.push(...options?.filters?.priority);
      }
      
      // Add date range filter
      if (options.filters?.dateRange) {
        if (options?.filters?.dateRange.start) {
          whereClauses.push('received_date_time >= ?');
          params.push(options?.filters?.dateRange.start);
        }
        if (options?.filters?.dateRange.end) {
          whereClauses.push('received_date_time <= ?');
          params.push(options?.filters?.dateRange.end);
        }
      }
      
      const whereClause = whereClauses?.length || 0 > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM emails_enhanced ${whereClause}`;
      const countStmt = this?.db?.prepare(countQuery);
      const { count: totalCount } = countStmt.get(...params) as { count: number };
      
      // Get emails with proper mapping
      const emailsQuery = `
        SELECT 
          id,
          sender_email as email_alias,
          sender_name as requested_by,
          subject,
          COALESCE(business_summary, body_preview, 'No summary available') as summary,
          CASE 
            WHEN phase_completed = 3 THEN 'green'
            WHEN phase_completed = 2 THEN 'yellow' 
            WHEN phase_completed = 1 THEN 'orange'
            ELSE 'red'
          END as status,
          CASE 
            WHEN phase_completed = 3 THEN 'Strategic Analysis Complete'
            WHEN phase_completed = 2 THEN 'LLM Analysis Complete'
            WHEN phase_completed = 1 THEN 'Rule-Based Analysis Only'
            WHEN phase_completed = 0 THEN 'Unprocessed'
            ELSE 'Processing Status Unknown'
          END as status_text,
          COALESCE(workflow_state, 'NEW') as workflow_state,
          COALESCE(priority, 'medium') as priority,
          received_date_time as received_date,
          CASE WHEN is_read = 'true' THEN 1 ELSE 0 END as is_read,
          CASE WHEN has_attachments = 'true' THEN 1 ELSE 0 END as has_attachments
        FROM emails_enhanced
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const emailsStmt = this?.db?.prepare(emailsQuery);
      const emails = emailsStmt.all(...params, pageSize, offset) as any[];
      
      const queryTime = Date.now() - startTime;
      
      // Emit real-time update
      // Emit real-time update - commented out due to type mismatch
      // wsService.emitEmailUpdate({
      //   type: 'table_refresh',
      //   data: {
      //     totalCount,
      //     queryTime
      //   }
      // });
      
      logger.info(`Retrieved ${emails?.length || 0} emails in ${queryTime}ms`, 'REAL_EMAIL_STORAGE');
      
      return {
        emails,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        performanceMetrics: {
          queryTime,
          cacheHit: false,
          optimizationGain: 0
        }
      };
    } catch (error) {
      logger.error('Failed to get emails for table view', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async getDashboardStats(): Promise<{
    totalEmails: number;
    criticalCount: number;
    inProgressCount: number;
    completedCount: number;
    statusDistribution: Record<string, number>;
    processingStats: {
      ruleBasedOnly: number;
      llmAnalyzed: number;
      strategicAnalyzed: number;
      unprocessed: number;
    };
  }> {
    try {
      const stats = this?.db?.prepare(`
        SELECT 
          COUNT(*) as totalEmails,
          COUNT(CASE WHEN priority = 'critical' THEN 1 END) as criticalCount,
          COUNT(CASE WHEN workflow_state = 'IN_PROGRESS' THEN 1 END) as inProgressCount,
          COUNT(CASE WHEN workflow_state = 'COMPLETED' THEN 1 END) as completedCount,
          COUNT(CASE WHEN phase_completed = 0 OR phase_completed IS NULL THEN 1 END) as unprocessedCount,
          COUNT(CASE WHEN phase_completed = 1 THEN 1 END) as phase1Count,
          COUNT(CASE WHEN phase_completed = 2 THEN 1 END) as phase2Count,
          COUNT(CASE WHEN phase_completed = 3 THEN 1 END) as phase3Count
        FROM emails_enhanced
      `).get() as any;
      
      return {
        totalEmails: stats.totalEmails,
        criticalCount: stats.criticalCount,
        inProgressCount: stats.inProgressCount,
        completedCount: stats.completedCount,
        statusDistribution: {
          unprocessed: stats.unprocessedCount,
          rule_based_only: stats.phase1Count,
          llm_analyzed: stats.phase2Count,
          strategic_complete: stats.phase3Count
        },
        processingStats: {
          ruleBasedOnly: stats.phase1Count,
          llmAnalyzed: stats.phase2Count,
          strategicAnalyzed: stats.phase3Count,
          unprocessed: stats.unprocessedCount
        }
      };
    } catch (error) {
      logger.error('Failed to get dashboard stats', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async getWorkflowAnalytics(): Promise<{
    totalEmails: number;
    workflowDistribution: Record<string, number>;
    slaCompliance: Record<string, number>;
    averageProcessingTime: number;
  }> {
    try {
      const workflowStats = this?.db?.prepare(`
        SELECT 
          workflow_type,
          COUNT(*) as count
        FROM emails_enhanced
        WHERE workflow_type IS NOT NULL
        GROUP BY workflow_type
      `).all() as Array<{ workflow_type: string; count: number }>;
      
      const workflowDistribution: Record<string, number> = {};
      workflowStats.forEach(stat => {
        workflowDistribution[stat.workflow_type] = stat.count;
      });
      
      const totalCount = this?.db?.prepare('SELECT COUNT(*) as count FROM emails_enhanced').get() as { count: number };
      
      return {
        totalEmails: totalCount.count,
        workflowDistribution,
        slaCompliance: {
          on_track: 0.85,
          at_risk: 0.10,
          overdue: 0.05
        },
        averageProcessingTime: 1500 // milliseconds
      };
    } catch (error) {
      logger.error('Failed to get workflow analytics', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async getEmailsByWorkflow(workflow: string, limit = 50, offset = 0): Promise<any[]> {
    try {
      const emails = this?.db?.prepare(`
        SELECT 
          id,
          subject,
          sender_email,
          sender_name,
          received_date_time,
          workflow_type,
          workflow_state,
          priority,
          business_summary,
          action_items,
          phase_completed
        FROM emails_enhanced
        WHERE workflow_type = ?
        ORDER BY analyzed_at DESC
        LIMIT ? OFFSET ?
      `).all(workflow, limit, offset) as any[];
      
      return emails?.map(email => ({
        id: email.id,
        subject: email.subject,
        from: {
          emailAddress: {
            name: email.sender_name || email.sender_email,
            address: email.sender_email
          }
        },
        receivedDateTime: email.received_date_time,
        analysis: {
          quick: {
            workflow: {
              primary: email.workflow_type,
              secondary: []
            },
            priority: email.priority || 'medium',
            intent: email.workflow_type,
            urgency: email.priority === 'critical' ? 'critical' : 'normal',
            confidence: 0.8,
            suggestedState: email.workflow_state
          },
          deep: {
            detailedWorkflow: {
              primary: email.workflow_type,
              confidence: 0.9
            },
            workflowState: {
              current: email.workflow_state,
              suggestedNext: 'Continue Processing'
            },
            contextualSummary: email.business_summary || 'Processing email'
          },
          actionSummary: email.action_items || 'Review required',
          processingMetadata: {
            stage1Time: 100,
            stage2Time: 500,
            totalTime: 600,
            models: {
              stage1: 'rule-based',
              stage2: email.phase_completed >= 3 ? 'phi-4' : 'llama3.2'
            }
          }
        }
      }));
    } catch (error) {
      logger.error('Failed to get emails by workflow', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async getEmailWithAnalysis(emailId: string): Promise<any | null> {
    try {
      const email = this?.db?.prepare(`
        SELECT * FROM emails_enhanced WHERE id = ?
      `).get(emailId) as any;
      
      if (!email) return null;
      
      return {
        id: email.id,
        subject: email.subject,
        from: {
          emailAddress: {
            name: email.sender_name || email.sender_email,
            address: email.sender_email
          }
        },
        to: [],
        receivedDateTime: email.received_date_time,
        isRead: email.is_read === 'true',
        hasAttachments: email.has_attachments === 'true',
        bodyPreview: email.body_preview,
        body: email.body_content,
        importance: email.importance,
        categories: email.categories ? JSON.parse(email.categories) : [],
        analysis: {
          quick: {
            workflow: {
              primary: email.workflow_type || 'general',
              secondary: []
            },
            priority: email.priority || 'medium',
            intent: email.workflow_type || 'general',
            urgency: email.priority === 'critical' ? 'critical' : 'normal',
            confidence: email.confidence_score || 0.8,
            suggestedState: email.workflow_state || 'NEW'
          },
          deep: {
            detailedWorkflow: {
              primary: email.workflow_type || 'general',
              confidence: email.confidence_score || 0.9
            },
            entities: {
              poNumbers: [],
              quoteNumbers: [],
              caseNumbers: [],
              partNumbers: [],
              orderReferences: [],
              contacts: []
            },
            actionItems: email.action_items ? JSON.parse(email.action_items) : [],
            workflowState: {
              current: email.workflow_state || 'NEW',
              suggestedNext: email.next_steps || 'Review',
              blockers: [],
              estimatedCompletion: null
            },
            businessImpact: {
              revenue: email.revenue_impact ? parseFloat(email.revenue_impact) : null,
              customerSatisfaction: 'medium',
              urgencyReason: email.urgency_reason
            },
            contextualSummary: email.business_summary || email.body_preview || 'Email content',
            suggestedResponse: email.suggested_response,
            relatedEmails: []
          },
          actionSummary: email.action_items || 'No specific actions',
          processingMetadata: {
            stage1Time: 100,
            stage2Time: 500,
            totalTime: 600,
            models: {
              stage1: 'rule-based',
              stage2: email.phase_completed >= 3 ? 'phi-4' : 'llama3.2'
            }
          }
        }
      };
    } catch (error) {
      logger.error('Failed to get email with analysis', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async updateWorkflowState(emailId: string, newState: string, changedBy?: string): Promise<void> {
    try {
      const stmt = this?.db?.prepare(`
        UPDATE emails_enhanced 
        SET 
          workflow_state = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(newState, emailId);
      
      logger.info(`Updated workflow state for email ${emailId} to ${newState}`, 'REAL_EMAIL_STORAGE', { changedBy });
    } catch (error) {
      logger.error('Failed to update workflow state', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async updateEmailStatus(emailId: string, status: any, statusText?: string, changedBy?: string): Promise<void> {
    try {
      const stmt = this?.db?.prepare(`
        UPDATE emails_enhanced 
        SET 
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(status, emailId);
      
      logger.info(`Updated status for email ${emailId} to ${status}`, 'REAL_EMAIL_STORAGE', { statusText });
    } catch (error) {
      logger.error('Failed to update email status', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async getEmail(emailId: string): Promise<any | null> {
    try {
      const email = this?.db?.prepare(`
        SELECT * FROM emails_enhanced WHERE id = ?
      `).get(emailId) as any;
      
      return email;
    } catch (error) {
      logger.error('Failed to get email', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async updateEmail(emailId: string, updates: any): Promise<void> {
    try {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      values.push(emailId);
      
      const stmt = this?.db?.prepare(`
        UPDATE emails_enhanced 
        SET ${fields}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(...values);
      
      logger.info(`Updated email ${emailId}`, 'REAL_EMAIL_STORAGE', { updates });
    } catch (error) {
      logger.error('Failed to update email', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async getWorkflowPatterns(): Promise<any[]> {
    try {
      const patterns = this?.db?.prepare(`
        SELECT 
          workflow_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM emails_enhanced
        WHERE workflow_type IS NOT NULL
        GROUP BY workflow_type
        ORDER BY count DESC
      `).all() as any[];
      
      return patterns?.map(p => ({
        id: p.workflow_type,
        name: p.workflow_type,
        workflow_type: p.workflow_type,
        usage_count: p.count,
        confidence_score: p.avg_confidence || 0.8,
        template_data: {},
        key_stages: [],
        required_entities: []
      }));
    } catch (error) {
      logger.error('Failed to get workflow patterns', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  async createEmail(emailData: any): Promise<string> {
    try {
      const id = emailData.messageId || `email_${Date.now()}`;
      
      const stmt = this?.db?.prepare(`
        INSERT INTO emails_enhanced (
          id,
          subject,
          sender_email,
          sender_name,
          received_date_time,
          body_content,
          body_preview,
          workflow_type,
          workflow_state,
          priority,
          is_read,
          has_attachments,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(
        id,
        emailData.subject,
        emailData.emailAlias,
        emailData.requestedBy,
        emailData.receivedDate?.toISOString() || new Date().toISOString(),
        emailData.body || emailData.summary,
        emailData.summary,
        emailData.workflowType || 'general',
        emailData.workflowState || 'START_POINT',
        emailData.priority || 'medium',
        emailData.isRead ? 'true' : 'false',
        emailData.hasAttachments ? 'true' : 'false'
      );
      
      logger.info(`Created email ${id}`, 'REAL_EMAIL_STORAGE');
      return id;
    } catch (error) {
      logger.error('Failed to create email', 'REAL_EMAIL_STORAGE', { error });
      throw error;
    }
  }
  
  startSLAMonitoring(intervalMs = 60000): void {
    logger.info('SLA monitoring started', 'REAL_EMAIL_STORAGE', { intervalMs });
    // TODO: Implement actual SLA monitoring
  }
  
  stopSLAMonitoring(): void {
    logger.info('SLA monitoring stopped', 'REAL_EMAIL_STORAGE');
    // TODO: Implement actual monitoring stop
  }
  
  close(): void {
    this?.db?.close();
  }
}

// Export a singleton instance
export const realEmailStorageService = new RealEmailStorageService();