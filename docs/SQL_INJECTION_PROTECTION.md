# SQL Injection Protection Guide

## Overview

This document outlines the comprehensive SQL injection protection measures implemented in the CrewAI Team application. Our multi-layered approach ensures that all database operations are secure against SQL injection attacks.

## Protection Layers

### 1. **Parameterized Queries (Primary Defense)**

All database queries use parameterized statements with placeholders:

```typescript
// ✅ SECURE: Using parameterized queries
const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?');
const result = stmt.get(email, status);

// ❌ VULNERABLE: String concatenation
const query = `SELECT * FROM users WHERE email = '${email}'`; // NEVER DO THIS
```

### 2. **Input Validation with Zod Schemas**

All user inputs are validated using strict Zod schemas before reaching the database layer:

```typescript
const EmailQueryParamsSchema = z.object({
  search: DatabaseInputSchemas.searchQuery.optional(),
  senderEmails: z.array(DatabaseInputSchemas.email).optional(),
  statuses: z.array(DatabaseInputSchemas.emailStatus).optional(),
  // ... other fields
});
```

### 3. **SqlInjectionProtection Class**

A dedicated security class that provides:
- Pattern-based detection of SQL injection attempts
- Parameter sanitization and validation
- Column and table name validation
- Query structure validation

```typescript
const sqlSecurity = new SqlInjectionProtection();
const validatedParams = sqlSecurity.validateQueryParameters(params);
```

### 4. **BaseRepository Pattern**

All repositories extend `BaseRepository` which includes built-in SQL injection protection:
- Automatic parameter validation
- Secure WHERE clause construction
- Safe ORDER BY handling
- Protection against malicious column names

## Security Features

### Pattern Detection

The system detects and blocks common SQL injection patterns:
- Classic injection: `' OR '1'='1`
- Union-based: `' UNION SELECT * FROM users`
- Comment injection: `--`, `/**/`
- Time-based blind: `SLEEP()`, `WAITFOR DELAY`
- Boolean-based blind: `AND 1=1`

### Safe Query Construction

```typescript
// Building WHERE clauses safely
const { clause, params } = sqlSecurity.createSecureWhereClause({
  email: userInput.email,
  status: 'active'
});
// Result: WHERE email = ? AND status = ?
```

### Column Name Validation

```typescript
// Only alphanumeric and underscore allowed
const safeColumn = sqlSecurity.sanitizeColumnName(columnName);
// Throws error if column name contains SQL keywords or special characters
```

## Implementation Guidelines

### DO's ✅

1. **Always use prepared statements**
   ```typescript
   const stmt = db.prepare('INSERT INTO logs (message, user_id) VALUES (?, ?)');
   stmt.run(message, userId);
   ```

2. **Validate all inputs with Zod schemas**
   ```typescript
   const validated = UserInputSchema.parse(userInput);
   ```

3. **Use the BaseRepository pattern**
   ```typescript
   class UserRepository extends BaseRepository<User> {
     // Inherits all security features
   }
   ```

4. **Parameterize dynamic queries**
   ```typescript
   const placeholders = ids.map(() => '?').join(',');
   const query = `SELECT * FROM items WHERE id IN (${placeholders})`;
   ```

### DON'TS ❌

1. **Never concatenate user input into queries**
   ```typescript
   // NEVER DO THIS
   const query = `SELECT * FROM users WHERE name = '${userName}'`;
   ```

2. **Never use template literals for SQL**
   ```typescript
   // VULNERABLE
   db.exec(`DELETE FROM logs WHERE date < '${userDate}'`);
   ```

3. **Never trust client-side validation alone**
   ```typescript
   // Always validate server-side even if client validates
   ```

4. **Never use dynamic table/column names from user input**
   ```typescript
   // DANGEROUS
   const query = `SELECT * FROM ${userTable}`;
   ```

## Testing

### SQL Injection Test Suite

Run the comprehensive test suite:
```bash
npm test src/database/security/__tests__/sql-injection-protection.test.ts
```

### Security Validation Script

Validate all SQL queries in the codebase:
```bash
npm run validate:sql-security
```

## Monitoring and Logging

All SQL injection attempts are logged:
- Pattern matched
- Source of attempt
- Timestamp
- User context (if available)

```typescript
logger.error('SQL injection attempt blocked', 'SQL_SECURITY', {
  pattern: 'UNION SELECT',
  input: sanitizedInput,
  source: 'email-query'
});
```

## Emergency Response

If a SQL injection vulnerability is discovered:

1. **Immediate Actions**
   - Enable read-only mode for affected tables
   - Review recent database logs for exploitation
   - Notify security team

2. **Remediation**
   - Apply security patch
   - Run security validation script
   - Review and update test cases
   - Audit recent database changes

3. **Post-Incident**
   - Update this documentation
   - Share learnings with team
   - Enhance monitoring for similar patterns

## Regular Security Audits

1. **Weekly**: Run automated security validation script
2. **Monthly**: Review and update SQL injection patterns
3. **Quarterly**: Penetration testing of database layer
4. **Annually**: Third-party security audit

## References

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Better-SQLite3 Security](https://github.com/WiseLibs/better-sqlite3/wiki/API#user-content-binding-parameters)

---

Last Updated: January 2025
Security Contact: security@crewai-team.com