# Security Headers Configuration

This document describes the comprehensive security headers implementation in the CrewAI Team project.

## Overview

The application implements a robust set of security headers to protect against common web vulnerabilities including:
- Cross-Origin Resource Sharing (CORS) attacks
- Cross-Site Scripting (XSS)
- Clickjacking
- Content type sniffing
- Mixed content
- Information disclosure

## Security Headers Implemented

### 1. CORS (Cross-Origin Resource Sharing)

**Configuration:**
- Configurable allowed origins via environment variables
- Credentials support enabled
- Preflight request caching for performance
- WebSocket origin validation

**Environment Variables:**
```bash
# Development origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Production origins (used only in production)
PRODUCTION_ORIGINS=https://app.example.com,https://www.example.com

# Enable strict origin validation
STRICT_ORIGIN_CHECK=true
```

### 2. Content-Security-Policy (CSP)

**Directives:**
- `default-src 'self'` - Only allow resources from same origin by default
- `script-src` - Controls script sources (unsafe-inline only in development)
- `style-src` - Controls stylesheet sources
- `img-src` - Allows images from self, data URIs, blob URIs, and HTTPS
- `connect-src` - Controls API and WebSocket connections
- `frame-ancestors 'none'` - Prevents embedding in iframes
- `base-uri 'self'` - Restricts base tag usage
- `form-action 'self'` - Restricts form submissions

**Report violations to:**
```bash
CSP_REPORT_URI=https://example.com/api/csp-report
```

### 3. X-Frame-Options

**Value:** `DENY`
- Prevents the page from being embedded in any iframe
- Protects against clickjacking attacks

### 4. X-Content-Type-Options

**Value:** `nosniff`
- Prevents browsers from MIME-sniffing
- Forces browsers to use the declared content-type

### 5. X-XSS-Protection

**Value:** `1; mode=block`
- Enables browser's XSS filter
- Blocks page if XSS attack detected
- Legacy but still useful for older browsers

### 6. Strict-Transport-Security (HSTS)

**Production Configuration:**
- `max-age=31536000` (1 year)
- `includeSubDomains`
- `preload` ready

**Development:** Disabled to avoid HTTPS requirements

### 7. Referrer-Policy

**Value:** `strict-origin-when-cross-origin`
- Sends full referrer to same-origin
- Only sends origin to cross-origin HTTPS
- No referrer to HTTP destinations

### 8. Permissions-Policy

**Disabled Features:**
- Camera
- Microphone
- Geolocation
- Payment
- USB
- Accelerometer
- Gyroscope
- Magnetometer

### 9. Additional Headers

- **X-Permitted-Cross-Domain-Policies:** `none`
- **X-Download-Options:** `noopen`
- **X-DNS-Prefetch-Control:** `off`
- **Removed Headers:** `X-Powered-By`, `Server`

## Implementation

### Server Configuration

```typescript
import { applySecurityHeaders } from './middleware/security/headers';

// Apply security headers with custom configuration
applySecurityHeaders(app, {
  cors: {
    origins: ['https://app.example.com'],
    credentials: true
  }
});
```

### WebSocket Security

WebSocket connections are protected with:
- Origin validation matching CORS configuration
- Rate limiting
- Authentication requirements

### Testing Security Headers

The implementation includes:
- Unit tests for all security headers
- Validation utility for header verification
- Environment-specific configurations

## Best Practices

1. **Environment-Specific Configuration**
   - Development: Relaxed CSP for hot-reloading
   - Production: Strict CSP and HSTS enforcement

2. **Origin Management**
   - Use environment variables for origin lists
   - Separate development and production origins
   - Enable strict origin checking in production

3. **CSP Management**
   - Start with restrictive policy
   - Add exceptions only as needed
   - Monitor CSP reports for violations

4. **Regular Reviews**
   - Audit security headers quarterly
   - Update CSP as application evolves
   - Test with security scanning tools

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check ALLOWED_ORIGINS includes your frontend URL
   - Ensure credentials are handled correctly
   - Verify preflight requests are cached

2. **CSP Violations**
   - Check browser console for CSP errors
   - Review CSP report endpoint logs
   - Add necessary sources to appropriate directives

3. **WebSocket Connection Failures**
   - Verify WebSocket origins match CORS configuration
   - Check rate limiting isn't blocking connections
   - Ensure authentication tokens are valid

### Debug Mode

Enable security header logging:
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## Security Compliance

This implementation helps meet requirements for:
- OWASP Top 10 protection
- PCI DSS compliance
- SOC 2 security controls
- GDPR data protection

## References

- [MDN Web Docs - HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [CORS Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)