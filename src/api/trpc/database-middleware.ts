/**
 * Database Middleware for tRPC - Integrates schema adapter and error handler
 * Provides safe database access and comprehensive error handling for all tRPC procedures
 */

import { TRPCError } from "@trpc/server";
import { logger } from "../../utils/logger.js";
import { DatabaseSchemaAdapter, createSchemaAdapter } from "./database-schema-adapter.js";
import { DatabaseErrorHandler, createDatabaseErrorHandler } from "./database-error-middleware.js";
import { getWalmartDatabaseManager } from "../../database/WalmartDatabaseManager.js";
import type { Context } from "./context.js";
import { middleware } from "./enhanced-router.js";
import type Database from "better-sqlite3";

// Extended context with database utilities
export interface DatabaseContext extends Context {
  dbAdapter: DatabaseSchemaAdapter;
  dbErrorHandler: DatabaseErrorHandler;
  safeDb: SafeDatabaseOperations;
}

export interface SafeQueryResult<T = any> {
  data: T[];
  missingColumns: string[];
  skippedColumns: string[];
  warnings: string[];
}

export interface SafeOperationResult {
  success: boolean;
  affectedRows: number;
  skippedColumns: string[];
  warnings: string[];
}

/**
 * Safe database operations wrapper
 */
export class SafeDatabaseOperations {
  constructor(
    private db: Database.Database,
    private adapter: DatabaseSchemaAdapter,
    private errorHandler: DatabaseErrorHandler
  ) {}

  /**
   * Execute a safe SELECT query
   */
  async select<T = any>(
    tableName: string,
    columns: string[] = ['*'],
    whereClause?: string,
    params: any[] = []
  ): Promise<SafeQueryResult<T>> {
    return this.errorHandler.safeExecute(() => {
      const { query, availableColumns, missingColumns } = this.adapter.createSafeSelectQuery(
        tableName,
        columns[0] === '*' ? this.adapter.getTableColumns(tableName) : columns,
        whereClause
      );

      const results = this.adapter.executeSafeQuery<T>(query, params);
      
      const warnings: string[] = [];
      if (missingColumns.length > 0) {
        warnings.push(`Missing columns: ${missingColumns.join(', ')}`);
      }

      return {
        data: results,
        missingColumns,
        skippedColumns: [],
        warnings
      };
    }, { table: tableName, operation: 'SELECT' });
  }

  /**
   * Execute a safe INSERT operation
   */
  async insert(
    tableName: string,
    data: Record<string, any>
  ): Promise<SafeOperationResult> {
    return this.errorHandler.safeExecute(() => {
      const { query, values, skippedColumns } = this.adapter.createSafeInsertQuery(tableName, data);
      
      const stmt = this.db.prepare(query);
      const result = stmt.run(...values);
      
      const warnings: string[] = [];
      if (skippedColumns.length > 0) {
        warnings.push(`Skipped invalid columns: ${skippedColumns.join(', ')}`);
      }

      logger.debug("Safe INSERT executed", "SAFE_DB_OPS", {
        table: tableName,
        affectedRows: result.changes,
        skippedColumns
      });

      return {
        success: true,
        affectedRows: result.changes,
        skippedColumns,
        warnings
      };
    }, { table: tableName, operation: 'INSERT' });
  }

  /**
   * Execute a safe UPDATE operation
   */
  async update(
    tableName: string,
    data: Record<string, any>,
    whereClause: string,
    whereParams: any[] = []
  ): Promise<SafeOperationResult> {
    return this.errorHandler.safeExecute(() => {
      const { query, values, skippedColumns } = this.adapter.createSafeUpdateQuery(
        tableName,
        data,
        whereClause
      );
      
      const allParams = [...values, ...whereParams];
      const stmt = this.db.prepare(query);
      const result = stmt.run(...allParams);
      
      const warnings: string[] = [];
      if (skippedColumns.length > 0) {
        warnings.push(`Skipped invalid columns: ${skippedColumns.join(', ')}`);
      }

      logger.debug("Safe UPDATE executed", "SAFE_DB_OPS", {
        table: tableName,
        affectedRows: result.changes,
        skippedColumns
      });

      return {
        success: true,
        affectedRows: result.changes,
        skippedColumns,
        warnings
      };
    }, { table: tableName, operation: 'UPDATE' });
  }

  /**
   * Execute a safe DELETE operation
   */
  async delete(
    tableName: string,
    whereClause: string,
    params: any[] = []
  ): Promise<SafeOperationResult> {
    return this.errorHandler.safeExecute(() => {
      const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
      
      const stmt = this.db.prepare(query);
      const result = stmt.run(...params);

      logger.debug("Safe DELETE executed", "SAFE_DB_OPS", {
        table: tableName,
        affectedRows: result.changes
      });

      return {
        success: true,
        affectedRows: result.changes,
        skippedColumns: [],
        warnings: []
      };
    }, { table: tableName, operation: 'DELETE' });
  }

