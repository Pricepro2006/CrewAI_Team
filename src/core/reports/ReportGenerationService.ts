import Database from 'better-sqlite3';
import { logger } from '../../utils/logger.js';
import { EmailAnalyticsService } from '../database/EmailAnalyticsService.js';
import fs from 'fs';
import path from 'path';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface ProcessingReport {
  reportType: 'processing_summary';
  generatedAt: Date;
  dateRange: DateRange;
  data: {
    totalEmails: number;
    processedEmails: number;
    pendingEmails: number;
    failedEmails: number;
    averageProcessingTime: number;
    successRate: number;
    dailyBreakdown: Array<{
      date: string;
      processed: number;
      failed: number;
      avgTime: number;
    }>;
  };
  downloadUrl?: string;
}

interface EntityExtractionReport {
  reportType: 'entity_extraction';
  generatedAt: Date;
  dateRange: DateRange;
  data: {
    totalExtractions: number;
    entityTypes: Array<{
      type: string;
      count: number;
      avgConfidence: number;
    }>;
    topEntities: Array<{
      type: string;
      value: string;
      occurrences: number;
    }>;
  };
  downloadUrl?: string;
}

interface WorkflowAnalysisReport {
  reportType: 'workflow_analysis';
  generatedAt: Date;
  dateRange: DateRange;
  data: {
    workflows: Array<{
      name: string;
      count: number;
      avgProcessingTime: number;
      successRate: number;
    }>;
    totalProcessed: number;
    avgOverallTime: number;
  };
  downloadUrl?: string;
}

interface SLAComplianceReport {
  reportType: 'sla_compliance';
  generatedAt: Date;
  dateRange: DateRange;
  data: {
    totalEmails: number;
    withinSLA: number;
    exceededSLA: number;
    complianceRate: number;
    criticalViolations: Array<{
      emailId: number;
      subject: string;
      processingTime: number;
      slaTarget: number;
    }>;
  };
  downloadUrl?: string;
}

export class ReportGenerationService {
  private db: Database.Database;
  private emailAnalytics: EmailAnalyticsService;
  private reportsPath: string;

  constructor(databasePath: string = './data/app.db', reportsPath: string = './data/reports') {
    try {
      this.db = new Database(databasePath);
      this.emailAnalytics = new EmailAnalyticsService(databasePath);
      this.reportsPath = reportsPath;
      
      // Ensure reports directory exists
      if (!fs.existsSync(this.reportsPath)) {
        fs.mkdirSync(this.reportsPath, { recursive: true });
      }
      
      logger.info('Report generation service initialized', 'REPORTS');
    } catch (error) {
      logger.error('Failed to initialize report service', 'REPORTS', { error });
      throw error;
    }
  }

  /**
   * Generate processing summary report
   */
  async generateProcessingSummary(dateRange: DateRange): Promise<ProcessingReport> {
    try {
      logger.info('Generating processing summary report', 'REPORTS', { dateRange });

      // Get overall stats
      const stats = await this?.emailAnalytics?.getStats();

      // Get daily breakdown
      const dailyStmt = this?.db?.prepare(`
        SELECT 
          DATE(analysis_timestamp) as date,
          COUNT(*) as processed,
          SUM(CASE WHEN workflow_state = 'ERROR' THEN 1 ELSE 0 END) as failed,
          AVG(processing_time_ms) as avg_time
        FROM email_analysis
        WHERE analysis_timestamp >= ? AND analysis_timestamp <= ?
        GROUP BY DATE(analysis_timestamp)
        ORDER BY date ASC
      `);

      const dailyData = dailyStmt.all(
        dateRange?.startDate?.toISOString(),
        dateRange?.endDate?.toISOString()
      ) as any[];

      // Get period-specific stats
      const periodStmt = this?.db?.prepare(`
        SELECT 
          COUNT(DISTINCT e.id) as total_emails,
          COUNT(DISTINCT ea.email_id) as processed_emails,
          SUM(CASE WHEN ea.workflow_state = 'ERROR' THEN 1 ELSE 0 END) as failed_emails
        FROM emails e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        WHERE e.created_at >= ? AND e.created_at <= ?
      `);

      const periodStats = periodStmt.get(
        dateRange?.startDate?.toISOString(),
        dateRange?.endDate?.toISOString()
      ) as any;

      const report: ProcessingReport = {
        reportType: 'processing_summary',
        generatedAt: new Date(),
        dateRange,
        data: {
          totalEmails: periodStats.total_emails || 0,
          processedEmails: periodStats.processed_emails || 0,
          pendingEmails: (periodStats.total_emails || 0) - (periodStats.processed_emails || 0),
          failedEmails: periodStats.failed_emails || 0,
          averageProcessingTime: stats.averageProcessingTime,
          successRate: periodStats.processed_emails > 0 
            ? ((periodStats.processed_emails - periodStats.failed_emails) / periodStats.processed_emails) * 100 
            : 0,
          dailyBreakdown: dailyData?.map(d => ({
            date: d.date,
            processed: d.processed,
            failed: d.failed || 0,
            avgTime: d.avg_time || 0
          }))
        }
      };

      // Generate CSV file
      const csvContent = this.generateProcessingSummaryCSV(report);
      const fileName = `processing_summary_${Date.now()}.csv`;
      const filePath = path.join(this.reportsPath, fileName);
      fs.writeFileSync(filePath, csvContent);
      
      report.downloadUrl = `/api/reports/download/${fileName}`;

      logger.info('Processing summary report generated', 'REPORTS', { fileName });
      return report;
    } catch (error) {
      logger.error('Error generating processing summary', 'REPORTS', { error });
      throw error;
    }
  }

