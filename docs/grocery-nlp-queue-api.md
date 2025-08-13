# Grocery NLP Queue API Documentation

## Overview

The Grocery NLP Queue API provides a production-ready queuing system for managing concurrent Natural Language Processing requests with the following key features:

- **Concurrent Request Management**: Limited to 2 concurrent Ollama requests (configurable)
- **Priority Queuing**: High, normal, and low priority processing
- **Request Deduplication**: Prevents duplicate processing of identical queries
- **Queue Persistence**: Crash recovery with state persistence
- **Real-time Updates**: WebSocket support for queue status monitoring
- **Batch Processing**: Efficient handling of multiple requests
- **Type Safety**: Full TypeScript support with tRPC integration

## Architecture

```
Frontend (React/TypeScript)
    ↓
tRPC Client (Type-safe)
    ↓
tRPC Server + REST API
    ↓
GroceryNLPQueue Service
    ↓
Ollama SDK (Direct Integration)
```

## API Endpoints

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/grocery/nlp/process` | Process single query |
| POST | `/api/grocery/nlp/batch` | Process multiple queries |
| GET | `/api/grocery/nlp/status` | Get queue status |
| GET | `/api/grocery/nlp/metrics` | Get performance metrics |
| DELETE | `/api/grocery/nlp/queue/:id` | Cancel queued request |
| GET | `/api/grocery/nlp/queue` | Get all queue items |
| GET | `/api/grocery/nlp/queue/:id` | Get specific queue item |
| POST | `/api/grocery/nlp/queue/clear` | Clear entire queue |
| GET | `/api/grocery/nlp/health` | Health check |

### WebSocket Endpoint

- `WS /ws/grocery-nlp-queue` - Real-time queue updates

### tRPC Procedures

- `groceryNLPQueue.process` - Process single query
- `groceryNLPQueue.processBatch` - Process batch queries
- `groceryNLPQueue.getStatus` - Get queue status
- `groceryNLPQueue.getMetrics` - Get metrics
- `groceryNLPQueue.cancelRequest` - Cancel request
- `groceryNLPQueue.getRequest` - Get specific request
- `groceryNLPQueue.getQueueItems` - Get all items (admin)
- `groceryNLPQueue.clearQueue` - Clear queue (admin)
- `groceryNLPQueue.getConfiguration` - Get config (admin)
- `groceryNLPQueue.updateConfiguration` - Update config (admin)
- `groceryNLPQueue.healthCheck` - Health check
- `groceryNLPQueue.getStatistics` - Get statistics

## Usage Examples

### 1. Basic Query Processing

#### REST API
```typescript
const response = await fetch('/api/grocery/nlp/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "Find organic apples in the store",
    priority: "normal",
    timeout: 10000,
    metadata: {
      userId: "user123",
      source: "web-app"
    }
  })
});

const result = await response.json();
console.log(result.data);
```

#### tRPC Client
```typescript
const result = await trpc.groceryNLPQueue.process.mutate({
  query: "Find organic apples in the store",
  priority: "normal",
  timeout: 10000,
  metadata: {
    userId: "user123",
    source: "web-app"
  }
});
```

### 2. Batch Processing

#### REST API
```typescript
const response = await fetch('/api/grocery/nlp/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    queries: [
      { query: "Find milk prices", metadata: { category: "dairy" } },
      { query: "Check bread availability", metadata: { category: "bakery" } },
      { query: "Locate fresh vegetables", metadata: { category: "produce" } }
    ],
    priority: "normal",
    timeout: 15000,
    batchId: "grocery-search-001"
  })
});

