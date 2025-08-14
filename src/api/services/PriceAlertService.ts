/**
 * Price Alert Service
 * Manages price alerts, monitors price changes, and triggers notifications
 */

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";
import { bestPracticeWSServer } from "../websocket/WebSocketBestPracticesImplementation.js";
import type { 
  DealAlert, 
  DealNotification, 
  TrackedDeal,
  PriceChangeEvent 
} from "../../types/price-alerts.js";

export interface CreateAlertParams {
  userId: string;
  alertName: string;
  alertType: "price_drop" | "stock_alert" | "sale_alert" | "custom";
  productName?: string;
  productBrand?: string;
  productCategory?: string;
  upcCode?: string;
  targetPrice?: number;
  priceDropPercentage?: number;
  priceDropAmount?: number;
  alertFrequency?: "immediate" | "hourly" | "daily" | "weekly";
  notificationMethods?: string[];
  conditions?: any;
}

export interface PriceCheckResult {
  productId: string;
  productName: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  percentageChange: number;
  triggeredAlerts: string[];
}

export class PriceAlertService extends EventEmitter {
  private db: Database.Database;
  private checkInterval: NodeJS.Timeout | null = null;
  private notificationQueue: Map<string, DealNotification[]> = new Map();
  private isProcessing = false;
  
  // Configuration
  private config = {
    checkIntervalMinutes: 5,
    batchSize: 100,
    maxRetries: 3,
    notificationDelay: 1000, // ms between notifications
    enableWebSocket: true,
    enableEmail: false, // Would need email service integration
    enableSMS: false, // Would need SMS service integration
    enablePush: false // Would need push notification service
  };

  constructor(db: Database.Database, config?: Partial<typeof PriceAlertService.prototype.config>) {
    super();
    this.db = db;
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize the service and start monitoring
   */
  async initialize() {
    logger.info("Initializing Price Alert Service", "PRICE_ALERTS");
    
    // Ensure tables exist
    this.ensureTablesExist();
    
    // Start price monitoring
    this.startPriceMonitoring();
    
    // Start notification processor
    this.startNotificationProcessor();
    
    logger.info("Price Alert Service initialized", "PRICE_ALERTS");
  }

  /**
   * Create a new price alert
   */
  createAlert(params: CreateAlertParams): DealAlert {
    const alertId = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO deal_alerts (
        id, user_id, alert_name, alert_type, product_name, product_brand,
        product_category, upc_code, target_price, price_drop_percentage,
        price_drop_amount, alert_frequency, notification_methods,
        conditions, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?
      )
    `);
    
    stmt.run(
      alertId,
      params.userId,
      params.alertName,
      params.alertType,
      params.productName || null,
      params.productBrand || null,
      params.productCategory || null,
      params.upcCode || null,
      params.targetPrice || null,
      params.priceDropPercentage || null,
      params.priceDropAmount || null,
      params.alertFrequency || 'immediate',
      JSON.stringify(params.notificationMethods || ['push', 'email']),
      JSON.stringify(params.conditions || {}),
      now,
      now
    );
    
    logger.info(`Created price alert ${alertId} for user ${params.userId}`, "PRICE_ALERTS");
    
    // Emit event
    this.emit("alert:created", { alertId, userId: params.userId, params });
    
    return this.getAlert(alertId)!;
  }

  /**
   * Get a specific alert
   */
  getAlert(alertId: string): DealAlert | null {
    const stmt = this.db.prepare(`SELECT * FROM deal_alerts WHERE id = ?`);
    const row = stmt.get(alertId) as any;
    
    if (!row) return null;
    
    return this.rowToAlert(row);
  }

  /**
   * Get all alerts for a user
   */
  getUserAlerts(userId: string, status?: string): DealAlert[] {
    const query = status 
      ? `SELECT * FROM deal_alerts WHERE user_id = ? AND status = ? ORDER BY created_at DESC`
      : `SELECT * FROM deal_alerts WHERE user_id = ? ORDER BY created_at DESC`;
    
    const stmt = this.db.prepare(query);
    const rows = status ? stmt.all(userId, status) : stmt.all(userId);
    
    return rows.map((row: any) => this.rowToAlert(row));
  }

  /**
   * Update an alert
   */
  updateAlert(alertId: string, updates: Partial<CreateAlertParams>): boolean {
    const updateFields: string[] = [];
    const values: any[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      const dbField = this.camelToSnake(key);
      updateFields.push(`${dbField} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    });
    
