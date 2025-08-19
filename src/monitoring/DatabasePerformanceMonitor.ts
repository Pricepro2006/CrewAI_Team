/**
 * Database Performance Monitoring System
 * Monitors SQLite query performance, connection pool usage, and optimization opportunities
 */

import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface QueryMetrics {
  queryId: string;
  sql: string;
  normalizedSql: string;
  parameters?: any[];
  executionTime: number;
  timestamp: number;
  rowsAffected?: number;
  rowsReturned?: number;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
  source: string; // Component or service that executed the query
  error?: boolean;
  errorMessage?: string;
  memoryUsed?: number;
  cpuTime?: number;
}

export interface ConnectionMetrics {
  connectionId: string;
  database: string;
  openedAt: number;
  closedAt?: number;
  connectionDuration?: number;
  queriesExecuted: number;
  totalExecutionTime: number;
  avgExecutionTime: number;
  errorCount: number;
}

export interface DatabaseHealth {
  database: string;
  timestamp: number;
  size: number; // bytes
  pageCount: number;
  pageSize: number;
  freePages: number;
  schemaVersion: number;
  userVersion: number;
  walMode: boolean;
  journalMode: string;
  synchronous: string;
  cacheSize: number;
  mmapSize: number;
  indexCount: number;
  tableCount: number;
}

export interface SlowQuery {
  sql: string;
  normalizedSql: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
  lastSeen: number;
  percentile95: number;
  percentile99: number;
}

export interface DatabaseAggregates {
  timestamp: number;
  queryCount: number;
  avgQueryTime: number;
  slowQueryCount: number;
  errorRate: number;
  queriesPerSecond: number;
  connectionPoolUsage: number;
  databaseSize: number;
  topSlowQueries: SlowQuery[];
  queryTypeDistribution: Record<string, number>;
  hourlyTrends: Array<{
    hour: number;
    queryCount: number;
    avgTime: number;
    errorCount: number;
  }>;
  indexEfficiency: Array<{
    table: string;
    indexName: string;
    usage: number;
    efficiency: number;
  }>;
}

export interface OptimizationSuggestion {
  type: 'missing_index' | 'unused_index' | 'slow_query' | 'schema_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  table: string;
  suggestion: string;
  impact: string;
  query?: string;
  estimatedImprovement?: string;
}

class DatabasePerformanceMonitor extends EventEmitter {
  private static instance: DatabasePerformanceMonitor;
  private queryMetrics: QueryMetrics[] = [];
  private connections = new Map<string, ConnectionMetrics>();
  private slowQueries = new Map<string, SlowQuery>();
  private aggregationInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  private initialized = false;
  private thresholds = {
    slowQueryMs: 1000,
    verySlowQueryMs: 5000,
    maxErrorRate: 5, // percentage
    maxQueryTime: 10000, // 10 seconds
    maxDatabaseSize: 1000 * 1024 * 1024, // 1GB
  };
  private databases = new Map<string, Database.Database>();

  private constructor() {
    super();
  }

  static getInstance(): DatabasePerformanceMonitor {
    if (!DatabasePerformanceMonitor.instance) {
      DatabasePerformanceMonitor.instance = new DatabasePerformanceMonitor();
    }
    return DatabasePerformanceMonitor.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Database performance monitor already initialized', 'DB_PERF');
      return;
    }

    // Start aggregation
    this.aggregationInterval = setInterval(() => {
      this.aggregateMetrics();
    }, 60 * 1000); // Every minute

    // Start optimization analysis
    this.optimizationInterval = setInterval(() => {
      this.analyzeOptimizations();
    }, 10 * 60 * 1000); // Every 10 minutes

