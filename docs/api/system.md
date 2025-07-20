# System API

## Overview

The System API provides endpoints for health checks, metrics, configuration management, and system monitoring. These endpoints are essential for operations, monitoring, and debugging.

## Endpoints

### Health Check

Basic health check endpoint for load balancers and monitoring.

```http
GET /api/health
```

#### Response

```json
{
  "status": "healthy",
  "timestamp": "2025-01-20T12:00:00Z",
  "version": "2.1.0",
  "uptime": 864000 // seconds
}
```

### Detailed Health Status

Comprehensive health check with component status.

```http
GET /api/health/detailed
Authorization: Bearer <token>
```

#### Response

```json
{
  "status": "degraded", // healthy, degraded, unhealthy
  "timestamp": "2025-01-20T12:00:00Z",
  "version": "2.1.0",
  "uptime": 864000,
  "components": {
    "api": {
      "status": "healthy",
      "responseTime": 12,
      "details": {
        "activeRequests": 45,
        "requestsPerSecond": 120
      }
    },
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "details": {
        "connections": 15,
        "poolSize": 20,
        "activeQueries": 3
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "details": {
        "connected": true,
        "memoryUsage": "245MB",
        "hitRate": 0.92
      }
    },
    "websocket": {
      "status": "healthy",
      "responseTime": 1,
      "details": {
        "connections": 234,
        "authenticatedClients": 198
      }
    },
    "agents": {
      "status": "degraded",
      "responseTime": 150,
      "details": {
        "total": 12,
        "healthy": 10,
        "degraded": 2,
        "offline": 0
      }
    },
    "storage": {
      "status": "healthy",
      "details": {
        "diskUsage": "45%",
        "freeSpace": "120GB"
      }
    }
  },
  "checks": {
    "lastRun": "2025-01-20T11:59:00Z",
    "nextRun": "2025-01-20T12:01:00Z",
    "failedChecks": [
      {
        "component": "agent-classifier",
        "error": "High response time",
        "threshold": 100,
        "actual": 150
      }
    ]
  }
}
```

### System Metrics

Real-time system metrics and performance data.

```http
GET /api/metrics
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| format | string | json | Output format (json, prometheus) |
| include | array | all | Specific metrics to include |

#### Response (JSON Format)

```json
{
  "metrics": {
    "system": {
      "cpu": {
        "usage": 45.2,
        "cores": 8,
        "loadAverage": [2.1, 1.8, 1.5]
      },
      "memory": {
        "total": 16384, // MB
        "used": 8765,
        "free": 7619,
        "percentage": 53.5
      },
      "disk": {
        "total": 500, // GB
        "used": 225,
        "free": 275,
        "percentage": 45
      },
      "network": {
        "bytesIn": 1234567890,
        "bytesOut": 9876543210,
        "packetsIn": 1234567,
        "packetsOut": 7654321
      }
    },
    "application": {
      "requests": {
        "total": 1234567,
        "rate": 120.5, // per second
        "errors": 234,
        "errorRate": 0.019
      },
      "response": {
        "average": 125, // ms
        "median": 95,
        "p95": 245,
        "p99": 512
      },
      "database": {
        "queries": 9876543,
        "queryRate": 450.2,
        "slowQueries": 123,
        "connections": {
          "active": 15,
          "idle": 5,
          "total": 20
        }
      },
      "cache": {
        "hits": 7654321,
        "misses": 234567,
        "hitRate": 0.97,
        "evictions": 12345,
        "memoryUsage": 256 // MB
      },
      "websocket": {
        "connections": 234,
        "messages": {
          "sent": 456789,
          "received": 345678,
          "rate": 45.6 // per second
        }
      },
      "email": {
        "processed": 45678,
        "pending": 123,
        "failed": 12,
        "averageProcessingTime": 234 // ms
      },
      "agents": {
        "tasks": {
          "completed": 23456,
          "failed": 123,
          "pending": 45,
          "successRate": 0.995
        },
        "utilization": 0.68
      }
    }
  },
  "timestamp": "2025-01-20T12:00:00Z"
}
```

#### Response (Prometheus Format)

```
# HELP api_requests_total Total number of API requests
# TYPE api_requests_total counter
api_requests_total 1234567

# HELP api_request_duration_seconds API request duration
# TYPE api_request_duration_seconds histogram
api_request_duration_seconds_bucket{le="0.1"} 789012
api_request_duration_seconds_bucket{le="0.5"} 1123456
api_request_duration_seconds_bucket{le="1"} 1234000
api_request_duration_seconds_sum 156789
api_request_duration_seconds_count 1234567

