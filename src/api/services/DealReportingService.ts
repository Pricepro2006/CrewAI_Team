/**
 * Deal Reporting Service - Daily reports, analytics, and performance metrics
 * Generates comprehensive reports on deal detection performance and user engagement
 */

import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import { DealPipelineMonitor } from "./DealPipelineMonitor.js";
import { DealWebSocketService } from "./DealWebSocketService.js";
import type Database from "better-sqlite3";

export interface DealReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  reportDate: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  
  // Summary metrics
  summary: {
    totalDealsDetected: number;
    totalSavingsOffered: number;
    averageDealScore: number;
    averageSavingsPercentage: number;
    uniqueProductsWithDeals: number;
    topPerformingCategory: string;
    userEngagementRate: number;
  };
  
  // Detailed metrics
  metrics: {
    dealsByType: Record<string, number>;
    dealsByCategory: Record<string, number>;
    priceTrackingStats: {
      productsTracked: number;
      pricesUpdated: number;
      averageUpdateTime: number;
      successRate: number;
    };
    userActivity: {
      activeUsers: number;
      notificationsSent: number;
      notificationsClicked: number;
      alertsTriggered: number;
      newUserSignups: number;
    };
    performance: {
      averageDetectionTime: number;
      systemUptime: number;
      errorRate: number;
      queueProcessingRate: number;
    };
  };
  
  // Top deals
  topDeals: Array<{
    productId: string;
    productName: string;
    category: string;
    dealType: string;
    currentPrice: number;
    savingsAmount: number;
    savingsPercentage: number;
    dealScore: number;
    userInterest: number; // clicks, views, etc.
  }>;
  
  // Insights and recommendations
  insights: {
    trendAnalysis: string;
    performanceHighlights: string[];
    areasForImprovement: string[];
    recommendations: string[];
    seasonalObservations: string[];
  };
  
  // Comparison with previous period
  comparison?: {
    periodType: string;
    dealsChangePercent: number;
    savingsChangePercent: number;
    userEngagementChange: number;
    performanceChange: number;
  };
  
  createdAt: string;
  generatedBy: string;
}

export interface PerformanceMetrics {
  timestamp: string;
  
  // Deal detection metrics
  dealsDetectedCount: number;
  totalSavingsOffered: number;
  averageDealScore: number;
  dealDetectionTime: number;
  
  // Price tracking metrics
  pricesUpdatedCount: number;
  priceUpdateSuccessRate: number;
  averagePriceUpdateTime: number;
  
  // System performance
  systemUptime: number;
  errorRate: number;
  queueSize: number;
  memoryUsage: number;
  cpuUsage: number;
  
  // User engagement
  activeUsers: number;
  notificationsSent: number;
  notificationClickRate: number;
  
  // Business metrics
  topCategory: string;
  mostPopularDealType: string;
  averageSavingsPerDeal: number;
}

export interface DealAnalytics {
  timeRange: string;
  dealPerformance: {
    bestPerformingProducts: Array<{
      productId: string;
      productName: string;
      totalSavings: number;
      userInteractions: number;
      conversionRate: number;
    }>;
    categoryPerformance: Array<{
      category: string;
      dealCount: number;
      averageSavings: number;
      userEngagement: number;
    }>;
    dealTypeEffectiveness: Array<{
      dealType: string;
      count: number;
      averageScore: number;
      userSatisfaction: number;
    }>;
  };
  
  userBehavior: {
    engagementPatterns: Array<{
      hour: number;
      activeUsers: number;
      dealViews: number;
      clickThroughRate: number;
    }>;
    preferenceDistribution: Record<string, number>;
    retentionMetrics: {
      dailyActiveUsers: number;
      weeklyActiveUsers: number;
      monthlyActiveUsers: number;
      churnRate: number;
    };
  };
  
  systemHealth: {
    uptimePercentage: number;
    averageResponseTime: number;
    errorFrequency: number;
    scalabilityMetrics: {
      peakConcurrentUsers: number;
      maxDealsProcessedPerHour: number;
      resourceUtilization: number;
    };
  };
}

export class DealReportingService {
  private static instance: DealReportingService;
  private db: Database.Database;
  private monitor: DealPipelineMonitor;
  private webSocketService: DealWebSocketService;
  
