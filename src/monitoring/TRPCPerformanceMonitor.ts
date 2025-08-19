import { TRPCError } from '@trpc/server';
import { sentryErrorTracker } from './SentryErrorTracker.js';
import { performanceMonitor } from './PerformanceMonitor.js';
import { logger } from '../utils/logger.js';

export interface TRPCCallMetrics {
  procedure: string;
  type: 'query' | 'mutation' | 'subscription';
  duration: number;
  success: boolean;
  userId?: string;
  input?: any;
  output?: any;
  error?: Error;
  timestamp: Date;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface TRPCPerformanceThresholds {
  query: {
    warning: number; // ms
    critical: number; // ms
  };
  mutation: {
    warning: number; // ms
    critical: number; // ms
  };
  subscription: {
    warning: number; // ms
    critical: number; // ms
  };
}

export class TRPCPerformanceMonitor {
  private callMetrics: Map<string, TRPCCallMetrics[]> = new Map();
  private activeTransactions: Map<string, any> = new Map();
  private thresholds: TRPCPerformanceThresholds;
  private maxMetricsRetention = 1000; // Keep last 1000 calls per procedure

  constructor() {
    this.thresholds = {
      query: {
        warning: 500, // 500ms for queries
        critical: 2000, // 2s for queries
      },
      mutation: {
        warning: 1000, // 1s for mutations
        critical: 5000, // 5s for mutations
      },
      subscription: {
        warning: 100, // 100ms for subscription setup
        critical: 1000, // 1s for subscription setup
      },
    };

    this.setupPeriodicReporting();
  }

  // TRPC middleware for performance monitoring
  createTRPCMiddleware() {
    return async (opts: any) => {
      const start = Date.now();
      const procedure = opts?.path;
      const type = opts?.type;
      const userId = opts.ctx?.user?.id;
      const callId = `${procedure}_${start}_${Math.random().toString(36).substr(2, 9)}`;

      // Start Sentry transaction
      const transaction = sentryErrorTracker.startTransaction(
        `trpc.${type}.${procedure}`,
        'rpc',
        {
          userId,
          component: 'trpc',
          operation: type,
          endpoint: procedure,
        }
      );

      this?.activeTransactions?.set(callId, transaction);

      // Add breadcrumb
      sentryErrorTracker.addBreadcrumb(
        `TRPC ${type} call started: ${procedure}`,
        'rpc',
        'info',
        {
          procedure,
          type,
          userId,
          callId,
        }
      );

      // Track memory usage before call
      const memoryBefore = process.memoryUsage();

      try {
        const result = await opts.next();
        const duration = Date.now() - start;
        const memoryAfter = process.memoryUsage();

        // Record successful call metrics
        const metrics: TRPCCallMetrics = {
          procedure,
          type,
          duration,
          success: true,
          userId,
          input: this.sanitizeInput(opts.input),
          output: this.sanitizeOutput(result),
          timestamp: new Date(start),
          memoryUsage: {
            heapUsed: memoryAfter.heapUsed,
            heapTotal: memoryAfter.heapTotal,
            external: memoryAfter.external,
          },
        };

        this.recordMetrics(metrics);
        this.checkPerformanceThresholds(metrics);

        // Complete Sentry transaction
        transaction.setStatus('ok');
        transaction.setData('duration', duration);
        transaction.setData('memory_delta', memoryAfter.heapUsed - memoryBefore.heapUsed);
        transaction.finish();

        // Record custom metrics
        sentryErrorTracker.recordCustomMetric(`trpc_${type}_duration`, duration, {
          procedure,
          status: 'success',
        });

        sentryErrorTracker.recordCustomMetric(`trpc_${type}_calls`, 1, {
          procedure,
          status: 'success',
        });

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        const memoryAfter = process.memoryUsage();

        // Record failed call metrics
        const metrics: TRPCCallMetrics = {
          procedure,
          type,
          duration,
          success: false,
          userId,
          input: this.sanitizeInput(opts.input),
          error: error as Error,
          timestamp: new Date(start),
          memoryUsage: {
            heapUsed: memoryAfter.heapUsed,
            heapTotal: memoryAfter.heapTotal,
            external: memoryAfter.external,
          },
        };

        this.recordMetrics(metrics);

        // Track error in Sentry
        const errorId = sentryErrorTracker.captureError(
          error as Error,
          {
            userId,
            component: 'trpc',
            operation: type,
            endpoint: procedure,
            requestId: callId,
          },
          'error',
          {
            procedure,
            type,
            duration: duration.toString(),
            input_hash: this.hashInput(opts.input),
          }
        );

        // Complete Sentry transaction with error
        transaction.setStatus('internal_error');
        transaction.setData('duration', duration);
        transaction.setData('error_id', errorId);
        transaction.finish();

        // Record error metrics
        sentryErrorTracker.recordCustomMetric(`trpc_${type}_errors`, 1, {
          procedure,
          error_type: (error as Error).name,
        });

        throw error;
      } finally {
        this?.activeTransactions?.delete(callId);
      }
    };
  }