  /**
   * Generate entity extraction report
   */
  async generateEntityExtractionReport(dateRange: DateRange): Promise<EntityExtractionReport> {
    try {
      logger.info('Generating entity extraction report', 'REPORTS', { dateRange });

      // Get entity type statistics
      const typeStatsStmt = this?.db?.prepare(`
        SELECT 
          entity_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM entity_extractions ee
        JOIN emails e ON ee.email_id = e.id
        WHERE e.created_at >= ? AND e.created_at <= ?
        GROUP BY entity_type
        ORDER BY count DESC
      `);

      const typeStats = typeStatsStmt.all(
        dateRange?.startDate?.toISOString(),
        dateRange?.endDate?.toISOString()
      ) as any[];

      // Get top entities
      const topEntitiesStmt = this?.db?.prepare(`
        SELECT 
          entity_type,
          entity_value,
          COUNT(*) as occurrences
        FROM entity_extractions ee
        JOIN emails e ON ee.email_id = e.id
        WHERE e.created_at >= ? AND e.created_at <= ?
        GROUP BY entity_type, entity_value
        ORDER BY occurrences DESC
        LIMIT 20
      `);

      const topEntities = topEntitiesStmt.all(
        dateRange?.startDate?.toISOString(),
        dateRange?.endDate?.toISOString()
      ) as any[];

      const totalExtractions = typeStats.reduce((sum: any, t: any) => sum + t.count, 0);

      const report: EntityExtractionReport = {
        reportType: 'entity_extraction',
        generatedAt: new Date(),
        dateRange,
        data: {
          totalExtractions,
          entityTypes: typeStats?.map(t => ({
            type: t.entity_type,
            count: t.count,
            avgConfidence: t.avg_confidence || 0
          })),
          topEntities: topEntities?.map(e => ({
            type: e.entity_type,
            value: e.entity_value,
            occurrences: e.occurrences
          }))
        }
      };

      // Generate CSV file
      const csvContent = this.generateEntityExtractionCSV(report);
      const fileName = `entity_extraction_${Date.now()}.csv`;
      const filePath = path.join(this.reportsPath, fileName);
      fs.writeFileSync(filePath, csvContent);
      
      report.downloadUrl = `/api/reports/download/${fileName}`;

      logger.info('Entity extraction report generated', 'REPORTS', { fileName });
      return report;
    } catch (error) {
      logger.error('Error generating entity extraction report', 'REPORTS', { error });
      throw error;
    }
  }

