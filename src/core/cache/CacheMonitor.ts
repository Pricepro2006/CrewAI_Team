/**
 * Cache Monitoring and Management Service
 * 
 * Features:
 * - Real-time cache performance monitoring
 * - Cache warming strategies
 * - Memory usage tracking
 * - Hit/miss ratio analysis
 * - Automatic cleanup of expired entries
 * - Performance optimization recommendations
 * - Health checks and alerts
 */

import { cacheManager } from './RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import { CachedEmailRepository } from '../../database/repositories/CachedEmailRepository.js';
import { llmCache } from './LLMResponseCache.js';
import { sessionUserCache } from './SessionUserCache.js';
import { webSocketCache } from './WebSocketCache.js';
import { EventEmitter } from 'events';

export interface CacheHealthStatus {
  healthy: boolean;
  issues: string[];
  recommendations: string[];
  stats: {
    hitRate: number;
    missRate: number;
    memoryUsage: number;
    totalKeys: number;
    responseTime: number;
  };
}

export interface CacheWarmingJob {
  id: string;
  name: string;
  priority: number;
  schedule: string; // cron format
  handler: () => Promise<number>;
  lastRun?: Date;
  nextRun?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface CacheAlert {
  id: string;
  type: 'performance' | 'memory' | 'connectivity' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export class CacheMonitor extends EventEmitter {
  private static instance: CacheMonitor | null = null;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private warmingJobs: Map<string, CacheWarmingJob> = new Map();
  private activeAlerts: Map<string, CacheAlert> = new Map();
  private healthHistory: CacheHealthStatus[] = [];
  private readonly maxHistorySize = 100;

  // Thresholds for alerting
  private readonly thresholds = {
    hitRate: 70, // Minimum hit rate percentage
    memoryUsage: 85, // Maximum memory usage percentage
    responseTime: 100, // Maximum response time in ms
    errorRate: 5, // Maximum error rate percentage
  };

  private constructor() {
    super();
    this.setupDefaultWarmingJobs();
    logger.info('Cache Monitor initialized', 'CACHE_MONITOR');
  }

  public static getInstance(): CacheMonitor {
    if (!CacheMonitor.instance) {
      CacheMonitor.instance = new CacheMonitor();
    }
    return CacheMonitor.instance;
  }

  /**
   * Start monitoring cache performance
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Cache monitoring already started', 'CACHE_MONITOR');
      return;
    }

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
        await this.collectMetrics();
        await this.checkThresholds();
        await this.cleanupExpiredEntries();
      } catch (error) {
        logger.error('Error during cache monitoring', 'CACHE_MONITOR', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, intervalMs);

    logger.info('Cache monitoring started', 'CACHE_MONITOR', {
      intervalMs,
    });

    this.emit('monitoring:started', { intervalMs });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Cache monitoring stopped', 'CACHE_MONITOR');
    this.emit('monitoring:stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<CacheHealthStatus> {
    const startTime = Date.now();

    try {
      const stats = await cacheManager.getStats();
      const responseTime = Date.now() - startTime;

      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check hit rate
      if (stats.hitRate < this.thresholds.hitRate) {
        issues.push(`Low cache hit rate: ${stats.hitRate.toFixed(1)}%`);
        recommendations.push('Consider cache warming or increasing TTL for frequently accessed data');
      }

      // Check memory usage (if available)
      if (stats.memoryUsage > 0) {
        const memoryPercentage = (stats.memoryUsage / (1024 * 1024 * 1024)) * 100; // Convert to GB percentage
        if (memoryPercentage > this.thresholds.memoryUsage) {
          issues.push(`High memory usage: ${memoryPercentage.toFixed(1)}%`);
          recommendations.push('Consider implementing cache eviction policies or increasing memory');
        }
      }

      // Check response time
      if (responseTime > this.thresholds.responseTime) {
        issues.push(`Slow cache response time: ${responseTime}ms`);
        recommendations.push('Check Redis server performance and network connectivity');
      }

      // Check key count growth
      if (stats.totalKeys > 100000) {
        recommendations.push('Large number of cache keys detected. Consider implementing key cleanup policies');
      }

      const healthStatus: CacheHealthStatus = {
        healthy: issues.length === 0,
        issues,
        recommendations,
        stats: {
          hitRate: stats.hitRate,
          missRate: stats.missRate,
          memoryUsage: stats.memoryUsage,
          totalKeys: stats.totalKeys,
          responseTime,
        },
      };

      // Store in history
      this.healthHistory.push(healthStatus);
      if (this.healthHistory.length > this.maxHistorySize) {
        this.healthHistory.shift();
      }

      // Emit health check event
      this.emit('health:checked', healthStatus);

      logger.debug('Cache health check completed', 'CACHE_MONITOR', {
        healthy: healthStatus.healthy,
        issueCount: issues.length,
        recommendationCount: recommendations.length,
        responseTime,
      });

      return healthStatus;
    } catch (error) {
      const healthStatus: CacheHealthStatus = {
        healthy: false,
        issues: ['Health check failed'],
        recommendations: ['Check cache connectivity and Redis server status'],
        stats: {
          hitRate: 0,
          missRate: 0,
          memoryUsage: 0,
          totalKeys: 0,
          responseTime: Date.now() - startTime,
        },
      };

      logger.error('Cache health check failed', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });

      return healthStatus;
    }
  }

  /**
   * Collect detailed cache metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const stats = await cacheManager.getStats();

      // Report to metrics system
      metrics.gauge('cache_monitor.hit_rate', stats.hitRate);
      metrics.gauge('cache_monitor.miss_rate', stats.missRate);
      metrics.gauge('cache_monitor.total_keys', stats.totalKeys);
      metrics.gauge('cache_monitor.memory_usage', stats.memoryUsage);
      metrics.gauge('cache_monitor.avg_response_time', stats.avgResponseTime);

      // Collect service-specific metrics
      const emailStats = await this.getEmailCacheStats();
      const llmStats = await this.getLLMCacheStats();
      const sessionStats = await this.getSessionCacheStats();
      const wsStats = await this.getWebSocketCacheStats();

      // Report service-specific metrics
      if (emailStats) {
        metrics.gauge('cache_monitor.email.hit_rate', emailStats.hitRate || 0);
      }

      if (llmStats) {
        metrics.gauge('cache_monitor.llm.hit_rate', llmStats.hitRate || 0);
      }

      logger.debug('Cache metrics collected', 'CACHE_MONITOR', {
        totalKeys: stats.totalKeys,
        hitRate: stats.hitRate,
        memoryUsage: stats.memoryUsage,
      });
    } catch (error) {
      logger.error('Failed to collect cache metrics', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  private async checkThresholds(): Promise<void> {
    try {
      const stats = await cacheManager.getStats();

      // Check hit rate threshold
      if (stats.hitRate < this.thresholds.hitRate) {
        await this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: `Cache hit rate (${stats.hitRate.toFixed(1)}%) is below threshold (${this.thresholds.hitRate}%)`,
          metadata: { hitRate: stats.hitRate, threshold: this.thresholds.hitRate },
        });
      }

      // Check memory usage threshold
      if (stats.memoryUsage > 0) {
        const memoryMB = stats.memoryUsage / (1024 * 1024);
        if (memoryMB > 1000) { // Alert if over 1GB
          await this.createAlert({
            type: 'memory',
            severity: 'high',
            message: `High cache memory usage: ${memoryMB.toFixed(1)}MB`,
            metadata: { memoryUsage: memoryMB },
          });
        }
      }

      // Check response time
      if (stats.avgResponseTime > this.thresholds.responseTime) {
        await this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: `Cache response time (${stats.avgResponseTime.toFixed(1)}ms) exceeds threshold (${this.thresholds.responseTime}ms)`,
          metadata: { responseTime: stats.avgResponseTime, threshold: this.thresholds.responseTime },
        });
      }

      logger.debug('Threshold check completed', 'CACHE_MONITOR', {
        activeAlerts: this.activeAlerts.size,
      });
    } catch (error) {
      logger.error('Failed to check thresholds', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanupExpiredEntries(): Promise<void> {
    try {
      // This is typically handled by Redis automatically, but we can add custom cleanup logic here
      logger.debug('Cache cleanup completed', 'CACHE_MONITOR');
    } catch (error) {
      logger.error('Failed to cleanup expired entries', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create a cache alert
   */
  private async createAlert(alertData: Omit<CacheAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const alert: CacheAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData,
    };

    // Check if similar alert already exists
    const existingAlert = Array.from(this.activeAlerts.values()).find(
      a => a.type === alert.type && a.message === alert.message && !a.resolved
    );

    if (existingAlert) {
      logger.debug('Similar alert already exists, skipping', 'CACHE_MONITOR', {
        alertId: existingAlert.id,
      });
      return;
    }

    this.activeAlerts.set(alert.id, alert);

    logger.warn('Cache alert created', 'CACHE_MONITOR', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
    });

    metrics.increment('cache_monitor.alerts.created');
    this.emit('alert:created', alert);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    this.activeAlerts.delete(alertId);

    logger.info('Cache alert resolved', 'CACHE_MONITOR', {
      alertId,
      type: alert.type,
      message: alert.message,
    });

    metrics.increment('cache_monitor.alerts.resolved');
    this.emit('alert:resolved', alert);

    return true;
  }

