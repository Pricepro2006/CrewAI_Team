import { useMemo, useCallback } from "react";
import { trpc, handleTrpcError } from "../lib/api.js";
import type { EmailRecord } from "../../types/email-dashboard?.interfaces.js";

// Real tRPC implementations with proper caching and invalidation
export function useOptimizedEmails(filters?: Record<string, any>) {
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
  const query = trpc.emails.getTableData.useQuery(tableParams, {
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes (renamed from cacheTime)
    retry: (failureCount, error) => {
      // Only retry for network errors
      if (failureCount < 3 && (!error?.data?.code || error.message?.includes('fetch'))) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });

  // Real mutation for updating email status with error handling
  const utils = trpc.useUtils();
  const updateEmailMutation = trpc.emails.updateStatus.useMutation({
    onSuccess: async () => {
      try {
        // Invalidate queries to refresh data
        await Promise.all([
          utils.emails.getTableData.invalidate(),
          utils.emails.getDashboardStats.invalidate(),
        ]);
      } catch (error) {
        console.warn('Failed to invalidate queries after email update:', error);
      }
    },
    onError: (error) => {
      console.error('Email update failed:', handleTrpcError(error));
    },
    retry: (failureCount, error) => {
      if (failureCount < 2 && (!error?.data?.code || error.message?.includes('fetch'))) {
        return true;
      }
      return false;
    },
  });

  const prefetchEmailDetail = useCallback(async (emailId: string) => {
    if (!emailId) {
      console.warn('Email ID is required for prefetching');
      return;
    }
    
    try {
      await utils.emails.getById.prefetch({ id: emailId });
    } catch (error) {
      console.warn('Failed to prefetch email:', emailId, handleTrpcError(error));
    }
  }, [utils]);

  return {
    data: query.data?.data?.emails || [],
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
    totalCount: query.data?.data?.totalCount || 0,
  };
}

// Dashboard metrics with intelligent caching
export function useOptimizedDashboardMetrics(timeRange: string = "24h") {
  // Use real tRPC query for dashboard stats
  const statsQuery = trpc.emails.getDashboardStats.useQuery({
    refreshKey: Date.now(),
  }, {
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes (renamed from cacheTime)
    refetchInterval: 120000, // 2 minutes
    retry: (failureCount, error) => {
      if (failureCount < 3 && (!error?.data?.code || error.message?.includes('fetch'))) {
        return true;
      }
      return false;
    },
    refetchOnWindowFocus: false,
  });

  // Transform stats to match expected format
  const data = useMemo(() => {
    const stats = statsQuery.data?.data;
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
      totalProcessingTime: stats.totalProcessingTime || 0,
      averageResponseTime: stats.averageResponseTime || 0,
      efficiency: stats.efficiency || 0,
      totalEmails: stats.totalEmails || 0,
      processedEmails: stats.processedEmails || 0,
      pendingEmails: stats.pendingEmails || 0,
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
  
  const searchQuery = trpc.emails.searchAdvanced.useQuery({
    query: searchTerm.trim(),
    page: 1,
    pageSize: 20,
    sortBy: "relevance",
    includeHighlight: true,
  }, {
    enabled: isSearchValid,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes (renamed from cacheTime)
    retry: (failureCount, error) => {
      if (failureCount < 2 && (!error?.data?.code || error.message?.includes('fetch'))) {
        return true;
      }
      return false;
    },
  });

  return {
    data: searchQuery.data?.data?.emails || [],
    isLoading: searchQuery.isLoading,
    error: searchQuery.error,
    errorMessage: handleTrpcError(searchQuery.error),
    isError: searchQuery.isError,
    refetch: searchQuery.refetch,
    totalCount: searchQuery.data?.data?.totalCount || 0,
    searchMetadata: searchQuery.data?.data?.searchMetadata,
    isSearchValid,
  };
}

// Batch operations for better performance
export function useOptimizedEmailBatch() {
  const utils = trpc.useUtils();
  
  // Real batch update mutation with proper error handling
  const batchUpdateMutation = trpc.emails.bulkUpdate.useMutation({
    onSuccess: async () => {
      try {
        await Promise.all([
          utils.emails.getTableData.invalidate(),
          utils.emails.getDashboardStats.invalidate(),
        ]);
      } catch (error) {
        console.warn('Failed to invalidate queries after batch update:', error);
      }
    },
    onError: (error) => {
      console.error('Batch update failed:', handleTrpcError(error));
    },
  });

  // Real batch delete mutation with proper error handling
  const batchDeleteMutation = trpc.emails.batchDelete.useMutation({
    onSuccess: async () => {
      try {
        await Promise.all([
          utils.emails.getTableData.invalidate(),
          utils.emails.getDashboardStats.invalidate(),
        ]);
      } catch (error) {
        console.warn('Failed to invalidate queries after batch delete:', error);
      }
    },
    onError: (error) => {
      console.error('Batch delete failed:', handleTrpcError(error));
    },
  });

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
export function useOptimizedWalmartProducts(searchQuery: string, filters?: Record<string, any>) {
  // Use real tRPC query for Walmart products with error handling
  const productsQuery = trpc.walmartGrocery.searchProducts.useMutation({
    onError: (error) => {
      console.error('Walmart product search failed:', handleTrpcError(error));
    },
  });

  // Trigger search when query changes with validation
  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.trim().length <= 2) {
      return { success: false, products: [], error: 'Search query must be at least 3 characters' };
    }
    
    try {
      return await productsQuery.mutateAsync({
        query: query.trim(),
        limit: filters?.limit || 20,
      });
    } catch (error) {
      const errorMessage = handleTrpcError(error);
      console.error('Product search failed:', errorMessage);
      return { success: false, products: [], error: errorMessage };
    }
  }, [productsQuery, filters?.limit]);

  return {
    data: productsQuery.data?.products || [],
    isLoading: productsQuery.isPending,
    error: productsQuery.error,
    errorMessage: handleTrpcError(productsQuery.error),
    isError: productsQuery.isError,
    searchProducts,
    metadata: productsQuery.data?.metadata,
  };
}

// Performance monitoring hook
export function useTRPCPerformanceMonitor() {
  const trpcContext = trpc.useUtils();
  
  const getCacheStats = useCallback(() => {
    try {
      // Access query client cache stats
      const queryClient = trpcContext.client;
      const queryCache = queryClient.getQueryCache();
      const mutationCache = queryClient.getMutationCache();
      
      const queries = queryCache.getAll();
      const mutations = mutationCache.getAll();
      
      return {
        queries: queries.length,
        mutations: mutations.length,
        staleQueries: queries.filter(q => q.isStale()).length,
        errorQueries: queries.filter(q => q.state.error).length,
        activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
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
      // Clear all tRPC query cache
      trpcContext.client.clear();
      console.log('tRPC cache cleared successfully');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }, [trpcContext]);
  
  const prefetchCriticalData = useCallback(async () => {
    // Prefetch critical dashboard data
    try {
      await Promise.all([
        trpcContext.emails.getDashboardStats.prefetch({ refreshKey: Date.now() }),
        trpcContext.emails.getTableData.prefetch({
          page: 1,
          pageSize: 10,
          sortBy: "received_date",
          sortOrder: "desc",
        }),
      ]);
      console.log('Critical data prefetched successfully');
    } catch (error) {
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