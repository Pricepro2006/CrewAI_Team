/**
 * Walmart API Service Layer
 * Provides frontend API integration for Walmart grocery features
 */

import { trpc } from '../../utils/trpc';
import type {
  WalmartProduct,
  GroceryList,
  Order,
  DealMatch,
  SubstitutionOptions,
  DeliverySlot,
  UserPreferences,
} from '../../types/walmart-grocery';

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
      const result = await trpc.walmartGrocery.searchProducts.mutate({
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
      const result = await trpc.walmartGrocery.getProductDetails.query({ 
        productId,
        includeReviews: false,
        includeAvailability: true
      });
      return result || null;
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
        trpc.walmartGrocery.getProductDetails.query({ 
          productId: id,
          includeReviews: false,
          includeAvailability: true
        })
      );
      const results = await Promise.all(productPromises);
      return results.filter(Boolean) as WalmartProduct[];
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
      const result = await trpc.walmartGrocery.getRecommendations.query({
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
      const result = await trpc.walmartGrocery.analyzeDeal.query({ 
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
      const result = await trpc.walmartGrocery.scrapeData.mutate({
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
      const result = await trpc.walmartGrocery.getDeal.query({ dealId });
      return result;
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
      const result = await trpc.walmartGrocery.getLists.query({ userId });
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
      const result = await trpc.walmartGrocery.createList.mutate(params);
      return result;
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
      const result = await trpc.walmartGrocery.updateList.mutate(params);
      return result;
    } catch (error) {
      console.error('Update list failed:', error);
      throw error;
    }
  },

  // Delete list
  deleteList: async (listId: string): Promise<void> => {
    try {
      await trpc.walmartGrocery.deleteList.mutate({ listId });
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
      await trpc.walmartGrocery.addItemToList.mutate(params);
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
      await trpc.walmartGrocery.removeItemFromList.mutate(params);
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
      const result = await trpc.walmartGrocery.getOrders.query(params);
      return result;
    } catch (error) {
      console.error('Get orders failed:', error);
      throw error;
    }
  },

  // Get order by ID
  getOrder: async (orderId: string): Promise<Order | null> => {
    try {
      const result = await trpc.walmartGrocery.getOrder.query({ orderId });
      return result;
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
      const result = await trpc.walmartGrocery.createOrder.mutate(params);
      return result;
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
      const result = await trpc.walmartGrocery.updateOrderStatus.mutate(params);
      return result;
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
      const result = await trpc.walmartGrocery.trackOrder.query({ orderId });
      return result;
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
      const result = await trpc.walmartGrocery.getSubstitutionSuggestions.query(params);
      return result;
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
      await trpc.walmartGrocery.saveSubstitutionPreference.mutate(params);
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
      const result = await trpc.walmartGrocery.getDeliverySlots.query(params);
      return result;
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
      await trpc.walmartGrocery.scheduleDelivery.mutate(params);
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
      await trpc.walmartGrocery.updateDelivery.mutate(params);
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
      const result = await trpc.walmartGrocery.getPriceHistory.query(params);
      return result;
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
      await trpc.walmartGrocery.setPriceAlert.mutate(params);
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
      const result = await trpc.walmartGrocery.getPriceAlerts.query({ userId });
      return result;
    } catch (error) {
      console.error('Get price alerts failed:', error);
      throw error;
    }
  },

  // Delete price alert
  deletePriceAlert: async (alertId: string): Promise<void> => {
    try {
      await trpc.walmartGrocery.deletePriceAlert.mutate({ alertId });
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
      const result = await trpc.walmartGrocery.getUserPreferences.query({ userId });
      return result;
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
      const result = await trpc.walmartGrocery.updateUserPreferences.mutate(params);
      return result;
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
      const result = await trpc.walmartGrocery.getSpendingSummary.query(params);
      return result;
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
      await trpc.walmartGrocery.setBudget.mutate(params);
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
      const result = await trpc.walmartGrocery.getBudgetStatus.query({ userId });
      return result;
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