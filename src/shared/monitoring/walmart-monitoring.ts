/**
 * Walmart Grocery Monitoring and Observability System
 * Comprehensive monitoring for all Walmart operations
 *
 * Integration Coordinator: Real-time monitoring and alerting
 */

import { EventEmitter } from "events";
import { logger } from "../../utils/logger";
import type { Timestamp } from "../types";
// Removed unused import for cleaner code

// =====================================================
// Core Monitoring Types
// =====================================================

export interface WalmartMetric {
  name: string;
  value: number;
  timestamp: Timestamp;
  tags: Record<string, string>;
  unit?: string;
  type: MetricType;
}

export type MetricType = "counter" | "gauge" | "histogram" | "timer" | "rate";

export interface WalmartAlert {
  id: string;
  name: string;
  severity: AlertSeverity;
  message: string;
  timestamp: Timestamp;
  resolved: boolean;
  metadata: Record<string, unknown>;
  conditions: AlertCondition[];
}

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface AlertCondition {
  metric: string;
  operator: "gt" | "lt" | "eq" | "gte" | "lte" | "ne";
  threshold: number;
  duration?: number; // seconds
}

export interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  timestamp: Timestamp;
  error?: string;
  metadata?: Record<string, unknown>;
}

// =====================================================
// Monitoring System
// =====================================================

export class WalmartMonitoringSystem extends EventEmitter {
  private static instance: WalmartMonitoringSystem;
  private metrics: Map<string, WalmartMetric[]>;
  private alerts: Map<string, WalmartAlert>;
  private healthChecks: Map<string, HealthCheck>;
  private alertRules: Map<string, AlertRule>;
  private collectors: Map<string, MetricCollector>;
  private storage: MetricStorageInterface;
  private config: MonitoringConfig;

  private constructor(config: MonitoringConfig) {
    super();
    this.metrics = new Map();
    this.alerts = new Map();
    this.healthChecks = new Map();
    this.alertRules = new Map();
    this.collectors = new Map();
    this.config = config;
    this.storage = new MetricStorage(config.storage);

    this.initializeDefaultMetrics();
    this.initializeDefaultAlerts();
    this.startPeriodicTasks();
  }

  static create(config: MonitoringConfig): WalmartMonitoringSystem {
    if (!WalmartMonitoringSystem.instance) {
      WalmartMonitoringSystem.instance = new WalmartMonitoringSystem(config);
    }
    return WalmartMonitoringSystem.instance;
  }

  static getInstance(): WalmartMonitoringSystem {
    if (!WalmartMonitoringSystem.instance) {
      throw new Error(
        "Monitoring system not initialized. Call create() first.",
      );
    }
    return WalmartMonitoringSystem.instance;
  }

  // =====================================================
  // Metric Collection
  // =====================================================

  recordMetric(metric: Omit<WalmartMetric, "timestamp">): void {
    const fullMetric: WalmartMetric = {
      ...metric,
      timestamp: new Date().toISOString(),
    };

    // Store in memory
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricHistory = this.metrics.get(metric.name)!;
    metricHistory.push(fullMetric);

    // Keep only recent metrics in memory
    if (metricHistory.length > this.config.metrics.maxHistorySize) {
      metricHistory.shift();
    }

    // Store in persistent storage
    this.storage.storeMetric(fullMetric);

    // Check alert conditions
    this.checkAlertConditions(fullMetric);

    // Emit event
    this.emit("metric", fullMetric);

    logger.debug("Metric recorded", "WALMART_MONITORING", {
      name: metric.name,
      value: metric.value,
      tags: metric.tags,
    });
  }

