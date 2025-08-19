/**
 * Database Query Performance Monitor
 * Integrates with SQLite databases to track query performance
 */

import Database from 'better-sqlite3';
import { monitoringService } from '../../services/MonitoringService';
import { logger } from '../../utils/logger.js';

interface DatabaseConfig {
  name: string;
  path: string;
  slowQueryThreshold?: number; // in milliseconds
}

interface DatabaseConnection {
  db: Database.Database;
  name: string;
  slowQueryThreshold: number;
}

export class DatabaseMonitor {
  private connections: Map<string, DatabaseConnection> = new Map();
  private queryCounter = 0;

  /**
   * Register a database for monitoring
   */
  registerDatabase(config: DatabaseConfig): Database.Database {
    try {
      const db = new Database(config.path, { 
        verbose: (...args: unknown[]) => this.queryLogger(config.name, String(args[0] || '')),
        readonly: false
      });

      const connection: DatabaseConnection = {
        db,
        name: config.name,
        slowQueryThreshold: config.slowQueryThreshold || 100
      };

      this.connections.set(config.name, connection);

      // Wrap common database methods to monitor performance
      this.wrapDatabaseMethods(connection);

      // Register health check for this database
      monitoringService.registerHealthCheck(`database_${config.name}`, async () => {
        try {
          const startTime = Date.now();
          
          // Simple health check query
          const result = db.prepare('SELECT 1 as health').get();
          const responseTime = Date.now() - startTime;
          
          if (result && (result as any).health === 1) {
            return {
              name: `database_${config.name}`,
              status: 'healthy',
              responseTime,
              lastCheck: new Date().toISOString(),
              metadata: {
                database: config.name,
                path: config.path
              }
            };
          } else {
            throw new Error('Health check query failed');
          }
        } catch (error) {
          return {
            name: `database_${config.name}`,
            status: 'critical',
            error: error instanceof Error ? error.message : String(error),
            lastCheck: new Date().toISOString(),
            metadata: {
              database: config.name,
              path: config.path
            }
          };
        }
      });

      logger.info(`Database monitoring registered for ${config.name}`, 'DB_MONITOR', {
        name: config.name,
        path: config.path,
        slowQueryThreshold: connection.slowQueryThreshold
      });

      return db;
    } catch (error) {
      logger.error(`Failed to register database ${config.name}`, 'DB_MONITOR', { error });
      throw error;
    }
  }

  /**
   * Query logger for better-sqlite3 verbose mode
   */
  private queryLogger(databaseName: string, sql: string): void {
    // This is called by better-sqlite3 when verbose mode is enabled
    // We'll use this for basic query logging, but detailed performance
    // tracking happens in the wrapped methods
    logger.debug(`[${databaseName}] ${sql}`, 'DB_QUERY');
  }

  /**
   * Wrap database methods to add performance monitoring
   */
  private wrapDatabaseMethods(connection: DatabaseConnection): void {
    const { db, name, slowQueryThreshold } = connection;

    // Wrap prepare method to monitor prepared statements
    const originalPrepare = db.prepare.bind(db);
    (db as any).prepare = (sql: string) => {
      const statement = originalPrepare(sql);
      
      // Wrap statement methods
      this.wrapStatementMethods(statement, name, sql, slowQueryThreshold);
      
      return statement;
    };

    // Wrap exec method for direct SQL execution
    const originalExec = db.exec.bind(db);
    db.exec = (sql: string) => {
      const startTime = Date.now();
      const queryId = `exec_${++this.queryCounter}`;
      
      try {
        const result = originalExec(sql);
        const executionTime = Date.now() - startTime;
        
        this.recordQuery(queryId, sql, name, executionTime, undefined, undefined);
        
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.recordQuery(queryId, sql, name, executionTime, undefined, errorMessage);
        
        throw error;
      }
    };
  }

