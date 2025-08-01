# Email Pipeline Health Check System

## Overview

The Email Pipeline Health Check System provides comprehensive monitoring and health assessment for the email processing pipeline. It monitors critical services, tracks performance metrics, and provides real-time health status information through a set of REST API endpoints.

## Architecture

### Components

1. **EmailPipelineHealthChecker** (`/src/core/monitoring/EmailPipelineHealthChecker.ts`)
   - Core service for health monitoring
   - Singleton pattern for consistent state management
   - Comprehensive health checks for all pipeline components

2. **Health Router** (`/src/api/routes/email-pipeline-health.router.ts`)
   - RESTful API endpoints for health monitoring
   - Authentication-aware endpoints
   - Comprehensive error handling and logging

3. **Type Definitions** (`/src/types/email-pipeline-health.types.ts`)
   - Complete TypeScript type definitions
   - Type guards and utility functions
   - Default configurations

## API Endpoints

### Public Endpoints

#### `GET /api/health/email-pipeline`

Returns overall pipeline health status (public access).

**Response Example:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-30T12:00:00.000Z",
  "services": {
    "critical": {
      "database": "healthy",
      "ollama": "healthy",
      "pipeline": "healthy"
    },
    "optional": {
      "redis": "healthy",
      "processingQueue": "healthy"
    }
  },
  "metrics": {
    "totalEmails": 15420,
    "todaysEmails": 234,
    "queueDepth": 12,
    "averageProcessingTime": 2.5
  },
  "responseTime": 45
}
```

**Query Parameters:**

- `force` (boolean): Force fresh health check, bypass cache

### Authenticated Endpoints

#### `GET /api/health/email-pipeline/detailed`

Returns detailed pipeline health status with comprehensive metrics.

**Response Example:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-30T12:00:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "lastCheck": "2025-01-30T12:00:00.000Z",
      "responseTime": 15,
      "details": "Database responsive, size: 125MB",
      "metrics": {
        "responseTime": 15,
        "databaseSize": 131072000,
        "tablesChecked": 3
      }
    },
    "ollama": {
      "status": "healthy",
      "lastCheck": "2025-01-30T12:00:00.000Z",
      "responseTime": 1250,
      "details": "5 models available",
      "metrics": {
        "responseTime": 1250,
        "modelsAvailable": 5,
        "missingModels": 0
      }
    }
    // ... other services
  },
  "metrics": {
    "totalEmails": 15420,
    "todaysEmails": 234,
    "unprocessedEmails": 12,
    "failedEmails": 3,
    "averageProcessingTime": 2.5,
    "queueDepth": 12
  },
  "resources": {
    "memoryUsage": 256,
    "cpuUsage": 15.5,
    "diskUsage": 0,
    "databaseSize": 125
  },
  "detailedMetrics": {
    "processingRates": {
      "lastHour": 45,
      "last24Hours": 890,
      "last7Days": 6230
    },
    "queueMetrics": {
      "depth": 12,
      "averageWaitTime": 5.2,
      "throughput": 37.1
    },
    "stageMetrics": {
      "stage1Success": 99.2,
      "stage2Success": 94.8,
      "stage3Success": 87.5,
      "overallSuccessRate": 96.1
    }
  },
  "cacheInfo": {
    "cached": true,
    "cacheAge": 15000
  },
  "responseTime": 23
}
```

#### `GET /api/metrics/email-pipeline`

Returns comprehensive pipeline performance metrics.

**Query Parameters:**

- `timeWindow` (enum): `1h`, `24h`, `7d`, `30d` (default: `24h`)
- `includeDetails` (boolean): Include detailed service information

#### `POST /api/health/email-pipeline/check`

Forces a fresh health check, bypassing cache.

#### `GET /api/health/email-pipeline/services/:service`

Returns health status for a specific service.

**Valid Services:**

- `database`
- `redis`
- `ollama`
- `pipeline`
- `processingQueue`

#### `DELETE /api/health/email-pipeline/cache`

Clears the health check cache, forcing fresh checks on next request.

## Health Status Levels

### Overall Status

- **`healthy`**: All critical services operational, metrics within normal ranges
- **`degraded`**: Some services have issues, but system is functional
- **`unhealthy`**: Critical services down or metrics indicate serious problems

### Service-Specific Status

Each service reports individual health status based on:

#### Database

- **Healthy**: Response time < 100ms, all tables accessible
- **Degraded**: Response time 100-500ms, some performance issues
- **Unhealthy**: Response time > 500ms or connection failures

#### Ollama (LLM Service)

- **Healthy**: Response time < 2s, all required models available
- **Degraded**: Response time 2-5s or some models missing
- **Unhealthy**: Response time > 5s or service unreachable

#### Pipeline

- **Healthy**: Success rate ≥ 95%, pipeline status normal
- **Degraded**: Success rate 80-95%, some failures
- **Unhealthy**: Success rate < 80% or pipeline failures

#### Processing Queue

- **Healthy**: No stuck emails, queue depth < 1000
- **Degraded**: Some stuck emails or queue depth 1000-5000
- **Unhealthy**: Many stuck emails or queue depth > 5000

## Integration with Existing Monitoring

### Metrics Integration

The health checker integrates with the existing metrics collection system:

```typescript
metrics.increment("email_pipeline.health_check_duration", responseTime);
metrics.gauge("email_pipeline.overall_health", healthScore);
```

### Error Tracking

All health check failures are logged and tracked:

