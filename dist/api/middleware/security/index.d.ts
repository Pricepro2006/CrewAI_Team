import { z } from "zod";
import type { Context } from "../../trpc/context";
/**
 * Security middleware implementations for tRPC
 */
export declare const sanitizationSchemas: {
    string: z.ZodString;
    sqlSafe: z.ZodString;
    htmlSafe: z.ZodEffects<z.ZodString, string, string>;
    email: z.ZodString;
    uuid: z.ZodString;
    url: z.ZodString;
};
/**
 * Create security audit middleware
 */
export declare function createSecurityAuditMiddleware(): (opts: {
    ctx: Context;
    next: () => Promise<any>;
    path: string;
    type: string;
    input: unknown;
}) => Promise<any>;
/**
 * Create authentication middleware
 */
export declare function createAuthMiddleware(): (opts: {
    ctx: Context;
    next: () => Promise<any>;
}) => Promise<any>;
/**
 * Create authorization middleware for role-based access
 */
export declare function createAuthorizationMiddleware(allowedRoles: string[]): (opts: {
    ctx: Context;
    next: () => Promise<any>;
}) => Promise<any>;
/**
 * Create input validation middleware
 */
export declare function createInputValidation<T extends z.ZodTypeAny>(schema: T): (opts: {
    ctx: Context;
    next: () => Promise<any>;
    input: unknown;
}) => Promise<any>;
/**
 * Create rate limiting middleware
 */
export declare function createRateLimitMiddleware(options: {
    windowMs: number;
    max: number;
    keyGenerator?: (ctx: Context) => string;
}): (opts: {
    ctx: Context;
    next: () => Promise<any>;
}) => Promise<any>;
/**
 * Create CSRF protection middleware
 */
export declare function createCSRFProtection(): (opts: {
    ctx: Context;
    next: () => Promise<any>;
    type?: string;
}) => Promise<any>;
/**
 * Create IP allowlist/blocklist middleware
 */
export declare function createIPRestriction(options: {
    allowlist?: string[];
    blocklist?: string[];
}): (opts: {
    ctx: Context;
    next: () => Promise<any>;
}) => Promise<any>;
/**
 * Create request size limit middleware
 */
export declare function createRequestSizeLimit(maxSizeBytes: number): (opts: {
    ctx: Context;
    next: () => Promise<any>;
    input: unknown;
}) => Promise<any>;
//# sourceMappingURL=index.d.ts.map