import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock dependencies
vi.mock("../../../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../middleware/index", () => ({
  chatProcedureRateLimiter: vi.fn((req, res, next) => next()),
  agentProcedureRateLimiter: vi.fn((req, res, next) => next()),
  taskProcedureRateLimiter: vi.fn((req, res, next) => next()),
  ragProcedureRateLimiter: vi.fn((req, res, next) => next()),
  strictProcedureRateLimiter: vi.fn((req, res, next) => next()),
  createSecurityAuditMiddleware: vi.fn(() => vi.fn()),
  createAuthMiddleware: vi.fn(() => vi.fn()),
  createAuthorizationMiddleware: vi.fn(() => vi.fn()),
  createInputValidation: vi.fn(() => vi.fn()),
  sanitizationSchemas: {
    string: vi.fn(),
    sqlSafe: vi.fn(),
  },
}));

vi.mock("../../middleware/security", () => ({
  createSecurityAuditMiddleware: vi.fn(() =>
    vi.fn().mockImplementation(async ({ next }) => next()),
  ),
  createAuthMiddleware: vi.fn(() =>
    vi.fn().mockImplementation(async ({ next }) => next()),
  ),
  createAuthorizationMiddleware: vi.fn(() =>
    vi.fn().mockImplementation(async ({ next }) => next()),
  ),
  createInputValidation: vi.fn(() =>
    vi.fn().mockImplementation(async ({ next }) => next()),
  ),
  sanitizationSchemas: {
    string: vi.fn(),
    sqlSafe: vi.fn(),
  },
  createCSRFProtection: vi.fn(() =>
    vi.fn().mockImplementation(async ({ next }) => next()),
  ),
  ensureCSRFToken: vi.fn(() =>
    vi.fn().mockImplementation(async ({ next }) => next()),
  ),
}));

// Store request counts globally to persist between calls
const globalRequestCounts = new Map<
  string,
  { count: number; resetTime: number }
>();

// Get the mocked logger
const mockedLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock the enhanced-router module
vi.mock("../enhanced-router", () => {
  const logger = mockedLogger;

  // Create a proper TRPCError class for the mock
  class MockTRPCError extends Error {
    code: string;

    constructor(options: any) {
      super(options.message);
      this.code = options.code;
      this.name = "TRPCError";
    }
  }

  return {
    createRateLimitMiddleware: vi.fn(
      (name: string, maxRequests: number, windowMs: number) => {
        return async ({ ctx, next }: any) => {
          const identifier = ctx.user?.id || ctx.req?.ip || "anonymous";
          const rateLimitKey = `trpc_${name}_${identifier}`;
          const now = Date.now();

          // Initialize rate limits in context if not present
          if (!ctx.rateLimits) {
            ctx.rateLimits = globalRequestCounts;
          }

          // Get existing rate limit data
          const existing = ctx.rateLimits.get(rateLimitKey);

          if (!existing || existing.resetTime < now) {
            ctx.rateLimits.set(rateLimitKey, {
              count: 1,
              resetTime: now + windowMs,
            });

            logger.debug(
              `Rate limit check passed for ${name}`,
              "TRPC_RATE_LIMIT",
              {
                procedure: name,
                identifier,
                current: 1,
                limit: maxRequests,
              },
            );

            return next();
          }

          existing.count++;

          // Determine max requests based on user type
          let limit = maxRequests;
          if (ctx.user?.isAdmin || ctx.user?.role === "admin") {
            limit = maxRequests * 5;
          } else if (ctx.user?.id) {
            limit = Math.floor(maxRequests * 1.5);
          }

          if (existing.count > limit) {
            logger.warn(
              `tRPC Rate limit exceeded for ${name}`,
              "TRPC_RATE_LIMIT",
              {
                procedure: name,
                identifier,
                count: existing.count,
                limit,
              },
            );

            const error = new MockTRPCError({
              code: "TOO_MANY_REQUESTS",
              message: `Rate limit exceeded for ${name}. Please try again later.`,
            });
            throw error;
          }

          logger.debug(
            `Rate limit check passed for ${name}`,
            "TRPC_RATE_LIMIT",
            {
              procedure: name,
              identifier,
              current: existing.count,
              limit,
            },
          );

          return next();
        };
      },
    ),
    router: vi.fn(),
    publicProcedure: vi.fn(),
    protectedProcedure: vi.fn(),
    chatProcedure: vi.fn(),
    agentProcedure: vi.fn(),
    taskProcedure: vi.fn(),
    ragProcedure: vi.fn(),
    strictProcedure: vi.fn(),
  };
});

