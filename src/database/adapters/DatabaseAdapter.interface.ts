/**
 * Database Adapter Interface for CrewAI Team System
 * 
 * Provides a unified interface for both SQLite and PostgreSQL
 * Following the existing ConnectionPool pattern but making it database-agnostic
 */

import { 
  SqlParams, 
  ExecuteResult, 
  DatabaseMetrics, 
  HealthCheckResult,
  PreparedStatement,
  TransactionContext 
} from './types.js';

export interface IDatabaseAdapter {
  query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]>;
  queryOne<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T | null>;
  execute(sql: string, params?: SqlParams): Promise<ExecuteResult>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
  prepare<T = Record<string, SqlValue>>(sql: string): PreparedStatement<T>;
  close(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  getMetrics(): DatabaseMetrics;
  initialize?(): Promise<void>;
}

export interface ITransactionAdapter extends TransactionContext {
  // TransactionContext already has all needed methods with proper types
}

// Import SqlValue for use in generic constraints
import type { SqlValue } from './types.js';

// Re-export DatabaseMetrics from types
export { DatabaseMetrics } from './types.js';

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  sqlite?: SQLiteConfig;
  postgresql?: PostgreSQLConfig;
}

export interface SQLiteConfig {
  databasePath: string;
  maxConnections?: number;
  enableWAL?: boolean;
  enableForeignKeys?: boolean;
  cacheSize?: number;
  busyTimeout?: number;
  memoryMap?: number;
  readonly?: boolean;
}

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  maxConnections?: number;
  minConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeout?: number;
  queryTimeout?: number;
  applicationName?: string;
}