/**
 * Database Performance Optimizer
 * Optimizes SQLite performance while maintaining security with parameterized queries
 */

import Database from 'better-sqlite3';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';

export interface QueryPlan {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
}

export interface QueryStats {
  executionTime: number;
  rowsExamined: number;
  rowsReturned: number;
  indexesUsed: string[];
  fullTableScans: boolean;
}

export class DatabasePerformanceOptimizer {
  private db: Database.Database;
  private queryPlanCache = new Map<string, QueryPlan[]>();
  private slowQueryThreshold = 100; // milliseconds

  constructor(db: Database.Database) {
    this.db = db;
    this.configureSQLiteOptimizations();
  }

  /**
   * Configure SQLite optimizations for better performance
   */
  private configureSQLiteOptimizations(): void {
    try {
      // Enable query planner optimizations
      this.db.pragma('optimize');
      
      // Set cache size (negative value = KB, positive = pages)
      // 64MB cache for better performance
      this.db.pragma('cache_size = -65536');
      
      // Enable memory-mapped I/O for faster reads (512MB)
      this.db.pragma('mmap_size = 536870912');
      
      // Use WAL mode for better concurrency
      const currentMode = this.db.pragma('journal_mode');
      if (currentMode !== 'wal') {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages
      }
      
      // Enable foreign key constraints for data integrity
      this.db.pragma('foreign_keys = ON');
      
      // Set busy timeout to handle concurrent access (5 seconds)
      this.db.pragma('busy_timeout = 5000');
      
      // Enable auto_vacuum for space optimization
      const currentVacuum = this.db.pragma('auto_vacuum');
      if (currentVacuum === 0) {
        this.db.pragma('auto_vacuum = INCREMENTAL');
      }
      
      // Set temp_store to memory for better performance
      this.db.pragma('temp_store = MEMORY');
      
      // Increase page size for better performance with larger datasets
      const currentPageSize = this.db.pragma('page_size');
      if (currentPageSize !== 4096) {
        this.db.pragma('page_size = 4096');
        // Need to VACUUM to apply page size change
        this.db.exec('VACUUM');
      }

      logger.info('SQLite optimizations configured', 'DB_PERFORMANCE', {
        cacheSize: this.db.pragma('cache_size'),
        journalMode: this.db.pragma('journal_mode'),
        pageSize: this.db.pragma('page_size'),
        walEnabled: this.db.pragma('journal_mode') === 'wal'
      });

    } catch (error) {
      logger.error('Failed to configure SQLite optimizations', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Analyze query execution plan
   */
  analyzeQueryPlan(query: string, params: any[] = []): QueryPlan[] {
    try {
      // Check cache first
      const cacheKey = `${query}-${JSON.stringify(params)}`;
      if (this.queryPlanCache.has(cacheKey)) {
        return this.queryPlanCache.get(cacheKey)!;
      }

      // Get query plan
      const planQuery = `EXPLAIN QUERY PLAN ${query}`;
      const plan = this.db.prepare(planQuery).all(...params) as QueryPlan[];

      // Cache the plan
      this.queryPlanCache.set(cacheKey, plan);

      // Check for performance issues
      const hasFullTableScan = plan.some(step => 
        step.detail.includes('SCAN TABLE') && !step.detail.includes('USING INDEX')
      );

      if (hasFullTableScan) {
        logger.warn('Full table scan detected', 'DB_PERFORMANCE', {
          query: query.substring(0, 100),
          plan: plan.map(p => p.detail)
        });
        metrics.increment('database.full_table_scans');
      }

      return plan;
    } catch (error) {
      logger.error('Failed to analyze query plan', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error),
        query: query.substring(0, 100)
      });
      return [];
    }
  }

  /**
   * Profile query execution
   */
  profileQuery(query: string, params: any[] = []): QueryStats {
    const startTime = Date.now();
    const startCpuUsage = process.cpuUsage();

    try {
      // Analyze query plan first
      const plan = this.analyzeQueryPlan(query, params);
      
      // Execute query with profiling
      const stmt = this.db.prepare(query);
      const result = stmt.all(...params);
      
      const executionTime = Date.now() - startTime;
      const cpuUsage = process.cpuUsage(startCpuUsage);

      // Extract index usage from plan
      const indexesUsed = plan
        .filter(step => step.detail.includes('USING INDEX'))
        .map(step => {
          const match = step.detail.match(/USING INDEX ([^\s]+)/);
          return match ? match[1] : 'unknown';
        });

      const hasFullTableScan = plan.some(step => 
        step.detail.includes('SCAN TABLE') && !step.detail.includes('USING INDEX')
      );

      const stats: QueryStats = {
        executionTime,
        rowsExamined: stmt.reader ? 1000 : 0, // Estimate
        rowsReturned: Array.isArray(result) ? result.length : 1,
        indexesUsed,
        fullTableScans: hasFullTableScan
      };

      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        logger.warn('Slow query detected', 'DB_PERFORMANCE', {
          query: query.substring(0, 200),
          stats,
          cpuTime: (cpuUsage.user + cpuUsage.system) / 1000
        });
        metrics.histogram('database.slow_query_time', executionTime);
      }

      metrics.histogram('database.query_execution_time', executionTime);
      
      return stats;
    } catch (error) {
      logger.error('Failed to profile query', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get index information for a table
   */
  getTableIndexes(tableName: string): IndexInfo[] {
    try {
      const indexes = this.db.prepare(`
        SELECT name, sql FROM sqlite_master 
        WHERE type = 'index' AND tbl_name = ?
      `).all(tableName);

      return indexes.map((idx: any) => {
        const info: IndexInfo = {
          name: idx.name,
          table: tableName,
          columns: [],
          unique: idx.sql?.includes('UNIQUE') || false,
          partial: idx.sql?.includes('WHERE') || false
        };

        // Extract columns from SQL
        if (idx.sql) {
          const columnMatch = idx.sql.match(/\(([^)]+)\)/);
          if (columnMatch) {
            info.columns = columnMatch[1].split(',').map((col: string) => col.trim());
          }
        }

        return info;
      });
    } catch (error) {
      logger.error('Failed to get table indexes', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error),
        tableName
      });
      return [];
    }
  }

