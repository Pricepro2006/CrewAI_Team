# Database Integration Guide for Unified Email Dashboard

_Version 1.0 - July 22, 2025_

## Overview

This guide documents the database integration layer for the Unified Email Dashboard, providing real-time email processing with persistent storage using SQLite and better-sqlite3.

## Architecture

```
Graph API Webhook → Queue Processor → Email Repository → SQLite Database
                                    ↓
                              Analysis Pipeline
                                    ↓
                            Workflow Chain Tracking
```

## Key Components

### 1. EmailRepository

Located at: `src/database/repositories/EmailRepository.ts`

The EmailRepository provides a clean abstraction layer for all email-related database operations:

```typescript
const repository = new EmailRepository({ db });

// Create email
const emailId = await repository.createEmail({
  graphId: 'graph-123',
  messageId: 'msg-123',
  subject: 'Quote Request',
  // ... other fields
});

// Query emails
const { emails, total } = await repository.queryEmails({
  statuses: ['new', 'in_progress'],
  priorities: ['critical', 'high'],
  dateRange: { start: new Date('2025-01-01'), end: new Date() }
});

// Update workflow chain
const chainId = await repository.createOrUpdateWorkflowChain({
  emailId,
  workflowType: 'Quote Processing',
  workflowState: 'IN_PROGRESS'
});
```

### 2. Database Connection

Located at: `src/database/connection.ts`

Manages SQLite connection with optimizations:

```typescript
import { getDatabaseConnection } from '@/database/connection';

const db = getDatabaseConnection({
  filename: './data/crewai.db',
  verbose: true
});
```

Features:
- Connection pooling (single connection for SQLite)
- WAL mode for better concurrency
- Automatic PRAGMA optimizations
- Graceful shutdown handling

### 3. Email Queue Processor

Located at: `src/core/processors/EmailQueueProcessor.ts`

Handles reliable email processing with Redis-backed queue:

```typescript
const processor = new EmailQueueProcessor({
  concurrency: 5,
  maxRetries: 3,
  redis: {
    host: 'localhost',
    port: 6379
  }
});

// Add email to queue
await processor.addEmailToQueue(graphEmailData);
```

Features:
- Priority-based processing
- Exponential backoff retry
- Dead letter queue for failed emails
- Real-time WebSocket notifications
- Performance metrics

### 4. Workflow Chain Tracking

Database schema supports comprehensive workflow tracking:

```sql
-- Track email workflow chains
CREATE TABLE workflow_chains (
  id TEXT PRIMARY KEY,
  workflow_type TEXT,
  current_state TEXT,
  is_complete BOOLEAN,
  email_count INTEGER
);

-- Link emails to chains
CREATE TABLE workflow_chain_emails (
  chain_id TEXT,
  email_id TEXT,
  sequence_number INTEGER
);
```

### 5. Performance Monitoring

Located at: `src/database/monitoring/DatabasePerformanceMonitor.ts`

Real-time database performance tracking:

```typescript
const monitor = new DatabasePerformanceMonitor({
  slowQueryMs: 1000,
  criticalQueryMs: 5000
});

// Start monitoring
monitor.start();

// Listen for issues
monitor.on('critical-query', (query) => {
  console.error('Critical slow query:', query);
});

// Get performance report
const report = monitor.exportReport();
```

## Database Schema

### Core Tables

1. **emails_enhanced** - Main email storage
   - Full email content and metadata
   - Workflow state tracking
   - Processing status
   - Agent assignments

2. **email_entities** - Extracted references
   - PO numbers, quote numbers, etc.
   - Confidence scores
   - Extraction methods

3. **workflow_chains** - Workflow tracking
   - Chain state management
   - Completion metrics
   - Duration tracking

4. **email_processing_queue** - Queue state
   - Processing status
   - Retry tracking
   - Error logging

### Indexes

Optimized indexes for common queries:
- Email status and priority
- Workflow states and types
- Date ranges
- Sender/recipient lookups
- Conversation threading

## Migration Strategy

### Running Migrations

```bash
# Run all pending migrations
npm run db:migrate

# Run specific migration
npm run db:migrate -- --target 001_unified_email_dashboard

# Rollback last migration
npm run db:migrate -- --rollback
```

### Migration Files

Located at: `src/database/migrations/`

Format: `XXX_description.sql` where XXX is the version number.