  /**
   * Wrap prepared statement methods for performance monitoring
   */
  private wrapStatementMethods(
    statement: Database.Statement,
    databaseName: string,
    sql: string,
    slowQueryThreshold: number
  ): void {
    // Wrap get method
    const originalGet = statement.get.bind(statement);
    statement.get = (...params: any[]) => {
      const startTime = Date.now();
      const queryId = `get_${++this.queryCounter}`;
      
      try {
        const result = originalGet(...params);
        const executionTime = Date.now() - startTime;
        
        this.recordQuery(queryId, sql, databaseName, executionTime, result ? 1 : 0, undefined);
        
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.recordQuery(queryId, sql, databaseName, executionTime, undefined, errorMessage);
        
        throw error;
      }
    };

    // Wrap all method
    const originalAll = statement.all.bind(statement);
    statement.all = (...params: any[]) => {
      const startTime = Date.now();
      const queryId = `all_${++this.queryCounter}`;
      
      try {
        const results = originalAll(...params);
        const executionTime = Date.now() - startTime;
        const rowCount = Array.isArray(results) ? results.length : 0;
        
        this.recordQuery(queryId, sql, databaseName, executionTime, rowCount, undefined);
        
        return results;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.recordQuery(queryId, sql, databaseName, executionTime, undefined, errorMessage);
        
        throw error;
      }
    };

    // Wrap run method
    const originalRun = statement.run.bind(statement);
    statement.run = (...params: any[]) => {
      const startTime = Date.now();
      const queryId = `run_${++this.queryCounter}`;
      
      try {
        const info = originalRun(...params);
        const executionTime = Date.now() - startTime;
        
        this.recordQuery(queryId, sql, databaseName, executionTime, info.changes, undefined);
        
        return info;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.recordQuery(queryId, sql, databaseName, executionTime, undefined, errorMessage);
        
        throw error;
      }
    };

    // Wrap iterate method
    const originalIterate = statement.iterate.bind(statement);
    statement.iterate = (...params: any[]) => {
      const startTime = Date.now();
      const queryId = `iterate_${++this.queryCounter}`;
      
      try {
        const iterator = originalIterate(...params);
        
        // We can't easily track the full execution time for iterators,
        // so we'll record the setup time
        const setupTime = Date.now() - startTime;
        this.recordQuery(queryId, sql, databaseName, setupTime, undefined, undefined);
        
        return iterator;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.recordQuery(queryId, sql, databaseName, executionTime, undefined, errorMessage);
        
        throw error;
      }
    };
  }

  /**
   * Record query performance data
   */
  private recordQuery(
    queryId: string,
    sql: string,
    database: string,
    executionTime: number,
    rowsAffected?: number,
    error?: string
  ): void {
    // Record in monitoring service
    monitoringService.recordDatabaseQuery(
      sql,
      database,
      executionTime,
      rowsAffected,
      error
    );

    // Record additional metrics
    monitoringService.recordMetric('db.queries.total', 1, { database }, 'counter');
    
    if (error) {
      monitoringService.recordMetric('db.queries.errors', 1, { database }, 'counter');
    } else {
      monitoringService.recordMetric('db.queries.success', 1, { database }, 'counter');
    }

    // Check connection-specific thresholds
    const connection = this.connections.get(database);
    if (connection && executionTime > connection.slowQueryThreshold) {
      monitoringService.createAlert('performance', 'low', 
        `Slow query in ${database}: ${executionTime}ms`, {
        database,
        executionTime,
        threshold: connection.slowQueryThreshold,
        sql: sql.length > 100 ? sql.substring(0, 100) + '...' : sql,
        queryId
      });
    }
  }

  /**
   * Get database statistics
   */
  getStatistics(databaseName?: string): any {
    const stats: any = {};
    
    for (const [name, connection] of this.connections.entries()) {
      if (databaseName && name !== databaseName) continue;
      
      try {
        // Get basic database info
        const db = connection.db;
        const info: Record<string, any> = {
          name,
          inMemory: db.memory,
          open: db.open,
          readonly: db.readonly,
          path: (db as any).name || 'memory'
        };
        
        // Get table count
        try {
          const tables = db.prepare(`
            SELECT COUNT(*) as count 
            FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
          `).get() as { count: number };
          
          info['tableCount'] = tables.count;
        } catch (e) {
          info['tableCount'] = 'unknown';
        }
        
        // Get database size (if not in memory)
        if (!db.memory) {
          try {
            const size = db.prepare('PRAGMA page_count').get() as { page_count: number };
            const pageSize = db.prepare('PRAGMA page_size').get() as { page_size: number };
            info['sizeBytes'] = size.page_count * pageSize.page_size;
          } catch (e) {
            info['sizeBytes'] = 'unknown';
          }
        }
        
        stats[name] = info;
      } catch (error) {
        stats[name] = {
          name,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    return databaseName ? stats[databaseName] : stats;
  }

  /**
   * Close a database connection
   */
  closeDatabase(name: string): void {
    const connection = this.connections.get(name);
    if (connection) {
      try {
        connection.db.close();
        this.connections.delete(name);
        
        logger.info(`Database monitoring stopped for ${name}`, 'DB_MONITOR', { name });
      } catch (error) {
        logger.error(`Error closing database ${name}`, 'DB_MONITOR', { error });
      }
    }
  }

  /**
   * Close all database connections
   */
  closeAll(): void {
    for (const [name] of this.connections) {
      this.closeDatabase(name);
    }
  }

  /**
   * Get list of monitored databases
   */
  getDatabases(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Export singleton instance
export const databaseMonitor = new DatabaseMonitor();
export default databaseMonitor;