  /**
   * Suggest indexes for a query based on WHERE and JOIN clauses
   */
  suggestIndexes(query: string): string[] {
    const suggestions: string[] = [];
    const normalizedQuery = query.toLowerCase();

    try {
      // Extract table names
      const tableMatches = normalizedQuery.matchAll(/(?:from|join)\s+(\w+)/g);
      const tables = Array.from(tableMatches, m => m[1]);

      // Extract WHERE clause columns
      const whereMatch = normalizedQuery.match(/where\s+(.+?)(?:group|order|limit|$)/s);
      if (whereMatch) {
        const whereClause = whereMatch[1];
        const columnMatches = whereClause.matchAll(/(\w+)\s*[=<>!]/g);
        const columns = Array.from(columnMatches, m => m[1]);

        // Suggest composite indexes for multiple columns
        if (columns.length > 1) {
          tables.forEach(table => {
            suggestions.push(
              `CREATE INDEX idx_${table}_${columns.join('_')} ON ${table}(${columns.join(', ')});`
            );
          });
        } else if (columns.length === 1) {
          tables.forEach(table => {
            suggestions.push(
              `CREATE INDEX idx_${table}_${columns[0]} ON ${table}(${columns[0]});`
            );
          });
        }
      }

      // Extract ORDER BY columns
      const orderMatch = normalizedQuery.match(/order\s+by\s+(\w+)/);
      if (orderMatch) {
        const orderColumn = orderMatch[1];
        tables.forEach(table => {
          suggestions.push(
            `CREATE INDEX idx_${table}_${orderColumn} ON ${table}(${orderColumn});`
          );
        });
      }

      return [...new Set(suggestions)]; // Remove duplicates
    } catch (error) {
      logger.error('Failed to suggest indexes', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error)
      });
      return suggestions;
    }
  }

  /**
   * Analyze table statistics
   */
  analyzeTableStats(tableName: string): void {
    try {
      // Update SQLite statistics
      this.db.exec(`ANALYZE ${tableName}`);
      
      // Get table stats
      const stats = this.db.prepare(`
        SELECT * FROM sqlite_stat1 WHERE tbl = ?
      `).all(tableName);

      logger.info('Table statistics updated', 'DB_PERFORMANCE', {
        tableName,
        stats
      });

    } catch (error) {
      logger.error('Failed to analyze table stats', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error),
        tableName
      });
    }
  }

  /**
   * Optimize database (VACUUM and ANALYZE)
   */
  optimizeDatabase(): void {
    try {
      logger.info('Starting database optimization', 'DB_PERFORMANCE');
      
      // Run ANALYZE to update statistics
      this.db.exec('ANALYZE');
      
      // Run incremental vacuum if auto_vacuum is enabled
      const autoVacuum = this.db.pragma('auto_vacuum');
      if (autoVacuum > 0) {
        this.db.exec('PRAGMA incremental_vacuum');
      } else {
        // Full VACUUM (requires exclusive lock)
        logger.warn('Running full VACUUM - this may take time', 'DB_PERFORMANCE');
        this.db.exec('VACUUM');
      }
      
      // Optimize query planner
      this.db.pragma('optimize');
      
      logger.info('Database optimization completed', 'DB_PERFORMANCE');
      metrics.increment('database.optimizations');

    } catch (error) {
      logger.error('Failed to optimize database', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check query compatibility with parameterized approach
   */
  validateParameterizedQuery(query: string, paramCount: number): boolean {
    try {
      // Count placeholders in query
      const placeholders = (query.match(/\?/g) || []).length;
      
      if (placeholders !== paramCount) {
        logger.warn('Parameter count mismatch', 'DB_PERFORMANCE', {
          query: query.substring(0, 100),
          expectedParams: placeholders,
          actualParams: paramCount
        });
        return false;
      }

      // Check for common anti-patterns
      const antiPatterns = [
        /\|\|/,  // String concatenation
        /\+\s*['"`]/, // String concatenation with quotes
        /concat\s*\(/i, // CONCAT function
      ];

      for (const pattern of antiPatterns) {
        if (pattern.test(query)) {
          logger.warn('Query contains anti-patterns', 'DB_PERFORMANCE', {
            query: query.substring(0, 100),
            pattern: pattern.toString()
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Failed to validate parameterized query', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Monitor connection pool health
   */
  getConnectionStats(): any {
    try {
      return {
        cacheSize: this.db.pragma('cache_size'),
        pageSize: this.db.pragma('page_size'),
        journalMode: this.db.pragma('journal_mode'),
        walSize: this.db.pragma('wal_checkpoint'),
        busyTimeout: this.db.pragma('busy_timeout'),
        mmapSize: this.db.pragma('mmap_size')
      };
    } catch (error) {
      logger.error('Failed to get connection stats', 'DB_PERFORMANCE', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }

  /**
   * Clear query plan cache
   */
  clearCache(): void {
    this.queryPlanCache.clear();
    logger.info('Query plan cache cleared', 'DB_PERFORMANCE');
  }
}

// Export factory function
export function createDatabasePerformanceOptimizer(db: Database.Database): DatabasePerformanceOptimizer {
  return new DatabasePerformanceOptimizer(db);
}