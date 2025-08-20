/**
 * Walmart Real-Time API Router
 * tRPC endpoints for real-time Walmart product data and live price updates
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc/router.js';
import type { Context } from '../trpc/context.js';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { walmartRealTimeAPI } from '../services/WalmartRealTimeAPI.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.getInstance();

// Create event emitter for real-time updates
const priceUpdateEmitter = new EventEmitter();

// Input validation schemas
const GetProductSchema = z.object({
  productId: z.string().min(1)
});

const SearchProductsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(50).default(10)
});

const SubscribeToUpdatesSchema = z.object({
  productIds: z.array(z.string()).min(1).max(20),
  intervalMs: z.number().min(10000).max(3600000).default(60000) // 10s to 1hr
});

const GetOrderHistorySchema = z.object({
  limit: z.number().min(1).max(50).default(10)
});

const BatchGetProductsSchema = z.object({
  productIds: z.array(z.string()).min(1).max(20)
});

// Type definitions for better type safety
type GetProductInput = z.infer<typeof GetProductSchema>;
type SearchProductsInput = z.infer<typeof SearchProductsSchema>;
type SubscribeToUpdatesInput = z.infer<typeof SubscribeToUpdatesSchema>;
type GetOrderHistoryInput = z.infer<typeof GetOrderHistorySchema>;
type BatchGetProductsInput = z.infer<typeof BatchGetProductsSchema>;

export const walmartRealTimeRouter = router({
  /**
   * Get real-time product data
   */
  getProduct: publicProcedure
    .input(GetProductSchema)
    .query(async ({ input, ctx }: { input: GetProductInput; ctx: Context }) => {
      try {
        logger.info('Fetching real-time product data', 'WALMART_RT_API', { 
          productId: input.productId 
        });

        const product = await walmartRealTimeAPI.getProductRealTime(input.productId);
        
        if (!product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product ${input.productId} not found`
          });
        }

        // Track API usage
        // ctx.metrics?.increment('walmart.realtime.getProduct');

        return product;
      } catch (error) {
        logger.error('Failed to get real-time product', 'WALMART_RT_API', { error });
        
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch product data'
        });
      }
    }),

  /**
   * Batch get multiple products
   */
  batchGetProducts: publicProcedure
    .input(BatchGetProductsSchema)
    .query(async ({ input, ctx }: { input: BatchGetProductsInput; ctx: Context }) => {
      try {
        logger.info('Batch fetching products', 'WALMART_RT_API', {
          count: input.productIds.length
        });

        const products = await Promise.all(
          input.productIds.map((id: string) => 
            walmartRealTimeAPI.getProductRealTime(id)
              .catch((err: any) => {
                logger.debug(`Failed to fetch ${id}`, 'WALMART_RT_API', { err });
                return null;
              })
          )
        );

        // Filter out nulls and create result map
        const result: Record<string, any> = {};
        input.productIds.forEach((id: string, index: number) => {
          result[id] = products[index];
        });

        // ctx.metrics?.increment('walmart.realtime.batchGet', input.productIds.length);

        return result;
      } catch (error) {
        logger.error('Batch fetch failed', 'WALMART_RT_API', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to batch fetch products'
        });
      }
    }),

  /**
   * Search products with real-time pricing
   */
  searchProducts: publicProcedure
    .input(SearchProductsSchema)
    .query(async ({ input, ctx }: { input: SearchProductsInput; ctx: Context }) => {
      try {
        logger.info('Searching products with real-time prices', 'WALMART_RT_API', {
          query: input.query,
          limit: input.limit
        });

        const results = await walmartRealTimeAPI.searchWithRealTimePrices(
          input.query,
          input.limit
        );

        // ctx.metrics?.increment('walmart.realtime.search');

        return {
          query: input.query,
          count: results.length,
          products: results
        };
      } catch (error) {
        logger.error('Search failed', 'WALMART_RT_API', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search products'
        });
      }
    }),

  /**
   * Subscribe to real-time price updates
   * Note: This is a subscription endpoint that pushes updates via WebSocket
   */
  subscribeToPriceUpdates: protectedProcedure
    .input(SubscribeToUpdatesSchema)
    .subscription(({ input, ctx }: { input: SubscribeToUpdatesInput; ctx: Context }) => {
      return observable<any>((emit) => {
        const userId = ctx.user?.id;
        
        if (!userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          });
        }

        logger.info('Setting up price update subscription', 'WALMART_RT_API', {
          userId,
          productIds: input.productIds,
          interval: input.intervalMs
        });

        // Set up subscription
        const subscriptionId = walmartRealTimeAPI.subscribeToPriceUpdates(
          userId,
          input.productIds,
          (update) => {
            emit.next(update);
          },
          input.intervalMs
        );

        // Track subscription
        // ctx.metrics?.increment('walmart.realtime.subscriptions');

        // Return cleanup function
        return () => {
          walmartRealTimeAPI.unsubscribe(subscriptionId);
          logger.info('Price update subscription ended', 'WALMART_RT_API', {
            subscriptionId
          });
        };
      });
    }),

  /**
   * Get user's order history
   */
  getOrderHistory: protectedProcedure
    .input(GetOrderHistorySchema)
    .query(async ({ input, ctx }: { input: GetOrderHistoryInput; ctx: Context }) => {
      try {
        const userId = ctx.user?.id;
        
        if (!userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          });
        }

        logger.info('Fetching order history', 'WALMART_RT_API', {
          userId,
          limit: input.limit
        });

        const history = await walmartRealTimeAPI.getOrderHistory(userId, input.limit);

        // ctx.metrics?.increment('walmart.realtime.orderHistory');

        return history;
      } catch (error) {
        logger.error('Failed to get order history', 'WALMART_RT_API', { error });
        
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch order history'
        });
      }
    }),

  /**
   * Compare prices across multiple products
   */
  comparePrices: publicProcedure
    .input(BatchGetProductsSchema)
    .query(async ({ input, ctx }: { input: BatchGetProductsInput; ctx: Context }) => {
      try {
        logger.info('Comparing prices', 'WALMART_RT_API', {
          count: input.productIds.length
        });

        const products = await Promise.all(
          input.productIds.map(id => walmartRealTimeAPI.getProductRealTime(id))
        );

        // Filter out failed fetches
        const validProducts = products.filter(p => p !== null);

        // Sort by price
        validProducts.sort((a, b) => {
          const priceA = typeof a?.price === 'number' ? a.price : (a?.price as any)?.regular || 0;
          const priceB = typeof b?.price === 'number' ? b.price : (b?.price as any)?.regular || 0;
          return priceA - priceB;
        });

        // ctx.metrics?.increment('walmart.realtime.priceCompare');

        return {
          count: validProducts.length,
          products: validProducts,
          lowestPrice: validProducts[0],
          highestPrice: validProducts[validProducts.length - 1]
        };
      } catch (error) {
        logger.error('Price comparison failed', 'WALMART_RT_API', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compare prices'
        });
      }
    }),

  /**
   * Track product availability
   */
  trackAvailability: publicProcedure
    .input(GetProductSchema)
    .query(async ({ input, ctx }: { input: GetProductInput; ctx: Context }) => {
      try {
        logger.info('Tracking product availability', 'WALMART_RT_API', {
          productId: input.productId
        });

        const product = await walmartRealTimeAPI.getProductRealTime(input.productId);
        
        if (!product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Product not found'
          });
        }

        const availability = {
          productId: input.productId,
          inStock: product.inStock || false,
          availableQuantity: (product as any).availableQuantity,
          lastChecked: new Date().toISOString(),
          stores: (product as any).storeAvailability || []
        };

        // ctx.metrics?.increment('walmart.realtime.availability');

        return availability;
      } catch (error) {
        logger.error('Availability check failed', 'WALMART_RT_API', { error });
        
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check availability'
        });
      }
    }),

  /**
   * Get price history for a product
   */
  getPriceHistory: publicProcedure
    .input(z.object({
      productId: z.string(),
      days: z.number().min(1).max(365).default(30)
    }))
    .query(async ({ input, ctx }: { input: { productId: string; days: number }; ctx: Context }) => {
      try {
        logger.info('Fetching price history', 'WALMART_RT_API', {
          productId: input.productId,
          days: input.days
        });

        // This would typically query a historical price database
        // For now, returning mock data structure
        const history = {
          productId: input.productId,
          period: input.days,
          dataPoints: [],
          lowestPrice: null,
          highestPrice: null,
          averagePrice: null,
          currentPrice: null
        };

        // Fetch current price
        const product = await walmartRealTimeAPI.getProductRealTime(input.productId);
        if (product) {
          history.currentPrice = typeof product.price === 'number' 
            ? product.price 
            : (product.price as any)?.regular || null;
        }

        // ctx.metrics?.increment('walmart.realtime.priceHistory');

        return history;
      } catch (error) {
        logger.error('Price history fetch failed', 'WALMART_RT_API', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch price history'
        });
      }
    })
});