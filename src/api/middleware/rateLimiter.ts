import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { TRPCError } from '@trpc/server';

// tRPC middleware for rate limiting
export function rateLimitMiddleware(maxRequests: number = 100, windowMs: number = 60000) {
  const store = new Map<string, { count: number; resetTime: number }>();
  
  return async ({ ctx, next }: { ctx: any; next: () => Promise<any> }) => {
    const identifier = ctx.user?.id || ctx.req?.ip || 'anonymous';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [key, value] of store.entries()) {
      if (value.resetTime < windowStart) {
        store.delete(key);
      }
    }
    
    // Get or create counter for this identifier
    const existing = store.get(identifier);
    if (!existing) {
      store.set(identifier, { count: 1, resetTime: now + windowMs });
    } else if (existing.resetTime < now) {
      // Reset window
      store.set(identifier, { count: 1, resetTime: now + windowMs });
    } else {
      // Increment counter
      existing.count++;
      if (existing.count > maxRequests) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded'
        });
      }
    }
    
    return next();
  };
}

// Standard API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat-specific rate limiter
export const chatProcedureRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 chat requests per minute
  message: 'Too many chat requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Agent execution rate limiter
export const agentProcedureRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 agent executions per 5 minutes
  message: 'Too many agent requests, please wait before retrying.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Task execution rate limiter
export const taskProcedureRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // 50 task requests per 10 minutes
  message: 'Too many task requests, please wait.',
  standardHeaders: true,
  legacyHeaders: false,
});

// RAG query rate limiter
export const ragProcedureRateLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 25, // 25 RAG queries per 2 minutes
  message: 'Too many RAG queries, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for sensitive operations
export const strictProcedureRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // Only 5 requests per 30 minutes
  message: 'Rate limit exceeded for sensitive operations.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Web search rate limiter
export const webSearchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 searches per minute
  message: 'Too many web search requests.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Business search rate limiter
export const businessSearchRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // 15 business searches per 5 minutes
  message: 'Too many business search requests.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Premium tier rate limiter
export const premiumRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Higher limit for premium users
  message: 'Premium rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,
});

// rateLimitMiddleware is already exported above