# Memory Management and Garbage Collection System

## Overview

This document describes the comprehensive memory management and garbage collection system implemented for the Walmart Grocery Agent microservices architecture. The system ensures stable operation under load by enforcing memory limits, detecting leaks, and providing automatic recovery mechanisms.

## Service Memory Allocations

| Service | Memory Limit | Warning @ | Critical @ | Description |
|---------|-------------|-----------|------------|-------------|
| Cache Warmer | 256MB | 200MB (78%) | 218MB (85%) | Background cache warming operations |
| Pricing Service | 512MB | 400MB (78%) | 435MB (85%) | Walmart API data processing |
| NLP Queue | 384MB | 300MB (78%) | 326MB (85%) | Ollama request buffering |
| API Server | 1GB | 800MB (78%) | 870MB (85%) | Main application server |
| WebSocket Gateway | 512MB | 400MB (78%) | 435MB (85%) | Real-time connection handling |

## Architecture Components

### 1. MemoryManager (`src/monitoring/MemoryManager.ts`)

Core memory management for individual services:

```typescript
const memoryManager = MemoryManager.getInstance({
  service: 'api-server',
  maxHeapSize: 1024,
  warningThreshold: 0.7,
  criticalThreshold: 0.85,
  gcInterval: 60000,
  heapSnapshotOnCritical: true,
  enableAutoGC: true,
  restartOnOOM: true,
  maxRestarts: 3,
  restartCooldown: 300000
});
```

**Features:**
- Real-time memory monitoring
- Automatic garbage collection
- Memory leak detection
- Heap snapshot generation
- Object pooling support
- Weak reference management
- Graceful degradation

### 2. MemoryMonitoringService (`src/monitoring/MemoryMonitoringService.ts`)

Centralized monitoring across all services:

```typescript
const monitor = MemoryMonitoringService.getInstance();
await monitor.start(3007);
```

**Features:**
- Multi-service coordination
- Alert rule engine
- WebSocket real-time updates
- Memory reports and analytics
- Service restart orchestration
- Redis metrics storage

### 3. Systemd Service Configurations

Each service has a dedicated systemd unit file with memory limits:

```ini
[Service]
MemoryMax=512M        # Hard limit
MemoryHigh=400M       # Soft limit (throttling starts)
MemoryLow=200M        # Memory protection threshold
MemorySwapMax=128M    # Swap limit

Environment="NODE_OPTIONS=--max-old-space-size=512 --expose-gc"
```

## Memory Management Strategies

### 1. Object Pooling

Reuse frequently created objects to reduce GC pressure:

```typescript
const pool = memoryManager.createObjectPool(
  'request-pool',
  () => ({ id: 0, data: Buffer.alloc(1024) }),
  (obj) => { obj.id = 0; obj.data.fill(0); },
  100 // max pool size
);

// Usage
const obj = pool.acquire();
// ... use object ...
pool.release(obj);
```

### 2. Weak References

For cache entries that can be garbage collected:

```typescript
const weakRef = memoryManager.createWeakRef('cache-key', largeObject);

// Later...
const obj = memoryManager.getWeakRef('cache-key');
if (obj) {
  // Object still in memory
} else {
  // Object was garbage collected
}
```

### 3. Stream Processing

Avoid buffering large datasets:

```typescript
// Bad - loads entire dataset
const data = await database.query('SELECT * FROM large_table');

// Good - streams data
const stream = database.queryStream('SELECT * FROM large_table');
stream.on('data', (row) => {
  // Process row immediately
});
```

### 4. Connection Pooling

Limit concurrent connections:

```typescript
const pool = new Pool({
  max: 20,         // Maximum connections
  min: 5,          // Minimum connections
  idleTimeout: 30000,
  acquireTimeout: 5000
});
```

## Leak Detection

The system automatically detects memory leaks by tracking heap growth:

```typescript
// Automatic detection every 10 seconds
// Alerts triggered if growth > 5MB/minute for 10+ samples

// Manual leak check
const leakResult = memoryManager.checkForLeaks();
if (leakResult.suspected) {
  console.log(`Leak detected: ${leakResult.growthRate}MB/min`);
}
```

## Monitoring and Alerts

### Alert Rules

```typescript
{
  id: 'memory-critical',
  service: '*',
  metric: 'memory',
  threshold: 0.85,
  severity: 'critical',
  action: 'restart',
  cooldown: 600000
}
```

### Available Actions

- **log**: Log the alert
- **notify**: Send notification (email/webhook)
- **restart**: Restart the service
- **scale**: Request horizontal scaling

### Monitoring Endpoints

- `GET /health` - Service health status
- `GET /metrics` - All service metrics
- `GET /metrics/:service` - Service-specific metrics
- `GET /alerts` - Active alerts
- `GET /report` - Memory usage report
- `POST /gc/:service` - Force garbage collection
- `POST /snapshot/:service` - Take heap snapshot

## Best Practices

### 1. Proper Cleanup

Always clean up resources:

```typescript
class Service {
  private intervals: NodeJS.Timeout[] = [];
  private connections: Connection[] = [];
  
  async shutdown() {
    // Clear intervals
    this.intervals.forEach(i => clearInterval(i));
    
    // Close connections
    await Promise.all(
      this.connections.map(c => c.close())
    );
    
    // Clear arrays
    this.intervals = [];
    this.connections = [];
  }
}
```

