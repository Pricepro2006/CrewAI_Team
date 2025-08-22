/**
 * SQLite Compatibility Shim
 * Wraps existing better-sqlite3 Database instances with the IDatabaseAdapter interface
 * This allows gradual migration from direct SQLite usage to the adapter pattern
 */

import type Database from 'better-sqlite3';
import type { 
  IDatabaseAdapter, 
  DatabaseMetrics
} from './DatabaseAdapter.interface.js';
import type { 
  SqlValue, 
  SqlParams, 
  ExecuteResult,
  DatabaseAdapterError,
  HealthCheckResult,
  TransactionContext,
  PreparedStatement
} from './types.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('SQLiteCompatibilityShim');

/**
 * Compatibility shim that wraps a better-sqlite3 Database instance
 * to implement the IDatabaseAdapter interface
 */
export class SQLiteCompatibilityShim implements IDatabaseAdapter {
  private db: Database.Database;
  private metrics: DatabaseMetrics;
  private preparedStatements = new Map<string, Database.Statement>();
  
  constructor(database: Database.Database) {
    if (!database) {
      throw new Error('Database instance is required for SQLiteCompatibilityShim');
    }
    
    this.db = database;
    this.metrics = {
      totalQueries: 0,
      avgQueryTime: 0,
      errorCount: 0,
      totalConnections: 1, // SQLite is single connection
      activeConnections: 1,
      idleConnections: 0,
      waitingRequests: 0
    };
    
    logger.info('SQLiteCompatibilityShim initialized for gradual migration');
  }
  
  /**
   * Execute a query and return multiple rows
   */
  async query<T = Record<string, SqlValue>>(
    sql: string, 
    params?: SqlParams
  ): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      const stmt = this.db.prepare(sql);
      const result = params 
        ? stmt.all(...this.normalizeParams(params))
        : stmt.all();
      
      this.updateMetrics(Date.now() - startTime);
      return result as T[];
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Query failed in compatibility shim', error);
      throw this.wrapError(error);
    }
  }
  
  /**
   * Execute a query and return a single row
   */
  async queryOne<T = Record<string, SqlValue>>(
    sql: string, 
    params?: SqlParams
  ): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const stmt = this.db.prepare(sql);
      const result = params 
        ? stmt.get(...this.normalizeParams(params))
        : stmt.get();
      
      this.updateMetrics(Date.now() - startTime);
      return (result as T) || null;
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('QueryOne failed in compatibility shim', error);
      throw this.wrapError(error);
    }
  }
  
  /**
   * Execute a statement (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, params?: SqlParams): Promise<ExecuteResult> {
    const startTime = Date.now();
    
    try {
      const stmt = this.db.prepare(sql);
      const result = params 
        ? stmt.run(...this.normalizeParams(params))
        : stmt.run();
      
      this.updateMetrics(Date.now() - startTime);
      
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Execute failed in compatibility shim', error);
      throw this.wrapError(error);
    }
  }
  
  /**
   * Execute multiple statements in a transaction
   */
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Create a transaction context that implements the interface
      const txContext = {
        query: <U = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<U[]> => 
          this.query<U>(sql, params),
        queryOne: <U = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<U | null> => 
          this.queryOne<U>(sql, params),
        execute: (sql: string, params?: SqlParams): Promise<ExecuteResult> => 
          this.execute(sql, params)
      };
      
      // Use better-sqlite3's transaction method
      const transaction = this.db.transaction(() => {
        // Run the async function synchronously within the transaction
        // Note: This is a limitation of better-sqlite3's synchronous nature
        return Promise.resolve(fn(txContext));
      });
      
      const result = await transaction();
      this.updateMetrics(Date.now() - startTime);
      return result;
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Transaction failed in compatibility shim', error);
      throw this.wrapError(error);
    }
  }
  
  /**
   * Prepare a statement for repeated execution
   */
  prepare<T = Record<string, SqlValue>>(sql: string): PreparedStatement<T> {
    const cacheKey = sql;
    
    if (!this.preparedStatements.has(cacheKey)) {
      this.preparedStatements.set(cacheKey, this.db.prepare(sql));
    }
    
    const stmt = this.preparedStatements.get(cacheKey)!;
    
    return {
      run: async (params?: SqlParams): Promise<ExecuteResult> => {
        try {
          const result = params 
            ? stmt.run(...this.normalizeParams(params))
            : stmt.run();
          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
          };
        } catch (error) {
          throw this.wrapError(error);
        }
      },
      
      get: async (params?: SqlParams): Promise<T | null> => {
        try {
          const result = params 
            ? stmt.get(...this.normalizeParams(params))
            : stmt.get();
          return (result as T) || null;
        } catch (error) {
          throw this.wrapError(error);
        }
      },
      
      all: async (params?: SqlParams): Promise<T[]> => {
        try {
          const result = params 
            ? stmt.all(...this.normalizeParams(params))
            : stmt.all();
          return result as T[];
        } catch (error) {
          throw this.wrapError(error);
        }
      },
      
      finalize: (): void => {
        // SQLite statements don't need explicit finalization in better-sqlite3
        this.preparedStatements.delete(cacheKey);
      }
    };
  }
  
  /**
   * Initialize the adapter (no-op for SQLite)
   */
  async initialize(): Promise<void> {
    logger.info('SQLiteCompatibilityShim initialized (no-op for existing connection)');
  }
  
  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    try {
      // Clear prepared statements
      this.preparedStatements.clear();
      
      // Close the database
      this.db.close();
      
      logger.info('SQLiteCompatibilityShim closed database connection');
    } catch (error) {
      logger.error('Error closing SQLite database', error);
      throw this.wrapError(error);
    }
  }
  
  /**
   * Get health status
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      // Try a simple query to verify connection
      this.db.prepare('SELECT 1').get();
      
      return {
        healthy: true,
        latency: 0,
        connections: {
          totalConnections: 1,
          activeConnections: 1,
          idleConnections: 0,
          waitingRequests: 0
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        latency: 0,
        connections: {
          totalConnections: 1,
          activeConnections: 0,
          idleConnections: 0,
          waitingRequests: 0
        },
        lastError: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get the underlying database instance (for migration purposes)
   */
  getUnderlyingDatabase(): Database.Database {
    return this.db;
  }
  
  /**
   * Normalize parameters to array format
   */
  private normalizeParams(params: SqlParams): SqlValue[] {
    if (Array.isArray(params)) {
      return params;
    }
    
    // Convert object params to array (not typically used with better-sqlite3)
    // This is mainly for compatibility with the adapter interface
    return Object.values(params);
  }
  
  /**
   * Update performance metrics
   */
  private updateMetrics(duration: number): void {
    this.metrics.totalQueries++;
    // Calculate running average
    this.metrics.avgQueryTime = 
      (this.metrics.avgQueryTime * (this.metrics.totalQueries - 1) + duration) / 
      this.metrics.totalQueries;
  }
  
  /**
   * Wrap errors in a consistent format
   */
  private wrapError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }
}

/**
 * Factory function to create a compatibility shim from an existing database
 */
export function createCompatibilityShim(database: Database.Database): IDatabaseAdapter {
  return new SQLiteCompatibilityShim(database);
}

/**
 * Check if a database adapter is actually a compatibility shim
 */
export function isCompatibilityShim(adapter: IDatabaseAdapter): adapter is SQLiteCompatibilityShim {
  return adapter instanceof SQLiteCompatibilityShim;
}