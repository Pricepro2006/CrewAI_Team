# Unified Dashboard Deployment Guide

_Version 1.0 - July 22, 2025_

## Overview

This guide provides step-by-step instructions for deploying the Unified Email Management Dashboard, including testing procedures, rollback plans, and monitoring setup.

## Pre-Deployment Checklist

### Requirements Verification

- [ ] Node.js 20.11+ installed
- [ ] PostgreSQL 15+ running
- [ ] Redis 7.2+ running
- [ ] Microsoft Graph API credentials configured
- [ ] SearXNG running on port 8888
- [ ] All environment variables set

### Code Review

- [ ] All PRs reviewed and approved
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met

## Testing Strategy

### 1. Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test suites
npm run test:unit -- UnifiedEmailService
npm run test:unit -- EmailAnalysisPipeline
npm run test:unit -- WorkflowDetectionStage

# With coverage
npm run test:unit -- --coverage
```

**Key Test Files:**
- `src/api/services/__tests__/UnifiedEmailService.test.ts`
- `src/core/processors/__tests__/EmailAnalysisPipeline.test.ts`
- `src/ui/components/UnifiedEmail/__tests__/UnifiedEmailDashboard.test.tsx`

### 2. Integration Tests

```bash
# Run integration tests
npm run test:integration

# Test Graph API webhook flow
npm run test:integration -- graph-webhook-flow

# Test real-time processing
npm run test:integration -- real-time-processing
```

**Test Scenarios:**
1. Graph API webhook → Processing → UI update
2. Email analysis pipeline with all stages
3. Workflow chain detection and linking
4. Agent assignment and processing
5. Real-time WebSocket updates

### 3. E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Specific user flows
npm run test:e2e -- email-processing-flow
npm run test:e2e -- workflow-analytics-view
npm run test:e2e -- agent-assignment-flow
```

### 4. Load Testing

```bash
# Run load tests
npm run test:load

# Test specific scenarios
npm run test:load -- webhook-processing --rate 1000/minute
npm run test:load -- dashboard-concurrent-users --users 100
```

**Load Test Targets:**
- 1000 emails/minute processing
- 100 concurrent dashboard users
- < 2 second dashboard load time
- < 10 second email processing time

## Deployment Steps

### Phase 1: Database Migration

```bash
# 1. Backup existing database
pg_dump -h localhost -U postgres email_dashboard > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migration scripts
npm run db:migrate -- --target unified-dashboard

# 3. Verify migration
npm run db:verify -- unified-dashboard

# 4. Import historical analysis data
npm run scripts:import-analysis-data
```

### Phase 2: Backend Deployment

```bash
# 1. Create feature branch
git checkout -b release/v2.0-unified-dashboard

# 2. Build backend
npm run build:backend

# 3. Deploy to staging
npm run deploy:staging -- --service backend

# 4. Verify health check
curl https://staging-api.tdsynnex.com/health

# 5. Run smoke tests
npm run test:smoke -- --env staging
```

### Phase 3: Frontend Deployment

```bash
# 1. Build frontend
npm run build:frontend

# 2. Deploy to staging CDN
npm run deploy:staging -- --service frontend

# 3. Verify deployment
npm run verify:deployment -- --env staging
```

### Phase 4: Graph API Subscription Setup

```bash
# 1. Configure subscriptions
npm run graph:setup-subscriptions -- --env staging

# 2. Verify webhook endpoint
npm run graph:verify-webhook -- --env staging

# 3. Test notification flow
npm run graph:test-notification -- --env staging
```

## Production Deployment

### Blue-Green Deployment Strategy

```bash
# 1. Deploy to green environment
npm run deploy:production -- --target green

# 2. Run production smoke tests
npm run test:smoke -- --env production-green

# 3. Switch traffic gradually
npm run traffic:switch -- --from blue --to green --percentage 10

# 4. Monitor metrics
npm run monitor:deployment -- --duration 30m

# 5. Complete switch if successful
npm run traffic:switch -- --from blue --to green --percentage 100
```

### Rollback Plan

