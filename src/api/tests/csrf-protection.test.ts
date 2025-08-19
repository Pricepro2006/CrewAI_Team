import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateCSRFToken,
  setCSRFCookie,
  getStoredCSRFToken,
  getRequestCSRFToken,
  validateCSRFToken,
  getCSRFStats,
} from '../middleware/security/csrf';
import { csrfValidator } from '../middleware/csrfValidator';
import type { Request, Response, NextFunction } from "express";

// Mock request and response objects for testing
const createMockRequest = (options: {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  body?: any;
  query?: any;
  method?: string;
  path?: string;
  ip?: string;
}): Partial<Request> => ({
  cookies: options.cookies || {},
  headers: options.headers || {},
  body: options.body || {},
  query: options.query || {},
  method: options.method || 'GET',
  path: options.path || '/',
  ip: options.ip || '127.0.0.1',
});

const createMockResponse = (): Partial<Response> & { _cookies: any[]; _headers: Record<string, string>; _status?: number; _json?: any } => {
  const cookies: Array<{ name: string; value: string; options: any }> = [];
  const headers: Record<string, string> = {};
  let status: number | undefined;
  let jsonData: any;
  
  const mockResponse = {
    cookie: (name: string, value: string, options: any) => {
      cookies.push({ name, value, options });
      return mockResponse;
    },
    setHeader: (name: string, value: string) => {
      headers[name] = value;
      return mockResponse;
    },
    getHeader: (name: string) => headers[name],
    status: (code: number) => {
      status = code;
      return mockResponse;
    },
    json: (data: any) => {
      jsonData = data;
      return mockResponse;
    },
    _cookies: cookies,
    _headers: headers,
    get _status() { return status; },
    get _json() { return jsonData; },
  } as any;
  
  return mockResponse;
};

