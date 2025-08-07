# Redis Caching Layer for CrewAI Team

## Overview

This comprehensive Redis caching system provides high-performance caching across all major components of the CrewAI Team application. The system is designed to reduce database load by 70% and improve API response times by 50% through intelligent caching strategies.

## Architecture

The caching system is built around several key components:

### 1. Core Cache Manager (`RedisCacheManager`)
- Centralized Redis cache management with connection pooling
- Cache-aside pattern with TTL management
- Distributed cache invalidation strategies
- Compression for large values
- Circuit breaker for Redis failures
- Performance metrics and monitoring

### 2. Database Query Caching (`CachedEmailRepository`)
- Wraps the EmailRepository with intelligent caching
- Caches frequently accessed email queries
- Bulk email operations with cache optimization
- Smart TTL management based on data type
- Automatic cache invalidation on data changes

### 3. LLM Response Caching (`LLMResponseCache`)
- Caches Ollama API responses with semantic similarity
- Prompt-based cache keys with normalization
- Email analysis results caching
- Workflow and phase analysis data caching
- Context-aware TTL management

### 4. Session and User Caching (`SessionUserCache`)
- Redis-based session storage with automatic expiry
- User authentication data caching
- User preferences and settings caching
- Session activity tracking
- Distributed session management

### 5. WebSocket Caching (`WebSocketCache`)
- WebSocket connection state caching
- Real-time data caching for WebSocket events
- Connection pool management
- User presence tracking
- Room/channel subscription caching

### 6. Cache Monitoring (`CacheMonitor`)
- Real-time performance monitoring
- Health checks and alerting
- Cache warming strategies
- Memory usage tracking
- Performance optimization recommendations

## Key Features

### Performance Optimizations
- **Smart TTL Management**: Different TTL values based on data characteristics
- **Compression**: Automatic compression for large values (>1KB)
- **Bulk Operations**: Optimized multi-get/set operations
- **Connection Pooling**: Efficient Redis connection management
- **Circuit Breaker**: Graceful degradation when Redis is unavailable

### Cache Invalidation
- **Tag-based Invalidation**: Group related cache entries with tags
- **Pattern-based Invalidation**: Wildcard pattern matching
- **Automatic Invalidation**: Smart invalidation on data mutations
- **Manual Invalidation**: Programmatic cache clearing

### Monitoring & Alerting
- **Real-time Metrics**: Hit rates, response times, memory usage
- **Health Checks**: Automated system health monitoring
- **Alerting**: Configurable alerts for performance issues
- **Performance Reports**: Detailed analytics and recommendations

### Cache Warming
- **Scheduled Warming**: Automated cache pre-loading
- **Startup Warming**: Essential data pre-loading on startup
- **Priority-based Warming**: High-priority data loaded first
- **Custom Warming Jobs**: Application-specific warming strategies

## Installation & Setup

### 1. Prerequisites
- Redis server (version 6.0+)
- Node.js with ioredis package
- Existing CrewAI Team application

### 2. Configuration

Update your environment variables:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
REDIS_TLS_ENABLED=false
```

### 3. Application Integration

Add to your main application startup:

```typescript
import { startupCacheSystem } from './src/config/cache-startup.js';

async function startApp() {
  // Initialize caching system
  await startupCacheSystem();
  
  // Continue with app initialization
  // ...
}
```

## Usage Examples

### Database Caching

```typescript
import { CachedEmailRepository } from './src/database/repositories/CachedEmailRepository.js';

// Create cached repository
const emailRepo = new CachedEmailRepository({ db });

// Queries are automatically cached
const emails = await emailRepo.queryEmails({
  statuses: ['new', 'in_progress'],
  limit: 50
});

// Warm cache with recent data
await emailRepo.warmCache({
  recentDays: 7,
  priorityEmails: true
});
```

### LLM Response Caching

```typescript
import { llmCache } from './src/core/cache/LLMResponseCache.js';

// Check for cached response
const cached = await llmCache.getCachedLLMResponse(
  prompt, 
  'llama3.2:3b',
  { enableSemanticMatching: true }
);

if (!cached) {
  // Perform LLM analysis
  const response = await performLLMAnalysis(prompt);
  
  // Cache the response
  await llmCache.cacheLLMResponse(prompt, response, 'llama3.2:3b');
}
```

### Session Management

```typescript
import { sessionUserCache } from './src/core/cache/SessionUserCache.js';

// Create session
const sessionId = await sessionUserCache.createSession(
  userId, 
  userEmail,
  { maxAge: 86400, slidingExpiration: true }
);

// Validate session
const session = await sessionUserCache.getSession(sessionId);
```

### tRPC Integration

```typescript
import { createCacheMiddleware } from './src/api/middleware/cacheMiddleware.js';

const cacheMiddleware = createCacheMiddleware({
  namespace: 'api',
  defaultTTL: 900,
  enableCompression: true
});

