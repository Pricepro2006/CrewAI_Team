import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc/enhanced-router";
import type { Context } from "../trpc/context";
import { logger } from "../../utils/logger";

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
  for (const [_procedure, userMap] of rateLimitStore.entries()) {
    for (const [userId, data] of userMap.entries()) {
      if (data.resetTime < now) {
        userMap.delete(userId);
      }
    }
  }
}, 60 * 1000); // Every minute

export function createTRPCRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = "Too many requests" } = options;

  return middleware(async ({ ctx, next, path }) => {
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

    // Continue with the procedure
    return next();
  });
}

// Pre-configured rate limiters for different procedure types
export const chatProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: "Too many chat messages",
});

export const agentProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: "Too many agent execution requests",
});

export const taskProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: "Too many task submissions",
});

export const ragProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: "Too many RAG queries",
});

// Strict rate limiter for expensive operations
export const strictProcedureRateLimiter = createTRPCRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: "This operation is resource-intensive",
});

// Dynamic rate limiter based on system load
export class DynamicTRPCRateLimiter {
  private baseMax: number;
  private currentMax: number;
  private systemLoad: number = 0;

  constructor(
    private windowMs: number = 60 * 1000,
    baseMax: number = 20,
  ) {
    this.baseMax = baseMax;
    this.currentMax = baseMax;

    // Update system load periodically
    setInterval(() => {
      this.updateSystemLoad();
    }, 10000);
  }

  private updateSystemLoad() {
    // In production, this would check actual system metrics
    // For now, using a simple calculation
    const procedureCount = rateLimitStore.size;
    let totalRequests = 0;

    for (const [_procedure, userMap] of rateLimitStore.entries()) {
      for (const [_userId, data] of userMap.entries()) {
        totalRequests += data.count;
      }
    }

    this.systemLoad = Math.min(totalRequests / 1000, 1); // Normalize to 0-1

    // Adjust limits based on load
    if (this.systemLoad > 0.8) {
      this.currentMax = Math.max(1, Math.floor(this.baseMax * 0.3));
    } else if (this.systemLoad > 0.6) {
      this.currentMax = Math.max(1, Math.floor(this.baseMax * 0.6));
    } else {
      this.currentMax = this.baseMax;
    }
  }

  createLimiter() {
    return createTRPCRateLimiter({
      windowMs: this.windowMs,
      max: this.currentMax,
      message: `System under load. Limited to ${this.currentMax} requests per ${this.windowMs / 1000} seconds`,
    });
  }
}

// Export dynamic rate limiter instance
export const dynamicTRPCRateLimiter = new DynamicTRPCRateLimiter();