  increment(name: string, value = 1, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      value,
      tags,
      type: "counter",
    });
  }

  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      value,
      tags,
      type: "gauge",
    });
  }

  histogram(
    name: string,
    value: number,
    tags: Record<string, string> = {},
  ): void {
    this.recordMetric({
      name,
      value,
      tags,
      type: "histogram",
    });
  }

  timer<T>(
    name: string,
    fn: () => T | Promise<T>,
    tags: Record<string, string> = {},
  ): Promise<T> {
    const startTime = Date.now();

    const recordTime = (error?: boolean) => {
      const duration = Date.now() - startTime;
      this.recordMetric({
        name,
        value: duration,
        tags: { ...tags, error: error ? "true" : "false" },
        type: "timer",
        unit: "ms",
      });
    };

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((res) => {
            recordTime(false);
            return res;
          })
          .catch((err) => {
            recordTime(true);
            throw err;
          });
      } else {
        recordTime(false);
        return Promise.resolve(result);
      }
    } catch (error) {
      recordTime(true);
      throw error;
    }
  }

  // =====================================================
  // Alert Management
  // =====================================================

  createAlert(
    alert: Omit<WalmartAlert, "id" | "timestamp" | "resolved">,
  ): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullAlert: WalmartAlert = {
      ...alert,
      id: alertId,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.alerts.set(alertId, fullAlert);
    this.emit("alert", fullAlert);

    logger.warn("Alert created", "WALMART_MONITORING", {
      alertId,
      name: alert.name,
      severity: alert.severity,
      message: alert.message,
    });

    return alertId;
  }

  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.metadata.resolvedAt = new Date().toISOString();
    alert.metadata.resolvedBy = resolvedBy;

    this.emit("alert_resolved", alert);

    logger.info("Alert resolved", "WALMART_MONITORING", {
      alertId,
      name: alert.name,
      resolvedBy,
    });

    return true;
  }

  registerAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.name, rule);

    logger.info("Alert rule registered", "WALMART_MONITORING", {
      name: rule.name,
      conditions: rule.conditions,
    });
  }

  private checkAlertConditions(metric: WalmartMetric): void {
    for (const [ruleName, rule] of this.alertRules) {
      if (rule.metricName !== metric.name) continue;

      const shouldAlert = rule.conditions.every((condition) => {
        switch (condition.operator) {
          case "gt":
            return metric.value > condition.threshold;
          case "lt":
            return metric.value < condition.threshold;
          case "eq":
            return metric.value === condition.threshold;
          case "gte":
            return metric.value >= condition.threshold;
          case "lte":
            return metric.value <= condition.threshold;
          case "ne":
            return metric.value !== condition.threshold;
          default:
            return false;
        }
      });

      if (shouldAlert && !this.hasActiveAlert(ruleName)) {
        this.createAlert({
          name: rule.name,
          severity: rule.severity,
          message: rule.message.replace("{value}", metric.value.toString()),
          metadata: {
            metric: metric.name,
            value: metric.value,
            rule: ruleName,
          },
          conditions: rule.conditions,
        });
      }
    }
  }

  private hasActiveAlert(ruleName: string): boolean {
    return Array.from(this.alerts.values()).some(
      (alert) => alert.metadata.rule === ruleName && !alert.resolved,
    );
  }

  // =====================================================
  // Health Checks
  // =====================================================

  registerHealthCheck(name: string, check: HealthCheckFunction): void {
    const collector: MetricCollector = {
      name,
      collect: async () => {
        const startTime = Date.now();
        try {
          await check();
          const responseTime = Date.now() - startTime;

          const healthCheck: HealthCheck = {
            name,
            status: "healthy",
            responseTime,
            timestamp: new Date().toISOString(),
          };

          this.healthChecks.set(name, healthCheck);
          this.gauge(`health_check.${name}.response_time`, responseTime, {
            status: "healthy",
          });

          return [healthCheck];
        } catch (error) {
          const responseTime = Date.now() - startTime;
          const healthCheck: HealthCheck = {
            name,
            status: "unhealthy",
            responseTime,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          };

          this.healthChecks.set(name, healthCheck);
          this.gauge(`health_check.${name}.response_time`, responseTime, {
            status: "unhealthy",
          });

          return [healthCheck];
        }
      },
    };

    this.collectors.set(name, collector);
  }

  async runHealthChecks(): Promise<Record<string, HealthCheck>> {
    const results: Record<string, HealthCheck> = {};

    const promises = Array.from(this.collectors.entries()).map(
      async ([name, collector]) => {
        const checks = await collector.collect();
        results[name] = checks[0] as HealthCheck;
      },
    );

    await Promise.allSettled(promises);
    return results;
  }

  getHealthStatus(): SystemHealth {
    const checks = Array.from(this.healthChecks.values());
    const unhealthy = checks.filter((c) => c.status === "unhealthy").length;
    const degraded = checks.filter((c) => c.status === "degraded").length;

    let overallStatus: "healthy" | "degraded" | "unhealthy";
    if (unhealthy > 0) {
      overallStatus = "unhealthy";
    } else if (degraded > 0) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: Object.fromEntries(checks.map((check) => [check.name, check])),
      metrics: {
        totalChecks: checks.length,
        healthyChecks: checks.filter((c) => c.status === "healthy").length,
        degradedChecks: degraded,
        unhealthyChecks: unhealthy,
      },
    };
  }

  // =====================================================
  // Query Interface
  // =====================================================

  async queryMetrics(query: MetricQuery): Promise<MetricQueryResult> {
    const startTime = Date.now();

    try {
      // Query from storage for historical data
      const storageResults = await this.storage.query(query);

      // Also check in-memory metrics for recent data
      const memoryResults = this.queryMemoryMetrics(query);

      // Combine and deduplicate results
      const allMetrics = [...storageResults, ...memoryResults];
      const uniqueMetrics = this.deduplicateMetrics(allMetrics);

      // Apply aggregation if requested
      const aggregatedResults = query.aggregation
        ? this.aggregateMetrics(uniqueMetrics, query.aggregation)
        : uniqueMetrics;

      return {
        metrics: aggregatedResults,
        query,
        executionTime: Date.now() - startTime,
        totalResults: aggregatedResults.length,
      };
    } catch (error) {
      logger.error("Metric query failed", "WALMART_MONITORING", {
        query,
        error,
      });
      throw error;
    }
  }

  private queryMemoryMetrics(query: MetricQuery): WalmartMetric[] {
    const results: WalmartMetric[] = [];

    for (const [name, metrics] of this.metrics) {
      if (query.metricName && !name.includes(query.metricName)) continue;

      const filteredMetrics = metrics.filter((metric) => {
        // Time range filter
        if (query.timeRange) {
          const metricTime = new Date(metric.timestamp).getTime();
          const startTime = new Date(query.timeRange.start).getTime();
          const endTime = new Date(query.timeRange.end).getTime();

          if (metricTime < startTime || metricTime > endTime) return false;
        }

        // Tag filters
        if (query.tags) {
          return Object.entries(query.tags).every(
            ([key, value]) => metric.tags[key] === value,
          );
        }

        return true;
      });

      results.push(...filteredMetrics);
    }

    return results;
  }

  private deduplicateMetrics(metrics: WalmartMetric[]): WalmartMetric[] {
    const seen = new Set<string>();
    return metrics.filter((metric) => {
      const key = `${metric.name}_${metric.timestamp}_${JSON.stringify(metric.tags)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private aggregateMetrics(
    metrics: WalmartMetric[],
    aggregation: MetricAggregation,
  ): WalmartMetric[] {
    const grouped = new Map<string, WalmartMetric[]>();

    // Group metrics by name and interval
    for (const metric of metrics) {
      const interval = this.getTimeInterval(
        metric.timestamp,
        aggregation.interval,
      );
      const key = `${metric.name}_${interval}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    }

    // Aggregate each group
    const aggregated: WalmartMetric[] = [];
    for (const [key, groupMetrics] of grouped) {
      const [name, interval] = key.split("_");
      const values = groupMetrics.map((m) => m.value);

      let aggregatedValue: number;
      switch (aggregation.function) {
        case "sum":
          aggregatedValue = values.reduce((a, b) => a + b, 0);
          break;
        case "avg":
          aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case "min":
          aggregatedValue = Math.min(...values);
          break;
        case "max":
          aggregatedValue = Math.max(...values);
          break;
        case "count":
          aggregatedValue = values.length;
          break;
        default:
          aggregatedValue = values[0];
      }

      aggregated.push({
        name,
        value: aggregatedValue,
        timestamp: interval,
        tags: groupMetrics[0].tags,
        type: groupMetrics[0].type,
        unit: groupMetrics[0].unit,
      });
    }

    return aggregated;
  }

  private getTimeInterval(timestamp: string, interval: string): string {
    const date = new Date(timestamp);

    switch (interval) {
      case "1m":
        date.setSeconds(0, 0);
        break;
      case "5m":
        date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
        break;
      case "1h":
        date.setMinutes(0, 0, 0);
        break;
      case "1d":
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.toISOString();
  }

  // =====================================================
  // Dashboard Data
  // =====================================================

  async getDashboardData(): Promise<WalmartDashboardData> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get key metrics for the last hour
    const [
      searchRequests,
      cartOperations,
      orderPlacements,
      errors,
      responseTime,
    ] = await Promise.all([
      this.queryMetrics({
        metricName: "walmart.search.requests",
        timeRange: { start: oneHourAgo.toISOString(), end: now.toISOString() },
        aggregation: { function: "sum", interval: "5m" },
      }),
      this.queryMetrics({
        metricName: "walmart.cart.operations",
        timeRange: { start: oneHourAgo.toISOString(), end: now.toISOString() },
        aggregation: { function: "sum", interval: "5m" },
      }),
      this.queryMetrics({
        metricName: "walmart.order.placements",
        timeRange: { start: oneHourAgo.toISOString(), end: now.toISOString() },
        aggregation: { function: "sum", interval: "5m" },
      }),
      this.queryMetrics({
        metricName: "walmart.errors",
        timeRange: { start: oneHourAgo.toISOString(), end: now.toISOString() },
        aggregation: { function: "sum", interval: "5m" },
      }),
      this.queryMetrics({
        metricName: "walmart.response_time",
        timeRange: { start: oneHourAgo.toISOString(), end: now.toISOString() },
        aggregation: { function: "avg", interval: "5m" },
      }),
    ]);

    const health = this.getHealthStatus();
    const activeAlerts = Array.from(this.alerts.values()).filter(
      (a) => !a.resolved,
    );

    return {
      timestamp: now.toISOString(),
      health,
      alerts: activeAlerts,
      metrics: {
        searchRequests: searchRequests.metrics,
        cartOperations: cartOperations.metrics,
        orderPlacements: orderPlacements.metrics,
        errors: errors.metrics,
        responseTime: responseTime.metrics,
      },
      summary: {
        totalSearches: searchRequests.metrics.reduce(
          (sum, m) => sum + m.value,
          0,
        ),
        totalCartOps: cartOperations.metrics.reduce(
          (sum, m) => sum + m.value,
          0,
        ),
        totalOrders: orderPlacements.metrics.reduce(
          (sum, m) => sum + m.value,
          0,
        ),
        totalErrors: errors.metrics.reduce((sum, m) => sum + m.value, 0),
        avgResponseTime:
          responseTime.metrics.length > 0
            ? responseTime.metrics.reduce((sum, m) => sum + m.value, 0) /
              responseTime.metrics.length
            : 0,
      },
    };
  }

  // =====================================================
  // Default Metrics and Alerts
  // =====================================================

  private initializeDefaultMetrics(): void {
    // Register default health checks
    this.registerHealthCheck("walmart_api", async () => {
      // Check if Walmart API is accessible
      const response = await fetch("https://www.walmart.com/api/health", {
        timeout: 5000,
      });
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
    });

    this.registerHealthCheck("database", async () => {
      // Check database connectivity
      // Implementation depends on your database
    });

    this.registerHealthCheck("redis", async () => {
      // Check Redis connectivity
      // Implementation depends on your Redis setup
    });
  }

  private initializeDefaultAlerts(): void {
    // High error rate alert
    this.registerAlertRule({
      name: "high_error_rate",
      metricName: "walmart.errors",
      severity: "high",
      message: "High error rate detected: {value} errors/min",
      conditions: [
        {
          metric: "walmart.errors",
          operator: "gt",
          threshold: 10,
          duration: 300,
        },
      ],
    });

    // Slow response time alert
    this.registerAlertRule({
      name: "slow_response_time",
      metricName: "walmart.response_time",
      severity: "medium",
      message: "Slow response time detected: {value}ms average",
      conditions: [
        {
          metric: "walmart.response_time",
          operator: "gt",
          threshold: 2000,
          duration: 300,
        },
      ],
    });

    // Low search success rate
    this.registerAlertRule({
      name: "low_search_success_rate",
      metricName: "walmart.search.success_rate",
      severity: "high",
      message: "Low search success rate: {value}%",
      conditions: [
        {
          metric: "walmart.search.success_rate",
          operator: "lt",
          threshold: 95,
          duration: 600,
        },
      ],
    });
  }

  private startPeriodicTasks(): void {
    // Run health checks every minute
    setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        logger.error("Health check failed", "WALMART_MONITORING", { error });
      }
    }, 60000);

    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.config.metrics.retentionPeriod);

    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter((m) => new Date(m.timestamp) > cutoff);
      this.metrics.set(name, filtered);
    }
  }
}

