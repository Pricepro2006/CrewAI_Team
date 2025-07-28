# Database Security Implementation

This module provides comprehensive SQL injection protection and security measures for the CrewAI Team database operations.

## Overview

The security implementation consists of multiple layers:

1. **SQL Injection Protection** - Validates queries and parameters for malicious patterns
2. **Input Validation** - Comprehensive validation of all database inputs
3. **Error Handling** - Secure error responses that don't expose database structure
4. **Security Monitoring** - Tracks and alerts on security violations
5. **Enhanced Repository Pattern** - Secure database operations with built-in protection

## Key Components

### SqlInjectionProtection

The core protection class that validates SQL queries and parameters:

```typescript
import { SqlInjectionProtection, createSqlInjectionProtection } from './SqlInjectionProtection';

const sqlSecurity = createSqlInjectionProtection({
  enableStrictValidation: true,
  enableBlacklist: true,
  maxQueryLength: 10000,
  maxParameterCount: 100
});

// Validate parameters
const safeParams = sqlSecurity.validateQueryParameters([userId, userName]);

// Validate complete query
const { query, params } = sqlSecurity.validateQueryExecution(
  'SELECT * FROM users WHERE id = ? AND name = ?',
  [1, 'John Doe']
);
```

### DatabaseErrorHandler

Handles database errors securely without exposing sensitive information:

```typescript
import { DatabaseErrorHandler } from './DatabaseErrorHandler';

try {
  // Database operation
  await repository.findById(id);
} catch (error) {
  const secureError = DatabaseErrorHandler.handleError(error, {
    operation: 'findById',
    table: 'users',
    userId: currentUser.id
  });
  
  // secureError.userMessage contains safe message for client
  // Original error details are logged securely
  throw new Error(secureError.userMessage);
}
```

### Enhanced BaseRepository

All repositories inherit from BaseRepository which includes built-in security:

```typescript
// Automatic SQL injection protection
const users = await userRepository.findAll({
  where: { name: userInput }, // Automatically validated
  orderBy: sortColumn,        // Automatically sanitized
  limit: 10
});

// Safe search functionality
const results = await userRepository.search(
  searchTerm,  // Validated for SQL injection
  ['name', 'email'], // Column names sanitized
  { limit: 20 }
);
```

### tRPC Security Middleware

Enhanced middleware for API endpoints:

```typescript
import { createEnhancedInputValidation, createDatabaseInputValidation } from './enhanced-security';

// In your tRPC router
const protectedProcedure = publicProcedure
  .use(createDatabaseInputValidation())
  .use(createEnhancedInputValidation(inputSchema));
```

## Protection Features

### SQL Injection Patterns Detected

The system detects and blocks various SQL injection patterns:

- **Basic injection**: `'; DROP TABLE users; --`
- **Union-based**: `UNION SELECT * FROM passwords`
- **Boolean-based**: `' OR 1=1 --`
- **Time-based**: `'; WAITFOR DELAY '00:00:05' --`
- **Comment injection**: `/* malicious comment */`
- **Database-specific**: `EXEC xp_cmdshell`, `sqlite_master`

### Input Validation

Comprehensive validation includes:

- Parameter type checking
- Length limits
- Character set validation
- Nested object depth limits
- Array size limits
- JSON structure validation

### Error Message Sanitization

Database errors are sanitized to prevent information disclosure:

```typescript
// Original error (not shown to client):
// "Table 'secret_table' doesn't exist"

// Sanitized error (shown to client):
// "A database error occurred. Please contact support."
```

### Security Monitoring

Built-in monitoring tracks:

- SQL injection attempts
- Invalid input patterns
- Error frequencies
- User-specific violation counts
- Performance metrics

## Configuration

### Security Configuration

```typescript
import { initializeDatabaseSecurity } from './index';

const securityManager = initializeDatabaseSecurity({
  sqlInjection: {
    enabled: true,
    strictValidation: true,
    enableBlacklist: true,
    maxQueryLength: 10000,
    maxParameterCount: 100
  },
  errorHandling: {
    exposeSensitiveErrors: false,
    logLevel: 'error',
    includeStackTrace: false
  },
  validation: {
    enforceInputValidation: true,
    maxInputSize: 1024 * 1024, // 1MB
    maxNestingDepth: 10
  },
  monitoring: {
    enabled: true,
    alertThreshold: 5,
    logSecurityEvents: true
  }
});
```

### Environment-Specific Settings

```typescript
// Development
const devConfig = {
  sqlInjection: {
    enableQueryLogging: true
  },
  errorHandling: {
    includeStackTrace: true
  }
};

// Production
const prodConfig = {
  sqlInjection: {
    enableQueryLogging: false
  },
  errorHandling: {
    exposeSensitiveErrors: false,
    includeStackTrace: false
  }
};
```

## Usage Examples

### Repository Operations

```typescript
import { UserRepository } from './repositories/UserRepository';

const userRepo = new UserRepository(db);

// All operations are automatically protected
try {
  // Safe parameter handling
  const user = await userRepo.findById(userId);
  
  // Safe search with column validation
  const users = await userRepo.search(searchTerm, ['name', 'email']);
  
  // Safe dynamic conditions
  const activeUsers = await userRepo.findAll({
    where: { 
      status: 'active',
      role: { operator: 'IN', value: ['user', 'admin'] }
    },
    orderBy: 'created_at',
    orderDirection: 'DESC'
  });
  
} catch (error) {
  // Errors are automatically sanitized
  console.error('Database operation failed:', error.message);
}
```

### tRPC Integration

