# Circuit Breaker Service - Walmart Grocery Agent

## Overview

The CircuitBreakerService provides comprehensive resilience patterns for the Walmart Grocery Agent microservices architecture. It implements circuit breakers, retry logic, and bulkhead patterns to ensure system stability and graceful degradation when external services fail.

## Features

### 🔧 Circuit Breaker Pattern
- **Three States**: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
- **Configurable Thresholds**: Customize failure/success thresholds per service
- **Automatic Recovery**: Intelligent state transitions with timeouts
- **Real-time Monitoring**: Track success/failure rates and response times

### 🔄 Retry Logic
- **Exponential Backoff**: Configurable base delay with multiplier and jitter
- **Smart Error Detection**: Retryable vs non-retryable error classification
- **Maximum Attempts**: Prevent infinite retry loops
- **Idempotency Support**: Safe retries with idempotency keys

### 🚧 Bulkhead Pattern
- **Resource Isolation**: Limit concurrent requests per service
- **Thread Pool Isolation**: Prevent resource exhaustion
- **Queue Management**: Handle request overflow gracefully
- **Performance Monitoring**: Track utilization and wait times

### 🎯 Fallback Mechanisms
- **Service-Specific Fallbacks**: Tailored responses per service type
- **Cache Integration**: Use cached responses when services are down
- **Default Values**: Return sensible defaults for non-critical failures
- **Dead Letter Queue**: Queue failed operations for later retry

### 📊 Monitoring & Observability
- **Real-time Dashboard**: Visual monitoring of all circuit breakers
- **Metrics Integration**: Export metrics to monitoring systems
- **Alert Generation**: Automatic alerts for service degradation
- **Health Checks**: Comprehensive system health reporting

## Service Configurations

### Ollama LLM Service
```typescript
{
  failureThreshold: 3,
  timeout: 300000,        // 5 minutes for LLM operations
  maxConcurrent: 3,       // Limit expensive operations
  retryAttempts: 2,       // Limited retries
  fallback: 'cache'       // Use cached responses
}
```

### Redis Cache Service
```typescript
{
  failureThreshold: 5,
  timeout: 10000,         // Fast fail for cache
  maxConcurrent: 50,      // High throughput
  retryAttempts: 3,       // Quick recovery
  fallback: 'in-memory'   // In-memory cache fallback
}
```

### SQLite Database
```typescript
{
  failureThreshold: 5,
  timeout: 30000,         // Medium tolerance
  maxConcurrent: 20,      // Reasonable concurrency
  retryAttempts: 3,       // Handle locked database
  fallback: 'cache'       // Cached query results
}
```

### External APIs (Walmart)
```typescript
{
  failureThreshold: 3,
  timeout: 60000,         // Conservative timeout
  maxConcurrent: 10,      // Respect rate limits
  retryAttempts: 3,       // Handle transient failures
  fallback: 'cache'       // Cached pricing data
}
```

### WebSocket Connections
```typescript
{
  failureThreshold: 5,
  timeout: 10000,         // Quick connection checks
  maxConcurrent: 100,     // Support many connections
  retryAttempts: 2,       // Fast recovery
  fallback: 'queue'       // Queue messages for later
}
```

## Usage Examples

### Basic Circuit Breaker Usage

```typescript
import { circuitBreakerService } from './CircuitBreakerService.js';

// Execute operation with circuit breaker protection
const result = await circuitBreakerService.executeWithCircuitBreaker(
  'ollama',
  'generate',
  async () => {
    return await ollamaProvider.generate(prompt);
  },
  {
    fallbackOptions: {
      fallbackValue: 'AI service temporarily unavailable',
    },
  }
);
```

### Service-Specific Methods

```typescript
// Ollama LLM operations
const response = await circuitBreakerService.executeOllamaRequest(
  'generate',
  () => ollama.generate(prompt),
  () => 'Fallback response'
);

// Redis operations
const cachedData = await circuitBreakerService.executeRedisOperation(
  'get',
  () => redis.get(key),
  null // fallback value
);

// Database queries
const results = await circuitBreakerService.executeDatabaseQuery(
  'getUsers',
  () => db.query('SELECT * FROM users'),
  [] // empty array fallback
);

// External API calls
const pricing = await circuitBreakerService.executeExternalAPI(
  'walmart',
  'getPricing',
  () => walmartAPI.getPrice(productId),
  { error: 'PRICING_UNAVAILABLE' } // fallback data
);

// WebSocket operations
await circuitBreakerService.executeWebSocketOperation(
  'broadcast',
  () => ws.broadcast(message),
  true // enable queue fallback
);
```

### Integration with Existing Services

```typescript
// Enhanced Ollama Provider
export class CircuitBreakerOllamaProvider extends OllamaProvider {
  async generate(prompt: string): Promise<string> {
    return circuitBreakerService.executeOllamaRequest(
      'generate',
      () => super.generate(prompt),
      async () => this.getFallbackResponse(prompt)
    );
  }
}

// Enhanced Walmart API
export class CircuitBreakerWalmartAPI {
  async getProductPrice(productId: string): Promise<any> {
    return circuitBreakerService.executeExternalAPI(
      'walmart',
      'getProductPrice',
      () => this.fetchPrice(productId),
      this.getFallbackPricing(productId)
    );
  }
}
```

## Configuration Management

### Service Configuration Update

```typescript
// Update circuit breaker configuration
circuitBreakerService.updateServiceConfig('ollama', {
  config: {
    failureThreshold: 5,
    timeout: 180000,
  },
  bulkhead: {
    maxConcurrent: 5,
  },
});
```

### Manual Circuit Breaker Control

