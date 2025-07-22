import type Database from "better-sqlite3";
import { getDatabaseConnection } from "@/database/connection";
import { logger } from "@/utils/logger";
import { metrics } from "@/api/monitoring/metrics";
import { EventEmitter } from "events";

export interface QueryMetrics {
  query: string;
  duration: number;
  rowsAffected: number;
  rowsReturned: number;
  timestamp: Date;
}

export interface DatabaseStats {
  totalQueries: number;
  avgQueryTime: number;
  slowQueries: number;
  errorCount: number;
  cacheHitRate: number;
  tableStats: Map<string, TableStats>;
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
}

export interface TableStats {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  indexCount: number;
  lastAnalyzed: Date;
}

export interface PerformanceThresholds {
  slowQueryMs: number;
  criticalQueryMs: number;
  maxConnectionsWarning: number;
  cacheHitRateWarning: number;
}

export class DatabasePerformanceMonitor extends EventEmitter {
  private db: Database;
  private queryHistory: QueryMetrics[] = [];
  private slowQueryLog: QueryMetrics[] = [];
  private thresholds: PerformanceThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    super();

    this.db = getDatabaseConnection();
    this.thresholds = {
      slowQueryMs: thresholds.slowQueryMs || 1000,
      criticalQueryMs: thresholds.criticalQueryMs || 5000,
      maxConnectionsWarning: thresholds.maxConnectionsWarning || 50,
      cacheHitRateWarning: thresholds.cacheHitRateWarning || 0.8,
    };

