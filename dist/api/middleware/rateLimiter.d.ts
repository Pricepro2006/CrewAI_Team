export declare function rateLimitMiddleware(maxRequests?: number, windowMs?: number): ({ ctx, next }: {
    ctx: any;
    next: () => Promise<any>;
}) => Promise<any>;
export declare const apiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const chatProcedureRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const agentProcedureRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const taskProcedureRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const ragProcedureRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const strictProcedureRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const webSearchRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const businessSearchRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const premiumRateLimit: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map