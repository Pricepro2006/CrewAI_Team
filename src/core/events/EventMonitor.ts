import { EventEmitter } from 'events';
import { z } from 'zod';
import { BaseEvent } from './EventBus.js';

// Monitoring schemas and types
export const EventMetricsSchema = z.object({
  totalEvents: z.number().default(0),
  eventsByType: z.record(z.number()).default({}),
  eventsBySource: z.record(z.number()).default({}),
  errorsByType: z.record(z.number()).default({}),
  averageProcessingTime: z.number().default(0),
  throughput: z.object({
    current: z.number().default(0), // events per second
    peak: z.number().default(0),
    average: z.number().default(0)
  }),
  latency: z.object({
    p50: z.number().default(0),
    p90: z.number().default(0),
    p95: z.number().default(0),
    p99: z.number().default(0)
  }),
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']).default('healthy'),
    uptime: z.number().default(0),
    lastError: z.string().optional(),
    errorRate: z.number().default(0)
  })
});

export const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  severity: z.enum(['info', 'warning', 'critical']),
  condition: z.object({
    metric: z.string(), // e.g., 'errorRate', 'throughput.current', 'latency.p99'
    operator: z.enum(['>', '<', '>=', '<=', '==', '!=']),
    threshold: z.number(),
    duration: z.number().default(60000) // Time in ms the condition must persist
  }),
  actions: z.array(z.object({
    type: z.enum(['webhook', 'email', 'log', 'event']),
    config: z.record(z.any())
  })).default([]),
  cooldown: z.number().default(300000), // 5 minutes between alerts
  metadata: z.record(z.string()).default({})
});

export const TraceSchema = z.object({
  traceId: z.string(),
  parentId: z.string().optional(),
  eventId: z.string(),
  eventType: z.string(),
  source: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  duration: z.number().optional(),
  status: z.enum(['pending', 'success', 'error']).default('pending'),
  error: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  spans: z.array(z.object({
    spanId: z.string(),
    operationName: z.string(),
    startTime: z.number(),
    endTime: z.number(),
    tags: z.record(z.string()).default({})
  })).default([])
});

export const MonitoringConfigSchema = z.object({
  metrics: z.object({
    enabled: z.boolean().default(true),
    retention: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
    aggregationInterval: z.number().default(60000), // 1 minute
    detailedMetrics: z.boolean().default(true)
  }),
  tracing: z.object({
    enabled: z.boolean().default(true),
    sampleRate: z.number().min(0).max(1).default(0.1), // 10% sampling
    maxTraces: z.number().default(10000),
    retention: z.number().default(24 * 60 * 60 * 1000) // 24 hours
  }),
  alerting: z.object({
    enabled: z.boolean().default(true),
    checkInterval: z.number().default(30000), // 30 seconds
    maxActiveAlerts: z.number().default(100)
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    structured: z.boolean().default(true),
    includePayloads: z.boolean().default(false) // For security
  })
});

export type EventMetrics = z.infer<typeof EventMetricsSchema>;
export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type EventTrace = z.infer<typeof TraceSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertRule['severity'];
  message: string;
  triggeredAt: number;
  resolvedAt?: number;
  status: 'active' | 'resolved';
  metadata: Record<string, any>;
}

/**
 * EventMonitor - Comprehensive monitoring and observability system
 * 
 * Features:
 * - Real-time metrics collection and aggregation
 * - Distributed tracing for event flows
 * - Customizable alerting with multiple notification channels
 * - Performance monitoring and health checking
 * - Integration with popular monitoring tools
 * - Structured logging with correlation IDs
 */
