/**
 * Walmart Real-Time API Service
 * Enhanced integration combining multiple data sources for real-time product information
 * Leverages Bright Data MCP tools, existing price fetcher, and WebSocket for live updates
 */

import { z } from 'zod';
import { Logger } from "../../utils/logger.js";
import { WalmartPriceFetcher } from "./WalmartPriceFetcher.js";
import { BrightDataService } from "../../core/data-collection/BrightDataService.js";
import { WebSocketGateway } from "../websocket/WebSocketGateway.js";
import { cacheManager } from "../../core/cache/RedisCacheManager.js";
import { circuitBreakerService } from "../../core/resilience/CircuitBreakerService.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";

const logger = Logger.getInstance();

// Real-time product update schema
const RealTimeProductSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.number().min(0),
  salePrice: z.number().optional(),
  wasPrice: z.number().optional(),
  inStock: z.boolean(),
  stockLevel: z.number().optional(),
  storeLocation: z.string().optional(),
  lastUpdated: z.string(),
  priceChange: z.number().optional(), // Percentage change
  priceHistory: z.array(z.object({
    date: z.string(),
    price: z.number()
  })).optional()
});

// Order history schema
const OrderHistorySchema = z.object({
  orderId: z.string(),
  orderDate: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    quantity: z.number(),
    price: z.number(),
    subtotal: z.number()
  })),
  total: z.number(),
  status: z.enum(['delivered', 'shipped', 'processing', 'cancelled'])
});

export type RealTimeProduct = z.infer<typeof RealTimeProductSchema>;
export type OrderHistory = z.infer<typeof OrderHistorySchema>;

interface LiveUpdateSubscription {
  userId: string;
  productIds: string[];
  callback: (update: RealTimeProduct) => void;
  interval: number; // Update interval in ms
  lastUpdate: number;
}

export class WalmartRealTimeAPI {
  private static instance: WalmartRealTimeAPI;
  private priceFetcher: WalmartPriceFetcher;
  private brightDataService: BrightDataService | null = null;
  private webSocketGateway: WebSocketGateway | null = null;
  private subscriptions: Map<string, LiveUpdateSubscription> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private priceHistory: Map<string, Array<{ date: string; price: number }>> = new Map();
  
  private constructor() {
    this.priceFetcher = WalmartPriceFetcher.getInstance();
    this.initializeServices();
  }

  static getInstance(): WalmartRealTimeAPI {
    if (!WalmartRealTimeAPI.instance) {
      WalmartRealTimeAPI.instance = new WalmartRealTimeAPI();
    }
    return WalmartRealTimeAPI.instance;
  }

  private async initializeServices() {
    try {
      // Initialize WebSocket if available
      try {
        // WebSocketGateway requires eventBus, monitor, and circuitBreaker
        // For now, we'll skip WebSocket initialization as it requires dependencies
        // this.webSocketGateway = new WebSocketGateway({}, eventBus, monitor, circuitBreaker);
        logger.debug("WebSocket gateway initialization skipped - requires dependencies", "WALMART_RT");
      } catch (err) {
        logger.debug("WebSocket gateway not available", "WALMART_RT");
      }

      // Initialize Bright Data service if credentials are available
      if (process.env.BRIGHT_DATA_CUSTOMER_ID) {
        this.brightDataService = new BrightDataService({
          customerId: process.env.BRIGHT_DATA_CUSTOMER_ID,
          password: process.env.BRIGHT_DATA_PASSWORD || ''
        } as any);
        logger.info("Bright Data service initialized", "WALMART_RT");
      }

      // Start update loop for subscriptions
      this.startUpdateLoop();
    } catch (error) {
      logger.error("Failed to initialize real-time services", "WALMART_RT", { error });
    }
  }

  /**
   * Get real-time product data with multiple data sources
   */
  async getProductRealTime(productId: string): Promise<RealTimeProduct | null> {
    return circuitBreakerService.executeExternalAPI(
      'walmart_realtime',
      'getProduct',
      async (): Promise<RealTimeProduct | null> => {
        // Check cache first
        const cached = await cacheManager.get<RealTimeProduct>(`walmart_rt_${productId}`);
        if (cached && this.isFreshData(cached.lastUpdated)) {
          logger.debug(`Using cached real-time data for ${productId}`, "WALMART_RT");
          return cached;
        }

        // Try Bright Data MCP tool first (most reliable)
        let productData = await this.fetchViaBrightData(productId);
        
        // Fallback to existing price fetcher
        if (!productData) {
          productData = await this.fetchViaExistingAPI(productId);
        }

        if (productData) {
          // Update price history
          this.updatePriceHistory(productId, productData.price);
          
          // Calculate price change
          productData.priceChange = this.calculatePriceChange(productId, productData.price);
          productData.priceHistory = this.priceHistory.get(productId) || [];

          // Cache the result
          await cacheManager.set(`walmart_rt_${productId}`, productData, { ttl: 300 }); // 5 min cache

          // Send WebSocket update if connected
          if (this.webSocketGateway) {
            this.webSocketGateway.broadcast('walmart.price.update', productData);
          }

          return productData;
        }

        return null;
      },
      null // No fallback, handled internally
    );
  }

