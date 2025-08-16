/**
 * Production-Ready Database Connection Pool for better-sqlite3
 *
 * Critical Design Principles:
 * 1. better-sqlite3 is NOT thread-safe for sharing connections between threads
 * 2. Each worker thread must create its own database instance
 * 3. Main thread uses singleton pattern since better-sqlite3 is synchronous
 * 4. SQLite serialized mode provides thread-safety at database level
 *
 * Features:
 * - Thread-safe connection management
 * - Connection lifecycle tracking
 * - Memory leak prevention
 * - Graceful shutdown handling
 * - Performance optimization
 */

import Database, { type Database as DatabaseType } from "better-sqlite3";
// Type definition for Database instance
type DatabaseInstance = DatabaseType;
import { Worker, isMainThread, threadId } from "worker_threads";
import { Logger } from "../utils/logger.js";
import appConfig from "../config/app.config.js";

const logger = new Logger("ConnectionPool");

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ConnectionPoolConfig {
  databasePath: string;
  maxConnections: number;
  connectionTimeout: number; // milliseconds
  idleTimeout: number; // milliseconds
  enableWAL: boolean;
  enableForeignKeys: boolean;
  cacheSize: number;
  memoryMap: number; // bytes
  busyTimeout: number; // milliseconds
}

export interface ConnectionMetrics {
  id: string;
  threadId: number;
  created: Date;
  lastUsed: Date;
  queryCount: number;
  isActive: boolean;
  memoryUsage: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  avgQueryTime: number;
  memoryUsage: number;
  threadConnections: Map<number, number>;
}

// ============================================
// CONNECTION WRAPPER
// ============================================

