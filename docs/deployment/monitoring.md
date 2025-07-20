# Monitoring and Logging Guide

## Overview

This guide covers comprehensive monitoring, logging, alerting, and observability setup for CrewAI Team in production environments.

## Table of Contents

1. [Monitoring Stack](#monitoring-stack)
2. [Metrics Collection](#metrics-collection)
3. [Logging Infrastructure](#logging-infrastructure)
4. [Distributed Tracing](#distributed-tracing)
5. [Alerting Rules](#alerting-rules)
6. [Dashboards](#dashboards)
7. [Performance Monitoring](#performance-monitoring)
8. [Security Monitoring](#security-monitoring)
9. [Cost Monitoring](#cost-monitoring)
10. [Troubleshooting](#troubleshooting)

## Monitoring Stack

### Recommended Stack

- **Metrics**: Prometheus + Grafana
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana) or Loki
- **Traces**: Jaeger or Zipkin
- **APM**: DataDog, New Relic, or AppDynamics
- **Uptime**: Pingdom or UptimeRobot
- **Error Tracking**: Sentry

### Docker Compose Stack

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    ports:
      - "9090:9090"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3030:3000"
    networks:
      - monitoring

  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "3100:3100"
    volumes:
      - ./loki/config.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - /var/log:/var/log:ro
      - ./promtail/config.yml:/etc/promtail/config.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring

  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    ports:
      - "5775:5775/udp"
      - "6831:6831/udp"
      - "6832:6832/udp"
      - "5778:5778"
      - "16686:16686"
      - "14268:14268"
      - "14250:14250"
      - "9411:9411"
    environment:
      - COLLECTOR_ZIPKIN_HTTP_PORT=9411
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    volumes:
      - ./alertmanager/config.yml:/etc/alertmanager/config.yml
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
    ports:
      - "9093:9093"
    networks:
      - monitoring

volumes:
  prometheus-data:
  grafana-data:
  loki-data:

networks:
  monitoring:
    driver: bridge
```

## Metrics Collection

### Application Metrics

```typescript
// src/monitoring/metrics.ts
import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';

// Request metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Business metrics
export const emailsProcessed = new Counter({
  name: 'emails_processed_total',
  help: 'Total number of emails processed',
  labelNames: ['workflow', 'priority', 'status']
});

export const emailProcessingDuration = new Summary({
  name: 'email_processing_duration_seconds',
  help: 'Time taken to process emails',
  labelNames: ['workflow', 'priority'],
  percentiles: [0.5, 0.9, 0.95, 0.99]
});

// WebSocket metrics
export const websocketConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['authenticated']
});

export const websocketMessages = new Counter({
  name: 'websocket_messages_total',
  help: 'Total WebSocket messages',
  labelNames: ['direction', 'type']
});

// Agent metrics
export const agentTasks = new Counter({
  name: 'agent_tasks_total',
  help: 'Total agent tasks',
  labelNames: ['agent', 'status']
});

export const agentUtilization = new Gauge({
  name: 'agent_utilization',
  help: 'Agent utilization percentage',
  labelNames: ['agent']
});

// Cache metrics
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type']
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_type']
});

// Database metrics
export const dbQueries = new Counter({
  name: 'database_queries_total',
  help: 'Total database queries',
  labelNames: ['operation', 'table']
});

export const dbQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

// Export all metrics
export function getMetrics() {
  return register.metrics();
}
```

### Prometheus Configuration

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - "alerts/*.yml"

scrape_configs:
  - job_name: 'crewai-app'
    static_configs:
      - targets: ['app:9090']
    metrics_path: '/metrics'
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
      
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
      
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

## Logging Infrastructure

### Structured Logging

```typescript
// src/monitoring/logger.ts
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const esTransportOpts = {
  level: 'info',
  clientOpts: { node: process.env.ELASTICSEARCH_URL },
  index: 'crewai-logs'
};

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'crewai-api',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    new ElasticsearchTransport(esTransportOpts)
  ]
});

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id,
      userId: req.user?.id
    });
  });
  
  next();
}

// Error logging
export function logError(error: Error, context?: any) {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context
  });
}
```

### Loki Configuration

```yaml
# loki/config.yml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    cache_ttl: 24h
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

## Distributed Tracing

### OpenTelemetry Setup

```typescript
// src/monitoring/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'crewai-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
  }),
  traceExporter: jaegerExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

sdk.start();

// Manual tracing
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('crewai-api');

export function traceAsync<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        span.setAttributes(attributes);
      }
      
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Usage example
export async function processEmail(email: Email) {
  return traceAsync('email.process', async () => {
    const span = trace.getActiveSpan();
    span?.setAttributes({
      'email.id': email.id,
      'email.workflow': email.workflow,
      'email.priority': email.priority,
    });
    
    // Process email...
  });
}
```

