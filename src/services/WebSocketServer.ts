/**
 * WebSocket Server for Real-Time Price Updates
 * Broadcasts price changes, stock updates, and alerts
 */

import { WebSocketServer, WebSocket } from 'ws';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import BrightDataMCPService from './BrightDataMCPService.js';

export interface PriceUpdateEvent {
  type: 'PRICE_UPDATE';
  productId: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  percentChange: number;
  timestamp: string;
}

export interface StockUpdateEvent {
  type: 'STOCK_UPDATE';
  productId: string;
  productName: string;
  inStock: boolean;
  stockLevel?: number;
  timestamp: string;
}

export interface PriceAlertEvent {
  type: 'PRICE_ALERT';
  productId: string;
  productName: string;
  alertType: 'price_drop' | 'back_in_stock' | 'price_increase';
  currentPrice: number;
  targetPrice?: number;
  message: string;
  timestamp: string;
}

export interface SystemEvent {
  type: 'SYSTEM';
  message: string;
  timestamp: string;
}

type WebSocketEvent = PriceUpdateEvent | StockUpdateEvent | PriceAlertEvent | SystemEvent;

class WalmartWebSocketServer {
  private wss: WebSocketServer;
  private db: Database.Database;
  private brightDataService: BrightDataMCPService;
  private clients: Set<WebSocket> = new Set();
  private priceCheckInterval: NodeJS.Timeout | null = null;
  private lastPrices: Map<string, number> = new Map();
  
  private readonly PORT = 8080;
  private readonly PRICE_CHECK_INTERVAL = 300000; // 5 minutes

  constructor() {
    this.db = new Database('./data/walmart_grocery.db');
    this.brightDataService = new BrightDataMCPService('./data/walmart_grocery.db');
    
    // Initialize WebSocket server
    this.wss = new WebSocketServer({ 
      port: this.PORT,
      perMessageDeflate: false
    });
    
    this.setupWebSocketServer();
    this.loadLastPrices();
    logger.info(`WebSocket server started on port ${this.PORT}`, 'WEBSOCKET');
  }

  /**
   * Setup WebSocket server handlers
   */
  private setupWebSocketServer() {
    this?.wss?.on('connection', (ws: WebSocket, req) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      logger.info('New WebSocket client connected', 'WEBSOCKET', { clientId });
      
      this?.clients?.add(ws);
      
      // Send welcome message
      this.sendToClient(ws, {
        type: 'SYSTEM',
        message: `Connected to Walmart Price Tracker (${this?.clients?.size} clients online)`,
        timestamp: new Date().toISOString()
      });
      
      // Send current product stats
      this.sendProductStats(ws);
      
      // Handle client messages
      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          logger.error('Failed to parse client message', 'WEBSOCKET', { error });
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        this?.clients?.delete(ws);
        logger.info('Client disconnected', 'WEBSOCKET', { 
          clientId,
          remainingClients: this?.clients?.size 
        });
      });
      
