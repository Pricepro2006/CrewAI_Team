/**
 * Comprehensive Monitoring System Integration
 * Coordinates all monitoring components for the grocery agent
 */

import { sentryErrorTracker } from './SentryErrorTracker.js';
import { errorTracker } from './ErrorTracker.js';
import { performanceMonitor } from './PerformanceMonitor.js';
import { trpcPerformanceMonitor } from './TRPCPerformanceMonitor.js';
import { groceryAgentMetrics } from './GroceryAgentMetrics.js';
import { alertSystem } from './AlertSystem.js';
import { structuredLogger } from './StructuredLogger.js';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'node:events';

export interface MonitoringConfig {
  sentry?: {
    dsn: string;
    environment: string;
    release: string;
    tracesSampleRate: number;
    profilesSampleRate: number;
  };
  alerts?: {
    email?: {
      enabled: boolean;
      smtp: any;
      from: string;
      to: string[];
    };
    slack?: {
      enabled: boolean;
      webhookUrl: string;
      channel: string;
    };
    webhooks?: {
      url: string;
      headers?: Record<string, string>;
    }[];
  };
  logging?: {
    level: string;
    format: 'json' | 'text';
    elasticsearch?: {
      url: string;
      username?: string;
      password?: string;
    };
    aggregation?: {
      url: string;
      token: string;
    };
  };
  metrics?: {
    retentionHours: number;
    aggregationIntervalMinutes: number;
    alertThresholds: {
      nlpSuccessRate: number;
      productMatchRate: number;
      priceSuccessRate: number;
      responseTimeMs: number;
      errorRatePercent: number;
    };
  };
}

export class MonitoringSystem extends EventEmitter {
  private static instance: MonitoringSystem;
  private initialized = false;
  private config: MonitoringConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsReportInterval?: NodeJS.Timeout;

  private constructor(config: MonitoringConfig = {}) {
    super();
    this.config = config;
  }

  static getInstance(config?: MonitoringConfig): MonitoringSystem {
    if (!MonitoringSystem.instance) {
      MonitoringSystem.instance = new MonitoringSystem(config);
    }
    return MonitoringSystem.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Monitoring system already initialized', 'MONITORING_SYSTEM');
      return;
    }

    logger.info('Initializing comprehensive monitoring system', 'MONITORING_SYSTEM');

    try {
      // Configure alert system
      if (this?.config?.alerts) {
        alertSystem.updateConfig(this?.config?.alerts);
      }

      // Setup cross-component event handling
      this.setupEventHandlers();

      // Setup periodic health checks
      this.setupHealthChecks();

      // Setup metrics reporting
      this.setupMetricsReporting();

      // Setup alert monitoring
      this.setupAlertMonitoring();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.initialized = true;

      logger.info('Monitoring system initialized successfully', 'MONITORING_SYSTEM', {
        components: [
          'sentry',
          'error-tracker',
          'performance-monitor',
          'trpc-monitor',
          'grocery-metrics',
          'alert-system',
          'structured-logger',
        ],
      });

      this.emit('initialized');

      // Send initialization alert
      alertSystem.createAlert(
        'monitoring_system_initialized',
        'info',
        'Comprehensive monitoring system has been successfully initialized',
        'monitoring_system',
        {
          timestamp: new Date().toISOString(),
          components_count: 7,
          config: Object.keys(this.config),
        }
      );

    } catch (error) {
      logger.error('Failed to initialize monitoring system', 'MONITORING_SYSTEM', {}, error as Error);
      
      // Create critical alert for initialization failure
      alertSystem.createAlert(
        'monitoring_init_failure',
        'critical',
        `Monitoring system initialization failed: ${(error as Error).message}`,
        'monitoring_system',
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
        }
      );

      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Connect grocery metrics to alert system
    groceryAgentMetrics.on('alert', (alert: any) => {
      alertSystem.createAlert(
        alert.type,
        alert.severity,
        alert.message,
        'grocery_metrics',
        {
          current: alert.current,
          threshold: alert.threshold,
          metric_type: alert.type,
        }
      );
    });

