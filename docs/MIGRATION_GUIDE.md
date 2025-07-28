# Migration Guide: Four-Phase Update

## Overview

This guide helps you migrate from the previous version to the new four-phase update that includes security, reliability, error handling, and production excellence improvements.

## Breaking Changes

### 1. Authentication Changes

#### JWT Token Structure
The JWT token payload structure has been updated for enhanced security.

**Before:**
```typescript
{
  userId: string;
  email: string;
}
```

**After:**
```typescript
{
  sub: string;        // User ID (standard claim)
  email: string;
  username: string;
  role: string;
  iat: number;        // Issued at
  exp: number;        // Expiration
}
```

**Migration Steps:**
1. Update any code that decodes JWT tokens to use `sub` instead of `userId`
2. Add role-based checks where needed
3. Handle token expiration properly

### 2. API Rate Limiting

New rate limits are enforced based on user authentication status:

| Endpoint Type | Anonymous | Authenticated | Admin |
|--------------|-----------|---------------|-------|
| General API | 100/15min | 500/15min | 2000/15min |
| Chat | 20/min | 60/min | 200/min |
| Auth | 5/15min | 10/15min | 50/15min |

**Migration Steps:**
1. Implement retry logic in your API clients
2. Handle 429 (Too Many Requests) responses
3. Use the `Retry-After` header for backoff

### 3. CSRF Protection

All state-changing operations now require CSRF tokens.

**Migration Steps:**
1. Fetch CSRF token: `GET /api/csrf-token`
2. Include token in headers: `X-CSRF-Token: <token>`
3. Handle 403 responses for invalid tokens

### 4. Error Response Format

Standardized error responses across all endpoints:

```typescript
{
  error: string;          // Human-readable message
  code: string;           // Machine-readable code
  details?: any;          // Additional context
  timestamp: string;      // ISO timestamp
  requestId: string;      // Unique request ID
}
```

**Migration Steps:**
1. Update error handling to use new format
2. Log `requestId` for debugging
3. Use `code` for programmatic error handling

## New Features to Adopt

### 1. Health Monitoring

New health endpoints available:

```typescript
// Overall health
GET /api/health/status

// Detailed service health
GET /api/health/services

// Metrics
GET /api/monitoring/metrics
```

### 2. Real-time Updates

WebSocket improvements for real-time data:

```typescript
// Connect with authentication
const ws = new WebSocket('ws://localhost:3001/trpc-ws');
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token'
}));
```

### 3. Enhanced Security Headers

The following security headers are now enforced:

```
Content-Security-Policy: default-src 'self'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

**Migration Steps:**
1. Update any inline scripts to external files
2. Use nonces for necessary inline scripts
3. Update frame embedding if used

## Configuration Changes

### Environment Variables

New required environment variables:

```env
# Security
JWT_SECRET=<strong-secret-min-32-chars>
CSRF_SECRET=<random-secret>

# Rate Limiting (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<if-required>

# Monitoring (optional)
ENABLE_METRICS=true
LOG_LEVEL=info
```

### Database Schema

No database migrations required, but new tables added:

- `user_sessions` - Session management
- `refresh_tokens` - Token rotation
- `api_keys` - Future API key support

## Testing Your Migration

### 1. Authentication Flow
```bash
# Test login
curl -X POST http://localhost:3000/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Should return tokens with new structure
```

### 2. Rate Limiting
```bash
# Test rate limits
for i in {1..10}; do
  curl http://localhost:3000/trpc/health.status
done

# Should see 429 after limit exceeded
```

### 3. CSRF Protection
```bash
# Get CSRF token
TOKEN=$(curl http://localhost:3000/api/csrf-token | jq -r .csrfToken)

# Use in mutation
curl -X POST http://localhost:3000/trpc/chat.send \
  -H "X-CSRF-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

## Rollback Plan

If issues arise, rollback procedure:

1. **Database**: No schema changes to rollback
2. **Code**: `git checkout main`
3. **Dependencies**: `git checkout main -- package.json && pnpm install`
4. **Config**: Restore previous environment variables

## Common Issues and Solutions

### Issue: JWT Token Invalid
**Solution**: Clear browser storage and re-authenticate with new token format

### Issue: CSRF Token Missing
**Solution**: Fetch token before mutations, store in app state

### Issue: Rate Limit Hit
**Solution**: Implement exponential backoff:
```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'TOO_MANY_REQUESTS' && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

### Issue: Security Headers Block Resources
**Solution**: Update CSP to allow required sources or use nonces

## Support

For migration support:
1. Check logs for detailed error messages
2. Use request IDs for debugging
3. Monitor health endpoints
4. Review security audit logs

## Timeline

1. **Week 1**: Test in development
2. **Week 2**: Staged rollout (10% traffic)
3. **Week 3**: Full deployment
4. **Week 4**: Deprecate old endpoints

## Checklist

- [ ] Update JWT handling code
- [ ] Implement CSRF token management
- [ ] Add retry logic for rate limits
- [ ] Update error handlers
- [ ] Test authentication flow
- [ ] Monitor health endpoints
- [ ] Update security headers compliance
- [ ] Review and update API clients
- [ ] Test WebSocket connections
- [ ] Verify no regression in features