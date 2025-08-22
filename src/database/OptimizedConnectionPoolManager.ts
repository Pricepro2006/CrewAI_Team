/**
 * Optimized Connection Pool Manager for CrewAI Team
 * 
 * This manager provides high-performance connection pooling for both main database
 * (crewai_enhanced.db) and Walmart database (walmart_grocery.db) with:
 * 
 * - Advanced connection lifecycle management
 * - Query performance monitoring and optimization
 * - Automatic connection recycling and cleanup
 * - Thread-safe operations for high-volume processing
 * - Intelligent load balancing and failover
 * - Comprehensive metrics and health monitoring
 */

import Database, { type Database as DatabaseType } from "better-sqlite3";
import { EventEmitter } from "events";
import { Logger } from "../utils/logger.js";
import appConfig from "../config/app.config.js";
import { performance } from "perf_hooks";

const logger = new Logger("OptimizedConnectionPoolManager");

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface OptimizedPoolConfig {
  databasePath: string;
  poolName: string;
  minConnections?: number;
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxLifetime?: number;
  acquireTimeout?: number;
  enableWAL?: boolean;
  enableForeignKeys?: boolean;
  cacheSize?: number; // In KB
  memoryMap?: number; // In bytes
  busyTimeout?: number;
  checkpointInterval?: number;
  maintenanceInterval?: number;
  queryTimeoutThreshold?: number; // Log slow queries above this threshold (ms)
  enableQueryOptimization?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export interface ConnectionMetadata {
  id: string;
  created: number;
  lastUsed: number;
  lastQuery: string;
  queryCount: number;
  totalQueryTime: number;
  inUse: boolean;
  threadId?: number;
  isHealthy: boolean;
  errorCount: number;
  lastError?: string;
}

export interface PoolStatistics {
  poolName: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalQueries: number;
  avgQueryTime: number;
  slowQueries: number;
  errors: number;
  checkpoints: number;
  recycledConnections: number;
  memoryUsage: number;
  hitRate: number;
  uptime: number;
  connectionDetails: ConnectionMetadata[];
  performanceProfile: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  timestamp: number;
  connectionId: string;
  success: boolean;
  errorMessage?: string;
}

// ============================================
// OPTIMIZED CONNECTION WRAPPER
// ============================================

class OptimizedConnection {
  private db: DatabaseType;
  private metadata: ConnectionMetadata;
  private config: Required<OptimizedPoolConfig>;
  private disposed: boolean = false;
  private queryHistory: QueryPerformanceMetrics[] = [];
  private readonly maxQueryHistorySize = 100;

  constructor(id: string, config: Required<OptimizedPoolConfig>) {
    this.config = config;
    this.metadata = {
      id,
      created: Date.now(),
      lastUsed: Date.now(),
      lastQuery: '',
      queryCount: 0,
      totalQueryTime: 0,
      inUse: false,
      isHealthy: true,
      errorCount: 0,
    };

    try {
      this.db = new Database(config.databasePath);
      this.configureDatabase();
      logger.debug(`Created optimized connection ${id}`, "CONNECTION_POOL");
    } catch (error) {
      this.metadata.isHealthy = false;
      this.metadata.errorCount++;
      this.metadata.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private configureDatabase(): void {
    try {
      // Enable WAL mode for better concurrency
      if (this?.config?.enableWAL) {
        this?.db?.pragma("journal_mode = WAL");
        this?.db?.pragma("wal_autocheckpoint = 1000");
      }

      // Performance optimizations
      this?.db?.pragma("synchronous = NORMAL");
      this?.db?.pragma(`cache_size = -${this?.config?.cacheSize}`); // Negative = KB
      this?.db?.pragma("temp_store = MEMORY");
      this?.db?.pragma(`mmap_size = ${this?.config?.memoryMap}`);
      this?.db?.pragma("page_size = 4096");
      this?.db?.pragma("cache_spill = 0"); // Keep cache in memory
      
      // Query planner optimizations
      this?.db?.pragma("optimize");
      this?.db?.pragma("automatic_index = 1");
      this?.db?.pragma("case_sensitive_like = 0");
      
      // Enable foreign keys if configured
      if (this?.config?.enableForeignKeys) {
        this?.db?.pragma("foreign_keys = ON");
      }

      // Set timeouts
      this?.db?.pragma(`busy_timeout = ${this?.config?.busyTimeout}`);

      // Additional performance settings
      this?.db?.pragma("secure_delete = 0"); // Faster deletes
      this?.db?.pragma("count_changes = 0"); // Disable counting changes
      
      logger.debug(`Database configured for connection ${this?.metadata?.id}`);
    } catch (error) {
      this.metadata.isHealthy = false;
      this.metadata.errorCount++;
      this.metadata.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  public executeQuery<T>(queryFn: (db: DatabaseType) => T, queryDescription?: string): T {
    if (this.disposed || !this?.metadata?.isHealthy) {
      throw new Error(`Connection ${this?.metadata?.id} is not available`);
    }

    const startTime = performance.now();
    this.metadata.inUse = true;
    this.metadata.lastUsed = Date.now();
    
    try {
      const result = queryFn(this.db);
      const executionTime = performance.now() - startTime;
      
      // Update metadata
      this.metadata.queryCount++;
      this.metadata.totalQueryTime += executionTime;
      this.metadata.lastQuery = queryDescription || 'Unknown Query';
      
      // Track query performance
      if (this?.config?.enablePerformanceMonitoring) {
        this.recordQueryMetrics(queryDescription || 'Unknown Query', executionTime, true);
      }

      // Log slow queries
      if (executionTime > this?.config?.queryTimeoutThreshold) {
        logger.warn(
          `Slow query detected (${Math.round(executionTime)}ms): ${queryDescription}`,
          "SLOW_QUERY",
          { connectionId: this?.metadata?.id, executionTime }
        );
      }

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.metadata.errorCount++;
      this.metadata.lastError = error instanceof Error ? error.message : String(error);
      
      if (this?.config?.enablePerformanceMonitoring) {
        this.recordQueryMetrics(
          queryDescription || 'Unknown Query', 
          executionTime, 
          false,
          this?.metadata?.lastError
        );
      }

      // Mark connection as unhealthy if too many errors
      if (this.metadata.errorCount > 5) {
        this.metadata.isHealthy = false;
        logger.warn(
          `Connection ${this?.metadata?.id} marked unhealthy due to excessive errors`,
          "CONNECTION_POOL"
        );
      }

      throw error;
    } finally {
      this.metadata.inUse = false;
    }
  }

  private recordQueryMetrics(query: string, executionTime: number, success: boolean, errorMessage?: string): void {
    const metrics: QueryPerformanceMetrics = {
      query,
      executionTime,
      timestamp: Date.now(),
      connectionId: this?.metadata?.id,
      success,
      errorMessage,
    };

    this?.queryHistory?.push(metrics);

    // Keep history size manageable
    if (this?.queryHistory?.length > this.maxQueryHistorySize) {
      this.queryHistory = this?.queryHistory?.slice(-this.maxQueryHistorySize);
    }
  }

  public getMetadata(): ConnectionMetadata {
    return { ...this.metadata };
  }

  public getQueryHistory(): QueryPerformanceMetrics[] {
    return [...this.queryHistory];
  }

  public isExpired(): boolean {
    const age = Date.now() - this?.metadata?.created;
    return age > this?.config?.maxLifetime;
  }

  public isIdle(): boolean {
    const idleTime = Date.now() - this?.metadata?.lastUsed;
    return !this?.metadata?.inUse && idleTime > this?.config?.idleTimeout;
  }

  public healthCheck(): boolean {
    if (this.disposed || !this?.metadata?.isHealthy) {
      return false;
    }

    try {
      this.db.prepare("SELECT 1").get();
      return true;
    } catch (error) {
      this.metadata.isHealthy = false;
      this.metadata.errorCount++;
      this.metadata.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    try {
      this.db.close();
      this.disposed = true;
      this.metadata.inUse = false;
      this.metadata.isHealthy = false;
      logger.debug(`Disposed connection ${this?.metadata?.id}`);
    } catch (error) {
      logger.error(
        `Error disposing connection ${this?.metadata?.id}:`,
        "CONNECTION_POOL",
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  public isDisposed(): boolean {
    return this.disposed;
  }
}

// ============================================
// OPTIMIZED CONNECTION POOL
// ============================================

export class OptimizedConnectionPool extends EventEmitter {
  private config: Required<OptimizedPoolConfig>;
  private connections: Map<string, OptimizedConnection> = new Map();
  private availableConnections: string[] = [];
  private waitingQueue: Array<{
    resolve: (connection: OptimizedConnection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  
  private stats = {
    totalQueries: 0,
    slowQueries: 0,
    errors: 0,
    checkpoints: 0,
    recycledConnections: 0,
    startTime: Date.now(),
  };

  private queryTimes: number[] = [];
  private checkpointInterval?: NodeJS.Timeout;
  private maintenanceInterval?: NodeJS.Timeout;
  private disposed: boolean = false;

  constructor(config: OptimizedPoolConfig) {
    super();

    this.config = {
      databasePath: config.databasePath,
      poolName: config.poolName,
      minConnections: config.minConnections || 2,
      maxConnections: config.maxConnections || 10,
      connectionTimeout: config.connectionTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000,
      maxLifetime: config.maxLifetime || 3600000, // 1 hour
      acquireTimeout: config.acquireTimeout || 10000,
      enableWAL: config.enableWAL !== false,
      enableForeignKeys: config.enableForeignKeys !== false,
      cacheSize: config.cacheSize || 32000, // 32MB
      memoryMap: config.memoryMap || 268435456, // 256MB
      busyTimeout: config.busyTimeout || 30000,
      checkpointInterval: config.checkpointInterval || 60000,
      maintenanceInterval: config.maintenanceInterval || 30000,
      queryTimeoutThreshold: config.queryTimeoutThreshold || 1000,
      enableQueryOptimization: config.enableQueryOptimization !== false,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    logger.info(
      `Initializing optimized connection pool: ${this?.config?.poolName}`,
      "CONNECTION_POOL",
      { config: this.config }
    );

    // Create minimum connections
    for (let i = 0; i < this?.config?.minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        logger.error(
          `Failed to create initial connection ${i}:`,
          "CONNECTION_POOL",
          undefined,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Start maintenance routines
    this.startCheckpointMonitoring();
    this.startMaintenanceRoutine();

    logger.info(
      `Pool ${this?.config?.poolName} initialized with ${this?.connections?.size} connections`,
      "CONNECTION_POOL"
    );
  }

  private async createConnection(): Promise<OptimizedConnection> {
    const id = `${this?.config?.poolName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const connection = new OptimizedConnection(id, this.config);
      this?.connections?.set(id, connection);
      this?.availableConnections?.push(id);
      
      this.emit('connectionCreated', { id, poolName: this?.config?.poolName });
      
      return connection;
    } catch (error) {
      logger.error(
        `Failed to create connection ${id}:`,
        "CONNECTION_POOL",
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  public async acquire(): Promise<OptimizedConnection> {
    if (this.disposed) {
      throw new Error(`Pool ${this?.config?.poolName} has been disposed`);
    }

    // Try to get available connection
    while (this?.availableConnections?.length > 0) {
      const connectionId = this?.availableConnections?.shift()!;
      const connection = this?.connections?.get(connectionId);

      if (connection && !connection.isDisposed() && connection.healthCheck()) {
        this.emit('connectionAcquired', { id: connectionId, poolName: this?.config?.poolName });
        return connection;
      } else if (connection) {
        // Remove unhealthy connection
        this.removeConnection(connectionId);
      }
    }

    // Create new connection if under limit
    if (this?.connections?.size < this?.config?.maxConnections) {
      try {
        const connection = await this.createConnection();
        this?.availableConnections?.pop(); // Remove from available since we're returning it
        this.emit('connectionAcquired', { id: connection.getMetadata().id, poolName: this?.config?.poolName });
        return connection;
      } catch (error) {
        logger.error(
          `Failed to create connection on demand:`,
          "CONNECTION_POOL",
          undefined,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Wait for available connection
    return new Promise<OptimizedConnection>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const index = this?.waitingQueue?.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this?.waitingQueue?.splice(index, 1);
        }
        reject(new Error(`Connection acquire timeout for pool ${this?.config?.poolName}`));
      }, this?.config?.acquireTimeout);

      this?.waitingQueue?.push({
        resolve: (connection: OptimizedConnection) => {
          clearTimeout(timeoutHandle);
          resolve(connection);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  public release(connection: OptimizedConnection): void {
    const metadata = connection.getMetadata();
    
    if (!this?.connections?.has(metadata.id)) {
      logger.warn(`Attempted to release unknown connection ${metadata.id}`, "CONNECTION_POOL");
      return;
    }

    // Check if connection should be recycled
    if (connection.isExpired() || !connection.healthCheck()) {
      this.removeConnection(metadata.id);
      this.ensureMinimumConnections();
      return;
    }

    // Fulfill waiting request if any
    if (this?.waitingQueue?.length > 0) {
      const waiter = this?.waitingQueue?.shift()!;
      waiter.resolve(connection);
      return;
    }

    // Return to available pool
    if (!this?.availableConnections?.includes(metadata.id)) {
      this?.availableConnections?.push(metadata.id);
    }

    this.emit('connectionReleased', { id: metadata.id, poolName: this?.config?.poolName });
  }

  public async executeQuery<T>(
    queryFn: (db: DatabaseType) => T,
    queryDescription?: string
  ): Promise<T> {
    const connection = await this.acquire();
    const startTime = performance.now();
    
    try {
      const result = connection.executeQuery(queryFn, queryDescription);
      const executionTime = performance.now() - startTime;
      
      // Track statistics
      this.stats.totalQueries++;
      this.queryTimes.push(executionTime);
      
      if (executionTime > this.config.queryTimeoutThreshold) {
        this.stats.slowQueries++;
      }

      // Keep query time history manageable
      if (this?.queryTimes?.length > 1000) {
        this.queryTimes = this?.queryTimes?.slice(-1000);
      }

      return result;
    } catch (error) {
      this.stats.errors++;
      throw error;
    } finally {
      this.release(connection);
    }
  }

  public async executeTransaction<T>(
    transactionFn: (db: DatabaseType) => T
  ): Promise<T> {
    const connection = await this.acquire();
    
    try {
      return connection.executeQuery((db: any) => {
        const transaction = db.transaction((fn: () => T) => fn());
        return transaction(() => transactionFn(db));
      }, 'Transaction');
    } finally {
      this.release(connection);
    }
  }

  private removeConnection(connectionId: string): void {
    const connection = this?.connections?.get(connectionId);
    if (connection) {
      connection.dispose();
      this?.connections?.delete(connectionId);
      this.availableConnections = this?.availableConnections?.filter(id => id !== connectionId);
      this.stats.recycledConnections++;
      
      this.emit('connectionRemoved', { id: connectionId, poolName: this?.config?.poolName });
    }
  }

  private async ensureMinimumConnections(): Promise<void> {
    const currentCount = this?.connections?.size;
    const needed = this?.config?.minConnections - currentCount;

    for (let i = 0; i < needed; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        logger.error(
          `Failed to create replacement connection:`,
          "CONNECTION_POOL",
          undefined,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  private startCheckpointMonitoring(): void {
    if (!this?.config?.enableWAL) {
      return;
    }

    this.checkpointInterval = setInterval(async () => {
      try {
        await this.executeQuery((db: any) => {
          const result = db.prepare("PRAGMA wal_checkpoint(PASSIVE)").get() as any;
          if (result && result?.length || 0 >= 2 && result[1] > 1000) {
            // WAL has grown large, perform full checkpoint
            db.prepare("PRAGMA wal_checkpoint(RESTART)").run();
            this.stats.checkpoints++;
          }
          return result;
        }, 'WAL Checkpoint');
      } catch (error) {
        logger.error(
          `Checkpoint monitoring error:`,
          "CONNECTION_POOL",
          undefined,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }, this?.config?.checkpointInterval);
  }

  private startMaintenanceRoutine(): void {
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, this?.config?.maintenanceInterval);
  }

  private performMaintenance(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    // Check for connections that need recycling
    for (const [id, connection] of this.connections) {
      const metadata = connection.getMetadata();
      
      if (!metadata.inUse && (connection.isExpired() || connection.isIdle() || !connection.healthCheck())) {
        connectionsToRemove.push(id);
      }
    }

    // Remove unhealthy/expired connections
    for (const id of connectionsToRemove) {
      this.removeConnection(id);
    }

    // Ensure minimum connections
    this.ensureMinimumConnections();

    // Clean up waiting queue of timed-out requests
    const expiredWaiters = this?.waitingQueue?.filter(
      waiter => now - waiter.timestamp > this?.config?.acquireTimeout
    );

    for (const waiter of expiredWaiters) {
      waiter.reject(new Error('Connection acquire timeout during maintenance'));
    }

    this.waitingQueue = this?.waitingQueue?.filter(
      waiter => now - waiter.timestamp <= this?.config?.acquireTimeout
    );

    this.emit('maintenanceComplete', {
      poolName: this?.config?.poolName,
      removedConnections: connectionsToRemove?.length || 0,
      waitingRequests: this?.waitingQueue?.length,
    });
  }

  public getStatistics(): PoolStatistics {
    const now = Date.now();
    const activeConnections = Array.from(this?.connections?.values())
      .filter(conn => conn.getMetadata().inUse).length;
    
    const idleConnections = this?.connections?.size - activeConnections;
    
    const avgQueryTime = this?.queryTimes?.length > 0
      ? this?.queryTimes?.reduce((sum: any, time: any) => sum + time, 0) / this?.queryTimes?.length
      : 0;

    // Calculate performance percentiles
    const sortedTimes = [...this.queryTimes].sort((a, b) => a - b);
    const performanceProfile = {
      p50: this.getPercentile(sortedTimes, 0.5),
      p90: this.getPercentile(sortedTimes, 0.9),
      p95: this.getPercentile(sortedTimes, 0.95),
      p99: this.getPercentile(sortedTimes, 0.99),
    };

    // Calculate total memory usage
    const totalMemoryUsage = Array.from(this?.connections?.values())
      .reduce((total: any, conn: any) => {
        // Estimate memory usage based on cache size and query count
        const metadata = conn.getMetadata();
        return total + (this?.config?.cacheSize * 1024) + (metadata.queryCount * 100);
      }, 0);

    return {
      poolName: this?.config?.poolName,
      totalConnections: this?.connections?.size,
      activeConnections,
      idleConnections,
      waitingRequests: this?.waitingQueue?.length,
      totalQueries: this?.stats?.totalQueries,
      avgQueryTime,
      slowQueries: this?.stats?.slowQueries,
      errors: this?.stats?.errors,
      checkpoints: this?.stats?.checkpoints,
      recycledConnections: this?.stats?.recycledConnections,
      memoryUsage: totalMemoryUsage,
      hitRate: this?.stats?.totalQueries > 0 
        ? ((this?.stats?.totalQueries - this?.stats?.errors) / this?.stats?.totalQueries) * 100 
        : 100,
      uptime: now - this?.stats?.startTime,
      connectionDetails: Array.from(this?.connections?.values()).map(conn => conn.getMetadata()),
      performanceProfile,
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray?.length || 0 === 0) return 0;
    const index = Math.ceil(sortedArray?.length || 0 * percentile) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  public async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    statistics: PoolStatistics;
  }> {
    const issues: string[] = [];
    let healthy = true;

    // Check if we have minimum connections
    if (this?.connections?.size < this?.config?.minConnections) {
      issues.push(`Below minimum connections: ${this?.connections?.size} < ${this?.config?.minConnections}`);
      healthy = false;
    }

    // Check for too many waiting requests
    if (this?.waitingQueue?.length > this?.config?.maxConnections) {
      issues.push(`Too many waiting requests: ${this?.waitingQueue?.length}`);
      healthy = false;
    }

    // Check connection health
    let unhealthyConnections = 0;
    for (const connection of this?.connections?.values()) {
      if (!connection.healthCheck()) {
        unhealthyConnections++;
      }
    }

    if (unhealthyConnections > this?.connections?.size / 2) {
      issues.push(`Too many unhealthy connections: ${unhealthyConnections}/${this?.connections?.size}`);
      healthy = false;
    }

    // Test a simple query
    try {
      await this.executeQuery((db: any) => db.prepare("SELECT 1").get(), 'Health Check');
    } catch (error) {
      issues.push(`Health check query failed: ${error instanceof Error ? error.message : String(error)}`);
      healthy = false;
    }

    return {
      healthy,
      issues,
      statistics: this.getStatistics(),
    };
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    logger.info(`Disposing connection pool: ${this?.config?.poolName}`, "CONNECTION_POOL");

    this.disposed = true;

    // Clear intervals
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
    }

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      waiter.reject(new Error('Pool is being disposed'));
    }
    this.waitingQueue.length = 0;

    // Close all connections
    const disposalPromises = Array.from(this?.connections?.values()).map(async (connection: any) => {
      try {
        connection.dispose();
      } catch (error) {
        logger.error(
          `Error disposing connection:`,
          "CONNECTION_POOL",
          undefined,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });

    await Promise.all(disposalPromises);

    this.connections.clear();
    this.availableConnections.length = 0;

    this.emit('disposed', { poolName: this?.config?.poolName });

    logger.info(`Connection pool disposed: ${this?.config?.poolName}`, "CONNECTION_POOL");
  }
}

// ============================================
// UNIFIED POOL MANAGER
// ============================================

export class UnifiedConnectionPoolManager extends EventEmitter {
  private static instance: UnifiedConnectionPoolManager;
  private pools: Map<string, OptimizedConnectionPool> = new Map();
  private disposed: boolean = false;

  private constructor() {
    super();
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2')); // nodemon
  }

  public static getInstance(): UnifiedConnectionPoolManager {
    if (!UnifiedConnectionPoolManager.instance) {
      UnifiedConnectionPoolManager.instance = new UnifiedConnectionPoolManager();
    }
    return UnifiedConnectionPoolManager.instance;
  }

  public async createPool(config: OptimizedPoolConfig): Promise<OptimizedConnectionPool> {
    if (this.disposed) {
      throw new Error('Manager has been disposed');
    }

    if (this?.pools?.has(config.poolName)) {
      logger.warn(`Pool ${config.poolName} already exists, returning existing pool`);
      return this?.pools?.get(config.poolName)!;
    }

    const pool = new OptimizedConnectionPool(config);
    this?.pools?.set(config.poolName, pool);

    // Forward pool events
    pool.on('connectionCreated', (data: any) => this.emit('connectionCreated', data));
    pool.on('connectionAcquired', (data: any) => this.emit('connectionAcquired', data));
    pool.on('connectionReleased', (data: any) => this.emit('connectionReleased', data));
    pool.on('connectionRemoved', (data: any) => this.emit('connectionRemoved', data));

    logger.info(`Created connection pool: ${config.poolName}`, "POOL_MANAGER");

    return pool;
  }

  public getPool(poolName: string): OptimizedConnectionPool | undefined {
    return this?.pools?.get(poolName);
  }

  public async getOrCreateMainPool(): Promise<OptimizedConnectionPool> {
    const poolName = 'main-database';
    
    if (this?.pools?.has(poolName)) {
      return this?.pools?.get(poolName)!;
    }

    return this.createPool({
      databasePath: appConfig?.database?.path,
      poolName,
      minConnections: 3,
      maxConnections: 15,
      connectionTimeout: 30000,
      idleTimeout: 300000,
      maxLifetime: 3600000,
      enableWAL: true,
      enableForeignKeys: true,
      cacheSize: 32000, // 32MB
      memoryMap: 268435456, // 256MB
      busyTimeout: 30000,
      enablePerformanceMonitoring: true,
      enableQueryOptimization: true,
    });
  }

  public async getOrCreateWalmartPool(): Promise<OptimizedConnectionPool> {
    const poolName = 'walmart-database';
    
    if (this?.pools?.has(poolName)) {
      return this?.pools?.get(poolName)!;
    }

    return this.createPool({
      databasePath: './data/walmart_grocery.db',
      poolName,
      minConnections: 2,
      maxConnections: 10,
      connectionTimeout: 30000,
      idleTimeout: 300000,
      maxLifetime: 3600000,
      enableWAL: true,
      enableForeignKeys: true,
      cacheSize: 16000, // 16MB
      memoryMap: 134217728, // 128MB
      busyTimeout: 30000,
      enablePerformanceMonitoring: true,
      enableQueryOptimization: true,
    });
  }

  public async getAllStatistics(): Promise<Record<string, PoolStatistics>> {
    const statistics: Record<string, PoolStatistics> = {};
    
    for (const [name, pool] of this.pools) {
      statistics[name] = pool.getStatistics();
    }

    return statistics;
  }

  public async healthCheckAll(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (const [name, pool] of this.pools) {
      results[name] = await pool.healthCheck();
    }

    return results;
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, initiating graceful shutdown...`, "POOL_MANAGER");
    
    try {
      await this.dispose();
      process.exit(0);
    } catch (error) {
      logger.error(
        "Error during graceful shutdown:",
        "POOL_MANAGER",
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      process.exit(1);
    }
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    logger.info("Disposing unified connection pool manager...", "POOL_MANAGER");

    this.disposed = true;

    // Dispose all pools in parallel
    const disposalPromises = Array.from(this?.pools?.values()).map(pool => pool.dispose());
    await Promise.all(disposalPromises);

    this?.pools?.clear();

    logger.info("Unified connection pool manager disposed", "POOL_MANAGER");
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Get the main database pool
 */
export async function getMainDatabasePool(): Promise<OptimizedConnectionPool> {
  const manager = UnifiedConnectionPoolManager.getInstance();
  return manager.getOrCreateMainPool();
}

/**
 * Get the Walmart database pool
 */
export async function getWalmartDatabasePool(): Promise<OptimizedConnectionPool> {
  const manager = UnifiedConnectionPoolManager.getInstance();
  return manager.getOrCreateWalmartPool();
}

/**
 * Execute query on main database
 */
export async function executeMainQuery<T>(
  queryFn: (db: DatabaseType) => T,
  queryDescription?: string
): Promise<T> {
  const pool = await getMainDatabasePool();
  return pool.executeQuery(queryFn, queryDescription);
}

/**
 * Execute query on Walmart database
 */
export async function executeWalmartQuery<T>(
  queryFn: (db: DatabaseType) => T,
  queryDescription?: string
): Promise<T> {
  const pool = await getWalmartDatabasePool();
  return pool.executeQuery(queryFn, queryDescription);
}

/**
 * Execute transaction on main database
 */
export async function executeMainTransaction<T>(
  transactionFn: (db: DatabaseType) => T
): Promise<T> {
  const pool = await getMainDatabasePool();
  return pool.executeTransaction(transactionFn);
}

/**
 * Execute transaction on Walmart database
 */
export async function executeWalmartTransaction<T>(
  transactionFn: (db: DatabaseType) => T
): Promise<T> {
  const pool = await getWalmartDatabasePool();
  return pool.executeTransaction(transactionFn);
}

/**
 * Get comprehensive system statistics
 */
export async function getSystemStatistics(): Promise<{
  pools: Record<string, PoolStatistics>;
  summary: {
    totalPools: number;
    totalConnections: number;
    totalQueries: number;
    avgQueryTime: number;
    totalMemoryUsage: number;
    overallHealthy: boolean;
  };
}> {
  const manager = UnifiedConnectionPoolManager.getInstance();
  const pools = await manager.getAllStatistics();
  
  const summary = {
    totalPools: Object.keys(pools).length,
    totalConnections: Object.values(pools).reduce((sum: any, stats: any) => sum + stats.totalConnections, 0),
    totalQueries: Object.values(pools).reduce((sum: any, stats: any) => sum + stats.totalQueries, 0),
    avgQueryTime: Object.values(pools).reduce((sum: any, stats: any) => sum + stats.avgQueryTime, 0) / Object.keys(pools).length,
    totalMemoryUsage: Object.values(pools).reduce((sum: any, stats: any) => sum + stats.memoryUsage, 0),
    overallHealthy: Object.values(pools).every(stats => stats.hitRate > 95 && stats.errors < stats.totalQueries * 0.01),
  };

  return { pools, summary };
}