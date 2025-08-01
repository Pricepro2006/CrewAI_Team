# Advanced Rate Limiting System

This document describes the comprehensive rate limiting system implemented in the CrewAI Team application.

## Overview

The rate limiting system provides multi-layered protection against abuse, DDoS attacks, and ensures fair resource allocation across users. It features:

- **Redis-backed rate limiting** with memory fallback
- **User-aware rate limits** (anonymous, authenticated, admin)
- **Endpoint-specific rate limits** (auth, API, upload, WebSocket)
- **Progressive delays** for repeated violations
- **Comprehensive monitoring** and alerting
- **TRPC integration** with procedure-specific limits

## Architecture

### Components

1. **AdvancedRateLimit** - Core rate limiting engine
2. **Express Middleware** - HTTP request rate limiting
3. **TRPC Middleware** - Procedure-specific rate limiting
4. **WebSocket Rate Limiting** - Connection rate limiting
5. **Authentication Integration** - User-aware limits

### Data Flow

```
Request → Authentication → User Tier Detection → Rate Limit Check → Progressive Delay → Response
```

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_RATE_LIMIT_DB=1

# Rate Limiting Settings
RATE_LIMIT_WINDOW=900000     # 15 minutes in ms
RATE_LIMIT_MAX_REQUESTS=100  # Default max requests
```

### Rate Limit Tiers

#### Anonymous Users

- **API Endpoints**: 100 requests per 15 minutes
- **Auth Endpoints**: 5 requests per 15 minutes
- **Upload Endpoints**: 5 requests per hour
- **WebSocket**: 10 connections per minute

#### Authenticated Users

- **API Endpoints**: 500 requests per 15 minutes
- **Auth Endpoints**: 10 requests per 15 minutes
- **Upload Endpoints**: 20 requests per hour
- **WebSocket**: 30 connections per minute

#### Admin Users

- **API Endpoints**: 2000 requests per 15 minutes
- **Auth Endpoints**: 50 requests per 15 minutes
- **Upload Endpoints**: 100 requests per hour
- **WebSocket**: 100 connections per minute

### TRPC Procedure Limits

- **Chat**: 30 requests per minute (60 for authenticated, 200 for admin)
- **Agent**: 20 requests per 5 minutes (40 for authenticated, 100 for admin)
- **Task**: 25 requests per 10 minutes (50 for authenticated, 150 for admin)
- **RAG**: 15 requests per 2 minutes (30 for authenticated, 100 for admin)
- **Strict**: 5 requests per 30 minutes (10 for authenticated, 50 for admin)

## Implementation

### Basic Usage

```typescript
import { advancedRateLimit } from "./middleware/advancedRateLimit";

// Apply to Express app
app.use(advancedRateLimit.getUserTierLimiter());

// Endpoint-specific rate limiting
app.use("/auth", advancedRateLimit.getAuthLimiter());
app.use("/upload", advancedRateLimit.getUploadLimiter());
```

### TRPC Integration

```typescript
import { chatProcedure, agentProcedure } from "./api/trpc/enhanced-router";

// Use rate-limited procedures
export const chatRouter = router({
  message: chatProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // This procedure is automatically rate limited
      return processMessage(input.message);
    }),
});
```

### WebSocket Rate Limiting

```typescript
wss.on("connection", async (ws, req) => {
  try {
    // Apply rate limiting
    await applyWebSocketRateLimit(req);
    // Connection accepted
  } catch (error) {
    ws.close(1008, "Rate limit exceeded");
  }
});
```

## Features

### Progressive Delays

Repeated violations trigger increasing delays:

```typescript
// First violation: 1 second delay
// Second violation: 2 second delay
// Third violation: 4 second delay
// Maximum: 30 seconds
```

### Rate Limit Headers

Responses include standard rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Error Responses

Rate limit violations return structured errors:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests from this IP, please try again later",
  "retryAfter": 900,
  "limit": 100,
  "window": 900000,
  "violations": 3
}
```

### Monitoring

The system provides comprehensive monitoring:

```typescript
// Get rate limit status (admin only)
GET /api/rate-limit-status

{
  "identifier": "user:123",
  "current": 45,
  "limit": 100,
  "remaining": 55,
  "resetTime": "2024-01-01T12:00:00Z",
  "violations": 0
}
```

### Alerting

Automatic alerts are triggered when:

- Rate limit violations exceed threshold (default: 10)
- High traffic patterns detected
- Redis connection issues

## Security Features

### IP Spoofing Protection

```typescript
app.set("trust proxy", 1); // Trust first proxy
```

### User Authentication Integration

```typescript
// Authentication runs before rate limiting
app.use(authenticateToken);
app.use(rateLimiter.getUserTierLimiter());
```

### Admin Bypass

Admin users automatically receive higher limits without explicit bypass.

