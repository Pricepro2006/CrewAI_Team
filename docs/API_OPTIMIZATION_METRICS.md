# Optimization Metrics API Documentation

## Overview
The Optimization Metrics API provides real-time insights into the performance of the OptimizedQueryExecutor and CachedLLMProvider components. These endpoints expose cache hit rates, query performance, and optimization recommendations.

## Base URL
```
http://localhost:3001/api/optimization
```

## Endpoints

### 1. Database Optimization Metrics
**GET** `/api/optimization/database/metrics`

Returns comprehensive metrics for OptimizedQueryExecutor instances across all databases.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-08-17T23:30:00.000Z",
  "databases": {
    "main": {
      "cacheHits": 1523,
      "cacheMisses": 287,
      "totalQueries": 1810,
      "cacheSize": 89,
      "avgQueryTime": 2.3,
      "preparedStatements": 45,
      "preparedReused": 412
    },
    "walmart": {
      "cacheHits": 892,
      "cacheMisses": 108,
      "totalQueries": 1000,
      "cacheSize": 56,
      "avgQueryTime": 1.8
    }
  },
  "summary": {
    "totalCacheHits": 2415,
    "totalCacheMisses": 395,
    "totalQueries": 2810,
    "avgCacheHitRate": 85.9,
    "totalMemoryUsage": 145
  }
}
```

### 2. Database Cache Statistics
**GET** `/api/optimization/database/cache`

Returns detailed cache statistics for the main database.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-08-17T23:30:00.000Z",
  "cache": {
    "size": 89,
    "hits": 1523,
    "misses": 287,
    "hitRate": 84.1,
    "evictions": 12,
    "memoryUsage": 524288,
    "entries": 89,
    "maxSize": 1000
  },
  "prepared": {
    "count": 45,
    "reused": 412,
    "reuseRate": 91.6
  }
}
```

### 3. Clear Database Cache
**POST** `/api/optimization/database/cache/clear`

Clears the query result cache for all databases.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-08-17T23:30:00.000Z",
  "message": "Query cache cleared successfully",
  "before": {
    "cacheSize": 89,
    "cacheHits": 1523,
    "cacheMisses": 287
  },
  "after": {
    "cacheSize": 0,
    "cacheHits": 0,
    "cacheMisses": 0
  }
}
```

### 4. LLM Provider Metrics
**GET** `/api/optimization/llm/metrics`

Returns CachedLLMProvider performance metrics.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-08-17T23:30:00.000Z",
  "llm": {
    "cacheHits": 234,
    "cacheMisses": 456,
    "totalRequests": 690,
    "cacheSize": 234,
    "totalLatency": 345000,
    "errors": 3,
    "deduplicatedRequests": 45,
    "hitRate": 33.9,
    "avgLatency": 500,
    "deduplicationRate": 6.5
  }
}
```

### 5. LLM Cache Statistics
**GET** `/api/optimization/llm/cache`

Returns detailed LLM cache statistics.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-08-17T23:30:00.000Z",
  "cache": {
    "size": 234,
    "maxSize": 500,
    "hits": 234,
    "misses": 456,
    "hitRate": 33.9,
    "evictions": 23,
    "memoryUsage": 2097152,
    "ttl": 3600000,
    "oldestEntry": "2025-08-17T22:30:00.000Z",
    "newestEntry": "2025-08-17T23:29:00.000Z"
  },
  "deduplication": {
    "active": 45,
    "saved": 45,
    "rate": 6.5
  }
}
```

### 6. Clear LLM Cache
**POST** `/api/optimization/llm/cache/clear`

Clears the LLM response cache.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-08-17T23:30:00.000Z",
  "message": "LLM cache cleared successfully",
  "before": {
    "cacheSize": 234,
    "cacheHits": 234,
    "cacheMisses": 456
  },
  "after": {
    "cacheSize": 0,
    "cacheHits": 0,
    "cacheMisses": 0
  }
}
```

### 7. Optimization Summary
**GET** `/api/optimization/summary`

