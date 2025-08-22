/**
 * Type definitions for database adapters
 * Following CrewAI Team's domain models and patterns
 */

// SQL Parameter Types - based on better-sqlite3 and pg patterns
export type SqlValue = string | number | boolean | null | Buffer | Date;
export type SqlParams = SqlValue[] | Record<string, SqlValue>;

// Query Result Types
export interface QueryResult {
  rows: Record<string, SqlValue>[];
  rowCount: number;
  fields?: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  dataType: string;
  nullable: boolean;
}

// Execution Result Types  
export interface ExecuteResult {
  changes: number;
  lastInsertRowid?: number | bigint;
}

// Statement Types for prepared statements (async for compatibility)
export interface PreparedStatement<T = Record<string, SqlValue>> {
  run(params?: SqlParams): Promise<ExecuteResult>;
  get(params?: SqlParams): Promise<T | undefined>;
  all(params?: SqlParams): Promise<T[]>;
  iterate(params?: SqlParams): IterableIterator<T>;
  finalize(): void;
}

// Transaction Context (async for compatibility)
export interface TransactionContext {
  query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]>;
  queryOne<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T | null>;
  execute(sql: string, params?: SqlParams): Promise<ExecuteResult>;
  prepare<T = Record<string, SqlValue>>(sql: string): PreparedStatement<T>;
}

// Database Connection Configuration
export interface ConnectionConfig {
  readonly: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: boolean;
}

// Pool Configuration
export interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementCacheSize?: number;
}

// Performance Metrics
export interface QueryMetrics {
  queryId: string;
  sql: string;
  duration: number;
  rowsAffected: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
}

export interface DatabaseMetrics extends ConnectionMetrics {
  totalQueries: number;
  avgQueryTime: number;
  errorCount: number;
  cacheHitRate?: number;
  slowQueries?: QueryMetrics[];
}

// Health Check Types
export interface HealthCheckResult {
  healthy: boolean;
  latency: number;
  connections: ConnectionMetrics;
  lastError?: string;
  timestamp: Date;
}

// Migration Types
export interface MigrationRecord {
  id: number;
  name: string;
  executedAt: Date;
  checksum: string;
}

// Pragma Settings (SQLite specific)
export interface PragmaSettings {
  journal_mode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  cache_size?: number;
  foreign_keys?: boolean;
  busy_timeout?: number;
  wal_autocheckpoint?: number;
}

// Error Types
export class DatabaseAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseAdapterError';
  }
}

export class ConnectionError extends DatabaseAdapterError {
  constructor(message: string, originalError?: Error) {
    super(message, 'CONNECTION_ERROR', originalError);
    this.name = 'ConnectionError';
  }
}

export class QueryError extends DatabaseAdapterError {
  constructor(
    message: string,
    public readonly sql: string,
    public readonly params?: SqlParams,
    originalError?: Error
  ) {
    super(message, 'QUERY_ERROR', originalError);
    this.name = 'QueryError';
  }
}

export class TransactionError extends DatabaseAdapterError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TRANSACTION_ERROR', originalError);
    this.name = 'TransactionError';
  }
}