  // Record performance metrics
  private recordMetrics(metrics: TRPCCallMetrics): void {
    const procedureMetrics = this?.callMetrics?.get(metrics.procedure) || [];
    procedureMetrics.push(metrics);

    // Limit retention to avoid memory leaks
    if (procedureMetrics?.length || 0 > this.maxMetricsRetention) {
      procedureMetrics.splice(0, procedureMetrics?.length || 0 - this.maxMetricsRetention);
    }

    this?.callMetrics?.set(metrics.procedure, procedureMetrics);

    // Log slow calls
    if (metrics.duration > this.thresholds[metrics.type].warning) {
      logger.warn(
        `Slow TRPC ${metrics.type} call: ${metrics.procedure}`,
        'TRPC_PERFORMANCE',
        {
          duration: metrics.duration,
          procedure: metrics.procedure,
          type: metrics.type,
          success: metrics.success,
          userId: metrics.userId,
        }
      );
    }
  }

  // Check performance thresholds and alert if exceeded
  private checkPerformanceThresholds(metrics: TRPCCallMetrics): void {
    const threshold = this.thresholds[metrics.type];
    
    if (metrics.duration > threshold.critical) {
      sentryErrorTracker.captureError(
        new Error(`TRPC ${metrics.type} call exceeded critical threshold`),
        {
          userId: metrics.userId,
          component: 'trpc',
          operation: metrics.type,
          endpoint: metrics.procedure,
        },
        'error',
        {
          procedure: metrics.procedure,
          duration: metrics?.duration?.toString(),
          threshold: threshold?.critical?.toString(),
          severity: 'critical',
        }
      );
    } else if (metrics.duration > threshold.warning) {
      sentryErrorTracker.addBreadcrumb(
        `TRPC ${metrics.type} call exceeded warning threshold`,
        'performance',
        'warning',
        {
          procedure: metrics.procedure,
          duration: metrics.duration,
          threshold: threshold.warning,
        }
      );
    }
  }

  // Get performance statistics for a procedure
  getStatistics(procedure?: string, timeWindowMs = 3600000): Record<string, any> {
    const cutoff = Date.now() - timeWindowMs;
    const stats: Record<string, any> = {};

    const procedures = procedure ? [procedure] : Array.from(this?.callMetrics?.keys());

    procedures.forEach(proc => {
      const metrics = this?.callMetrics?.get(proc) || [];
      const recentMetrics = metrics?.filter(m => m?.timestamp?.getTime() > cutoff);

      if (recentMetrics?.length || 0 === 0) return;

      const successful = recentMetrics?.filter(m => m.success);
      const failed = recentMetrics?.filter(m => !m.success);
      const durations = recentMetrics?.map(m => m.duration).sort((a, b) => a - b);

      // Calculate memory statistics
      const memoryStats = recentMetrics
        .filter(m => m.memoryUsage)
        .map(m => m.memoryUsage!.heapUsed);

      stats[proc] = {
        totalCalls: recentMetrics?.length || 0,
        successfulCalls: successful?.length || 0,
        failedCalls: failed?.length || 0,
        successRate: successful?.length || 0 / recentMetrics?.length || 0,
        avgDuration: durations.reduce((sum: any, d: any) => sum + d, 0) / durations?.length || 0,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations?.length || 0 - 1] || 0,
        p50: this.percentile(durations, 0.5),
        p95: this.percentile(durations, 0.95),
        p99: this.percentile(durations, 0.99),
        memoryUsage: {
          avg: memoryStats?.length || 0 > 0 
            ? memoryStats.reduce((sum: any, m: any) => sum + m, 0) / memoryStats?.length || 0 
            : 0,
          max: memoryStats?.length || 0 > 0 ? Math.max(...memoryStats) : 0,
        },
        errorTypes: this.getErrorTypes(failed),
        thresholdViolations: {
          warning: recentMetrics?.filter(m => m.duration > this.thresholds[m.type].warning).length,
          critical: recentMetrics?.filter(m => m.duration > this.thresholds[m.type].critical).length,
        },
      };
    });

    return stats;
  }