  /**
   * Register a cache warming job
   */
  registerWarmingJob(job: Omit<CacheWarmingJob, 'status'>): void {
    const warmingJob: CacheWarmingJob = {
      ...job,
      status: 'pending',
    };

    this.warmingJobs.set(job.id, warmingJob);

    logger.info('Cache warming job registered', 'CACHE_MONITOR', {
      jobId: job.id,
      name: job.name,
      priority: job.priority,
    });
  }

  /**
   * Execute cache warming jobs
   */
  async executeWarmingJobs(): Promise<void> {
    const jobs = Array.from(this.warmingJobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => b.priority - a.priority);

    logger.info('Executing cache warming jobs', 'CACHE_MONITOR', {
      jobCount: jobs.length,
    });

    for (const job of jobs) {
      try {
        job.status = 'running';
        job.lastRun = new Date();

        const warmedCount = await job.handler();

        job.status = 'completed';

        logger.info('Cache warming job completed', 'CACHE_MONITOR', {
          jobId: job.id,
          name: job.name,
          warmedCount,
        });

        metrics.increment('cache_monitor.warming.completed');
        metrics.histogram('cache_monitor.warming.items', warmedCount);
      } catch (error) {
        job.status = 'failed';

        logger.error('Cache warming job failed', 'CACHE_MONITOR', {
          jobId: job.id,
          name: job.name,
          error: error instanceof Error ? error.message : String(error),
        });

        metrics.increment('cache_monitor.warming.failed');
      }
    }
  }