### CSRF Protection

Rate limiting integrates with CSRF protection for mutation operations.

## Performance

### Redis Optimization

- Connection pooling with retry logic
- Automatic failover to memory storage
- Efficient key expiration
- Sliding window algorithm

### Memory Management

- Automatic cleanup of expired entries
- Configurable memory limits
- Garbage collection optimization

### Benchmarks

- **Throughput**: 10,000+ requests/second
- **Latency**: <1ms average overhead
- **Memory**: <100MB for 1M active keys

## Troubleshooting

### Common Issues

#### High Memory Usage

```typescript
// Reduce window size or limits
const config = {
  tiers: {
    anonymous: {
      windowMs: 300000, // 5 minutes instead of 15
      maxRequests: 50, // Lower limit
    },
  },
};
```

#### Redis Connection Errors

```bash
# Check Redis status
redis-cli ping

# Check connection logs
tail -f logs/app.log | grep "redis"
```

#### False Positives

```typescript
// Adjust user detection
const getUserTier = (req) => {
  // Custom logic for user identification
  return req.user ? "authenticated" : "anonymous";
};
```

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

View rate limit logs:

```bash
tail -f logs/app.log | grep "RATE_LIMIT"
```

## Testing

### Unit Tests

```bash
npm test src/middleware/__tests__/advancedRateLimit.test.ts
```

### Integration Tests

```bash
npm test src/middleware/__tests__/integration.test.ts
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run tests/load/rate-limiting.yml
```

## Migration Guide

### From Basic Rate Limiting

1. Replace existing rate limiters:

```typescript
// Before
app.use(rateLimit({ windowMs: 900000, max: 100 }));

// After
app.use(advancedRateLimit.getUserTierLimiter());
```

2. Update error handling:

```typescript
// Handle new error format
if (response.status === 429) {
  const retryAfter = response.headers["retry-after"];
  // Implement exponential backoff
}
```

3. Configure Redis:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Configuration Migration

Old configuration format:

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

New configuration format:

```typescript
const rateLimiter = new AdvancedRateLimit({
  tiers: {
    anonymous: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
    },
  },
});
```

## Best Practices

### Rate Limit Design

1. **Start Conservative**: Begin with lower limits and increase based on usage
2. **Monitor Closely**: Track violation rates and adjust accordingly
3. **User Feedback**: Provide clear error messages with retry guidance
4. **Graceful Degradation**: Ensure fallback when rate limiting fails

### Performance Optimization

1. **Redis Tuning**: Configure appropriate memory and connection limits
2. **Key Design**: Use efficient key naming conventions
3. **Monitoring**: Set up alerts for high violation rates
4. **Caching**: Cache rate limit status for frequently checked users

### Security Considerations

1. **DDoS Protection**: Combine with upstream DDoS protection
2. **Bot Detection**: Integrate with bot detection services
3. **Anomaly Detection**: Monitor for unusual traffic patterns
4. **Logging**: Maintain detailed logs for security analysis

## API Reference

### AdvancedRateLimit Class

#### Constructor

```typescript
new AdvancedRateLimit(config?: Partial<AdvancedRateLimitOptions>)
```

#### Methods

- `getUserTierLimiter()` - Express middleware for user-aware rate limiting
- `getEndpointLimiter()` - Express middleware for endpoint-specific limits
- `getAuthLimiter()` - Express middleware for authentication endpoints
- `getUploadLimiter()` - Express middleware for file upload endpoints
- `getWebSocketLimiter()` - Express middleware for WebSocket connections
- `getRateLimitStatus(req)` - Get current rate limit status
- `cleanup()` - Clean up resources

### Configuration Options

```typescript
interface AdvancedRateLimitOptions {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  tiers: {
    anonymous: RateLimitConfig;
    authenticated: RateLimitConfig;
    admin: RateLimitConfig;
  };
  endpoints: {
    auth: RateLimitConfig;
    api: RateLimitConfig;
    upload: RateLimitConfig;
    websocket: RateLimitConfig;
  };
  progressiveDelay: {
    enabled: boolean;
    baseDelayMs: number;
    maxDelayMs: number;
    multiplier: number;
  };
  monitoring: {
    alertThreshold: number;
    logViolations: boolean;
  };
}
```

## Contributing

When contributing to the rate limiting system:

1. **Test Thoroughly**: Include unit and integration tests
2. **Document Changes**: Update this README for any changes
3. **Monitor Impact**: Track performance after deployment
4. **Security Review**: Have security team review changes

## Support

For issues with rate limiting:

1. Check logs: `tail -f logs/app.log | grep RATE_LIMIT`
2. Verify Redis connection: `redis-cli ping`
3. Review configuration: Check environment variables
4. Contact support: Include relevant logs and configuration

---

_Last updated: January 2024_
