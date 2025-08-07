# NLP Microservice

A dedicated, production-ready microservice for Natural Language Processing operations with integrated GroceryNLPQueue and respect for Ollama's 2-operation limit.

## Features

### Core Functionality
- **Grocery NLP Processing**: Specialized parsing for grocery-related queries
- **Entity Extraction**: Identifies products, quantities, units, actions, and locations
- **Intent Detection**: Determines user intentions (add, remove, update, search, list)
- **Batch Processing**: Efficient processing of multiple queries
- **Queue Management**: Respects Ollama's 2-operation limit with intelligent queuing

### API Support
- **REST API**: HTTP endpoints with comprehensive validation
- **gRPC API**: High-performance binary protocol
- **tRPC API**: Type-safe RPC with TypeScript integration

### Production Features
- **Health Monitoring**: Comprehensive health checks and alerting
- **Service Discovery**: Consul integration with heartbeat mechanisms
- **Graceful Shutdown**: Proper cleanup and queue draining
- **Metrics & Observability**: Detailed performance and operational metrics
- **Docker Support**: Container-ready with multi-stage builds
- **Security**: Rate limiting, CORS, API key authentication

## Quick Start

### Prerequisites
- Node.js 18+
- Ollama service running
- Redis (optional, for caching)

### Installation

```bash
# Clone the repository
cd src/microservices/nlp-service

# Install dependencies
npm install

# Build the service
npm run build
```

### Configuration

Create a `.env` file or set environment variables:

```bash
# Server Configuration
PORT=3001
GRPC_PORT=50051
HOST=0.0.0.0
NODE_ENV=production

# Ollama Configuration (Critical: Must be 2 for Walmart Grocery Agent)
OLLAMA_NUM_PARALLEL=2

# Queue Configuration
NLP_DEFAULT_TIMEOUT=30000
NLP_MAX_RETRIES=2
NLP_PERSISTENCE_ENABLED=true
NLP_QUEUE_PERSISTENCE_PATH=./data/nlp-queue

# Monitoring Configuration
MONITORING_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
ALERT_QUEUE_SIZE=50
ALERT_ERROR_RATE=0.1
ALERT_PROCESSING_TIME=5000
ALERT_MEMORY_USAGE=80

# Service Discovery Configuration
SERVICE_DISCOVERY_ENABLED=false
SERVICE_NAME=nlp-service
SERVICE_VERSION=1.0.0
SERVICE_REGISTRY_URL=http://consul:8500
HEARTBEAT_INTERVAL=10000

# Security Configuration
RATE_LIMITING_ENABLED=true
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=1 minute
API_KEYS_ENABLED=false
API_KEYS_REQUIRED=false
CORS_ENABLED=true
CORS_ORIGINS=http://localhost:3000,https://app.example.com

# Graceful Shutdown
GRACEFUL_SHUTDOWN_TIMEOUT=10000
SHUTDOWN_SIGNALS=SIGINT,SIGTERM
```

### Running the Service

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start

# Docker
docker build -t crewai-nlp-service .
docker run -p 3001:3001 -p 50051:50051 crewai-nlp-service

# Docker Compose (with dependencies)
docker-compose up
```

## API Documentation

### REST API

#### Health Check
```http
GET /health
```
Returns basic health status.

#### Detailed Health Check
```http
GET /health/detailed
```
Returns comprehensive health information including metrics.

#### Process Single Query
```http
POST /api/v1/process
Content-Type: application/json

{
  "query": "add 2 pounds of apples to my shopping list",
  "priority": "normal",
  "timeout": 30000,
  "metadata": {
    "userId": "user123",
    "source": "mobile-app"
  }
}
```

#### Process Batch Queries
```http
POST /api/v1/batch
Content-Type: application/json

{
  "queries": [
    { "query": "add milk" },
    { "query": "add bread" },
    { "query": "remove eggs" }
  ],
  "priority": "normal",
  "timeout": 60000
}
```

#### Queue Status
```http
GET /api/v1/queue/status
```

#### Service Metrics
```http
GET /metrics
```

### Response Format

#### Successful Processing Response
```json
{
  "success": true,
  "requestId": "req-1234567890-abc123",
  "result": {
    "entities": [
      {
        "type": "quantity",
        "value": "2",
        "confidence": 0.95,
        "startIndex": 4,
        "endIndex": 5
      },
      {
        "type": "unit",
        "value": "pounds",
        "confidence": 0.9,
        "startIndex": 6,
        "endIndex": 12
      },
      {
        "type": "product",
        "value": "apples",
        "confidence": 0.85,
        "startIndex": 16,
        "endIndex": 22
      }
    ],
    "intent": {
      "action": "add",
      "confidence": 0.9
    },
    "normalized": {
      "products": [
        {
          "name": "apples",
          "quantity": 2,
          "unit": "pounds"
        }
      ]
    },
    "metadata": {
      "processingTime": 250,
      "model": "ollama-llama2",
      "version": "1.0.0"
    }
  },
  "processingTime": 250,
  "queueTime": 50
}
```

### gRPC API

The service also exposes a gRPC API on port 50051. See `src/api/grpc/nlp_service.proto` for the complete protocol definition.

### tRPC API

Type-safe RPC endpoints are available for TypeScript applications. Import the router type for full type safety:

```typescript
import type { NLPRouter } from './src/api/trpc/router';
```

## Architecture

### Service Components

```
┌─────────────────────────────────────────────────┐
│                 NLP Microservice                │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │  REST API   │  │  gRPC API   │  │ tRPC API │  │
│  └─────────────┘  └─────────────┘  └──────────┘  │
├─────────────────────────────────────────────────┤
│                NLP Service Core                 │
├─────────────────────────────────────────────────┤
│              GroceryNLPQueue                    │
│           (2-Operation Limit)                   │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ Health       │  │ Service Discovery       │   │
│  │ Monitor      │  │ (Consul)               │   │
│  └──────────────┘  └─────────────────────────┘   │
├─────────────────────────────────────────────────┤
│              External Dependencies              │
│  ┌──────────┐  ┌───────┐  ┌─────────────────┐    │
│  │  Ollama  │  │ Redis │  │ Service Registry│    │
│  │ (2-ops)  │  │(Cache)│  │    (Consul)     │    │
│  └──────────┘  └───────┘  └─────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Queue Management