  // Get slow procedures
  getSlowProcedures(limit = 10): Array<{ procedure: string; avgDuration: number; callCount: number }> {
    const stats = this.getStatistics();
    
    return Object.entries(stats)
      .map(([procedure, stat]: [string, any]) => ({
        procedure,
        avgDuration: stat.avgDuration,
        callCount: stat.totalCalls,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  // Get error-prone procedures
  getErrorProneProcedures(limit = 10): Array<{ procedure: string; errorRate: number; errorCount: number }> {
    const stats = this.getStatistics();
    
    return Object.entries(stats)
      .map(([procedure, stat]: [string, any]) => ({
        procedure,
        errorRate: 1 - stat.successRate,
        errorCount: stat.failedCalls,
      }))
      .filter(item => item.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }

  // Export metrics for external monitoring systems
  exportMetrics(): Record<string, any> {
    const stats = this.getStatistics();
    const slowProcedures = this.getSlowProcedures();
    const errorProneProcedures = this.getErrorProneProcedures();

    return {
      timestamp: new Date().toISOString(),
      overview: {
        totalProcedures: Object.keys(stats).length,
        totalCalls: Object.values(stats).reduce((sum: number, stat: any) => sum + stat.totalCalls, 0),
        totalErrors: Object.values(stats).reduce((sum: number, stat: any) => sum + stat.failedCalls, 0),
        averageSuccessRate: Object.values(stats).reduce((sum: number, stat: any) => sum + stat.successRate, 0) / Object.keys(stats).length,
      },
      procedures: stats,
      slowProcedures,
      errorProneProcedures,
      activeTransactions: this?.activeTransactions?.size,
    };
  }

  // Update performance thresholds
  updateThresholds(newThresholds: Partial<TRPCPerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    logger.info('TRPC performance thresholds updated', 'TRPC_PERFORMANCE', {
      thresholds: this.thresholds,
    });
  }

  // Clear old metrics
  clearOldMetrics(olderThanMs = 86400000): void { // 24 hours default
    const cutoff = Date.now() - olderThanMs;
    
    this?.callMetrics?.forEach((metrics, procedure) => {
      const recentMetrics = metrics?.filter(m => m?.timestamp?.getTime() > cutoff);
      if (recentMetrics?.length || 0 < metrics?.length || 0) {
        this?.callMetrics?.set(procedure, recentMetrics);
      }
    });

    logger.info('Cleared old TRPC metrics', 'TRPC_PERFORMANCE', {
      cutoffTime: new Date(cutoff).toISOString(),
    });
  }

  // Private helper methods
  private sanitizeInput(input: any): any {
    if (!input) return undefined;
    
    // Remove sensitive data from input
    const sanitized = JSON.parse(JSON.stringify(input));
    
    // Remove potential passwords, tokens, etc.
    this.removeSensitiveFields(sanitized, ['password', 'token', 'secret', 'key', 'credential']);
    
    return sanitized;
  }

  private sanitizeOutput(output: any): any {
    if (!output) return undefined;
    
    // Limit output size and remove sensitive data
    const sanitized = JSON.parse(JSON.stringify(output));
    
    // Remove sensitive fields
    this.removeSensitiveFields(sanitized, ['password', 'token', 'secret', 'key', 'credential']);
    
    return sanitized;
  }

  private removeSensitiveFields(obj: any, sensitiveFields: string[]): void {
    if (typeof obj !== 'object' || obj === null) return;
    
    Object.keys(obj).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key], sensitiveFields);
      }
    });
  }

  private hashInput(input: any): string {
    if (!input) return 'no_input';
    
    try {
      const inputStr = JSON.stringify(input);
      return inputStr?.length || 0 > 50 ? `hash_${inputStr?.length || 0}_${inputStr.substring(0, 10)}` : inputStr;
    } catch {
      return 'unhashable_input';
    }
  }

  private percentile(values: number[], p: number): number {
    if (!values?.length) return 0;
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))] || 0;
  }

  private getErrorTypes(failedMetrics: TRPCCallMetrics[]): Record<string, number> {
    const errorTypes: Record<string, number> = {};
    
    failedMetrics.forEach(metric => {
      if (metric.error) {
        const errorType = metric?.error?.name || 'UnknownError';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }
    });

    return errorTypes;
  }

  private setupPeriodicReporting(): void {
    // Report metrics every 5 minutes
    setInterval(() => {
      const metrics = this.exportMetrics();
      
      // Send key metrics to Sentry
      sentryErrorTracker.recordCustomMetric('trpc_total_calls', metrics?.overview?.totalCalls);
      sentryErrorTracker.recordCustomMetric('trpc_total_errors', metrics?.overview?.totalErrors);
      sentryErrorTracker.recordCustomMetric('trpc_success_rate', metrics?.overview?.averageSuccessRate);
      sentryErrorTracker.recordCustomMetric('trpc_active_transactions', metrics.activeTransactions);

      // Log summary
      logger.info('TRPC performance report', 'TRPC_PERFORMANCE', {
        totalCalls: metrics?.overview?.totalCalls,
        totalErrors: metrics?.overview?.totalErrors,
        successRate: metrics?.overview?.averageSuccessRate,
        slowProceduresCount: metrics?.slowProcedures?.length,
        errorProneProceduresCount: metrics?.errorProneProcedures?.length,
      });

      // Clean up old metrics
      this.clearOldMetrics();
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// Singleton instance
export const trpcPerformanceMonitor = new TRPCPerformanceMonitor();