/**
 * Comprehensive logging system for CrewAI Team
 * Environment-aware implementation that works in Node.js, browser, and test environments
 */

// Environment detection
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const isBrowser = typeof window !== 'undefined';
const isTest = process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true';

// Dynamic module loading with fallbacks
let fs: any = null;
let path: any = null;

// Try to load Node.js modules if available
if (isNode && !isBrowser) {
  try {
    // Use require for synchronous loading in Node.js environments
    fs = require("fs").promises;
    path = require("path");
  } catch (error) {
    // Modules not available, will use console-only logging
    fs = null;
    path = null;
  }
}

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
  private logDir: string;
  private logLevel: LogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;
  private logQueue: LogEntry[] = [];
  private isWriting: boolean = false;

  private constructor() {
    // Handle different environments gracefully
    if (isNode && path && typeof process?.cwd === 'function') {
      try {
        this.logDir = path.join(process.cwd(), "data", "logs");
      } catch (error) {
        this.logDir = "/tmp/logs"; // Fallback if path.join fails
      }
    } else {
      this.logDir = "/tmp/logs"; // Fallback for non-Node environments
    }
    
    this.logLevel =
      process.env?.["LOG_LEVEL"] === "debug" ? LogLevel.DEBUG : LogLevel.INFO;
    this.enableConsole = process.env?.["NODE_ENV"] !== "production";
    this.enableFile = !isBrowser && !isTest && fs !== null; // Only enable in Node.js with fs available

    if (this.enableFile) {
      this.ensureLogDirectory();
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async ensureLogDirectory(): Promise<void> {
    if (!fs || !this.enableFile) return;
    
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create log directory:", error);
      // Disable file logging if directory creation fails
      this.enableFile = false;
    }
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
        return "\x1b[36m"; // Cyan
      case LogLevel.INFO:
        return "\x1b[32m"; // Green
      case LogLevel.WARN:
        return "\x1b[33m"; // Yellow
      case LogLevel.ERROR:
        return "\x1b[31m"; // Red
      case LogLevel.FATAL:
        return "\x1b[35m"; // Magenta
      default:
        return "\x1b[0m";
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.enableFile || !fs || !path) return;

    try {
      const logFileName = this.getLogFileName(entry.level);
      const logPath = path.join(this.logDir, logFileName);
      const formatted = this.formatLogEntry(entry) + "\n";
      await fs.appendFile(logPath, formatted);
    } catch (error) {
      console.error("Failed to write to log file:", error);
      // Disable file logging on persistent errors
      this.enableFile = false;
    }
  }

  private getLogFileName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return "debug.log";
      case LogLevel.INFO:
        return "app.log";
      case LogLevel.WARN:
        return "app.log";
      case LogLevel.ERROR:
        return "error.log";
      case LogLevel.FATAL:
        return "error.log";
      default:
        return "app.log";
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.enableConsole) return;

    const color = this.getLogColor(entry.level);
    const reset = "\x1b[0m";
    const formatted = this.formatLogEntry(entry);

    console.log(`${color}${formatted}${reset}`);
  }

  private async processLogQueue(): Promise<void> {
    if (this.isWriting || this.logQueue.length === 0) return;

    this.isWriting = true;

    const batch = this.logQueue.splice(0, 100); // Process in batches

    for (const entry of batch) {
      await this.writeToFile(entry);
    }

    this.isWriting = false;

    // Process remaining queue
    if (this.logQueue.length > 0) {
      setImmediate(() => this.processLogQueue());
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

    // Only queue for file writing if file logging is enabled
    if (this.enableFile) {
      this.logQueue.push(entry);
      this.processLogQueue();
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

  // Specialized logging methods
  agentActivity(
    agentType: string,
    action: string,
    metadata?: Record<string, any>,
  ): void {
    this.info(`Agent ${agentType}: ${action}`, "AGENT", metadata);
  }

  systemHealth(
    component: string,
    status: "healthy" | "degraded" | "unhealthy",
    message?: string,
  ): void {
    const level =
      status === "healthy"
        ? LogLevel.INFO
        : status === "degraded"
          ? LogLevel.WARN
          : LogLevel.ERROR;
    this.log(
      level,
      `System health: ${component} is ${status}${message ? ` - ${message}` : ""}`,
      "HEALTH",
    );
  }

  llmCall(
    model: string,
    prompt: string,
    response: string,
    metadata?: Record<string, any>,
  ): void {
    this.debug(`LLM Call: ${model}`, "LLM", {
      prompt: prompt.substring(0, 200),
      response: response.substring(0, 200),
      ...metadata,
    });
  }

  ragQuery(
    query: string,
    resultsCount: number,
    metadata?: Record<string, any>,
  ): void {
    this.debug(`RAG Query: ${query}`, "RAG", {
      resultsCount,
      ...metadata,
    });
  }

  toolExecution(
    toolName: string,
    parameters: any,
    result: any,
    duration: number,
  ): void {
    this.info(`Tool executed: ${toolName}`, "TOOL", {
      parameters,
      success: result.success,
      duration: `${duration}ms`,
    });
  }

  async flush(): Promise<void> {
    while (this.logQueue.length > 0 || this.isWriting) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

// Global logger instance
export const logger = Logger.getInstance();

// Error handling middleware
export function createErrorHandler(component: string) {
  return (error: Error, context?: Record<string, any>) => {
    logger.error(`Unhandled error in ${component}`, component, context, error);

    // In production, you might want to send to external monitoring service
    if (process.env?.["NODE_ENV"] === "production") {
      // Send to Sentry, DataDog, etc.
    }
  };
}

// Performance monitoring
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
          if (duration > 10000) {
            // 10 seconds
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

// Async error wrapper
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