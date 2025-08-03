import type { WebSocketServer } from "ws";
import type { AuthenticatedWebSocket } from "../middleware/websocketAuth";
import { wsService, type WebSocketMessage } from "../services/WebSocketService";
import { logger } from "../../utils/logger";
import type { DealDataService } from "../services/DealDataService";
import type { EmailStorageService } from "../services/EmailStorageService";

// Walmart-specific WebSocket message types that extend the base WebSocketMessage
interface WalmartPriceUpdateMessage extends Omit<WebSocketMessage, 'type'> {
  type: "walmart.price_update";
  productId: string;
  currentPrice: number;
  previousPrice: number;
  percentChange: number;
  timestamp: Date;
}

interface WalmartStockUpdateMessage extends Omit<WebSocketMessage, 'type'> {
  type: "walmart.stock_update";
  productId: string;
  inStock: boolean;
  quantity?: number;
  timestamp: Date;
}

interface WalmartDealAlertMessage extends Omit<WebSocketMessage, 'type'> {
  type: "walmart.deal_alert";
  dealId: string;
  dealDetails: any;
  affectedProducts: string[];
  timestamp: Date;
}

interface WalmartCartSyncMessage extends Omit<WebSocketMessage, 'type'> {
  type: "walmart.cart_sync";
  cartData: any;
  sourceClientId: string;
  timestamp: Date;
  userId: string;
}

interface WalmartRecommendationMessage extends Omit<WebSocketMessage, 'type'> {
  type: "walmart.recommendation";
  recommendations: any[];
  preferences: any;
  timestamp: Date;
  userId: string;
}

type WalmartWSMessage = 
  | WalmartPriceUpdateMessage 
  | WalmartStockUpdateMessage 
  | WalmartDealAlertMessage 
  | WalmartCartSyncMessage 
  | WalmartRecommendationMessage;

// Price monitoring configuration
interface PriceMonitor {
  productId: string;
  targetPrice?: number;
  percentDrop?: number;
  userId: string;
}

