# Security Guidelines for CrewAI Team

## JWT Secret Configuration

### Overview
The JWT (JSON Web Token) secret is a critical security component used to sign and verify authentication tokens. A compromised JWT secret allows attackers to forge valid tokens and impersonate any user.

### Requirements

#### Production Environment
- **Mandatory**: JWT_SECRET must be set
- **Minimum length**: 32 characters (64+ recommended)
- **Character diversity**: At least 8 unique characters
- **Forbidden patterns**: No default values, common words, or predictable patterns

#### Development Environment
- JWT_SECRET is optional (auto-generated if missing)
- Warnings issued for insecure secrets
- Allows faster development iteration

### Generating a Secure JWT Secret

Use the provided utility script:

```bash
node scripts/generate-jwt-secret.js
```

This generates a cryptographically secure 64-character secret suitable for production use.

### Security Validation

The UserService performs comprehensive JWT secret validation:

1. **Existence Check**: Ensures JWT_SECRET is set in production
2. **Pattern Matching**: Blocks common insecure patterns like "secret", "password", "123456"
3. **Length Validation**: Enforces minimum 32 characters in production
4. **Entropy Check**: Ensures sufficient character diversity
5. **Environment-Aware**: Strict in production, lenient in development

### Best Practices

1. **Never commit secrets**: Add .env to .gitignore
2. **Use different secrets per environment**: Dev, staging, and production should have unique secrets
3. **Rotate regularly**: Change JWT secrets periodically
4. **Store securely**: Use environment variables or secure vaults
5. **Monitor usage**: Log authentication failures and suspicious patterns

### Error Messages

| Error | Environment | Cause | Solution |
|-------|-------------|-------|----------|
| "JWT_SECRET environment variable is not set" | Production | Missing JWT_SECRET | Set JWT_SECRET in .env |
| "JWT_SECRET contains insecure or default values" | Production | Using forbidden patterns | Generate new secret with script |
| "JWT_SECRET is too short" | Production | Less than 32 characters | Use longer secret |
| "JWT_SECRET has insufficient character diversity" | Production | Less than 8 unique chars | Use more diverse characters |

### Implementation Details

The security validation is implemented in:
- **File**: `src/api/services/UserService.ts`
- **Method**: `initializeJwtSecret()`
- **Tests**: `src/api/services/__tests__/UserService.security.test.ts`

### Logging

All JWT security events are logged with appropriate severity:
- **CRITICAL**: Production failures that prevent startup
- **HIGH**: Security issues that should be addressed immediately
- **MEDIUM**: Warnings about suboptimal configurations
- **INFO**: Successful initialization

Logs include recommendations without exposing the actual secret value.

### Migration Guide

If upgrading from a version with hardcoded secrets:

1. Generate a new secure secret:
   ```bash
   node scripts/generate-jwt-secret.js
   ```

2. Update your .env file:
   ```env
   JWT_SECRET=<generated-secret>
   ```

3. Restart the application

4. Monitor logs for security validation results

### Testing

Run security tests:
```bash
pnpm test src/api/services/__tests__/UserService.security.test.ts
```

The test suite validates:
- Production enforcement of all security rules
- Development flexibility
- Edge cases and boundary conditions
- Proper error messages

### Compliance

This implementation helps meet common security requirements:
- **OWASP**: Proper secret management
- **PCI DSS**: Strong cryptographic keys
- **SOC 2**: Access control and key management
- **ISO 27001**: Information security controls