      // Handle errors
      ws.on('error', (error: any) => {
        logger.error('WebSocket client error', 'WEBSOCKET', { clientId, error });
        this?.clients?.delete(ws);
      });
    });
    
    this?.wss?.on('error', (error: any) => {
      logger.error('WebSocket server error', 'WEBSOCKET', { error });
    });
  }

  /**
   * Handle messages from clients
   */
  private handleClientMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case 'SUBSCRIBE_PRODUCT':
        this.subscribeToProduct(ws, data.productId);
        break;
      case 'UNSUBSCRIBE_PRODUCT':
        this.unsubscribeFromProduct(ws, data.productId);
        break;
      case 'REQUEST_PRICE_CHECK':
        this.checkPriceNow(data.productId);
        break;
      case 'SET_PRICE_ALERT':
        this.setPriceAlert(data.productId, data.targetPrice, data.userId);
        break;
      default:
        logger.warn('Unknown message type', 'WEBSOCKET', { type: data.type });
    }
  }

  /**
   * Start monitoring prices
   */
  startPriceMonitoring() {
    if (this.priceCheckInterval) {
      return;
    }
    
    logger.info('Starting price monitoring', 'WEBSOCKET', {
      interval: `${this.PRICE_CHECK_INTERVAL / 1000} seconds`
    });
    
    // Initial check
    this.checkAllPrices();
    
    // Set up interval
    this.priceCheckInterval = setInterval(() => {
      this.checkAllPrices();
    }, this.PRICE_CHECK_INTERVAL);
  }

  /**
   * Stop monitoring prices
   */
  stopPriceMonitoring() {
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
      this.priceCheckInterval = null;
      logger.info('Stopped price monitoring', 'WEBSOCKET');
    }
  }

  /**
   * Check prices for all products
   */
  private async checkAllPrices() {
    logger.info('Checking all product prices', 'WEBSOCKET');
    
    try {
      // Get all products from database
      const products = this?.db?.prepare(`
        SELECT id, product_id, name, current_price 
        FROM walmart_products 
        WHERE in_stock = 1
        LIMIT 20
      `).all() as any[];
      
      let priceChanges = 0;
      
      for (const product of products) {
        // Simulate price check (in production, would call BrightData)
        const newPrice = this.simulatePriceChange(product.current_price);
        const oldPrice = this?.lastPrices?.get(product.product_id) || product.current_price;
        
        if (Math.abs(newPrice - oldPrice) > 0.01) {
          // Price changed!
          priceChanges++;
          
          // Update database
          this.updateProductPrice(product.id, newPrice);
          
          // Update last price cache
          this?.lastPrices?.set(product.product_id, newPrice);
          
          // Broadcast price update
          const event: PriceUpdateEvent = {
            type: 'PRICE_UPDATE',
            productId: product.product_id,
            productName: product.name,
            oldPrice,
            newPrice,
            percentChange: ((newPrice - oldPrice) / oldPrice) * 100,
            timestamp: new Date().toISOString()
          };
          
          this.broadcast(event);
          
          // Check for price alerts
          this.checkPriceAlerts(product.product_id, product.name, newPrice);
        }
      }
      
      logger.info('Price check completed', 'WEBSOCKET', {
        productsChecked: products?.length || 0,
        priceChanges
      });
      
    } catch (error) {
      logger.error('Failed to check prices', 'WEBSOCKET', { error });
    }
  }

  /**
   * Check a specific product price now
   */
  private async checkPriceNow(productId: string) {
    try {
      const product = this?.db?.prepare(`
        SELECT id, product_id, name, current_price 
        FROM walmart_products 
        WHERE product_id = ?
      `).get(productId) as any;
      
      if (!product) {
        logger.warn('Product not found for price check', 'WEBSOCKET', { productId });
        return;
      }
      
      // In production, would fetch real price from BrightData
      const newPrice = this.simulatePriceChange(product.current_price);
      
      if (Math.abs(newPrice - product.current_price) > 0.01) {
        this.updateProductPrice(product.id, newPrice);
        
        const event: PriceUpdateEvent = {
          type: 'PRICE_UPDATE',
          productId: product.product_id,
          productName: product.name,
          oldPrice: product.current_price,
          newPrice,
          percentChange: ((newPrice - product.current_price) / product.current_price) * 100,
          timestamp: new Date().toISOString()
        };
        
        this.broadcast(event);
      }
    } catch (error) {
      logger.error('Failed to check price now', 'WEBSOCKET', { error, productId });
    }
  }

  /**
   * Update product price in database
   */
  private updateProductPrice(productId: string, newPrice: number) {
    try {
      this?.db?.prepare(`
        UPDATE walmart_products 
        SET current_price = ?, updated_at = ? 
        WHERE id = ?
      `).run(newPrice, new Date().toISOString(), productId);
      
      // Also add to price history
      this?.db?.prepare(`
        INSERT INTO price_history (id, product_id, price, recorded_at)
        VALUES (?, ?, ?, ?)
      `).run(
        `ph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId,
        newPrice,
        new Date().toISOString()
      );
    } catch (error) {
      logger.error('Failed to update product price', 'WEBSOCKET', { error });
    }
  }

  /**
   * Check for price alerts
   */
  private checkPriceAlerts(productId: string, productName: string, currentPrice: number) {
    try {
      const alerts = this?.db?.prepare(`
        SELECT * FROM price_alerts 
        WHERE product_id = ? AND is_active = 1
      `).all(productId) as any[];
      
      for (const alert of alerts) {
        if (alert.alert_type === 'price_drop' && currentPrice <= alert.target_price) {
          const event: PriceAlertEvent = {
            type: 'PRICE_ALERT',
            productId,
            productName,
            alertType: 'price_drop',
            currentPrice,
            targetPrice: alert.target_price,
            message: `Price dropped to $${currentPrice.toFixed(2)}! (Target was $${alert?.target_price?.toFixed(2)})`,
            timestamp: new Date().toISOString()
          };
          
          this.broadcast(event);
          
          // Mark alert as triggered
          this?.db?.prepare(`
            UPDATE price_alerts SET is_active = 0 WHERE id = ?
          `).run(alert.id);
        }
      }
    } catch (error) {
      logger.error('Failed to check price alerts', 'WEBSOCKET', { error });
    }
  }

  /**
   * Set a price alert
   */
  private setPriceAlert(productId: string, targetPrice: number, userId: string = 'default_user') {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this?.db?.prepare(`
        INSERT INTO price_alerts (id, user_id, product_id, alert_type, target_price, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        alertId,
        userId,
        productId,
        'price_drop',
        targetPrice,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      );
      
      logger.info('Price alert set', 'WEBSOCKET', { productId, targetPrice, userId });
      
      this.broadcast({
        type: 'SYSTEM',
        message: `Price alert set for product ${productId} at $${targetPrice.toFixed(2)}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to set price alert', 'WEBSOCKET', { error });
    }
  }

  /**
   * Subscribe to product updates
   */
  private subscribeToProduct(ws: WebSocket, productId: string) {
    // In production, would track subscriptions per client
    logger.info('Client subscribed to product', 'WEBSOCKET', { productId });
    
    this.sendToClient(ws, {
      type: 'SYSTEM',
      message: `Subscribed to updates for product ${productId}`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unsubscribe from product updates
   */
  private unsubscribeFromProduct(ws: WebSocket, productId: string) {
    logger.info('Client unsubscribed from product', 'WEBSOCKET', { productId });
    
    this.sendToClient(ws, {
      type: 'SYSTEM',
      message: `Unsubscribed from product ${productId}`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send product stats to a client
   */
  private sendProductStats(ws: WebSocket) {
    try {
      const stats = this?.db?.prepare(`
        SELECT 
          COUNT(*) as totalProducts,
          AVG(current_price) as avgPrice,
          SUM(CASE WHEN in_stock = 1 THEN 1 ELSE 0 END) as inStock
        FROM walmart_products
      `).get() as any;
      
      this.sendToClient(ws, {
        type: 'SYSTEM',
        message: `Tracking ${stats.totalProducts} products (${stats.inStock} in stock, avg price: $${stats.avgPrice?.toFixed(2) || '0.00'})`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send product stats', 'WEBSOCKET', { error });
    }
  }

  /**
   * Load last known prices
   */
  private loadLastPrices() {
    try {
      const products = this?.db?.prepare(`
        SELECT product_id, current_price FROM walmart_products
      `).all() as any[];
      
      for (const product of products) {
        this?.lastPrices?.set(product.product_id, product.current_price);
      }
      
      logger.info('Loaded last prices', 'WEBSOCKET', { count: this?.lastPrices?.size });
    } catch (error) {
      logger.error('Failed to load last prices', 'WEBSOCKET', { error });
    }
  }

  /**
   * Simulate price change (for testing)
   */
  private simulatePriceChange(currentPrice: number): number {
    // Simulate ±5% price change with 20% probability
    if (Math.random() < 0.2) {
      const change = (Math.random() - 0.5) * 0.1; // ±5%
      const newPrice = currentPrice * (1 + change);
      return Math.round(newPrice * 100) / 100; // Round to 2 decimal places
    }
    return currentPrice;
  }

  /**
   * Send event to specific client
   */
  private sendToClient(ws: WebSocket, event: WebSocketEvent) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /**
   * Broadcast event to all clients
   */
  broadcast(event: WebSocketEvent) {
    const message = JSON.stringify(event);
    
    this?.clients?.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    
    logger.info('Broadcast sent', 'WEBSOCKET', {
      type: event.type,
      clients: this?.clients?.size
    });
  }

  /**
   * Shutdown server
   */
  shutdown() {
    logger.info('Shutting down WebSocket server', 'WEBSOCKET');
    
    this.stopPriceMonitoring();
    
    // Close all client connections
    this?.clients?.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });
    
    this?.wss?.close();
    this?.db?.close();
    this?.brightDataService?.close();
  }
}

export default WalmartWebSocketServer;