```bash
# If issues detected, rollback immediately
npm run rollback:production -- --to blue

# Restore database if needed
npm run db:restore -- --backup backup_20250722_120000.sql

# Notify team
npm run notify:rollback -- --reason "Performance degradation detected"
```

## Monitoring Setup

### 1. Application Metrics

```typescript
// Key metrics to monitor
- email.processing.duration
- email.processing.success/error
- workflow.completion.rate
- dashboard.load.time
- api.response.time
- websocket.connections
```

### 2. Alerts Configuration

```yaml
# alerts.yaml
alerts:
  - name: WorkflowCompletionLow
    condition: workflow.completion.rate < 10
    severity: critical
    action: page-oncall
    
  - name: EmailProcessingSlow
    condition: email.processing.duration.p95 > 30s
    severity: warning
    action: notify-team
    
  - name: APIErrorRateHigh
    condition: api.error.rate > 0.05
    severity: critical
    action: page-oncall
```

### 3. Dashboard Monitoring

Access monitoring dashboards:
- Grafana: https://monitoring.tdsynnex.com/unified-dashboard
- Application Logs: https://logs.tdsynnex.com/unified-dashboard
- Performance: https://apm.tdsynnex.com/unified-dashboard

## Post-Deployment Verification

### 1. Functional Verification

```bash
# Run post-deployment tests
npm run test:post-deployment -- --env production

# Verify critical flows
- [ ] Email reception via webhook
- [ ] Email processing pipeline
- [ ] Workflow detection accuracy
- [ ] Dashboard data display
- [ ] Real-time updates
- [ ] Agent assignment
```

### 2. Performance Verification

```bash
# Check performance metrics
npm run metrics:check -- --env production

# Expected values:
- Dashboard load time: < 2s
- Email processing: < 10s
- API response time: < 200ms (p95)
- WebSocket latency: < 500ms
```

### 3. Data Integrity Checks

```sql
-- Verify workflow chains
SELECT 
  COUNT(*) as total_chains,
  SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) as complete_chains,
  ROUND(100.0 * SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) / COUNT(*), 2) as completion_rate
FROM workflow_chains;

-- Check email processing status
SELECT 
  workflow_state,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM unified_emails
GROUP BY workflow_state;
```

## User Migration

### 1. Gradual Rollout

```javascript
// Feature flag configuration
{
  "unified-dashboard": {
    "enabled": true,
    "rollout": {
      "type": "percentage",
      "value": 10,
      "sticky": true
    },
    "overrides": {
      "beta-users": true,
      "admin-users": true
    }
  }
}
```

### 2. User Communication

Send notifications:
```bash
npm run notify:users -- --template unified-dashboard-launch --group beta
```

### 3. Training Materials

- Video walkthrough: `/docs/videos/unified-dashboard-intro.mp4`
- User guide: `/docs/guides/unified-dashboard-user-guide.pdf`
- FAQ: `/docs/unified-dashboard-faq.md`

## Troubleshooting

### Common Issues

1. **Graph API webhook not receiving notifications**
   ```bash
   # Check subscription status
   npm run graph:check-subscriptions
   
   # Verify webhook endpoint
   curl -X POST https://api.tdsynnex.com/api/webhooks/microsoft-graph \
     -H "Content-Type: application/json" \
     -d '{"validationToken": "test"}'
   ```

2. **Email processing stuck**
   ```bash
   # Check queue status
   npm run queue:status -- email-notifications
   
   # Clear stuck jobs
   npm run queue:clear-stuck -- email-notifications
   ```

3. **Dashboard not loading**
   ```bash
   # Check API health
   curl https://api.tdsynnex.com/health
   
   # Verify WebSocket connection
   npm run ws:test-connection
   ```

## Success Criteria

The deployment is considered successful when:

1. ✅ All health checks passing
2. ✅ Workflow completion rate improving (target: >10% within 1 week)
3. ✅ Average response time < 4 hours
4. ✅ No critical errors in first 24 hours
5. ✅ User adoption > 50% within 1 week
6. ✅ Performance metrics within targets

## Support

For deployment support:
- Slack: #unified-dashboard-deployment
- On-call: deployment-support@tdsynnex.com
- Wiki: https://wiki.tdsynnex.com/unified-dashboard-deployment