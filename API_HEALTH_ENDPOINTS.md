# API Health Endpoints Documentation

## Overview

The CrewAI Team API provides comprehensive health monitoring endpoints to track system status, service availability, and performance metrics. All health endpoints are designed to support both monitoring tools and manual health checks.

## Dual-Field Strategy (Transition Period)

During the migration from Ollama to llama.cpp, health endpoints implement a **dual-field strategy** to ensure backwards compatibility:

```json
{
  "services": {
    "llm": { /* Primary field - llama.cpp status */ },
    "ollama": { /* Deprecated field - mirrors llm status */ }
  }
}
```

### Deprecation Timeline

- **Current (Aug 2025)**: Both fields returned, identical values
- **Q4 2025**: Deprecation warnings added to responses using `ollama` field
- **Q1 2026**: `ollama` field removed from responses

### Migration Best Practices

```typescript
// Recommended: Check 'llm' first, fallback to 'ollama'
const getLLMStatus = (health: HealthResponse) => {
  return health.services.llm || health.services.ollama;
};

// Future-proof: Only use 'llm' field
const getLLMStatus = (health: HealthResponse) => {
  return health.services.llm;
};
```

## Primary Health Endpoint

### GET `/api/health`

Returns comprehensive system health status.

#### Response Format

```typescript
interface HealthStatus {
  status: "healthy" | "degraded" | "error";
  timestamp: string;           // ISO 8601 format
  version: string;              // Application version
  uptime: number;               // Milliseconds since start
  services: {
    api: ServiceStatus;
    llm: ServiceStatus;         // llama.cpp status (primary)
    ollama?: ServiceStatus;     // Deprecated, mirrors llm
    database: ServiceStatus;
    chromadb: ServiceStatus;
    rag: ServiceStatus;
    nlpQueue?: ServiceStatus;
  };
  system: {
    memory: {
      used: number;             // Bytes
      total: number;            // Bytes
      percentage: number;       // 0-100
    };
    cpu: {
      usage: number;            // Percentage 0-100
    };
  };
}

interface ServiceStatus {
  status: "healthy" | "degraded" | "error" | "unknown";
  message?: string;
  details?: Record<string, any>;
}
```

#### Example Response

```json
{
  "status": "healthy",
  "timestamp": "2025-08-22T10:30:00.000Z",
  "version": "2.0.0",
  "uptime": 3600000,
  "services": {
    "api": {
      "status": "healthy",
      "message": "API is running"
    },
    "llm": {
      "status": "healthy",
      "message": "llama.cpp server is connected",
      "details": {
        "models": 1,
        "baseUrl": "http://127.0.0.1:8081",
        "serverType": "llama.cpp",
        "modelName": "llama-3.2-3b-instruct",
        "contextSize": 8192
      }
    },
    "ollama": {
      "status": "healthy",
      "message": "llama.cpp server is connected",
      "details": {
        "models": 1,
        "baseUrl": "http://127.0.0.1:8081",
        "serverType": "llama.cpp"
      }
    },
    "database": {
      "status": "healthy",
      "message": "Database connection established",
      "details": {
        "type": "sqlite",
        "tables": 15,
        "connections": 5
      }
    },
    "chromadb": {
      "status": "healthy",
      "message": "ChromaDB is operational",
      "details": {
        "collections": 3,
        "documents": 1247
      }
    },
    "rag": {
      "status": "healthy",
      "message": "RAG system initialized"
    }
  },
  "system": {
    "memory": {
      "used": 2147483648,
      "total": 8589934592,
      "percentage": 25
    },
    "cpu": {
      "usage": 45
    }
  }
}
```

#### Status Codes

- **200 OK**: System is operational (healthy or degraded)
- **503 Service Unavailable**: System is in error state

#### Health Status Logic

The overall health status is determined by:

1. **healthy**: All critical services are healthy
2. **degraded**: At least one non-critical service is unhealthy
3. **error**: At least one critical service is in error state

Critical services:
- `api`
- `llm` (llama.cpp)
- `database`

## Service-Specific Endpoints