// =====================================================
// Supporting Classes and Interfaces
// =====================================================

export interface AlertRule {
  name: string;
  metricName: string;
  severity: AlertSeverity;
  message: string;
  conditions: AlertCondition[];
}

export interface MetricCollector {
  name: string;
  collect(): Promise<(WalmartMetric | HealthCheck)[]>;
}

export interface MetricQuery {
  metricName?: string;
  timeRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  tags?: Record<string, string>;
  limit?: number;
  aggregation?: MetricAggregation;
}

export interface MetricAggregation {
  function: "sum" | "avg" | "min" | "max" | "count";
  interval: "1m" | "5m" | "1h" | "1d";
}

export interface MetricQueryResult {
  metrics: WalmartMetric[];
  query: MetricQuery;
  executionTime: number;
  totalResults: number;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Timestamp;
  checks: Record<string, HealthCheck>;
  metrics: {
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
  };
}

export interface WalmartDashboardData {
  timestamp: Timestamp;
  health: SystemHealth;
  alerts: WalmartAlert[];
  metrics: {
    searchRequests: WalmartMetric[];
    cartOperations: WalmartMetric[];
    orderPlacements: WalmartMetric[];
    errors: WalmartMetric[];
    responseTime: WalmartMetric[];
  };
  summary: {
    totalSearches: number;
    totalCartOps: number;
    totalOrders: number;
    totalErrors: number;
    avgResponseTime: number;
  };
}

