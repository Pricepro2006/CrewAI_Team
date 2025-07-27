# Security Patch: Guest User Authentication Bypass Fix

## Overview

This document details the security patch implemented to fix critical authentication bypass vulnerabilities in the guest user handling system.

## Vulnerabilities Fixed

### 1. **Predictable Guest User IDs** (CRITICAL)
- **Previous**: Guest IDs were generated using IP address: `guest-${ip.replace(/\./g, "-")}-${Date.now()}`
- **Risk**: Attackers could predict and hijack guest sessions
- **Fix**: Now using cryptographically secure random IDs with SHA-256 hashing

### 2. **Excessive Guest User Permissions** (CRITICAL)
- **Previous**: Guest users had same permissions as authenticated users (`["read", "write"]`)
- **Risk**: Guest users could perform privileged operations
- **Fix**: Guest users now have restricted permissions:
  - `chat.read` - Can read chat messages
  - `chat.create.limited` - Limited chat creation (rate limited)
  - `health.read` - Can check system health
  - `public.read` - Can access public resources

### 3. **No Rate Limiting on Guest Creation** (HIGH)
- **Previous**: Unlimited guest user creation per IP
- **Risk**: Resource exhaustion, DoS attacks
- **Fix**: Rate limiting implemented:
  - Max 5 guest users per IP per hour
  - LRU cache with TTL for efficient tracking

### 4. **No Differentiation from Authenticated Users** (HIGH)
- **Previous**: Code couldn't distinguish guests from authenticated users
- **Risk**: Security checks could be bypassed
- **Fix**: Clear differentiation through:
  - Special "guest" role
  - `isGuestUser()` utility method
  - Metadata tracking for guests

## Implementation Details

### New Components

1. **GuestUserService** (`src/api/services/GuestUserService.ts`)
   - Centralized guest user management
   - Secure ID generation
   - Rate limiting per IP
   - Session caching with TTL (30 minutes)
   - IP sanitization and validation

2. **SecurityMonitoringService** (`src/api/services/SecurityMonitoringService.ts`)
   - Real-time security event tracking
   - Suspicious activity detection
   - Alert generation for security incidents
   - Comprehensive logging and reporting

3. **Enhanced Security Middleware** (`src/api/middleware/security/guest-auth.ts`)
   - Permission-based access control
   - Guest-specific rate limiting
   - Strict authentication options
   - Enhanced authorization with role + permission checks

### Updated Components

1. **Context Creation** (`src/api/trpc/context.ts`)
   - Integrated GuestUserService for secure guest creation
   - Enhanced security validation
   - Suspicious pattern detection
   - Proper error handling for rate-limited requests

2. **Enhanced Router** (`src/api/trpc/enhanced-router.ts`)
   - New permission-based procedures
   - Guest-aware middleware stack
   - Differentiated access levels

3. **Security Router** (`src/api/routes/security.router.ts`)
   - Admin endpoints for security monitoring
   - Guest session management
   - Real-time security event subscriptions

## Security Features

### 1. Secure ID Generation
```typescript
// Cryptographically secure, unpredictable IDs
const randomBytes = crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256')
  .update([randomBytes, Date.now(), ip, userAgent, process.hrtime.bigint()].join('|'))
  .digest('hex')
  .substring(0, 16);
return `guest-${hash}`;
```

### 2. Rate Limiting
- Per-IP rate limiting with configurable thresholds
- LRU cache for efficient memory usage
- Automatic cleanup of expired entries

### 3. Permission Model
```typescript
// Guest permissions (restricted)
["chat.read", "chat.create.limited", "health.read", "public.read"]

// Authenticated user permissions
["read", "write"]

// Admin permissions
["read", "write", "delete", "admin"]
```

### 4. Security Monitoring
- Real-time event tracking
- Automatic alert generation
- Suspicious activity detection
- Comprehensive audit trails

## API Changes

### Breaking Changes
- Guest users now have role "guest" instead of "user"
- Guest permissions are different from authenticated users
- Rate limiting may reject guest creation requests

### Backward Compatibility
- Existing code checking `username === "guest"` still works
- Basic user properties maintained
- Permission array structure unchanged

## Security Best Practices

1. **Always check permissions**, not just authentication
2. **Use strict procedures** for sensitive operations
3. **Monitor security events** regularly
4. **Review guest access patterns** for anomalies
5. **Keep rate limits appropriate** for your use case

## Testing

Comprehensive test suite added:
- Secure ID generation validation
- Rate limiting verification
- Permission differentiation tests
- Backward compatibility checks
- Security vulnerability regression tests

## Migration Guide

1. **Update middleware usage**:
   ```typescript
   // Old
   protectedProcedure
   
   // New - for guest-allowed endpoints
   publicProcedure.use(requireChatRead)
   
   // New - for authenticated-only endpoints
   protectedProcedure.use(requireAgentExecute)
   ```

2. **Check for guest users**:
   ```typescript
   if (guestUserService.isGuestUser(ctx.user)) {
     // Handle guest-specific logic
   }
   ```

3. **Monitor security events**:
   ```typescript
   // Subscribe to security events
   securityMonitor.on('security-alert', (alert) => {
     // Handle security alerts
   });
   ```

## Maintenance

1. **Regular Reviews**:
   - Check security stats via `/api/security/getStats`
   - Review guest user patterns
   - Adjust rate limits as needed

2. **Cleanup**:
   - Guest sessions auto-expire after 30 minutes
   - Manual cleanup available via admin API

3. **Monitoring**:
   - Set up alerts for suspicious patterns
   - Review security reports regularly
   - Track rate limit violations

## Conclusion

This security patch addresses critical vulnerabilities in guest user handling while maintaining backward compatibility. The implementation provides defense in depth through multiple security layers: secure ID generation, strict permission controls, comprehensive rate limiting, and real-time monitoring.

All identified vulnerabilities have been patched, and the system now provides clear differentiation between guest and authenticated users, preventing privilege escalation and resource abuse.