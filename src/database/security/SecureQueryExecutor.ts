/**
 * Secure Query Executor
 * Wraps database query execution with SQL injection protection
 */

import type * as Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";
import { sqlSecurity, SqlInjectionError } from "./SqlInjectionProtection.js";
import { executeQuery as rawExecuteQuery, executeTransaction as rawExecuteTransaction } from "../ConnectionPool.js";

export interface SecureQueryOptions {
  validateQuery?: boolean;
  validateParams?: boolean;
  logQueries?: boolean;
  maxQueryLength?: number;
}

/**
 * Execute a secure query with SQL injection protection
 */
export async function executeSecureQuery<T>(
  queryFn: (db: Database.Database) => { sql: string; params: any[] },
  options: SecureQueryOptions = {}
): Promise<T> {
  const {
    validateQuery = true,
    validateParams = true,
    logQueries = false,
    maxQueryLength = 10000
  } = options;

  return rawExecuteQuery((db: any) => {
    const { sql, params } = queryFn(db);

    try {
      // Validate query structure
      if (validateQuery) {
        sqlSecurity.validateQuery(sql);
        
        if (sql?.length || 0 > maxQueryLength) {
          throw new SqlInjectionError(
            `Query too long: ${sql?.length || 0} characters (max: ${maxQueryLength})`
          );
        }
      }

      // Validate and sanitize parameters
      const sanitizedParams = validateParams 
        ? sqlSecurity.validateQueryParameters(params)
        : params;

      // Log query if enabled (without sensitive data)
      if (logQueries) {
        logger.debug("Executing secure query", "SECURE_QUERY", {
          queryType: getQueryType(sql),
          paramCount: sanitizedParams?.length || 0,
          queryLength: sql?.length || 0,
        });
      }

      // Prepare and execute the statement
      const stmt = db.prepare(sql);
      
      // Determine which method to call based on query type
      const queryType = getQueryType(sql);
      if (queryType === "SELECT") {
        return stmt.all(...sanitizedParams) as T;
      } else if (queryType === "INSERT" || queryType === "UPDATE" || queryType === "DELETE") {
        return stmt.run(...sanitizedParams) as T;
      } else {
        return stmt.get(...sanitizedParams) as T;
      }
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error("SQL injection attempt blocked", "SECURE_QUERY", {
          error: error.message,
          suspiciousInput: error.suspiciousInput,
        });
      }
      throw error;
    }
  });
}

/**
 * Execute a secure transaction with SQL injection protection
 */
export async function executeSecureTransaction<T>(
  transactionFn: (db: Database.Database) => T,
  options: SecureQueryOptions = {}
): Promise<T> {
  return rawExecuteTransaction((db: any) => {
    // Wrap the database object to intercept prepare calls
    const secureDb = createSecureDatabase(db, options);
    return transactionFn(secureDb as any);
  });
}

/**
 * Create a secure database wrapper that validates all queries
 */
function createSecureDatabase(
  db: Database.Database,
  options: SecureQueryOptions
): any {
  return {
    ...db,
    prepare: (sql: string) => {
      // Validate query before preparing
      if (options.validateQuery !== false) {
        sqlSecurity.validateQuery(sql);
      }

      const originalStmt = db.prepare(sql);

      // Return wrapped statement that validates parameters
      return {
        ...originalStmt,
        run: (...params: any[]) => {
          const sanitizedParams = options.validateParams !== false
            ? sqlSecurity.validateQueryParameters(params)
            : params;
          return originalStmt.run(...sanitizedParams);
        },
        get: (...params: any[]) => {
          const sanitizedParams = options.validateParams !== false
            ? sqlSecurity.validateQueryParameters(params)
            : params;
          return originalStmt.get(...sanitizedParams);
        },
        all: (...params: any[]) => {
          const sanitizedParams = options.validateParams !== false
            ? sqlSecurity.validateQueryParameters(params)
            : params;
          return originalStmt.all(...sanitizedParams);
        },
      };
    },
  };
}

/**
 * Helper to build secure WHERE clauses
 */
export function buildSecureWhere(
  conditions: Record<string, any>
): { clause: string; params: any[] } {
  return sqlSecurity.createSecureWhereClause(conditions);
}

/**
 * Helper to build secure ORDER BY clauses
 */
export function buildSecureOrderBy(
  column?: string,
  direction: "ASC" | "DESC" = "ASC"
): string {
  return sqlSecurity.createSecureOrderClause(column, direction);
}

/**
 * Helper to sanitize column names for dynamic queries
 */
export function sanitizeColumnName(columnName: string): string {
  return sqlSecurity.sanitizeColumnName(columnName);
}

/**
 * Helper to sanitize table names for dynamic queries
 */
export function sanitizeTableName(tableName: string): string {
  return sqlSecurity.sanitizeTableName(tableName);
}

/**
 * Get query type from SQL string
 */
function getQueryType(sql: string): string {
  const normalizedSql = sql.trim().toUpperCase();
  
  if (normalizedSql.startsWith("SELECT")) return "SELECT";
  if (normalizedSql.startsWith("INSERT")) return "INSERT";
  if (normalizedSql.startsWith("UPDATE")) return "UPDATE";
  if (normalizedSql.startsWith("DELETE")) return "DELETE";
  if (normalizedSql.startsWith("CREATE")) return "CREATE";
  if (normalizedSql.startsWith("ALTER")) return "ALTER";
  if (normalizedSql.startsWith("DROP")) return "DROP";
  
  return "OTHER";
}

/**
 * Export secure versions of query execution functions
 */
export const secureQuery = executeSecureQuery;
export const secureTransaction = executeSecureTransaction;