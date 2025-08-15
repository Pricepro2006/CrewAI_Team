/**
 * Database Error Middleware - Handles database errors and provides graceful error responses
 * Provides comprehensive error handling for SQLite database operations
 */

import { TRPCError } from "@trpc/server";
import { logger } from "../../utils/logger.js";
import { DatabaseSchemaAdapter } from "./database-schema-adapter.js";
import type Database from "better-sqlite3";

export interface DatabaseErrorDetails {
  code: string;
  message: string;
  table?: string;
  column?: string;
  operation?: string;
  suggestion?: string;
}

export class DatabaseErrorHandler {
  constructor(
    private db: Database.Database,
    private schemaAdapter: DatabaseSchemaAdapter
  ) {}

  /**
   * Parse SQLite error and provide structured error information
   */
  private parseSqliteError(error: Error): DatabaseErrorDetails {
    const message = error?.message?.toLowerCase();
    
    // Schema-related errors
    if (message.includes('no such column')) {
      const columnMatch = error?.message?.match(/no such column: (\w+)/i);
      const tableMatch = error?.message?.match(/table (\w+)/i);
      
      return {
        code: 'COLUMN_NOT_FOUND',
        message: `Column '${columnMatch?.[1] || 'unknown'}' does not exist`,
        column: columnMatch?.[1],
        table: tableMatch?.[1],
        operation: 'SELECT/UPDATE/INSERT',
        suggestion: 'Check if the column exists in the database schema or if there was a recent schema change'
      };
    }

    if (message.includes('no such table')) {
      const tableMatch = error?.message?.match(/no such table: (\w+)/i);
      
      return {
        code: 'TABLE_NOT_FOUND',
        message: `Table '${tableMatch?.[1] || 'unknown'}' does not exist`,
        table: tableMatch?.[1],
        operation: 'TABLE_ACCESS',
        suggestion: 'Ensure the database is properly initialized and the table has been created'
      };
    }

    // Constraint violations
    if (message.includes('unique constraint failed')) {
      const constraintMatch = error?.message?.match(/unique constraint failed: (\w+\.\w+)/i);
      
      return {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'A record with this value already exists',
        column: constraintMatch?.[1]?.split('.')?.[1],
        table: constraintMatch?.[1]?.split('.')?.[0],
        operation: 'INSERT/UPDATE',
        suggestion: 'Use a different value or update the existing record instead'
      };
    }

    if (message.includes('foreign key constraint failed')) {
      return {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced record does not exist',
        operation: 'INSERT/UPDATE/DELETE',
        suggestion: 'Ensure the referenced record exists before creating this relationship'
      };
    }

    if (message.includes('not null constraint failed')) {
      const columnMatch = error?.message?.match(/not null constraint failed: (\w+\.\w+)/i);
      
      return {
        code: 'NOT_NULL_VIOLATION',
        message: 'Required field cannot be empty',
        column: columnMatch?.[1]?.split('.')?.[1],
        table: columnMatch?.[1]?.split('.')?.[0],
        operation: 'INSERT/UPDATE',
        suggestion: 'Provide a value for this required field'
      };
    }

    // Connection and database errors
    if (message.includes('database is locked')) {
      return {
        code: 'DATABASE_LOCKED',
        message: 'Database is temporarily unavailable',
        operation: 'DATABASE_ACCESS',
        suggestion: 'Wait a moment and try again. If the problem persists, check for long-running transactions'
      };
    }

    if (message.includes('database disk image is malformed')) {
      return {
        code: 'DATABASE_CORRUPTED',
        message: 'Database file is corrupted',
        operation: 'DATABASE_ACCESS',
        suggestion: 'Contact system administrator - database may need to be restored from backup'
      };
    }

    // Syntax errors
    if (message.includes('syntax error')) {
      return {
        code: 'SQL_SYNTAX_ERROR',
        message: 'Invalid SQL query format',
        operation: 'QUERY_EXECUTION',
        suggestion: 'Check the SQL query syntax for errors'
      };
    }

    // Generic database error
    return {
      code: 'DATABASE_ERROR',
      message: error.message,
      operation: 'UNKNOWN',
      suggestion: 'Please try again. If the problem persists, contact support'
    };
  }

  /**
   * Handle database error and return appropriate tRPC error
   */
  handleError(error: Error, context?: { table?: string; operation?: string }): never {
    const errorDetails = this.parseSqliteError(error);
    
    // Enhance error details with context
    if (context?.table && !errorDetails.table) {
      errorDetails.table = context.table;
    }
    if (context?.operation && !errorDetails.operation) {
      errorDetails.operation = context.operation;
    }

    // Log the error with full details
    logger.error("Database error occurred", "DB_ERROR_HANDLER", {
      originalError: error.message,
      errorCode: errorDetails.code,
      table: errorDetails.table,
      column: errorDetails.column,
      operation: errorDetails.operation,
      suggestion: errorDetails.suggestion,
      stack: error.stack
    });

    // Map to appropriate tRPC error codes
    let trpcCode: TRPCError['code'] = 'INTERNAL_SERVER_ERROR';
    let clientMessage = errorDetails.message;

    switch (errorDetails.code) {
      case 'COLUMN_NOT_FOUND':
      case 'TABLE_NOT_FOUND':
        trpcCode = 'NOT_FOUND';
        clientMessage = 'Requested data structure not found';
        break;
        
      case 'UNIQUE_CONSTRAINT_VIOLATION':
        trpcCode = 'CONFLICT';
        clientMessage = 'A record with this information already exists';
        break;
        
      case 'FOREIGN_KEY_VIOLATION':
        trpcCode = 'BAD_REQUEST';
        clientMessage = 'Invalid reference - related record not found';
        break;
        
      case 'NOT_NULL_VIOLATION':
        trpcCode = 'BAD_REQUEST';
        clientMessage = 'Missing required information';
        break;
        
      case 'DATABASE_LOCKED':
        trpcCode = 'TIMEOUT';
        clientMessage = 'Service temporarily unavailable, please try again';
        break;
        
      case 'DATABASE_CORRUPTED':
        trpcCode = 'INTERNAL_SERVER_ERROR';
        clientMessage = 'Data storage issue detected, please contact support';
        break;
        
      case 'SQL_SYNTAX_ERROR':
        trpcCode = 'INTERNAL_SERVER_ERROR';
        clientMessage = 'Query processing error';
        break;
        
      default:
        trpcCode = 'INTERNAL_SERVER_ERROR';
        clientMessage = 'A database error occurred';
    }

    // Don't expose internal details to client in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const developmentInfo = isDevelopment 
      ? ` Details: ${errorDetails}. Original: ${error.message}` 
      : '';
    
    throw new TRPCError({
      code: trpcCode,
      message: clientMessage + developmentInfo,
      cause: error,
    });
  }

