/**
 * Product Matching Performance Metrics and Monitoring
 * 
 * Real-time performance tracking for product matching algorithms
 * Provides insights into:
 * - Response times
 * - Cache effectiveness
 * - Accuracy metrics
 * - Resource utilization
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import { OptimizedProductMatchingAlgorithm } from '../services/OptimizedProductMatchingAlgorithm.js';
import { SmartMatchingServiceOptimized } from '../services/SmartMatchingServiceOptimized.js';

export interface PerformanceMetric {
  timestamp: Date;
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

export interface AggregatedMetrics {
  period: string;
  startTime: Date;
  endTime: Date;
  metrics: {
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalRequests: number;
    cacheHitRate: number;
    errorRate: number;
    throughput: number;
  };
}

export interface AlertRule {
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  windowSize: number; // seconds
  severity: 'info' | 'warning' | 'critical';
}

export interface Alert {
  id: string;
  rule: AlertRule;
  value: number;
  timestamp: Date;
  message: string;
  resolved: boolean;
}

export class ProductMatchingMetrics extends EventEmitter {
  private static instance: ProductMatchingMetrics;
  private metrics: PerformanceMetric[] = [];
  private responseTimes: number[] = [];
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private metricsRetentionHours = 24;
  private collectionInterval: NodeJS.Timeout | undefined = undefined;
  
  // Services to monitor
  private optimizedAlgorithm: OptimizedProductMatchingAlgorithm;
  private optimizedService: SmartMatchingServiceOptimized;
  
  // Metric collectors
  private requestCount = 0;
  private errorCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  
  private constructor() {
    super();
    this.optimizedAlgorithm = OptimizedProductMatchingAlgorithm.getOptimizedInstance();
    this.optimizedService = SmartMatchingServiceOptimized.getOptimizedInstance();
    
    this.initializeAlertRules();
    this.startMetricsCollection();
    this.startCleanup();
  }
  
  static getInstance(): ProductMatchingMetrics {
    if (!ProductMatchingMetrics.instance) {
      ProductMatchingMetrics.instance = new ProductMatchingMetrics();
    }
    return ProductMatchingMetrics.instance;
  }
  
  /**
   * Initialize default alert rules
   */
  private initializeAlertRules(): void {
    this.alertRules = [
      {
        name: 'High Response Time',
        metric: 'avgResponseTime',
        threshold: 500, // ms
        operator: 'gt',
        windowSize: 300, // 5 minutes
        severity: 'warning'
      },
      {
        name: 'Critical Response Time',
        metric: 'p99ResponseTime',
        threshold: 1000, // ms
        operator: 'gt',
        windowSize: 300,
        severity: 'critical'
      },
      {
        name: 'Low Cache Hit Rate',
        metric: 'cacheHitRate',
        threshold: 0.5, // 50%
        operator: 'lt',
        windowSize: 600, // 10 minutes
        severity: 'warning'
      },
      {
        name: 'High Error Rate',
        metric: 'errorRate',
        threshold: 0.05, // 5%
        operator: 'gt',
        windowSize: 300,
        severity: 'critical'
      },
      {
        name: 'Low Throughput',
        metric: 'throughput',
        threshold: 10, // requests per second
        operator: 'lt',
        windowSize: 600,
        severity: 'info'
      }
    ];
  }
  
  /**
   * Start collecting metrics periodically
   */
  private startMetricsCollection(): void {
    // Collect every 10 seconds
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, 10000);
  }
  
  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    const timestamp = new Date();
    
    // Get algorithm stats
    const algorithmStats = this.optimizedAlgorithm.getPerformanceStats();
    
    // Record metrics
    this.recordMetric({
      timestamp,
      name: 'cache_hit_rate',
      value: algorithmStats.cacheHitRate,
      unit: 'ratio'
    });
    
    this.recordMetric({
      timestamp,
      name: 'avg_calculation_time',
      value: algorithmStats.avgCalculationTime,
      unit: 'ms'
    });
    
    this.recordMetric({
      timestamp,
      name: 'total_calculations',
      value: algorithmStats.totalCalculations,
      unit: 'count'
    });
    
    this.recordMetric({
      timestamp,
      name: 'cache_size',
      value: algorithmStats.cacheSize,
      unit: 'entries'
    });
    
    // Calculate derived metrics
    if (this.responseTimes.length > 0) {
      const sorted = [...this.responseTimes].sort((a, b) => a - b);
      
      this.recordMetric({
        timestamp,
        name: 'p50_response_time',
        value: this.percentile(sorted, 0.5),
        unit: 'ms'
      });
      
      this.recordMetric({
        timestamp,
        name: 'p95_response_time',
        value: this.percentile(sorted, 0.95),
        unit: 'ms'
      });
      
      this.recordMetric({
        timestamp,
        name: 'p99_response_time',
        value: this.percentile(sorted, 0.99),
        unit: 'ms'
      });
    }
    
    // Calculate throughput
    const throughput = this.requestCount / 10; // requests per second
    this.recordMetric({
      timestamp,
      name: 'throughput',
      value: throughput,
      unit: 'rps'
    });
    
    // Calculate error rate
    const errorRate = this.requestCount > 0 
      ? this.errorCount / this.requestCount 
      : 0;
    
    this.recordMetric({
      timestamp,
      name: 'error_rate',
      value: errorRate,
      unit: 'ratio'
    });
    
    // Reset counters
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }
  
  /**
   * Record a metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    this.emit('metric', metric);
  }
  
  /**
   * Record a request
   */
  recordRequest(responseTime: number, success: boolean = true): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);
    
    if (!success) {
      this.errorCount++;
    }
    
    // Record immediate metric for real-time monitoring
    this.recordMetric({
      timestamp: new Date(),
      name: 'response_time',
      value: responseTime,
      unit: 'ms',
      tags: { success: success.toString() }
    });
  }
  
  /**
   * Record cache activity
   */
  recordCacheActivity(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }
  
  /**
   * Check alert rules
   */
  private checkAlerts(): void {
    const now = new Date();
    
    for (const rule of this.alertRules) {
      const windowStart = new Date(now.getTime() - rule.windowSize * 1000);
      const windowMetrics = this.getMetricsInWindow(rule.metric, windowStart, now);
      
      if (windowMetrics.length === 0) continue;
      
      const avgValue = windowMetrics.reduce((sum, m) => sum + m.value, 0) / windowMetrics.length;
      const shouldAlert = this.evaluateRule(avgValue, rule);
      
      const alertId = `${rule.name}-${rule.metric}`;
      const existingAlert = this.activeAlerts.get(alertId);
      
      if (shouldAlert && !existingAlert) {
        // Create new alert
        const alert: Alert = {
          id: alertId,
          rule,
          value: avgValue,
          timestamp: now,
          message: `${rule.name}: ${rule.metric} is ${avgValue.toFixed(2)} (threshold: ${rule.threshold})`,
          resolved: false
        };
        
        this.activeAlerts.set(alertId, alert);
        this.emit('alert', alert);
        
        logger.warn("Performance alert triggered", "METRICS", {
          alert: alert.message,
          severity: rule.severity
        });
      } else if (!shouldAlert && existingAlert && !existingAlert.resolved) {
        // Resolve existing alert
        existingAlert.resolved = true;
        this.emit('alert-resolved', existingAlert);
        
        logger.info("Performance alert resolved", "METRICS", {
          alert: existingAlert.message
        });
      }
    }
  }
  
  /**
   * Evaluate alert rule
   */
  private evaluateRule(value: number, rule: AlertRule): boolean {
    switch (rule.operator) {
      case 'gt': return value > rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'gte': return value >= rule.threshold;
      case 'lte': return value <= rule.threshold;
      case 'eq': return value === rule.threshold;
      default: return false;
    }
  }
  
  /**
   * Get metrics within a time window
   */
  private getMetricsInWindow(
    metricName: string,
    start: Date,
    end: Date
  ): PerformanceMetric[] {
    return this.metrics.filter(m => 
      m.name === metricName &&
      m.timestamp >= start &&
      m.timestamp <= end
    );
  }
  
  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }
  
  /**
   * Get aggregated metrics for a period
   */
  getAggregatedMetrics(periodMinutes: number = 60): AggregatedMetrics {
    const now = new Date();
    const startTime = new Date(now.getTime() - periodMinutes * 60 * 1000);
    
    const periodMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= now
    );
    
    // Calculate aggregates
    const responseTimes = periodMetrics
      .filter(m => m.name === 'response_time')
      .map(m => m.value);
    
    const sorted = responseTimes.sort((a, b) => a - b);
    
    const cacheHitRates = periodMetrics
      .filter(m => m.name === 'cache_hit_rate')
      .map(m => m.value);
    
    const errorRates = periodMetrics
      .filter(m => m.name === 'error_rate')
      .map(m => m.value);
    
    const throughputs = periodMetrics
      .filter(m => m.name === 'throughput')
      .map(m => m.value);
    
    return {
      period: `${periodMinutes} minutes`,
      startTime,
      endTime: now,
      metrics: {
        avgResponseTime: responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
        p50ResponseTime: this.percentile(sorted, 0.5),
        p95ResponseTime: this.percentile(sorted, 0.95),
        p99ResponseTime: this.percentile(sorted, 0.99),
        totalRequests: responseTimes.length,
        cacheHitRate: cacheHitRates.length > 0
          ? cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length
          : 0,
        errorRate: errorRates.length > 0
          ? errorRates.reduce((a, b) => a + b, 0) / errorRates.length
          : 0,
        throughput: throughputs.length > 0
          ? throughputs.reduce((a, b) => a + b, 0) / throughputs.length
          : 0
      }
    };
  }
  
  /**
   * Get current health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    metrics: AggregatedMetrics;
  } {
    const metrics = this.getAggregatedMetrics(5); // Last 5 minutes
    const issues: string[] = [];
    
    // Check health criteria
    if (metrics.metrics.avgResponseTime > 500) {
      issues.push(`High average response time: ${metrics.metrics.avgResponseTime.toFixed(0)}ms`);
    }
    
    if (metrics.metrics.p99ResponseTime > 1000) {
      issues.push(`High P99 response time: ${metrics.metrics.p99ResponseTime.toFixed(0)}ms`);
    }
    
    if (metrics.metrics.cacheHitRate < 0.5) {
      issues.push(`Low cache hit rate: ${(metrics.metrics.cacheHitRate * 100).toFixed(1)}%`);
    }
    
    if (metrics.metrics.errorRate > 0.05) {
      issues.push(`High error rate: ${(metrics.metrics.errorRate * 100).toFixed(1)}%`);
    }
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length <= 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    return {
      status,
      issues,
      metrics
    };
  }
  
  /**
   * Export metrics for external monitoring
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.exportPrometheusMetrics();
    }
    
    const aggregated = this.getAggregatedMetrics(60);
    return JSON.stringify(aggregated, null, 2);
  }
  
  /**
   * Export metrics in Prometheus format
   */
  private exportPrometheusMetrics(): string {
    const lines: string[] = [];
    const timestamp = Date.now();
    
    // Get current stats
    const stats = this.optimizedAlgorithm.getPerformanceStats();
    const aggregated = this.getAggregatedMetrics(5);
    
    // Format metrics
    lines.push('# HELP product_matching_response_time Response time in milliseconds');
    lines.push('# TYPE product_matching_response_time histogram');
    lines.push(`product_matching_response_time_avg ${aggregated.metrics.avgResponseTime} ${timestamp}`);
    lines.push(`product_matching_response_time_p50 ${aggregated.metrics.p50ResponseTime} ${timestamp}`);
    lines.push(`product_matching_response_time_p95 ${aggregated.metrics.p95ResponseTime} ${timestamp}`);
    lines.push(`product_matching_response_time_p99 ${aggregated.metrics.p99ResponseTime} ${timestamp}`);
    
    lines.push('# HELP product_matching_cache_hit_rate Cache hit rate');
    lines.push('# TYPE product_matching_cache_hit_rate gauge');
    lines.push(`product_matching_cache_hit_rate ${stats.cacheHitRate} ${timestamp}`);
    
    lines.push('# HELP product_matching_requests_total Total number of requests');
    lines.push('# TYPE product_matching_requests_total counter');
    lines.push(`product_matching_requests_total ${aggregated.metrics.totalRequests} ${timestamp}`);
    
    lines.push('# HELP product_matching_error_rate Error rate');
    lines.push('# TYPE product_matching_error_rate gauge');
    lines.push(`product_matching_error_rate ${aggregated.metrics.errorRate} ${timestamp}`);
    
    lines.push('# HELP product_matching_throughput Requests per second');
    lines.push('# TYPE product_matching_throughput gauge');
    lines.push(`product_matching_throughput ${aggregated.metrics.throughput} ${timestamp}`);
    
    return lines.join('\n');
  }
  
  /**
   * Start cleanup process for old metrics
   */
  private startCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - this.metricsRetentionHours * 60 * 60 * 1000);
      const beforeCount = this.metrics.length;
      
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      
      const removed = beforeCount - this.metrics.length;
      if (removed > 0) {
        logger.info("Cleaned up old metrics", "METRICS", {
          removed,
          remaining: this.metrics.length
        });
      }
    }, 60 * 60 * 1000); // Every hour
  }
  
  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    logger.info("Alert rule added", "METRICS", { rule });
  }
  
  /**
   * Remove alert rule
   */
  removeAlertRule(name: string): void {
    this.alertRules = this.alertRules.filter(r => r.name !== name);
    logger.info("Alert rule removed", "METRICS", { name });
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }
  
  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.responseTimes = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    logger.info("All metrics cleared", "METRICS");
  }
  
  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }
    
    logger.info("Metrics collection stopped", "METRICS");
  }
}

// Export singleton instance
export const productMatchingMetrics = ProductMatchingMetrics.getInstance();