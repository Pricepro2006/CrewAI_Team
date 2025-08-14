/**
 * Advanced Walmart Product Search Component
 * Full-featured search with working filters, sorting, and pagination
 */

import React, { useState, useEffect, useCallback } from "react";
import { 
  MagnifyingGlassIcon, 
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  ChevronDownIcon,
  XMarkIcon,
  StarIcon,
  ScaleIcon
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { api } from "../../../lib/trpc.js";
import { WalmartProductCardEnhanced } from "./WalmartProductCardEnhanced.js";
import type { WalmartProduct } from "../../../types/walmart-grocery.js";

interface FilterState {
  category: string;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  inStock: boolean;
  brand: string;
  minRating: number | undefined;
}

interface SortOption {
  value: "relevance" | "price_low" | "price_high" | "rating" | "popular";
  label: string;
  icon?: React.ReactNode;
}

const sortOptions: SortOption[] = [
  { value: "relevance", label: "Most Relevant" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "rating", label: "Highest Rated" },
  { value: "popular", label: "Most Popular" },
];

export const WalmartAdvancedSearch: React.FC = () => {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WalmartProduct[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage] = useState(20);
  
  // Comparison state
  const [compareProducts, setCompareProducts] = useState<WalmartProduct[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<WalmartProduct | null>(null);
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: "",
    minPrice: undefined,
    maxPrice: undefined,
    inStock: false,
    brand: "",
    minRating: undefined,
  });
  
  // Sort state
  const [sortBy, setSortBy] = useState<typeof sortOptions[0]["value"]>("relevance");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // Data for filters
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  
  // Suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Active filters display
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // API calls
  const searchProducts = api.walmartGrocery.searchProducts.useMutation({
    onSuccess: (data) => {
      setSearchResults(data.products || []);
      setTotalResults(data.metadata?.totalResults || 0);
    },
  });

  const { data: categoriesData } = api.walmartGrocery.getCategories.useQuery();
  const { data: brandsData } = api.walmartGrocery.getBrands.useQuery({
    category: filters.category || undefined,
  });
  const { data: priceRangeData } = api.walmartGrocery.getPriceRange.useQuery({
    category: filters.category || undefined,
  });
  
  const getSuggestions = api.walmartGrocery.getSuggestions.useQuery(
    { query: searchQuery, limit: 5 },
    { 
      enabled: searchQuery.length > 2,
      debounce: 300,
    }
  );

  // Load initial data
  useEffect(() => {
    if (categoriesData?.categories) {
      setCategories(categoriesData.categories);
    }
  }, [categoriesData]);

  useEffect(() => {
    if (brandsData?.brands) {
      setBrands(brandsData.brands);
    }
  }, [brandsData]);

  useEffect(() => {
    if (priceRangeData?.priceRange) {
      setPriceRange(priceRangeData.priceRange);
    }
  }, [priceRangeData]);

  useEffect(() => {
    if (getSuggestions.data?.suggestions) {
      setSuggestions(getSuggestions.data.suggestions);
    }
  }, [getSuggestions.data]);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.inStock) count++;
    if (filters.brand) count++;
    if (filters.minRating !== undefined) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  // Search handler
  const handleSearch = useCallback((page: number = 1) => {
    searchProducts.mutate({
      query: searchQuery,
      category: filters.category || undefined,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      inStock: filters.inStock || undefined,
      brand: filters.brand || undefined,
      minRating: filters.minRating,
      sortBy,
      limit: resultsPerPage,
      offset: (page - 1) * resultsPerPage,
    });
    setCurrentPage(page);
    setShowSuggestions(false);
  }, [searchQuery, filters, sortBy, resultsPerPage, searchProducts]);

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      category: "",
      minPrice: undefined,
      maxPrice: undefined,
      inStock: false,
      brand: "",
      minRating: undefined,
    });
  };

  // Remove individual filter
  const removeFilter = (filterKey: keyof FilterState) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: filterKey === "inStock" ? false : filterKey.includes("Price") || filterKey === "minRating" ? undefined : "",
    }));
  };
  
  // Comparison handlers
  const handleCompare = (product: WalmartProduct) => {
    if (compareProducts.find(p => p.id === product.id)) {
      setCompareProducts(compareProducts.filter(p => p.id !== product.id));
    } else if (compareProducts.length < 4) {
      setCompareProducts([...compareProducts, product]);
    }
  };

  const handleQuickView = (product: WalmartProduct) => {
    setQuickViewProduct(product);
  };

  // Pagination
  const totalPages = Math.ceil(totalResults / resultsPerPage);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="walmart-advanced-search">
      {/* Search Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        {/* Search Bar */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(e.target.value.length > 2);
              }}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              onFocus={() => setShowSuggestions(searchQuery.length > 2)}
              placeholder="Search for products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setShowSuggestions(false);
                      handleSearch();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilters ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              Sort: {sortOptions.find(o => o.value === sortBy)?.label}
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            
            {showSortDropdown && (
              <div className="absolute right-0 z-10 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSortDropdown(false);
                      if (searchResults.length > 0) handleSearch();
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                      sortBy === option.value ? "bg-blue-50 text-blue-700" : ""
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={() => handleSearch()}
            disabled={searchProducts.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {searchProducts.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Searching...
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="h-5 w-5" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600">Active filters:</span>
            
            {filters.category && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Category: {filters.category}
                <button onClick={() => removeFilter("category")}>
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            )}
            
            {filters.brand && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Brand: {filters.brand}
                <button onClick={() => removeFilter("brand")}>
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            )}
            
            {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Price: ${filters.minPrice || 0} - ${filters.maxPrice || "∞"}
                <button onClick={() => {
                  setFilters(prev => ({ ...prev, minPrice: undefined, maxPrice: undefined }));
                }}>
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            )}
            
            {filters.inStock && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                In Stock Only
                <button onClick={() => removeFilter("inStock")}>
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            )}
            
            {filters.minRating !== undefined && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Rating: {filters.minRating}+ stars
                <button onClick={() => removeFilter("minRating")}>
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            )}
            
            <button
              onClick={clearAllFilters}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <select
                value={filters.brand}
                onChange={(e) => setFilters(prev => ({ ...prev, brand: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={brands.length === 0}
              >
                <option value="">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Range
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={filters.minPrice || ""}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    minPrice: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  placeholder={`$${priceRange.min}`}
                  className="w-24 px-2 py-2 border border-gray-300 rounded"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  value={filters.maxPrice || ""}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    maxPrice: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  placeholder={`$${priceRange.max}`}
                  className="w-24 px-2 py-2 border border-gray-300 rounded"
                />
              </div>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Rating
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setFilters(prev => ({ 
                      ...prev, 
                      minRating: prev.minRating === rating ? undefined : rating 
                    }))}
                    className="p-1"
                  >
                    {filters.minRating !== undefined && rating <= filters.minRating ? (
                      <StarIconSolid className="h-6 w-6 text-yellow-400" />
                    ) : (
                      <StarIcon className="h-6 w-6 text-gray-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock Filter */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={(e) => setFilters(prev => ({ ...prev, inStock: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">In Stock Only</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      {totalResults > 0 && !searchProducts.isPending && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {((currentPage - 1) * resultsPerPage) + 1}-{Math.min(currentPage * resultsPerPage, totalResults)} of {totalResults} results
          {searchQuery && ` for "${searchQuery}"`}
        </div>
      )}

      {/* Loading State */}
      {searchProducts.isPending && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {searchProducts.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error searching products. Please try again.
        </div>
      )}

      {/* Comparison Bar */}
      {compareProducts.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScaleIcon className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Comparing {compareProducts.length} products (max 4)</span>
            </div>
            <button
              onClick={() => setCompareProducts([])}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear comparison
            </button>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {searchResults.map((product) => (
              <WalmartProductCardEnhanced 
                key={product.id} 
                product={product}
                onCompare={handleCompare}
                onQuickView={handleQuickView}
                isCompared={compareProducts.some(p => p.id === product.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => handleSearch(currentPage - 1)}
                disabled={!canGoPrevious}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handleSearch(pageNum)}
                      className={`px-3 py-1 rounded ${
                        currentPage === pageNum
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handleSearch(currentPage + 1)}
                disabled={!canGoNext}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* No Results */}
      {searchResults.length === 0 && searchProducts.isSuccess && (
        <div className="text-center py-12">
          <p className="text-gray-500">No products found. Try adjusting your search criteria.</p>
        </div>
      )}
    </div>
  );
};