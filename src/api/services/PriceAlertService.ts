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
  targetPrice: number;
  currentPrice: number;
  alertType: 'below' | 'above' | 'change';
  threshold: number;
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  userId?: string;
}

export interface PriceAlertConfig {
  productId: string;
  targetPrice: number;
  alertType: 'below' | 'above' | 'change';
  threshold?: number;
  userId?: string;
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
        targetPrice: config.targetPrice,
        currentPrice: config.targetPrice + 10, // Mock current price
        alertType: config.alertType,
        threshold: config.threshold || 0,
        isActive: true,
        createdAt: new Date(),
        userId: config.userId
      };

      this.alerts.set(alert.id, alert);
      logger.info(`Created price alert ${alert.id} for product ${config.productId}`);
      return alert;
    } catch (error) {
      logger.error('Error creating price alert:', error);
      throw error;
    }
  }

  async getAlerts(userId?: string): Promise<PriceAlert[]> {
    try {
      const alerts = Array.from(this.alerts.values());
      return userId ? alerts.filter(alert => alert.userId === userId) : alerts;
    } catch (error) {
      logger.error('Error getting price alerts:', error);
      throw error;
    }
  }

  async updateAlert(alertId: string, updates: Partial<PriceAlert>): Promise<PriceAlert> {
    try {
      const alert = this.alerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      const updatedAlert = { ...alert, ...updates };
      this.alerts.set(alertId, updatedAlert);
      
      logger.info(`Updated price alert ${alertId}`);
      return updatedAlert;
    } catch (error) {
      logger.error('Error updating price alert:', error);
      throw error;
    }
  }

  async deleteAlert(alertId: string): Promise<void> {
    try {
      if (!this.alerts.has(alertId)) {
        throw new Error(`Alert ${alertId} not found`);
      }

      this.alerts.delete(alertId);
      logger.info(`Deleted price alert ${alertId}`);
    } catch (error) {
      logger.error('Error deleting price alert:', error);
      throw error;
    }
  }

  async checkAlerts(): Promise<PriceAlert[]> {
    try {
      const triggeredAlerts: PriceAlert[] = [];
      
      for (const alert of this.alerts.values()) {
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
      logger.error('Error checking price alerts:', error);
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