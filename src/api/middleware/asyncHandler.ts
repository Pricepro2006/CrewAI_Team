import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "../../utils/logger";
import { AppError } from "../../utils/error-handling";

/**
 * Wraps async route handlers to properly catch errors with enhanced error handling
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await Promise.resolve(fn(req, res, next));
    } catch (error) {
      // Log the error with request context
      logger.error("Async handler error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method,
        handler: fn.name || "anonymous",
      });

      // Convert known errors to AppError if needed
      let processedError = error;
      if (error instanceof Error && !(error instanceof AppError)) {
        // Check for common error patterns
        if (error.message.includes("ECONNREFUSED")) {
          processedError = new AppError(
            "SERVICE_UNAVAILABLE",
            "Service connection refused",
            503,
            { originalError: error.message },
          );
        } else if (error.message.includes("ETIMEDOUT")) {
          processedError = new AppError(
            "SERVICE_UNAVAILABLE",
            "Service request timed out",
            503,
            { originalError: error.message },
          );
        }
      }

      next(processedError);
    }
  };
};

/**
 * Wraps async middleware with error handling
 */
export const asyncMiddleware = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};
