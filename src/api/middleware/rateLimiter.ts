import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { appConfig } from "../../config/app.config";
import { logger } from "../../utils/logger";
import { wsService } from "../services/WebSocketService";

// Store for tracking rate limit violations
const violationStore = new Map<string, number>();

// Create different rate limiters for different endpoints
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
}) => {
  const {
    windowMs = appConfig.security.rateLimiting.windowMs,
    max = appConfig.security.rateLimiting.maxRequests,
    message = "Too many requests, please try again later.",
    keyGenerator = (req: Request) => {
      // Use ipKeyGenerator helper for proper IPv6 handling (2025 best practices)
      return ipKeyGenerator(req.ip || "unknown");
    },
    handler,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    keyGenerator,
    handler:
      handler ||
      ((req: Request, res: Response) => {
        const key = keyGenerator(req);
        const violations = (violationStore.get(key) || 0) + 1;
        violationStore.set(key, violations);

        logger.warn("Rate limit exceeded", "RATE_LIMITER", {
          ip: req.ip,
          path: req.path,
          violations,
          userAgent: req.get("user-agent"),
        });

        // Broadcast system health update if too many violations
        if (violations > 10) {
          wsService.broadcastSystemHealth(
            {
              api: "degraded",
              database: "healthy",
              ollama: "healthy",
              vectorstore: "healthy",
            },
            {
              activeAgents: 0,
              queueLength: 0,
            },
          );
        }

        res.status(429).json({
          error: "Too Many Requests",
          message,
          retryAfter: windowMs / 1000,
          violations,
        });
      }),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === "/health";
    },
  });
};

// General API rate limiter
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: "Too many API requests, please slow down.",
});

// Strict rate limiter for expensive operations
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message:
    "This operation is resource-intensive. Please wait before trying again.",
});

// Chat-specific rate limiter
export const chatRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  message: "Too many chat messages, please slow down.",
  keyGenerator: (req: Request) => {
    // If we have user authentication, use user ID
    // Otherwise fall back to IP using ipKeyGenerator for proper IPv6 handling
    const userId = (req as any).user?.id;
    return userId || ipKeyGenerator(req.ip || "unknown");
  },
});

// Agent execution rate limiter
export const agentRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 agent executions per 5 minutes
  message:
    "Too many agent execution requests. Please wait before submitting more tasks.",
});

// File operation rate limiter
export const fileOperationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 file operations per minute
  message:
    "Too many file operations. Please wait before performing more file actions.",
});

// Authentication rate limiter
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: "Too many authentication attempts. Please try again later.",
  handler: (req: Request, res: Response) => {
    // const key = req.ip || "unknown";

    logger.error("Potential brute force attack detected", "AUTH_RATE_LIMITER", {
      ip: req.ip,
      path: req.path,
      userAgent: req.get("user-agent"),
      body: { ...req.body, password: "[REDACTED]" },
    });

    // Lock out the IP after too many attempts
    res.status(429).json({
      error: "Account Locked",
      message:
        "Too many failed authentication attempts. Your account has been temporarily locked.",
      lockDuration: 15 * 60, // 15 minutes in seconds
    });
  },
});

// Dynamic rate limiter that adjusts based on system load
export class DynamicRateLimiter {
  private baseMax: number;
  private currentMax: number;
  private systemLoad: number = 0;

  constructor(baseMax: number = 30) {
    this.baseMax = baseMax;
    this.currentMax = baseMax;

    // Update system load periodically
    setInterval(() => {
      this.updateSystemLoad();
    }, 10000); // Every 10 seconds
  }

  private async updateSystemLoad() {
    // In a real implementation, this would check actual system metrics
    // For now, we'll use a simple calculation based on active requests
    const activeRequests = Math.random() * 100; // Placeholder
    this.systemLoad = activeRequests / 100;

    // Adjust rate limit based on load
    if (this.systemLoad > 0.8) {
      this.currentMax = Math.floor(this.baseMax * 0.5); // Reduce to 50%
    } else if (this.systemLoad > 0.6) {
      this.currentMax = Math.floor(this.baseMax * 0.75); // Reduce to 75%
    } else {
      this.currentMax = this.baseMax; // Full capacity
    }
  }

  createLimiter() {
    return createRateLimiter({
      windowMs: 60 * 1000,
      max: this.currentMax,
      message: `System under high load. Limited to ${this.currentMax} requests per minute.`,
    });
  }
}

// Export a dynamic rate limiter instance
export const dynamicRateLimiter = new DynamicRateLimiter(30);

// Cleanup old violation records periodically
setInterval(
  () => {
    const now = Date.now();
    const expirationTime = 60 * 60 * 1000; // 1 hour

    for (const [key, _violations] of violationStore.entries()) {
      // In a real implementation, we'd track timestamps
      // For now, just clear old entries periodically
      violationStore.delete(key);
    }
  },
  60 * 60 * 1000,
); // Every hour
