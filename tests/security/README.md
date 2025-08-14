# Security Test Suite for Walmart Grocery Agent

Comprehensive security testing framework targeting critical vulnerabilities identified in the security audit.

## Overview

This test suite addresses the following critical security issues:
- **WebSocket server accepts connections without authentication**
- **SQL injection vulnerabilities in walmart-grocery-simple.router.ts**
- **Missing security headers (CSP, HSTS, X-Frame-Options)**
- **29 console statements in production code**
- **Insufficient rate limiting**

## Test Structure

```
tests/security/
├── authentication.test.ts        # JWT auth, session management, token validation
├── input-validation.test.ts      # XSS/SQL injection prevention
├── rate-limiting.test.ts         # API rate limits (100 req/15min)
├── websocket-security.test.ts    # WebSocket auth on port 8080
├── security-headers.test.ts      # Required security headers
├── config/
│   └── security-test-config.ts   # Central test configuration
├── setup/
│   └── test-setup.ts             # Global test setup
├── reports/                      # Test reports and coverage
└── run-security-tests.ts         # CI/CD test runner
```

## Quick Start

```bash
# Run all security tests
npm run test:security

# Run specific test suites
npm run test:security:auth          # Authentication tests
npm run test:security:input         # Input validation tests
npm run test:security:rate          # Rate limiting tests
npm run test:security:websocket     # WebSocket security tests
npm run test:security:headers       # Security headers tests

# Run with coverage
npm run test:security:coverage

# Run in CI/CD mode
npm run test:security:ci

# Watch mode for development
npm run test:security:watch
```

## Test Categories

### 1. Authentication Security (`authentication.test.ts`)
- JWT token validation and expiry
- Session management security
- Brute force protection
- Token structure validation
- Malformed authorization headers

### 2. Input Validation (`input-validation.test.ts`)
- XSS prevention with 15+ payloads
- SQL injection prevention with 15+ payloads
- Path traversal protection
- Command injection prevention
- Unicode and encoding handling

### 3. Rate Limiting (`rate-limiting.test.ts`)
- API rate limits (100 requests per 15 minutes)
- Authentication rate limits (5 attempts per 15 minutes)
- WebSocket connection limits
- Rate limit bypass attempts
- Proper rate limit headers

### 4. WebSocket Security (`websocket-security.test.ts`)
- Connection authentication on port 8080
- Message type validation
- Message size limits
- Rate limiting for messages
- Connection flooding protection

### 5. Security Headers (`security-headers.test.ts`)
- Required headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Forbidden headers: X-Powered-By, Server
- Header consistency across endpoints
- Error response headers

## Configuration

All tests use centralized configuration from `config/security-test-config.ts`:

```typescript
// Environment configuration
baseUrl: 'http://localhost:3000'
wsUrl: 'ws://localhost:8080/ws/walmart/secure'

// Rate limiting
api: { maxRequests: 100, windowMs: 15 * 60 * 1000 }
auth: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }

// Security payloads
xssPayloads: ['<script>alert("XSS")</script>', ...]
sqlInjectionPayloads: ["' OR '1'='1", ...]
```

## Critical Issues Tested

### 1. WebSocket Authentication
**Issue**: WebSocket server accepts unauthenticated connections
**Test**: `websocket-security.test.ts`
**Coverage**: Connection rejection, token validation, message authentication

### 2. SQL Injection
**Issue**: Direct string concatenation in database queries
**Test**: `input-validation.test.ts`
**Coverage**: 15+ SQL injection payloads, parameterized query validation

### 3. Missing Security Headers
**Issue**: No CSP, HSTS, or X-Frame-Options headers
**Test**: `security-headers.test.ts`
**Coverage**: All required headers, forbidden headers, consistency

### 4. Console Statements
**Issue**: 29 console statements in production code
**Test**: Integrated into code analysis patterns in config
**Coverage**: Debug pattern detection, production environment validation

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Security Tests
  run: npm run test:security:ci
  
- name: Upload Security Report
  uses: actions/upload-artifact@v3
  with:
    name: security-test-report
    path: tests/security/reports/
```

### Test Reports
- **JSON Report**: `tests/security/reports/security-test-results.json`
- **JUnit XML**: `tests/security/reports/security-test-results.xml`
- **Coverage**: `tests/security/reports/coverage/`
- **Executive Summary**: Generated automatically with recommendations

## Performance Standards
- **Test Execution**: < 2 minutes for full suite
- **Individual Tests**: < 30 seconds timeout
- **Coverage Target**: 70% minimum for security-critical code
- **Parallel Execution**: Up to 4 threads

## Development Guidelines

### Adding New Security Tests
1. Create test file in `tests/security/`
2. Import configuration: `import { getSecurityTestConfig } from './config/security-test-config.js'`
3. Follow test patterns from existing files
4. Add test script to `package.json`
5. Update this README

### Test Patterns
```typescript
describe('Security Feature Tests', () => {
  let app: express.Application;
  const config = getSecurityTestConfig();

  beforeAll(async () => {
    // Setup test environment
  });

  afterAll(() => {
    // Cleanup
  });

  it('should prevent security vulnerability', async () => {
    // Test implementation
    expect(result).toMeetSecurityStandard();
  });
});
```

## Continuous Monitoring

### Automated Checks
- **Pre-commit**: Run critical security tests
- **PR Validation**: Full security test suite
- **Nightly**: Comprehensive security audit
- **Release**: Security test + penetration testing

### Alerting
- Failed security tests block deployments
- Critical vulnerabilities trigger immediate alerts
- Security test metrics tracked in monitoring dashboards

## Compliance

This test suite helps ensure compliance with:
- **OWASP Top 10** security vulnerabilities
- **CWE (Common Weakness Enumeration)** standards
- **Industry security best practices**
- **Data protection regulations**

## Support

For questions or issues:
1. Check test output and reports in `tests/security/reports/`
2. Review configuration in `config/security-test-config.ts`
3. Run individual test suites for targeted debugging
4. Review security audit documentation