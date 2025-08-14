import type { Request, Response, NextFunction } from "express";
import {
  AppError,
  ErrorCode,
  // isOperationalError, // Unused import
  sanitizeError,
} from "../../utils/error-handling/server.js";
import {
  getUserFriendlyError,
  getErrorSeverity,
} from "../../utils/error-handling/error-messages.js";
import { logger } from "../../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

export interface ErrorResponse {
  error: {
    id: string;
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    path?: string;
    method?: string;
  };
  userMessage?: {
    title: string;
    message: string;
    action?: string;
  };
}

/**
 * Express error handling middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  const errorId = uuidv4();
  const timestamp = new Date().toISOString();

  // Log the error
  const logData = {
    errorId,
    ...sanitizeError(err),
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: sanitizeRequestBody(req.body),
      headers: sanitizeHeaders(req.headers),
      ip: req.ip,
      userAgent: req.get("user-agent"),
    },
  };

  // Determine severity and log appropriately
  if (err instanceof AppError) {
    const severity = getErrorSeverity(err.code);
    switch (severity) {
      case "critical":
        logger.error("Critical error occurred", logData);
        break;
      case "error":
        logger.error("Error occurred", logData);
        break;
      case "warning":
        logger.warn("Warning error occurred", logData);
        break;
      case "info":
        logger.info("Info error occurred", logData);
        break;
    }
  } else {
    // Unknown errors are always logged as errors
    logger.error("Unexpected error occurred", logData);
  }

  // Prepare error response
  let statusCode = 500;
  let errorResponse: ErrorResponse;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    const userFriendly = getUserFriendlyError(err.code, err.details);

    errorResponse = {
      error: {
        id: errorId,
        code: err.code,
        message: err.message,
        details:
          process.env['NODE_ENV'] === "development" ? err.details : undefined,
        timestamp,
        path: req.path,
        method: req.method,
      },
      userMessage: {
        title: userFriendly.title,
        message: userFriendly.message,
        action: userFriendly.action,
      },
    };
  } else {
    // Handle non-AppError errors
    const isProduction = process.env['NODE_ENV'] === "production";

    errorResponse = {
      error: {
        id: errorId,
        code: "INTERNAL_SERVER_ERROR",
        message: isProduction ? "An unexpected error occurred" : err.message,
        details: isProduction ? undefined : { stack: err.stack },
        timestamp,
        path: req.path,
        method: req.method,
      },
      userMessage: {
        title: "Something Went Wrong",
        message: "An unexpected error occurred. Our team has been notified.",
        action:
          "Please try again later. If the problem persists, contact support.",
      },
    };
  }

  // Send error response
  res.status(statusCode).json(errorResponse);

  // For critical errors, consider alerting
  if (err instanceof AppError && getErrorSeverity(err.code) === "critical") {
    // TODO: Send alert to monitoring service or admin
    logger.error(
      "Critical error requires immediate attention",
      "ERROR_HANDLER",
      {
        errorId,
        code: err.code,
        message: err.message,
      },
    );
  }
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const error = new AppError(
    ErrorCode.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    404,
    { method: req.method, path: req.path },
  );

  errorHandler(error, req, res, () => {});
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorWrapper(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error formatter for express-validator
 */
interface ValidationError {
  param: string;
  msg: string;
}

export function validationErrorFormatter(errors: ValidationError[]): AppError {
  const formattedErrors = errors.reduce<Record<string, string[]>>((acc, error) => {
    if (!acc[error.param]) {
      acc[error.param] = [];
    }
    acc[error.param]?.push(error.msg);
    return acc;
  }, {});

  return new AppError(ErrorCode.VALIDATION_ERROR, "Validation failed", 422, {
    fields: formattedErrors,
  });
}

/**
 * Sanitize request body to remove sensitive fields
 */
function sanitizeRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || body === null) {
    return body;
  }

  const sensitiveFields = [
    "password",
    "token",
    "apiKey",
    "secret",
    "creditCard",
    "ssn",
  ];
  const sanitized = { ...(body as Record<string, unknown>) };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers: unknown): unknown {
  if (!headers || typeof headers !== "object" || headers === null) {
    return headers;
  }
  
  const sensitiveHeaders = [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
  ];
  const sanitized = { ...(headers as Record<string, unknown>) };

  for (const header of sensitiveHeaders) {
    if (header in sanitized) {
      sanitized[header] = "[REDACTED]";
    }
  }

  return sanitized;
}
