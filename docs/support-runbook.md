# Email Dashboard Support Runbook

## Quick Reference

**Application**: Email Dashboard
**Environment**: Production
**URL**: https://email-dashboard.tdsynnex.com
**Version**: 1.0.0
**Last Updated**: January 2025

### Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| On-Call Engineer | Rotation | PagerDuty | 24/7 |
| Team Lead | John Smith | +1-555-0123 | Business hours |
| Database Admin | Jane Doe | +1-555-0124 | Business hours |
| Security Team | SOC | security@tdsynnex.com | 24/7 |

### Critical Systems

| System | Endpoint | Monitoring |
|--------|----------|------------|
| Application | https://email-dashboard.tdsynnex.com | Uptime Robot |
| API | https://api.email-dashboard.tdsynnex.com | Prometheus |
| Database | postgresql.production.svc.cluster.local | CloudWatch |
| Redis | redis.production.svc.cluster.local | Redis Sentinel |

## Common Issues and Resolutions

### Issue 1: Users Cannot Login

**Symptoms:**
- Login page loads but authentication fails
- "Invalid credentials" error
- Spinning login button

**Diagnosis Steps:**
1. Check authentication service health
   ```bash
   kubectl get pods -n production -l component=auth
   kubectl logs -n production -l component=auth --tail=50
   ```

2. Verify JWT secret is configured
   ```bash
   kubectl get secret email-dashboard-secrets -n production -o yaml
   ```

3. Check database connectivity
   ```bash
   kubectl exec -it <app-pod> -n production -- nc -zv postgresql 5432
   ```

**Resolution:**
1. **If auth service is down:**
   ```bash
   kubectl rollout restart deployment/email-dashboard -n production
   ```

2. **If JWT secret missing:**
   ```bash
   # Restore from backup
   kubectl apply -f backups/secrets/email-dashboard-secrets.yaml
   ```

3. **If database unreachable:**
   - Check database pod status
   - Verify network policies
   - Escalate to DBA team

**Escalation:** If unresolved after 15 minutes

---

### Issue 2: Slow Performance / Timeouts

**Symptoms:**
- Page load time >5 seconds
- API timeouts
- Browser showing "This page isn't responding"

**Diagnosis Steps:**
1. Check application metrics
   ```bash
   # CPU and Memory usage
   kubectl top pods -n production -l app=email-dashboard
   
   # Response time metrics
   curl http://prometheus:9090/api/v1/query?query=http_request_duration_seconds
   ```

2. Verify database performance
   ```bash
   kubectl exec -it postgresql-0 -n production -- \
     psql -U postgres -d email_dashboard -c \
     "SELECT * FROM pg_stat_activity WHERE state != 'idle';"
   ```

3. Check Redis cache
   ```bash
   kubectl exec -it redis-master-0 -n production -- \
     redis-cli INFO stats | grep hit_rate
   ```

**Resolution:**
1. **High CPU/Memory:**
   ```bash
   # Scale up pods
   kubectl scale deployment email-dashboard --replicas=5 -n production
   
   # If persistent, check for memory leaks
   kubectl exec -it <pod> -n production -- npm run heapdump
   ```

2. **Database bottleneck:**
   ```bash
   # Kill long-running queries
   kubectl exec -it postgresql-0 -n production -- \
     psql -U postgres -d email_dashboard -c \
     "SELECT pg_cancel_backend(pid) FROM pg_stat_activity 
      WHERE state != 'idle' AND query_start < now() - interval '5 minutes';"
   ```

3. **Cache issues:**
   ```bash
   # Clear specific cache keys
   kubectl exec -it redis-master-0 -n production -- \
     redis-cli --scan --pattern "email:*" | xargs redis-cli DEL
   ```

**Escalation:** Performance team if degradation persists

---

### Issue 3: Missing or Incorrect Email Data

**Symptoms:**
- Emails not appearing in dashboard
- Incorrect status displays
- Data inconsistencies

**Diagnosis Steps:**
1. Verify data ingestion
   ```bash
   # Check ingestion logs
   kubectl logs -n production -l component=ingestion --since=1h
   
   # Verify queue status
   kubectl exec -it <app-pod> -n production -- \
     npm run queue:status
   ```

2. Check data integrity
   ```sql
   -- Run in database
   SELECT COUNT(*), status, DATE(created_at) 
   FROM emails 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   GROUP BY status, DATE(created_at);
   ```

