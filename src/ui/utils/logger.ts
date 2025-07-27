/**
 * Browser-safe logging system for UI components
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  context?: Record<string, any>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
}

class BrowserLogger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep only last 1000 logs in memory

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableRemote: false,
      ...config
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatMessage(level: LogLevel, message: string, component?: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const componentStr = component ? ` [${component}]` : '';
    return `${timestamp} ${levelStr}${componentStr} ${message}`;
  }

  private log(level: LogLevel, message: string, component?: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      context,
      error
    };

    // Add to memory (with rotation)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console logging
    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(level, message, component);
      const logData = [formattedMessage];
      
      if (context) {
        logData.push(context);
      }
      if (error) {
        logData.push(error);
      }

      switch (level) {
        case LogLevel.DEBUG:
          console.debug(...logData);
          break;
        case LogLevel.INFO:
          console.info(...logData);
          break;
        case LogLevel.WARN:
          console.warn(...logData);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(...logData);
          break;
      }
    }

    // Remote logging (if enabled)
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.sendToRemote(entry).catch(err => {
        console.warn('Failed to send log to remote endpoint:', err);
      });
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      // Silently fail for remote logging to avoid logging loops
    }
  }

  debug(message: string, component?: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, component, context);
  }

  info(message: string, component?: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, component, context);
  }

  warn(message: string, component?: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, component, context);
  }

  error(message: string, component?: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, component, context, error);
  }

  fatal(message: string, component?: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.FATAL, message, component, context, error);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }
}

// Create default logger instance
export const logger = new BrowserLogger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableRemote: false
});

// Export class for custom instances
export { BrowserLogger };

// Performance monitoring helper (browser version)
export function createPerformanceMonitor(component: string) {
  return {
    start(operation: string) {
      const startTime = performance.now();
      logger.debug(`Starting ${operation}`, component);
      
      return {
        end(metadata?: Record<string, any>) {
          const duration = performance.now() - startTime;
          logger.info(`Completed ${operation}`, component, {
            duration: `${duration.toFixed(2)}ms`,
            ...metadata
          });
        }
      };
    }
  };
}