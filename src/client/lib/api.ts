/**
 * API Client for frontend hooks
 * Provides type-safe tRPC integration with proper error handling
 */

import { trpc } from "../../utils/trpc.js";
import type { WalmartProduct } from "../../types/walmart-grocery.js";
import type { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "../../api/trpc/router.js";

// Type-safe API client with proper error handling
export const api = trpc;

// Type-safe API wrapper with actual available procedures
export const legacyApi = {
  walmartGrocery: {
    // Available procedures from walmart grocery router
    searchProducts: () => trpc.walmartGrocery.searchProducts,
    getStats: () => trpc.walmartGrocery.getStats,
    getTrending: () => trpc.walmartGrocery.getTrending,
    getBudget: () => trpc.walmartGrocery.getBudget,
  },
  emails: {
    // Available procedures from email router
    getTableData: () => safeTrpcAccess(() => trpc.emails.getTableData),
    getDashboardStats: () => safeTrpcAccess(() => trpc.emails.getDashboardStats),
    updateStatus: () => safeTrpcAccess(() => trpc.emails.updateStatus),
    searchAdvanced: () => safeTrpcAccess(() => trpc.emails.searchAdvanced),
    bulkUpdate: () => safeTrpcAccess(() => trpc.emails.bulkUpdate),
    batchDelete: () => safeTrpcAccess(() => trpc.emails.batchDelete),
    getById: () => safeTrpcAccess(() => trpc.emails.getById),
  },
  emailAssignment: {
    // Available procedures from email assignment router
    getTeamMembers: () => safeTrpcAccess(() => trpc.emailAssignment.getTeamMembers),
    getWorkloadDistribution: () => safeTrpcAccess(() => trpc.emailAssignment.getWorkloadDistribution),
    assignEmail: () => safeTrpcAccess(() => trpc.emailAssignment.assignEmail),
    bulkAssignEmails: () => safeTrpcAccess(() => trpc.emailAssignment.bulkAssignEmails),
    getAssignmentSuggestions: () => safeTrpcAccess(() => trpc.emailAssignment.getAssignmentSuggestions),
    onEmailUpdate: () => safeTrpcAccess(() => trpc.emailAssignment.onEmailUpdate),
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
  // Handle tRPC client errors
  if (error && typeof error === 'object' && 'data' in error) {
    const trpcError = error as TRPCClientError<AppRouter>;
    
    // Handle validation errors
    if (trpcError.data && typeof trpcError.data === 'object' && 'zodError' in trpcError.data) {
      return "Invalid data format. Please check your input.";
    }
    
    // Handle specific error codes
    if (trpcError.data && typeof trpcError.data === 'object' && 'code' in trpcError.data) {
      const code = (trpcError.data as any).code;
      switch (code) {
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
    
    return trpcError.message || "An unexpected error occurred.";
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