### 2. Event Listener Management

Prevent memory leaks from event listeners:

```typescript
class Component {
  private listeners = new Map<string, Function>();
  
  addListener(event: string, handler: Function) {
    // Remove old listener if exists
    this.removeListener(event);
    
    this.listeners.set(event, handler);
    emitter.on(event, handler);
  }
  
  removeListener(event: string) {
    const handler = this.listeners.get(event);
    if (handler) {
      emitter.off(event, handler);
      this.listeners.delete(event);
    }
  }
  
  cleanup() {
    // Remove all listeners
    for (const [event, handler] of this.listeners) {
      emitter.off(event, handler);
    }
    this.listeners.clear();
  }
}
```

### 3. Request/Response Size Limits

```typescript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Stream large responses
app.get('/large-data', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  const stream = createReadStream('large-file.json');
  stream.pipe(res);
});
```

### 4. Caching Strategy

Use appropriate cache sizes and TTLs:

```typescript
const cache = new LRUCache<string, any>({
  max: 500,              // Maximum items
  maxSize: 50 * 1024 * 1024, // 50MB total size
  sizeCalculation: (value) => JSON.stringify(value).length,
  ttl: 1000 * 60 * 5,    // 5 minute TTL
  dispose: (value, key) => {
    // Cleanup on eviction
    if (value.cleanup) value.cleanup();
  }
});
```

## Testing

Run the memory management test suite:

```bash
npm run test:memory

# Or directly
npx tsx scripts/test-memory-management.ts
```

Test scenarios:
- Memory limit enforcement
- Garbage collection efficiency
- Object pool management
- Leak detection accuracy
- Recovery mechanisms
- Alert system
- Service coordination

## Deployment

### 1. Install systemd services

```bash
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 2. Enable services

```bash
sudo systemctl enable walmart-cache-warmer
sudo systemctl enable walmart-pricing
sudo systemctl enable walmart-nlp-queue
sudo systemctl enable walmart-api-server
sudo systemctl enable walmart-websocket
```

### 3. Start services

```bash
sudo systemctl start walmart-api-server
# Other services will start as dependencies
```

### 4. Monitor services

```bash
# Check status
sudo systemctl status walmart-*

# View logs
sudo journalctl -u walmart-api-server -f

# Monitor memory usage
sudo systemctl show walmart-api-server --property=MemoryCurrent
```

## Troubleshooting

### High Memory Usage

1. Check for memory leaks:
```bash
curl -X POST http://localhost:3007/snapshot/api-server \
  -H "Content-Type: application/json" \
  -d '{"reason": "high-memory"}'
```

2. Analyze heap snapshot:
```bash
# Use Chrome DevTools or heapdump module
npx heapdump-viewer memory-snapshots/api-server-*.heapsnapshot
```

3. Force garbage collection:
```bash
curl -X POST http://localhost:3007/gc/api-server
```

### Service Crashes

1. Check systemd logs:
```bash
sudo journalctl -u walmart-api-server --since "1 hour ago"
```

2. Check OOM killer:
```bash
dmesg | grep -i "killed process"
```

3. Adjust memory limits if needed:
```bash
sudo systemctl edit walmart-api-server
# Add:
# [Service]
# MemoryMax=1500M
```

### Memory Leak Detection

1. Monitor growth rate:
```bash
watch -n 5 'curl -s http://localhost:3007/metrics/api-server | jq .statistics'
```

2. Check alerts:
```bash
curl http://localhost:3007/alerts | jq '.[] | select(.severity == "critical")'
```

3. Generate report:
```bash
curl http://localhost:3007/report > memory-report.json
```

## Performance Tuning

### Node.js Flags

```bash
# Recommended flags for production
NODE_OPTIONS="
  --max-old-space-size=1024  # Heap size in MB
  --expose-gc                 # Allow manual GC
  --gc-interval=100          # GC frequency
  --optimize-for-size        # Optimize for memory
  --always-compact           # Aggressive compaction
  --trace-gc                 # Log GC events (debugging)
"
```

### Systemd Tuning

```ini
# Aggressive memory management
[Service]
MemoryMax=1G
MemoryHigh=800M
MemoryLow=400M
MemorySwapMax=0  # Disable swap for predictable performance

# CPU limits
CPUQuota=100%
CPUWeight=200

# OOM handling
OOMScoreAdjust=-500  # Less likely to be killed
OOMPolicy=continue   # Don't kill dependent services
```

### Redis Configuration

```redis
# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence (reduce memory overhead)
save ""
appendonly no
```

## Monitoring Dashboard

Access the memory monitoring dashboard:

```
http://localhost:3007
```

WebSocket endpoint for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3007/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  
  switch (event.type) {
    case 'metrics':
      updateMetricsChart(event.data);
      break;
    case 'alert':
      showAlert(event.data);
      break;
    case 'service-update':
      updateServiceStatus(event.data);
      break;
  }
});
```

## Conclusion

This memory management system provides:

1. **Predictable Performance**: Services operate within defined memory limits
2. **Automatic Recovery**: Self-healing from memory pressure situations
3. **Early Detection**: Proactive leak detection and alerting
4. **Observability**: Comprehensive monitoring and reporting
5. **Resilience**: Graceful degradation under load

Regular monitoring and tuning based on production metrics will ensure optimal performance and stability of the Walmart Grocery Agent microservices.