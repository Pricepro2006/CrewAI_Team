import { EventEmitter } from 'events';
import { z } from 'zod';
import { EventMonitor } from '../../core/events/EventMonitor.js';
import { WebSocketGateway } from './WebSocketGateway.js';
import { MessageBatcher } from './MessageBatcher.js';
import { ConnectionManager } from './ConnectionManager.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import { EventBroadcaster } from './EventBroadcaster.js';

// Monitoring configuration schemas
export const MonitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  metricsInterval: z.number().default(30000), // 30 seconds
  detailedMetrics: z.boolean().default(false),
  alerting: z.object({
    enabled: z.boolean().default(true),
    thresholds: z.object({
      errorRate: z.number().default(0.05), // 5%
      latencyP95: z.number().default(1000), // 1 second
      connectionFailureRate: z.number().default(0.1), // 10%
      memoryUsage: z.number().default(0.8), // 80%
      cpuUsage: z.number().default(0.7) // 70%
    }),
    cooldownPeriod: z.number().default(300000) // 5 minutes
  }),
  retention: z.object({
    shortTerm: z.number().default(3600000), // 1 hour
    longTerm: z.number().default(86400000) // 24 hours
  }),
  export: z.object({
    enabled: z.boolean().default(false),
    format: z.enum(['prometheus', 'json', 'csv']).default('json'),
    endpoint: z.string().optional(),
    interval: z.number().default(60000) // 1 minute
  })
});

export const PerformanceMetricsSchema = z.object({
  connections: z.object({
    total: z.number().default(0),
    active: z.number().default(0),
    peak: z.number().default(0),
    connectionsPerSecond: z.number().default(0),
    averageConnectionDuration: z.number().default(0),
    rejectedConnections: z.number().default(0)
  }),
  messages: z.object({
    totalSent: z.number().default(0),
    totalReceived: z.number().default(0),
    messagesPerSecond: z.number().default(0),
    averageMessageSize: z.number().default(0),
    largestMessage: z.number().default(0),
    failedMessages: z.number().default(0)
  }),
  subscriptions: z.object({
    total: z.number().default(0),
    byEventType: z.record(z.number()).default({}),
    averagePerConnection: z.number().default(0),
    subscriptionChangesPerSecond: z.number().default(0)
  }),
  batching: z.object({
    totalBatches: z.number().default(0),
    averageBatchSize: z.number().default(0),
    batchesPerSecond: z.number().default(0),
    averageBatchLatency: z.number().default(0),
    compressionRatio: z.number().default(0)
  }),
  broadcasting: z.object({
    totalBroadcasts: z.number().default(0),
    successfulBroadcasts: z.number().default(0),
    averageBroadcastLatency: z.number().default(0),
    averageRecipientsPerBroadcast: z.number().default(0),
    crossNodeBroadcasts: z.number().default(0)
  }),
  latency: z.object({
    p50: z.number().default(0),
    p90: z.number().default(0),
    p95: z.number().default(0),
    p99: z.number().default(0),
    max: z.number().default(0)
  }),
  errors: z.object({
    total: z.number().default(0),
    connectionErrors: z.number().default(0),
    messageErrors: z.number().default(0),
    broadcastErrors: z.number().default(0),
    authErrors: z.number().default(0),
    rateLimitErrors: z.number().default(0)
  })
});

export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

export interface AlertCondition {
  id: string;
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number;
  lastTriggered?: number;
}

export interface MetricDataPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    value?: number;
    threshold?: number;
  }>;
  summary: {
    passCount: number;
    warnCount: number;
    failCount: number;
  };
}

/**
 * WebSocketMonitor - Comprehensive performance monitoring and alerting system
 * 
 * Features:
 * - Real-time performance metrics collection
 * - Intelligent alerting with configurable thresholds
 * - Health checks and system diagnostics
 * - Historical metrics storage and analysis
 * - Resource usage monitoring (memory, CPU, connections)
 * - SLA tracking and reporting
 * - Integration with external monitoring systems
 * - Performance optimization recommendations
 */
