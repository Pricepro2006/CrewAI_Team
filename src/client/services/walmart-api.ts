/**
 * Walmart API Service Layer
 * Provides frontend API integration for Walmart grocery features
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../api/trpc/router.js';

// Create a vanilla client for non-hook usage
const client = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: '/api/trpc',
    }),
  ],
});
import type {
  WalmartProduct,
  GroceryList,
  Order,
  DealMatch,
  SubstitutionOptions,
  DeliverySlot,
  UserPreferences,
  OrderStatus,
  PaymentMethod,
  ProductPrice,
  ProductAvailability,
  ProductCategory,
  ProductImage,
  FulfillmentInfo,
} from '../../types/walmart-grocery.js';

// Router response types based on actual implementation
type ProductSearchResult = {
  success: boolean;
  products: Array<{
    id: number;
    productId: string;
    name: string;
    title: string;
    price: number;
    originalPrice?: number;
    savings?: number;
    inStock: boolean;
    category: string;
    brand: string;
    unit: string;
    imageUrl: string;
    image: string;
    rating?: number;
    reviewCount: number;
  }>;
  metadata: {
    totalResults: number;
    query: string;
    source: string;
    error?: string;
  };
};

type TrendingResult = {
  trending: Array<{
    id: number;
    productId: string;
    name: string;
    currentPrice: number;
    originalPrice?: number;
    inStock: boolean;
    category: string;
    imageUrl: string;
    trend: 'up' | 'down' | 'stable';
    priceChange: number;
  }>;
};

type BudgetResult = {
  budget: {
    monthlyBudget: number;
    totalSpent: number;
    remaining: number;
    percentUsed: number;
    categories: Record<string, { budget: number; spent: number }>;
  };
};

type StatsResult = {
  stats: {
    productsTracked: number;
    savedThisMonth: number;
    activeAlerts: number;
    inStock: number;
    avgPrice: number;
  };
};

// Helper function to create a minimal WalmartProduct from API response
function createWalmartProductFromResponse(apiProduct: any): WalmartProduct {
  const now = new Date().toISOString();
  return {
    id: apiProduct.productId || apiProduct.id || `product-${Date.now()}`,
    walmartId: apiProduct.productId || apiProduct.id || '',
    name: apiProduct.name || 'Unknown Product',
    brand: apiProduct.brand || 'Generic',
    category: (apiProduct.category as ProductCategory) || 'Other',
    description: apiProduct.description || '',
    price: {
      current: apiProduct.price || 0,
      original: apiProduct.originalPrice,
      currency: 'USD',
      unit: apiProduct.unit || 'each',
      perUnit: apiProduct.price || 0,
    } as any as ProductPrice,
    images: apiProduct.imageUrl ? [
      {
        url: apiProduct.imageUrl || apiProduct.image || '',
        type: 'primary',
        alt: apiProduct.name || 'Product Image',
      } as ProductImage
    ] : [],
    availability: {
      inStock: apiProduct.inStock !== undefined ? apiProduct.inStock : true,
      stockLevel: apiProduct.stockLevel,
      maxQuantity: 99,
      minQuantity: 1,
    } as ProductAvailability,
    metadata: { source: 'api' } as any,
    createdAt: now,
    updatedAt: now,
  };
}

// Helper function to create a full Order object from partial data
function createOrderFromPartial(partialOrder: any): Order {
  const now = new Date().toISOString();
  return {
    id: partialOrder.id || `order-${Date.now()}`,
    orderId: partialOrder.orderNumber || partialOrder.orderId || partialOrder.id || `ORD-${Date.now()}`,
    userId: partialOrder.userId || '',
    status: (partialOrder.status as OrderStatus) || 'pending',
    items: partialOrder.items || [],
    payment: {
      method: 'credit_card' as PaymentMethod,
      status: 'pending',
      amount: partialOrder.total || 0,
    },
    fulfillment: {
      fulfillmentType: 'delivery',
      status: 'scheduled',
      estimatedTime: partialOrder.deliveryDate || now,
      address: {
        type: 'residential',
        street1: partialOrder.deliveryAddress || '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
      },
      slot: {
        id: 'slot-1',
        date: partialOrder.deliveryDate || now,
        startTime: partialOrder.deliverySlot || '10:00',
        endTime: partialOrder.deliverySlot || '12:00',
        price: 0,
        available: true,
      },
    } as any as FulfillmentInfo,
    totals: {
      subtotal: partialOrder.subtotal || 0,
      tax: partialOrder.tax || 0,
      fees: partialOrder.fees || {},
      discounts: 0,
      total: partialOrder.total || 0,
      savings: 0,
    },
    timeline: [],
    customer: {
      id: partialOrder.userId || '',
      name: '',
      email: '',
    },
    metadata: {
      source: 'api',
    },
    createdAt: partialOrder.createdAt?.toISOString ? partialOrder?.createdAt?.toISOString() : partialOrder.createdAt || now,
    updatedAt: partialOrder.updatedAt?.toISOString ? partialOrder?.updatedAt?.toISOString() : partialOrder.updatedAt || now,
  };
}

// Product Search API
export const walmartProductAPI = {
  // Search products with filters
  searchProducts: async (params: {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    dietary?: string[];
    brands?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ products: WalmartProduct[]; total: number }> => {
    try {
      // searchProducts is a mutation in the router
      const result: ProductSearchResult = await client.walmartGrocery.searchProducts.mutate({
        query: params.query,
        limit: params.limit || 20
      });
      
      // Transform the response to match WalmartProduct format
      const products: WalmartProduct[] = (result.products || []).map((p: any) => 
        createWalmartProductFromResponse(p)
      );
      
      return {
        products,
        total: result.metadata?.totalResults || 0
      };
    } catch (error) {
      console.error('Product search failed:', error);
      throw error;
    }
  },

  // Get product by ID (search by name instead since getProductDetails isn't available)
  getProduct: async (productId: string): Promise<WalmartProduct | null> => {
    try {
      // Since getProductDetails doesn't exist, we'll search for the product
      const result: ProductSearchResult = await client.walmartGrocery.searchProducts.mutate({
        query: productId,
        limit: 1
      });
      
      if (!result.products || result.products.length === 0) return null;
      
      const product = result.products[0];
      return createWalmartProductFromResponse(product);
    } catch (error) {
      console.error('Get product failed:', error);
      return null;
    }
  },

  // Get products by IDs (search for each individually)
  getProductsByIds: async (productIds: string[]): Promise<WalmartProduct[]> => {
    try {
      // Fetch products individually using search
      const productPromises = productIds.map(async (id) => {
        const result: ProductSearchResult = await client.walmartGrocery.searchProducts.mutate({
          query: id,
          limit: 1
        });
        return result.products?.[0] || null;
      });
      
      const results = await Promise.all(productPromises);
      
      return results
        .filter((product): product is NonNullable<typeof product> => product !== null)
        .map(product => createWalmartProductFromResponse(product));
    } catch (error) {
      console.error('Get products by IDs failed:', error);
      throw error;
    }
  },

  // Get product recommendations (using getRecommendations endpoint)
  getRecommendations: async (params: {
    productId?: string;
    category?: string;
    userId?: string;
    limit?: number;
  }): Promise<WalmartProduct[]> => {
    try {
      // getRecommendations endpoint exists in the router, try to use it
      if (params.userId) {
        try {
          const result = await (client.walmartGrocery as any).getRecommendations?.query({
            userId: params.userId,
            context: {
              productId: params.productId,
              category: params.category
            }
          });
          
          if (result?.success && result?.recommendations) {
            return result.recommendations.slice(0, params.limit || 6).map((rec: any) => 
              createWalmartProductFromResponse(rec)
            );
          }
        } catch (err) {
          // Fallback to trending if getRecommendations fails
          console.warn('getRecommendations failed, falling back to trending:', err);
        }
      }
      
      // Fallback to trending products if no userId or if getRecommendations fails
      const trendingResult = await (client.walmartGrocery as any).getTrending?.query({
        limit: params.limit || 6
      });
      
      if (!trendingResult?.trending) {
        return [];
      }
      
      const result = trendingResult as TrendingResult;
      
      return result.trending.map((product: any) => 
        createWalmartProductFromResponse({
          ...product,
          price: product.currentPrice
        })
      );
    } catch (error) {
      console.error('Get recommendations failed:', error);
      return [];
    }
  },
};

// Deal Matching API
export const walmartDealAPI = {
  // Find deals for products (use trending products with savings)
  findDeals: async (productIds: string[]): Promise<DealMatch[]> => {
    try {
      const trendingResult = await (client.walmartGrocery as any).getTrending?.query({
        limit: 10
      });
      
      if (!trendingResult?.trending) {
        return [];
      }
      
      const result = trendingResult as TrendingResult;
      
      // Transform trending items with savings into deals
      return result.trending
        .filter((product: any) => product.originalPrice && product.originalPrice > product.currentPrice)
        .map((product: any) => ({
          id: `deal-${product.id}`,
          productId: product.productId,
          product: createWalmartProductFromResponse({
            ...product,
            price: product.currentPrice
          }),
          dealType: 'discount' as const,
          discount: {
            type: 'percentage' as const,
            value: product.priceChange,
            originalPrice: product.originalPrice || product.currentPrice,
            salePrice: product.currentPrice
          },
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          isActive: true,
          savings: (product.originalPrice || product.currentPrice) - product.currentPrice
        } as any as DealMatch));
    } catch (error) {
      console.error('Find deals failed:', error);
      return [];
    }
  },

  // Get featured deals (use trending products as featured deals)
  getFeaturedDeals: async (params?: {
    category?: string;
    limit?: number;
  }): Promise<WalmartProduct[]> => {
    try {
      const trendingResult = await (client.walmartGrocery as any).getTrending?.query({
        limit: params?.limit || 6
      });
      
      if (!trendingResult?.trending) {
        return [];
      }
      
      const result = trendingResult as TrendingResult;
      
      return result.trending
        .filter((product: any) => product.originalPrice && product.originalPrice > product.currentPrice)
        .map((product: any) => 
          createWalmartProductFromResponse({
            ...product,
            price: product.currentPrice
          })
        );
    } catch (error) {
      console.error('Get featured deals failed:', error);
      return [];
    }
  },

  // Get deal by ID (not implemented - return null)
  getDeal: async (dealId: string): Promise<DealMatch | null> => {
    try {
      // Deal by ID lookup not implemented in router
      console.warn('getDeal not implemented');
      return null;
    } catch (error) {
      console.error('Get deal failed:', error);
      return null;
    }
  },
};

// Grocery List API (not implemented in router - using mock implementations)
export const walmartListAPI = {
  // Get user's lists (mock implementation)
  getLists: async (userId: string): Promise<GroceryList[]> => {
    try {
      console.warn('getLists not implemented in router - returning mock data');
      return [];
    } catch (error) {
      console.error('Get lists failed:', error);
      return [];
    }
  },

  // Create new list (mock implementation)
  createList: async (params: {
    userId: string;
    name: string;
    description?: string;
    isShared?: boolean;
  }): Promise<GroceryList> => {
    try {
      console.warn('createList not implemented in router - returning mock data');
      // Return a default list structure
      return {
        id: `list-${Date.now()}`,
        user_id: params.userId,
        list_name: params.name,
        description: params.description,
        list_type: "shopping" as const,
        status: "active" as const,
        items: [],
        estimated_total: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Create list failed:', error);
      throw error;
    }
  },

  // Update list (mock implementation)
  updateList: async (params: {
    listId: string;
    updates: Partial<GroceryList>;
  }): Promise<GroceryList> => {
    try {
      console.warn('updateList not implemented in router - returning mock data');
      // Return the updated list structure
      return {
        id: params.listId,
        user_id: '',
        list_name: params?.updates?.list_name || '',
        description: params?.updates?.description,
        list_type: "shopping" as const,
        status: "active" as const,
        items: [],
        estimated_total: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Update list failed:', error);
      throw error;
    }
  },

  // Delete list (mock implementation)
  deleteList: async (listId: string): Promise<void> => {
    try {
      console.warn('deleteList not implemented in router');
      // Mock implementation - no-op
    } catch (error) {
      console.error('Delete list failed:', error);
      throw error;
    }
  },

  // Add item to list (mock implementation)
  addItemToList: async (params: {
    listId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }): Promise<void> => {
    try {
      console.warn('addItemToList not implemented in router');
      // Mock implementation - no-op
    } catch (error) {
      console.error('Add item to list failed:', error);
      throw error;
    }
  },

  // Remove item from list (mock implementation)
  removeItemFromList: async (params: {
    listId: string;
    itemId: string;
  }): Promise<void> => {
    try {
      console.warn('removeItemFromList not implemented in router');
      // Mock implementation - no-op
    } catch (error) {
      console.error('Remove item from list failed:', error);
      throw error;
    }
  },
};

// Order API (not implemented in router - using mock implementations)
export const walmartOrderAPI = {
  // Get user's orders (mock implementation)
  getOrders: async (params: {
    userId: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: Order[]; total: number }> => {
    try {
      console.warn('getOrders not implemented in router - returning mock data');
      return {
        orders: [],
        total: 0
      };
    } catch (error) {
      console.error('Get orders failed:', error);
      return { orders: [], total: 0 };
    }
  },

  // Get order by ID (mock implementation)
  getOrder: async (orderId: string): Promise<Order | null> => {
    try {
      console.warn('getOrder not implemented in router - returning null');
      return null;
    } catch (error) {
      console.error('Get order failed:', error);
      return null;
    }
  },

  // Create order (mock implementation)
  createOrder: async (params: {
    userId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    deliveryAddress: string;
    deliveryDate: Date;
    deliverySlot: string;
    paymentMethod: string;
  }): Promise<Order> => {
    try {
      console.warn('createOrder not implemented in router - returning mock order');
      return createOrderFromPartial({
        id: `order-${Date.now()}`,
        userId: params.userId,
        items: params.items,
        deliveryAddress: params.deliveryAddress,
        deliveryDate: params.deliveryDate.toISOString(),
        deliverySlot: params.deliverySlot,
        status: 'pending',
        total: params.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      });
    } catch (error) {
      console.error('Create order failed:', error);
      throw error;
    }
  },

  // Update order status (mock implementation)
  updateOrderStatus: async (params: {
    orderId: string;
    status: string;
  }): Promise<Order> => {
    try {
      console.warn('updateOrderStatus not implemented in router - returning mock order');
      return createOrderFromPartial({
        id: params.orderId,
        status: params.status
      });
    } catch (error) {
      console.error('Update order status failed:', error);
      throw error;
    }
  },

  // Track order (mock implementation)
  trackOrder: async (orderId: string): Promise<{
    status: string;
    location: string;
    estimatedDelivery: Date;
    updates: Array<{ timestamp: Date; status: string; description: string }>;
  }> => {
    try {
      console.warn('trackOrder not implemented in router - returning mock data');
      return {
        status: 'in_transit',
        location: 'Distribution Center',
        estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
        updates: [
          {
            timestamp: new Date(),
            status: 'in_transit',
            description: 'Package is on the way'
          }
        ]
      };
    } catch (error) {
      console.error('Track order failed:', error);
      throw error;
    }
  },
};

// Substitution API
export const walmartSubstitutionAPI = {
  // Get substitution suggestions
  getSuggestions: async (params: {
    productId: string;
    preferences?: SubstitutionOptions;
    limit?: number;
  }): Promise<Array<WalmartProduct & { matchScore: number; reason: string }>> => {
    try {
      // getSubstitutionSuggestions not implemented
      return [];
    } catch (error) {
      console.error('Get substitution suggestions failed:', error);
      throw error;
    }
  },

  // Save substitution preference
  savePreference: async (params: {
    userId: string;
    originalProductId: string;
    substituteProductId: string;
    preference: 'always' | 'never' | 'ask';
  }): Promise<void> => {
    try {
      // saveSubstitutionPreference not implemented
      console.warn('Substitution preference saving not implemented');
    } catch (error) {
      console.error('Save substitution preference failed:', error);
      throw error;
    }
  },
};

// Delivery API
export const walmartDeliveryAPI = {
  // Get available delivery slots
  getDeliverySlots: async (params: {
    zipCode: string;
    date: Date;
    days?: number;
  }): Promise<DeliverySlot[]> => {
    try {
      // getDeliverySlots not implemented
      return [] as DeliverySlot[];
    } catch (error) {
      console.error('Get delivery slots failed:', error);
      throw error;
    }
  },

  // Schedule delivery
  scheduleDelivery: async (params: {
    orderId: string;
    slotId: string;
    address: string;
    instructions?: string;
  }): Promise<void> => {
    try {
      // scheduleDelivery not implemented in router
      console.warn('Schedule delivery not implemented');
    } catch (error) {
      console.error('Schedule delivery failed:', error);
      throw error;
    }
  },

  // Update delivery
  updateDelivery: async (params: {
    orderId: string;
    slotId?: string;
    address?: string;
    instructions?: string;
  }): Promise<void> => {
    try {
      // updateDelivery not implemented in router
      console.warn('Update delivery not implemented');
    } catch (error) {
      console.error('Update delivery failed:', error);
      throw error;
    }
  },
};

// Price Tracking API
export const walmartPriceAPI = {
  // Get price history
  getPriceHistory: async (params: {
    productId: string;
    days?: number;
  }): Promise<Array<{ date: Date; price: number; wasOnSale?: boolean }>> => {
    try {
      // getPriceHistory endpoint doesn't exist, return empty array
      console.warn('getPriceHistory not implemented in router - returning empty array');
      return [];
    } catch (error) {
      console.error('Get price history failed:', error);
      throw error;
    }
  },

  // Set price alert
  setPriceAlert: async (params: {
    userId: string;
    productId: string;
    targetPrice: number;
    alertType: 'below' | 'above';
  }): Promise<void> => {
    try {
      // Use priceAlerts router createAlert instead
      await (client as any).priceAlerts?.createAlert?.mutate({
        alertName: `Price Alert for ${params.productId}`,
        alertType: 'price_drop',
        productName: params.productId,
        targetPrice: params.targetPrice
      });
    } catch (error) {
      console.error('Set price alert failed:', error);
      throw error;
    }
  },

  // Get user's price alerts
  getPriceAlerts: async (userId: string): Promise<Array<{
    id: string;
    productId: string;
    product: WalmartProduct;
    targetPrice: number;
    alertType: 'below' | 'above';
    isActive: boolean;
    createdAt: Date;
  }>> => {
    try {
      // Use priceAlerts router getAlerts instead
      const result = await (client as any).priceAlerts?.getAlerts?.query();
      // Transform alerts to price alerts format
      if (!result?.alerts) {
        return [];
      }
      
      return result.alerts
        .filter((alert: any) => alert.alertType === 'price_drop')
        .map((alert: any) => ({
          id: alert.id || alert.alertId,
          productId: alert.productId || alert.productName,
          product: {} as WalmartProduct, // Would need to fetch product details
          targetPrice: alert.targetPrice || 0,
          alertType: 'below' as const,
          isActive: alert.status === 'active',
          createdAt: new Date(alert.createdAt || Date.now())
        }));
    } catch (error) {
      console.error('Get price alerts failed:', error);
      throw error;
    }
  },

  // Delete price alert
  deletePriceAlert: async (alertId: string): Promise<void> => {
    try {
      await (client as any).priceAlerts?.deleteAlert?.mutate({ alertId });
    } catch (error) {
      console.error('Delete price alert failed:', error);
      throw error;
    }
  },
};

// User Preferences API
export const walmartPreferencesAPI = {
  // Get user preferences
  getPreferences: async (userId: string): Promise<UserPreferences> => {
    try {
      // getPreferences endpoint doesn't exist, return default preferences
      console.warn('getPreferences not implemented in router - returning defaults');
      // Return default preferences
      return {
        id: `pref-${userId}`,
        user_id: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as UserPreferences;
    } catch (error) {
      console.error('Get user preferences failed:', error);
      throw error;
    }
  },

  // Update user preferences
  updatePreferences: async (params: {
    userId: string;
    preferences: Partial<UserPreferences>;
  }): Promise<UserPreferences> => {
    try {
      // updatePreferences endpoint doesn't exist, return merged preferences
      console.warn('updatePreferences not implemented in router - returning merged defaults');
      // Return merged preferences
      return {
        id: `pref-${params.userId}`,
        user_id: params.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...params.preferences
      } as UserPreferences;
    } catch (error) {
      console.error('Update user preferences failed:', error);
      throw error;
    }
  },
};

// Budget API
export const walmartBudgetAPI = {
  // Get spending summary
  getSpendingSummary: async (params: {
    userId: string;
    startDate: Date;
    endDate: Date;
    groupBy?: 'day' | 'week' | 'month' | 'category';
  }): Promise<{
    total: number;
    average: number;
    byPeriod: Array<{ period: string; amount: number }>;
    byCategory: Array<{ category: string; amount: number; percentage: number }>;
  }> => {
    try {
      // getSpendingSummary not implemented in router
      return {
        total: 0,
        average: 0,
        byPeriod: [],
        byCategory: []
      };
    } catch (error) {
      console.error('Get spending summary failed:', error);
      throw error;
    }
  },

  // Set budget
  setBudget: async (params: {
    userId: string;
    amount: number;
    period: 'weekly' | 'monthly';
    categories?: Record<string, number>;
  }): Promise<void> => {
    try {
      // setBudget not implemented in router
      console.warn('Set budget not implemented');
    } catch (error) {
      console.error('Set budget failed:', error);
      throw error;
    }
  },

  // Get budget status
  getBudgetStatus: async (userId: string): Promise<{
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
    period: 'weekly' | 'monthly';
    categories: Array<{
      category: string;
      budget: number;
      spent: number;
      percentage: number;
    }>;
  }> => {
    try {
      // getBudgetStatus not implemented in router
      return {
        budget: 0,
        spent: 0,
        remaining: 0,
        percentage: 0,
        period: 'monthly' as const,
        categories: []
      };
    } catch (error) {
      console.error('Get budget status failed:', error);
      throw error;
    }
  },
};

// Export all APIs
export const walmartAPI = {
  products: walmartProductAPI,
  deals: walmartDealAPI,
  lists: walmartListAPI,
  orders: walmartOrderAPI,
  substitutions: walmartSubstitutionAPI,
  delivery: walmartDeliveryAPI,
  prices: walmartPriceAPI,
  preferences: walmartPreferencesAPI,
  budget: walmartBudgetAPI,
};

// Export default
export default walmartAPI;