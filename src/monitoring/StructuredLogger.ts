import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import DailyRotateFile from 'winston-daily-rotate-file';
import { hostname } from 'node:os';
import { sentryErrorTracker } from './SentryErrorTracker.js';
import { piiRedactor } from '../utils/PIIRedactor.js';
import { JSONObject, JSONValue } from '../shared/types/utility.types';
import { LogEntry } from '../shared/types/monitoring.types';

// Extended log levels for better granularity
export const LOG_LEVELS = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
  trace: 8,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

// Structured log interface
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component: string;
  operation?: string;
  traceId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  version: string;
  environment: string;
  hostname: string;
  pid: number;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  performance?: {
    duration?: number;
    cpu?: {
      user: number;
      system: number;
    };
  };
  context?: JSONObject;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  tags?: string[];
}

// Log aggregation interface
export interface LogAggregation {
  timeWindow: string;
  component: string;
  level: LogLevel;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  samples: StructuredLogEntry[];
  uniqueMessages: Set<string>;
  uniqueOperations: Set<string>;
  averageDuration?: number;
  memoryTrend?: {
    min: number;
    max: number;
    avg: number;
  };
}

export class StructuredLogger {
  private winston: winston.Logger;
  private aggregations: Map<string, LogAggregation> = new Map();
  private logBuffer: StructuredLogEntry[] = [];
  private bufferFlushInterval!: NodeJS.Timeout;
  private readonly maxBufferSize = 1000;
  private readonly flushIntervalMs = 5000; // 5 seconds
  private readonly version: string;
  private readonly environment: string;
  private readonly hostname: string;

  constructor() {
    this.version = process.env.APP_VERSION || '1.0.0';
    this.environment = process.env.NODE_ENV || 'development';
    this.hostname = process.env.HOSTNAME || hostname();
    
    this.winston = this.createWinstonLogger();
    this.setupBufferFlushing();
    this.setupAggregation();
  }