  // Reporting configuration
  private config = {
    enableDailyReports: true,
    enableWeeklyReports: true,
    enableMonthlyReports: true,
    reportRetentionDays: 90,
    metricsAggregationIntervalMinutes: 15,
    alertThresholds: {
      lowDealDetectionRate: 10, // deals per hour
      highErrorRate: 5, // percentage
      lowUserEngagement: 20, // percentage
    }
  };
  
  // Report generation state
  private reportGenerationTimer?: NodeJS.Timeout;
  private metricsAggregationTimer?: NodeJS.Timeout;
  private isGeneratingReport = false;
  
  // Cached data
  private latestMetrics: PerformanceMetrics;
  private recentReports: Map<string, DealReport> = new Map();

  private constructor() {
    const dbManager = getDatabaseManager();
    this.db = dbManager.connectionPool?.getConnection().getDatabase() || 
              (() => { throw new Error("Database connection not available"); })();
    
    this.monitor = DealPipelineMonitor.getInstance();
    this.webSocketService = DealWebSocketService.getInstance();
    
    this.latestMetrics = this.getEmptyMetrics();
    
    this.initializeTables();
    this.loadRecentReports();
    this.startReportingTimers();
  }

  static getInstance(): DealReportingService {
    if (!DealReportingService.instance) {
      DealReportingService.instance = new DealReportingService();
    }
    return DealReportingService.instance;
  }

  /**
   * Generate daily deal report
   */
  async generateDailyReport(date?: string): Promise<DealReport> {
    const reportDate = date || new Date().toISOString().split('T')[0];
    const reportId = `daily_${reportDate}`;
    
    if (this.isGeneratingReport) {
      throw new Error("Report generation already in progress");
    }

    try {
      this.isGeneratingReport = true;
      logger.info("Generating daily deal report", "DEAL_REPORTING", { reportDate });
      
      const dateRange = {
        startDate: `${reportDate}T00:00:00.000Z`,
        endDate: `${reportDate}T23:59:59.999Z`
      };
      
      // Collect all metrics
      const summary = await this.collectSummaryMetrics(dateRange);
      const metrics = await this.collectDetailedMetrics(dateRange);
      const topDeals = await this.collectTopDeals(dateRange);
      const insights = await this.generateInsights(summary, metrics, topDeals);
      const comparison = await this.generateComparison(dateRange, 'daily');
      
      const report: DealReport = {
        id: reportId,
        reportType: 'daily',
        reportDate,
        dateRange,
        summary,
        metrics,
        topDeals,
        insights,
        comparison,
        createdAt: new Date().toISOString(),
        generatedBy: 'DealReportingService'
      };
      
      // Store report
      await this.storeReport(report);
      this.recentReports.set(reportId, report);
      
      // Send notification
      await this.notifyReportGenerated(report);
      
      logger.info("Daily deal report generated successfully", "DEAL_REPORTING", {
        reportId,
        dealsDetected: summary.totalDealsDetected,
        totalSavings: summary.totalSavingsOffered
      });
      
      return report;
      
    } catch (error) {
      logger.error("Failed to generate daily report", "DEAL_REPORTING", { error, reportDate });
      throw error;
    } finally {
      this.isGeneratingReport = false;
    }
  }

