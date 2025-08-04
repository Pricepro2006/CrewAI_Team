import { Router } from "express";
import { wsService } from "../services/WebSocketService.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { logger } from "../../utils/logger.js";

const router = Router();

/**
 * GET /api/websocket/stats
 * Get WebSocket connection statistics
 */
router.get("/stats", (req: AuthenticatedRequest, res) => {
  try {
    // Only allow authenticated users to view stats
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const stats = wsService.getConnectionStats();
    const performanceMetrics = wsService.getPerformanceMetrics();

    return res.json({
      timestamp: new Date().toISOString(),
      connections: {
        total: stats.totalClients,
        authenticated: stats.authenticatedClients,
        totalSockets: stats.totalConnections,
      },
      subscriptions: stats.subscriptionStats,
      authentication: stats.authStats,
      performance: {
        messagesSent: performanceMetrics.messagesSent,
        messagesDropped: performanceMetrics.messagesDropped,
        averageResponseTime: performanceMetrics.averageResponseTime,
        connectionErrors: performanceMetrics.connectionErrors,
        lastCleanup: new Date(performanceMetrics.lastCleanup).toISOString(),
      },
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        arrayBuffers: process.memoryUsage().arrayBuffers,
      },
    });
  } catch (error) {
    logger.error("Error getting WebSocket stats", "WS_MONITOR", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/websocket/clients
 * Get detailed client information (admin only)
 */
router.get("/clients", (req: AuthenticatedRequest, res) => {
  try {
    // Only allow admins to view detailed client info
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const stats = wsService.getConnectionStats();

    return res.json({
      timestamp: new Date().toISOString(),
      totalClients: stats.totalClients,
      authenticatedClients: stats.authenticatedClients,
      authenticationStats: stats.authStats,
    });
  } catch (error) {
    logger.error("Error getting WebSocket clients", "WS_MONITOR", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/websocket/broadcast
 * Send a broadcast message (admin only)
 */
router.post("/broadcast", (req: AuthenticatedRequest, res) => {
  try {
    // Only allow admins to broadcast
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { type, payload, requiredPermission } = req.body;

    if (!type || !payload) {
      return res.status(400).json({ error: "Type and payload are required" });
    }

    // Broadcast the message
    wsService.broadcast(
      {
        type,
        ...payload,
        timestamp: new Date(),
      } as any,
      requiredPermission,
    );

    return res.json({
      success: true,
      message: "Broadcast sent",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error broadcasting message", "WS_MONITOR", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/websocket/client/:clientId
 * Force disconnect a client (admin only)
 */
router.delete("/client/:clientId", (req: AuthenticatedRequest, res) => {
  try {
    // Only allow admins to disconnect clients
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ error: "Client ID is required" });
    }

    // Force disconnect the client
    wsService.forceDisconnectClient(clientId);

    return res.json({
      success: true,
      message: `Client ${clientId} disconnected`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error disconnecting client", "WS_MONITOR", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/websocket/health
 * WebSocket service health check
 */
router.get("/health", (_req, res) => {
  try {
    const stats = wsService.getConnectionStats();
    const performanceMetrics = wsService.getPerformanceMetrics();

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      metrics: {
        activeConnections: stats.totalConnections,
        connectionErrors: performanceMetrics.connectionErrors,
        averageResponseTime: performanceMetrics.averageResponseTime,
      },
    };

    // Determine health status
    if (stats.totalConnections > 5000) {
      health.status = "degraded";
    } else if (performanceMetrics.connectionErrors > 100) {
      health.status = "degraded";
    } else if (performanceMetrics.averageResponseTime > 1000) {
      health.status = "degraded";
    }

    return res.json(health);
  } catch (error) {
    logger.error("Error checking WebSocket health", "WS_MONITOR", { error });
    return res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: "Failed to check WebSocket health",
    });
  }
});

export default router;
