# Walmart Grocery Agent - Load Testing Suite

## Overview

Comprehensive load testing suite for the Walmart Grocery Agent microservices architecture. This suite tests all six microservices under various load conditions to identify performance bottlenecks, validate scalability, and ensure system reliability.

## Test Scenarios

### 1. **Baseline Test**
- Single user performance baseline
- Measures optimal response times
- Establishes performance benchmarks

### 2. **Concurrent Users Test**
- Tests with 10, 50, 100, 500 concurrent users
- Validates system behavior under normal load
- Identifies concurrency limits

### 3. **Mixed Workload Test**
- 60% read operations
- 30% write operations  
- 10% complex operations
- Simulates realistic usage patterns

### 4. **Sustained Load Test**
- Constant load for extended periods (5, 15, 30 minutes)
- Identifies memory leaks
- Validates stability

### 5. **Spike Test**
- Sudden traffic increases (10x normal)
- Tests auto-scaling capabilities
- Validates circuit breaker behavior

### 6. **Stress Test**
- Gradually increase load until failure
- Identifies breaking points
- Measures maximum capacity

### 7. **Soak Test**
- Extended duration (1+ hours)
- Detects memory leaks
- Validates long-term stability

### 8. **Chaos Engineering Test**
- Service failures and recovery
- Network latency injection
- Resource exhaustion scenarios
- Database connection failures

## Quick Start

### Prerequisites

```bash
# Ensure all services are running
sudo systemctl status grocery-*.service

# Ensure Redis is running
sudo systemctl status redis

# Ensure database is initialized
ls -la /home/pricepro2006/CrewAI_Team/data/grocery.db
```

### Running Tests

```bash
# Run quick smoke test
./run-load-tests.sh quick

# Run standard test suite
./run-load-tests.sh standard

# Run comprehensive tests
./run-load-tests.sh comprehensive

# Run specific test
tsx grocery-load-test.ts baseline
```

### Available Test Profiles

- **baseline**: Single test scenario only
- **quick**: Smoke test + baseline
- **standard**: Common load patterns
- **comprehensive**: Full test suite (recommended)
- **extended**: Includes soak testing
- **chaos**: Failure injection tests
- **all**: Every test scenario

## Architecture

```
Load Test Client
    ↓
Nginx (grocery.local)
    ↓
Service Discovery
    ↓
┌─────────────────────────────────────────┐
│  Microservices                          │
├──────────────┬──────────────┬──────────┤
│ NLP Service  │ Pricing      │ Matching │
│ Port: 3001   │ Port: 3002   │ Port: 3003│
├──────────────┼──────────────┼──────────┤
│ Cache        │ Queue        │ Analytics│
│ Port: 3004   │ Port: 3005   │ Port: 3006│
└──────────────┴──────────────┴──────────┘
         ↓              ↓             ↓
    [SQLite]       [Redis]       [Ollama]
```

## Performance Targets

### Response Time SLAs
- P50: < 200ms
- P90: < 400ms  
- P95: < 500ms
- P99: < 1000ms

### Throughput Requirements
- Minimum: 100 req/s
- Target: 500 req/s
- Peak: 1000 req/s

### Error Rate Thresholds
- Acceptable: < 1%
- Warning: < 5%
- Critical: < 10%

### Resource Limits
- CPU: < 70% sustained
- Memory: < 80% peak
- Network: < 100 Mbps

## Metrics Collection

### Real-time Monitoring
```bash
# Start monitoring dashboard
tsx monitor-dashboard.ts
```

### Prometheus Metrics
- `http_requests_total`: Total request count
- `http_request_duration_seconds`: Response time histogram
- `http_errors_total`: Error count
- `process_cpu_percent`: CPU usage
- `process_memory_bytes`: Memory usage

### Custom Metrics
- `nlp_processing_time`: Natural language processing duration
- `price_comparison_time`: Price lookup duration
- `cache_hit_rate`: Cache effectiveness
- `queue_depth`: Message queue backlog
- `circuit_breaker_trips`: Failure protection triggers

## Test Data

### Sample Grocery Lists
```javascript
// Simple list
"milk, eggs, bread"

// Complex list with quantities
"2 pounds of chicken breast, 1 gallon of milk, organic vegetables"

// Price-sensitive queries
"cheapest pasta and sauce for under $10"
```

