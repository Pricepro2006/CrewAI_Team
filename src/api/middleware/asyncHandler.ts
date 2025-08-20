import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logger } from "../../utils/logger.js";
import { AppError, ErrorCode } from "../../utils/error-handling/server.js";

/**
 * Wraps async route handlers to properly catch errors with enhanced error handling
 * Test comment for pre-commit hook verification
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Enhanced async handler with error processing
 */
export const enhancedAsyncHandler = (fn: RequestHandler): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await Promise.resolve(fn(req, res, next));
      return result;
    } catch (error) {
      // Log the error with request context
      logger.error("Async handler error", "ASYNC_HANDLER", {
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
        if (error?.message?.includes("ECONNREFUSED")) {
          processedError = new AppError(
            ErrorCode.SERVICE_UNAVAILABLE,
            "Service connection refused",
            503,
            { originalError: error.message },
          );
        } else if (error?.message?.includes("ETIMEDOUT")) {
          processedError = new AppError(
            ErrorCode.SERVICE_UNAVAILABLE,
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
