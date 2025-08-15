/**
 * Comprehensive Local Development Monitoring Service
 * For the Walmart Grocery Agent LOCAL development project
 * 
 * Features:
 * - WebSocket connection monitoring
 * - API performance tracking
 * - Database query monitoring
 * - Real-time metrics collection
 * - Development-friendly alerting
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { Database } from 'better-sqlite3';
import { logger } from '../utils/logger.js';

// =====================================================
// Core Types
// =====================================================

export interface MonitoringMetric {
  id: string;
  name: string;
  value: number;
  timestamp: string;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  unit?: string;
}

export interface ConnectionInfo {
  id: string;
  type: 'websocket' | 'http' | 'database';
  status: 'connected' | 'disconnected' | 'error';
  connectedAt: string;
  lastActivity: string;
  metadata: Record<string, any>;
}

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: string;
  error?: string;
}

export interface DatabaseQuery {
  id: string;
  sql: string;
  database: string;
  executionTime: number;
  timestamp: string;
  error?: string;
  rowsAffected?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  services: Record<string, ServiceHealth>;
  metrics: {
    cpu: number;
    memory: number;
    connections: number;
    errors: number;
  };
  timestamp: string;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  responseTime?: number;
  error?: string;
  lastCheck: string;
}

export interface MonitoringAlert {
  id: string;
  type: 'performance' | 'error' | 'connection' | 'health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  metadata: Record<string, any>;
}

// =====================================================
// Main Monitoring Service
// =====================================================

export class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  
  // Storage
  private metrics: Map<string, MonitoringMetric[]> = new Map();
  private connections: Map<string, ConnectionInfo> = new Map();
  private performanceLog: PerformanceMetric[] = [];
  private queryLog: DatabaseQuery[] = [];
  private alerts: MonitoringAlert[] = [];
  
  // Configuration
  private config = {
    maxMetricsHistory: 1000,
    maxPerformanceHistory: 500,
    maxQueryHistory: 200,
    alertThresholds: {
      responseTime: 1000, // 1 second
      queryTime: 100, // 100ms
      errorRate: 0.05, // 5%
      memoryUsage: 500 * 1024 * 1024, // 500MB
    }
  };
  
  // Health check functions
  private healthChecks: Map<string, () => Promise<ServiceHealth>> = new Map();
  
  private constructor() {
    super();
    this.initializeDefaultHealthChecks();
    this.startPeriodicTasks();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // =====================================================
  // Metric Collection
  // =====================================================

  recordMetric(name: string, value: number, tags: Record<string, string> = {}, type: MonitoringMetric['type'] = 'gauge', unit?: string): void {
    const metric: MonitoringMetric = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      value,
      timestamp: new Date().toISOString(),
      tags,
      type,
      unit
    };

    if (!this?.metrics?.has(name)) {
      this?.metrics?.set(name, []);
    }

    const metricHistory = this?.metrics?.get(name)!;
    metricHistory.push(metric);

    // Keep only recent metrics
    if (metricHistory?.length || 0 > this?.config?.maxMetricsHistory) {
      metricHistory.shift();
    }

    this.emit('metric', metric);
    this.checkAlertThresholds(metric);
  }

  increment(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    this.recordMetric(name, value, tags, 'counter');
  }

  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric(name, value, tags, 'gauge');
  }

  timer<T>(name: string, operation: () => T | Promise<T>, tags: Record<string, string> = {}): Promise<T> {
    const startTime = Date.now();
    
    const recordTime = (error?: Error) => {
      const duration = Date.now() - startTime;
      this.recordMetric(name, duration, { ...tags, error: error ? 'true' : 'false' }, 'timer', 'ms');
    };

    try {
      const result = operation();
      
      if (result instanceof Promise) {
        return result
          .then(res => {
            recordTime();
            return res;
          })
          .catch(err => {
            recordTime(err);
            throw err;
          });
      } else {
        recordTime();
        return Promise.resolve(result);
      }
    } catch (error) {
      recordTime(error as Error);
      throw error;
    }
  }

  // =====================================================
  // Connection Monitoring
  // =====================================================

  trackConnection(id: string, type: ConnectionInfo['type'], metadata: Record<string, any> = {}): void {
    const connection: ConnectionInfo = {
      id,
      type,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      metadata
    };

    this?.connections?.set(id, connection);
    this.emit('connection_change', connection);
    
    // Update metrics
    this.increment('connections.total', 1, { type });
    this.gauge('connections.active', this.getActiveConnections().length);
  }

  updateConnectionActivity(id: string, metadata?: Record<string, any>): void {
    const connection = this?.connections?.get(id);
    if (connection) {
      connection.lastActivity = new Date().toISOString();
      if (metadata) {
        connection.metadata = { ...connection.metadata, ...metadata };
      }
      this.emit('connection_activity', connection);
    }
  }

  disconnectConnection(id: string, error?: string): void {
    const connection = this?.connections?.get(id);
    if (connection) {
      connection.status = error ? 'error' : 'disconnected';
      if (error) {
        connection?.metadata?.error = error;
      }
      
      this.emit('connection_change', connection);
      
      // Update metrics
      this.increment('connections.disconnected', 1, { type: connection.type });
      this.gauge('connections.active', this.getActiveConnections().length);
    }
  }

  getActiveConnections(): ConnectionInfo[] {
    return Array.from(this?.connections?.values()).filter(conn => conn.status === 'connected');
  }

  getConnectionsByType(type: ConnectionInfo['type']): ConnectionInfo[] {
    return Array.from(this?.connections?.values()).filter(conn => conn.type === type);
  }

  // =====================================================
  // Performance Monitoring
  // =====================================================

  recordAPIPerformance(endpoint: string, method: string, responseTime: number, statusCode: number, error?: string): void {
    const performance: PerformanceMetric = {
      endpoint,
      method,
      responseTime,
      statusCode,
      timestamp: new Date().toISOString(),
      error
    };

    this?.performanceLog?.push(performance);
    
    // Keep only recent performance data
    if (this?.performanceLog?.length > this?.config?.maxPerformanceHistory) {
      this?.performanceLog?.shift();
    }

    // Record metrics
    this.recordMetric('api.response_time', responseTime, { endpoint, method }, 'timer', 'ms');
    this.increment('api.requests', 1, { endpoint, method, status: statusCode.toString() });
    
    if (error) {
      this.increment('api.errors', 1, { endpoint, method });
    }

    this.emit('performance', performance);
    
    // Check for slow responses
    if (responseTime > this?.config?.alertThresholds.responseTime) {
      this.createAlert('performance', 'medium', 
        `Slow API response: ${endpoint} took ${responseTime}ms`, 
        { endpoint, method, responseTime });
    }
  }

  // =====================================================
  // Database Monitoring
  // =====================================================

  recordDatabaseQuery(sql: string, database: string, executionTime: number, rowsAffected?: number, error?: string): void {
    const query: DatabaseQuery = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sql: sql?.length || 0 > 200 ? sql.substring(0, 200) + '...' : sql,
      database,
      executionTime,
      timestamp: new Date().toISOString(),
      error,
      rowsAffected
    };

    this?.queryLog?.push(query);
    
    // Keep only recent query data
    if (this?.queryLog?.length > this?.config?.maxQueryHistory) {
      this?.queryLog?.shift();
    }

    // Record metrics
    this.recordMetric('db.query_time', executionTime, { database }, 'timer', 'ms');
    this.increment('db.queries', 1, { database, error: error ? 'true' : 'false' });
    
    if (rowsAffected !== undefined) {
      this.recordMetric('db.rows_affected', rowsAffected, { database }, 'gauge');
    }

    this.emit('database_query', query);
    
    // Check for slow queries
    if (executionTime > this?.config?.alertThresholds.queryTime) {
      this.createAlert('performance', 'low', 
        `Slow database query: ${executionTime}ms in ${database}`, 
        { database, executionTime, sql: query.sql });
    }
  }

  getSlowQueries(threshold: number = 100): DatabaseQuery[] {
    return this?.queryLog?.filter(q => q.executionTime > threshold);
  }

  getQueryStats(database?: string): {
    totalQueries: number;
    averageTime: number;
    slowQueries: number;
    errorCount: number;
  } {
    const queries = database ? 
      this?.queryLog?.filter(q => q.database === database) : 
      this.queryLog;

    const totalQueries = queries?.length || 0;
    const averageTime = totalQueries > 0 ? 
      queries.reduce((sum: any, q: any) => sum + q.executionTime, 0) / totalQueries : 0;
    const slowQueries = queries?.filter(q => q.executionTime > this?.config?.alertThresholds.queryTime).length;
    const errorCount = queries?.filter(q => q.error).length;

    return {
      totalQueries,
      averageTime,
      slowQueries,
      errorCount
    };
  }

  // =====================================================
  // Health Monitoring
  // =====================================================

  registerHealthCheck(name: string, check: () => Promise<ServiceHealth>): void {
    this?.healthChecks?.set(name, check);
  }

  async runHealthChecks(): Promise<SystemHealth> {
    const services: Record<string, ServiceHealth> = {};
    
    // Run all health checks
    for (const [name, check] of this.healthChecks) {
      try {
        services[name] = await check();
      } catch (error) {
        services[name] = {
          name,
          status: 'critical',
          error: error instanceof Error ? error.message : String(error),
          lastCheck: new Date().toISOString()
        };
      }
    }

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const activeConnections = this.getActiveConnections().length;
    const recentErrors = this?.alerts?.filter(a => 
      a.type === 'error' && 
      new Date(a.timestamp) > new Date(Date.now() - 300000) // Last 5 minutes
    ).length;

    // Determine overall status
    const serviceStatuses = Object.values(services).map(s => s.status);
    let overallStatus: SystemHealth['status'] = 'healthy';
    
    if (serviceStatuses.includes('critical')) {
      overallStatus = 'critical';
    } else if (serviceStatuses.includes('degraded') || memoryUsage.heapUsed > this?.config?.alertThresholds.memoryUsage) {
      overallStatus = 'degraded';
    }

    const health: SystemHealth = {
      status: overallStatus,
      services,
      metrics: {
        cpu: process.cpuUsage().system / 1000000, // Convert to percentage-like number
        memory: memoryUsage.heapUsed,
        connections: activeConnections,
        errors: recentErrors
      },
      timestamp: new Date().toISOString()
    };

    this.emit('health_check', health);
    return health;
  }

  // =====================================================
  // Alert Management
  // =====================================================

  createAlert(type: MonitoringAlert['type'], severity: MonitoringAlert['severity'], message: string, metadata: Record<string, any> = {}): void {
    const alert: MonitoringAlert = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      metadata
    };

    this?.alerts?.push(alert);
    this.emit('alert', alert);

    // Log alert
    const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    logger[logLevel](`[MONITORING ALERT] ${message}`, 'MONITORING', metadata);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this?.alerts?.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert_acknowledged', alert);
      return true;
    }
    return false;
  }

  getActiveAlerts(): MonitoringAlert[] {
    return this?.alerts?.filter(a => !a.acknowledged);
  }

  // =====================================================
  // Data Retrieval
  // =====================================================

  getMetrics(name?: string, limit: number = 100): MonitoringMetric[] {
    if (name) {
      return this?.metrics?.get(name)?.slice(-limit) || [];
    }
    
    const allMetrics: MonitoringMetric[] = [];
    for (const metrics of this?.metrics?.values()) {
      allMetrics.push(...metrics);
    }
    
    return allMetrics
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  getPerformanceMetrics(limit: number = 100): PerformanceMetric[] {
    return this?.performanceLog?.slice(-limit);
  }

  getDatabaseQueries(limit: number = 100): DatabaseQuery[] {
    return this?.queryLog?.slice(-limit);
  }

  getDashboardData(): {
    connections: ConnectionInfo[];
    recentMetrics: MonitoringMetric[];
    recentPerformance: PerformanceMetric[];
    recentQueries: DatabaseQuery[];
    alerts: MonitoringAlert[];
    systemStats: {
      totalConnections: number;
      activeConnections: number;
      totalMetrics: number;
      recentErrors: number;
    };
  } {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;

    return {
      connections: Array.from(this?.connections?.values()),
      recentMetrics: this.getMetrics(undefined, 50),
      recentPerformance: this?.performanceLog?.filter(p => 
        new Date(p.timestamp).getTime() > fiveMinutesAgo
      ),
      recentQueries: this?.queryLog?.filter(q => 
        new Date(q.timestamp).getTime() > fiveMinutesAgo
      ),
      alerts: this.getActiveAlerts(),
      systemStats: {
        totalConnections: this?.connections?.size,
        activeConnections: this.getActiveConnections().length,
        totalMetrics: Array.from(this?.metrics?.values()).reduce((sum: any, metrics: any) => sum + metrics?.length || 0, 0),
        recentErrors: this?.alerts?.filter(a => 
          a.type === 'error' && 
          new Date(a.timestamp).getTime() > fiveMinutesAgo
        ).length
      }
    };
  }

  // =====================================================
  // Private Methods
  // =====================================================

  private checkAlertThresholds(metric: MonitoringMetric): void {
    // Check for high memory usage
    if (metric.name === 'system.memory' && metric.value > this?.config?.alertThresholds.memoryUsage) {
      this.createAlert('health', 'high', 
        `High memory usage: ${Math.round(metric.value / 1024 / 1024)}MB`, 
        { memory: metric.value });
    }
    
    // Check error rates
    if (metric?.name?.includes('error') && metric.type === 'counter') {
      // Simple error rate check - could be made more sophisticated
      const recentErrors = this.getMetrics(metric.name, 10);
      const errorCount = recentErrors.reduce((sum: any, m: any) => sum + m.value, 0);
      
      if (errorCount > 10) { // More than 10 errors in recent history
        this.createAlert('error', 'medium', 
          `High error rate detected: ${errorCount} recent errors`, 
          { metric: metric.name, errorCount });
      }
    }
  }

  private initializeDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      try {
        // Simple check - could be expanded to test actual database connections
        const startTime = Date.now();
        
        // Simulate a simple database operation
        await new Promise(resolve => setTimeout(resolve, 10));
        
        return {
          name: 'database',
          status: 'healthy',
          responseTime: Date.now() - startTime,
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'critical',
          error: error instanceof Error ? error.message : String(error),
          lastCheck: new Date().toISOString()
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memoryUsage = process.memoryUsage();
      const threshold = this?.config?.alertThresholds.memoryUsage;
      
      let status: ServiceHealth['status'] = 'healthy';
      if (memoryUsage.heapUsed > threshold) {
        status = 'degraded';
      }
      if (memoryUsage.heapUsed > threshold * 1.5) {
        status = 'critical';
      }

      return {
        name: 'memory',
        status,
        lastCheck: new Date().toISOString(),
        responseTime: memoryUsage.heapUsed
      };
    });

    // WebSocket health check
    this.registerHealthCheck('websocket', async () => {
      const wsConnections = this.getConnectionsByType('websocket');
      const activeWS = wsConnections?.filter(c => c.status === 'connected');
      
      return {
        name: 'websocket',
        status: wsConnections?.length || 0 > 0 ? 'healthy' : 'degraded',
        lastCheck: new Date().toISOString(),
        responseTime: activeWS?.length || 0
      };
    });
  }

  private startPeriodicTasks(): void {
    // Update system metrics every 30 seconds
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.gauge('system.memory', memoryUsage.heapUsed, { type: 'heap' });
      this.gauge('system.memory', memoryUsage.rss, { type: 'rss' });
      this.gauge('system.connections', this.getActiveConnections().length);
    }, 30000);

    // Run health checks every minute
    setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        logger.error('Health check failed', 'MONITORING', { error });
      }
    }, 60000);

    // Clean up old data every 5 minutes
    setInterval(() => {
      this.cleanupOldData();
    }, 300000);
  }

  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - 3600000); // 1 hour ago
    
    // Clean performance log
    this.performanceLog = this?.performanceLog?.filter(p => 
      new Date(p.timestamp) > cutoff
    );
    
    // Clean query log
    this.queryLog = this?.queryLog?.filter(q => 
      new Date(q.timestamp) > cutoff
    );
    
    // Clean old alerts (keep acknowledged ones for 24 hours)
    const alertCutoff = new Date(Date.now() - 86400000); // 24 hours ago
    this.alerts = this?.alerts?.filter(a => 
      !a.acknowledged || new Date(a.timestamp) > alertCutoff
    );

    // Clean old connections
    const connectionCutoff = new Date(Date.now() - 600000); // 10 minutes ago
    for (const [id, conn] of this?.connections?.entries()) {
      if (conn.status !== 'connected' && new Date(conn.lastActivity) < connectionCutoff) {
        this?.connections?.delete(id);
      }
    }
  }
}

// =====================================================
// Export singleton instance
// =====================================================

export const monitoringService = MonitoringService.getInstance();
export default monitoringService;