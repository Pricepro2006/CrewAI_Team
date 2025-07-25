/**
 * React hooks for Walmart product operations
 */

import { useState, useCallback } from "react";
import { trpc } from "../../utils/trpc";
import type { WalmartProduct } from "../../types/walmart-grocery";

// Hook for searching products
export function useWalmartProductSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    products: WalmartProduct[];
    total: number;
  }>({ products: [], total: 0 });

  const searchProducts = trpc.walmartGrocery.searchProducts.useMutation({
    onSuccess: (data) => {
      setSearchResults({
        products: data.products || [],
        total: data.metadata?.totalResults || 0
      });
    }
  });

  const search = useCallback(async (params: {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    limit?: number;
  }) => {
    setIsSearching(true);
    try {
      await searchProducts.mutateAsync({
        query: params.query,
        category: params.category,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        inStock: params.inStock,
        storeId: undefined,
        limit: params.limit || 20
      });
    } finally {
      setIsSearching(false);
    }
  }, [searchProducts]);

  return {
    search,
    searchResults,
    isSearching,
    error: searchProducts.error
  };
}

// Hook for getting product details
export function useWalmartProduct(productId: string) {
  return trpc.walmartGrocery.getProductDetails.useQuery(
    {
      productId,
      includeReviews: false,
      includeAvailability: true
    },
    {
      enabled: !!productId
    }
  );
}

// Hook for product recommendations
export function useWalmartRecommendations(params: {
  userId?: string;
  category?: string;
  budget?: number;
}) {
  return trpc.walmartGrocery.getRecommendations.useQuery({
    userId: params.userId || "default",
    category: params.category,
    budget: params.budget,
    dietaryRestrictions: undefined
  });
}

// Hook for analyzing deals
export function useWalmartDealAnalysis() {
  return trpc.walmartGrocery.analyzeDeal.useMutation();
}

// Hook for scraping product data
export function useWalmartProductScraper() {
  return trpc.walmartGrocery.scrapeData.useMutation();
}
