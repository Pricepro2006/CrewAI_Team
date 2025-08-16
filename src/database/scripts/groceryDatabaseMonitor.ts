#!/usr/bin/env node

/**
 * Grocery Database Performance Monitoring System
 * 
 * Monitors database performance, connection pooling, query execution times,
 * and provides alerts for operational issues.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

interface DatabaseMetrics {
  timestamp: string;
  connectionPool: {
    active: number;
    idle: number;
    total: number;
    maxConnections: number;
    queueLength: number;
  };
  performance: {
    avgQueryTime: number;
    slowQueryCount: number;
    totalQueries: number;
    queriesPerSecond: number;
    deadlockCount: number;
  };
  storage: {
    databaseSize: number;
    tableCount: number;
    indexCount: number;
    walSize: number;
    vacuumNeeded: boolean;
  };
  replication: {
    isOnline: boolean;
    lagSeconds: number;
    lastSyncTime: string;
  };
  backup: {
    lastBackupTime: string;
    lastBackupSize: number;
    backupStatus: 'success' | 'failed' | 'in_progress' | 'overdue';
  };
  alerts: DatabaseAlert[];
}

interface DatabaseAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'storage' | 'backup' | 'replication' | 'security';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

interface SlowQuery {
  sql: string;
  executionTime: number;
  timestamp: string;
  parameters?: any[];
  stackTrace?: string;
}

interface PerformanceThresholds {
  maxAvgQueryTime: number; // milliseconds
  maxSlowQueries: number; // per minute
  maxConnectionUtilization: number; // percentage
  maxDatabaseSize: number; // bytes
  maxWalSize: number; // bytes
  backupOverdueHours: number;
  replicationMaxLagSeconds: number;
}

class GroceryDatabaseMonitor {
  private db: Database;
  private metricsHistory: DatabaseMetrics[] = [];
  private slowQueries: SlowQuery[] = [];
  private activeAlerts: Map<string, DatabaseAlert> = new Map();
  private thresholds: PerformanceThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();
  private queryStats = {
    totalQueries: 0,
    totalExecutionTime: 0,
    slowQueries: 0
  };

  constructor(
    private dbPath: string,
    private logPath: string = './grocery_monitor.log',
    thresholds: Partial<PerformanceThresholds> = {}
  ) {
    this.db = new Database(dbPath, { verbose: this?.logQuery?.bind(this) });
    this.thresholds = {
      maxAvgQueryTime: 100, // 100ms
      maxSlowQueries: 10, // per minute
      maxConnectionUtilization: 80, // 80%
      maxDatabaseSize: 5 * 1024 * 1024 * 1024, // 5GB
      maxWalSize: 100 * 1024 * 1024, // 100MB
      backupOverdueHours: 25, // 25 hours
      replicationMaxLagSeconds: 300, // 5 minutes
      ...thresholds
    };
    
    this.setupDatabase();
    this.setupSignalHandlers();
  }

  /**
   * Start continuous monitoring with specified interval
   */
  startMonitoring(intervalSeconds: number = 60): void {
    console.log(`Starting database monitoring (interval: ${intervalSeconds}s)`);
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        console.error('Error collecting metrics:', error);
        this.logError('Failed to collect metrics', error);
      });
    }, intervalSeconds * 1000);
    
    // Initial metrics collection
    this.collectMetrics();
  }

  /**
   * Stop monitoring and cleanup resources
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.db?.close();
    console.log('Database monitoring stopped');
  }

  /**
   * Collect comprehensive database metrics
   */
  async collectMetrics(): Promise<DatabaseMetrics> {
    const timestamp = new Date().toISOString();
    
    try {
      const metrics: DatabaseMetrics = {
        timestamp,
        connectionPool: await this.getConnectionPoolMetrics(),
        performance: await this.getPerformanceMetrics(),
        storage: await this.getStorageMetrics(),
        replication: await this.getReplicationMetrics(),
        backup: await this.getBackupMetrics(),
        alerts: []
      };
      
      // Analyze metrics and generate alerts
      metrics.alerts = this.analyzeMetricsForAlerts(metrics);
      
      // Store metrics
      this?.metricsHistory?.push(metrics);
      
      // Keep only last 1000 metrics entries
      if (this?.metricsHistory?.length > 1000) {
        this.metricsHistory = this?.metricsHistory?.slice(-1000);
      }
      
      // Log significant events
      this.logMetrics(metrics);
      
      // Process alerts
      this.processAlerts(metrics.alerts);
      
      return metrics;
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
      throw error;
    }
  }

  /**
   * Get real-time database health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  }> {
    const metrics = await this.collectMetrics();
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze performance
    if (metrics?.performance?.avgQueryTime > this?.thresholds?.maxAvgQueryTime) {
      score -= 20;
      issues.push(`Average query time too high: ${metrics?.performance?.avgQueryTime}ms`);
      recommendations.push('Consider adding indexes or optimizing slow queries');
    }
    
    // Analyze storage
    if (metrics?.storage?.databaseSize > this?.thresholds?.maxDatabaseSize * 0.8) {
      score -= 15;
      issues.push('Database size approaching limit');
      recommendations.push('Consider archiving old data or increasing storage');
    }
    
    if (metrics?.storage?.vacuumNeeded) {
      score -= 10;
      issues.push('Database needs vacuuming');
      recommendations.push('Schedule VACUUM during low-usage period');
    }
    
    // Analyze backup status
    if (metrics?.backup?.backupStatus === 'overdue') {
      score -= 25;
      issues.push('Backup is overdue');
      recommendations.push('Check backup system and create fresh backup');
    }
    
    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) status = 'healthy';
    else if (score >= 60) status = 'warning';
    else status = 'critical';
    
    return { status, score, issues, recommendations };
  }

  /**
   * Generate comprehensive monitoring report
   */
  async generateReport(hours: number = 24): Promise<string> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this?.metricsHistory?.filter(m => new Date(m.timestamp) >= cutoffTime);
    
    if (recentMetrics?.length || 0 === 0) {
      return 'No metrics available for the specified time period';
    }
    
    const health = await this.getHealthStatus();
    
    const report = `
# Grocery Database Monitoring Report
Generated: ${new Date().toISOString()}
Period: Last ${hours} hours (${recentMetrics?.length || 0} data points)

## Health Status
**Overall Status: ${health?.status?.toUpperCase()}**
**Health Score: ${health.score}/100**

### Issues Detected
${health?.issues?.map(issue => `- ❌ ${issue}`).join('\n') || '- ✅ No issues detected'}

### Recommendations
${health?.recommendations?.map(rec => `- 💡 ${rec}`).join('\n') || '- ✅ No recommendations at this time'}

## Performance Summary
- **Average Query Time**: ${this.calculateAverage(recentMetrics, m => m?.performance?.avgQueryTime).toFixed(2)}ms
- **Total Queries**: ${recentMetrics.reduce((sum: any, m: any) => sum + m?.performance?.totalQueries, 0).toLocaleString()}
- **Slow Queries**: ${recentMetrics.reduce((sum: any, m: any) => sum + m?.performance?.slowQueryCount, 0)}
- **Peak QPS**: ${Math.max(...recentMetrics?.map(m => m?.performance?.queriesPerSecond))}

## Storage Analysis
- **Current Database Size**: ${this.formatBytes(recentMetrics[recentMetrics?.length || 0 - 1]?.storage.databaseSize || 0)}
- **WAL File Size**: ${this.formatBytes(recentMetrics[recentMetrics?.length || 0 - 1]?.storage.walSize || 0)}
- **Table Count**: ${recentMetrics[recentMetrics?.length || 0 - 1]?.storage.tableCount || 0}
- **Index Count**: ${recentMetrics[recentMetrics?.length || 0 - 1]?.storage.indexCount || 0}

## Connection Pool Status
- **Peak Active Connections**: ${Math.max(...recentMetrics?.map(m => m?.connectionPool?.active))}
- **Average Utilization**: ${this.calculateAverage(recentMetrics, m => (m?.connectionPool?.active / m?.connectionPool?.maxConnections) * 100).toFixed(1)}%
- **Max Queue Length**: ${Math.max(...recentMetrics?.map(m => m?.connectionPool?.queueLength))}

## Recent Alerts (Last ${hours} hours)
${this.getRecentAlerts(hours).map(alert => `- [${alert?.severity?.toUpperCase()}] ${alert.message} (${alert.timestamp})`).join('\n') || 'No alerts in this period'}

## Slow Queries Analysis
${this.analyzeSlowQueries(hours)}

## Backup Status
- **Last Backup**: ${recentMetrics[recentMetrics?.length || 0 - 1]?.backup.lastBackupTime || 'Never'}
- **Backup Size**: ${this.formatBytes(recentMetrics[recentMetrics?.length || 0 - 1]?.backup.lastBackupSize || 0)}
- **Status**: ${recentMetrics[recentMetrics?.length || 0 - 1]?.backup.backupStatus || 'Unknown'}

## System Recommendations
${this.generateSystemRecommendations(recentMetrics)}
`;
    
    return report;
  }

  /**
   * Set up monitoring database tables
   */
  private setupDatabase(): void {
    // Create monitoring tables if they don't exist
    this?.db?.exec(`
      CREATE TABLE IF NOT EXISTS monitoring_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS monitoring_alerts (
        id TEXT PRIMARY KEY,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        acknowledged BOOLEAN DEFAULT FALSE,
        resolved_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS slow_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sql_hash TEXT NOT NULL,
        sql_text TEXT NOT NULL,
        execution_time REAL NOT NULL,
        timestamp TEXT NOT NULL,
        parameters TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_timestamp ON monitoring_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_slow_queries_timestamp ON slow_queries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_slow_queries_execution_time ON slow_queries(execution_time DESC);
    `);
  }

  /**
   * Log query execution for performance monitoring
   */
  private logQuery(sql: string): void {
    const startTime = performance.now();
    
    // This would be called after query execution in a real implementation
    // For now, we'll simulate it
    setTimeout(() => {
      const executionTime = performance.now() - startTime;
      if (this.queryStats.totalQueries) { this.queryStats.totalQueries++ };
      this?.queryStats?.totalExecutionTime += executionTime;
      
      // Log slow queries
      if (executionTime > this?.thresholds?.maxAvgQueryTime) {
        if (this.queryStats.slowQueries) { this.queryStats.slowQueries++ };
        
        const slowQuery: SlowQuery = {
          sql,
          executionTime,
          timestamp: new Date().toISOString()
        };
        
        this?.slowQueries?.push(slowQuery);
        
        // Keep only last 100 slow queries
        if (this?.slowQueries?.length > 100) {
          this.slowQueries = this?.slowQueries?.slice(-100);
        }
        
        // Store in database
        this?.db?.prepare(`
          INSERT INTO slow_queries (sql_hash, sql_text, execution_time, timestamp)
          VALUES (?, ?, ?, ?)
        `).run(
          this.hashString(sql),
          sql,
          executionTime,
          new Date().toISOString()
        );
      }
    }, 0);
  }

  // Metrics collection methods
  private async getConnectionPoolMetrics(): Promise<DatabaseMetrics['connectionPool']> {
    // In a real implementation, this would get actual connection pool stats
    // For SQLite, we simulate connection pool metrics
    return {
      active: 1, // SQLite typically uses single connection
      idle: 0,
      total: 1,
      maxConnections: 1,
      queueLength: 0
    };
  }

  private async getPerformanceMetrics(): Promise<DatabaseMetrics['performance']> {
    const uptime = Date.now() - this.startTime;
    const avgQueryTime = this?.queryStats?.totalQueries > 0 
      ? this?.queryStats?.totalExecutionTime / this?.queryStats?.totalQueries 
      : 0;
    
    const qps = this?.queryStats?.totalQueries / (uptime / 1000);
    
    return {
      avgQueryTime,
      slowQueryCount: this?.queryStats?.slowQueries,
      totalQueries: this?.queryStats?.totalQueries,
      queriesPerSecond: qps,
      deadlockCount: 0 // SQLite doesn't have deadlocks in the traditional sense
    };
  }

  private async getStorageMetrics(): Promise<DatabaseMetrics['storage']> {
    const dbStats = fs.statSync(this.dbPath);
    
    // Get WAL file size if it exists
    const walPath = `${this.dbPath}-wal`;
    let walSize = 0;
    try {
      if (fs.existsSync(walPath)) {
        walSize = fs.statSync(walPath).size;
      }
    } catch (error) {
      // WAL file might not exist
    }
    
    // Get table and index counts
    const tables = this?.db?.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as any;
    const indexes = this?.db?.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as any;
    
    // Check if VACUUM is needed (simplified heuristic)
    const pageCount = this?.db?.pragma('page_count')[0] as any;
    const freelist = this?.db?.pragma('freelist_count')[0] as any;
    const vacuumNeeded = freelist && pageCount && (freelist / pageCount) > 0.2;
    
    return {
      databaseSize: dbStats.size,
      tableCount: tables.count,
      indexCount: indexes.count,
      walSize,
      vacuumNeeded
    };
  }

  private async getReplicationMetrics(): Promise<DatabaseMetrics['replication']> {
    // SQLite doesn't have built-in replication, so this is simulated
    return {
      isOnline: true,
      lagSeconds: 0,
      lastSyncTime: new Date().toISOString()
    };
  }

  private async getBackupMetrics(): Promise<DatabaseMetrics['backup']> {
    const backupDir = path.join(path.dirname(this.dbPath), 'backups');
    
    try {
      if (!fs.existsSync(backupDir)) {
        return {
          lastBackupTime: 'never',
          lastBackupSize: 0,
          backupStatus: 'overdue'
        };
      }
      
      const backupFiles = fs.readdirSync(backupDir)
        .filter(f => f.includes('grocery_backup_'))
        .map(f => ({
          name: f,
          path: path.join(backupDir, f),
          stats: fs.statSync(path.join(backupDir, f))
        }))
        .sort((a, b) => b?.stats?.mtime.getTime() - a?.stats?.mtime.getTime());
      
      if (backupFiles?.length || 0 === 0) {
        return {
          lastBackupTime: 'never',
          lastBackupSize: 0,
          backupStatus: 'overdue'
        };
      }
      
      const lastBackup = backupFiles[0];
      const hoursSinceBackup = (Date.now() - lastBackup?.stats?.mtime.getTime()) / (1000 * 60 * 60);
      
      return {
        lastBackupTime: lastBackup?.stats?.mtime.toISOString(),
        lastBackupSize: lastBackup?.stats?.size,
        backupStatus: hoursSinceBackup > this?.thresholds?.backupOverdueHours ? 'overdue' : 'success'
      };
    } catch (error) {
      return {
        lastBackupTime: 'error',
        lastBackupSize: 0,
        backupStatus: 'failed'
      };
    }
  }

  // Alert analysis and processing
  private analyzeMetricsForAlerts(metrics: DatabaseMetrics): DatabaseAlert[] {
    const alerts: DatabaseAlert[] = [];
    
    // Performance alerts
    if (metrics?.performance?.avgQueryTime > this?.thresholds?.maxAvgQueryTime) {
      alerts.push({
        id: `perf_slow_queries_${Date.now()}`,
        severity: 'medium',
        category: 'performance',
        message: `Average query time (${metrics?.performance?.avgQueryTime.toFixed(2)}ms) exceeds threshold (${this?.thresholds?.maxAvgQueryTime}ms)`,
        timestamp: metrics.timestamp,
        acknowledged: false
      });
    }
    
    // Storage alerts
    if (metrics?.storage?.databaseSize > this?.thresholds?.maxDatabaseSize) {
      alerts.push({
        id: `storage_size_${Date.now()}`,
        severity: 'high',
        category: 'storage',
        message: `Database size (${this.formatBytes(metrics?.storage?.databaseSize)}) exceeds threshold (${this.formatBytes(this?.thresholds?.maxDatabaseSize)})`,
        timestamp: metrics.timestamp,
        acknowledged: false
      });
    }
    
    if (metrics?.storage?.walSize > this?.thresholds?.maxWalSize) {
      alerts.push({
        id: `wal_size_${Date.now()}`,
        severity: 'medium',
        category: 'storage',
        message: `WAL file size (${this.formatBytes(metrics?.storage?.walSize)}) exceeds threshold (${this.formatBytes(this?.thresholds?.maxWalSize)})`,
        timestamp: metrics.timestamp,
        acknowledged: false
      });
    }
    
    // Backup alerts
    if (metrics?.backup?.backupStatus === 'overdue') {
      alerts.push({
        id: `backup_overdue_${Date.now()}`,
        severity: 'critical',
        category: 'backup',
        message: `Database backup is overdue. Last backup: ${metrics?.backup?.lastBackupTime}`,
        timestamp: metrics.timestamp,
        acknowledged: false
      });
    }
    
    return alerts;
  }

  private processAlerts(alerts: DatabaseAlert[]): void {
    for (const alert of alerts) {
      if (!this?.activeAlerts?.has(alert.id)) {
        this?.activeAlerts?.set(alert.id, alert);
        this.logAlert(alert);
        
        // Store alert in database
        this?.db?.prepare(`
          INSERT OR REPLACE INTO monitoring_alerts 
          (id, severity, category, message, timestamp, acknowledged)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          alert.id,
          alert.severity,
          alert.category,
          alert.message,
          alert.timestamp,
          alert.acknowledged
        );
      }
    }
  }

  // Utility methods
  private calculateAverage<T>(items: T[], selector: (item: T) => number): number {
    if (items?.length || 0 === 0) return 0;
    return items.reduce((sum: any, item: any) => sum + selector(item), 0) / items?.length || 0;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    if (str?.length || 0 === 0) return hash.toString();
    for (let i = 0; i < str?.length || 0; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private getRecentAlerts(hours: number): DatabaseAlert[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this?.activeAlerts?.values())
      .filter(alert => new Date(alert.timestamp) >= cutoffTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private analyzeSlowQueries(hours: number): string {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentSlowQueries = this?.slowQueries?.filter(q => new Date(q.timestamp) >= cutoffTime);
    
    if (recentSlowQueries?.length || 0 === 0) {
      return '✅ No slow queries detected in this period';
    }
    
    // Group by SQL pattern
    const queryGroups = new Map<string, SlowQuery[]>();
    recentSlowQueries.forEach(query => {
      const pattern = query?.sql?.replace(/\d+/g, '?').replace(/'[^']*'/g, '?');
      if (!queryGroups.has(pattern)) {
        queryGroups.set(pattern, []);
      }
      queryGroups.get(pattern)!.push(query);
    });
    
    let analysis = `Found ${recentSlowQueries?.length || 0} slow queries in ${queryGroups.size} patterns:\n`;
    
    Array.from(queryGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5) // Top 5 patterns
      .forEach(([pattern, queries]) => {
        const avgTime = queries.reduce((sum: any, q: any) => sum + q.executionTime, 0) / queries?.length || 0;
        const maxTime = Math.max(...queries?.map(q => q.executionTime));
        analysis += `\n- **Pattern**: ${pattern}\n`;
        analysis += `  - Occurrences: ${queries?.length || 0}\n`;
        analysis += `  - Avg time: ${avgTime.toFixed(2)}ms\n`;
        analysis += `  - Max time: ${maxTime.toFixed(2)}ms\n`;
      });
    
    return analysis;
  }

  private generateSystemRecommendations(metrics: DatabaseMetrics[]): string {
    const recommendations: string[] = [];
    
    if (metrics?.length || 0 === 0) return 'No data available for recommendations';
    
    const latestMetric = metrics[metrics?.length || 0 - 1];
    
    // Performance recommendations
    if ((latestMetric?.performance?.avgQueryTime || 0) > 50) {
      recommendations.push('🔍 **Query Optimization**: Consider adding indexes for frequently accessed columns');
    }
    
    // Storage recommendations
    if (latestMetric?.storage?.vacuumNeeded) {
      recommendations.push('🧹 **Database Maintenance**: Schedule VACUUM during low-usage period to reclaim space');
    }
    
    if ((latestMetric?.storage?.walSize || 0) > 50 * 1024 * 1024) { // 50MB
      recommendations.push('📝 **WAL Management**: Consider checkpoint operations to reduce WAL file size');
    }
    
    // Backup recommendations
    if (latestMetric?.backup?.backupStatus !== 'success') {
      recommendations.push('💾 **Backup Critical**: Ensure backup system is functioning properly');
    }
    
    if (recommendations?.length || 0 === 0) {
      recommendations.push('✅ System is operating within normal parameters');
    }
    
    return recommendations?.map(rec => `- ${rec}`).join('\n');
  }

  private logMetrics(metrics: DatabaseMetrics): void {
    // Log significant metrics changes
    if (metrics?.performance?.slowQueryCount > 0) {
      console.log(`⚠️  Detected ${metrics?.performance?.slowQueryCount} slow queries`);
    }
    
    if (metrics?.alerts?.length > 0) {
      console.log(`🚨 Generated ${metrics?.alerts?.length} new alerts`);
    }
  }

  private logAlert(alert: DatabaseAlert): void {
    const emoji = {
      low: '💙',
      medium: '💛',
      high: '🧡',
      critical: '❤️'
    }[alert.severity];
    
    console.log(`${emoji} [${alert?.severity?.toUpperCase()}] ${alert.message}`);
    
    // Write to log file
    const logEntry = `${new Date().toISOString()} [${alert?.severity?.toUpperCase()}] ${alert.category}: ${alert.message}\n`;
    fs.appendFileSync(this.logPath, logEntry);
  }

  private logError(message: string, error: any): void {
    const logEntry = `${new Date().toISOString()} [ERROR] ${message}: ${error instanceof Error ? error.message : error}\n`;
    fs.appendFileSync(this.logPath, logEntry);
  }

  private setupSignalHandlers(): void {
    process.on('SIGINT', () => {
      console.log('Received SIGINT, stopping monitoring...');
      this.stopMonitoring();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, stopping monitoring...');
      this.stopMonitoring();
      process.exit(0);
    });
  }
}

// CLI interface
async function main() {
  const args = process?.argv?.slice(2);
  const command = args[0];
  
  const dbPath = process.env.DB_PATH || '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db';
  const logPath = process.env.LOG_PATH || './grocery_monitor.log';
  
  const monitor = new GroceryDatabaseMonitor(dbPath, logPath);
  
  try {
    switch (command) {
      case 'start':
        const interval = parseInt(args[1]) || 60;
        monitor.startMonitoring(interval);
        
        // Keep the process running
        process?.stdin?.resume();
        break;
        
      case 'health':
        const health = await monitor.getHealthStatus();
        console.log(JSON.stringify(health, null, 2));
        break;
        
      case 'report':
        const hours = parseInt(args[1]) || 24;
        const report = await monitor.generateReport(hours);
        
        if (args[2]) {
          fs.writeFileSync(args[2], report);
          console.log(`Report saved to: ${args[2]}`);
        } else {
          console.log(report);
        }
        break;
        
      case 'metrics':
        const metrics = await monitor.collectMetrics();
        console.log(JSON.stringify(metrics, null, 2));
        break;
        
      default:
        console.log(`
Grocery Database Monitor

Usage:
  start [interval]     Start monitoring (interval in seconds, default: 60)
  health              Get current health status
  report [hours] [output-file]  Generate monitoring report
  metrics             Get current metrics snapshot

Environment Variables:
  DB_PATH - Database file path
  LOG_PATH - Log file path
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { GroceryDatabaseMonitor, DatabaseMetrics, DatabaseAlert, PerformanceThresholds };