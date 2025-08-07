/**
 * Deal WebSocket Service - Real-time notifications for deal detection
 * Extends the existing WebSocket service with deal-specific functionality
 */

import { EventEmitter } from "events";
import type { WebSocket } from "ws";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import type Database from "better-sqlite3";
import type { DetectedDeal } from "./DealDetectionEngine.js";
import type { AuthenticatedWebSocket } from "../middleware/websocketAuth.js";

// Deal-specific WebSocket message types
export const DealWebSocketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("deal.detected"),
    deal: z.object({
      id: z.string(),
      productId: z.string(),
      productName: z.string(),
      category: z.string().optional(),
      dealType: z.enum(['price_drop', 'bulk_discount', 'seasonal', 'clearance', 'competitor_match', 'historical_low']),
      currentPrice: z.number(),
      originalPrice: z.number().optional(),
      savingsAmount: z.number(),
      savingsPercentage: z.number(),
      dealScore: z.number(),
      urgencyScore: z.number(),
      stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'unknown']),
      dealExpiresAt: z.string().optional(),
      detectedAt: z.string(),
    }),
    timestamp: z.string(),
    userId: z.string().optional(),
  }),
  z.object({
    type: z.literal("deal.expired"),
    dealId: z.string(),
    productId: z.string(),
    productName: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("deal.price_updated"),
    productId: z.string(),
    productName: z.string(),
    oldPrice: z.number(),
    newPrice: z.number(),
    priceChange: z.number(),
    priceChangePercentage: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("deal.alert_triggered"),
    alertId: z.string(),
    userId: z.string(),
    productId: z.string(),
    productName: z.string(),
    triggerReason: z.string(),
    currentPrice: z.number(),
    targetPrice: z.number().optional(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("deal.bulk_opportunity"),
    productId: z.string(),
    productName: z.string(),
    category: z.string().optional(),
    bulkSavings: z.number(),
    recommendedQuantity: z.number(),
    riskLevel: z.enum(['low', 'medium', 'high']),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("deal.seasonal_alert"),
    category: z.string(),
    season: z.enum(['spring', 'summer', 'fall', 'winter']),
    recommendation: z.enum(['buy_now', 'wait', 'stock_up']),
    expectedSavings: z.number(),
    products: z.array(z.string()),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("deal.pipeline_status"),
    status: z.object({
      isRunning: z.boolean(),
      queueSize: z.number(),
      dealsDetectedLastHour: z.number(),
      pricesUpdatedLastHour: z.number(),
      avgDealScore: z.number(),
      successRate: z.number(),
    }),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("deal.user_preferences_updated"),
    userId: z.string(),
    preferences: z.object({
      categories: z.array(z.string()),
      minSavingsPercentage: z.number(),
      maxPrice: z.number().optional(),
      notificationFrequency: z.enum(['instant', 'hourly', 'daily']),
      dealTypes: z.array(z.string()),
    }),
    timestamp: z.string(),
  }),
]);

export type DealWebSocketMessage = z.infer<typeof DealWebSocketMessageSchema>;

export interface UserPreferences {
  userId: string;
  categories: string[];
  minSavingsPercentage: number;
  maxPrice?: number;
  notificationFrequency: 'instant' | 'hourly' | 'daily';
  dealTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealNotificationQueue {
  id: string;
  userId: string;
  dealId: string;
  messageType: DealWebSocketMessage['type'];
  messageData: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'failed';
  scheduledFor: string;
  createdAt: string;
  sentAt?: string;
  failureReason?: string;
}

export class DealWebSocketService extends EventEmitter {
  private static instance: DealWebSocketService;
  private db: Database.Database;
  
  // Connection management
  private connections: Map<string, AuthenticatedWebSocket> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of connectionIds
  private connectionUsers: Map<string, string> = new Map(); // connectionId -> userId
  
  // Notification management
  private notificationQueue: DealNotificationQueue[] = [];
  private batchNotificationTimer?: NodeJS.Timeout;
  private userPreferences: Map<string, UserPreferences> = new Map();
  
  // Rate limiting
  private userNotificationCounts: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly MAX_NOTIFICATIONS_PER_HOUR = 20;
  
