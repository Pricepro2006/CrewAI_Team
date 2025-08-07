import { useMemo, useCallback } from "react";
import { trpc } from "../lib/api";
import { queryKeys, cacheUtils } from "../lib/queryClient";
import type { EmailRecord } from "../../types/email-dashboard.interfaces";

// Optimized email hooks with proper caching and invalidation
export function useOptimizedEmails(filters?: Record<string, any>) {
  const queryKey = useMemo(() => queryKeys.emails.list(filters || {}), [filters]);
  
  const query = trpc.emails.getAll.useQuery(filters, {
    queryKey,
    staleTime: 2 * 60 * 1000, // 2 minutes for email data
    gcTime: 5 * 60 * 1000, // 5 minutes in cache
    refetchOnWindowFocus: true, // Refetch emails when window gains focus
    select: useCallback((data: EmailRecord[]) => {
      // Memoize expensive data transformations
      return data.map(email => ({
        ...email,
        // Add computed properties
        isOverdue: new Date(email.timestamp) < new Date(Date.now() - (24 * 60 * 60 * 1000)),
        isRecent: new Date(email.timestamp) > new Date(Date.now() - (60 * 60 * 1000)),
        priorityScore: email.priority === "critical" ? 3 : email.priority === "high" ? 2 : 1,
      }));
    }, []),
  });

  // Optimized mutation with cache updates
  const updateEmailMutation = trpc.emails.update.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await trpc.emails.getAll.cancel();
      
      // Snapshot the previous value
      const previousEmails = cacheUtils.getQueryData(queryKey);
      
      // Optimistically update the cache
      if (previousEmails) {
        const updatedEmails = (previousEmails as EmailRecord[]).map(email =>
          email.id === variables.id ? { ...email, ...variables.updates } : email
        );
        cacheUtils.setQueryData(queryKey, updatedEmails);
      }
      
      return { previousEmails };
    },
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      if (context?.previousEmails) {
        cacheUtils.setQueryData(queryKey, context.previousEmails);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      cacheUtils.invalidateQueries(queryKeys.emails.all);
    },
  });

  const prefetchEmailDetail = useCallback(async (emailId: string) => {
    // Prefetch email details for better UX
    await cacheUtils.prefetchQuery(
      queryKeys.emails.detail(emailId),
      () => trpc.emails.getById.query({ id: emailId })
    );
  }, []);

  return {
    ...query,
    updateEmail: updateEmailMutation.mutate,
    updateEmailAsync: updateEmailMutation.mutateAsync,
    isUpdating: updateEmailMutation.isPending,
    prefetchEmailDetail,
  };
}

// Dashboard metrics with intelligent caching
export function useOptimizedDashboardMetrics(timeRange: string = "24h") {
  const queryKey = queryKeys.dashboard.analytics(timeRange);
  
  return trpc.dashboard.getMetrics.useQuery(
    { timeRange },
    {
      queryKey,
      staleTime: 5 * 60 * 1000, // 5 minutes for dashboard data
      gcTime: 10 * 60 * 1000, // 10 minutes in cache
      refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
      refetchIntervalInBackground: false, // Don't refetch in background
      select: useCallback((data: any) => {
        // Memoize expensive calculations
        return {
          ...data,
          // Add computed metrics
          totalProcessingTime: data.metrics?.reduce((sum: number, m: any) => sum + (m.processingTime || 0), 0) || 0,
          averageResponseTime: data.metrics?.length 
            ? data.metrics.reduce((sum: number, m: any) => sum + (m.responseTime || 0), 0) / data.metrics.length 
            : 0,
          efficiency: data.completed && data.total 
            ? Math.round((data.completed / data.total) * 100) 
            : 0,
        };
      }, []),
    }
  );
}

// Optimized search with debouncing built into the hook
export function useOptimizedEmailSearch(searchTerm: string, enabled: boolean = true) {
  const queryKey = queryKeys.emails.search(searchTerm);
  
  return trpc.emails.search.useQuery(
    { query: searchTerm },
    {
      queryKey,
      enabled: enabled && searchTerm.length >= 2, // Only search if term is long enough
      staleTime: 1 * 60 * 1000, // 1 minute for search results
      gcTime: 3 * 60 * 1000, // 3 minutes in cache
      keepPreviousData: true, // Keep previous results while loading new ones
      select: useCallback((data: EmailRecord[]) => {
        // Sort search results by relevance
        return data.sort((a, b) => {
          // Prioritize exact matches in subject
          const aExactMatch = a.subject.toLowerCase().includes(searchTerm.toLowerCase());
          const bExactMatch = b.subject.toLowerCase().includes(searchTerm.toLowerCase());
          
          if (aExactMatch && !bExactMatch) return -1;
          if (!aExactMatch && bExactMatch) return 1;
          
          // Then sort by timestamp (newest first)
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
      }, [searchTerm]),
    }
  );
}

// Batch operations for better performance
export function useOptimizedEmailBatch() {
  const batchUpdateMutation = trpc.emails.batchUpdate.useMutation({
    onSuccess: () => {
      // Invalidate all email queries after batch update
      cacheUtils.invalidateQueries(queryKeys.emails.all);
    },
  });

  const batchDeleteMutation = trpc.emails.batchDelete.useMutation({
    onSuccess: () => {
      // Invalidate all email queries after batch delete
      cacheUtils.invalidateQueries(queryKeys.emails.all);
    },
  });

  return {
    batchUpdate: batchUpdateMutation.mutate,
    batchDelete: batchDeleteMutation.mutate,
    isBatchUpdating: batchUpdateMutation.isPending,
    isBatchDeleting: batchDeleteMutation.isPending,
  };
}

// Walmart/grocery optimized hooks
export function useOptimizedWalmartProducts(searchQuery: string, filters?: Record<string, any>) {
  const queryKey = queryKeys.walmart.products.search(searchQuery, filters);
  
  return trpc.walmart.searchProducts.useQuery(
    { query: searchQuery, filters },
    {
      queryKey,
      enabled: searchQuery.length >= 2,
      staleTime: 10 * 60 * 1000, // 10 minutes for product data
      gcTime: 30 * 60 * 1000, // 30 minutes in cache
      keepPreviousData: true,
      select: useCallback((data: any[]) => {
        // Add computed properties for better UX
        return data.map(product => ({
          ...product,
          // Add price comparison indicators
          isOnSale: product.price?.regular && product.price?.sale && product.price.sale < product.price.regular,
          discountPercentage: product.price?.regular && product.price?.sale 
            ? Math.round(((product.price.regular - product.price.sale) / product.price.regular) * 100)
            : 0,
          // Add availability indicators
          isAvailable: product.availability?.inStock !== false,
          estimatedDelivery: product.delivery?.estimatedDays || 3,
        }));
      }, []),
    }
  );
}

// Performance monitoring hook
export function useTRPCPerformanceMonitor() {
  const utils = trpc.useUtils();
  
  const getCacheStats = useCallback(() => {
    return cacheUtils.getCacheStats();
  }, []);
  
  const clearCache = useCallback(() => {
    cacheUtils.clear();
  }, []);
  
  const prefetchCriticalData = useCallback(async () => {
    // Prefetch commonly accessed data
    await Promise.all([
      cacheUtils.prefetchQuery(
        queryKeys.dashboard.metrics(),
        () => utils.dashboard.getMetrics.fetch({ timeRange: "24h" })
      ),
      cacheUtils.prefetchQuery(
        queryKeys.emails.lists(),
        () => utils.emails.getAll.fetch({})
      ),
    ]);
  }, [utils]);
  
  return {
    getCacheStats,
    clearCache,
    prefetchCriticalData,
  };
}