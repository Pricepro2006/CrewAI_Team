export * from "./error-types.js";
export * from "./error-messages.js";
export * from "./async-error-wrapper.js";

// Type declarations for browser globals when in server context
// These are already declared in logger.ts, so we don't redeclare them here

import { AppError, ErrorCode } from "./error-types.js";
import { getUserFriendlyError } from "./error-messages.js";

// Use browser-compatible logger for client-side code
let logger: any;
if (typeof window !== "undefined") {
  // Browser environment - use console as logger
  logger = {
    error: (
      message: string,
      component?: string,
      metadata?: any,
      error?: Error,
    ) => {
      console.error(`[${component || "ERROR"}] ${message}`, metadata, error);
    },
    warn: (message: string, component?: string, metadata?: any) => {
      console.warn(`[${component || "WARN"}] ${message}`, metadata);
    },
    info: (message: string, component?: string, metadata?: any) => {
      console.info(`[${component || "INFO"}] ${message}`, metadata);
    },
    debug: (message: string, component?: string, metadata?: any) => {
      console.debug(`[${component || "DEBUG"}] ${message}`, metadata);
    },
  };
} else {
  // Server environment - use the full logger
  import("../logger.js").then(loggerModule => {
    logger = loggerModule.logger;
  });
}

/**
 * Global error handler for unhandled errors
 */
export function setupGlobalErrorHandlers(): void {
  if (typeof process !== "undefined" && process.on) {
    process.on("uncaughtException", (error: Error) => {
      logger.error(
        "Uncaught Exception",
        "GLOBAL_ERROR_HANDLER",
        undefined,
        error,
      );
      // Give the logger time to write before exiting
      setTimeout(() => process.exit(1), 1000);
    });

    process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
      logger.error("Unhandled Rejection", "GLOBAL_ERROR_HANDLER", {
        reason,
        promise,
      });
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("error", (event: ErrorEvent) => {
      logger.error("Window Error", "GLOBAL_ERROR_HANDLER", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    });

    window.addEventListener(
      "unhandledrejection",
      (event: PromiseRejectionEvent) => {
        logger.error("Unhandled Promise Rejection", "GLOBAL_ERROR_HANDLER", {
          reason: event.reason,
        });
      },
    );
  }
}

/**
 * Determines if an error is operational (expected) or programmer error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
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
  };

  if (error instanceof AppError) {
    sanitized.code = error.code;
    sanitized.statusCode = error.statusCode;
    sanitized.timestamp = error.timestamp;

    // Sanitize details - remove sensitive fields
    if (error.details) {
      const sensitiveFields = [
        "password",
        "token",
        "apiKey",
        "secret",
        "authorization",
      ];
      sanitized.details = Object.keys(error.details).reduce((acc, key) => {
        if (
          sensitiveFields.some((field) => key.toLowerCase().includes(field))
        ) {
          acc[key] = "[REDACTED]";
        } else {
          acc[key] = error.details[key];
        }
        return acc;
      }, {} as any);
    }
  }

  return sanitized;
}

/**
 * Wraps a function to catch synchronous errors
 */
export function tryCatch<T extends (...args: unknown[]) => unknown>(
  fn: T,
  errorHandler?: (error: Error) => void,
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (errorHandler) {
        errorHandler(err);
        throw err;
      } else {
        logger.error(
          `Error in ${fn.name || "anonymous function"}`,
          "TRY_CATCH",
          undefined,
          err,
        );
        throw err;
      }
    }
  }) as T;
}
