import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc/enhanced-router.js';
import { BrightDataService } from '../../core/data-collection/BrightDataService.js';
import { logger } from '../../utils/logger.js';
import { CircuitBreakerFactory } from '../../core/resilience/CircuitBreaker.js';

// Input validation schemas
const searchProductsSchema = z.object({
  query: z.string().min(1).max(100),
  maxResults: z.number().min(1).max(50).default(20)
});

const productDetailsSchema = z.object({
  productUrl: z.string().url(),
  includeReviews: z.boolean().default(false)
});

const productHistorySchema = z.object({
  productId: z.string(),
  days: z.number().min(1).max(365).default(30)
});

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

export const walmartDataRouter = router({
  /**
   * Search for Walmart products
   */
  searchProducts: protectedProcedure
    .input(searchProductsSchema)
    .mutation(async ({ input }) => {
      try {
        const cacheKey = `search:${input.query}:${input.maxResults}`;
        
        // Check cache
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          logger.info('Returning cached search results', 'WALMART_API', { query: input.query });
          return cached.data;
        }

        // Initialize BrightData service
        const brightDataService = new BrightDataService({
          apiKey: process.env.BRIGHTDATA_API_KEY || '',
          apiSecret: process.env.BRIGHTDATA_API_SECRET || '',
          rateLimitPerMinute: Number(process.env.BRIGHTDATA_RATE_LIMIT) || 60
        });

        // Perform search
        const searchResult = await brightDataService.searchWalmartProducts(
          input.query,
          input.maxResults
        );

        // Transform response for frontend
        const response = {
          query: input.query,
          totalFound: searchResult.totalResults || 0,
          products: searchResult.products || [],
          timestamp: new Date()
        };

        // Cache the result
        cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });

        logger.info('Search completed successfully', 'WALMART_API', {
          query: input.query,
          productsFound: response?.products?.length
        });

        return response;
      } catch (error) {
        logger.error('Search failed', 'WALMART_API', { error, input });
        throw new Error('Failed to search Walmart products');
      }
    }),

  /**
   * Get detailed product information
   */
  getProductDetails: protectedProcedure
    .input(productDetailsSchema)
    .mutation(async ({ input }) => {
      try {
        const cacheKey = `product:${input.productUrl}`;
        
        // Check cache
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          logger.info('Returning cached product details', 'WALMART_API', { url: input.productUrl });
          return cached.data;
        }

        // Initialize BrightData service
        const brightDataService = new BrightDataService({
          apiKey: process.env.BRIGHTDATA_API_KEY || '',
          apiSecret: process.env.BRIGHTDATA_API_SECRET || '',
          rateLimitPerMinute: Number(process.env.BRIGHTDATA_RATE_LIMIT) || 60
        });

        // Fetch product details
        const productData = await brightDataService.collectEcommerceData({
          platform: 'walmart',
          productUrl: input.productUrl
        });

        if (!productData || productData?.length || 0 === 0) {
          throw new Error('Product not found');
        }

        const response = productData[0]?.data || productData[0];

        // Cache the result
        cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });

        logger.info('Product details fetched successfully', 'WALMART_API', { url: input.productUrl });

        return response;
      } catch (error) {
        logger.error('Failed to get product details', 'WALMART_API', { error, input });
        throw new Error('Failed to fetch product details');
      }
    }),

  /**
   * Get product price history (placeholder for future implementation)
   */
  getProductHistory: protectedProcedure
    .input(productHistorySchema)
    .query(async ({ input }) => {
      try {
        logger.info('Fetching product history', 'WALMART_API', { productId: input.productId });
        
        // This would connect to a database storing historical price data
        // For now, return mock structure
        return {
          productId: input.productId,
          history: [],
          lowestPrice: null,
          highestPrice: null,
          averagePrice: null,
          lastUpdated: new Date()
        };
      } catch (error) {
        logger.error('Failed to get product history', 'WALMART_API', { error, input });
        throw new Error('Failed to fetch product history');
      }
    }),

  /**
   * Clear cache (admin endpoint)
   */
  clearCache: protectedProcedure
    .mutation(async () => {
      cache.clear();
      logger.info('Cache cleared', 'WALMART_API');
      return { success: true, message: 'Cache cleared successfully' };
    })
});