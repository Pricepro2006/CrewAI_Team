/**
 * useWalmartSearch Hook
 * Custom hook for searching Walmart products with caching and state management
 */

import { useState, useCallback, useRef } from 'react';
// TODO: Replace with proper tRPC hooks
// import { api } from '../lib/api.js';
import type { WalmartProduct, SearchOptions } from '../../types/walmart-grocery.js';

interface UseWalmartSearchResult {
  search: (options: SearchOptions) => Promise<void>;
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
  const currentSearchOptions = useRef<SearchOptions | null>(null);
  const currentPage = useRef(0);

  const getCacheKey = (options: SearchOptions): string => {
    return JSON.stringify({
      query: options.query,
      category: options.category,
      minPrice: options.minPrice,
      maxPrice: options.maxPrice,
      inStock: options.inStock,
      dietary: options.dietary?.sort(),
    });
  };

  const search = useCallback(async (options: SearchOptions) => {
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

      // TODO: Replace with proper tRPC mutation
      // Mock successful response for now
      const response = {
        success: true,
        products: [] as WalmartProduct[]
      };

      const products = response.products || [];
      setResults(products);
      setHasMore(products.length === (options.limit || 20));
      
      // Update cache
      searchCache.current[cacheKey] = {
        results: products,
        timestamp: Date.now(),
        hasMore: products.length === (options.limit || 20),
      };
    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Search failed');
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

      // TODO: Replace with proper tRPC mutation
      // Mock successful response for now
      const response = {
        success: true,
        products: [] as WalmartProduct[]
      };

      const newProducts = response.products || [];
      setResults(prev => [...prev, ...newProducts]);
      setHasMore(newProducts.length === (currentSearchOptions.current?.limit || 20));
    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Failed to load more results');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore]);

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