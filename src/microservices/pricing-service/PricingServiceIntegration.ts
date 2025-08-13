import { PricingService, PriceRequest, PriceResponse } from './PricingService.js';
import { EventEmitter } from 'events';

/**
 * Integration module for connecting the pricing microservice
 * with the main application and other services
 */
export class PricingServiceIntegration extends EventEmitter {
  private static instance: PricingServiceIntegration;
  private pricingService: PricingService;
  private isInitialized: boolean = false;

  private constructor() {
    super();
  }

  public static getInstance(): PricingServiceIntegration {
    if (!PricingServiceIntegration.instance) {
      PricingServiceIntegration.instance = new PricingServiceIntegration();
    }
    return PricingServiceIntegration.instance;
  }

  /**
   * Initialize the pricing service with configuration
   */
  public async initialize(config?: any): Promise<void> {
    if (this.isInitialized) {
      console.log('[PricingIntegration] Already initialized');
      return;
    }

    try {
      this.pricingService = new PricingService(config);
      
      // Forward pricing service events
      this.setupEventForwarding();
      
      // Pre-warm cache with popular products if configured
      if (config?.warmupProducts) {
        await this.warmupCache(config.warmupProducts);
      }

      this.isInitialized = true;
      this.emit('initialized');
      console.log('[PricingIntegration] Successfully initialized');
    } catch (error) {
      console.error('[PricingIntegration] Initialization failed:', error);
      throw error;
    }
  }

  private setupEventForwarding(): void {
    // Forward all pricing service events
    this.pricingService.on('cache:hit', (data) => {
      this.emit('cache:hit', data);
    });

    this.pricingService.on('api:fetch', (data) => {
      this.emit('api:fetch', data);
    });

    this.pricingService.on('error', (data) => {
      this.emit('error', data);
    });

    this.pricingService.on('cache:warm:complete', (data) => {
      this.emit('cache:warm:complete', data);
    });
  }

  /**
   * Get price for a single product
   */
  public async getPrice(request: PriceRequest): Promise<PriceResponse> {
    if (!this.isInitialized) {
      throw new Error('PricingServiceIntegration not initialized');
    }
    return this.pricingService.getPrice(request);
  }

  /**
   * Get prices for multiple products
   */
  public async getBatchPrices(
    requests: PriceRequest[],
    options: { parallel?: boolean; batchSize?: number } = {}
  ): Promise<(PriceResponse | { productId: string; error: string })[]> {
    if (!this.isInitialized) {
      throw new Error('PricingServiceIntegration not initialized');
    }

    const { parallel = true, batchSize = 10 } = options;

    if (parallel) {
      // Process in batches to avoid overwhelming the system
      const results: (PriceResponse | { productId: string; error: string })[] = [];
      
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(req =>
            this.pricingService.getPrice(req).catch(err => ({
              productId: req.productId,
              error: err.message
            }))
          )
        );
        results.push(...batchResults);
      }
      
      return results;
    } else {
      // Sequential processing
      const results: (PriceResponse | { productId: string; error: string })[] = [];
      
      for (const request of requests) {
        try {
          const price = await this.pricingService.getPrice(request);
          results.push(price);
        } catch (err) {
          results.push({
            productId: request.productId,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }
      
      return results;
    }
  }

  /**
   * Get price with automatic retry on failure
   */
  public async getPriceWithRetry(
    request: PriceRequest,
    maxRetries: number = 3
  ): Promise<PriceResponse> {
    if (!this.isInitialized) {
      throw new Error('PricingServiceIntegration not initialized');
    }

    let lastError: Error | undefined;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await this.pricingService.getPrice(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (i < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, i), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to get price after retries');
  }

  /**
   * Warm up cache with product IDs
   */
  public async warmupCache(
    productIds: string[],
    storeIds: string[] = ['default']
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PricingServiceIntegration not initialized');
    }

    console.log(`[PricingIntegration] Warming cache with ${productIds.length} products`);
    await this.pricingService.warmCache(productIds, storeIds);
  }

  /**
   * Invalidate cache entries
   */
  public async invalidateCache(
    criteria?: { productId?: string; storeId?: string }
  ): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('PricingServiceIntegration not initialized');
    }

    return this.pricingService.invalidateCache(criteria);
  }

  /**
   * Get service metrics
   */
  public getMetrics() {
    if (!this.isInitialized) {
      throw new Error('PricingServiceIntegration not initialized');
    }

    return this.pricingService.getMetrics();
  }

  /**
   * Subscribe to price updates for a product
   */
  public subscribeToPriceUpdates(
    productId: string,
    callback: (price: PriceResponse) => void,
    interval: number = 30000
  ): () => void {
    if (!this.isInitialized) {
      throw new Error('PricingServiceIntegration not initialized');
    }

    const fetchPrice = async () => {
      try {
        const price = await this.pricingService.getPrice({
          productId,
          storeId: 'default',
          quantity: 1,
          includePromotions: true
        });
        callback(price);
      } catch (error) {
        console.error(`[PricingIntegration] Error fetching price for ${productId}:`, error);
      }
    };

    // Fetch initial price
    fetchPrice();

    // Set up interval
    const intervalId = setInterval(fetchPrice, interval);

    // Return unsubscribe function
    return () => {
      clearInterval(intervalId);
    };
  }

  /**
   * Get estimated savings for a list of products
   */
  public async calculateSavings(
    productIds: string[],
    quantities: number[] = []
  ): Promise<{
    totalOriginal: number;
    totalDiscounted: number;
    totalSavings: number;
    savingsPercentage: number;
    products: Array<{
      productId: string;
      quantity: number;
      originalTotal: number;
      discountedTotal: number;
      savings: number;
    }>;
  }> {
    if (!this.isInitialized) {
      throw new Error('PricingServiceIntegration not initialized');
    }

    const results = await this.getBatchPrices(
      productIds.map((id, index) => ({
        productId: id,
        storeId: 'default',
        quantity: quantities[index] || 1,
        includePromotions: true
      }))
    );

    let totalOriginal = 0;
    let totalDiscounted = 0;
    const products: any[] = [];

    results.forEach((result, index) => {
      if ('price' in result) {
        const quantity = quantities[index] || 1;
        const originalTotal = (result.originalPrice || result.price) * quantity;
        const discountedTotal = result.price * quantity;
        const savings = originalTotal - discountedTotal;

        totalOriginal += originalTotal;
        totalDiscounted += discountedTotal;

        products.push({
          productId: result.productId,
          quantity,
          originalTotal,
          discountedTotal,
          savings
        });
      }
    });

    const totalSavings = totalOriginal - totalDiscounted;
    const savingsPercentage = totalOriginal > 0 
      ? (totalSavings / totalOriginal) * 100 
      : 0;

    return {
      totalOriginal,
      totalDiscounted,
      totalSavings,
      savingsPercentage,
      products
    };
  }

  /**
   * Shutdown the pricing service
   */
  public async shutdown(): Promise<void> {
    if (this.pricingService) {
      await this.pricingService.close();
      this.isInitialized = false;
      this.emit('shutdown');
    }
  }
}

// Export singleton instance
export const pricingIntegration = PricingServiceIntegration.getInstance();