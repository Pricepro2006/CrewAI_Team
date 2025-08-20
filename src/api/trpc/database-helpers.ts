/**
 * Database Helper Utilities - Common database operation patterns with schema safety
 * Provides high-level database operations for common use cases
 */

import { TRPCError } from "@trpc/server";
import { logger } from "../../utils/logger.js";
import type { DatabaseContext, SafeQueryResult, SafeOperationResult } from "./database-middleware.js";
import { safeColumnAccess } from "./database-middleware.js";

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface FilterOptions {
  [key: string]: any;
}

export interface DatabaseQueryOptions {
  pagination?: PaginationOptions;
  sort?: SortOptions;
  filters?: FilterOptions;
  columns?: string[];
}

/**
 * Database helper class with common patterns
 */
export class DatabaseHelpers {
  constructor(private ctx: DatabaseContext) {}

  /**
   * Get paginated and filtered results from a table
   */
  async getPaginatedResults<T = any>(
    tableName: string,
    options: DatabaseQueryOptions = {}
  ): Promise<{
    data: T[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    warnings: string[];
  }> {
    const {
      pagination = { page: 1, limit: 10 },
      sort,
      filters,
      columns = ['*']
    } = options;

    // Normalize pagination
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 10));
    const offset = (page - 1) * limit;

