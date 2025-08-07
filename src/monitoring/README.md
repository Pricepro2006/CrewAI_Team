# Comprehensive Monitoring System

This monitoring system provides complete observability for the Walmart Grocery Agent with error tracking, performance monitoring, custom metrics, alerts, and structured logging.

## 🌟 Features

- **Error Tracking**: Comprehensive error capture with Sentry integration
- **Performance Monitoring**: Real-time performance metrics for tRPC procedures and database queries
- **Custom Metrics**: Business-specific metrics for grocery agent operations
- **Alert System**: Multi-channel alerting with escalation policies
- **Structured Logging**: Advanced logging with log aggregation and search
- **Real-time Dashboard**: Interactive monitoring dashboard with visualizations
- **Health Checks**: Automated system health monitoring
- **Error Recovery**: Automatic error boundaries and recovery mechanisms

## 📋 Components

### 1. Error Tracking (`SentryErrorTracker`)
- **Sentry Integration**: Production-ready error tracking
- **Custom Error Types**: Specialized error classes for different failure types
- **Performance Profiling**: Built-in performance profiling
- **Context Enrichment**: Automatic context and user data capture
- **Custom Metrics**: Business metrics tracking

### 2. Performance Monitoring (`PerformanceMonitor`, `TRPCPerformanceMonitor`)
- **tRPC Middleware**: Automatic procedure performance tracking
- **Database Query Monitoring**: Query performance and slow query detection
- **Memory & CPU Tracking**: System resource monitoring
- **Threshold Alerts**: Configurable performance thresholds
- **Response Time Analysis**: P50, P95, P99 percentile tracking

### 3. Custom Metrics (`GroceryAgentMetrics`)
- **NLP Parsing Metrics**: Success rates and confidence tracking
- **Product Matching Metrics**: Match accuracy and search performance
- **Price Fetching Metrics**: API success rates and response times
- **Deal Detection Metrics**: Detection effectiveness and savings
- **User Session Metrics**: Engagement and conversion tracking
- **WebSocket Metrics**: Connection stability and message throughput

### 4. Alert System (`AlertSystem`)
- **Multi-Channel Notifications**: Email, Slack, Teams, Discord, WebHooks, SMS
- **Escalation Policies**: Automatic escalation with time delays
- **Alert Throttling**: Prevents alert storms
- **Pattern Detection**: Identifies alert patterns and trends
- **Acknowledgment System**: Alert acknowledgment and resolution tracking

### 5. Structured Logging (`StructuredLogger`)
- **Winston Integration**: Production-grade logging with Winston
- **Log Aggregation**: Elasticsearch and external log service integration
- **PII Redaction**: Automatic removal of sensitive data
- **Log Rotation**: Daily log rotation with compression
- **Search & Analysis**: Log search and pattern analysis
- **Multiple Formats**: JSON and text formatting options

### 6. Monitoring Dashboard (`MonitoringDashboard`)
- **Real-time Metrics**: Live performance and error metrics
- **Interactive Charts**: Response time, throughput, and error rate visualization
- **Alert Management**: View and manage active alerts
- **Component Health**: System component status monitoring
- **Export Functionality**: Export metrics and diagnostics

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install @sentry/node @sentry/tracing @sentry/profiling-node winston winston-daily-rotate-file winston-elasticsearch prom-client node-cron
```

### 2. Environment Configuration

```bash
# Sentry Configuration
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENVIRONMENT=production
APP_VERSION=1.0.0

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DIR=./logs
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme

# Log Aggregation
LOG_AGGREGATION_URL=https://your-log-service.com/api/logs
LOG_AGGREGATION_TOKEN=your_token_here

# Alert Configuration
ALERT_EMAIL_ENABLED=true
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/your/slack/webhook
ALERT_TEAMS_WEBHOOK=https://your-teams-webhook-url

# Performance Thresholds
PERFORMANCE_WARNING_MS=500
PERFORMANCE_CRITICAL_MS=2000
ERROR_RATE_THRESHOLD=0.05
```

### 3. Initialize Monitoring

```typescript
import { initializeMonitoring } from './src/monitoring/MonitoringSystem.js';

