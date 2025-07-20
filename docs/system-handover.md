# Email Dashboard System Handover Documentation

## Overview

This document facilitates the complete handover of the Email Dashboard system from the development team to the operations and support teams. It contains all critical information needed to maintain, operate, and enhance the system.

**Handover Date**: January 19, 2025
**System Version**: 1.0.0
**Development Team Lead**: [Development Lead Name]
**Operations Team Lead**: [Operations Lead Name]

## Table of Contents

1. [System Overview](#system-overview)
2. [Access and Credentials](#access-and-credentials)
3. [Technical Stack](#technical-stack)
4. [Infrastructure Details](#infrastructure-details)
5. [Operational Procedures](#operational-procedures)
6. [Known Issues and Limitations](#known-issues-and-limitations)
7. [Support Escalation](#support-escalation)
8. [Knowledge Transfer Schedule](#knowledge-transfer-schedule)

---

## System Overview

### Business Purpose
The Email Dashboard provides TD SYNNEX with a centralized platform for managing, tracking, and analyzing email communications. It replaces the legacy email management system with modern, scalable architecture.

### Key Capabilities
- Real-time email tracking and status management
- Advanced filtering and search functionality
- Analytics and reporting dashboard
- Workflow automation
- Export capabilities
- SLA tracking and compliance

### User Base
- **Primary Users**: Customer Service Representatives (500+ users)
- **Secondary Users**: Managers and Supervisors (50+ users)
- **Admin Users**: System Administrators (10 users)
- **API Consumers**: 3 internal systems

### Service Level Agreements
- **Availability**: 99.5% uptime
- **Response Time**: <2 seconds for 95% of requests
- **Data Freshness**: <30 seconds for email updates
- **Support Response**: P1-15min, P2-30min, P3-2hrs

---

## Access and Credentials

### System URLs

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production | https://email-dashboard.tdsynnex.com | Live system |
| Staging | https://staging.email-dashboard.tdsynnex.com | Testing |
| Development | https://dev.email-dashboard.tdsynnex.com | Development |
| API Docs | https://api.email-dashboard.tdsynnex.com/docs | API Reference |

### Administrative Access

#### Kubernetes Cluster
```bash
# Production cluster
kubectl config use-context prod-cluster
kubectl get pods -n production

# Staging cluster
kubectl config use-context staging-cluster
kubectl get pods -n staging
```

#### Database Access
```bash
# Production database (read-only)
psql -h postgresql.production.svc.cluster.local \
     -U readonly_user -d email_dashboard

# Admin access (restricted)
# Contact DBA team for write access
```

#### Monitoring Systems
- **Grafana**: https://grafana.tdsynnex.com
  - Login: LDAP credentials
  - Dashboards: Email Dashboard folder
  
- **Prometheus**: https://prometheus.tdsynnex.com
  - Access: Read-only via Grafana
  
- **Logs**: https://kibana.tdsynnex.com
  - Index pattern: `email-dashboard-*`

### Service Accounts

| Service | Username | Location | Purpose |
|---------|----------|----------|---------|
| GitHub | email-dash-bot | GitHub Settings | CI/CD |
| Docker Hub | tdsynnex-bot | Docker Hub | Image registry |
| AWS | email-dashboard-sa | AWS IAM | S3 access |
| Monitoring | prometheus-sa | Kubernetes | Metrics collection |

*Note: Passwords/tokens stored in HashiCorp Vault*

---

## Technical Stack

### Frontend Technologies
- **Framework**: React 18.2.0
- **Language**: TypeScript 5.0
- **State Management**: TanStack Query v5
- **UI Library**: Custom components + Tailwind CSS
- **Charts**: Chart.js 4.0
- **Build Tool**: Vite 5.0

### Backend Technologies
- **Runtime**: Node.js 20.11 LTS
- **Framework**: Express + tRPC
- **Language**: TypeScript 5.0
- **Database**: PostgreSQL 15.3
- **Cache**: Redis 7.2
- **Queue**: Bull (Redis-based)

### Infrastructure
- **Container**: Docker 24.0
- **Orchestration**: Kubernetes 1.28
- **Ingress**: NGINX Ingress Controller
- **Service Mesh**: Istio (planned for v2)
- **Cloud Provider**: AWS (primary), Azure (DR)

### Development Tools
- **Version Control**: Git / GitHub
- **CI/CD**: GitHub Actions + ArgoCD
- **Monitoring**: Prometheus + Grafana
- **Logging**: Loki + Promtail
- **APM**: Jaeger (traces)

---

## Infrastructure Details

### Kubernetes Architecture

```yaml
Production Cluster:
  Nodes: 6 (m5.2xlarge)
  Namespaces:
    - production (main application)
    - monitoring (Prometheus stack)
    - ingress-nginx (ingress controller)
  
Resource Allocation:
  Email Dashboard:
    Replicas: 3-10 (HPA enabled)
    CPU: 250m request, 500m limit
    Memory: 256Mi request, 512Mi limit
  
  PostgreSQL:
    Replicas: 1 primary + 2 replicas
    CPU: 2 cores
    Memory: 8Gi
    Storage: 100Gi SSD
  
  Redis:
    Replicas: 1 primary + 2 replicas
    CPU: 500m
    Memory: 2Gi
```

### Network Architecture

```
Internet
    │
    ▼
CloudFront CDN
    │
    ▼
AWS ALB (Load Balancer)
    │
    ▼
NGINX Ingress (Kubernetes)
    │
    ├── /api/* → API Service
    ├── /ws/* → WebSocket Service
    └── /* → Frontend Service
```

### Database Schema

Key tables and relationships:

```sql
emails (master table)
  ├── email_status_history (1:N)
  ├── email_attachments (1:N)
  ├── email_tags (N:N via email_tag_mapping)
  └── workflows (N:1)

users
  ├── user_preferences (1:1)
  ├── filter_presets (1:N)
  └── audit_logs (1:N)
```

### Backup Strategy

| Component | Frequency | Retention | Location |
|-----------|-----------|-----------|----------|
| Database | Every 6 hours | 30 days | S3 bucket |
| Application logs | Daily | 90 days | S3 bucket |
| Configurations | On change | Unlimited | Git repository |
| Persistent volumes | Daily | 7 days | EBS snapshots |

---

## Operational Procedures

### Daily Operations Checklist

#### Morning (9:00 AM)
- [ ] Check overnight alerts
- [ ] Review system dashboard
- [ ] Verify backup completion
- [ ] Check error rates
- [ ] Review queue depth

#### Afternoon (2:00 PM)
- [ ] Monitor peak load performance
- [ ] Check resource utilization
- [ ] Review any P3/P4 tickets
- [ ] Verify data synchronization

#### End of Day (5:00 PM)
- [ ] Review daily metrics
- [ ] Ensure no critical alerts
- [ ] Check scheduled jobs status
- [ ] Update team on any issues

### Common Operational Tasks

#### 1. Scaling Application
```bash
# Manual scale
kubectl scale deployment email-dashboard \
  --replicas=5 -n production

# Check HPA status
kubectl get hpa -n production
```

#### 2. Clearing Cache
```bash
# Clear all cache
kubectl exec -it redis-master-0 -n production -- \
  redis-cli FLUSHDB

# Clear specific pattern
kubectl exec -it redis-master-0 -n production -- \
  redis-cli --scan --pattern "email:*" | xargs redis-cli DEL
```

#### 3. Database Maintenance
```bash
# Vacuum database
kubectl exec -it postgresql-0 -n production -- \
  psql -U postgres -d email_dashboard -c "VACUUM ANALYZE;"

# Check slow queries
kubectl exec -it postgresql-0 -n production -- \
  psql -U postgres -d email_dashboard -c \
  "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

#### 4. Log Analysis
```bash
# Check application logs
kubectl logs -n production -l app=email-dashboard \
  --since=1h --tail=1000

# Search for errors
kubectl logs -n production -l app=email-dashboard \
  --since=1h | grep ERROR
```

### Deployment Procedures

#### Standard Deployment
1. Code merged to main branch
2. CI/CD pipeline triggered automatically
3. Tests run (unit, integration, security)
4. Docker image built and pushed
5. ArgoCD detects new image
6. Rolling update initiated
7. Health checks validate deployment
8. Old pods terminated

#### Emergency Hotfix
```bash
# Use the emergency deployment script
./scripts/emergency-deploy.sh <version>

# This will:
# 1. Bypass certain CI checks
# 2. Deploy directly to production
# 3. Create incident report
# 4. Notify on-call team
```

#### Rollback Procedure
```bash
# Automated rollback
./deployment/scripts/rollback.sh <revision>

# Manual rollback
kubectl rollout undo deployment/email-dashboard \
  -n production --to-revision=<revision>
```

---

## Known Issues and Limitations

### Current Limitations

1. **Export Size Limit**
   - Maximum 50,000 rows per export
   - Workaround: Use date filters to split large exports

2. **WebSocket Connections**
   - Maximum 1,000 concurrent connections per pod
   - Scaling: Add more WebSocket pods if needed

3. **Search Performance**
   - Full-text search slower on >1M records
   - Solution: Elasticsearch integration planned for v2

4. **Browser Compatibility**
   - IE11 not supported
   - Best experience: Chrome, Firefox, Safari (latest)

### Known Bugs

| ID | Description | Impact | Workaround |
|----|-------------|--------|------------|
| BUG-001 | Filter presets occasionally don't load | Low | Refresh page |
| BUG-002 | Export progress bar stuck at 99% | Low | Download completes despite UI |
| BUG-003 | WebSocket reconnection delay | Medium | Manual page refresh |

### Technical Debt

1. **Code Refactoring Needed**
   - EmailStorageService has grown too large
   - Plan: Split into smaller services in v1.1

2. **Test Coverage**
   - Current: 78%
   - Target: 90%
   - Focus areas: Export functionality, WebSocket handlers

3. **Performance Optimization**
   - Database queries need optimization
   - Consider implementing GraphQL for flexible queries

---

## Support Escalation

### Support Tiers

#### Tier 1 - Help Desk
- Password resets
- Basic navigation help
- Known issue workarounds
- Contact: helpdesk@tdsynnex.com

#### Tier 2 - Application Support
- Application errors
- Data inconsistencies
- Performance issues
- Contact: email-dashboard-support@tdsynnex.com

#### Tier 3 - Development Team
- Bug fixes
- Feature requests
- Architecture changes
- Contact: email-dashboard-dev@tdsynnex.com

### Escalation Matrix

| Issue Type | Severity | First Contact | Escalation Time |
|------------|----------|---------------|------------------|
| Login Issues | P3 | Tier 1 | 2 hours |
| Data Missing | P2 | Tier 2 | 30 minutes |
| System Down | P1 | Tier 2 | Immediate |
| Feature Request | P4 | Tier 2 | Next sprint |

### On-Call Rotation

- **Primary**: Rotation via PagerDuty
- **Secondary**: Team lead backup
- **Schedule**: Weekly rotation
- **Handoff**: Fridays at 5 PM

---

## Knowledge Transfer Schedule

### Week 1: System Overview
- **Day 1**: Architecture walkthrough
- **Day 2**: Codebase tour
- **Day 3**: Infrastructure deep dive
- **Day 4**: Monitoring and alerting
- **Day 5**: Hands-on exercises

### Week 2: Operational Training
- **Day 1**: Daily operations procedures
- **Day 2**: Deployment processes
- **Day 3**: Troubleshooting common issues
- **Day 4**: Performance tuning
- **Day 5**: Incident response drill

### Week 3: Advanced Topics
- **Day 1**: Database administration
- **Day 2**: Security procedures
- **Day 3**: Disaster recovery
- **Day 4**: Capacity planning
- **Day 5**: Q&A and assessment

### Week 4: Shadowing
- Operations team shadows development team
- Handle real incidents together
- Document any gaps
- Final handover sign-off

## Handover Checklist

### Development Team Completes:
- [x] Source code repository access
- [x] Documentation complete
- [x] CI/CD pipeline access
- [x] Monitoring dashboards created
- [x] Runbook updated
- [x] Known issues documented
- [ ] Knowledge transfer sessions
- [ ] Shadow support period

### Operations Team Confirms:
- [ ] Access to all systems verified
- [ ] Documentation reviewed
- [ ] Runbook tested
- [ ] Alerts configured
- [ ] Backup procedures tested
- [ ] Team trained
- [ ] Support processes defined
- [ ] Handover accepted

## Sign-off

### Development Team
**Name**: ________________________
**Date**: ________________________
**Signature**: ________________________

### Operations Team
**Name**: ________________________
**Date**: ________________________
**Signature**: ________________________

### Management Approval
**Name**: ________________________
**Date**: ________________________
**Signature**: ________________________

---

## Appendices

### A. Contact List

| Role | Name | Email | Phone | Available |
|------|------|-------|-------|-----------|
| Dev Lead | John Smith | john.smith@tdsynnex.com | +1-555-0100 | 9-5 PST |
| Ops Lead | Jane Doe | jane.doe@tdsynnex.com | +1-555-0101 | 9-5 EST |
| DBA | Bob Wilson | bob.wilson@tdsynnex.com | +1-555-0102 | On-call |
| Security | Alice Brown | alice.brown@tdsynnex.com | +1-555-0103 | 9-5 PST |

### B. Useful Links

- **GitHub Repository**: https://github.com/tdsynnex/email-dashboard
- **Wiki**: https://wiki.tdsynnex.com/email-dashboard
- **Jira Project**: https://jira.tdsynnex.com/projects/ED
- **Slack Channel**: #email-dashboard-support
- **Training Videos**: https://training.tdsynnex.com/email-dashboard

### C. License Information

| Component | License | Expiry | Contact |
|-----------|---------|--------|---------|
| Kubernetes | Enterprise | 2025-12-31 | vendor@k8s.com |
| PostgreSQL | PostgreSQL | Perpetual | N/A |
| Redis | BSD | Perpetual | N/A |
| Monitoring | Prometheus | Apache 2.0 | N/A |

---

*This document is classified as TD SYNNEX Confidential*
*Version: 1.0 | Last Updated: January 19, 2025*