    if (updateFields.length === 0) return false;
    
    values.push(new Date().toISOString(), alertId);
    
    const stmt = this.db.prepare(`
      UPDATE deal_alerts 
      SET ${updateFields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    
    if (result.changes > 0) {
      logger.info(`Updated alert ${alertId}`, "PRICE_ALERTS");
      this.emit("alert:updated", { alertId, updates });
      return true;
    }
    
    return false;
  }

  /**
   * Delete an alert
   */
  deleteAlert(alertId: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM deal_alerts WHERE id = ?`);
    const result = stmt.run(alertId);
    
    if (result.changes > 0) {
      logger.info(`Deleted alert ${alertId}`, "PRICE_ALERTS");
      this.emit("alert:deleted", { alertId });
      return true;
    }
    
    return false;
  }

  /**
   * Pause an alert
   */
  pauseAlert(alertId: string): boolean {
    return this.updateAlertStatus(alertId, 'paused');
  }

  /**
   * Resume an alert
   */
  resumeAlert(alertId: string): boolean {
    return this.updateAlertStatus(alertId, 'active');
  }

  /**
   * Update alert status
   */
  private updateAlertStatus(alertId: string, status: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE deal_alerts 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(status, new Date().toISOString(), alertId);
    
    if (result.changes > 0) {
      logger.info(`Updated alert ${alertId} status to ${status}`, "PRICE_ALERTS");
      this.emit("alert:status_changed", { alertId, status });
      return true;
    }
    
    return false;
  }

  /**
   * Check if a price change triggers any alerts
   */
  async checkPriceChange(productInfo: {
    productName: string;
    productBrand?: string;
    productCategory?: string;
    upcCode?: string;
    currentPrice: number;
    previousPrice: number;
    storeName?: string;
  }): Promise<PriceCheckResult> {
    const { currentPrice, previousPrice, productName } = productInfo;
    const priceChange = currentPrice - previousPrice;
    const percentageChange = ((priceChange / previousPrice) * 100);
    
    // Find matching active alerts
    const alerts = this.findMatchingAlerts(productInfo);
    const triggeredAlerts: string[] = [];
    
    for (const alert of alerts) {
      if (this.shouldTriggerAlert(alert, currentPrice, previousPrice)) {
        triggeredAlerts.push(alert.id);
        await this.triggerAlert(alert, productInfo);
      }
    }
    
    const result: PriceCheckResult = {
      productId: productInfo.upcCode || productName,
      productName,
      currentPrice,
      previousPrice,
      priceChange,
      percentageChange,
      triggeredAlerts
    };
    
    if (triggeredAlerts.length > 0) {
      logger.info(`Price change triggered ${triggeredAlerts.length} alerts for ${productName}`, "PRICE_ALERTS");
      this.emit("price:alerts_triggered", result);
    }
    
    return result;
  }

  /**
   * Find alerts matching a product
   */
  private findMatchingAlerts(productInfo: any): DealAlert[] {
    const conditions: string[] = [`status = 'active'`];
    const params: any[] = [];
    
    // Build matching conditions
    if (productInfo.upcCode) {
      conditions.push(`(upc_code = ? OR upc_code IS NULL)`);
      params.push(productInfo.upcCode);
    }
    
    if (productInfo.productName) {
      conditions.push(`(product_name LIKE ? OR product_name IS NULL)`);
      params.push(`%${productInfo.productName}%`);
    }
    
    if (productInfo.productBrand) {
      conditions.push(`(product_brand = ? OR product_brand IS NULL)`);
      params.push(productInfo.productBrand);
    }
    
    if (productInfo.productCategory) {
      conditions.push(`(product_category = ? OR product_category IS NULL)`);
      params.push(productInfo.productCategory);
    }
    
    const query = `
      SELECT * FROM deal_alerts 
      WHERE ${conditions.join(' AND ')}
      ORDER BY priority DESC
    `;
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map((row: any) => this.rowToAlert(row));
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(alert: DealAlert, currentPrice: number, previousPrice: number): boolean {
    // Check if price dropped
    if (currentPrice >= previousPrice) return false;
    
    const priceDrop = previousPrice - currentPrice;
    const percentDrop = (priceDrop / previousPrice) * 100;
    
    // Check target price
    if (alert.targetPrice && currentPrice <= alert.targetPrice) {
      return true;
    }
    
    // Check price drop amount
    if (alert.priceDropAmount && priceDrop >= alert.priceDropAmount) {
      return true;
    }
    
    // Check price drop percentage
    if (alert.priceDropPercentage && percentDrop >= alert.priceDropPercentage) {
      return true;
    }
    
    // Check maximum acceptable price
    if (alert.maximumAcceptablePrice && currentPrice > alert.maximumAcceptablePrice) {
      return false;
    }
    
    return false;
  }

  /**
   * Trigger an alert and create notifications
   */
  private async triggerAlert(alert: DealAlert, productInfo: any) {
    const notificationId = uuidv4();
    const now = new Date().toISOString();
    
    // Create notification record
    const notification: DealNotification = {
      id: notificationId,
      alertId: alert.id,
      userId: alert.userId,
      notificationType: 'push', // Default, will create multiple for each method
      subject: `Price Alert: ${productInfo.productName}`,
      messageContent: this.generateNotificationMessage(alert, productInfo),
      productName: productInfo.productName,
      productBrand: productInfo.productBrand,
      productCategory: productInfo.productCategory,
      storeName: productInfo.storeName,
      originalPrice: productInfo.previousPrice,
      salePrice: productInfo.currentPrice,
      discountPercentage: ((productInfo.previousPrice - productInfo.currentPrice) / productInfo.previousPrice * 100),
      discountAmount: productInfo.previousPrice - productInfo.currentPrice,
      sentAt: now,
      deliveryStatus: 'pending',
      createdAt: now,
      updatedAt: now
    };
    
    // Queue notifications for each method
    const methods = JSON.parse(alert.notificationMethods || '["push"]');
    for (const method of methods) {
      const methodNotification = { ...notification, notificationType: method as any };
      this.queueNotification(methodNotification);
    }
    
    // Update alert statistics
    this.updateAlertStatistics(alert.id);
    
    // Store notification in database
    this.storeNotification(notification);
  }

  /**
   * Generate notification message
   */
  private generateNotificationMessage(alert: DealAlert, productInfo: any): string {
    const savings = productInfo.previousPrice - productInfo.currentPrice;
    const percentOff = ((savings / productInfo.previousPrice) * 100).toFixed(0);
    
    return `🎯 ${productInfo.productName} is now ${percentOff}% off!\n` +
           `Was: $${productInfo.previousPrice.toFixed(2)}\n` +
           `Now: $${productInfo.currentPrice.toFixed(2)}\n` +
           `You save: $${savings.toFixed(2)}\n` +
           `${productInfo.storeName ? `Available at ${productInfo.storeName}` : ''}`;
  }

  /**
   * Queue notification for delivery
   */
  private queueNotification(notification: DealNotification) {
    const userId = notification.userId;
    
    if (!this.notificationQueue.has(userId)) {
      this.notificationQueue.set(userId, []);
    }
    
    this.notificationQueue.get(userId)!.push(notification);
  }

  /**
   * Store notification in database
   */
  private storeNotification(notification: DealNotification) {
    const stmt = this.db.prepare(`
      INSERT INTO deal_notifications (
        id, alert_id, user_id, notification_type, subject, message_content,
        product_name, product_brand, product_category, store_name,
        original_price, sale_price, discount_percentage, discount_amount,
        sent_at, delivery_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      notification.id,
      notification.alertId,
      notification.userId,
      notification.notificationType,
      notification.subject,
      notification.messageContent,
      notification.productName,
      notification.productBrand || null,
      notification.productCategory || null,
      notification.storeName || null,
      notification.originalPrice,
      notification.salePrice,
      notification.discountPercentage,
      notification.discountAmount,
      notification.sentAt,
      notification.deliveryStatus,
      notification.createdAt,
      notification.updatedAt
    );
  }

  /**
   * Update alert statistics
   */
  private updateAlertStatistics(alertId: string) {
    const stmt = this.db.prepare(`
      UPDATE deal_alerts
      SET times_triggered = times_triggered + 1,
          last_triggered_at = ?,
          updated_at = ?
      WHERE id = ?
    `);
    
    const now = new Date().toISOString();
    stmt.run(now, now, alertId);
  }

  /**
   * Start price monitoring
   */
  private startPriceMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(() => {
      this.performPriceCheck();
    }, this.config.checkIntervalMinutes * 60 * 1000);
    
    // Perform initial check
    this.performPriceCheck();
    
    logger.info(`Started price monitoring (interval: ${this.config.checkIntervalMinutes} minutes)`, "PRICE_ALERTS");
  }

  /**
   * Perform price check for all tracked products
   */
  private async performPriceCheck() {
    if (this.isProcessing) {
      logger.warn("Price check already in progress, skipping", "PRICE_ALERTS");
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Get all tracked products with recent price changes
      const stmt = this.db.prepare(`
        SELECT * FROM products 
        WHERE last_price_update > datetime('now', '-1 day')
        ORDER BY last_price_update DESC
        LIMIT ?
      `);
      
      const products = stmt.all(this.config.batchSize);
      
      for (const product of products) {
        // Check if price has changed
        if (product.previous_price && product.price !== product.previous_price) {
          await this.checkPriceChange({
            productName: product.name,
            productBrand: product.brand,
            productCategory: product.category,
            upcCode: product.upc,
            currentPrice: product.price,
            previousPrice: product.previous_price,
            storeName: product.store_name
          });
        }
      }
      
      logger.info(`Completed price check for ${products.length} products`, "PRICE_ALERTS");
      
    } catch (error) {
      logger.error(`Price check failed: ${error}`, "PRICE_ALERTS");
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start notification processor
   */
  private startNotificationProcessor() {
    setInterval(() => {
      this.processNotificationQueue();
    }, this.config.notificationDelay);
    
    logger.info("Started notification processor", "PRICE_ALERTS");
  }

  /**
   * Process notification queue
   */
  private async processNotificationQueue() {
    if (this.notificationQueue.size === 0) return;
    
    for (const [userId, notifications] of this.notificationQueue.entries()) {
      if (notifications.length === 0) continue;
      
      // Process batch of notifications for user
      const batch = notifications.splice(0, 10); // Process up to 10 at a time
      
      for (const notification of batch) {
        await this.sendNotification(notification);
      }
      
      // Clean up empty queues
      if (notifications.length === 0) {
        this.notificationQueue.delete(userId);
      }
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(notification: DealNotification) {
    try {
      switch (notification.notificationType) {
        case 'push':
          await this.sendWebSocketNotification(notification);
          break;
        case 'email':
          if (this.config.enableEmail) {
            await this.sendEmailNotification(notification);
          }
          break;
        case 'sms':
          if (this.config.enableSMS) {
            await this.sendSMSNotification(notification);
          }
          break;
        default:
          logger.warn(`Unknown notification type: ${notification.notificationType}`, "PRICE_ALERTS");
      }
      
      // Update delivery status
      this.updateNotificationStatus(notification.id, 'sent');
      
    } catch (error) {
      logger.error(`Failed to send notification ${notification.id}: ${error}`, "PRICE_ALERTS");
      this.updateNotificationStatus(notification.id, 'failed');
    }
  }

  /**
   * Send WebSocket notification
   */
  private async sendWebSocketNotification(notification: DealNotification) {
    if (!this.config.enableWebSocket) return;
    
    // Send via WebSocket server
    bestPracticeWSServer.sendToUser(notification.userId, {
      type: 'price_alert',
      payload: {
        alertId: notification.alertId,
        productName: notification.productName,
        originalPrice: notification.originalPrice,
        salePrice: notification.salePrice,
        savings: notification.discountAmount,
        percentOff: notification.discountPercentage,
        message: notification.messageContent,
        storeName: notification.storeName,
        timestamp: notification.sentAt
      },
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Sent WebSocket notification for alert ${notification.alertId}`, "PRICE_ALERTS");
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(notification: DealNotification) {
    // TODO: Integrate with email service
    logger.info(`Email notification would be sent for alert ${notification.alertId}`, "PRICE_ALERTS");
  }

  /**
   * Send SMS notification (placeholder)
   */
  private async sendSMSNotification(notification: DealNotification) {
    // TODO: Integrate with SMS service (Twilio, etc.)
    logger.info(`SMS notification would be sent for alert ${notification.alertId}`, "PRICE_ALERTS");
  }

  /**
   * Update notification status
   */
  private updateNotificationStatus(notificationId: string, status: string) {
    const stmt = this.db.prepare(`
      UPDATE deal_notifications
      SET delivery_status = ?, updated_at = ?
      WHERE id = ?
    `);
    
    stmt.run(status, new Date().toISOString(), notificationId);
  }

  /**
   * Get notification history for user
   */
  getNotificationHistory(userId: string, limit = 50): DealNotification[] {
    const stmt = this.db.prepare(`
      SELECT * FROM deal_notifications
      WHERE user_id = ?
      ORDER BY sent_at DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(userId, limit);
    return rows.map((row: any) => this.rowToNotification(row));
  }

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string) {
    const stmt = this.db.prepare(`
      UPDATE deal_notifications
      SET read_at = ?, updated_at = ?
      WHERE id = ?
    `);
    
    const now = new Date().toISOString();
    stmt.run(now, now, notificationId);
  }

  /**
   * Mark notification as clicked
   */
  markNotificationAsClicked(notificationId: string) {
    const stmt = this.db.prepare(`
      UPDATE deal_notifications
      SET was_clicked = true, clicked_at = ?, updated_at = ?
      WHERE id = ?
    `);
    
    const now = new Date().toISOString();
    stmt.run(now, now, notificationId);
  }

  /**
   * Get alert analytics
   */
  getAlertAnalytics(userId?: string) {
    const userCondition = userId ? `WHERE user_id = ?` : '';
    
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_alerts,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_alerts,
        SUM(times_triggered) as total_triggers,
        SUM(times_clicked) as total_clicks,
        SUM(times_purchased) as total_purchases,
        SUM(total_savings_generated) as total_savings,
        AVG(effectiveness_score) as avg_effectiveness
      FROM deal_alerts
      ${userCondition}
    `);
    
    const result = userId ? stmt.get(userId) : stmt.get();
    
    return {
      totalAlerts: result.total_alerts || 0,
      activeAlerts: result.active_alerts || 0,
      totalTriggers: result.total_triggers || 0,
      totalClicks: result.total_clicks || 0,
      totalPurchases: result.total_purchases || 0,
      totalSavings: result.total_savings || 0,
      avgEffectiveness: result.avg_effectiveness || 0
    };
  }

  /**
   * Ensure required tables exist
   */
  private ensureTablesExist() {
    // Check if tables exist, create if not
    const tables = ['deal_alerts', 'deal_notifications', 'deal_sources', 'tracked_deals'];
    
    for (const table of tables) {
      const result = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);
      
      if (!result) {
        logger.warn(`Table ${table} does not exist. Run migrations to create it.`, "PRICE_ALERTS");
      }
    }
  }

  /**
   * Convert row to DealAlert object
   */
  private rowToAlert(row: any): DealAlert {
    return {
      id: row.id,
      userId: row.user_id,
      alertName: row.alert_name,
      alertDescription: row.alert_description,
      alertType: row.alert_type,
      productName: row.product_name,
      productBrand: row.product_brand,
      productCategory: row.product_category,
      upcCode: row.upc_code,
      sku: row.sku,
      keywords: row.keywords ? JSON.parse(row.keywords) : [],
      exactMatchRequired: row.exact_match_required,
      targetPrice: row.target_price,
      priceDropPercentage: row.price_drop_percentage,
      priceDropAmount: row.price_drop_amount,
      maximumAcceptablePrice: row.maximum_acceptable_price,
      minimumQualityThreshold: row.minimum_quality_threshold,
      preferredStores: row.preferred_stores ? JSON.parse(row.preferred_stores) : [],
      excludedStores: row.excluded_stores ? JSON.parse(row.excluded_stores) : [],
      onlineDealsIncluded: row.online_deals_included,
      inStoreDealsIncluded: row.in_store_deals_included,
      requireImmediateAvailability: row.require_immediate_availability,
      alertFrequency: row.alert_frequency,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      alertDays: row.alert_days ? JSON.parse(row.alert_days) : [],
      status: row.status,
      priority: row.priority,
      maxAlertsPerDay: row.max_alerts_per_day,
      alertsSentToday: row.alerts_sent_today,
      lastResetDate: row.last_reset_date,
      expirationDate: row.expiration_date,
      autoExpireAfterDays: row.auto_expire_after_days,
      autoPauseIfNotFoundDays: row.auto_pause_if_not_found_days,
      autoDeleteAfterFulfillment: row.auto_delete_after_fulfillment,
      notificationMethods: row.notification_methods,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      smsNotifications: row.sms_notifications,
      conditions: row.conditions ? JSON.parse(row.conditions) : {},
      seasonalRestrictions: row.seasonal_restrictions ? JSON.parse(row.seasonal_restrictions) : null,
      quantityRequirements: row.quantity_requirements ? JSON.parse(row.quantity_requirements) : null,
      timesTriggered: row.times_triggered,
      timesClicked: row.times_clicked,
      timesPurchased: row.times_purchased,
      totalSavingsGenerated: row.total_savings_generated,
      lastTriggeredAt: row.last_triggered_at,
      lastPriceSeen: row.last_price_seen,
      lastAvailabilityCheck: row.last_availability_check,
      effectivenessScore: row.effectiveness_score,
      userSatisfactionRating: row.user_satisfaction_rating,
      autoOptimizationEnabled: row.auto_optimization_enabled,
      tags: row.tags ? JSON.parse(row.tags) : [],
      notes: row.notes,
      customWebhookUrl: row.custom_webhook_url,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by
    };
  }

  /**
   * Convert row to DealNotification object
   */
  private rowToNotification(row: any): DealNotification {
    return {
      id: row.id,
      alertId: row.alert_id,
      userId: row.user_id,
      notificationType: row.notification_type,
      subject: row.subject,
      messageContent: row.message_content,
      productName: row.product_name,
      productBrand: row.product_brand,
      productCategory: row.product_category,
      storeName: row.store_name,
      originalPrice: row.original_price,
      salePrice: row.sale_price,
      discountPercentage: row.discount_percentage,
      discountAmount: row.discount_amount,
      availabilityStatus: row.availability_status,
      urgencyLevel: row.urgency_level,
      dealExpiresAt: row.deal_expires_at,
      stockLevel: row.stock_level,
      sentAt: row.sent_at,
      deliveryStatus: row.delivery_status,
      deliveryAttemptCount: row.delivery_attempt_count,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
      clickedAt: row.clicked_at,
      wasClicked: row.was_clicked,
      wasPurchased: row.was_purchased,
      purchaseAmount: row.purchase_amount,
      userFeedback: row.user_feedback,
      userRating: row.user_rating,
      dealUrl: row.deal_url,
      couponCode: row.coupon_code,
      promotionId: row.promotion_id,
      externalDealId: row.external_deal_id,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      deviceType: row.device_type,
      locationContext: row.location_context ? JSON.parse(row.location_context) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    logger.info("Price Alert Service shutdown", "PRICE_ALERTS");
  }
}

// Export singleton instance
let priceAlertService: PriceAlertService | null = null;

export function initializePriceAlertService(db: Database.Database, config?: any): PriceAlertService {
  if (!priceAlertService) {
    priceAlertService = new PriceAlertService(db, config);
    priceAlertService.initialize();
  }
  return priceAlertService;
}

export function getPriceAlertService(): PriceAlertService | null {
  return priceAlertService;
}

export default PriceAlertService;