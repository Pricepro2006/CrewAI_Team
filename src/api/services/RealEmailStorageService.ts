/**
 * Real Email Storage Service
 * Connects to the actual enhanced database for email data
 */

import Database from "better-sqlite3";
import path from "path";
import { Logger } from "../../utils/logger.js";
import type {
  EmailStorageServiceInterface,
  GetEmailsResult,
  GetDashboardStatsResult,
  GetAnalyticsResult,
  EmailTableFilters,
} from "./EmailStorageService.js";

const logger = new Logger("RealEmailStorageService");

const ENHANCED_DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");

export class RealEmailStorageService implements EmailStorageServiceInterface {
  private db: Database.Database;
  private slaMonitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH);
    this.configureDatabase();
    logger.info("Real EmailStorageService initialized with enhanced database");
  }

  private configureDatabase(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 10000");
  }

  async getEmailsForTable(
    page: number,
    pageSize: number,
    sortBy: string,
    sortOrder: "asc" | "desc",
    filters: EmailTableFilters
  ): Promise<GetEmailsResult> {
    try {
      // Build WHERE clause
      const whereClauses: string[] = ["1=1"];
      const params: any[] = [];

      if (filters.search) {
        whereClauses.push("(subject LIKE ? OR sender_email LIKE ?)");
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      if (filters.status) {
        whereClauses.push("workflow_state = ?");
        params.push(filters.status);
      }

      if (filters.priority) {
        whereClauses.push("priority = ?");
        params.push(filters.priority);
      }

      if (filters.dateFrom) {
        whereClauses.push("received_date_time >= ?");
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        whereClauses.push("received_date_time <= ?");
        params.push(filters.dateTo);
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM emails_enhanced 
        WHERE ${whereClauses.join(" AND ")}
      `;
      const { total } = this.db.prepare(countQuery).get(...params) as any;

      // Get paginated results
      const offset = (page - 1) * pageSize;
      const dataQuery = `
        SELECT 
          id,
          subject,
          body_content as body_preview,
          sender_email,
          sender_name,
          recipient_emails,
          received_date_time as received_date,
          workflow_state as status,
          priority,
          confidence_score as confidence,
          chain_completeness_score,
          is_chain_complete,
          has_attachments,
          extracted_entities
        FROM emails_enhanced
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY ${this.mapSortField(sortBy)} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      
      params.push(pageSize, offset);
      const emails = this.db.prepare(dataQuery).all(...params) as any[];

      // Transform results
      const transformedEmails = emails.map(email => ({
        id: email.id,
        subject: email.subject,
        body_preview: (email.body_preview || "").substring(0, 100) + "...",
        from: email.sender_email,
        to: email.recipient_emails ? email.recipient_emails.split(",") : [],
        received_date: email.received_date,
        status: email.status || "analyzed",
        priority: email.priority || "medium",
        confidence_score: email.confidence || 0.5,
        has_attachments: Boolean(email.has_attachments),
        entities: this.parseEntities(email.extracted_entities),
        // Enhanced fields
        sender_name: email.sender_name || this.extractNameFromEmail(email.sender_email),
        is_complete_chain: Boolean(email.is_chain_complete),
        chain_score: email.chain_completeness_score || 0,
      }));

      return {
        emails: transformedEmails,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      logger.error("Error fetching emails:", error);
      return {
        emails: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }
  }

  async getDashboardStats(): Promise<GetDashboardStatsResult> {
    try {
      const stats = this.db
        .prepare(
          `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN workflow_state = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN workflow_state = 'in_progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN workflow_state = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical,
            COUNT(CASE WHEN priority = 'high' THEN 1 END) as high,
            COUNT(CASE WHEN is_chain_complete = 1 THEN 1 END) as complete_chains,
            AVG(confidence_score) as avg_confidence,
            AVG(chain_completeness_score) as avg_chain_score
          FROM emails_enhanced
          WHERE status = 'analyzed'`
        )
        .get() as any;

      return {
        total: stats.total || 0,
        pending: stats.pending || 0,
        inProgress: stats.in_progress || 0,
        completed: stats.completed || 0,
        todayCount: await this.getTodayCount(),
        weekCount: await this.getWeekCount(),
        priority: {
          critical: stats.critical || 0,
          high: stats.high || 0,
          medium: stats.total - stats.critical - stats.high || 0,
          low: 0,
        },
        avgResponseTime: 2.5, // TODO: Calculate from actual data
        slaBreaches: await this.getSLABreaches(),
        processingStats: {
          totalProcessed: stats.total || 0,
          completeChains: stats.complete_chains || 0,
          avgConfidence: stats.avg_confidence || 0.7,
          avgChainScore: stats.avg_chain_score || 50,
        },
      };
    } catch (error) {
      logger.error("Error fetching dashboard stats:", error);
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        todayCount: 0,
        weekCount: 0,
        priority: { critical: 0, high: 0, medium: 0, low: 0 },
        avgResponseTime: 0,
        slaBreaches: 0,
        processingStats: {
          totalProcessed: 0,
          completeChains: 0,
          avgConfidence: 0,
          avgChainScore: 0,
        },
      };
    }
  }

  async getAnalytics(
    timeRange: "day" | "week" | "month" = "week"
  ): Promise<GetAnalyticsResult> {
    try {
      // Get volume data
      const volumeData = await this.getVolumeData(timeRange);
      
      // Get category distribution
      const categoryData = this.db
        .prepare(
          `SELECT 
            workflow_state as category,
            COUNT(*) as count
          FROM emails_enhanced
          WHERE status = 'analyzed'
          GROUP BY workflow_state`
        )
        .all() as any[];

      // Get priority distribution
      const priorityData = this.db
        .prepare(
          `SELECT 
            priority,
            COUNT(*) as count
          FROM emails_enhanced
          WHERE status = 'analyzed'
          GROUP BY priority`
        )
        .all() as any[];

      return {
        volumeByDate: volumeData,
        categoryDistribution: categoryData.map(c => ({
          category: c.category || "unknown",
          count: c.count,
        })),
        priorityTrends: this.generatePriorityTrends(timeRange),
        responseTimeMetrics: {
          average: 2.5,
          p95: 4.2,
          p99: 8.5,
        },
      };
    } catch (error) {
      logger.error("Error fetching analytics:", error);
      return {
        volumeByDate: [],
        categoryDistribution: [],
        priorityTrends: [],
        responseTimeMetrics: {
          average: 0,
          p95: 0,
          p99: 0,
        },
      };
    }
  }

  async getEmailById(id: string): Promise<any> {
    try {
      const email = this.db
        .prepare(
          `SELECT * FROM emails_enhanced WHERE id = ?`
        )
        .get(id);
      
      return email || null;
    } catch (error) {
      logger.error(`Error fetching email ${id}:`, error);
      return null;
    }
  }

  startSLAMonitoring(): void {
    // Monitor SLA every 5 minutes
    this.slaMonitoringInterval = setInterval(() => {
      this.checkSLABreaches();
    }, 5 * 60 * 1000);
  }

  stopSLAMonitoring(): void {
    if (this.slaMonitoringInterval) {
      clearInterval(this.slaMonitoringInterval);
    }
  }

  // Helper methods
  private mapSortField(field: string): string {
    const fieldMap: Record<string, string> = {
      received_date: "received_date_time",
      subject: "subject",
      requested_by: "sender_email",
      status: "workflow_state",
      priority: "priority",
    };
    return fieldMap[field] || "received_date_time";
  }

  private parseEntities(entitiesJson: string | null): any {
    if (!entitiesJson) return {};
    try {
      return JSON.parse(entitiesJson);
    } catch {
      return {};
    }
  }

  private extractNameFromEmail(email: string): string {
    const parts = email.split("@")[0].split(".");
    return parts
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }

  private async getTodayCount(): Promise<number> {
    const result = this.db
      .prepare(
        `SELECT COUNT(*) as count 
         FROM emails_enhanced 
         WHERE date(received_date_time) = date('now')`
      )
      .get() as any;
    return result.count || 0;
  }

  private async getWeekCount(): Promise<number> {
    const result = this.db
      .prepare(
        `SELECT COUNT(*) as count 
         FROM emails_enhanced 
         WHERE date(received_date_time) >= date('now', '-7 days')`
      )
      .get() as any;
    return result.count || 0;
  }

  private async getSLABreaches(): Promise<number> {
    // TODO: Implement actual SLA breach calculation
    return 0;
  }

  private async checkSLABreaches(): Promise<void> {
    // TODO: Implement SLA breach checking logic
    logger.debug("Checking SLA breaches...");
  }

  private async getVolumeData(timeRange: string): Promise<any[]> {
    const days = timeRange === "day" ? 1 : timeRange === "week" ? 7 : 30;
    
    const data = this.db
      .prepare(
        `SELECT 
          date(received_date_time) as date,
          COUNT(*) as count
        FROM emails_enhanced
        WHERE date(received_date_time) >= date('now', '-${days} days')
          AND status = 'analyzed'
        GROUP BY date(received_date_time)
        ORDER BY date`
      )
      .all() as any[];

    return data.map(d => ({
      date: d.date,
      volume: d.count,
    }));
  }

  private generatePriorityTrends(timeRange: string): any[] {
    // TODO: Implement actual priority trends from database
    const days = timeRange === "day" ? 1 : timeRange === "week" ? 7 : 30;
    const trends = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split("T")[0],
        critical: Math.floor(Math.random() * 5),
        high: Math.floor(Math.random() * 15),
        medium: Math.floor(Math.random() * 30),
        low: Math.floor(Math.random() * 10),
      });
    }
    
    return trends.reverse();
  }

  // Cleanup
  close(): void {
    this.stopSLAMonitoring();
    this.db.close();
  }
}

// Export singleton instance
export const realEmailStorageService = new RealEmailStorageService();