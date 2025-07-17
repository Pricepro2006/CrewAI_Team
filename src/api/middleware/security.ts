import { TRPCError } from "@trpc/server";
import type { Context } from "../trpc/context";
import { logger } from "../../utils/logger";
import { z } from "zod";
import rateLimit from "express-rate-limit";

/**
 * Advanced security middleware for tRPC based on security specialist patterns
 * Implements OWASP Top 10 protections and enterprise security controls
 */

// Security headers configuration for Express middleware
// Note: This would be used with helmet in Express middleware, not in tRPC
export const securityHeadersConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
};

// Input sanitization schemas
const sanitizationSchemas = {
  string: z
    .string()
    .max(10000)
    .refine(
      (val) => {
        // XSS prevention
        const xssPattern = /<script|javascript:|on\w+=/i;
        if (xssPattern.test(val)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Potentially malicious input detected",
          });
        }
        return true;
      },
      { message: "Invalid input detected" },
    ),

  email: z.string().email().max(255),

  url: z
    .string()
    .url()
    .refine(
      (val) => {
        // Only allow HTTPS URLs for external resources
        if (
          !val.startsWith("https://") &&
          !val.startsWith("http://localhost")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only HTTPS URLs are allowed",
          });
        }
        return true;
      },
      { message: "Only secure URLs are allowed" },
    ),

  sqlSafe: z.string().refine(
    (val) => {
      // SQL injection prevention
      const sqlPattern =
        /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i;
      if (sqlPattern.test(val)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SQL injection attempt detected",
        });
      }
      return true;
    },
    { message: "Invalid query detected" },
  ),
};

// Input validation middleware factory (used in enhanced-router.ts)
export function createInputValidation<T extends z.ZodSchema>(
  schema: T,
): (opts: any) => Promise<any> {
  return async (opts: any) => {
    try {
      // Validate and sanitize input
      const validatedInput = await schema.parseAsync(opts.rawInput);

      logger.debug("Input validation passed", "SECURITY", {
        inputKeys: Object.keys(validatedInput || {}),
      });

      return opts.next();
    } catch (error) {
      logger.warn("Input validation failed", "SECURITY", {
        error: error instanceof Error ? error.message : "Unknown error",
        rawInput:
          typeof opts.rawInput === "object"
            ? Object.keys(opts.rawInput || {})
            : typeof opts.rawInput,
      });

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid input provided",
        cause: error,
      });
    }
  };
}

// Authentication middleware factory (used in enhanced-router.ts)
export function createAuthMiddleware(): (opts: any) => Promise<any> {
  return async (opts: any) => {
    const { ctx } = opts;
    if (!ctx.user) {
      logger.warn("Unauthorized access attempt", "SECURITY", {
        ip: ctx.req?.ip || "unknown",
        userAgent: ctx.req?.headers?.["user-agent"] || "unknown",
        path: ctx.req?.path || "unknown",
      });

      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be authenticated to access this resource",
      });
    }

    logger.debug("Authentication successful", "SECURITY", {
      userId: ctx.user.id,
      role: ctx.user.role,
    });

    return opts.next({
      ctx: {
        // Ensure user is non-nullable for subsequent procedures
        user: ctx.user,
      },
    });
  };
}

// Authorization middleware factory (used in enhanced-router.ts)
export function createAuthorizationMiddleware(
  requiredRoles: string[],
): (opts: any) => Promise<any> {
  return async (opts: any) => {
    const { ctx } = opts;
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const userRole = ctx.user.role || "user";
    if (!requiredRoles.includes(userRole)) {
      logger.warn("Authorization failed", "SECURITY", {
        userId: ctx.user.id,
        userRole,
        requiredRoles,
        ip: ctx.req?.ip || "unknown",
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient permissions to access this resource",
      });
    }

    logger.debug("Authorization successful", "SECURITY", {
      userId: ctx.user.id,
      userRole,
      requiredRoles,
    });

    return opts.next();
  };
}

