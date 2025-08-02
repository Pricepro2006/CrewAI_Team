# Email Ingestion Production Deployment Guide

**Version:** 2.2.0  
**Last Updated:** August 2, 2025  
**Status:** Production Ready

## Table of Contents

1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Deployment Options](#deployment-options)
6. [Operational Modes](#operational-modes)
7. [API Reference](#api-reference)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Security Considerations](#security-considerations)

---

## System Overview

The CrewAI Email Ingestion System is a production-ready, enterprise-grade email processing pipeline that supports three operational modes:

- **Manual Load Mode**: Batch processing of email files
- **Auto-Pull Mode**: Scheduled retrieval from email providers
- **Hybrid Mode**: Concurrent manual and automated operations

### Key Features

- 📊 **High Performance**: 60+ emails/minute processing capability
- 🔄 **Real-time Updates**: WebSocket integration for live monitoring
- 🔒 **Enterprise Security**: TLS encryption, authentication, rate limiting
- 📈 **Scalable Architecture**: Support for 1M+ emails with linear scaling
- 🎯 **Adaptive Analysis**: 3-phase AI processing with intelligent routing
- 🛡️ **Fault Tolerant**: Comprehensive error handling and recovery

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Email Ingestion System                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Manual    │  │  Auto-Pull  │  │   Hybrid    │       │
│  │    Load     │  │    Mode     │  │    Mode     │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │   Queue     │                         │
│                    │  Manager    │◄────── Redis/BullMQ     │
│                    └──────┬──────┘                         │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │   Worker    │                         │
│                    │    Pool     │◄────── 10-25 Workers    │
│                    └──────┬──────┘                         │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │  3-Phase    │                         │
│                    │  Analysis   │◄────── AI Processing    │
│                    └──────┬──────┘                         │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │  Database   │                         │
│                    │   Storage   │◄────── SQLite           │
│                    └─────────────┘                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

- **Node.js**: v18.0.0 or higher
- **pnpm**: v8.0.0 or higher
- **Redis**: v7.0.0 or higher
- **SQLite**: v3.35.0 or higher
- **Memory**: 4GB minimum, 8GB recommended
- **Storage**: 10GB minimum for database

### Required Services

- **Redis Server**: For queue management
- **Ollama**: For LLM processing (optional)
- **Email Provider Access**: Microsoft Graph or Gmail API credentials

### Development Tools

```bash
# Install required tools
npm install -g pnpm
pnpm install -g typescript tsx nodemon

# Verify installations
node --version
pnpm --version
redis-server --version
```

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-org/crewai-team.git
cd crewai-team
git checkout fix/critical-email-processing-issues
```

### 2. Install Dependencies

```bash
# Install all dependencies
pnpm install

# Build TypeScript files
pnpm build

# Run database migrations
pnpm db:migrate
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 4. Initialize Security

```bash
# Generate secure secrets
node scripts/generate-secrets.js

# Validate configuration
pnpm validate:config
```

---

## Configuration

### Environment Variables

```bash
# =====================================================
# Core Configuration
# =====================================================
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# =====================================================
# Redis Configuration (REQUIRED)
# =====================================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password_here
REDIS_TLS_ENABLED=true
REDIS_DB=0

# =====================================================
# Database Configuration
# =====================================================
DATABASE_URL=sqlite:./data/crewai_enhanced.db
DATABASE_POOL_SIZE=10

# =====================================================
# Email Processing
# =====================================================
EMAIL_PROCESSING_BATCH_SIZE=50
EMAIL_PROCESSING_CONCURRENCY=10
EMAIL_PROCESSING_MAX_RETRIES=3
EMAIL_DEDUPLICATION_WINDOW_HOURS=24

# =====================================================
# Microsoft Graph API (Optional)
# =====================================================
MSGRAPH_CLIENT_ID=your_client_id
MSGRAPH_CLIENT_SECRET=your_client_secret
MSGRAPH_TENANT_ID=your_tenant_id

# =====================================================
# Security
# =====================================================
JWT_SECRET=minimum_32_character_secret_key_here
CSRF_SECRET=minimum_32_character_secret_key_here
SESSION_SECRET=minimum_32_character_secret_key_here
ENCRYPTION_KEY=exactly_32_character_key_required

# =====================================================
# Monitoring
# =====================================================
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true
WEBSOCKET_ENABLED=true
```

### Security Configuration

```typescript
// src/config/security.config.ts
export const securityConfig = {
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    skipSuccessfulRequests: false
  },
  
  // CORS settings
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  }
};
```

### Queue Configuration

```typescript
// src/config/queue.config.ts
export const queueConfig = {
  // Worker pool settings
  workers: {
    min: 5,
    max: 25,
    idleTimeout: 30000
  },
  
  // Job processing
  processing: {
    batchSize: 50,
    concurrency: 10,
    maxRetries: 3,
    retryDelay: 5000
  },
  
  // Priority levels
  priorities: {
    URGENT: 1,
    HIGH: 2,
    NORMAL: 3,
    LOW: 4
  }
};
```

---

## Deployment Options

### Option 1: Manual Deployment

```bash
# 1. Start Redis
redis-server --requirepass your_password

# 2. Initialize database
pnpm db:init

# 3. Start production server
pnpm start:production

# 4. Start worker processes
pnpm workers:start
```

### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build application
RUN pnpm build

# Expose ports
EXPOSE 3001 3002

# Start application
CMD ["pnpm", "start:production"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
      - "3002:3002"
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
    depends_on:
      - redis
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  redis-data:
```

### Option 3: Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crewai-email-ingestion
spec:
  replicas: 3
  selector:
    matchLabels:
      app: email-ingestion
  template:
    metadata:
      labels:
        app: email-ingestion
    spec:
      containers:
      - name: app
        image: crewai/email-ingestion:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
---
apiVersion: v1
kind: Service
metadata:
  name: email-ingestion-service
spec:
  selector:
    app: email-ingestion
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3001
  type: LoadBalancer
```

---

## Operational Modes

### Manual Load Mode

```typescript
// Example: Load emails from JSON files
import { getEmailIngestionIntegrationService } from './services/EmailIngestionIntegrationService';

const service = getEmailIngestionIntegrationService({
  mode: IngestionMode.MANUAL_LOAD
});

// Initialize service
await service.initialize();

// Load batch of email files
const result = await service.loadBatch([
  '/data/emails/batch1.json',
  '/data/emails/batch2.json'
], IngestionSource.JSON_FILE);

console.log(`Processed: ${result.data.processed} emails`);
```

### Auto-Pull Mode

```typescript
// Example: Schedule automatic email pulling
const service = getEmailIngestionIntegrationService({
  mode: IngestionMode.AUTO_PULL,
  schedulerIntervalMinutes: 5,
  autoStartScheduler: true
});

await service.initialize();

// Service will automatically pull emails every 5 minutes
// Monitor via WebSocket or API endpoints
```

### Hybrid Mode

```typescript
// Example: Combined manual and auto operations
const service = getEmailIngestionIntegrationService({
  mode: IngestionMode.HYBRID,
  enableWebSocketUpdates: true,
  maxConcurrentOperations: 3
});

await service.initialize();

// Manual load while auto-pull runs
await service.loadBatch(['emergency-emails.json']);
```

---

## API Reference

### REST Endpoints

```typescript
// Health Check
GET /api/health
Response: {
  status: "healthy" | "degraded" | "unhealthy",
  components: {
    redis: { healthy: boolean, latency: number },
    queue: { healthy: boolean, activeJobs: number },
    database: { healthy: boolean, connections: number }
  }
}

// Get Metrics
GET /api/ingestion/metrics
Response: {
  totalProcessed: number,
  totalDuplicate: number,
  totalFailed: number,
  avgThroughput: number,
  currentThroughput: number,
  queueDepth: number
}

// Queue Management
POST /api/ingestion/pause
POST /api/ingestion/resume
POST /api/ingestion/retry/:jobId

// Manual Ingestion
POST /api/ingestion/load
Body: {
  files: string[],
  source: "JSON_FILE" | "DATABASE",
  priority: "URGENT" | "HIGH" | "NORMAL" | "LOW"
}
```

### WebSocket Events

```typescript
// Client connection
const socket = io('ws://localhost:3002');

// Listen for events
socket.on('email:ingestion:progress', (data) => {
  console.log('Progress:', data);
  // { processed: 100, total: 1000, throughput: 65.5 }
});

socket.on('email:ingestion:complete', (data) => {
  console.log('Batch complete:', data);
});

socket.on('email:ingestion:error', (data) => {
  console.error('Error:', data);
});

socket.on('email:ingestion:health', (data) => {
  console.log('Health status:', data);
});
```

### tRPC API

```typescript
// Initialize tRPC client
import { createTRPCProxyClient } from '@trpc/client';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/api/trpc',
      headers: {
        authorization: `Bearer ${token}`
      }
    })
  ]
});

// Use typed API
const metrics = await client.emailIngestion.getMetrics.query();
const queueStatus = await client.emailIngestion.getQueueStatus.query();
await client.emailIngestion.pauseQueue.mutate();
```

---

## Monitoring & Maintenance

### Dashboard Access

```bash
# Access monitoring dashboard
http://localhost:3001/dashboard

# Features:
- Real-time processing metrics
- Queue status visualization
- Health indicators
- Error logs
- Performance charts
```

### Health Monitoring

```bash
# Check system health
curl http://localhost:3001/api/health

# Monitor Redis
redis-cli -a your_password INFO

# Check queue status
pnpm queue:status

# View logs
tail -f logs/application.log
```

### Performance Monitoring

```typescript
// Monitor key metrics
const monitoringConfig = {
  // Alert thresholds
  alerts: {
    throughput: { min: 30, max: 100 }, // emails/minute
    errorRate: { max: 0.05 }, // 5% max error rate
    queueDepth: { max: 10000 }, // max queued jobs
    responseTime: { p95: 2000 } // 95th percentile < 2s
  },
  
  // Monitoring intervals
  intervals: {
    metrics: 30000, // 30 seconds
    health: 60000, // 1 minute
    detailed: 300000 // 5 minutes
  }
};
```

### Maintenance Tasks

```bash
# Daily maintenance
pnpm maintenance:daily
- Cleans up old logs
- Optimizes database
- Archives processed emails

# Weekly maintenance
pnpm maintenance:weekly
- Full database backup
- Performance analysis
- Security audit logs

# Monthly maintenance
pnpm maintenance:monthly
- Update dependencies
- Review error patterns
- Capacity planning
```

---

## Troubleshooting

### Common Issues

#### 1. Redis Connection Failed

```bash
# Check Redis status
redis-cli ping

# Verify authentication
redis-cli -a your_password ping

# Check TLS configuration
openssl s_client -connect localhost:6379
```

#### 2. Low Throughput

```bash
# Increase worker concurrency
EMAIL_PROCESSING_CONCURRENCY=20

# Optimize batch size
EMAIL_PROCESSING_BATCH_SIZE=100

# Check system resources
htop
iostat -x 1
```

#### 3. High Memory Usage

```bash
# Monitor memory
pnpm memory:profile

# Adjust worker pool
EMAIL_PROCESSING_MAX_WORKERS=15

# Enable memory limits
NODE_OPTIONS="--max-old-space-size=4096"
```

#### 4. Queue Backup

```typescript
// Clear stuck jobs
await ingestionService.clearFailedJobs();

// Reset queue
await ingestionService.resetQueue();

// Reprocess failed
await ingestionService.retryAllFailed();
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug pnpm start:dev

# Trace specific component
DEBUG=email:ingestion:* pnpm start:dev

# Profile performance
NODE_ENV=development PROFILE=true pnpm start:dev
```

### Error Recovery

```typescript
// Automatic recovery configuration
const recoveryConfig = {
  // Retry strategy
  retry: {
    attempts: 3,
    delay: 5000,
    backoff: 'exponential',
    maxDelay: 60000
  },
  
  // Circuit breaker
  circuitBreaker: {
    threshold: 5, // failures to open
    timeout: 30000, // wait before retry
    resetTimeout: 120000 // full reset
  },
  
  // Fallback options
  fallback: {
    useCache: true,
    degradedMode: true,
    notifyAdmins: true
  }
};
```

---

## Security Considerations

### Authentication & Authorization

```typescript
// JWT configuration
const authConfig = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d',
    algorithm: 'HS256'
  },
  
  // Role-based access
  roles: {
    admin: ['*'],
    operator: ['read', 'process', 'monitor'],
    viewer: ['read', 'monitor']
  }
};
```

### Data Protection

```typescript
// Encryption configuration
const encryptionConfig = {
  // At-rest encryption
  database: {
    algorithm: 'aes-256-gcm',
    key: process.env.ENCRYPTION_KEY
  },
  
  // In-transit encryption
  transport: {
    tls: {
      minVersion: 'TLSv1.2',
      ciphers: 'ECDHE-RSA-AES256-GCM-SHA384'
    }
  },
  
  // PII handling
  pii: {
    mask: true,
    fields: ['email', 'name', 'phone'],
    retention: 90 // days
  }
};
```

### Security Checklist

- [ ] All secrets in environment variables
- [ ] Redis authentication enabled
- [ ] TLS encryption configured
- [ ] Rate limiting active
- [ ] CSRF protection enabled
- [ ] Input validation implemented
- [ ] Audit logging configured
- [ ] Regular security scans
- [ ] Dependency updates scheduled
- [ ] Incident response plan ready

---

## Performance Optimization

### Scaling Guidelines

```yaml
# Scaling matrix
Small (< 10k emails/day):
  - Workers: 5-10
  - Batch Size: 25-50
  - Memory: 2-4GB
  - Redis: Single instance

Medium (10k-100k emails/day):
  - Workers: 10-25
  - Batch Size: 50-100
  - Memory: 4-8GB
  - Redis: Master-slave

Large (100k+ emails/day):
  - Workers: 25-50
  - Batch Size: 100-200
  - Memory: 8-16GB
  - Redis: Cluster
```

### Optimization Tips

1. **Database Optimization**
   ```sql
   -- Index frequently queried fields
   CREATE INDEX idx_email_message_id ON emails_enhanced(internet_message_id);
   CREATE INDEX idx_email_created ON emails_enhanced(created_at);
   
   -- Periodic optimization
   VACUUM;
   ANALYZE;
   ```

2. **Redis Optimization**
   ```bash
   # Memory optimization
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   
   # Persistence tuning
   redis-cli CONFIG SET save ""
   redis-cli CONFIG SET appendonly no
   ```

3. **Node.js Optimization**
   ```bash
   # Production flags
   NODE_ENV=production
   NODE_OPTIONS="--max-old-space-size=8192 --optimize-for-size"
   
   # Cluster mode
   pm2 start ecosystem.config.js
   ```

---

## Support & Resources

### Documentation

- **Architecture Guide**: `/docs/EMAIL_PIPELINE_PRODUCTION_ARCHITECTURE.md`
- **API Documentation**: `/docs/API_DOCUMENTATION.md`
- **Security Guide**: `/docs/SECURITY_CONFIGURATION_GUIDE.md`
- **Troubleshooting**: `/docs/TROUBLESHOOTING_GUIDE.md`

### Monitoring URLs

- **Dashboard**: http://localhost:3001/dashboard
- **Health Check**: http://localhost:3001/api/health
- **Metrics**: http://localhost:3001/api/metrics
- **Logs**: http://localhost:3001/logs

### Contact Information

- **GitHub Issues**: https://github.com/your-org/crewai-team/issues
- **Documentation**: https://docs.crewai-team.com
- **Support Email**: support@crewai-team.com

---

**Version:** 2.2.0  
**Last Updated:** August 2, 2025  
**Status:** Production Ready