export class EventMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: EventMetrics;
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private traces = new Map<string, EventTrace>();
  private latencyBuffer: number[] = [];
  
  private metricsHistory: EventMetrics[] = [];
  private alertCooldowns = new Map<string, number>();
  private startTime = Date.now();
  private lastThroughputCalculation = Date.now();
  private eventCountSinceLastCalc = 0;

  private metricsTimer?: NodeJS.Timeout;
  private alertTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = MonitoringConfigSchema.parse(config);
    this.metrics = EventMetricsSchema.parse({});
    this.initializeMonitoring();
    this.setupDefaultAlerts();
  }

  private initializeMonitoring(): void {
    if (this.config.metrics.enabled) {
      this.metricsTimer = setInterval(() => {
        this.aggregateMetrics();
        this.emit('metrics_updated', this.metrics);
      }, this.config.metrics.aggregationInterval);
    }

    if (this.config.alerting.enabled) {
      this.alertTimer = setInterval(() => {
        this.checkAlerts();
      }, this.config.alerting.checkInterval);
    }

    // Cleanup old data periodically
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes

    console.log('EventMonitor initialized with config:', this.config);
  }

  private setupDefaultAlerts(): void {
    // High error rate alert
    this.addAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      severity: 'critical',
      condition: {
        metric: 'health.errorRate',
        operator: '>',
        threshold: 0.05, // 5%
        duration: 120000 // 2 minutes
      },
      actions: [
        { type: 'log', config: { level: 'error' } },
        { type: 'event', config: { eventType: 'monitoring.alert.critical' } }
      ]
    });

    // Low throughput alert
    this.addAlertRule({
      id: 'low_throughput',
      name: 'Low Throughput',
      severity: 'warning',
      condition: {
        metric: 'throughput.current',
        operator: '<',
        threshold: 1, // Less than 1 event per second
        duration: 300000 // 5 minutes
      },
      actions: [
        { type: 'log', config: { level: 'warn' } }
      ]
    });

    // High latency alert
    this.addAlertRule({
      id: 'high_latency_p99',
      name: 'High P99 Latency',
      severity: 'warning',
      condition: {
        metric: 'latency.p99',
        operator: '>',
        threshold: 1000, // 1 second
        duration: 180000 // 3 minutes
      },
      actions: [
        { type: 'log', config: { level: 'warn' } }
      ]
    });
  }

  // Event tracking methods
  public recordEvent(event: BaseEvent, context: {
    processingStartTime?: number;
    processingEndTime?: number;
    source?: string;
    error?: Error;
    traceId?: string;
    parentTraceId?: string;
  } = {}): void {
    const now = Date.now();

    // Update basic metrics
    this.metrics.totalEvents++;
    
    // Track by type
    this.metrics.eventsByType[event.type] = (this.metrics.eventsByType[event.type] || 0) + 1;
    
    // Track by source
    const source = context.source || event.source;
    this.metrics.eventsBySource[source] = (this.metrics.eventsBySource[source] || 0) + 1;

    // Track errors
    if (context.error) {
      this.metrics.errorsByType[event.type] = (this.metrics.errorsByType[event.type] || 0) + 1;
    }

    // Track processing time
    if (context.processingStartTime && context.processingEndTime) {
      const processingTime = context.processingEndTime - context.processingStartTime;
      this.recordLatency(processingTime);
    }

    // Create or update trace
    if (this.config.tracing.enabled && this.shouldSample()) {
      this.recordTrace(event, context);
    }

    // Update throughput counter
    this.eventCountSinceLastCalc++;

    // Log event if configured
    if (this.config.logging.level === 'debug' || 
        (this.config.logging.level === 'info' && !context.error) ||
        (context.error && ['warn', 'error'].includes(this.config.logging.level))) {
      this.logEvent(event, context);
    }
  }

  public recordError(error: Error, context: {
    eventId?: string;
    eventType?: string;
    source?: string;
    traceId?: string;
  } = {}): void {
    // Update error metrics
    if (context.eventType) {
      this.metrics.errorsByType[context.eventType] = 
        (this.metrics.errorsByType[context.eventType] || 0) + 1;
    }

    // Update trace if exists
    if (context.traceId && this.traces.has(context.traceId)) {
      const trace = this.traces.get(context.traceId)!;
      trace.status = 'error';
      trace.error = error.message;
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;
    }

    // Emit error event
    this.emit('error_recorded', {
      error: error.message,
      context,
      timestamp: Date.now()
    });

    this.logError(error, context);
  }

  public startTrace(event: BaseEvent, parentTraceId?: string): string {
    if (!this.config.tracing.enabled || !this.shouldSample()) {
      return '';
    }

    const traceId = this.generateTraceId();
    const trace: EventTrace = {
      traceId,
      parentId: parentTraceId,
      eventId: event.id,
      eventType: event.type,
      source: event.source,
      startTime: Date.now(),
      status: 'pending',
      metadata: {
        correlationId: event.correlationId,
        causationId: event.causationId
      },
      spans: []
    };

    this.traces.set(traceId, trace);
    return traceId;
  }

  public endTrace(traceId: string, success: boolean = true, error?: Error): void {
    if (!this.traces.has(traceId)) return;

    const trace = this.traces.get(traceId)!;
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = success ? 'success' : 'error';
    
    if (error) {
      trace.error = error.message;
    }

    this.emit('trace_completed', {
      traceId,
      duration: trace.duration,
      success,
      eventType: trace.eventType
    });
  }

  public addSpan(traceId: string, operationName: string, startTime: number, endTime: number, tags: Record<string, string> = {}): void {
    if (!this.traces.has(traceId)) return;

    const trace = this.traces.get(traceId)!;
    trace.spans.push({
      spanId: this.generateSpanId(),
      operationName,
      startTime,
      endTime,
      tags
    });
  }

  // Alert management
  public addAlertRule(rule: Omit<AlertRule, 'id'> & { id?: string }): string {
    const alertRule: AlertRule = {
      ...rule,
      id: rule.id || this.generateAlertId()
    };

    AlertRuleSchema.parse(alertRule);
    this.alertRules.set(alertRule.id, alertRule);
    
    this.emit('alert_rule_added', {
      ruleId: alertRule.id,
      name: alertRule.name,
      severity: alertRule.severity
    });

    return alertRule.id;
  }

  public removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      // Resolve any active alerts for this rule
      for (const [alertId, alert] of this.activeAlerts) {
        if (alert.ruleId === ruleId) {
          this.resolveAlert(alertId);
        }
      }
      this.emit('alert_rule_removed', { ruleId });
    }
    return removed;
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(a => a.status === 'active');
  }

  // Metrics and observability
  public getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  public getTrace(traceId: string): EventTrace | null {
    return this.traces.get(traceId) || null;
  }

  public getTraces(filter: {
    eventType?: string;
    source?: string;
    status?: EventTrace['status'];
    minDuration?: number;
    maxDuration?: number;
    limit?: number;
  } = {}): EventTrace[] {
    let traces = Array.from(this.traces.values());

    if (filter.eventType) {
      traces = traces.filter(t => t.eventType === filter.eventType);
    }

    if (filter.source) {
      traces = traces.filter(t => t.source === filter.source);
    }

    if (filter.status) {
      traces = traces.filter(t => t.status === filter.status);
    }

    if (filter.minDuration !== undefined) {
      traces = traces.filter(t => (t.duration || 0) >= filter.minDuration!);
    }

    if (filter.maxDuration !== undefined) {
      traces = traces.filter(t => (t.duration || 0) <= filter.maxDuration!);
    }

    // Sort by start time (newest first)
    traces.sort((a, b) => b.startTime - a.startTime);

    if (filter.limit) {
      traces = traces.slice(0, filter.limit);
    }

    return traces;
  }

  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    metrics: EventMetrics;
    activeAlertsCount: number;
    lastError?: string;
  } {
    const activeAlertsCount = this.getActiveAlerts().length;
    const criticalAlerts = this.getActiveAlerts().filter(a => a.severity === 'critical');
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (activeAlertsCount > 0 || this.metrics.health.errorRate > 0.01) {
      status = 'degraded';
    }

    return {
      status,
      uptime: Date.now() - this.startTime,
      metrics: this.metrics,
      activeAlertsCount,
      lastError: this.metrics.health.lastError
    };
  }

  // Private utility methods
  private recordTrace(event: BaseEvent, context: any): void {
    const traceId = context.traceId || this.startTrace(event, context.parentTraceId);
    
    if (context.processingEndTime) {
      this.endTrace(traceId, !context.error, context.error);
    }
  }

  private recordLatency(latency: number): void {
    this.latencyBuffer.push(latency);
    
    // Keep buffer size manageable
    if (this.latencyBuffer.length > 1000) {
      this.latencyBuffer = this.latencyBuffer.slice(-1000);
    }
  }

  private aggregateMetrics(): void {
    // Calculate throughput
    const now = Date.now();
    const timeSinceLastCalc = now - this.lastThroughputCalculation;
    const currentThroughput = (this.eventCountSinceLastCalc / timeSinceLastCalc) * 1000; // per second

    this.metrics.throughput.current = currentThroughput;
    this.metrics.throughput.peak = Math.max(this.metrics.throughput.peak, currentThroughput);
    
    // Calculate average throughput
    const totalTime = (now - this.startTime) / 1000; // in seconds
    this.metrics.throughput.average = this.metrics.totalEvents / totalTime;

    // Reset counters
    this.lastThroughputCalculation = now;
    this.eventCountSinceLastCalc = 0;

    // Calculate latency percentiles
    if (this.latencyBuffer.length > 0) {
      const sorted = [...this.latencyBuffer].sort((a, b) => a - b);
      this.metrics.latency.p50 = this.calculatePercentile(sorted, 0.5);
      this.metrics.latency.p90 = this.calculatePercentile(sorted, 0.9);
      this.metrics.latency.p95 = this.calculatePercentile(sorted, 0.95);
      this.metrics.latency.p99 = this.calculatePercentile(sorted, 0.99);
    }

    // Calculate error rate
    const totalErrors = Object.values(this.metrics.errorsByType).reduce((sum, count) => sum + count, 0);
    this.metrics.health.errorRate = this.metrics.totalEvents > 0 ? totalErrors / this.metrics.totalEvents : 0;
    
    // Update health status
    this.metrics.health.uptime = now - this.startTime;
    this.updateHealthStatus();

    // Store metrics history
    this.metricsHistory.push({ ...this.metrics });
    
    // Keep history size manageable
    const maxHistorySize = Math.floor(this.config.metrics.retention / this.config.metrics.aggregationInterval);
    if (this.metricsHistory.length > maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-maxHistorySize);
    }
  }

  private updateHealthStatus(): void {
    const activeAlertsCount = this.getActiveAlerts().length;
    const criticalAlerts = this.getActiveAlerts().filter(a => a.severity === 'critical');
    
    if (criticalAlerts.length > 0) {
      this.metrics.health.status = 'unhealthy';
    } else if (activeAlertsCount > 0 || this.metrics.health.errorRate > 0.01) {
      this.metrics.health.status = 'degraded';
    } else {
      this.metrics.health.status = 'healthy';
    }
  }

  private checkAlerts(): void {
    const now = Date.now();

    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastTriggered = this.alertCooldowns.get(ruleId);
      if (lastTriggered && (now - lastTriggered) < rule.cooldown) {
        continue;
      }

      const metricValue = this.getMetricValue(rule.condition.metric);
      const conditionMet = this.evaluateCondition(metricValue, rule.condition);

      if (conditionMet) {
        this.triggerAlert(rule);
      }
    }
  }

  private getMetricValue(metricPath: string): number {
    const parts = metricPath.split('.');
    let value: any = this.metrics;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return typeof value === 'number' ? value : 0;
  }

  private evaluateCondition(value: number, condition: AlertRule['condition']): boolean {
    switch (condition.operator) {
      case '>': return value > condition.threshold;
      case '<': return value < condition.threshold;
      case '>=': return value >= condition.threshold;
      case '<=': return value <= condition.threshold;
      case '==': return value === condition.threshold;
      case '!=': return value !== condition.threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule): void {
    const alertId = this.generateAlertId();
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `Alert triggered: ${rule.name}`,
      triggeredAt: Date.now(),
      status: 'active',
      metadata: {
        metric: rule.condition.metric,
        threshold: rule.condition.threshold,
        currentValue: this.getMetricValue(rule.condition.metric)
      }
    };

    this.activeAlerts.set(alertId, alert);
    this.alertCooldowns.set(rule.id, Date.now());

    // Execute alert actions
    rule.actions.forEach(action => {
      this.executeAlertAction(action, alert);
    });

    this.emit('alert_triggered', alert);
  }

  private executeAlertAction(action: AlertRule['actions'][0], alert: Alert): void {
    try {
      switch (action.type) {
        case 'log':
          const level = action.config.level || 'warn';
          console[level as keyof Console](`[ALERT] ${alert.message}`, alert.metadata);
          break;

        case 'event':
          this.emit(action.config.eventType || 'alert', alert);
          break;

        case 'webhook':
          // Would implement webhook call
          console.log(`[WEBHOOK] Would call ${action.config.url} with alert:`, alert);
          break;

        case 'email':
          // Would implement email notification
          console.log(`[EMAIL] Would send to ${action.config.to}:`, alert.message);
          break;
      }
    } catch (error) {
      console.error('Alert action execution failed:', error);
    }
  }

  private resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      this.emit('alert_resolved', alert);
    }
  }

  private performCleanup(): void {
    const now = Date.now();

    // Clean up old traces
    if (this.config.tracing.enabled) {
      const traceRetention = this.config.tracing.retention;
      const traceIds = Array.from(this.traces.keys());
      
      for (const traceId of traceIds) {
        const trace = this.traces.get(traceId)!;
        if (now - trace.startTime > traceRetention) {
          this.traces.delete(traceId);
        }
      }

      // Limit total number of traces
      if (this.traces.size > this.config.tracing.maxTraces) {
        const sortedTraces = Array.from(this.traces.entries())
          .sort(([, a], [, b]) => a.startTime - b.startTime);
        
        const toDelete = sortedTraces.slice(0, sortedTraces.length - this.config.tracing.maxTraces);
        toDelete.forEach(([traceId]) => this.traces.delete(traceId));
      }
    }

    // Clean up resolved alerts older than 24 hours
    const alertIds = Array.from(this.activeAlerts.keys());
    for (const alertId of alertIds) {
      const alert = this.activeAlerts.get(alertId)!;
      if (alert.status === 'resolved' && alert.resolvedAt && 
          (now - alert.resolvedAt) > 24 * 60 * 60 * 1000) {
        this.activeAlerts.delete(alertId);
      }
    }
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.tracing.sampleRate;
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private logEvent(event: BaseEvent, context: any): void {
    if (this.config.logging.structured) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: context.error ? 'error' : 'info',
        eventId: event.id,
        eventType: event.type,
        source: event.source,
        traceId: context.traceId,
        duration: context.processingEndTime ? 
          context.processingEndTime - context.processingStartTime : undefined,
        error: context.error?.message,
        ...(this.config.logging.includePayloads && { payload: event.payload })
      }));
    } else {
      const message = `[${event.type}] ${event.id} from ${event.source}`;
      if (context.error) {
        console.error(message, context.error);
      } else {
        console.log(message);
      }
    }
  }

  private logError(error: Error, context: any): void {
    if (this.config.logging.structured) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: error.message,
        stack: error.stack,
        context
      }));
    } else {
      console.error('[ERROR]', error.message, context);
    }
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // Public API methods
  public exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      // Convert to Prometheus format
      const lines: string[] = [];
      
      lines.push(`# HELP events_total Total number of events processed`);
      lines.push(`# TYPE events_total counter`);
      lines.push(`events_total ${this.metrics.totalEvents}`);
      
      lines.push(`# HELP events_throughput_current Current events per second`);
      lines.push(`# TYPE events_throughput_current gauge`);
      lines.push(`events_throughput_current ${this.metrics.throughput.current}`);
      
      lines.push(`# HELP events_latency_seconds Event processing latency`);
      lines.push(`# TYPE events_latency_seconds summary`);
      lines.push(`events_latency_seconds{quantile="0.5"} ${this.metrics.latency.p50 / 1000}`);
      lines.push(`events_latency_seconds{quantile="0.9"} ${this.metrics.latency.p90 / 1000}`);
      lines.push(`events_latency_seconds{quantile="0.95"} ${this.metrics.latency.p95 / 1000}`);
      lines.push(`events_latency_seconds{quantile="0.99"} ${this.metrics.latency.p99 / 1000}`);
      
      return lines.join('\n');
    }

    return JSON.stringify(this.metrics, null, 2);
  }

  public createDashboard(): {
    overview: any;
    throughput: any;
    latency: any;
    errors: any;
    alerts: any;
  } {
    return {
      overview: {
        totalEvents: this.metrics.totalEvents,
        currentThroughput: this.metrics.throughput.current,
        healthStatus: this.metrics.health.status,
        activeAlerts: this.getActiveAlerts().length
      },
      throughput: {
        current: this.metrics.throughput.current,
        peak: this.metrics.throughput.peak,
        average: this.metrics.throughput.average,
        history: this.metricsHistory.map(m => ({
          timestamp: Date.now() - (this.metricsHistory.length - this.metricsHistory.indexOf(m)) * this.config.metrics.aggregationInterval,
          value: m.throughput.current
        }))
      },
      latency: this.metrics.latency,
      errors: {
        errorRate: this.metrics.health.errorRate,
        errorsByType: this.metrics.errorsByType
      },
      alerts: {
        active: this.getActiveAlerts(),
        rules: this.getAlertRules().filter(r => r.enabled)
      }
    };
  }

  public async shutdown(): Promise<void> {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.emit('shutdown');
  }
}