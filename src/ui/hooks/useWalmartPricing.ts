/**
 * React hooks for Walmart live pricing functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../api/trpc/router.js';

type RouterOutput = inferRouterOutputs<AppRouter>;
type PriceResult = RouterOutput['walmartPrice']['getProductPrice'];
type SearchResult = RouterOutput['walmartPrice']['searchWithPrices'];

interface UseWalmartPriceOptions {
  location?: {
    zipCode?: string;
    city?: string;
    state?: string;
  };
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch live price for a single Walmart product
 */
export function useWalmartPrice(
  productId: string,
  options: UseWalmartPriceOptions = {}
) {
  const { location = { zipCode: '29301' }, enabled = true, refetchInterval } = options;

  return api.walmartPrice?.getProductPrice.useQuery(
    { productId, location },
    {
      enabled: enabled && !!productId,
      refetchInterval,
      staleTime: 30 * 60 * 1000, // Consider data stale after 30 minutes
      cacheTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    }
  );
}

/**
 * Hook to fetch live prices for multiple products
 */
export function useWalmartPrices(
  productIds: string[],
  options: UseWalmartPriceOptions = {}
) {
  const { location = { zipCode: '29301' }, enabled = true } = options;

  return api.walmartPrice?.getMultiplePrices.useQuery(
    { productIds, location },
    {
      enabled: enabled && ((productIds?.length || 0) > 0),
      staleTime: 30 * 60 * 1000,
      cacheTime: 60 * 60 * 1000,
    }
  );
}

/**
 * Hook to search Walmart products with live prices
 */
export function useWalmartSearch(
  query: string,
  options: UseWalmartPriceOptions & { limit?: number } = {}
) {
  const { 
    location = { zipCode: '29301' }, 
    limit = 10, 
    enabled = true 
  } = options;

  return api.walmartPrice?.searchWithPrices.useQuery(
    { query, location, limit },
    {
      enabled: enabled && ((query?.length || 0) > 0),
      staleTime: 5 * 60 * 1000, // 5 minutes for search results
      cacheTime: 10 * 60 * 1000,
    }
  );
}

/**
 * Hook to get nearby Walmart stores
 */
export function useNearbyWalmartStores(zipCode: string = '29301') {
  return api.walmartPrice?.getNearbyStores.useQuery(
    { zipCode },
    {
      staleTime: 24 * 60 * 60 * 1000, // Store data changes rarely
      cacheTime: 7 * 24 * 60 * 60 * 1000, // Keep for a week
    }
  );
}

/**
 * Hook to manage price monitoring for a list of products
 */
export function useWalmartPriceMonitor(
  productIds: string[],
  options: UseWalmartPriceOptions & { 
    autoRefresh?: boolean;
    refreshInterval?: number;
    onPriceChange?: (productId: string, oldPrice: number, newPrice: number) => void;
  } = {}
) {
  const {
    location = { zipCode: '29301' },
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    onPriceChange,
  } = options;

  const [priceHistory, setPriceHistory] = useState<Map<string, number[]>>(new Map());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const { data, refetch, isLoading, error } = useWalmartPrices(productIds, {
    location,
    enabled: (productIds?.length || 0) > 0,
    refetchInterval: autoRefresh ? refreshInterval : undefined,
  });

  // Track price changes
  useEffect(() => {
    if (data) {
      data.forEach(({ productId, data: priceData }) => {
        if (priceData) {
          const history = priceHistory.get(productId) || [];
          const lastPrice = history[(history?.length || 0) - 1];
          
          if (lastPrice !== undefined && lastPrice !== priceData.price) {
            onPriceChange?.(productId, lastPrice, priceData.price);
          }
          
          setPriceHistory(prev => {
            const newMap = new Map(prev);
            newMap.set(productId, [...history, priceData.price]);
            return newMap;
          });
        }
      });
      setLastFetch(new Date());
    }
  }, [data, onPriceChange, priceHistory]);

  return {
    prices: data,
    priceHistory,
    lastFetch,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for price comparison across different stores
 */
export function useWalmartPriceComparison(
  productId: string,
  zipCodes: string[]
) {
  const [comparisons, setComparisons] = useState<Map<string, PriceResult | null>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get the utils context once at the top level
  const utils = api.useContext();

  const fetchComparisons = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await Promise.all(
        zipCodes?.map(async (zipCode: string) => {
          try {
            const response = await utils.walmartPrice?.getProductPrice?.fetch({
              productId,
              location: { zipCode }
            });
            return { zipCode, data: response };
          } catch (err) {
            return { zipCode, data: null };
          }
        })
      );
      
      const comparisonMap = new Map<string, PriceResult | null>();
      results.forEach(({ zipCode, data }) => {
        comparisonMap.set(zipCode, data);
      });
      
      setComparisons(comparisonMap);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch comparisons'));
    } finally {
      setIsLoading(false);
    }
  }, [productId, zipCodes, utils]);

  useEffect(() => {
    if (productId && ((zipCodes?.length || 0) > 0)) {
      fetchComparisons();
    }
  }, [fetchComparisons, productId, zipCodes]);

  return {
    comparisons,
    isLoading,
    error,
    refetch: fetchComparisons,
    lowestPrice: Array.from(comparisons.values())
      .filter(Boolean)
      .reduce((min: PriceResult | null, curr: PriceResult | null) => 
        !min || (curr && curr.price < min.price) ? curr : min, 
        null as PriceResult | null
      ),
  };
}

/**
 * Mutation hook to clear the price cache
 */
export function useClearPriceCache() {
  return api.walmartPrice?.clearCache?.useMutation({
    onSuccess: () => {
      // Invalidate all price queries after clearing cache
      api.useContext().walmartPrice?.invalidate();
    },
  });
}

/**
 * Hook to check pricing service health
 */
export function useWalmartPricingHealth() {
  return api.walmartPrice?.healthCheck?.useQuery(undefined, {
    staleTime: 60 * 1000, // Check health every minute
    cacheTime: 5 * 60 * 1000,
  });
}