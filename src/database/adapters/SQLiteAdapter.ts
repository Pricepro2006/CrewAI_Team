/**
 * SQLite Adapter - Wraps existing ConnectionPool for database abstraction
 * Maintains compatibility with existing better-sqlite3 implementation
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseInstance, Statement } from 'better-sqlite3';
import { IDatabaseAdapter, SQLiteConfig } from './DatabaseAdapter.interface.js';
import {
  SqlParams,
  SqlValue,
  ExecuteResult,
  DatabaseMetrics,
  HealthCheckResult,
  PreparedStatement,
  TransactionContext,
  QueryError,
  ConnectionError,
  TransactionError
} from './types.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('SQLiteAdapter');

export class SQLiteAdapter implements IDatabaseAdapter {
  private db: DatabaseInstance | null = null;
  private readonly config: SQLiteConfig;
  private metrics: DatabaseMetrics;
  private preparedStatements = new Map<string, Statement>();
  private initialized = false;

  constructor(config: SQLiteConfig) {
    this.config = config;
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalQueries: 0,
      avgQueryTime: 0,
      errorCount: 0,
      cacheHitRate: 0,
      slowQueries: []
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create database connection with options
      this.db = new Database(this.config.databasePath, {
        readonly: this.config.readonly || false,
        fileMustExist: false,
        timeout: this.config.busyTimeout || 5000,
        verbose: process.env.NODE_ENV === 'development' ? 
          (message: string) => logger.debug('SQLite:', message) : undefined
      });

      // Configure SQLite pragmas for performance
      this.configureSQLite();
      
      this.metrics.totalConnections = 1;
      this.metrics.activeConnections = 1;
      this.initialized = true;
      
      logger.info('SQLite adapter initialized', { path: this.config.databasePath });
    } catch (error) {
      throw new ConnectionError(
        `Failed to initialize SQLite: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private configureSQLite(): void {
    if (!this.db) return;

    try {
      // Enable WAL mode for better concurrency
      if (this.config.enableWAL) {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('wal_checkpoint = TRUNCATE');
        this.db.pragma('wal_autocheckpoint = 1000');
      }

      // Enable foreign keys
      if (this.config.enableForeignKeys) {
        this.db.pragma('foreign_keys = ON');
      }

      // Set cache size
      if (this.config.cacheSize) {
        this.db.pragma(`cache_size = ${this.config.cacheSize}`);
      }

      // Set busy timeout
      if (this.config.busyTimeout) {
        this.db.pragma(`busy_timeout = ${this.config.busyTimeout}`);
      }

      // Memory mapping for performance
      if (this.config.memoryMap) {
        this.db.pragma(`mmap_size = ${this.config.memoryMap}`);
      }

      // Optimize for performance
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('optimize');

    } catch (error) {
      logger.error('Failed to configure SQLite pragmas:', error);
    }
  }

  async query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const stmt = this.db!.prepare(sql);
      const normalizedParams = this.normalizeParams(params);
      
      const result = normalizedParams ? 
        stmt.all(...normalizedParams) as T[] : 
        stmt.all() as T[];
      
      this.updateQueryMetrics(startTime, sql, result.length);
      return result;
    } catch (error) {
      this.metrics.errorCount++;
      throw new QueryError(
        `SQLite query failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async queryOne<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T | null> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const stmt = this.db!.prepare(sql);
      const normalizedParams = this.normalizeParams(params);
      
      const result = normalizedParams ? 
        stmt.get(...normalizedParams) as T | undefined : 
        stmt.get() as T | undefined;
      
      this.updateQueryMetrics(startTime, sql, result ? 1 : 0);
      return result || null;
    } catch (error) {
      this.metrics.errorCount++;
      throw new QueryError(
        `SQLite queryOne failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async execute(sql: string, params?: SqlParams): Promise<ExecuteResult> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const stmt = this.db!.prepare(sql);
      const normalizedParams = this.normalizeParams(params);
      
      const result = normalizedParams ? 
        stmt.run(...normalizedParams) : 
        stmt.run();
      
      this.updateQueryMetrics(startTime, sql, result.changes);
      
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid as number | bigint | undefined
      };
    } catch (error) {
      this.metrics.errorCount++;
      throw new QueryError(
        `SQLite execute failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    
    const db = this.db!;
    const adapter = this;
    
    // Create a promise-based wrapper around better-sqlite3's synchronous transaction
    return new Promise<T>((resolve, reject) => {
      try {
        const transaction = db.transaction(async () => {
          const txContext = new SQLiteTransactionContext(db, adapter);
          try {
            const result = await fn(txContext);
            return result;
          } catch (error) {
            throw error;
          }
        });
        
        // Execute the transaction
        const result = transaction() as T;
        resolve(result);
      } catch (error) {
        this.metrics.errorCount++;
        reject(new TransactionError(
          `SQLite transaction failed: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        ));
      }
    });
  }

  prepare<T = Record<string, SqlValue>>(sql: string): PreparedStatement<T> {
    this.ensureInitializedSync();
    
    if (!this.preparedStatements.has(sql)) {
      const stmt = this.db!.prepare(sql);
      this.preparedStatements.set(sql, stmt);
    }
    
    const stmt = this.preparedStatements.get(sql)!;
    return new SQLitePreparedStatement<T>(stmt, this);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Test basic query
      const result = await this.queryOne<{ health_check: number }>('SELECT 1 as health_check');
      const latency = Date.now() - startTime;
      
      return {
        healthy: result !== null && result.health_check === 1,
        latency,
        connections: {
          totalConnections: this.metrics.totalConnections,
          activeConnections: this.db ? 1 : 0,
          idleConnections: 0,
          waitingRequests: 0
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        connections: {
          totalConnections: this.metrics.totalConnections,
          activeConnections: 0,
          idleConnections: 0,
          waitingRequests: 0
        },
        lastError: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  async close(): Promise<void> {
    // Finalize all prepared statements
    for (const stmt of this.preparedStatements.values()) {
      try {
        // SQLite statements don't have a finalize method in better-sqlite3
        // They are automatically finalized when the database closes
      } catch (error) {
        logger.error('Failed to finalize statement:', error);
      }
    }
    this.preparedStatements.clear();

    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.initialized = false;
        this.metrics.activeConnections = 0;
        logger.info('SQLite connection closed');
      } catch (error) {
        logger.error('Failed to close SQLite database:', error);
        throw error;
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private ensureInitializedSync(): void {
    if (!this.initialized) {
      throw new ConnectionError('SQLite adapter not initialized');
    }
  }

  private normalizeParams(params?: SqlParams): SqlValue[] | undefined {
    if (!params) return undefined;
    if (Array.isArray(params)) return params;
    
    // Convert object params to array (not typically used with better-sqlite3)
    return Object.values(params);
  }

  private updateQueryMetrics(startTime: number, sql: string, rowsAffected: number): void {
    const duration = Date.now() - startTime;
    this.metrics.totalQueries++;
    
    // Update running average
    const totalTime = this.metrics.avgQueryTime * (this.metrics.totalQueries - 1) + duration;
    this.metrics.avgQueryTime = totalTime / this.metrics.totalQueries;
    
    // Track slow queries (over 100ms for SQLite)
    if (duration > 100 && this.metrics.slowQueries) {
      this.metrics.slowQueries.push({
        queryId: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sql,
        duration,
        rowsAffected,
        timestamp: new Date(),
        success: true
      });
      
      // Keep only last 100 slow queries
      if (this.metrics.slowQueries.length > 100) {
        this.metrics.slowQueries = this.metrics.slowQueries.slice(-100);
      }
    }
  }
}

class SQLiteTransactionContext implements TransactionContext {
  constructor(
    private db: DatabaseInstance,
    private adapter: SQLiteAdapter
  ) {}

  async query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      const normalizedParams = this.normalizeParams(params);
      
      const result = normalizedParams ? 
        stmt.all(...normalizedParams) as T[] : 
        stmt.all() as T[];
      
      return result;
    } catch (error) {
      throw new QueryError(
        `Transaction query failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async queryOne<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T | null> {
    try {
      const stmt = this.db.prepare(sql);
      const normalizedParams = this.normalizeParams(params);
      
      const result = normalizedParams ? 
        stmt.get(...normalizedParams) as T | undefined : 
        stmt.get() as T | undefined;
      
      return result || null;
    } catch (error) {
      throw new QueryError(
        `Transaction queryOne failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async execute(sql: string, params?: SqlParams): Promise<ExecuteResult> {
    try {
      const stmt = this.db.prepare(sql);
      const normalizedParams = this.normalizeParams(params);
      
      const result = normalizedParams ? 
        stmt.run(...normalizedParams) : 
        stmt.run();
      
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid as number | bigint | undefined
      };
    } catch (error) {
      throw new QueryError(
        `Transaction execute failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  prepare<T = Record<string, SqlValue>>(sql: string): PreparedStatement<T> {
    const stmt = this.db.prepare(sql);
    return new SQLitePreparedStatement<T>(stmt, this.adapter);
  }

  private normalizeParams(params?: SqlParams): SqlValue[] | undefined {
    if (!params) return undefined;
    if (Array.isArray(params)) return params;
    return Object.values(params);
  }
}

class SQLitePreparedStatement<T = Record<string, SqlValue>> implements PreparedStatement<T> {
  constructor(
    private stmt: Statement,
    private adapter: SQLiteAdapter
  ) {}

  async run(params?: SqlParams): Promise<ExecuteResult> {
    try {
      const normalizedParams = this.normalizeParams(params);
      const result = normalizedParams ? 
        this.stmt.run(...normalizedParams) : 
        this.stmt.run();
      
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid as number | bigint | undefined
      };
    } catch (error) {
      throw new QueryError(
        `Prepared statement run failed: ${error instanceof Error ? error.message : String(error)}`,
        this.stmt.source,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async get(params?: SqlParams): Promise<T | undefined> {
    try {
      const normalizedParams = this.normalizeParams(params);
      const result = normalizedParams ? 
        this.stmt.get(...normalizedParams) as T | undefined : 
        this.stmt.get() as T | undefined;
      
      return result;
    } catch (error) {
      throw new QueryError(
        `Prepared statement get failed: ${error instanceof Error ? error.message : String(error)}`,
        this.stmt.source,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async all(params?: SqlParams): Promise<T[]> {
    try {
      const normalizedParams = this.normalizeParams(params);
      const result = normalizedParams ? 
        this.stmt.all(...normalizedParams) as T[] : 
        this.stmt.all() as T[];
      
      return result;
    } catch (error) {
      throw new QueryError(
        `Prepared statement all failed: ${error instanceof Error ? error.message : String(error)}`,
        this.stmt.source,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  *iterate(params?: SqlParams): IterableIterator<T> {
    try {
      const normalizedParams = this.normalizeParams(params);
      const iterator = normalizedParams ? 
        this.stmt.iterate(...normalizedParams) : 
        this.stmt.iterate();
      
      for (const row of iterator) {
        yield row as T;
      }
    } catch (error) {
      throw new QueryError(
        `Prepared statement iterate failed: ${error instanceof Error ? error.message : String(error)}`,
        this.stmt.source,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  finalize(): void {
    // better-sqlite3 statements don't need explicit finalization
    // They are automatically finalized when the database closes
  }

  private normalizeParams(params?: SqlParams): SqlValue[] | undefined {
    if (!params) return undefined;
    if (Array.isArray(params)) return params;
    return Object.values(params);
  }
}