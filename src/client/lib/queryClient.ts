import { QueryClient } from "@tanstack/react-query";

// Create a singleton query client with optimized configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Retry with exponential backoff
      retryDelay: (attemptIndex: any) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus by default (can be overridden per query)
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data is fresh
      refetchOnMount: true,
      // Don't refetch on reconnect if data is fresh
      refetchOnReconnect: "always",
      // Network mode for offline support
      networkMode: "online",
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      // Network mode for offline support
      networkMode: "online",
    },
  },
});

// Performance monitoring for queries
export const queryMetrics = {
  slowQueries: new Map<string, number>(),
  failedQueries: new Map<string, number>(),
  
  trackSlowQuery: (queryKey: string, duration: number) => {
    if (duration > 2000) { // Track queries slower than 2 seconds
      queryMetrics?.slowQueries?.set(queryKey, duration);
      console.warn(`🐌 Slow query detected: ${queryKey} took ${duration}ms`);
    }
  },
  
  trackFailedQuery: (queryKey: string, error: any) => {
    const count = queryMetrics?.failedQueries?.get(queryKey) || 0;
    queryMetrics?.failedQueries?.set(queryKey, count + 1);
    console.error(`❌ Query failed: ${queryKey}`, error);
  },
  
  getSlowQueries: () => Array.from(queryMetrics?.slowQueries?.entries()),
  getFailedQueries: () => Array.from(queryMetrics?.failedQueries?.entries()),
  
  reset: () => {
    queryMetrics?.slowQueries?.clear();
    queryMetrics?.failedQueries?.clear();
  }
};

// Add global error handling and performance monitoring
queryClient.getQueryCache().subscribe((event: any) => {
  if (event.type === "observerResultsUpdated") {
    const query = event?.query;
    const queryKey = JSON.stringify(query.queryKey);
    
    // Track query performance
    if (query?.state?.fetchStatus === "idle" && query?.state?.dataUpdateCount > 0) {
      const duration = Date.now() - (query?.state?.dataUpdatedAt || 0);
      if (duration > 0) {
        queryMetrics.trackSlowQuery(queryKey, duration);
      }
    }
    
    // Track query errors
    if (query?.state?.error) {
      queryMetrics.trackFailedQuery(queryKey, query?.state?.error);
    }
  }
});

// Query key factories for consistent cache keys
export const queryKeys = {
  // Email queries
  emails: {
    all: ["emails"] as const,
    lists: () => ["emails", "list"] as const,
    list: (filters: Record<string, any>) => ["emails", "list", filters] as const,
    details: () => ["emails", "detail"] as const,
    detail: (id: string) => ["emails", "detail", id] as const,
    search: (query: string) => ["emails", "search", query] as const,
  },
  
  // Dashboard queries
  dashboard: {
    all: ["dashboard"] as const,
    metrics: () => ["dashboard", "metrics"] as const,
    analytics: (timeRange: string) => ["dashboard", "analytics", timeRange] as const,
  },
  
  // User queries
  user: {
    all: ["user"] as const,
    profile: () => ["user", "profile"] as const,
    preferences: () => ["user", "preferences"] as const,
    settings: () => ["user", "settings"] as const,
  },
  
  // Walmart/grocery queries
  walmart: {
    all: ["walmart"] as const,
    products: {
      all: ["walmart", "products"] as const,
      search: (query: string, filters?: Record<string, any>) => 
        ["walmart", "products", "search", query, filters] as const,
      details: (id: string) => ["walmart", "products", "detail", id] as const,
      recommendations: (userId: string) => 
        ["walmart", "products", "recommendations", userId] as const,
    },
    orders: {
      all: ["walmart", "orders"] as const,
      list: (userId: string) => ["walmart", "orders", "list", userId] as const,
      detail: (orderId: string) => ["walmart", "orders", "detail", orderId] as const,
    },
  },
} as const;

// Helper functions for cache management
export const cacheUtils = {
  // Invalidate all queries matching a pattern
  invalidateQueries: (queryKey: readonly unknown[]) => {
    return queryClient.invalidateQueries({ queryKey });
  },
  
  // Prefetch query for better UX
  prefetchQuery: async <T>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    options?: { staleTime?: number }
  ) => {
    return queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: options?.staleTime || 5 * 60 * 1000,
    });
  },
  
  // Set query data optimistically
  setQueryData: <T>(queryKey: readonly unknown[], data: T) => {
    queryClient.setQueryData(queryKey, data);
  },
  
  // Get cached query data
  getQueryData: <T>(queryKey: readonly unknown[]): T | undefined => {
    return queryClient.getQueryData(queryKey);
  },
  
  // Remove query from cache
  removeQueries: (queryKey: readonly unknown[]) => {
    queryClient.removeQueries({ queryKey });
  },
  
  // Clear all cache
  clear: () => {
    queryClient.clear();
  },
  
  // Get cache statistics
  getCacheStats: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    return {
      totalQueries: queries?.length || 0,
      activeQueries: queries?.filter(q => q.getObserversCount() > 0).length,
      staleQueries: queries?.filter(q => q.isStale()).length,
      errorQueries: queries?.filter(q => q?.state?.error).length,
      cacheSize: queries.reduce((size: any, query: any) => {
        const dataSize = JSON.stringify(query?.state?.data || {}).length;
        return size + dataSize;
      }, 0),
    };
  },
};