```typescript
// Reset circuit breaker
circuitBreakerService.resetCircuitBreaker('ollama', 'generate');

// Force circuit breaker open (maintenance mode)
circuitBreakerService.forceCircuitBreakerOpen('ollama');
```

## Monitoring & Health Checks

### System Health

```typescript
const health = circuitBreakerService.getSystemHealth();
console.log(`Overall health: ${health.overall}`);
console.log(`Services monitored: ${Object.keys(health.services).length}`);
```

### Circuit Breaker States

```typescript
const states = circuitBreakerService.getCircuitBreakerState();
Object.entries(states).forEach(([name, stats]) => {
  console.log(`${name}: ${stats.state} (${stats.totalRequests} requests)`);
});
```

### Dead Letter Queue Processing

```typescript
const deadLetters = circuitBreakerService.getDeadLetterQueue();
console.log(`${deadLetters.length} operations in DLQ`);

// Retry failed operation
await circuitBreakerService.retryDeadLetterItem(itemId);
```

## Dashboard Integration

The service includes a React dashboard component for real-time monitoring:

```tsx
import CircuitBreakerDashboard from './components/monitoring/CircuitBreakerDashboard';

function MonitoringPage() {
  return (
    <div>
      <h1>System Monitoring</h1>
      <CircuitBreakerDashboard />
    </div>
  );
}
```

### Dashboard Features

- **Real-time Updates**: Auto-refresh every 5 seconds
- **Service Overview**: Health status and metrics for all services
- **Circuit Breaker Control**: Reset and force-open circuit breakers
- **Bulkhead Monitoring**: Resource utilization and queue status
- **Dead Letter Queue**: View and retry failed operations
- **Historical Metrics**: Success rates and response times

## API Endpoints

The service exposes REST endpoints for monitoring and control:

```bash
# Get system health
GET /api/circuit-breaker/health

# Get circuit breaker state
GET /api/circuit-breaker/state/:service/:operation?

# Reset circuit breaker
POST /api/circuit-breaker/reset/:service/:operation?

# Force circuit breaker open
POST /api/circuit-breaker/force-open/:service/:operation?

# Get dead letter queue
GET /api/circuit-breaker/dead-letter-queue

# Retry dead letter item
POST /api/circuit-breaker/retry/:itemId

# Update configuration
PUT /api/circuit-breaker/config/:service

# Get metrics
GET /api/circuit-breaker/metrics
```

## Error Handling Patterns

### Retryable vs Non-Retryable Errors

```typescript
// Automatically retried
- ECONNRESET, ECONNREFUSED (connection issues)
- 502, 503, 504 (server errors)
- TIMEOUT (request timeouts)
- SQLITE_BUSY, SQLITE_LOCKED (database busy)

// Never retried
- 400, 401, 403, 404 (client errors)
- SQLITE_CONSTRAINT (data validation)
- WS_AUTH_FAILED (authentication)
```

### Custom Error Classification

```typescript
circuitBreakerService.updateServiceConfig('custom-service', {
  retryPolicy: {
    retryableErrors: ['CUSTOM_TRANSIENT_ERROR'],
    nonRetryableErrors: ['CUSTOM_PERMANENT_ERROR'],
  },
});
```

## Performance Considerations

### Resource Management
- **Memory Usage**: Circuit breaker metrics are kept in memory with LRU eviction
- **Cache Efficiency**: Failed operations use cached responses when available
- **Connection Pooling**: Reuse connections for better performance
- **Batch Processing**: Group related operations to reduce overhead

### Tuning Guidelines
- **High-Volume Services**: Increase `maxConcurrent` and `queueSize`
- **Critical Services**: Lower `failureThreshold` for faster failure detection
- **Expensive Operations**: Reduce `maxAttempts` to prevent resource waste
- **Real-time Systems**: Decrease `timeout` values for faster responses

## Integration with Monitoring Systems

### Metrics Export

```typescript
// The service automatically exports metrics to:
- Prometheus (via metrics endpoint)
- Sentry (error tracking)
- Application logs (structured logging)
- Monitoring dashboards (real-time updates)
```

### Alert Conditions

```typescript
// Automatic alerts triggered for:
- Circuit breaker trips (state: OPEN)
- High error rates (>10% failures)
- Resource exhaustion (bulkhead at capacity)
- Dead letter queue growth (>10 items)
- Service unavailability (all circuits open)
```

## Best Practices

1. **Start Conservative**: Begin with lower thresholds and adjust based on monitoring
2. **Monitor Actively**: Use the dashboard to track system health
3. **Test Failures**: Regularly test circuit breaker behavior with failure injection
4. **Cache Strategically**: Implement meaningful fallback data for better user experience
5. **Document Fallbacks**: Clearly document what happens when each service fails
6. **Review Regularly**: Periodically review and tune configurations based on usage patterns

## Troubleshooting

### Common Issues

**Circuit Breaker Stuck Open**
```bash
# Check error patterns in logs
# Review failure threshold configuration
# Manually reset if needed
POST /api/circuit-breaker/reset/service-name
```

**High Queue Wait Times**
```typescript
// Increase bulkhead capacity
circuitBreakerService.updateServiceConfig('service-name', {
  bulkhead: { maxConcurrent: 20 }
});
```

**Dead Letter Queue Growth**
```bash
# Investigate root cause of failures
# Check service health
# Process queued items manually
POST /api/circuit-breaker/retry/item-id
```

## Future Enhancements

- **Adaptive Thresholds**: Machine learning-based threshold adjustment
- **Distributed Circuit Breakers**: Share state across multiple instances
- **Advanced Fallback Strategies**: A/B testing for fallback responses
- **Integration Testing**: Chaos engineering integration for resilience testing