// Use in tRPC router
export const emailRouter = router({
  getEmails: procedure
    .use(cacheMiddleware)
    .input(emailQuerySchema)
    .query(async ({ input }) => {
      return await emailService.getEmails(input);
    })
});
```

## Performance Metrics

### Expected Performance Improvements
- **Database Load Reduction**: 70% reduction in database queries
- **API Response Time**: 50% faster response times
- **Concurrent User Support**: 3x more concurrent users
- **Memory Efficiency**: Optimized memory usage with compression

### Monitoring Metrics
- Cache hit/miss ratios by service
- Average response times
- Memory usage and key counts
- Error rates and alerts
- Cache warming effectiveness

## Cache TTL Strategies

### Short TTL (1-5 minutes)
- Real-time data (status updates, live metrics)
- Frequently changing data
- Session activity tracking

### Medium TTL (15-60 minutes)
- Query results with moderate change frequency
- User preferences and settings
- Dashboard data and analytics

### Long TTL (1-24 hours)
- Stable reference data
- Historical analysis results
- Completed workflow data

### Very Long TTL (24+ hours)
- Static configuration data
- Completed email analysis
- Archived content

## Troubleshooting

### Common Issues

#### High Cache Miss Rate
- Check TTL values (may be too short)
- Verify cache warming is working
- Review query patterns for consistency

#### Memory Issues
- Enable compression for large values
- Review TTL values (may be too long)
- Implement cache eviction policies

#### Connection Issues
- Verify Redis server status
- Check network connectivity
- Review connection pool settings

### Debugging Tools

```typescript
// Get cache statistics
const stats = await cacheManager.getStats();
console.log('Hit rate:', stats.hitRate);
console.log('Memory usage:', stats.memoryUsage);

// Check health status
const health = await cacheMonitor.performHealthCheck();
console.log('Health:', health.healthy);
console.log('Issues:', health.issues);

// Generate performance report
const report = await cacheMonitor.generatePerformanceReport();
```

## Security Considerations

### Redis Security
- Use Redis AUTH with strong passwords
- Enable TLS for production environments
- Restrict Redis access to application servers only
- Regular security updates

### Data Security
- Sensitive data is never cached in plain text
- Cache keys don't expose sensitive information
- Proper TTL ensures data doesn't persist too long
- Cache invalidation on user permission changes

## Maintenance

### Regular Tasks
- Monitor cache performance metrics
- Review and optimize TTL values
- Update cache warming strategies
- Clean up unused cache keys

### Alerts to Monitor
- Cache hit rate below 70%
- Memory usage above 85%
- Response time above 100ms
- Redis connection failures

### Backup & Recovery
- Redis persistence configuration
- Cache warming procedures for disaster recovery
- Monitoring alert recovery procedures

## Advanced Configuration

### Custom Cache Middleware

```typescript
import { createCacheMiddleware } from './src/api/middleware/cacheMiddleware.js';

const customMiddleware = createCacheMiddleware({
  shouldCache: (input, ctx) => {
    // Custom caching logic
    return !input.skipCache && ctx.user?.cacheEnabled;
  },
  keyGenerator: (input, ctx) => {
    // Custom key generation
    return `custom:${ctx.user.id}:${JSON.stringify(input)}`;
  }
});
```

### Custom Warming Jobs

```typescript
import { cacheMonitor } from './src/core/cache/CacheMonitor.js';

cacheMonitor.registerWarmingJob({
  id: 'custom_warming',
  name: 'Custom Cache Warming',
  priority: 90,
  schedule: '0 */4 * * *', // Every 4 hours
  handler: async () => {
    // Custom warming logic
    return warmedCount;
  }
});
```

## Integration with Existing Systems

### Health Check Endpoints

```typescript
import { getCacheSystemStatus } from './src/config/cache-startup.js';

app.get('/health/cache', async (req, res) => {
  const status = await getCacheSystemStatus();
  res.json(status);
});
```

### Metrics Integration

The cache system automatically reports metrics to your existing monitoring system. Metrics include:
- `cache.hit` / `cache.miss`
- `cache.set.duration`
- `cache.get.duration`
- `cache.memory_usage`
- `cache.error_rate`

## Migration Guide

### From No Caching
1. Install and configure Redis
2. Add cache startup to application initialization
3. Replace repository instances with cached versions
4. Add cache middleware to tRPC routes
5. Monitor performance improvements

### From Basic Caching
1. Migrate existing cache keys to new format
2. Update cache invalidation logic
3. Implement cache warming strategies
4. Add monitoring and alerting

## Best Practices

### Cache Key Design
- Use consistent naming conventions
- Include version information when needed
- Avoid sensitive data in keys
- Keep keys reasonably short

### TTL Management
- Use appropriate TTL based on data volatility
- Implement sliding expiration for active data
- Consider business requirements for staleness

### Error Handling
- Always handle cache failures gracefully
- Implement fallback to database queries
- Log cache errors for monitoring

### Performance Testing
- Load test with cache enabled/disabled
- Monitor cache hit rates under load
- Test cache warming effectiveness

## Support & Contributing

For issues, questions, or contributions:
1. Check existing documentation and troubleshooting guides
2. Review logs and monitoring data
3. Test with cache disabled to isolate issues
4. Provide detailed error messages and configuration

## License

This caching system is part of the CrewAI Team project and follows the same licensing terms.