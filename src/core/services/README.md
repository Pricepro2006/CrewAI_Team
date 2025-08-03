# EmailIngestionService - Production-Ready Email Pipeline

## Overview

The EmailIngestionService is a high-performance, production-ready email ingestion system designed for the CrewAI Team Email Pipeline. It supports multiple operational modes, handles 60+ emails per minute, provides comprehensive deduplication, and integrates seamlessly with Redis queue management.

## Features

### Core Capabilities
- ✅ **Multiple Ingestion Modes**: Manual, Auto-Pull, and Hybrid operation
- ✅ **High Throughput**: 60+ emails/minute processing capability
- ✅ **Smart Deduplication**: Message ID-based duplicate detection with configurable time windows
- ✅ **Redis Queue Integration**: BullMQ-powered job processing with priority management
- ✅ **Comprehensive Error Handling**: Retry logic, dead letter queues, and graceful degradation
- ✅ **Real-time Monitoring**: WebSocket updates, health checks, and performance metrics
- ✅ **Type Safety**: Full TypeScript implementation with strict typing

### Supported Sources
- JSON file import
- Database queries (extensible)
- Microsoft Graph API (planned)
- Gmail API (planned)
- Webhook ingestion

## Quick Start

### 1. Basic Setup

```typescript
import { EmailIngestionServiceFactory } from './EmailIngestionServiceFactory.js';
import { IngestionSource } from './EmailIngestionService.js';

// Create service with default configuration
const service = await EmailIngestionServiceFactory.create();

// Ingest a single email
const result = await service.ingestEmail(emailData, IngestionSource.JSON_FILE);

if (result.success) {
  console.log(`Email processed: ${result.data.emailId}`);
} else {
  console.error(`Failed: ${result.error}`);
}

// Cleanup
await service.shutdown();
```

### 2. Batch Processing

```typescript
import { EmailIngestionConfigPresets } from './EmailIngestionServiceFactory.js';

// Use high-throughput configuration
const config = EmailIngestionConfigPresets.getHighThroughputConfig();
const service = await EmailIngestionServiceFactory.create(config);

// Process batch of emails
const batchResult = await service.ingestBatch(emails, IngestionSource.JSON_FILE);

console.log(`Processed: ${batchResult.data.processed}`);
console.log(`Duplicates: ${batchResult.data.duplicates}`);
console.log(`Throughput: ${batchResult.data.throughput} emails/min`);
```

### 3. Auto-Pull Mode

```typescript
// Configure auto-pull from multiple sources
const service = await EmailIngestionServiceFactory.create({
  mode: IngestionMode.AUTO_PULL,
  autoPull: {
    interval: 15, // Every 15 minutes
    sources: [IngestionSource.MICROSOFT_GRAPH, IngestionSource.GMAIL_API],
    maxEmailsPerPull: 500
  }
});

// Start continuous pulling
await service.startAutoPull();

// Monitor status
console.log(`Auto-pull active: ${service.isAutoPullActive()}`);
```

## Configuration

### Environment Variables

```bash
# Ingestion Mode
EMAIL_INGESTION_MODE=manual              # manual, auto_pull, hybrid

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_MAX_RETRIES=3

# Processing Configuration
EMAIL_BATCH_SIZE=50                      # Emails per batch
EMAIL_CONCURRENCY=10                     # Parallel processing jobs
EMAIL_MAX_RETRIES=3                      # Retry attempts per email
EMAIL_RETRY_DELAY=5000                   # Delay between retries (ms)
EMAIL_DEDUP_WINDOW_HOURS=24             # Deduplication window

# Priority Configuration
EMAIL_PRIORITY_KEYWORDS=urgent,critical,emergency,asap

# Auto-Pull Configuration (for auto_pull/hybrid modes)
EMAIL_AUTOPULL_INTERVAL_MINUTES=15      # Pull frequency
EMAIL_AUTOPULL_SOURCES=microsoft_graph,gmail_api
EMAIL_AUTOPULL_MAX_EMAILS=1000          # Max emails per pull
```

### Configuration Presets

```typescript
import { EmailIngestionConfigPresets } from './EmailIngestionServiceFactory.js';

// Production high-throughput
const prodConfig = EmailIngestionConfigPresets.getHighThroughputConfig();

// Development environment
const devConfig = EmailIngestionConfigPresets.getDevelopmentConfig();

// Testing environment
const testConfig = EmailIngestionConfigPresets.getTestConfig();

// Auto-pull configuration
const autoPullConfig = EmailIngestionConfigPresets.getAutoPullConfig();

// Hybrid mode configuration
const hybridConfig = EmailIngestionConfigPresets.getHybridConfig();
```

