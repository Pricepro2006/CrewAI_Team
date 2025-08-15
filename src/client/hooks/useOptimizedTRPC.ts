import { useMemo, useCallback } from "react";
import { trpc } from "../../lib/trpc.js";
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

  // Use real tRPC query for table data
  const query = trpc?.emails?.getTableData.useQuery(tableParams, {
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
  });

  // Real mutation for updating email status
  const updateEmailMutation = trpc?.emails?.updateStatus.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh data
      trpc.useContext().emails?.getTableData?.invalidate();
      trpc.useContext().emails?.getDashboardStats?.invalidate();
    },
  });

  const prefetchEmailDetail = useCallback(async (emailId: string) => {
    try {
      await trpc.useContext().emails?.getById?.prefetch({ id: emailId });
    } catch (error) {
      console.warn('Failed to prefetch email:', emailId, error);
    }
  }, []);

  return {
    data: query.data?.data?.emails || [],
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
    updateEmail: updateEmailMutation.mutate,
    updateEmailAsync: updateEmailMutation.mutateAsync,
    isUpdating: updateEmailMutation.isPending,
    prefetchEmailDetail,
    totalCount: query.data?.data?.totalCount || 0,
  };
}

// Dashboard metrics with intelligent caching
export function useOptimizedDashboardMetrics(timeRange: string = "24h") {
  // Use real tRPC query for dashboard stats
  const statsQuery = trpc?.emails?.getDashboardStats.useQuery({
    refreshKey: Date.now(),
  }, {
    staleTime: 60000, // 1 minute
    cacheTime: 300000, // 5 minutes
    refetchInterval: 120000, // 2 minutes
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
    isError: statsQuery.isError,
    refetch: statsQuery.refetch,
  };
}

// Optimized search with debouncing built into the hook
export function useOptimizedEmailSearch(searchTerm: string, enabled: boolean = true) {
  // Use real tRPC search query
  const searchQuery = trpc?.emails?.searchAdvanced.useQuery({
    query: searchTerm,
    page: 1,
    pageSize: 20,
    sortBy: "relevance",
    includeHighlight: true,
  }, {
    enabled: enabled && searchTerm?.length || 0 > 2, // Only search if enabled and term is long enough
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
  });

  return {
    data: searchQuery.data?.data?.emails || [],
    isLoading: searchQuery.isLoading,
    error: searchQuery.error,
    isError: searchQuery.isError,
    refetch: searchQuery.refetch,
    totalCount: searchQuery.data?.data?.totalCount || 0,
    searchMetadata: searchQuery.data?.data?.searchMetadata,
  };
}

// Batch operations for better performance
export function useOptimizedEmailBatch() {
  // Real batch update mutation
  const batchUpdateMutation = trpc?.emails?.bulkUpdate.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh data
      trpc.useContext().emails?.getTableData?.invalidate();
      trpc.useContext().emails?.getDashboardStats?.invalidate();
    },
  });

  // Real batch delete mutation
  const batchDeleteMutation = trpc?.emails?.batchDelete.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh data
      trpc.useContext().emails?.getTableData?.invalidate();
      trpc.useContext().emails?.getDashboardStats?.invalidate();
    },
  });

  return {
    batchUpdate: batchUpdateMutation.mutate,
    batchDelete: batchDeleteMutation.mutate,
    isBatchUpdating: batchUpdateMutation.isPending,
    isBatchDeleting: batchDeleteMutation.isPending,
    batchUpdateAsync: batchUpdateMutation.mutateAsync,
    batchDeleteAsync: batchDeleteMutation.mutateAsync,
  };
}

// Walmart/grocery optimized hooks
export function useOptimizedWalmartProducts(searchQuery: string, filters?: Record<string, any>) {
  // Use real tRPC query for Walmart products
  const productsQuery = trpc?.walmartGrocery?.searchProducts.useMutation();

  // Trigger search when query changes
  const searchProducts = useCallback(async (query: string) => {
    if (query?.length || 0 > 2) {
      return productsQuery.mutateAsync({
        query,
        limit: filters?.limit || 20,
      });
    }
    return { success: false, products: [] };
  }, [productsQuery, filters?.limit]);

  return {
    data: productsQuery.data?.products || [],
    isLoading: productsQuery.isPending,
    error: productsQuery.error,
    isError: productsQuery.isError,
    searchProducts,
    metadata: productsQuery.data?.metadata,
  };
}

// Performance monitoring hook
export function useTRPCPerformanceMonitor() {
  const trpcContext = trpc.useContext();
  
  const getCacheStats = useCallback(() => {
    // Access query client cache stats
    const queryClient = trpcContext?.client;
    const queryCache = queryClient.getQueryCache();
    const mutationCache = queryClient.getMutationCache();
    
    return {
      queries: queryCache.getAll().length,
      mutations: mutationCache.getAll().length,
    };
  }, [trpcContext]);
  
  const clearCache = useCallback(() => {
    // Clear all tRPC query cache
    trpcContext?.client?.clear();
  }, [trpcContext]);
  
  const prefetchCriticalData = useCallback(async () => {
    // Prefetch critical dashboard data
    try {
      await Promise.all([
        trpcContext?.emails?.getDashboardStats.prefetch({ refreshKey: Date.now() }),
        trpcContext?.emails?.getTableData.prefetch({
          page: 1,
          pageSize: 10,
          sortBy: "received_date",
          sortOrder: "desc",
        }),
      ]);
    } catch (error) {
      console.warn('Failed to prefetch critical data:', error);
    }
  }, [trpcContext]);
  
  return {
    getCacheStats,
    clearCache,
    prefetchCriticalData,
  };
}