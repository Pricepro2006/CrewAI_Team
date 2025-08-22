/**
 * PostgreSQL Connection Manager for CrewAI Team System
 * 
 * Implements the IDatabaseAdapter interface for PostgreSQL
 * Following the existing ConnectionPool pattern with pg library
 */

import { Pool, PoolClient, PoolConfig, QueryResult as PgQueryResult } from 'pg';
import { 
  IDatabaseAdapter,
  ITransactionAdapter,
  PostgreSQLConfig 
} from './DatabaseAdapter.interface.js';
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

const logger = new Logger('PostgreSQLConnectionManager');

export class PostgreSQLConnectionManager implements IDatabaseAdapter {
  private pool: Pool | null = null;
  private readonly config: PostgreSQLConfig;
  private metrics: DatabaseMetrics;
  private initialized = false;
  private preparedStatements = new Map<string, PreparedStatement>();

  constructor(config: PostgreSQLConfig) {
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
      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl,
        max: this.config.maxConnections || 20,
        min: this.config.minConnections || 2,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 5000,
        statement_timeout: this.config.statementTimeout || 30000,
        query_timeout: this.config.queryTimeout || 30000,
        application_name: this.config.applicationName || 'CrewAI-Team'
      };

      this.pool = new Pool(poolConfig);

      // Set up pool event handlers
      this.pool.on('connect', () => {
        this.metrics.totalConnections++;
        this.updateConnectionMetrics();
      });

      this.pool.on('remove', () => {
        this.updateConnectionMetrics();
      });

      this.pool.on('error', (err) => {
        logger.error('PostgreSQL pool error:', 'POOL_ERROR', { error: err });
        this.metrics.errorCount++;
      });

      // Test connection
      const health = await this.healthCheck();
      if (!health.healthy) {
        throw new ConnectionError('Failed to establish database connection');
      }

