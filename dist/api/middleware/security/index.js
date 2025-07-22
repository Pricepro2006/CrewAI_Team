import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { logger } from "../../../utils/logger";
/**
 * Security middleware implementations for tRPC
 */
// Sanitization schemas for common input types
export const sanitizationSchemas = {
    string: z.string().max(1000).trim(),
    sqlSafe: z.string()
        .max(500)
        .trim()
        .regex(/^[a-zA-Z0-9\s\-_,.()'"%]+$/, "Invalid characters detected"),
    htmlSafe: z.string()
        .transform(str => str
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/&/g, "&amp;")),
    email: z.string().email().toLowerCase().trim(),
    uuid: z.string().uuid(),
    url: z.string().url().max(2048),
};
/**
 * Create security audit middleware
 */
export function createSecurityAuditMiddleware() {
    return async (opts) => {
        const { ctx, next, path, type, input } = opts;
        const startTime = Date.now();
        // Log request details
        logger.debug("tRPC Request", "SECURITY_AUDIT", {
            path,
            type,
            userId: ctx.user?.id,
            userRole: ctx.user?.role,
            requestId: ctx.requestId,
            hasInput: !!input,
        });
        try {
            const result = await next();
            const duration = Date.now() - startTime;
            // Log successful requests
            logger.debug("tRPC Request Completed", "SECURITY_AUDIT", {
                path,
                type,
                userId: ctx.user?.id,
                duration,
                requestId: ctx.requestId,
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Log failed requests
            logger.warn("tRPC Request Failed", "SECURITY_AUDIT", {
                path,
                type,
                userId: ctx.user?.id,
                duration,
                requestId: ctx.requestId,
                error: error instanceof Error ? error.message : "Unknown error",
                errorCode: error instanceof TRPCError ? error.code : undefined,
            });
            throw error;
        }
    };
}
/**
 * Create authentication middleware
 */
export function createAuthMiddleware() {
    return async (opts) => {
        const { ctx, next } = opts;
        // Check if user is authenticated
        if (!ctx.user || ctx.user.username === "guest") {
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
        // Update last activity
        ctx.user.lastActivity = new Date();
        return next();
    };
}
/**
 * Create authorization middleware for role-based access
 */
export function createAuthorizationMiddleware(allowedRoles) {
    return async (opts) => {
        const { ctx, next } = opts;
        // Ensure user is authenticated first
        if (!ctx.user || ctx.user.username === "guest") {
            throw new TRPCError({
                code: "UNAUTHORIZED",
                message: "Authentication required",
            });
        }
        // Check if user has required role
        if (!allowedRoles.includes(ctx.user.role)) {
            logger.warn("Authorization Failed", "SECURITY", {
                userId: ctx.user.id,
                userRole: ctx.user.role,
                requiredRoles: allowedRoles,
                requestId: ctx.requestId,
            });
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Insufficient permissions",
            });
        }
        return next();
    };
}
/**
 * Create input validation middleware
 */
export function createInputValidation(schema) {
    return async (opts) => {
        const { ctx, next, input } = opts;
        try {
            // Validate and sanitize input
            const validatedInput = await schema.parseAsync(input);
            // Update context with validated input and continue
            ctx.validatedInput = validatedInput;
            return next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                logger.warn("Input Validation Failed", "SECURITY", {
                    userId: ctx.user?.id,
                    requestId: ctx.requestId,
                    errors: error.errors,
                });
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Invalid input",
                    cause: error.errors,
                });
            }
            throw error;
        }
    };
}
/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(options) {
    const requests = new Map();
    return async (opts) => {
        const { ctx, next } = opts;
        // Generate rate limit key
        const key = options.keyGenerator
            ? options.keyGenerator(ctx)
            : ctx.user?.id || ctx.req.ip || "anonymous";
        const now = Date.now();
        const windowStart = now - options.windowMs;
        // Get or create rate limit data
        let data = requests.get(key);
        if (!data || data.resetAt < now) {
            data = { count: 0, resetAt: now + options.windowMs };
            requests.set(key, data);
        }
        // Clean up old entries periodically
        if (Math.random() < 0.01) { // 1% chance
            for (const [k, v] of requests.entries()) {
                if (v.resetAt < windowStart) {
                    requests.delete(k);
                }
            }
        }
        // Check rate limit
        if (data.count >= options.max) {
            logger.warn("Rate Limit Exceeded", "SECURITY", {
                key,
                userId: ctx.user?.id,
                requestId: ctx.requestId,
                count: data.count,
                max: options.max,
            });
            throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message: "Rate limit exceeded. Please try again later.",
            });
        }
        // Increment counter
        data.count++;
        return next();
    };
}
/**
 * Create CSRF protection middleware
 */
export function createCSRFProtection() {
    return async (opts) => {
        const { ctx, next } = opts;
        // Skip CSRF check for safe methods
        if (opts.type && ["query", "subscription"].includes(opts.type)) {
            return next();
        }
        // Check CSRF token
        const token = ctx.req.headers["x-csrf-token"];
        const sessionToken = ctx.req.session?.csrfToken;
        if (!token || token !== sessionToken) {
            logger.warn("CSRF Token Mismatch", "SECURITY", {
                userId: ctx.user?.id,
                requestId: ctx.requestId,
                hasToken: !!token,
                hasSessionToken: !!sessionToken,
            });
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Invalid CSRF token",
            });
        }
        return next();
    };
}
/**
 * Create IP allowlist/blocklist middleware
 */
export function createIPRestriction(options) {
    return async (opts) => {
        const { ctx, next } = opts;
        const clientIP = ctx.req.ip || ctx.req.connection?.remoteAddress || "";
        // Check blocklist first
        if (options.blocklist?.includes(clientIP)) {
            logger.warn("Blocked IP Access Attempt", "SECURITY", {
                ip: clientIP,
                userId: ctx.user?.id,
                requestId: ctx.requestId,
            });
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Access denied",
            });
        }
        // Check allowlist if configured
        if (options.allowlist && !options.allowlist.includes(clientIP)) {
            logger.warn("Non-Allowlisted IP Access Attempt", "SECURITY", {
                ip: clientIP,
                userId: ctx.user?.id,
                requestId: ctx.requestId,
            });
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Access denied",
            });
        }
        return next();
    };
}
/**
 * Create request size limit middleware
 */
export function createRequestSizeLimit(maxSizeBytes) {
    return async (opts) => {
        const { ctx, next, input } = opts;
        // Estimate input size
        const inputSize = JSON.stringify(input).length;
        if (inputSize > maxSizeBytes) {
            logger.warn("Request Size Limit Exceeded", "SECURITY", {
                userId: ctx.user?.id,
                requestId: ctx.requestId,
                size: inputSize,
                limit: maxSizeBytes,
            });
            throw new TRPCError({
                code: "PAYLOAD_TOO_LARGE",
                message: "Request size exceeds limit",
            });
        }
        return next();
    };
}
//# sourceMappingURL=index.js.map