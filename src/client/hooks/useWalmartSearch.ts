/**
 * useWalmartSearch Hook
 * Custom hook for searching Walmart products with caching and state management
 */

import { useState, useCallback, useRef } from 'react';
import { api } from '../lib/api.js';
import type { WalmartProduct } from '../../types/walmart-grocery.js';

// Define search options interface
interface ExtendedSearchOptions {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  dietary?: string[];
  limit?: number;
  offset?: number;
}

interface UseWalmartSearchResult {
  search: (options: ExtendedSearchOptions) => Promise<void>;
  results: WalmartProduct[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  clearResults: () => void;
}

interface SearchCache {
  [key: string]: {
    results: WalmartProduct[];
    timestamp: number;
    hasMore: boolean;
  };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useWalmartSearch = (): UseWalmartSearchResult => {
  const [results, setResults] = useState<WalmartProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  
  const searchCache = useRef<SearchCache>({});
  const currentSearchOptions = useRef<ExtendedSearchOptions | null>(null);
  const currentPage = useRef(0);

  // Set up tRPC mutation for search
  const searchMutation = api.walmartGrocery.searchProducts.useMutation({
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      setError(errorMessage);
    },
  });

  const getCacheKey = useCallback((options: ExtendedSearchOptions): string => {
    return JSON.stringify({
      query: options.query,
      category: options.category,
      minPrice: options.minPrice,
      maxPrice: options.maxPrice,
      inStock: options.inStock,
      dietary: options.dietary ? [...options.dietary].sort() : undefined,
    });
  }, [searchMutation]);

  const search = useCallback(async (options: ExtendedSearchOptions) => {
    try {
      setError(null);
      setLoading(true);
      
      // Check cache first
      const cacheKey = getCacheKey(options);
      const cached = searchCache.current[cacheKey];
      
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setResults(cached.results);
        setHasMore(cached.hasMore);
        setLoading(false);
        return;
      }

      // Store current search options
      currentSearchOptions.current = options;
      currentPage.current = 0;

      // Use real tRPC mutation for search
      
      const response = await searchMutation.mutateAsync({
        query: options.query,
        limit: options.limit || 20
      });

      const products = (response as any)?.products || [];
      setResults(products);
      setHasMore(products.length === (options.limit || 20));
      
      // Update cache
      searchCache.current[cacheKey] = {
        results: products,
        timestamp: Date.now(),
        hasMore: products.length === (options.limit || 20),
      };
    } catch (err) {
      
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!currentSearchOptions.current || loading || !hasMore) return;

    try {
      setLoading(true);
      currentPage.current += 1;

      // Use real tRPC mutation for loading more
      
      const response = await searchMutation.mutateAsync({
        query: currentSearchOptions.current.query,
        limit: currentSearchOptions.current.limit || 20
      });

      const newProducts = (response as any)?.products || [];
      setResults((prev: WalmartProduct[]) => [...prev, ...newProducts]);
      setHasMore(newProducts.length === (currentSearchOptions.current?.limit || 20));
    } catch (err) {
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more results';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, searchMutation]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setHasMore(false);
    currentSearchOptions.current = null;
    currentPage.current = 0;
  }, []);

  return {
    search,
    results,
    loading,
    error,
    hasMore,
    loadMore,
    clearResults,
  };
};