    // Connect performance monitor to alert system
    performanceMonitor.on('threshold-exceeded', (event: any) => {
      alertSystem.createAlert(
        'performance_threshold_exceeded',
        event.severity === 'critical' ? 'critical' : 'warning',
        `Performance threshold exceeded for ${event.name}: ${event.duration}ms`,
        'performance_monitor',
        {
          operation: event.name,
          duration: event.duration,
          threshold: event.threshold,
          severity: event.severity,
        }
      );
    });

    // Connect error tracker to alert system
    errorTracker.on('critical-error', (error: any) => {
      alertSystem.createAlert(
        'critical_system_error',
        'critical',
        `Critical system error: ${error?.error?.message}`,
        error?.context?.component || 'unknown',
        {
          error_id: error.id,
          error_name: error?.error?.name,
          endpoint: error?.context?.endpoint,
          user_id: error?.context?.userId,
        }
      );
    });

    // Log all alerts for audit trail
    alertSystem.on('alert-created', (alert: any) => {
      structuredLogger.log(
        alert.severity === 'critical' ? 'critical' :
        alert.severity === 'error' ? 'error' :
        alert.severity === 'warning' ? 'warning' : 'info',
        `Alert created: ${alert.message}`,
        'alert_system',
        {
          operation: 'create_alert',
          data: {
            alert_id: alert.id,
            alert_type: alert.type,
            component: alert.component,
          },
          tags: ['alert', 'created', alert.severity],
        }
      );
    });

