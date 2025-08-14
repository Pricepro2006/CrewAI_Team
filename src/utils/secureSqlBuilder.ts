/**
 * Secure SQL Query Builder
 * Prevents SQL injection by using parameterized queries and input validation
 */

import { z } from "zod";
import Database from "better-sqlite3";

// Validation schemas for common SQL operations
const identifierSchema = z.string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid SQL identifier")
  .max(64);

const tableNameSchema = identifierSchema;
const columnNameSchema = identifierSchema;

const orderBySchema = z.enum(["ASC", "DESC", "asc", "desc"]);

const operatorSchema = z.enum(["=", "!=", "<>", ">", "<", ">=", "<=", "LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL"]);

export class SecureSQLBuilder {
  private params: any[] = [];
  private paramCounter = 0;
  
  /**
   * Validate and sanitize table name
   */
  static validateTableName(table: string): string {
    return tableNameSchema.parse(table);
  }
  
  /**
   * Validate and sanitize column name
   */
  static validateColumnName(column: string): string {
    return columnNameSchema.parse(column);
  }
  
  /**
   * Build a secure SELECT query
   */
  buildSelect(options: {
    table: string;
    columns?: string[];
    where?: Record<string, any>;
    orderBy?: { column: string; direction?: "ASC" | "DESC" }[];
    limit?: number;
    offset?: number;
  }): { sql: string; params: any[] } {
    this.params = [];
    this.paramCounter = 0;
    
    // Validate table name
    const table = SecureSQLBuilder.validateTableName(options.table);
    
    // Build column list
    let columnList = "*";
    if (options.columns && options.columns.length > 0) {
      columnList = options.columns
        .map(col => SecureSQLBuilder.validateColumnName(col))
        .join(", ");
    }
    
    // Start building query
    let sql = `SELECT ${columnList} FROM ${table}`;
    
    // Add WHERE clause
    if (options.where && Object.keys(options.where).length > 0) {
      const whereConditions = Object.entries(options.where).map(([column, value]) => {
        const validColumn = SecureSQLBuilder.validateColumnName(column);
        
        if (value === null) {
          return `${validColumn} IS NULL`;
        } else if (Array.isArray(value)) {
          const placeholders = value.map(() => "?").join(", ");
          this.params.push(...value);
          return `${validColumn} IN (${placeholders})`;
        } else {
          this.params.push(value);
          return `${validColumn} = ?`;
        }
      });
      
      sql += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    
    // Add ORDER BY clause
    if (options.orderBy && options.orderBy.length > 0) {
      const orderByParts = options.orderBy.map(({ column, direction = "ASC" }) => {
        const validColumn = SecureSQLBuilder.validateColumnName(column);
        const validDirection = orderBySchema.parse(direction);
        return `${validColumn} ${validDirection}`;
      });
      
      sql += ` ORDER BY ${orderByParts.join(", ")}`;
    }
    
    // Add LIMIT and OFFSET
    if (options.limit !== undefined) {
      sql += ` LIMIT ${parseInt(String(options.limit), 10)}`;
      
      if (options.offset !== undefined) {
        sql += ` OFFSET ${parseInt(String(options.offset), 10)}`;
      }
    }
    
    return { sql, params: this.params };
  }
  
  /**
   * Build a secure INSERT query
   */
  buildInsert(options: {
    table: string;
    data: Record<string, any>;
  }): { sql: string; params: any[] } {
    this.params = [];
    
    // Validate table name
    const table = SecureSQLBuilder.validateTableName(options.table);
    
    // Validate column names and prepare values
    const columns: string[] = [];
    const placeholders: string[] = [];
    
    Object.entries(options.data).forEach(([column, value]) => {
      const validColumn = SecureSQLBuilder.validateColumnName(column);
      columns.push(validColumn);
      placeholders.push("?");
      this.params.push(value);
    });
    
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
    
    return { sql, params: this.params };
  }
  
  /**
   * Build a secure UPDATE query
   */
  buildUpdate(options: {
    table: string;
    data: Record<string, any>;
    where: Record<string, any>;
  }): { sql: string; params: any[] } {
    this.params = [];
    
    // Validate table name
    const table = SecureSQLBuilder.validateTableName(options.table);
    
    // Build SET clause
    const setClauses: string[] = [];
    Object.entries(options.data).forEach(([column, value]) => {
      const validColumn = SecureSQLBuilder.validateColumnName(column);
      setClauses.push(`${validColumn} = ?`);
      this.params.push(value);
    });
    
    // Build WHERE clause
    const whereConditions: string[] = [];
    Object.entries(options.where).forEach(([column, value]) => {
      const validColumn = SecureSQLBuilder.validateColumnName(column);
      
      if (value === null) {
        whereConditions.push(`${validColumn} IS NULL`);
      } else {
        whereConditions.push(`${validColumn} = ?`);
        this.params.push(value);
      }
    });
    
    const sql = `UPDATE ${table} SET ${setClauses.join(", ")} WHERE ${whereConditions.join(" AND ")}`;
    
    return { sql, params: this.params };
  }
  
  /**
   * Build a secure DELETE query
   */
  buildDelete(options: {
    table: string;
    where: Record<string, any>;
  }): { sql: string; params: any[] } {
    this.params = [];
    
    // Validate table name
    const table = SecureSQLBuilder.validateTableName(options.table);
    
    // Build WHERE clause
    const whereConditions: string[] = [];
    Object.entries(options.where).forEach(([column, value]) => {
      const validColumn = SecureSQLBuilder.validateColumnName(column);
      
      if (value === null) {
        whereConditions.push(`${validColumn} IS NULL`);
      } else {
        whereConditions.push(`${validColumn} = ?`);
        this.params.push(value);
      }
    });
    
    // Require WHERE clause for DELETE to prevent accidental full table deletion
    if (whereConditions.length === 0) {
      throw new Error("DELETE query requires WHERE clause");
    }
    
    const sql = `DELETE FROM ${table} WHERE ${whereConditions.join(" AND ")}`;
    
    return { sql, params: this.params };
  }
  
  /**
   * Execute a query with the database
   */
  static execute<T = any>(
    db: Database.Database,
    queryBuilder: { sql: string; params: any[] }
  ): T[] {
    const stmt = db.prepare(queryBuilder.sql);
    return stmt.all(...queryBuilder.params) as T[];
  }
  
  /**
   * Execute a query that returns a single row
   */
  static executeOne<T = any>(
    db: Database.Database,
    queryBuilder: { sql: string; params: any[] }
  ): T | undefined {
    const stmt = db.prepare(queryBuilder.sql);
    return stmt.get(...queryBuilder.params) as T | undefined;
  }
  
  /**
   * Execute a mutation (INSERT, UPDATE, DELETE)
   */
  static executeMutation(
    db: Database.Database,
    queryBuilder: { sql: string; params: any[] }
  ): Database.RunResult {
    const stmt = db.prepare(queryBuilder.sql);
    return stmt.run(...queryBuilder.params);
  }
}

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize search query input
   */
  static sanitizeSearchQuery(query: string): string {
    // Remove SQL special characters except for wildcards in LIKE queries
    return query
      .replace(/[';\\--]/g, "") // Remove dangerous SQL characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .substring(0, 200); // Limit length
  }
  
  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(value: any): number | null {
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }
  
  /**
   * Sanitize boolean input
   */
  static sanitizeBoolean(value: any): boolean {
    return value === true || value === "true" || value === 1 || value === "1";
  }
  
  /**
   * Sanitize array input
   */
  static sanitizeArray<T>(value: any, itemSanitizer: (item: any) => T): T[] {
    if (!Array.isArray(value)) {
      return [];
    }
    
    return value.map(itemSanitizer).filter(item => item !== null && item !== undefined);
  }
  
  /**
   * Validate and sanitize UUID
   */
  static sanitizeUUID(value: string): string | null {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value) ? value.toLowerCase() : null;
  }
  
  /**
   * Escape special characters for LIKE queries
   */
  static escapeLikePattern(pattern: string): string {
    return pattern
      .replace(/\\/g, "\\\\") // Escape backslash
      .replace(/%/g, "\\%")   // Escape percent
      .replace(/_/g, "\\_");   // Escape underscore
  }
}

/**
 * Prepared statement wrapper for common queries
 */
export class SecureQueryExecutor {
  private statements: Map<string, Database.Statement> = new Map();
  
  constructor(private db: Database.Database) {}
  
  /**
   * Prepare and cache a statement
   */
  prepare(key: string, sql: string): Database.Statement {
    if (!this.statements.has(key)) {
      this.statements.set(key, this.db.prepare(sql));
    }
    return this.statements.get(key)!;
  }
  
  /**
   * Execute a cached statement
   */
  execute<T = any>(key: string, params: any[] = []): T[] {
    const stmt = this.statements.get(key);
    if (!stmt) {
      throw new Error(`Statement ${key} not prepared`);
    }
    return stmt.all(...params) as T[];
  }
  
  /**
   * Clear all cached statements
   */
  clear(): void {
    this.statements.clear();
  }
}