## Alerting Rules

### Prometheus Alert Rules

```yaml
# prometheus/alerts/application.yml
groups:
  - name: application
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.route }}"
          
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: High response time detected
          description: "95th percentile response time is {{ $value }}s"
          
      - alert: EmailProcessingBacklog
        expr: rate(emails_processed_total[5m]) < 10 and email_queue_size > 100
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: Email processing backlog detected
          description: "Queue size is {{ $value }} with low processing rate"
          
      - alert: WebSocketConnectionDrop
        expr: rate(websocket_connections_active[5m]) < -10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Rapid WebSocket disconnections
          description: "{{ $value }} connections dropped in 5 minutes"
          
      - alert: DatabaseConnectionPoolExhausted
        expr: database_connections_active / database_connections_max > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Database connection pool nearly exhausted
          description: "{{ $value | humanizePercentage }} of connections in use"
          
      - alert: CacheHitRateLow
        expr: rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Cache hit rate below threshold
          description: "Cache hit rate is {{ $value | humanizePercentage }}"
```

### AlertManager Configuration

```yaml
# alertmanager/config.yml
global:
  resolve_timeout: 5m
  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: pagerduty
      continue: true
      
    - match:
        severity: warning
      receiver: slack
      
receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        title: 'CrewAI Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}{{ end }}'
        
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ .GroupLabels.alertname }}'
        
  - name: 'slack'
    slack_configs:
      - channel: '#warnings'
        title: 'CrewAI Warning'
        color: 'warning'
        text: '{{ .GroupLabels.alertname }}: {{ .Annotations.summary }}'
```

## Dashboards

### Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "CrewAI Application Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (method)"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 }
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 }
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 }
      },
      {
        "title": "Active WebSocket Connections",
        "targets": [
          {
            "expr": "websocket_connections_active"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 }
      },
      {
        "title": "Email Processing Rate",
        "targets": [
          {
            "expr": "sum(rate(emails_processed_total[5m])) by (workflow)"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 }
      },
      {
        "title": "Database Query Performance",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket[5m])) by (operation, le))"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 }
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 24 }
      },
      {
        "title": "Agent Utilization",
        "targets": [
          {
            "expr": "avg(agent_utilization) by (agent)"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 24 }
      }
    ]
  }
}
```

## Performance Monitoring

### APM Integration

```typescript
// src/monitoring/apm.ts
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

// Sentry initialization
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    new ProfilingIntegration(),
  ],
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});

// Custom performance monitoring
export class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    
    try {
      const result = fn();
      this.recordMeasurement(name, performance.now() - start);
      return result;
    } catch (error) {
      this.recordMeasurement(name, performance.now() - start, true);
      throw error;
    }
  }
  
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      this.recordMeasurement(name, performance.now() - start);
      return result;
    } catch (error) {
      this.recordMeasurement(name, performance.now() - start, true);
      throw error;
    }
  }
  
  private recordMeasurement(name: string, duration: number, error = false) {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    
    this.measurements.get(name)!.push(duration);
    
    // Send to metrics
    if (error) {
      httpRequestDuration.labels(name, 'error').observe(duration / 1000);
    } else {
      httpRequestDuration.labels(name, 'success').observe(duration / 1000);
    }
    
    // Send to APM
    Sentry.addBreadcrumb({
      message: `Performance: ${name}`,
      data: { duration, error },
      level: error ? 'error' : 'info',
    });
  }
  
  getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) return null;
    
    const sorted = measurements.sort((a, b) => a - b);
    
    return {
      count: measurements.length,
      mean: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }
}

export const perfMonitor = new PerformanceMonitor();
```

## Security Monitoring

### Security Event Logging

```typescript
// src/monitoring/security.ts
export class SecurityMonitor {
  logAuthFailure(userId: string, reason: string, ip: string) {
    logger.warn('Authentication failure', {
      event: 'auth_failure',
      userId,
      reason,
      ip,
      timestamp: new Date().toISOString(),
    });
    
    // Increment metrics
    authFailures.labels(reason).inc();
  }
  
  logSuspiciousActivity(userId: string, activity: string, details: any) {
    logger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
    
    // Send alert if threshold reached
    this.checkAlertThreshold(userId, activity);
  }
  
  logSecurityViolation(type: string, details: any) {
    logger.error('Security violation', {
      event: 'security_violation',
      type,
      details,
      timestamp: new Date().toISOString(),
    });
    
    // Immediate alert
    this.sendSecurityAlert(type, details);
  }
  