  /**
   * Execute a database operation with error handling
   */
  async safeExecute<T>(
    operation: () => T,
    context?: { table?: string; operation?: string }
  ): Promise<T> {
    try {
      return operation();
    } catch (error) {
      if (error instanceof Error) {
        this.handleError(error, context);
      }
      throw error;
    }
  }

  /**
   * Execute a database query with schema validation and error handling
   */
  async executeWithSchemaValidation<T>(
    tableName: string,
    requiredColumns: string[],
    operation: () => T,
    context?: { operation?: string }
  ): Promise<T> {
    // First validate that required columns exist
    const missingColumns: string[] = [];
    
    for (const column of requiredColumns) {
      if (!this?.schemaAdapter?.columnExists(tableName, column)) {
        missingColumns.push(column);
      }
    }

    if (missingColumns?.length || 0 > 0) {
      logger.warn("Missing columns detected before operation", "DB_ERROR_HANDLER", {
        table: tableName,
        missing: missingColumns,
        required: requiredColumns
      });

      // Try to suggest alternatives or provide fallback
      const suggestion = this.getSchemaSuggestion(tableName, missingColumns);
      
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Database schema mismatch detected for table ${tableName}. Missing columns: ${missingColumns.join(', ')}. ${suggestion}`,
      });
    }

    // Execute the operation with error handling
    return this.safeExecute(operation, { table: tableName, ...context });
  }

  /**
   * Get suggestion for missing columns
   */
  private getSchemaSuggestion(tableName: string, missingColumns: string[]): string {
    const suggestions: string[] = [];
    
    for (const column of missingColumns) {
      // Common column name variations
      const variations = this.getColumnVariations(column);
      const actualColumns = this?.schemaAdapter?.getTableColumns(tableName);
      
      for (const variation of variations) {
        if (actualColumns.includes(variation)) {
          suggestions.push(`Use '${variation}' instead of '${column}'`);
          break;
        }
      }
    }

    return suggestions?.length || 0 > 0
      ? suggestions.join('; ')
      : 'Check if the database schema is up to date';
  }

  /**
   * Get possible variations of a column name
   */
  private getColumnVariations(columnName: string): string[] {
    const variations = [columnName];
    
    // Snake case to camel case
    if (columnName.includes('_')) {
      const camelCase = columnName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      variations.push(camelCase);
    }
    
    // Camel case to snake case
    if (/[A-Z]/.test(columnName)) {
      const snakeCase = columnName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      variations.push(snakeCase);
    }

    // Common column name aliases
    const aliases: Record<string, string[]> = {
      'due_date': ['dueDate', 'deadline', 'expires_at', 'end_date'],
      'dueDate': ['due_date', 'deadline', 'expires_at', 'end_date'],
      'created_at': ['createdAt', 'date_created', 'creation_date'],
      'updated_at': ['updatedAt', 'date_updated', 'modification_date'],
      'user_id': ['userId', 'owner_id', 'creator_id'],
      'list_id': ['listId', 'parent_id']
    };

    if (aliases[columnName]) {
      variations.push(...aliases[columnName]);
    }

    // Find reverse aliases
    for (const [key, values] of Object.entries(aliases)) {
      if (values.includes(columnName)) {
        variations.push(key);
      }
    }

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Get database health information
   */
  getDatabaseHealth(): {
    status: 'healthy' | 'warning' | 'error';
    details: Record<string, any>;
  } {
    try {
      // Test basic database connectivity
      const testResult = this?.db?.prepare('SELECT 1 as test').get();
      
      if (!testResult) {
        return {
          status: 'error',
          details: { error: 'Database connection test failed' }
        };
      }

      // Get database information
      const dbInfo = this?.schemaAdapter?.getDatabaseInfo();
      
      return {
        status: 'healthy',
        details: {
          connected: true,
          ...dbInfo,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error("Database health check failed", "DB_ERROR_HANDLER", { error });
      
      return {
        status: 'error',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date().toISOString()
        }
      };
    }
  }
}

// Factory function to create error handler
export function createDatabaseErrorHandler(
  db: Database.Database,
  schemaAdapter: DatabaseSchemaAdapter
): DatabaseErrorHandler {
  return new DatabaseErrorHandler(db, schemaAdapter);
}