# Email Pipeline Deployment Guide

## Overview

The CrewAI Email Processing Pipeline analyzes incoming emails in real-time, detecting workflows, extracting entities, and assigning priorities. The pipeline is designed to work with or without Redis for queue management.

## Architecture

```
Email Sources → Email Pipeline → Database
                     ↓
              ┌─────────────────────────┐
              │  Email Analysis Agent   │
              │  - Sentiment Analysis   │
              │  - Intent Detection     │
              │  - Entity Extraction    │
              └─────────────────────────┘
                     ↓
              ┌─────────────────────────┐
              │  Workflow Detection     │
              │  - Quote to Order       │
              │  - Order Support        │
              │  - Technical Support    │
              └─────────────────────────┘
                     ↓
              ┌─────────────────────────┐
              │  Priority & Assignment  │
              │  - Critical/High/Medium │
              │  - Agent Assignment     │
              └─────────────────────────┘
```

## Deployment Options

### Option 1: Development Mode (No Redis Required)

Quick start for testing and development:

```bash
# Start the pipeline
./scripts/start-email-pipeline-dev.sh start

# Check status
./scripts/start-email-pipeline-dev.sh status

# View logs
./scripts/start-email-pipeline-dev.sh logs

# Stop the pipeline
./scripts/start-email-pipeline-dev.sh stop
```

### Option 2: Production Mode (With systemd)

For production deployment with automatic restart:

```bash
# Deploy the pipeline (requires sudo)
./scripts/deploy-email-pipeline.sh deploy

# Check status
./scripts/deploy-email-pipeline.sh status

# View logs
./scripts/deploy-email-pipeline.sh logs

# Restart
./scripts/deploy-email-pipeline.sh restart
```

### Option 3: Docker Deployment

```dockerfile
# Dockerfile for email pipeline
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist
COPY data ./data

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/crewai.db

CMD ["node", "dist/scripts/run-email-pipeline.js"]
```

## Configuration

### Environment Variables

```bash
# Core Settings
NODE_ENV=production              # Environment mode
DATABASE_PATH=./data/crewai.db   # SQLite database path
LOG_LEVEL=info                   # Logging level

# Redis Configuration (Optional)
REDIS_HOST=localhost             # Redis host
REDIS_PORT=6379                  # Redis port
REDIS_PASSWORD=                  # Redis password (if required)

# Pipeline Settings
BATCH_CONCURRENCY=5              # Concurrent email processing
BATCH_TIMEOUT=30000              # Processing timeout (ms)
QUEUE_CONCURRENCY=5              # Queue processing concurrency
MAX_RETRIES=3                    # Max retry attempts
USE_CACHE=true                   # Enable analysis caching

# Ollama Settings (Required for AI analysis)
OLLAMA_HOST=http://localhost:11434  # Ollama API endpoint
OLLAMA_MODEL=granite3.3:2b          # Default model
```

### Configuration File

Create `config/pipeline.json`:

```json
{
  "pipeline": {
    "batchSize": 10,
    "processingInterval": 30000,
    "cacheEnabled": true,
    "cacheTTL": 1800
  },
  "workflow": {
    "patterns": {
      "quoteToOrder": {
        "confidence": 0.8,
        "keywords": ["quote", "pricing", "rfq"]
      },
      "orderSupport": {
        "confidence": 0.7,
        "keywords": ["order", "tracking", "delivery"]
      }
    }
  },
  "priority": {
    "rules": {
      "critical": ["urgent", "asap", "critical"],
      "high": ["important", "priority", "today"],
      "medium": ["this week", "when possible"]
    }
  }
}
```

## Monitoring

### Real-time Monitoring

```bash
# Start monitoring dashboard
./scripts/monitor-email-pipeline.sh monitor

# Get one-time status
./scripts/monitor-email-pipeline.sh status

# Generate report
./scripts/monitor-email-pipeline.sh report
```

### Metrics Available

- **Queue Metrics**
  - Emails waiting
  - Emails processing
  - Emails completed
  - Failed emails

- **Performance Metrics**
  - Average processing time
  - Cache hit rate
  - Success rate
  - Error rate

- **System Metrics**
  - CPU usage
  - Memory usage
  - Disk space

### Health Checks

```bash
# Check pipeline health
curl http://localhost:3001/api/health

# Get detailed metrics
curl http://localhost:3001/metrics
```

## Troubleshooting