      this.initialized = true;
      logger.info('PostgreSQL connection pool initialized');
    } catch (error) {
      throw new ConnectionError(
        `Failed to initialize PostgreSQL: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool!.connect();
      
      // Convert params to array format if needed
      const queryParams = this.normalizeParams(params);
      const result: PgQueryResult = await client.query(sql, queryParams);
      
      this.updateQueryMetrics(startTime, sql, result.rowCount || 0);
      return result.rows as T[];
    } catch (error) {
      this.metrics.errorCount++;
      throw new QueryError(
        `PostgreSQL query failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async queryOne<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, params?: SqlParams): Promise<ExecuteResult> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool!.connect();
      
      const queryParams = this.normalizeParams(params);
      
      // For INSERT operations with RETURNING clause
      if (sql.toLowerCase().includes('returning')) {
        const result: PgQueryResult = await client.query(sql, queryParams);
        this.updateQueryMetrics(startTime, sql, result.rowCount || 0);
        
        return {
          changes: result.rowCount || 0,
          lastInsertRowid: result.rows.length > 0 ? result.rows[0].id : undefined
        };
      }
      
      // For other operations
      const result: PgQueryResult = await client.query(sql, queryParams);
      this.updateQueryMetrics(startTime, sql, result.rowCount || 0);
      
      return {
        changes: result.rowCount || 0
      };
    } catch (error) {
      this.metrics.errorCount++;
      throw new QueryError(
        `PostgreSQL execute failed: ${error instanceof Error ? error.message : String(error)}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    
    let client: PoolClient | null = null;

    try {
      client = await this.pool!.connect();
      await client.query('BEGIN');

      const txContext = new PostgreSQLTransactionContext(client);
      const result = await fn(txContext);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction', 'ROLLBACK_ERROR', { error: rollbackError });
        }
      }
      this.metrics.errorCount++;
      throw new TransactionError(
        `PostgreSQL transaction failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  prepare<T = Record<string, SqlValue>>(sql: string): PreparedStatement<T> {
    // PostgreSQL doesn't have the same prepared statement API as SQLite
    // We'll create a wrapper that mimics the behavior
    const statement = new PostgreSQLPreparedStatement<T>(this, sql);
    this.preparedStatements.set(sql, statement as PreparedStatement);
    return statement;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      const result = await this.query<{ health_check: number }>('SELECT 1 as health_check');
      const latency = Date.now() - startTime;
      
      return {
        healthy: result.length > 0 && result[0].health_check === 1,
        latency,
        connections: {
          totalConnections: this.metrics.totalConnections,
          activeConnections: this.metrics.activeConnections,
          idleConnections: this.metrics.idleConnections,
          waitingRequests: this.metrics.waitingRequests
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
    this.updateConnectionMetrics();
    return { ...this.metrics };
  }

  async close(): Promise<void> {
    // Finalize all prepared statements
    for (const stmt of this.preparedStatements.values()) {
      stmt.finalize();
    }
    this.preparedStatements.clear();

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      this.metrics.activeConnections = 0;
      this.metrics.idleConnections = 0;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private normalizeParams(params?: SqlParams): SqlValue[] | undefined {
    if (!params) return undefined;
    if (Array.isArray(params)) return params;
    
    // Convert object params to array (not typically used with pg)
    return Object.values(params);
  }

  private updateConnectionMetrics(): void {
    if (!this.pool) return;
    
    this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.waitingRequests = this.pool.waitingCount;
  }

  private updateQueryMetrics(startTime: number, sql: string, rowsAffected: number): void {
    const duration = Date.now() - startTime;
    this.metrics.totalQueries++;
    
    // Update running average
    const totalTime = this.metrics.avgQueryTime * (this.metrics.totalQueries - 1) + duration;
    this.metrics.avgQueryTime = totalTime / this.metrics.totalQueries;
    
    // Track slow queries (over 1000ms)
    if (duration > 1000 && this.metrics.slowQueries) {
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

class PostgreSQLTransactionContext implements TransactionContext {
  constructor(private client: PoolClient) {}

  async query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]> {
    try {
      const queryParams = Array.isArray(params) ? params : params ? Object.values(params) : undefined;
      const result: PgQueryResult = await this.client.query(sql, queryParams);
      return result.rows as T[];
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
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, params?: SqlParams): Promise<ExecuteResult> {
    try {
      const queryParams = Array.isArray(params) ? params : params ? Object.values(params) : undefined;
      const result: PgQueryResult = await this.client.query(sql, queryParams);
      
      return {
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows.length > 0 && result.rows[0].id ? result.rows[0].id : undefined
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
    // In transaction context, we create a statement bound to this client
    return new PostgreSQLPreparedStatement<T>(this, sql);
  }
}

class PostgreSQLPreparedStatement<T = Record<string, SqlValue>> implements PreparedStatement<T> {
  constructor(
    private adapter: PostgreSQLConnectionManager | TransactionContext,
    private sql: string
  ) {}

  async run(params?: SqlParams): Promise<ExecuteResult> {
    if ('execute' in this.adapter) {
      return this.adapter.execute(this.sql, params);
    }
    throw new Error('Invalid adapter for prepared statement');
  }

  async get(params?: SqlParams): Promise<T | undefined> {
    if ('queryOne' in this.adapter) {
      const result = await this.adapter.queryOne<T>(this.sql, params);
      return result || undefined;
    }
    throw new Error('Invalid adapter for prepared statement');
  }

  async all(params?: SqlParams): Promise<T[]> {
    if ('query' in this.adapter) {
      return this.adapter.query<T>(this.sql, params);
    }
    throw new Error('Invalid adapter for prepared statement');
  }

  *iterate(params?: SqlParams): IterableIterator<T> {
    // PostgreSQL doesn't support synchronous iteration like SQLite
    // This would need to be implemented with cursors for true streaming
    throw new Error('Iterate is not supported in PostgreSQL adapter. Use query() instead.');
  }

  finalize(): void {
    // No-op for PostgreSQL
    // Prepared statements are managed by the connection pool
  }
}