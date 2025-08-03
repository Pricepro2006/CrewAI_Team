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
} from '../../types/walmart-grocery.js';

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
      type: 'delivery',
      status: 'pending',
      estimatedTime: partialOrder.deliveryDate || now,
      address: {
        id: 'addr-1',
        type: 'home',
        street1: partialOrder.deliveryAddress || '',
        city: '',
        state: '',
        postalCode: '',
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
    },
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
    createdAt: partialOrder.createdAt?.toISOString ? partialOrder.createdAt.toISOString() : partialOrder.createdAt || now,
    updatedAt: partialOrder.updatedAt?.toISOString ? partialOrder.updatedAt.toISOString() : partialOrder.updatedAt || now,
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
      const result = await client.walmartGrocery.searchProducts.mutate({
        query: params.query,
        category: params.category,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        inStock: params.inStock,
        storeId: undefined,
        limit: params.limit || 20
      });
      // Transform the response to match expected format
      return {
        products: result.products || [],
        total: result.metadata?.totalResults || 0
      };
    } catch (error) {
      console.error('Product search failed:', error);
      throw error;
    }
  },

  // Get product by ID
  getProduct: async (productId: string): Promise<WalmartProduct | null> => {
    try {
      // Use getProductDetails instead
      const result = await client.walmartGrocery.getProductDetails.query({ 
        productId,
        includeReviews: false,
        includeAvailability: true
      });
      // Transform response to match WalmartProduct type
      if (!result || !result.data) return null;
      const product = result.data;
      return {
        id: product.productId || productId,
        name: product.name || 'Unknown Product',
        category: product.category || 'General',
        price: product.price || 0,
        imageUrl: product.imageUrl || '',
        inStock: product.available !== false,
        unit: 'each'
      } as unknown as WalmartProduct;
    } catch (error) {
      console.error('Get product failed:', error);
      throw error;
    }
  },

  // Get products by IDs
  getProductsByIds: async (productIds: string[]): Promise<WalmartProduct[]> => {
    try {
      // Fetch products individually
      const productPromises = productIds.map(id => 
        client.walmartGrocery.getProductDetails.query({ 
          productId: id,
          includeReviews: false,
          includeAvailability: true
        })
      );
      const results = await Promise.all(productPromises);
      // Transform results to match WalmartProduct[]
      return results
        .filter(result => result?.data)
        .map(result => {
          const product = result.data;
          return {
            id: product.productId || '',
            name: product.name || 'Unknown Product',
            category: product.category || 'General',
            price: product.price || 0,
            imageUrl: product.imageUrl || '',
            inStock: product.available !== false,
            unit: 'each'
          } as unknown as WalmartProduct;
        });
    } catch (error) {
      console.error('Get products by IDs failed:', error);
      throw error;
    }
  },

  // Get product recommendations
  getRecommendations: async (params: {
    productId?: string;
    category?: string;
    userId?: string;
    limit?: number;
  }): Promise<WalmartProduct[]> => {
    try {
      const result = await client.walmartGrocery.getRecommendations.query({
        userId: params.userId || 'default',
        category: params.category,
        budget: undefined,
        dietaryRestrictions: undefined
      });
      // Parse recommendations from the response
      return []; // Recommendations come as text, need proper parsing
    } catch (error) {
      console.error('Get recommendations failed:', error);
      throw error;
    }
  },
};