export class WebSocketMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private eventMonitor: EventMonitor;
  
  // Component references
  private gateway: WebSocketGateway;
  private batcher: MessageBatcher;
  private connectionManager: ConnectionManager;
  private subscriptionManager: SubscriptionManager;
  private broadcaster: EventBroadcaster;
  
  // Metrics and monitoring state
  private currentMetrics: PerformanceMetrics;
  private historicalMetrics: Array<{ timestamp: number; metrics: PerformanceMetrics }> = [];
  private alerts = new Map<string, AlertCondition>();
  private latencyBuffer: number[] = [];
  private alertCooldowns = new Map<string, number>();
  
  // Data collection
  private metricsTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    config: Partial<MonitoringConfig> = {},
    eventMonitor: EventMonitor,
    gateway: WebSocketGateway,
    batcher: MessageBatcher,
    connectionManager: ConnectionManager,
    subscriptionManager: SubscriptionManager,
    broadcaster: EventBroadcaster
  ) {
    super();
    
    this.config = MonitoringConfigSchema.parse(config);
    this.eventMonitor = eventMonitor;
    
    this.gateway = gateway;
    this.batcher = batcher;
    this.connectionManager = connectionManager;
    this.subscriptionManager = subscriptionManager;
    this.broadcaster = broadcaster;
    
    this.currentMetrics = PerformanceMetricsSchema.parse({});
    
    this.setupDefaultAlerts();
    this.setupComponentListeners();
    this.startPeriodicTasks();
    
    console.log('WebSocketMonitor initialized with comprehensive monitoring');
  }

  private setupDefaultAlerts(): void {
    // High error rate alert
    this.addAlert({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: 'metrics?.errors?.total / (metrics?.messages?.totalSent + metrics?.messages?.totalReceived) > 0.05',
      severity: 'high',
      enabled: true,
      cooldown: this?.config?.alerting.cooldownPeriod
    });

    // High latency alert
    this.addAlert({
      id: 'high_latency',
      name: 'High Latency',
      condition: 'metrics?.latency?.p95 > 1000',
      severity: 'medium',
      enabled: true,
      cooldown: this?.config?.alerting.cooldownPeriod
    });

    // Connection failure alert
    this.addAlert({
      id: 'connection_failures',
      name: 'High Connection Failures',
      condition: 'metrics?.connections?.rejectedConnections > metrics?.connections?.total * 0.1',
      severity: 'high',
      enabled: true,
      cooldown: this?.config?.alerting.cooldownPeriod
    });

    // Low broadcast success rate
    this.addAlert({
      id: 'broadcast_failures',
      name: 'Broadcast Failures',
      condition: 'metrics?.broadcasting?.successfulBroadcasts < metrics?.broadcasting?.totalBroadcasts * 0.9',
      severity: 'medium',
      enabled: true,
      cooldown: this?.config?.alerting.cooldownPeriod
    });
  }

  private setupComponentListeners(): void {
    // Gateway events
    this?.gateway?.on('connection_opened', (data: any) => {
      this.recordMetric('connection_opened', 1, { connectionId: data.connectionId });
    });

    this?.gateway?.on('connection_closed', (data: any) => {
      this.recordMetric('connection_closed', 1, { reason: data.reason });
      this.recordLatency('connection_duration', data.duration || 0);
    });

    this?.gateway?.on('message_error', (data: any) => {
      if (this.currentMetrics.errors.messageErrors) { this.currentMetrics.errors.messageErrors++ };
      if (this.currentMetrics.errors.total) { this.currentMetrics.errors.total++ };
    });

    // Connection manager events
    this?.connectionManager?.on('connection_rejected', (data: any) => {
      if (this.currentMetrics.connections.rejectedConnections) { this.currentMetrics.connections.rejectedConnections++ };
      this.recordMetric('connection_rejected', 1, { reason: data.reason });
    });

    this?.connectionManager?.on('auth_error', (data: any) => {
      if (this.currentMetrics.errors.authErrors) { this.currentMetrics.errors.authErrors++ };
      if (this.currentMetrics.errors.total) { this.currentMetrics.errors.total++ };
    });

    this?.connectionManager?.on('rate_limit_exceeded', (data: any) => {
      if (this.currentMetrics.errors.rateLimitErrors) { this.currentMetrics.errors.rateLimitErrors++ };
      if (this.currentMetrics.errors.total) { this.currentMetrics.errors.total++ };
    });

    // Subscription manager events
    this?.subscriptionManager?.on('event_routed', (data: any) => {
      this.recordLatency('routing_latency', data.processingTime);
    });

    this?.subscriptionManager?.on('routing_error', (data: any) => {
      if (this.currentMetrics.errors.total) { this.currentMetrics.errors.total++ };
    });

    // Message batcher events
    this?.batcher?.on('batch_created', (data: any) => {
      if (this.currentMetrics.batching.totalBatches) { this.currentMetrics.batching.totalBatches++ };
      this.recordLatency('batch_latency', data?.batch?.metadata.createdAt - Date.now());
    });

    // Event broadcaster events
    this?.broadcaster?.on('broadcast_completed', (data: any) => {
      if (data?.result?.success) {
        if (this.currentMetrics.broadcasting.successfulBroadcasts) { this.currentMetrics.broadcasting.successfulBroadcasts++ };
      }
      if (this.currentMetrics.broadcasting.totalBroadcasts) { this.currentMetrics.broadcasting.totalBroadcasts++ };
      this.recordLatency('broadcast_latency', data?.result?.broadcastTime);
    });

    this?.broadcaster?.on('broadcast_error', (data: any) => {
      if (this.currentMetrics.errors.broadcastErrors) { this.currentMetrics.errors.broadcastErrors++ };
      if (this.currentMetrics.errors.total) { this.currentMetrics.errors.total++ };
    });
  }

  private startPeriodicTasks(): void {
    if (!this?.config?.enabled) return;

    // Collect metrics
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
      this.emit('metrics_collected', { 
        metrics: this.currentMetrics, 
        timestamp: Date.now() 
      });
    }, this?.config?.metricsInterval);

    // Health checks
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Every minute

    // Cleanup old data
    this.cleanupTimer = setInterval(() => {
      this.cleanupHistoricalData();
    }, 300000); // Every 5 minutes
  }

  // Metrics collection
  private collectMetrics(): void {
    // Connection metrics
    const gatewayMetrics = this?.gateway?.getMetrics();
    const connectionStats = this?.connectionManager?.getStats();
    
    if (this.currentMetrics) {

    
      this.currentMetrics.connections = {
      total: connectionStats.total,
      active: connectionStats.active,
      peak: connectionStats.peakConnections,
      connectionsPerSecond: connectionStats.connectionsPerSecond,
      averageConnectionDuration: connectionStats.averageConnectionTime,
      rejectedConnections: this?.currentMetrics?.connections.rejectedConnections
    };

    
    }

    // Message metrics
    if (this.currentMetrics) {

      this.currentMetrics.messages = {
      totalSent: gatewayMetrics.totalMessages,
      totalReceived: gatewayMetrics.totalMessages, // Approximation
      messagesPerSecond: this.calculateMessagesPerSecond(),
      averageMessageSize: this.calculateAverageMessageSize(),
      largestMessage: this.findLargestMessage(),
      failedMessages: this?.currentMetrics?.errors.messageErrors
    };

    }

    // Subscription metrics
    const subscriptionStats = this?.subscriptionManager?.getSubscriptionStats();
    if (this.currentMetrics) {

      this.currentMetrics.subscriptions = {
      total: subscriptionStats.totalSubscriptions,
      byEventType: subscriptionStats.byEventType,
      averagePerConnection: this?.currentMetrics?.connections.active > 0 
        ? subscriptionStats.totalSubscriptions / this?.currentMetrics?.connections.active 
        : 0,
      subscriptionChangesPerSecond: this.calculateSubscriptionChangesPerSecond()
    };

    }

    // Batching metrics
    const batchMetrics = this?.batcher?.getMetrics();
    if (this.currentMetrics) {

      this.currentMetrics.batching = {
      totalBatches: batchMetrics.totalBatches,
      averageBatchSize: batchMetrics.averageBatchSize,
      batchesPerSecond: this.calculateBatchesPerSecond(),
      averageBatchLatency: batchMetrics.averageWaitTime,
      compressionRatio: batchMetrics.averageCompressionRatio
    };

    }

    // Broadcasting metrics
    const broadcastMetrics = this?.broadcaster?.getMetrics();
    if (this.currentMetrics) {

      this.currentMetrics.broadcasting = {
      totalBroadcasts: broadcastMetrics.totalBroadcasts,
      successfulBroadcasts: broadcastMetrics.successfulBroadcasts,
      averageBroadcastLatency: broadcastMetrics.averageBroadcastTime,
      averageRecipientsPerBroadcast: broadcastMetrics.averageRecipientsPerBroadcast,
      crossNodeBroadcasts: broadcastMetrics.redisPublishes
    };

    }

    // Latency metrics
    this.updateLatencyMetrics();

    // Store historical data
    this.storeHistoricalMetrics();
  }

  private updateLatencyMetrics(): void {
    if (this?.latencyBuffer?.length === 0) return;

    const sorted = [...this.latencyBuffer].sort((a, b) => a - b);
    
    if (this.currentMetrics) {

    
      this.currentMetrics.latency = {
      p50: this.calculatePercentile(sorted, 0.5),
      p90: this.calculatePercentile(sorted, 0.9),
      p95: this.calculatePercentile(sorted, 0.95),
      p99: this.calculatePercentile(sorted, 0.99),
      max: Math.max(...sorted)
    };

    
    }

    // Clear old latency data
    if (this?.latencyBuffer?.length > 10000) {
      this.latencyBuffer = this?.latencyBuffer?.slice(-5000);
    }
  }

  private storeHistoricalMetrics(): void {
    this?.historicalMetrics?.push({
      timestamp: Date.now(),
      metrics: JSON.parse(JSON.stringify(this.currentMetrics))
    });

    // Limit historical data size
    if (this?.historicalMetrics?.length > 1000) {
      this.historicalMetrics = this?.historicalMetrics?.slice(-500);
    }
  }

  // Alert management
  public addAlert(alert: AlertCondition): void {
    this?.alerts?.set(alert.id, alert);
    this.emit('alert_added', { alertId: alert.id, alert });
  }

  public removeAlert(alertId: string): boolean {
    const removed = this?.alerts?.delete(alertId);
    if (removed) {
      this?.alertCooldowns?.delete(alertId);
      this.emit('alert_removed', { alertId });
    }
    return removed;
  }

  private checkAlerts(): void {
    if (!this?.config?.alerting.enabled) return;

    const now = Date.now();
    
    for (const [alertId, alert] of this.alerts) {
      if (!alert.enabled) continue;

      // Check cooldown
      const lastCooldown = this?.alertCooldowns?.get(alertId);
      if (lastCooldown && now - lastCooldown < alert.cooldown) {
        continue;
      }

      try {
        const triggered = this.evaluateAlertCondition(alert.condition);
        
        if (triggered) {
          this.triggerAlert(alert);
          this?.alertCooldowns?.set(alertId, now);
          alert.lastTriggered = now;
        }
        
      } catch (error) {
        this.emit('alert_evaluation_error', { alertId, error });
      }
    }
  }

  private evaluateAlertCondition(condition: string): boolean {
    try {
      const func = new Function('metrics', `return ${condition}`);
      return func(this.currentMetrics);
    } catch (error) {
      throw new Error(`Alert condition evaluation failed: ${error.message}`);
    }
  }

  private triggerAlert(alert: AlertCondition): void {
    this.emit('alert_triggered', {
      alert,
      metrics: this.currentMetrics,
      timestamp: Date.now()
    });

    console.warn(`Alert triggered: ${alert.name} (${alert.severity})`);
  }

  // Health checks
  private performHealthCheck(): void {
    const checks: HealthCheckResult['checks'] = [];

    // Connection health
    const connectionHealth = this.checkConnectionHealth();
    checks.push(...connectionHealth);

    // Error rate health
    const errorHealth = this.checkErrorRateHealth();
    checks.push(...errorHealth);

    // Latency health
    const latencyHealth = this.checkLatencyHealth();
    checks.push(...latencyHealth);

    // Resource usage health
    const resourceHealth = this.checkResourceHealth();
    checks.push(...resourceHealth);

    // Calculate overall health
    const summary = {
      passCount: checks?.filter(c => c.status === 'pass').length,
      warnCount: checks?.filter(c => c.status === 'warn').length,
      failCount: checks?.filter(c => c.status === 'fail').length
    };

    const score = (summary.passCount * 100) / checks?.length || 0;
    let status: HealthCheckResult['status'] = 'healthy';

    if (summary.failCount > 0 || score < 70) {
      status = 'unhealthy';
    } else if (summary.warnCount > 0 || score < 85) {
      status = 'degraded';
    }

    const result: HealthCheckResult = {
      status,
      score,
      checks,
      summary
    };

    this.emit('health_check_completed', {
      result,
      timestamp: Date.now()
    });
  }

  private checkConnectionHealth(): HealthCheckResult['checks'] {
    const checks: HealthCheckResult['checks'] = [];
    const stats = this?.connectionManager?.getStats();

    // Check connection rejection rate
    const rejectionRate = stats.total > 0 
      ? this?.currentMetrics?.connections.rejectedConnections / stats.total 
      : 0;

    checks.push({
      name: 'Connection Rejection Rate',
      status: rejectionRate > 0.1 ? 'fail' : rejectionRate > 0.05 ? 'warn' : 'pass',
      value: rejectionRate,
      threshold: 0.1,
      message: rejectionRate > 0.1 ? 'High connection rejection rate' : undefined
    });

    // Check active connections
    checks.push({
      name: 'Active Connections',
      status: stats.active > 0 ? 'pass' : 'warn',
      value: stats.active,
      message: stats.active === 0 ? 'No active connections' : undefined
    });

    return checks;
  }

  private checkErrorRateHealth(): HealthCheckResult['checks'] {
    const checks: HealthCheckResult['checks'] = [];
    const totalOperations = this?.currentMetrics?.messages.totalSent + 
                           this?.currentMetrics?.messages.totalReceived +
                           this?.currentMetrics?.broadcasting.totalBroadcasts;

    const errorRate = totalOperations > 0 
      ? this?.currentMetrics?.errors.total / totalOperations 
      : 0;

    checks.push({
      name: 'Overall Error Rate',
      status: errorRate > 0.05 ? 'fail' : errorRate > 0.02 ? 'warn' : 'pass',
      value: errorRate,
      threshold: 0.05,
      message: errorRate > 0.05 ? 'High error rate detected' : undefined
    });

    return checks;
  }

  private checkLatencyHealth(): HealthCheckResult['checks'] {
    const checks: HealthCheckResult['checks'] = [];

    checks.push({
      name: 'P95 Latency',
      status: this?.currentMetrics?.latency.p95 > 1000 ? 'fail' : 
              this?.currentMetrics?.latency.p95 > 500 ? 'warn' : 'pass',
      value: this?.currentMetrics?.latency.p95,
      threshold: 1000,
      message: this?.currentMetrics?.latency.p95 > 1000 ? 'High P95 latency' : undefined
    });

    return checks;
  }

  private checkResourceHealth(): HealthCheckResult['checks'] {
    const checks: HealthCheckResult['checks'] = [];

    // Memory usage (if available)
    const memUsage = process.memoryUsage();
    const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;

    checks.push({
      name: 'Memory Usage',
      status: memUsagePercent > 0.8 ? 'fail' : memUsagePercent > 0.6 ? 'warn' : 'pass',
      value: memUsagePercent,
      threshold: 0.8,
      message: memUsagePercent > 0.8 ? 'High memory usage' : undefined
    });

    return checks;
  }

  // Utility methods
  private recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this?.eventMonitor?.recordMetric(name, value, tags);
  }

  private recordLatency(name: string, latency: number): void {
    this?.latencyBuffer?.push(latency);
    this?.eventMonitor?.recordLatency(name, latency);
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray?.length || 0 === 0) return 0;
    const index = Math.ceil(sortedArray?.length || 0 * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray?.length || 0 - 1))];
  }

  private calculateMessagesPerSecond(): number {
    // Implement based on historical data
    return 0; // Placeholder
  }

  private calculateAverageMessageSize(): number {
    // Implement based on message size tracking
    return 0; // Placeholder
  }

  private findLargestMessage(): number {
    // Implement based on message size tracking
    return 0; // Placeholder
  }

  private calculateSubscriptionChangesPerSecond(): number {
    // Implement based on subscription change tracking
    return 0; // Placeholder
  }

  private calculateBatchesPerSecond(): number {
    // Implement based on batch creation tracking
    return 0; // Placeholder
  }

  private cleanupHistoricalData(): void {
    const now = Date.now();
    const shortTermCutoff = now - this?.config?.retention.shortTerm;
    const longTermCutoff = now - this?.config?.retention.longTerm;

    // Keep detailed data for short term, summarized for long term
    this.historicalMetrics = this?.historicalMetrics?.filter(
      entry => entry.timestamp > longTermCutoff
    );
  }

  // Public API methods
  public getCurrentMetrics(): PerformanceMetrics {
    return JSON.parse(JSON.stringify(this.currentMetrics));
  }

  public getHistoricalMetrics(
    startTime?: number,
    endTime?: number
  ): Array<{ timestamp: number; metrics: PerformanceMetrics }> {
    let filtered = this.historicalMetrics;

    if (startTime) {
      filtered = filtered?.filter(entry => entry.timestamp >= startTime);
    }

    if (endTime) {
      filtered = filtered?.filter(entry => entry.timestamp <= endTime);
    }

    return filtered;
  }

  public getAlerts(): AlertCondition[] {
    return Array.from(this?.alerts?.values());
  }

  public getAlert(alertId: string): AlertCondition | undefined {
    return this?.alerts?.get(alertId);
  }

  public async performManualHealthCheck(): Promise<HealthCheckResult> {
    this.performHealthCheck();
    
    return new Promise((resolve: any) => {
      this.once('health_check_completed', (data: any) => {
        resolve(data.result);
      });
    });
  }

  public getSystemInfo(): {
    uptime: number;
    nodeVersion: string;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    platform: string;
    arch: string;
  } {
    return {
      uptime: process.uptime() * 1000,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      platform: process.platform,
      arch: process.arch
    };
  }

  public exportMetrics(format: 'json' | 'prometheus' | 'csv' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify({
          current: this.currentMetrics,
          historical: this?.historicalMetrics?.slice(-10), // Last 10 entries
          timestamp: Date.now()
        }, null, 2);
      
      case 'prometheus':
        return this.formatPrometheusMetrics();
      
      case 'csv':
        return this.formatCSVMetrics();
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private formatPrometheusMetrics(): string {
    // Implement Prometheus format
    return `# WebSocket Metrics\nws_connections_total ${this?.currentMetrics?.connections.total}\n`;
  }

  private formatCSVMetrics(): string {
    // Implement CSV format
    return 'timestamp,connections_total,messages_sent,errors_total\n' +
           `${Date.now()},${this?.currentMetrics?.connections.total},${this?.currentMetrics?.messages.totalSent},${this?.currentMetrics?.errors.total}\n`;
  }

  public async shutdown(): Promise<void> {
    console.log('Shutting down WebSocketMonitor...');

    // Clear timers
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);

    // Final metrics collection
    this.collectMetrics();

    this.emit('shutdown', {
      finalMetrics: this.currentMetrics,
      totalHistoricalEntries: this?.historicalMetrics?.length
    });
  }
}