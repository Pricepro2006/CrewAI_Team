/**
 * SQL Injection Protection Layer
 * Comprehensive protection against SQL injection attacks
 */

import { z } from "zod";
import { logger } from "../../utils/logger.js";

export interface SqlSecurityConfig {
  enableStrictValidation: boolean;
  enableQueryLogging: boolean;
  enableBlacklist: boolean;
  maxQueryLength: number;
  maxParameterCount: number;
}

export class SqlInjectionError extends Error {
  constructor(
    message: string,
    public readonly suspiciousInput?: string,
  ) {
    super(message);
    this.name = "SqlInjectionError";
  }
}

/**
 * SQL Injection Protection Utility
 */
export class SqlInjectionProtection {
  private static readonly SQL_INJECTION_PATTERNS = [
    // Basic SQL injection patterns
    /('|(%27)|(%2527))/i,
    /((%3D)|(=))[^\n]*(((%27)|')|(--)|(%3B)|(;))/i,
    /\w*((%27)|('))((%6F)|o|(%4F))((%72)|r|(%52))/i,
    /((%27)|(''))union/i,
    /((%27)|('))\s*((%6F)|o|(%4F))((%72)|r|(%52))/i,
    /((%27)|('))\s*((%41)|a|(%61))((%4E)|n|(%6E))((%44)|d|(%64))/i,
    /((%27)|('))\s*((%4F)|o|(%6F))((%52)|r|(%72))/i,

    // Advanced patterns
    /exec(\s|\+)+(s|x)p\w+/i,
    /union\s+.*select/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /update\s+.*set/i,
    /drop\s+(table|database|schema)/i,
    /alter\s+(table|database|schema)/i,
    /create\s+(table|database|schema|user)/i,
    /grant\s+/i,
    /revoke\s+/i,

    // Database specific functions
    /xp_cmdshell/i,
    /sp_executesql/i,
    /information_schema/i,
    /sys\.(tables|columns|databases)/i,
    /sqlite_master/i,
    /pragma\s+/i,

    // Boolean-based blind injection
    /\s+(and|or)\s+\d+\s*=\s*\d+/i,
    /\s+(and|or)\s+\w+\s*=\s*\w+/i,

    // Time-based blind injection
    /waitfor\s+delay/i,
    /sleep\s*\(/i,
    /benchmark\s*\(/i,

    // Comment injection
    /\/\*.*\*\//,
    /--[^\r\n]*/,
    /#[^\r\n]*/,
  ];

  private static readonly ALLOWED_COLUMN_CHARS = /^[a-zA-Z0-9_]+$/;
  private static readonly ALLOWED_TABLE_CHARS = /^[a-zA-Z0-9_]+$/;

  private config: SqlSecurityConfig;

  constructor(config: Partial<SqlSecurityConfig> = {}) {
    this.config = {
      enableStrictValidation: true,
      enableQueryLogging: true,
      enableBlacklist: true,
      maxQueryLength: 10000,
      maxParameterCount: 100,
      ...config,
    };
  }

  /**
   * Validate and sanitize SQL query parameters
   */
  validateQueryParameters(params: any[]): any[] {
    if (params?.length || 0 > this?.config?.maxParameterCount) {
      throw new SqlInjectionError(
        `Too many parameters: ${params?.length || 0} (max: ${this?.config?.maxParameterCount})`,
      );
    }

    return params?.map((param, index) => {
      try {
        return this.sanitizeParameter(param);
      } catch (error) {
        logger.error("Parameter validation failed", "SQL_SECURITY", {
          parameterIndex: index,
          parameterValue:
            typeof param === "string" ? param.substring(0, 100) : param,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new SqlInjectionError(
          `Invalid parameter at index ${index}: ${error instanceof Error ? error.message : String(error)}`,
          typeof param === "string" ? param : undefined,
        );
      }
    });
  }

  /**
   * Sanitize individual parameter
   */
  private sanitizeParameter(param: any): any {
    if (param === null || param === undefined) {
      return param;
    }

    if (typeof param === "string") {
      // Check for suspicious patterns
      if (this?.config?.enableBlacklist && this.containsSqlInjection(param)) {
        throw new SqlInjectionError("Suspicious SQL pattern detected", param);
      }

      // Validate length
      if (param?.length || 0 > 5000) {
        // Individual parameter limit
        throw new SqlInjectionError("Parameter too long");
      }

      return param;
    }

    if (typeof param === "number") {
      if (!Number.isFinite(param)) {
        throw new SqlInjectionError("Invalid number parameter");
      }
      return param;
    }

    if (typeof param === "boolean") {
      return param;
    }

    if (param instanceof Date) {
      return param.toISOString();
    }

    // For other types, convert to string and validate
    const stringParam = String(param);
    if (this?.config?.enableBlacklist && this.containsSqlInjection(stringParam)) {
      throw new SqlInjectionError(
        "Suspicious SQL pattern in parameter",
        stringParam,
      );
    }

    return stringParam;
  }

  /**
   * Check if input contains SQL injection patterns
   */
  private containsSqlInjection(input: string): boolean {
    const normalizedInput = input.toLowerCase().trim();

    return SqlInjectionProtection?.SQL_INJECTION_PATTERNS?.some((pattern: any) =>
      pattern.test(normalizedInput),
    );
  }

  /**
   * Validate SQL query structure
   */
  validateQuery(query: string): void {
    if (!query || typeof query !== "string") {
      throw new SqlInjectionError("Invalid query: must be a non-empty string");
    }

    if (query?.length || 0 > this?.config?.maxQueryLength) {
      throw new SqlInjectionError(
        `Query too long: ${query?.length || 0} (max: ${this?.config?.maxQueryLength})`,
      );
    }

    // Check for suspicious patterns in the query structure
    if (this?.config?.enableBlacklist && this.containsSqlInjection(query)) {
      logger.warn("Suspicious SQL query detected", "SQL_SECURITY", {
        queryPreview: query.substring(0, 200),
        queryLength: query?.length || 0,
      });
      throw new SqlInjectionError(
        "Suspicious SQL pattern detected in query",
        query.substring(0, 100),
      );
    }

    // Validate that query uses parameterized structure
    if (this?.config?.enableStrictValidation) {
      this.validateParameterizedQuery(query);
    }

    if (this?.config?.enableQueryLogging) {
      logger.debug("SQL query validated", "SQL_SECURITY", {
        queryType: this.getQueryType(query),
        queryLength: query?.length || 0,
        parameterCount: (query.match(/\?/g) || []).length,
      });
    }
  }

  /**
   * Validate that query uses proper parameterization
   */
  private validateParameterizedQuery(query: string): void {
    const normalizedQuery = query.toLowerCase().trim();

    // Check for string concatenation patterns that might indicate injection
    const dangerousPatterns = [
      /\+\s*['"`]/, // String concatenation
      /\|\|\s*['"`]/, // String concatenation (Oracle/PostgreSQL)
      /concat\s*\(/i, // CONCAT function with user input
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalizedQuery)) {
        throw new SqlInjectionError(
          "Query appears to use string concatenation instead of parameters",
        );
      }
    }
  }

  /**
   * Get query type for logging
   */
  private getQueryType(query: string): string {
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.startsWith("select")) return "SELECT";
    if (normalizedQuery.startsWith("insert")) return "INSERT";
    if (normalizedQuery.startsWith("update")) return "UPDATE";
    if (normalizedQuery.startsWith("delete")) return "DELETE";
    if (normalizedQuery.startsWith("create")) return "CREATE";
    if (normalizedQuery.startsWith("alter")) return "ALTER";
    if (normalizedQuery.startsWith("drop")) return "DROP";
    if (normalizedQuery.startsWith("pragma")) return "PRAGMA";

    return "OTHER";
  }

  /**
   * Sanitize column name for ORDER BY and similar clauses
   */
  sanitizeColumnName(columnName: string): string {
    if (!columnName || typeof columnName !== "string") {
      throw new SqlInjectionError(
        "Invalid column name: must be a non-empty string",
      );
    }

    const sanitized = columnName.trim();

    // Allow only alphanumeric characters, underscores, and dots
    if (!SqlInjectionProtection?.ALLOWED_COLUMN_CHARS?.test(sanitized)) {
      throw new SqlInjectionError(
        "Invalid column name: contains invalid characters",
        sanitized,
      );
    }

    // Check length
    if (sanitized?.length || 0 > 64) {
      // Standard SQL column name limit
      throw new SqlInjectionError("Column name too long");
    }

    // Check for SQL keywords that shouldn't be column names
    const sqlKeywords = [
      "select",
      "insert",
      "update",
      "delete",
      "drop",
      "create",
      "alter",
      "union",
      "where",
      "having",
      "group",
      "order",
      "limit",
      "offset",
    ];

    if (sqlKeywords.includes(sanitized.toLowerCase())) {
      throw new SqlInjectionError(
        "Column name conflicts with SQL keyword",
        sanitized,
      );
    }

    return sanitized;
  }

  /**
   * Sanitize table name
   */
  sanitizeTableName(tableName: string): string {
    if (!tableName || typeof tableName !== "string") {
      throw new SqlInjectionError(
        "Invalid table name: must be a non-empty string",
      );
    }

    const sanitized = tableName.trim();

    if (!SqlInjectionProtection?.ALLOWED_TABLE_CHARS?.test(sanitized)) {
      throw new SqlInjectionError(
        "Invalid table name: contains invalid characters",
        sanitized,
      );
    }

    if (sanitized?.length || 0 > 64) {
      throw new SqlInjectionError("Table name too long");
    }

    return sanitized;
  }

  /**
   * Create secure WHERE clause with parameterized conditions
   */
  createSecureWhereClause(conditions: Record<string, any>): {
    clause: string;
    params: any[];
  } {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { clause: "", params: [] };
    }

    const clauses: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      const sanitizedKey = this.sanitizeColumnName(key);

      if (value === null || value === undefined) {
        clauses.push(`${sanitizedKey} IS NULL`);
      } else if (Array.isArray(value)) {
        if (value?.length || 0 === 0) {
          clauses.push("1=0"); // No match condition
        } else {
          const placeholders = value?.map(() => "?").join(",");
          clauses.push(`${sanitizedKey} IN (${placeholders})`);
          params.push(...this.validateQueryParameters(value));
        }
      } else if (typeof value === "object" && value.operator) {
        // Support for complex conditions like { operator: '>', value: 100 }
        const { operator, value: conditionValue } = value;

        // Validate operator
        const allowedOperators = [
          "=",
          "!=",
          "<>",
          "<",
          ">",
          "<=",
          ">=",
          "LIKE",
          "NOT LIKE",
        ];
        if (!allowedOperators.includes(operator.toUpperCase())) {
          throw new SqlInjectionError(`Invalid operator: ${operator}`);
        }

        clauses.push(`${sanitizedKey} ${operator} ?`);
        params.push(...this.validateQueryParameters([conditionValue]));
      } else {
        clauses.push(`${sanitizedKey} = ?`);
        params.push(...this.validateQueryParameters([value]));
      }
    }

    return {
      clause: `WHERE ${clauses.join(" AND ")}`,
      params,
    };
  }

  /**
   * Create secure ORDER BY clause
   */
  createSecureOrderClause(
    orderBy?: string,
    orderDirection: "ASC" | "DESC" = "ASC",
  ): string {
    if (!orderBy) {
      return "ORDER BY id ASC";
    }

    const sanitizedColumn = this.sanitizeColumnName(orderBy);

    // Validate order direction
    if (!["ASC", "DESC"].includes(orderDirection.toUpperCase())) {
      throw new SqlInjectionError(`Invalid order direction: ${orderDirection}`);
    }

    return `ORDER BY ${sanitizedColumn} ${orderDirection.toUpperCase()}`;
  }

  /**
   * Validate and execute query with comprehensive protection
   */
  validateQueryExecution(
    query: string,
    params: any[] = [],
  ): { query: string; params: any[] } {
    try {
      // Validate query structure
      this.validateQuery(query);

      // Validate and sanitize parameters
      const sanitizedParams = this.validateQueryParameters(params);

      return { query, params: sanitizedParams };
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error("SQL injection attempt blocked", "SQL_SECURITY", {
          error: error.message,
          suspiciousInput: error.suspiciousInput,
          queryPreview: query.substring(0, 100),
        });
      }
      throw error;
    }
  }
}

/**
 * Zod schemas for database input validation
 */
export const DatabaseInputSchemas = {
  // Basic types
  id: z.string().uuid("Invalid ID format"),

  // Text fields with length limits
  shortText: z.string().min(1).max(255).trim(),
  mediumText: z.string().min(1).max(1000).trim(),
  longText: z.string().min(1).max(10000).trim(),

  // SQL-safe identifiers
  columnName: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/, "Invalid column name format"),

  tableName: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/, "Invalid table name format"),

  // Email validation
  email: z.string().email().toLowerCase().trim(),

  // Date validation
  isoDate: z.string().datetime("Invalid ISO date format"),

  // Numeric validation
  positiveInteger: z.number().int().positive(),
  nonNegativeInteger: z.number().int().min(0),
  currency: z.number().min(0).max(999999999.99),

  // Enums for controlled values
  userRole: z.enum(["admin", "manager", "user", "viewer"]),
  userStatus: z.enum(["active", "inactive", "suspended"]),
  emailStatus: z.enum(["new", "in_progress", "completed", "archived"]),
  emailPriority: z.enum(["critical", "high", "medium", "low"]),
  dealStatus: z.enum(["active", "expired", "pending", "cancelled"]),
  taskStatus: z.enum([
    "pending",
    "in_progress",
    "completed",
    "cancelled",
    "blocked",
  ]),

  // Complex object validation
  jsonField: z.string().refine((val: any) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, "Invalid JSON format"),

  // Search query validation
  searchQuery: z
    .string()
    .min(1)
    .max(500)
    .trim()
    .refine((val: any) => {
      // Block obviously malicious search terms
      const maliciousPatterns = [
        /union\s+select/i,
        /insert\s+into/i,
        /delete\s+from/i,
        /drop\s+table/i,
        /exec\s+/i,
        /script\s*>/i,
      ];
      return !maliciousPatterns.some((pattern: any) => pattern.test(val));
    }, "Search query contains invalid patterns"),
};

/**
 * Factory function to create SQL injection protection instance
 */
export function createSqlInjectionProtection(
  config?: Partial<SqlSecurityConfig>,
): SqlInjectionProtection {
  return new SqlInjectionProtection(config);
}

// Export singleton instance for common use
export const sqlSecurity = new SqlInjectionProtection();
