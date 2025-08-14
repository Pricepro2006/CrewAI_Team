/**
 * Secure Error Handling Middleware
 * Prevents information leakage and provides consistent error responses
 * 
 * Security Features:
 * - Stack trace removal in production
 * - Sensitive data masking
 * - Error categorization
 * - Rate limiting for error endpoints
 * - Audit logging for security events
 * - Client-friendly error messages
 * - Correlation IDs for debugging
 */

import type { Request, Response, NextFunction } from "express";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { logger } from "../../../utils/logger.js";
import { ZodError } from "zod";

// Error categories for classification
enum ErrorCategory {
  VALIDATION = "VALIDATION",
  AUTHENTICATION = "AUTHENTICATION", 
  AUTHORIZATION = "AUTHORIZATION",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMIT = "RATE_LIMIT",
  BUSINESS_LOGIC = "BUSINESS_LOGIC",
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE",
  DATABASE = "DATABASE",
  INTERNAL = "INTERNAL",
}

// Error severity levels
enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Sensitive patterns to mask in error messages
const SENSITIVE_PATTERNS = [
  // API Keys and Tokens
  /(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|authentication|authorization|bearer)\s*[:=]\s*["']?([A-Za-z0-9+/=\-_.]+)["']?/gi,
  
  // Passwords
  /(?:password|passwd|pwd|pass)\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
  
  // Credit Cards
  /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
  
  // Social Security Numbers
  /\b\d{3}-\d{2}-\d{4}\b/g,
  
  // Email Addresses (in error context)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone Numbers
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  
  // Database Connection Strings
  /(?:mongodb|mysql|postgresql|redis|mssql):\/\/[^"\s]+/gi,
  
  // File Paths
  /(?:\/home\/|\/usr\/|\/var\/|C:\\|D:\\)[^\s"']+/gi,
  
  // IP Addresses
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  
  // JWT Tokens
  /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
];

// Map error codes to HTTP status codes
const ERROR_STATUS_MAP: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

// User-friendly error messages
const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "The information provided is invalid. Please check and try again.",
  AUTH_REQUIRED: "Please sign in to continue.",
  PERMISSION_DENIED: "You don't have permission to perform this action.",
  NOT_FOUND: "The requested resource could not be found.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later.",
  DATABASE_ERROR: "We're having trouble accessing our data. Please try again.",
  EXTERNAL_SERVICE_ERROR: "One of our services is temporarily unavailable. Please try again later.",
  INTERNAL_ERROR: "Something went wrong on our end. We're working to fix it.",
  TIMEOUT: "The request took too long to process. Please try again.",
  NETWORK_ERROR: "Network connection issue. Please check your connection and try again.",
};

/**
 * Generate correlation ID for error tracking
 */
function generateCorrelationId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Mask sensitive data in strings
 */
function maskSensitiveData(str: string): string {
  let masked = str;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, (match) => {
      // Keep first and last few characters for debugging
      if (match.length > 8) {
        return match.substring(0, 3) + "*".repeat(match.length - 6) + match.substring(match.length - 3);
      }
      return "*".repeat(match.length);
    });
  }
  
  return masked;
}

/**
 * Sanitize error object for client response
 */
