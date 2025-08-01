/**
 * API Client for frontend hooks
 * Re-exports tRPC hooks for consistent usage
 */

import { trpc } from "../../utils/trpc.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";

// Direct export of tRPC hooks for use in components
export const api = {
  walmartGrocery: {
    // Export tRPC procedures directly
    cartOperation: trpc.walmartGrocery.cartOperation,
    searchProducts: trpc.walmartGrocery.searchProducts,
    analyzeDeal: trpc.walmartGrocery.analyzeDeal,
    trackPrice: trpc.walmartGrocery.trackPrice,
    getRecommendations: trpc.walmartGrocery.getRecommendations,
    getProductDetails: trpc.walmartGrocery.getProductDetails,
    getOrders: trpc.walmartGrocery.getOrders,
    createOrder: trpc.walmartGrocery.createOrder,
    getPreferences: trpc.walmartGrocery.getPreferences,
    updatePreferences: trpc.walmartGrocery.updatePreferences,
    getLists: trpc.walmartGrocery.getLists,
    createList: trpc.walmartGrocery.createList,
    getAlerts: trpc.walmartGrocery.getAlerts,
    createAlert: trpc.walmartGrocery.createAlert,
    getPriceHistory: trpc.walmartGrocery.getPriceHistory,
  },
};

// Convenience re-export of trpc for direct usage
export { trpc };
