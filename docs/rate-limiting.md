# Rate Limiting Implementation Guide

## Overview

The GROUP 2B WebSearch Enhancement includes comprehensive rate limiting to prevent abuse and ensure system stability. This implementation uses industry-standard patterns and supports both in-memory and Redis-based distributed rate limiting.

## Architecture

### Components

1. **RateLimiter Class** (`src/core/middleware/RateLimiter.ts`)
   - Provides multiple rate limiting strategies
   - Supports Redis for distributed systems
   - Implements token bucket and sliding window algorithms

2. **BusinessSearchMiddleware Integration**
   - Seamlessly integrates rate limiting into the WebSearch flow
   - Tracks rate-limited requests in metrics
   - Emits events for monitoring

3. **Express Route Integration** (`src/api/routes/businessSearch.ts`)
   - Apply rate limits at the API endpoint level
   - Different limits for different endpoints

4. **Monitoring Dashboard** (`src/client/components/RateLimitMonitor.tsx`)
   - Real-time visualization of rate limit metrics
   - Circuit breaker status monitoring
   - Alert system for high rate limiting

## Rate Limiting Strategies

### 1. Fixed Window (Default)
```typescript
const webSearchLimiter = rateLimiter.webSearchLimiter();
// 100 requests per 15 minutes
```

### 2. Sliding Window
```typescript
const slidingLimiter = rateLimiter.slidingWindowLimiter(
  5 * 60 * 1000, // 5 minute window
  30 // max requests
);
```

### 3. Token Bucket
```typescript
const tokenBucket = rateLimiter.tokenBucketLimiter(
  5,   // burst capacity
  0.1  // refill rate (tokens/second)
);
```

## Configuration

### Environment Variables
```env
# Enable Redis for distributed rate limiting
USE_REDIS=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```

### Rate Limit Tiers

| Tier | Endpoint | Limit | Window | Use Case |
|------|----------|-------|---------|----------|
| Standard | `/search/web` | 100 req | 15 min | General web searches |
| Strict | `/search/business` | 30 req | 5 min | Business info searches |
| Premium | `/search/premium` | 500 req | 15 min | Premium users |
| Global | All endpoints | 1000 req | 15 min | Overall API protection |

## Usage Examples

### Basic Implementation
```typescript
import { webSearchRateLimit } from '@/core/middleware/RateLimiter';

// Apply to Express route
router.post('/api/search', 
  webSearchRateLimit, // Apply rate limiting
  async (req, res) => {
    // Your route handler
  }
);
```

### Custom Rate Limiter
```typescript
const customLimiter = new RateLimiter().webSearchLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // 50 requests
  message: 'Custom rate limit exceeded'
});
```

### Middleware Integration
```typescript
const middleware = new BusinessSearchMiddleware();
const wrappedProvider = middleware.wrapProvider(ollamaProvider);

// Rate limiting is automatically applied to enhanced queries
const response = await wrappedProvider.generate('Find plumbers near me');
```

## Monitoring

### Metrics Available
- Total requests
- Rate limited requests (count and percentage)
- Average latency
- Circuit breaker status
- Window reset times

### Event Handling
```typescript
middleware.on('rate_limited', (event) => {
  console.log('Rate limit hit:', {
    prompt: event.prompt,
    timestamp: event.timestamp,
    totalRateLimited: event.totalRateLimited
  });
});
```

### Dashboard Integration
The `RateLimitMonitor` component provides real-time visualization:
- Request counts and percentages
- Circuit breaker status
- Latency tracking
- Alert system for high rate limiting

## Best Practices

1. **Choose Appropriate Limits**
   - Start conservative and adjust based on usage patterns
   - Monitor metrics to find optimal values

2. **Use Redis for Production**
   - Essential for multi-server deployments
   - Provides persistence across restarts

3. **Implement Graceful Degradation**
   - Circuit breaker prevents cascade failures
   - Falls back to unenhanced responses when rate limited

4. **Monitor and Alert**
   - Set up alerts for high rate limiting percentages
   - Track latency impacts
   - Review patterns for optimization opportunities

5. **User-Specific Limits**
   - Implement premium tiers for power users
   - Use authentication for better rate limit keys

## Security Considerations

1. **DDoS Protection**
   - Rate limiting is first line of defense
   - Combine with firewall rules for complete protection

2. **Key Generation**
   - Use user IDs when available
   - Combine IP + query for granular control
   - Avoid predictable patterns

3. **Error Handling**
   - Don't expose internal details in rate limit messages
   - Log attempts for security analysis

## Troubleshooting

### Common Issues

1. **Redis Connection Failures**
   - System automatically falls back to memory store
   - Check Redis configuration and connectivity

2. **High Rate Limiting**
   - Review usage patterns
   - Consider increasing limits or adding caching
   - Check for inefficient query patterns

3. **Circuit Breaker Open**
   - Indicates repeated failures
   - Check logs for root cause
   - Can manually reset via API

### Debug Commands
```bash
# Check Redis connectivity
redis-cli ping

# Monitor rate limit keys
redis-cli --scan --pattern "rl:*"

# View current metrics
curl http://localhost:3000/api/business-search/metrics
```

## Future Enhancements

1. **Dynamic Rate Limiting**
   - Adjust limits based on system load
   - Machine learning for anomaly detection

2. **Geographic Rate Limiting**
   - Different limits by region
   - Compliance with local regulations

3. **Advanced Analytics**
   - Pattern detection for optimization
   - Cost analysis per endpoint

4. **Integration with CDN**
   - Edge-level rate limiting
   - Global distribution of limits