  /**
   * Generate workflow analysis report
   */
  async generateWorkflowAnalysisReport(dateRange: DateRange): Promise<WorkflowAnalysisReport> {
    try {
      logger.info('Generating workflow analysis report', 'REPORTS', { dateRange });

      const workflowStmt = this?.db?.prepare(`
        SELECT 
          primary_workflow as name,
          COUNT(*) as count,
          AVG(processing_time_ms) as avg_processing_time,
          SUM(CASE WHEN workflow_state = 'COMPLETE' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
        FROM email_analysis ea
        JOIN emails e ON ea.email_id = e.id
        WHERE e.created_at >= ? AND e.created_at <= ?
        GROUP BY primary_workflow
        ORDER BY count DESC
      `);

      const workflows = workflowStmt.all(
        dateRange?.startDate?.toISOString(),
        dateRange?.endDate?.toISOString()
      ) as any[];

      const totalProcessed = workflows.reduce((sum: any, w: any) => sum + w.count, 0);
      const avgOverallTime = workflows.reduce((sum: any, w: any) => sum + (w.avg_processing_time * w.count), 0) / (totalProcessed || 1);

      const report: WorkflowAnalysisReport = {
        reportType: 'workflow_analysis',
        generatedAt: new Date(),
        dateRange,
        data: {
          workflows: workflows?.map(w => ({
            name: w.name,
            count: w.count,
            avgProcessingTime: w.avg_processing_time || 0,
            successRate: w.success_rate || 0
          })),
          totalProcessed,
          avgOverallTime
        }
      };

      // Generate CSV file
      const csvContent = this.generateWorkflowAnalysisCSV(report);
      const fileName = `workflow_analysis_${Date.now()}.csv`;
      const filePath = path.join(this.reportsPath, fileName);
      fs.writeFileSync(filePath, csvContent);
      
      report.downloadUrl = `/api/reports/download/${fileName}`;

      logger.info('Workflow analysis report generated', 'REPORTS', { fileName });
      return report;
    } catch (error) {
      logger.error('Error generating workflow analysis report', 'REPORTS', { error });
      throw error;
    }
  }

  /**
   * Generate SLA compliance report
   */
  async generateSLAComplianceReport(dateRange: DateRange, slaTarget: number = 5000): Promise<SLAComplianceReport> {
    try {
      logger.info('Generating SLA compliance report', 'REPORTS', { dateRange, slaTarget });

      const complianceStmt = this?.db?.prepare(`
        SELECT 
          COUNT(*) as total_emails,
          SUM(CASE WHEN ea.processing_time_ms <= ? THEN 1 ELSE 0 END) as within_sla,
          SUM(CASE WHEN ea.processing_time_ms > ? THEN 1 ELSE 0 END) as exceeded_sla
        FROM email_analysis ea
        JOIN emails e ON ea.email_id = e.id
        WHERE e.created_at >= ? AND e.created_at <= ?
          AND ea.workflow_state = 'COMPLETE'
      `);

      const compliance = complianceStmt.get(
        slaTarget,
        slaTarget,
        dateRange?.startDate?.toISOString(),
        dateRange?.endDate?.toISOString()
      ) as any;

      // Get critical violations
      const violationsStmt = this?.db?.prepare(`
        SELECT 
          e.id as email_id,
          e.subject,
          ea.processing_time_ms as processing_time
        FROM email_analysis ea
        JOIN emails e ON ea.email_id = e.id
        WHERE e.created_at >= ? AND e.created_at <= ?
          AND ea.workflow_state = 'COMPLETE'
          AND ea.processing_time_ms > ?
          AND e.priority IN ('urgent', 'high')
        ORDER BY ea.processing_time_ms DESC
        LIMIT 10
      `);

      const violations = violationsStmt.all(
        dateRange?.startDate?.toISOString(),
        dateRange?.endDate?.toISOString(),
        slaTarget
      ) as any[];

      const report: SLAComplianceReport = {
        reportType: 'sla_compliance',
        generatedAt: new Date(),
        dateRange,
        data: {
          totalEmails: compliance.total_emails || 0,
          withinSLA: compliance.within_sla || 0,
          exceededSLA: compliance.exceeded_sla || 0,
          complianceRate: compliance.total_emails > 0 
            ? (compliance.within_sla / compliance.total_emails) * 100 
            : 0,
          criticalViolations: violations?.map(v => ({
            emailId: v.email_id,
            subject: v.subject,
            processingTime: v.processing_time,
            slaTarget
          }))
        }
      };

      // Generate CSV file
      const csvContent = this.generateSLAComplianceCSV(report);
      const fileName = `sla_compliance_${Date.now()}.csv`;
      const filePath = path.join(this.reportsPath, fileName);
      fs.writeFileSync(filePath, csvContent);
      
      report.downloadUrl = `/api/reports/download/${fileName}`;

      logger.info('SLA compliance report generated', 'REPORTS', { fileName });
      return report;
    } catch (error) {
      logger.error('Error generating SLA compliance report', 'REPORTS', { error });
      throw error;
    }
  }

