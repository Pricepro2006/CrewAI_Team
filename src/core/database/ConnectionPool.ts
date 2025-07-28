import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";

/**
 * Connection pool configuration options
 */
export interface PoolConfig {
  filename: string;
  poolSize?: number;
  maxIdleTime?: number; // milliseconds
  checkpointInterval?: number; // milliseconds
  walSizeLimit?: number; // bytes
  enableWAL?: boolean;
  readonly?: boolean;
  verbose?: boolean;
}

/**
 * Database connection wrapper with metadata
 */
interface PooledConnection {
  db: Database.Database;
  id: string;
  inUse: boolean;
  lastUsed: number;
  created: number;
  queryCount: number;
}

/**
 * Connection pool for better-sqlite3 with WAL mode support
 * 
 * Implements best practices for SQLite connection pooling:
 * - WAL mode for concurrent readers
 * - Automatic checkpointing to prevent WAL file growth
 * - Connection recycling based on idle time
 * - Performance monitoring and statistics
 */
export class ConnectionPool extends EventEmitter {
  private config: Required<PoolConfig>;
  private connections: Map<string, PooledConnection> = new Map();
  private availableConnections: string[] = [];
  private checkpointInterval?: NodeJS.Timeout;
  private maintenanceInterval?: NodeJS.Timeout;
  private stats = {
    totalConnections: 0,
    activeConnections: 0,
    totalQueries: 0,
    checkpoints: 0,
    recycledConnections: 0,
  };

  constructor(config: PoolConfig) {
    super();
    
    this.config = {
      filename: config.filename,
      poolSize: config.poolSize || 5,
      maxIdleTime: config.maxIdleTime || 300000, // 5 minutes
      checkpointInterval: config.checkpointInterval || 60000, // 1 minute
      walSizeLimit: config.walSizeLimit || 10 * 1024 * 1024, // 10MB
      enableWAL: config.enableWAL !== false, // Default true
      readonly: config.readonly || false,
      verbose: config.verbose || false,
    };

    this.initialize();
  }

  private initialize(): void {
    logger.info("Initializing connection pool", "CONNECTION_POOL", {
      filename: this.config.filename,
      poolSize: this.config.poolSize,
      enableWAL: this.config.enableWAL,
    });

    // Create initial connection to set up pragmas
    const setupDb = this.createConnection("setup");
    
    if (this.config.enableWAL && !this.config.readonly) {
      // Enable WAL mode for better concurrency
      setupDb.db.pragma("journal_mode = WAL");
      
      // Performance optimizations
      setupDb.db.pragma("synchronous = NORMAL");
      setupDb.db.pragma("cache_size = 10000"); // 10MB cache
      setupDb.db.pragma("temp_store = MEMORY");
      setupDb.db.pragma("mmap_size = 268435456"); // 256MB memory map
      
      logger.info("WAL mode enabled with performance optimizations", "CONNECTION_POOL");
    }
    
    // Return setup connection to pool
    this.releaseConnection(setupDb);

    // Start checkpoint monitoring if WAL is enabled
    if (this.config.enableWAL && !this.config.readonly) {
      this.startCheckpointMonitoring();
    }

    // Start connection maintenance
    this.startMaintenanceRoutine();
  }

