/**
 * Unified Error Handler Implementation
 * Production-ready error handling system with comprehensive features
 */

import type {
  BaseError,
  ApiError,
  ValidationError,
  BusinessError,
  SystemError,
  ErrorContext,
  ErrorHandler,
  ErrorResult,
  RetryStrategy,
  CircuitBreakerConfig,
  ErrorReport,
  ErrorMetrics,
  ErrorAlert,
  AlertRule,
  ErrorNotification,
  NotificationChannel,
  RecoveryAction,
  RecoveryResult,
  ErrorCode,
  ErrorCategory,
  Timestamp,
} from "../types/errors.js";
import { ERROR_CODES } from "../types/errors.js";

// =====================================================
// Custom Error Classes
// =====================================================

export class CrewAIError extends Error implements BaseError {
  public code: string;
  public timestamp: Timestamp;
  public requestId?: string;
  public userId?: string;
  public details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    requestId?: string,
    userId?: string,
  ) {
    super(message);
    this.name = "CrewAIError";
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.details = details;
    this.requestId = requestId;
    this.userId = userId;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CrewAIError);
    }
  }

  toJSON(): BaseError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
      userId: this.userId,
      stack: this.stack,
    };
  }
}

export class CrewAIApiError extends CrewAIError implements ApiError {
  public httpStatus: number;
  public path?: string;
  public method?: string;
  public userAgent?: string;
  public ipAddress?: string;
  public correlationId?: string;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    details?: Record<string, unknown>,
    requestId?: string,
    userId?: string,
  ) {
    super(code, message, details, requestId, userId);
    this.name = "CrewAIApiError";
    this.httpStatus = httpStatus;
  }
}

export class CrewAIValidationError
  extends CrewAIError
  implements ValidationError
{
  public field: string;
  public value?: unknown;
  public constraint: string;
  public children?: ValidationError[];

  constructor(
    field: string,
    value: unknown,
    constraint: string,
    message?: string,
    children?: ValidationError[],
  ) {
    super(
      ERROR_CODES.INVALID_INPUT,
      message || `Validation failed for field "${field}": ${constraint}`,
      { field, value, constraint },
    );
    this.name = "CrewAIValidationError";
    this.field = field;
    this.value = value;
    this.constraint = constraint;
    this.children = children;
  }
}

export class CrewAIBusinessError extends CrewAIError implements BusinessError {
  public domain: string;
  public operation: string;
  public recoverable: boolean;
  public suggestedAction?: string;
  public context?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    domain: string,
    operation: string,
    recoverable: boolean = true,
    context?: Record<string, unknown>,
    suggestedAction?: string,
  ) {
    super(code, message, { domain, operation, recoverable, context });
    this.name = "CrewAIBusinessError";
    this.domain = domain;
    this.operation = operation;
    this.recoverable = recoverable;
    this.context = context;
    this.suggestedAction = suggestedAction;
  }
}

export class CrewAISystemError extends CrewAIError implements SystemError {
  public service: string;
  public component: string;
  public severity: "low" | "medium" | "high" | "critical";
  public impact: "none" | "limited" | "significant" | "severe";
  public resolution?: any;

  constructor(
    code: string,
    message: string,
    service: string,
    component: string,
    severity: "low" | "medium" | "high" | "critical" = "medium",
    impact: "none" | "limited" | "significant" | "severe" = "limited",
  ) {
    super(code, message, { service, component, severity, impact });
    this.name = "CrewAISystemError";
    this.service = service;
    this.component = component;
    this.severity = severity;
    this.impact = impact;
  }
}

// =====================================================
// Error Handler Registry
// =====================================================

export class ErrorHandlerRegistry {
  private handlers: Map<string, ErrorHandler> = new Map();
  private globalHandlers: ErrorHandler[] = [];
  private metrics: ErrorMetrics;
  private reports: Map<string, ErrorReport> = new Map();

  constructor() {
    this.metrics = {
      totalErrors: 0,
      errorRate: 0,
      errorsByCode: {},
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsByService: {},
      averageResolutionTime: 0,
      topErrors: [],
      trends: [],
    };
  }

  registerHandler(handler: ErrorHandler): void {
    this.handlers.set(handler.name, handler);

    // Sort global handlers by priority
    this.globalHandlers = Array.from(this.handlers.values()).sort(
      (a, b) => b.priority - a.priority,
    );
  }

  unregisterHandler(name: string): void {
    this.handlers.delete(name);
    this.globalHandlers = Array.from(this.handlers.values()).sort(
      (a, b) => b.priority - a.priority,
    );
  }

  async handleError(
    error: BaseError,
    context: ErrorContext,
  ): Promise<ErrorResult> {
    const startTime = Date.now();

    // Update metrics
    this.updateMetrics(error);

    // Create or update error report
    this.updateErrorReport(error, context);

    // Try to handle the error with registered handlers
    for (const handler of this.globalHandlers) {
      if (handler.canHandle(error)) {
        try {
          const result = await handler.handle(error, context);

          if (result.handled) {
            // Update resolution time metrics
            const resolutionTime = Date.now() - startTime;
            this.updateResolutionTime(resolutionTime);

            return result;
          }
        } catch (handlerError) {
          console.error(
            `Error handler "${handler.name}" failed:`,
            handlerError,
          );
          // Continue to next handler
        }
      }
    }

    // If no handler could handle the error, return default result
    return {
      handled: false,
      escalate: true,
      log: true,
      notify: this.shouldNotify(error),
    };
  }

