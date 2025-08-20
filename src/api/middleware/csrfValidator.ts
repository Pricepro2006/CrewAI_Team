import type { Request, Response, NextFunction } from "express";
import { getStoredCSRFToken, getRequestCSRFToken, validateCSRFToken } from "./security/csrf.js";
import { logger } from "../../utils/logger.js";

/**
 * Express middleware to validate CSRF tokens for state-changing operations
 * This runs BEFORE tRPC to ensure CSRF validation happens at the correct point
 */
export function csrfValidator(skipPaths: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF check for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Skip specific paths
    const path = req?.path;
    if (skipPaths.some(skipPath => path.startsWith(skipPath))) {
      logger.debug("Skipping CSRF check for path", "CSRF_VALIDATOR", { path });
      return next();
    }

    // Skip CSRF token endpoints
    if (path === "/api/csrf-token" || path === "/api/csrf-token/validate") {
      return next();
    }

    // Get tokens
    const requestToken = getRequestCSRFToken(req);
    const storedToken = getStoredCSRFToken(req);

    // Log for debugging
    logger.debug("CSRF validation attempt", "CSRF_VALIDATOR", {
      path,
      method: req.method,
      hasRequestToken: !!requestToken,
      hasStoredToken: !!storedToken,
      requestTokenPreview: requestToken ? requestToken.substring(0, 8) + "..." : null,
      storedTokenPreview: storedToken ? storedToken.substring(0, 8) + "..." : null,
    });

    // Validate tokens
    const validation = validateCSRFToken(requestToken, storedToken, {
      path,
      requestId: (req as any).requestId,
    });

    if (!validation.valid) {
      logger.warn("CSRF validation failed at Express level", "SECURITY", {
        reason: validation.reason,
        path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Return 403 Forbidden for CSRF validation failures
      return res.status(403).json({
        error: "CSRF validation failed",
        reason: validation.reason,
        message: "Please ensure you have a valid CSRF token. Get one from /api/csrf-token",
      });
    }

    // Attach token to request for downstream use
    (req as any).csrfToken = storedToken;

    logger.debug("CSRF validation successful", "CSRF_VALIDATOR", {
      path,
      method: req.method,
    });

    next();
  };
}

/**
 * Middleware to ensure CSRF token exists for protected routes
 * Use this for routes that need a CSRF token but don't modify state
 */
export function ensureCSRFTokenExists(req: Request, res: Response, next: NextFunction) {
  const storedToken = getStoredCSRFToken(req);
  
  if (!storedToken) {
    logger.debug("No CSRF token found, client needs to fetch one", "CSRF_VALIDATOR", {
      path: req.path,
      method: req.method,
    });
    
    return res.status(401).json({
      error: "CSRF token required",
      message: "Please get a CSRF token from /api/csrf-token first",
    });
  }
  
  (req as any).csrfToken = storedToken;
  return next();
}