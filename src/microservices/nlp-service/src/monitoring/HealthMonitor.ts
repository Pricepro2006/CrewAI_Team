/**
 * Health Monitor for NLP Microservice
 * Comprehensive health checking and alerting system
 */

import { EventEmitter } from 'events';
import { NLPService } from '../services/NLPService.js';
import { logger } from '../utils/logger.js';
import type {
  NLPServiceConfig,
  ServiceStatus,
  ServiceMetrics,
  NLPServiceError
} from '../types/index.js';

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: number;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  component: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // milliseconds
  lastTriggered?: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  component: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export class HealthMonitor extends EventEmitter {
  private nlpService: NLPService;
  private config: NLPServiceConfig;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private lastHealthCheck: number = 0;
  private healthHistory: HealthCheckResult[] = [];
  private maxHistorySize = 100;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    super();
    this.nlpService = nlpService;
    this.config = config;
    
    this.setupDefaultAlertRules();
    
    logger.info('Health Monitor initialized', 'HEALTH_MONITOR', {
      alertRules: this?.alertRules?.size,
      healthCheckInterval: this?.config?.monitoring.healthCheckInterval
    });
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.healthCheckInterval) {
      logger.warn('Health monitoring already started', 'HEALTH_MONITOR');
      return;
    }

    // Start health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this?.config?.monitoring.healthCheckInterval);

    // Start metrics collection
    this.metricsCollectionInterval = setInterval(() => {
      this.collectAndAnalyzeMetrics();
    }, 5000); // Collect metrics every 5 seconds

    logger.info('Health monitoring started', 'HEALTH_MONITOR');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = undefined;
    }

    logger.info('Health monitoring stopped', 'HEALTH_MONITOR');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult[]> {
    const timestamp = Date.now();
    const results: HealthCheckResult[] = [];

    try {
      // Check service status
      const serviceResult = await this.checkServiceHealth();
      results.push(serviceResult);

      // Check queue health
      const queueResult = await this.checkQueueHealth();
      results.push(queueResult);

      // Check dependencies
      const depResults = await this.checkDependencies();
      results.push(...depResults);

      // Check resource usage
      const resourceResult = await this.checkResourceUsage();
      results.push(resourceResult);

      // Store health history
      this.storeHealthHistory(results);

      // Emit health check event
      this.emit('healthCheck', {
        timestamp,
        results,
        overallHealth: this.calculateOverallHealth(results)
      });

      this.lastHealthCheck = timestamp;
      
      logger.debug('Health check completed', 'HEALTH_MONITOR', {
        resultCount: results?.length || 0,
        overallHealth: this.calculateOverallHealth(results)
      });

    } catch (error) {
      logger.error('Health check failed', 'HEALTH_MONITOR', { error });
      
      const errorResult: HealthCheckResult = {
        component: 'health-monitor',
        status: 'unhealthy',
        message: `Health check error: ${error}`,
        timestamp
      };
      results.push(errorResult);
    }

    return results;
  }

  /**
   * Check service health
   */
  private async checkServiceHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const status = this?.nlpService?.getStatus();
      const responseTime = Date.now() - startTime;
      
      return {
        component: 'service',
        status: status.status === 'healthy' ? 'healthy' : 
               status.status === 'degraded' ? 'degraded' : 'unhealthy',
        message: `Service status: ${status.status}`,
        timestamp: Date.now(),
        responseTime,
        metadata: {
          version: status.version,
          uptime: status.uptime,
          startedAt: status.startedAt
        }
      };
    } catch (error) {
      return {
        component: 'service',
        status: 'unhealthy',
        message: `Service check failed: ${error}`,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check queue health
   */
  private async checkQueueHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const queueStatus = this?.nlpService?.getQueueStatus();
      const responseTime = Date.now() - startTime;
      
      // Determine queue health based on metrics
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Queue is healthy';
      
      if (queueStatus.queueSize >= this?.config?.monitoring.alertThresholds.queueSize) {
        status = 'degraded';
        message = `Queue size high: ${queueStatus.queueSize}`;
      }
      
      if (queueStatus.queueSize >= this?.config?.monitoring.alertThresholds.queueSize * 1.5) {
        status = 'unhealthy';
        message = `Queue size critical: ${queueStatus.queueSize}`;
      }
      
      return {
        component: 'queue',
        status,
        message,
        timestamp: Date.now(),
        responseTime,
        metadata: {
          queueSize: queueStatus.queueSize,
          activeRequests: queueStatus.activeRequests,
          maxConcurrent: 'maxConcurrent' in queueStatus ? queueStatus.maxConcurrent : 2,
          estimatedWaitTime: 'estimatedWaitTime' in queueStatus ? queueStatus.estimatedWaitTime : 0
        }
      };
    } catch (error) {
      return {
        component: 'queue',
        status: 'unhealthy',
        message: `Queue check failed: ${error}`,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check dependencies health
   */
  private async checkDependencies(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const status = this?.nlpService?.getStatus();
    
    // Check Ollama
    results.push({
      component: 'ollama',
      status: status?.dependencies?.ollama === 'healthy' ? 'healthy' : 'unhealthy',
      message: `Ollama status: ${status?.dependencies?.ollama}`,
      timestamp: Date.now(),
      metadata: {
        lastCheck: status.lastHealthCheck
      }
    });
    
    // Check Redis
    results.push({
      component: 'redis',
      status: status?.dependencies?.redis === 'healthy' ? 'healthy' : 'unhealthy',
      message: `Redis status: ${status?.dependencies?.redis}`,
      timestamp: Date.now(),
      metadata: {
        lastCheck: status.lastHealthCheck
      }
    });
    
    return results;
  }

  /**
   * Check resource usage
   */
  private async checkResourceUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const metrics = this?.nlpService?.getMetrics();
      const responseTime = Date.now() - startTime;
      
      const memoryPercentage = (metrics?.resources?.memory.used / metrics?.resources?.memory.total) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Resource usage normal';
      
      if (memoryPercentage >= this?.config?.monitoring.alertThresholds.memoryUsage) {
        status = 'degraded';
        message = `Memory usage high: ${memoryPercentage.toFixed(1)}%`;
      }
      
      if (memoryPercentage >= this?.config?.monitoring.alertThresholds.memoryUsage * 1.2) {
        status = 'unhealthy';
        message = `Memory usage critical: ${memoryPercentage.toFixed(1)}%`;
      }
      
      return {
        component: 'resources',
        status,
        message,
        timestamp: Date.now(),
        responseTime,
        metadata: {
          memoryUsed: metrics?.resources?.memory.used,
          memoryTotal: metrics?.resources?.memory.total,
          memoryPercentage,
          cpuUsage: metrics?.resources?.cpu.usage
        }
      };
    } catch (error) {
      return {
        component: 'resources',
        status: 'unhealthy',
        message: `Resource check failed: ${error}`,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Collect and analyze metrics for alerting
   */
  private async collectAndAnalyzeMetrics(): Promise<void> {
    try {
      const metrics = this?.nlpService?.getMetrics();
      const timestamp = Date.now();
      
      // Check each alert rule
      if (this.alertRules) {
        for (const rule of Array.from(this.alertRules.values())) {
          if (!rule.enabled) continue;
        
        const value = this.extractMetricValue(metrics, rule.component, rule.metric);
        if (value === null) continue;
        
        const shouldAlert = this.evaluateAlertRule(rule, value);
        
        if (shouldAlert && this.canTriggerAlert(rule, timestamp)) {
          const alert = this.createAlert(rule, value, timestamp);
          this.triggerAlert(alert);
        }
        }
      }
      
    } catch (error) {
      logger.error('Metrics collection failed', 'HEALTH_MONITOR', { error });
    }
  }

  /**
   * Extract metric value for alert evaluation
   */
  private extractMetricValue(metrics: ServiceMetrics, component: string, metric: string): number | null {
    switch (component) {
      case 'queue':
        switch (metric) {
          case 'size':
            return metrics?.queue?.size;
          case 'processing':
            return metrics?.queue?.processing;
          case 'averageWaitTime':
            return metrics?.queue?.averageWaitTime;
          case 'averageProcessingTime':
            return metrics?.queue?.averageProcessingTime;
          case 'throughput':
            return metrics?.queue?.throughput;
        }
        break;
      
      case 'requests':
        switch (metric) {
          case 'failed':
            return metrics?.requests?.failed;
          case 'rate':
            return metrics?.requests?.rate;
          case 'errorRate':
            return metrics?.requests?.total > 0 ? metrics?.requests?.failed / metrics?.requests?.total : 0;
        }
        break;
        
      case 'resources':
        switch (metric) {
          case 'memoryUsage':
            return (metrics?.resources?.memory.used / metrics?.resources?.memory.total) * 100;
          case 'cpuUsage':
            return metrics?.resources?.cpu.usage;
        }
        break;
    }
    
    return null;
  }

  /**
   * Evaluate if alert rule should trigger
   */
  private evaluateAlertRule(rule: AlertRule, value: number): boolean {
    switch (rule.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'gte':
        return value >= rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'lte':
        return value <= rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  /**
   * Check if alert can be triggered (respects cooldown)
   */
  private canTriggerAlert(rule: AlertRule, timestamp: number): boolean {
    if (!rule.lastTriggered) return true;
    return (timestamp - rule.lastTriggered) >= rule.cooldownPeriod;
  }

  /**
   * Create alert from rule and value
   */
  private createAlert(rule: AlertRule, value: number, timestamp: number): Alert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      component: rule.component,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      message: `${rule.component}.${rule.metric} is ${value} (threshold: ${rule.threshold})`,
      timestamp,
      acknowledged: false
    };
  }

  /**
   * Trigger alert
   */
  private triggerAlert(alert: Alert): void {
    // Update rule last triggered time
    const rule = this?.alertRules?.get(alert.ruleId);
    if (rule) {
      rule.lastTriggered = alert.timestamp;
    }
    
    // Store active alert
    this?.activeAlerts?.set(alert.id, alert);
    
    // Emit alert event
    this.emit('alert', alert);
    
    logger.warn('Alert triggered', 'HEALTH_MONITOR', {
      alertId: alert.id,
      component: alert.component,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity
    });
  }

  /**
   * Calculate overall health from check results
   */
  private calculateOverallHealth(results: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (results.some(r => r.status === 'unhealthy')) {
      return 'unhealthy';
    } else if (results.some(r => r.status === 'degraded')) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Store health history
   */
  private storeHealthHistory(results: HealthCheckResult[]): void {
    this?.healthHistory?.push(...results);
    
    // Keep only recent history
    if (this?.healthHistory?.length > this.maxHistorySize) {
      this.healthHistory = this?.healthHistory?.slice(-this.maxHistorySize);
    }
  }

  /**
   * Set up default alert rules
   */
  private setupDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        component: 'queue',
        metric: 'size',
        threshold: this?.config?.monitoring.alertThresholds.queueSize,
        operator: 'gte',
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 60000 // 1 minute
      },
      {
        component: 'queue',
        metric: 'averageProcessingTime',
        threshold: this?.config?.monitoring.alertThresholds.processingTime,
        operator: 'gte',
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 120000 // 2 minutes
      },
      {
        component: 'requests',
        metric: 'errorRate',
        threshold: this?.config?.monitoring.alertThresholds.errorRate,
        operator: 'gte',
        severity: 'high',
        enabled: true,
        cooldownPeriod: 300000 // 5 minutes
      },
      {
        component: 'resources',
        metric: 'memoryUsage',
        threshold: this?.config?.monitoring.alertThresholds.memoryUsage,
        operator: 'gte',
        severity: 'high',
        enabled: true,
        cooldownPeriod: 180000 // 3 minutes
      }
    ];
    
    defaultRules.forEach(rule => {
      const id = `default-${rule.component}-${rule.metric}`;
      this?.alertRules?.set(id, { ...rule, id });
    });
  }

  /**
   * Get current health status
   */
  getHealthStatus(): {
    lastCheck: number;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    components: HealthCheckResult[];
    activeAlerts: Alert[];
    alertRules: AlertRule[];
  } {
    const recentResults = this?.healthHistory?.slice(-10); // Last 10 results
    const componentResults = this.getLatestResultsByComponent(recentResults);
    
    return {
      lastCheck: this.lastHealthCheck,
      overallHealth: this.calculateOverallHealth(componentResults),
      components: componentResults,
      activeAlerts: Array.from(this?.activeAlerts?.values()),
      alertRules: Array.from(this?.alertRules?.values())
    };
  }

  /**
   * Get latest results by component
   */
  private getLatestResultsByComponent(results: HealthCheckResult[]): HealthCheckResult[] {
    const latestByComponent = new Map<string, HealthCheckResult>();
    
    results.forEach(result => {
      const existing = latestByComponent.get(result.component);
      if (!existing || result.timestamp > existing.timestamp) {
        latestByComponent.set(result.component, result);
      }
    });
    
    return Array.from(latestByComponent.values());
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this?.activeAlerts?.get(alertId);
    if (!alert) return false;
    
    alert.acknowledged = true;
    this.emit('alertAcknowledged', alert);
    
    logger.info('Alert acknowledged', 'HEALTH_MONITOR', {
      alertId,
      component: alert.component,
      metric: alert.metric
    });
    
    return true;
  }

  /**
   * Clear alert
   */
  clearAlert(alertId: string): boolean {
    const alert = this?.activeAlerts?.get(alertId);
    if (!alert) return false;
    
    this?.activeAlerts?.delete(alertId);
    this.emit('alertCleared', alert);
    
    logger.info('Alert cleared', 'HEALTH_MONITOR', {
      alertId,
      component: alert.component,
      metric: alert.metric
    });
    
    return true;
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this?.alertRules?.set(id, { ...rule, id });
    
    logger.info('Alert rule added', 'HEALTH_MONITOR', {
      id,
      component: rule.component,
      metric: rule.metric,
      threshold: rule.threshold
    });
    
    return id;
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this?.alertRules?.delete(ruleId);
    
    if (removed) {
      logger.info('Alert rule removed', 'HEALTH_MONITOR', { ruleId });
    }
    
    return removed;
  }

  /**
   * Update alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<Omit<AlertRule, 'id'>>): boolean {
    const rule = this?.alertRules?.get(ruleId);
    if (!rule) return false;
    
    Object.assign(rule, updates);
    
    logger.info('Alert rule updated', 'HEALTH_MONITOR', {
      ruleId,
      updates
    });
    
    return true;
  }
}