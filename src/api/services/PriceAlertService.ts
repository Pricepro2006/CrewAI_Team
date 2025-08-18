/**
 * Price Alert Service
 * Manages price alerts and notifications for product monitoring
 */

import { Logger } from "../../utils/logger.js";
const logger = Logger.getInstance();

export interface PriceAlert {
  id: string;
  productId: string;
  productName: string;
  productBrand?: string;
  productCategory?: string;
  upcCode?: string;
  targetPrice: number;
  currentPrice: number;
  alertType: 'below' | 'above' | 'change';
  threshold: number;
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  userId?: string;
  status?: string;
}

export interface PriceAlertConfig {
  productId: string;
  targetPrice: number;
  alertType: 'below' | 'above' | 'change';
  threshold?: number;
  userId?: string;
  productBrand?: string;
  productCategory?: string;
  upcCode?: string;
}

export class PriceAlertService {
  private static instance: PriceAlertService;
  private alerts: Map<string, PriceAlert> = new Map();

  static getInstance(): PriceAlertService {
    if (!PriceAlertService.instance) {
      PriceAlertService.instance = new PriceAlertService();
    }
    return PriceAlertService.instance;
  }

  async createAlert(config: PriceAlertConfig): Promise<PriceAlert> {
    try {
      const alert: PriceAlert = {
        id: Math.random().toString(36).substr(2, 9),
        productId: config.productId,
        productName: `Product ${config.productId}`,
        productBrand: config.productBrand,
        productCategory: config.productCategory,
        upcCode: config.upcCode,
        targetPrice: config.targetPrice,
        currentPrice: config.targetPrice + 10, // Mock current price
        alertType: config.alertType,
        threshold: config.threshold || 0,
        isActive: true,
        createdAt: new Date(),
        userId: config.userId,
        status: 'active'
      };

      this?.alerts?.set(alert.id, alert);
      logger.info(`Created price alert ${alert.id} for product ${config.productId}`);
      return alert;
    } catch (error) {
      logger.error('Error creating price alert:', error as string);
      throw error;
    }
  }

  async getAlerts(userId?: string): Promise<PriceAlert[]> {
    try {
      const alerts = Array.from(this?.alerts?.values());
      return userId ? alerts?.filter(alert => alert.userId === userId) : alerts;
    } catch (error) {
      logger.error('Error getting price alerts:', error as string);
      throw error;
    }
  }

  async updateAlert(alertId: string, updates: Partial<PriceAlert>): Promise<PriceAlert> {
    try {
      const alert = this?.alerts?.get(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      const updatedAlert = { ...alert, ...updates };
      this?.alerts?.set(alertId, updatedAlert);
      
      logger.info(`Updated price alert ${alertId}`);
      return updatedAlert;
    } catch (error) {
      logger.error('Error updating price alert:', error as string);
      throw error;
    }
  }

  async pauseAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this?.alerts?.get(alertId);
      if (!alert) {
        return false;
      }
      alert.isActive = false;
      this?.alerts?.set(alertId, alert);
      logger.info(`Paused price alert ${alertId}`);
      return true;
    } catch (error) {
      logger.error('Error pausing price alert:', error as string);
      return false;
    }
  }

  async resumeAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this?.alerts?.get(alertId);
      if (!alert) {
        return false;
      }
      alert.isActive = true;
      this?.alerts?.set(alertId, alert);
      logger.info(`Resumed price alert ${alertId}`);
      return true;
    } catch (error) {
      logger.error('Error resuming price alert:', error as string);
      return false;
    }
  }

  async getNotificationHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      // Mock notification history
      return [
        {
          id: 'notif_1',
          alertId: 'alert_1',
          userId,
          type: 'price_drop',
          message: 'Price dropped below target',
          timestamp: new Date().toISOString(),
          isRead: false,
          isClicked: false
        }
      ].slice(0, limit);
    } catch (error) {
      logger.error('Error getting notification history:', error as string);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      logger.info(`Marked notification ${notificationId} as read`);
      // Mock implementation
    } catch (error) {
      logger.error('Error marking notification as read:', error as string);
      throw error;
    }
  }

  async markNotificationAsClicked(notificationId: string): Promise<void> {
    try {
      logger.info(`Marked notification ${notificationId} as clicked`);
      // Mock implementation
    } catch (error) {
      logger.error('Error marking notification as clicked:', error as string);
      throw error;
    }
  }

  async getAlertAnalytics(userId: string): Promise<any> {
    try {
      const userAlerts = await this.getAlerts(userId);
      return {
        totalAlerts: userAlerts.length,
        activeAlerts: userAlerts.filter(a => a.isActive).length,
        totalTriggers: userAlerts.reduce((sum, a) => sum + (a.lastTriggered ? 1 : 0), 0),
        totalClicks: 0, // Mock
        totalPurchases: 0, // Mock
        totalSavings: 0, // Mock
        avgEffectiveness: 0.75 // Mock
      };
    } catch (error) {
      logger.error('Error getting alert analytics:', error as string);
      throw error;
    }
  }

  async checkPriceChange(priceData: any): Promise<any> {
    try {
      const triggeredAlerts: string[] = [];
      
      // Mock price change checking
      for (const alert of this?.alerts?.values()) {
        if (alert.isActive && alert.productName === priceData.productName) {
          if (this.shouldTriggerAlert(alert)) {
            triggeredAlerts.push(alert.id);
            alert.lastTriggered = new Date();
          }
        }
      }
      
      return {
        triggeredAlerts,
        priceChange: {
          productName: priceData.productName,
          previousPrice: priceData.previousPrice,
          currentPrice: priceData.currentPrice,
          change: priceData.currentPrice - priceData.previousPrice,
          percentageChange: ((priceData.currentPrice - priceData.previousPrice) / priceData.previousPrice) * 100
        }
      };
    } catch (error) {
      logger.error('Error checking price change:', error as string);
      throw error;
    }
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    try {
      if (!this?.alerts?.has(alertId)) {
        return false;
      }

      this?.alerts?.delete(alertId);
      logger.info(`Deleted price alert ${alertId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting price alert:', error as string);
      return false;
    }
  }

  async checkAlerts(): Promise<PriceAlert[]> {
    try {
      const triggeredAlerts: PriceAlert[] = [];
      
      for (const alert of this?.alerts?.values()) {
        if (!alert.isActive) continue;

        // Mock price checking logic
        const shouldTrigger = this.shouldTriggerAlert(alert);
        
        if (shouldTrigger) {
          alert.lastTriggered = new Date();
          triggeredAlerts.push(alert);
          logger.info(`Price alert triggered for ${alert.productName}`);
        }
      }

      return triggeredAlerts;
    } catch (error) {
      logger.error('Error checking price alerts:', error as string);
      throw error;
    }
  }

  private shouldTriggerAlert(alert: PriceAlert): boolean {
    switch (alert.alertType) {
      case 'below':
        return alert.currentPrice <= alert.targetPrice;
      case 'above':
        return alert.currentPrice >= alert.targetPrice;
      case 'change':
        const changePercent = Math.abs((alert.currentPrice - alert.targetPrice) / alert.targetPrice) * 100;
        return changePercent >= alert.threshold;
      default:
        return false;
    }
  }
}

// Export function for backward compatibility
export function getPriceAlertService(): PriceAlertService {
  return PriceAlertService.getInstance();
}