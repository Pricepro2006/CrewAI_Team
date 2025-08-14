/**
 * Performance Dashboard Service
 * Provides comprehensive performance metrics and dashboards
 */

import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';
import { realUserMonitoring } from './RealUserMonitoring.js';
import { performanceMonitor } from './PerformanceMonitor.js';
import { errorTracker } from './ErrorTracker.js';
import { metricsCollector } from './MetricsCollector.js';
import { groceryAgentMetrics } from './GroceryAgentMetrics.js';

export interface DashboardMetrics {
  timestamp: number;
  overview: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    activeUsers: number;
  };
  performance: {
    api: {
      requests_per_minute: number;
      avg_response_time: number;
      p95_response_time: number;
      p99_response_time: number;
      error_rate: number;
      slowest_endpoints: Array<{ endpoint: string; avg_time: number; count: number }>;
    };
    frontend: {
      avg_load_time: number;
      avg_fcp: number;
      avg_lcp: number;
      avg_fid: number;
      avg_cls: number;
      bounce_rate: number;
      device_breakdown: Record<string, number>;
    };
    database: {
      query_count: number;
      avg_query_time: number;
      slow_queries: Array<{ query: string; avg_time: number; count: number }>;
      connection_pool_usage: number;
    };
    websocket: {
      active_connections: number;
      messages_per_minute: number;
      avg_message_latency: number;
      connection_errors: number;
    };
    business: {
      search_success_rate: number;
      product_match_rate: number;
      price_fetch_success_rate: number;
      nlp_accuracy: number;
      cart_conversion_rate: number;
    };
  };
  resources: {
    memory: {
      used_mb: number;
      total_mb: number;
      usage_percent: number;
      heap_used_mb: number;
      heap_total_mb: number;
    };
    cpu: {
      usage_percent: number;
      load_average: number[];
    };
    disk: {
      usage_percent: number;
      available_gb: number;
    };
  };
  slos: {
    availability: {
      target: number;
      current: number;
      status: 'met' | 'at_risk' | 'violated';
    };
    latency: {
      target_p95: number;
      current_p95: number;
      status: 'met' | 'at_risk' | 'violated';
    };
    error_rate: {
      target: number;
      current: number;
      status: 'met' | 'at_risk' | 'violated';
    };
  };
  alerts: {
    critical: number;
    warning: number;
    recent: Array<{
      id: string;
      severity: string;
      message: string;
      timestamp: number;
      component: string;
    }>;
  };
}

export interface SLOConfig {
  availability_target: number; // 99.9%
  latency_p95_target: number; // 100ms
  error_rate_target: number; // 1%
  memory_usage_target: number; // 80%
  cpu_usage_target: number; // 70%
}

class PerformanceDashboard extends EventEmitter {
  private static instance: PerformanceDashboard;
  private metricsHistory: DashboardMetrics[] = [];
  private updateInterval?: NodeJS.Timeout;
  private initialized = false;
  private sloConfig: SLOConfig = {
    availability_target: 99.9,
    latency_p95_target: 100,
    error_rate_target: 1,
    memory_usage_target: 80,
    cpu_usage_target: 70,
  };
  private startTime = Date.now();
  private requestCounts = new Map<string, number>();
  private responseTimes: number[] = [];
  private errorCounts = new Map<string, number>();

  private constructor() {
    super();
  }

  static getInstance(): PerformanceDashboard {
    if (!PerformanceDashboard.instance) {
      PerformanceDashboard.instance = new PerformanceDashboard();
    }
    return PerformanceDashboard.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Performance dashboard already initialized', 'PERF_DASHBOARD');
      return;
    }

    // Start metrics collection
    this.updateInterval = setInterval(() => {
      this.collectMetrics();
    }, 30 * 1000); // Every 30 seconds

    // Initial metrics collection
    await this.collectMetrics();

    this.initialized = true;
    logger.info('Performance dashboard initialized', 'PERF_DASHBOARD');
    this.emit('initialized');
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // Collect all metrics
      const rumMetrics = realUserMonitoring.getMetricsSummary(60 * 1000); // Last minute
      const performanceStats = performanceMonitor.getStatistics();
      const errorStats = errorTracker.getStatistics(60 * 1000);
      const groceryMetrics = groceryAgentMetrics.exportAllMetrics();
      const resourceUsage = performanceMonitor.monitorResourceUsage();

