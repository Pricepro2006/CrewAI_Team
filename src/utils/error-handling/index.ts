export * from './error-types';
export * from './error-messages';
export * from './async-error-wrapper';

import { logger } from '../logger';
import { AppError, ErrorCode } from './error-types';
import { getUserFriendlyError } from './error-messages';

/**
 * Global error handler for unhandled errors
 */
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    // Give the logger time to write before exiting
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', { reason, promise });
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event: ErrorEvent) => {
      logger.error('Window Error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      logger.error('Unhandled Promise Rejection:', {
        reason: event.reason,
      });
    });
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
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  };

  if (error instanceof AppError) {
    sanitized.code = error.code;
    sanitized.statusCode = error.statusCode;
    sanitized.timestamp = error.timestamp;
    
    // Sanitize details - remove sensitive fields
    if (error.details) {
      const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
      sanitized.details = Object.keys(error.details).reduce((acc, key) => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          acc[key] = '[REDACTED]';
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
export function tryCatch<T extends (...args: any[]) => any>(
  fn: T,
  errorHandler?: (error: Error) => void
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (errorHandler) {
        errorHandler(err);
      } else {
        logger.error(`Error in ${fn.name || 'anonymous function'}:`, err);
        throw err;
      }
    }
  }) as T;
}