describe("CSRF Protection Unit Tests", () => {
  describe("Token Generation", () => {
    test("generateCSRFToken should create valid tokens", () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();

      expect(typeof token1).toBe("string");
      expect(typeof token2).toBe("string");
      expect(token1).toHaveLength(64); // 32 bytes * 2 hex chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2); // Tokens should be unique
      expect(/^[0-9a-f]+$/.test(token1)).toBe(true); // Should be hex
    });

    test("setCSRFCookie should set cookie with correct attributes", () => {
      const token = generateCSRFToken();
      const mockRes = createMockResponse();
      
      setCSRFCookie(mockRes as Response, token, false);
      
      expect(mockRes._cookies).toHaveLength(1);
      const cookie = mockRes._cookies[0];
      
      expect(cookie.name).toMatch(/csrf-token/);
      expect(cookie.value).toBe(token);
      expect(cookie?.options?.length).toBe(true);
      expect(cookie?.options?.length).toBe("strict");
      expect(cookie?.options?.length).toBe("/");
      expect(typeof cookie?.options?.length).toBe("number");
    });
  });

  describe("Token Retrieval", () => {
    test("getStoredCSRFToken should retrieve token from cookies", () => {
      const token = generateCSRFToken();
      // Use the current environment's cookie name
      const cookieName = process.env.NODE_ENV === 'production' ? "__Host-csrf-token" : "csrf-token";
      const mockReq = createMockRequest({
        cookies: { [cookieName]: token }
      });

      const retrievedToken = getStoredCSRFToken(mockReq as Request);
      expect(retrievedToken).toBe(token);
    });

    test("getRequestCSRFToken should retrieve token from header", () => {
      const token = generateCSRFToken();
      const mockReq = createMockRequest({
        headers: { "x-csrf-token": token }
      });

      const retrievedToken = getRequestCSRFToken(mockReq as Request);
      expect(retrievedToken).toBe(token);
    });

    test("getRequestCSRFToken should retrieve token from body", () => {
      const token = generateCSRFToken();
      const mockReq = createMockRequest({
        body: { _csrf: token }
      });

      const retrievedToken = getRequestCSRFToken(mockReq as Request);
      expect(retrievedToken).toBe(token);
    });

    test("getRequestCSRFToken should retrieve token from query params", () => {
      const token = generateCSRFToken();
      const mockReq = createMockRequest({
        query: { csrfToken: token }
      });

      const retrievedToken = getRequestCSRFToken(mockReq as Request);
      expect(retrievedToken).toBe(token);
    });
  });

  describe("Token Validation", () => {
    test("validateCSRFToken should accept matching tokens", () => {
      const token = generateCSRFToken();
      
      const result = validateCSRFToken(token, token, {
        userId: "test-user",
        requestId: "test-request",
        path: "/test"
      });

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test("validateCSRFToken should reject missing request token", () => {
      const token = generateCSRFToken();
      
      const result = validateCSRFToken(undefined, token, {});

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing request token");
    });

    test("validateCSRFToken should reject missing stored token", () => {
      const token = generateCSRFToken();
      
      const result = validateCSRFToken(token, undefined, {});

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing stored token");
    });

    test("validateCSRFToken should reject mismatched tokens", () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      
      const result = validateCSRFToken(token1, token2, {});

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Token mismatch");
    });
  });

  describe("CSRF Middleware", () => {
    test("csrfValidator should allow GET requests without tokens", () => {
      const mockReq = createMockRequest({ method: "GET", path: "/test" });
      const mockRes = createMockResponse();
      const mockNext = vi.fn();

      const middleware = csrfValidator([]);
      middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes._status).toBeUndefined();
    });

    test("csrfValidator should allow HEAD requests without tokens", () => {
      const mockReq = createMockRequest({ method: "HEAD", path: "/test" });
      const mockRes = createMockResponse();
      const mockNext = vi.fn();

      const middleware = csrfValidator([]);
      middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes._status).toBeUndefined();
    });

    test("csrfValidator should allow OPTIONS requests without tokens", () => {
      const mockReq = createMockRequest({ method: "OPTIONS", path: "/test" });
      const mockRes = createMockResponse();
      const mockNext = vi.fn();

      const middleware = csrfValidator([]);
      middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes._status).toBeUndefined();
    });

    test("csrfValidator should skip paths in skipPaths array", () => {
      const mockReq = createMockRequest({ method: "POST", path: "/api/csrf-token" });
      const mockRes = createMockResponse();
      const mockNext = vi.fn();

      const middleware = csrfValidator(["/api/csrf-token"]);
      middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes._status).toBeUndefined();
    });

    test("csrfValidator should reject POST requests without valid CSRF tokens", () => {
      const mockReq = createMockRequest({ method: "POST", path: "/test" });
      const mockRes = createMockResponse();
      const mockNext = vi.fn();

      const middleware = csrfValidator([]);
      middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(403);
      expect(mockRes._json).toHaveProperty("error");
      expect(mockRes?._json?.length).toContain("CSRF");
    });

    test("csrfValidator should accept POST requests with valid CSRF tokens", () => {
      const token = generateCSRFToken();
      const cookieName = process.env.NODE_ENV === 'production' ? "__Host-csrf-token" : "csrf-token";
      
      const mockReq = createMockRequest({ 
        method: "POST", 
        path: "/test",
        headers: { "x-csrf-token": token },
        cookies: { [cookieName]: token }
      });
      const mockRes = createMockResponse();
      const mockNext = vi.fn();

      const middleware = csrfValidator([]);
      middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes._status).toBeUndefined();
      expect((mockReq as any).csrfToken).toBe(token);
    });

    test("csrfValidator should reject POST requests with mismatched CSRF tokens", () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      const cookieName = process.env.NODE_ENV === 'production' ? "__Host-csrf-token" : "csrf-token";
      
      const mockReq = createMockRequest({ 
        method: "POST", 
        path: "/test",
        headers: { "x-csrf-token": token1 },
        cookies: { [cookieName]: token2 }
      });
      const mockRes = createMockResponse();
      const mockNext = vi.fn();

      const middleware = csrfValidator([]);
      middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(403);
      expect(mockRes?._json?.length).toContain("CSRF");
      expect(mockRes?._json?.length).toBe("Token mismatch");
    });
  });

  describe("CSRF Statistics", () => {
    test("getCSRFStats should return valid statistics", () => {
      const stats = getCSRFStats();
      
      expect(typeof stats).toBe("object");
      expect(typeof stats.totalTokens).toBe("number");
      expect(typeof stats.activeTokens).toBe("number");
      expect(typeof stats.expiredTokens).toBe("number");
      expect(typeof stats.averageRotationCount).toBe("number");
      expect(stats.tokensByUser).toBeInstanceOf(Map);
    });
  });

  describe("Environment-specific Cookie Names", () => {
    test("should use development cookie name when NODE_ENV is not production", () => {
      // This test works with the current environment
      const token = generateCSRFToken();
      const mockReq = createMockRequest({
        cookies: { "csrf-token": token }
      });

      // Should work in non-production environments
      if (process.env.NODE_ENV !== 'production') {
        const retrievedToken = getStoredCSRFToken(mockReq as Request);
        expect(retrievedToken).toBe(token);
      } else {
        // In production, it should use __Host- prefix
        const prodMockReq = createMockRequest({
          cookies: { "__Host-csrf-token": token }
        });
        const retrievedToken = getStoredCSRFToken(prodMockReq as Request);
        expect(retrievedToken).toBe(token);
      }
    });

    test("should handle both cookie names appropriately", () => {
      const token = generateCSRFToken();
      
      // Test development cookie name
      const devMockReq = createMockRequest({
        cookies: { "csrf-token": token }
      });
      
      // Test production cookie name
      const prodMockReq = createMockRequest({
        cookies: { "__Host-csrf-token": token }
      });
      
      // In current environment, one of these should work
      const devToken = getStoredCSRFToken(devMockReq as Request);
      const prodToken = getStoredCSRFToken(prodMockReq as Request);
      
      // At least one should return the token based on current environment
      expect(devToken || prodToken).toBe(token);
    });
  });

  describe("Cookie Security Attributes", () => {
    test("setCSRFCookie should set appropriate secure attributes based on environment", () => {
      const token = generateCSRFToken();
      const mockRes = createMockResponse();
      
      // Test with current environment settings
      setCSRFCookie(mockRes as Response, token, false);
      
      const cookie = mockRes._cookies[0];
      
      // Verify basic security attributes
      expect(cookie?.options?.length).toBe(true);
      expect(cookie?.options?.length).toBe("strict");
      expect(cookie?.options?.length).toBe("/");
      expect(typeof cookie?.options?.length).toBe("number");
      
      // The secure flag depends on environment and parameter
      expect(typeof cookie?.options?.length).toBe("boolean");
    });

    test("setCSRFCookie should respect the secure parameter correctly", () => {
      const token = generateCSRFToken();
      const mockRes = createMockResponse();
      
      setCSRFCookie(mockRes as Response, token, true);
      
      const cookie = mockRes._cookies[0];
      
      // In non-production, secure should still be false regardless of parameter
      // In production, it follows the environment logic
      if (process.env.NODE_ENV === 'production') {
        expect(cookie?.options?.length).toBe(true);
      } else {
        expect(cookie?.options?.length).toBe(false);
      }
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty cookie object gracefully", () => {
      const mockReq = createMockRequest({ cookies: {} });
      const retrievedToken = getStoredCSRFToken(mockReq as Request);
      expect(retrievedToken).toBeUndefined();
    });

    test("should handle missing headers gracefully", () => {
      const mockReq = createMockRequest({ headers: {} });
      const retrievedToken = getRequestCSRFToken(mockReq as Request);
      expect(retrievedToken).toBeUndefined();
    });

    test("should handle requests with no cookies property", () => {
      const mockReq = { headers: {}, body: {}, query: {} } as Request;
      const retrievedToken = getStoredCSRFToken(mockReq);
      expect(retrievedToken).toBeUndefined();
    });

    test("should handle malformed tokens gracefully", () => {
      const result = validateCSRFToken("malformed", "different", {});
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Token mismatch");
    });
  });
});