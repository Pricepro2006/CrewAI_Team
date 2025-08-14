import { TRPCError } from "@trpc/server";
import type { Context } from "../../trpc/context.js";
import { logger } from "../../../utils/logger.js";
import { guestUserService } from "../../services/GuestUserService.js";
import { securityMonitor, SecurityEventType } from "../../services/SecurityMonitoringService.js";

/**
 * Enhanced authentication middleware that supports guest users with restricted permissions
 */

/**
 * Create permission-based middleware that allows both authenticated and guest users
 * but checks for specific permissions
 */
export function createPermissionMiddleware(requiredPermissions: string[]) {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
    path: string;
  }) => {
    const { ctx, next, path } = opts;

    // Check if user exists (authenticated or guest)
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    // Check if user is active
    if (!ctx.user.isActive) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Account is inactive",
      });
    }

    // Check if user is a guest
    const isGuest = guestUserService.isGuestUser(ctx.user);

    // Verify user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission => 
      ctx.user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      logger.warn("Permission check failed", "SECURITY", {
        userId: ctx.user.id,
        isGuest,
        userPermissions: ctx.user.permissions,
        requiredPermissions,
        path,
        requestId: ctx.requestId,
      });

      // Log to security monitor
      securityMonitor.logEvent({
        type: isGuest ? SecurityEventType.GUEST_ACCESS_DENIED : SecurityEventType.PERMISSION_DENIED,
        userId: ctx.user.id,
        ip: (ctx.user.metadata as any)?.ip,
        userAgent: (ctx.user.metadata as any)?.userAgent,
        resource: path,
        reason: `Missing permissions: ${requiredPermissions.join(", ")}`,
        metadata: {
          userPermissions: ctx.user.permissions,
          requiredPermissions,
        },
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: isGuest 
          ? "This feature requires authentication. Please sign in to continue."
          : "Insufficient permissions for this operation",
      });
    }

    // Log guest access for monitoring
    if (isGuest) {
      logger.info("Guest user accessing protected resource", "GUEST_ACCESS", {
        guestId: ctx.user.id,
        path,
        permissions: requiredPermissions,
        requestId: ctx.requestId,
      });
    }

    // Update last activity
    ctx.user.lastActivity = new Date();

    return next();
  };
}

/**
 * Create guest-friendly middleware that allows guest users with specific permissions
 */
export function createGuestAllowedMiddleware(guestPermissions: string[] = ["read"]) {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
  }) => {
    const { ctx, next } = opts;

    // If no user, this is truly unauthenticated - reject
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    // Check if user is a guest
    if (guestUserService.isGuestUser(ctx.user)) {
      // Verify guest has required permissions
      const hasPermission = guestPermissions.some(permission =>
        ctx.user.permissions.includes(permission)
      );

      if (!hasPermission) {
        // Log guest access denial
        securityMonitor.logEvent({
          type: SecurityEventType.GUEST_ACCESS_DENIED,
          userId: ctx.user.id,
          ip: (ctx.user.metadata as any)?.ip,
          userAgent: (ctx.user.metadata as any)?.userAgent,
          resource: opts.path || "unknown",
          reason: "Guest lacks required permissions",
        });

        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Guest users cannot access this resource. Please sign in.",
        });
      }
    }

    return next();
  };
}

/**
 * Strict authentication middleware that completely blocks guest users
 */
export function createStrictAuthMiddleware() {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
  }) => {
    const { ctx, next } = opts;

    // Check if user is authenticated and not a guest
    if (!ctx.user || guestUserService.isGuestUser(ctx.user)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required. Guest access not allowed.",
      });
    }

    // Check if user is active
    if (!ctx.user.isActive) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Account is inactive",
      });
    }

    return next();
  };
}

/**
 * Rate limiting middleware specifically for guest users
 */
export function createGuestRateLimitMiddleware(
  maxRequests: number = 10,
  windowMs: number = 60000
) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
    path: string;
  }) => {
    const { ctx, next, path } = opts;

    // Only apply to guest users
    if (!ctx.user || !guestUserService.isGuestUser(ctx.user)) {
      return next();
    }

    const now = Date.now();
    const guestId = ctx.user.id;
    const key = `${guestId}:${path}`;

    // Clean up old entries
    requestCounts.forEach((value, k) => {
      if (value.resetTime < now) {
        requestCounts.delete(k);
      }
    });

    // Get or create counter
    const counter = requestCounts.get(key);
    
    if (!counter) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
    } else if (counter.resetTime < now) {
      // Reset window
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
    } else {
      // Increment counter
      counter.count++;
      
      if (counter.count > maxRequests) {
        logger.warn("Guest rate limit exceeded", "SECURITY", {
          guestId,
          path,
          count: counter.count,
          maxRequests,
        });

        // Log rate limit event
        securityMonitor.logEvent({
          type: SecurityEventType.GUEST_RATE_LIMITED,
          userId: guestId,
          ip: (ctx.user.metadata as any)?.ip,
          userAgent: (ctx.user.metadata as any)?.userAgent,
          resource: path,
          reason: `Rate limit exceeded: ${counter.count}/${maxRequests}`,
          metadata: {
            count: counter.count,
            maxRequests,
            windowMs,
          },
        });

        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded for guest users. Please sign in for higher limits.",
        });
      }
    }

    return next();
  };
}

/**
 * Create enhanced authorization middleware that supports both roles and permissions
 */
export function createEnhancedAuthorizationMiddleware(
  allowedRoles: string[] = [],
  requiredPermissions: string[] = []
) {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
  }) => {
    const { ctx, next } = opts;

    // Ensure user exists
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    // Block guest users from role-based endpoints
    if (guestUserService.isGuestUser(ctx.user) && allowedRoles.length > 0) {
      securityMonitor.logEvent({
        type: SecurityEventType.GUEST_ACCESS_DENIED,
        userId: ctx.user.id,
        ip: (ctx.user.metadata as any)?.ip,
        userAgent: (ctx.user.metadata as any)?.userAgent,
        resource: opts.path || "role-based-endpoint",
        reason: "Guest attempted to access role-based resource",
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Guest users cannot access role-based resources",
      });
    }

    // Check role-based access
    if (allowedRoles.length > 0 && !allowedRoles.includes(ctx.user.role)) {
      logger.warn("Role-based authorization failed", "SECURITY", {
        userId: ctx.user.id,
        userRole: ctx.user.role,
        requiredRoles: allowedRoles,
        requestId: ctx.requestId,
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient role privileges",
      });
    }

    // Check permission-based access
    if (requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every(permission =>
        ctx.user.permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        logger.warn("Permission-based authorization failed", "SECURITY", {
          userId: ctx.user.id,
          userPermissions: ctx.user.permissions,
          requiredPermissions,
          requestId: ctx.requestId,
        });

        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions",
        });
      }
    }

    return next();
  };
}