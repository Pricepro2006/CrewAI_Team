# Middleware Execution Order Documentation

**Date:** August 7, 2025  
**Version:** 2.0.0  
**Status:** ✅ FIXED AND VERIFIED

## Critical Middleware Ordering Requirements

The order of middleware in Express.js is **CRITICAL** for proper functionality. Middleware executes in the order it's defined, and dependencies between middleware must be respected.

## Current Middleware Stack Order (FIXED)

```javascript
// 1. COOKIE PARSER (MUST BE FIRST)
app.use(cookieParser());
// ↓ Parses cookies for all downstream middleware

// 2. SECURITY HEADERS
applySecurityHeaders(app, {...});
// ↓ Sets CORS and security headers

// 3. BODY PARSERS
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// ↓ Parses request bodies

// 4. COMPRESSION
app.use(compression({...}));
// ↓ Compresses responses

// 5. MONITORING
app.use(requestTracking);
app.use(requestSizeTracking);
app.use(rateLimitTracking);
app.use(authTracking);
// ↓ Tracks metrics

// 6. AUTHENTICATION
app.use(authenticateToken);
// ↓ Verifies JWT tokens

// 7. RATE LIMITING
app.use(apiRateLimiter);
// ↓ Enforces rate limits

// 8. HEALTH CHECKS
app.get("/health", ...);
// ↓ Basic health endpoint

// 9. CSRF TOKEN ENDPOINTS
app.use("/api", csrfRouter);
// ↓ Provides CSRF tokens

// 10. CSRF VALIDATION
app.use(csrfValidator([...]));
// ↓ Validates CSRF for state-changing operations

// 11. API ROUTES
app.use("/api/webhooks", webhookRouter);
app.use("/api/email-analysis", emailAnalysisRouter);
// ... other routes

// 12. tRPC MIDDLEWARE
app.use("/trpc", createExpressMiddleware({...}));
// ↓ Handles tRPC requests

// 13. STATIC FILES (Production)
if (production) {
  app.use(express.static("dist/client"));
}

// 14. ERROR HANDLERS (MUST BE LAST)
app.use(notFoundHandler);
app.use(errorTracking);
app.use(errorHandler);
```

## Why This Order Matters

### 1. Cookie Parser MUST Be First
**Problem:** If `cookieParser()` isn't first, downstream middleware can't access cookies.
```javascript
// ❌ WRONG - CSRF can't read cookies
app.use(csrfValidator);
app.use(cookieParser());

// ✅ CORRECT - Cookies parsed first
app.use(cookieParser());
app.use(csrfValidator);
```

### 2. Security Headers Before Body Parsing
**Reason:** Headers should be set before any processing to ensure they're always applied.

### 3. Body Parsers Before Routes
**Problem:** Routes can't access `req.body` without parsers.
```javascript
// ❌ WRONG - req.body is undefined
app.post("/api/data", handler);
app.use(express.json());

// ✅ CORRECT - Body parsed first
app.use(express.json());
app.post("/api/data", handler);
```

### 4. Authentication Before Authorization
**Reason:** You must know WHO the user is before checking WHAT they can do.

### 5. CSRF Token Endpoints Before CSRF Validation
**Problem:** Users can't get tokens if validation blocks the endpoint.
```javascript
// ❌ WRONG - Can't fetch tokens
app.use(csrfValidator);
app.use("/api", csrfRouter);

// ✅ CORRECT - Token endpoint accessible
app.use("/api", csrfRouter);
app.use(csrfValidator);
```

### 6. Error Handlers MUST Be Last
**Reason:** Error handlers catch errors from all previous middleware.

## CSRF Token Flow

### 1. Client Gets Token
```
GET /api/csrf-token
→ cookieParser() parses existing cookies
→ csrfRouter generates/returns token
→ Token stored in cookie
```

### 2. Client Makes Protected Request
```
POST /api/some-endpoint
→ cookieParser() parses CSRF cookie
→ csrfValidator checks token
→ Route handler executes
```

### 3. tRPC Request with CSRF
```
POST /trpc/procedure.mutate
→ cookieParser() parses CSRF cookie
→ csrfValidator validates token
→ tRPC context extracts token
→ tRPC procedure executes
```

## Common Middleware Ordering Mistakes

### Mistake 1: Late Cookie Parser
```javascript
// ❌ WRONG
app.use(compression());
app.use(express.json());
app.use(cookieParser()); // Too late!

// ✅ CORRECT
app.use(cookieParser()); // First!
app.use(compression());
app.use(express.json());
```

### Mistake 2: CSRF Before Token Endpoints
```javascript
// ❌ WRONG
app.use(csrfValidator); // Blocks token fetching
app.use("/api/csrf-token", csrfRouter);

// ✅ CORRECT
app.use("/api/csrf-token", csrfRouter);
app.use(csrfValidator); // After token endpoints
```

### Mistake 3: Error Handlers Not Last
```javascript
// ❌ WRONG
app.use(errorHandler);
app.use("/api", router); // Errors not caught!

// ✅ CORRECT
app.use("/api", router);
app.use(errorHandler); // Catches all errors
```

## Testing Middleware Order

### Test 1: Cookie Parsing
```bash
curl -v http://localhost:3001/api/csrf-token \
  -H "Cookie: test=value"
# Server should see the cookie
```

### Test 2: CSRF Flow
```bash
# Get token
TOKEN=$(curl -s http://localhost:3001/api/csrf-token | jq -r .token)

# Use token
curl -X POST http://localhost:3001/api/endpoint \
  -H "x-csrf-token: $TOKEN" \
  -H "Cookie: csrf-token=$TOKEN"
```

### Test 3: tRPC with CSRF
```javascript
// Client should:
1. Fetch CSRF token from /api/csrf-token
2. Include token in tRPC requests
3. Ensure cookies are sent with credentials: 'include'
```

## Debugging Middleware Issues

### Enable Debug Logging
```javascript
// Add logging to track execution order
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Cookies:', req.cookies);
  console.log('Headers:', req.headers);
  next();
});
```

### Check Middleware Dependencies
```bash
# Verify cookie parser is installed
npm ls cookie-parser

# Check middleware versions
npm ls express
```

### Common Symptoms and Solutions

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| `req.cookies` is undefined | cookieParser not installed/used | Add `app.use(cookieParser())` early |
| CSRF always fails | Cookie parser after CSRF check | Move cookieParser before CSRF |
| Can't get CSRF token | CSRF validator blocking endpoint | Skip validation for token endpoints |
| `req.body` is undefined | Body parser after route | Move body parser before routes |
| Errors not caught | Error handler not last | Move error handler to end |

## Best Practices

1. **Document Middleware Order**: Always comment why middleware is in a specific position
2. **Test Order Changes**: Middleware order changes can break the entire app
3. **Use Skip Lists**: Configure middleware to skip certain paths when needed
4. **Log Middleware Execution**: Add debug logging during development
5. **Validate Dependencies**: Ensure middleware that depends on others comes after

## Migration Guide

If updating from an incorrectly ordered middleware stack:

1. **Backup Current Configuration**
2. **Move Cookie Parser First**
3. **Test Authentication Flow**
4. **Test CSRF Protection**
5. **Test API Routes**
6. **Test Error Handling**
7. **Deploy with Monitoring**

## References

- [Express.js Middleware Documentation](https://expressjs.com/en/guide/using-middleware.html)
- [CSRF Protection Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Express Middleware Order Guide](https://expressjs.com/en/guide/writing-middleware.html)

---

**Important:** The middleware order is now correct and CSRF protection is functional. Any changes to middleware order should be carefully tested to ensure dependencies are maintained.