  /**
   * Generate weekly deal report
   */
  async generateWeeklyReport(weekEndDate?: string): Promise<DealReport> {
    const endDate = weekEndDate || new Date().toISOString().split('T')[0];
    const startDate = new Date(new Date(endDate).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const reportId = `weekly_${endDate}`;
    
    try {
      logger.info("Generating weekly deal report", "DEAL_REPORTING", { startDate, endDate });
      
      const dateRange = {
        startDate: `${startDate}T00:00:00.000Z`,
        endDate: `${endDate}T23:59:59.999Z`
      };
      
      const summary = await this.collectSummaryMetrics(dateRange);
      const metrics = await this.collectDetailedMetrics(dateRange);
      const topDeals = await this.collectTopDeals(dateRange, 20); // More deals for weekly
      const insights = await this.generateWeeklyInsights(summary, metrics, topDeals);
      const comparison = await this.generateComparison(dateRange, 'weekly');
      
      const report: DealReport = {
        id: reportId,
        reportType: 'weekly',
        reportDate: endDate,
        dateRange,
        summary,
        metrics,
        topDeals,
        insights,
        comparison,
        createdAt: new Date().toISOString(),
        generatedBy: 'DealReportingService'
      };
      
      await this.storeReport(report);
      this.recentReports.set(reportId, report);
      
      return report;
      
    } catch (error) {
      logger.error("Failed to generate weekly report", "DEAL_REPORTING", { error });
      throw error;
    }
  }

  /**
   * Get deal analytics for a specific time range
   */
  async getDealAnalytics(timeRange: string): Promise<DealAnalytics> {
    try {
      const { startDate, endDate } = this.parseTimeRange(timeRange);
      
      const dealPerformance = await this.analyzeDealPerformance(startDate, endDate);
      const userBehavior = await this.analyzeUserBehavior(startDate, endDate);
      const systemHealth = await this.analyzeSystemHealth(startDate, endDate);
      
      return {
        timeRange,
        dealPerformance,
        userBehavior,
        systemHealth
      };
      
    } catch (error) {
      logger.error("Failed to get deal analytics", "DEAL_REPORTING", { error, timeRange });
      throw error;
    }
  }

  /**
   * Get recent reports
   */
  getRecentReports(reportType?: 'daily' | 'weekly' | 'monthly', limit: number = 10): DealReport[] {
    let reports = Array.from(this.recentReports.values());
    
    if (reportType) {
      reports = reports.filter(r => r.reportType === reportType);
    }
    
    return reports
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  /**
   * Get specific report by ID
   */
  async getReport(reportId: string): Promise<DealReport | null> {
    // Check cache first
    if (this.recentReports.has(reportId)) {
      return this.recentReports.get(reportId)!;
    }
    
    // Load from database
    try {
      const stmt = this.db.prepare(`
        SELECT report_data FROM deal_reports WHERE id = ?
      `);
      
      const row = stmt.get(reportId) as { report_data: string } | undefined;
      
      if (row) {
        const report = JSON.parse(row.report_data) as DealReport;
        this.recentReports.set(reportId, report);
        return report;
      }
      
      return null;
      
    } catch (error) {
      logger.error("Failed to get report", "DEAL_REPORTING", { error, reportId });
      return null;
    }
  }

  /**
   * Record performance metrics
   */
  async recordMetrics(metrics: Partial<PerformanceMetrics>): Promise<void> {
    try {
      const now = new Date().toISOString();
      const fullMetrics: PerformanceMetrics = {
        ...this.latestMetrics,
        ...metrics,
        timestamp: now
      };
      
      // Store metrics
      const stmt = this.db.prepare(`
        INSERT INTO performance_metrics (
          timestamp, metrics_data
        ) VALUES (?, ?)
      `);
      
      stmt.run(now, JSON.stringify(fullMetrics));
      
      this.latestMetrics = fullMetrics;
      
    } catch (error) {
      logger.warn("Failed to record metrics", "DEAL_REPORTING", { error });
    }
  }

  /**
   * Get performance metrics for time range
   */
  async getPerformanceMetrics(
    startDate: string, 
    endDate: string, 
    aggregation: 'hourly' | 'daily' = 'hourly'
  ): Promise<PerformanceMetrics[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT timestamp, metrics_data 
        FROM performance_metrics 
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
      `);
      
      const rows = stmt.all(startDate, endDate) as Array<{ timestamp: string; metrics_data: string }>;
      
      const metrics = rows.map(row => JSON.parse(row.metrics_data) as PerformanceMetrics);
      
      if (aggregation === 'daily') {
        return this.aggregateMetricsDaily(metrics);
      }
      
      return metrics;
      
    } catch (error) {
      logger.error("Failed to get performance metrics", "DEAL_REPORTING", { error });
      return [];
    }
  }

  // Private methods

  private initializeTables(): void {
    try {
      // Reports table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS deal_reports (
          id TEXT PRIMARY KEY,
          report_type TEXT NOT NULL,
          report_date TEXT NOT NULL,
          report_data TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);

      // Performance metrics table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          metrics_data TEXT NOT NULL
        )
      `);

      // Indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_deal_reports_type_date 
        ON deal_reports(report_type, report_date DESC)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp 
        ON performance_metrics(timestamp DESC)
      `);

      logger.debug("Deal reporting tables initialized", "DEAL_REPORTING");

    } catch (error) {
      logger.error("Failed to initialize reporting tables", "DEAL_REPORTING", { error });
      throw error;
    }
  }

  private loadRecentReports(): void {
    try {
      const stmt = this.db.prepare(`
        SELECT id, report_data FROM deal_reports 
        ORDER BY created_at DESC 
        LIMIT 20
      `);
      
      const rows = stmt.all() as Array<{ id: string; report_data: string }>;
      
      for (const row of rows) {
        const report = JSON.parse(row.report_data) as DealReport;
        this.recentReports.set(row.id, report);
      }
      
      logger.info("Recent reports loaded", "DEAL_REPORTING", { count: rows.length });
      
    } catch (error) {
      logger.warn("Failed to load recent reports", "DEAL_REPORTING", { error });
    }
  }

  private startReportingTimers(): void {
    // Daily report generation at 1 AM
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(1, 0, 0, 0);
    
    const timeUntilReport = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.generateDailyReport().catch(error => {
        logger.error("Failed to generate scheduled daily report", "DEAL_REPORTING", { error });
      });
      
      // Set up daily timer
      this.reportGenerationTimer = setInterval(() => {
        this.generateDailyReport().catch(error => {
          logger.error("Failed to generate scheduled daily report", "DEAL_REPORTING", { error });
        });
      }, 24 * 60 * 60 * 1000); // Daily
      
    }, timeUntilReport);
    
    // Metrics aggregation timer
    this.metricsAggregationTimer = setInterval(() => {
      this.aggregateCurrentMetrics();
    }, this.config.metricsAggregationIntervalMinutes * 60 * 1000);
  }

  private async collectSummaryMetrics(dateRange: { startDate: string; endDate: string }): Promise<DealReport['summary']> {
    try {
      // Total deals detected
      const dealsStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_deals,
          SUM(savings_amount) as total_savings,
          AVG(deal_score) as avg_score,
          AVG(savings_percentage) as avg_savings_pct,
          COUNT(DISTINCT product_id) as unique_products
        FROM detected_deals 
        WHERE detected_at BETWEEN ? AND ?
      `);
      
      const dealsData = dealsStmt.get(dateRange.startDate, dateRange.endDate) as any;
      
      // Top performing category
      const categoryStmt = this.db.prepare(`
        SELECT category, COUNT(*) as count 
        FROM detected_deals 
        WHERE detected_at BETWEEN ? AND ? AND category IS NOT NULL
        GROUP BY category 
        ORDER BY count DESC 
        LIMIT 1
      `);
      
      const topCategory = categoryStmt.get(dateRange.startDate, dateRange.endDate) as any;
      
      // User engagement rate (placeholder - would need user interaction data)
      const engagementRate = 75.5; // Mock data
      
      return {
        totalDealsDetected: dealsData?.total_deals || 0,
        totalSavingsOffered: dealsData?.total_savings || 0,
        averageDealScore: dealsData?.avg_score || 0,
        averageSavingsPercentage: dealsData?.avg_savings_pct || 0,
        uniqueProductsWithDeals: dealsData?.unique_products || 0,
        topPerformingCategory: topCategory?.category || 'Unknown',
        userEngagementRate: engagementRate
      };
      
    } catch (error) {
      logger.error("Failed to collect summary metrics", "DEAL_REPORTING", { error });
      throw error;
    }
  }

  private async collectDetailedMetrics(dateRange: { startDate: string; endDate: string }): Promise<DealReport['metrics']> {
    try {
      // Deal distribution by type
      const dealTypesStmt = this.db.prepare(`
        SELECT deal_type, COUNT(*) as count 
        FROM detected_deals 
        WHERE detected_at BETWEEN ? AND ?
        GROUP BY deal_type
      `);
      
      const dealTypeRows = dealTypesStmt.all(dateRange.startDate, dateRange.endDate) as any[];
      const dealsByType: Record<string, number> = {};
      for (const row of dealTypeRows) {
        dealsByType[row.deal_type] = row.count;
      }
      
      // Deal distribution by category
      const categoriesStmt = this.db.prepare(`
        SELECT category, COUNT(*) as count 
        FROM detected_deals 
        WHERE detected_at BETWEEN ? AND ? AND category IS NOT NULL
        GROUP BY category
      `);
      
      const categoryRows = categoriesStmt.all(dateRange.startDate, dateRange.endDate) as any[];
      const dealsByCategory: Record<string, number> = {};
      for (const row of categoryRows) {
        dealsByCategory[row.category] = row.count;
      }
      
      // Price tracking stats
      const priceStatsStmt = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT product_id) as products_tracked,
          COUNT(*) as prices_updated
        FROM price_history_enhanced 
        WHERE recorded_at BETWEEN ? AND ?
      `);
      
      const priceStats = priceStatsStmt.get(dateRange.startDate, dateRange.endDate) as any;
      
      // Get current system metrics
      const currentMetrics = this.monitor.getCurrentMetrics();
      
      return {
        dealsByType,
        dealsByCategory,
        priceTrackingStats: {
          productsTracked: priceStats?.products_tracked || 0,
          pricesUpdated: priceStats?.prices_updated || 0,
          averageUpdateTime: currentMetrics.avgPriceUpdateTimeMs,
          successRate: currentMetrics.successRate
        },
        userActivity: {
          activeUsers: 150, // Mock data - would come from user sessions
          notificationsSent: 1250,
          notificationsClicked: 875,
          alertsTriggered: currentMetrics.alertsTriggeredLast24h,
          newUserSignups: 25
        },
        performance: {
          averageDetectionTime: currentMetrics.avgDealDetectionTimeMs,
          systemUptime: 99.5, // Mock uptime percentage
          errorRate: currentMetrics.errorRate,
          queueProcessingRate: currentMetrics.queueProcessingRate
        }
      };
      
    } catch (error) {
      logger.error("Failed to collect detailed metrics", "DEAL_REPORTING", { error });
      throw error;
    }
  }

  private async collectTopDeals(dateRange: { startDate: string; endDate: string }, limit: number = 10): Promise<DealReport['topDeals']> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          product_id, product_name, category, deal_type,
          current_price, savings_amount, savings_percentage, deal_score
        FROM detected_deals 
        WHERE detected_at BETWEEN ? AND ?
        ORDER BY deal_score DESC, savings_percentage DESC
        LIMIT ?
      `);
      
      const rows = stmt.all(dateRange.startDate, dateRange.endDate, limit) as any[];
      
      return rows.map(row => ({
        productId: row.product_id,
        productName: row.product_name,
        category: row.category || 'Unknown',
        dealType: row.deal_type,
        currentPrice: row.current_price,
        savingsAmount: row.savings_amount,
        savingsPercentage: row.savings_percentage,
        dealScore: row.deal_score,
        userInterest: Math.floor(Math.random() * 100) + 1 // Mock user interest
      }));
      
    } catch (error) {
      logger.error("Failed to collect top deals", "DEAL_REPORTING", { error });
      return [];
    }
  }

  private async generateInsights(
    summary: DealReport['summary'], 
    metrics: DealReport['metrics'],
    topDeals: DealReport['topDeals']
  ): Promise<DealReport['insights']> {
    const insights: DealReport['insights'] = {
      trendAnalysis: '',
      performanceHighlights: [],
      areasForImprovement: [],
      recommendations: [],
      seasonalObservations: []
    };
    
    // Trend analysis
    if (summary.totalDealsDetected > 50) {
      insights.trendAnalysis = `Strong deal detection activity with ${summary.totalDealsDetected} deals identified, offering total savings of $${summary.totalSavingsOffered.toFixed(2)}.`;
    } else {
      insights.trendAnalysis = `Moderate deal detection activity. Consider expanding product monitoring or adjusting detection thresholds.`;
    }
    
    // Performance highlights
    if (summary.averageDealScore >= 0.7) {
      insights.performanceHighlights.push(`High-quality deals detected with average score of ${summary.averageDealScore.toFixed(2)}`);
    }
    
    if (summary.userEngagementRate >= 70) {
      insights.performanceHighlights.push(`Excellent user engagement rate of ${summary.userEngagementRate}%`);
    }
    
    if (metrics.performance.errorRate < 5) {
      insights.performanceHighlights.push(`System reliability maintained with ${metrics.performance.errorRate.toFixed(1)}% error rate`);
    }
    
    // Areas for improvement
    if (summary.averageDealScore < 0.5) {
      insights.areasForImprovement.push('Deal quality could be improved by refining detection algorithms');
    }
    
    if (metrics.performance.errorRate > 10) {
      insights.areasForImprovement.push('System error rate is above acceptable thresholds');
    }
    
    if (summary.userEngagementRate < 50) {
      insights.areasForImprovement.push('User engagement is below optimal levels');
    }
    
    // Recommendations
    const topCategory = Object.keys(metrics.dealsByCategory)
      .reduce((a, b) => metrics.dealsByCategory[a] > metrics.dealsByCategory[b] ? a : b, '');
    
    if (topCategory) {
      insights.recommendations.push(`Focus monitoring efforts on ${topCategory} category which shows highest deal activity`);
    }
    
    if (summary.averageSavingsPercentage < 15) {
      insights.recommendations.push('Consider lowering savings thresholds to detect more deals');
    }
    
    // Seasonal observations
    const currentMonth = new Date().getMonth() + 1;
    if ([11, 12, 1].includes(currentMonth)) {
      insights.seasonalObservations.push('Winter season typically shows increased deal activity in electronics and home goods');
    } else if ([6, 7, 8].includes(currentMonth)) {
      insights.seasonalObservations.push('Summer season shows strong performance in outdoor and grocery categories');
    }
    
    return insights;
  }

  private async generateWeeklyInsights(
    summary: DealReport['summary'], 
    metrics: DealReport['metrics'],
    topDeals: DealReport['topDeals']
  ): Promise<DealReport['insights']> {
    // Similar to daily insights but with weekly context
    const insights = await this.generateInsights(summary, metrics, topDeals);
    
    // Add weekly-specific analysis
    insights.trendAnalysis = `Weekly analysis shows ${summary.totalDealsDetected} deals detected across ${summary.uniqueProductsWithDeals} unique products.`;
    
    // Weekly trend observations
    const weekdayDeals = Math.floor(summary.totalDealsDetected * 0.7); // Mock weekday distribution
    const weekendDeals = summary.totalDealsDetected - weekdayDeals;
    
    insights.seasonalObservations.push(
      `Deal activity: ${weekdayDeals} weekday deals vs ${weekendDeals} weekend deals`
    );
    
    return insights;
  }

  private async generateComparison(
    currentPeriod: { startDate: string; endDate: string },
    periodType: 'daily' | 'weekly' | 'monthly'
  ): Promise<DealReport['comparison']> {
    try {
      // Calculate previous period dates
      const periodMs = new Date(currentPeriod.endDate).getTime() - new Date(currentPeriod.startDate).getTime();
      const previousEnd = new Date(new Date(currentPeriod.startDate).getTime() - 1);
      const previousStart = new Date(previousEnd.getTime() - periodMs);
      
      const previousPeriod = {
        startDate: previousStart.toISOString(),
        endDate: previousEnd.toISOString()
      };
      
      // Get metrics for both periods
      const [currentMetrics, previousMetrics] = await Promise.all([
        this.collectSummaryMetrics(currentPeriod),
        this.collectSummaryMetrics(previousPeriod)
      ]);
      
      // Calculate changes
      const dealsChangePercent = previousMetrics.totalDealsDetected > 0 ?
        ((currentMetrics.totalDealsDetected - previousMetrics.totalDealsDetected) / previousMetrics.totalDealsDetected) * 100 : 0;
      
      const savingsChangePercent = previousMetrics.totalSavingsOffered > 0 ?
        ((currentMetrics.totalSavingsOffered - previousMetrics.totalSavingsOffered) / previousMetrics.totalSavingsOffered) * 100 : 0;
      
      const userEngagementChange = currentMetrics.userEngagementRate - previousMetrics.userEngagementRate;
      
      const performanceChange = currentMetrics.averageDealScore - previousMetrics.averageDealScore;
      
      return {
        periodType,
        dealsChangePercent,
        savingsChangePercent,
        userEngagementChange,
        performanceChange
      };
      
    } catch (error) {
      logger.warn("Failed to generate comparison data", "DEAL_REPORTING", { error });
      return undefined;
    }
  }

  private async storeReport(report: DealReport): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO deal_reports (id, report_type, report_date, report_data, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        report.id,
        report.reportType,
        report.reportDate,
        JSON.stringify(report),
        report.createdAt
      );
      
    } catch (error) {
      logger.error("Failed to store report", "DEAL_REPORTING", { error });
      throw error;
    }
  }

  private async notifyReportGenerated(report: DealReport): Promise<void> {
    // Send WebSocket notification about new report
    // Note: DealWebSocketService doesn't have a generic broadcast method
    // Would need to implement a report notification method or use deal notification
    logger.info("Report generated notification", "DEAL_REPORTING", {
      reportId: report.id,
      reportType: report.reportType,
      reportDate: report.reportDate
    });
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      timestamp: new Date().toISOString(),
      dealsDetectedCount: 0,
      totalSavingsOffered: 0,
      averageDealScore: 0,
      dealDetectionTime: 0,
      pricesUpdatedCount: 0,
      priceUpdateSuccessRate: 100,
      averagePriceUpdateTime: 0,
      systemUptime: 0,
      errorRate: 0,
      queueSize: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeUsers: 0,
      notificationsSent: 0,
      notificationClickRate: 0,
      topCategory: 'Unknown',
      mostPopularDealType: 'price_drop',
      averageSavingsPerDeal: 0
    };
  }

  private aggregateCurrentMetrics(): void {
    try {
      const pipelineMetrics = this.monitor.getCurrentMetrics();
      const webSocketStats = this.webSocketService.getStatistics();
      
      const metrics: Partial<PerformanceMetrics> = {
        dealsDetectedCount: pipelineMetrics.dealsDetectedLastHour,
        totalSavingsOffered: pipelineMetrics.totalSavingsOffered,
        averageDealScore: pipelineMetrics.avgDealScore,
        averagePriceUpdateTime: pipelineMetrics.avgPriceUpdateTimeMs,
        errorRate: pipelineMetrics.errorRate,
        queueSize: pipelineMetrics.currentQueueSize,
        activeUsers: webSocketStats.activeConnections,
        notificationsSent: webSocketStats.messagesSent
      };
      
      this.recordMetrics(metrics);
      
    } catch (error) {
      logger.warn("Failed to aggregate current metrics", "DEAL_REPORTING", { error });
    }
  }

  private parseTimeRange(timeRange: string): { startDate: string; endDate: string } {
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };
  }

  private async analyzeDealPerformance(startDate: string, endDate: string): Promise<DealAnalytics['dealPerformance']> {
    // Mock implementation - in real system would analyze actual performance data
    return {
      bestPerformingProducts: [],
      categoryPerformance: [],
      dealTypeEffectiveness: []
    };
  }

  private async analyzeUserBehavior(startDate: string, endDate: string): Promise<DealAnalytics['userBehavior']> {
    // Mock implementation
    return {
      engagementPatterns: [],
      preferenceDistribution: {},
      retentionMetrics: {
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        churnRate: 0
      }
    };
  }

  private async analyzeSystemHealth(startDate: string, endDate: string): Promise<DealAnalytics['systemHealth']> {
    const healthStatus = this.monitor.getHealthStatus();
    
    return {
      uptimePercentage: 99.5, // Mock uptime
      averageResponseTime: this.latestMetrics.averagePriceUpdateTime,
      errorFrequency: this.latestMetrics.errorRate,
      scalabilityMetrics: {
        peakConcurrentUsers: 500, // Mock data
        maxDealsProcessedPerHour: 1000,
        resourceUtilization: 65
      }
    };
  }

  private aggregateMetricsDaily(metrics: PerformanceMetrics[]): PerformanceMetrics[] {
    // Group by date and aggregate
    const dailyGroups: Record<string, PerformanceMetrics[]> = {};
    
    for (const metric of metrics) {
      const date = metric.timestamp.split('T')[0];
      if (!dailyGroups[date]) {
        dailyGroups[date] = [];
      }
      dailyGroups[date].push(metric);
    }
    
    // Aggregate each day
    return Object.entries(dailyGroups).map(([date, dayMetrics]) => {
      const aggregated = { ...this.getEmptyMetrics() };
      aggregated.timestamp = `${date}T00:00:00.000Z`;
      
      // Calculate averages and sums
      aggregated.dealsDetectedCount = dayMetrics.reduce((sum, m) => sum + m.dealsDetectedCount, 0);
      aggregated.totalSavingsOffered = dayMetrics.reduce((sum, m) => sum + m.totalSavingsOffered, 0);
      aggregated.averageDealScore = dayMetrics.reduce((sum, m) => sum + m.averageDealScore, 0) / dayMetrics.length;
      
      return aggregated;
    });
  }
}