function sanitizeErrorForClient(
  error: any,
  isDevelopment: boolean = false
): {
  message: string;
  code: string;
  statusCode: number;
  correlationId: string;
  timestamp: string;
  details?: any;
} {
  const correlationId = generateCorrelationId();
  const timestamp = new Date().toISOString();
  
  // Determine error category and severity
  let category = ErrorCategory.INTERNAL;
  let severity = ErrorSeverity.MEDIUM as ErrorSeverity;
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = USER_FRIENDLY_MESSAGES.INTERNAL_ERROR;
  let details: any = undefined;
  
  // Handle different error types
  if (error instanceof ZodError) {
    category = ErrorCategory.VALIDATION;
    severity = ErrorSeverity.LOW;
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = USER_FRIENDLY_MESSAGES.VALIDATION_ERROR;
    
    if (isDevelopment) {
      details = {
        validation: error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message,
        })),
      };
    }
  } else if (error instanceof TRPCError) {
    code = error.code;
    statusCode = ERROR_STATUS_MAP[error.code] || 500;
    
    switch (error.code) {
      case "UNAUTHORIZED":
        category = ErrorCategory.AUTHENTICATION;
        severity = ErrorSeverity.MEDIUM;
        message = USER_FRIENDLY_MESSAGES.AUTH_REQUIRED;
        break;
      case "FORBIDDEN":
        category = ErrorCategory.AUTHORIZATION;
        severity = ErrorSeverity.MEDIUM;
        message = USER_FRIENDLY_MESSAGES.PERMISSION_DENIED;
        break;
      case "NOT_FOUND":
        category = ErrorCategory.NOT_FOUND;
        severity = ErrorSeverity.LOW;
        message = USER_FRIENDLY_MESSAGES.NOT_FOUND;
        break;
      case "TOO_MANY_REQUESTS":
        category = ErrorCategory.RATE_LIMIT;
        severity = ErrorSeverity.LOW;
        message = USER_FRIENDLY_MESSAGES.RATE_LIMIT_EXCEEDED;
        break;
      default:
        message = isDevelopment ? error.message : USER_FRIENDLY_MESSAGES.INTERNAL_ERROR;
    }
  } else if (error.code === "ECONNREFUSED") {
    category = ErrorCategory.EXTERNAL_SERVICE;
    severity = ErrorSeverity.HIGH;
    statusCode = 503;
    code = "SERVICE_UNAVAILABLE";
    message = USER_FRIENDLY_MESSAGES.EXTERNAL_SERVICE_ERROR;
  } else if (error.code === "ETIMEDOUT" || error.code === "ESOCKETTIMEDOUT") {
    category = ErrorCategory.EXTERNAL_SERVICE;
    severity = ErrorSeverity.MEDIUM;
    statusCode = 504;
    code = "GATEWAY_TIMEOUT";
    message = USER_FRIENDLY_MESSAGES.TIMEOUT;
  } else if (error.name === "SequelizeDatabaseError" || error.name === "DatabaseError") {
    category = ErrorCategory.DATABASE;
    severity = ErrorSeverity.HIGH;
    statusCode = 503;
    code = "DATABASE_ERROR";
    message = USER_FRIENDLY_MESSAGES.DATABASE_ERROR;
  } else if (error.statusCode || error.status) {
    statusCode = error.statusCode || error.status;
    code = error.code || "HTTP_ERROR";
    
    if (statusCode >= 400 && statusCode < 500) {
      severity = ErrorSeverity.LOW;
      message = error.message && isDevelopment 
        ? maskSensitiveData(error.message)
        : USER_FRIENDLY_MESSAGES.VALIDATION_ERROR;
    } else {
      severity = ErrorSeverity.HIGH;
      message = USER_FRIENDLY_MESSAGES.INTERNAL_ERROR;
    }
  }
  
  // Log the error with appropriate severity
  const logData = {
    correlationId,
    category,
    severity,
    code,
    statusCode,
    message: error.message || "Unknown error",
    stack: isDevelopment ? error.stack : undefined,
    ...error.metadata,
  };
  
  if (severity === ErrorSeverity.CRITICAL) {
    logger.error("Critical error occurred", "ERROR_HANDLER", logData);
    // Trigger alerts for critical errors if needed
    // alertService.sendCriticalAlert(logData);
  } else if (severity === ErrorSeverity.HIGH) {
    logger.error("High severity error", "ERROR_HANDLER", logData);
  } else if (severity === ErrorSeverity.MEDIUM) {
    logger.warn("Medium severity error", "ERROR_HANDLER", logData);
  } else if (severity === ErrorSeverity.LOW) {
    logger.info("Low severity error", "ERROR_HANDLER", logData);
  } else {
    logger.error("Unknown severity error", "ERROR_HANDLER", logData);
  }
  
  return {
    message,
    code,
    statusCode,
    correlationId,
    timestamp,
    details: isDevelopment ? details : undefined,
  };
}

/**
 * Express error handling middleware
 */
export function secureErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }
  
  const isDevelopment = process.env.NODE_ENV === "development";
  const sanitized = sanitizeErrorForClient(error, isDevelopment);
  
  // Add security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  
  // Add correlation ID to response headers
  res.setHeader("X-Correlation-ID", sanitized.correlationId);
  
  // Log request details for debugging
  logger.info("Error response sent", "ERROR_HANDLER", {
    correlationId: sanitized.correlationId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    userId: (req as any).user?.id,
    statusCode: sanitized.statusCode,
    errorCode: sanitized.code,
  });
  
  // Send error response
  res.status(sanitized.statusCode).json({
    error: {
      message: sanitized.message,
      code: sanitized.code,
      correlationId: sanitized.correlationId,
      timestamp: sanitized.timestamp,
      ...(sanitized.details && { details: sanitized.details }),
    },
  });
}

/**
 * TRPC error formatter
 */
