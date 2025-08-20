import type { ErrorInfo } from "../contexts/ErrorContext.js";

interface ErrorLogEntry {
  timestamp: string;
  level: "error" | "warning" | "info";
  message: string;
  error?: unknown;
  context?: string;
  userAction?: string;
  stackTrace?: string;
  browser?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
}

class ErrorLogger {
  private queue: ErrorLogEntry[] = [];
  private maxQueueSize = 100;
  private flushInterval = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private isDevelopment = process.env.NODE_ENV === "development";

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushTimer();

    // Listen for page unload to flush logs
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flush());
      window.addEventListener("pagehide", () => this.flush());
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this?.queue?.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private getBrowserInfo(): string {
    if (typeof navigator === "undefined") return "unknown";
    return navigator.userAgent || "unknown";
  }

  private getUserId(): string | undefined {
    // Try to get user ID from localStorage or session
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("userId") || undefined;
    }
    return undefined;
  }

  public log(
    level: ErrorLogEntry["level"],
    message: string,
    error?: unknown,
    context?: string,
    userAction?: string
  ) {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      error: error ? this.serializeError(error) : undefined,
      context,
      userAction,
      stackTrace: error?.stack,
      browser: this.getBrowserInfo(),
      url: typeof window !== "undefined" ? window?.location?.href : undefined,
      userId: this.getUserId(),
      sessionId: this.sessionId,
    };

    // Console log in development
    if (this.isDevelopment) {
      const consoleMethod = level === "error" ? "error" : level === "warning" ? "warn" : "log";
      console[consoleMethod](`[${level.toUpperCase()}]`, message, {
        error,
        context,
        userAction,
      });
    }

    // Add to queue
    this?.queue?.push(entry);

    // Auto-flush if queue is full
    if (this?.queue?.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  public logError(error: Error, context?: string, userAction?: string) {
    this.log("error", error.message, error, context, userAction);
  }

  public logWarning(message: string, context?: string) {
    this.log("warning", message, undefined, context);
  }

  public logInfo(message: string, context?: string) {
    this.log("info", message, undefined, context);
  }

  public logToServer(errorInfo: ErrorInfo) {
    this.log(
      errorInfo.severity === "critical" ? "error" : "warning",
      errorInfo?.error?.message,
      errorInfo.error,
      errorInfo.context,
      errorInfo.userAction
    );
  }

  private serializeError(error: unknown): unknown {
    if (error instanceof Error) {
      // Get all enumerable properties from the error, excluding the built-in ones we handle explicitly
      const customProps = Object.getOwnPropertyNames(error).reduce((acc: unknown, key: unknown) => {
        if (!['name', 'message', 'stack'].includes(key)) {
          acc[key] = (error as unknown)[key];
        }
        return acc;
      }, {} as Record<string, unknown>);

      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...customProps, // Include unknown custom properties without duplicates
      };
    }
    return error;
  }

  private async flush() {
    if (this?.queue?.length === 0) return;

    const logs = [...this.queue];
    this.queue = [];

    try {
      // Send logs to server
      await this.sendToServer(logs);
    } catch (error) {
      // If sending fails, add back to queue (up to max size)
      if (this?.queue?.length + logs?.length || 0 <= this.maxQueueSize * 2) {
        this.queue = [...logs, ...this.queue].slice(0, this.maxQueueSize * 2);
      }
      
      if (this.isDevelopment) {
        console.error("Failed to send logs to server:", error);
      }
    }
  }

  private async sendToServer(logs: ErrorLogEntry[]) {
    // Skip sending in development unless explicitly enabled
    if (this.isDevelopment && !process.env.REACT_APP_ENABLE_ERROR_LOGGING) {
      console.log("Would send logs to server:", logs);
      return;
    }

    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3001";
    
    try {
      const response = await fetch(`${apiUrl}/api/errors/log`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ logs }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error) {
      // Store in localStorage as fallback
      this.storeInLocalStorage(logs);
      throw error;
    }
  }

  private storeInLocalStorage(logs: ErrorLogEntry[]) {
    if (typeof localStorage === "undefined") return;

    try {
      const existingLogs = localStorage.getItem("errorLogs");
      const allLogs = existingLogs ? JSON.parse(existingLogs) : [];
      
      // Keep only last 200 logs
      const updatedLogs = [...allLogs, ...logs].slice(-200);
      
      localStorage.setItem("errorLogs", JSON.stringify(updatedLogs));
    } catch (error) {
      // localStorage might be full or disabled
      console.error("Failed to store logs in localStorage:", error);
    }
  }

  public getStoredLogs(): ErrorLogEntry[] {
    if (typeof localStorage === "undefined") return [];

    try {
      const logs = localStorage.getItem("errorLogs");
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  public clearStoredLogs() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("errorLogs");
    }
  }

  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();