/**
 * Query Performance Monitor for real-time database performance tracking
 * Implements 2025 best practices for performance monitoring and alerting
 */
export declare class QueryPerformanceMonitor {
    private performanceHistory;
    private alertThresholds;
    private monitors;
    private isMonitoring;
    private readonly MAX_HISTORY_SIZE;
    private readonly ALERT_COOLDOWN;
    private lastAlertTime;
    constructor();
    /**
     * Start monitoring database performance
     */
    startMonitoring(): void;
    /**
     * Stop monitoring
     */
    stopMonitoring(): void;
    /**
     * Record query execution for monitoring
     */
    recordQuery(queryInfo: QueryExecutionInfo): void;
    /**
     * Register a query monitor for specific queries
     */
    registerQueryMonitor(queryPattern: string, options: QueryMonitorOptions): string;
    /**
     * Get current performance statistics
     */
    getPerformanceStatistics(): PerformanceStatistics;
    /**
     * Get detailed performance report
     */
    getDetailedReport(): DetailedPerformanceReport;
    /**
     * Set custom alert thresholds
     */
    setAlertThresholds(thresholds: Partial<PerformanceThresholds>): void;
    /**
     * Clear performance history
     */
    clearHistory(): void;
    private startPeriodicChecks;
    private performPeriodicChecks;
    private addToHistory;
    private checkPerformanceIssues;
    private processAlert;
    private updateQueryMonitor;
    private broadcastPerformanceUpdate;
    private getRecentQueries;
    private calculateCacheHitRatio;
    private getTopSlowQueries;
    private calculatePerformanceTrend;
    private getActiveAlerts;
    private generateHourlyStatistics;
    private analyzeQueryTypes;
    private classifyQuery;
    private generatePerformanceRecommendations;
    private estimateResourceUtilization;
    private getMonitorStatuses;
    private checkSystemPerformance;
    private cleanupHistory;
    private matchesPattern;
    private generateQueryId;
    private generateMonitorId;
    private initializeStatistics;
    private getEmptyStatistics;
}
interface QueryExecutionInfo {
    query: string;
    executionTime: number;
    params?: any[];
    error?: string;
    cacheHit?: boolean;
    rowsAffected?: number;
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
interface QueryStatistics {
    totalQueries: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    errorCount: number;
    lastExecution: number;
    slowestQuery: string;
}
interface PerformanceStatistics {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueriesCount: number;
    criticalQueriesCount: number;
    errorRate: number;
    cacheHitRatio: number;
    topSlowQueries: SlowQueryInfo[];
    performanceTrend: PerformanceTrend;
    alerts: PerformanceAlert[];
    monitoringDuration: number;
}
interface SlowQueryInfo {
    query: string;
    executionTime: number;
    timestamp: number;
    params?: any[];
}
interface PerformanceTrend {
    direction: 'improving' | 'degrading' | 'stable';
    percentChange: number;
}
interface PerformanceAlert {
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
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
export declare const queryPerformanceMonitor: QueryPerformanceMonitor;
export {};
//# sourceMappingURL=QueryPerformanceMonitor.d.ts.map