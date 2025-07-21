import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to properly catch errors
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};