      // Calculate overview metrics
      const uptime = timestamp - this.startTime;
      const totalRequests = rumMetrics.user_metrics.total_sessions;
      const errorRate = rumMetrics.user_metrics.error_rate * 100;
      const avgResponseTime = rumMetrics.user_metrics.avg_load_time;
      const activeUsers = rumMetrics.user_metrics.unique_users;

      // Determine system status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (errorRate > 10 || avgResponseTime > 5000) {
        status = 'unhealthy';
      } else if (errorRate > 5 || avgResponseTime > 2000) {
        status = 'degraded';
      }

      // Calculate SLO status
      const availability = this.calculateAvailability();
      const latencyP95 = this.calculateP95Latency();
      const currentErrorRate = errorRate;

      const dashboardMetrics: DashboardMetrics = {
        timestamp,
        overview: {
          status,
          uptime,
          totalRequests,
          errorRate,
          avgResponseTime,
          activeUsers,
        },
        performance: {
          api: {
            requests_per_minute: totalRequests,
            avg_response_time: avgResponseTime,
            p95_response_time: latencyP95,
            p99_response_time: this.calculateP99Latency(),
            error_rate: errorRate,
            slowest_endpoints: this.getSlowestEndpoints(performanceStats),
          },
          frontend: {
            avg_load_time: rumMetrics.user_metrics.avg_load_time,
            avg_fcp: rumMetrics.user_metrics.avg_fcp,
            avg_lcp: rumMetrics.user_metrics.avg_lcp,
            avg_fid: rumMetrics.user_metrics.avg_fid,
            avg_cls: rumMetrics.user_metrics.avg_cls,
            bounce_rate: rumMetrics.user_metrics.bounce_rate,
            device_breakdown: rumMetrics.device_distribution,
          },
          database: {
            query_count: this.getDatabaseQueryCount(),
            avg_query_time: this.getAvgDatabaseQueryTime(),
            slow_queries: this.getSlowQueries(),
            connection_pool_usage: this.getConnectionPoolUsage(),
          },
          websocket: {
            active_connections: this.getActiveWebSocketConnections(),
            messages_per_minute: this.getWebSocketMessageRate(),
            avg_message_latency: this.getAvgWebSocketLatency(),
            connection_errors: this.getWebSocketErrors(),
          },
          business: {
            search_success_rate: this.calculateSuccessRate(groceryMetrics.nlp?.successfulParses, groceryMetrics.nlp?.totalQueries),
            product_match_rate: this.calculateSuccessRate(groceryMetrics.product?.successfulMatches, groceryMetrics.product?.totalSearches),
            price_fetch_success_rate: this.calculateSuccessRate(groceryMetrics.price?.successfulFetches, groceryMetrics.price?.totalRequests),
            nlp_accuracy: groceryMetrics.nlp?.accuracy || 0,
            cart_conversion_rate: rumMetrics.business_metrics.conversion_rate,
          },
        },
        resources: {
          memory: {
            used_mb: Math.round(resourceUsage.memory.heapUsed / 1024 / 1024),
            total_mb: Math.round(resourceUsage.memory.heapTotal / 1024 / 1024),
            usage_percent: Math.round((resourceUsage.memory.heapUsed / resourceUsage.memory.heapTotal) * 100),
            heap_used_mb: Math.round(resourceUsage.memory.heapUsed / 1024 / 1024),
            heap_total_mb: Math.round(resourceUsage.memory.heapTotal / 1024 / 1024),
          },
          cpu: {
            usage_percent: this.calculateCpuUsage(resourceUsage.cpu),
            load_average: process.platform === 'linux' ? require('os').loadavg() : [0, 0, 0],
          },
          disk: {
            usage_percent: await this.getDiskUsage(),
            available_gb: await this.getAvailableDiskSpace(),
          },
        },
        slos: {
          availability: {
            target: this.sloConfig.availability_target,
            current: availability,
            status: this.getSLOStatus(availability, this.sloConfig.availability_target),
          },
          latency: {
            target_p95: this.sloConfig.latency_p95_target,
            current_p95: latencyP95,
            status: this.getSLOStatus(latencyP95, this.sloConfig.latency_p95_target, true),
          },
          error_rate: {
            target: this.sloConfig.error_rate_target,
            current: currentErrorRate,
            status: this.getSLOStatus(currentErrorRate, this.sloConfig.error_rate_target, true),
          },
        },
        alerts: {
          critical: this.getCriticalAlertCount(),
          warning: this.getWarningAlertCount(),
          recent: this.getRecentAlerts(),
        },
      };

      // Store metrics
      this.metricsHistory.push(dashboardMetrics);
      
      // Keep only last 100 entries (about 50 minutes of data)
      if (this.metricsHistory.length > 100) {
        this.metricsHistory = this.metricsHistory.slice(-100);
      }

      // Emit metrics update
      this.emit('metrics-updated', dashboardMetrics);

      // Check for SLO violations
      this.checkSLOViolations(dashboardMetrics);

      logger.debug('Dashboard metrics collected', 'PERF_DASHBOARD', {
        status: dashboardMetrics.overview.status,
        requests: dashboardMetrics.overview.totalRequests,
        error_rate: dashboardMetrics.overview.errorRate,
        avg_response_time: dashboardMetrics.overview.avgResponseTime,
      });

    } catch (error) {
      logger.error('Failed to collect dashboard metrics', 'PERF_DASHBOARD', {}, error as Error);
    }
  }

  private calculateSuccessRate(successes?: number, total?: number): number {
    if (!total || total === 0) return 0;
    return Math.round((successes || 0) / total * 100);
  }

  private calculateAvailability(): number {
    // Calculate availability based on successful requests vs total requests
    const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    if (totalRequests === 0) return 100;
    return Math.round(((totalRequests - totalErrors) / totalRequests) * 100 * 100) / 100;
  }

  private calculateP95Latency(): number {
    if (this.responseTimes.length === 0) return 0;
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || 0;
  }

  private calculateP99Latency(): number {
    if (this.responseTimes.length === 0) return 0;
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.99);
    return sorted[index] || 0;
  }

  private calculateCpuUsage(cpuUsage: { user: number; system: number }): number {
    // Simple CPU usage calculation - in a real system, this would be more sophisticated
    return Math.round(((cpuUsage.user + cpuUsage.system) / 1000000) * 100) / 100;
  }

  private getSlowestEndpoints(performanceStats: any): Array<{ endpoint: string; avg_time: number; count: number }> {
    return Object.entries(performanceStats)
      .map(([endpoint, stats]: [string, any]) => ({
        endpoint,
        avg_time: Math.round(stats.avg || 0),
        count: stats.count || 0,
      }))
      .sort((a, b) => b.avg_time - a.avg_time)
      .slice(0, 5);
  }

  private getDatabaseQueryCount(): number {
    // This would normally come from database metrics
    return 0; // Placeholder
  }

  private getAvgDatabaseQueryTime(): number {
    // This would normally come from database metrics
    return 0; // Placeholder
  }

  private getSlowQueries(): Array<{ query: string; avg_time: number; count: number }> {
    // This would normally come from database metrics
    return []; // Placeholder
  }

  private getConnectionPoolUsage(): number {
    // This would normally come from database connection pool metrics
    return 0; // Placeholder
  }

  private getActiveWebSocketConnections(): number {
    // This would normally come from WebSocket metrics
    return 0; // Placeholder
  }

  private getWebSocketMessageRate(): number {
    // This would normally come from WebSocket metrics
    return 0; // Placeholder
  }

  private getAvgWebSocketLatency(): number {
    // This would normally come from WebSocket metrics
    return 0; // Placeholder
  }

  private getWebSocketErrors(): number {
    // This would normally come from WebSocket metrics
    return 0; // Placeholder
  }

  private async getDiskUsage(): Promise<number> {
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'linux' || process.platform === 'darwin') {
        const output = execSync('df -h / | tail -1').toString();
        const usage = output.split(/\s+/)[4];
        return parseInt(usage.replace('%', ''));
      }
    } catch (error) {
      // Fallback
    }
    return 0;
  }

  private async getAvailableDiskSpace(): Promise<number> {
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'linux' || process.platform === 'darwin') {
        const output = execSync('df -BG / | tail -1').toString();
        const available = output.split(/\s+/)[3];
        return parseInt(available.replace('G', ''));
      }
    } catch (error) {
      // Fallback
    }
    return 0;
  }

  private getSLOStatus(current: number, target: number, isReversed = false): 'met' | 'at_risk' | 'violated' {
    const threshold = target * 0.9; // 90% of target is "at risk"
    
    if (isReversed) {
      // For metrics where lower is better (latency, error rate)
      if (current <= target) return 'met';
      if (current <= target * 1.5) return 'at_risk';
      return 'violated';
    } else {
      // For metrics where higher is better (availability)
      if (current >= target) return 'met';
      if (current >= threshold) return 'at_risk';
      return 'violated';
    }
  }

  private getCriticalAlertCount(): number {
    // This would normally come from alert system
    return 0; // Placeholder
  }

  private getWarningAlertCount(): number {
    // This would normally come from alert system
    return 0; // Placeholder
  }

  private getRecentAlerts(): Array<{ id: string; severity: string; message: string; timestamp: number; component: string }> {
    // This would normally come from alert system
    return []; // Placeholder
  }

  private checkSLOViolations(metrics: DashboardMetrics): void {
    const violations: string[] = [];

    if (metrics.slos.availability.status === 'violated') {
      violations.push(`Availability SLO violated: ${metrics.slos.availability.current}% < ${metrics.slos.availability.target}%`);
    }

    if (metrics.slos.latency.status === 'violated') {
      violations.push(`Latency SLO violated: P95 ${metrics.slos.latency.current_p95}ms > ${metrics.slos.latency.target_p95}ms`);
    }

    if (metrics.slos.error_rate.status === 'violated') {
      violations.push(`Error rate SLO violated: ${metrics.slos.error_rate.current}% > ${metrics.slos.error_rate.target}%`);
    }

    if (violations.length > 0) {
      this.emit('slo-violation', {
        violations,
        timestamp: metrics.timestamp,
        metrics,
      });

      logger.warn('SLO violations detected', 'PERF_DASHBOARD', {
        violations,
        availability: metrics.slos.availability,
        latency: metrics.slos.latency,
        error_rate: metrics.slos.error_rate,
      });
    }
  }

  // Public API methods
  getCurrentMetrics(): DashboardMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  getMetricsHistory(limit: number = 50): DashboardMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  getSLOSummary(timeWindow: number = 24 * 60 * 60 * 1000): any {
    const cutoff = Date.now() - timeWindow;
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp > cutoff);
    
    if (relevantMetrics.length === 0) {
      return null;
    }

    const totalPoints = relevantMetrics.length;
    const availabilityMet = relevantMetrics.filter(m => m.slos.availability.status === 'met').length;
    const latencyMet = relevantMetrics.filter(m => m.slos.latency.status === 'met').length;
    const errorRateMet = relevantMetrics.filter(m => m.slos.error_rate.status === 'met').length;

    return {
      time_window_hours: timeWindow / (60 * 60 * 1000),
      total_measurements: totalPoints,
      slo_compliance: {
        availability: {
          target: this.sloConfig.availability_target,
          compliance_percentage: Math.round((availabilityMet / totalPoints) * 100),
          status: availabilityMet / totalPoints >= 0.95 ? 'met' : 'violated',
        },
        latency: {
          target: this.sloConfig.latency_p95_target,
          compliance_percentage: Math.round((latencyMet / totalPoints) * 100),
          status: latencyMet / totalPoints >= 0.95 ? 'met' : 'violated',
        },
        error_rate: {
          target: this.sloConfig.error_rate_target,
          compliance_percentage: Math.round((errorRateMet / totalPoints) * 100),
          status: errorRateMet / totalPoints >= 0.95 ? 'met' : 'violated',
        },
      },
    };
  }

  updateSLOConfig(config: Partial<SLOConfig>): void {
    this.sloConfig = { ...this.sloConfig, ...config };
    logger.info('SLO configuration updated', 'PERF_DASHBOARD', config);
  }

  recordRequest(endpoint: string, responseTime: number, isError: boolean): void {
    const count = this.requestCounts.get(endpoint) || 0;
    this.requestCounts.set(endpoint, count + 1);
    
    this.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times for memory efficiency
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    if (isError) {
      const errorCount = this.errorCounts.get(endpoint) || 0;
      this.errorCounts.set(endpoint, errorCount + 1);
    }
  }

  reset(): void {
    this.requestCounts.clear();
    this.responseTimes = [];
    this.errorCounts.clear();
    this.metricsHistory = [];
    this.startTime = Date.now();
    logger.info('Performance dashboard metrics reset', 'PERF_DASHBOARD');
  }

  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.initialized = false;
    logger.info('Performance dashboard shut down', 'PERF_DASHBOARD');
  }
}

export const performanceDashboard = PerformanceDashboard.getInstance();
export { PerformanceDashboard };