  /**
   * Fetch product data via Bright Data MCP tools
   */
  private async fetchViaBrightData(productId: string): Promise<RealTimeProduct | null> {
    if (!this.brightDataService) {
      return null;
    }

    try {
      logger.debug(`Fetching via Bright Data for ${productId}`, "WALMART_RT");
      
      // Use the mcp__Bright_Data__web_data_walmart_product tool
      // This would be called through the MCP interface in production
      const productUrl = `https://www.walmart.com/ip/${productId}`;
      
      // Simulate MCP tool call (in production, this would use actual MCP)
      const brightDataResult = await this.brightDataService.collectEcommerceData({
        platform: 'walmart',
        productUrl,
        includePricing: true,
        includeAvailability: true
      } as any);

      if (brightDataResult && (brightDataResult as any).length > 0) {
        const data = (brightDataResult as any)[0].data;
        
        return {
          productId,
          name: data.title || `Product ${productId}`,
          price: parseFloat(data.price) || 0,
          salePrice: data.salePrice ? parseFloat(data.salePrice) : undefined,
          wasPrice: data.wasPrice ? parseFloat(data.wasPrice) : undefined,
          inStock: data.availability !== 'out_of_stock',
          stockLevel: data.stockLevel,
          storeLocation: data.storeLocation || 'Online',
          lastUpdated: new Date().toISOString(),
          priceChange: 0,
          priceHistory: []
        };
      }
    } catch (error) {
      logger.debug(`Bright Data fetch failed for ${productId}`, "WALMART_RT", { error });
    }

    return null;
  }

  /**
   * Fetch via existing WalmartPriceFetcher
   */
  private async fetchViaExistingAPI(productId: string): Promise<RealTimeProduct | null> {
    try {
      const priceResult = await this.priceFetcher.fetchProductPrice(productId);
      
      if (priceResult) {
        // Get additional product info from database if available
        const productInfo = await this.getProductInfoFromDB(productId);
        
        return {
          productId,
          name: productInfo?.name || `Product ${productId}`,
          price: priceResult.price,
          salePrice: priceResult.salePrice,
          wasPrice: priceResult.wasPrice,
          inStock: priceResult.inStock,
          stockLevel: undefined,
          storeLocation: priceResult.storeLocation,
          lastUpdated: priceResult.lastUpdated.toISOString(),
          priceChange: 0,
          priceHistory: []
        };
      }
    } catch (error) {
      logger.debug(`Existing API fetch failed for ${productId}`, "WALMART_RT", { error });
    }

    return null;
  }

  /**
   * Subscribe to live price updates for products
   */
  subscribeToPriceUpdates(
    userId: string,
    productIds: string[],
    callback: (update: RealTimeProduct) => void,
    intervalMs: number = 60000 // Default 1 minute
  ): string {
    const subscriptionId = `sub_${userId}_${Date.now()}`;
    
    this.subscriptions.set(subscriptionId, {
      userId,
      productIds,
      callback,
      interval: intervalMs,
      lastUpdate: 0
    });

    logger.info(`Created price update subscription for user ${userId}`, "WALMART_RT", {
      productIds,
      interval: intervalMs
    });

    // Trigger immediate update for new subscription
    this.processSubscription(subscriptionId);

    return subscriptionId;
  }

  /**
   * Unsubscribe from price updates
   */
  unsubscribe(subscriptionId: string): boolean {
    const deleted = this.subscriptions.delete(subscriptionId);
    if (deleted) {
      logger.info(`Removed subscription ${subscriptionId}`, "WALMART_RT");
    }
    return deleted;
  }

  /**
   * Get order history for a user (mock implementation - would need actual user auth)
   */
  async getOrderHistory(userId: string, limit: number = 10): Promise<OrderHistory[]> {
    try {
      // In production, this would fetch from Walmart API with user OAuth
      // For now, return cached/mock data
      const cached = await cacheManager.get<OrderHistory[]>(`walmart_orders_${userId}`);
      if (cached) {
        return cached.slice(0, limit);
      }

      // Mock data for demonstration
      const mockOrders: OrderHistory[] = [
        {
          orderId: "ORD-2024-001",
          orderDate: "2024-12-15T10:30:00Z",
          items: [
            {
              productId: "23656054",
              name: "Great Value Whole Milk, 1 Gallon",
              quantity: 2,
              price: 3.48,
              subtotal: 6.96
            },
            {
              productId: "44391472",
              name: "Great Value Large White Eggs, 12 Count",
              quantity: 1,
              price: 2.76,
              subtotal: 2.76
            }
          ],
          total: 9.72,
          status: "delivered"
        }
      ];

      await cacheManager.set(`walmart_orders_${userId}`, mockOrders, { ttl: 3600 });
      return mockOrders;
    } catch (error) {
      logger.error("Failed to fetch order history", "WALMART_RT", { error, userId });
      return [];
    }
  }

