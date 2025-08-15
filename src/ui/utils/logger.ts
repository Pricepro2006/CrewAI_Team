/**
 * Browser-compatible logger for UI components
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  metadata?: Record<string, any>;
  stack?: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private enableConsole: boolean;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  private constructor() {
    this.logLevel =
      process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO;
    this.enableConsole = true;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelName = LogLevel[entry.level].padEnd(5);
    const component = entry.component ? `[${entry.component}]` : "";
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : "";

    let formatted = `${entry.timestamp} ${levelName} ${component} ${entry.message}${metadata}`;

    if (entry.stack) {
      formatted += `\n${entry.stack}`;
    }

    return formatted;
  }

  private getLogColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return "#36a3d9"; // Cyan
      case LogLevel.INFO:
        return "#4caf50"; // Green
      case LogLevel.WARN:
        return "#ff9800"; // Yellow
      case LogLevel.ERROR:
        return "#f44336"; // Red
      case LogLevel.FATAL:
        return "#9c27b0"; // Purple
      default:
        return "#000000";
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.enableConsole) return;

    const color = this.getLogColor(entry.level);
    const formatted = this.formatLogEntry(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`%c${formatted}`, `color: ${color}`);
        break;
      case LogLevel.INFO:
        console.info(`%c${formatted}`, `color: ${color}`);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  private log(
    level: LogLevel,
    message: string,
    component?: string,
    metadata?: Record<string, any>,
    error?: Error,
  ): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(component && { component }),
      ...(metadata && { metadata }),
      ...(error?.stack && { stack: error.stack }),
    };

    this.writeToConsole(entry);

    // Store in memory for retrieval
    this?.logs?.push(entry);
    if (this?.logs?.length > this.maxLogs) {
      this?.logs?.shift();
    }
  }

  debug(
    message: string,
    component?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.DEBUG, message, component, metadata);
  }

  info(
    message: string,
    component?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.INFO, message, component, metadata);
  }

  warn(
    message: string,
    component?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.WARN, message, component, metadata);
  }

  error(
    message: string,
    component?: string,
    metadata?: Record<string, any>,
    error?: Error,
  ): void {
    this.log(LogLevel.ERROR, message, component, metadata, error);
  }

  fatal(
    message: string,
    component?: string,
    metadata?: Record<string, any>,
    error?: Error,
  ): void {
    this.log(LogLevel.FATAL, message, component, metadata, error);
  }

  // Get stored logs
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this?.logs?.filter((log: any) => log.level >= level);
    }
    return [...this.logs];
  }

  // Clear stored logs
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Error handling for UI
export function createErrorHandler(component: string) {
  return (error: Error, context?: Record<string, any>) => {
    logger.error(`Unhandled error in ${component}`, component, context, error);
  };
}

// Performance monitoring for UI
export function createPerformanceMonitor(component: string) {
  return {
    start: (operation: string) => {
      const startTime = Date.now();

      return {
        end: (metadata?: Record<string, any>) => {
          const duration = Date.now() - startTime;
          logger.debug(
            `Performance: ${operation} took ${duration}ms`,
            component,
            metadata,
          );

          // Alert if operation takes too long
          if (duration > 3000) {
            // 3 seconds for UI operations
            logger.warn(
              `Slow operation detected: ${operation} took ${duration}ms`,
              component,
              metadata,
            );
          }
        },
      };
    },
  };
}

// Async error wrapper for UI
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  component: string,
  operation: string,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const errorHandler = createErrorHandler(component);
    const perf = createPerformanceMonitor(component);
    const perfMonitor = perf.start(operation);

    try {
      const result = await fn(...args);
      perfMonitor.end({ success: true });
      return result;
    } catch (error) {
      perfMonitor.end({ success: false });
      errorHandler(error as Error, { operation, args });
      throw error;
    }
  };
}
