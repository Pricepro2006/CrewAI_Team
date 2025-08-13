# Walmart Grocery Agent - Service Discovery & Load Balancing System

This directory contains a production-ready service discovery and load balancing system specifically designed for the Walmart Grocery Agent microservices architecture.

## 🏗️ Architecture Overview

The system implements a comprehensive service mesh with the following core components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Walmart Service Mesh                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Service Registry│  │  Load Balancer  │  │ Health Checker  │    │
│  │ (Redis-based)   │  │ (Multi-strategy)│  │ (Circuit Breaker│    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Service Proxy   │  │ Service Discovery│  │ Auto Scaling    │    │
│  │ (HTTP/WS)       │  │ (Orchestrator)   │  │ (Policy-based)  │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## 🛠️ Core Components

### 1. ServiceRegistry (`discovery/ServiceRegistry.ts`)
- **Redis-based service registration** with TTL-based expiration
- **Auto-registration** with heartbeat monitoring
- **Service metadata** storage and retrieval
- **Event-driven updates** with real-time notifications
- **Graceful cleanup** of expired services

### 2. LoadBalancer (`discovery/LoadBalancer.ts`)
- **Multiple strategies**: Round-robin, Weighted, Least connections, Random, IP Hash, Resource-based
- **Health-aware routing** with automatic failover
- **Circuit breaker integration** for fault tolerance
- **Connection tracking** and performance metrics
- **Sticky session support** for stateful services

### 3. HealthChecker (`discovery/HealthChecker.ts`)
- **HTTP/HTTPS/WebSocket** health checks
- **Configurable intervals** and timeout handling
- **Circuit breaker integration** for failing services
- **Batch health checking** for efficiency
- **Recovery detection** with automated recovery

### 4. ServiceProxy (`discovery/ServiceProxy.ts`)
- **Transparent request routing** with retry logic
- **Caching layer integration** for performance
- **Request/response transformation** capabilities
- **WebSocket proxy support** for real-time services
- **Express middleware integration**

### 5. ServiceDiscovery (`discovery/ServiceDiscovery.ts`)
- **Main orchestrator** coordinating all components
- **Auto-scaling support** with policy-based decisions
- **Comprehensive metrics** collection and reporting
- **Service lifecycle management**
- **Graceful shutdown** handling

### 6. WalmartServiceMesh (`WalmartServiceMesh.ts`)
- **High-level interface** for managing the complete architecture
- **Service deployment** in dependency order
- **Express and WebSocket integration**
- **Auto-scaling monitoring**
- **Health monitoring dashboard**

## 🎯 Walmart Services Configuration

The system is specifically configured for these Walmart microservices:

| Service | Port | Protocol | Scaling | Load Balancing | Priority |
|---------|------|----------|---------|----------------|----------|
| **walmart-api-server** | 3000 | HTTP | 1-3 instances | Least Connections | 1 |
| **walmart-websocket** | 8080 | WebSocket | 1-2 instances | Least Connections | 2 |
| **walmart-pricing** | 3007 | HTTP | 1-3 instances | Weighted Round Robin | 3 |
| **walmart-nlp-queue** | 3008 | HTTP | 1-2 instances | Least Response Time | 4 |
| **walmart-cache-warmer** | 3006 | HTTP | 1 instance | Round Robin | 5 |
| **walmart-memory-monitor** | 3009 | HTTP | 1 instance | Round Robin | 6 |

## 🚀 Quick Start

### Basic Usage

```typescript
import { walmartServiceMesh } from './microservices';

// Deploy all services
const deploymentSuccess = await walmartServiceMesh.deployAllServices();

if (deploymentSuccess) {
  console.log('✅ All services deployed successfully');
  
  // Get service proxy for making requests
  const pricingProxy = walmartServiceMesh.getServiceProxy('walmart-pricing');
  
  // Make a request through the proxy
  const response = await pricingProxy.proxyRequest({
    method: 'GET',
    path: '/api/price/12345',
    headers: { 'Content-Type': 'application/json' },
  });
  
  console.log('Response:', response);
} else {
  console.error('❌ Service deployment failed');
}
```

### Express Integration

```typescript
import express from 'express';
import { walmartServiceMesh } from './microservices';

const app = express();

// Deploy services first
await walmartServiceMesh.deployAllServices();

// Setup automatic service proxying
walmartServiceMesh.setupExpressProxies(app);

// Now requests to /walmart-pricing/* will be automatically proxied
app.listen(8000, () => {
  console.log('🎯 API Gateway running on port 8000');
});
```

### WebSocket Integration

```typescript
import { createServer } from 'http';
import { walmartServiceMesh } from './microservices';

const server = createServer(app);

// Setup WebSocket proxying
walmartServiceMesh.setupWebSocketProxy(server);

server.listen(8000);
```

### Service Scaling

```typescript
// Scale the pricing service to 3 instances
const scaleSuccess = await walmartServiceMesh.scaleService('walmart-pricing', 3);

if (scaleSuccess) {
  console.log('✅ Service scaled successfully');
} else {
  console.error('❌ Service scaling failed');
}
```

## 🔄 Load Balancing Strategies

### Round Robin
Distributes requests evenly across all healthy instances.
```typescript
strategy: 'round_robin'
```

### Weighted Round Robin
Distributes based on instance weights (higher weight = more requests).
```typescript
strategy: 'weighted_round_robin'
```

### Least Connections
Routes to the instance with fewest active connections.
```typescript
strategy: 'least_connections'
```

### Least Response Time
Routes to the instance with lowest average response time.
```typescript
strategy: 'least_response_time'
```

### Resource-Based
Routes based on CPU and memory usage metrics.
```typescript
strategy: 'resource_based'
```

### IP Hash
Ensures same client IP always goes to same instance (sticky).
```typescript
strategy: 'ip_hash'
```

## 🏥 Health Monitoring

### Health Check Configuration

```typescript
const healthConfig = {
  interval: 15000,      // Check every 15 seconds
  timeout: 5000,        // 5 second timeout
  retries: 3,           // Retry 3 times
  expectedStatus: [200, 204],  // Success status codes
  expectedBody: /healthy/,     // Optional body validation
};
```

### Circuit Breaker Integration

- **Failure Threshold**: Automatically opens circuit after N failures
- **Reset Timeout**: Time before attempting to close circuit
- **Half-Open State**: Limited requests to test recovery
- **Monitoring Window**: Time window for calculating failure rates

## 📊 Monitoring & Metrics

### Service Discovery Metrics
- Total services registered
- Healthy vs unhealthy services
- Registration/deregistration events
- Health check success/failure rates

### Load Balancer Metrics
- Request distribution by strategy
- Active connections per service
- Average response times
- Circuit breaker state changes

### Proxy Metrics
- Total requests proxied
- Success/failure rates
- Cache hit rates
- Response time percentiles

### Access Metrics Endpoint

```bash
# Get comprehensive service mesh status
curl http://localhost:8000/service-mesh/stats

# Get individual service health
curl http://localhost:8000/service-mesh/health
```

## 🔧 Configuration

### Service Configuration Example

```typescript
const serviceConfig: WalmartServiceDefinition = {
  name: 'walmart-pricing',
  version: '1.0.0',
  host: 'localhost',
  port: 3007,
  protocol: 'http',
  health_endpoint: '/health',
  capacity: 150,
  weight: 2,
  tags: ['walmart', 'pricing', 'comparison'],
  load_balancing_strategy: 'weighted_round_robin',
  circuit_breaker_enabled: true,
  proxy_enabled: true,
  proxy_caching_enabled: true,
  proxy_cache_ttl: 300,
  scaling: {
    min_instances: 1,
    max_instances: 3,
    auto_scale: true,
    cpu_threshold: 70,
    memory_threshold: 80,
  },
  dependencies: ['walmart-api-server'],
  deployment_priority: 3,
};
```

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
REDIS_TLS_ENABLED=true

# Service Discovery
SERVICE_DISCOVERY_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
CIRCUIT_BREAKER_ENABLED=true

# Load Balancing
DEFAULT_LOAD_BALANCING_STRATEGY=least_connections
STICKY_SESSIONS_ENABLED=false
MAX_CONNECTIONS_PER_SERVICE=100
```

## 🚨 Error Handling

### Circuit Breaker States
- **CLOSED**: Normal operation
- **OPEN**: Failing fast, no requests allowed
- **HALF_OPEN**: Testing recovery with limited requests

### Retry Logic
- **Exponential backoff** for failed requests
- **Maximum retry attempts** configuration
- **Retryable vs non-retryable** error detection

### Graceful Degradation
- **Automatic failover** to healthy instances
- **Service isolation** prevents cascade failures
- **Fallback responses** when all instances fail

## 🧪 Testing

### Run Service Mesh Example

```bash
npm run service-mesh:example
```

This will:
1. Deploy all Walmart services
2. Start API gateway on port 8000
3. Setup WebSocket proxy
4. Demonstrate service communication
5. Show auto-scaling in action

### Available Endpoints

```bash
# Health check
curl http://localhost:8000/health

# Service status
curl http://localhost:8000/status

# Scale service
curl -X POST -H "Content-Type: application/json" \
  -d '{"instances": 2}' \
  http://localhost:8000/services/walmart-pricing/scale

# Proxy to service
curl http://localhost:8000/walmart-pricing/api/health
```

## 🛡️ Security Features

- **Redis authentication** with password protection
- **TLS encryption** for Redis connections in production
- **Service authentication** through proxy configuration
- **Request/response sanitization**
- **Rate limiting** through circuit breakers

## 📈 Performance Optimization

- **Connection pooling** for database and Redis connections
- **Response caching** with TTL-based expiration
- **Batch health checking** for efficiency
- **Lazy loading** of service connections
- **Async/await** throughout for non-blocking operations

## 🔧 Deployment

### Production Deployment

1. **Start Redis** cluster
2. **Configure environment** variables
3. **Deploy services** in dependency order
4. **Monitor health** and scaling metrics
5. **Setup alerts** for circuit breaker events

### Docker Deployment

Each service can be containerized and deployed using Docker with the service discovery system handling inter-container communication.

### Kubernetes Integration

The system can be integrated with Kubernetes service discovery while maintaining the intelligent load balancing and health monitoring capabilities.

## 🤝 Contributing

When adding new services:

1. **Update WalmartServiceConfig.ts** with service definition
2. **Configure health check** endpoints
3. **Set appropriate load balancing** strategy
4. **Define scaling policies**
5. **Add monitoring metrics**

## 📚 API Reference

See the individual TypeScript files for complete API documentation with JSDoc comments covering all methods, parameters, and return types.

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server is running
   - Verify connection credentials
   - Check network connectivity

2. **Service Registration Failed**
   - Ensure service is healthy
   - Check health endpoint accessibility
   - Verify service configuration

3. **Load Balancing Not Working**
   - Check if services are marked as healthy
   - Verify circuit breaker states
   - Review load balancing strategy configuration

4. **Auto-scaling Issues**
   - Check CPU/memory thresholds
   - Verify scaling policies
   - Review service capacity limits

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will provide detailed information about service discovery operations, health checks, and load balancing decisions.

---

## 📊 System Requirements

- **Node.js**: 18.x or higher
- **Redis**: 6.x or higher
- **Memory**: 512MB minimum per service
- **Network**: Low latency between services recommended

## 🎯 Next Steps

1. **Implement metric dashboards** with Grafana/Prometheus
2. **Add service mesh observability** with distributed tracing
3. **Implement advanced auto-scaling** with predictive algorithms
4. **Add A/B testing capabilities** through intelligent routing
5. **Implement service versioning** and blue-green deployments