    this.setupMonitoring();
  }

  /**
   * Setup database monitoring
   */
  private setupMonitoring(): void {
    // Override database prepare method to track queries
    const originalPrepare = this.db.prepare.bind(this.db);

    this.db.prepare = (sql: string) => {
      const statement = originalPrepare(sql);
      const originalRun = statement.run.bind(statement);
      const originalGet = statement.get.bind(statement);
      const originalAll = statement.all.bind(statement);

      // Track run operations
      statement.run = (...args: any[]) => {
        const start = Date.now();
        try {
          const result = originalRun(...args);
          this.recordQuery(sql, Date.now() - start, result.changes, 0);
          return result;
        } catch (error) {
          this.recordError(sql, error as Error);
          throw error;
        }
      };

      // Track get operations
      statement.get = (...args: any[]) => {
        const start = Date.now();
        try {
          const result = originalGet(...args);
          this.recordQuery(sql, Date.now() - start, 0, result ? 1 : 0);
          return result;
        } catch (error) {
          this.recordError(sql, error as Error);
          throw error;
        }
      };

      // Track all operations
      statement.all = (...args: any[]) => {
        const start = Date.now();
        try {
          const result = originalAll(...args);
          this.recordQuery(sql, Date.now() - start, 0, result.length);
          return result;
        } catch (error) {
          this.recordError(sql, error as Error);
          throw error;
        }
      };

      return statement;
    };
  }

  /**
   * Start performance monitoring
   */
  start(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      logger.warn("Database monitoring already started", "DB_MONITOR");
      return;
    }

    this.isMonitoring = true;

    // Run initial analysis
    this.performAnalysis();

    // Setup periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performAnalysis();
    }, intervalMs);

    logger.info("Database performance monitoring started", "DB_MONITOR", {
      interval: intervalMs,
    });
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    logger.info("Database performance monitoring stopped", "DB_MONITOR");
  }

  /**
   * Record query metrics
   */
  private recordQuery(
    query: string,
    duration: number,
    rowsAffected: number,
    rowsReturned: number,
  ): void {
    const queryMetric: QueryMetrics = {
      query: this.sanitizeQuery(query),
      duration,
      rowsAffected,
      rowsReturned,
      timestamp: new Date(),
    };

    // Add to history (keep last 1000 queries)
    this.queryHistory.push(queryMetric);
    if (this.queryHistory.length > 1000) {
      this.queryHistory.shift();
    }

    // Check for slow queries
    if (duration > this.thresholds.slowQueryMs) {
      this.slowQueryLog.push(queryMetric);

      if (duration > this.thresholds.criticalQueryMs) {
        this.emit("critical-query", queryMetric);
        logger.error("Critical slow query detected", "DB_MONITOR", {
          query: queryMetric.query.substring(0, 100),
          duration,
        });
      } else {
        logger.warn("Slow query detected", "DB_MONITOR", {
          query: queryMetric.query.substring(0, 100),
          duration,
        });
      }
    }

    // Record metrics
    metrics.histogram("database.query_duration", duration);
    metrics.increment("database.queries_total");
  }

  /**
   * Record query error
   */
  private recordError(query: string, error: Error): void {
    logger.error("Database query error", "DB_MONITOR", {
      query: this.sanitizeQuery(query).substring(0, 100),
      error: error.message,
    });

    metrics.increment("database.query_errors");
    this.emit("query-error", { query, error });
  }

  /**
   * Perform periodic analysis
   */
  private async performAnalysis(): Promise<void> {
    try {
      const stats = await this.collectStats();

      // Check thresholds
      if (stats.cacheHitRate < this.thresholds.cacheHitRateWarning) {
        logger.warn("Low cache hit rate", "DB_MONITOR", {
          cacheHitRate: stats.cacheHitRate,
        });
        this.emit("low-cache-hit-rate", stats.cacheHitRate);
      }

      // Record metrics
      metrics.gauge("database.avg_query_time", stats.avgQueryTime);
      metrics.gauge("database.slow_queries", stats.slowQueries);
      metrics.gauge("database.cache_hit_rate", stats.cacheHitRate);

      // Emit stats for consumers
      this.emit("stats", stats);
    } catch (error) {
      logger.error("Failed to perform database analysis", "DB_MONITOR", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Collect database statistics
   */
  async collectStats(): Promise<DatabaseStats> {
    const stats: DatabaseStats = {
      totalQueries: this.queryHistory.length,
      avgQueryTime: this.calculateAvgQueryTime(),
      slowQueries: this.slowQueryLog.length,
      errorCount: 0, // Would need to track this
      cacheHitRate: await this.getCacheHitRate(),
      tableStats: await this.getTableStats(),
      connectionPool: {
        active: 1, // SQLite doesn't have connection pooling
        idle: 0,
        total: 1,
      },
    };

    return stats;
  }

  /**
   * Calculate average query time
   */
  private calculateAvgQueryTime(): number {
    if (this.queryHistory.length === 0) return 0;

    const total = this.queryHistory.reduce((sum, q) => sum + q.duration, 0);
    return total / this.queryHistory.length;
  }

  /**
   * Get cache hit rate
   */
  private async getCacheHitRate(): Promise<number> {
    try {
      const result = this.db.prepare("PRAGMA cache_stats").get() as any;
      if (result && result.hit && result.miss) {
        return result.hit / (result.hit + result.miss);
      }
      return 1; // Default to 100% if not available
    } catch {
      return 1;
    }
  }

  /**
   * Get table statistics
   */
  private async getTableStats(): Promise<Map<string, TableStats>> {
    const tableStats = new Map<string, TableStats>();

    try {
      // Get list of tables
      const tables = this.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `,
        )
        .all() as any[];

      for (const table of tables) {
        const tableName = table.name;

        // Get row count
        const countResult = this.db
          .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
          .get() as any;

        // Get table info
        const indexCount = this.db
          .prepare(
            `
          SELECT COUNT(*) as count FROM sqlite_master 
          WHERE type='index' AND tbl_name = ?
        `,
          )
          .get(tableName) as any;

        tableStats.set(tableName, {
          tableName,
          rowCount: countResult.count,
          sizeBytes: 0, // SQLite doesn't provide easy table size
          indexCount: indexCount.count,
          lastAnalyzed: new Date(),
        });
      }
    } catch (error) {
      logger.error("Failed to collect table stats", "DB_MONITOR", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return tableStats;
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit: number = 10): QueryMetrics[] {
    return this.slowQueryLog
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Clear slow query log
   */
  clearSlowQueryLog(): void {
    this.slowQueryLog = [];
    logger.info("Slow query log cleared", "DB_MONITOR");
  }

  /**
   * Optimize database
   */
  async optimizeDatabase(): Promise<void> {
    try {
      logger.info("Starting database optimization", "DB_MONITOR");

      // Run VACUUM to reclaim space
      this.db.exec("VACUUM");

      // Analyze tables for query optimization
      this.db.exec("ANALYZE");

      // Rebuild indexes
      const indexes = this.db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type='index'
      `,
        )
        .all() as any[];

      for (const index of indexes) {
        this.db.exec(`REINDEX ${index.name}`);
      }

      logger.info("Database optimization completed", "DB_MONITOR");
      this.emit("optimization-complete");
    } catch (error) {
      logger.error("Failed to optimize database", "DB_MONITOR", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Export performance report
   */
  exportReport(): any {
    const stats = {
      summary: {
        totalQueries: this.queryHistory.length,
        avgQueryTime: this.calculateAvgQueryTime(),
        slowQueries: this.slowQueryLog.length,
        monitoring: {
          started: this.isMonitoring,
          uptime: process.uptime(),
        },
      },
      slowQueries: this.getSlowQueries(20),
      queryDistribution: this.getQueryDistribution(),
      recommendations: this.generateRecommendations(),
    };

    return stats;
  }

  /**
   * Get query distribution by type
   */
  private getQueryDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      SELECT: 0,
      INSERT: 0,
      UPDATE: 0,
      DELETE: 0,
      OTHER: 0,
    };

    this.queryHistory.forEach((q) => {
      const type = q.query.trim().split(" ")[0].toUpperCase();
      if (type in distribution) {
        distribution[type]++;
      } else {
        distribution.OTHER++;
      }
    });

    return distribution;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const avgQueryTime = this.calculateAvgQueryTime();
    if (avgQueryTime > 500) {
      recommendations.push(
        "Consider adding indexes to frequently queried columns",
      );
    }

    const slowQueryRatio =
      this.slowQueryLog.length / Math.max(this.queryHistory.length, 1);
    if (slowQueryRatio > 0.1) {
      recommendations.push(
        "More than 10% of queries are slow. Review query optimization",
      );
    }

    const distribution = this.getQueryDistribution();
    if (distribution.SELECT > distribution.INSERT * 10) {
      recommendations.push(
        "Read-heavy workload detected. Consider caching strategies",
      );
    }

    return recommendations;
  }

  /**
   * Sanitize query for logging
   */
  private sanitizeQuery(query: string): string {
    return query.replace(/\s+/g, " ").trim();
  }
}
