/**
 * API Client for frontend hooks
 * Provides a simplified interface over tRPC for client hooks
 */

import { trpc } from '../../utils/trpc';
import type { WalmartProduct } from '../../types/walmart-grocery';

// Simplified API interface that matches what hooks expect
export const api = {
  walmartGrocery: {
    // Cart operations
    cartOperation: {
      mutate: async (params: {
        userId: string;
        productId: string;
        quantity: number;
        operation: 'add' | 'update' | 'remove';
      }) => {
        try {
          switch (params.operation) {
            case 'add':
              return await trpc.walmartGrocery.addToCart.mutate({
                userId: params.userId,
                productId: params.productId,
                quantity: params.quantity,
              });
            case 'update':
              return await trpc.walmartGrocery.updateCartQuantity.mutate({
                userId: params.userId,
                productId: params.productId,
                quantity: params.quantity,
              });
            case 'remove':
              return await trpc.walmartGrocery.removeFromCart.mutate({
                userId: params.userId,
                productId: params.productId,
              });
            default:
              throw new Error('Unknown cart operation: ' + params.operation);
          }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },
    },

    // Product search
    searchProducts: {
      mutate: async (params: {
        query: string;
        category?: string;
        minPrice?: number;
        maxPrice?: number;
        inStock?: boolean;
        dietary?: string[];
        limit?: number;
        offset?: number;
      }) => {
        try {
          // The searchProducts endpoint is a mutation, not a query
          const result = await trpc.walmartGrocery.searchProducts.mutate({
            query: params.query,
            category: params.category,
            minPrice: params.minPrice,
            maxPrice: params.maxPrice,
            inStock: params.inStock,
            storeId: undefined, // Add if needed
            limit: params.limit || 20,
          });
          
          // Extract products from the result
          const products = result.products || result.searchResults || [];
          
          return {
            success: true,
            products: products,
            total: products.length,
          };
        } catch (error) {
          return {
            success: false,
            products: [],
            total: 0,
            error: error instanceof Error ? error.message : 'Search failed',
          };
        }
      },
    },

    // Deal matching
    findDeals: {
      mutate: async (params: { productIds: string[] }) => {
        try {
          // The analyzeDeal endpoint is a query
          const result = await trpc.walmartGrocery.analyzeDeal.query({
            productIds: params.productIds,
            dealId: undefined,
            customerId: undefined,
          });
          
          // Convert the result format to match what the frontend expects
          const deals = result.dealMatches || result.deals || [];
          
          return {
            success: true,
            deals: deals,
          };
        } catch (error) {
          return {
            success: false,
            deals: [],
            error: error instanceof Error ? error.message : 'Deal search failed',
          };
        }
      },
    },

    // Price tracking
    trackPrice: {
      mutate: async (params: {
        userId: string;
        productId: string;
        targetPrice: number;
      }) => {
        try {
          const result = await trpc.walmartGrocery.setPriceAlert.mutate(params);
          return {
            success: true,
            alert: result,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Price tracking failed',
          };
        }
      },
    },

    // Product substitutions
    getSubstitutions: {
      query: async (params: { productId: string; limit?: number }) => {
        try {
          const result = await trpc.walmartGrocery.getSubstitutionSuggestions.query(params);
          return {
            success: true,
            substitutions: result || [],
          };
        } catch (error) {
          return {
            success: false,
            substitutions: [],
            error: error instanceof Error ? error.message : 'Substitution search failed',
          };
        }
      },
    },
  },
};

// Type-safe wrapper for API calls with error handling
export const apiCall = async <T>(
  operation: () => Promise<T>,
  defaultValue: T
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      data: defaultValue,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export default api;
