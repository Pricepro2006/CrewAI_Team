import { TRPCError } from "@trpc/server";
import { logger } from "../../utils/logger.js";
import { AppError, ErrorCode } from "../../utils/error-handling/server.js";
import { getUserFriendlyError } from "../../utils/error-handling/error-messages.js";

/**
 * Maps AppError codes to TRPC error codes
 */
function mapErrorCodeToTRPC(code: ErrorCode): TRPCError["code"] {
  switch (code) {
    case ErrorCode.BAD_REQUEST:
    case ErrorCode.VALIDATION_ERROR:
      return "BAD_REQUEST";
    case ErrorCode.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case ErrorCode.FORBIDDEN:
      return "FORBIDDEN";
    case ErrorCode.NOT_FOUND:
      return "NOT_FOUND";
    case ErrorCode.CONFLICT:
      return "CONFLICT";
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return "TOO_MANY_REQUESTS";
    case ErrorCode.SERVICE_UNAVAILABLE:
    case ErrorCode.OLLAMA_CONNECTION_ERROR:
    case ErrorCode.CHROMADB_CONNECTION_ERROR:
      return "PRECONDITION_FAILED";
    case ErrorCode.INTERNAL_SERVER_ERROR:
    case ErrorCode.DATABASE_ERROR:
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

/**
 * Converts various error types to TRPCError with proper formatting
 */
export function formatTRPCError(error: unknown, context?: any): TRPCError {
  // Already a TRPCError
  if (error instanceof TRPCError) {
    return error;
  }

  // AppError - convert to TRPCError with user-friendly message
  if (error instanceof AppError) {
    const userFriendly = getUserFriendlyError(error.code, error.details);

    return new TRPCError({
      code: mapErrorCodeToTRPC(error.code),
      message: error.message,
      cause: {
        ...error.toJSON(),
        userMessage: userFriendly,
        context,
      },
    });
  }

  // Regular Error
  if (error instanceof Error) {
    // Check for common patterns
    if (error.message.includes("ECONNREFUSED")) {
      return new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Service unavailable",
        cause: {
          originalError: error.message,
          userMessage: {
            title: "Service Unavailable",
            message:
              "A required service is not responding. Please try again later.",
            action: "Check service status or contact support.",
          },
          context,
        },
      });
    }

    if (error.message.includes("ETIMEDOUT")) {
      return new TRPCError({
        code: "TIMEOUT",
        message: "Request timed out",
        cause: {
          originalError: error.message,
          userMessage: {
            title: "Request Timeout",
            message: "The request took too long to complete.",
            action:
              "Please try again with a smaller request or check your connection.",
          },
          context,
        },
      });
    }

    // Generic error
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An error occurred"
          : error.message,
      cause: {
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        context,
      },
    });
  }

  // Unknown error type
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: {
      error: String(error),
      context,
    },
  });
}

/**
 * Error logging middleware for tRPC
 */
export const errorLoggingMiddleware = async (opts: {
  ctx: any;
  next: () => Promise<any>;
  path: string;
  type: "query" | "mutation" | "subscription";
  input: unknown;
}) => {
  const start = Date.now();

  try {
    const result = await opts.next();
    return result;
  } catch (error) {
    const duration = Date.now() - start;

    // Log the error with context
    logger.error("tRPC procedure error", "TRPC_ERROR", {
      path: opts.path,
      type: opts.type,
      duration,
      input: sanitizeInput(opts.input),
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              ...(error instanceof TRPCError && { code: error.code }),
            }
          : String(error),
      user: opts.ctx.user?.id,
    });

    // Re-throw formatted error
    throw formatTRPCError(error, {
      path: opts.path,
      type: opts.type,
    });
  }
};

/**
 * Retry middleware for tRPC procedures
 */
export const retryMiddleware = (
  options: {
    maxRetries?: number;
    retryDelay?: number;
    retryableErrors?: string[];
  } = {},
) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryableErrors = ["PRECONDITION_FAILED", "TIMEOUT"],
  } = options;

  return async (opts: { ctx: any; next: () => Promise<any>; path: string }) => {
    let lastError: TRPCError | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await opts.next();
      } catch (error) {
        if (
          error instanceof TRPCError &&
          retryableErrors.includes(error.code)
        ) {
          lastError = error;

          if (attempt < maxRetries - 1) {
            logger.info(
              `Retrying tRPC procedure ${opts.path}, attempt ${attempt + 1}/${maxRetries}`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * Math.pow(2, attempt)),
            );
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError;
  };
};

/**
 * Circuit breaker middleware for external service calls
 */
export class TRPCCircuitBreaker {
  private failures = new Map<string, number>();
  private lastFailureTime = new Map<string, number>();
  private circuitState = new Map<string, "closed" | "open" | "half-open">();

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private halfOpenRetries: number = 3,
  ) {}

  middleware = async (opts: {
    ctx: any;
    next: () => Promise<any>;
    path: string;
  }) => {
    const state = this.circuitState.get(opts.path) || "closed";

    if (state === "open") {
      const lastFailure = this.lastFailureTime.get(opts.path) || 0;
      const now = Date.now();

      if (now - lastFailure >= this.timeout) {
        this.circuitState.set(opts.path, "half-open");
        this.failures.set(opts.path, 0);
      } else {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Circuit breaker is open",
          cause: {
            path: opts.path,
            retryAfter: this.timeout - (now - lastFailure),
          },
        });
      }
    }

    try {
      const result = await opts.next();

      if (state === "half-open") {
        this.circuitState.set(opts.path, "closed");
        this.failures.set(opts.path, 0);
        logger.info(`Circuit breaker for ${opts.path} reset to closed`);
      }

      return result;
    } catch (error) {
      const currentFailures = (this.failures.get(opts.path) || 0) + 1;
      this.failures.set(opts.path, currentFailures);
      this.lastFailureTime.set(opts.path, Date.now());

      if (currentFailures >= this.threshold) {
        this.circuitState.set(opts.path, "open");
        logger.error(
          `Circuit breaker for ${opts.path} opened after ${currentFailures} failures`,
        );
      }

      throw error;
    }
  };

  reset(path?: string): void {
    if (path) {
      this.circuitState.delete(path);
      this.failures.delete(path);
      this.lastFailureTime.delete(path);
    } else {
      this.circuitState.clear();
      this.failures.clear();
      this.lastFailureTime.clear();
    }
  }
}

/**
 * Sanitize input for logging
 */
function sanitizeInput(input: unknown): any {
  if (!input || typeof input !== "object") {
    return input;
  }

  const sensitiveFields = ["password", "token", "apiKey", "secret"];
  const sanitized = { ...(input as any) };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}