  private async checkAlertThreshold(userId: string, activity: string) {
    const key = `security:${userId}:${activity}`;
    const count = await redis.incr(key);
    await redis.expire(key, 3600); // 1 hour window
    
    if (count > 10) {
      this.sendSecurityAlert('threshold_exceeded', {
        userId,
        activity,
        count,
      });
    }
  }
  
  private sendSecurityAlert(type: string, details: any) {
    // Send to security team
    alertManager.sendAlert({
      severity: 'critical',
      type: 'security',
      subtype: type,
      details,
    });
  }
}
```

## Cost Monitoring

### Cloud Cost Tracking

```typescript
// src/monitoring/costs.ts
export class CostMonitor {
  async trackResourceUsage() {
    const usage = {
      compute: await this.getComputeUsage(),
      storage: await this.getStorageUsage(),
      network: await this.getNetworkUsage(),
      database: await this.getDatabaseUsage(),
    };
    
    // Calculate estimated costs
    const costs = this.calculateCosts(usage);
    
    // Send metrics
    cloudCosts.labels('compute').set(costs.compute);
    cloudCosts.labels('storage').set(costs.storage);
    cloudCosts.labels('network').set(costs.network);
    cloudCosts.labels('database').set(costs.database);
    
    // Check budget alerts
    this.checkBudgetAlerts(costs);
    
    return costs;
  }
  
  private calculateCosts(usage: ResourceUsage): Costs {
    // Example pricing (adjust for your cloud provider)
    const pricing = {
      compute: 0.10, // per vCPU hour
      storage: 0.023, // per GB month
      network: 0.09, // per GB egress
      database: 0.15, // per instance hour
    };
    
    return {
      compute: usage.compute.hours * usage.compute.vcpus * pricing.compute,
      storage: usage.storage.gb * pricing.storage,
      network: usage.network.egress * pricing.network,
      database: usage.database.hours * pricing.database,
      total: 0, // Calculate total
    };
  }
  
  private checkBudgetAlerts(costs: Costs) {
    const monthlyBudget = parseInt(process.env.MONTHLY_BUDGET || '1000');
    const projectedMonthly = costs.total * 30;
    
    if (projectedMonthly > monthlyBudget * 0.8) {
      logger.warn('Budget alert', {
        currentDaily: costs.total,
        projectedMonthly,
        budget: monthlyBudget,
        percentage: (projectedMonthly / monthlyBudget) * 100,
      });
    }
  }
}
```

## Troubleshooting

### Debug Logging

```typescript
// Enable debug logging
export function enableDebugLogging() {
  logger.level = 'debug';
  
  // Log all database queries
  db.on('query', (query) => {
    logger.debug('Database query', { query });
  });
  
  // Log all cache operations
  cache.on('get', (key, hit) => {
    logger.debug('Cache operation', { operation: 'get', key, hit });
  });
  
  // Log all HTTP requests in detail
  app.use((req, res, next) => {
    logger.debug('HTTP request', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    });
    next();
  });
}
```

### Performance Profiling

```bash
# CPU profiling
node --inspect dist/index.js

# Memory profiling
node --inspect --expose-gc dist/index.js

# Heap snapshot
kill -USR2 <pid>
```

### Log Analysis Queries

```sql
-- Kibana/Elasticsearch queries

-- Find slow queries
{
  "query": {
    "bool": {
      "must": [
        { "match": { "service": "crewai-api" } },
        { "range": { "duration": { "gte": 1000 } } }
      ]
    }
  }
}

-- Error spike detection
{
  "aggs": {
    "errors_over_time": {
      "date_histogram": {
        "field": "@timestamp",
        "interval": "5m"
      },
      "aggs": {
        "error_count": {
          "filter": {
            "term": { "level": "error" }
          }
        }
      }
    }
  }
}
```

## Best Practices

1. **Use structured logging**: JSON format for easy parsing
2. **Implement correlation IDs**: Track requests across services
3. **Set meaningful alerts**: Avoid alert fatigue
4. **Monitor business metrics**: Not just technical metrics
5. **Use distributed tracing**: For microservices debugging
6. **Regular review**: Analyze trends and patterns
7. **Automate responses**: Self-healing where possible
8. **Document procedures**: Runbooks for alerts
9. **Test monitoring**: Ensure alerts work correctly
10. **Cost awareness**: Monitor and optimize spending

## Next Steps

1. Deploy monitoring stack
2. Configure dashboards
3. Set up alert rules
4. Implement custom metrics
5. Create runbooks
6. Train team on tools
7. Regular monitoring reviews