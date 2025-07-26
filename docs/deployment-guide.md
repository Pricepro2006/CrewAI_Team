# Email Dashboard Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Email Dashboard application to production environments using Docker and Kubernetes with 2025 best practices.

## Prerequisites

### Required Tools
- Docker 24.0+ with BuildKit
- Kubernetes 1.28+
- kubectl CLI
- Helm 3.12+
- Git
- Node.js 20.x (for local builds)

### Access Requirements
- Kubernetes cluster access
- Docker registry credentials
- Database credentials
- SSL certificates
- Monitoring stack access

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Ingress       │────▶│   App Service   │────▶│   PostgreSQL    │
│   (NGINX)       │     │   (3 replicas)  │     │   (Primary)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   Redis Cache   │     │   PostgreSQL    │
                        │   (Primary)     │     │   (Replica)     │
                        └─────────────────┘     └─────────────────┘
```

## Pre-Deployment Checklist

- [ ] Production cluster access verified
- [ ] Database provisioned and accessible
- [ ] Redis cache configured
- [ ] SSL certificates obtained
- [ ] Secrets configured in cluster
- [ ] Monitoring stack ready
- [ ] Backup strategy defined
- [ ] Rollback plan documented

## Step-by-Step Deployment

### 1. Environment Preparation

#### Create Namespace
```bash
kubectl create namespace production
kubectl label namespace production name=production
```

#### Configure Secrets
```bash
# Create .env.production file with sensitive data
cp deployment/env/.env.production.example deployment/env/.env.production
# Edit with actual values

# Create Kubernetes secret
kubectl create secret generic email-dashboard-secrets \
  --from-env-file=deployment/env/.env.production \
  --namespace=production
```

#### Setup Image Pull Secret
```bash
kubectl create secret docker-registry docker-registry-secret \
  --docker-server=docker.io \
  --docker-username=<username> \
  --docker-password=<password> \
  --docker-email=<email> \
  --namespace=production
```

### 2. Database Setup

#### PostgreSQL Deployment
```bash
# Using Helm for PostgreSQL
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgresql bitnami/postgresql \
  --namespace production \
  --set auth.postgresPassword=<password> \
  --set auth.database=email_dashboard \
  --set primary.persistence.size=100Gi \
  --set readReplicas.replicaCount=2
```

#### Database Migration
```bash
# Run migrations
kubectl run migration --rm -i --tty \
  --image=tdsynnex/email-dashboard:latest \
  --namespace=production \
  -- npm run migrate:prod
```

### 3. Application Build and Push

#### Build Docker Image
```bash
# Set version
export VERSION=v1.0.0

# Build with BuildKit
DOCKER_BUILDKIT=1 docker build \
  --build-arg VERSION=$VERSION \
  --tag tdsynnex/email-dashboard:$VERSION \
  --tag tdsynnex/email-dashboard:latest \
  --file deployment/docker/Dockerfile \
  .
```

#### Security Scan
```bash
# Scan for vulnerabilities
docker scan tdsynnex/email-dashboard:$VERSION

# Run Trivy scan
trivy image tdsynnex/email-dashboard:$VERSION
```

#### Push to Registry
```bash
docker push tdsynnex/email-dashboard:$VERSION
docker push tdsynnex/email-dashboard:latest
```

### 4. Deploy Application

#### Apply Configurations
```bash
# Apply ConfigMap
kubectl apply -f deployment/kubernetes/configmap.yaml

# Deploy application
kubectl apply -f deployment/kubernetes/deployment.yaml

# Verify deployment
kubectl rollout status deployment/email-dashboard -n production
```

#### Verify Pods
```bash
# Check pod status
kubectl get pods -n production -l app=email-dashboard

# Check logs
kubectl logs -n production -l app=email-dashboard --tail=100
```

### 5. Configure Networking

#### Apply Service and Ingress
```bash
# Service is included in deployment.yaml
# Verify service
kubectl get svc email-dashboard-service -n production

# Check endpoints
kubectl get endpoints email-dashboard-service -n production
```

#### SSL/TLS Configuration
```bash
# Cert-manager should auto-provision Let's Encrypt certificate
# Verify certificate
kubectl get certificate -n production
kubectl describe certificate email-dashboard-tls -n production
```

### 6. Setup Monitoring

#### Deploy Prometheus Config
```bash
kubectl apply -f deployment/monitoring/prometheus-config.yaml
kubectl apply -f deployment/monitoring/alertmanager-config.yaml
```

#### Import Grafana Dashboard
```bash
# Apply dashboard ConfigMap
kubectl apply -f deployment/monitoring/grafana-dashboard.json

# Dashboard will auto-import if Grafana is configured correctly
```

#### Verify Metrics
```bash
# Port-forward to test metrics endpoint
kubectl port-forward -n production \
  deployment/email-dashboard 9090:9090

# Check metrics
curl http://localhost:9090/metrics
```

### 7. Post-Deployment Verification

#### Health Checks
```bash
# Check application health
curl https://email-dashboard.tdsynnex.com/health

# Check readiness
curl https://email-dashboard.tdsynnex.com/ready
```

#### Functional Tests
```bash
# Run smoke tests
npm run test:smoke -- --env=production

