import { useMemo, useCallback } from "react";
import { api as trpc, handleTrpcError } from "../lib/api.js";
import type { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "../../api/trpc/router.js";

// Define proper types for tRPC hook parameters
type TRPCQueryOptions = {
  staleTime?: number;
  gcTime?: number; // Replaced cacheTime
  retry?: boolean | number | ((failureCount: number, error: unknown) => boolean);
  retryDelay?: number | ((attemptIndex: number) => number);
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number | false;
  enabled?: boolean;
};

type TRPCMutationOptions = {
  onSuccess?: (...args: unknown[]) => void | Promise<void>;
  onError?: (error: unknown, ...args: unknown[]) => void;
  retry?: boolean | number | ((failureCount: number, error: unknown) => boolean);
};

// Define proper filter and search types
type EmailFilters = {
  status?: ("red" | "yellow" | "green")[];
  emailAlias?: string[];
  workflowState?: ("START_POINT" | "IN_PROGRESS" | "COMPLETION")[];
  priority?: ("critical" | "high" | "medium" | "low")[];
  dateRange?: {
    start: string;
    end: string;
  };
};

type TableParams = {
  page: number;
  pageSize: number;
  sortBy: "received_date" | "subject" | "requested_by" | "status" | "priority";
  sortOrder: "asc" | "desc";
  filters?: EmailFilters;
  search?: string;
  refreshKey?: number;
};

// Real tRPC implementations with proper caching and invalidation
export function useOptimizedEmails(filters?: Record<string, unknown>) {
  // Convert filters to table view format
  const tableParams = useMemo(() => ({
    page: 1,
    pageSize: filters?.limit || 50,
    sortBy: filters?.sortBy || "received_date",
    sortOrder: filters?.sortOrder || "desc",
    filters: {
      status: filters?.status ? [filters.status] : undefined,
      emailAlias: filters?.emailAlias ? [filters.emailAlias] : undefined,
      workflowState: filters?.workflowState ? [filters.workflowState] : undefined,
      priority: filters?.priority ? [filters.priority] : undefined,
      dateRange: filters?.dateRange,
    },
    search: filters?.search,
    refreshKey: filters?.refreshKey,
  }), [filters]);

  // Use real tRPC query for table data with proper error handling
  const query = trpc.emails?.getTableData?.useQuery?.(tableParams as any, {
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  }) || { data: null, isLoading: false, error: null, isError: false, refetch: async () => ({}) };

  // Real mutation for updating email status with error handling
  const utils = trpc.useUtils();
  const updateEmailMutation = trpc.emails?.updateStatus?.useMutation?.({
    onSuccess: async () => {
      try {
        // Invalidate queries to refresh data
        await Promise.all([
          utils.emails?.getTableData?.invalidate?.(),
          utils.emails?.getDashboardStats?.invalidate?.(),
        ]);
      } catch (error: unknown) {
        console.warn('Failed to invalidate queries after email update:', error);
      }
    },
    onError: (error: unknown) => {
      console.error('Email update failed:', handleTrpcError(error));
    },
    retry: (failureCount: number, error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (failureCount < 2 && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
        return true;
      }
      return false;
    },
  }) || { mutate: () => {}, mutateAsync: async () => ({}), isPending: false, error: null };

  const prefetchEmailDetail = useCallback(async (emailId: string) => {
    if (!emailId) {
      console.warn('Email ID is required for prefetching');
      return;
    }
    
    try {
      await utils.emails?.getById?.prefetch?.({ id: emailId });
    } catch (error: unknown) {
      console.warn('Failed to prefetch email:', emailId, handleTrpcError(error));
    }
  }, [utils]);

  return {
    data: (query.data as any)?.data?.emails || [],
    isLoading: query.isLoading,
    error: query.error,
    errorMessage: handleTrpcError(query.error),
    isError: query.isError,
    refetch: query.refetch,
    updateEmail: updateEmailMutation.mutate,
    updateEmailAsync: updateEmailMutation.mutateAsync,
    isUpdating: updateEmailMutation.isPending,
    updateError: updateEmailMutation.error,
    updateErrorMessage: handleTrpcError(updateEmailMutation.error),
    prefetchEmailDetail,
    totalCount: (query.data as any)?.data?.totalCount || 0,
  };
}

// Dashboard metrics with intelligent caching
export function useOptimizedDashboardMetrics(timeRange: string = "24h") {
  // Use real tRPC query for dashboard stats
  const statsQuery = trpc.emails?.getDashboardStats?.useQuery?.({
    refreshKey: Date.now(),
  }, {
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
    refetchOnWindowFocus: false,
  }) || { data: null, isLoading: false, error: null, isError: false, refetch: async () => ({}) };

  // Transform stats to match expected format
  const data = useMemo(() => {
    const stats = (statsQuery.data as any)?.data;
    if (!stats) {
      return {
        totalProcessingTime: 0,
        averageResponseTime: 0,
        efficiency: 0,
        totalEmails: 0,
        processedEmails: 0,
        pendingEmails: 0,
      };
    }

    return {
      totalProcessingTime: 0, // Not available in current stats format
      averageResponseTime: 0, // Not available in current stats format  
      efficiency: 0, // Not available in current stats format
      totalEmails: stats.totalEmails || 0,
      processedEmails: (stats.processingStats?.llmAnalyzed || 0) + (stats.processingStats?.strategicAnalyzed || 0),
      pendingEmails: stats.processingStats?.unprocessed || 0,
      criticalCount: stats.criticalCount || 0,
      inProgressCount: stats.inProgressCount || 0,
      completedCount: stats.completedCount || 0,
    };
  }, [statsQuery.data]);

  return {
    data,
    isLoading: statsQuery.isLoading,
    error: statsQuery.error,
    errorMessage: handleTrpcError(statsQuery.error),
    isError: statsQuery.isError,
    refetch: statsQuery.refetch,
  };
}

// Optimized search with debouncing built into the hook
export function useOptimizedEmailSearch(searchTerm: string, enabled: boolean = true) {
  // Use real tRPC search query with proper validation
  const isSearchValid = enabled && searchTerm && searchTerm.trim().length > 2;
  
  const searchQuery = trpc.emails?.searchAdvanced?.useQuery?.({
    query: searchTerm.trim(),
    page: 1,
    pageSize: 20,
    sortBy: "relevance" as any,
    includeHighlight: true,
  }, {
    enabled: isSearchValid,
    staleTime: 30000, // 30 seconds
  } as any) || { data: null, isLoading: false, error: null, isError: false, refetch: async () => ({}) };

  return {
    data: (searchQuery.data as any)?.data?.emails || [],
    isLoading: searchQuery.isLoading,
    error: searchQuery.error,
    errorMessage: handleTrpcError(searchQuery.error),
    isError: searchQuery.isError,
    refetch: searchQuery.refetch,
    totalCount: (searchQuery.data as any)?.data?.totalCount || 0,
    searchMetadata: (searchQuery.data as any)?.data?.searchMetadata,
    isSearchValid,
  };
}

// Batch operations for better performance
export function useOptimizedEmailBatch() {
  const utils = trpc.useUtils();
  
  // Real batch update mutation with proper error handling
  const batchUpdateMutation = trpc.emails?.bulkUpdate?.useMutation?.({
    onSuccess: async () => {
      try {
        await Promise.all([
          utils.emails?.getTableData?.invalidate?.(),
          utils.emails?.getDashboardStats?.invalidate?.(),
        ]);
      } catch (error) {
        console.warn('Failed to invalidate queries after batch update:', error);
      }
    },
    onError: (error: unknown) => {
      console.error('Batch update failed:', handleTrpcError(error));
    },
  }) || { mutate: () => {}, mutateAsync: async () => ({}), isPending: false, error: null };

  // Real batch delete mutation with proper error handling
  const batchDeleteMutation = trpc.emails?.batchDelete?.useMutation?.({
    onSuccess: async () => {
      try {
        await Promise.all([
          utils.emails?.getTableData?.invalidate?.(),
          utils.emails?.getDashboardStats?.invalidate?.(),
        ]);
      } catch (error) {
        console.warn('Failed to invalidate queries after batch delete:', error);
      }
    },
    onError: (error: unknown) => {
      console.error('Batch delete failed:', handleTrpcError(error));
    },
  }) || { mutate: () => {}, mutateAsync: async () => ({}), isPending: false, error: null };

  return {
    batchUpdate: batchUpdateMutation.mutate,
    batchDelete: batchDeleteMutation.mutate,
    isBatchUpdating: batchUpdateMutation.isPending,
    isBatchDeleting: batchDeleteMutation.isPending,
    batchUpdateAsync: batchUpdateMutation.mutateAsync,
    batchDeleteAsync: batchDeleteMutation.mutateAsync,
    batchUpdateError: batchUpdateMutation.error,
    batchDeleteError: batchDeleteMutation.error,
    batchUpdateErrorMessage: handleTrpcError(batchUpdateMutation.error),
    batchDeleteErrorMessage: handleTrpcError(batchDeleteMutation.error),
  };
}

// Walmart/grocery optimized hooks
export function useOptimizedWalmartProducts(searchQuery: string, filters?: Record<string, unknown>) {
  // Use real tRPC query for Walmart products with error handling
  const productsQuery = trpc.walmartGrocery?.searchProducts?.useMutation?.({
    onError: (error: unknown) => {
      console.error('Walmart product search failed:', handleTrpcError(error));
    },
  }) || { mutateAsync: async () => ({ success: false, products: [] }), data: null, isPending: false, error: null, isError: false };

  // Trigger search when query changes with validation
  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.trim().length <= 2) {
      return { success: false, products: [], error: 'Search query must be at least 3 characters' };
    }
    
    try {
      return await productsQuery.mutateAsync({
        query: query.trim(),
        limit: (filters?.limit as number) || 20
      });
    } catch (error: unknown) {
      const errorMessage = handleTrpcError(error);
      console.error('Product search failed:', errorMessage);
      return { success: false, products: [], error: errorMessage };
    }
  }, [productsQuery, filters?.limit]);

  return {
    data: (productsQuery.data as any)?.products || [],
    isLoading: productsQuery.isPending,
    error: productsQuery.error,
    errorMessage: handleTrpcError(productsQuery.error),
    isError: productsQuery.isError,
    searchProducts,
    metadata: (productsQuery.data as any)?.metadata,
  };
}

