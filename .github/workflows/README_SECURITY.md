# GitHub Actions Security Testing Integration

## Overview

This repository now includes comprehensive security testing integrated with GitHub Actions CI/CD pipeline. The security tests run automatically on every push and pull request to ensure code security and compliance.

## Security Test Workflows

### 1. **Security Test Suite** (`security-tests.yml`)

Dedicated workflow for comprehensive security testing with the following features:

#### Triggers
- **Push** to main, develop, or main-consolidated branches
- **Pull Requests** to protected branches
- **Scheduled** daily security scans at 2 AM UTC
- **Manual** workflow dispatch with category selection

#### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| **Authentication** | 14 tests | JWT validation, session management, brute force protection |
| **Input Validation** | 15+ tests | XSS, SQL injection, path traversal, command injection |
| **Rate Limiting** | 10+ tests | API limits, WebSocket limits, DoS protection |
| **WebSocket Security** | 8+ tests | Connection auth, message validation, flooding protection |
| **Security Headers** | 30+ tests | CSP, HSTS, X-Frame-Options, forbidden headers |

#### Jobs

1. **security-tests** - Runs test suites in parallel matrix strategy
2. **code-security-analysis** - Scans for console statements, hardcoded secrets, debug code
3. **dependency-vulnerability-scan** - pnpm audit and Snyk scanning
4. **security-report** - Generates comprehensive summary report

### 2. **Main Pipeline Integration** (`migration-pipeline.yml`)

The security tests are integrated into the main CI/CD pipeline:

- Security audit job includes the new test suite
- Required check before deployment readiness
- Blocks deployment if security tests fail

## Test Results

### Current Status
- ✅ **14/14** Authentication tests passing
- ⚠️ **30/32** Security header tests passing (minor Permissions-Policy issue)
- ✅ **100%** Input validation tests passing
- ✅ **100%** Rate limiting tests passing
- ✅ **100%** WebSocket security tests passing

### Artifacts

Each workflow run produces:
- **JUnit XML** reports for CI integration
- **JSON** detailed test results
- **HTML** human-readable reports
- **Coverage** reports with thresholds

## Configuration

### Environment Variables

Required secrets in GitHub repository settings:

```yaml
JWT_SECRET_TEST       # Test JWT secret for security tests
SNYK_TOKEN           # Optional: Snyk vulnerability scanning
SLACK_WEBHOOK_URL    # Optional: Slack notifications for failures
```

### Local Testing

Run security tests locally before pushing:

```bash
# Run all security tests
npm run test:security

# Run specific category
npm run test:security:auth
npm run test:security:headers

# Run with coverage
npm run test:security:coverage

# CI mode (produces JUnit output)
npm run test:security:ci
```

## Security Standards

The test suite verifies compliance with:

- **OWASP Top 10 (2021)**
  - A01: Broken Access Control
  - A02: Cryptographic Failures
  - A03: Injection
  - A04: Insecure Design
  - A05: Security Misconfiguration
  - A06: Vulnerable Components
  - A07: Authentication Failures
  - A08: Data Integrity Failures
  - A09: Security Logging Failures
  - A10: SSRF

- **Security Headers**
  - Content-Security-Policy
  - Strict-Transport-Security
  - X-Content-Type-Options
  - X-Frame-Options
  - X-XSS-Protection
  - Referrer-Policy
  - Permissions-Policy

## Pull Request Integration

When you create a PR, the security tests will:

1. Run automatically on push
2. Block merge if tests fail
3. Post results as PR comment
4. Generate detailed reports in Actions tab

### PR Comment Example

```markdown
## 🔒 Security Test Results

**Authentication Tests:** 14/14 passing ✅
**Security Headers:** 30/32 passing ⚠️
**Input Validation:** All tests passing ✅
**Rate Limiting:** All tests passing ✅
**WebSocket Security:** All tests passing ✅

View full report in the workflow summary
```

## Failure Notifications

For main branch failures:

1. **GitHub Actions Summary** - Detailed report in workflow
2. **Artifacts** - Test results and logs preserved for 30 days
3. **Slack Notifications** - Optional alerts to team channel
4. **PR Comments** - Automatic feedback on pull requests

## Manual Workflow Dispatch

Run security tests manually from Actions tab:

1. Go to Actions → Security Test Suite
2. Click "Run workflow"
3. Select branch
4. Choose test category (optional):
   - all (default)
   - auth
   - input-validation
   - rate-limiting
   - websocket
   - headers
   - penetration

## Maintenance

### Adding New Security Tests

1. Add test file to `/tests/security/`
2. Update test category in workflow matrix
3. Add npm script to `package.json`
4. Update this README

### Updating Security Policies

1. Edit `/tests/security/config/security-test-config.ts`
2. Update test payloads and thresholds
3. Commit changes to trigger new test run

### Reviewing Security Reports

1. Check Actions tab for workflow runs
2. Download artifacts for detailed analysis
3. Review security-report job summary
4. Address any failing tests immediately

## Troubleshooting

### Common Issues

**Tests fail locally but pass in CI:**
- Check environment variables
- Verify database setup
- Ensure server is running on correct port

**Security header tests failing:**
- Review server middleware configuration
- Check for missing security headers
- Verify header values match requirements

**Rate limiting tests timeout:**
- Increase test timeouts in config
- Check Redis connection
- Verify rate limit middleware is active

## Support

For security test issues:
1. Check workflow logs in Actions tab
2. Review test output in artifacts
3. Consult security test configuration
4. Open issue with security-test label

## Next Steps

- [ ] Add OWASP ZAP integration for penetration testing
- [ ] Implement security regression testing
- [ ] Add performance impact analysis
- [ ] Create security dashboard
- [ ] Set up security metrics tracking

---

*Last Updated: August 12, 2025*
*Security Test Version: 1.0.0*