### Common Issues

1. **Pipeline won't start**

   ```bash
   # Check if port is in use
   lsof -i :3001

   # Check logs
   tail -f logs/email-pipeline-error.log
   ```

2. **Redis connection errors**

   ```bash
   # Start Redis
   redis-server --daemonize yes

   # Or run without Redis
   ./scripts/start-email-pipeline-dev.sh start
   ```

3. **Ollama not responding**

   ```bash
   # Start Ollama
   ollama serve

   # Pull required model
   ollama pull granite3.3:2b
   ```

4. **Database errors**

   ```bash
   # Check database permissions
   ls -la data/crewai.db

   # Run migrations
   npm run db:migrate
   ```

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug ./scripts/start-email-pipeline-dev.sh start
```

## Performance Tuning

### Batch Processing

Adjust concurrency based on system resources:

```bash
# Low resource systems
BATCH_CONCURRENCY=2 QUEUE_CONCURRENCY=2

# High performance systems
BATCH_CONCURRENCY=10 QUEUE_CONCURRENCY=10
```

### Cache Optimization

```bash
# Increase cache size for better performance
CACHE_MAX_SIZE=1000

# Reduce TTL for more real-time processing
CACHE_TTL=600
```

### Database Optimization

```sql
-- Add indexes for better query performance
CREATE INDEX idx_emails_received_at ON emails(received_at);
CREATE INDEX idx_emails_workflow_state ON emails(workflow_state);
CREATE INDEX idx_emails_priority ON emails(priority);
```

## Security Considerations

1. **Database Security**
   - Use read-only database user for pipeline
   - Regular backups of crewai.db
   - Encrypt sensitive email content

2. **API Security**
   - Use authentication for health endpoints
   - Implement rate limiting
   - Monitor for suspicious patterns

3. **Log Security**
   - Rotate logs regularly
   - Mask sensitive information
   - Secure log storage

## Backup and Recovery

### Backup Strategy

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/email-pipeline"
DATE=$(date +%Y%m%d)

# Backup database
cp data/crewai.db "$BACKUP_DIR/crewai-$DATE.db"

# Backup logs
tar -czf "$BACKUP_DIR/logs-$DATE.tar.gz" logs/

# Keep last 30 days
find "$BACKUP_DIR" -mtime +30 -delete
```

### Recovery Process

```bash
# Stop pipeline
systemctl stop crewai-email-pipeline

# Restore database
cp /backups/email-pipeline/crewai-20250130.db data/crewai.db

# Restart pipeline
systemctl start crewai-email-pipeline
```

## Integration

### Email Sources

1. **Microsoft Graph API**
   - OAuth2 authentication
   - Real-time webhooks
   - Batch email fetching

2. **IMAP Integration**
   - Any IMAP-compatible email
   - Polling-based retrieval
   - SSL/TLS support

3. **Direct API**
   ```bash
   curl -X POST http://localhost:3001/api/emails/process \
     -H "Content-Type: application/json" \
     -d '{"subject": "Test", "body": "Test email"}'
   ```

### Output Integration

1. **Webhook Notifications**

   ```javascript
   // Configure in pipeline settings
   {
     "webhooks": {
       "onProcessed": "https://api.company.com/email-processed",
       "onError": "https://api.company.com/email-error"
     }
   }
   ```

2. **Database Events**
   - SQLite triggers for processed emails
   - Event streaming for real-time updates

3. **WebSocket Updates**
   - Real-time email processing notifications
   - Live dashboard updates

## Maintenance

### Regular Tasks

- **Daily**: Check error logs, monitor queue size
- **Weekly**: Review processing metrics, clear old cache
- **Monthly**: Database optimization, performance review
- **Quarterly**: Update dependencies, security audit

### Upgrade Process

```bash
# 1. Backup current version
./scripts/backup-pipeline.sh

# 2. Stop pipeline
systemctl stop crewai-email-pipeline

# 3. Update code
git pull origin main
npm install
npm run build

# 4. Run migrations
npm run db:migrate

# 5. Restart pipeline
systemctl start crewai-email-pipeline
```

## Support

For issues or questions:

1. Check logs: `logs/email-pipeline-error.log`
2. Review metrics: `http://localhost:3001/metrics`
3. Run diagnostics: `./scripts/diagnose-pipeline.sh`
4. Contact: support@crewai.team

---

Last updated: January 30, 2025
Version: 1.0.0