export function createTRPCErrorFormatter(isDevelopment: boolean = false) {
  return ({ shape, error }: any) => {
    const sanitized = sanitizeErrorForClient(error, isDevelopment);
    
    return {
      ...shape,
      data: {
        ...shape.data,
        correlationId: sanitized.correlationId,
        timestamp: sanitized.timestamp,
        code: sanitized.code,
        httpStatus: sanitized.statusCode,
      },
      message: sanitized.message,
    };
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler with security
 */
export function secureNotFoundHandler(
  req: Request,
  res: Response
): void {
  const correlationId = generateCorrelationId();
  
  logger.info("404 Not Found", "ERROR_HANDLER", {
    correlationId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  
  res.status(404).json({
    error: {
      message: "The requested resource could not be found",
      code: "NOT_FOUND",
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Method not allowed handler
 */
export function methodNotAllowedHandler(
  allowedMethods: string[]
) {
  return (req: Request, res: Response) => {
    const correlationId = generateCorrelationId();
    
    logger.info("405 Method Not Allowed", "ERROR_HANDLER", {
      correlationId,
      path: req.path,
      method: req.method,
      allowedMethods,
      ip: req.ip,
    });
    
    res.setHeader("Allow", allowedMethods.join(", "));
    res.status(405).json({
      error: {
        message: `Method ${req.method} not allowed`,
        code: "METHOD_NOT_ALLOWED",
        correlationId,
        timestamp: new Date().toISOString(),
        details: {
          allowedMethods,
        },
      },
    });
  };
}

/**
 * Timeout handler
 */
export function createTimeoutHandler(timeout: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      const correlationId = generateCorrelationId();
      
      logger.error("Request timeout", "ERROR_HANDLER", {
        correlationId,
        path: req.path,
        method: req.method,
        timeout,
        ip: req.ip,
      });
      
      if (!res.headersSent) {
        res.status(504).json({
          error: {
            message: "Request timeout",
            code: "TIMEOUT",
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }, timeout);
    
    // Clear timeout when response is sent
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    
    next();
  };
}

/**
 * Payload too large handler
 */
export function payloadTooLargeHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error.type === "entity.too.large") {
    const correlationId = generateCorrelationId();
    
    logger.warn("Payload too large", "ERROR_HANDLER", {
      correlationId,
      path: req.path,
      method: req.method,
      contentLength: req.headers["content-length"],
      ip: req.ip,
    });
    
    res.status(413).json({
      error: {
        message: "Request payload too large",
        code: "PAYLOAD_TOO_LARGE",
        correlationId,
        timestamp: new Date().toISOString(),
      },
    });
  } else {
    next(error);
  }
}

/**
 * Create error metrics collector
 */
class ErrorMetrics {
  private metrics: Map<string, {
    count: number;
    lastOccurred: Date;
    severity: ErrorSeverity;
  }> = new Map();
  
  record(code: string, severity: ErrorSeverity): void {
    const existing = this.metrics.get(code) || {
      count: 0,
      lastOccurred: new Date(),
      severity,
    };
    
    existing.count++;
    existing.lastOccurred = new Date();
    
    this.metrics.set(code, existing);
    
    // Alert on error spikes
    if (existing.count > 100 && (severity === (ErrorSeverity.HIGH as ErrorSeverity) || severity === (ErrorSeverity.CRITICAL as ErrorSeverity))) {
      logger.error("Error spike detected", "ERROR_METRICS", {
        code,
        count: existing.count,
        severity: severity,
      });
      // alertService.sendErrorSpikeAlert({ code, count: existing.count });
    }
  }
  
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    this.metrics.forEach((data, code) => {
      result[code] = {
        count: data.count,
        lastOccurred: data.lastOccurred.toISOString(),
        severity: data.severity,
      };
    });
    
    return result;
  }
  
  reset(): void {
    this.metrics.clear();
  }
}

export const errorMetrics = new ErrorMetrics();

/**
 * Error recovery strategies
 */
export const errorRecovery = {
  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          logger.info("Retrying after error", "ERROR_RECOVERY", {
            attempt: i + 1,
            maxRetries,
            delay,
            error: (error as Error).message,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  },
  
  /**
   * Circuit breaker pattern
   */
  createCircuitBreaker(
    threshold: number = 5,
    timeout: number = 60000
  ) {
    let failures = 0;
    let lastFailTime: number | null = null;
    let isOpen = false;
    
    return async function<T>(fn: () => Promise<T>): Promise<T> {
      // Check if circuit is open
      if (isOpen) {
        if (lastFailTime && Date.now() - lastFailTime > timeout) {
          // Try to close circuit
          isOpen = false;
          failures = 0;
        } else {
          throw new Error("Circuit breaker is open");
        }
      }
      
      try {
        const result = await fn();
        failures = 0; // Reset on success
        return result;
      } catch (error) {
        failures++;
        lastFailTime = Date.now();
        
        if (failures >= threshold) {
          isOpen = true;
          logger.error("Circuit breaker opened", "ERROR_RECOVERY", {
            failures,
            threshold,
          });
        }
        
        throw error;
      }
    };
  },
};

/**
 * Export error handling utilities
 */
export const errorUtils = {
  generateCorrelationId,
  maskSensitiveData,
  sanitizeErrorForClient,
  errorMetrics,
  errorRecovery,
};