  /**
   * Create a new database connection
   */
  private createConnection(id?: string): PooledConnection {
    const connectionId = id || `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const db = new Database(this.config.filename, {
      readonly: this.config.readonly,
      verbose: this.config.verbose ? (message) => {
        logger.debug(`SQLite: ${message}`, "CONNECTION_POOL");
      } : undefined,
    });

    // Set connection-specific pragmas
    db.pragma("foreign_keys = ON");
    
    // Set busy timeout to handle concurrent access
    db.pragma("busy_timeout = 30000"); // 30 seconds
    
    const connection: PooledConnection = {
      db,
      id: connectionId,
      inUse: false,
      lastUsed: Date.now(),
      created: Date.now(),
      queryCount: 0,
    };

    this.connections.set(connectionId, connection);
    this.stats.totalConnections++;
    
    logger.debug(`Created new connection: ${connectionId}`, "CONNECTION_POOL");
    
    return connection;
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<Database.Database> {
    // Try to get an available connection
    while (this.availableConnections.length > 0) {
      const connectionId = this.availableConnections.shift()!;
      const connection = this.connections.get(connectionId);
      
      if (connection && !connection.inUse) {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        this.stats.activeConnections++;
        
        this.emit("acquire", { connectionId, poolSize: this.connections.size });
        
        return connection.db;
      }
    }

    // Create new connection if pool not at limit
    if (this.connections.size < this.config.poolSize) {
      const connection = this.createConnection();
      connection.inUse = true;
      this.stats.activeConnections++;
      
      this.emit("acquire", { connectionId: connection.id, poolSize: this.connections.size });
      
      return connection.db;
    }

    // Wait for a connection to become available
    return new Promise((resolve) => {
      const checkAvailable = () => {
        for (const [id, conn] of this.connections) {
          if (!conn.inUse) {
            conn.inUse = true;
            conn.lastUsed = Date.now();
            this.stats.activeConnections++;
            
            this.emit("acquire", { connectionId: id, poolSize: this.connections.size });
            
            resolve(conn.db);
            return;
          }
        }
        
        // Check again in 10ms
        setTimeout(checkAvailable, 10);
      };
      
      checkAvailable();
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(db: Database.Database): void {
    for (const [id, conn] of this.connections) {
      if (conn.db === db) {
        this.releaseConnection(conn);
        return;
      }
    }
    
    logger.warn("Attempted to release unknown connection", "CONNECTION_POOL");
  }

  private releaseConnection(connection: PooledConnection): void {
    connection.inUse = false;
    connection.lastUsed = Date.now();
    
    if (!this.availableConnections.includes(connection.id)) {
      this.availableConnections.push(connection.id);
    }
    
    if (this.stats.activeConnections > 0) {
      this.stats.activeConnections--;
    }
    
    this.emit("release", { connectionId: connection.id, poolSize: this.connections.size });
  }

  /**
   * Execute a query with automatic connection management
   */
  async execute<T>(
    fn: (db: Database.Database) => T,
    options?: { retries?: number }
  ): Promise<T> {
    const maxRetries = options?.retries ?? 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const db = await this.acquire();
      
      try {
        const result = fn(db);
        this.stats.totalQueries++;
        
        // Update connection query count
        for (const conn of this.connections.values()) {
          if (conn.db === db) {
            conn.queryCount++;
            break;
          }
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is due to database lock
        if (lastError.message.includes("database is locked") && attempt < maxRetries - 1) {
          logger.debug(`Retrying query due to lock (attempt ${attempt + 1})`, "CONNECTION_POOL");
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
          continue;
        }
        
        throw error;
      } finally {
        this.release(db);
      }
    }
    
    throw lastError || new Error("Failed to execute query after retries");
  }

  /**
   * Start checkpoint monitoring for WAL mode
   */
  private startCheckpointMonitoring(): void {
    this.checkpointInterval = setInterval(async () => {
      try {
        const db = await this.acquire();
        
        try {
          // Check WAL file size
          const walInfo = db.prepare("PRAGMA wal_checkpoint(PASSIVE)").get() as any;
          const walSize = walInfo[1] * 4096; // Pages to bytes
          
          if (walSize > this.config.walSizeLimit) {
            logger.info(`WAL file size (${walSize} bytes) exceeds limit, performing checkpoint`, "CONNECTION_POOL");
            
            // Perform full checkpoint
            db.prepare("PRAGMA wal_checkpoint(RESTART)").run();
            this.stats.checkpoints++;
            
            this.emit("checkpoint", { walSize, timestamp: Date.now() });
          }
        } finally {
          this.release(db);
        }
      } catch (error) {
        logger.error(`Checkpoint monitoring error: ${error}`, "CONNECTION_POOL");
      }
    }, this.config.checkpointInterval);
  }

  /**
   * Start connection maintenance routine
   */
  private startMaintenanceRoutine(): void {
    this.maintenanceInterval = setInterval(() => {
      const now = Date.now();
      const toRecycle: string[] = [];
      
      for (const [id, conn] of this.connections) {
        if (!conn.inUse && (now - conn.lastUsed) > this.config.maxIdleTime) {
          toRecycle.push(id);
        }
      }
      
      // Recycle idle connections
      for (const id of toRecycle) {
        const conn = this.connections.get(id);
        if (conn && !conn.inUse && this.connections.size > 1) {
          conn.db.close();
          this.connections.delete(id);
          this.availableConnections = this.availableConnections.filter(availId => availId !== id);
          this.stats.recycledConnections++;
          
          logger.debug(`Recycled idle connection: ${id}`, "CONNECTION_POOL");
          
          this.emit("recycle", { connectionId: id, idleTime: now - conn.lastUsed });
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number;
    activeConnections: number;
    availableConnections: number;
    totalQueries: number;
    checkpoints: number;
    recycledConnections: number;
    connectionDetails: Array<{
      id: string;
      inUse: boolean;
      queryCount: number;
      idleTime: number;
      lifetime: number;
    }>;
  } {
    const now = Date.now();
    
    return {
      poolSize: this.connections.size,
      activeConnections: this.stats.activeConnections,
      availableConnections: this.availableConnections.length,
      totalQueries: this.stats.totalQueries,
      checkpoints: this.stats.checkpoints,
      recycledConnections: this.stats.recycledConnections,
      connectionDetails: Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        inUse: conn.inUse,
        queryCount: conn.queryCount,
        idleTime: conn.inUse ? 0 : now - conn.lastUsed,
        lifetime: now - conn.created,
      })),
    };
  }

  /**
   * Close all connections and clean up
   */
  close(): void {
    logger.info("Closing connection pool", "CONNECTION_POOL", {
      stats: this.getStats(),
    });
    
    // Clear intervals
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
    }
    
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }
    
    // Close all connections
    for (const conn of this.connections.values()) {
      try {
        conn.db.close();
      } catch (error) {
        logger.error(`Error closing connection ${conn.id}: ${error}`, "CONNECTION_POOL");
      }
    }
    
    this.connections.clear();
    this.availableConnections = [];
    
    this.emit("close");
  }
}