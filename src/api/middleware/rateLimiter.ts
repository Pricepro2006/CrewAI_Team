import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import type { Request, Response } from "express";
import { TRPCError } from "@trpc/server";

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    role?: string;
    isAdmin?: boolean;
  };
}

// Enhanced Redis-based rate limiting with user awareness
let redisClient: Redis | null = null;
let redisConnected = false;

// Only attempt Redis connection in production or if explicitly enabled
if (
  process.env.NODE_ENV === "production" ||
  process.env.ENABLE_REDIS === "true"
) {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_RATE_LIMIT_DB || "1"),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on("error", (err: Error) => {
      console.warn(
        "Redis rate limiting unavailable, falling back to memory store:",
        err.message,
      );
      redisConnected = false;
    });

    redisClient.on("connect", () => {
      console.log("Redis connected for rate limiting");
      redisConnected = true;
    });

    // Try to connect
    redisClient.connect().catch(() => {
      console.warn("Redis connection failed, will use memory store");
      redisConnected = false;
    });
  } catch (error) {
    console.warn("Redis rate limiting setup failed, will use memory store");
    redisClient = null;
  }
}

// Enhanced key generator that considers user authentication status
function createKeyGenerator(prefix: string) {
  return (req: Request): string => {
    const user = (req as AuthenticatedRequest).user;

    // Use user ID if authenticated, otherwise return undefined to use default IP handling
    if (user?.id) {
      return `${prefix}:user:${user.id}`;
    }

    // Return undefined to let express-rate-limit handle IP extraction properly
    return undefined as unknown as string;
  };
}

// Enhanced rate limiter factory with Redis fallback
function createRateLimiter(options: {
  windowMs: number;
  max: number;
  maxAuthenticated?: number;
  maxAdmin?: number;
  message: string;
  keyPrefix: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) {
  const store =
    redisClient && redisConnected
      ? new RedisStore({
          sendCommand: async (command: string, ...args: string[]) => {
            const cmd = new (redisClient!.constructor as typeof Redis).Command(
              command,
              args,
            );
            const result = await redisClient!.sendCommand(cmd);
            return result as unknown; // Type assertion to match RedisReply interface
          },
          prefix: `rl:${options.keyPrefix}:`,
        })
      : undefined;

  return rateLimit({
    store,
    windowMs: options.windowMs,
    max: (req: Request) => {
      const user = (req as AuthenticatedRequest).user;

      // Admin users get higher limits
      if (user?.isAdmin || user?.role === "admin") {
        return options.maxAdmin || options.max * 10;
      }

      // Authenticated users get higher limits than anonymous
      if (user?.id) {
        return options.maxAuthenticated || Math.floor(options.max * 2);
      }

      // Anonymous users get base limit
      return options.max;
    },
    message: options.message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: createKeyGenerator(options.keyPrefix),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      const user = (req as AuthenticatedRequest).user;

      // Log rate limit violations
      console.warn("Rate limit exceeded:", {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userId: user?.id,
        userAgent: req.get("User-Agent"),
        endpoint: req.path,
        method: req.method,
        prefix: options.keyPrefix,
      });

      res.status(429).json({
        error: "Rate limit exceeded",
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000),
        type: "RATE_LIMIT_ERROR",
      });
    },
  });
}

