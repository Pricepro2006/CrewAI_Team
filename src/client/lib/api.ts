/**
 * API Client for frontend hooks
 * Provides type-safe tRPC integration with proper error handling
 */

import { trpc } from "../../utils/trpc.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";
import type { TRPCError } from "@trpc/server";

// Type-safe API client with proper error handling
export const api = trpc;

// Legacy compatibility wrapper with safe access patterns
export const legacyApi = {
  walmartGrocery: {
    // Safe exports with fallback handling
    cartOperation: trpc.walmartGrocery?.cartOperation,
    searchProducts: trpc.walmartGrocery?.searchProducts,
    analyzeDeal: trpc.walmartGrocery?.analyzeDeal,
    trackPrice: trpc.walmartGrocery?.trackPrice,
    getRecommendations: trpc.walmartGrocery?.getRecommendations,
    getProductDetails: trpc.walmartGrocery?.getProductDetails,
    getOrders: trpc.walmartGrocery?.getOrders,
    createOrder: trpc.walmartGrocery?.createOrder,
    getPreferences: trpc.walmartGrocery?.getPreferences,
    updatePreferences: trpc.walmartGrocery?.updatePreferences,
    getLists: trpc.walmartGrocery?.getLists,
    createList: trpc.walmartGrocery?.createList,
    getAlerts: trpc.walmartGrocery?.getAlerts,
    createAlert: trpc.walmartGrocery?.createAlert,
    getPriceHistory: trpc.walmartGrocery?.getPriceHistory,
  },
  emails: {
    getTableData: trpc.emails?.getTableData,
    getDashboardStats: trpc.emails?.getDashboardStats,
    updateStatus: trpc.emails?.updateStatus,
    searchAdvanced: trpc.emails?.searchAdvanced,
    bulkUpdate: trpc.emails?.bulkUpdate,
    batchDelete: trpc.emails?.batchDelete,
    getById: trpc.emails?.getById,
  },
  emailAssignment: {
    getTeamMembers: trpc.emailAssignment?.getTeamMembers,
    getWorkloadDistribution: trpc.emailAssignment?.getWorkloadDistribution,
    assignEmail: trpc.emailAssignment?.assignEmail,
    bulkAssignEmails: trpc.emailAssignment?.bulkAssignEmails,
    getAssignmentSuggestions: trpc.emailAssignment?.getAssignmentSuggestions,
    onEmailUpdate: trpc.emailAssignment?.onEmailUpdate,
  },
};

// Helper function to safely access tRPC procedures
export function safeTrpcAccess<T>(accessor: () => T, fallback?: T): T | undefined {
  try {
    return accessor();
  } catch (error) {
    console.warn('tRPC procedure access failed:', error);
    return fallback;
  }
}

// Helper function for handling tRPC errors
export function handleTrpcError(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const trpcError = error as TRPCError;
    
    // Handle validation errors
    if (trpcError.data?.zodError) {
      return "Invalid data format. Please check your input.";
    }
    
    // Handle specific error codes
    switch (trpcError.data?.code) {
      case "UNAUTHORIZED":
        return "You are not authorized to perform this action.";
      case "NOT_FOUND":
        return "The requested resource was not found.";
      case "BAD_REQUEST":
        return "Invalid request. Please check your input.";
      case "TIMEOUT":
        return "Request timed out. Please try again.";
      case "TOO_MANY_REQUESTS":
        return "Too many requests. Please wait a moment and try again.";
      default:
        return trpcError.message || "An unexpected error occurred.";
    }
  }
  
  // Handle network errors
  if (error instanceof Error) {
    if (error.message.includes('fetch')) {
      return "Network error. Please check your connection and try again.";
    }
    if (error.message.includes('timeout')) {
      return "Request timed out. Please try again.";
    }
    return error.message;
  }
  
  return "An unexpected error occurred. Please try again.";
}

// Convenience re-export of trpc for direct usage
export { trpc };