# HELP system_cpu_usage CPU usage percentage
# TYPE system_cpu_usage gauge
system_cpu_usage 45.2
```

### System Configuration

Get current system configuration (admin only).

```http
GET /api/system/config
Authorization: Bearer <token>
```

#### Response

```json
{
  "configuration": {
    "environment": "production",
    "version": "2.1.0",
    "features": {
      "businessSearch": true,
      "emailAnalysis": true,
      "multiAgentWorkflows": true,
      "webSocketAuth": true
    },
    "limits": {
      "maxEmailSize": 10485760, // 10MB
      "maxAttachmentSize": 5242880, // 5MB
      "maxConcurrentConnections": 1000,
      "requestTimeout": 30000, // ms
      "maxRequestSize": 1048576 // 1MB
    },
    "email": {
      "processingEnabled": true,
      "batchSize": 100,
      "retentionDays": 90,
      "slaThresholds": {
        "high": 3600, // 1 hour
        "medium": 14400, // 4 hours
        "low": 86400 // 24 hours
      }
    },
    "agents": {
      "enabled": true,
      "maxConcurrentTasks": 50,
      "taskTimeout": 300000, // 5 minutes
      "retryAttempts": 3
    },
    "cache": {
      "enabled": true,
      "provider": "redis",
      "ttl": 3600, // seconds
      "maxSize": 10000
    },
    "rateLimiting": {
      "enabled": true,
      "general": {
        "windowMs": 60000,
        "max": 60
      },
      "websearch": {
        "windowMs": 900000,
        "max": 100
      }
    }
  }
}
```

### Update Configuration

Update system configuration (admin only).

```http
PUT /api/system/config
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "features": {
    "businessSearch": false
  },
  "limits": {
    "maxConcurrentConnections": 2000
  }
}
```

### System Logs

Query system logs (admin only).

```http
GET /api/system/logs
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| level | string | - | Filter by log level |
| service | string | - | Filter by service |
| from | string | -1h | Start time (ISO 8601 or relative) |
| to | string | now | End time |
| limit | integer | 100 | Number of results |
| search | string | - | Search in log messages |

#### Response

```json
{
  "logs": [
    {
      "timestamp": "2025-01-20T12:00:00.123Z",
      "level": "error",
      "service": "email-processor",
      "message": "Failed to process email",
      "context": {
        "emailId": "email-123",
        "error": "Timeout exceeded",
        "duration": 30145
      },
      "traceId": "abc123xyz",
      "spanId": "def456"
    }
  ],
  "pagination": {
    "total": 4567,
    "limit": 100,
    "hasMore": true,
    "nextCursor": "eyJvZmZzZXQiOjEwMH0="
  }
}
```

### System Events

Get system events and audit trail (admin only).