  // CSV generation helper methods
  private generateProcessingSummaryCSV(report: ProcessingReport): string {
    let csv = 'Processing Summary Report\n';
    csv += `Generated At,${report?.generatedAt?.toISOString()}\n`;
    csv += `Date Range,${report?.dateRange?.startDate.toISOString()} to ${report?.dateRange?.endDate.toISOString()}\n\n`;
    
    csv += 'Overall Statistics\n';
    csv += 'Metric,Value\n';
    csv += `Total Emails,${report?.data?.totalEmails}\n`;
    csv += `Processed Emails,${report?.data?.processedEmails}\n`;
    csv += `Pending Emails,${report?.data?.pendingEmails}\n`;
    csv += `Failed Emails,${report?.data?.failedEmails}\n`;
    csv += `Average Processing Time (ms),${report?.data?.averageProcessingTime.toFixed(2)}\n`;
    csv += `Success Rate (%),${report?.data?.successRate.toFixed(2)}\n\n`;
    
    csv += 'Daily Breakdown\n';
    csv += 'Date,Processed,Failed,Avg Time (ms)\n';
    report?.data?.dailyBreakdown.forEach(day => {
      csv += `${day.date},${day.processed},${day.failed},${day?.avgTime?.toFixed(2)}\n`;
    });
    
    return csv;
  }

  private generateEntityExtractionCSV(report: EntityExtractionReport): string {
    let csv = 'Entity Extraction Report\n';
    csv += `Generated At,${report?.generatedAt?.toISOString()}\n`;
    csv += `Date Range,${report?.dateRange?.startDate.toISOString()} to ${report?.dateRange?.endDate.toISOString()}\n`;
    csv += `Total Extractions,${report?.data?.totalExtractions}\n\n`;
    
    csv += 'Entity Types\n';
    csv += 'Type,Count,Avg Confidence\n';
    report?.data?.entityTypes.forEach(type => {
      csv += `${type.type},${type.count},${type?.avgConfidence?.toFixed(3)}\n`;
    });
    
    csv += '\nTop Entities\n';
    csv += 'Type,Value,Occurrences\n';
    report?.data?.topEntities.forEach(entity => {
      csv += `${entity.type},"${entity.value}",${entity.occurrences}\n`;
    });
    
    return csv;
  }

  private generateWorkflowAnalysisCSV(report: WorkflowAnalysisReport): string {
    let csv = 'Workflow Analysis Report\n';
    csv += `Generated At,${report?.generatedAt?.toISOString()}\n`;
    csv += `Date Range,${report?.dateRange?.startDate.toISOString()} to ${report?.dateRange?.endDate.toISOString()}\n`;
    csv += `Total Processed,${report?.data?.totalProcessed}\n`;
    csv += `Avg Overall Time (ms),${report?.data?.avgOverallTime.toFixed(2)}\n\n`;
    
    csv += 'Workflow Breakdown\n';
    csv += 'Workflow,Count,Avg Processing Time (ms),Success Rate (%)\n';
    report?.data?.workflows.forEach(workflow => {
      csv += `${workflow.name},${workflow.count},${workflow?.avgProcessingTime?.toFixed(2)},${workflow?.successRate?.toFixed(2)}\n`;
    });
    
    return csv;
  }

  private generateSLAComplianceCSV(report: SLAComplianceReport): string {
    let csv = 'SLA Compliance Report\n';
    csv += `Generated At,${report?.generatedAt?.toISOString()}\n`;
    csv += `Date Range,${report?.dateRange?.startDate.toISOString()} to ${report?.dateRange?.endDate.toISOString()}\n\n`;
    
    csv += 'Compliance Summary\n';
    csv += 'Metric,Value\n';
    csv += `Total Emails,${report?.data?.totalEmails}\n`;
    csv += `Within SLA,${report?.data?.withinSLA}\n`;
    csv += `Exceeded SLA,${report?.data?.exceededSLA}\n`;
    csv += `Compliance Rate (%),${report?.data?.complianceRate.toFixed(2)}\n\n`;
    
    csv += 'Critical Violations\n';
    csv += 'Email ID,Subject,Processing Time (ms),SLA Target (ms)\n';
    report?.data?.criticalViolations.forEach(violation => {
      csv += `${violation.emailId},"${violation.subject}",${violation.processingTime},${violation.slaTarget}\n`;
    });
    
    return csv;
  }

  /**
   * Close database connections
   */
  close(): void {
    try {
      this?.db?.close();
      this?.emailAnalytics?.close();
      logger.info('Report generation service closed', 'REPORTS');
    } catch (error) {
      logger.error('Error closing report generation service', 'REPORTS', { error });
    }
  }
}