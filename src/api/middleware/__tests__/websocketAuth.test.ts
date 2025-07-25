import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { WebSocketAuthManager, type AuthenticatedWebSocket } from "../websocketAuth";
import type { UserService, User, JWTPayload } from "../../services/UserService";
import { UserRole } from "../../services/UserService";
import { WebSocket } from "ws";

// Mock dependencies
vi.mock("../../services/UserService");
vi.mock("../../../utils/logger");

describe("WebSocketAuthManager", () => {
  let authManager: WebSocketAuthManager;
  let mockUserService: {
    verifyToken: MockedFunction<UserService['verifyToken']>;
    getById: MockedFunction<UserService['getById']>;
  };
  let mockWs: AuthenticatedWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock UserService
    mockUserService = {
      verifyToken: vi.fn(),
      getById: vi.fn(),
    } as any;

    // Create auth manager
    authManager = new WebSocketAuthManager(mockUserService);

    // Create mock WebSocket
    mockWs = {
      send: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN,
    } as any;
  });

  describe("authenticate", () => {
    it("should authenticate valid user", async () => {
      const token = "valid-token";
      const userId = "user-123";
      
      mockUserService.verifyToken.mockResolvedValue({
        userId,
        email: "user@example.com",
        username: "testuser",
        role: UserRole.USER,
      });
      
      mockUserService.getById.mockResolvedValue({
        id: userId,
        email: "user@example.com",
        username: "testuser",
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await authManager.authenticate(mockWs, token);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(userId);
      expect(result.userRole).toBe(UserRole.USER);
      expect(result.permissions).toEqual(["read", "write"]);
      
      expect(mockWs.userId).toBe(userId);
      expect(mockWs.userRole).toBe("user");
      expect(mockWs.isAuthenticated).toBe(true);
      expect(mockWs.clientId).toBeDefined();
    });

    it("should reject invalid token", async () => {
      const token = "invalid-token";
      
      mockUserService.verifyToken.mockRejectedValue(
        new Error("Invalid token")
      );

      const result = await authManager.authenticate(mockWs, token);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid token");
      expect(mockWs.isAuthenticated).toBeUndefined();
    });

    it("should reject inactive user", async () => {
      const token = "valid-token";
      const userId = "user-123";
      
      mockUserService.verifyToken.mockResolvedValue({
        userId,
        email: "user@example.com",
        username: "testuser",
        role: UserRole.USER,
      });
      
      mockUserService.getById.mockResolvedValue({
        id: userId,
        email: "user@example.com",
        username: "testuser",
        role: UserRole.USER,
        isActive: false, // Inactive user
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await authManager.authenticate(mockWs, token);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid user");
    });

    it("should set admin permissions for admin role", async () => {
      const token = "admin-token";
      const userId = "admin-123";
      
      mockUserService.verifyToken.mockResolvedValue({
        userId,
        email: "admin@example.com",
        username: "admin",
        role: UserRole.ADMIN,
      });
      
      mockUserService.getById.mockResolvedValue({
        id: userId,
        email: "admin@example.com",
        username: "admin",
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await authManager.authenticate(mockWs, token);

      expect(result.success).toBe(true);
      expect(result.permissions).toEqual([
        "read",
        "write",
        "delete",
        "admin",
        "broadcast",
      ]);
    });
  });

  describe("handleAuthMessage", () => {
    it("should handle valid auth message", async () => {
      const message = {
        type: "auth",
        token: "valid-token",
      };

      // Mock successful authentication
      vi.spyOn(authManager, "authenticate").mockResolvedValue({
        success: true,
        userId: "user-123",
        userRole: "user",
        permissions: ["read", "write"],
      });

      const result = await authManager.handleAuthMessage(mockWs, message);

      expect(result).toBe(true);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"auth_response"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"success":true')
      );
    });

    it("should handle invalid auth message format", async () => {
      const message = {
        type: "wrong",
        data: "invalid",
      };

      const result = await authManager.handleAuthMessage(mockWs, message);

      expect(result).toBe(false);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"success":false')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Invalid authentication message")
      );
    });

    it("should handle authentication failure", async () => {
      const message = {
        type: "auth",
        token: "invalid-token",
      };

      // Mock failed authentication
      vi.spyOn(authManager, "authenticate").mockResolvedValue({
        success: false,
        error: "Invalid token",
      });

      const result = await authManager.handleAuthMessage(mockWs, message);

      expect(result).toBe(false);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Invalid token"')
      );
    });
  });

  describe("permission checks", () => {
    beforeEach(() => {
      mockWs.isAuthenticated = true;
      mockWs.userId = "user-123";
      mockWs.userRole = UserRole.USER;
      mockWs.permissions = ["read", "write"];
    });

    it("should correctly check if authenticated", () => {
      expect(authManager.isAuthenticated(mockWs)).toBe(true);
      
      mockWs.isAuthenticated = false;
      expect(authManager.isAuthenticated(mockWs)).toBe(false);
    });

    it("should correctly check permissions", () => {
      expect(authManager.hasPermission(mockWs, "read")).toBe(true);
      expect(authManager.hasPermission(mockWs, "write")).toBe(true);
      expect(authManager.hasPermission(mockWs, "delete")).toBe(false);
      expect(authManager.hasPermission(mockWs, "admin")).toBe(false);
    });

    it("should correctly check roles", () => {
      expect(authManager.hasRole(mockWs, [UserRole.USER, UserRole.ADMIN])).toBe(true);
      expect(authManager.hasRole(mockWs, [UserRole.ADMIN, UserRole.MODERATOR])).toBe(false);
      
      mockWs.userRole = UserRole.ADMIN;
      expect(authManager.hasRole(mockWs, [UserRole.ADMIN])).toBe(true);
    });
  });

  describe("client management", () => {
    it("should track authenticated clients", async () => {
      const token = "valid-token";
      const userId = "user-123";
      
      mockUserService.verifyToken.mockResolvedValue({
        userId,
        email: "user@example.com",
        username: "testuser",
        role: UserRole.USER,
      });
      
      mockUserService.getById.mockResolvedValue({
        id: userId,
        email: "user@example.com",
        username: "testuser",
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await authManager.authenticate(mockWs, token);
      
      const clientIds = authManager.getClientsByUserId(userId);
      expect(clientIds).toHaveLength(1);
      expect(clientIds[0]).toBe(mockWs.clientId);
    });

    it("should remove client on cleanup", async () => {
      mockWs.clientId = "client-123";
      mockWs.userId = "user-123";
      
      // Add to tracking manually (simulating successful auth)
      (authManager as any).authenticatedClients.set(mockWs.clientId, {
        userId: mockWs.userId,
        userRole: UserRole.USER,
        permissions: ["read", "write"],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      authManager.removeClient(mockWs);

      const clientIds = authManager.getClientsByUserId(mockWs.userId);
      expect(clientIds).toHaveLength(0);
    });

    it("should get authentication statistics", async () => {
      // Add some test clients
      const clients = [
        { clientId: "c1", userId: "u1", userRole: UserRole.ADMIN },
        { clientId: "c2", userId: "u2", userRole: UserRole.USER },
        { clientId: "c3", userId: "u1", userRole: UserRole.ADMIN }, // Same user, different client
        { clientId: "c4", userId: "u3", userRole: UserRole.USER },
      ];

      clients.forEach(client => {
        (authManager as any).authenticatedClients.set(client.clientId, {
          userId: client.userId,
          userRole: client.userRole,
          permissions: ["read"],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      });

      const stats = authManager.getStats();

      expect(stats.totalAuthenticated).toBe(4);
      expect(stats.byRole).toEqual({
        admin: 2,
        user: 2,
      });
      expect(stats.byUser).toEqual({
        u1: 2, // User u1 has 2 connections
        u2: 1,
        u3: 1,
      });
    });
  });

  describe("activity tracking", () => {
    it("should update last activity", () => {
      mockWs.isAuthenticated = true;
      const initialActivity = new Date(Date.now() - 1000);
      mockWs.lastActivity = initialActivity;

      authManager.updateActivity(mockWs);

      expect(mockWs.lastActivity.getTime()).toBeGreaterThan(
        initialActivity.getTime()
      );
    });

    it("should not update activity for unauthenticated clients", () => {
      mockWs.isAuthenticated = false;
      const initialActivity = new Date(Date.now() - 1000);
      mockWs.lastActivity = initialActivity;

      authManager.updateActivity(mockWs);

      expect(mockWs.lastActivity).toBe(initialActivity);
    });
  });

  describe("disconnectUser", () => {
    it("should disconnect all clients for a user", () => {
      const userId = "user-123";
      const mockWsService = {
        forceDisconnectClient: vi.fn(),
      };

      // Add multiple clients for the same user
      ["c1", "c2", "c3"].forEach(clientId => {
        (authManager as any).authenticatedClients.set(clientId, {
          userId,
          userRole: UserRole.USER,
          permissions: ["read"],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      });

      authManager.disconnectUser(userId, mockWsService);

      expect(mockWsService.forceDisconnectClient).toHaveBeenCalledTimes(3);
      expect(mockWsService.forceDisconnectClient).toHaveBeenCalledWith("c1");
      expect(mockWsService.forceDisconnectClient).toHaveBeenCalledWith("c2");
      expect(mockWsService.forceDisconnectClient).toHaveBeenCalledWith("c3");
      
      const remainingClients = authManager.getClientsByUserId(userId);
      expect(remainingClients).toHaveLength(0);
    });
  });

  describe("cleanup", () => {
    it("should stop cleanup interval", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      
      // Force create cleanup interval
      (authManager as any).startCleanupInterval();
      
      authManager.stopCleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect((authManager as any).cleanupInterval).toBeNull();
    });
  });
});