```http
GET /api/system/events
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| type | string | - | Filter by event type |
| actor | string | - | Filter by actor (user/system) |
| from | string | -24h | Start time |
| to | string | now | End time |
| limit | integer | 100 | Number of results |

#### Response

```json
{
  "events": [
    {
      "id": "event-123",
      "timestamp": "2025-01-20T12:00:00Z",
      "type": "config_changed",
      "actor": {
        "type": "user",
        "id": "user-456",
        "name": "Admin User"
      },
      "action": "update_configuration",
      "resource": {
        "type": "system_config",
        "id": "features.businessSearch"
      },
      "changes": {
        "before": true,
        "after": false
      },
      "metadata": {
        "ip": "192.168.1.100",
        "userAgent": "Mozilla/5.0..."
      }
    }
  ]
}
```

### Database Stats

Get database statistics and performance metrics.

```http
GET /api/system/database
Authorization: Bearer <token>
```

#### Response

```json
{
  "database": {
    "type": "sqlite",
    "version": "3.40.0",
    "file": "crewai.db",
    "size": 156789012, // bytes
    "tables": {
      "emails": {
        "rows": 125678,
        "size": 45678901,
        "indexes": ["idx_received_at", "idx_customer_id"]
      },
      "email_analysis": {
        "rows": 125678,
        "size": 23456789,
        "indexes": ["idx_email_id", "idx_workflow"]
      }
    },
    "performance": {
      "queryCount": 456789,
      "slowQueries": 123,
      "cacheHitRate": 0.89,
      "walSize": 5678901,
      "checkpoints": 456
    },
    "connections": {
      "current": 15,
      "max": 20,
      "idle": 5
    }
  }
}
```

### Cache Statistics

Get cache statistics and performance.

```http
GET /api/system/cache
Authorization: Bearer <token>
```

#### Response

```json
{
  "cache": {
    "provider": "redis",
    "status": "connected",
    "memory": {
      "used": 256, // MB
      "limit": 1024,
      "evicted": 12345
    },
    "stats": {
      "hits": 7654321,
      "misses": 234567,
      "hitRate": 0.97,
      "sets": 345678,
      "deletes": 12345
    },
    "keys": {
      "total": 4567,
      "byPattern": {
        "business:*": 234,
        "email:*": 1234,
        "session:*": 567
      }
    },
    "ttl": {
      "average": 3456,
      "expiringSoon": 123
    }
  }
}
```

### Feature Flags

Get all feature flags and their current state.

```http
GET /api/system/features
Authorization: Bearer <token>
```

#### Response

```json
{
  "features": {
    "businessSearch": {
      "enabled": true,
      "rollout": 100,
      "updatedAt": "2025-01-15T10:00:00Z",
      "updatedBy": "user-456"
    },
    "emailBatchProcessing": {
      "enabled": true,
      "rollout": 100,
      "config": {
        "batchSize": 100,
        "timeout": 30000
      }
    },
    "advancedAnalytics": {
      "enabled": false,
      "rollout": 0,
      "reason": "Under development"
    },
    "webSocketCompression": {
      "enabled": true,
      "rollout": 50,
      "criteria": "random"
    }
  }
}
```

### Maintenance Mode

Enable or disable maintenance mode (admin only).

```http
POST /api/system/maintenance
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "enabled": true,
  "message": "System maintenance in progress. Expected completion: 3:00 AM EST",
  "allowedIPs": ["192.168.1.100", "10.0.0.0/8"],
  "estimatedEndTime": "2025-01-21T08:00:00Z"
}
```

### Export System Report

Generate and download a system report.

```http
POST /api/system/report
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "sections": [
    "health",
    "metrics",
    "configuration",
    "database",
    "cache",
    "logs"
  ],
  "format": "pdf", // pdf, json, csv
  "period": "7d"
}
```

#### Response

```json
{
  "reportId": "report-123",
  "status": "generating",
  "estimatedSize": 5242880,
  "downloadUrl": "/api/system/report/report-123/download"
}
```

## Monitoring Endpoints

### Readiness Probe

For Kubernetes readiness checks.

```http
GET /api/ready
```

Returns 200 if ready to serve traffic, 503 if not.

### Liveness Probe

For Kubernetes liveness checks.

```http
GET /api/alive
```

Returns 200 if application is alive.

## Code Examples

### JavaScript/TypeScript

```typescript
// Monitor system health
async function monitorHealth() {
  const response = await fetch('/api/health/detailed', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const health = await response.json();
  
  if (health.status !== 'healthy') {
    // Alert on degraded or unhealthy status
    const unhealthyComponents = Object.entries(health.components)
      .filter(([_, component]) => component.status !== 'healthy')
      .map(([name, _]) => name);
      
    console.error('Unhealthy components:', unhealthyComponents);
  }
  
  return health;
}

// Get metrics for dashboard
async function getMetrics() {
  const response = await fetch('/api/metrics', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { metrics } = await response.json();
  
  return {
    cpu: metrics.system.cpu.usage,
    memory: metrics.system.memory.percentage,
    requestRate: metrics.application.requests.rate,
    errorRate: metrics.application.requests.errorRate,
    cacheHitRate: metrics.application.cache.hitRate
  };
}
```

### Python Monitoring Script

```python
import requests
import time
from datetime import datetime

class SystemMonitor:
    def __init__(self, api_url, token):
        self.api_url = api_url
        self.headers = {'Authorization': f'Bearer {token}'}
        
    def check_health(self):
        response = requests.get(
            f'{self.api_url}/api/health/detailed',
            headers=self.headers
        )
        return response.json()
        
    def get_metrics(self):
        response = requests.get(
            f'{self.api_url}/api/metrics',
            headers=self.headers
        )
        return response.json()
        
    def monitor_continuously(self, interval=60):
        while True:
            health = self.check_health()
            metrics = self.get_metrics()
            
            print(f"\n[{datetime.now()}] System Status: {health['status']}")
            print(f"CPU: {metrics['metrics']['system']['cpu']['usage']:.1f}%")
            print(f"Memory: {metrics['metrics']['system']['memory']['percentage']:.1f}%")
            print(f"Request Rate: {metrics['metrics']['application']['requests']['rate']:.1f}/s")
            
            # Check for issues
            if health['status'] != 'healthy':
                self.alert_unhealthy(health)
                
            time.sleep(interval)
            
    def alert_unhealthy(self, health):
        print("\n🚨 ALERT: System is not healthy!")
        for component, status in health['components'].items():
            if status['status'] != 'healthy':
                print(f"  - {component}: {status['status']}")
```

## Best Practices

1. **Regular health checks**: Monitor at 30-60 second intervals
2. **Set up alerts**: Alert on degraded or unhealthy status
3. **Monitor trends**: Look for gradual degradation
4. **Log analysis**: Regularly review error patterns
5. **Capacity planning**: Monitor resource usage trends
6. **Security auditing**: Review system events regularly
7. **Performance baselines**: Establish normal metrics ranges