// Deal Matching API
export const walmartDealAPI = {
  // Find deals for products
  findDeals: async (productIds: string[]): Promise<DealMatch[]> => {
    try {
      // Use analyzeDeal instead
      const result = await client.walmartGrocery.analyzeDeal.query({ 
        productIds,
        dealId: undefined,
        customerId: undefined
      });
      // Transform response to DealMatch array
      return result.applicableDeals || [];
    } catch (error) {
      console.error('Find deals failed:', error);
      throw error;
    }
  },

  // Get featured deals
  getFeaturedDeals: async (params?: {
    category?: string;
    limit?: number;
  }): Promise<WalmartProduct[]> => {
    try {
      // Use scrapeData to get deals page
      const result = await client.walmartGrocery.scrapeData.mutate({
        url: 'https://www.walmart.com/shop/deals',
        extractType: 'deals',
        options: { category: params?.category, limit: params?.limit }
      });
      // Transform scraped data to products
      return [];
    } catch (error) {
      console.error('Get featured deals failed:', error);
      throw error;
    }
  },

  // Get deal by ID
  getDeal: async (dealId: string): Promise<DealMatch | null> => {
    try {
      // analyzeDeal expects productIds, not a single dealId
      // Return null for now as getDeal by ID isn't implemented
      return null;
    } catch (error) {
      console.error('Get deal failed:', error);
      throw error;
    }
  },
};

