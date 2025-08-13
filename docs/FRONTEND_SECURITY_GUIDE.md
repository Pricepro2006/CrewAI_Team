# Frontend Security Configuration Guide

## Overview

This guide covers the security features implemented in the CrewAI Team application and how they affect frontend development.

## Security Features

### 1. CORS (Cross-Origin Resource Sharing)

The application implements strict CORS policies to prevent unauthorized cross-origin requests.

**Allowed Origins:**

- Development: `http://localhost:3000`, `http://localhost:5173-5175`
- Production: Configured via `PRODUCTION_ORIGINS` environment variable

**Important for Frontend:**

- All API requests must include `credentials: "include"` to send cookies
- The origin header is automatically set by browsers
- Preflight requests are cached for 24 hours for performance

### 2. CSP (Content-Security-Policy)

Content Security Policy prevents XSS attacks by controlling which resources can be loaded.

**Development Mode:**

- Allows `'unsafe-inline'` and `'unsafe-eval'` for React DevTools and HMR
- WebSocket connections to localhost are permitted

**Production Mode:**

- Stricter policies without unsafe-inline/eval
- Consider using nonces for inline scripts if needed

**Allowed Resources:**

- Scripts: Self-hosted, CDN (jsdelivr, unpkg)
- Styles: Self-hosted, inline (required for React), Google Fonts
- Images: Self-hosted, data URIs, HTTPS sources
- Fonts: Self-hosted, Google Fonts
- WebSockets: Configured domains only

### 3. CSRF Protection

All state-changing requests require a CSRF token to prevent cross-site request forgery.

**Implementation:**

```typescript
import { useCSRF } from "@/hooks/useCSRF";

// The hook automatically fetches and manages CSRF tokens
const { token, getHeaders } = useCSRF();

// Headers are automatically included in tRPC requests
// For manual fetch requests:
fetch("/api/endpoint", {
  method: "POST",
  headers: {
    ...getHeaders(),
    "Content-Type": "application/json",
  },
  credentials: "include",
  body: JSON.stringify(data),
});
```

### 4. Security Headers

Additional security headers are automatically applied:

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` - Disables unnecessary browser features

## Frontend Integration

### Using tRPC with Security

The tRPC client is pre-configured with security headers:

```typescript
import { api } from "@/lib/trpc";

// All tRPC calls automatically include CSRF tokens
const { data } = api.user.profile.useQuery();

// Mutations also include CSRF protection
const mutation = api.user.update.useMutation();
```

### WebSocket Security

WebSocket connections require origin validation:

```typescript
// WebSocket connections are automatically configured with auth
// No additional configuration needed when using tRPC subscriptions
const subscription = api.ws.agentStatus.useSubscription();
```

### File Uploads

File uploads require special handling:

```typescript
const { submitForm } = useCSRFForm();

const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const result = await submitForm("/api/upload", formData);
};
```

## Security Monitoring

### Using the Security Status Monitor

Add the security monitor to your app for development:

```typescript
import { SecurityStatusMonitor } from '@/components/Security';

// In your app layout:
{process.env.NODE_ENV === 'development' && <SecurityStatusMonitor />}
```

### CSRF Status Monitoring

Monitor CSRF token status:

```typescript
import { useCSRFStatus } from "@/hooks/useTRPCWithCSRF";

const status = useCSRFStatus();
console.log("CSRF Token Age:", status.tokenAge);
console.log("Has Token:", status.hasToken);
```

## Common Issues and Solutions

### Issue: CORS Errors

**Solution:** Ensure your development server URL is in the allowed origins list and you're using `credentials: "include"`

### Issue: CSP Violations

**Solution:** Check browser console for specific violations. Add required sources to CSP configuration if legitimate.

### Issue: CSRF Token Errors

**Solution:** The token automatically refreshes. If persistent, clear cookies and reload.

### Issue: WebSocket Connection Rejected

**Solution:** Verify your origin is allowed and you're connecting to the correct port (3002 by default).

## Testing Security

Run the security test script:

```bash
npm run test:security
# or
node scripts/test-frontend-security.js
```

This will verify:

- CORS configuration
- CSP headers
- Security headers presence
- WebSocket connectivity
- CSRF token flow

## Best Practices

1. **Always use HTTPS in production** - Many security features require secure contexts
2. **Keep credentials flag consistent** - Use `credentials: "include"` for all API requests
3. **Monitor CSP violations** - Set up CSP reporting in production
4. **Regular security audits** - Run security tests as part of CI/CD
5. **Update allowed origins** - Keep CORS origins list minimal and up-to-date

## Environment Variables

Configure security via environment variables:

```env
# CORS Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
PRODUCTION_ORIGINS=https://app.example.com,https://www.example.com

# CSP Report URI (optional)
CSP_REPORT_URI=https://csp-report.example.com

# Strict Origin Check (optional)
STRICT_ORIGIN_CHECK=true
```

## Troubleshooting

Enable debug logging for security issues:

```typescript
// In browser console
localStorage.setItem("debug", "SECURITY,CSRF,TRPC");
```

Check security headers:

```bash
curl -I http://localhost:3001/health
```

## Further Reading

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