## Usage Examples

### 1. Processing Incoming Email

```typescript
// In Graph webhook handler
const emailService = new UnifiedEmailService();

const processedEmail = await emailService.processIncomingEmail({
  id: notification.resourceData.id,
  subject: notification.resourceData.subject,
  body: notification.resourceData.body,
  // ... other fields
});
```

### 2. Querying Emails with Filters

```typescript
const emails = await emailService.getEmails({
  page: 1,
  limit: 50,
  filters: {
    workflowStates: ['START_POINT', 'IN_PROGRESS'],
    priorities: ['critical', 'high'],
    dateRange: {
      start: new Date('2025-01-01'),
      end: new Date()
    }
  }
});
```

### 3. Getting Workflow Analytics

```typescript
const analytics = await emailService.getWorkflowAnalytics({
  start: new Date('2025-01-01'),
  end: new Date()
});

console.log(`Completion rate: ${analytics.completeChains / analytics.totalChains * 100}%`);
```

## Performance Considerations

### 1. Query Optimization

- Use prepared statements (automatically handled by EmailRepository)
- Leverage indexes for filtering
- Limit result sets with pagination
- Use views for complex analytics

### 2. Connection Management

```typescript
// Database connection is managed automatically
// But can be controlled if needed:

import { closeDatabaseConnection } from '@/database/connection';

// On application shutdown
process.on('SIGTERM', () => {
  closeDatabaseConnection();
});
```

### 3. Monitoring

Enable monitoring in production:

```typescript
// In application startup
const monitor = new DatabasePerformanceMonitor();
monitor.start(60000); // Check every minute

// Export metrics to monitoring service
monitor.on('stats', (stats) => {
  prometheus.gauge('db_avg_query_time', stats.avgQueryTime);
  prometheus.gauge('db_cache_hit_rate', stats.cacheHitRate);
});
```

## Security Considerations

### 1. SQL Injection Prevention

All queries use parameterized statements:

```typescript
// Safe - uses parameterized query
db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);

// Repository methods are all safe by default
await repository.queryEmails({ search: userInput });
```

### 2. Access Control

Implement role-based access in service layer:

```typescript
// In UnifiedEmailService
async getEmails(params, user) {
  // Check user permissions
  if (!user.hasPermission('email.read')) {
    throw new UnauthorizedError();
  }
  
  // Add user-specific filters
  if (user.role === 'agent') {
    params.filters.assignedTo = user.id;
  }
  
  return this.emailRepository.queryEmails(params);
}
```

## Backup and Recovery

### Automated Backups

```bash
# Backup database
sqlite3 data/crewai.db ".backup data/backup/crewai_$(date +%Y%m%d_%H%M%S).db"

# Restore from backup
sqlite3 data/crewai.db ".restore data/backup/crewai_20250722_120000.db"
```

### Export/Import

```bash
# Export to SQL
sqlite3 data/crewai.db .dump > backup.sql

# Import from SQL
sqlite3 data/crewai.db < backup.sql
```

## Troubleshooting

### Common Issues

1. **Slow Queries**
   ```typescript
   // Check slow query log
   const slowQueries = monitor.getSlowQueries(10);
   console.log('Slowest queries:', slowQueries);
   ```

2. **Lock Timeouts**
   - Ensure WAL mode is enabled
   - Check for long-running transactions
   - Monitor connection count

3. **Queue Processing Issues**
   ```typescript
   // Check queue health
   const stats = await processor.getQueueStats();
   if (!stats.healthy) {
     await processor.pause();
     // Investigate issues
     await processor.resume();
   }
   ```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review slow query logs
   - Check queue dead letter items
   - Monitor disk space

2. **Monthly**
   - Run database optimization
   ```typescript
   await monitor.optimizeDatabase();
   ```
   - Archive old emails
   - Update statistics

3. **Quarterly**
   - Review and update indexes
   - Analyze query patterns
   - Plan schema optimizations

## Future Enhancements

1. **PostgreSQL Migration**
   - Better concurrent write performance
   - Advanced indexing options
   - Native JSON support

2. **Read Replicas**
   - Separate read/write connections
   - Load balancing for queries

3. **Caching Layer**
   - Redis caching for frequent queries
   - Invalidation strategies

4. **Event Sourcing**
   - Complete audit trail
   - Time-travel queries
   - CQRS pattern implementation