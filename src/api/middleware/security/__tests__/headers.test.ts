/**
 * Tests for comprehensive security headers middleware
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from "express";
import {
  getSecurityHeadersConfig,
  createCorsMiddleware,
  createSecurityHeadersMiddleware,
  createOriginValidationMiddleware,
  testSecurityHeaders,
} from '../headers';

// Mock Express response
function createMockResponse(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    removeHeader: vi.fn((name: string) => {
      delete headers[name.toLowerCase()];
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
}

// Mock Express request
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    method: "GET",
    path: "/api/test",
    ip: "127.0.0.1",
    ...overrides,
  } as any;
}

describe("Security Headers Middleware", () => {
  beforeEach(() => {
    // Reset environment
    process.env.NODE_ENV = "test";
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
    delete process.env.PRODUCTION_ORIGINS;
  });

  describe("getSecurityHeadersConfig", () => {
    test("should return default configuration for development", () => {
      process.env.NODE_ENV = "development";
      const config = getSecurityHeadersConfig();

      expect(config?.cors).toContain("http://localhost:3000");
      expect(config?.cors).toBe(true);
      expect(config?.csp).toContain("'unsafe-inline'");
      expect(config?.hsts).toBeDefined();
    });

    test("should return secure configuration for production", () => {
      process.env.NODE_ENV = "production";
      const config = getSecurityHeadersConfig();

      expect(config?.csp).not.toContain("'unsafe-inline'");
      expect(config?.hsts).toBe(31536000);
      expect(config?.hsts?.length).toBe(true);
    });

    test("should use environment variables for origins", () => {
      process.env.ALLOWED_ORIGINS =
        "https://app.example?.com,https://api?.example?.com";
      const config = getSecurityHeadersConfig();

      expect(config?.cors).toContain("https://app.example?.com");
      expect(config?.cors).toContain("https://api?.example?.com");
    });
  });

  describe("createSecurityHeadersMiddleware", () => {
    test("should set all required security headers", () => {
      const middleware = createSecurityHeadersMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Security-Policy",
        expect.any(String),
      );
      expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
      expect(res.setHeader).toHaveBeenCalledWith(
        "X-Content-Type-Options",
        "nosniff",
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "X-XSS-Protection",
        "1; mode=block",
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Referrer-Policy",
        "strict-origin-when-cross-origin",
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Permissions-Policy",
        expect.any(String),
      );
      expect(res.removeHeader).toHaveBeenCalledWith("X-Powered-By");
      expect(res.removeHeader).toHaveBeenCalledWith("Server");
      expect(next).toHaveBeenCalled();
    });

    test("should set HSTS header in production", () => {
      process.env.NODE_ENV = "production";
      const middleware = createSecurityHeadersMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    });

    test("should include CSP directives correctly", () => {
      const middleware = createSecurityHeadersMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      const csp = res.headers["content-security-policy"];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
      expect(csp).toContain("img-src 'self' data: blob: https:");
      expect(csp).toContain("font-src 'self'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe("createOriginValidationMiddleware", () => {
    test("should allow same-origin requests", () => {
      const middleware = createOriginValidationMiddleware([
        "https://example.com",
      ]);
      const req = createMockRequest({
        headers: { host: "example.com" },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should allow requests without origin header", () => {
      const middleware = createOriginValidationMiddleware([
        "https://example.com",
      ]);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should allow whitelisted origins", () => {
      const middleware = createOriginValidationMiddleware([
        "https://allowed.com",
      ]);
      const req = createMockRequest({
        headers: { origin: "https://allowed.com" },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test("should block non-whitelisted origins", () => {
      const middleware = createOriginValidationMiddleware([
        "https://allowed.com",
      ]);
      const req = createMockRequest({
        headers: { origin: "https://malicious.com" },
      });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden: Invalid origin",
      });
    });
  });

  describe("testSecurityHeaders", () => {
    test("should pass with all required headers", () => {
      const headers = {
        "content-security-policy": "default-src 'self'",
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "x-xss-protection": "1; mode=block",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=()",
      };

      const result = testSecurityHeaders(headers);

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test("should fail with missing headers", () => {
      const headers = {
        "x-frame-options": "DENY",
      };

      const result = testSecurityHeaders(headers);

      expect(result.passed).toBe(false);
      expect(result.issues).toContain(
        "Missing required header: Content-Security-Policy",
      );
      expect(result.issues).toContain(
        "Missing required header: X-Content-Type-Options",
      );
    });

    test("should fail with dangerous headers present", () => {
      const headers = {
        "content-security-policy": "default-src 'self'",
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "x-xss-protection": "1; mode=block",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=()",
        "x-powered-by": "Express",
        server: "nginx/1.0",
      };

      const result = testSecurityHeaders(headers);

      expect(result.passed).toBe(false);
      expect(result.issues).toContain("Dangerous header present: X-Powered-By");
      expect(result.issues).toContain("Dangerous header present: Server");
    });

    test("should fail with unsafe CSP in production", () => {
      process.env.NODE_ENV = "production";
      const headers = {
        "content-security-policy":
          "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "x-xss-protection": "1; mode=block",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=()",
      };

      const result = testSecurityHeaders(headers);

      expect(result.passed).toBe(false);
      expect(result.issues).toContain(
        "CSP contains 'unsafe-inline' in production",
      );
      expect(result.issues).toContain(
        "CSP contains 'unsafe-eval' in production",
      );
    });

    test("should fail without HSTS in production", () => {
      process.env.NODE_ENV = "production";
      const headers = {
        "content-security-policy": "default-src 'self'",
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "x-xss-protection": "1; mode=block",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=()",
      };

      const result = testSecurityHeaders(headers);

      expect(result.passed).toBe(false);
      expect(result.issues).toContain("Missing HSTS header in production");
    });
  });
});
