import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import {
  generateCSRFToken,
  setCSRFCookie,
  getStoredCSRFToken,
  getRequestCSRFToken,
  validateCSRFToken,
  createEnhancedCSRFProtection,
  ensureCSRFToken,
  shouldRotateToken,
  updateTokenMetadata,
} from "../csrf";

// Mock logger
vi.mock("../../../../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CSRF Protection", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockContext: unknown;

  beforeEach(() => {
    // Reset mocks
    mockReq = {
      headers: {},
      cookies: {},
      body: {},
      query: {},
      ip: "127.0.0.1",
    };

    mockRes = {
      cookie: vi.fn(),
      setHeader: vi.fn(),
    };

    mockContext = {
      req: mockReq,
      res: mockRes,
      user: { id: "test-user", role: "user" },
      requestId: "test-request",
    };

    // Clear token metadata between tests
    vi.clearAllMocks();
  });

  describe("generateCSRFToken", () => {
    it("should generate a 64-character hex token", () => {
      const token = generateCSRFToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should generate unique tokens", () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("setCSRFCookie", () => {
    it("should set secure httpOnly cookie in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      setCSRFCookie(mockRes as Response, "test-token", true);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        "__Host-csrf-token",
        "test-token",
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: 24 * 60 * 60 * 1000,
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("should set non-secure cookie in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      setCSRFCookie(mockRes as Response, "test-token", true);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        "__Host-csrf-token",
        "test-token",
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: "strict",
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("getStoredCSRFToken", () => {
    it("should get token from cookie", () => {
      mockReq.cookies = { "__Host-csrf-token": "cookie-token" };
      const token = getStoredCSRFToken(mockReq as Request);
      expect(token).toBe("cookie-token");
    });

    it("should get token from session if no cookie", () => {
      (mockReq as any).session = { csrfToken: "session-token" };
      const token = getStoredCSRFToken(mockReq as Request);
      expect(token).toBe("session-token");
    });

    it("should prefer cookie over session", () => {
      mockReq.cookies = { "__Host-csrf-token": "cookie-token" };
      (mockReq as any).session = { csrfToken: "session-token" };
      const token = getStoredCSRFToken(mockReq as Request);
      expect(token).toBe("cookie-token");
    });
  });

  describe("getRequestCSRFToken", () => {
    it("should get token from header", () => {
      mockReq.headers = { "x-csrf-token": "header-token" };
      const token = getRequestCSRFToken(mockReq as Request);
      expect(token).toBe("header-token");
    });

    it("should get token from body", () => {
      mockReq.body = { _csrf: "body-token" };
      const token = getRequestCSRFToken(mockReq as Request);
      expect(token).toBe("body-token");
    });

    it("should get token from query", () => {
      mockReq.query = { csrfToken: "query-token" };
      const token = getRequestCSRFToken(mockReq as Request);
      expect(token).toBe("query-token");
    });

    it("should prefer header over body and query", () => {
      mockReq.headers = { "x-csrf-token": "header-token" };
      mockReq.body = { _csrf: "body-token" };
      mockReq.query = { csrfToken: "query-token" };
      const token = getRequestCSRFToken(mockReq as Request);
      expect(token).toBe("header-token");
    });
  });

  describe("validateCSRFToken", () => {
    it("should validate matching tokens", () => {
      const result = validateCSRFToken("test-token", "test-token");
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should reject missing request token", () => {
      const result = validateCSRFToken(undefined, "stored-token");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing request token");
    });

    it("should reject missing stored token", () => {
      const result = validateCSRFToken("request-token", undefined);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing stored token");
    });

    it("should reject mismatched tokens", () => {
      const result = validateCSRFToken("token1", "token2");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Token mismatch");
    });
  });

  describe("createEnhancedCSRFProtection", () => {
    const csrfProtection = createEnhancedCSRFProtection();

    it("should skip CSRF check for queries", async () => {
      const next = vi.fn().mockResolvedValue("result");
      const result = await csrfProtection({
        ctx: mockContext,
        next,
        type: "query",
      });

      expect(result).toBe("result");
      expect(next).toHaveBeenCalled();
    });

    it("should skip CSRF check for subscriptions", async () => {
      const next = vi.fn().mockResolvedValue("result");
      const result = await csrfProtection({
        ctx: mockContext,
        next,
        type: "subscription",
      });

      expect(result).toBe("result");
      expect(next).toHaveBeenCalled();
    });

    it("should throw error for mutations without CSRF token", async () => {
      const next = vi.fn();

      await expect(
        csrfProtection({
          ctx: mockContext,
          next,
          type: "mutation",
        }),
      ).rejects.toThrow(TRPCError);

      expect(next).not.toHaveBeenCalled();
    });

    it("should allow mutations with valid CSRF token", async () => {
      const token = "valid-token";
      mockReq.headers = { "x-csrf-token": token };
      mockReq.cookies = { "__Host-csrf-token": token };

      const next = vi.fn().mockResolvedValue("result");
      const result = await csrfProtection({
        ctx: mockContext,
        next,
        type: "mutation",
      });

      expect(result).toBe("result");
      expect(next).toHaveBeenCalled();
    });

    it("should handle token rotation", async () => {
      const oldToken = "old-token";
      mockReq.headers = { "x-csrf-token": oldToken };
      mockReq.cookies = { "__Host-csrf-token": oldToken };

      // Force token to be old enough for rotation
      updateTokenMetadata(oldToken, "test-user");
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 60 * 60 * 1000); // 2 hours later

      const next = vi.fn().mockResolvedValue("result");
      await csrfProtection({
        ctx: mockContext,
        next,
        type: "mutation",
      });

      // Should have set a new cookie
      expect(mockRes.cookie).toHaveBeenCalled();
      // Context should have new token
      expect(mockContext.csrfToken).toBeDefined();
      expect(mockContext.csrfToken).not.toBe(oldToken);
    });
  });

  describe("ensureCSRFToken", () => {
    const tokenProvider = ensureCSRFToken();

    it("should generate token if none exists", async () => {
      const next = vi.fn().mockResolvedValue("result");

      await tokenProvider({
        ctx: mockContext,
        next,
      });

      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockContext.csrfToken).toBeDefined();
      expect(mockContext.csrfToken).toHaveLength(64);
      expect(next).toHaveBeenCalled();
    });

    it("should use existing token if present", async () => {
      const existingToken = "existing-token";
      mockReq.cookies = { "__Host-csrf-token": existingToken };

      const next = vi.fn().mockResolvedValue("result");

      await tokenProvider({
        ctx: mockContext,
        next,
      });

      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockContext.csrfToken).toBe(existingToken);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Integration with auth system", () => {
    it("should work with authenticated users", async () => {
      const token = "auth-test-token";
      mockReq.headers = { "x-csrf-token": token };
      mockReq.cookies = { "__Host-csrf-token": token };
      mockContext.user = {
        id: "auth-user",
        username: "testuser",
        role: "user",
        isActive: true,
      };

      const csrfProtection = createEnhancedCSRFProtection();
      const next = vi.fn().mockResolvedValue("result");

      const result = await csrfProtection({
        ctx: mockContext,
        next,
        type: "mutation",
      });

      expect(result).toBe("result");
      expect(next).toHaveBeenCalled();
    });

    it("should work with guest users", async () => {
      const token = "guest-test-token";
      mockReq.headers = { "x-csrf-token": token };
      mockReq.cookies = { "__Host-csrf-token": token };
      mockContext.user = {
        id: "guest-127-0-0-1-123456",
        username: "guest",
        role: "user",
        isActive: true,
      };

      const csrfProtection = createEnhancedCSRFProtection();
      const next = vi.fn().mockResolvedValue("result");

      const result = await csrfProtection({
        ctx: mockContext,
        next,
        type: "mutation",
      });

      expect(result).toBe("result");
      expect(next).toHaveBeenCalled();
    });
  });
});
