# Monitoring and Observability Setup

This document describes the comprehensive monitoring and observability system implemented in the CrewAI Team application.

## Overview

The monitoring system provides real-time insights into application performance, health, and errors through:

- **Performance Metrics**: Track API response times, database queries, and LLM operations
- **Error Tracking**: Capture, categorize, and analyze application errors
- **Health Checks**: Monitor service availability and system resources
- **WebSocket Monitoring**: Track real-time connection metrics
- **System Metrics**: Monitor CPU, memory, and process statistics

## Architecture

### Core Components

1. **MetricsCollector** (`src/monitoring/MetricsCollector.ts`)
   - Collects and aggregates system metrics
   - Supports counter, gauge, and histogram metric types
   - Exports metrics in Prometheus format
   - Tracks system resource usage

2. **ErrorTracker** (`src/monitoring/ErrorTracker.ts`)
   - Captures and categorizes application errors
   - Tracks error frequency and patterns
   - Provides error search and filtering
   - Maintains error history with automatic cleanup

3. **PerformanceMonitor** (`src/monitoring/PerformanceMonitor.ts`)
   - Tracks operation performance with timing
   - Identifies slow operations and threshold violations
   - Provides performance statistics and percentiles
   - Monitors resource usage patterns

4. **HealthChecker** (`src/monitoring/HealthChecker.ts`)
   - Performs periodic health checks on services
   - Tracks service availability and latency
   - Provides overall system health status
   - Alerts on critical service failures

### Middleware Integration

The monitoring system integrates with Express middleware to automatically track:

```typescript
// Request tracking
app.use(requestTracking);
app.use(requestSizeTracking);
app.use(rateLimitTracking);
app.use(authTracking);
```

### API Routes

Monitoring endpoints are available at `/api/monitoring/*`:

- `GET /api/monitoring/health` - Public health check endpoint
- `GET /api/monitoring/health/detailed` - Detailed health status (admin only)
- `GET /api/monitoring/metrics` - Prometheus-format metrics (admin only)
- `GET /api/monitoring/errors` - Recent errors (admin only)
- `GET /api/monitoring/performance` - Performance statistics (admin only)

## Configuration

### Environment Variables

```bash
# Monitoring intervals (optional)
HEALTH_CHECK_INTERVAL=30000  # 30 seconds
METRICS_RETENTION_MS=3600000  # 1 hour
ERROR_RETENTION_MS=86400000   # 24 hours
```

### Default Health Checks

The system automatically monitors:

1. **Database**: SQLite connection and query capability
2. **Ollama**: LLM service availability
3. **ChromaDB**: Vector database connection (if configured)
4. **Redis**: Cache service (if configured)
5. **Memory**: Heap usage and thresholds

### Performance Thresholds

Default performance thresholds are configured for common operations:

```typescript
// API endpoints
api_request: { warning: 100ms, critical: 500ms }

// Database operations
database_query: { warning: 50ms, critical: 200ms }

// LLM operations
ollama_inference: { warning: 1000ms, critical: 5000ms }

// WebSocket operations
websocket_broadcast: { warning: 10ms, critical: 50ms }
```

## Usage

### Accessing the Monitoring Dashboard

1. Navigate to Settings in the application
2. Click on the "Monitoring" tab
3. View real-time metrics and health status

### Admin Requirements

Most monitoring endpoints require admin privileges. Ensure your user has the `isAdmin` flag set to access detailed metrics.

### Monitoring Dashboard Features

1. **Health Overview**
   - Overall system status (healthy/degraded/unhealthy)
   - Service-specific health indicators
   - Critical service alerts

2. **Performance Metrics**
   - Operation response times
   - Slowest operations tracking
   - Threshold violations

3. **Error Analytics**
   - Error frequency and severity
   - Error patterns and aggregations
   - Searchable error logs

4. **System Resources**
   - CPU usage and load averages
   - Memory consumption
   - Process statistics

## Integration Examples

### Tracking Custom Operations

```typescript
import { performanceMonitor } from '@/monitoring/PerformanceMonitor';

// Track async operation
const result = await performanceMonitor.trackAsync(
  'custom_operation',
  async () => {
    // Your operation code
    return await someAsyncOperation();
  },
  { metadata: 'additional context' }
);

// Track sync operation
const syncResult = performanceMonitor.track(
  'sync_operation',
  () => {
    // Your sync code
    return computeSomething();
  }
);
```

### Recording Custom Metrics

```typescript
import { metricsCollector } from '@/monitoring/MetricsCollector';

// Counter
metricsCollector.increment('custom_counter', 1, { label: 'value' });

// Gauge
metricsCollector.gauge('queue_size', queue.length);

// Histogram
metricsCollector.histogram('processing_time_ms', processingTime);
```

### Tracking Errors

```typescript
import { errorTracker } from '@/monitoring/ErrorTracker';

try {
  // Your code
} catch (error) {
  errorTracker.trackError(
    error as Error,
    {
      endpoint: '/api/custom',
      userId: user.id,
      requestId: req.id
    },
    'medium', // severity: low, medium, high, critical
    false,    // handled
    ['custom', 'api'] // tags
  );
}
```

## Alerts and Notifications

The monitoring system emits events for critical conditions:

```typescript
healthChecker.on('critical-service-failure', ({ service, health }) => {
  // Handle critical failure
});

healthChecker.on('service-down', ({ service, failures }) => {
  // Handle service down after consecutive failures
});

errorTracker.on('critical-error', (errorEvent) => {
  // Handle critical errors
});
```

## Best Practices

1. **Set Appropriate Thresholds**: Adjust performance thresholds based on your application's SLA requirements

2. **Regular Health Checks**: Ensure health check intervals balance between timely detection and system load

3. **Monitor Critical Paths**: Focus monitoring on user-facing and business-critical operations

4. **Clean Up Old Data**: The system automatically cleans up old metrics and errors, but adjust retention periods based on your needs

5. **Use Tags and Labels**: Add meaningful tags to metrics and errors for better filtering and analysis

## Troubleshooting

### High Memory Usage

If monitoring is consuming too much memory:

1. Reduce retention periods in configuration
2. Limit the number of metrics being collected
3. Increase cleanup intervals

### Missing Metrics

If metrics are not appearing:

1. Check user permissions (admin required)
2. Verify services are properly initialized
3. Check browser console for API errors

### Health Check Failures

If health checks are failing:

1. Verify service URLs and ports
2. Check network connectivity
3. Review service logs for errors
4. Adjust timeout values if needed

## Security Considerations

1. **Access Control**: All detailed monitoring endpoints require admin authentication
2. **Data Sanitization**: Error messages are sanitized to prevent information leakage
3. **Rate Limiting**: Monitoring endpoints are rate-limited to prevent abuse
4. **HTTPS Only**: Ensure monitoring data is transmitted over secure connections

## Future Enhancements

Planned improvements to the monitoring system:

1. **External Metrics Export**: Support for external monitoring systems (Grafana, Datadog)
2. **Custom Dashboards**: User-configurable monitoring dashboards
3. **Alerting Rules**: Configurable alert thresholds and notifications
4. **Historical Analysis**: Long-term metrics storage and trend analysis
5. **Distributed Tracing**: Support for distributed system monitoring