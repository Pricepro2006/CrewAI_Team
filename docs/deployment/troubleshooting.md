# Deployment Troubleshooting Guide

## Overview

This guide provides solutions to common deployment issues, debugging techniques, and recovery procedures for CrewAI Team deployments.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Debugging Techniques](#debugging-techniques)
3. [Performance Issues](#performance-issues)
4. [Database Problems](#database-problems)
5. [Network Issues](#network-issues)
6. [Container/Kubernetes Issues](#containerkubernetes-issues)
7. [Application Errors](#application-errors)
8. [Recovery Procedures](#recovery-procedures)
9. [Health Check Failures](#health-check-failures)
10. [Emergency Procedures](#emergency-procedures)

## Common Issues

### Application Won't Start

#### Symptoms
- Container exits immediately
- No logs output
- Health checks failing

#### Diagnosis
```bash
# Check container logs
docker logs crewai-app --tail=100

# Check exit code
docker inspect crewai-app --format='{{.State.ExitCode}}'

# Interactive debug
docker run -it --entrypoint /bin/sh crewai/team:latest
```

#### Common Causes and Solutions

1. **Missing Environment Variables**
   ```bash
   # Check required variables
   docker exec crewai-app env | grep -E "(DATABASE|REDIS|JWT)"
   
   # Solution: Ensure all required env vars are set
   docker run -e DATABASE_URL=... -e REDIS_URL=... crewai/team
   ```

2. **Database Connection Failed**
   ```typescript
   // Test database connection
   const testConnection = async () => {
     try {
       await db.raw('SELECT 1');
       console.log('Database connected');
     } catch (error) {
       console.error('Database connection failed:', error);
     }
   };
   ```

3. **Port Already in Use**
   ```bash
   # Check port usage
   lsof -i :3000
   netstat -tulpn | grep 3000
   
   # Solution: Change port or kill process
   kill -9 $(lsof -t -i:3000)
   ```

4. **Insufficient Resources**
   ```bash
   # Check resource limits
   docker stats crewai-app
   
   # Increase limits
   docker run -m 2g --cpus="2" crewai/team
   ```

### Memory Leaks

#### Detection
```javascript
// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
  });
}, 60000);
```

#### Heap Dump Analysis
```bash
# Generate heap dump
kill -USR2 <pid>

# Or programmatically
const v8 = require('v8');
const fs = require('fs');

function createHeapSnapshot() {
  const fileName = `heap-${Date.now()}.heapsnapshot`;
  const stream = fs.createWriteStream(fileName);
  v8.writeHeapSnapshot(stream);
  console.log(`Heap snapshot written to ${fileName}`);
}
```

#### Common Memory Leak Sources
1. **Event Listener Accumulation**
   ```typescript
   // Bad
   emitter.on('data', handler);
   
   // Good - cleanup
   emitter.on('data', handler);
   // Later...
   emitter.removeListener('data', handler);
   ```

2. **Unclosed Database Connections**
   ```typescript
   // Ensure cleanup
   class Service {
     async cleanup() {
       await this.db.destroy();
       await this.redis.quit();
     }
   }
   
   // Graceful shutdown
   process.on('SIGTERM', async () => {
     await service.cleanup();
     process.exit(0);
   });
   ```

3. **Large Object Caching**
   ```typescript
   // Implement LRU cache with size limits
   const cache = new LRUCache<string, any>({
     max: 500,
     maxSize: 50 * 1024 * 1024, // 50MB
     sizeCalculation: (value) => {
       return JSON.stringify(value).length;
     },
   });
   ```

## Debugging Techniques

### Remote Debugging

#### Node.js Inspector
```bash
# Start with inspector
node --inspect=0.0.0.0:9229 dist/index.js

# For Docker
docker run -p 9229:9229 crewai/team \
  node --inspect=0.0.0.0:9229 dist/index.js

# Connect via Chrome DevTools
chrome://inspect
```

#### VS Code Remote Debugging
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Remote",
      "address": "localhost",
      "port": 9229,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "protocol": "inspector"
    }
  ]
}
```

### Logging Best Practices

```typescript
// Structured logging with context
class ContextLogger {
  private context: Record<string, any> = {};
  
  setContext(key: string, value: any) {
    this.context[key] = value;
  }
  
  log(level: string, message: string, data?: any) {
    logger[level](message, {
      ...this.context,
      ...data,
      timestamp: new Date().toISOString(),
      pid: process.pid,
    });
  }
  
  // Request-scoped logger
  static forRequest(req: Request): ContextLogger {
    const logger = new ContextLogger();
    logger.setContext('requestId', req.id);
    logger.setContext('userId', req.user?.id);
    logger.setContext('path', req.path);
    logger.setContext('method', req.method);
    return logger;
  }
}
```

### Distributed Tracing

```typescript
// Trace async operations
import { AsyncLocalStorage } from 'async_hooks';

const traceStorage = new AsyncLocalStorage<TraceContext>();

export function withTrace<T>(
  traceId: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return traceStorage.run({ traceId, spans: [] }, fn);
}

export function addSpan(name: string, data?: any) {
  const context = traceStorage.getStore();
  if (context) {
    context.spans.push({
      name,
      timestamp: Date.now(),
      data,
    });
  }
}
```

## Performance Issues

### Slow API Responses

#### Diagnosis Tools
```bash
# API response time analysis
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/emails

# curl-format.txt:
time_namelookup:  %{time_namelookup}s\n
time_connect:  %{time_connect}s\n
time_appconnect:  %{time_appconnect}s\n
time_pretransfer:  %{time_pretransfer}s\n
time_redirect:  %{time_redirect}s\n
time_starttransfer:  %{time_starttransfer}s\n
time_total:  %{time_total}s\n
```

#### Performance Profiling
```typescript
// CPU profiling
import { performance, PerformanceObserver } from 'perf_hooks';

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    if (entry.duration > 100) {
      logger.warn('Slow operation detected', {
        name: entry.name,
        duration: entry.duration,
        type: entry.entryType,
      });
    }
  });
});

obs.observe({ entryTypes: ['measure', 'function'] });

// Measure operations
export function measurePerformance<T>(
  name: string,
  fn: () => T
): T {
  performance.mark(`${name}-start`);
  
  try {
    const result = fn();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    return result;
  } catch (error) {
    performance.mark(`${name}-error`);
    performance.measure(`${name}-error`, `${name}-start`, `${name}-error`);
    throw error;
  }
}
```

### Database Query Optimization

```sql
-- Identify slow queries
EXPLAIN ANALYZE
SELECT e.*, a.*
FROM emails e
JOIN email_analysis a ON e.id = a.email_id
WHERE e.workflow = 'technical_support'
ORDER BY e.received_at DESC
LIMIT 100;

-- Add missing indexes
CREATE INDEX idx_emails_workflow_received 
ON emails(workflow, received_at DESC);

CREATE INDEX idx_email_analysis_email_id 
ON email_analysis(email_id);

-- Analyze query performance
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%emails%'
ORDER BY mean_time DESC
LIMIT 10;
```

## Database Problems

### Connection Pool Exhaustion

#### Symptoms
```
Error: Connection pool timeout. Unable to acquire connection
```

#### Diagnosis
```typescript
// Monitor pool status
const poolStats = db.client.pool;
console.log({
  used: poolStats.numUsed(),
  free: poolStats.numFree(),
  pending: poolStats.numPendingCreates(),
  max: poolStats.max,
});
```

#### Solutions
```typescript
// 1. Increase pool size
const db = knex({
  client: 'pg',
  connection: DATABASE_URL,
  pool: {
    min: 2,
    max: 20, // Increased from 10
    acquireTimeoutMillis: 30000,
  },
});

// 2. Ensure proper connection release
async function queryWithRelease() {
  const connection = await db.client.acquire();
  
  try {
    return await connection.query('SELECT * FROM emails');
  } finally {
    db.client.release(connection);
  }
}

// 3. Implement connection retry
async function queryWithRetry(query: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await db.raw(query);
    } catch (error) {
      if (i === retries - 1) throw error;
      
      logger.warn(`Query retry ${i + 1}/${retries}`, { error });
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

### Database Locks

```sql
-- PostgreSQL: Find blocking queries
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity 
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;

-- Kill blocking query
SELECT pg_terminate_backend(pid);
```

## Network Issues

### DNS Resolution Problems

```bash
# Test DNS resolution
nslookup api.crewai.com
dig api.crewai.com

# Check /etc/resolv.conf
cat /etc/resolv.conf

# Test with specific DNS
dig @8.8.8.8 api.crewai.com

# Clear DNS cache
# macOS
sudo dscacheutil -flushcache

# Linux
sudo systemctl restart systemd-resolved
```

### SSL/TLS Issues

```bash
# Test SSL connection
openssl s_client -connect api.crewai.com:443 -servername api.crewai.com

# Check certificate
openssl s_client -connect api.crewai.com:443 < /dev/null | \
  openssl x509 -noout -dates

# Test with curl verbose
curl -v https://api.crewai.com/api/health

# Ignore cert issues (debug only!)
curl -k https://api.crewai.com/api/health
NODE_TLS_REJECT_UNAUTHORIZED=0 node app.js
```

### WebSocket Connection Issues

```javascript
// WebSocket debugging
const ws = new WebSocket('wss://api.crewai.com/ws');

ws.addEventListener('open', () => {
  console.log('Connected');
});

ws.addEventListener('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.addEventListener('close', (event) => {
  console.log('Disconnected:', {
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean,
  });
});

// Test with wscat
// npm install -g wscat
// wscat -c wss://api.crewai.com/ws
```

## Container/Kubernetes Issues

### Pod CrashLoopBackOff

```bash
# Get pod details
kubectl describe pod crewai-app-xyz -n crewai

# Check logs
kubectl logs crewai-app-xyz -n crewai --previous

# Check events
kubectl get events -n crewai --sort-by='.lastTimestamp'

# Interactive debugging
kubectl run debug --rm -it --image=alpine --restart=Never -- sh
```

### Image Pull Errors

```bash
# Check secret
kubectl get secret regcred -n crewai -o yaml

# Create new secret
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=pass \
  --docker-email=email@example.com \
  -n crewai

# Test pull manually
docker pull registry.example.com/crewai:latest
```

### Resource Constraints

```yaml
# Check resource usage
kubectl top pods -n crewai
kubectl top nodes

# Describe node
kubectl describe node node-1

# Check resource quotas
kubectl get resourcequota -n crewai
kubectl describe resourcequota compute-quota -n crewai

# Temporarily increase resources
kubectl set resources deployment crewai-app \
  --limits=cpu=2,memory=4Gi \
  --requests=cpu=1,memory=2Gi \
  -n crewai
```

## Application Errors

### Unhandled Promise Rejections

```typescript
// Global handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  
  // Graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  
  // Graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

### Memory Issues

```bash
# Node.js memory flags
node --max-old-space-size=4096 dist/index.js
node --expose-gc --max-old-space-size=4096 dist/index.js

# Monitor memory
ps aux | grep node
top -p $(pgrep -f "node dist/index.js")

# Force garbage collection (if --expose-gc)
if (global.gc) {
  setInterval(() => {
    global.gc();
    console.log('Manual GC triggered');
  }, 60000);
}
```

## Recovery Procedures

### Database Recovery

```bash
# PostgreSQL backup
pg_dump -h localhost -U crewai -d crewai > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U crewai -d crewai < backup_20250120.sql

# Point-in-time recovery
pg_basebackup -h localhost -D /backup/base -U replicator -P -Xs

# SQLite backup
sqlite3 crewai.db ".backup backup.db"

# Restore
cp backup.db crewai.db
```

### Redis Recovery

```bash
# Save snapshot
redis-cli BGSAVE

# Check save status
redis-cli LASTSAVE

# Restore from RDB
cp dump.rdb /var/lib/redis/
redis-server --dbfilename dump.rdb

# AOF recovery
redis-check-aof --fix appendonly.aof
```

### Application State Recovery

```typescript
// Implement circuit breaker
class CircuitBreaker {
  private failures = 0;
  private lastFailTime?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,
    private timeout = 60000
  ) {}
  
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime!.getTime() > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailTime = new Date();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.threshold,
      });
    }
  }
}
```

## Health Check Failures

### Debugging Health Checks

```typescript
// Detailed health check
app.get('/api/health/detailed', async (req, res) => {
  const checks = {
    api: 'healthy',
    database: 'unknown',
    redis: 'unknown',
    websocket: 'unknown',
  };
  
  // Check database
  try {
    await db.raw('SELECT 1');
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
    logger.error('Database health check failed', { error });
  }
  
  // Check Redis
  try {
    await redis.ping();
    checks.redis = 'healthy';
  } catch (error) {
    checks.redis = 'unhealthy';
    logger.error('Redis health check failed', { error });
  }
  
  // Check WebSocket
  try {
    const activeConnections = wsServer.clients.size;
    checks.websocket = activeConnections >= 0 ? 'healthy' : 'unhealthy';
  } catch (error) {
    checks.websocket = 'unhealthy';
    logger.error('WebSocket health check failed', { error });
  }
  
  const overallHealth = Object.values(checks).every(s => s === 'healthy')
    ? 'healthy'
    : 'unhealthy';
    
  res.status(overallHealth === 'healthy' ? 200 : 503).json({
    status: overallHealth,
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

### Kubernetes Probe Configuration

```yaml
# Proper probe configuration
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30  # Give app time to start
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  successThreshold: 1
  failureThreshold: 3

startupProbe:  # For slow starting containers
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 0
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 30  # 5 minutes to start
```

## Emergency Procedures

### System Overload

```bash
# 1. Enable maintenance mode
kubectl set env deployment/crewai-app MAINTENANCE_MODE=true -n crewai

# 2. Scale down non-critical services
kubectl scale deployment/crewai-worker --replicas=0 -n crewai

# 3. Increase resources
kubectl set resources deployment/crewai-app \
  --limits=cpu=4,memory=8Gi -n crewai

# 4. Clear caches
redis-cli FLUSHDB

# 5. Restart with increased capacity
kubectl rollout restart deployment/crewai-app -n crewai
```

### Data Corruption

```typescript
// Data validation and recovery
class DataIntegrityChecker {
  async validateEmails() {
    const corrupted = [];
    
    const emails = await db.query('SELECT * FROM emails');
    
    for (const email of emails) {
      try {
        // Validate required fields
        if (!email.id || !email.from || !email.received_at) {
          corrupted.push({ id: email.id, reason: 'missing_required_fields' });
        }
        
        // Validate JSON fields
        if (email.headers) {
          JSON.parse(email.headers);
        }
        
        // Validate relationships
        const analysis = await db.query(
          'SELECT * FROM email_analysis WHERE email_id = ?',
          [email.id]
        );
        
        if (analysis.length === 0) {
          corrupted.push({ id: email.id, reason: 'missing_analysis' });
        }
      } catch (error) {
        corrupted.push({ id: email.id, reason: error.message });
      }
    }
    
    return corrupted;
  }
  
  async repairData(corrupted: any[]) {
    for (const item of corrupted) {
      try {
        switch (item.reason) {
          case 'missing_analysis':
            // Re-analyze email
            await this.reanalyzeEmail(item.id);
            break;
            
          case 'missing_required_fields':
            // Attempt to recover from backups
            await this.recoverFromBackup(item.id);
            break;
            
          default:
            logger.error('Unable to repair', item);
        }
      } catch (error) {
        logger.error('Repair failed', { item, error });
      }
    }
  }
}
```

### Complete System Recovery

```bash
#!/bin/bash
# disaster-recovery.sh

set -e

echo "Starting disaster recovery..."

# 1. Stop all services
kubectl scale deployment --all --replicas=0 -n crewai

# 2. Restore database from backup
echo "Restoring database..."
kubectl exec -it postgres-0 -n crewai -- \
  psql -U crewai -d crewai < /backup/latest.sql

# 3. Restore Redis data
echo "Restoring Redis..."
kubectl exec -it redis-0 -n crewai -- \
  redis-cli --rdb /backup/redis-latest.rdb

# 4. Restore application data
echo "Restoring application data..."
kubectl cp backup/app-data.tar.gz crewai-app-0:/tmp/
kubectl exec -it crewai-app-0 -n crewai -- \
  tar -xzf /tmp/app-data.tar.gz -C /app/data

# 5. Verify data integrity
echo "Verifying data..."
kubectl exec -it crewai-app-0 -n crewai -- \
  node scripts/verify-data.js

# 6. Start services gradually
echo "Starting services..."
kubectl scale deployment/crewai-app --replicas=1 -n crewai
sleep 30

# 7. Health check
if kubectl exec -it crewai-app-0 -n crewai -- \
   curl -f http://localhost:3000/api/health; then
  echo "Health check passed"
  
  # Scale to normal
  kubectl scale deployment/crewai-app --replicas=3 -n crewai
  kubectl scale deployment/crewai-worker --replicas=2 -n crewai
else
  echo "Health check failed!"
  exit 1
fi

echo "Recovery completed successfully"
```

## Best Practices

1. **Always have backups**: Test restore procedures regularly
2. **Monitor proactively**: Set up alerts before issues occur
3. **Document everything**: Keep runbooks updated
4. **Practice recovery**: Run disaster recovery drills
5. **Use health checks**: Implement comprehensive health endpoints
6. **Enable debug logging**: When troubleshooting issues
7. **Collect metrics**: Historical data helps diagnose issues
8. **Implement timeouts**: Prevent cascading failures
9. **Use circuit breakers**: Protect against downstream failures
10. **Keep dependencies updated**: Security and bug fixes

## Quick Reference

### Essential Commands

```bash
# Docker
docker logs <container> --tail=100 -f
docker exec -it <container> sh
docker stats <container>

# Kubernetes
kubectl logs <pod> -n <namespace> --tail=100 -f
kubectl exec -it <pod> -n <namespace> -- sh
kubectl describe pod <pod> -n <namespace>
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Database
psql -h localhost -U user -d database
redis-cli ping
redis-cli monitor

# Network
curl -v http://localhost:3000/api/health
netstat -tulpn | grep LISTEN
ss -tulpn | grep LISTEN

# Process
ps aux | grep node
top -p $(pgrep -f "node dist/index.js")
lsof -p <pid>
```

### Emergency Contacts

- On-call Engineer: +1-xxx-xxx-xxxx
- Database Admin: dba@crewai.com
- Security Team: security@crewai.com
- Cloud Support: [Provider specific]

Remember: Stay calm, gather information, and follow the runbooks!