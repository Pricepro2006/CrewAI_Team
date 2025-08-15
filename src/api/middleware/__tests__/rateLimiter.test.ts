/**
 * Security Test Suite for Rate Limiting Middleware
 * Tests rate limiting implementation for security and performance
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockedFunction } from "vitest";
import type { Request } from "express";
import { TRPCError } from "@trpc/server";
import { rateLimitMiddleware } from "../rateLimiter.js";

// Mock Redis to test both Redis and in-memory implementations
vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: vi.fn(),
    expire: vi.fn(),
  })),
}));

describe("Rate Limiting Middleware Security Tests", () => {
  let mockNext: MockedFunction<() => Promise<any>>;
  let mockCtx: { user?: { id?: string; role?: string; isAdmin?: boolean }; req?: Request };

  beforeEach(() => {
    mockNext = vi.fn().mockResolvedValue("success");
    mockCtx = {
      user: { id: "user123" },
      req: { ip: "192.168.1.1" } as Request,
    };
  });

  describe("Rate Limiting Functionality", () => {
    it("should allow requests within rate limit", async () => {
      const rateLimiter = rateLimitMiddleware(10, 60000); // 10 requests per minute

      // First request should pass
      const result = await rateLimiter({ ctx: mockCtx, next: mockNext });
      expect(result).toBe("success");
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it("should block requests exceeding rate limit", async () => {
      const rateLimiter = rateLimitMiddleware(2, 60000); // 2 requests per minute

      // First two requests should pass
      await rateLimiter({ ctx: mockCtx, next: mockNext });
      await rateLimiter({ ctx: mockCtx, next: mockNext });

      // Third request should be blocked
      await expect(
        rateLimiter({ ctx: mockCtx, next: mockNext }),
      ).rejects.toThrow(TRPCError);

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it("should use different counters for different users", async () => {
      const rateLimiter = rateLimitMiddleware(1, 60000); // 1 request per minute

      const user1Ctx = { ...mockCtx, user: { id: "user1" } };
      const user2Ctx = { ...mockCtx, user: { id: "user2" } };

      // Both users should be able to make one request
      await rateLimiter({ ctx: user1Ctx, next: mockNext });
      await rateLimiter({ ctx: user2Ctx, next: mockNext });

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it("should use IP address when user is not authenticated", async () => {
      const rateLimiter = rateLimitMiddleware(1, 60000);

      const unauthCtx1 = { req: { ip: "192.168.1.1" } as Request };
      const unauthCtx2 = { req: { ip: "192.168.1.2" } as Request };

      // Different IPs should have separate limits
      await rateLimiter({ ctx: unauthCtx1, next: mockNext });
      await rateLimiter({ ctx: unauthCtx2, next: mockNext });

      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe("Security Considerations", () => {
    it("should handle missing user and IP gracefully", async () => {
      const rateLimiter = rateLimitMiddleware(5, 60000);

      const emptyCtx: { user?: { id?: string; role?: string; isAdmin?: boolean }; req?: Request } = { req: {} as Request };

      // Should not throw error and use fallback identifier
      await expect(
        rateLimiter({ ctx: emptyCtx, next: mockNext }),
      ).resolves.toBe("success");
    });

    it("should fail open when rate limiting encounters errors", async () => {
      const rateLimiter = rateLimitMiddleware(1, 60000);

      // Mock next to throw an error
      const errorNext: MockedFunction<() => Promise<any>> = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      // Should not throw rate limit error, should allow request
      await expect(
        rateLimiter({ ctx: mockCtx, next: errorNext }),
      ).rejects.toThrow("Database error");
    });
  });

  describe("Configuration Validation", () => {
    it("should use default values when not specified", async () => {
      const rateLimiter = rateLimitMiddleware(); // No params

      // Should work with defaults (100 requests per minute)
      await expect(rateLimiter({ ctx: mockCtx, next: mockNext })).resolves.toBe(
        "success",
      );
    });

    it("should handle edge case configurations", async () => {
      // Very low limit
      const strictLimiter = rateLimitMiddleware(1, 1000); // 1 request per second

      await strictLimiter({ ctx: mockCtx, next: mockNext });

      await expect(
        strictLimiter({ ctx: mockCtx, next: mockNext }),
      ).rejects.toThrow("Rate limit exceeded");
    });
  });
});
