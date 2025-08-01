import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context: {
    userId?: string;
    requestId?: string;
    endpoint?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
  };
  severity: "low" | "medium" | "high" | "critical";
  handled: boolean;
  tags?: string[];
}

export interface ErrorAggregation {
  errorType: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  samples: ErrorEvent[];
  affectedUsers: Set<string>;
  endpoints: Set<string>;
}

export class ErrorTracker extends EventEmitter {
  private errors: Map<string, ErrorEvent> = new Map();
  private aggregations: Map<string, ErrorAggregation> = new Map();
  private errorRetentionMs: number = 86400000; // 24 hours
  private maxSamplesPerType: number = 10;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startCleanupInterval();
  }

  // Track an error
  trackError(
    error: Error,
    context: ErrorEvent["context"] = {},
    severity: ErrorEvent["severity"] = "medium",
    handled: boolean = true,
    tags?: string[],
  ): string {
    const errorId = this.generateErrorId();

    const errorEvent: ErrorEvent = {
      id: errorId,
      timestamp: new Date(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
      context,
      severity,
      handled,
      tags,
    };

    // Store error
    this.errors.set(errorId, errorEvent);

    // Update aggregation
    this.updateAggregation(errorEvent);

    // Emit events
    this.emit("error", errorEvent);

    if (severity === "critical") {
      this.emit("critical-error", errorEvent);
    }

    // Log based on severity
    this.logError(errorEvent);

    return errorId;
  }

  // Get error by ID
  getError(errorId: string): ErrorEvent | undefined {
    return this.errors.get(errorId);
  }

  // Get recent errors
  getRecentErrors(limit: number = 100): ErrorEvent[] {
    const errors = Array.from(this.errors.values());
    return errors
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Get error aggregations
  getAggregations(): Record<string, any> {
    const result: Record<string, any> = {};

    this.aggregations.forEach((agg, key) => {
      result[key] = {
        count: agg.count,
        firstSeen: agg.firstSeen,
        lastSeen: agg.lastSeen,
        affectedUsers: agg.affectedUsers.size,
        endpoints: Array.from(agg.endpoints),
        samples: agg.samples.slice(0, 3).map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          message: e.error.message,
        })),
      };
    });

    return result;
  }

  // Get error statistics
  getStatistics(timeWindowMs: number = 3600000): Record<string, any> {
    const cutoff = Date.now() - timeWindowMs;
    const recentErrors = Array.from(this.errors.values()).filter(
      (e) => e.timestamp.getTime() > cutoff,
    );

    const stats = {
      total: recentErrors.length,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      byType: {} as Record<string, number>,
      handled: 0,
      unhandled: 0,
      topErrors: [] as Array<{ type: string; count: number; lastSeen: Date }>,
      errorRate: 0,
    };

    recentErrors.forEach((error) => {
      // Count by severity
      stats.bySeverity[error.severity]++;

      // Count by type
      const type = error.error.name;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count handled vs unhandled
      if (error.handled) {
        stats.handled++;
      } else {
        stats.unhandled++;
      }
    });

    // Calculate error rate (errors per minute)
    const timeWindowMinutes = timeWindowMs / 60000;
    stats.errorRate = recentErrors.length / timeWindowMinutes;

    // Get top errors
    stats.topErrors = Object.entries(stats.byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        count,
        lastSeen: this.aggregations.get(type)?.lastSeen || new Date(),
      }));

    return stats;
  }

  // Check if error rate exceeds threshold
  checkErrorRateThreshold(
    threshold: number,
    timeWindowMs: number = 300000,
  ): boolean {
    const stats = this.getStatistics(timeWindowMs);
    return stats.errorRate > threshold;
  }

  // Get errors by user
  getErrorsByUser(userId: string): ErrorEvent[] {
    return Array.from(this.errors.values())
      .filter((e) => e.context.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Get errors by endpoint
  getErrorsByEndpoint(endpoint: string): ErrorEvent[] {
    return Array.from(this.errors.values())
      .filter((e) => e.context.endpoint === endpoint)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Search errors
  searchErrors(query: {
    severity?: ErrorEvent["severity"];
    handled?: boolean;
    tags?: string[];
    startTime?: Date;
    endTime?: Date;
    errorType?: string;
  }): ErrorEvent[] {
    let results = Array.from(this.errors.values());

    if (query.severity) {
      results = results.filter((e) => e.severity === query.severity);
    }

    if (query.handled !== undefined) {
      results = results.filter((e) => e.handled === query.handled);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(
        (e) => e.tags && query.tags!.some((tag) => e.tags!.includes(tag)),
      );
    }

    if (query.startTime) {
      results = results.filter((e) => e.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      results = results.filter((e) => e.timestamp <= query.endTime!);
    }

    if (query.errorType) {
      results = results.filter((e) => e.error.name === query.errorType);
    }

    return results.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  // Clear all errors
  clearErrors(): void {
    this.errors.clear();
    this.aggregations.clear();
  }

  // Private methods
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateAggregation(errorEvent: ErrorEvent): void {
    const key = errorEvent.error.name;
    const existing = this.aggregations.get(key) || {
      errorType: key,
      count: 0,
      firstSeen: errorEvent.timestamp,
      lastSeen: errorEvent.timestamp,
      samples: [],
      affectedUsers: new Set<string>(),
      endpoints: new Set<string>(),
    };

    existing.count++;
    existing.lastSeen = errorEvent.timestamp;

    // Add sample if under limit
    if (existing.samples.length < this.maxSamplesPerType) {
      existing.samples.push(errorEvent);
    }

    // Track affected users
    if (errorEvent.context.userId) {
      existing.affectedUsers.add(errorEvent.context.userId);
    }

    // Track endpoints
    if (errorEvent.context.endpoint) {
      existing.endpoints.add(errorEvent.context.endpoint);
    }

    this.aggregations.set(key, existing);
  }

  private logError(errorEvent: ErrorEvent): void {
    const logData = {
      errorId: errorEvent.id,
      error: errorEvent.error.name,
      message: errorEvent.error.message,
      severity: errorEvent.severity,
      handled: errorEvent.handled,
      context: errorEvent.context,
      tags: errorEvent.tags,
    };

    switch (errorEvent.severity) {
      case "critical":
        logger.error("Critical error tracked", "ERROR_TRACKER", logData);
        break;
      case "high":
        logger.error("High severity error tracked", "ERROR_TRACKER", logData);
        break;
      case "medium":
        logger.warn("Medium severity error tracked", "ERROR_TRACKER", logData);
        break;
      case "low":
        logger.info("Low severity error tracked", "ERROR_TRACKER", logData);
        break;
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.errorRetentionMs;

      // Clean up old errors
      this.errors.forEach((error, id) => {
        if (error.timestamp.getTime() < cutoff) {
          this.errors.delete(id);
        }
      });

      // Clean up old aggregations
      this.aggregations.forEach((agg, key) => {
        if (agg.lastSeen.getTime() < cutoff) {
          this.aggregations.delete(key);
        } else {
          // Clean up old samples
          agg.samples = agg.samples.filter(
            (s) => s.timestamp.getTime() > cutoff,
          );
        }
      });
    }, 3600000); // Clean up every hour
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.removeAllListeners();
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker();

// Graceful shutdown
process.once("SIGINT", () => errorTracker.shutdown());
process.once("SIGTERM", () => errorTracker.shutdown());