    // Build WHERE clause from filters
    const whereConditions: string[] = [];
    const whereParams: any[] = [];

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          // Check if column exists before adding to where clause
          if (this?.ctx?.dbAdapter.columnExists(tableName, key)) {
            whereConditions.push(`${key} = ?`);
            whereParams.push(value);
          } else {
            logger.warn(`Skipping filter for non-existent column`, "DB_HELPERS", {
              table: tableName,
              column: key,
              value
            });
          }
        }
      }
    }

    const whereClause = whereConditions?.length || 0 > 0 
      ? whereConditions.join(' AND ')
      : '1=1';

    // Build sort clause
    let sortClause = '';
    if (sort && this?.ctx?.dbAdapter.columnExists(tableName, sort.column)) {
      sortClause = `ORDER BY ${sort.column} ${sort.direction}`;
    } else if (sort) {
      logger.warn(`Skipping sort for non-existent column`, "DB_HELPERS", {
        table: tableName,
        column: sort.column
      });
    }

    // Get total count
    const countResult = await this?.ctx?.safeDb.customQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`,
      whereParams
    );

    const totalCount = countResult[0]?.count || 0;

    // Get paginated data
    const dataQuery = `
      SELECT ${columns.join(', ')} 
      FROM ${tableName} 
      WHERE ${whereClause}
      ${sortClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const dataResult = await this?.ctx?.safeDb.customQuery<T>(dataQuery, whereParams);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data: dataResult,
      totalCount,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      warnings: []
    };
  }

  /**
   * Create a record with automatic timestamp handling
   */
  async createRecord(
    tableName: string,
    data: Record<string, any>,
    options: { includeTimestamps?: boolean; timestampColumns?: { created?: string; updated?: string } } = {}
  ): Promise<SafeOperationResult & { insertedId?: string }> {
    const { includeTimestamps = true, timestampColumns = { created: 'created_at', updated: 'updated_at' } } = options;

    const recordData = { ...data };

    // Add timestamps if enabled and columns exist
    if (includeTimestamps) {
      const now = new Date().toISOString();
      
      if (timestampColumns.created && this?.ctx?.dbAdapter.columnExists(tableName, timestampColumns.created)) {
        recordData[timestampColumns.created] = now;
      }
      
      if (timestampColumns.updated && this?.ctx?.dbAdapter.columnExists(tableName, timestampColumns.updated)) {
        recordData[timestampColumns.updated] = now;
      }
    }

    const result = await this?.ctx?.safeDb.insert(tableName, recordData);

    // Try to get the inserted record's ID if possible
    let insertedId: string | undefined;
    try {
      const lastInsertResult = await this?.ctx?.safeDb.customQuery<{ id: string }>(
        'SELECT last_insert_rowid() as id'
      );
      insertedId = lastInsertResult[0]?.id;
    } catch (error) {
      // Ignore error - ID retrieval is optional
      logger.debug("Could not retrieve inserted ID", "DB_HELPERS", { error });
    }

    return {
      ...result,
      insertedId
    };
  }

  /**
   * Update a record with automatic timestamp handling
   */
  async updateRecord(
    tableName: string,
    id: string,
    data: Record<string, any>,
    options: { 
      includeTimestamps?: boolean; 
      timestampColumns?: { updated?: string };
      idColumn?: string;
    } = {}
  ): Promise<SafeOperationResult> {
    const { 
      includeTimestamps = true, 
      timestampColumns = { updated: 'updated_at' },
      idColumn = 'id'
    } = options;

    const updateData = { ...data };

    // Add update timestamp if enabled and column exists
    if (includeTimestamps && timestampColumns.updated) {
      if (this?.ctx?.dbAdapter.columnExists(tableName, timestampColumns.updated)) {
        updateData[timestampColumns.updated] = new Date().toISOString();
      }
    }

    const result = await this?.ctx?.safeDb.update(
      tableName,
      updateData,
      `${idColumn} = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Record with ${idColumn} '${id}' not found in ${tableName}`
      });
    }

    return result;
  }

  /**
   * Delete a record by ID
   */
  async deleteRecord(
    tableName: string,
    id: string,
    options: { idColumn?: string } = {}
  ): Promise<SafeOperationResult> {
    const { idColumn = 'id' } = options;

    const result = await this?.ctx?.safeDb.delete(
      tableName,
      `${idColumn} = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Record with ${idColumn} '${id}' not found in ${tableName}`
      });
    }

    return result;
  }

  /**
   * Check if a record exists
   */
  async recordExists(
    tableName: string,
    id: string,
    options: { idColumn?: string } = {}
  ): Promise<boolean> {
    const { idColumn = 'id' } = options;

    const result = await this?.ctx?.safeDb.select(
      tableName,
      [idColumn],
      `${idColumn} = ?`,
      [id]
    );

    return result?.data?.length > 0;
  }

  /**
   * Get a single record by ID with safe column access
   */
  async getRecord<T = any>(
    tableName: string,
    id: string,
    options: { 
      columns?: string[];
      idColumn?: string;
      required?: boolean;
    } = {}
  ): Promise<T | null> {
    const { 
      columns = ['*'],
      idColumn = 'id',
      required = false
    } = options;

    const result = await this?.ctx?.safeDb.select(
      tableName,
      columns,
      `${idColumn} = ?`,
      [id]
    );

    if (result?.data?.length === 0) {
      if (required) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Record with ${idColumn} '${id}' not found in ${tableName}`
        });
      }
      return null;
    }

    return result.data[0] as T;
  }

  /**
   * Execute a transaction with proper error handling
   */
  async executeTransaction<T>(
    operations: () => Promise<T>
  ): Promise<T> {
    try {
      // Begin transaction
      await this?.ctx?.safeDb.customQuery('BEGIN TRANSACTION');
      
      logger.debug("Transaction started", "DB_HELPERS");

      // Execute operations
      const result = await operations();

      // Commit transaction
      await this?.ctx?.safeDb.customQuery('COMMIT');
      
      logger.debug("Transaction committed successfully", "DB_HELPERS");

      return result;
    } catch (error) {
      // Rollback transaction on error
      try {
        await this?.ctx?.safeDb.customQuery('ROLLBACK');
        logger.debug("Transaction rolled back due to error", "DB_HELPERS");
      } catch (rollbackError) {
        logger.error("Failed to rollback transaction", "DB_HELPERS", { rollbackError });
      }

      logger.error("Transaction failed", "DB_HELPERS", { error });
      throw error;
    }
  }

  /**
   * Search records with text matching (safe LIKE operation)
   */
  async searchRecords<T = any>(
    tableName: string,
    searchTerm: string,
    searchColumns: string[],
    options: DatabaseQueryOptions = {}
  ): Promise<{
    data: T[];
    totalCount: number;
    searchTerm: string;
    searchedColumns: string[];
    warnings: string[];
  }> {
    // Filter search columns to only include existing ones
    const validColumns = searchColumns?.filter(col => 
      this?.ctx?.dbAdapter.columnExists(tableName, col)
    );

    if (validColumns?.length || 0 === 0) {
      logger.warn("No valid search columns found", "DB_HELPERS", {
        table: tableName,
        requestedColumns: searchColumns
      });

      return {
        data: [],
        totalCount: 0,
        searchTerm,
        searchedColumns: validColumns,
        warnings: [`No valid search columns found in table ${tableName}`]
      };
    }

    // Build search conditions
    const searchConditions = validColumns?.map(col => `${col} LIKE ?`).join(' OR ');
    const searchParams = validColumns?.map(() => `%${searchTerm}%`);

    // Add search filters to existing filters
    const searchFilters = {
      ...options.filters,
      [Symbol.for('searchCondition')]: {
        condition: searchConditions,
        params: searchParams
      }
    };

    // Get paginated results with search
    const result = await this.getPaginatedResults<T>(tableName, {
      ...options,
      filters: searchFilters
    });

    return {
      data: result.data,
      totalCount: result.totalCount,
      searchTerm,
      searchedColumns: validColumns,
      warnings: result.warnings
    };
  }
}

/**
 * Factory function to create database helpers
 */
export function createDatabaseHelpers(ctx: DatabaseContext): DatabaseHelpers {
  return new DatabaseHelpers(ctx);
}

/**
 * Higher-order function to wrap tRPC procedures with database helpers
 */
export function withDatabaseHelpers<TInput, TOutput>(
  operation: (helpers: DatabaseHelpers, input: TInput) => Promise<TOutput>
) {
  return async (ctx: DatabaseContext, input: TInput): Promise<TOutput> => {
    const helpers = createDatabaseHelpers(ctx);
    return operation(helpers, input);
  };
}