```typescript
import { z } from 'zod';
import { DatabaseInputSchemas } from './security';

export const userRouter = router({
  getUser: protectedProcedure
    .input(z.object({
      id: DatabaseInputSchemas.id,
      includeProfile: z.boolean().optional()
    }))
    .query(async ({ input }) => {
      // Input is automatically validated for SQL injection
      return await userService.getUser(input.id);
    }),
    
  searchUsers: protectedProcedure
    .input(z.object({
      query: DatabaseInputSchemas.searchQuery,
      filters: z.object({
        role: DatabaseInputSchemas.userRole.optional(),
        status: DatabaseInputSchemas.userStatus.optional()
      }).optional()
    }))
    .query(async ({ input }) => {
      // Search query is validated for malicious patterns
      return await userService.searchUsers(input.query, input.filters);
    })
});
```

### Security Monitoring

```typescript
import { getDatabaseSecurityManager } from './security';

const securityManager = getDatabaseSecurityManager();

// Get security statistics
const stats = securityManager.getSecurityStatistics();
console.log('Security violations:', stats.violations);

// Reset violation counters
securityManager.resetViolationCounters('sql_injection');

// Update configuration
securityManager.updateConfig({
  monitoring: {
    alertThreshold: 3
  }
});
```

## Testing

### Running Security Tests

```bash
# Run all security tests
npm test src/database/security/__tests__/

# Run specific test suite
npm test SqlInjectionProtection.test.ts
```

### Test Coverage

The test suite covers:

- SQL injection pattern detection
- Parameter validation
- Query structure validation
- Column name sanitization
- WHERE clause building
- ORDER BY clause building
- Error handling scenarios
- Performance benchmarks

### Example Test Cases

```typescript
describe('SQL Injection Protection', () => {
  it('should block malicious SQL patterns', () => {
    const maliciousInputs = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "UNION SELECT * FROM passwords"
    ];
    
    maliciousInputs.forEach(input => {
      expect(() => {
        sqlSecurity.validateQueryParameters([input]);
      }).toThrow(SqlInjectionError);
    });
  });
  
  it('should allow safe parameters', () => {
    const safeInputs = [
      'normal string',
      'user@example.com',
      123,
      true,
      null
    ];
    
    expect(() => {
      sqlSecurity.validateQueryParameters(safeInputs);
    }).not.toThrow();
  });
});
```

## Security Best Practices

### 1. Always Use Parameterized Queries

```typescript
// ✅ Good - Parameterized
const query = 'SELECT * FROM users WHERE id = ?';
const params = [userId];

// ❌ Bad - String concatenation
const query = `SELECT * FROM users WHERE id = ${userId}`;
```

### 2. Validate All User Input

```typescript
// ✅ Good - Validated input
const validatedInput = DatabaseInputSchemas.searchQuery.parse(userInput);
const results = await repository.search(validatedInput, columns);

// ❌ Bad - Direct user input
const results = await repository.search(userInput, columns);
```

### 3. Use Type-Safe Schema Validation

```typescript
// ✅ Good - Schema validation
const schema = z.object({
  email: DatabaseInputSchemas.email,
  role: DatabaseInputSchemas.userRole
});

// ❌ Bad - No validation
const updateUser = async (data: any) => {
  // Direct use of unvalidated data
};
```

### 4. Handle Errors Securely

```typescript
// ✅ Good - Sanitized error handling
try {
  await databaseOperation();
} catch (error) {
  const secureError = DatabaseErrorHandler.handleError(error);
  throw new Error(secureError.userMessage);
}

// ❌ Bad - Exposing database details
try {
  await databaseOperation();
} catch (error) {
  throw error; // May expose sensitive database information
}
```

### 5. Monitor Security Events

```typescript
// ✅ Good - Monitor and alert
const securityManager = getDatabaseSecurityManager();
const stats = securityManager.getSecurityStatistics();

if (Object.values(stats.violations).some(v => v.count > 5)) {
  alertSecurityTeam(stats);
}
```

## Troubleshooting

### Common Issues

#### False Positives

If legitimate queries are being blocked:

1. Review the query pattern
2. Check if it matches any blacklist patterns
3. Consider updating the configuration
4. Use whitelisting for specific cases

#### Performance Impact

If security validation is affecting performance:

1. Monitor query execution times
2. Adjust validation strictness
3. Consider caching validation results
4. Profile the security overhead

#### Error Messages

If error messages are too generic:

1. Check error handling configuration
2. Review log files for detailed errors
3. Adjust logging levels for debugging
4. Use development mode for detailed errors

### Debugging

Enable detailed logging in development:

```typescript
const securityManager = initializeDatabaseSecurity({
  sqlInjection: {
    enableQueryLogging: true
  },
  errorHandling: {
    logLevel: 'debug',
    includeStackTrace: true
  }
});
```

## Maintenance

### Regular Security Updates

1. Review and update SQL injection patterns
2. Update validation rules based on new threats
3. Monitor security logs for new attack patterns
4. Update dependencies regularly

### Performance Monitoring

1. Monitor query execution times
2. Track validation overhead
3. Optimize frequently used patterns
4. Review and tune configuration

### Security Audits

1. Regular penetration testing
2. Code review for security issues
3. Dependency vulnerability scanning
4. Configuration review

## Contributing

When contributing to the security module:

1. Add comprehensive tests for new features
2. Update documentation for any changes
3. Follow secure coding practices
4. Review security implications of changes
5. Test with various attack patterns

### Adding New Validation Rules

```typescript
// Add new pattern to SQL_INJECTION_PATTERNS
private static readonly SQL_INJECTION_PATTERNS = [
  // Existing patterns...
  /new_malicious_pattern/i
];

// Add corresponding test
it('should detect new malicious pattern', () => {
  expect(() => {
    sqlSecurity.validateQueryParameters(['malicious input']);
  }).toThrow(SqlInjectionError);
});
```