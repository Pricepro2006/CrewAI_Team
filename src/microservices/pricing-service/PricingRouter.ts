import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PricingService, PriceRequestSchema, PriceRequest } from './PricingService.js';
import { createRateLimiter } from '../../api/middleware/rateLimiter.js';

// Batch pricing request schema
const BatchPriceRequestSchema = z.object({
  products: z.array(PriceRequestSchema).min(1).max(100),
  strategy: z.enum(['parallel', 'sequential']).default('parallel')
});

// Cache control schema
const CacheControlSchema = z.object({
  action: z.enum(['warm', 'invalidate', 'stats']),
  productIds: z.array(z.string()).optional(),
  storeIds: z.array(z.string()).optional(),
  criteria: z.object({
    productId: z.string().optional(),
    storeId: z.string().optional()
  }).optional()
});

export class PricingRouter {
  private router: Router;
  private pricingService: PricingService;
  private rateLimiter: any;

  constructor(pricingService?: PricingService) {
    this.router = Router();
    this.pricingService = pricingService || new PricingService();
    
    // Create rate limiter for pricing endpoints
    this.rateLimiter = createRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute per IP
      keyPrefix: 'pricing:',
      message: 'Too many pricing requests, please try again later'
    });

    this.setupRoutes();
    this.setupEventHandlers();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this?.router?.get('/health', this?.healthCheck?.bind(this));

    // Single price lookup
    this?.router?.get('/price/:productId', this.rateLimiter, this?.getPrice?.bind(this));

    // Batch price lookup
    this?.router?.post('/prices/batch', this.rateLimiter, this?.getBatchPrices?.bind(this));

    // Cache management endpoints
    this?.router?.post('/cache/control', this?.cacheControl?.bind(this));
    
    // Metrics endpoint
    this?.router?.get('/metrics', this?.getMetrics?.bind(this));

    // WebSocket endpoint for real-time price updates
    this?.router?.get('/stream/:productId', this?.streamPriceUpdates?.bind(this));
  }

  private setupEventHandlers(): void {
    // Log cache hits for monitoring
    this?.pricingService?.on('cache:hit', (data: any) => {
      console.log(`[PricingService] Cache hit at ${data.level}: ${data.key} (${data.latency}ms)`);
    });

    // Log API fetches
    this?.pricingService?.on('api:fetch', (data: any) => {
      console.log(`[PricingService] API fetch for ${data.productId} (${data.latency}ms)`);
    });

    // Log errors
    this?.pricingService?.on('error', (data: any) => {
      console.error(`[PricingService] Error from ${data.source}:`, data.error);
    });

    // Log cache warm progress
    this?.pricingService?.on('cache:warm:progress', (data: any) => {
      console.log(`[PricingService] Cache warming: ${data.completed}/${data.total}`);
    });
  }

  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this?.pricingService?.getMetrics();
      res.json({
        status: 'healthy',
        service: 'pricing-microservice',
        uptime: process.uptime(),
        metrics: {
          cacheHitRate: metrics?.hitRate?.overall.toFixed(2) + '%',
          memoryCacheSize: `${metrics?.cacheSize?.memory}/${metrics?.cacheSize?.memoryMax}`,
          errors: metrics.errors
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request: PriceRequest = {
        productId: req?.params?.productId || '',
        storeId: req?.query?.storeId as string || 'default',
        quantity: parseInt(req?.query?.quantity as string) || 1,
        includePromotions: req?.query?.includePromotions !== 'false'
      };

      const validatedRequest = PriceRequestSchema.parse(request);
      const price = await this?.pricingService?.getPrice(validatedRequest);

      // Set cache headers based on source
      const cacheMaxAge = this.getCacheMaxAge(price.source);
      res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
      res.set('X-Cache-Source', price.source);

      res.json(price);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async getBatchPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedRequest = BatchPriceRequestSchema.parse(req.body);
      const { products, strategy } = validatedRequest;

      let prices;
      if (strategy === 'parallel') {
        // Process all requests in parallel
        prices = await Promise.all(
          products?.map(product => 
            this?.pricingService?.getPrice(product).catch(err => ({
              productId: product.productId,
              error: err.message
            }))
          )
        );
      } else {
        // Process requests sequentially
        prices = [];
        for (const product of products) {
          try {
            const price = await this?.pricingService?.getPrice(product);
            prices.push(price);
          } catch (err) {
            prices.push({
              productId: product.productId,
              error: err instanceof Error ? err.message : 'Unknown error'
            });
          }
        }
      }

      res.json({
        count: prices?.length || 0,
        strategy,
        prices
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid batch request',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async cacheControl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedRequest = CacheControlSchema.parse(req.body);

      switch (validatedRequest.action) {
        case 'warm':
          if (!validatedRequest.productIds || validatedRequest?.productIds?.length === 0) {
            res.status(400).json({ error: 'productIds required for warm action' });
            return;
          }

          // Start cache warming in background
          this?.pricingService?.warmCache(
            validatedRequest.productIds,
            validatedRequest.storeIds
          ).catch(console.error);

          res.json({
            message: 'Cache warming started',
            products: validatedRequest?.productIds?.length,
            stores: validatedRequest.storeIds?.length || 1
          });
          break;

        case 'invalidate':
          const invalidated = await this?.pricingService?.invalidateCache(
            validatedRequest.criteria || {}
          );

          res.json({
            message: 'Cache invalidated',
            entriesRemoved: invalidated
          });
          break;

        case 'stats':
          const metrics = this?.pricingService?.getMetrics();
          res.json({
            cacheStats: {
              hits: metrics.hits,
              misses: metrics.misses,
              hitRate: metrics.hitRate,
              avgLatency: metrics.avgLatency,
              size: metrics.cacheSize
            }
          });
          break;

        default:
          res.status(400).json({ error: 'Invalid cache control action' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid cache control request',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async getMetrics(req: Request, res: Response): Promise<void> {
    const metrics = this?.pricingService?.getMetrics();
    const reset = req?.query?.reset === 'true';

    if (reset) {
      this?.pricingService?.resetMetrics();
    }

    res.json({
      timestamp: new Date().toISOString(),
      metrics,
      reset
    });
  }

  private async streamPriceUpdates(req: Request, res: Response): Promise<void> {
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const productId = req?.params?.productId;
    const storeId = req?.query?.storeId as string || 'default';

    // Send initial price
    try {
      const price = await this?.pricingService?.getPrice({
        productId: productId || '',
        storeId,
        quantity: 1,
        includePromotions: true
      });

      res.write(`data: ${JSON.stringify(price)}\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: 'Failed to fetch initial price' })}\n\n`);
    }

    // Set up periodic price updates
    const interval = setInterval(async () => {
      try {
        const price = await this?.pricingService?.getPrice({
          productId: productId || '',
          storeId,
          quantity: 1,
          includePromotions: true
        });

        res.write(`data: ${JSON.stringify(price)}\n\n`);
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: 'Failed to fetch price update' })}\n\n`);
      }
    }, 30000); // Update every 30 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }

  private getCacheMaxAge(source: string): number {
    switch (source) {
      case 'memory':
        return 60; // 1 minute
      case 'redis':
        return 300; // 5 minutes
      case 'sqlite':
        return 3600; // 1 hour
      case 'api':
        return 30; // 30 seconds for fresh data
      default:
        return 60;
    }
  }

  public getRouter(): Router {
    return this.router;
  }

  public async shutdown(): Promise<void> {
    await this?.pricingService?.close();
  }
}