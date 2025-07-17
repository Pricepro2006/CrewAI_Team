/**
 * Middleware Index - Internal Module Pattern
 * 
 * This file follows the Internal Module Pattern to resolve circular dependencies
 * between tRPC router and middleware files. Based on 2025 TypeScript best practices
 * and tRPC v10 patterns.
 * 
 * References:
 * - https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de
 * - https://trpc.io/docs/server/middlewares
 */

import { TRPCError } from "@trpc/server";
import type { Context } from "../trpc/context";
import { logger } from "../../utils/logger";

// First, import base tRPC without circular dependencies
import { initTRPC } from "@trpc/server";

// Initialize tRPC for middleware creation
const t = initTRPC.context<Context>().create();

// =====================================================
// RATE LIMITING MIDDLEWARE IMPLEMENTATION
// =====================================================

// Rate limit store for tRPC procedures
const rateLimitStore = new Map<
  string,
  Map<string, { count: number; resetTime: number }>
>();

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((procedureStore, procedurePath) => {
    procedureStore.forEach((userData, userId) => {
      if (userData.resetTime < now) {
        procedureStore.delete(userId);
      }
    });
    
    // Remove empty procedure stores
    if (procedureStore.size === 0) {
      rateLimitStore.delete(procedurePath);
    }
  });
}, 60000); // Clean up every minute

/**
 * Creates a tRPC rate limiter middleware using 2025 best practices
 */
export function createTRPCRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = "Too many requests" } = options;

  return t.middleware(async ({ ctx, next, path }) => {
    // Get user identifier (IP or user ID)
    const userId = ctx.user?.id || ctx.req.ip || "unknown";
    const procedurePath = path;

    // Get or create procedure-specific store
    if (!rateLimitStore.has(procedurePath)) {
      rateLimitStore.set(procedurePath, new Map());
    }
    const procedureStore = rateLimitStore.get(procedurePath)!;

    // Get or create user data
    const now = Date.now();
    let userData = procedureStore.get(userId);

    if (!userData || userData.resetTime < now) {
      userData = {
        count: 0,
        resetTime: now + windowMs,
      };
      procedureStore.set(userId, userData);
    }

    // Check rate limit
    if (userData.count >= max) {
      const retryAfter = Math.ceil((userData.resetTime - now) / 1000);

      logger.warn("tRPC rate limit exceeded", "TRPC_RATE_LIMITER", {
        userId,
        procedure: procedurePath,
        count: userData.count,
        max,
        retryAfter,
      });

      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `${message}. Please try again in ${retryAfter} seconds.`,
        cause: {
          retryAfter,
          limit: max,
          window: windowMs / 1000,
        },
      });
    }

    // Increment count
    userData.count++;

    // Continue with the request
    const result = await next();

    logger.debug("tRPC rate limiter passed", "TRPC_RATE_LIMITER", {
      userId,
      procedure: procedurePath,
      count: userData.count,
      max,
    });

    return result;
  });
}

// =====================================================
// PREDEFINED RATE LIMITERS FOR DIFFERENT PROCEDURES
// =====================================================

// Chat procedures - moderate rate limiting
export const chatProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 60000, // 1 minute
  max: 30, // 30 requests per minute
  message: "Too many chat requests",
});

// Agent procedures - stricter rate limiting
export const agentProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute
  message: "Too many agent requests",
});

// Task procedures - moderate rate limiting
export const taskProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 60000, // 1 minute
  max: 20, // 20 requests per minute
  message: "Too many task requests",
});

// RAG procedures - relaxed rate limiting
export const ragProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 60000, // 1 minute
  max: 50, // 50 requests per minute
  message: "Too many RAG requests",
});

// Strict procedures - very strict rate limiting
export const strictProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 60000, // 1 minute
  max: 5, // 5 requests per minute
  message: "Too many sensitive requests",
});

// =====================================================
// CENTRALIZED RATE LIMITER CLASS
// =====================================================

export class TRPCRateLimiterManager {
  private static instance: TRPCRateLimiterManager;
  private limiters: Map<string, ReturnType<typeof createTRPCRateLimiter>> = new Map();

  private constructor() {}

  static getInstance(): TRPCRateLimiterManager {
    if (!TRPCRateLimiterManager.instance) {
      TRPCRateLimiterManager.instance = new TRPCRateLimiterManager();
    }
    return TRPCRateLimiterManager.instance;
  }

  createLimiter(name: string, options: RateLimitOptions) {
    const limiter = createTRPCRateLimiter(options);
    this.limiters.set(name, limiter);
    return limiter;
  }

  getLimiter(name: string) {
    return this.limiters.get(name);
  }

  clearStats() {
    rateLimitStore.clear();
  }

  getStats() {
    const stats = new Map<string, { totalUsers: number; totalRequests: number }>();
    
    rateLimitStore.forEach((procedureStore, procedurePath) => {
      let totalRequests = 0;
      procedureStore.forEach((userData) => {
        totalRequests += userData.count;
      });
      
      stats.set(procedurePath, {
        totalUsers: procedureStore.size,
        totalRequests,
      });
    });
    
    return stats;
  }
}

// Export the singleton instance
export const rateLimiterManager = TRPCRateLimiterManager.getInstance();