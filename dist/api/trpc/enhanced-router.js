import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { createSecurityAuditMiddleware, createAuthMiddleware, createAuthorizationMiddleware, createInputValidation, sanitizationSchemas, } from "../middleware/security";
// Import rate limiters from centralized middleware index (avoids circular dependency)
import { chatProcedureRateLimiter, agentProcedureRateLimiter, taskProcedureRateLimiter, ragProcedureRateLimiter, strictProcedureRateLimiter, } from "../middleware/index";
import { logger } from "../../utils/logger";
import { z } from "zod";
/**
 * Enhanced tRPC setup with comprehensive security and performance features
 * Based on TypeScript Expert tRPC API instructions and security best practices
 */
// Initialize tRPC with enhanced configuration
const t = initTRPC.context().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        // Enhanced error formatting with security considerations
        const isDev = process.env.NODE_ENV === "development";
        // Log security-relevant errors
        if (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN") {
            logger.warn("Security error occurred", "TRPC_SECURITY", {
                code: error.code,
                message: error.message,
                stack: isDev ? error.stack : undefined,
            });
        }
        return {
            ...shape,
            data: {
                ...shape.data,
                // Only include stack traces in development
                stack: isDev ? error.stack : undefined,
                // Add request ID for tracking if available
                requestId: shape.data?.requestId,
            },
        };
    },
});
// Enhanced middleware stack
const securityAudit = createSecurityAuditMiddleware();
const authRequired = createAuthMiddleware();
// Role-based authorization procedures
const requireAdmin = createAuthorizationMiddleware(["admin"]);
const requireUser = createAuthorizationMiddleware(["admin", "user"]);
// Input validation with security sanitization
const secureStringValidation = createInputValidation(z.object({
    input: sanitizationSchemas.string,
}));
const secureQueryValidation = createInputValidation(z.object({
    query: sanitizationSchemas.sqlSafe,
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().min(0).optional(),
}));
// Export router and procedure helpers with explicit types
export const router = t.router;
export const middleware = t.middleware;
// Public procedure with basic security
export const publicProcedure = t.procedure.use(securityAudit);
// Protected procedure requiring authentication
export const protectedProcedure = t.procedure.use(securityAudit).use(authRequired);
// Admin-only procedure
export const adminProcedure = t.procedure
    .use(securityAudit)
    .use(authRequired)
    .use(requireAdmin);
// User-level procedure (admin or user)
export const userProcedure = t.procedure
    .use(securityAudit)
    .use(authRequired)
    .use(requireUser);
// Rate-limited procedures for different operation types
export const chatProcedure = protectedProcedure.use(chatProcedureRateLimiter);
export const agentProcedure = protectedProcedure.use(agentProcedureRateLimiter);
export const taskProcedure = protectedProcedure.use(taskProcedureRateLimiter);
export const ragProcedure = protectedProcedure.use(ragProcedureRateLimiter);
export const strictProcedure = protectedProcedure.use(strictProcedureRateLimiter);
// Procedures with input validation
export const secureTextProcedure = protectedProcedure.use(secureStringValidation);
export const secureQueryProcedure = protectedProcedure.use(secureQueryValidation);
// Performance monitoring middleware
const performanceMonitoring = t.middleware(async ({ next, path, type, ctx }) => {
    const start = Date.now();
    try {
        const result = await next();
        const duration = Date.now() - start;
        // Log slow operations
        if (duration > 5000) {
            logger.warn("Slow tRPC operation detected", "PERFORMANCE", {
                path,
                type,
                duration,
                userId: ctx.user?.id,
                requestId: ctx.requestId,
            });
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - start;
        logger.error("tRPC operation failed", "PERFORMANCE", {
            path,
            type,
            duration,
            userId: ctx.user?.id,
            requestId: ctx.requestId,
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
    }
});
// Performance-monitored procedures
export const monitoredProcedure = protectedProcedure.use(performanceMonitoring);
export const monitoredPublicProcedure = publicProcedure.use(performanceMonitoring);
// Comprehensive procedure with all enhancements
export const enhancedProcedure = t.procedure
    .use(securityAudit)
    .use(performanceMonitoring)
    .use(authRequired);
// Batch operation middleware for efficient data handling
const batchOperationMiddleware = t.middleware(async ({ next, ctx }) => {
    // Track batch operations for monitoring
    const batchId = Math.random().toString(36).substring(7);
    logger.debug("Batch operation started", "BATCH", {
        batchId,
        userId: ctx.user?.id,
        requestId: ctx.requestId,
    });
    return next({
        ctx: {
            ...ctx,
            batchId,
        },
    });
});
export const batchProcedure = protectedProcedure.use(batchOperationMiddleware);
// Custom error handlers for different scenarios
export function createCustomErrorHandler(errorType) {
    return t.middleware(async ({ next }) => {
        try {
            return await next();
        }
        catch (error) {
            if (error instanceof TRPCError) {
                // Log custom error context
                logger.error(`Custom error in ${errorType}`, "TRPC_ERROR", {
                    errorType,
                    code: error.code,
                    message: error.message,
                });
                throw error;
            }
            // Handle unexpected errors
            logger.error(`Unexpected error in ${errorType}`, "TRPC_ERROR", {
                errorType,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "An unexpected error occurred",
                cause: error,
            });
        }
    });
}
// Validation schemas for common patterns
export const commonSchemas = {
    // ID validation
    id: z.string().uuid("Invalid ID format"),
    // Pagination
    pagination: z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
    }),
    // Search
    search: z.object({
        query: sanitizationSchemas.sqlSafe,
        filters: z.record(z.string()).optional(),
        sort: z.enum(["asc", "desc"]).optional(),
    }),
    // File upload
    fileUpload: z.object({
        name: z.string().max(255),
        size: z.number().max(50 * 1024 * 1024), // 50MB max
        type: z.string().refine((type) => {
            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/gif",
                "application/pdf",
                "text/plain",
                "text/csv",
            ];
            return allowedTypes.includes(type);
        }, { message: "File type not allowed" }),
    }),
};
// Utility function for creating feature-specific routers
export function createFeatureRouter(name, procedures) {
    logger.info(`Creating feature router: ${name}`, "ROUTER_SETUP");
    // Add feature-specific middleware here if needed
    return procedures;
}
// Router builder with security defaults
export function createSecureRouter(routes, options) {
    const { requireAuth = true, rateLimit = true, adminOnly = false, } = options || {};
    logger.info("Creating secure router", "ROUTER_SETUP", {
        requireAuth,
        rateLimit,
        adminOnly,
        routeCount: Object.keys(routes).length,
    });
    // Apply security policies based on options
    // This is a placeholder for dynamic router configuration
    return routes;
}
//# sourceMappingURL=enhanced-router.js.map