### Load Patterns

#### Morning Rush (7-9 AM)
```
Users: 50 → 200 → 400 → 200 → 50
Duration: 2 hours
Pattern: Gradual ramp-up and down
```

#### Flash Sale
```
Users: 50 → 800 (spike) → 600 → 400 → 200 → 50
Duration: 30 minutes
Pattern: Sudden spike with gradual decrease
```

#### Weekend Pattern
```
Users: Variable 100-400
Duration: 8 hours
Pattern: Multiple peaks throughout day
```

## Results Analysis

### Automated Analysis
```bash
# Analyze latest results
tsx analyze-results.ts ./results/latest

# Analyze specific test run
tsx analyze-results.ts ./results/20240101_120000
```

### Report Contents
- Performance grade (A-F)
- Health score (0-100)
- Critical issues
- Warnings
- Recommendations
- Detailed metrics

### Key Metrics Analyzed
1. **Response Time Percentiles**
   - Distribution analysis
   - Outlier detection
   - Trend analysis

2. **Error Patterns**
   - Error rate by service
   - Error types
   - Recovery time

3. **Scalability Curve**
   - Throughput vs concurrency
   - Response time degradation
   - Optimal operating point

4. **Resource Utilization**
   - CPU usage patterns
   - Memory growth
   - Network I/O

5. **Bottleneck Identification**
   - Database queries
   - LLM inference
   - Network connections
   - Cache misses

## Troubleshooting

### Common Issues

#### Services Not Responding
```bash
# Check service status
sudo systemctl status grocery-*.service

# Check logs
sudo journalctl -u grocery-nlp.service -n 100

# Restart services
sudo systemctl restart grocery-*.service
```

#### High Error Rates
```bash
# Check database connections
sqlite3 /home/pricepro2006/CrewAI_Team/data/grocery.db "SELECT COUNT(*) FROM sqlite_master;"

# Check Redis
redis-cli ping

# Check Ollama
curl http://localhost:11434/api/tags
```

#### Memory Issues
```bash
# Check memory usage
free -h

# Find memory-hungry processes
ps aux --sort=-%mem | head

# Clear caches
sync && echo 3 > /proc/sys/vm/drop_caches
```

## Performance Optimization Recommendations

### Database Optimizations
- Add indexes for frequently queried columns
- Implement connection pooling
- Use prepared statements
- Enable query result caching

### Caching Strategy
- Redis for session data (TTL: 1 hour)
- In-memory cache for hot data (TTL: 5 minutes)
- CDN for static assets
- Browser cache headers

### Service Optimizations
- Implement request batching
- Add circuit breakers (threshold: 50% error rate)
- Configure retry logic (max 3 attempts)
- Use connection pooling

### LLM Optimizations
- Cache common NLP responses
- Use smaller models for simple tasks
- Batch inference requests
- Implement response streaming

### Infrastructure Scaling
- Horizontal scaling for stateless services
- Read replicas for database
- Redis cluster for cache
- Load balancer with health checks

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Load Tests
  run: |
    ./run-load-tests.sh standard
    tsx analyze-results.ts ./results/latest
    
- name: Check Performance
  run: |
    grade=$(cat ./results/latest/analysis-report.json | jq -r '.performanceGrade')
    if [ "$grade" \< "C" ]; then
      echo "Performance grade $grade is below threshold"
      exit 1
    fi
```

### Performance Gates
- Block deployment if performance degrades >20%
- Require performance tests for major changes
- Track metrics over time
- Alert on regression

## Best Practices

1. **Run tests regularly** - Daily in staging, weekly in production
2. **Test after changes** - Any code or config modifications
3. **Monitor trends** - Track performance over time
4. **Simulate reality** - Use production-like data and patterns
5. **Document findings** - Keep records of all test results
6. **Act on results** - Fix issues before they reach production

## Support

For issues or questions about load testing:
1. Check service logs: `sudo journalctl -u grocery-*.service`
2. Review test logs: `./results/latest/*.log`
3. Analyze metrics: `tsx analyze-results.ts`
4. Contact DevOps team for infrastructure issues