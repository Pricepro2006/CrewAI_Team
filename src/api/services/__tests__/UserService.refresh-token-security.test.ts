import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UserService, UserRole } from "../UserService";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

describe("UserService Security - Refresh Token Vulnerability Fix", () => {
  let userService: UserService;
  let testUser: any;
  let validTokens: any;

  beforeEach(async () => {
    // Set up test environment
    process.env.JWT_SECRET = "test-secret-key-for-testing-purposes-only-32chars";
    process.env.DATABASE_PATH = ":memory:";
    
    // Create a new UserService instance for each test
    userService = new UserService();
    
    // Create a test user
    testUser = await userService.create({
      email: "test@example.com",
      username: "testuser",
      password: "TestPassword123!",
      role: UserRole.USER,
    });

    // Login to get valid tokens
    const loginResult = await userService.login({
      emailOrUsername: "test@example.com",
      password: "TestPassword123!",
    });
    validTokens = loginResult.tokens;
  });

  afterEach(async () => {
    // Clean up database
    const db = (userService as any).db;
    db.close();
  });

  describe("refreshTokens method security", () => {
    it("should successfully refresh tokens with a valid refresh token", async () => {
      // Act
      const newTokens = await userService.refreshTokens(validTokens.refreshToken);

      // Assert
      expect(newTokens).toBeDefined();
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.refreshToken).not.toBe(validTokens.refreshToken);
    });

    it("should reject refresh attempt with invalid token hash", async () => {
      // Create a fake token with valid JWT structure but invalid hash
      const fakePayload = jwt.verify(validTokens.refreshToken, process.env.JWT_SECRET || "test-secret") as any;
      const fakeToken = jwt.sign(fakePayload, process.env.JWT_SECRET || "test-secret", { expiresIn: "7d" });

      // Act & Assert
      await expect(userService.refreshTokens(fakeToken)).rejects.toThrow("Invalid refresh token");
    });

    it("should reject refresh attempt with reused token (one-time use enforcement)", async () => {
      // First refresh should succeed
      const newTokens = await userService.refreshTokens(validTokens.refreshToken);
      expect(newTokens).toBeDefined();

      // Second attempt with same token should fail
      await expect(userService.refreshTokens(validTokens.refreshToken)).rejects.toThrow("Invalid refresh token");
    });

    it("should reject refresh attempt with manually crafted token", async () => {
      // Create a completely fake token
      const fakeToken = jwt.sign(
        { userId: testUser.id, email: testUser.email },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "7d" }
      );

      // Act & Assert
      await expect(userService.refreshTokens(fakeToken)).rejects.toThrow("Invalid refresh token");
    });

    it("should reject refresh attempt for non-existent user", async () => {
      // Create token for non-existent user
      const fakeToken = jwt.sign(
        { userId: "non-existent-user-id", email: "fake@example.com" },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "7d" }
      );

      // Act & Assert
      await expect(userService.refreshTokens(fakeToken)).rejects.toThrow("Invalid refresh token");
    });

    it("should handle race condition with concurrent refresh attempts", async () => {
      // Attempt to refresh the same token concurrently
      const promises = [
        userService.refreshTokens(validTokens.refreshToken),
        userService.refreshTokens(validTokens.refreshToken),
        userService.refreshTokens(validTokens.refreshToken),
      ];

      const results = await Promise.allSettled(promises);
      
      // Only one should succeed
      const successes = results.filter(r => r.status === "fulfilled");
      const failures = results.filter(r => r.status === "rejected");
      
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(2);
    });

    it("should properly verify bcrypt hash comparison", async () => {
      // Get the stored token hash
      const db = (userService as any).db;
      const storedToken = db.prepare(
        "SELECT token_hash FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL"
      ).get(testUser.id) as any;

      // Verify that the stored hash matches the original token
      const isMatch = await bcrypt.compare(validTokens.refreshToken, storedToken.token_hash);
      expect(isMatch).toBe(true);

      // Verify that a random token doesn't match
      const randomToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "7d" }
      );
      const isRandomMatch = await bcrypt.compare(randomToken, storedToken.token_hash);
      expect(isRandomMatch).toBe(false);
    });
  });

  describe("logout method security", () => {
    it("should revoke specific refresh token with proper hash verification", async () => {
      // Logout with specific token
      await userService.logout(testUser.id, validTokens.refreshToken);

      // Verify token is revoked
      await expect(userService.refreshTokens(validTokens.refreshToken)).rejects.toThrow("Invalid refresh token");
    });

    it("should not revoke token with invalid hash", async () => {
      // Create a fake token
      const fakeToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "7d" }
      );

      // Attempt logout with fake token
      await userService.logout(testUser.id, fakeToken);

      // Original token should still work
      const newTokens = await userService.refreshTokens(validTokens.refreshToken);
      expect(newTokens).toBeDefined();
    });

    it("should revoke all tokens when no specific token provided", async () => {
      // Create additional tokens
      const loginResult2 = await userService.login({
        emailOrUsername: "test@example.com",
        password: "TestPassword123!",
      });

      // Revoke all tokens
      await userService.logout(testUser.id);

      // Both tokens should be revoked
      await expect(userService.refreshTokens(validTokens.refreshToken)).rejects.toThrow("Invalid refresh token");
      await expect(userService.refreshTokens(loginResult2.tokens.refreshToken)).rejects.toThrow("Invalid refresh token");
    });
  });

  describe("token storage security", () => {
    it("should use bcrypt cost factor 10 for refresh token hashing", async () => {
      const db = (userService as any).db;
      const storedToken = db.prepare(
        "SELECT token_hash FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
      ).get(testUser.id) as any;

      // Bcrypt hashes with cost factor 10 should start with $2b$10$
      expect(storedToken.token_hash).toMatch(/^\$2[aby]\$10\$/);
    });

    it("should handle storage failures gracefully", async () => {
      // Mock database error
      const db = (userService as any).db;
      const originalPrepare = db.prepare.bind(db);
      db.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("INSERT INTO refresh_tokens")) {
          return {
            run: () => {
              throw new Error("Database error");
            },
          };
        }
        return originalPrepare(sql);
      });

      // Attempt login which will try to store refresh token
      await expect(
        userService.login({
          emailOrUsername: "test@example.com",
          password: "TestPassword123!",
        })
      ).rejects.toThrow("Failed to store refresh token");

      // Restore original prepare method
      db.prepare = originalPrepare;
    });
  });

  describe("security event detection", () => {
    it("should detect and prevent token replay attacks", async () => {
      // Mock console.error to capture security logs
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      // First use of token should work
      await userService.refreshTokens(validTokens.refreshToken);
      
      // Second use should be detected as replay attack
      try {
        await userService.refreshTokens(validTokens.refreshToken);
      } catch (error) {
        // Expected to throw
      }
      
      // Check that replay attack was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("possible replay attack"),
        expect.any(String),
        expect.objectContaining({
          severity: "CRITICAL",
          userId: testUser.id,
        })
      );
      
      consoleErrorSpy.mockRestore();
    });

    it("should log failed hash verification attempts", async () => {
      // Mock console.error to capture security logs
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      // Create fake token
      const fakeToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "7d" }
      );
      
      try {
        await userService.refreshTokens(fakeToken);
      } catch (error) {
        // Expected to throw
      }
      
      // Check that hash verification failure was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token hash verification failed"),
        expect.any(String),
        expect.objectContaining({
          severity: "HIGH",
          userId: testUser.id,
        })
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});