// Initialize with configuration
const monitoring = await initializeMonitoring({
  sentry: {
    dsn: process.env.SENTRY_DSN!,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
  },
  alerts: {
    email: {
      enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      },
      from: 'alerts@yourcompany.com',
      to: ['team@yourcompany.com'],
    },
    slack: {
      enabled: !!process.env.ALERT_SLACK_WEBHOOK,
      webhookUrl: process.env.ALERT_SLACK_WEBHOOK!,
      channel: '#alerts',
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: (process.env.LOG_FORMAT as 'json' | 'text') || 'json',
    elasticsearch: process.env.ELASTICSEARCH_URL ? {
      url: process.env.ELASTICSEARCH_URL,
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
    } : undefined,
  },
  metrics: {
    retentionHours: 24,
    aggregationIntervalMinutes: 5,
    alertThresholds: {
      nlpSuccessRate: 0.85,
      productMatchRate: 0.80,
      priceSuccessRate: 0.90,
      responseTimeMs: 2000,
      errorRatePercent: 5,
    },
  },
});
```

### 4. Add Middleware

```typescript
import monitoringMiddleware from './src/api/middleware/monitoringMiddleware.js';

// Express middleware
app.use(monitoringMiddleware.http());
app.use(monitoringMiddleware.error());

// tRPC middleware
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const middleware = t.middleware;
export const publicProcedure = t.procedure
  .use(monitoringMiddleware.trpc());
```

### 5. Use Monitoring in Components

```typescript
import { groceryMonitoring } from './src/api/middleware/monitoringMiddleware.js';

// NLP Processing
const nlpContext = groceryMonitoring.nlpParsing.start(query, userId);
try {
  const result = await processQuery(query);
  groceryMonitoring.nlpParsing.complete(
    nlpContext, query, true, confidence, result, undefined, userId
  );
} catch (error) {
  groceryMonitoring.nlpParsing.complete(
    nlpContext, query, false, 0, undefined, error, userId
  );
}

// Product Matching
groceryMonitoring.productMatching.record(
  searchTerm, 'fuzzy', confidence, searchTime, category, userId
);

// Price Fetching
groceryMonitoring.priceFetching.record(
  productId, success, responseTime, storeId, error, userId
);
```

## 📊 Dashboard Usage

### Accessing the Dashboard

1. Navigate to `/monitoring` in your application
2. The dashboard provides real-time insights into system performance
3. Use time range controls to adjust the monitoring window
4. Filter alerts by component or severity level
5. Export metrics and diagnostics for external analysis

### Key Metrics to Monitor

- **Response Time**: Average response time for API calls
- **Error Rate**: Percentage of failed requests
- **Success Rates**: NLP parsing, product matching, and price fetching success rates
- **Active Users**: Number of concurrent users
- **Memory Usage**: System memory consumption
- **Alert Count**: Number of active alerts by severity

## 🔧 Configuration Options

### Alert Thresholds

```typescript
groceryAgentMetrics.updateAlertThresholds({
  nlpSuccessRate: 0.85,     // 85% minimum success rate
  productMatchRate: 0.80,   // 80% minimum match rate
  priceSuccessRate: 0.90,   // 90% minimum price fetch success
  responseTimeMs: 2000,     // 2s maximum response time
  errorRatePercent: 5,      // 5% maximum error rate
});
```

### Notification Channels

```typescript
alertSystem.updateConfig({
  email: { enabled: true, /* ... */ },
  slack: { enabled: true, /* ... */ },
  teams: { enabled: true, /* ... */ },
  webhook: { enabled: true, /* ... */ },
});
```

### Log Levels

- `emergency`: System is unusable
- `alert`: Action must be taken immediately
- `critical`: Critical conditions
- `error`: Error conditions
- `warning`: Warning conditions
- `notice`: Normal but significant condition
- `info`: Informational messages
- `debug`: Debug-level messages
- `trace`: Very detailed debug information

## 🚨 Alert Types

### System Alerts

- `monitoring_system_initialized`: System startup
- `system_unhealthy`: Overall system health degraded
- `memory_limit_error`: Memory usage critical
- `performance_threshold_error`: Performance threshold exceeded

### Grocery Agent Alerts

- `nlp_success_rate_low`: NLP parsing success rate below threshold
- `product_match_rate_low`: Product matching rate below threshold
- `price_success_rate_low`: Price fetching success rate below threshold
- `deal_detection_rate_low`: Deal detection rate below threshold

### Infrastructure Alerts

- `database_query_error`: Database query failed
- `websocket_error_rate_high`: WebSocket error rate exceeded
- `alert_storm_detected`: Too many alerts in short time
- `component_repeated_failures`: Component generating frequent alerts

## 📈 Custom Metrics

### Recording Custom Metrics

```typescript
import { groceryAgentMetrics, sentryErrorTracker } from './src/monitoring';

