import { logger } from "../../utils/logger";
import { wsService } from "./WebSocketService";

// Forward declarations - actual interfaces are at the bottom
declare interface QueryPerformanceEntry extends QueryExecutionInfo {
  id: string;
  timestamp: number;
}

type MonitorInfo = QueryMonitor;

/**
 * Query Performance Monitor for real-time database performance tracking
 * Implements 2025 best practices for performance monitoring and alerting
 */
export class QueryPerformanceMonitor {
  private performanceHistory: QueryPerformanceEntry[] = [];
  private alertThresholds: PerformanceThresholds;
  private monitors: Map<string, MonitorInfo> = new Map();
  private isMonitoring: boolean = false;

  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly ALERT_COOLDOWN = 30000; // 30 seconds
  private lastAlertTime: Map<string, number> = new Map();

  constructor() {
    this.alertThresholds = {
      slowQueryTime: 1000, // 1 second
      criticalQueryTime: 5000, // 5 seconds
      highCpuUsage: 80, // 80%
      highMemoryUsage: 85, // 85%
      lowCacheHitRatio: 50, // 50%
      highErrorRate: 5, // 5%
    };
  }

  /**
   * Start monitoring database performance
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    logger.info("Query performance monitoring started", "QUERY_MONITOR");

    // Start periodic performance checks
    this.startPeriodicChecks();
  }

  /**
   * Track operation performance
   */
  trackOperation(operation: string, duration: number, success: boolean): void {
    const entry: QueryPerformanceEntry = {
      query: operation,
      executionTime: duration,
      timestamp: Date.now(),
      id: this.generateQueryId(),
      error: success ? undefined : 'Operation failed',
    };

    this.performanceHistory.push(entry);

    // Maintain history size limit
    if (this.performanceHistory.length > this.MAX_HISTORY_SIZE) {
      this.performanceHistory.shift();
    }

    // Check for performance alerts
    this.checkPerformanceThresholds(entry);
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  private checkPerformanceThresholds(entry: QueryPerformanceEntry): void {
    const now = Date.now();
    const operation = entry.query.split(' ')[0] || 'unknown';
    const alertKey = `${operation}_${entry.executionTime > this.alertThresholds.criticalQueryTime ? "critical" : "slow"}`;

    // Check if we're in cooldown period
    const lastAlert = this.lastAlertTime.get(alertKey) || 0;
    if (now - lastAlert < this.ALERT_COOLDOWN) {
      return;
    }

    // Check for slow/critical queries
    if (entry.executionTime > this.alertThresholds.criticalQueryTime) {
      logger.warn(
        `Critical query performance: ${operation} took ${entry.executionTime}ms`,
        "QUERY_MONITOR",
      );
      this.lastAlertTime.set(alertKey, now);
    } else if (entry.executionTime > this.alertThresholds.slowQueryTime) {
      logger.warn(
        `Slow query detected: ${operation} took ${entry.executionTime}ms`,
        "QUERY_MONITOR",
      );
      this.lastAlertTime.set(alertKey, now);
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.monitors.clear();
    logger.info("Query performance monitoring stopped", "QUERY_MONITOR");
  }

  /**
   * Record query execution for monitoring
   */
  recordQuery(queryInfo: QueryExecutionInfo): void {
    const entry: QueryPerformanceEntry = {
      ...queryInfo,
      timestamp: Date.now(),
      id: this.generateQueryId(),
    };

    // Add to history
    this.addToHistory(entry);

    // Check for performance issues
    this.checkPerformanceIssues(entry);

    // Update query monitor if exists
    this.updateQueryMonitor(entry);

    // Broadcast real-time performance data
    this.broadcastPerformanceUpdate(entry);
  }

  /**
   * Register a query monitor for specific queries
   */
  registerQueryMonitor(
    queryPattern: string,
    options: QueryMonitorOptions,
  ): string {
    const monitorId = this.generateMonitorId();

    const monitorInfo: MonitorInfo = {
      id: monitorId,
      pattern: queryPattern,
      options,
      statistics: this.initializeStatistics(),
      createdAt: Date.now(),
    };

    this.monitors.set(monitorId, monitorInfo);

    logger.info("Query monitor registered", "QUERY_MONITOR", {
      monitorId,
      pattern: queryPattern,
    });

    return monitorId;
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStatistics(): PerformanceStatistics {
    const recentQueries = this.getRecentQueries(5 * 60 * 1000); // Last 5 minutes

    if (recentQueries.length === 0) {
      return this.getEmptyStatistics();
    }

    const totalTime = recentQueries.reduce(
      (sum, q) => sum + q.executionTime,
      0,
    );
    const averageTime = totalTime / recentQueries.length;

    const slowQueries = recentQueries.filter(
      (q) => q.executionTime > this.alertThresholds.slowQueryTime,
    );
    const criticalQueries = recentQueries.filter(
      (q) => q.executionTime > this.alertThresholds.criticalQueryTime,
    );

    const errors = recentQueries.filter((q) => q.error);
    const errorRate = (errors.length / recentQueries.length) * 100;

    return {
      totalQueries: recentQueries.length,
      averageExecutionTime: Math.round(averageTime),
      slowQueriesCount: slowQueries.length,
      criticalQueriesCount: criticalQueries.length,
      errorRate: Math.round(errorRate * 100) / 100,
      cacheHitRatio: this.calculateCacheHitRatio(recentQueries),
      topSlowQueries: this.getTopSlowQueries(recentQueries, 5),
      performanceTrend: this.calculatePerformanceTrend(),
      alerts: this.getActiveAlerts(),
      monitoringDuration:
        Date.now() - (recentQueries[0]?.timestamp || Date.now()),
    };
  }

  /**
   * Get detailed performance report
   */
  getDetailedReport(): DetailedPerformanceReport {
    const stats = this.getPerformanceStatistics();
    const recentQueries = this.getRecentQueries(60 * 60 * 1000); // Last hour

    return {
      ...stats,
      hourlyStatistics: this.generateHourlyStatistics(recentQueries),
      queryTypeBreakdown: this.analyzeQueryTypes(recentQueries),
      performanceRecommendations:
        this.generatePerformanceRecommendations(stats),
      resourceUtilization: this.estimateResourceUtilization(recentQueries),
      monitorStatuses: this.getMonitorStatuses(),
    };
  }

  /**
   * Set custom alert thresholds
   */
  setAlertThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    logger.info("Alert thresholds updated", "QUERY_MONITOR", { thresholds });
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.performanceHistory = [];
    logger.info("Performance history cleared", "QUERY_MONITOR");
  }

  // Private methods

  private startPeriodicChecks(): void {
    const checkInterval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(checkInterval);
        return;
      }

      this.performPeriodicChecks();
    }, 30000); // Check every 30 seconds
  }

  private performPeriodicChecks(): void {
    const stats = this.getPerformanceStatistics();

    // Check for system-wide performance issues
    this.checkSystemPerformance(stats);

    // Clean up old history
    this.cleanupHistory();
  }

  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMonitorId(): string {
    return `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeStatistics(): QueryStatistics {
    return {
      totalQueries: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      maxExecutionTime: 0,
      minExecutionTime: 0,
      errorCount: 0,
    };
  }


  private addToHistory(entry: QueryPerformanceEntry): void {
    this.performanceHistory.push(entry);

    // Maintain history size limit
    if (this.performanceHistory.length > this.MAX_HISTORY_SIZE) {
      this.performanceHistory = this.performanceHistory.slice(
        -this.MAX_HISTORY_SIZE,
      );
    }
  }

  private checkPerformanceIssues(entry: QueryPerformanceEntry): void {
    const alerts: PerformanceAlert[] = [];

    // Check for slow query
    if (entry.executionTime > this.alertThresholds.criticalQueryTime) {
      alerts.push({
        type: "critical_slow_query",
        severity: "critical",
        message: `Critical slow query detected: ${entry.executionTime}ms`,
        queryId: entry.id,
        timestamp: entry.timestamp,
        details: {
          executionTime: entry.executionTime,
          query: entry.query?.substring(0, 100),
          threshold: this.alertThresholds.criticalQueryTime,
        },
      });
    } else if (entry.executionTime > this.alertThresholds.slowQueryTime) {
      alerts.push({
        type: "slow_query",
        severity: "warning",
        message: `Slow query detected: ${entry.executionTime}ms`,
        queryId: entry.id,
        timestamp: entry.timestamp,
        details: {
          executionTime: entry.executionTime,
          query: entry.query?.substring(0, 100),
          threshold: this.alertThresholds.slowQueryTime,
        },
      });
    }

    // Check for query errors
    if (entry.error) {
      alerts.push({
        type: "query_error",
        severity: "error",
        message: `Query execution error: ${entry.error || 'Unknown error'}`,
        queryId: entry.id,
        timestamp: entry.timestamp,
        details: {
          error: entry.error,
          query: entry.query?.substring(0, 100),
        },
      });
    }

    // Process alerts
    alerts.forEach((alert) => this.processAlert(alert));
  }

  private processAlert(alert: PerformanceAlert): void {
    const alertKey = `${alert.type}_${alert.queryId}`;
    const lastAlert = this.lastAlertTime.get(alertKey);

    // Implement alert cooldown
    if (lastAlert && Date.now() - lastAlert < this.ALERT_COOLDOWN) {
      return;
    }

    this.lastAlertTime.set(alertKey, Date.now());

    // Log alert
    logger.warn("Performance alert", "QUERY_MONITOR", alert);

    // Broadcast alert via WebSocket
    const severity = alert.severity === "error" ? "critical" : alert.severity;
    wsService.broadcastPerformanceWarning(
      "database",
      alert.type,
      alert.details?.executionTime || 0,
      alert.details?.threshold || 0,
      severity as "critical" | "warning",
    );
  }

  private updateQueryMonitor(entry: QueryPerformanceEntry): void {
    this.monitors.forEach((monitor) => {
      if (this.matchesPattern(entry.query, monitor.pattern)) {
        monitor.statistics.totalQueries++;
        monitor.statistics.totalExecutionTime += entry.executionTime;
        monitor.statistics.averageExecutionTime =
          monitor.statistics.totalExecutionTime /
          monitor.statistics.totalQueries;

        if (entry.executionTime > monitor.statistics.maxExecutionTime) {
          monitor.statistics.maxExecutionTime = entry.executionTime;
          monitor.statistics.slowestQuery = entry.query;
        }

        if (
          entry.executionTime < monitor.statistics.minExecutionTime ||
          monitor.statistics.minExecutionTime === 0
        ) {
          monitor.statistics.minExecutionTime = entry.executionTime;
        }

        if (entry.error) {
          monitor.statistics.errorCount++;
        }

        monitor.statistics.lastExecution = entry.timestamp;
      }
    });
  }

  private broadcastPerformanceUpdate(entry: QueryPerformanceEntry): void {
    // Broadcast selective performance updates
    if (
      entry.executionTime > this.alertThresholds.slowQueryTime ||
      entry.error
    ) {
      try {
        wsService.broadcast({
          type: "system.performance_warning",
          value: entry.executionTime,
          component: "database",
          metric: "query_time",
          threshold: this.alertThresholds.slowQueryTime,
          severity:
            entry.executionTime > this.alertThresholds.criticalQueryTime
              ? ("critical" as const)
              : ("warning" as const),
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error(
          "Failed to broadcast performance update",
          "QUERY_MONITOR",
          { error },
        );
      }
    }
  }

  private matchesPattern(query: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(query);
    } catch {
      // If pattern is not a valid regex, do simple string matching
      return query.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  private getRecentQueries(timeWindow: number): QueryPerformanceEntry[] {
    const cutoff = Date.now() - timeWindow;
    return this.performanceHistory.filter((entry) => entry.timestamp > cutoff);
  }

  private calculateCacheHitRatio(queries: QueryPerformanceEntry[]): number {
    const cacheableQueries = queries.filter((q) => q.cacheHit !== undefined);
    if (cacheableQueries.length === 0) return 0;

    const hits = cacheableQueries.filter((q) => q.cacheHit).length;
    return Math.round((hits / cacheableQueries.length) * 100);
  }

  private getTopSlowQueries(
    queries: QueryPerformanceEntry[],
    limit: number,
  ): Array<{ query: string; time: number }> {
    return queries
      .filter((q) => !q.error)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit)
      .map((q) => ({
        query: q.query.substring(0, 200),
        time: q.executionTime,
      }));
  }

  private calculatePerformanceTrend(): 'improving' | 'stable' | 'degrading' {
    const recentQueries = this.getRecentQueries(10 * 60 * 1000); // Last 10 minutes
    const olderCutoff = Date.now() - 10 * 60 * 1000;
    const olderQueries = this.getRecentQueries(20 * 60 * 1000).filter(
      (q) => q.timestamp < olderCutoff,
    ); // 10-20 minutes ago

    if (recentQueries.length === 0 || olderQueries.length === 0) {
      return 'stable';
    }

    const recentAvg =
      recentQueries.reduce((sum, q) => sum + q.executionTime, 0) /
      recentQueries.length;
    const olderAvg =
      olderQueries.reduce((sum, q) => sum + q.executionTime, 0) /
      olderQueries.length;

    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (percentChange < -10) {
      return 'improving';
    } else if (percentChange > 10) {
      return 'degrading';
    } else {
      return 'stable';
    }
  }


  private checkSystemPerformance(stats: PerformanceStatistics): void {
    // Check error rate
    if (stats.errorRate > this.alertThresholds.highErrorRate) {
      logger.warn('High error rate detected', 'QUERY_MONITOR', {
        errorRate: stats.errorRate,
        threshold: this.alertThresholds.highErrorRate,
      });
    }

    // Check cache hit ratio
    if (stats.cacheHitRatio < this.alertThresholds.lowCacheHitRatio) {
      logger.warn('Low cache hit ratio', 'QUERY_MONITOR', {
        cacheHitRatio: stats.cacheHitRatio,
        threshold: this.alertThresholds.lowCacheHitRatio,
      });
    }

    // Check performance trend
    if (stats.performanceTrend === 'degrading') {
      logger.warn('Performance degradation detected', 'QUERY_MONITOR');
    }
  }

  private cleanupHistory(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep 24 hours
    this.performanceHistory = this.performanceHistory.filter(
      (entry) => entry.timestamp > cutoff
    );
  }

  // These methods are already defined below with correct implementations
  // Removing duplicates

  private getActiveAlerts(): PerformanceAlert[] {
    // Return recent alerts from the last 5 minutes
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recentQueries = this.getRecentQueries(5 * 60 * 1000);

    const alerts: PerformanceAlert[] = [];

    recentQueries.forEach((query) => {
      if (query.executionTime > this.alertThresholds.criticalQueryTime) {
        alerts.push({
          type: "critical_slow_query",
          severity: "critical",
          message: `Critical slow query: ${query.executionTime}ms`,
          queryId: query.id,
          timestamp: query.timestamp,
          details: { executionTime: query.executionTime },
        });
      }

      if (query.error) {
        alerts.push({
          type: "query_error",
          severity: "error",
          message: `Query error: ${query.error}`,
          queryId: query.id,
          timestamp: query.timestamp,
          details: { error: query.error },
        });
      }
    });

    return alerts.slice(-10); // Return last 10 alerts
  }

  private generateHourlyStatistics(
    queries: QueryPerformanceEntry[],
  ): HourlyStats[] {
    const hourlyMap = new Map<number, QueryPerformanceEntry[]>();

    queries.forEach((query) => {
      const hour = Math.floor(query.timestamp / (60 * 60 * 1000));
      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, []);
      }
      hourlyMap.get(hour)!.push(query);
    });

    return Array.from(hourlyMap.entries())
      .map(([hour, hourQueries]) => ({
        hour: hour * 60 * 60 * 1000,
        queryCount: hourQueries.length,
        averageTime:
          hourQueries.reduce((sum, q) => sum + q.executionTime, 0) /
          hourQueries.length,
        slowQueries: hourQueries.filter(
          (q) => q.executionTime > this.alertThresholds.slowQueryTime,
        ).length,
        errors: hourQueries.filter((q) => q.error).length,
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  private analyzeQueryTypes(
    queries: QueryPerformanceEntry[],
  ): QueryTypeBreakdown[] {
    const typeMap = new Map<string, QueryPerformanceEntry[]>();

    queries.forEach((query) => {
      const type = this.classifyQuery(query.query);
      if (!typeMap.has(type)) {
        typeMap.set(type, []);
      }
      typeMap.get(type)!.push(query);
    });

    return Array.from(typeMap.entries()).map(([type, typeQueries]) => ({
      type,
      count: typeQueries.length,
      averageTime:
        typeQueries.reduce((sum, q) => sum + q.executionTime, 0) /
        typeQueries.length,
      percentage: (typeQueries.length / queries.length) * 100,
    }));
  }

  private classifyQuery(query: string): string {
    const upperQuery = query.toUpperCase().trim();

    if (upperQuery.startsWith("SELECT")) return "SELECT";
    if (upperQuery.startsWith("INSERT")) return "INSERT";
    if (upperQuery.startsWith("UPDATE")) return "UPDATE";
    if (upperQuery.startsWith("DELETE")) return "DELETE";
    if (upperQuery.startsWith("CREATE")) return "CREATE";
    if (upperQuery.startsWith("DROP")) return "DROP";
    if (upperQuery.startsWith("ALTER")) return "ALTER";

    return "OTHER";
  }

  private generatePerformanceRecommendations(
    stats: PerformanceStatistics,
  ): string[] {
    const recommendations: string[] = [];

    if (stats.averageExecutionTime > 500) {
      recommendations.push(
        "Average query time is high - consider optimizing slow queries",
      );
    }

    if (stats.errorRate > 5) {
      recommendations.push(
        "Query error rate is elevated - review failing queries",
      );
    }

    if (stats.cacheHitRatio < 50) {
      recommendations.push("Cache hit ratio is low - review caching strategy");
    }

    if (stats.slowQueriesCount > stats.totalQueries * 0.1) {
      recommendations.push(
        "High percentage of slow queries - review indexes and query optimization",
      );
    }

    return recommendations;
  }

  private estimateResourceUtilization(
    queries: QueryPerformanceEntry[],
  ): ResourceUtilization {
    // Simplified resource estimation
    const totalTime = queries.reduce((sum, q) => sum + q.executionTime, 0);
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    return {
      cpuUtilization: Math.min(100, (totalTime / timeWindow) * 100),
      memoryUtilization: Math.min(100, queries.length * 0.1), // Rough estimate
      ioUtilization: Math.min(
        100,
        queries.filter((q) => q.query.includes("JOIN")).length * 2,
      ),
    };
  }

  private getMonitorStatuses(): MonitorStatus[] {
    return Array.from(this.monitors.values()).map((monitor) => ({
      id: monitor.id,
      pattern: monitor.pattern,
      isActive: monitor.statistics.lastExecution ? Date.now() - monitor.statistics.lastExecution < 5 * 60 * 1000 : false,
      statistics: monitor.statistics,
    }));
  }

  // Duplicate methods removed - these are already implemented above

  private getEmptyStatistics(): PerformanceStatistics {
    return {
      totalQueries: 0,
      averageExecutionTime: 0,
      slowQueriesCount: 0,
      criticalQueriesCount: 0,
      errorRate: 0,
      cacheHitRatio: 0,
      topSlowQueries: [],
      performanceTrend: "stable",
      alerts: [],
      monitoringDuration: 0,
    };
  }
}

// Type definitions
interface QueryExecutionInfo {
  query: string;
  executionTime: number;
  params?: any[];
  error?: string;
  cacheHit?: boolean;
  rowsAffected?: number;
}

interface QueryPerformanceEntry extends QueryExecutionInfo {
  id: string;
  timestamp: number;
}

interface PerformanceThresholds {
  slowQueryTime: number;
  criticalQueryTime: number;
  highCpuUsage: number;
  highMemoryUsage: number;
  lowCacheHitRatio: number;
  highErrorRate: number;
}

interface QueryMonitorOptions {
  alertOnSlow: boolean;
  alertOnError: boolean;
  trackStatistics: boolean;
}

interface QueryMonitor {
  id: string;
  pattern: string;
  options: QueryMonitorOptions;
  statistics: QueryStatistics;
  createdAt: number;
}

interface QueryStatistics {
  totalQueries: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  errorCount: number;
  lastExecution?: number;
  slowestQuery?: string;
}

interface PerformanceStatistics {
  totalQueries: number;
  averageExecutionTime: number;
  slowQueriesCount: number;
  criticalQueriesCount: number;
  errorRate: number;
  cacheHitRatio: number;
  topSlowQueries: Array<{ query: string; time: number }>;
  performanceTrend: 'improving' | 'stable' | 'degrading';
  alerts: PerformanceAlert[];
  monitoringDuration: number;
}


interface PerformanceAlert {
  type: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  queryId: string;
  timestamp: number;
  details?: any;
}

interface DetailedPerformanceReport extends PerformanceStatistics {
  hourlyStatistics: HourlyStats[];
  queryTypeBreakdown: QueryTypeBreakdown[];
  performanceRecommendations: string[];
  resourceUtilization: ResourceUtilization;
  monitorStatuses: MonitorStatus[];
}

interface HourlyStats {
  hour: number;
  queryCount: number;
  averageTime: number;
  slowQueries: number;
  errors: number;
}

interface QueryTypeBreakdown {
  type: string;
  count: number;
  averageTime: number;
  percentage: number;
}

interface ResourceUtilization {
  cpuUtilization: number;
  memoryUtilization: number;
  ioUtilization: number;
}

interface MonitorStatus {
  id: string;
  pattern: string;
  isActive: boolean;
  statistics: QueryStatistics;
}

// Singleton instance
export const queryPerformanceMonitor = new QueryPerformanceMonitor();
