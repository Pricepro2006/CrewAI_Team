
/**
 * Database Connection Pool Configuration
 * Optimized for production deployment
 */

export const dbPoolConfig = {
  // Connection pool settings
  min: 2,              // Minimum connections in pool
  max: 10,             // Maximum connections in pool
  idleTimeoutMillis: 30000,  // Close idle connections after 30 seconds
  
  // SQLite-specific settings (for better-sqlite3)
  readonly: false,
  fileMustExist: true,
  timeout: 10000,      // 10 second timeout
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  
  // Pragma settings (applied to each new connection)
  pragmas: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    cache_size: -64000,  // 64MB
    temp_store: 'MEMORY',
    mmap_size: 268435456,  // 256MB
    busy_timeout: 10000,
    foreign_keys: 'ON'
  }
};

/**
 * Connection pool implementation for better-sqlite3
 */
import Database from 'better-sqlite3';

class SQLitePool {
  private connections: Database.Database[] = [];
  private available: Database.Database[] = [];
  private config: typeof dbPoolConfig;
  
  constructor(dbPath: string, config = dbPoolConfig) {
    this.config = config;
    
    // Create initial connections
    for (let i = 0; i < config.min; i++) {
      const conn = this.createConnection(dbPath);
      this.connections.push(conn);
      this.available.push(conn);
    }
  }
  
  private createConnection(dbPath: string): Database.Database {
    const db = new Database(dbPath, {
      readonly: this.config.readonly,
      fileMustExist: this.config.fileMustExist,
      timeout: this.config.timeout,
      verbose: this.config.verbose
    });
    
    // Apply pragmas
    for (const [pragma, value] of Object.entries(this.config.pragmas)) {
      db.pragma(`${pragma} = ${value}`);
    }
    
    return db;
  }
  
  async acquire(): Promise<Database.Database> {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    
    if (this.connections.length < this.config.max) {
      const conn = this.createConnection(dbPath);
      this.connections.push(conn);
      return conn;
    }
    
    // Wait for connection to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.available.length > 0) {
          clearInterval(checkInterval);
          resolve(this.available.pop()!);
        }
      }, 100);
    });
  }
  
  release(conn: Database.Database) {
    this.available.push(conn);
  }
  
  async close() {
    for (const conn of this.connections) {
      conn.close();
    }
    this.connections = [];
    this.available = [];
  }
}

export default SQLitePool;
