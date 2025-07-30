/**
 * Browser-compatible error handling utilities for UI components
 * This module provides error handling without Node.js dependencies
 */

import { logger } from "./logger";

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  isOperational?: boolean;
  timestamp?: string;
  details?: Record<string, any>;
}

export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  CSRF_ERROR = "CSRF_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
}

/**
 * Create an application error with additional metadata
 */
export function createAppError(
  message: string,
  code: ErrorCode = ErrorCode.INTERNAL_ERROR,
  statusCode: number = 500,
  details?: Record<string, any>,
): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.statusCode = statusCode;
  error.isOperational = true;
  error.timestamp = new Date().toISOString();
  error.details = details;
  return error;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error: Error): string {
  if (error instanceof Error && "code" in error) {
    const appError = error as AppError;
    switch (appError.code) {
      case ErrorCode.VALIDATION_ERROR:
        return "Please check your input and try again.";
      case ErrorCode.NETWORK_ERROR:
        return "Network connection failed. Please check your internet connection.";
      case ErrorCode.AUTHENTICATION_ERROR:
        return "Please log in to continue.";
      case ErrorCode.AUTHORIZATION_ERROR:
        return "You do not have permission to perform this action.";
      case ErrorCode.RESOURCE_NOT_FOUND:
        return "The requested resource was not found.";
      case ErrorCode.CSRF_ERROR:
        return "Security token expired. Please refresh the page.";
      case ErrorCode.RATE_LIMIT_ERROR:
        return "Too many requests. Please wait and try again.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Global error handler for unhandled errors in the browser
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught JavaScript errors
  window.addEventListener("error", (event: ErrorEvent) => {
    logger.error("Global JavaScript Error", "GLOBAL_ERROR_HANDLER", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      logger.error("Unhandled Promise Rejection", "GLOBAL_ERROR_HANDLER", {
        reason: event.reason,
        timestamp: new Date().toISOString(),
      });

      // Prevent the default behavior (logging to console)
      event.preventDefault();
    },
  );

  // Handle React error boundary fallbacks
  window.addEventListener("react-error", (event: Event) => {
    const customEvent = event as CustomEvent;
    logger.error("React Error Boundary", "GLOBAL_ERROR_HANDLER", {
      error: customEvent.detail?.error,
      errorInfo: customEvent.detail?.errorInfo,
      timestamp: new Date().toISOString(),
    });
  });

  logger.info("Global error handlers initialized", "GLOBAL_ERROR_HANDLER");
}

/**
 * Determines if an error is operational (expected) or programmer error
 */
export function isOperationalError(error: Error): boolean {
  if ("isOperational" in error) {
    return (error as AppError).isOperational === true;
  }
  return false;
}

/**
 * Sanitizes error for logging (removes sensitive data)
 */
export function sanitizeError(error: Error): any {
  const sanitized: any = {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  };

  if ("code" in error) {
    const appError = error as AppError;
    sanitized.code = appError.code;
    sanitized.statusCode = appError.statusCode;

    // Sanitize details - remove sensitive fields
    if (appError.details) {
      const sensitiveFields = [
        "password",
        "token",
        "apiKey",
        "secret",
        "authorization",
        "cookie",
      ];
      sanitized.details = Object.keys(appError.details).reduce((acc, key) => {
        if (
          sensitiveFields.some((field) => key.toLowerCase().includes(field))
        ) {
          acc[key] = "[REDACTED]";
        } else {
          acc[key] = appError.details![key];
        }
        return acc;
      }, {} as any);
    }
  }

  return sanitized;
}

/**
 * Async error wrapper for React components
 */
export function asyncErrorWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler?: (error: Error) => void,
): T {
  return ((...args: Parameters<T>) => {
    return fn(...args).catch((error: Error) => {
      const sanitizedError = sanitizeError(error);
      logger.error(
        `Async error in ${fn.name || "anonymous function"}`,
        "ASYNC_ERROR_WRAPPER",
        sanitizedError,
      );

      if (errorHandler) {
        errorHandler(error);
      } else {
        // Re-throw if no custom handler
        throw error;
      }
    });
  }) as T;
}

/**
 * Wraps a function to catch synchronous errors
 */
export function tryCatch<T extends (...args: any[]) => any>(
  fn: T,
  errorHandler?: (error: Error) => void,
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const sanitizedError = sanitizeError(err);

      logger.error(
        `Sync error in ${fn.name || "anonymous function"}`,
        "TRY_CATCH",
        sanitizedError,
      );

      if (errorHandler) {
        errorHandler(err);
      } else {
        throw err;
      }
    }
  }) as T;
}

/**
 * Error recovery utilities for UI components
 */
export const errorRecovery = {
  /**
   * Retry a function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          logger.error(
            `Max retries (${maxRetries}) exceeded`,
            "ERROR_RECOVERY",
            {
              error: sanitizeError(lastError),
              attempts: attempt + 1,
            },
          );
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(
          `Retry attempt ${attempt + 1}/${maxRetries + 1} in ${delay}ms`,
          "ERROR_RECOVERY",
          {
            error: lastError.message,
          },
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  },

  /**
   * Circuit breaker pattern for repeated failures
   */
  createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    failureThreshold: number = 5,
    resetTimeout: number = 60000,
  ): T {
    let failures = 0;
    let lastFailureTime = 0;
    let state: "closed" | "open" | "half-open" = "closed";

    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const now = Date.now();

      // Reset circuit breaker if enough time has passed
      if (state === "open" && now - lastFailureTime > resetTimeout) {
        state = "half-open";
        failures = 0;
        logger.info("Circuit breaker reset to half-open", "ERROR_RECOVERY");
      }

      // Fail fast if circuit is open
      if (state === "open") {
        throw createAppError(
          "Circuit breaker is open. Service temporarily unavailable.",
          ErrorCode.INTERNAL_ERROR,
          503,
        );
      }

      try {
        const result = await fn(...args);

        // Success - reset circuit breaker
        if (state === "half-open") {
          state = "closed";
          failures = 0;
          logger.info("Circuit breaker closed", "ERROR_RECOVERY");
        }

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= failureThreshold) {
          state = "open";
          logger.error(
            `Circuit breaker opened after ${failures} failures`,
            "ERROR_RECOVERY",
            {
              error: error instanceof Error ? sanitizeError(error) : error,
            },
          );
        }

        throw error;
      }
    }) as T;
  },
};

/**
 * Performance monitoring utilities
 */
export const performance = {
  /**
   * Measure function execution time
   */
  measure<T extends (...args: any[]) => any>(fn: T, name?: string): T {
    return ((...args: Parameters<T>) => {
      const start = Date.now();
      const result = fn(...args);
      const duration = Date.now() - start;

      logger.debug(
        `Function ${name || fn.name} took ${duration}ms`,
        "PERFORMANCE",
      );

      return result;
    }) as T;
  },

  /**
   * Measure async function execution time
   */
  measureAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name?: string,
  ): T {
    return (async (...args: Parameters<T>) => {
      const start = Date.now();
      const result = await fn(...args);
      const duration = Date.now() - start;

      logger.debug(
        `Async function ${name || fn.name} took ${duration}ms`,
        "PERFORMANCE",
      );

      return result;
    }) as T;
  },
};