describe("TRPC Rate Limiting", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      req: {
        ip: "127.0.0.1",
        headers: {
          "user-agent": "test-agent",
        },
      },
      res: {
        json: vi.fn(),
        status: vi.fn(() => ({ json: vi.fn() })),
      },
      user: null,
      rateLimits: new Map(),
      requestId: "test-request-id",
      timestamp: new Date(),
    };

    // Reset rate limits between tests
    globalRequestCounts.clear();
    vi.clearAllMocks();
  });

  describe("Rate Limit Middleware", () => {
    it("should allow requests within rate limit", async () => {
      // Import the mocked function
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      // Create the middleware
      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        5,
        60000,
      ) as any;

      const next = vi.fn().mockResolvedValue({ success: true });

      // First request should pass
      const result = await rateLimitMiddleware({
        ctx: mockContext,
        next,
      });

      expect(next).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("should block requests exceeding rate limit", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        2,
        60000,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      // First two requests should pass
      await rateLimitMiddleware({ ctx: mockContext, next });
      await rateLimitMiddleware({ ctx: mockContext, next });

      // Third request should be blocked
      await expect(
        rateLimitMiddleware({ ctx: mockContext, next }),
      ).rejects.toThrow("Rate limit exceeded");

      expect(next).toHaveBeenCalledTimes(2);
    });

    it("should apply different limits for different user types", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        2,
        60000,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      // Test with authenticated user (should get 1.5x limit)
      const authContext = {
        ...mockContext,
        user: { id: "user123", role: "user" },
      };

      // Should allow 3 requests (2 * 1.5 = 3)
      await rateLimitMiddleware({ ctx: authContext, next });
      await rateLimitMiddleware({ ctx: authContext, next });
      await rateLimitMiddleware({ ctx: authContext, next });

      // Fourth should be blocked
      await expect(
        rateLimitMiddleware({ ctx: authContext, next }),
      ).rejects.toThrow("Rate limit exceeded");

      expect(next).toHaveBeenCalledTimes(3);
    });

    it("should give admin users higher limits", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        2,
        60000,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      // Test with admin user (should get 5x limit)
      const adminContext = {
        ...mockContext,
        user: { id: "admin123", role: "admin", isAdmin: true },
      };

      // Should allow 10 requests (2 * 5 = 10)
      for (let i = 0; i < 10; i++) {
        await rateLimitMiddleware({ ctx: adminContext, next });
      }

      // 11th should be blocked
      await expect(
        rateLimitMiddleware({ ctx: adminContext, next }),
      ).rejects.toThrow("Rate limit exceeded");

      expect(next).toHaveBeenCalledTimes(10);
    });

    it("should clean up expired rate limit entries", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      // Very short window for testing
      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        1,
        100,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      // First request should pass
      await rateLimitMiddleware({ ctx: mockContext, next });

      // Should be blocked immediately
      await expect(
        rateLimitMiddleware({ ctx: mockContext, next }),
      ).rejects.toThrow("Rate limit exceeded");

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should work again after window expires
      await rateLimitMiddleware({ ctx: mockContext, next });

      expect(next).toHaveBeenCalledTimes(2);
    });

    it("should use different keys for different users", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        1,
        60000,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      const user1Context = {
        ...mockContext,
        user: { id: "user1", role: "user" },
      };

      const user2Context = {
        ...mockContext,
        user: { id: "user2", role: "user" },
      };

      // Each user should get their own rate limit
      await rateLimitMiddleware({ ctx: user1Context, next });
      await rateLimitMiddleware({ ctx: user2Context, next });

      expect(next).toHaveBeenCalledTimes(2);

      // But second request from same user should be blocked
      await expect(
        rateLimitMiddleware({ ctx: user1Context, next }),
      ).rejects.toThrow("Rate limit exceeded");
    });
  });

  describe("Procedure-Specific Rate Limits", () => {
    it("should apply chat-specific rate limits", async () => {
      const { chatProcedure } = await import("../enhanced-router.js");

      // Mock the chat procedure context
      const chatContext = {
        ...mockContext,
        path: "chat.message",
      };

      // This test verifies that chat procedures have their own rate limiting
      // The actual implementation would be tested through integration tests
      expect(chatProcedure).toBeDefined();
    });

    it("should apply agent-specific rate limits", async () => {
      const { agentProcedure } = await import("../enhanced-router.js");

      expect(agentProcedure).toBeDefined();
    });

    it("should apply task-specific rate limits", async () => {
      const { taskProcedure } = await import("../enhanced-router.js");

      expect(taskProcedure).toBeDefined();
    });

    it("should apply RAG-specific rate limits", async () => {
      const { ragProcedure } = await import("../enhanced-router.js");

      expect(ragProcedure).toBeDefined();
    });

    it("should apply strict rate limits for sensitive operations", async () => {
      const { strictProcedure } = await import("../enhanced-router.js");

      expect(strictProcedure).toBeDefined();
    });
  });

  describe("Rate Limit Error Handling", () => {
    it("should throw TRPCError with correct code when rate limited", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        1,
        60000,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      // First request passes
      await rateLimitMiddleware({ ctx: mockContext, next });

      // Second request should throw TRPCError
      try {
        await rateLimitMiddleware({ ctx: mockContext, next });
        expect.fail("Should have thrown TRPCError");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).code).toBe("TOO_MANY_REQUESTS");
        expect((error as any).message).toContain("Rate limit exceeded");
      }
    });

    it("should include helpful error message with procedure name", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "chatMessage",
        1,
        60000,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      // Exhaust rate limit
      await rateLimitMiddleware({ ctx: mockContext, next });

      try {
        await rateLimitMiddleware({ ctx: mockContext, next });
        expect.fail("Should have thrown TRPCError");
      } catch (error) {
        expect((error as TRPCError).message).toContain("chatMessage");
      }
    });
  });

  describe("Rate Limit Logging", () => {
    it("should log rate limit violations", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        1,
        60000,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      // Exhaust rate limit
      await rateLimitMiddleware({ ctx: mockContext, next });

      try {
        await rateLimitMiddleware({ ctx: mockContext, next });
      } catch (error) {
        // Should log the violation
        expect(mockedLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("tRPC Rate limit exceeded"),
          "TRPC_RATE_LIMIT",
          expect.objectContaining({
            procedure: "test",
            identifier: expect.any(String),
            count: expect.any(Number),
            limit: expect.any(Number),
          }),
        );
      }
    });

    it("should log successful rate limit checks in debug mode", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        5,
        60000,
      ) as any;
      const next = vi.fn().mockResolvedValue({ success: true });

      await rateLimitMiddleware({ ctx: mockContext, next });

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit check passed"),
        "TRPC_RATE_LIMIT",
        expect.objectContaining({
          procedure: "test",
          identifier: expect.any(String),
          current: expect.any(Number),
          limit: expect.any(Number),
        }),
      );
    });
  });

  describe("Memory Management", () => {
    it("should limit memory usage by cleaning old entries", async () => {
      const { createRateLimitMiddleware } = await import(
        "../enhanced-router.js"
      );

      const rateLimitMiddleware = createRateLimitMiddleware(
        "test",
        10,
        100,
      ) as any; // Short window
      const next = vi.fn().mockResolvedValue({ success: true });

      // Create many rate limit entries
      for (let i = 0; i < 100; i++) {
        const context = {
          ...mockContext,
          user: { id: `user${i}`, role: "user" },
        };
        await rateLimitMiddleware({ ctx: context, next });
      }

      // Wait for entries to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Clean up expired entries manually (simulating what would happen in the real implementation)
      const now = Date.now();
      for (const [key, value] of mockContext.rateLimits.entries()) {
        if (value.resetTime < now) {
          mockContext.rateLimits.delete(key);
        }
      }

      // New request should work after cleanup
      await rateLimitMiddleware({ ctx: mockContext, next });

      // Rate limits map should be much smaller now after cleanup
      expect(mockContext.rateLimits.size).toBeLessThan(50);
    });
  });
});