**Resolution:**
1. **Ingestion stopped:**
   ```bash
   # Restart ingestion service
   kubectl rollout restart deployment/email-ingestion -n production
   
   # Process backlog
   kubectl exec -it <app-pod> -n production -- \
     npm run queue:process-backlog
   ```

2. **Data corruption:**
   ```bash
   # Run data validation
   kubectl exec -it <app-pod> -n production -- \
     npm run data:validate --fix
   
   # Reindex if needed
   kubectl exec -it <app-pod> -n production -- \
     npm run data:reindex
   ```

**Escalation:** Data team for integrity issues

---

### Issue 4: WebSocket Connection Failures

**Symptoms:**
- Real-time updates not working
- "Connection lost" notifications
- Constant reconnection attempts

**Diagnosis Steps:**
1. Check WebSocket service
   ```bash
   # Verify WebSocket pods
   kubectl get pods -n production -l component=websocket
   
   # Check connection count
   kubectl exec -it <ws-pod> -n production -- \
     curl localhost:3001/metrics | grep websocket_connections
   ```

2. Verify ingress configuration
   ```bash
   kubectl describe ingress email-dashboard-ingress -n production | \
     grep -A5 "websocket"
   ```

**Resolution:**
1. **Service issues:**
   ```bash
   # Restart WebSocket service
   kubectl rollout restart deployment/websocket-service -n production
   ```

2. **Connection limit reached:**
   ```bash
   # Increase connection limit
   kubectl set env deployment/websocket-service \
     MAX_CONNECTIONS=10000 -n production
   ```

**Escalation:** Network team for persistent issues

---

### Issue 5: Export Functionality Broken

**Symptoms:**
- Export button not responding
- Corrupted export files
- Export timeout errors

**Diagnosis Steps:**
1. Check export service health
   ```bash
   kubectl logs -n production -l component=export --tail=100
   ```

2. Verify storage availability
   ```bash
   kubectl exec -it <app-pod> -n production -- df -h /tmp
   ```

**Resolution:**
1. **Service errors:**
   ```bash
   # Clear export queue
   kubectl exec -it redis-master-0 -n production -- \
     redis-cli DEL export:queue
   
   # Restart service
   kubectl rollout restart deployment/email-dashboard -n production
   ```

2. **Storage full:**
   ```bash
   # Clean temporary files
   kubectl exec -it <app-pod> -n production -- \
     find /tmp -name "export-*" -mtime +1 -delete
   ```

**Escalation:** Infrastructure team for storage issues

---

## Incident Response Procedures

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 | Complete outage | 15 minutes | Site down, data loss |
| P2 | Major degradation | 30 minutes | Login failures, severe slowness |
| P3 | Minor issues | 2 hours | Export errors, missing emails |
| P4 | Low impact | Next business day | UI bugs, feature requests |

### P1 Incident Response

1. **Immediate Actions (0-5 minutes)**
   ```bash
   # Check overall health
   kubectl get pods -n production
   kubectl get nodes
   
   # Check recent deployments
   kubectl rollout history deployment/email-dashboard -n production
   ```

2. **Diagnosis (5-15 minutes)**
   - Review monitoring dashboards
   - Check recent changes
   - Identify affected components

3. **Mitigation Options**
   - **Rollback recent deployment:**
     ```bash
     ./deployment/scripts/rollback.sh
     ```
   
   - **Scale up resources:**
     ```bash
     kubectl scale deployment email-dashboard --replicas=10 -n production
     ```
   
   - **Enable maintenance mode:**
     ```bash
     kubectl set env deployment/email-dashboard \
       MAINTENANCE_MODE=true -n production
     ```

4. **Communication**
   - Update status page
   - Notify stakeholders via Slack
   - Create incident ticket

### P2/P3 Incident Response

1. **Initial Assessment**
   - Determine scope of impact
   - Check monitoring alerts
   - Review recent changes

2. **Targeted Resolution**
   - Apply specific fixes from runbook
   - Monitor improvement
   - Document actions taken

3. **Verification**
   - Confirm issue resolved
   - Check for side effects
   - Update monitoring if needed

---

## Maintenance Procedures

### Daily Checks (Automated)

