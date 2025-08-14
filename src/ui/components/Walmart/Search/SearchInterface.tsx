/**
 * Enhanced Search Interface Component
 * Advanced product search with filtering, sorting, and real-time updates
 * Integrates with both traditional search and NLP processing
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  SortDesc, 
  Grid, 
  List, 
  X, 
  Loader,
  AlertCircle,
  TrendingUp,
  Clock,
  Star
} from 'lucide-react';
import { SearchQuery, SearchResult, SearchFilters, WalmartProduct } from '../types/WalmartTypes';
import { api } from '../../../utils/trpc';
import { VirtualizedProductList } from '../Virtualized/VirtualizedProductList';
import { SearchFilters as SearchFiltersComponent } from './SearchFilters';
import './Search.css';

interface SearchInterfaceProps {
  onSearchResult?: (result: SearchResult) => void;
  onProductSelect?: (product: WalmartProduct) => void;
  initialQuery?: string;
  initialFilters?: SearchFilters;
  showFilters?: boolean;
  showSorting?: boolean;
  viewMode?: 'grid' | 'list';
  className?: string;
}

type SortOption = {
  value: string;
  label: string;
  field: keyof WalmartProduct;
  order: 'asc' | 'desc';
};

const SORT_OPTIONS: SortOption[] = [
  { value: 'relevance', label: 'Relevance', field: 'name', order: 'desc' },
  { value: 'price_low', label: 'Price: Low to High', field: 'price', order: 'asc' },
  { value: 'price_high', label: 'Price: High to Low', field: 'price', order: 'desc' },
  { value: 'name_az', label: 'Name: A to Z', field: 'name', order: 'asc' },
  { value: 'name_za', label: 'Name: Z to A', field: 'name', order: 'desc' },
  { value: 'savings_high', label: 'Highest Savings', field: 'savings', order: 'desc' }
];

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onSearchResult,
  onProductSelect,
  initialQuery = '',
  initialFilters = {},
  showFilters = true,
  showSorting = true,
  viewMode: initialViewMode = 'grid',
  className = ''
}) => {
  // State management
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Search mutation
  const searchMutation = api.walmartGrocery.searchProducts.useMutation({
    onSuccess: (result) => {
      const searchResult: SearchResult = {
        query,
        totalResults: result.metadata?.totalResults || result.products?.length || 0,
        products: result.products || [],
        filters,
        timestamp: new Date(),
        suggestions: result.suggestions,
        metadata: result.metadata
      };
      
      setSearchResults(searchResult);
      setIsSearching(false);
      setError(null);
      onSearchResult?.(searchResult);
    },
    onError: (error) => {
      setError(error.message || 'Search failed');
      setIsSearching(false);
      setSearchResults(null);
    }
  });
  
  // Quick search for autocomplete
  const quickSearchMutation = api.walmartGrocery.quickSearch.useMutation();
  
  // Debounced search function
  const debouncedSearch = useCallback((searchQuery: string, searchFilters: SearchFilters) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery, searchFilters);
      } else {
        setSearchResults(null);
      }
    }, 300);
  }, []);
  
  // Main search function
  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    setIsSearching(true);
    setError(null);
    setCurrentPage(1);
    
    const sortOption = SORT_OPTIONS.find(opt => opt.value === sortBy);
    
    const searchParams: SearchQuery = {
      query: searchQuery.trim(),
      filters: searchFilters,
      sortBy: sortOption?.field || 'name',
      sortOrder: sortOption?.order || 'desc',
      limit: itemsPerPage,
      offset: 0
    };
    
    try {
      await searchMutation.mutateAsync(searchParams);
    } catch (error) {
      // Error handled in mutation's onError
    }
  }, [searchMutation, sortBy, itemsPerPage]);
  
  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    debouncedSearch(newQuery, filters);
  }, [filters, debouncedSearch]);
  
  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (query.trim()) {
      debouncedSearch(query, newFilters);
    }
  }, [query, debouncedSearch]);
  
  // Handle sort changes
  const handleSortChange = useCallback((newSortBy: string) => {
    setSortBy(newSortBy);
    if (query.trim()) {
      performSearch(query, filters);
    }
  }, [query, filters, performSearch]);
  
  // Handle pagination
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    
    if (searchResults) {
      const sortOption = SORT_OPTIONS.find(opt => opt.value === sortBy);
      const searchParams: SearchQuery = {
        query,
        filters,
        sortBy: sortOption?.field || 'name',
        sortOrder: sortOption?.order || 'desc',
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage
      };
      
      searchMutation.mutate(searchParams);
    }
  }, [searchResults, sortBy, query, filters, itemsPerPage, searchMutation]);
  
  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setSearchResults(null);
    setError(null);
    setCurrentPage(1);
    searchInputRef.current?.focus();
  }, []);
  
  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
    if (query.trim()) {
      debouncedSearch(query, {});
    }
  }, [query, debouncedSearch]);
  
  // Filtered and sorted products for display
  const displayProducts = useMemo(() => {
    if (!searchResults?.products) return [];
    
    // Apply client-side sorting if needed
    const sortOption = SORT_OPTIONS.find(opt => opt.value === sortBy);
    if (!sortOption) return searchResults.products;
    
    return [...searchResults.products].sort((a, b) => {
      const aValue = a[sortOption.field];
      const bValue = b[sortOption.field];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortOption.order === 'asc' ? comparison : -comparison;
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortOption.order === 'asc' ? comparison : -comparison;
      }
      
      return 0;
    });
  }, [searchResults?.products, sortBy]);
  
  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category?.length) count++;
    if (filters.priceRange) count++;
    if (filters.inStockOnly) count++;
    if (filters.onSaleOnly) count++;
    if (filters.brands?.length) count++;
    if (filters.stores?.length) count++;
    return count;
  }, [filters]);
  
  // Initial search effect
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, initialFilters);
    }
  }, []); // Only run on mount
  
  return (
    <div className={`search-interface ${className}`}>
      {/* Search Header */}
      <div className=\"search-header\">\n        <div className=\"search-input-container\">\n          <div className=\"search-input-wrapper\">\n            <Search className=\"search-icon\" size={20} />\n            <input\n              ref={searchInputRef}\n              type=\"text\"\n              value={query}\n              onChange={handleSearchChange}\n              placeholder=\"Search for groceries, brands, or categories...\"\n              className=\"search-input\"\n              disabled={isSearching}\n            />\n            {query && (\n              <button\n                onClick={clearSearch}\n                className=\"clear-search-button\"\n                aria-label=\"Clear search\"\n              >\n                <X size={16} />\n              </button>\n            )}\n            {isSearching && (\n              <div className=\"search-loading\">\n                <Loader className=\"animate-spin\" size={16} />\n              </div>\n            )}\n          </div>\n        </div>\n        \n        {/* Search Controls */}\n        <div className=\"search-controls\">\n          {showFilters && (\n            <button\n              onClick={() => setShowFiltersPanel(!showFiltersPanel)}\n              className={`filter-toggle-button ${\n                showFiltersPanel || activeFiltersCount > 0 ? 'active' : ''\n              }`}\n            >\n              <Filter size={16} />\n              Filters\n              {activeFiltersCount > 0 && (\n                <span className=\"filter-count\">{activeFiltersCount}</span>\n              )}\n            </button>\n          )}\n          \n          {showSorting && searchResults && (\n            <div className=\"sort-container\">\n              <SortDesc size={16} />\n              <select\n                value={sortBy}\n                onChange={(e) => handleSortChange(e.target.value)}\n                className=\"sort-select\"\n              >\n                {SORT_OPTIONS.map((option) => (\n                  <option key={option.value} value={option.value}>\n                    {option.label}\n                  </option>\n                ))}\n              </select>\n            </div>\n          )}\n          \n          {searchResults && (\n            <div className=\"view-mode-toggle\">\n              <button\n                onClick={() => setViewMode('grid')}\n                className={`view-mode-button ${viewMode === 'grid' ? 'active' : ''}`}\n                aria-label=\"Grid view\"\n              >\n                <Grid size={16} />\n              </button>\n              <button\n                onClick={() => setViewMode('list')}\n                className={`view-mode-button ${viewMode === 'list' ? 'active' : ''}`}\n                aria-label=\"List view\"\n              >\n                <List size={16} />\n              </button>\n            </div>\n          )}\n        </div>\n      </div>\n      \n      {/* Filters Panel */}\n      {showFiltersPanel && (\n        <div className=\"filters-panel\">\n          <SearchFiltersComponent\n            filters={filters}\n            onFiltersChange={handleFiltersChange}\n            onClearFilters={clearFilters}\n            activeCount={activeFiltersCount}\n          />\n        </div>\n      )}\n      \n      {/* Search Results */}\n      <div className=\"search-content\">\n        {error && (\n          <div className=\"search-error\">\n            <AlertCircle size={20} />\n            <div className=\"error-content\">\n              <h3>Search Error</h3>\n              <p>{error}</p>\n              <button\n                onClick={() => performSearch(query, filters)}\n                className=\"retry-button\"\n              >\n                Try Again\n              </button>\n            </div>\n          </div>\n        )}\n        \n        {isSearching && (\n          <div className=\"search-loading-state\">\n            <Loader className=\"animate-spin\" size={32} />\n            <p>Searching products...</p>\n          </div>\n        )}\n        \n        {searchResults && !isSearching && (\n          <>\n            {/* Results Summary */}\n            <div className=\"results-summary\">\n              <div className=\"results-info\">\n                <h2 className=\"results-title\">\n                  {searchResults.totalResults.toLocaleString()} results for \"{searchResults.query}\"\n                </h2>\n                {searchResults.metadata?.processingTime && (\n                  <p className=\"processing-time\">\n                    <Clock size={14} />\n                    Found in {searchResults.metadata.processingTime}ms\n                  </p>\n                )}\n              </div>\n              \n              {searchResults.suggestions && searchResults.suggestions.length > 0 && (\n                <div className=\"search-suggestions\">\n                  <span className=\"suggestions-label\">Try:</span>\n                  {searchResults.suggestions.slice(0, 3).map((suggestion, index) => (\n                    <button\n                      key={index}\n                      onClick={() => {\n                        setQuery(suggestion);\n                        performSearch(suggestion, filters);\n                      }}\n                      className=\"suggestion-chip\"\n                    >\n                      {suggestion}\n                    </button>\n                  ))}\n                </div>\n              )}\n            </div>\n            \n            {/* Products Display */}\n            {displayProducts.length > 0 ? (\n              <div className={`products-container view-mode-${viewMode}`}>\n                <VirtualizedProductList\n                  products={displayProducts}\n                  viewMode={viewMode}\n                  onProductClick={onProductSelect}\n                  itemHeight={viewMode === 'grid' ? 300 : 120}\n                  height={600}\n                />\n                \n                {/* Pagination */}\n                {searchResults.totalResults > itemsPerPage && (\n                  <div className=\"pagination\">\n                    <div className=\"pagination-info\">\n                      Showing {((currentPage - 1) * itemsPerPage) + 1} - {\n                        Math.min(currentPage * itemsPerPage, searchResults.totalResults)\n                      } of {searchResults.totalResults.toLocaleString()}\n                    </div>\n                    \n                    <div className=\"pagination-controls\">\n                      <button\n                        onClick={() => handlePageChange(currentPage - 1)}\n                        disabled={currentPage === 1 || isSearching}\n                        className=\"pagination-button\"\n                      >\n                        Previous\n                      </button>\n                      \n                      <span className=\"current-page\">\n                        Page {currentPage} of {Math.ceil(searchResults.totalResults / itemsPerPage)}\n                      </span>\n                      \n                      <button\n                        onClick={() => handlePageChange(currentPage + 1)}\n                        disabled={\n                          currentPage >= Math.ceil(searchResults.totalResults / itemsPerPage) ||\n                          isSearching\n                        }\n                        className=\"pagination-button\"\n                      >\n                        Next\n                      </button>\n                    </div>\n                  </div>\n                )}\n              </div>\n            ) : (\n              <div className=\"no-results\">\n                <div className=\"no-results-icon\">\n                  <Search size={48} />\n                </div>\n                <h3>No products found</h3>\n                <p>Try adjusting your search terms or filters</p>\n                <div className=\"no-results-actions\">\n                  <button onClick={clearSearch} className=\"clear-search-action\">\n                    Clear Search\n                  </button>\n                  <button onClick={clearFilters} className=\"clear-filters-action\">\n                    Clear Filters\n                  </button>\n                </div>\n              </div>\n            )}\n          </>\n        )}\n        \n        {!searchResults && !isSearching && !error && (\n          <div className=\"search-placeholder\">\n            <div className=\"placeholder-content\">\n              <div className=\"placeholder-icon\">\n                <Search size={64} />\n              </div>\n              <h2>Search for Groceries</h2>\n              <p>Find exactly what you need with our intelligent search</p>\n              \n              <div className=\"popular-searches\">\n                <h3>Popular Searches</h3>\n                <div className=\"popular-chips\">\n                  {['Organic Milk', 'Fresh Produce', 'Gluten Free', 'Protein Bars', 'Coffee'].map((term) => (\n                    <button\n                      key={term}\n                      onClick={() => {\n                        setQuery(term);\n                        performSearch(term, filters);\n                      }}\n                      className=\"popular-chip\"\n                    >\n                      <TrendingUp size={12} />\n                      {term}\n                    </button>\n                  ))}\n                </div>\n              </div>\n            </div>\n          </div>\n        )}\n      </div>\n    </div>\n  );\n};"