Returns a consolidated summary of all optimization metrics.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-08-17T23:30:00.000Z",
  "optimization": {
    "database": {
      "cacheHitRate": 84.1,
      "totalQueries": 1810,
      "avgQueryTime": 2.3,
      "cacheMemory": 89
    },
    "llm": {
      "cacheHitRate": 33.9,
      "totalRequests": 690,
      "avgLatency": 500,
      "cacheMemory": 234
    },
    "overall": {
      "totalCacheHits": 1757,
      "totalCacheMisses": 743,
      "totalOperations": 2500,
      "avgCacheHitRate": 70.3,
      "totalMemoryUsage": 323
    }
  }
}
```

### 8. Optimization Recommendations
**GET** `/api/optimization/recommendations`

Provides actionable recommendations based on current metrics.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-08-17T23:30:00.000Z",
  "recommendations": [
    {
      "type": "database",
      "severity": "medium",
      "message": "Database cache hit rate is low (45.2%). Consider increasing cache size or TTL."
    },
    {
      "type": "llm",
      "severity": "low", 
      "message": "LLM cache hit rate is low (33.9%). This is normal for diverse queries."
    },
    {
      "type": "memory",
      "severity": "info",
      "message": "Cache memory usage is optimal (323KB)."
    }
  ],
  "metrics": {
    "database": {
      "hitRate": 84.1,
      "avgQueryTime": 2.3
    },
    "llm": {
      "hitRate": 33.9,
      "errorRate": 0.4
    },
    "memory": {
      "totalUsage": 331776,
      "totalUsageMB": 0.32
    }
  }
}
```

## Integration Guide

### Monitoring Dashboard Integration
```javascript
// Fetch optimization metrics every 30 seconds
setInterval(async () => {
  const response = await fetch('/api/optimization/summary');
  const data = await response.json();
  updateDashboard(data.optimization);
}, 30000);
```

### Performance Alerts
```javascript
// Check for performance issues
async function checkOptimizationHealth() {
  const response = await fetch('/api/optimization/recommendations');
  const data = await response.json();
  
  const criticalIssues = data.recommendations.filter(
    r => r.severity === 'high'
  );
  
  if (criticalIssues.length > 0) {
    sendAlert('Critical optimization issues detected', criticalIssues);
  }
}
```

### Cache Management
```javascript
// Clear caches when memory usage is high
async function manageCaches() {
  const summary = await fetch('/api/optimization/summary').then(r => r.json());
  
  if (summary.optimization.overall.totalMemoryUsage > 100 * 1024 * 1024) {
    // Clear LLM cache first (less critical)
    await fetch('/api/optimization/llm/cache/clear', { method: 'POST' });
    
    // If still high, clear database cache
    if (summary.optimization.database.cacheMemory > 50 * 1024 * 1024) {
      await fetch('/api/optimization/database/cache/clear', { method: 'POST' });
    }
  }
}
```

## Performance Benchmarks

### Expected Cache Hit Rates
- **Database Cache**: 70-90% (typical for repeated queries)
- **LLM Cache**: 20-40% (varies with query diversity)
- **Prepared Statements**: 80-95% reuse rate

### Query Performance Targets
- **Cached Query**: < 1ms
- **Non-cached Query**: < 10ms for simple, < 100ms for complex
- **LLM Cached Response**: < 5ms
- **LLM Non-cached Response**: 200-2000ms (depends on model)

### Memory Usage Guidelines
- **Database Cache**: 10-100MB for typical usage
- **LLM Cache**: 50-500MB depending on response sizes
- **Total Optimization Memory**: < 1GB recommended

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details if available"
}
```

HTTP Status Codes:
- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters
- `500 Internal Server Error`: Server-side error

## Security Considerations

1. **Authentication**: These endpoints should be protected with authentication in production
2. **Rate Limiting**: Apply rate limits to prevent abuse
3. **PII Protection**: Cache keys are hashed with SHA-256 to prevent PII exposure
4. **Access Control**: Only administrators should access cache clearing endpoints

## Deployment Notes

1. **Environment Variables**:
   ```bash
   OPTIMIZATION_CACHE_SIZE=1000
   OPTIMIZATION_CACHE_TTL=3600000
   OPTIMIZATION_ENABLE_METRICS=true
   ```

2. **Monitoring Integration**:
   - Prometheus endpoint: `/api/metrics`
   - Grafana dashboard: Available at `/api/metrics/grafana`

3. **Performance Impact**:
   - Metrics collection adds < 0.1ms overhead
   - Cache operations are O(1) for lookup
   - Memory overhead: ~1KB per cached entry

## Version History
- **v1.0.0** (2025-08-17): Initial release with OptimizedQueryExecutor and CachedLLMProvider metrics