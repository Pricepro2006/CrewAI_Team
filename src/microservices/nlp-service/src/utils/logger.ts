/**
 * Logger utility for NLP Microservice
 * Provides structured logging with proper levels and formatting
 */

// Optional Pino dependency - fallback to console if not available
let pino: any;
let pinoLogger: any;

try {
  pino = require('pino');
  
  // Create logger instance
  pinoLogger = pino({
    name: 'nlp-service',
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label: string) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions?.isoTime || (() => `,"time":"${new Date().toISOString()}"`),
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
} catch (error) {
  // Pino not available - use fallback console logger
  pino = null;
  pinoLogger = null;
}

export interface LogContext {
  component?: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  [key: string]: any;
}

/**
 * Console logger fallback
 */
class ConsoleLogger {
  private formatMessage(level: string, message: string, component?: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const comp = component ? `[${component}]` : '';
    const ctx = context ? JSON.stringify(context) : '';
    return `${timestamp} ${level.toUpperCase()} ${comp} ${message} ${ctx}`;
  }

  debug(message: string, component?: string, context?: LogContext): void {
    console.debug(this.formatMessage('debug', message, component, context));
  }

  info(message: string, component?: string, context?: LogContext): void {
    console.info(this.formatMessage('info', message, component, context));
  }

  warn(message: string, component?: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, component, context));
  }

  error(message: string, component?: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, component, context));
  }

  fatal(message: string, component?: string, context?: LogContext): void {
    console.error(this.formatMessage('fatal', message, component, context));
  }

  child(defaultContext: LogContext): ConsoleLogger {
    const childLogger = new ConsoleLogger();
    // Store default context for child logger
    (childLogger as any).defaultContext = defaultContext;
    return childLogger;
  }

  getRawLogger() {
    return console;
  }

  async flush(): Promise<void> {
    // Console doesn't need flushing
    return Promise.resolve();
  }
}

/**
 * Enhanced logger with context support
 */
class Logger {
  private pino = pinoLogger;
  private fallbackLogger = new ConsoleLogger();

  /**
   * Debug level logging
   */
  debug(message: string, component?: string, context?: LogContext): void {
    if (this.pino) {
      this.pino.debug({
        component,
        ...context
      }, message);
    } else {
      this.fallbackLogger.debug(message, component, context);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, component?: string, context?: LogContext): void {
    if (this.pino) {
      this.pino.info({
        component,
        ...context
      }, message);
    } else {
      this.fallbackLogger.info(message, component, context);
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, component?: string, context?: LogContext): void {
    if (this.pino) {
      this.pino.warn({
        component,
        ...context
      }, message);
    } else {
      this.fallbackLogger.warn(message, component, context);
    }
  }

  /**
   * Error level logging
   */
  error(message: string, component?: string, context?: LogContext): void {
    if (this.pino) {
      this.pino.error({
        component,
        ...context
      }, message);
    } else {
      this.fallbackLogger.error(message, component, context);
    }
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, component?: string, context?: LogContext): void {
    if (this.pino) {
      this.pino.fatal({
        component,
        ...context
      }, message);
    } else {
      this.fallbackLogger.fatal(message, component, context);
    }
  }

  /**
   * Create child logger with fixed context
   */
  child(defaultContext: LogContext): Logger {
    const childLogger = new Logger();
    if (this.pino) {
      childLogger.pino = this.pino.child(defaultContext);
    } else {
      childLogger.fallbackLogger = this.fallbackLogger.child(defaultContext);
    }
    return childLogger;
  }

  /**
   * Get raw pino instance
   */
  getRawLogger() {
    return this.pino || this.fallbackLogger.getRawLogger();
  }

  /**
   * Flush logs (useful for graceful shutdown)
   */
  async flush(): Promise<void> {
    if (this.pino && this.pino.flush) {
      return new Promise<void>((resolve) => {
        this.pino.flush(() => {
          resolve();
        });
      });
    } else {
      return this.fallbackLogger.flush();
    }
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
    const logMethod = this[level] as (message: string, component?: string, context?: LogContext) => void;
    logMethod.call(this, 'Request completed', 'REQUEST', {
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
    const logMethod = this[level] as (message: string, component?: string, context?: LogContext) => void;
    logMethod.call(this, 'NLP operation completed', 'NLP_OPERATION', {
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
    
    const logMethod = this[level] as (message: string, component?: string, context?: LogContext) => void;
    logMethod.call(this, 'Health check', 'HEALTH', {
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