export class DatabaseConnection {
  private db: DatabaseInstance;
  private config: ConnectionPoolConfig;
  private metrics: ConnectionMetrics;
  private disposed: boolean = false;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
    this.db = new Database(config.databasePath);
    this.metrics = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      threadId: threadId,
      created: new Date(),
      lastUsed: new Date(),
      queryCount: 0,
      isActive: true,
      memoryUsage: 0,
    };

    this.configureSQLite();
    logger.debug(`Created connection ${this?.metrics?.id} on thread ${threadId}`);
  }

  /**
   * Configure SQLite database with performance optimizations
   */
  private configureSQLite(): void {
    try {
      // Enable WAL mode for better concurrency
      if (this?.config?.enableWAL) {
        this?.db?.pragma("journal_mode = WAL");
        // Optimize WAL checkpoint behavior
        this?.db?.pragma("wal_checkpoint = TRUNCATE");
        this?.db?.pragma("wal_autocheckpoint = 1000"); // Pages before auto-checkpoint
      }

      // Performance optimizations
      this?.db?.pragma("synchronous = NORMAL");
      this?.db?.pragma(`cache_size = -${this?.config?.cacheSize * 1024}`); // Negative = KB instead of pages
      this?.db?.pragma("temp_store = MEMORY");
      this?.db?.pragma(`mmap_size = ${this?.config?.memoryMap}`);
      
      // Additional performance optimizations
      this?.db?.pragma("page_size = 4096"); // Optimal page size for most systems
      this?.db?.pragma("cache_spill = 10000"); // Pages before spilling to disk
      this?.db?.pragma("optimize"); // Run ANALYZE on tables
      
      // Query planner optimizations
      this?.db?.pragma("query_only = 0");
      this?.db?.pragma("automatic_index = 1"); // Allow automatic index creation
      this?.db?.pragma("case_sensitive_like = 0"); // Case-insensitive LIKE by default

      // Enable foreign keys
      if (this?.config?.enableForeignKeys) {
        this?.db?.pragma("foreign_keys = ON");
      }

      // Set busy timeout
      this?.db?.pragma(`busy_timeout = ${this?.config?.busyTimeout}`);

      // Enable thread safety (serialized mode)
      this?.db?.pragma("threading_mode = 2"); // SQLITE_THREADSAFE=2 (serialized)

      logger.debug(`SQLite configured for connection ${this?.metrics?.id}`);
    } catch (error) {
      logger.error(
        `Failed to configure SQLite for connection ${this?.metrics?.id}:`,
        this?.metrics?.id,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get the underlying database instance
   */
  getDatabase(): DatabaseInstance {
    if (this.disposed) {
      throw new Error(`Connection ${this?.metrics?.id} has been disposed`);
    }

    if (this.metrics) {
      this.metrics.lastUsed = new Date();
      this.metrics.queryCount++;
    }
    return this.db;
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    if (!this.disposed) {
      // Update memory usage estimate
      try {
        const pageCount = this?.db?.pragma("page_count", {
          simple: true,
        }) as number;
        const pageSize = this?.db?.pragma("page_size", {
          simple: true,
        }) as number;
        if (this.metrics) {
          this.metrics.memoryUsage = pageCount * pageSize;
        }
      } catch (error) {
        // Ignore errors in metrics collection
      }
    }

    return { ...this.metrics };
  }

  /**
   * Check if connection is idle
   */
  isIdle(): boolean {
    const idleTime = Date.now() - this?.metrics?.lastUsed.getTime();
    return idleTime > this?.config?.idleTimeout;
  }

  /**
   * Close the database connection
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    try {
      this?.db?.close();
      this.disposed = true;
      if (this.metrics) {
        this.metrics.isActive = false;
      }
      logger.debug(
        `Disposed connection ${this?.metrics?.id} on thread ${threadId}`,
      );
    } catch (error) {
      logger.error(
        `Error disposing connection ${this?.metrics?.id}:`,
        this?.metrics?.id,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if connection is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }
}

// ============================================
// CONNECTION POOL
// ============================================

export class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool | null = null;
  private config: ConnectionPoolConfig;
  private connections: Map<number, DatabaseConnection> = new Map();
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private totalQueries: number = 0;
  private queryTimes: number[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private disposed: boolean = false;

  private constructor(config?: Partial<ConnectionPoolConfig>) {
    this.config = {
      databasePath: config?.databasePath || appConfig?.database?.path,
      maxConnections: config?.maxConnections || 10,
      connectionTimeout: config?.connectionTimeout || 30000,
      idleTimeout: config?.idleTimeout || 300000, // 5 minutes
      enableWAL: config?.enableWAL !== false,
      enableForeignKeys: config?.enableForeignKeys !== false,
      cacheSize: config?.cacheSize || 10000,
      memoryMap: config?.memoryMap || 268435456, // 256MB
      busyTimeout: config?.busyTimeout || 30000,
    };

    // Start cleanup interval for idle connections
    this.startCleanupInterval();

    logger.info(
      `Connection pool initialized for thread ${threadId}`,
      "ConnectionPool",
      {
        config: this.config,
        isMainThread,
      }
    );
  }

  /**
   * Get singleton instance (thread-safe)
   */
  public static getInstance(
    config?: Partial<ConnectionPoolConfig>,
  ): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool(config);
    }
    return DatabaseConnectionPool.instance;
  }

  /**
   * Get database connection for current thread
   * IMPORTANT: Each thread gets its own connection instance
   */
  public getConnection(): DatabaseConnection {
    if (this.disposed) {
      throw new Error("Connection pool has been disposed");
    }

    const currentThreadId = threadId;
    let connection = this?.connections?.get(currentThreadId);

    // Create new connection if none exists for this thread or if disposed
    if (!connection || connection.isDisposed()) {
      if (this?.connections?.size >= this?.config?.maxConnections) {
        this.cleanupIdleConnections();

        if (this?.connections?.size >= this?.config?.maxConnections) {
          throw new Error(
            `Maximum connections (${this?.config?.maxConnections}) reached`,
          );
        }
      }

      connection = new DatabaseConnection(this.config);
      this?.connections?.set(currentThreadId, connection);

      logger.debug(
        `Created new connection for thread ${currentThreadId}`,
        "ConnectionPool",
        {
          totalConnections: this?.connections?.size,
        }
      );
    }

    // Update metrics
    const metrics = connection.getMetrics();
    this?.connectionMetrics?.set(metrics.id, metrics);

    return connection;
  }

  /**
   * Execute query with performance tracking
   */
  public async executeQuery<T>(
    queryFn: (db: DatabaseInstance) => T,
  ): Promise<T> {
    const startTime = Date.now();
    const connection = this.getConnection();

    try {
      const result = queryFn(connection.getDatabase());

      // Track performance
      const queryTime = Date.now() - startTime;
      this.totalQueries++;
      this?.queryTimes?.push(queryTime);

      // Keep only last 1000 query times for average calculation
      if (this?.queryTimes?.length > 1000) {
        this.queryTimes = this?.queryTimes?.slice(-1000);
      }

      return result;
    } catch (error) {
      logger.error(
        `Query execution failed on thread ${threadId}:`,
        "ConnectionPool",
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Execute transaction with automatic rollback on error
   */
  public async executeTransaction<T>(
    transactionFn: (db: DatabaseInstance) => T,
  ): Promise<T> {
    const connection = this.getConnection();
    const db = connection.getDatabase();

    const transaction = db.transaction((fn: () => T) => {
      return fn();
    });

    return transaction(() => transactionFn(db));
  }

  /**
   * Get pool statistics
   */
  public getStats(): PoolStats {
    const activeConnections = Array.from(this?.connections?.values()).filter(
      (conn: any) => !conn.isDisposed(),
    ).length;

    const idleConnections = Array.from(this?.connections?.values()).filter(
      (conn: any) => !conn.isDisposed() && conn.isIdle(),
    ).length;

    const threadConnections = new Map<number, number>();
    for (const [threadId, conn] of this.connections) {
      if (!conn.isDisposed()) {
        threadConnections.set(threadId, 1);
      }
    }

    const avgQueryTime =
      this?.queryTimes?.length > 0
        ? this?.queryTimes?.reduce((a: any, b: any) => a + b, 0) / this?.queryTimes?.length
        : 0;

    const totalMemory = Array.from(this?.connectionMetrics?.values()).reduce(
      (total, metrics) => total + (metrics.memoryUsage || 0),
      0,
    );

    return {
      totalConnections: this?.connections?.size,
      activeConnections,
      idleConnections,
      totalQueries: this.totalQueries,
      avgQueryTime,
      memoryUsage: totalMemory,
      threadConnections,
    };
  }

  /**
   * Get detailed connection metrics
   */
  public getConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this?.connectionMetrics?.values());
  }

  /**
   * Cleanup idle connections
   */
  private cleanupIdleConnections(): void {
    const connectionsToRemove: number[] = [];

    for (const [threadId, connection] of this.connections) {
      if (connection.isIdle() || connection.isDisposed()) {
        connection.dispose();
        connectionsToRemove.push(threadId);
        this?.connectionMetrics?.delete(connection.getMetrics().id);
      }
    }

    for (const threadId of connectionsToRemove) {
      this?.connections?.delete(threadId);
    }

    if (connectionsToRemove?.length || 0 > 0) {
      logger.debug(`Cleaned up ${connectionsToRemove?.length || 0} idle connections`);
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this?.config?.idleTimeout / 2); // Run cleanup at half the idle timeout
  }

  /**
   * Health check for the connection pool
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    stats: PoolStats;
    errors: string[];
  }> {
    const errors: string[] = [];
    let healthy = true;

    try {
      // Test current thread connection
      const connection = this.getConnection();
      const db = connection.getDatabase();

      // Simple query test
      db.prepare("SELECT 1 as test").get();

      // Check if we can create a test table and drop it
      db.exec("CREATE TEMP TABLE _health_check (id INTEGER)");
      db.exec("DROP TABLE _health_check");
    } catch (error) {
      healthy = false;
      errors.push(
        `Connection test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const stats = this.getStats();

    // Check for concerning metrics
    if (stats.activeConnections === 0) {
      errors.push("No active connections available");
      healthy = false;
    }

    if (stats.avgQueryTime > 10000) {
      // 10 seconds
      errors.push(`High average query time: ${stats.avgQueryTime}ms`);
    }

    return {
      healthy,
      stats,
      errors,
    };
  }

  /**
   * Graceful shutdown - close all connections
   */
  public async shutdown(): Promise<void> {
    if (this.disposed) {
      return;
    }

    logger.info("Shutting down connection pool...");

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    for (const [threadId, connection] of this.connections) {
      try {
        connection.dispose();
      } catch (error) {
        logger.error(
          `Error closing connection for thread ${threadId}:`,
          "ConnectionPool",
          undefined,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    this?.connections?.clear();
    this?.connectionMetrics?.clear();
    this.disposed = true;

    // Reset singleton
    DatabaseConnectionPool.instance = null;

    logger.info("Connection pool shutdown complete");
  }

  /**
   * Force close connection for specific thread (for testing)
   */
  public forceCloseConnection(threadId: number): void {
    const connection = this?.connections?.get(threadId);
    if (connection) {
      connection.dispose();
      this?.connections?.delete(threadId);
      this?.connectionMetrics?.delete(connection.getMetrics().id);
      logger.debug(`Force closed connection for thread ${threadId}`);
    }
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Get database connection for current thread
 */
export function getDatabaseConnection(
  config?: Partial<ConnectionPoolConfig>,
): DatabaseConnection {
  const pool = DatabaseConnectionPool.getInstance(config);
  return pool.getConnection();
}

/**
 * Execute query with automatic connection management
 */
export async function executeQuery<T>(
  queryFn: (db: DatabaseInstance) => T,
  config?: Partial<ConnectionPoolConfig>,
): Promise<T> {
  const pool = DatabaseConnectionPool.getInstance(config);
  return pool.executeQuery(queryFn);
}

/**
 * Execute transaction with automatic connection management
 */
export async function executeTransaction<T>(
  transactionFn: (db: DatabaseInstance) => T,
  config?: Partial<ConnectionPoolConfig>,
): Promise<T> {
  const pool = DatabaseConnectionPool.getInstance(config);
  return pool.executeTransaction(transactionFn);
}

/**
 * Get connection pool instance
 */
export function getConnectionPool(
  config?: Partial<ConnectionPoolConfig>,
): DatabaseConnectionPool {
  return DatabaseConnectionPool.getInstance(config);
}

/**
 * Shutdown connection pool gracefully
 */
export async function shutdownConnectionPool(): Promise<void> {
  const pool = DatabaseConnectionPool.getInstance();
  await pool.shutdown();
}

// ============================================
// GRACEFUL SHUTDOWN HANDLER
// ============================================

// Handle graceful shutdown in main thread
if (isMainThread) {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    try {
      await shutdownConnectionPool();
      process.exit(0);
    } catch (error) {
      logger.error(
        "Error during graceful shutdown:",
        "ConnectionPool",
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart
}
