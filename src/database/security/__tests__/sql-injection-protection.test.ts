/**
 * SQL Injection Protection Tests
 * Comprehensive test suite to verify SQL injection protection mechanisms
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { SqlInjectionProtection, SqlInjectionError, DatabaseInputSchemas } from '../SqlInjectionProtection.js';

describe('SqlInjectionProtection', () => {
  let sqlSecurity: SqlInjectionProtection;

  beforeEach(() => {
    sqlSecurity = new SqlInjectionProtection({
      enableStrictValidation: true,
      enableQueryLogging: false,
      enableBlacklist: true,
      maxQueryLength: 10000,
      maxParameterCount: 100
    });
  });

  describe('Parameter Validation', () => {
    test('should accept safe parameters', () => {
      const safeParams = [
        'john.doe@example.com',
        'Order #12345',
        42,
        true,
        null,
        new Date(),
        'normal string without SQL'
      ];

      const result = sqlSecurity.validateQueryParameters(safeParams);
      expect(result).toEqual(safeParams);
    });

    test('should reject SQL injection attempts in parameters', () => {
      const maliciousParams = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM passwords --",
        "'; UPDATE users SET role='admin' WHERE email='hacker@evil.com'; --"
      ];

      maliciousParams.forEach(param => {
        expect(() => {
          sqlSecurity.validateQueryParameters([param]);
        }).toThrow(SqlInjectionError);
      });
    });

    test('should handle parameter count limits', () => {
      const tooManyParams = Array(101).fill('safe value');
      
      expect(() => {
        sqlSecurity.validateQueryParameters(tooManyParams);
      }).toThrow(/Too many parameters/);
    });

    test('should sanitize special SQL characters in LIKE patterns', () => {
      const likePatterns = [
        '%test%',
        'user_%',
        'data\\%escaped'
      ];

      const result = sqlSecurity.validateQueryParameters(likePatterns);
      expect(result).toEqual(likePatterns);
    });
  });

  describe('Column Name Sanitization', () => {
    test('should accept valid column names', () => {
      const validColumns = [
        'id',
        'user_name',
        'created_at',
        'order_id',
        'product_SKU_123'
      ];

      validColumns.forEach(column => {
        const result = sqlSecurity.sanitizeColumnName(column);
        expect(result).toBe(column);
      });
    });

    test('should reject invalid column names', () => {
      const invalidColumns = [
        'user; DROP TABLE--',
        'id OR 1=1',
        'name/*comment*/',
        'field\'quoted',
        'col"quoted',
        'table.column',
        'SELECT',
        'DROP'
      ];

      invalidColumns.forEach(column => {
        expect(() => {
          sqlSecurity.sanitizeColumnName(column);
        }).toThrow(SqlInjectionError);
      });
    });

    test('should reject overly long column names', () => {
      const longColumn = 'a'.repeat(65);
      
      expect(() => {
        sqlSecurity.sanitizeColumnName(longColumn);
      }).toThrow(/Column name too long/);
    });
  });

  describe('Table Name Sanitization', () => {
    test('should accept valid table names', () => {
      const validTables = [
        'users',
        'email_logs',
        'product_inventory',
        'orders_2024'
      ];

      validTables.forEach(table => {
        const result = sqlSecurity.sanitizeTableName(table);
        expect(result).toBe(table);
      });
    });

    test('should reject malicious table names', () => {
      const maliciousTables = [
        'users; DELETE FROM users',
        'orders DROP TABLE',
        'products/**/WHERE/**/1=1'
      ];

      maliciousTables.forEach(table => {
        expect(() => {
          sqlSecurity.sanitizeTableName(table);
        }).toThrow(SqlInjectionError);
      });
    });
  });

  describe('WHERE Clause Construction', () => {
    test('should create safe WHERE clauses', () => {
      const conditions = {
        email: 'user@example.com',
        status: 'active',
        age: 25,
        verified: true
      };

      const { clause, params } = sqlSecurity.createSecureWhereClause(conditions);
      
      expect(clause).toBe('WHERE email = ? AND status = ? AND age = ? AND verified = ?');
      expect(params).toEqual(['user@example.com', 'active', 25, true]);
    });

    test('should handle NULL values', () => {
      const conditions = {
        deleted_at: null,
        user_id: 123
      };

      const { clause, params } = sqlSecurity.createSecureWhereClause(conditions);
      
      expect(clause).toBe('WHERE deleted_at IS NULL AND user_id = ?');
      expect(params).toEqual([123]);
    });

    test('should handle IN clauses with arrays', () => {
      const conditions = {
        status: ['active', 'pending', 'approved'],
        role: 'admin'
      };

      const { clause, params } = sqlSecurity.createSecureWhereClause(conditions);
      
      expect(clause).toBe('WHERE status IN (?,?,?) AND role = ?');
      expect(params).toEqual(['active', 'pending', 'approved', 'admin']);
    });

    test('should support complex operators', () => {
      const conditions = {
        age: { operator: '>', value: 18 },
        created_at: { operator: '<=', value: '2024-01-01' }
      };

      const { clause, params } = sqlSecurity.createSecureWhereClause(conditions);
      
      expect(clause).toBe('WHERE age > ? AND created_at <= ?');
      expect(params).toEqual([18, '2024-01-01']);
    });

    test('should reject invalid operators', () => {
      const conditions = {
        age: { operator: 'EVIL', value: 18 }
      };

      expect(() => {
        sqlSecurity.createSecureWhereClause(conditions);
      }).toThrow(/Invalid operator/);
    });
  });

  describe('ORDER BY Clause Construction', () => {
    test('should create safe ORDER BY clauses', () => {
      const result = sqlSecurity.createSecureOrderClause('created_at', 'DESC');
      expect(result).toBe('ORDER BY created_at DESC');
    });

    test('should default to ASC order', () => {
      const result = sqlSecurity.createSecureOrderClause('name');
      expect(result).toBe('ORDER BY name ASC');
    });

    test('should reject invalid order directions', () => {
      expect(() => {
        sqlSecurity.createSecureOrderClause('id', 'RANDOM' as any);
      }).toThrow(/Invalid order direction/);
    });
  });

  describe('Query Validation', () => {
    test('should accept safe queries', () => {
      const safeQueries = [
        'SELECT * FROM users WHERE id = ?',
        'INSERT INTO logs (message, created_at) VALUES (?, ?)',
        'UPDATE products SET price = ? WHERE id = ?',
        'DELETE FROM sessions WHERE expired_at < ?'
      ];

      safeQueries.forEach(query => {
        expect(() => {
          sqlSecurity.validateQuery(query);
        }).not.toThrow();
      });
    });

    test('should detect string concatenation patterns', () => {
      const dangerousQueries = [
        "SELECT * FROM users WHERE name = '" + "userInput" + "'",
        'SELECT * FROM products WHERE id = ' + '123',
        "UPDATE users SET role = 'admin' WHERE email = '" + "email" + "'"
      ];

      dangerousQueries.forEach(query => {
        expect(() => {
          sqlSecurity.validateQuery(query);
        }).toThrow(SqlInjectionError);
      });
    });

    test('should enforce query length limits', () => {
      const longQuery = 'SELECT ' + 'a,'.repeat(5000) + ' FROM table';
      
      expect(() => {
        sqlSecurity.validateQuery(longQuery);
      }).toThrow(/Query too long/);
    });
  });

  describe('Zod Schema Validation', () => {
    test('should validate email format', () => {
      const validEmails = [
        'user@example.com',
        'john.doe+tag@company.org'
      ];

      validEmails.forEach(email => {
        const result = DatabaseInputSchemas.email.parse(email);
        expect(result).toBe(email.toLowerCase());
      });

      expect(() => {
        DatabaseInputSchemas.email.parse('not-an-email');
      }).toThrow();
    });

    test('should validate search queries', () => {
      const validSearch = 'normal search term';
      const result = DatabaseInputSchemas.searchQuery.parse(validSearch);
      expect(result).toBe(validSearch);

      const maliciousSearches = [
        "'; DROP TABLE users--",
        'search UNION SELECT passwords',
        '<script>alert("XSS")</script>'
      ];

      maliciousSearches.forEach(search => {
        expect(() => {
          DatabaseInputSchemas.searchQuery.parse(search);
        }).toThrow(/invalid patterns/);
      });
    });

    test('should validate enum values', () => {
      expect(DatabaseInputSchemas.userRole.parse('admin')).toBe('admin');
      expect(DatabaseInputSchemas.emailPriority.parse('high')).toBe('high');
      
      expect(() => {
        DatabaseInputSchemas.userRole.parse('superadmin');
      }).toThrow();
    });
  });

  describe('Real-world Attack Scenarios', () => {
    test('should prevent classic SQL injection', () => {
      const userInput = "admin' OR '1'='1";
      
      expect(() => {
        sqlSecurity.validateQueryParameters([userInput]);
      }).toThrow(SqlInjectionError);
    });

    test('should prevent union-based injection', () => {
      const userInput = "' UNION SELECT username, password FROM users--";
      
      expect(() => {
        sqlSecurity.validateQueryParameters([userInput]);
      }).toThrow(SqlInjectionError);
    });

    test('should prevent blind SQL injection', () => {
      const userInput = "1' AND SLEEP(5)--";
      
      expect(() => {
        sqlSecurity.validateQueryParameters([userInput]);
      }).toThrow(SqlInjectionError);
    });

    test('should prevent second-order injection', () => {
      const userInput = "Robert'); DROP TABLE students;--";
      
      expect(() => {
        sqlSecurity.validateQueryParameters([userInput]);
      }).toThrow(SqlInjectionError);
    });
  });

  describe('Performance', () => {
    test('should validate parameters efficiently', () => {
      const largeParamSet = Array(50).fill('safe@email.com');
      
      const start = performance.now();
      sqlSecurity.validateQueryParameters(largeParamSet);
      const end = performance.now();
      
      // Should complete in less than 10ms
      expect(end - start).toBeLessThan(10);
    });
  });
});