  // Statistics
  private stats = {
    totalConnections: 0,
    activeConnections: 0,
    messagesSent: 0,
    messagesQueued: 0,
    messagesDelivered: 0,
    messagesFailed: 0,
    lastResetAt: new Date().toISOString(),
  };

  private constructor() {
    super();
    
    const dbManager = getDatabaseManager();
    this.db = dbManager.connectionPool?.getConnection().getDatabase() || 
              (() => { throw new Error("Database connection not available"); })();
    
    this.initializeTables();
    this.loadUserPreferences();
    this.startBatchProcessor();
  }

  static getInstance(): DealWebSocketService {
    if (!DealWebSocketService.instance) {
      DealWebSocketService.instance = new DealWebSocketService();
    }
    return DealWebSocketService.instance;
  }

  /**
   * Register a WebSocket connection for deal notifications
   */
  registerConnection(ws: AuthenticatedWebSocket, userId: string): void {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store connection mappings
    this.connections.set(connectionId, ws);
    this.connectionUsers.set(connectionId, userId);
    
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);
    
    // Load user preferences
    this.loadUserPreference(userId);
    
    // Set up connection event handlers
    ws.on('close', () => this.unregisterConnection(connectionId));
    ws.on('error', (error) => {
      logger.warn("WebSocket error", "DEAL_WEBSOCKET", { error, connectionId, userId });
      this.unregisterConnection(connectionId);
    });
    
    // Send initial data
    this.sendWelcomeMessage(ws, userId);
    
    this.stats.totalConnections++;
    this.stats.activeConnections = this.connections.size;
    
    logger.info("Deal WebSocket connection registered", "DEAL_WEBSOCKET", { 
      connectionId, 
      userId,
      activeConnections: this.stats.activeConnections
    });
    
    this.emit('connection_registered', { connectionId, userId });
  }

  /**
   * Unregister a WebSocket connection
   */
  private unregisterConnection(connectionId: string): void {
    const userId = this.connectionUsers.get(connectionId);
    
    this.connections.delete(connectionId);
    this.connectionUsers.delete(connectionId);
    
    if (userId) {
      const userConnections = this.userConnections.get(userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this.userConnections.delete(userId);
        }
      }
    }
    
    this.stats.activeConnections = this.connections.size;
    
    logger.info("Deal WebSocket connection unregistered", "DEAL_WEBSOCKET", { 
      connectionId, 
      userId,
      activeConnections: this.stats.activeConnections
    });
    