// Request logging middleware factory for security audit trail
export function createSecurityAuditMiddleware(): (opts: any) => Promise<any> {
  return async (opts: any) => {
    const { ctx, path, type } = opts;
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    logger.info("tRPC request started", "SECURITY_AUDIT", {
      requestId,
      path,
      type,
      userId: ctx.user?.id,
      ip: ctx.req?.ip || "unknown",
      userAgent: ctx.req?.headers?.["user-agent"] || "unknown",
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await opts.next();

      logger.info("tRPC request completed", "SECURITY_AUDIT", {
        requestId,
        path,
        type,
        userId: ctx.user?.id,
        duration: Date.now() - startTime,
        status: "success",
      });

      return result;
    } catch (error) {
      logger.error("tRPC request failed", "SECURITY_AUDIT", {
        requestId,
        path,
        type,
        userId: ctx.user?.id,
        duration: Date.now() - startTime,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  };
}

// CSRF protection middleware factory
export function createCSRFProtection(): (opts: any) => Promise<any> {
  return async (opts: any) => {
    const { ctx, type } = opts;
    // Skip CSRF for queries (read-only operations)
    if (type === "query") {
      return opts.next();
    }

    const csrfToken = ctx.req?.headers?.["x-csrf-token"] as string;
    const sessionToken = ctx.req?.headers?.["x-session-token"] as string;

    if (!csrfToken || !sessionToken) {
      logger.warn("CSRF protection triggered", "SECURITY", {
        ip: ctx.req?.ip || "unknown",
        userAgent: ctx.req?.headers?.["user-agent"] || "unknown",
        hasCSRF: !!csrfToken,
        hasSession: !!sessionToken,
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: "CSRF token required for mutations",
      });
    }

    // In production, validate CSRF token against session
    // For now, just check presence
    logger.debug("CSRF protection passed", "SECURITY", {
      userId: ctx.user?.id,
    });

    return opts.next();
  };
}

// Data sanitization utility
export function sanitizeInput(data: any): any {
  if (typeof data === "string") {
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+=/gi, "") // Remove event handlers
      .trim();
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }

  if (data && typeof data === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return data;
}

// Rate limiting with IP and user-based tracking
export function createAdvancedRateLimit(options: {
  windowMs: number;
  maxPerIP: number;
  maxPerUser: number;
  skipSuccessfulRequests?: boolean;
}): Record<string, any> {
  const ipLimiter = rateLimit({
    windowMs: options.windowMs,
    max: options.maxPerIP,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req, res) => {
      logger.warn("IP rate limit exceeded", "SECURITY", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(429).json({
        error: "Too many requests from this IP",
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });

  const userLimiter = new Map<string, { count: number; resetTime: number }>();

  return {
    ipLimiter,
    userMiddleware: () => {
      return async (opts: any) => {
        const { ctx } = opts;
        if (ctx.user) {
          const userId = ctx.user.id;
          const now = Date.now();

          let userLimit = userLimiter.get(userId);
          if (!userLimit || userLimit.resetTime < now) {
            userLimit = {
              count: 0,
              resetTime: now + options.windowMs,
            };
            userLimiter.set(userId, userLimit);
          }

          if (userLimit.count >= options.maxPerUser) {
            logger.warn("User rate limit exceeded", "SECURITY", {
              userId,
              count: userLimit.count,
              max: options.maxPerUser,
            });

            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "Too many requests from this user",
            });
          }

          userLimit.count++;
        }

        return opts.next();
      };
    },
  };
}

// Export security schemas for use in procedures
export { sanitizationSchemas };

// Comprehensive security middleware stack
export function createSecurityStack(): Record<string, any> {
  return {
    headers: securityHeadersConfig,
    audit: createSecurityAuditMiddleware(),
    auth: createAuthMiddleware(),
    authorization: createAuthorizationMiddleware,
    validation: createInputValidation,
    csrf: createCSRFProtection(),
    rateLimit: createAdvancedRateLimit,
    sanitize: sanitizeInput,
  };
}
