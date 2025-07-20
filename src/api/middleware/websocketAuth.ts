import type { WebSocket } from "ws";
import type { UserService } from "../services/UserService";
import { logger } from "../../utils/logger";
import { z } from "zod";

// WebSocket authentication message schema
const AuthMessageSchema = z.object({
  type: z.literal("auth"),
  token: z.string(),
});

// WebSocket connection metadata
export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  clientId?: string;
  isAuthenticated?: boolean;
  permissions?: string[];
  lastActivity?: Date;
}

// Authentication result
interface AuthResult {
  success: boolean;
  userId?: string;
  userRole?: string;
  permissions?: string[];
  error?: string;
}

export class WebSocketAuthManager {
  private userService: UserService;
  private authenticatedClients: Map<string, {
    userId: string;
    userRole: string;
    permissions: string[];
    expiresAt: Date;
  }> = new Map();
  
  // Cleanup interval for expired sessions
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(userService: UserService) {
    this.userService = userService;
    this.startCleanupInterval();
  }

  /**
   * Authenticate a WebSocket connection
   */
  async authenticate(ws: AuthenticatedWebSocket, token: string): Promise<AuthResult> {
    try {
      // Verify JWT token
      const payload = await this.userService.verifyToken(token);
      
      // Get user details
      const user = await this.userService.getById(payload.userId);
      
      if (!user || !user.isActive) {
        logger.warn("WebSocket auth failed: User not found or inactive", "WS_AUTH", {
          userId: payload.userId,
        });
        return { success: false, error: "Invalid user" };
      }

      // Set authentication metadata on WebSocket
      ws.userId = user.id;
      ws.userRole = user.role;
      ws.isAuthenticated = true;
      ws.permissions = this.getPermissionsForRole(user.role);
      ws.lastActivity = new Date();
      
      // Generate client ID for tracking
      ws.clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Store authenticated client info
      this.authenticatedClients.set(ws.clientId, {
        userId: user.id,
        userRole: user.role,
        permissions: ws.permissions,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour expiry
      });

      logger.info("WebSocket authenticated successfully", "WS_AUTH", {
        userId: user.id,
        clientId: ws.clientId,
        role: user.role,
      });

      return {
        success: true,
        userId: user.id,
        userRole: user.role,
        permissions: ws.permissions,
      };
    } catch (error) {
      logger.error(`WebSocket authentication failed: ${error}`, "WS_AUTH");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Handle authentication message from client
   */
  async handleAuthMessage(ws: AuthenticatedWebSocket, message: any): Promise<boolean> {
    try {
      // Validate message format
      const authMessage = AuthMessageSchema.parse(message);
      
      // Authenticate with token
      const result = await this.authenticate(ws, authMessage.token);
      
      // Send authentication response
      ws.send(JSON.stringify({
        type: "auth_response",
        success: result.success,
        userId: result.userId,
        permissions: result.permissions,
        error: result.error,
      }));

      return result.success;
    } catch (error) {
      logger.error(`Invalid auth message: ${error}`, "WS_AUTH");
      
      ws.send(JSON.stringify({
        type: "auth_response",
        success: false,
        error: "Invalid authentication message",
      }));
      
      return false;
    }
  }

  /**
   * Check if a WebSocket is authenticated
   */
  isAuthenticated(ws: AuthenticatedWebSocket): boolean {
    return ws.isAuthenticated === true && !!ws.userId;
  }

  /**
   * Check if a WebSocket has specific permission
   */
  hasPermission(ws: AuthenticatedWebSocket, permission: string): boolean {
    return ws.permissions?.includes(permission) || false;
  }

  /**
   * Check if a WebSocket has any of the specified roles
   */
  hasRole(ws: AuthenticatedWebSocket, roles: string[]): boolean {
    return roles.includes(ws.userRole || "");
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(ws: AuthenticatedWebSocket): void {
    if (ws.isAuthenticated) {
      ws.lastActivity = new Date();
    }
  }

  /**
   * Remove authenticated client
   */
  removeClient(ws: AuthenticatedWebSocket): void {
    if (ws.clientId) {
      this.authenticatedClients.delete(ws.clientId);
      logger.debug("Removed authenticated WebSocket client", "WS_AUTH", {
        clientId: ws.clientId,
        userId: ws.userId,
      });
    }
  }

  /**
   * Get all authenticated clients for a user
   */
  getClientsByUserId(userId: string): string[] {
    const clients: string[] = [];
    this.authenticatedClients.forEach((info, clientId) => {
      if (info.userId === userId) {
        clients.push(clientId);
      }
    });
    return clients;
  }

  /**
   * Force disconnect all clients for a user
   */
  disconnectUser(userId: string, wsService: any): void {
    const clientIds = this.getClientsByUserId(userId);
    clientIds.forEach(clientId => {
      // Remove from authenticated clients
      this.authenticatedClients.delete(clientId);
      
      // Notify WebSocket service to disconnect
      wsService.forceDisconnectClient(clientId);
    });
    
    logger.info(`Disconnected all WebSocket clients for user: ${userId}`, "WS_AUTH");
  }

  /**
   * Get permissions based on role
   */
  private getPermissionsForRole(role: string): string[] {
    switch (role) {
      case "admin":
        return ["read", "write", "delete", "admin", "broadcast"];
      case "moderator":
        return ["read", "write", "moderate", "broadcast"];
      case "user":
        return ["read", "write"];
      default:
        return ["read"];
    }
  }

  /**
   * Start cleanup interval for expired sessions
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const expired: string[] = [];

      this.authenticatedClients.forEach((info, clientId) => {
        if (info.expiresAt < now) {
          expired.push(clientId);
        }
      });

      expired.forEach(clientId => {
        this.authenticatedClients.delete(clientId);
      });

      if (expired.length > 0) {
        logger.debug(`Cleaned up ${expired.length} expired WebSocket sessions`, "WS_AUTH");
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get authentication statistics
   */
  getStats(): {
    totalAuthenticated: number;
    byRole: Record<string, number>;
    byUser: Record<string, number>;
  } {
    const stats = {
      totalAuthenticated: this.authenticatedClients.size,
      byRole: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
    };

    this.authenticatedClients.forEach(info => {
      // Count by role
      stats.byRole[info.userRole] = (stats.byRole[info.userRole] || 0) + 1;
      
      // Count by user
      stats.byUser[info.userId] = (stats.byUser[info.userId] || 0) + 1;
    });

    return stats;
  }
}

// Middleware function for WebSocket upgrade
export function createWebSocketAuthMiddleware(authManager: WebSocketAuthManager) {
  return async (ws: AuthenticatedWebSocket, req: any) => {
    // Extract token from query params or headers
    const token = req.url?.includes("token=") 
      ? new URLSearchParams(req.url.split("?")[1]).get("token")
      : req.headers.authorization?.replace("Bearer ", "");

    if (token) {
      // Attempt immediate authentication
      const result = await authManager.authenticate(ws, token);
      
      if (!result.success) {
        // Send error and close connection
        ws.send(JSON.stringify({
          type: "auth_error",
          error: result.error || "Authentication failed",
        }));
        
        setTimeout(() => {
          ws.close(1008, "Authentication failed");
        }, 1000);
        
        return;
      }
    } else {
      // Mark as unauthenticated guest
      ws.isAuthenticated = false;
      ws.userId = undefined;
      ws.userRole = "guest";
      ws.permissions = ["read"];
      ws.clientId = `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Send authentication required message
      ws.send(JSON.stringify({
        type: "auth_required",
        message: "Please authenticate to access all features",
      }));
    }

    // Set up message handler for authentication
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle authentication messages
        if (message.type === "auth" && !ws.isAuthenticated) {
          await authManager.handleAuthMessage(ws, message);
        }
        
        // Update activity on any message
        if (ws.isAuthenticated) {
          authManager.updateActivity(ws);
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    });

    // Clean up on disconnect
    ws.on("close", () => {
      authManager.removeClient(ws);
    });
  };
}

// Default authentication function export
export async function authenticateWebSocket(ws: AuthenticatedWebSocket, token: string): Promise<boolean> {
  // This is a simplified version for compatibility
  // In a real implementation, you'd inject the UserService
  try {
    if (!token || token.length < 10) {
      return false;
    }
    
    // Basic token validation (this should use proper JWT verification)
    ws.isAuthenticated = true;
    ws.userId = 'default-user';
    ws.userRole = 'user';
    ws.permissions = ['read'];
    ws.lastActivity = new Date();
    
    return true;
  } catch (error) {
    return false;
  }
}