// Record business metrics
groceryAgentMetrics.recordNLPParsing(true, 0.95, 150, query);
groceryAgentMetrics.recordProductMatching('exact', 0.98, 89, searchTerm);
groceryAgentMetrics.recordPriceFetch(true, 234, productId, storeId);

// Record custom Sentry metrics
sentryErrorTracker.recordCustomMetric('custom_business_metric', value, {
  component: 'business_logic',
  operation: 'custom_operation',
});
```

### Viewing Metrics

```typescript
// Get current metrics
const metrics = groceryAgentMetrics.exportAllMetrics();
const stats = groceryAgentMetrics.getLogStats(24); // Last 24 hours

// Get metric snapshots
const snapshots = groceryAgentMetrics.getMetricSnapshots(24);
```

## 🔍 Debugging and Troubleshooting

### Viewing Logs

```typescript
import { structuredLogger } from './src/monitoring/StructuredLogger.js';

// Search logs
const results = structuredLogger.searchLogs('error query', {
  component: 'nlp_processor',
  level: 'error',
  limit: 50,
});

// Get log statistics
const stats = structuredLogger.getLogStats(24);

// Export logs
const exportData = structuredLogger.exportLogs('json');
```

### Health Checks

```typescript
import { monitoringSystem } from './src/monitoring/MonitoringSystem.js';

// Get system health
const health = monitoringSystem.getSystemHealth();

// Export diagnostics
const diagnostics = await monitoringSystem.exportDiagnostics();
```

### Manual Alerts

```typescript
import { alertSystem } from './src/monitoring/AlertSystem.js';

// Create manual alert
alertSystem.createAlert(
  'custom_alert',
  'warning',
  'Custom alert message',
  'custom_component',
  { custom: 'data' }
);

// Test notification channels
alertSystem.testNotification('slack');
```

## 🔒 Security Considerations

- **PII Redaction**: All logs automatically redact personally identifiable information
- **Secure Configuration**: Store sensitive configuration in environment variables
- **Access Control**: Implement proper access controls for monitoring endpoints
- **Data Retention**: Configure appropriate data retention policies
- **Encryption**: Use TLS for all external communications

## 📝 Best Practices

1. **Set Appropriate Thresholds**: Configure alert thresholds based on your SLA requirements
2. **Monitor Key Business Metrics**: Focus on metrics that matter to your users
3. **Use Structured Logging**: Always use structured logs with consistent fields
4. **Implement Circuit Breakers**: Use monitoring data to implement circuit breakers
5. **Regular Health Checks**: Implement comprehensive health checks
6. **Escalation Policies**: Define clear escalation policies for different alert types
7. **Documentation**: Keep monitoring documentation up to date
8. **Testing**: Regularly test alert channels and monitoring components

## 🤝 Contributing

When adding new monitoring capabilities:

1. Follow the existing patterns for error types and metrics
2. Add appropriate tests for new functionality
3. Update documentation and configuration examples
4. Ensure proper error handling and fallbacks
5. Consider performance impact of monitoring code

## 📚 Additional Resources

- [Sentry Documentation](https://docs.sentry.io/platforms/node/)
- [Winston Logging Guide](https://github.com/winstonjs/winston)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [Alert Manager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Elasticsearch Logging](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)