const result = await response.json();
console.log(`Processed ${result.data.completedCount} queries successfully`);
```

#### tRPC Client
```typescript
const result = await trpc.groceryNLPQueue.processBatch.mutate({
  queries: [
    { query: "Find milk prices", metadata: { category: "dairy" } },
    { query: "Check bread availability", metadata: { category: "bakery" } },
    { query: "Locate fresh vegetables", metadata: { category: "produce" } }
  ],
  priority: "normal",
  timeout: 15000
});
```

### 3. Real-time Monitoring with WebSocket

```typescript
const ws = new WebSocket('ws://localhost:3000/ws/grocery-nlp-queue');

ws.onopen = () => {
  console.log('Connected to grocery NLP queue WebSocket');
  
  // Subscribe to updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    subscriptions: ['queue_updates', 'request_status', 'metrics_updates']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'queue_update':
      console.log(`Queue size: ${data.data.queueSize}, Active: ${data.data.activeRequests}`);
      break;
      
    case 'request_status':
      console.log(`Request ${data.data.requestId}: ${data.data.status}`);
      break;
      
    case 'metrics_update':
      console.log(`Success rate: ${data.data.successRate}`);
      break;
  }
};
```

### 4. Queue Monitoring

#### Get Status
```typescript
// REST API
const response = await fetch('/api/grocery/nlp/status');
const status = await response.json();

// tRPC
const status = await trpc.groceryNLPQueue.getStatus.query();

console.log({
  healthy: status.data.healthy,
  queueSize: status.data.queueSize,
  activeRequests: status.data.activeRequests,
  estimatedWaitTime: status.data.estimatedWaitTime
});
```

#### Get Metrics
```typescript
// REST API
const response = await fetch('/api/grocery/nlp/metrics');
const metrics = await response.json();

// tRPC
const metrics = await trpc.groceryNLPQueue.getMetrics.query();

console.log({
  totalRequests: metrics.data.totalRequests,
  successRate: metrics.data.successRate,
  averageProcessingTime: metrics.data.averageProcessingTime,
  throughput: metrics.data.throughput
});
```

## Configuration

### Environment Variables

```bash
# Queue Configuration
OLLAMA_NUM_PARALLEL=2                    # Max concurrent requests
NLP_QUEUE_PERSISTENCE_PATH=./data/nlp-queue  # Persistence directory

# WebSocket Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com

# Logging
LOG_LEVEL=info
```

### Runtime Configuration

```typescript
// Update queue configuration at runtime (admin only)
await trpc.groceryNLPQueue.updateConfiguration.mutate({
  maxConcurrent: 4,
  defaultTimeout: 30000,
  deduplicationEnabled: true,
  deduplicationTTL: 300000, // 5 minutes
  healthCheck: {
    maxQueueSize: 100,
    maxErrorRate: 0.1,
    maxProcessingTime: 5000
  }
});
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Request not found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error
- `503` - Service Unavailable (queue unhealthy)

### Error Response Format

```typescript
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid request data",
    details: {
      requestId: "req-123",
      field: "query"
    }
  },
  timestamp: 1640995200000
}
```

### tRPC Error Codes

- `BAD_REQUEST` - Invalid input
- `NOT_FOUND` - Resource not found
- `TIMEOUT` - Request timeout
- `INTERNAL_SERVER_ERROR` - Processing error
- `FORBIDDEN` - Insufficient permissions

## Performance Characteristics

### Throughput
- **Max Concurrent**: 2 Ollama requests (configurable)
- **Queue Capacity**: 1000+ pending requests
- **Batch Size**: Up to 100 queries per batch
- **Processing Time**: 500-2000ms per query (varies by complexity)

### Latency
- **Queue Wait Time**: 0-5000ms (depends on queue size)
- **Processing Time**: 200-3000ms (depends on query complexity)
- **WebSocket Updates**: < 100ms

### Memory Usage
- **Base Memory**: ~50MB
- **Per Request**: ~1KB
- **Persistence**: ~100KB per 1000 requests

## Security Considerations

### Authentication
- WebSocket connections require authentication
- Admin operations require elevated permissions
- Request metadata can include user context

### Rate Limiting
- Built-in queue size limits
- Configurable timeout values
- Request deduplication prevents abuse