# Run E2E tests
npm run test:e2e -- --env=production
```

#### Performance Validation
```bash
# Run load test
npm run test:load -- --env=production --users=100
```

## Configuration Management

### Environment Variables
Key environment variables configured via ConfigMap:
- `NODE_ENV`: production
- `PORT`: 3000
- `LOG_LEVEL`: info
- `FEATURE_FLAGS`: Enabled features

Sensitive variables via Secrets:
- `DATABASE_URL`
- `REDIS_URL`
- `API_KEY`
- `JWT_SECRET`

### Feature Flags
Managed through ConfigMap for easy updates:
```yaml
FEATURE_EXPORT_ENABLED: "true"
FEATURE_REALTIME_UPDATES: "true"
FEATURE_ADVANCED_FILTERING: "true"
```

## Scaling Configuration

### Horizontal Pod Autoscaler
```yaml
minReplicas: 3
maxReplicas: 10
metrics:
  - cpu: 70%
  - memory: 80%
```

### Manual Scaling
```bash
# Scale up
kubectl scale deployment email-dashboard \
  --replicas=5 -n production

# Scale down
kubectl scale deployment email-dashboard \
  --replicas=3 -n production
```

## Maintenance Procedures

### Rolling Updates
```bash
# Update image
kubectl set image deployment/email-dashboard \
  email-dashboard=tdsynnex/email-dashboard:v1.1.0 \
  -n production

# Monitor rollout
kubectl rollout status deployment/email-dashboard -n production
```

### Database Maintenance
```bash
# Backup database
kubectl exec -it postgresql-0 -n production -- \
  pg_dump -U postgres email_dashboard > backup.sql

# Vacuum database
kubectl exec -it postgresql-0 -n production -- \
  psql -U postgres -d email_dashboard -c "VACUUM ANALYZE;"
```

### Cache Management
```bash
# Clear Redis cache
kubectl exec -it redis-master-0 -n production -- \
  redis-cli FLUSHDB

# Monitor cache metrics
kubectl exec -it redis-master-0 -n production -- \
  redis-cli INFO stats
```

## Troubleshooting

### Common Issues

#### Pods Not Starting
```bash
# Check pod events
kubectl describe pod <pod-name> -n production

# Check resource limits
kubectl top pod -n production

# Review security policies
kubectl get psp
```

#### Database Connection Issues
```bash
# Test connectivity
kubectl run -it --rm debug \
  --image=postgres:15 \
  --namespace=production \
  -- psql -h postgresql -U postgres

# Check network policies
kubectl get networkpolicy -n production
```

#### Performance Issues
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n production

# Review HPA status
kubectl get hpa -n production

# Check for throttling
kubectl describe pod <pod-name> -n production | grep -i throttl
```

### Debug Mode
```bash
# Enable debug logging
kubectl set env deployment/email-dashboard \
  LOG_LEVEL=debug -n production

# Attach to pod
kubectl exec -it <pod-name> -n production -- /bin/sh
```

## Rollback Procedures

### Automatic Rollback
The deployment is configured with:
- `maxUnavailable: 0` - Ensures availability
- Health checks prevent bad deployments
- Automatic rollback on failure

### Manual Rollback
```bash
# View rollout history
kubectl rollout history deployment/email-dashboard -n production

# Rollback to previous version
kubectl rollout undo deployment/email-dashboard -n production

# Rollback to specific revision
kubectl rollout undo deployment/email-dashboard \
  --to-revision=2 -n production
```

### Emergency Rollback Script
```bash
# Use the provided rollback script
./deployment/scripts/rollback.sh <revision-number>
```

## Security Considerations

### Pod Security
- Runs as non-root user (UID 1001)
- Read-only root filesystem
- No privilege escalation
- Capabilities dropped

### Network Security
- Network policies restrict traffic
- TLS encryption for all endpoints
- Ingress rate limiting enabled

### Secrets Management
- Secrets encrypted at rest
- RBAC restricts access
- Regular rotation schedule

## Monitoring and Alerts

### Key Metrics to Monitor
- Request rate and errors
- Response time (p95, p99)
- Pod CPU and memory usage
- Database connection pool
- Cache hit rate
- WebSocket connections

### Alert Configuration
Critical alerts configured for:
- High error rate (>5%)
- Response time degradation
- Pod failures
- Database connection exhaustion
- Certificate expiration

## Backup and Recovery

### Automated Backups
```bash
# Database backups run daily via CronJob
kubectl get cronjob -n production

# Verify latest backup
kubectl logs -n production \
  -l job-name=database-backup-<timestamp>
```

### Manual Backup
```bash
# Use backup script
./deployment/scripts/backup.sh

# Verify backup
ls -la backups/
```

### Disaster Recovery
1. Restore database from backup
2. Clear Redis cache
3. Redeploy application
4. Verify functionality
5. Update DNS if needed

## Performance Tuning

### Application Tuning
- Connection pool sizing
- Worker process configuration
- Cache TTL optimization
- Query optimization

### Kubernetes Tuning
- Resource requests/limits
- HPA configuration
- Node affinity rules
- Pod disruption budgets

## Compliance and Audit

### Audit Logging
All administrative actions logged:
- Deployment changes
- Configuration updates
- Access attempts
- Data exports

### Compliance Checks
- GDPR data handling
- SOC2 requirements
- PCI DSS if applicable
- Regular security audits

---

*Deployment Guide Version: 1.0*
*Last Updated: January 2025*
*Next Review: April 2025*