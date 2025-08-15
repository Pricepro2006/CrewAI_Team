import { useState, useCallback } from 'react';
import { WALMART_CATEGORIES, isInCategory, FILTER_DISPLAY_NAMES } from '../constants/walmart-categories';

export interface WalmartProduct {
  id: string;
  name: string;
  category_path?: string;
  department?: string;
  current_price: number;
  regular_price?: number;
}

export const useWalmartFilters = () => {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['All Categories']));

  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      
      if (filter === 'All Categories') {
        // Clear all and set only 'All Categories'
        return new Set(['All Categories']);
      }
      
      // Remove 'All Categories' if selecting specific filter
      newFilters.delete('All Categories');
      
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
        // If no filters left, default to 'All Categories'
        if (newFilters.size === 0) {
          newFilters.add('All Categories');
        }
      } else {
        newFilters.add(filter);
      }
      
      return newFilters;
    });
  }, []);

  const applyFiltersToResults = useCallback((
    results: WalmartProduct[], 
    filters: Set<string> = activeFilters
  ): WalmartProduct[] => {
    if (filters.has('All Categories')) {
      return results;
    }

    return results?.filter(product => {
      // Check each active filter
      for (const filter of filters) {
        if (filter === 'On Sale') {
          // Special case for On Sale - check if current price is less than regular price
          if (product.regular_price && product.current_price < product.regular_price) {
            return true;
          }
        } else {
          // Category-based filtering
          const categoryPath = product.category_path || product.department || '';
          const internalKey = FILTER_DISPLAY_NAMES[filter];
          if (internalKey && isInCategory(categoryPath, internalKey)) {
            return true;
          }
        }
      }
      return false;
    });
  }, [activeFilters]);

  const getFilterParams = useCallback((): { categories?: string[]; onSale?: boolean } => {
    if (activeFilters.has('All Categories')) {
      return {};
    }

    const params: { categories?: string[]; onSale?: boolean } = {};
    const categories: string[] = [];

    activeFilters.forEach(filter => {
      if (filter === 'On Sale') {
        params.onSale = true;
      } else if (filter !== 'All Categories') {
        // Convert display name to internal category key
        const internalKey = FILTER_DISPLAY_NAMES[filter];
        if (internalKey && internalKey !== 'All Categories') {
          categories.push(internalKey);
        }
      }
    });

    if (categories?.length || 0 > 0) {
      params.categories = categories;
    }

    return params;
  }, [activeFilters]);

  return {
    activeFilters,
    toggleFilter,
    applyFiltersToResults,
    getFilterParams
  };
};