  /**
   * Search products with real-time pricing
   */
  async searchWithRealTimePrices(
    query: string,
    limit: number = 10
  ): Promise<RealTimeProduct[]> {
    try {
      // Use existing search functionality
      const searchResults = await this.priceFetcher.searchProductsWithPrices(
        query,
        { zipCode: '29301', city: 'Spartanburg', state: 'SC' },
        limit
      );

      // Convert to real-time format with additional data
      const realTimeResults: RealTimeProduct[] = [];
      
      for (const product of searchResults) {
        const productPrice = typeof product.price === 'number' 
          ? product.price 
          : (product.price as any)?.regular || 0;
        
        const rtProduct: RealTimeProduct = {
          productId: product.walmartId,
          name: product.name,
          price: productPrice,
          salePrice: product.livePrice?.salePrice,
          wasPrice: product.livePrice?.wasPrice,
          inStock: product.inStock || false,
          stockLevel: undefined,
          storeLocation: product.livePrice?.storeLocation,
          lastUpdated: product.livePrice?.lastUpdated || new Date().toISOString(),
          priceChange: 0,
          priceHistory: []
        };

        // Get price history if available
        if (this.priceHistory.has(product.walmartId)) {
          rtProduct.priceHistory = this.priceHistory.get(product.walmartId);
          rtProduct.priceChange = this.calculatePriceChange(product.walmartId, productPrice);
        }

        realTimeResults.push(rtProduct);
      }

      return realTimeResults;
    } catch (error) {
      logger.error("Search with real-time prices failed", "WALMART_RT", { error });
      return [];
    }
  }

  /**
   * Start the update loop for subscriptions
   */
  private startUpdateLoop() {
    if (this.updateInterval) {
      return; // Already running
    }

    this.updateInterval = setInterval(() => {
      this.processAllSubscriptions();
    }, 5000); // Check every 5 seconds

    logger.info("Started real-time update loop", "WALMART_RT");
  }

  /**
   * Process all active subscriptions
   */
  private async processAllSubscriptions() {
    const now = Date.now();
    
    for (const [id, subscription] of this.subscriptions) {
      if (now - subscription.lastUpdate >= subscription.interval) {
        this.processSubscription(id);
      }
    }
  }

  /**
   * Process a single subscription
   */
  private async processSubscription(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    try {
      for (const productId of subscription.productIds) {
        const productData = await this.getProductRealTime(productId);
        if (productData) {
          // Call the subscription callback
          subscription.callback(productData);
          
          // Send WebSocket update to specific user
          if (this.webSocketGateway) {
            (this.webSocketGateway as any).broadcast('walmart.subscription.update', {
              subscriptionId,
              product: productData
            });
          }
        }
      }
      
      // Update last processed time
      subscription.lastUpdate = Date.now();
    } catch (error) {
      logger.error(`Failed to process subscription ${subscriptionId}`, "WALMART_RT", { error });
    }
  }

  /**
   * Update price history for a product
   */
  private updatePriceHistory(productId: string, price: number) {
    const history = this.priceHistory.get(productId) || [];
    const now = new Date().toISOString();
    
    // Add new price point
    history.push({ date: now, price });
    
    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const filteredHistory = history.filter(h => h.date > thirtyDaysAgo);
    
    // Keep max 100 entries
    if (filteredHistory.length > 100) {
      filteredHistory.splice(0, filteredHistory.length - 100);
    }
    
    this.priceHistory.set(productId, filteredHistory);
  }

  /**
   * Calculate price change percentage
   */
  private calculatePriceChange(productId: string, currentPrice: number): number {
    const history = this.priceHistory.get(productId);
    if (!history || history.length < 2) return 0;
    
    // Get price from 24 hours ago or oldest available
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const previousPrice = history
      .filter(h => h.date < oneDayAgo)
      .slice(-1)[0]?.price || history[0]?.price;
    
    if (!previousPrice || previousPrice === 0) return 0;
    
    return ((currentPrice - previousPrice) / previousPrice) * 100;
  }

  /**
   * Check if data is fresh (less than 5 minutes old)
   */
  private isFreshData(lastUpdated: string): boolean {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return new Date(lastUpdated).getTime() > fiveMinutesAgo;
  }

  /**
   * Get product info from database
   */
  private async getProductInfoFromDB(productId: string): Promise<{ name: string } | null> {
    try {
      // This would query the walmart_products table
      // For now, return null to use default naming
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.subscriptions.clear();
    this.priceHistory.clear();
    
    logger.info("WalmartRealTimeAPI destroyed", "WALMART_RT");
  }
}

// Export singleton instance
export const walmartRealTimeAPI = WalmartRealTimeAPI.getInstance();