  /**
   * Check if table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    return this.errorHandler.safeExecute(() => {
      const result = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(tableName);
      
      return !!result;
    }, { table: tableName, operation: 'TABLE_CHECK' });
  }

  /**
   * Get safe column list for a table
   */
  async getTableColumns(tableName: string): Promise<string[]> {
    return this.errorHandler.safeExecute(() => {
      return this.adapter.getTableColumns(tableName);
    }, { table: tableName, operation: 'SCHEMA_INFO' });
  }

  /**
   * Execute custom query with error handling
   */
  async customQuery<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    return this.errorHandler.safeExecute(() => {
      return this.adapter.executeSafeQuery<T>(query, params);
    }, { operation: 'CUSTOM_QUERY' });
  }

  /**
   * Execute a general query - alias for customQuery for backward compatibility
   */
  async query<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    return this.customQuery<T>(sql, params);
  }
}

/**
 * Create database middleware for tRPC procedures
 */
export const databaseMiddleware = middleware(async ({ ctx, next }) => {
  try {
    // Get database instance
    const dbManager = getWalmartDatabaseManager();
    const db = dbManager.getDatabase();

    // Create adapter and error handler
    const dbAdapter = createSchemaAdapter(db);
    const dbErrorHandler = createDatabaseErrorHandler(db, dbAdapter);
    const safeDb = new SafeDatabaseOperations(db, dbAdapter, dbErrorHandler);

    // Log database middleware activation
    logger.debug("Database middleware activated", "DB_MIDDLEWARE", {
      userId: ctx.user?.id,
      requestId: ctx.requestId,
      hasDatabase: !!db
    });

    // Extend context with database utilities
    const enhancedCtx: DatabaseContext = {
      ...ctx,
      dbAdapter,
      dbErrorHandler,
      safeDb
    };

    // Execute procedure with enhanced context
    const result = await next({
      ctx: enhancedCtx
    });

    // Log successful operation
    logger.debug("Database operation completed successfully", "DB_MIDDLEWARE", {
      requestId: ctx.requestId
    });

    return result;
  } catch (error) {
    // Enhanced error logging
    logger.error("Database middleware error", "DB_MIDDLEWARE", {
      error: error instanceof Error ? error.message : String(error),
      userId: ctx.user?.id,
      requestId: ctx.requestId,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Re-throw to let the error handler deal with it
    throw error;
  }
});

/**
 * Specialized middleware for operations that require specific schema validation
 */
export function createSchemaValidatedMiddleware(
  requiredTables: Record<string, string[]> // table -> required columns
) {
  return middleware(async ({ ctx, next }) => {
    // Apply database enhancements to context
    const dbManager = getWalmartDatabaseManager();
    const dbAdapter = createSchemaAdapter(dbManager.getDatabase());
    const dbErrorHandler = createDatabaseErrorHandler(dbManager.getDatabase(), dbAdapter);
    
    const databaseCtx: DatabaseContext = {
      ...ctx,
      dbAdapter,
      dbErrorHandler,
      safeDb: new SafeDatabaseOperations(dbManager.getDatabase(), dbAdapter, dbErrorHandler)
    };
      
      // Validate required schema
      const validationErrors: string[] = [];
      
      for (const [tableName, requiredColumns] of Object.entries(requiredTables)) {
        for (const column of requiredColumns) {
          if (!databaseCtx.dbAdapter.columnExists(tableName, column)) {
            validationErrors.push(`Missing column '${column}' in table '${tableName}'`);
          }
        }
      }

      if (validationErrors.length > 0) {
        logger.error("Schema validation failed", "SCHEMA_VALIDATION", {
          errors: validationErrors,
          requiredSchema: requiredTables
        });

        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Database schema validation failed: ${validationErrors.join(', ')}`,
        });
      }

    return next({ ctx: databaseCtx });
  });
}

/**
 * Middleware specifically for Walmart grocery database operations
 */
export const walmartDatabaseMiddleware = createSchemaValidatedMiddleware({
  walmart_products: ['id', 'product_id', 'name', 'current_price', 'in_stock'],
  grocery_lists: ['id', 'user_id', 'name'],
  grocery_items: ['id', 'list_id', 'quantity']
});

/**
 * Helper function to safely access database columns with fallbacks
 */
export function safeColumnAccess<T>(
  row: any,
  columnName: string,
  fallback: T
): T {
  if (row && row.hasOwnProperty(columnName) && row[columnName] !== undefined) {
    return row[columnName];
  }
  return fallback;
}

/**
 * Type-safe database operation wrapper
 */
export function withDatabaseContext<TInput, TOutput>(
  operation: (ctx: DatabaseContext, input: TInput) => Promise<TOutput>
) {
  return async (ctx: Context, input: TInput): Promise<TOutput> => {
    // Ensure database context is available
    if (!('safeDb' in ctx)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database context not available. Ensure database middleware is applied.'
      });
    }

    return operation(ctx as DatabaseContext, input);
  };
}