// tRPC middleware for rate limiting with enhanced user awareness
export function rateLimitMiddleware(
  maxRequests: number = 100,
  windowMs: number = 60000,
  options: {
    maxAuthenticated?: number;
    maxAdmin?: number;
    keyPrefix?: string;
  } = {},
) {
  const store = new Map<string, { count: number; resetTime: number }>();

  return async ({ ctx, next }: { ctx: { user?: { id?: string; role?: string; isAdmin?: boolean }; req?: Request }; next: () => Promise<unknown> }) => {
    const user = ctx.user;
    const ip = ctx.req?.ip || "unknown";
    const identifier = user?.id ? `user:${user.id}` : `ip:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Determine rate limit based on user status
    let limit = maxRequests;
    if (user?.isAdmin || user?.role === "admin") {
      limit = options.maxAdmin || maxRequests * 10;
    } else if (user?.id) {
      limit = options.maxAuthenticated || Math.floor(maxRequests * 2);
    }

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
      if (existing.count > limit) {
        // Log the violation
        console.warn("TRPC Rate limit exceeded:", {
          timestamp: new Date().toISOString(),
          identifier,
          userId: user?.id,
          limit,
          count: existing.count,
          keyPrefix: options.keyPrefix,
        });

        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
        });
      }
    }

    return next();
  };
}

// Enhanced rate limiters with user awareness

// Standard API rate limiter
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development - Anonymous users
  maxAuthenticated: 2000, // Increased for development - Authenticated users
  maxAdmin: 5000, // Increased for development - Admin users
  message: "Too many requests from this IP, please try again later.",
  keyPrefix: "api",
});

// Authentication rate limiter (very strict)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Very strict for auth attempts
  maxAuthenticated: 10,
  maxAdmin: 50,
  message: "Too many authentication attempts, please try again later.",
  keyPrefix: "auth",
});

// Chat-specific rate limiter
export const chatProcedureRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Anonymous users
  maxAuthenticated: 60, // Authenticated users get 3x more
  maxAdmin: 200, // Admins get plenty
  message: "Too many chat requests, please slow down.",
  keyPrefix: "chat",
});

// Agent execution rate limiter
export const agentProcedureRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Anonymous users
  maxAuthenticated: 30, // Authenticated users
  maxAdmin: 100, // Admin users
  message: "Too many agent requests, please wait before retrying.",
  keyPrefix: "agent",
});

// Task execution rate limiter
export const taskProcedureRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 25, // Anonymous users
  maxAuthenticated: 75, // Authenticated users
  maxAdmin: 200, // Admin users
  message: "Too many task requests, please wait.",
  keyPrefix: "task",
});

// RAG query rate limiter
export const ragProcedureRateLimiter = createRateLimiter({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 15, // Anonymous users
  maxAuthenticated: 40, // Authenticated users
  maxAdmin: 100, // Admin users
  message: "Too many RAG queries, please slow down.",
  keyPrefix: "rag",
});

// File upload rate limiter (very strict)
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Anonymous users
  maxAuthenticated: 20, // Authenticated users
  maxAdmin: 100, // Admin users
  message: "File upload rate limit exceeded, please try again later.",
  keyPrefix: "upload",
  skipSuccessfulRequests: true, // Only count failed uploads
});

// Strict rate limiter for sensitive operations
export const strictProcedureRateLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 2, // Anonymous users
  maxAuthenticated: 10, // Authenticated users
  maxAdmin: 50, // Admin users
  message: "Rate limit exceeded for sensitive operations.",
  keyPrefix: "strict",
});

// Web search rate limiter
export const webSearchRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Anonymous users
  maxAuthenticated: 15, // Authenticated users
  maxAdmin: 50, // Admin users
  message: "Too many web search requests.",
  keyPrefix: "websearch",
});

// Business search rate limiter
export const businessSearchRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 8, // Anonymous users
  maxAuthenticated: 25, // Authenticated users
  maxAdmin: 75, // Admin users
  message: "Too many business search requests.",
  keyPrefix: "bizsearch",
});

// WebSocket connection rate limiter
export const websocketRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Anonymous connections
  maxAuthenticated: 30, // Authenticated connections
  maxAdmin: 100, // Admin connections
  message: "Too many WebSocket connections.",
  keyPrefix: "websocket",
});

// Premium tier rate limiter (deprecated - now using user-aware limits)
export const premiumRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // High limit for backwards compatibility
  message: "Premium rate limit exceeded.",
  keyPrefix: "premium",
});

// Rate limit status checker for admin endpoints
export async function getRateLimitStatus(req: Request): Promise<{
  identifier: string;
  current: number;
  limit: number;
  remaining: number;
  resetTime: Date;
}> {
  const user = (req as AuthenticatedRequest).user;
  const ip = req.ip || "unknown";
  const identifier = user?.id ? `user:${user.id}` : `ip:${ip}`;

  if (!redisClient) {
    return {
      identifier,
      current: 0,
      limit: 0,
      remaining: 0,
      resetTime: new Date(),
    };
  }

  try {
    const key = `rl:api:${identifier}`;
    const current = parseInt((await redisClient.get(key)) || "0");
    const ttl = await redisClient.ttl(key);

    // Determine limit based on user status
    let limit = 100; // Default for anonymous
    if (user?.isAdmin || user?.role === "admin") {
      limit = 2000;
    } else if (user?.id) {
      limit = 500;
    }

    return {
      identifier,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      resetTime: new Date(Date.now() + ttl * 1000),
    };
  } catch (error) {
    console.error("Error getting rate limit status:", error);
    throw error;
  }
}

// Cleanup function for graceful shutdown
export async function cleanupRateLimiting(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log("Rate limiting Redis connection closed");
    } catch (error) {
      console.error("Error closing rate limiting Redis connection:", error);
    }
  }
}
