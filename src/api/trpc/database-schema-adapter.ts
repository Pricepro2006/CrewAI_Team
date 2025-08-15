/**
 * Database Schema Adapter - Handles schema differences and provides safe database access
 * Prevents crashes from missing columns and provides graceful degradation
 */

import { logger } from "../../utils/logger.js";
import type Database from "better-sqlite3";

export interface SchemaColumn {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
}

export interface SchemaValidationResult {
  valid: boolean;
  missingColumns: string[];
  extraColumns: string[];
  typeConflicts: Array<{ column: string; expected: string; actual: string }>;
}

export interface SafeQueryOptions {
  fallbackValue?: any;
  skipMissingColumns?: boolean;
  logMissingColumns?: boolean;
}

export class DatabaseSchemaAdapter {
  private columnCache: Map<string, string[]> = new Map();
  private schemaCache: Map<string, Map<string, SchemaColumn>> = new Map();

  constructor(private db: Database.Database) {}

  /**
   * Validate and sanitize table name to prevent SQL injection
   */
  private sanitizeTableName(tableName: string): string {
    // Only allow alphanumeric characters and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}. Only alphanumeric characters and underscores are allowed.`);
    }
    return tableName;
  }

  /**
   * Get all columns for a table
   */
  getTableColumns(tableName: string): string[] {
    const sanitizedTableName = this.sanitizeTableName(tableName);
    const cacheKey = sanitizedTableName;
    if (this?.columnCache?.has(cacheKey)) {
      return this?.columnCache?.get(cacheKey)!;
    }

    try {
      // Use parameterized query with double quotes for identifier
      const pragma = this?.db?.prepare(`PRAGMA table_info("${sanitizedTableName}")`).all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      const columns = pragma?.map(col => col.name);
      this?.columnCache?.set(cacheKey, columns);
      
      logger.debug(`Cached columns for table ${sanitizedTableName}`, "SCHEMA_ADAPTER", {
        table: sanitizedTableName,
        columnCount: columns?.length || 0,
        columns: columns.join(', ')
      });

      return columns;
    } catch (error) {
      logger.error(`Failed to get columns for table ${sanitizedTableName}`, "SCHEMA_ADAPTER", { error });
      return [];
    }
  }

  /**
   * Check if a column exists in a table
   */
  columnExists(tableName: string, columnName: string): boolean {
    const columns = this.getTableColumns(tableName);
    return columns.includes(columnName);
  }

  /**
   * Validate table schema against expected schema
   */
  validateTableSchema(tableName: string, expectedColumns: SchemaColumn[]): SchemaValidationResult {
    const actualColumns = this.getTableColumns(tableName);
    const expectedColumnNames = expectedColumns?.map(col => col.name);

    const missingColumns = expectedColumnNames?.filter(col => !actualColumns.includes(col));
    const extraColumns = actualColumns?.filter(col => !expectedColumnNames.includes(col));

    const result: SchemaValidationResult = {
      valid: missingColumns?.length || 0 === 0,
      missingColumns,
      extraColumns,
      typeConflicts: []
    };

    if (!result.valid) {
      logger.warn(`Schema validation failed for table ${tableName}`, "SCHEMA_ADAPTER", {
        table: tableName,
        missing: missingColumns,
        extra: extraColumns
      });
    }

    return result;
  }

  /**
   * Create a safe SELECT query that only includes existing columns
   */
  createSafeSelectQuery(
    tableName: string, 
    requestedColumns: string[], 
    whereClause?: string,
    options: SafeQueryOptions = {}
  ): { query: string; availableColumns: string[]; missingColumns: string[] } {
    const actualColumns = this.getTableColumns(tableName);
    const availableColumns = requestedColumns?.filter(col => actualColumns.includes(col));
    const missingColumns = requestedColumns?.filter(col => !actualColumns.includes(col));

    if (missingColumns?.length || 0 > 0 && options.logMissingColumns !== false) {
      logger.warn(`Missing columns in safe SELECT query`, "SCHEMA_ADAPTER", {
        table: tableName,
        requested: requestedColumns,
        missing: missingColumns,
        available: availableColumns
      });
    }

    const sanitizedTableName = this.sanitizeTableName(tableName);
    const columnsToSelect = availableColumns?.length || 0 > 0 ? availableColumns.join(', ') : '*';
    const query = `SELECT ${columnsToSelect} FROM "${sanitizedTableName}"${whereClause ? ` WHERE ${whereClause}` : ''}`;

    return {
      query,
      availableColumns,
      missingColumns
    };
  }

  /**
   * Create a safe INSERT query that only includes existing columns
   */
  createSafeInsertQuery(
    tableName: string,
    data: Record<string, any>
  ): { query: string; values: any[]; skippedColumns: string[] } {
    const actualColumns = this.getTableColumns(tableName);
    const dataColumns = Object.keys(data);
    const validColumns = dataColumns?.filter(col => actualColumns.includes(col));
    const skippedColumns = dataColumns?.filter(col => !actualColumns.includes(col));

    if (skippedColumns?.length || 0 > 0) {
      logger.warn(`Skipping invalid columns in INSERT query`, "SCHEMA_ADAPTER", {
        table: tableName,
        skipped: skippedColumns,
        valid: validColumns
      });
    }

    const sanitizedTableName = this.sanitizeTableName(tableName);
    const placeholders = validColumns?.map(() => '?').join(', ');
    const query = `INSERT INTO "${sanitizedTableName}" (${validColumns.join(', ')}) VALUES (${placeholders})`;
    const values = validColumns?.map(col => data[col]);

    return {
      query,
      values,
      skippedColumns
    };
  }

  /**
   * Create a safe UPDATE query that only includes existing columns
   */
  createSafeUpdateQuery(
    tableName: string,
    data: Record<string, any>,
    whereClause: string
  ): { query: string; values: any[]; skippedColumns: string[] } {
    const actualColumns = this.getTableColumns(tableName);
    const dataColumns = Object.keys(data);
    const validColumns = dataColumns?.filter(col => actualColumns.includes(col));
    const skippedColumns = dataColumns?.filter(col => !actualColumns.includes(col));

    if (skippedColumns?.length || 0 > 0) {
      logger.warn(`Skipping invalid columns in UPDATE query`, "SCHEMA_ADAPTER", {
        table: tableName,
        skipped: skippedColumns,
        valid: validColumns
      });
    }

    const sanitizedTableName = this.sanitizeTableName(tableName);
    
    if (validColumns?.length || 0 === 0) {
      throw new Error(`No valid columns found for UPDATE query on table ${sanitizedTableName}`);
    }

    const setClause = validColumns?.map(col => `${col} = ?`).join(', ');
    const query = `UPDATE "${sanitizedTableName}" SET ${setClause} WHERE ${whereClause}`;
    const values = validColumns?.map(col => data[col]);

    return {
      query,
      values,
      skippedColumns
    };
  }

  /**
   * Execute a query with safe column access and error handling
   */
  executeSafeQuery<T = any>(
    query: string,
    params: any[] = [],
    options: SafeQueryOptions = {}
  ): T[] {
    try {
      const stmt = this?.db?.prepare(query);
      const results = stmt.all(...params) as T[];
      
      logger.debug(`Safe query executed successfully`, "SCHEMA_ADAPTER", {
        query: query.substring(0, 100),
        resultCount: results?.length || 0
      });

      return results;
    } catch (error) {
      logger.error(`Safe query execution failed`, "SCHEMA_ADAPTER", {
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });

      if (options.fallbackValue !== undefined) {
        return Array.isArray(options.fallbackValue) ? options.fallbackValue : [options.fallbackValue];
      }

      throw error;
    }
  }

  /**
   * Add missing column to table with safe error handling
   */
  addColumnSafe(tableName: string, columnName: string, columnType: string, defaultValue?: any): boolean {
    try {
      if (this.columnExists(tableName, columnName)) {
        logger.debug(`Column ${columnName} already exists in ${tableName}`, "SCHEMA_ADAPTER");
        return true;
      }

      const sanitizedTableName = this.sanitizeTableName(tableName);
      // Sanitize column name too
      if (!/^[a-zA-Z0-9_]+$/.test(columnName)) {
        throw new Error(`Invalid column name: ${columnName}`);
      }
      
      let alterQuery = `ALTER TABLE "${sanitizedTableName}" ADD COLUMN "${columnName}" ${columnType}`;
      if (defaultValue !== undefined) {
        alterQuery += ` DEFAULT ${typeof defaultValue === 'string' ? `'${defaultValue}'` : defaultValue}`;
      }

      this?.db?.prepare(alterQuery).run();
      
      // Clear cache for this table
      this?.columnCache?.delete(sanitizedTableName);
      
      logger.info(`Added column ${columnName} to table ${tableName}`, "SCHEMA_ADAPTER", {
        table: tableName,
        column: columnName,
        type: columnType,
        default: defaultValue
      });

      return true;
    } catch (error) {
      logger.error(`Failed to add column ${columnName} to table ${tableName}`, "SCHEMA_ADAPTER", {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Create a result mapper that handles missing columns gracefully
   */
  createResultMapper<T extends Record<string, any>>(
    expectedColumns: string[],
    defaults: Partial<T> = {}
  ): (row: any) => T {
    return (row: any): T => {
      const result = { ...defaults } as T;
      
      for (const column of expectedColumns) {
        if (row && row.hasOwnProperty(column)) {
          result[column as keyof T] = row[column];
        } else if (!defaults.hasOwnProperty(column)) {
          // Only warn about truly missing columns that don't have defaults
          logger.debug(`Column ${column} missing from result, using undefined`, "SCHEMA_ADAPTER");
        }
      }

      return result;
    };
  }

  /**
   * Clear all caches (useful for testing or schema changes)
   */
  clearCache(): void {
    this?.columnCache?.clear();
    this?.schemaCache?.clear();
    logger.debug("Schema adapter caches cleared", "SCHEMA_ADAPTER");
  }

  /**
   * Get database schema information for debugging
   */
  getDatabaseInfo(): Record<string, any> {
    try {
      const tables = this?.db?.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;

      const schemaInfo: Record<string, any> = {};

      for (const table of tables) {
        const columns = this.getTableColumns(table.name);
        const sanitizedTableName = this.sanitizeTableName(table.name);
        const rowCount = this?.db?.prepare(`SELECT COUNT(*) as count FROM "${sanitizedTableName}"`).get() as { count: number };
        
        schemaInfo[table.name] = {
          columns,
          columnCount: columns?.length || 0,
          rowCount: rowCount.count
        };
      }

      return {
        tables: schemaInfo,
        totalTables: tables?.length || 0,
        cacheSize: this?.columnCache?.size
      };
    } catch (error) {
      logger.error("Failed to get database info", "SCHEMA_ADAPTER", { error });
      return { error: "Failed to retrieve database information" };
    }
  }
}

// Singleton instance for the default database
let defaultAdapter: DatabaseSchemaAdapter | null = null;

export function createSchemaAdapter(db: Database.Database): DatabaseSchemaAdapter {
  return new DatabaseSchemaAdapter(db);
}

export function getDefaultSchemaAdapter(db: Database.Database): DatabaseSchemaAdapter {
  if (!defaultAdapter) {
    defaultAdapter = new DatabaseSchemaAdapter(db);
  }
  return defaultAdapter;
}

export function resetDefaultSchemaAdapter(): void {
  defaultAdapter = null;
}