// Real-time update manager for Walmart grocery features
export class WalmartRealtimeManager {
  private priceMonitors: Map<string, PriceMonitor[]> = new Map();
  private stockAlerts: Map<string, Set<string>> = new Map(); // productId -> Set<userId>
  private cartSyncClients: Map<string, Set<string>> = new Map(); // userId -> Set<clientId>
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    private dealDataService: DealDataService,
    private emailStorageService: EmailStorageService,
  ) {
    // Start periodic update checks
    this.startUpdateLoop();
  }

  /**
   * Register price monitoring for a product
   */
  registerPriceMonitor(monitor: PriceMonitor): void {
    const { productId, userId } = monitor;

    if (!this.priceMonitors.has(productId)) {
      this.priceMonitors.set(productId, []);
    }

    const monitors = this.priceMonitors.get(productId)!;
    const existingIndex = monitors.findIndex((m) => m.userId === userId);

    if (existingIndex >= 0) {
      monitors[existingIndex] = monitor;
    } else {
      monitors.push(monitor);
    }

    logger.info("Price monitor registered", "WALMART_WS", {
      productId,
      userId,
      targetPrice: monitor.targetPrice,
      percentDrop: monitor.percentDrop,
    });
  }

  /**
   * Register stock alert for a product
   */
  registerStockAlert(productId: string, userId: string): void {
    if (!this.stockAlerts.has(productId)) {
      this.stockAlerts.set(productId, new Set());
    }

    this.stockAlerts.get(productId)!.add(userId);

    logger.info("Stock alert registered", "WALMART_WS", {
      productId,
      userId,
    });
  }

  /**
   * Enable cart synchronization for a user
   */
  enableCartSync(userId: string, clientId: string): void {
    if (!this.cartSyncClients.has(userId)) {
      this.cartSyncClients.set(userId, new Set());
    }

    this.cartSyncClients.get(userId)!.add(clientId);

    logger.info("Cart sync enabled", "WALMART_WS", {
      userId,
      clientId,
    });
  }

  /**
   * Broadcast price update to interested clients
   */
  broadcastPriceUpdate(
    productId: string,
    currentPrice: number,
    previousPrice: number,
  ): void {
    const monitors = this.priceMonitors.get(productId) || [];
    const percentChange =
      ((previousPrice - currentPrice) / previousPrice) * 100;

    monitors.forEach((monitor) => {
      let shouldNotify = false;

      // Check if target price reached
      if (monitor.targetPrice && currentPrice <= monitor.targetPrice) {
        shouldNotify = true;
      }

      // Check if percent drop reached
      if (monitor.percentDrop && percentChange >= monitor.percentDrop) {
        shouldNotify = true;
      }

      if (shouldNotify) {
        const message: WalmartPriceUpdateMessage = {
          type: "walmart.price_update",
          productId,
          currentPrice,
          previousPrice,
          percentChange,
          timestamp: new Date(),
        };

        // Send to all user's connected clients
        wsService.sendToUser(monitor.userId, message);

        logger.info("Price alert sent", "WALMART_WS", {
          userId: monitor.userId,
          productId,
          currentPrice,
          percentChange,
        });
      }
    });
  }

  /**
   * Broadcast stock update
   */
  broadcastStockUpdate(
    productId: string,
    inStock: boolean,
    quantity?: number,
  ): void {
    const interestedUsers = this.stockAlerts.get(productId) || new Set();

    interestedUsers.forEach((userId) => {
      const message: WalmartStockUpdateMessage = {
        type: "walmart.stock_update",
        productId,
        inStock,
        quantity,
        timestamp: new Date(),
      };

      wsService.sendToUser(userId, message);

      logger.info("Stock alert sent", "WALMART_WS", {
        userId,
        productId,
        inStock,
        quantity,
      });
    });

    // Remove alert if item is back in stock
    if (inStock) {
      this.stockAlerts.delete(productId);
    }
  }

  /**
   * Broadcast deal alert
   */
  async broadcastDealAlert(
    dealId: string,
    affectedProducts: string[],
  ): Promise<void> {
    try {
      // Get deal details
      const dealDetails = await this.dealDataService.getDealDetails(dealId);

      if (!dealDetails) {
        logger.warn("Deal not found for alert", "WALMART_WS", { dealId });
        return;
      }

      // Find users monitoring these products
      const affectedUsers = new Set<string>();

      affectedProducts.forEach((productId) => {
        const monitors = this.priceMonitors.get(productId) || [];
        monitors.forEach((monitor) => affectedUsers.add(monitor.userId));

        const stockWatchers = this.stockAlerts.get(productId) || new Set();
        stockWatchers.forEach((userId) => affectedUsers.add(userId));
      });

      // Send deal alert to affected users
      affectedUsers.forEach((userId) => {
        const message: WalmartDealAlertMessage = {
          type: "walmart.deal_alert",
          dealId,
          dealDetails,
          affectedProducts,
          timestamp: new Date(),
        };

        wsService.sendToUser(userId, message);
      });

      logger.info("Deal alerts sent", "WALMART_WS", {
        dealId,
        affectedUsers: affectedUsers.size,
        products: affectedProducts.length,
      });
    } catch (error) {
      logger.error("Failed to broadcast deal alert", "WALMART_WS", { error });
    }
  }

  /**
   * Sync cart updates across devices
   */
  syncCartUpdate(userId: string, cartData: any, sourceClientId: string): void {
    const userClients = this.cartSyncClients.get(userId) || new Set();

    userClients.forEach((clientId) => {
      // Don't send back to source client
      if (clientId !== sourceClientId) {
        const message: WalmartCartSyncMessage = {
          type: "walmart.cart_sync",
          cartData,
          sourceClientId,
          timestamp: new Date(),
          userId,
        };

        wsService.sendToClient(clientId, message);
      }
    });

    logger.info("Cart sync broadcast", "WALMART_WS", {
      userId,
      clients: userClients.size - 1, // Excluding source
    });
  }

  /**
   * Send personalized recommendations
   */
  async sendRecommendations(userId: string, context: any): Promise<void> {
    try {
      // Get user's recent email interactions
      const recentEmails =
        await this.emailStorageService.getRecentEmailsForUser(
          userId,
          7, // Last 7 days
        );

      // Build recommendation context
      const recommendationData = {
        recentSearches: context.searches || [],
        recentPurchases: context.purchases || [],
        emailInsights: recentEmails.map((email) => ({
          subject: email.subject,
          sentiment: email.sentiment,
          entities: email.entities,
        })),
        preferences: context.preferences || {},
      };

      const message: WalmartRecommendationMessage = {
        type: "walmart.recommendation",
        recommendations: recommendationData.emailInsights || [],
        preferences: recommendationData.preferences,
        timestamp: new Date(),
        userId,
      };

      wsService.sendToUser(userId, message);

      logger.info("Recommendations sent", "WALMART_WS", {
        userId,
        emailCount: recentEmails.length,
      });
    } catch (error) {
      logger.error("Failed to send recommendations", "WALMART_WS", { error });
    }
  }

  /**
   * Handle WebSocket message from client
   */
  async handleClientMessage(
    ws: AuthenticatedWebSocket,
    message: any,
  ): Promise<void> {
    try {
      const { type, data } = message;

      switch (type) {
        case "monitor_price":
          this.registerPriceMonitor({
            productId: data.productId,
            targetPrice: data.targetPrice,
            percentDrop: data.percentDrop,
            userId: ws.userId!,
          });
          break;

        case "monitor_stock":
          this.registerStockAlert(data.productId, ws.userId!);
          break;

        case "enable_cart_sync":
          this.enableCartSync(ws.userId!, ws.clientId!);
          break;

        case "cart_update":
          this.syncCartUpdate(ws.userId!, data.cart, ws.clientId!);
          break;

        case "request_recommendations":
          await this.sendRecommendations(ws.userId!, data.context || {});
          break;

        default:
          logger.warn("Unknown Walmart WS message type", "WALMART_WS", {
            type,
          });
      }
    } catch (error) {
      logger.error("Error handling client message", "WALMART_WS", { error });
    }
  }

  /**
   * Start periodic update checks
   */
  private startUpdateLoop(): void {
    // Check for updates every 5 minutes
    this.updateInterval = setInterval(
      async () => {
        try {
          await this.checkPriceUpdates();
          await this.checkStockUpdates();
          await this.checkNewDeals();
        } catch (error) {
          logger.error("Update loop error", "WALMART_WS", { error });
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes
  }

  /**
   * Check for price updates (would integrate with scraping)
   */
  private async checkPriceUpdates(): Promise<void> {
    // This would integrate with the BrightData scraping service
    // For now, it's a placeholder
    logger.info("Checking price updates", "WALMART_WS", {
      monitoredProducts: this.priceMonitors.size,
    });
  }

  /**
   * Check for stock updates
   */
  private async checkStockUpdates(): Promise<void> {
    // This would integrate with the BrightData scraping service
    logger.info("Checking stock updates", "WALMART_WS", {
      monitoredProducts: this.stockAlerts.size,
    });
  }

  /**
   * Check for new deals
   */
  private async checkNewDeals(): Promise<void> {
    try {
      // Check for new deals in the system
      const recentDeals = await this.dealDataService.getRecentDeals(1); // Last hour

      if (recentDeals.length > 0) {
        for (const deal of recentDeals) {
          await this.broadcastDealAlert(deal.id, deal.products || []);
        }
      }
    } catch (error) {
      logger.error("Failed to check new deals", "WALMART_WS", { error });
    }
  }

  /**
   * Remove a client from cart sync
   */
  removeCartSyncClient(userId: string, clientId: string): void {
    const clients = this.cartSyncClients.get(userId);
    if (clients) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.cartSyncClients.delete(userId);
      }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.priceMonitors.clear();
    this.stockAlerts.clear();
    this.cartSyncClients.clear();

    logger.info("Walmart realtime manager cleaned up", "WALMART_WS");
  }
}

/**
 * Setup Walmart-specific WebSocket handlers
 */
export function setupWalmartWebSocket(
  wss: WebSocketServer,
  dealDataService: DealDataService,
  emailStorageService: EmailStorageService,
): WalmartRealtimeManager {
  const manager = new WalmartRealtimeManager(
    dealDataService,
    emailStorageService,
  );

  // Add Walmart-specific message handling
  wss.on("connection", (ws: AuthenticatedWebSocket) => {
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle Walmart-specific messages
        if (
          message.type?.startsWith("walmart_") ||
          [
            "monitor_price",
            "monitor_stock",
            "enable_cart_sync",
            "cart_update",
            "request_recommendations",
          ].includes(message.type)
        ) {
          await manager.handleClientMessage(ws, message);
        }
      } catch (error) {
        logger.error("Failed to handle Walmart WS message", "WALMART_WS", {
          error,
        });
      }
    });

    // Cleanup on disconnect
    ws.on("close", () => {
      if (ws.userId) {
        // Remove from cart sync if applicable
        manager.removeCartSyncClient(ws.userId, ws.clientId!);
      }
    });
  });

  logger.info("Walmart WebSocket handlers setup", "WALMART_WS");

  return manager;
}