```bash
#!/bin/bash
# Daily health check script

echo "=== Email Dashboard Daily Health Check ==="
echo "Date: $(date)"

# Check pod status
echo -e "\n--- Pod Status ---"
kubectl get pods -n production -l app=email-dashboard

# Check resource usage
echo -e "\n--- Resource Usage ---"
kubectl top pods -n production -l app=email-dashboard

# Check error rate
echo -e "\n--- Error Rate (Last 24h) ---"
curl -s http://prometheus:9090/api/v1/query?query=\
'rate(http_requests_total{app="email-dashboard",status=~"5.."}[24h])' | \
jq '.data.result[0].value[1]'

# Check database connections
echo -e "\n--- Database Connections ---"
kubectl exec -it postgresql-0 -n production -- \
  psql -U postgres -d email_dashboard -c \
  "SELECT count(*) FROM pg_stat_activity;"
```

### Weekly Maintenance

1. **Log Rotation**
   ```bash
   # Archive old logs
   kubectl exec -it <app-pod> -n production -- \
     find /var/log -name "*.log" -mtime +7 -exec gzip {} \;
   ```

2. **Cache Optimization**
   ```bash
   # Analyze cache usage
   kubectl exec -it redis-master-0 -n production -- \
     redis-cli --bigkeys
   ```

3. **Database Maintenance**
   ```bash
   # Vacuum and analyze
   kubectl exec -it postgresql-0 -n production -- \
     psql -U postgres -d email_dashboard -c "VACUUM ANALYZE;"
   ```

### Monthly Tasks

1. **Security Patches**
   - Review available updates
   - Test in staging
   - Schedule maintenance window

2. **Performance Review**
   - Analyze trends
   - Optimize slow queries
   - Adjust resource limits

3. **Backup Verification**
   - Test restore procedure
   - Verify backup integrity
   - Update documentation

---

## Monitoring and Alerts

### Key Dashboards

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Application Overview | http://grafana/d/email-dash | General health |
| Performance Metrics | http://grafana/d/performance | Response times |
| Database Stats | http://grafana/d/postgres | Query performance |
| Error Tracking | http://grafana/d/errors | Error analysis |

### Alert Response Matrix

| Alert | Check | Action |
|-------|-------|--------|
| High Error Rate | Logs, recent changes | Rollback if needed |
| Memory Alert | Pod memory usage | Scale or restart |
| CPU Alert | Pod CPU usage | Scale horizontally |
| Disk Space | PVC usage | Clean temp files |
| Certificate Expiry | Cert-manager logs | Renew certificate |

### Custom Queries

**Find slow queries:**
```promql
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
) > 2
```

**Check WebSocket health:**
```promql
rate(websocket_errors_total[5m]) > 0.01
```

**Database connection pool:**
```promql
email_dashboard_db_pool_available / 
email_dashboard_db_pool_size < 0.2
```

---

## Recovery Procedures

### Database Recovery

1. **From Backup:**
   ```bash
   # Stop application
   kubectl scale deployment email-dashboard --replicas=0 -n production
   
   # Restore database
   kubectl exec -it postgresql-0 -n production -- \
     psql -U postgres < /backups/email_dashboard_latest.sql
   
   # Start application
   kubectl scale deployment email-dashboard --replicas=3 -n production
   ```

2. **Point-in-Time Recovery:**
   ```bash
   # Use WAL archives
   kubectl exec -it postgresql-0 -n production -- \
     pg_basebackup -D /var/lib/postgresql/data.restored
   ```

### Application Recovery

1. **Clean Restart:**
   ```bash
   # Delete pods to force restart
   kubectl delete pods -n production -l app=email-dashboard
   ```

2. **State Reset:**
   ```bash
   # Clear application state
   kubectl exec -it redis-master-0 -n production -- redis-cli FLUSHDB
   
   # Reinitialize
   kubectl exec -it <app-pod> -n production -- npm run init:prod
   ```

---

## Appendix

### Useful Commands

```bash
# Get pod logs with timestamps
kubectl logs -n production <pod> --timestamps

# Execute commands in pod
kubectl exec -it <pod> -n production -- /bin/sh

# Port forward for debugging
kubectl port-forward -n production svc/email-dashboard 8080:80

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'

# Describe problematic pod
kubectl describe pod <pod> -n production
```

### Configuration Files

All configuration files are stored in:
- Git: https://github.com/tdsynnex/email-dashboard
- Backup: s3://tdsynnex-configs/email-dashboard/

### Support Tools

- **K9s**: Terminal UI for Kubernetes
- **Stern**: Multi-pod log tailing
- **HTTPie**: API testing
- **pgcli**: PostgreSQL CLI
- **redis-cli**: Redis CLI

---

*This runbook is a living document. Update it after each incident with new findings and solutions.*

**Version**: 1.0.0
**Last Updated**: January 2025
**Next Review**: February 2025