### Data Privacy
- Queries are not logged by default
- Metadata can be filtered for sensitive information
- Queue persistence can be disabled

## Monitoring and Observability

### Health Checks
```typescript
const health = await trpc.groceryNLPQueue.healthCheck.query();

// Health criteria:
// - Queue size < 50
// - Error rate < 10%
// - Processing time < 5000ms
```

### Metrics Dashboard Data
```typescript
const stats = await trpc.groceryNLPQueue.getStatistics.query();

// Returns:
// - Overview: queue status, health
// - Performance: success rate, timing
// - Capacity: utilization, peak usage
```

### Logging
All operations are logged with structured data:

```typescript
{
  level: "info",
  category: "NLP_QUEUE", 
  message: "Processing NLP request",
  data: {
    requestId: "req-123",
    priority: "normal",
    queueSize: 5
  }
}
```

## Integration Guide

### Adding to Express App
```typescript
import express from 'express';
import { groceryNLPQueueRouter } from './routes/grocery-nlp-queue.router';

const app = express();
app.use('/api/grocery/nlp', groceryNLPQueueRouter);
```

### Adding to tRPC Router
```typescript
import { groceryNLPQueueRouter } from './routers/grocery-nlp-queue.router';

export const appRouter = router({
  // ... other routers
  groceryNLPQueue: groceryNLPQueueRouter
});
```

### WebSocket Integration
```typescript
import { getGroceryNLPQueueWebSocketManager } from './websocket/grocery-nlp-queue';

// In your WebSocket server setup
wss.on('connection', (ws, req) => {
  if (req.url?.includes('/grocery-nlp-queue')) {
    const manager = getGroceryNLPQueueWebSocketManager();
    manager.handleConnection(ws, req);
  }
});
```

## Best Practices

### 1. Query Design
- Keep queries concise and specific
- Include relevant metadata for context
- Use appropriate priority levels

### 2. Batch Processing
- Group related queries together
- Use reasonable batch sizes (10-50 queries)
- Handle partial failures gracefully

### 3. Error Handling
- Implement retry logic with exponential backoff
- Monitor error rates and adjust timeouts
- Log errors with context for debugging

### 4. Performance Optimization
- Use deduplication for repeated queries
- Monitor queue metrics regularly
- Adjust concurrency based on system resources

### 5. Production Deployment
- Enable persistence for crash recovery
- Configure proper logging levels
- Set up health monitoring alerts
- Use rate limiting to prevent abuse

## Troubleshooting

### Common Issues

1. **High Queue Wait Times**
   - Increase `maxConcurrent` if system can handle it
   - Check for slow processing operations
   - Monitor system resources

2. **Memory Leaks**
   - Ensure proper cleanup of completed requests
   - Monitor fingerprint cache size
   - Check for event listener leaks

3. **WebSocket Connection Issues**
   - Verify authentication is working
   - Check firewall and proxy settings
   - Monitor connection count limits

4. **Persistence Errors**
   - Check file system permissions
   - Ensure adequate disk space
   - Verify directory structure

### Debug Mode
```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Monitor internal state
const queue = getGroceryNLPQueue();
setInterval(() => {
  console.log('Queue state:', {
    size: queue.getStatus().queueSize,
    active: queue.getStatus().activeRequests,
    metrics: queue.getMetrics()
  });
}, 10000);
```

## Contributing

### Development Setup
1. Clone repository
2. Install dependencies: `npm install`
3. Set environment variables
4. Run tests: `npm test`
5. Start development server: `npm run dev`

### Testing
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "GroceryNLPQueue"

# Run integration tests
npm run test:integration
```

### Code Style
- Follow TypeScript strict mode
- Use proper error handling
- Include comprehensive documentation
- Write unit tests for new features

---

For more information, examples, and advanced usage patterns, see the `/examples` directory and individual service documentation.