    alertSystem.on('alert-resolved', (alert: any) => {
      structuredLogger.info(
        `Alert resolved: ${alert.message}`,
        'alert_system',
        {
          operation: 'resolve_alert',
          data: {
            alert_id: alert.id,
            alert_type: alert.type,
            component: alert.component,
            resolution_time: alert.resolvedAt ? 
              new Date(alert.resolvedAt).getTime() - new Date(alert.timestamp).getTime() : 0,
          },
          tags: ['alert', 'resolved'],
        }
      );
    });
  }

  private setupHealthChecks(): void {
    // Run health checks every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30 * 1000);

    logger.info('Health check monitoring started', 'MONITORING_SYSTEM', {
      interval: '30s',
    });
  }

  private setupMetricsReporting(): void {
    // Report comprehensive metrics every 5 minutes
    this.metricsReportInterval = setInterval(() => {
      this.reportComprehensiveMetrics();
    }, 5 * 60 * 1000);

    logger.info('Metrics reporting started', 'MONITORING_SYSTEM', {
      interval: '5m',
    });
  }

  private setupAlertMonitoring(): void {
    // Monitor for alert patterns that might indicate systemic issues
    setInterval(() => {
      this.analyzeAlertPatterns();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    const healthStatus = {
      timestamp: new Date().toISOString(),
      overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      components: {} as Record<string, any>,
      duration: 0,
    };

    try {
      // Check error rates
      const errorStats = errorTracker.getStatistics(30 * 60 * 1000); // Last 30 minutes
      const errorRate = errorStats.total > 0 ? errorStats.unhandled / errorStats.total : 0;
      
      if (healthStatus?.components) {
        healthStatus.components.error_tracker = {
          status: errorRate > 0.1 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy',
          error_rate: errorRate,
          total_errors: errorStats.total,
          unhandled_errors: errorStats.unhandled,
        };
      }

      // Check performance metrics
      const perfStats = performanceMonitor.getStatistics();
      const avgResponseTime = Object.values(perfStats).length > 0 ? 
        Object.values(perfStats).reduce((sum: number, stat: any) => sum + stat.avg, 0) / Object.values(perfStats).length : 0;

      if (healthStatus?.components) {
        healthStatus.components.performance = {
          status: avgResponseTime > 2000 ? 'unhealthy' : avgResponseTime > 1000 ? 'degraded' : 'healthy',
          avg_response_time: avgResponseTime,
          monitored_operations: Object.keys(perfStats).length,
        };
      }

      // Check grocery metrics
      const groceryMetrics = groceryAgentMetrics.exportAllMetrics();
      const nlpSuccessRate = groceryMetrics?.nlp?.successfulParses / Math.max(groceryMetrics?.nlp?.totalQueries, 1);
      const priceSuccessRate = groceryMetrics?.price?.successfulFetches / Math.max(groceryMetrics?.price?.totalRequests, 1);

      if (healthStatus?.components) {
        healthStatus.components.grocery_agent = {
          status: (nlpSuccessRate < 0.8 || priceSuccessRate < 0.9) ? 'degraded' : 'healthy',
          nlp_success_rate: nlpSuccessRate,
          price_success_rate: priceSuccessRate,
          active_users: groceryMetrics?.session?.totalSessions,
        };
      }

      // Check system resources
      const resourceUsage = performanceMonitor.monitorResourceUsage();
      const memoryUsagePercent = (resourceUsage?.memory?.heapUsed / resourceUsage?.memory?.heapTotal) * 100;

      if (healthStatus?.components) {
        healthStatus.components.system_resources = {
          status: memoryUsagePercent > 90 ? 'unhealthy' : memoryUsagePercent > 75 ? 'degraded' : 'healthy',
          memory_usage_percent: memoryUsagePercent,
          memory_used_mb: resourceUsage?.memory?.heapUsed,
          cpu_user_ms: resourceUsage?.cpu?.user,
        };
      }

      // Determine overall health
      const componentStatuses = Object.values(healthStatus.components).map(c => c.status);
      if (componentStatuses.some(s => s === 'unhealthy')) {
        healthStatus.overall = 'unhealthy';
      } else if (componentStatuses.some(s => s === 'degraded')) {
        healthStatus.overall = 'degraded';
      }

      healthStatus.duration = Date.now() - startTime;

      // Log health status
      structuredLogger.log(
        healthStatus.overall === 'healthy' ? 'info' : 
        healthStatus.overall === 'degraded' ? 'warning' : 'error',
        `System health check completed: ${healthStatus.overall}`,
        'monitoring_system',
        {
          operation: 'health_check',
          duration: healthStatus.duration,
          data: healthStatus,
          tags: ['health', 'check', healthStatus.overall],
        }
      );

      // Create alert if system is unhealthy
      if (healthStatus.overall === 'unhealthy') {
        alertSystem.createAlert(
          'system_unhealthy',
          'critical',
          'System health check indicates unhealthy status',
          'monitoring_system',
          healthStatus
        );
      }

      this.emit('health-check-completed', healthStatus);

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Health check failed', 'MONITORING_SYSTEM', { duration }, error as Error);

      alertSystem.createAlert(
        'health_check_failure',
        'error',
        `Health check failed: ${(error as Error).message}`,
        'monitoring_system',
        {
          duration,
          error: (error as Error).message,
        }
      );
    }
  }

  private reportComprehensiveMetrics(): void {
    try {
      // Collect metrics from all systems
      const report = {
        timestamp: new Date().toISOString(),
        error_tracker: {
          stats: errorTracker.getStatistics(),
          aggregations: errorTracker.getAggregations(),
        },
        performance: performanceMonitor.getStatistics(),
        trpc: trpcPerformanceMonitor.exportMetrics(),
        grocery_metrics: groceryAgentMetrics.exportAllMetrics(),
        alerts: alertSystem.getAlertStats(),
        system_resources: performanceMonitor.monitorResourceUsage(),
      };

      // Send key metrics to external systems
      Object.entries(report.grocery_metrics).forEach(([category, metrics]) => {
        if (typeof metrics === 'object' && metrics !== null) {
          Object.entries(metrics).forEach(([key, value]) => {
            if (typeof value === 'number') {
              sentryErrorTracker.recordCustomMetric(`grocery_${category}_${key}`, value, {
                category,
                component: 'grocery_agent',
              });
            }
          });
        }
      });

      // Log comprehensive report
      structuredLogger.info(
        'Comprehensive metrics report generated',
        'monitoring_system',
        {
          operation: 'metrics_report',
          data: {
            total_errors: report?.error_tracker?.stats.total,
            avg_response_time: Object.values(report.performance).length > 0 ?
              Object.values(report.performance).reduce((sum: number, stat: any) => sum + stat.avg, 0) / Object.values(report.performance).length : 0,
            active_alerts: report?.alerts?.unresolved,
            memory_usage_mb: report?.system_resources?.memory.heapUsed,
          },
          tags: ['metrics', 'report', 'comprehensive'],
        }
      );

      this.emit('metrics-report-generated', report);

    } catch (error) {
      logger.error('Failed to generate metrics report', 'MONITORING_SYSTEM', {}, error as Error);
    }
  }

  private analyzeAlertPatterns(): void {
    try {
      const recentAlerts = alertSystem.getAlerts({ limit: 100 });
      const last30Minutes = recentAlerts?.filter(a => 
        Date.now() - new Date(a.timestamp).getTime() < 30 * 60 * 1000
      );

      // Check for alert storms (many alerts in short time)
      if (last30Minutes?.length || 0 > 20) {
        alertSystem.createAlert(
          'alert_storm_detected',
          'warning',
          `Alert storm detected: ${last30Minutes?.length || 0} alerts in last 30 minutes`,
          'monitoring_system',
          {
            alert_count: last30Minutes?.length || 0,
            time_window: '30 minutes',
            top_components: this.getTopAlertComponents(last30Minutes),
          }
        );
      }

      // Check for repeated failures
      const componentAlertCounts = last30Minutes.reduce((acc: any, alert: any) => {
        acc[alert.component] = (acc[alert.component] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(componentAlertCounts).forEach(([component, count]) => {
        if (count >= 5) {
          alertSystem.createAlert(
            'component_repeated_failures',
            'error',
            `Component ${component} has generated ${count} alerts in 30 minutes`,
            component,
            {
              alert_count: count,
              time_window: '30 minutes',
              component,
            }
          );
        }
      });

    } catch (error) {
      logger.error('Failed to analyze alert patterns', 'MONITORING_SYSTEM', {}, error as Error);
    }
  }

  private getTopAlertComponents(alerts: any[]): Array<{ component: string; count: number }> {
    const counts = alerts.reduce((acc: any, alert: any) => {
      acc[alert.component] = (acc[alert.component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([component, count]) => ({ component, count }));
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      logger.info('Shutting down monitoring system', 'MONITORING_SYSTEM');

      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.metricsReportInterval) {
        clearInterval(this.metricsReportInterval);
      }

      // Flush all pending data
      await Promise.all([
        structuredLogger.shutdown(),
        sentryErrorTracker.flush(),
      ]);

      logger.info('Monitoring system shutdown complete', 'MONITORING_SYSTEM');
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }

  // Public API methods
  getSystemHealth(): any {
    return {
      error_tracker: errorTracker.getStatistics(),
      performance: performanceMonitor.getStatistics(),
      grocery_metrics: groceryAgentMetrics.exportAllMetrics(),
      alerts: alertSystem.getAlertStats(),
      resources: performanceMonitor.monitorResourceUsage(),
    };
  }

  getMetricsSummary(timeWindow: number = 3600000): any {
    return {
      errors: errorTracker.getStatistics(timeWindow),
      performance: performanceMonitor.getStatistics(undefined, timeWindow),
      alerts: alertSystem.getAlerts({ limit: 50 }),
      trpc: trpcPerformanceMonitor.getStatistics(),
    };
  }

  async exportDiagnostics(): Promise<string> {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      system_info: {
        node_version: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      health: this.getSystemHealth(),
      metrics: this.getMetricsSummary(),
      logs: structuredLogger.getLogStats(24),
    };

    return JSON.stringify(diagnostics, null, 2);
  }

  updateConfiguration(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update alert system configuration
    if (newConfig.alerts) {
      alertSystem.updateConfig(newConfig.alerts);
    }

    // Update metrics thresholds
    if (newConfig.metrics?.alertThresholds) {
      groceryAgentMetrics.updateAlertThresholds(newConfig?.metrics?.alertThresholds);
    }

    logger.info('Monitoring system configuration updated', 'MONITORING_SYSTEM', {
      updated_sections: Object.keys(newConfig),
    });
  }
}

// Factory function for easy initialization
export function initializeMonitoring(config: MonitoringConfig = {}): Promise<MonitoringSystem> {
  const monitoring = MonitoringSystem.getInstance(config);
  return monitoring.initialize().then(() => monitoring);
}

// Export singleton for direct access
export const monitoringSystem = MonitoringSystem.getInstance();