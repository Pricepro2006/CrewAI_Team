/**
 * SQL Injection Protection Tests
 * Comprehensive test suite for SQL injection protection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SqlInjectionProtection, 
  SqlInjectionError, 
  DatabaseInputSchemas,
  createSqlInjectionProtection 
} from '../SqlInjectionProtection.js';

describe('SqlInjectionProtection', () => {
  let sqlSecurity: SqlInjectionProtection;

  beforeEach(() => {
    sqlSecurity = new SqlInjectionProtection({
      enableStrictValidation: true,
      enableQueryLogging: false, // Disable for tests
      enableBlacklist: true,
      maxQueryLength: 1000,
      maxParameterCount: 10
    });
  });

  describe('Parameter Validation', () => {
    it('should allow safe parameters', () => {
      const safeParams = [
        'normal string',
        123,
        true,
        null,
        undefined,
        new Date(),
        'user@example.com'
      ];

      expect(() => {
        sqlSecurity.validateQueryParameters(safeParams);
      }).not.toThrow();
    });

    it('should detect SQL injection patterns in parameters', () => {
      const maliciousParams = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM users",
        "'; INSERT INTO users VALUES (1, 'hacker'); --",
        "admin'--",
        "1; EXEC xp_cmdshell('dir'); --",
        "'; UPDATE users SET password = 'hacked' WHERE 1=1; --"
      ];

      maliciousParams.forEach(param => {
        expect(() => {
          sqlSecurity.validateQueryParameters([param]);
        }).toThrow(SqlInjectionError);
      });
    });

    it('should handle parameter count limits', () => {
      const tooManyParams = Array(15).fill('safe param');
      
      expect(() => {
        sqlSecurity.validateQueryParameters(tooManyParams);
      }).toThrow(SqlInjectionError);
    });

    it('should validate parameter length', () => {
      const longParam = 'a'.repeat(6000);
      
      expect(() => {
        sqlSecurity.validateQueryParameters([longParam]);
      }).toThrow(SqlInjectionError);
    });
  });

  describe('Query Validation', () => {
    it('should allow safe queries', () => {
      const safeQueries = [
        'SELECT * FROM users WHERE id = ?',
        'INSERT INTO users (name, email) VALUES (?, ?)',
        'UPDATE users SET name = ? WHERE id = ?',
        'DELETE FROM users WHERE id = ?'
      ];

      safeQueries.forEach(query => {
        expect(() => {
          sqlSecurity.validateQuery(query);
        }).not.toThrow();
      });
    });

    it('should detect SQL injection in queries', () => {
      const maliciousQueries = [
        "SELECT * FROM users WHERE id = 1 OR 1=1",
        "SELECT * FROM users; DROP TABLE users; --",
        "SELECT * FROM users UNION SELECT * FROM passwords",
        "SELECT * FROM users WHERE name = 'admin'--'",
        "SELECT * FROM users; INSERT INTO logs VALUES ('hacked'); --"
      ];

      maliciousQueries.forEach(query => {
        expect(() => {
          sqlSecurity.validateQuery(query);
        }).toThrow(SqlInjectionError);
      });
    });

    it('should enforce query length limits', () => {
      const longQuery = 'SELECT * FROM users WHERE ' + 'id = ? AND '.repeat(200);
      
      expect(() => {
        sqlSecurity.validateQuery(longQuery);
      }).toThrow(SqlInjectionError);
    });
  });

  describe('Column Name Sanitization', () => {
    it('should allow safe column names', () => {
      const safeColumns = [
        'id',
        'user_name',
        'email_address',
        'created_at',
        'is_active'
      ];

      safeColumns.forEach(column => {
        expect(() => {
          sqlSecurity.sanitizeColumnName(column);
        }).not.toThrow();
      });
    });

    it('should reject unsafe column names', () => {
      const unsafeColumns = [
        'id; DROP TABLE users; --',
        'name OR 1=1',
        'email\' AND 1=1 --',
        '* FROM users WHERE 1=1 --',
        'select',
        'insert',
        'delete',
        'union'
      ];

      unsafeColumns.forEach(column => {
        expect(() => {
          sqlSecurity.sanitizeColumnName(column);
        }).toThrow(SqlInjectionError);
      });
    });
  });

  describe('WHERE Clause Builder', () => {
    it('should build safe WHERE clauses', () => {
      const conditions = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        is_active: true
      };

      const result = sqlSecurity.createSecureWhereClause(conditions);
      
      expect(result.clause).toMatch(/WHERE .+ = \? AND .+ = \? AND .+ = \? AND .+ = \?/);
      expect(result.params).toHaveLength(4);
      expect(result.params).toEqual([1, 'John Doe', 'john@example.com', true]);
    });

    it('should handle array conditions safely', () => {
      const conditions = {
        id: [1, 2, 3],
        status: ['active', 'pending']
      };

      const result = sqlSecurity.createSecureWhereClause(conditions);
      
      expect(result.clause).toMatch(/WHERE .+ IN \(\?,\?,\?\) AND .+ IN \(\?,\?\)/);
      expect(result.params).toEqual([1, 2, 3, 'active', 'pending']);
    });

    it('should handle complex operators safely', () => {
      const conditions = {
        age: { operator: '>', value: 18 },
        created_at: { operator: '<=', value: '2023-01-01' }
      };

      const result = sqlSecurity.createSecureWhereClause(conditions);
      
      expect(result.clause).toMatch(/WHERE .+ > \? AND .+ <= \?/);
      expect(result.params).toEqual([18, '2023-01-01']);
    });

    it('should reject malicious WHERE conditions', () => {
      const maliciousConditions = {
        'id; DROP TABLE users; --': 1,
        'name OR 1=1': 'test'
      };

      expect(() => {
        sqlSecurity.createSecureWhereClause(maliciousConditions);
      }).toThrow(SqlInjectionError);
    });
  });

  describe('ORDER BY Clause Builder', () => {
    it('should build safe ORDER BY clauses', () => {
      const orderClause = sqlSecurity.createSecureOrderClause('name', 'ASC');
      expect(orderClause).toBe('ORDER BY name ASC');
    });

    it('should reject unsafe ORDER BY columns', () => {
      expect(() => {
        sqlSecurity.createSecureOrderClause('name; DROP TABLE users; --', 'ASC');
      }).toThrow(SqlInjectionError);
    });

    it('should reject invalid sort directions', () => {
      expect(() => {
        sqlSecurity.createSecureOrderClause('name', 'INVALID' as any);
      }).toThrow(SqlInjectionError);
    });
  });

  describe('Full Query Validation', () => {
    it('should validate complete query execution', () => {
      const query = 'SELECT * FROM users WHERE id = ? AND name = ?';
      const params = [1, 'John Doe'];

      const result = sqlSecurity.validateQueryExecution(query, params);
      
      expect(result.query).toBe(query);
      expect(result.params).toEqual(params);
    });

    it('should block malicious complete queries', () => {
      const maliciousQuery = "SELECT * FROM users WHERE id = 1 OR 1=1; --";
      const params = [];

      expect(() => {
        sqlSecurity.validateQueryExecution(maliciousQuery, params);
      }).toThrow(SqlInjectionError);
    });
  });
});

describe('DatabaseInputSchemas', () => {
  describe('Basic Input Validation', () => {
    it('should validate safe inputs', () => {
      expect(() => {
        DatabaseInputSchemas.email.parse('user@example.com');
      }).not.toThrow();

      expect(() => {
        DatabaseInputSchemas.id.parse('123e4567-e89b-12d3-a456-426614174000');
      }).not.toThrow();

      expect(() => {
        DatabaseInputSchemas.shortText.parse('Safe text content');
      }).not.toThrow();
    });

    it('should reject malicious inputs', () => {
      expect(() => {
        DatabaseInputSchemas.shortText.parse("'; DROP TABLE users; --");
      }).toThrow();

      expect(() => {
        DatabaseInputSchemas.email.parse("admin@example.com'; DROP TABLE users; --");
      }).toThrow();
    });
  });

  describe('Search Query Validation', () => {
    it('should allow safe search queries', () => {
      const safeQueries = [
        'john doe',
        'user@example.com',
        'Product Name 123',
        'normal search term'
      ];

      safeQueries.forEach(query => {
        expect(() => {
          DatabaseInputSchemas.searchQuery.parse(query);
        }).not.toThrow();
      });
    });

    it('should block malicious search queries', () => {
      const maliciousQueries = [
        'UNION SELECT * FROM users',
        'INSERT INTO users VALUES',
        'DELETE FROM users',
        'DROP TABLE users',
        'EXEC xp_cmdshell',
        '<script>alert("xss")</script>'
      ];

      maliciousQueries.forEach(query => {
        expect(() => {
          DatabaseInputSchemas.searchQuery.parse(query);
        }).toThrow();
      });
    });
  });

  describe('Column Name Validation', () => {
    it('should allow valid column names', () => {
      const validNames = [
        'id',
        'user_name',
        'email_address',
        'created_at'
      ];

      validNames.forEach(name => {
        expect(() => {
          DatabaseInputSchemas.columnName.parse(name);
        }).not.toThrow();
      });
    });

    it('should reject invalid column names', () => {
      const invalidNames = [
        'id; DROP TABLE',
        'name OR 1=1',
        'email\' --',
        'select',
        'from'
      ];

      invalidNames.forEach(name => {
        expect(() => {
          DatabaseInputSchemas.columnName.parse(name);
        }).toThrow();
      });
    });
  });

  describe('JSON Field Validation', () => {
    it('should allow valid JSON', () => {
      const validJson = [
        '{"key": "value"}',
        '["item1", "item2"]',
        '"simple string"',
        'null',
        '123'
      ];

      validJson.forEach(json => {
        expect(() => {
          DatabaseInputSchemas.jsonField.parse(json);
        }).not.toThrow();
      });
    });

    it('should reject invalid JSON', () => {
      const invalidJson = [
        '{key: "value"}', // Missing quotes
        '{"key": value}', // Missing quotes on value
        '{key": "value"}', // Missing opening quote
        'undefined',
        'function() {}'
      ];

      invalidJson.forEach(json => {
        expect(() => {
          DatabaseInputSchemas.jsonField.parse(json);
        }).toThrow();
      });
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complex nested input validation', () => {
    const complexInput = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        profile: {
          bio: 'Software developer',
          skills: ['JavaScript', 'TypeScript', 'SQL']
        }
      },
      search: {
        query: 'javascript developer',
        filters: {
          experience: { operator: '>', value: 2 },
          location: ['New York', 'San Francisco']
        }
      }
    };

    const sqlSecurity = createSqlInjectionProtection();
    
    expect(() => {
      // This would be called by the enhanced middleware
      function validateRecursively(obj: any): void {
        if (typeof obj === 'string') {
          sqlSecurity.validateQueryParameters([obj]);
        } else if (Array.isArray(obj)) {
          obj.forEach(validateRecursively);
        } else if (obj && typeof obj === 'object') {
          Object.entries(obj).forEach(([key, value]) => {
            sqlSecurity.validateQueryParameters([key]);
            validateRecursively(value);
          });
        }
      }
      
      validateRecursively(complexInput);
    }).not.toThrow();
  });

  it('should detect SQL injection in complex nested input', () => {
    const maliciousInput = {
      user: {
        name: "John'; DROP TABLE users; --",
        email: 'john@example.com'
      },
      search: {
        query: 'UNION SELECT * FROM passwords',
        filters: {
          'id OR 1=1': 'malicious'
        }
      }
    };

    const sqlSecurity = createSqlInjectionProtection();
    
    expect(() => {
      function validateRecursively(obj: any): void {
        if (typeof obj === 'string') {
          sqlSecurity.validateQueryParameters([obj]);
        } else if (Array.isArray(obj)) {
          obj.forEach(validateRecursively);
        } else if (obj && typeof obj === 'object') {
          Object.entries(obj).forEach(([key, value]) => {
            sqlSecurity.validateQueryParameters([key]);
            validateRecursively(value);
          });
        }
      }
      
      validateRecursively(maliciousInput);
    }).toThrow(SqlInjectionError);
  });
});

describe('Performance Tests', () => {
  it('should handle large safe inputs efficiently', () => {
    const largeInput = {
      items: Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`
      }))
    };

    const sqlSecurity = createSqlInjectionProtection();
    const startTime = Date.now();
    
    expect(() => {
      sqlSecurity.validateQueryParameters([JSON.stringify(largeInput)]);
    }).not.toThrow();

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should quickly detect obvious SQL injection attempts', () => {
    const obviousAttack = "'; DROP TABLE users; DELETE FROM passwords; --";
    const sqlSecurity = createSqlInjectionProtection();
    
    const startTime = Date.now();
    
    expect(() => {
      sqlSecurity.validateQueryParameters([obviousAttack]);
    }).toThrow(SqlInjectionError);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(100); // Should detect quickly
  });
});