## Architecture

### Service Components

```
EmailIngestionService
├── Queue Management (BullMQ + Redis)
│   ├── Main ingestion queue
│   ├── Dead letter queue
│   ├── Priority-based processing
│   └── Worker pool management
├── Deduplication System
│   ├── Message ID hashing
│   ├── Redis-based tracking
│   └── Configurable time windows
├── Source Integrations
│   ├── JSON file processing
│   ├── Database queries
│   ├── API integrations (Graph, Gmail)
│   └── Webhook handling
├── Monitoring & Metrics
│   ├── Real-time performance tracking
│   ├── Health checks
│   ├── Error tracking
│   └── WebSocket notifications
└── Error Handling
    ├── Retry mechanisms
    ├── Circuit breakers
    ├── Graceful degradation
    └── Dead letter processing
```

### Data Flow

```
Raw Email Data → Deduplication Check → Priority Calculation → Queue Addition
                                                                      ↓
WebSocket Notifications ← Unified Email Service ← Queue Processing ←
                                    ↓
                          Database Storage → Analysis Pipeline
```

## Performance Characteristics

### Throughput Targets
- **Sustained**: 60+ emails/minute
- **Burst**: 120+ emails/minute (short periods)
- **Batch Processing**: 1000+ emails in under 10 minutes

### Latency Targets
- **Single Email**: < 2 seconds (95th percentile)
- **Batch Processing**: < 1 second per email average
- **Queue Response**: < 100ms for job addition

### Resource Usage
- **Memory**: ~100-200MB base + ~1MB per 1000 queued emails
- **CPU**: Scales with concurrency setting
- **Redis**: ~1KB per email in deduplication cache
- **Network**: Minimal for local Redis, scales with API usage

## Monitoring and Observability

### Health Checks

```typescript
const health = await service.healthCheck();

console.log('Component Status:');
console.log(`Queue: ${health.components.queue.healthy ? '✅' : '❌'}`);
console.log(`Redis: ${health.components.redis.healthy ? '✅' : '❌'}`);
console.log(`Database: ${health.components.database.healthy ? '✅' : '❌'}`);
console.log(`Auto-Pull: ${health.components.autoPull.healthy ? '✅' : '❌'}`);
```

### Metrics Collection

```typescript
const metrics = await service.getMetrics();

console.log(`Total Ingested: ${metrics.totalIngested}`);
console.log(`Duplicates: ${metrics.duplicatesDetected}`);
console.log(`Failed: ${metrics.failedIngestions}`);
console.log(`Avg Processing Time: ${metrics.averageProcessingTime}ms`);
console.log(`Current Queue Size: ${metrics.currentQueueSize}`);
console.log(`Throughput: ${metrics.throughput.lastMinute} emails/min`);
```

### Queue Management

```typescript
// Pause/Resume processing
await service.pauseIngestion();
await service.resumeIngestion();

// Get queue status
const status = await service.getQueueStatus();
console.log(`Waiting: ${status.waiting}, Active: ${status.active}`);

// Retry failed jobs
const retriedCount = await service.retryFailedJobs(100);
console.log(`Retried ${retriedCount} failed jobs`);
```

## Error Handling

### Error Categories

1. **Retryable Errors**
   - Network timeouts
   - Temporary database connectivity issues
   - Rate limiting from APIs
   - Temporary processing failures

2. **Non-Retryable Errors**
   - Invalid email format
   - Authentication failures
   - Permanent API errors
   - Data validation failures

### Error Recovery

```typescript
// Get recent errors for analysis
const errors = await service.getRecentErrors(50);

// Clear deduplication cache if needed
await service.clearDeduplicationCache();

// Manual retry of specific failed jobs
await service.retryFailedJobs(10);
```

## Integration Examples

### Express.js Route Handler

```typescript
import { Request, Response } from 'express';
import { EmailIngestionServiceFactory } from '../services/EmailIngestionServiceFactory.js';

const service = await EmailIngestionServiceFactory.getInstance();

export async function ingestEmailHandler(req: Request, res: Response) {
  try {
    const result = await service.ingestEmail(req.body, IngestionSource.WEBHOOK);
    
    if (result.success) {
      res.json({
        success: true,
        emailId: result.data.emailId,
        status: result.data.status
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
```