### GET `/api/health/llm`

Check llama.cpp server status specifically.

#### Response

```json
{
  "status": "healthy",
  "serverType": "llama.cpp",
  "endpoint": "http://127.0.0.1:8081",
  "models": [
    {
      "id": "llama-3.2-3b-instruct",
      "object": "model",
      "created": 1724332800,
      "owned_by": "local"
    }
  ],
  "performance": {
    "tokensPerSecond": 45,
    "contextSize": 8192,
    "batchSize": 512
  }
}
```

### GET `/api/health/database`

Check database connectivity and statistics.

#### Response

```json
{
  "status": "healthy",
  "type": "sqlite",
  "path": "./data/crewai.db",
  "stats": {
    "tables": 15,
    "size": 52428800,
    "activeConnections": 5,
    "maxConnections": 10
  }
}
```

### GET `/api/health/rag`

Check RAG system and vector store status.

#### Response

```json
{
  "status": "healthy",
  "vectorStore": "chromadb",
  "collections": [
    {
      "name": "documents",
      "count": 847
    },
    {
      "name": "emails",
      "count": 400
    }
  ],
  "embeddingModel": "llama-3.2-3b",
  "lastIndexed": "2025-08-22T09:15:00.000Z"
}
```

## WebSocket Health Monitoring

### WS `/api/ws/health`

Real-time health updates via WebSocket.

#### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001/api/ws/health');

ws.onmessage = (event) => {
  const health = JSON.parse(event.data);
  console.log('Health update:', health);
};
```

#### Message Format

```json
{
  "type": "health_update",
  "timestamp": "2025-08-22T10:30:00.000Z",
  "service": "llm",
  "status": "healthy",
  "details": { /* service-specific details */ }
}
```

## Monitoring Integration

### Prometheus Metrics

The health endpoints expose Prometheus-compatible metrics at `/metrics`:

```
# HELP api_health_status API health status (1=healthy, 0=unhealthy)
# TYPE api_health_status gauge
api_health_status{service="api"} 1
api_health_status{service="llm"} 1
api_health_status{service="database"} 1
api_health_status{service="chromadb"} 1
api_health_status{service="rag"} 1

# HELP api_response_time_ms API response time in milliseconds
# TYPE api_response_time_ms histogram
api_response_time_ms_bucket{le="10"} 45
api_response_time_ms_bucket{le="50"} 120
api_response_time_ms_bucket{le="100"} 150
```

### Grafana Dashboard

Import the provided Grafana dashboard for visual monitoring:

```json
{
  "dashboard": {
    "title": "CrewAI Health Monitor",
    "panels": [
      {
        "title": "Service Health",
        "targets": [
          {
            "expr": "api_health_status"
          }
        ]
      }
    ]
  }
}
```

## Health Check Strategies

### Basic Health Check

```bash
#!/bin/bash
# Simple health check script