// Grocery List API
export const walmartListAPI = {
  // Get user's lists
  getLists: async (userId: string): Promise<GroceryList[]> => {
    try {
      const result = await client.walmartGrocery.getLists.query({ userId });
      // Transform the response to match GroceryList[]
      if (!result || !Array.isArray(result)) return [];
      return result;
    } catch (error) {
      console.error('Get lists failed:', error);
      throw error;
    }
  },

  // Create new list
  createList: async (params: {
    userId: string;
    name: string;
    description?: string;
    isShared?: boolean;
  }): Promise<GroceryList> => {
    try {
      const result = await client.walmartGrocery.createList.mutate(params);
      // Transform the response to match GroceryList type
      if (result.success && result.list) {
        return result.list;
      }
      // Return a default list structure if transformation fails
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

  // Update list
  updateList: async (params: {
    listId: string;
    updates: Partial<GroceryList>;
  }): Promise<GroceryList> => {
    try {
      const result = await client.walmartGrocery.updateList.mutate({
        listId: params.listId,
        name: params.updates.list_name,
        description: params.updates.description
      });
      // Transform the response to match GroceryList type
      if (result.success) {
        // Return the updated list structure
        return {
          id: params.listId,
          user_id: '',
          list_name: params.updates.list_name || '',
          description: params.updates.description,
          list_type: "shopping" as const,
          status: "active" as const,
          items: [],
          estimated_total: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      throw new Error('Failed to update list');
    } catch (error) {
      console.error('Update list failed:', error);
      throw error;
    }
  },

  // Delete list
  deleteList: async (listId: string): Promise<void> => {
    try {
      await client.walmartGrocery.deleteList.mutate({ listId });
    } catch (error) {
      console.error('Delete list failed:', error);
      throw error;
    }
  },

  // Add item to list
  addItemToList: async (params: {
    listId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }): Promise<void> => {
    try {
      await client.walmartGrocery.addItemToList.mutate({
        listId: params.listId,
        items: [{
          productId: params.productId,
          quantity: params.quantity,
          notes: params.notes
        }]
      });
    } catch (error) {
      console.error('Add item to list failed:', error);
      throw error;
    }
  },

  // Remove item from list
  removeItemFromList: async (params: {
    listId: string;
    itemId: string;
  }): Promise<void> => {
    try {
      await client.walmartGrocery.removeItemFromList.mutate(params);
    } catch (error) {
      console.error('Remove item from list failed:', error);
      throw error;
    }
  },
};

// Order API
export const walmartOrderAPI = {
  // Get user's orders
  getOrders: async (params: {
    userId: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: Order[]; total: number }> => {
    try {
      const result = await client.walmartGrocery.getOrders.query(params);
      // Transform result to expected format
      return {
        orders: (result.orders || []).map(createOrderFromPartial),
        total: result.totalCount || 0
      };
    } catch (error) {
      console.error('Get orders failed:', error);
      throw error;
    }
  },

  // Get order by ID
  getOrder: async (orderId: string): Promise<Order | null> => {
    try {
      const result = await client.walmartGrocery.getOrder.query({ orderId });
      return result?.order ? createOrderFromPartial(result.order) : null;
    } catch (error) {
      console.error('Get order failed:', error);
      throw error;
    }
  },

  // Create order
  createOrder: async (params: {
    userId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    deliveryAddress: string;
    deliveryDate: Date;
    deliverySlot: string;
    paymentMethod: string;
  }): Promise<Order> => {
    try {
      const result = await client.walmartGrocery.createOrder.mutate({
        userId: params.userId,
        items: params.items,
        deliveryAddress: params.deliveryAddress,
        deliveryDate: params.deliveryDate.toISOString(),
        deliverySlot: params.deliverySlot
      });
      // Transform the response to match Order type
      if (result.success && result.order) {
        return createOrderFromPartial(result.order);
      }
      // Fallback if structure is different
      throw new Error('Failed to create order');
    } catch (error) {
      console.error('Create order failed:', error);
      throw error;
    }
  },

  // Update order status
  updateOrderStatus: async (params: {
    orderId: string;
    status: string;
  }): Promise<Order> => {
    try {
      const result = await client.walmartGrocery.updateOrderStatus.mutate({
        orderId: params.orderId,
        status: params.status as any
      });
      // TODO: Backend should return full Order object. Using partial data for now.
      return createOrderFromPartial({
        id: params.orderId,
        status: result.status || params.status
      });
    } catch (error) {
      console.error('Update order status failed:', error);
      throw error;
    }
  },

  // Track order
  trackOrder: async (orderId: string): Promise<{
    status: string;
    location: string;
    estimatedDelivery: Date;
    updates: Array<{ timestamp: Date; status: string; description: string }>;
  }> => {
    try {
      const result = await client.walmartGrocery.trackOrder.query({ orderId });
      // Transform result to expected format
      return {
        status: result.status || 'unknown',
        location: 'In transit', // Mock location as it's not in the response
        estimatedDelivery: new Date(result.estimatedDelivery || Date.now()),
        updates: result.trackingSteps?.map((step: any) => ({
          timestamp: step.timestamp || new Date(),
          status: step.step || 'unknown',
          description: step.step || ''
        })) || []
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
      const result = await client.walmartGrocery.getPriceHistory.query(params);
      // Transform result to expected format
      if (result && result.history) {
        return result.history.map((point: any) => ({
          date: point.date || new Date(),
          price: point.price || 0,
          wasOnSale: point.available === false
        }));
      }
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
      // Use createAlert instead of setPriceAlert
      await client.walmartGrocery.createAlert.mutate({
        userId: params.userId,
        productId: params.productId,
        alertType: 'price_drop',
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
      // Use getAlerts instead of getPriceAlerts
      const result = await client.walmartGrocery.getAlerts.query({ userId });
      // Transform alerts to price alerts format
      return result.alerts
        .filter((alert: any) => alert.type === 'price')
        .map((alert: any) => ({
          id: alert.id,
          productId: alert.productId,
          product: {} as WalmartProduct, // Would need to fetch product details
          targetPrice: alert.conditions?.targetPrice || 0,
          alertType: alert.conditions?.alertType || 'below',
          isActive: alert.isActive,
          createdAt: new Date(alert.createdAt)
        }));
    } catch (error) {
      console.error('Get price alerts failed:', error);
      throw error;
    }
  },

  // Delete price alert
  deletePriceAlert: async (alertId: string): Promise<void> => {
    try {
      await client.walmartGrocery.deleteAlert.mutate({ alertId });
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
      const result = await client.walmartGrocery.getPreferences.query({ userId });
      // Transform the response to include userId
      return {
        userId,
        ...result.preferences
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
      const result = await client.walmartGrocery.updatePreferences.mutate(params);
      // Transform the response to include userId
      return {
        userId: params.userId,
        ...result.preferences
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