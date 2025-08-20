/**
 * Walmart Real-Time API Router
 * tRPC endpoints for real-time Walmart product data and live price updates
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
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

export const walmartRealTimeRouter = router({
  /**
   * Get real-time product data
   */
  getProduct: publicProcedure
    .input(GetProductSchema)
    .query(async ({ input, ctx }) => {
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
        ctx.metrics?.increment('walmart.realtime.getProduct');

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
    .query(async ({ input, ctx }) => {
      try {
        logger.info('Batch fetching products', 'WALMART_RT_API', {
          count: input.productIds.length
        });

        const products = await Promise.all(
          input.productIds.map(id => 
            walmartRealTimeAPI.getProductRealTime(id)
              .catch(err => {
                logger.debug(`Failed to fetch ${id}`, 'WALMART_RT_API', { err });
                return null;
              })
          )
        );

        // Filter out nulls and create result map
        const result: Record<string, any> = {};
        input.productIds.forEach((id, index) => {
          result[id] = products[index];
        });

        ctx.metrics?.increment('walmart.realtime.batchGet', input.productIds.length);

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
    .query(async ({ input, ctx }) => {
      try {
        logger.info('Searching products with real-time prices', 'WALMART_RT_API', {
          query: input.query,
          limit: input.limit
        });

        const results = await walmartRealTimeAPI.searchWithRealTimePrices(
          input.query,
          input.limit
        );

        ctx.metrics?.increment('walmart.realtime.search');

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
   * Subscribe to live price updates (WebSocket)
   */
  subscribeToPriceUpdates: protectedProcedure
    .input(SubscribeToUpdatesSchema)
    .subscription(({ input, ctx }) => {
      return observable((emit) => {
        const userId = ctx.user?.id || 'anonymous';
        
        logger.info('Creating price update subscription', 'WALMART_RT_API', {
          userId,
          productIds: input.productIds,
          interval: input.intervalMs
        });

        // Create subscription with callback
        const subscriptionId = walmartRealTimeAPI.subscribeToPriceUpdates(
          userId,
          input.productIds,
          (update) => {
            emit.next({
              type: 'price_update',
              data: update
            });
          },
          input.intervalMs
        );

        // Handle cleanup on unsubscribe
        return () => {
          logger.info('Removing price subscription', 'WALMART_RT_API', {
            subscriptionId
          });
          walmartRealTimeAPI.unsubscribe(subscriptionId);
        };
      });
    }),

  /**
   * Get user's Walmart order history
   */
  getOrderHistory: protectedProcedure
    .input(GetOrderHistorySchema)
    .query(async ({ input, ctx }) => {
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

        const orders = await walmartRealTimeAPI.getOrderHistory(userId, input.limit);

        ctx.metrics?.increment('walmart.realtime.orderHistory');

        return {
          userId,
          count: orders.length,
          orders
        };
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
   * Get price history for a product
   */
  getPriceHistory: publicProcedure
    .input(z.object({
      productId: z.string(),
      days: z.number().min(1).max(90).default(30)
    }))
    .query(async ({ input, ctx }) => {
      try {
        logger.info('Fetching price history', 'WALMART_RT_API', {
          productId: input.productId,
          days: input.days
        });

        // Get product with history
        const product = await walmartRealTimeAPI.getProductRealTime(input.productId);
        
        if (!product) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Product ${input.productId} not found`
          });
        }

        // Filter history by days
        const cutoffDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString();
        const history = product.priceHistory?.filter(h => h.date > cutoffDate) || [];

        ctx.metrics?.increment('walmart.realtime.priceHistory');

        return {
          productId: input.productId,
          productName: product.name,
          currentPrice: product.price,
          priceChange: product.priceChange,
          history,
          days: input.days
        };
      } catch (error) {
        logger.error('Failed to get price history', 'WALMART_RT_API', { error });
        
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch price history'
        });
      }
    }),

  /**
   * Check product availability at nearby stores
   */
  checkStoreAvailability: publicProcedure
    .input(z.object({
      productId: z.string(),
      zipCode: z.string().regex(/^\d{5}$/)
    }))
    .query(async ({ input, ctx }) => {
      try {
        logger.info('Checking store availability', 'WALMART_RT_API', {
          productId: input.productId,
          zipCode: input.zipCode
        });

        // This would integrate with store inventory API
        // For now, return mock data
        const stores = [
          {
            storeId: '1451',
            name: 'Walmart Supercenter - Spartanburg',
            address: '2151 E Main St, Spartanburg, SC 29307',
            distance: 3.2,
            inStock: true,
            quantity: 15,
            price: 0 // Will be populated
          },
          {
            storeId: '631',
            name: 'Walmart Supercenter - Spartanburg West',
            address: '205 W Blackstock Rd, Spartanburg, SC 29301',
            distance: 1.8,
            inStock: true,
            quantity: 8,
            price: 0 // Will be populated
          }
        ];

        // Get product price
        const product = await walmartRealTimeAPI.getProductRealTime(input.productId);
        if (product) {
          stores.forEach(store => {
            store.price = product.price;
          });
        }

        ctx.metrics?.increment('walmart.realtime.storeAvailability');

        return {
          productId: input.productId,
          zipCode: input.zipCode,
          stores
        };
      } catch (error) {
        logger.error('Failed to check store availability', 'WALMART_RT_API', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check store availability'
        });
      }
    }),

  /**
   * Set price alert for a product
   */
  setPriceAlert: protectedProcedure
    .input(z.object({
      productId: z.string(),
      targetPrice: z.number().min(0),
      alertType: z.enum(['below', 'above'])
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.user?.id;
        if (!userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          });
        }

        logger.info('Setting price alert', 'WALMART_RT_API', {
          userId,
          productId: input.productId,
          targetPrice: input.targetPrice,
          alertType: input.alertType
        });

        // Store alert in database (implementation needed)
        const alertId = `alert_${userId}_${input.productId}_${Date.now()}`;
        
        // For now, just create a subscription that checks periodically
        const subscriptionId = walmartRealTimeAPI.subscribeToPriceUpdates(
          userId,
          [input.productId],
          (update) => {
            const shouldAlert = input.alertType === 'below' 
              ? update.price <= input.targetPrice
              : update.price >= input.targetPrice;
            
            if (shouldAlert) {
              logger.info('Price alert triggered', 'WALMART_RT_API', {
                alertId,
                productId: input.productId,
                currentPrice: update.price,
                targetPrice: input.targetPrice
              });
              
              // Send notification (implement notification service)
              // notificationService.send(userId, `Price alert: ${update.name} is now $${update.price}`);
            }
          },
          60000 // Check every minute
        );

        ctx.metrics?.increment('walmart.realtime.priceAlert');

        return {
          alertId,
          subscriptionId,
          productId: input.productId,
          targetPrice: input.targetPrice,
          alertType: input.alertType,
          created: new Date().toISOString()
        };
      } catch (error) {
        logger.error('Failed to set price alert', 'WALMART_RT_API', { error });
        
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to set price alert'
        });
      }
    })
});