```typescript
logger.error("Database health check failed", "EMAIL_PIPELINE_HEALTH", error);
metrics.increment("email_pipeline.health_check_errors");
```

## Configuration

### Default Configuration

```typescript
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  cacheTTL: 30000, // 30 seconds
  timeouts: {
    database: 1000,
    redis: 2000,
    ollama: 5000,
    pipeline: 3000,
    queue: 2000,
  },
  thresholds: {
    responseTime: {
      healthy: 1000,
      degraded: 3000,
    },
    successRate: {
      healthy: 95,
      degraded: 80,
    },
    queueDepth: {
      healthy: 1000,
      degraded: 5000,
    },
    memoryUsage: {
      healthy: 512, // MB
      degraded: 1024, // MB
    },
  },
};
```

### Environment Variables

- `DATABASE_PATH`: Path to SQLite database
- `REDIS_URL`: Redis connection URL (optional)
- `OLLAMA_BASE_URL`: Ollama service URL

## Usage Examples

### Basic Health Check

```bash
curl -X GET http://localhost:3001/api/health/email-pipeline
```

### Detailed Health Check (Authenticated)

```bash
curl -X GET http://localhost:3001/api/health/email-pipeline/detailed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Force Fresh Health Check

```bash
curl -X POST http://localhost:3001/api/health/email-pipeline/check \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Specific Service

```bash
curl -X GET http://localhost:3001/api/health/email-pipeline/services/database \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Performance Metrics

```bash
curl -X GET "http://localhost:3001/api/metrics/email-pipeline?timeWindow=24h&includeDetails=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Programmatic Usage

### TypeScript/JavaScript

```typescript
import { EmailPipelineHealthChecker } from "./core/monitoring/EmailPipelineHealthChecker.js";

const healthChecker = EmailPipelineHealthChecker.getInstance();

// Get current health status
const health = await healthChecker.getHealthStatus();
console.log(`Pipeline status: ${health.status}`);

// Force fresh health check
const freshHealth = await healthChecker.forceHealthCheck();

// Get detailed metrics
const metrics = await healthChecker.getPipelineMetrics();
console.log(`Total emails: ${metrics.totalEmails}`);
```

## Monitoring and Alerting

### Health Check Automation

Set up automated health checks:

```bash
# Cron job example (every 5 minutes)
*/5 * * * * curl -f http://localhost:3001/api/health/email-pipeline || echo "Pipeline unhealthy"
```

### Integration with Monitoring Systems

#### Prometheus Metrics

The system exposes metrics in Prometheus format through the existing `/api/monitoring/metrics` endpoint.

#### Custom Alerts

```typescript
// Example alert configuration
const healthChecker = EmailPipelineHealthChecker.getInstance();

setInterval(async () => {
  const health = await healthChecker.getHealthStatus();

  if (health.status === "unhealthy") {
    // Send alert to your monitoring system
    await sendAlert("Email pipeline is unhealthy", health);
  }
}, 60000); // Check every minute
```

## Troubleshooting

### Common Issues

#### Database Connection Failures

- Check database file permissions
- Verify `DATABASE_PATH` environment variable
- Ensure database schema is up to date

#### Ollama Service Unreachable

- Verify Ollama is running: `ollama serve`
- Check `OLLAMA_BASE_URL` configuration
- Ensure required models are pulled: `ollama pull llama3.2:3b`

#### High Queue Depth

- Check email processing pipeline status
- Review processing rates and bottlenecks
- Monitor system resources (CPU, memory)

### Debug Mode

Enable detailed logging:

```bash
export LOG_LEVEL=debug
npm start
```

### Manual Health Checks

Use the force check endpoint to bypass cache and get real-time status:

```bash
curl -X GET "http://localhost:3001/api/health/email-pipeline?force=true"
```

## Security Considerations

### Authentication

- Public health endpoint provides limited information
- Detailed endpoints require JWT authentication
- Sensitive metrics and controls are admin-only

### Rate Limiting

All endpoints are subject to the existing rate limiting middleware.

### Data Exposure

Health endpoints are designed to provide operational information without exposing sensitive data:

- No email content or user data
- No internal system paths or credentials
- Aggregate metrics only

## Future Enhancements

### Planned Features

1. **Health History**: Store and retrieve historical health data
2. **Custom Alerts**: Configurable alerting thresholds
3. **Service Dependencies**: Track and visualize service dependencies
4. **Performance Trends**: Historical performance trend analysis
5. **Auto-Recovery**: Automated recovery actions for common issues

### Extensibility

The system is designed for easy extension:

```typescript
// Add custom health checks
class CustomServiceHealthChecker {
  async checkCustomService(): Promise<ServiceHealth> {
    // Custom health check logic
  }
}
```

## API Reference Summary

| Endpoint                                       | Method | Auth     | Description             |
| ---------------------------------------------- | ------ | -------- | ----------------------- |
| `/api/health/email-pipeline`                   | GET    | None     | Basic health status     |
| `/api/health/email-pipeline/detailed`          | GET    | Required | Detailed health status  |
| `/api/metrics/email-pipeline`                  | GET    | Required | Performance metrics     |
| `/api/health/email-pipeline/check`             | POST   | Required | Force health check      |
| `/api/health/email-pipeline/services/:service` | GET    | Required | Service-specific health |
| `/api/health/email-pipeline/cache`             | DELETE | Required | Clear health cache      |

All authenticated endpoints require a valid JWT token in the Authorization header.