export interface MonitoringConfig {
  metrics: {
    maxHistorySize: number;
    retentionPeriod: number; // milliseconds
  };
  storage: {
    type: "memory" | "redis" | "influxdb" | "prometheus";
    connectionString?: string;
    options?: Record<string, unknown>;
  };
  alerts: {
    enabled: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
  };
}

// Metric Storage Interface
export interface MetricStorageInterface {
  storeMetric(metric: WalmartMetric): Promise<void>;
  query(query: MetricQuery): Promise<WalmartMetric[]>;
}

// Simple in-memory implementation
class MetricStorage implements MetricStorageInterface {
  private storage: WalmartMetric[] = [];

  constructor(private config: MonitoringConfig["storage"]) {}

  async storeMetric(metric: WalmartMetric): Promise<void> {
    this.storage.push(metric);

    // Keep only recent metrics
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    this.storage = this.storage.filter((m) => new Date(m.timestamp) > cutoff);
  }

  async query(query: MetricQuery): Promise<WalmartMetric[]> {
    return this.storage
      .filter((metric) => {
        if (query.metricName && !metric.name.includes(query.metricName))
          return false;

        if (query.timeRange) {
          const metricTime = new Date(metric.timestamp).getTime();
          const startTime = new Date(query.timeRange.start).getTime();
          const endTime = new Date(query.timeRange.end).getTime();

          if (metricTime < startTime || metricTime > endTime) return false;
        }

        if (query.tags) {
          return Object.entries(query.tags).every(
            ([key, value]) => metric.tags[key] === value,
          );
        }

        return true;
      })
      .slice(0, query.limit || 1000);
  }
}

export type HealthCheckFunction = () => Promise<void>;

// Export default configuration
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  metrics: {
    maxHistorySize: 1000,
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  storage: {
    type: "memory",
  },
  alerts: {
    enabled: true,
  },
};

// Export convenience function
export function createWalmartMonitoring(
  config?: Partial<MonitoringConfig>,
): WalmartMonitoringSystem {
  const fullConfig = { ...DEFAULT_MONITORING_CONFIG, ...config };
  return WalmartMonitoringSystem.create(fullConfig);
}
