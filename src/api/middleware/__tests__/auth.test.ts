/**
 * Security Test Suite for Authentication Middleware
 * Tests the JWT authentication implementation for security vulnerabilities
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import jwt from "jsonwebtoken";
import { verifyJWT, type AuthUser } from '../auth';

const TEST_JWT_SECRET = "test-secret-key-for-unit-tests-only";

// Mock environment variables
const originalEnv = process.env.JWT_SECRET;
beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

afterAll(() => {
  process.env.JWT_SECRET = originalEnv;
});

describe("Authentication Middleware Security Tests", () => {
  describe("JWT Verification - Security Critical", () => {
    it("should properly verify valid JWT tokens", () => {
      const payload = {
        sub: "user123",
        email: "test@example.com",
        role: "user",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET);
      const result = verifyJWT(token);

      expect(result).toEqual({
        id: "user123",
        email: "test@example.com",
        role: "user",
      });
    });

    it("should reject tokens with invalid signatures", () => {
      const token = jwt.sign(
        { sub: "user123", email: "test@example.com" },
        "wrong-secret",
      );

      expect(() => verifyJWT(token)).toThrow("Invalid token signature");
    });

    it("should reject expired tokens", () => {
      const payload = {
        sub: "user123",
        email: "test@example.com",
        role: "user",
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET);

      expect(() => verifyJWT(token)).toThrow("Token has expired");
    });

    it("should reject malformed tokens", () => {
      const malformedTokens = [
        "invalid.token",
        "not?.jwt?.token.format",
        "",
        "bearer token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9?.invalid?.signature",
      ];

      malformedTokens.forEach((token: any) => {
        expect(() => verifyJWT(token)).toThrow();
      });
    });

    it("should reject tokens without required fields", () => {
      const incompletePayloads = [
        { email: "test@example.com", role: "user" }, // Missing sub
        { sub: "user123", role: "user" }, // Missing email
        { sub: "", email: "test@example.com" }, // Empty sub
        { sub: "user123", email: "" }, // Empty email
      ];

      incompletePayloads.forEach((payload: any) => {
        const token = jwt.sign(payload, TEST_JWT_SECRET);
        expect(() => verifyJWT(token)).toThrow("Invalid token payload");
      });
    });

    it("should handle missing JWT_SECRET environment variable", () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => verifyJWT("any?.token?.here")).toThrow(
        "JWT_SECRET environment variable is required",
      );

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe("Security Vulnerability Prevention", () => {
    it('should not accept tokens with "none" algorithm', () => {
      // This tests against the "none" algorithm vulnerability
      const header = { alg: "none", typ: "JWT" };
      const payload = { sub: "user123", email: "test@example.com" };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
        "base64",
      );
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const maliciousToken = `${encodedHeader}.${encodedPayload}.`;

      expect(() => verifyJWT(maliciousToken)).toThrow();
    });

    it("should not accept unsigned tokens", () => {
      const header = { alg: "HS256", typ: "JWT" };
      const payload = { sub: "user123", email: "test@example.com" };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
        "base64",
      );
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const unsignedToken = `${encodedHeader}.${encodedPayload}`;

      expect(() => verifyJWT(unsignedToken)).toThrow();
    });
  });
});