  /**
   * Setup default cache warming jobs
   */
  private setupDefaultWarmingJobs(): void {
    // Email cache warming
    this.registerWarmingJob({
      id: 'email_cache_warming',
      name: 'Email Cache Warming',
      priority: 80,
      schedule: '0 */6 * * *', // Every 6 hours
      handler: async () => {
        // Implementation would depend on having access to the cached email repository
        logger.info('Email cache warming job executed', 'CACHE_MONITOR');
        return 0; // Placeholder
      },
    });

    // LLM cache warming
    this.registerWarmingJob({
      id: 'llm_cache_warming',
      name: 'LLM Cache Warming',
      priority: 60,
      schedule: '0 */12 * * *', // Every 12 hours
      handler: async () => {
        const commonPrompts = [
          { prompt: 'Analyze this email for priority level', model: 'llama3.2:3b' },
          { prompt: 'Extract entities from this email', model: 'llama3.2:3b' },
          { prompt: 'Determine email sentiment', model: 'llama3.2:3b' },
        ];

        return await llmCache.warmCache(commonPrompts);
      },
    });
  }

  /**
   * Get email cache statistics
   */
  private async getEmailCacheStats(): Promise<any> {
    try {
      // This would require access to the email repository instance
      return null; // Placeholder
    } catch (error) {
      logger.error('Failed to get email cache stats', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get LLM cache statistics
   */
  private async getLLMCacheStats(): Promise<any> {
    try {
      return await llmCache.getCacheStats();
    } catch (error) {
      logger.error('Failed to get LLM cache stats', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get session cache statistics
   */
  private async getSessionCacheStats(): Promise<any> {
    try {
      return await sessionUserCache.getCacheStats();
    } catch (error) {
      logger.error('Failed to get session cache stats', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get WebSocket cache statistics
   */
  private async getWebSocketCacheStats(): Promise<any> {
    try {
      return await webSocketCache.getCacheStats();
    } catch (error) {
      logger.error('Failed to get WebSocket cache stats', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): CacheHealthStatus | null {
    return this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1] : null;
  }

  /**
   * Get health history
   */
  getHealthHistory(): CacheHealthStatus[] {
    return [...this.healthHistory];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): CacheAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<any> {
    try {
      const currentHealth = this.getCurrentHealth();
      const activeAlerts = this.getActiveAlerts();
      const warmingJobs = Array.from(this.warmingJobs.values());

      const report = {
        timestamp: new Date(),
        health: currentHealth,
        alerts: {
          active: activeAlerts.length,
          byType: activeAlerts.reduce((acc, alert) => {
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          bySeverity: activeAlerts.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        warming: {
          totalJobs: warmingJobs.length,
          completedJobs: warmingJobs.filter(j => j.status === 'completed').length,
          failedJobs: warmingJobs.filter(j => j.status === 'failed').length,
        },
        recommendations: currentHealth?.recommendations || [],
      };

      logger.info('Performance report generated', 'CACHE_MONITOR', {
        healthy: currentHealth?.healthy,
        alertCount: activeAlerts.length,
        jobCount: warmingJobs.length,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate performance report', 'CACHE_MONITOR', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Shutdown cache monitor
   */
  async shutdown(): Promise<void> {
    this.stopMonitoring();
    this.warmingJobs.clear();
    this.activeAlerts.clear();
    this.healthHistory.length = 0;

    logger.info('Cache monitor shutdown completed', 'CACHE_MONITOR');
  }
}

// Export singleton instance
export const cacheMonitor = CacheMonitor.getInstance();