  private updateMetrics(error: BaseError): void {
    this.metrics.totalErrors++;

    // Update error counts by code
    if (!this.metrics.errorsByCode[error.code]) {
      this.metrics.errorsByCode[error.code] = 0;
    }
    this.metrics.errorsByCode[error.code] =
      (this.metrics.errorsByCode[error.code] || 0) + 1;

    // Update error counts by category
    const category = this.categorizeError(error);
    if (!this.metrics.errorsByCategory[category]) {
      this.metrics.errorsByCategory[category] = 0;
    }
    this.metrics.errorsByCategory[category]++;
  }

  private updateErrorReport(error: BaseError, context: ErrorContext): void {
    const fingerprint = this.generateFingerprint(error);
    const existingReport = this.reports.get(fingerprint);

    if (existingReport) {
      existingReport.frequency++;
      existingReport.lastOccurrence = new Date().toISOString();
      existingReport.affectedUsers = context.userId
        ? existingReport.affectedUsers + 1
        : existingReport.affectedUsers;
    } else {
      const newReport: ErrorReport = {
        id: `error-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        error,
        context,
        environment: process.env.NODE_ENV || "unknown",
        version: process.env.npm_package_version || "unknown",
        frequency: 1,
        firstOccurrence: new Date().toISOString(),
        lastOccurrence: new Date().toISOString(),
        affectedUsers: context.userId ? 1 : 0,
        severity: this.determineSeverity(error),
        status: "new",
      };

      this.reports.set(fingerprint, newReport);
    }
  }

  private generateFingerprint(error: BaseError): string {
    // Generate a unique fingerprint based on error characteristics
    const parts = [
      error.code,
      error.message,
      error.stack?.split("\n")[0] || "",
    ];

    return parts.join("|");
  }

  private categorizeError(error: BaseError): ErrorCategory {
    // Categorize error based on code prefix or type
    if (error.code.startsWith("1001") || error.code.startsWith("1002"))
      return "authentication";
    if (error.code.startsWith("1100")) return "authorization";
    if (error.code.startsWith("1200")) return "validation";
    if (error.code.startsWith("1300")) return "business";
    if (error.code.startsWith("1400")) return "system";
    if (error.code.startsWith("1500")) return "network";
    if (error.code.startsWith("1600")) return "database";
    if (error.code.startsWith("1700")) return "external_service";
    if (error.code.startsWith("1800")) return "rate_limit";
    if (error.code.startsWith("1900")) return "resource";
    if (error.code.startsWith("2000")) return "security";

    return "system"; // Default category
  }

  private determineSeverity(
    error: BaseError,
  ): "low" | "medium" | "high" | "critical" {
    if (error instanceof CrewAISystemError) {
      return error.severity;
    }

    // Determine severity based on error code
    if (error.code.startsWith("2000")) return "critical"; // Security errors
    if (error.code.startsWith("1400")) return "high"; // System errors
    if (error.code.startsWith("1600")) return "high"; // Database errors
    if (error.code.startsWith("1300")) return "medium"; // Business errors
    if (error.code.startsWith("1200")) return "low"; // Validation errors

    return "medium"; // Default severity
  }

  private shouldNotify(error: BaseError): boolean {
    const severity = this.determineSeverity(error);
    return severity === "critical" || severity === "high";
  }

  private updateResolutionTime(resolutionTime: number): void {
    // Update average resolution time (simplified calculation)
    this.metrics.averageResolutionTime =
      (this.metrics.averageResolutionTime + resolutionTime) / 2;
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  getReports(): ErrorReport[] {
    return Array.from(this.reports.values());
  }

  getReport(fingerprint: string): ErrorReport | undefined {
    return this.reports.get(fingerprint);
  }
}

// =====================================================
// Circuit Breaker Implementation
// =====================================================

export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures: number = 0;
  private lastFailureTime?: number;
  private successCount: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (this.shouldAttemptReset()) {
        this.state = "half-open";
        this.successCount = 0;
      } else {
        throw new CrewAISystemError(
          ERROR_CODES.SERVICE_UNAVAILABLE,
          "Circuit breaker is open",
          "circuit-breaker",
          "execute",
        );
      }
    }

    try {
      const result = await operation();

      if (this.state === "half-open") {
        this.successCount++;
        if (this.successCount >= 3) {
          // Reset after 3 successful calls
          this.reset();
        }
      } else {
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime > this.config.resetTimeoutMs;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
    }
  }

  private reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }

  getState(): string {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

// =====================================================
// Retry Handler Implementation
// =====================================================

export class RetryHandler {
  constructor(private strategy: RetryStrategy) {}

  async execute<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < this.strategy.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        const baseError: BaseError = {
          code: "OPERATION_FAILED",
          message: errorMessage,
          timestamp: new Date().toISOString(),
          stack: errorStack,
          ...context,
        };

        if (!this.strategy.retryCondition(baseError, attempt)) {
          throw error;
        }

        if (attempt < this.strategy.maxAttempts - 1) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private calculateDelay(attempt: number): number {
    let delay =
      this.strategy.initialDelayMs *
      Math.pow(this.strategy.backoffMultiplier, attempt);
    delay = Math.min(delay, this.strategy.maxDelayMs);

    if (this.strategy.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5); // Add jitter (50-100% of calculated delay)
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =====================================================
// Default Error Handlers
// =====================================================

export const defaultErrorHandlers: ErrorHandler[] = [
  // Authentication Error Handler
  {
    name: "authentication-handler",
    priority: 100,
    canHandle: (error: BaseError) =>
      error.code === ERROR_CODES.EXPIRED_TOKEN ||
      error.code === ERROR_CODES.INVALID_TOKEN ||
      error.code === ERROR_CODES.TOKEN_REQUIRED,
    handle: async (
      error: BaseError,
      context: ErrorContext,
    ): Promise<ErrorResult> => {
      return {
        handled: true,
        retry: false,
        escalate: false,
        notify: false,
        log: true,
        metadata: { action: "redirect_to_login" },
      };
    },
  },

  // Validation Error Handler
  {
    name: "validation-handler",
    priority: 80,
    canHandle: (error: BaseError) => error.code.startsWith("1200"), // Validation error codes
    handle: async (
      error: BaseError,
      context: ErrorContext,
    ): Promise<ErrorResult> => {
      return {
        handled: true,
        retry: false,
        escalate: false,
        notify: false,
        log: false,
        metadata: { action: "return_validation_errors" },
      };
    },
  },

  // Rate Limit Error Handler
  {
    name: "rate-limit-handler",
    priority: 90,
    canHandle: (error: BaseError) =>
      error.code === ERROR_CODES.RATE_LIMIT_EXCEEDED ||
      error.code === ERROR_CODES.TOO_MANY_REQUESTS,
    handle: async (
      error: BaseError,
      context: ErrorContext,
    ): Promise<ErrorResult> => {
      return {
        handled: true,
        retry: true,
        retryAfter: 60000, // Retry after 1 minute
        escalate: false,
        notify: false,
        log: true,
        metadata: { action: "rate_limited_retry" },
      };
    },
  },

  // Network Error Handler
  {
    name: "network-handler",
    priority: 85,
    canHandle: (error: BaseError) => error.code.startsWith("1500"), // Network error codes
    handle: async (
      error: BaseError,
      context: ErrorContext,
    ): Promise<ErrorResult> => {
      return {
        handled: true,
        retry: true,
        retryAfter: 5000, // Retry after 5 seconds
        escalate: false,
        notify: false,
        log: true,
        metadata: { action: "network_retry" },
      };
    },
  },

  // System Error Handler
  {
    name: "system-handler",
    priority: 70,
    canHandle: (error: BaseError) => error.code.startsWith("1400"), // System error codes
    handle: async (
      error: BaseError,
      context: ErrorContext,
    ): Promise<ErrorResult> => {
      return {
        handled: true,
        retry: false,
        escalate: true,
        notify: true,
        log: true,
        metadata: {
          action: "system_error_escalation",
          severity: "high",
        },
      };
    },
  },
];

// =====================================================
// Global Error Handler Instance
// =====================================================

export const globalErrorHandler = new ErrorHandlerRegistry();

// Register default handlers
defaultErrorHandlers.forEach((handler) => {
  globalErrorHandler.registerHandler(handler);
});

// Default retry strategy
export const defaultRetryStrategy: RetryStrategy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error: BaseError, attempt: number) => {
    // Don't retry validation or authentication errors
    if (error.code.startsWith("1200") || error.code.startsWith("1001")) {
      return false;
    }

    // Don't retry after 3 attempts
    if (attempt >= 2) {
      return false;
    }

    return true;
  },
};

// Default circuit breaker config
export const defaultCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  monitoringPeriodMs: 30000, // 30 seconds
  expectedSuccessRate: 0.8, // 80%
  slowRequestThreshold: 5000, // 5 seconds
};

// Export utility functions
export function createApiError(
  code: string,
  message: string,
  httpStatus: number,
  details?: Record<string, unknown>,
): CrewAIApiError {
  return new CrewAIApiError(code, message, httpStatus, details);
}

export function createValidationError(
  field: string,
  value: unknown,
  constraint: string,
  message?: string,
): CrewAIValidationError {
  return new CrewAIValidationError(field, value, constraint, message);
}

export function createBusinessError(
  code: string,
  message: string,
  domain: string,
  operation: string,
  recoverable: boolean = true,
): CrewAIBusinessError {
  return new CrewAIBusinessError(code, message, domain, operation, recoverable);
}

export function createSystemError(
  code: string,
  message: string,
  service: string,
  component: string,
  severity: "low" | "medium" | "high" | "critical" = "medium",
): CrewAISystemError {
  return new CrewAISystemError(code, message, service, component, severity);
}