The service integrates with the existing `GroceryNLPQueue` which enforces Ollama's 2-operation limit:

- **Concurrent Limit**: Maximum 2 operations processing simultaneously
- **Priority Queuing**: High, normal, and low priority levels
- **Timeout Handling**: Configurable per-request timeouts
- **Retry Logic**: Automatic retry with exponential backoff
- **Persistence**: Queue state survives service restarts
- **Deduplication**: Prevents duplicate processing of identical queries

### Monitoring & Alerting

#### Health Checks
- **Service Health**: Overall service status
- **Queue Health**: Queue size, processing time, error rate
- **Dependency Health**: Ollama, Redis connectivity
- **Resource Health**: Memory, CPU usage

#### Metrics Collection
- **Request Metrics**: Total, successful, failed, rate
- **Queue Metrics**: Size, wait time, throughput
- **Resource Metrics**: Memory, CPU, heap usage
- **Dependency Metrics**: Response times, availability

#### Alert Rules
- Queue size exceeds threshold
- Error rate above acceptable level
- Processing time degradation
- Memory usage critical
- Dependency failures

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Type checking
npm run type-check
```

### Building

```bash
# Build for production
npm run build

# Build Docker image
npm run docker:build

# Run in Docker
npm run docker:run
```

## Production Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Scale the service
docker-compose up -d --scale nlp-service=3

# View logs
docker-compose logs -f nlp-service

# Stop services
docker-compose down
```

### Environment-Specific Configuration

The service automatically applies environment-specific configurations:

- **Development**: Relaxed security, verbose logging
- **Test**: Minimal monitoring, in-memory storage
- **Production**: Full security, service discovery, monitoring

### Monitoring Integration

The service exposes metrics in multiple formats:

- **REST Endpoint**: `/metrics` for custom monitoring
- **Health Checks**: `/health` for load balancer integration
- **gRPC Health**: Standard gRPC health checking protocol

### Service Discovery

When enabled, the service:

- Registers itself with Consul
- Sends periodic heartbeats
- Updates metadata dynamically
- Handles graceful deregistration

## Performance Considerations

### Ollama Integration
- **Respect 2-Operation Limit**: Critical for Walmart Grocery Agent
- **Queue Overflow Protection**: Prevents system overload
- **Timeout Management**: Prevents hanging requests
- **Batch Optimization**: Processes multiple queries efficiently

### Memory Management
- **Connection Pooling**: Reuses connections to external services
- **Graceful Degradation**: Handles high load gracefully
- **Memory Monitoring**: Alerts on high memory usage

### Scalability
- **Horizontal Scaling**: Multiple instances with load balancing
- **Service Discovery**: Automatic instance registration
- **Health-Based Routing**: Routes traffic to healthy instances

## Security

### Authentication & Authorization
- **API Keys**: Optional API key authentication
- **Request Validation**: Input sanitization and validation
- **Rate Limiting**: Prevents abuse and DoS attacks

### Network Security
- **CORS**: Configurable cross-origin request policies
- **Security Headers**: Helmet.js security headers
- **TLS Support**: HTTPS/TLS termination at load balancer

### Operational Security
- **Secret Management**: Environment-based configuration
- **Audit Logging**: Comprehensive request/response logging
- **Error Sanitization**: Prevents information leakage

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check configuration
npm run type-check

# Verify environment variables
env | grep -E "(PORT|OLLAMA|NODE_ENV)"

# Check dependencies
curl http://localhost:11434/api/tags  # Ollama health
```

#### Queue Overflow
```bash
# Check queue status
curl http://localhost:3001/api/v1/queue/status

# Clear queue (emergency only)
curl -X DELETE http://localhost:3001/api/v1/queue/clear \
  -H "x-api-key: your-admin-key"
```

#### High Memory Usage
```bash
# Monitor metrics
curl http://localhost:3001/metrics

# Check detailed health
curl http://localhost:3001/health/detailed
```

#### Performance Issues
```bash
# Monitor processing times
curl http://localhost:3001/metrics | jq '.queue'

# Check Ollama status
curl http://localhost:11434/api/tags
```

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Health Check Commands

```bash
# Basic health
curl http://localhost:3001/health

# Detailed health with metrics
curl http://localhost:3001/health/detailed

# Queue-specific health
curl http://localhost:3001/api/v1/queue/status
```

## Contributing

### Code Style
- TypeScript with strict mode
- ESLint with TypeScript rules
- Prettier for formatting
- Conventional commits

### Testing Requirements
- Unit tests for all services
- Integration tests for API endpoints
- Minimum 80% code coverage
- Performance tests for queue operations

### Pull Request Process
1. Create feature branch
2. Add tests for new functionality
3. Update documentation
4. Ensure all checks pass
5. Request review

## License

MIT License - see LICENSE file for details.

---

**Note**: This microservice is specifically designed to work with the Walmart Grocery Agent's Ollama 2-operation limit. Modifying the `OLLAMA_NUM_PARALLEL` setting may impact the performance and reliability of the grocery parsing functionality.