/**
 * Logger utility for NLP Microservice
 * Provides structured logging with proper levels and formatting
 */

import pino from 'pino';

export interface LogContext {
  component?: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  [key: string]: any;
}

// Create logger instance
const pinoLogger = pino({
  name: 'nlp-service',
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Pretty print in development
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
});

/**
 * Enhanced logger with context support
 */
class Logger {
  private pino = pinoLogger;

  /**
   * Debug level logging
   */
  debug(message: string, component?: string, context?: LogContext): void {
    this.pino.debug({
      component,
      ...context
    }, message);
  }

  /**
   * Info level logging
   */
  info(message: string, component?: string, context?: LogContext): void {
    this.pino.info({
      component,
      ...context
    }, message);
  }

  /**
   * Warning level logging
   */
  warn(message: string, component?: string, context?: LogContext): void {
    this.pino.warn({
      component,
      ...context
    }, message);
  }

  /**
   * Error level logging
   */
  error(message: string, component?: string, context?: LogContext): void {
    this.pino.error({
      component,
      ...context
    }, message);
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, component?: string, context?: LogContext): void {
    this.pino.fatal({
      component,
      ...context
    }, message);
  }

  /**
   * Create child logger with fixed context
   */
  child(defaultContext: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.pino = this.pino.child(defaultContext);
    return childLogger;
  }

  /**
   * Get raw pino instance
   */
  getRawLogger() {
    return this.pino;
  }

  /**
   * Flush logs (useful for graceful shutdown)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.pino.flush(() => {
        resolve();
      });
    });
  }

  /**
   * Log request start
   */
  logRequestStart(method: string, url: string, context: LogContext = {}): void {
    this.info('Request started', 'REQUEST', {
      method,
      url,
      ...context
    });
  }

  /**
   * Log request completion
   */
  logRequestComplete(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context: LogContext = {}
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this[level]('Request completed', 'REQUEST', {
      method,
      url,
      statusCode,
      duration,
      ...context
    });
  }

  /**
   * Log NLP operation
   */
  logNLPOperation(
    operation: 'process' | 'batch',
    query: string,
    duration: number,
    success: boolean,
    context: LogContext = {}
  ): void {
    const level = success ? 'info' : 'error';
    this[level]('NLP operation completed', 'NLP_OPERATION', {
      operation,
      query: query.length > 100 ? query.substring(0, 100) + '...' : query,
      queryLength: query.length,
      duration,
      success,
      ...context
    });
  }

  /**
   * Log queue operation
   */
  logQueueOperation(
    operation: 'enqueue' | 'dequeue' | 'process' | 'complete' | 'fail',
    requestId: string,
    queueSize: number,
    context: LogContext = {}
  ): void {
    this.debug('Queue operation', 'QUEUE', {
      operation,
      requestId,
      queueSize,
      ...context
    });
  }

  /**
   * Log service lifecycle
   */
  logServiceLifecycle(
    event: 'starting' | 'started' | 'stopping' | 'stopped',
    component: string,
    context: LogContext = {}
  ): void {
    this.info(`Service ${event}`, component.toUpperCase(), {
      event,
      ...context
    });
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(
    component: string,
    metrics: Record<string, number>,
    context: LogContext = {}
  ): void {
    this.debug('Performance metrics', component.toUpperCase(), {
      metrics,
      ...context
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    event: 'auth_failed' | 'rate_limited' | 'suspicious_activity',
    details: Record<string, any>,
    context: LogContext = {}
  ): void {
    this.warn('Security event', 'SECURITY', {
      event,
      details,
      ...context
    });
  }

  /**
   * Log health check
   */
  logHealthCheck(
    component: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    details: Record<string, any> = {},
    context: LogContext = {}
  ): void {
    const level = status === 'healthy' ? 'debug' : 
                 status === 'degraded' ? 'warn' : 'error';
    
    this[level]('Health check', 'HEALTH', {
      component,
      status,
      details,
      ...context
    });
  }

  /**
   * Log configuration
   */
  logConfiguration(config: Record<string, any>, context: LogContext = {}): void {
    // Sanitize sensitive information
    const sanitizedConfig = this.sanitizeConfig(config);
    
    this.info('Configuration loaded', 'CONFIG', {
      config: sanitizedConfig,
      ...context
    });
  }

  /**
   * Sanitize configuration for logging (remove secrets)
   */
  private sanitizeConfig(config: any): any {
    if (typeof config !== 'object' || config === null) {
      return config;
    }

    const sensitiveKeys = [
      'password',
      'secret',
      'key',
      'token',
      'apiKey',
      'api_key',
      'auth',
      'credential'
    ];

    const sanitized: any = Array.isArray(config) ? [] : {};

    for (const [key, value] of Object.entries(config)) {
      const keyLower = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitiveKey => 
        keyLower.includes(sensitiveKey)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeConfig(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// Export singleton logger instance
export const logger = new Logger();

// Export Logger class for creating child loggers
export { Logger };

// Export types
export type { LogContext };