    this.emit('connection_unregistered', { connectionId, userId });
  }

  /**
   * Broadcast deal notification to all connected users
   */
  broadcastDealNotification(deal: DetectedDeal): void {
    const message: DealWebSocketMessage = {
      type: 'deal.detected',
      deal: {
        id: deal.id,
        productId: deal.productId,
        productName: deal.productName,
        category: deal.category,
        dealType: deal.dealType,
        currentPrice: deal.currentPrice,
        originalPrice: deal.originalPrice,
        savingsAmount: deal.savingsAmount,
        savingsPercentage: deal.savingsPercentage,
        dealScore: deal.dealScore,
        urgencyScore: deal.urgencyScore,
        stockStatus: deal.stockStatus,
        dealExpiresAt: deal.dealExpiresAt,
        detectedAt: deal.detectedAt,
      },
      timestamp: new Date().toISOString(),
    };

    // Filter users based on preferences
    const interestedUsers = this.getInterestedUsers(deal);
    
    for (const userId of interestedUsers) {
      this.sendToUser(userId, message, 'normal');
    }
    
    logger.info("Deal notification broadcasted", "DEAL_WEBSOCKET", {
      dealId: deal.id,
      productName: deal.productName,
      savings: `${deal.savingsPercentage.toFixed(1)}%`,
      interestedUsers: interestedUsers.length
    });
  }

  /**
   * Send price update notification
   */
  sendPriceUpdate(
    productId: string, 
    productName: string, 
    oldPrice: number, 
    newPrice: number
  ): void {
    const priceChange = newPrice - oldPrice;
    const priceChangePercentage = (priceChange / oldPrice) * 100;
    
    const message: DealWebSocketMessage = {
      type: 'deal.price_updated',
      productId,
      productName,
      oldPrice,
      newPrice,
      priceChange,
      priceChangePercentage,
      timestamp: new Date().toISOString(),
    };

    // Send to users who have alerts for this product
    const interestedUsers = this.getUsersWithProductAlerts(productId);
    
    for (const userId of interestedUsers) {
      this.sendToUser(userId, message, 'low');
    }
  }

  /**
   * Send personalized deal alert
   */
  sendDealAlert(
    userId: string, 
    alertId: string, 
    productId: string, 
    productName: string,
    triggerReason: string,
    currentPrice: number,
    targetPrice?: number
  ): void {
    const message: DealWebSocketMessage = {
      type: 'deal.alert_triggered',
      alertId,
      userId,
      productId,
      productName,
      triggerReason,
      currentPrice,
      targetPrice,
      timestamp: new Date().toISOString(),
    };

    this.sendToUser(userId, message, 'high');
  }

  /**
   * Send pipeline status update
   */
  sendPipelineStatus(status: {
    isRunning: boolean;
    queueSize: number;
    dealsDetectedLastHour: number;
    pricesUpdatedLastHour: number;
    avgDealScore: number;
    successRate: number;
  }): void {
    const message: DealWebSocketMessage = {
      type: 'deal.pipeline_status',
      status,
      timestamp: new Date().toISOString(),
    };

    // Send to all admin users or users with dashboard access
    this.broadcast(message);
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const now = new Date().toISOString();
      const existing = this.userPreferences.get(userId);
      
      const updated: UserPreferences = {
        userId,
        categories: preferences.categories || existing?.categories || [],
        minSavingsPercentage: preferences.minSavingsPercentage ?? existing?.minSavingsPercentage ?? 10,
        maxPrice: preferences.maxPrice ?? existing?.maxPrice,
        notificationFrequency: preferences.notificationFrequency || existing?.notificationFrequency || 'instant',
        dealTypes: preferences.dealTypes || existing?.dealTypes || ['price_drop', 'historical_low'],
        isActive: preferences.isActive ?? existing?.isActive ?? true,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      // Save to database
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO deal_user_preferences (
          user_id, categories, min_savings_percentage, max_price,
          notification_frequency, deal_types, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        userId,
        JSON.stringify(updated.categories),
        updated.minSavingsPercentage,
        updated.maxPrice,
        updated.notificationFrequency,
        JSON.stringify(updated.dealTypes),
        updated.isActive ? 1 : 0,
        updated.createdAt,
        updated.updatedAt
      );

      this.userPreferences.set(userId, updated);

      // Notify user of preference update
      const message: DealWebSocketMessage = {
        type: 'deal.user_preferences_updated',
        userId,
        preferences: {
          categories: updated.categories,
          minSavingsPercentage: updated.minSavingsPercentage,
          maxPrice: updated.maxPrice,
          notificationFrequency: updated.notificationFrequency,
          dealTypes: updated.dealTypes,
        },
        timestamp: now,
      };

      this.sendToUser(userId, message, 'low');

      logger.info("User preferences updated", "DEAL_WEBSOCKET", { userId });

    } catch (error) {
      logger.error("Failed to update user preferences", "DEAL_WEBSOCKET", { error, userId });
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  getStatistics(): typeof this.stats & {
    connectionsByUser: Record<string, number>;
    queuedNotifications: number;
  } {
    const connectionsByUser: Record<string, number> = {};
    for (const [userId, connections] of this.userConnections.entries()) {
      connectionsByUser[userId] = connections.size;
    }

    return {
      ...this.stats,
      connectionsByUser,
      queuedNotifications: this.notificationQueue.length,
    };
  }

  // Private methods

  private initializeTables(): void {
    try {
      // User preferences table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS deal_user_preferences (
          user_id TEXT PRIMARY KEY,
          categories TEXT NOT NULL, -- JSON array
          min_savings_percentage REAL NOT NULL DEFAULT 10,
          max_price REAL,
          notification_frequency TEXT NOT NULL DEFAULT 'instant',
          deal_types TEXT NOT NULL, -- JSON array
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // Notification queue table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS deal_notification_queue (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          deal_id TEXT,
          message_type TEXT NOT NULL,
          message_data TEXT NOT NULL, -- JSON
          priority TEXT DEFAULT 'normal',
          status TEXT DEFAULT 'pending',
          scheduled_for TEXT NOT NULL,
          created_at TEXT NOT NULL,
          sent_at TEXT,
          failure_reason TEXT
        )
      `);

      // Indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_deal_notification_queue_user_status 
        ON deal_notification_queue(user_id, status, scheduled_for)
      `);

      logger.debug("Deal WebSocket tables initialized", "DEAL_WEBSOCKET");

    } catch (error) {
      logger.error("Failed to initialize deal WebSocket tables", "DEAL_WEBSOCKET", { error });
      throw error;
    }
  }

  private loadUserPreferences(): void {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM deal_user_preferences WHERE is_active = 1
      `);

      const rows = stmt.all() as any[];
      
      for (const row of rows) {
        const preferences: UserPreferences = {
          userId: row.user_id,
          categories: JSON.parse(row.categories || '[]'),
          minSavingsPercentage: row.min_savings_percentage,
          maxPrice: row.max_price,
          notificationFrequency: row.notification_frequency,
          dealTypes: JSON.parse(row.deal_types || '[]'),
          isActive: row.is_active === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

        this.userPreferences.set(preferences.userId, preferences);
      }

      logger.info("User preferences loaded", "DEAL_WEBSOCKET", { 
        count: this.userPreferences.size 
      });

    } catch (error) {
      logger.warn("Failed to load user preferences", "DEAL_WEBSOCKET", { error });
    }
  }

  private loadUserPreference(userId: string): void {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM deal_user_preferences WHERE user_id = ? AND is_active = 1
      `);

      const row = stmt.get(userId) as any;
      
      if (row) {
        const preferences: UserPreferences = {
          userId: row.user_id,
          categories: JSON.parse(row.categories || '[]'),
          minSavingsPercentage: row.min_savings_percentage,
          maxPrice: row.max_price,
          notificationFrequency: row.notification_frequency,
          dealTypes: JSON.parse(row.deal_types || '[]'),
          isActive: row.is_active === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

        this.userPreferences.set(userId, preferences);
      }

    } catch (error) {
      logger.warn("Failed to load user preference", "DEAL_WEBSOCKET", { error, userId });
    }
  }

  private getInterestedUsers(deal: DetectedDeal): string[] {
    const interestedUsers: string[] = [];

    for (const [userId, preferences] of this.userPreferences.entries()) {
      if (!preferences.isActive) continue;

      // Check if user is connected
      if (!this.userConnections.has(userId)) continue;

      // Check savings threshold
      if (deal.savingsPercentage < preferences.minSavingsPercentage) continue;

      // Check price threshold
      if (preferences.maxPrice && deal.currentPrice > preferences.maxPrice) continue;

      // Check category preference
      if (preferences.categories.length > 0 && deal.category) {
        const categoryMatch = preferences.categories.some(cat => 
          deal.category!.toLowerCase().includes(cat.toLowerCase())
        );
        if (!categoryMatch) continue;
      }

      // Check deal type preference
      if (preferences.dealTypes.length > 0) {
        if (!preferences.dealTypes.includes(deal.dealType)) continue;
      }

      // Check rate limiting
      if (this.isUserRateLimited(userId)) continue;

      interestedUsers.push(userId);
    }

    return interestedUsers;
  }

  private getUsersWithProductAlerts(productId: string): string[] {
    // This would query the database for users with alerts for this specific product
    // For now, return empty array as a placeholder
    return [];
  }

  private sendToUser(userId: string, message: DealWebSocketMessage, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): void {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      // Queue message for later delivery
      this.queueMessage(userId, message, priority);
      return;
    }

    // Check rate limiting
    if (this.isUserRateLimited(userId) && priority !== 'urgent') {
      this.queueMessage(userId, message, priority);
      return;
    }

    // Send to all user connections
    let sent = false;
    for (const connectionId of userConnections) {
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          sent = true;
          this.stats.messagesSent++;
        } catch (error) {
          logger.warn("Failed to send message to WebSocket", "DEAL_WEBSOCKET", { 
            error, 
            connectionId, 
            userId 
          });
        }
      }
    }

    if (sent) {
      this.incrementUserNotificationCount(userId);
      this.stats.messagesDelivered++;
    } else {
      this.queueMessage(userId, message, priority);
      this.stats.messagesFailed++;
    }
  }

  private broadcast(message: DealWebSocketMessage): void {
    for (const [connectionId, ws] of this.connections.entries()) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          this.stats.messagesSent++;
        } catch (error) {
          logger.warn("Failed to broadcast message to WebSocket", "DEAL_WEBSOCKET", { 
            error, 
            connectionId 
          });
        }
      }
    }
    
    this.stats.messagesDelivered += this.connections.size;
  }

  private queueMessage(userId: string, message: DealWebSocketMessage, priority: 'low' | 'normal' | 'high' | 'urgent'): void {
    const queueItem: DealNotificationQueue = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      dealId: 'deal' in message ? message.deal?.id || '' : '',
      messageType: message.type,
      messageData: JSON.stringify(message),
      priority,
      status: 'pending',
      scheduledFor: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.notificationQueue.push(queueItem);
    this.stats.messagesQueued++;

    // Sort by priority
    this.notificationQueue.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
    });
  }

  private startBatchProcessor(): void {
    this.batchNotificationTimer = setInterval(() => {
      this.processBatchNotifications();
    }, 30000); // Process every 30 seconds
  }

  private processBatchNotifications(): void {
    if (this.notificationQueue.length === 0) return;

    const now = new Date();
    const toProcess = this.notificationQueue.filter(item => 
      item.status === 'pending' && new Date(item.scheduledFor) <= now
    ).slice(0, 50); // Process up to 50 at a time

    for (const item of toProcess) {
      try {
        const message = JSON.parse(item.messageData) as DealWebSocketMessage;
        this.sendToUser(item.userId, message, item.priority);
        
        item.status = 'sent';
        item.sentAt = now.toISOString();
        
      } catch (error) {
        item.status = 'failed';
        item.failureReason = error instanceof Error ? error.message : 'Unknown error';
        logger.warn("Failed to process queued notification", "DEAL_WEBSOCKET", { 
          error, 
          queueItemId: item.id 
        });
      }

      // Remove from queue
      const index = this.notificationQueue.findIndex(q => q.id === item.id);
      if (index >= 0) {
        this.notificationQueue.splice(index, 1);
      }
    }
  }

  private isUserRateLimited(userId: string): boolean {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;
    
    let userCount = this.userNotificationCounts.get(userId);
    if (!userCount || userCount.resetAt <= now) {
      userCount = { count: 0, resetAt: now + hourInMs };
      this.userNotificationCounts.set(userId, userCount);
    }

    return userCount.count >= this.MAX_NOTIFICATIONS_PER_HOUR;
  }

  private incrementUserNotificationCount(userId: string): void {
    const userCount = this.userNotificationCounts.get(userId);
    if (userCount) {
      userCount.count++;
    }
  }

  private sendWelcomeMessage(ws: AuthenticatedWebSocket, userId: string): void {
    const preferences = this.userPreferences.get(userId);
    if (preferences) {
      const welcomeMessage: DealWebSocketMessage = {
        type: 'deal.user_preferences_updated',
        userId,
        preferences: {
          categories: preferences.categories,
          minSavingsPercentage: preferences.minSavingsPercentage,
          maxPrice: preferences.maxPrice,
          notificationFrequency: preferences.notificationFrequency,
          dealTypes: preferences.dealTypes,
        },
        timestamp: new Date().toISOString(),
      };

      try {
        ws.send(JSON.stringify(welcomeMessage));
      } catch (error) {
        logger.warn("Failed to send welcome message", "DEAL_WEBSOCKET", { error, userId });
      }
    }
  }
}