    this.initialized = true;
    logger.info('Database performance monitor initialized', 'DB_PERF');
    this.emit('initialized');
  }

  // Register a database for monitoring
  registerDatabase(database: Database.Database, name: string): void {
    this.databases.set(name, database);
    
    // Wrap database methods to track performance
    this.wrapDatabaseMethods(database, name);
    
    logger.info('Database registered for monitoring', 'DB_PERF', { name });
  }

  private wrapDatabaseMethods(db: Database.Database, dbName: string): void {
    if (!db) return;
    
    // Wrap prepare method
    const originalPrepare = db.prepare?.bind(db);
    if (originalPrepare) {
      db.prepare = function(sql: string) {
        const statement = originalPrepare(sql);
        const instance = DatabasePerformanceMonitor.instance;
        return instance ? instance.wrapStatement(statement, sql, dbName) : statement;
      };
    }

    // Wrap exec method
    const originalExec = db.exec?.bind(db);
    if (originalExec) {
      db.exec = function(sql: string) {
        const instance = DatabasePerformanceMonitor.instance;
        const queryId = instance ? instance.generateQueryId() : 'unknown';
        const startTime = process.hrtime ? process.hrtime.bigint() : BigInt(Date.now() * 1000000);
        const startCpu = process.cpuUsage ? process.cpuUsage() : { user: 0, system: 0 };
        const startMemory = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0 };

      try {
        const result = originalExec(sql);
        const endTime = process.hrtime ? process.hrtime.bigint() : BigInt(Date.now() * 1000000);
        const endCpu = process.cpuUsage ? process.cpuUsage(startCpu) : { user: 0, system: 0 };
        const endMemory = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0 };
        
        const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const cpuTime = (endCpu.user + endCpu.system) / 1000; // Convert to milliseconds
        const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

        if (instance) {
          instance.recordQuery({
            queryId,
            sql,
            normalizedSql: instance.normalizeSql(sql),
            executionTime,
            timestamp: Date.now(),
            operation: instance.getQueryOperation(sql),
            source: dbName,
            cpuTime,
            memoryUsed,
          });
        }

        return result;
      } catch (error) {
        const endTime = process.hrtime ? process.hrtime.bigint() : BigInt(Date.now() * 1000000);
        const executionTime = Number(endTime - startTime) / 1000000;

        if (instance) {
          instance.recordQuery({
            queryId,
            sql,
            normalizedSql: instance.normalizeSql(sql),
            executionTime,
            timestamp: Date.now(),
            operation: instance.getQueryOperation(sql),
            source: dbName,
            error: true,
            errorMessage: (error as Error).message,
          });
        }

        throw error;
      }
      };
    }
  }

  private wrapStatement(statement: any, sql: string, dbName: string): any {
    const originalRun = statement.run?.bind(statement);
    const originalGet = statement.get?.bind(statement);
    const originalAll = statement.all?.bind(statement);
    const originalIterate = statement.iterate?.bind(statement);

    if (originalRun) {
      statement.run = (...params: any[]) => {
        return this.executeWithTracking('run', originalRun, sql, dbName, params);
      };
    }

    if (originalGet) {
      statement.get = (...params: any[]) => {
        return this.executeWithTracking('get', originalGet, sql, dbName, params);
      };
    }

    if (originalAll) {
      statement.all = (...params: any[]) => {
        return this.executeWithTracking('all', originalAll, sql, dbName, params);
      };
    }

    if (originalIterate) {
      statement.iterate = (...params: any[]) => {
        return this.executeWithTracking('iterate', originalIterate, sql, dbName, params);
      };
    }

    return statement;
  }

  private executeWithTracking(method: string, originalMethod: Function, sql: string, dbName: string, params: any[]): any {
    const queryId = this.generateQueryId();
    const startTime = process.hrtime ? process.hrtime.bigint() : BigInt(Date.now() * 1000000);
    const startCpu = process.cpuUsage ? process.cpuUsage() : { user: 0, system: 0 };
    const startMemory = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0 };

    try {
      const result = originalMethod(...params);
      const endTime = process.hrtime ? process.hrtime.bigint() : BigInt(Date.now() * 1000000);
      const endCpu = process.cpuUsage ? process.cpuUsage(startCpu) : { user: 0, system: 0 };
      const endMemory = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0 };
      
      const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const cpuTime = (endCpu.user + endCpu.system) / 1000; // Convert to milliseconds
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      let rowsAffected: number | undefined;
      let rowsReturned: number | undefined;

      if (result && typeof result === 'object') {
        if ('changes' in result) rowsAffected = result.changes;
        if ('lastInsertRowid' in result) rowsAffected = 1;
        if (Array.isArray(result)) rowsReturned = result.length || 0;
        else if (result && method === 'get') rowsReturned = 1;
      }

      this.recordQuery({
        queryId,
        sql,
        normalizedSql: this.normalizeSql(sql),
        parameters: params,
        executionTime,
        timestamp: Date.now(),
        rowsAffected,
        rowsReturned,
        operation: this.getQueryOperation(sql),
        source: `${dbName}.${method}`,
        cpuTime,
        memoryUsed,
      });

      return result;
    } catch (error) {
      const endTime = process.hrtime ? process.hrtime.bigint() : BigInt(Date.now() * 1000000);
      const executionTime = Number(endTime - startTime) / 1000000;

      this.recordQuery({
        queryId,
        sql,
        normalizedSql: this.normalizeSql(sql),
        parameters: params,
        executionTime,
        timestamp: Date.now(),
        operation: this.getQueryOperation(sql),
        source: `${dbName}.${method}`,
        error: true,
        errorMessage: (error as Error).message,
      });

      throw error;
    }
  }

  recordQuery(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);
    
    // Update slow query tracking
    if (metrics.executionTime >= this.thresholds.slowQueryMs) {
      this.updateSlowQueryTracking(metrics);
    }

    // Keep only recent queries for memory efficiency
    if (this.queryMetrics.length > 50000) {
      this.queryMetrics = this.queryMetrics.slice(-25000);
    }

    // Emit alerts for very slow queries
    if (metrics.executionTime >= this.thresholds.verySlowQueryMs) {
      this.emit('very-slow-query', {
        ...metrics,
        threshold: this.thresholds.verySlowQueryMs,
      });
    }

    // Emit alerts for query errors
    if (metrics.error) {
      this.emit('query-error', metrics);
    }

    logger.debug('Query metrics recorded', 'DB_PERF', {
      queryId: metrics.queryId,
      operation: metrics.operation,
      executionTime: metrics.executionTime,
      source: metrics.source,
      error: metrics.error,
    });
  }

  private updateSlowQueryTracking(metrics: QueryMetrics): void {
    const existing = this.slowQueries.get(metrics.normalizedSql);
    
    if (existing) {
      existing.count++;
      existing.totalTime += metrics.executionTime;
      existing.avgTime = existing.totalTime / existing.count;
      existing.maxTime = Math.max(existing.maxTime, metrics.executionTime);
      existing.minTime = Math.min(existing.minTime, metrics.executionTime);
      existing.lastSeen = metrics.timestamp;
    } else {
      this.slowQueries.set(metrics.normalizedSql, {
        sql: metrics.sql,
        normalizedSql: metrics.normalizedSql,
        count: 1,
        totalTime: metrics.executionTime,
        avgTime: metrics.executionTime,
        maxTime: metrics.executionTime,
        minTime: metrics.executionTime,
        lastSeen: metrics.timestamp,
        percentile95: metrics.executionTime,
        percentile99: metrics.executionTime,
      });
    }
  }

  private generateQueryId(): string {
    return `qry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private normalizeSql(sql: string): string {
    // Normalize SQL by removing literals and parameters
    return sql
      .replace(/\s+/g, ' ')
      .replace(/'[^']*'/g, '?')
      .replace(/"[^"]*"/g, '?')
      .replace(/\b\d+\b/g, '?')
      .replace(/\$\d+/g, '?')
      .replace(/\?+/g, '?')
      .trim()
      .toLowerCase();
  }

  private getQueryOperation(sql: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' {
    const normalized = sql.trim().toLowerCase();
    if (normalized.startsWith('select')) return 'SELECT';
    if (normalized.startsWith('insert')) return 'INSERT';
    if (normalized.startsWith('update')) return 'UPDATE';
    if (normalized.startsWith('delete')) return 'DELETE';
    return 'OTHER';
  }

  // Get database health metrics
  async getDatabaseHealth(dbName: string): Promise<DatabaseHealth | null> {
    const db = this.databases.get(dbName);
    if (!db) return null;

    try {
      const pragmaQueries = {
        pageCount: 'PRAGMA page_count',
        pageSize: 'PRAGMA page_size',
        freePages: 'PRAGMA freelist_count',
        schemaVersion: 'PRAGMA schema_version',
        userVersion: 'PRAGMA user_version',
        journalMode: 'PRAGMA journal_mode',
        synchronous: 'PRAGMA synchronous',
        cacheSize: 'PRAGMA cache_size',
        mmapSize: 'PRAGMA mmap_size',
      };

      const results: any = {};
      for (const [key, query] of Object.entries(pragmaQueries)) {
        try {
          const result = db.prepare(query).get();
          results[key] = Object.values(result)[0];
        } catch (error) {
          results[key] = 0;
        }
      }

      // Get table and index counts
      const tableCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as any;
      const indexCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as any;

      // Get database file size
      const dbPath = (db as any).name;
      let size = 0;
      try {
        if (dbPath && typeof dbPath === 'string') {
          const stats = fs.statSync(dbPath);
          size = stats.size;
        }
      } catch (error) {
        // Database might be in-memory
      }

      return {
        database: dbName,
        timestamp: Date.now(),
        size,
        pageCount: results.pageCount || 0,
        pageSize: results.pageSize || 0,
        freePages: results.freePages || 0,
        schemaVersion: results.schemaVersion || 0,
        userVersion: results.userVersion || 0,
        walMode: results.journalMode === 'wal',
        journalMode: results.journalMode || 'unknown',
        synchronous: results.synchronous || 'unknown',
        cacheSize: results.cacheSize || 0,
        mmapSize: results.mmapSize || 0,
        indexCount: indexCount.count || 0,
        tableCount: tableCount.count || 0,
      };
    } catch (error) {
      logger.error('Failed to get database health', 'DB_PERF', { dbName }, error as Error);
      return null;
    }
  }

  // Aggregate metrics for reporting
  private aggregateMetrics(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentQueries = this.queryMetrics.filter(q => q.timestamp > oneHourAgo);

    if (!recentQueries || recentQueries.length === 0) {
      return;
    }

    const totalQueries = recentQueries.length;
    const totalTime = recentQueries.reduce((sum: any, q: any) => sum + q.executionTime, 0);
    const avgQueryTime = totalTime / totalQueries;
    const slowQueries = recentQueries.filter(q => q.executionTime >= this.thresholds.slowQueryMs);
    const errorQueries = recentQueries.filter(q => q.error);
    const errorRate = ((errorQueries?.length || 0) / totalQueries) * 100;

    const aggregates: DatabaseAggregates = {
      timestamp: now,
      queryCount: totalQueries,
      avgQueryTime,
      slowQueryCount: slowQueries?.length || 0,
      errorRate,
      queriesPerSecond: totalQueries / 3600, // per hour / 3600 seconds
      connectionPoolUsage: this.getConnectionPoolUsage(),
      databaseSize: this.getTotalDatabaseSize(),
      topSlowQueries: this.getTopSlowQueries(10),
      queryTypeDistribution: this.getQueryTypeDistribution(recentQueries),
      hourlyTrends: this.getHourlyTrends(recentQueries),
      indexEfficiency: [], // Will be populated asynchronously
    };

    // Check for performance alerts
    this.checkPerformanceAlerts(aggregates);

    // Emit aggregates
    this.emit('metrics-aggregated', aggregates);

    logger.debug('Database metrics aggregated', 'DB_PERF', {
      queryCount: aggregates.queryCount,
      avgQueryTime: aggregates.avgQueryTime,
      slowQueryCount: aggregates.slowQueryCount,
      errorRate: aggregates.errorRate,
    });
  }

  private getConnectionPoolUsage(): number {
    // This would be more sophisticated in a real connection pool scenario
    return this.connections.size;
  }

  private getTotalDatabaseSize(): number {
    let totalSize = 0;
    for (const [name] of this.databases) {
      try {
        const dbPath = (this.databases.get(name) as any)?.name;
        if (dbPath && typeof dbPath === 'string') {
          const stats = fs.statSync(dbPath);
          totalSize += stats.size;
        }
      } catch (error) {
        // Ignore errors for in-memory databases
      }
    }
    return totalSize;
  }

  private getTopSlowQueries(limit: number): SlowQuery[] {
    return Array.from(this.slowQueries.values())
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  private getQueryTypeDistribution(queries: QueryMetrics[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    queries.forEach(query => {
      distribution[query.operation] = (distribution[query.operation] || 0) + 1;
    });
    return distribution;
  }

  private getHourlyTrends(queries: QueryMetrics[]): Array<{ hour: number; queryCount: number; avgTime: number; errorCount: number }> {
    const trends = new Map<number, { queries: QueryMetrics[]; errors: number }>();
    
    queries.forEach(query => {
      const hour = new Date(query.timestamp).getHours();
      const existing = trends.get(hour) || { queries: [], errors: 0 };
      existing.queries.push(query);
      if (query.error) existing.errors++;
      trends.set(hour, existing);
    });

    return Array.from(trends.entries())
      .map(([hour, data]) => ({
        hour,
        queryCount: data.queries.length,
        avgTime: data.queries.reduce((sum: any, q: any) => sum + q.executionTime, 0) / data.queries.length,
        errorCount: data.errors,
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  private async getIndexEfficiency(): Promise<Array<{ table: string; indexName: string; usage: number; efficiency: number }>> {
    const efficiency: Array<{ table: string; indexName: string; usage: number; efficiency: number }> = [];
    
    for (const [dbName, db] of this.databases) {
      try {
        // Get all indexes
        const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all() as any[];
        
        for (const index of indexes) {
          // This is a simplified efficiency calculation
          // In a real system, you'd use EXPLAIN QUERY PLAN and actual usage statistics
          efficiency.push({
            table: index.tbl_name,
            indexName: index.name,
            usage: Math.random() * 100, // Placeholder - would be actual usage data
            efficiency: Math.random() * 100, // Placeholder - would be calculated efficiency
          });
        }
      } catch (error) {
        logger.warn('Failed to analyze index efficiency', 'DB_PERF', error as Error);
      }
    }

    return efficiency;
  }

  private checkPerformanceAlerts(aggregates: DatabaseAggregates): void {
    const alerts: string[] = [];

    // High error rate
    if (aggregates.errorRate > this.thresholds.maxErrorRate) {
      alerts.push(`High database error rate: ${aggregates.errorRate.toFixed(1)}%`);
    }

    // High average query time
    if (aggregates.avgQueryTime > this.thresholds.slowQueryMs) {
      alerts.push(`High average query time: ${aggregates.avgQueryTime.toFixed(0)}ms`);
    }

    // Large database size
    if (aggregates.databaseSize > this.thresholds.maxDatabaseSize) {
      alerts.push(`Large database size: ${(aggregates.databaseSize / 1024 / 1024).toFixed(0)}MB`);
    }

    // Many slow queries
    if (aggregates.slowQueryCount > aggregates.queryCount * 0.1) {
      alerts.push(`High slow query rate: ${aggregates.slowQueryCount} of ${aggregates.queryCount} queries`);
    }

    if (alerts.length > 0) {
      this.emit('performance-alerts', {
        alerts,
        aggregates,
        timestamp: Date.now(),
      });

      logger.warn('Database performance alerts triggered', 'DB_PERF', {
        alerts,
        errorRate: aggregates.errorRate,
        avgQueryTime: aggregates.avgQueryTime,
        slowQueryCount: aggregates.slowQueryCount,
      });
    }
  }

  // Analyze optimization opportunities
  private async analyzeOptimizations(): Promise<void> {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze slow queries for missing indexes
    const topSlowQueries = this.getTopSlowQueries(20);
    for (const slowQuery of topSlowQueries) {
      if (slowQuery.sql.toLowerCase().includes('where') && slowQuery.avgTime > 500) {
        suggestions.push({
          type: 'missing_index',
          severity: slowQuery.avgTime > 2000 ? 'high' : 'medium',
          table: this.extractTableName(slowQuery.sql),
          suggestion: `Consider adding an index for this frequently slow query`,
          impact: `Query appears ${slowQuery.count} times with average time ${slowQuery.avgTime.toFixed(0)}ms`,
          query: slowQuery.sql,
          estimatedImprovement: `Could reduce query time by 50-90%`,
        });
      }
    }

    // Check for unused indexes (simplified)
    for (const [dbName, db] of this.databases) {
      try {
        const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all() as any[];
        
        for (const index of indexes) {
          // Check if index is used in recent queries (simplified check)
          const isUsed = this.queryMetrics
            .slice(-1000) // Check last 1000 queries
            .some(q => q.sql.toLowerCase().includes(index.tbl_name.toLowerCase()));
            
          if (!isUsed) {
            suggestions.push({
              type: 'unused_index',
              severity: 'low',
              table: index.tbl_name,
              suggestion: `Index '${index.name}' appears to be unused and could be dropped`,
              impact: `Removing unused indexes improves INSERT/UPDATE performance`,
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to analyze unused indexes', 'DB_PERF', error as Error);
      }
    }

    if (suggestions.length > 0) {
      this.emit('optimization-suggestions', {
        suggestions,
        timestamp: Date.now(),
      });

      logger.info('Database optimization suggestions generated', 'DB_PERF', {
        suggestionCount: suggestions.length,
        highSeverity: suggestions?.filter(s => s.severity === 'high').length,
      });
    }
  }

  private extractTableName(sql: string): string {
    // Simplified table name extraction
    const match = sql.toLowerCase().match(/(?:from|update|into)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    return match && match[1] ? match[1] : 'unknown';
  }

  // Public API methods
  getCurrentMetrics(): DatabaseAggregates | null {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentQueries = this.queryMetrics.filter(q => q.timestamp > oneHourAgo);

    if (!recentQueries || recentQueries.length === 0) {
      return null;
    }

    const totalQueries = recentQueries.length;
    const totalTime = recentQueries.reduce((sum: any, q: any) => sum + q.executionTime, 0);
    const avgQueryTime = totalTime / totalQueries;
    const slowQueries = recentQueries.filter(q => q.executionTime >= this.thresholds.slowQueryMs);
    const errorQueries = recentQueries.filter(q => q.error);
    const errorRate = ((errorQueries?.length || 0) / totalQueries) * 100;

    return {
      timestamp: now,
      queryCount: totalQueries,
      avgQueryTime,
      slowQueryCount: slowQueries?.length || 0,
      errorRate,
      queriesPerSecond: totalQueries / 3600,
      connectionPoolUsage: this.getConnectionPoolUsage(),
      databaseSize: this.getTotalDatabaseSize(),
      topSlowQueries: this.getTopSlowQueries(10),
      queryTypeDistribution: this.getQueryTypeDistribution(recentQueries),
      hourlyTrends: this.getHourlyTrends(recentQueries),
      indexEfficiency: [], // Would be populated asynchronously
    };
  }

  getSlowQueries(limit: number = 20): SlowQuery[] {
    return this.getTopSlowQueries(limit);
  }

  updateThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Database performance thresholds updated', 'DB_PERF', thresholds);
  }

  // Clean up old data
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    
    // Remove old query metrics
    this.queryMetrics = this.queryMetrics.filter(q => q.timestamp > cutoff);
    
    // Remove old slow queries that haven't been seen recently
    for (const [sql, slowQuery] of this.slowQueries.entries()) {
      if (slowQuery.lastSeen < cutoff) {
        this.slowQueries.delete(sql);
      }
    }

    logger.debug('Database performance monitor cleanup completed', 'DB_PERF', {
      remaining_queries: this.queryMetrics.length,
      remaining_slow_queries: this.slowQueries.size,
    });
  }

  shutdown(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    this.initialized = false;
    logger.info('Database performance monitor shut down', 'DB_PERF');
  }
}

export const databasePerformanceMonitor = DatabasePerformanceMonitor.getInstance();
export { DatabasePerformanceMonitor };