response=$(curl -s http://localhost:3001/api/health)
status=$(echo $response | jq -r '.status')

if [ "$status" = "healthy" ]; then
  echo "✅ System is healthy"
  exit 0
else
  echo "❌ System is $status"
  exit 1
fi
```

### Advanced Monitoring

```typescript
// TypeScript health monitor
class HealthMonitor {
  private readonly healthUrl = 'http://localhost:3001/api/health';
  private readonly checkInterval = 30000; // 30 seconds
  
  async monitor() {
    setInterval(async () => {
      try {
        const response = await fetch(this.healthUrl);
        const health = await response.json();
        
        // Check LLM status (with backwards compatibility)
        const llmStatus = health.services.llm || health.services.ollama;
        
        if (llmStatus.status !== 'healthy') {
          this.alertUnhealthy('LLM', llmStatus);
        }
        
        // Check other critical services
        ['database', 'rag'].forEach(service => {
          if (health.services[service].status !== 'healthy') {
            this.alertUnhealthy(service, health.services[service]);
          }
        });
        
      } catch (error) {
        this.alertError('Health check failed', error);
      }
    }, this.checkInterval);
  }
  
  private alertUnhealthy(service: string, status: any) {
    console.error(`⚠️ ${service} is ${status.status}: ${status.message}`);
    // Send alert to monitoring system
  }
  
  private alertError(message: string, error: any) {
    console.error(`❌ ${message}:`, error);
    // Send critical alert
  }
}
```

## Docker Health Check

Add health checks to your Docker configuration:

```dockerfile
# Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
```

```yaml
# docker-compose.yml
services:
  api:
    image: crewai-api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s
```

## Kubernetes Probes

Configure Kubernetes health probes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crewai-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: crewai-api:latest
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 2
          successThreshold: 1
```

## Troubleshooting

### Common Health Check Issues

1. **LLM Service Unhealthy**
   - Check if llama-server is running: `ps aux | grep llama-server`
   - Verify port accessibility: `curl http://127.0.0.1:8081/health`
   - Check model file exists: `ls -la ./models/`

2. **Database Unhealthy**
   - Check database file permissions: `ls -la ./data/crewai.db`
   - Verify SQLite installation: `sqlite3 --version`
   - Check disk space: `df -h`

3. **ChromaDB Unhealthy**
   - Verify ChromaDB is running: `docker ps | grep chromadb`
   - Check network connectivity: `curl http://localhost:8000`
   - Review ChromaDB logs: `docker logs chromadb`

### Debug Mode

Enable verbose health checks:

```bash
# Set debug environment variable
DEBUG=health:* npm run dev:server

# Or in .env file
DEBUG_HEALTH=true
```

## API Client Examples

### JavaScript/TypeScript

```typescript
// Health check client
class HealthClient {
  constructor(private baseUrl = 'http://localhost:3001') {}
  
  async checkHealth(): Promise<HealthStatus> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }
  
  async waitForHealthy(timeout = 60000): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const health = await this.checkHealth();
        if (health.status === 'healthy') {
          return;
        }
      } catch (error) {
        // Service might not be ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Service did not become healthy within timeout');
  }
}
```

### Python

```python
import requests
import time

class HealthClient:
    def __init__(self, base_url='http://localhost:3001'):
        self.base_url = base_url
    
    def check_health(self):
        response = requests.get(f'{self.base_url}/api/health')
        response.raise_for_status()
        return response.json()
    
    def wait_for_healthy(self, timeout=60):
        start = time.time()
        
        while time.time() - start < timeout:
            try:
                health = self.check_health()
                if health['status'] == 'healthy':
                    return health
            except:
                pass  # Service might not be ready
            
            time.sleep(1)
        
        raise TimeoutError('Service did not become healthy')

# Usage
client = HealthClient()
health = client.wait_for_healthy()
print(f"System status: {health['status']}")
```

### cURL

```bash
# Basic health check
curl http://localhost:3001/api/health | jq '.'

# Check specific service
curl http://localhost:3001/api/health | jq '.services.llm'

# Monitor continuously
watch -n 5 'curl -s http://localhost:3001/api/health | jq ".status"'
```

## Rate Limiting

Health endpoints have generous rate limits to support monitoring:

- `/api/health`: 60 requests per minute per IP
- `/api/health/*`: 30 requests per minute per IP
- `/metrics`: No rate limit (for Prometheus scraping)

## Security Considerations

1. **No Authentication Required**: Health endpoints are public by design
2. **Limited Information Disclosure**: Sensitive details are not exposed
3. **Rate Limiting**: Prevents abuse while allowing monitoring
4. **CORS Enabled**: Allows browser-based monitoring dashboards

## Future Enhancements

### Planned Features (Q4 2025)

1. **Historical Health Data**: Store and query past health states
2. **Predictive Health**: ML-based failure prediction
3. **Custom Health Checks**: User-defined health criteria
4. **Health Score**: Weighted scoring system
5. **Dependency Mapping**: Visual service dependency graph

### API Version 3.0 (2026)

- GraphQL health endpoint
- WebSocket subscriptions for specific services
- Health check plugins system
- Automated recovery actions
- SLA tracking and reporting

---

**Version**: 2.0.0 | **Last Updated**: August 22, 2025 | **API Stability**: Stable