### Scheduled Job Integration

```typescript
import cron from 'node-cron';
import { EmailIngestionServiceFactory } from '../services/EmailIngestionServiceFactory.js';

const service = await EmailIngestionServiceFactory.getInstance();

// Schedule auto-pull every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Starting scheduled email pull...');
  
  try {
    const result = await service.ingestFromMicrosoftGraph();
    if (result.success) {
      console.log(`Pulled ${result.data.processed} emails`);
    }
  } catch (error) {
    console.error('Scheduled pull failed:', error);
  }
});
```

### WebSocket Real-time Updates

```typescript
import { io } from '../websocket/index.js';

// Listen for ingestion events
io.on('connection', (socket) => {
  // Email ingested successfully
  socket.on('email:ingested', (data) => {
    console.log(`Email ${data.emailId} ingested from ${data.source}`);
  });

  // Batch progress updates
  socket.on('ingestion:batch_progress', (data) => {
    console.log(`Batch ${data.batchId}: ${data.progress}% complete`);
  });

  // Health status updates
  socket.on('ingestion:health', (health) => {
    if (!health.healthy) {
      console.warn('Ingestion service health degraded:', health.status);
    }
  });
});
```

## Testing

### Unit Tests

```bash
# Run all service tests
npm test src/core/services/__tests__/EmailIngestionService.test.ts

# Run with coverage
npm run test:coverage
```

### Integration Tests

```typescript
import { EmailIngestionServiceFactory, EmailIngestionConfigPresets } from '../EmailIngestionServiceFactory.js';

describe('Email Ingestion Integration', () => {
  let service;

  beforeEach(async () => {
    service = await EmailIngestionServiceFactory.create(
      EmailIngestionConfigPresets.getTestConfig()
    );
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it('should process email end-to-end', async () => {
    const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('processed');
  });
});
```

### Load Testing

```bash
# Generate load test data
node scripts/generate-test-emails.js --count 1000

# Run load test
node scripts/load-test-ingestion.js --emails 1000 --concurrency 10
```

## Deployment

### Production Checklist

- [ ] Redis cluster configured with persistence
- [ ] Environment variables properly set
- [ ] Database connections tested
- [ ] WebSocket server configured
- [ ] Monitoring/alerting set up
- [ ] Log aggregation configured
- [ ] Security credentials secured
- [ ] Health check endpoints exposed
- [ ] Graceful shutdown handling implemented

### Docker Configuration

```dockerfile
# Dockerfile example
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY dist/ ./dist/

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Environment-Specific Configurations

```yaml
# docker-compose.yml
version: '3.8'
services:
  email-ingestion:
    build: .
    environment:
      - NODE_ENV=production
      - EMAIL_INGESTION_MODE=hybrid
      - REDIS_HOST=redis
      - EMAIL_BATCH_SIZE=100
      - EMAIL_CONCURRENCY=20
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=crewai_emails
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce batch size and concurrency
   - Check for memory leaks in processing
   - Monitor Redis memory usage

2. **Slow Processing**
   - Increase concurrency settings
   - Optimize database queries
   - Check Redis connection latency

3. **Queue Backlog**
   - Scale worker instances
   - Increase processing concurrency
   - Check for failed job accumulation

4. **Duplicate Detection Issues**
   - Verify Redis connectivity
   - Check deduplication window settings
   - Monitor cache hit rates

### Debug Mode

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Get detailed error information
const errors = await service.getRecentErrors(100);
errors.forEach(error => {
  console.log(`${error.timestamp}: ${error.error}`);
  if (error.stackTrace) {
    console.log(error.stackTrace);
  }
});
```

### Performance Tuning

```typescript
// High-performance configuration for production
const performanceConfig = {
  processing: {
    batchSize: 100,        // Larger batches for efficiency
    concurrency: 25,       // High parallelism
    maxRetries: 5,         // More retry attempts
    retryDelay: 1000,      // Faster retries
    deduplicationWindow: 72, // Longer window for accuracy
  },
  redis: {
    maxRetriesPerRequest: 5
  }
};
```

## Contributing

1. Follow TypeScript strict mode requirements
2. Maintain 80%+ test coverage
3. Update documentation for new features
4. Use conventional commit messages
5. Ensure production-ready error handling

## License

MIT License - see LICENSE file for details.

---

**Version**: 1.0.0  
**Last Updated**: August 2, 2025  
**Maintainer**: CrewAI Team Development