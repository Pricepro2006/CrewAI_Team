import { WebSocketServer } from "ws";
import {
  WebSocketAuthManager,
  createWebSocketAuthMiddleware,
  type AuthenticatedWebSocket,
} from "../middleware/websocketAuth.js";
import { wsService } from "../services/WebSocketService.js";
import type { UserService } from "../services/UserService.js";
import { logger } from "../../utils/logger.js";

/**
 * Setup authenticated WebSocket server
 */
export function setupAuthenticatedWebSocketServer(
  wss: WebSocketServer,
  userService: UserService,
): WebSocketAuthManager {
  // Create auth manager
  const authManager = new WebSocketAuthManager(userService);

  // Create auth middleware
  const authMiddleware = createWebSocketAuthMiddleware(authManager);

  // Handle new connections
  wss.on("connection", async (ws: AuthenticatedWebSocket, req: any) => {
    logger.info("New WebSocket connection", "WS_SETUP", {
      ip: req.socket.remoteAddress,
      headers: req.headers,
    });

    // Apply authentication middleware
    await authMiddleware(ws, req);

    // Register with WebSocket service
    if (ws.clientId) {
      wsService.registerClient(ws.clientId, ws);

      // Subscribe to default channels based on permissions
      const defaultSubscriptions = getDefaultSubscriptions(ws);
      if (defaultSubscriptions.length > 0) {
        wsService.subscribe(ws.clientId, defaultSubscriptions);
      }
    }

    // Handle incoming messages
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Check authentication for protected message types
        if (requiresAuth(message.type) && !ws.isAuthenticated) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Authentication required for this operation",
            }),
          );
          return;
        }

        // Handle subscription requests
        if (message.type === "subscribe" && ws.clientId) {
          const allowed = filterAllowedSubscriptions(
            message.channels || [],
            ws,
          );
          if (allowed.length > 0) {
            wsService.subscribe(ws.clientId, allowed);
            ws.send(
              JSON.stringify({
                type: "subscribed",
                channels: allowed,
              }),
            );
          }
        }

        // Handle unsubscribe requests
        if (message.type === "unsubscribe" && ws.clientId) {
          wsService.unsubscribe(ws.clientId, message.channels || []);
          ws.send(
            JSON.stringify({
              type: "unsubscribed",
              channels: message.channels,
            }),
          );
        }

        // Update activity
        if (ws.isAuthenticated) {
          authManager.updateActivity(ws);
        }
      } catch (error) {
        logger.error(`WebSocket message handling error: ${error}`, "WS_SETUP");
      }
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "welcome",
        clientId: ws.clientId,
        isAuthenticated: ws.isAuthenticated,
        permissions: ws.permissions,
        subscriptions: ws.clientId
          ? wsService.getClientSubscriptions(ws.clientId)
          : [],
      }),
    );
  });

  // Handle server errors
  wss.on("error", (error) => {
    logger.error(`WebSocket server error: ${error}`, "WS_SETUP");
  });

  // Periodic health check
  const healthCheckInterval = setInterval(() => {
    const stats = authManager.getStats();
    const wsStats = wsService.getConnectionStats();

    logger.info("WebSocket Health Check", "WS_SETUP", {
      authenticated: stats.totalAuthenticated,
      total: wsStats.totalClients,
      byRole: stats.byRole,
    });
  }, 60000); // Every minute

  // Cleanup on server close
  wss.on("close", () => {
    clearInterval(healthCheckInterval);
    authManager.stopCleanup();
    logger.info("WebSocket server closed", "WS_SETUP");
  });

  return authManager;
}

/**
 * Get default subscriptions based on user permissions
 */
function getDefaultSubscriptions(ws: AuthenticatedWebSocket): string[] {
  const subscriptions: string[] = [];

  if (!ws.permissions) return subscriptions;

  // All authenticated users get system health updates
  if (ws.isAuthenticated) {
    subscriptions.push("system.health");
  }

  // Read permission gets email updates
  if (ws.permissions.includes("read")) {
    subscriptions.push("email.analyzed");
    subscriptions.push("email.state_changed");
    subscriptions.push("email.sla_alert");
  }

  // Write permission gets additional updates
  if (ws.permissions.includes("write")) {
    subscriptions.push("email.batch_state_changed");
  }

  // Admin permission gets all updates
  if (ws.permissions.includes("admin")) {
    subscriptions.push("*"); // Subscribe to everything
  }

  return subscriptions;
}

/**
 * Filter subscriptions based on user permissions
 */
function filterAllowedSubscriptions(
  requested: string[],
  ws: AuthenticatedWebSocket,
): string[] {
  if (!ws.permissions) return [];

  // Admins can subscribe to anything
  if (ws.permissions.includes("admin")) {
    return requested;
  }

  const allowed: string[] = [];

  for (const channel of requested) {
    // Check channel-specific permissions
    if (channel.startsWith("email.") && ws.permissions.includes("read")) {
      allowed.push(channel);
    } else if (channel === "system.health" && ws.isAuthenticated) {
      allowed.push(channel);
    } else if (
      channel.startsWith("agent.") &&
      ws.permissions.includes("write")
    ) {
      allowed.push(channel);
    } else if (
      channel.startsWith("task.") &&
      ws.permissions.includes("write")
    ) {
      allowed.push(channel);
    }
    // Add more channel permission mappings as needed
  }

  return allowed;
}

/**
 * Check if a message type requires authentication
 */
function requiresAuth(messageType: string): boolean {
  const publicMessageTypes = ["auth", "ping", "pong"];

  return !publicMessageTypes.includes(messageType);
}

/**
 * Create a standalone WebSocket server with authentication
 */
export function createAuthenticatedWebSocketServer(
  port: number,
  userService: UserService,
): { wss: WebSocketServer; authManager: WebSocketAuthManager } {
  const wss = new WebSocketServer({
    port,
    path: "/ws",
    // Enable permessage-deflate compression
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3,
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024,
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
      threshold: 1024,
    },
    // Connection verification
    verifyClient: (info: any) => {
      // Could add IP filtering, origin checks, etc.
      const origin = info.origin || info.req.headers.origin;

      // In production, check against allowed origins
      if (process.env.NODE_ENV === "production") {
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");
        if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
          logger.warn(
            "WebSocket connection rejected - invalid origin",
            "WS_SETUP",
            {
              origin,
              ip: info.req.socket.remoteAddress,
            },
          );
          return false;
        }
      }

      return true;
    },
  });

  logger.info(
    `Authenticated WebSocket server created on port ${port}`,
    "WS_SETUP",
  );

  const authManager = setupAuthenticatedWebSocketServer(wss, userService);

  return { wss, authManager };
}
