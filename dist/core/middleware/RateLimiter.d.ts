import type { Request, Response, NextFunction } from 'express';
declare module 'express' {
    interface Request {
        user?: {
            id: string;
            [key: string]: any;
        };
    }
}
export interface RateLimitConfig {
    windowMs: number;
    max: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (req: Request) => string;
}
export interface RateLimitMetrics {
    totalRequests: number;
    blockedRequests: number;
    limiters: Record<string, {
        requests: number;
        blocked: number;
    }>;
    topIdentifiers: Array<{
        identifier: string;
        requests: number;
        blocked: number;
    }>;
    windowStats: {
        current: {
            requests: number;
            blocked: number;
            startTime: Date;
        };
        previous: {
            requests: number;
            blocked: number;
            startTime: Date;
        };
    };
}
export declare class RateLimiter {
    private redisClient?;
    private useRedis;
    constructor(useRedis?: boolean);
    webSearchLimiter(): import("express-rate-limit").RateLimitRequestHandler;
    businessSearchLimiter(): import("express-rate-limit").RateLimitRequestHandler;
    globalLimiter(): import("express-rate-limit").RateLimitRequestHandler;
    premiumLimiter(): import("express-rate-limit").RateLimitRequestHandler;
    private createLimiter;
    private rateLimitHandler;
    slidingWindowLimiter(windowMs: number, max: number): (req: Request, res: Response, next: NextFunction) => void;
    tokenBucketLimiter(capacity: number, refillRate: number): (req: Request, res: Response, next: NextFunction) => void;
    cleanup(): void;
    getMetrics(): any;
    checkLimit(identifier: string): {
        allowed: boolean;
        remaining: number;
        reset: Date;
    };
    reset(identifier: string): void;
    resetAll(): void;
    static getInstance(): RateLimiter;
}
export declare const rateLimiter: RateLimiter;
export declare const webSearchRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const businessSearchRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const globalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const premiumRateLimit: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=RateLimiter.d.ts.map