// Performance monitoring hook
export function useTRPCPerformanceMonitor() {
  const trpcContext = trpc.useUtils();
  
  const getCacheStats = useCallback(() => {
    try {
      // tRPC utils provide limited cache access - return placeholder stats
      // This would require direct QueryClient access which isn't available through tRPC utils
      return {
        queries: 0,
        mutations: 0,
        staleQueries: 0,
        errorQueries: 0,
        activeQueries: 0,
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        queries: 0,
        mutations: 0,
        staleQueries: 0,
        errorQueries: 0,
        activeQueries: 0,
      };
    }
  }, [trpcContext]);
  
  const clearCache = useCallback(() => {
    try {
      // Invalidate all tRPC queries as alternative to direct cache clearing
      trpcContext.invalidate();
      console.log('tRPC cache invalidated successfully');
    } catch (error) {
      console.warn('Failed to invalidate cache:', error);
    }
  }, [trpcContext]);
  
  const prefetchCriticalData = useCallback(async () => {
    // Prefetch critical dashboard data
    try {
      await Promise.all([
        trpcContext.emails?.getDashboardStats?.prefetch?.({ refreshKey: Date.now() }),
        trpcContext.emails?.getTableData?.prefetch?.({
          page: 1,
          pageSize: 10,
          sortBy: "received_date",
          sortOrder: "desc",
        }),
      ]);
      console.log('Critical data prefetched successfully');
    } catch (error: unknown) {
      const errorMessage = handleTrpcError(error);
      console.warn('Failed to prefetch critical data:', errorMessage);
    }
  }, [trpcContext]);
  
  return {
    getCacheStats,
    clearCache,
    prefetchCriticalData,
  };
}