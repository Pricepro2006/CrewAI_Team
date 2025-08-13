export * from "./error-types.js";
export * from "./error-messages.js";
export * from "./async-error-wrapper.js";

import { AppError, ErrorCode } from "./error-types.js";
import { getUserFriendlyError } from "./error-messages.js";
import { logger } from "../logger.js";

/**
 * Global error handler for unhandled errors (server-side only)
 */
export function setupGlobalErrorHandlers(): void {
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

/**
 * Handle and log errors appropriately (server version)
 */
export function handleError(
  error: unknown,
  context: string = "Unknown",
): AppError {
  if (error instanceof AppError) {
    logger.error(error.message, context, { code: error.code }, error);
    return error;
  }

  const appError = new AppError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    error instanceof Error ? error.message : "An unknown error occurred",
    500,
    { originalError: error },
  );

  logger.error(appError.message, context, { code: appError.code }, appError);
  return appError;
}

/**
 * Create a user-friendly error response (server version)
 */
export function createErrorResponse(
  error: unknown,
  includeDetails: boolean = false,
): {
  error: string;
  code: string;
  statusCode: number;
  details?: any;
} {
  const appError = error instanceof AppError ? error : handleError(error);
  const userFriendlyError = getUserFriendlyError(
    appError.code,
    appError.details,
  );

  return {
    error: userFriendlyError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    ...(includeDetails && { details: appError.details }),
  };
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