  private createWinstonLogger(): winston.Logger {
    const formats = [
      winston?.format?.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston?.format?.errors({ stack: true }),
      winston?.format?.metadata({ 
        fillExcept: ['message', 'level', 'timestamp', 'label'] 
      }),
    ];

    // Add JSON format for structured logging
    if (process.env.LOG_FORMAT === 'json') {
      formats.push(winston?.format.json());
    } else {
      formats.push(
        winston?.format?.printf((info: LogEntry) => {
          const { timestamp, level, message, component, operation, traceId, ...meta } = info;
          let log = `${timestamp} [${level.toUpperCase()}] ${component || 'UNKNOWN'}`;
          
          if (operation) log += `::${operation}`;
          if (traceId) log += ` [${traceId}]`;
          
          log += `: ${message}`;
          
          // Add metadata if present
          if (Object.keys(meta).length > 0) {
            log += ` | ${JSON.stringify(meta)}`;
          }
          
          return log;
        })
      );
    }

    const transports: winston.transport[] = [];

    // Console transport
    transports.push(
      new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info',
        format: winston?.format?.combine(
          winston?.format?.colorize(),
          ...formats
        ),
      })
    );

    // File transports with rotation
    const logDir = process.env.LOG_DIR || './logs';

    // Application logs
    transports.push(
      new DailyRotateFile({
        filename: `${logDir}/application-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info',
        format: winston?.format?.combine(...formats),
      })
    );

    // Error logs
    transports.push(
      new DailyRotateFile({
        filename: `${logDir}/error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: winston?.format?.combine(...formats),
      })
    );

    // Debug logs (only in development)
    if (this.environment === 'development') {
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/debug-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '50m',
          maxFiles: '7d',
          level: 'debug',
          format: winston?.format?.combine(...formats),
        })
      );
    }

    // Elasticsearch transport for log aggregation (if configured)
    if (process.env.ELASTICSEARCH_URL) {
      transports.push(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL,
            auth: process.env.ELASTICSEARCH_AUTH ? {
              username: process.env.ELASTICSEARCH_USERNAME || '',
              password: process.env.ELASTICSEARCH_PASSWORD || '',
            } : undefined,
          },
          index: `grocery-agent-logs-${this.environment}`,
          transformer: (logData: LogEntry) => {
            return {
              '@timestamp': new Date().toISOString(),
              level: logData.level,
              message: logData.message,
              component: logData.component,
              environment: this.environment,
              version: this.version,
              hostname: this.hostname,
              ...logData.meta,
            };
          },
        })
      );
    }

    return winston.createLogger({
      levels: LOG_LEVELS,
      level: process.env.LOG_LEVEL || 'info',
      transports,
      exitOnError: false,
    });
  }

  private setupBufferFlushing(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.flushBuffer();
    }, this.flushIntervalMs);

    // Flush on process exit
    process.on('SIGINT', () => this.flushBuffer());
    process.on('SIGTERM', () => this.flushBuffer());
  }

  private setupAggregation(): void {
    // Aggregate logs every minute
    setInterval(() => {
      this.aggregateLogs();
    }, 60 * 1000);

    // Clean up old aggregations every hour
    setInterval(() => {
      this.cleanupAggregations();
    }, 60 * 60 * 1000);
  }

  // Main logging method
  log(
    level: LogLevel,
    message: string,
    component: string,
    context?: {
      operation?: string;
      traceId?: string;
      userId?: string;
      sessionId?: string;
      requestId?: string;
      duration?: number;
      error?: Error;
      data?: JSONObject;
      tags?: string[];
    }
  ): void {
    // Apply PII redaction
    const redactedMessage = piiRedactor.redact(message);
    const redactedContext = context?.data ? {
      ...context,
      data: piiRedactor.redactObject(context.data),
    } : context;

    // Create structured log entry
    const logEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: redactedMessage,
      component,
      operation: redactedContext?.operation,
      traceId: redactedContext?.traceId,
      userId: redactedContext?.userId,
      sessionId: redactedContext?.sessionId,
      requestId: redactedContext?.requestId,
      version: this.version,
      environment: this.environment,
      hostname: this.hostname,
      pid: process.pid,
      memory: this.getMemoryUsage(),
      performance: redactedContext?.duration ? {
        duration: redactedContext.duration,
        cpu: process.cpuUsage(),
      } : undefined,
      context: redactedContext?.data,
      error: redactedContext?.error ? {
        name: redactedContext?.error?.name,
        message: piiRedactor.redact(redactedContext?.error?.message),
        stack: redactedContext?.error?.stack ? piiRedactor.redact(redactedContext?.error?.stack) : undefined,
        code: (redactedContext.error as Error & { code?: string | number }).code,
      } : undefined,
      tags: redactedContext?.tags,
    };

    // Add to buffer for aggregation
    this?.logBuffer?.push(logEntry);

    // Flush buffer if it's getting too large
    if (this?.logBuffer?.length >= this.maxBufferSize) {
      this.flushBuffer();
    }

    // Send to Winston
    this?.winston?.log(level, redactedMessage, {
      component,
      operation: redactedContext?.operation,
      traceId: redactedContext?.traceId,
      userId: redactedContext?.userId,
      sessionId: redactedContext?.sessionId,
      requestId: redactedContext?.requestId,
      duration: redactedContext?.duration,
      memory: logEntry.memory,
      context: redactedContext?.data,
      error: logEntry.error,
      tags: redactedContext?.tags,
    });

    // Send critical logs to Sentry
    if (['emergency', 'alert', 'critical', 'error'].includes(level)) {
      if (redactedContext?.error) {
        sentryErrorTracker.captureError(
          redactedContext.error,
          {
            component,
            operation: redactedContext.operation,
            userId: redactedContext.userId,
            sessionId: redactedContext.sessionId,
            requestId: redactedContext.requestId,
            traceId: redactedContext.traceId,
          },
          level === 'emergency' || level === 'alert' || level === 'critical' ? 'fatal' : 'error',
          {
            log_level: level,
            environment: this.environment,
            version: this.version,
          }
        );
      } else {
        sentryErrorTracker.captureError(
          new Error(redactedMessage),
          {
            component,
            operation: redactedContext?.operation,
            userId: redactedContext?.userId,
            sessionId: redactedContext?.sessionId,
            requestId: redactedContext?.requestId,
            traceId: redactedContext?.traceId,
          },
          level === 'emergency' || level === 'alert' || level === 'critical' ? 'fatal' : 'error'
        );
      }
    }
  }

  // Convenience methods for different log levels
  emergency(message: string, component: string, context?: JSONObject): void {
    this.log('emergency', message, component, context);
  }

  alert(message: string, component: string, context?: JSONObject): void {
    this.log('alert', message, component, context);
  }

  critical(message: string, component: string, context?: JSONObject): void {
    this.log('critical', message, component, context);
  }

  error(message: string, component: string, context?: JSONObject): void {
    this.log('error', message, component, context);
  }

  warning(message: string, component: string, context?: JSONObject): void {
    this.log('warning', message, component, context);
  }

  notice(message: string, component: string, context?: JSONObject): void {
    this.log('notice', message, component, context);
  }

  info(message: string, component: string, context?: JSONObject): void {
    this.log('info', message, component, context);
  }

  debug(message: string, component: string, context?: JSONObject): void {
    this.log('debug', message, component, context);
  }

  trace(message: string, component: string, context?: JSONObject): void {
    this.log('trace', message, component, context);
  }

  // Specialized logging methods for grocery agent
  nlpParsing(
    success: boolean,
    query: string,
    confidence: number,
    parseTime: number,
    context?: JSONObject
  ): void {
    this.info('NLP parsing completed', 'NLP_PARSER', {
      operation: 'parse_query',
      duration: parseTime,
      data: {
        success,
        query: query.substring(0, 100), // Truncate for logging
        confidence,
      },
      tags: ['nlp', 'parsing', success ? 'success' : 'failure'],
      ...context,
    });
  }

  productMatching(
    searchTerm: string,
    matchType: 'exact' | 'fuzzy' | 'none',
    confidence: number,
    searchTime: number,
    context?: JSONObject
  ): void {
    this.info('Product matching completed', 'PRODUCT_MATCHER', {
      operation: 'match_product',
      duration: searchTime,
      data: {
        searchTerm: searchTerm.substring(0, 50),
        matchType,
        confidence,
      },
      tags: ['product', 'matching', matchType],
      ...context,
    });
  }

  priceFetching(
    productId: string,
    success: boolean,
    responseTime: number,
    storeId?: string,
    context?: JSONObject
  ): void {
    this.info('Price fetching completed', 'PRICE_FETCHER', {
      operation: 'fetch_price',
      duration: responseTime,
      data: {
        productId,
        success,
        storeId,
      },
      tags: ['price', 'fetch', success ? 'success' : 'failure'],
      ...context,
    });
  }

  dealDetection(
    productId: string,
    dealsFound: number,
    detectionTime: number,
    context?: JSONObject
  ): void {
    this.info('Deal detection completed', 'DEAL_DETECTOR', {
      operation: 'detect_deals',
      duration: detectionTime,
      data: {
        productId,
        dealsFound,
      },
      tags: ['deal', 'detection'],
      ...context,
    });
  }

  userSession(
    sessionId: string,
    userId: string,
    action: string,
    context?: JSONObject
  ): void {
    this.info(`User session ${action}`, 'USER_SESSION', {
      operation: action,
      sessionId,
      userId,
      tags: ['user', 'session', action],
      ...context,
    });
  }

  webSocketEvent(
    event: string,
    connectionId: string,
    context?: JSONObject
  ): void {
    this.debug(`WebSocket ${event}`, 'WEBSOCKET', {
      operation: event,
      data: { connectionId },
      tags: ['websocket', event],
      ...context,
    });
  }

  apiRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    context?: JSONObject
  ): void {
    const level = statusCode >= 500 ? 'error' : 
                  statusCode >= 400 ? 'warning' : 'info';

    this.log(level, `API request ${method} ${path}`, 'API', {
      operation: 'api_request',
      duration: responseTime,
      userId,
      data: {
        method,
        path,
        statusCode,
      },
      tags: ['api', 'request', statusCode >= 400 ? 'error' : 'success'],
      ...context,
    });
  }

  databaseQuery(
    query: string,
    duration: number,
    success: boolean,
    context?: JSONObject
  ): void {
    const level = success ? 'debug' : 'error';
    
    this.log(level, `Database query ${success ? 'succeeded' : 'failed'}`, 'DATABASE', {
      operation: 'db_query',
      duration,
      data: {
        query: query.substring(0, 200), // Truncate for logging
        success,
      },
      tags: ['database', 'query', success ? 'success' : 'failure'],
      ...context,
    });
  }

  // Log aggregation and analysis
  private flushBuffer(): void {
    if (this?.logBuffer?.length === 0) return;

    // Send buffer to external log aggregation service if configured
    if (process.env.LOG_AGGREGATION_URL) {
      this.sendToAggregationService(this.logBuffer);
    }

    // Clear buffer
    this.logBuffer = [];
  }

  private async sendToAggregationService(logs: StructuredLogEntry[]): Promise<void> {
    try {
      const response = await fetch(process.env.LOG_AGGREGATION_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LOG_AGGREGATION_TOKEN}`,
        },
        body: JSON.stringify({
          logs,
          service: 'grocery-agent',
          environment: this.environment,
          version: this.version,
        }),
      });

      if (!response.ok) {
        throw new Error(`Log aggregation service error: ${response.statusText}`);
      }
    } catch (error) {
      // Log to console if aggregation service fails
      console.error('Failed to send logs to aggregation service:', error);
    }
  }

  private aggregateLogs(): void {
    const now = new Date();
    const timeWindow = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${Math.floor(now.getMinutes() / 5)}`;

    this?.logBuffer?.forEach(log => {
      const key = `${timeWindow}_${log.component}_${log.level}`;
      const existing = this?.aggregations?.get(key);

      if (existing) {
        existing.count++;
        existing.lastSeen = new Date(log.timestamp);
        existing?.uniqueMessages?.add(log.message);
        if (log.operation) existing?.uniqueOperations?.add(log.operation);
        
        if (existing?.samples?.length < 5) {
          existing?.samples?.push(log);
        }

        if (log.performance?.duration) {
          existing.averageDuration = existing.averageDuration 
            ? (existing.averageDuration + log?.performance?.duration) / 2
            : log?.performance?.duration;
        }
      } else {
        this?.aggregations?.set(key, {
          timeWindow,
          component: log.component,
          level: log.level,
          count: 1,
          firstSeen: new Date(log.timestamp),
          lastSeen: new Date(log.timestamp),
          samples: [log],
          uniqueMessages: new Set([log.message]),
          uniqueOperations: new Set(log.operation ? [log.operation] : []),
          averageDuration: log.performance?.duration,
          memoryTrend: log.memory ? {
            min: log?.memory?.heapUsed,
            max: log?.memory?.heapUsed,
            avg: log?.memory?.heapUsed,
          } : undefined,
        });
      }
    });
  }

  private cleanupAggregations(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    this?.aggregations?.forEach((agg, key) => {
      if (agg.lastSeen < cutoff) {
        this?.aggregations?.delete(key);
      }
    });
  }

  private getMemoryUsage(): StructuredLogEntry['memory'] {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
    };
  }

  // Query and analysis methods
  getAggregations(filter?: {
    component?: string;
    level?: LogLevel;
    timeWindow?: string;
  }): LogAggregation[] {
    let aggregations = Array.from(this?.aggregations?.values());

    if (filter) {
      if (filter.component) {
        aggregations = aggregations?.filter(a => a.component === filter.component);
      }
      if (filter.level) {
        aggregations = aggregations?.filter(a => a.level === filter.level);
      }
      if (filter.timeWindow) {
        aggregations = aggregations?.filter(a => a.timeWindow === filter.timeWindow);
      }
    }

    return aggregations.sort((a, b) => b?.lastSeen?.getTime() - a?.lastSeen?.getTime());
  }

  getLogStats(hours = 1): JSONObject {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentAggregations = Array.from(this?.aggregations?.values())
      .filter(a => a.lastSeen >= cutoff);

    const stats: JSONObject = {
      totalLogs: recentAggregations.reduce((sum: number, a: LogAggregation) => sum + a.count, 0),
      uniqueComponents: new Set(recentAggregations?.map(a => a.component)).size,
      logsByLevel: {} as Record<string, number>,
      logsByComponent: {} as Record<string, number>,
      errorRate: 0,
      averageMemoryUsage: 0,
      slowOperations: [] as Array<{ component: string; operation: string; duration: number }>,
    };

    let errorCount = 0;
    let memorySum = 0;
    let memoryCount = 0;

    recentAggregations.forEach(agg => {
      // Count by level
      stats.logsByLevel[agg.level] = (stats.logsByLevel[agg.level] || 0) + agg.count;

      // Count by component
      stats.logsByComponent[agg.component] = (stats.logsByComponent[agg.component] || 0) + agg.count;

      // Count errors
      if (['emergency', 'alert', 'critical', 'error'].includes(agg.level)) {
        errorCount += agg.count;
      }

      // Track memory usage
      if (agg.memoryTrend) {
        memorySum += agg?.memoryTrend?.avg;
        memoryCount++;
      }

      // Track slow operations
      if (agg.averageDuration && agg.averageDuration > 1000) { // > 1 second
        agg?.uniqueOperations?.forEach(op => {
          stats?.slowOperations?.push({
            component: agg.component,
            operation: op,
            duration: agg.averageDuration!,
          });
        });
      }
    });

    stats.errorRate = stats.totalLogs > 0 ? errorCount / stats.totalLogs : 0;
    stats.averageMemoryUsage = memoryCount > 0 ? memorySum / memoryCount : 0;
    stats?.slowOperations?.sort((a, b) => b.duration - a.duration);

    return stats;
  }

  // Search logs
  searchLogs(query: string, options?: {
    component?: string;
    level?: LogLevel;
    limit?: number;
  }): StructuredLogEntry[] {
    const results: StructuredLogEntry[] = [];
    const limit = options?.limit || 100;

    this?.aggregations?.forEach(agg => {
      if (options?.component && agg.component !== options.component) return;
      if (options?.level && agg.level !== options.level) return;

      agg?.samples?.forEach(log => {
        if (results?.length || 0 >= limit) return;

        const searchIn = `${log.message} ${log.operation || ''} ${JSON.stringify(log.context || {})}`;
        if (searchIn.toLowerCase().includes(query.toLowerCase())) {
          results.push(log);
        }
      });
    });

    return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Export for external analysis
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    const aggregations = this.getAggregations();

    if (format === 'json') {
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        aggregations,
        stats: this.getLogStats(24),
      }, null, 2);
    } else {
      // CSV export implementation
      const headers = ['timestamp', 'component', 'level', 'count', 'uniqueMessages', 'uniqueOperations'];
      const rows = aggregations?.map(agg => [
        agg?.lastSeen?.toISOString(),
        agg.component,
        agg.level,
        agg.count,
        agg?.uniqueMessages?.size,
        agg?.uniqueOperations?.size,
      ]);

      return [headers.join(','), ...rows?.map(row => row.join(','))].join('\n');
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.flushBuffer();
    clearInterval(this.bufferFlushInterval);
    
    // Wait for Winston to finish writing
    await new Promise<void>((resolve) => {
      this?.winston?.on('finish', resolve);
      this?.winston?.end();
    });
  }
}

// Singleton instance
export const structuredLogger = new StructuredLogger();

// Graceful shutdown
process.on('SIGINT', async () => {
  await structuredLogger.shutdown();
});

process.on('SIGTERM', async () => {
  await structuredLogger.shutdown();
});