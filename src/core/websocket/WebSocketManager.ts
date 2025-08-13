import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { logger } from "../../utils/logger.js";
import { EmailAnalyticsService } from "../database/EmailAnalyticsService.js";
import { redisService, CacheKeys, CacheTTL } from "../cache/RedisService.js";

interface WebSocketConfig {
  port?: number;
  path?: string;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
}

interface AuthenticatedSocket extends Socket {
  id: string;
  userId?: string;
  sessionId?: string;
}

export class WebSocketManager {
  private io: SocketIOServer;
  private emailAnalyticsService: EmailAnalyticsService;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(httpServer: HTTPServer, config?: WebSocketConfig) {
    const defaultConfig: WebSocketConfig = {
      port: Number(process.env.WEBSOCKET_PORT) || 3001,
      path: process.env.WEBSOCKET_PATH || "/ws",
      cors: {
        origin:
          process.env.NODE_ENV === "production"
            ? process.env.FRONTEND_URL || "http://localhost:5173"
            : "*",
        credentials: true,
      },
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.io = new SocketIOServer(httpServer, {
      path: finalConfig.path,
      cors: finalConfig.cors,
      transports: ["websocket", "polling"],
    });

    this.emailAnalyticsService = new EmailAnalyticsService();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startBroadcastIntervals();

    logger.info("WebSocket server initialized", "WEBSOCKET", {
      config: finalConfig,
    });
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        // TODO: Implement proper JWT authentication
        const token = socket.handshake.auth.token;

        if (!token) {
          // For now, allow anonymous connections
          socket.sessionId = `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          logger.info("Anonymous WebSocket connection", "WEBSOCKET", {
            sessionId: socket.sessionId,
          });
          return next();
        }

        // Validate token and extract user info
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // socket.userId = decoded.userId;
        // socket.sessionId = decoded.sessionId;

        next();
      } catch (error) {
        logger.error("WebSocket authentication failed", "WEBSOCKET", { error });
        next(new Error("Authentication failed"));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      logger.info("Client connected", "WEBSOCKET", {
        socketId: socket.id,
        sessionId: socket.sessionId,
        userId: socket.userId,
      });

      // Join user-specific room if authenticated
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Handle subscription to specific data streams
      socket.on("subscribe", async (channels: string[]) => {
        for (const channel of channels) {
          socket.join(channel);
          logger.debug("Client subscribed to channel", "WEBSOCKET", {
            socketId: socket.id,
            channel,
          });

          // Send initial data for the channel
          await this.sendInitialData(socket, channel);
        }
      });

      // Handle unsubscription
      socket.on("unsubscribe", (channels: string[]) => {
        for (const channel of channels) {
          socket.leave(channel);
          logger.debug("Client unsubscribed from channel", "WEBSOCKET", {
            socketId: socket.id,
            channel,
          });
        }
      });

      // Handle custom events
      socket.on("request:emailStats", async () => {
        try {
          const stats = await this.getEmailStats();
          socket.emit("response:emailStats", stats);
        } catch (error) {
          socket.emit("error", { message: "Failed to fetch email stats" });
        }
      });

      socket.on("request:refreshData", async (dataType: string) => {
        try {
          await this.refreshAndBroadcastData(dataType);
          socket.emit("response:refreshData", { success: true, dataType });
        } catch (error) {
          socket.emit("error", { message: `Failed to refresh ${dataType}` });
        }
      });

      // Handle disconnection
      socket.on("disconnect", (reason) => {
        logger.info("Client disconnected", "WEBSOCKET", {
          socketId: socket.id,
          sessionId: socket.sessionId,
          reason,
        });
      });

      // Handle errors
      socket.on("error", (error) => {
        logger.error("WebSocket error", "WEBSOCKET", {
          socketId: socket.id,
          error,
        });
      });
    });
  }

  private async sendInitialData(
    socket: Socket,
    channel: string,
  ): Promise<void> {
    try {
      switch (channel) {
        case "email:stats": {
          const stats = await this.getEmailStats();
          socket.emit("data:emailStats", stats);
          break;
        }

        case "email:dailyVolume": {
          const dailyVolume = await this.getDailyVolume();
          socket.emit("data:dailyVolume", dailyVolume);
          break;
        }

        case "email:entityMetrics": {
          const entityMetrics = await this.getEntityMetrics();
          socket.emit("data:entityMetrics", entityMetrics);
          break;
        }

        case "email:workflowDistribution": {
          const workflowDist = await this.getWorkflowDistribution();
          socket.emit("data:workflowDistribution", workflowDist);
          break;
        }

        case "email:urgencyDistribution": {
          const urgencyDist = await this.getUrgencyDistribution();
          socket.emit("data:urgencyDistribution", urgencyDist);
          break;
        }
      }
    } catch (error) {
      logger.error("Failed to send initial data", "WEBSOCKET", {
        channel,
        error,
      });
      socket.emit("error", { message: `Failed to load ${channel} data` });
    }
  }

  private startBroadcastIntervals(): void {
    // Broadcast email stats every 5 seconds
    const statsInterval = setInterval(async () => {
      try {
        const stats = await this.getEmailStats();
        this.io.to("email:stats").emit("data:emailStats", stats);
      } catch (error) {
        logger.error("Failed to broadcast email stats", "WEBSOCKET", { error });
      }
    }, 5000);
    this.updateIntervals.set("emailStats", statsInterval);

    // Broadcast daily volume every 30 seconds
    const volumeInterval = setInterval(async () => {
      try {
        const dailyVolume = await this.getDailyVolume();
        this.io.to("email:dailyVolume").emit("data:dailyVolume", dailyVolume);
      } catch (error) {
        logger.error("Failed to broadcast daily volume", "WEBSOCKET", {
          error,
        });
      }
    }, 30000);
    this.updateIntervals.set("dailyVolume", volumeInterval);

    // Broadcast entity metrics every 30 seconds
    const entityInterval = setInterval(async () => {
      try {
        const entityMetrics = await this.getEntityMetrics();
        this.io
          .to("email:entityMetrics")
          .emit("data:entityMetrics", entityMetrics);
      } catch (error) {
        logger.error("Failed to broadcast entity metrics", "WEBSOCKET", {
          error,
        });
      }
    }, 30000);
    this.updateIntervals.set("entityMetrics", entityInterval);

    // Broadcast workflow distribution every 60 seconds
    const workflowInterval = setInterval(async () => {
      try {
        const workflowDist = await this.getWorkflowDistribution();
        this.io
          .to("email:workflowDistribution")
          .emit("data:workflowDistribution", workflowDist);
      } catch (error) {
        logger.error("Failed to broadcast workflow distribution", "WEBSOCKET", {
          error,
        });
      }
    }, 60000);
    this.updateIntervals.set("workflowDistribution", workflowInterval);
  }

  /**
   * Get email stats with caching
   */
  private async getEmailStats() {
    return await redisService.cacheWithFallback(
      CacheKeys.emailStats(),
      async () => await this.emailAnalyticsService.getStats(),
      CacheTTL.SHORT,
    );
  }

  /**
   * Get daily volume with caching
   */
  private async getDailyVolume() {
    return await redisService.cacheWithFallback(
      CacheKeys.emailDailyVolume(7),
      async () => {
        const service = new EmailAnalyticsService();
        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);

          // This would need to be implemented in EmailAnalyticsService
          return { startDate, endDate, data: [] };
        } finally {
          service.close();
        }
      },
      CacheTTL.MEDIUM,
    );
  }

  /**
   * Get entity metrics with caching
   */
  private async getEntityMetrics() {
    return await redisService.cacheWithFallback(
      CacheKeys.emailEntityMetrics(),
      async () => {
        // This would need to be implemented
        return { entities: [], totalExtractions: 0, avgConfidence: 0 };
      },
      CacheTTL.MEDIUM,
    );
  }

  /**
   * Get workflow distribution with caching
   */
  private async getWorkflowDistribution() {
    return await redisService.cacheWithFallback(
      CacheKeys.emailWorkflowDistribution(),
      async () => {
        // This would need to be implemented
        return { workflows: [], totalProcessed: 0 };
      },
      CacheTTL.MEDIUM,
    );
  }

  /**
   * Get urgency distribution with caching
   */
  private async getUrgencyDistribution() {
    return await redisService.cacheWithFallback(
      CacheKeys.emailUrgencyDistribution(),
      async () => {
        // This would need to be implemented
        return { distribution: [], total: 0 };
      },
      CacheTTL.MEDIUM,
    );
  }

  /**
   * Refresh and broadcast specific data type
   */
  private async refreshAndBroadcastData(dataType: string): Promise<void> {
    switch (dataType) {
      case "emailStats": {
        await redisService.delete(CacheKeys.emailStats());
        const stats = await this.getEmailStats();
        this.io.to("email:stats").emit("data:emailStats", stats);
        break;
      }

      case "dailyVolume": {
        await redisService.delete(CacheKeys.emailDailyVolume(7));
        const dailyVolume = await this.getDailyVolume();
        this.io.to("email:dailyVolume").emit("data:dailyVolume", dailyVolume);
        break;
      }

      // Add more cases as needed
    }
  }

  /**
   * Emit event to specific user
   */
  public emitToUser(userId: string, event: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to specific channel
   */
  public emitToChannel(channel: string, event: string, data: unknown): void {
    this.io.to(channel).emit(event, data);
  }

  /**
   * Broadcast event to all connected clients
   */
  public broadcast(event: string, data: unknown): void {
    this.io.emit(event, data);
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      connectedClients: this.io.engine.clientsCount,
      rooms: this.io.sockets.adapter.rooms.size,
      updateIntervals: this.updateIntervals.size,
    };
  }

  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    logger.info("Shutting down WebSocket server", "WEBSOCKET");

    // Clear all intervals
    for (const [name, interval] of this.updateIntervals) {
      clearInterval(interval);
      logger.debug(`Cleared interval: ${name}`, "WEBSOCKET");
    }
    this.updateIntervals.clear();

    // Close all connections
    this.io.disconnectSockets(true);

    // Close email analytics service
    this.emailAnalyticsService.close();

    // Close the server
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        logger.info("WebSocket server closed", "WEBSOCKET");
        resolve();
      });
    });
  }
}

// Export events enum for type safety
export enum WebSocketEvents {
  // Client -> Server
  SUBSCRIBE = "subscribe",
  UNSUBSCRIBE = "unsubscribe",
  REQUEST_EMAIL_STATS = "request:emailStats",
  REQUEST_REFRESH_DATA = "request:refreshData",

  // Server -> Client
  DATA_EMAIL_STATS = "data:emailStats",
  DATA_DAILY_VOLUME = "data:dailyVolume",
  DATA_ENTITY_METRICS = "data:entityMetrics",
  DATA_WORKFLOW_DISTRIBUTION = "data:workflowDistribution",
  DATA_URGENCY_DISTRIBUTION = "data:urgencyDistribution",
  RESPONSE_EMAIL_STATS = "response:emailStats",
  RESPONSE_REFRESH_DATA = "response:refreshData",

  // Notifications
  NOTIFICATION_EMAIL_PROCESSED = "notification:emailProcessed",
  NOTIFICATION_HIGH_PRIORITY = "notification:highPriority",
  NOTIFICATION_RULE_TRIGGERED = "notification:ruleTriggered",
  NOTIFICATION_PRICE_ALERT = "notification:priceAlert",

  // Errors
  ERROR = "error",
}

// Export channels for consistency
export enum WebSocketChannels {
  EMAIL_STATS = "email:stats",
  EMAIL_DAILY_VOLUME = "email:dailyVolume",
  EMAIL_ENTITY_METRICS = "email:entityMetrics",
  EMAIL_WORKFLOW_DISTRIBUTION = "email:workflowDistribution",
  EMAIL_URGENCY_DISTRIBUTION = "email:urgencyDistribution",
  WALMART_PRICE_ALERTS = "walmart:priceAlerts",
  AUTOMATION_RULES = "automation:rules",
  SYSTEM_NOTIFICATIONS = "system:notifications",
}
